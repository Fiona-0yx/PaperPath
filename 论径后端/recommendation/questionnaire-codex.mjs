import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

const MAX_RUN_MS = 120_000;
const MAX_OUTPUT_BYTES = 64 * 1024;
const DISABLED_FEATURES = [
  'shell_tool', 'unified_exec', 'apps', 'plugins', 'browser_use',
  'browser_use_external', 'computer_use', 'in_app_browser', 'image_generation',
  'hooks', 'memories', 'multi_agent', 'multi_agent_v2', 'goals', 'sleep_tool', 'view_image',
  'code_mode_host', 'auth_elicitation'
];

async function configuredModel(env) {
  const override = env.QUESTIONNAIRE_CODEX_MODEL?.trim();
  if (override) return override;

  const home = env.CODEX_HOME || path.join(homedir(), '.codex');
  try {
    const config = await readFile(path.join(home, 'config.toml'), 'utf8');
    // Import only a plain top-level model name. The CLI loads its own auth.
    const root = config.split(/^\s*\[/m, 1)[0];
    return root.match(/^\s*model\s*=\s*"([\w.:-]+)"\s*(?:#.*)?$/m)?.[1] ??
      root.match(/^\s*model\s*=\s*'([\w.:-]+)'\s*(?:#.*)?$/m)?.[1];
  } catch {
    return undefined;
  }
}

function runProcess(bin, args, { directory, env, prompt, signal }) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Codex request cancelled or timed out'));
      return;
    }

    const child = spawn(bin, args, {
      cwd: directory,
      env,
      windowsHide: true,
      stdio: ['pipe', 'ignore', 'ignore']
    });
    let failedToStart = false;
    const stop = () => child.kill('SIGKILL');
    signal.addEventListener('abort', stop, { once: true });

    child.on('error', error => { failedToStart = error; });
    child.stdin.on('error', () => { /* Early CLI exit is handled on close. */ });
    child.once('close', code => {
      signal.removeEventListener('abort', stop);
      if (signal.aborted) reject(new Error('Codex request cancelled or timed out'));
      else if (failedToStart) reject(Object.assign(new Error('Could not start Codex CLI'), {code:failedToStart.code}));
      else if (code !== 0) reject(new Error(`Codex CLI exited with code ${code ?? 'unknown'}`));
      else resolve();
    });
    child.stdin.end(prompt, 'utf8');
  });
}

async function codexExecutable(env) {
  const configured = env.QUESTIONNAIRE_CODEX_BIN?.trim() || 'codex';
  if (process.platform !== 'win32')
    return /[\\/]/.test(configured) ? path.resolve(configured) : configured;
  const searchPath = env.Path || env.PATH || '';
  const dirs = /[\\/]/.test(configured)
    ? [path.dirname(path.resolve(configured))]
    : searchPath.split(path.delimiter).filter(Boolean).map(dir => dir.replace(/^"|"$/g, '')).filter(path.isAbsolute);
  const filename = path.basename(configured, path.extname(configured));
  const extension = path.extname(configured).toLowerCase();
  const target = process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
  for (const dir of dirs) {
    const native = extension === '.exe' ? path.basename(configured) : filename + '.exe';
    const candidates = [path.join(dir, native)];
    // npm shims locate the packaged native binary without invoking a shell.
    if (filename.toLowerCase() === 'codex' && extension !== '.exe') {
      for (const modules of [path.join(dir, 'node_modules'), path.dirname(dir)]) {
        for (const pkg of ['codex-win32-' + process.arch, 'codex']) {
          for (const subpath of ['bin', 'codex']) {
            candidates.push(path.join(modules, '@openai', pkg, 'vendor', target, subpath, 'codex.exe'));
          }
        }
      }
    }
    for (const candidate of candidates) {
      if ((await stat(candidate).catch(() => null))?.isFile()) return candidate;
    }
  }
  if (['.cmd', '.ps1', '.bat'].includes(extension))
    throw Object.assign(new Error('Could not resolve the Codex shim to a native binary'), {code:'ENOENT'});
  return configured;
}

export async function runCodexJson({ prompt, schema, env = process.env, signal }) {
  const runSignal = signal ?? AbortSignal.timeout(MAX_RUN_MS);
  runSignal.throwIfAborted();
  const directory = await mkdtemp(path.join(tmpdir(), 'lun-path-codex-'));
  try {
    const output = path.join(directory, 'output.json');
    const schemaFile = path.join(directory, 'schema.json');
    await writeFile(schemaFile, JSON.stringify(schema), { mode: 0o600 });

    const bin = await codexExecutable(env);
    const model = await configuredModel(env);
    const args = [
      '--ask-for-approval', 'never', 'exec',
      '--sandbox', 'read-only', '--ephemeral', '--skip-git-repo-check',
      '--ignore-user-config', '--ignore-rules', '--color', 'never',
      '--config', 'web_search="disabled"',
      '--config', 'mcp_servers={}',
      '--config', 'project_doc_max_bytes=0',
      '--config', 'model_reasoning_effort="low"',
      ...DISABLED_FEATURES.flatMap(feature => ['--disable', feature]),
      '--output-schema', schemaFile, '--output-last-message', output,
      ...(model ? ['--model', model] : []), '-'
    ];
    const childEnv = { ...env };
    delete childEnv.PLAN_LLM_API_KEY;
    delete childEnv.QUESTIONNAIRE_MODEL_API_KEY;
    await runProcess(bin, args, { directory, env: childEnv, prompt, signal: runSignal });

    try {
      const { size } = await stat(output);
      if (!size || size > MAX_OUTPUT_BYTES) throw new Error('Invalid output size');
      const parsed = JSON.parse(await readFile(output, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid output type');
      return parsed;
    } catch {
      throw new Error('Codex CLI did not return a structured result');
    }
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 2 });
  }
}

export const runQuestionnaireCodex = runCodexJson;
