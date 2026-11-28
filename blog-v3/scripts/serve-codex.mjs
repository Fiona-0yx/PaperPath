import { createServer } from 'vite';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

process.env.LUNJING_MODEL_PROVIDER = 'codex';
process.env.QUESTIONNAIRE_MODEL_PROVIDER = 'codex';

const pythonPackages = resolve('../复杂前端/lun-path/.runtime/python');
if (existsSync(pythonPackages)) {
  process.env.PYTHONPATH = [pythonPackages, process.env.PYTHONPATH].filter(Boolean).join(delimiter);
}
const pythonCandidates = [
  process.env.LUNJING_PYTHON,
  resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),
  'python',
].filter(Boolean);
const python = pythonCandidates.find(candidate =>
  spawnSync(candidate, ['-c', 'import jsonschema'], { windowsHide: true }).status === 0,
);
if (!python) {
  throw new Error('缺少 Python jsonschema 依赖。请先在 blog-v3 运行 pnpm setup:python。');
}
process.env.LUNJING_PYTHON = python;

const server = await createServer({
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PORT || 8080),
    strictPort: true,
    open: false,
    cors: false,
  },
});
await server.listen();
server.printUrls();
