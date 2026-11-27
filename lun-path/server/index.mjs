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
const EVENT_FIELDS = ['kind', 'action', 'source', 'userId', 'noteId', 'noteType', 'filter', 'reason', 'resolved', 'status', 'crossPaper', 'paperId', 'paperTitle', 'categoryId', 'sectionId', 'sectionHeading', 'paragraphIndex', 'textLength', 'text', 'lang'];
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
    if (typeof value === 'number') out[key] = Number.isFinite(value) ? value : 0;
    else if (typeof value === 'boolean') out[key] = value;
    else out[key] = String(value).slice(0, 300);
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
// Normalise a selected phrase into a stable comparison key.
function termKey(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
}
// Deterministic observations built only from counts in the local log. Each entry
// states the rule that produced it, so the UI can label it as a rule rather than
// an agent verdict. Nothing here is inferred from content semantics.
function buildObservations(agg) {
  const out = [];
  if (agg.acted < 2 || agg.total < 3) return out;
  const push = (id, title, text, evidence, rule) => { out.push({id, title, text, evidence, rule, method: 'rule'}); };

  const repeated = (agg.weakTerms || []).filter((item) => item.count >= 2).slice(0, 3);
  if (repeated.length) {
    push('repeated-terms', '反复出现的疑问词',
      '同一处词句被反复标记：' + repeated.map((item) => '「' + item.term + '」').join('') + '，这些概念可能还没有吃透。',
      repeated.map((item) => item.term + ' ×' + item.count).join('，'),
      '同一词句被记录 ≥ 2 次');
  }

  if (agg.sectionTotal >= 4 && agg.topSections && agg.topSections.length) {
    const top = agg.topSections[0];
    const share = top.count / agg.sectionTotal;
    if (share >= 0.4) {
      push('section-focus', '疑问集中的章节',
        '你的记录有 ' + Math.round(share * 100) + '% 落在「' + top.section + '」，建议回到这一节重读一遍。',
        top.section + ' ' + top.count + '/' + agg.sectionTotal + ' 条记录',
        '单章节占比 ≥ 40%');
    }
  }

  const marked = ['question', 'explain', 'bookmark'].reduce((sum, key) => sum + (Number(agg.byAction && agg.byAction[key]) || 0), 0);
  if (marked >= 3) {
    const labels = {question: '有疑问', explain: '需要进一步解释', bookmark: '收藏'};
    const favorite = ['question', 'explain', 'bookmark']
      .map((key) => [key, Number(agg.byAction[key]) || 0])
      .sort((a, b) => b[1] - a[1])[0];
    if (favorite[1] / marked >= 0.6) {
      push('type-preference', '记录习惯',
        '你更常用「' + labels[favorite[0]] + '」来标记内容，占全部记录的 ' + Math.round(favorite[1] / marked * 100) + '%。',
        labels[favorite[0]] + ' ' + favorite[1] + '/' + marked,
        '单一记录类型占比 ≥ 60%');
    }
  }

  if (agg.menuOpened >= 4 && agg.dismissed / agg.menuOpened >= 0.4) {
    push('menu-dismissal', '选中后放弃的比例',
      '有 ' + agg.dismissed + ' 次选中后没有记录就关掉了菜单（共 ' + agg.menuOpened + ' 次右键），可能还没想好该怎么记。',
      agg.dismissed + '/' + agg.menuOpened,
      '放弃占比 ≥ 40% 且右键 ≥ 4 次');
  }

  const life = agg.lifecycle || {};
  if (agg.acted >= 3 && (life.resolved || life.reopened || life.deleted)) {
    push('lifecycle', '疑问的处理进度',
      '记录了 ' + agg.acted + ' 条，其中已解决 ' + (life.resolved || 0) + ' 条' +
      (life.reopened ? '、重新打开 ' + life.reopened + ' 条' : '') +
      (life.deleted ? '、删除 ' + life.deleted + ' 条' : '') + '。',
      'created ' + agg.acted + ' · resolved ' + (life.resolved || 0) + ' · reopened ' + (life.reopened || 0) + ' · deleted ' + (life.deleted || 0),
      '有处理动作时汇总');
  }

  if (life.jumped >= 2) {
    push('revisit', '回看原文的习惯',
      '你回看原文核对过 ' + life.jumped + ' 次，会主动确认出处。',
      'jumped ' + life.jumped,
      '回看次数 ≥ 2');
  }

  if (agg.days >= 2) {
    push('active-days', '学习节奏',
      '记录分布在 ' + agg.days + ' 个不同日期。',
      '活跃天数 ' + agg.days,
      '活跃天数 ≥ 2');
  }

  if (agg.papers >= 2) {
    push('coverage', '阅读覆盖',
      '你的记录分布在 ' + agg.papers + ' 篇论文里。',
      '论文数 ' + agg.papers,
      '涉及论文 ≥ 2 篇');
  }

  return out.slice(0, 5);
}
async function handleReaderSummary(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); fail(405, 'METHOD_NOT_ALLOWED', 'Unsupported HTTP method'); }
  let lines = [];
  try { lines = (await readFile(EVENTS_FILE, 'utf8')).split('\n').filter(Boolean); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const events = [];
  for (const line of lines) { try { events.push(JSON.parse(line)); } catch { /* skip malformed line */ } }
  const byKind = {}, byAction = {}, byPaper = {}, bySection = {}, byUser = {}, byReason = {}, sectionLabels = {};
  const terms = new Map();
  let menuOpened = 0, dismissed = 0, acted = 0;
  let resolvedCount = 0, reopenedCount = 0, deletedCount = 0, jumpedCount = 0;
  let firstAt = null, lastAt = null;
  const days = new Set();
  for (const event of events) {
    const time = Number(event.at) || Number(event.receivedAt) || 0;
    if (time) {
      if (!firstAt || time < firstAt) firstAt = time;
      if (!lastAt || time > lastAt) lastAt = time;
      days.add(new Date(time).toISOString().slice(0, 10));
    }
    byKind[event.kind] = (byKind[event.kind] || 0) + 1;
    if (event.action) byAction[event.action] = (byAction[event.action] || 0) + 1;
    if (event.paperId) byPaper[event.paperId] = (byPaper[event.paperId] || 0) + 1;
    if (event.sectionId) {
      bySection[event.sectionId] = (bySection[event.sectionId] || 0) + 1;
      if (event.sectionHeading) sectionLabels[event.sectionId] = event.sectionHeading;
    }
    if (event.userId) byUser[event.userId] = (byUser[event.userId] || 0) + 1;
    if (event.kind === 'menu-opened') menuOpened += 1;
    if (event.kind === 'menu-dismissed') { dismissed += 1; const reason = event.reason || 'unknown'; byReason[reason] = (byReason[reason] || 0) + 1; }
    if (event.kind === 'action') {
      acted += 1;
      if (event.action === 'question' || event.action === 'explain') {
        const key = termKey(event.text);
        if (key) terms.set(key, (terms.get(key) || 0) + 1);
      }
    }
    if (event.kind === 'note-resolve') { if (event.resolved === true) resolvedCount += 1; else if (event.resolved === false) reopenedCount += 1; }
    if (event.kind === 'note-delete') deletedCount += 1;
    if (event.kind === 'note-jump') jumpedCount += 1;
  }
  const weakTerms = [...terms.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([term, count]) => ({term, count}));
  const topSections = Object.entries(bySection)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, count]) => ({section: sectionLabels[id] || id, sectionId: id, count}));
  const sectionTotal = Object.values(bySection).reduce((sum, count) => sum + count, 0);
  const observations = buildObservations({
    total: events.length, acted, menuOpened, dismissed, weakTerms, topSections,
    sectionTotal, byAction, days: days.size, papers: Object.keys(byPaper).length,
    lifecycle: {resolved: resolvedCount, reopened: reopenedCount, deleted: deletedCount, jumped: jumpedCount},
  });
  json(res, {
    total: events.length,
    updatedAt: Date.now(),
    byKind, byAction, byPaper, byUser, byReason,
    weakTerms,
    topSections,
    observations,
    papers: Object.keys(byPaper).length,
    funnel: {menuOpened, dismissed, acted, conversion: menuOpened ? Number((acted / menuOpened).toFixed(3)) : null},
    lifecycle: {created: acted, resolved: resolvedCount, reopened: reopenedCount, deleted: deletedCount, jumped: jumpedCount},
    span: {firstAt, lastAt, days: days.size},
    recent: events.slice(-20),
  });
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
