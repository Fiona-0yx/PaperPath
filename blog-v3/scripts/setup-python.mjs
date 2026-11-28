import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const python = process.env.LUNJING_PYTHON ||
  resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const target = resolve('../复杂前端/lun-path/.runtime/python');
const requirements = resolve('../论径后端/requirements.txt');
await mkdir(target, { recursive: true });

const code = await new Promise((resolveCode, reject) => {
  const child = spawn(python, [
    '-m', 'pip', 'install', '--disable-pip-version-check',
    '--target', target, '-r', requirements,
  ], { windowsHide: true, stdio: 'inherit' });
  child.once('error', reject);
  child.once('close', resolveCode);
});
if (code !== 0) process.exitCode = code;
