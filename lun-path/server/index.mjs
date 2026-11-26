import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, realpath, stat, mkdir, appendFile } from 'node:fs/promises';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2' };
const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code});};
function json(res,value,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const within = (base, target) => { const rel = path.relative(base, target); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };

// ——— reading interaction events (right-click / notes), collected for later agent use ———
const DATA_DIR = path.join(ROOT, 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'reader-events.jsonl');
const MAX_EVENT_BYTES = 16 * 1024;
const EVENT_FIELDS = ['kind', 'action', 'paperId', 'paperTitle', 'categoryId', 'sectionId', 'sectionHeading', 'paragraphIndex', 'textLength', 'text', 'lang'];
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0, done = false; const chunks = [];
    req.on('data', chunk => {
      if (done) return;
      size += chunk.length;
      if (size > limit) { done = true; reject(Object.assign(new Error('Payload too large'), {status: 413, code: 'PAYLOAD_TOO_LARGE'})); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks).toString('utf8')); } });
    req.on('error', error => { if (!done) { done = true; reject(error); } });
  });
}
function cleanEvent(raw) {
  const out = {};
  for (const key of EVENT_FIELDS) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    out[key] = typeof value === 'number' ? (Number.isFinite(value) ? value : 0) : String(value).slice(0, 300);
  }
  out.at = Number(raw.at) || Date.now();
  out.receivedAt = Date.now();
  return out;
}
async function handleReaderEvent(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); fail(405, 'METHOD_NOT_ALLOWED', 'Unsupported HTTP method'); }
  const text = await readBody(req, MAX_EVENT_BYTES);
  let raw;
  try { raw = JSON.parse(text); } catch { fail(400, 'INVALID_JSON', 'Body must be JSON'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(400, 'INVALID_BODY', 'Body must be a JSON object');
  const event = cleanEvent(raw);
  if (!event.kind) fail(400, 'INVALID_EVENT', 'Missing kind');
  await mkdir(DATA_DIR, {recursive: true});
  await appendFile(EVENTS_FILE, JSON.stringify(event) + '\n', 'utf8');
  res.writeHead(204, {'Cache-Control': 'no-store'});
  res.end();
}
async function handleReaderSummary(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); fail(405, 'METHOD_NOT_ALLOWED', 'Unsupported HTTP method'); }
  let lines = [];
  try { lines = (await readFile(EVENTS_FILE, 'utf8')).split('\n').filter(Boolean); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const events = [];
  for (const line of lines) { try { events.push(JSON.parse(line)); } catch { /* skip malformed line */ } }
  const byKind = {}, byAction = {}, byPaper = {};
  for (const event of events) {
    byKind[event.kind] = (byKind[event.kind] || 0) + 1;
    if (event.action) byAction[event.action] = (byAction[event.action] || 0) + 1;
    const key = event.paperId || 'unknown';
    byPaper[key] = (byPaper[key] || 0) + 1;
  }
  json(res, {total: events.length, byKind, byAction, byPaper, recent: events.slice(-20)});
}
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
      if (url.pathname === '/api/health') json(res, {ok:true,service:'lun-path',scope:'vine-and-overview'});
      else if (url.pathname === '/api/reader/events') await handleReaderEvent(req, res);
      else if (url.pathname === '/api/reader/summary') await handleReaderSummary(req, res);
      else if (url.pathname.startsWith('/api/')) fail(404,'NOT_FOUND','Unknown API route');
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
  createServer().listen(port, '127.0.0.1', () => console.log(`Lun Path demo: http://localhost:${port} (vine and overview)`));
}
