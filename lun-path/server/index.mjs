import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, realpath, stat } from 'node:fs/promises';
import { generateInternalReport } from './questionnaire-api.mjs';
import { paperCatalog } from './paper-catalog.mjs';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2' };
const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code});};
function json(res,value,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const within = (base, target) => { const rel = path.relative(base, target); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };
function servePaperSample(req, res, pathname) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    fail(405, 'METHOD_NOT_ALLOWED', 'Sample papers support GET and HEAD.');
  }
  const paper = paperCatalog.find(({id}) => pathname === '/papers/' + id);
  if (!paper) fail(404, 'NOT_FOUND', 'Sample paper not found.');
  const title = paper.title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { margin: 0; padding: clamp(24px, 8vw, 100px); background: #faf7ec; color: #353a2e; }
  h1 { max-width: 24ch; margin: 0 auto; font: 400 clamp(28px, 5vw, 58px)/1.17 Georgia, serif; overflow-wrap: anywhere; }
</style>
<main><h1>${title}</h1></main>
</html>`;
  res.writeHead(200, {'Content-Type': MIME['.html'], 'X-Content-Type-Options': 'nosniff'});
  res.end(req.method === 'HEAD' ? undefined : html);
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
export function createServer({ reportDirectory } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/health') json(res, {ok:true,service:'lun-path',scope:'vine-and-overview'});
      else if (url.pathname === '/api/questionnaire/analyze') {
        json(res, await generateInternalReport(req, res, reportDirectory, {
          includeReport: url.searchParams.get('include') === 'report',
          locale: url.searchParams.get('lang') === 'en' ? 'en' : 'zh'
        }));
      }
      else if (url.pathname.startsWith('/api/')) fail(404,'NOT_FOUND','Unknown API route');
      else if (url.pathname.startsWith('/papers/')) servePaperSample(req, res, url.pathname);
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
