import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createServer } from '../server/index.mjs';
import { paperCatalog } from '../server/paper-catalog.mjs';

function configureModel(t, env) {
  const configKeys = new Set([
    ...Object.keys(process.env).filter(key => key.startsWith('QUESTIONNAIRE_MODEL_')),
    ...Object.keys(env)
  ]);
  const previous = [...configKeys].map(key => [key, process.env[key]]);
  for (const key of configKeys) delete process.env[key];
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('submitting a portrait stores a private report and returns its receipt', async t => {
  configureModel(t, { QUESTIONNAIRE_MODEL_PROVIDER: 'none' });
  const directory = await mkdtemp(path.join(tmpdir(), 'questionnaire-api-'));
  const server = createServer({ reportDirectory: directory });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const url = origin + '/api/questionnaire/analyze';
  const post = (body, type = 'application/json', query = '') => fetch(url + query, {
    method: 'POST', headers: { 'Content-Type': type }, body
  });
  const body = JSON.stringify({ answers: { foundation: { source: 'check', values: [1] } }, evidence: {} });
  const responses = await Promise.all([post(body), post(body)]);
  for (const response of responses) assert.equal(response.status, 200);
  const [receipt, repeated] = await Promise.all(responses.map(r => r.json()));
  assert.deepEqual(receipt, repeated);
  assert.deepEqual(Object.keys(receipt).sort(), ['modelStatus', 'reportId']);
  const filename = receipt.reportId + '.json';
  const report = JSON.parse(await readFile(path.join(directory, filename), 'utf8'));
  assert.equal(report.id, receipt.reportId);
  assert.equal(report.model.status, 'disabled');
  assert.equal(report.model.provider, 'none');
  assert.equal(report.analysis.fields.find(f => f.id === 'foundation').status, 'correct');
  const expandedResponse = await post(body, 'application/json', '?include=report&lang=en');
  assert.equal(expandedResponse.status, 200);
  const expanded = await expandedResponse.json();
  const expandedFilename = expanded.reportId + '.json';
  const expandedFile = JSON.parse(await readFile(path.join(directory, expandedFilename), 'utf8'));
  assert.deepEqual(expanded.report, expandedFile);
  const retry = await post(body, 'application/json', '?include=report&lang=en');
  assert.deepEqual((await retry.json()).report, expandedFile);
  assert.equal(typeof expanded.report.readingPlan.clarification, 'string');
  assert.equal(expanded.report.locale, 'en');
  assert.equal(expanded.report.id, expanded.reportId);
  assert.equal(expanded.modelStatus, expanded.report.model.status);
  assert.equal((await fetch(origin + '/.local/questionnaire-reports/' + filename)).status, 403);
  assert.equal((await fetch(url)).status, 405);
  assert.equal((await post(body, 'text/plain')).status, 415);
  assert.equal((await post('{')).status, 400);
  assert.equal((await post('{"answers":{"invalid":{}}}')).status, 400);
  assert.equal((await post('x'.repeat(256 * 1024 + 1))).status, 413);
  assert.deepEqual((await readdir(directory)).sort(), [filename, expandedFilename].sort());

  const all = await post(JSON.stringify({answers:{direction:{source:'self',values:[0,1,2,3,4]}}}),
    'application/json', '?include=report');
  assert.equal(all.status, 200);
  const {report: matched} = await all.json();
  assert.equal(matched.readingPlan.directions.length, 5);
  for (const {paper} of matched.readingPlan.directions) {
    assert.equal(paper.sampleUrl, '/papers/' + paper.id);
    assert.equal(paper.url, paperCatalog.find(entry => entry.id === paper.id).url);
  }
  for (const {id, title} of paperCatalog) {
    const sample = await fetch(origin + '/papers/' + id);
    assert.equal(sample.status, 200);
    assert.match(sample.headers.get('content-type'), /^text\/html/);
    const page = await sample.text();
    assert.ok(page.includes('<main><h1>' + title + '</h1></main>'));
    assert.doesNotMatch(page, /<script|https?:\/\//);
  }
  assert.equal((await fetch(origin + '/papers/unknown')).status, 404);
});

test('the analysis service calls a compatible model and still saves a report if that model fails', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'questionnaire-model-api-'));
  let calls = 0;
  const requests = [];
  const provider = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({ url:req.url, auth:req.headers.authorization, body:JSON.parse(Buffer.concat(chunks)) });
    if (++calls === 2) { res.writeHead(503); res.end(); return; }
    const content = JSON.stringify({ suggestions: [{ text:'先试读一段英文摘要并标出关键词。', evidenceIds:['english'] }] });
    res.end(JSON.stringify({ choices:[{ message:{ content } }] }));
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  const env = {
    QUESTIONNAIRE_MODEL_NAME: 'test-model', QUESTIONNAIRE_MODEL_API_KEY: 'local-test',
    QUESTIONNAIRE_MODEL_BASE_URL: 'http://127.0.0.1:' + provider.address().port + '/v1'
  };
  configureModel(t, env);
  const server = createServer({ reportDirectory:directory });
  t.after(async () => {
    await Promise.all([server,provider].map(s => new Promise(resolve => s.close(resolve))));
    await rm(directory, {recursive:true,force:true});
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  for (const expected of ['available', 'unavailable']) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/questionnaire/analyze', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({answers:{english:{source:'self',values:[0]}}})
    });
    assert.equal(response.status, 200);
    const receipt = await response.json();
    const report = JSON.parse(await readFile(path.join(directory, receipt.reportId + '.json'), 'utf8'));
    assert.equal(report.model.status, expected);
    assert.equal(report.model.provider, 'http');
    assert.equal(receipt.modelStatus, expected);
    assert.ok(report.analysis.recommendations.some(r => r.basedOn.includes('english')));
    if (expected === 'available') assert.deepEqual(report.model.suggestions[0].evidenceIds, ['english']);
  }
  assert.equal(calls, 2);
  assert.equal(requests[0].url, '/v1/chat/completions');
  assert.equal(requests[0].body.model, 'test-model');
  assert.equal(requests[0].auth, 'Bearer local-test');
});
