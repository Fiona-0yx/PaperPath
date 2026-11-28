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
      reject(new Error('Codex questionnaire cancelled or timed out'));
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

    child.on('error', () => { failedToStart = true; });
    child.stdin.on('error', () => { /* Early CLI exit is handled on close. */ });
    child.once('close', code => {
      signal.removeEventListener('abort', stop);
      if (signal.aborted) reject(new Error('Codex questionnaire cancelled or timed out'));
      else if (failedToStart) reject(new Error('Could not start Codex CLI'));
      else if (code !== 0) reject(new Error(`Codex CLI exited with code ${code ?? 'unknown'}`));
      else resolve();
    });
    child.stdin.end(prompt, 'utf8');
  });
}

export async function runQuestionnaireCodex({ prompt, schema, env = process.env, signal }) {
  const runSignal = signal ?? AbortSignal.timeout(MAX_RUN_MS);
  runSignal.throwIfAborted();
  const directory = await mkdtemp(path.join(tmpdir(), 'lun-path-questionnaire-'));
  try {
    const output = path.join(directory, 'output.json');
    const schemaFile = path.join(directory, 'schema.json');
    await writeFile(schemaFile, JSON.stringify(schema), { mode: 0o600 });

    const configuredBin = env.QUESTIONNAIRE_CODEX_BIN?.trim();
    const bin = configuredBin && /[\\/]/.test(configuredBin)
      ? path.resolve(configuredBin)
      : configuredBin || 'codex';
    const model = await configuredModel(env);
    const args = [
      '--ask-for-approval', 'never', 'exec',
      '--sandbox', 'read-only', '--ephemeral', '--skip-git-repo-check',
      '--ignore-user-config', '--ignore-rules', '--color', 'never',
      '--config', 'web_search="disabled"',
      '--config', 'mcp_servers={}',
      '--config', 'project_doc_max_bytes=0',
      ...DISABLED_FEATURES.flatMap(feature => ['--disable', feature]),
      '--output-schema', schemaFile, '--output-last-message', output,
      ...(model ? ['--model', model] : []), '-'
    ];
    await runProcess(bin, args, { directory, env, prompt, signal: runSignal });

    try {
      const { size } = await stat(output);
      if (!size || size > MAX_OUTPUT_BYTES) throw new Error('Invalid output size');
      const parsed = JSON.parse(await readFile(output, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid output type');
      return parsed;
    } catch {
      throw new Error('Codex CLI did not return a structured questionnaire result');
    }
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 2 });
  }
}
