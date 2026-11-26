import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeQuestionnaire } from './questionnaire-report.mjs';
import { enrichQuestionnaire } from './questionnaire-model.mjs';
import { recommendPapers } from './recommend-papers.mjs';

const defaultDirectory = fileURLToPath(new URL('../.local/questionnaire-reports/', import.meta.url));
const maxBytes = 256 * 1024;

function reject(status, code, message) {
  throw Object.assign(new Error(message), { status, code });
}

async function readSubmission(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    reject(415, 'JSON_REQUIRED', 'Send the submitted portrait as application/json.');
  }
  if (Number(req.headers['content-length']) > maxBytes) reject(413, 'TOO_LARGE', 'Submission exceeds 256 KiB.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBytes) {
      req.resume();
      reject(413, 'TOO_LARGE', 'Submission exceeds 256 KiB.');
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    reject(400, 'INVALID_JSON', 'Invalid JSON body.');
  }
}

export async function generateInternalReport(req, res, directory = defaultDirectory, { includeReport, locale = 'zh' } = {}) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    reject(405, 'METHOD_NOT_ALLOWED', 'Submit the questionnaire using POST.');
  }
  const snapshot = await readSubmission(req);
  const analysis = analyzeQuestionnaire(snapshot, { locale });
  const model = await enrichQuestionnaire(analysis, { locale });
  const readingPlan = recommendPapers(analysis, model, locale);
  const id = createHash('sha256').update(JSON.stringify({ analysis, model, locale, readingPlan })).digest('hex');
  let report = { id, generatedAt: new Date().toISOString(), locale, readingPlan, analysis, model };

  await mkdir(directory, { recursive: true });
  const temporary = path.join(directory, randomUUID() + '.tmp');
  const filename = path.join(directory, id + '.json');
  try {
    await writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    // Publish the completed file once, even when identical submissions finish together.
    try {
      await link(temporary, filename);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (includeReport) report = JSON.parse(await readFile(filename, 'utf8'));
    }
  } finally {
    await rm(temporary, { force: true });
  }
  return { reportId: id, modelStatus: model.status, ...(includeReport && { report }) };
}
