import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, realpath, stat } from 'node:fs/promises';
import { papers, branches, nextQuestion, analyzeIntroduction, scoreAssessment, getTutorReply } from '../shared/domain.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MAX_BODY = 64 * 1024;
const FIELDS = ['goal', 'direction', 'experience', 'deadline', 'output'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const fail = (status, code, message, details) => { throw Object.assign(new Error(message), { status, code, details }); };
const object = (value, label) => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'INVALID_BODY', `${label} must be an object`); return value; };
const string = (value, label, max = 12000) => { if (typeof value !== 'string' || value.length > max) fail(400, 'INVALID_FIELD', `${label} must be a string of at most ${max} characters`); return value; };
const enumeration = (value, allowed, label) => { if (!allowed.includes(value)) fail(400, 'INVALID_ENUM', `Invalid ${label}`, { field: label, allowed }); return value; };
function profileValue(value = {}) {
  object(value, 'profile');
  for (const key of FIELDS) if (value[key] !== undefined) string(value[key], `profile.${key}`, 2000);
  return Object.fromEntries(FIELDS.map(k => [k, value[k] ?? '']));
}
async function body(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json');
  if (Number(req.headers['content-length']) > MAX_BODY) fail(413, 'BODY_TOO_LARGE', 'JSON body exceeds 65536 bytes');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) fail(413, 'BODY_TOO_LARGE', 'JSON body exceeds 65536 bytes');
    chunks.push(chunk);
  }
  let parsed;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail(400, 'INVALID_JSON', 'Request body must contain valid JSON'); }
  return object(parsed, 'body');
}
function json(res, value, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function validatePaper(data) {
  enumeration(data.paperId, papers.map(p => p.id), 'paperId');
  if (data.sectionId !== undefined) enumeration(data.sectionId, papers.find(p => p.id === data.paperId).sections.map(s => s.id), 'sectionId');
}
async function api(req, res, url) {
  const routes = { '/api/health': 'GET', '/api/papers': 'GET', '/api/planner/next': 'POST', '/api/assessment': 'POST', '/api/tutor': 'POST', '/api/critic': 'POST', '/api/profile/update': 'POST' };
  if (!routes[url.pathname]) fail(404, 'NOT_FOUND', 'Unknown API route');
  if (req.method !== routes[url.pathname]) { res.setHeader('Allow', routes[url.pathname]); fail(405, 'METHOD_NOT_ALLOWED', 'Unsupported HTTP method'); }
  if (url.pathname === '/api/health') return json(res, { ok: true, service: 'lun-path', mode: 'demo', isLLM: false, modelConfigured: false, retrievalConfigured: false });
  if (url.pathname === '/api/papers') {
    const branch = url.searchParams.get('branch');
    if (branch !== null) enumeration(branch, branches.map(b => b.id), 'branch');
    return json(res, { papers: branch ? papers.filter(p => p.branch === branch) : papers, branches, mode: 'demo', isRetrieval: false });
  }
  const data = await body(req);
  if (data.lang !== undefined) enumeration(data.lang, ['zh', 'en'], 'lang');
  if (url.pathname === '/api/planner/next') {
    const profile = profileValue(data.profile);
    const history = data.history ?? [];
    if (!Array.isArray(history) || history.length > 200) fail(400, 'INVALID_FIELD', 'history must be an array with at most 200 entries');
    for (const entry of history) { object(entry, 'history entry'); enumeration(entry.field, FIELDS, 'history.field'); string(entry.value, 'history.value', 2000); }
    return json(res, nextQuestion(profile, history, data.lang));
  }
  if (url.pathname === '/api/profile/update') {
    const profile = profileValue(data.profile);
    const text = data.text ?? data.introduction ?? '';
    string(text, 'text');
    const result = analyzeIntroduction(text, data.lang);
    result.profile = { ...profile, ...Object.fromEntries(Object.entries(result.profile).filter(([, v]) => v)) };
    if (data.field !== undefined) {
      enumeration(data.field, FIELDS, 'field');
      string(data.value, 'value', 2000);
      if (data.value !== 'skip') { result.profile[data.field] = data.value; result.evidence.push({ field: data.field, value: data.value, quote: data.value, source: 'user-answer' }); }
    }
    result.unknowns = FIELDS.filter(f => !result.profile[f]);
    return json(res, result);
  }
  validatePaper(data);
  if (url.pathname === '/api/assessment') {
    enumeration(data.stage ?? 'diagnostic', ['diagnostic', 'final'], 'stage');
    if (data.other !== undefined) string(data.other, 'other', 4000);
    if (data.confidence !== undefined && !(typeof data.confidence === 'number' && Number.isFinite(data.confidence) && data.confidence >= 0 && data.confidence <= 100)) enumeration(data.confidence, ['low', 'medium', 'high', 'uncertain'], 'confidence');
    try { return json(res, scoreAssessment(data)); }
    catch (error) { if (error instanceof RangeError) fail(400, 'INVALID_ANSWER', error.message); throw error; }
  }
  if (url.pathname === '/api/tutor') {
    string(data.question ?? '', 'question', 4000);
    return json(res, getTutorReply(data));
  }
  const text = data.text ?? data.draft ?? data.question ?? '';
  string(text, 'text');
  const citation = getTutorReply(data);
  const en = data.lang === 'en';
  return json(res, { ...citation, reply: en ? 'Rule-based critic demo, not an actual LLM. Check whether your claim names a metric, comparison protocol and limitation. This service does not verify the truth of your draft.' : '规则质疑演示，并非实际 LLM。请检查主张是否说明指标、比较协议与局限；本服务不核验草稿真实性。',
    checks: [ { id: 'claim', question: en ? 'What exactly is claimed?' : '主张具体是什么？' }, { id: 'evidence', question: en ? 'Which original passage supports it?' : '哪段原文支持它？' }, { id: 'limit', question: en ? 'What remains unknown?' : '哪些信息仍未知？' } ], inputLength: text.length });
}
const within = (base, target) => { const rel = path.relative(base, target); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };
async function serveStatic(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); fail(405, 'METHOD_NOT_ALLOWED', 'Unsupported HTTP method'); }
  let decoded;
  try { decoded = decodeURIComponent(url.pathname); } catch { fail(400, 'INVALID_PATH', 'Invalid URL encoding'); }
  if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').some(s => s.startsWith('.'))) fail(403, 'FORBIDDEN', 'Path is not public');
  const mount = decoded.startsWith('/src/') ? 'src' : decoded.startsWith('/shared/') ? 'shared' : 'public';
  const relative = mount === 'public' ? decoded.slice(1) || 'index.html' : decoded.slice(mount.length + 2);
  const base = path.join(ROOT, mount);
  const target = path.resolve(base, relative);
  if (!within(base, target)) fail(403, 'FORBIDDEN', 'Path is not public');
  try {
    const [actualBase, actualTarget] = await Promise.all([realpath(base), realpath(target)]);
    if (!within(actualBase, actualTarget)) fail(403, 'FORBIDDEN', 'Path is not public');
    if (!(await stat(actualTarget)).isFile()) fail(404, 'NOT_FOUND', 'File not found');
    const buffer = await readFile(actualTarget);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(actualTarget).toLowerCase()] || 'application/octet-stream', 'Content-Length': buffer.length, 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : buffer);
  } catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) fail(404, 'NOT_FOUND', 'File not found'); throw error; }
}
export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else await serveStatic(req, res, url);
    } catch (error) {
      if (res.headersSent || res.destroyed) return;
      json(res, { error: { code: error.code && error.status ? error.code : 'INTERNAL_ERROR', message: error.status ? error.message : 'Internal server error', ...(error.details ? { details: error.details } : {}) } }, error.status || 500);
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 5180);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError('PORT must be an integer from 1 to 65535');
  createServer().listen(port, '127.0.0.1', () => console.log(`Lun Path demo: http://localhost:${port} (rule-based fixtures; no LLM or retrieval configured)`));
}
