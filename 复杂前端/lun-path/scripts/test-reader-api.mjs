import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.LUNJING_DATA_DIR = ":memory:";
const { handleRequest } = await import("../server/index.mjs");
const cookie = "lj_reader=" + randomUUID();
process.env.QUESTIONNAIRE_MODEL_PROVIDER = 'none';
process.env.LUNJING_PAPER_SEARCH = 'off';
async function call(path, method = "GET", body, owner = cookie, setupResponse) {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  Object.assign(req, {
    method,
    url: "/api/reader/" + path,
    headers: { host: "localhost", cookie: owner },
  });
  const res = Object.assign(new EventEmitter(), {
    setHeader() {},
    writeHead(status) {
      this.status = status;
    },
    end(text) {
      this.data = text ? JSON.parse(text) : null;
    },
  });
  setupResponse?.(res);
  await handleRequest(req, res);
  return res;
}

test('portrait recommendations persist per browser and link only to available local texts', async () => {
  const other = 'lj_reader=' + randomUUID();
  assert.equal((await call('recommendations', 'GET', null, other)).status, 404);
  const snapshot = {answers:{direction:{source:'self',values:[0]},outcome:{source:'self',values:[0]}},evidence:{}};
  const saved = await call('recommendations', 'POST', snapshot);
  assert.equal(saved.status, 201);
  assert.equal(saved.data.report.modelStatus, 'disabled');
  assert.equal(saved.data.report.paperSearch.status, 'fallback');
  assert.ok(saved.data.report.readingPlan.directions.length);
  assert.ok(saved.data.report.localPapers.some(p => p.id === 'attention'));
  assert.ok(saved.data.report.localPapers.every(p => p.categoryId === 'machine-learning'));
  assert.deepEqual((await call('recommendations')).data, saved.data);
  assert.equal((await call('recommendations', 'GET', null, other)).status, 404);
  const bad = await call('recommendations', 'POST', {answers:{direction:{source:'self',values:[999]}}});
  assert.equal(bad.status, 400);
  assert.deepEqual((await call('recommendations')).data, saved.data);
  const external = await call('recommendations', 'POST', {answers:{direction:{source:'self',values:[3]}},locale:'en'});
  assert.equal(external.status, 201);
  assert.equal(external.data.report.localPapers.length, 0);
  assert.equal(external.data.report.readingPlan.directions[0].category, 'computer-vision');
  assert.equal((await call('recommendations', 'DELETE')).status, 405);
});

test('Crossref recommendations and manual search expose external DOI metadata only', async t => {
  process.env.LUNJING_PAPER_SEARCH = 'on';
  t.after(() => { process.env.LUNJING_PAPER_SEARCH = 'off'; });
  const queries = [];
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url.origin, 'https://api.crossref.org');
    assert.equal(url.searchParams.get('rows'), '8');
    const query = url.searchParams.get('query.bibliographic');
    queries.push(query);
    const items = query === 'machine learning'
      ? [
        { DOI: '10.9999/ml', title: ['Machine Learning Methods'], URL: 'https://example.com', abstract: 'Untrusted' },
        { DOI: '10.9999/other', title: ['Marine Biology'] },
      ]
      : [{ DOI: '10.9999/cn', title: ['特定论文题目'], published: {'date-parts': [[2024]]} }];
    return Response.json({message: {items}});
  });
  const snapshot = {answers:{direction:{source:'self',values:[0]},intro:{source:'self',text:'PRIVATE'}},evidence:{}};
  const recommendation = await call('recommendations', 'POST', snapshot);
  assert.equal(recommendation.status, 201);
  const search = recommendation.data.report.paperSearch;
  assert.equal(search.status, 'online');
  assert.deepEqual(search.papers.map(p => p.url), ['https://doi.org/10.9999/ml']);
  assert.equal(search.papers[0].abstract, undefined);
  assert.equal((await call('materials/' + encodeURIComponent(search.papers[0].id))).status, 404);
  assert.equal((await call('paper-search', 'POST', {query:'机器学习'})).data.status, 'online');
  assert.deepEqual(queries, ['machine learning']);
  await new Promise(resolve => setTimeout(resolve, 1000));
  const manual = await call('paper-search', 'POST', {query:'特定论文题目'});
  assert.equal(manual.data.papers[0].title, '特定论文题目');
  assert.deepEqual(queries, ['machine learning', '特定论文题目']);
  assert.equal((await call('paper-search', 'POST', {query:'a'.repeat(121)})).status, 400);
});

test('the collected PLOS paper opens by DOI and supplies reader citations offline', async () => {
  const doi = '10.1371/journal.pone.0316019';
  const search = await call('paper-search', 'POST', {query: doi});
  assert.equal(search.status, 200);
  assert.equal(search.data.status, 'local');
  const [result] = search.data.papers;
  assert.equal(result.doi, doi);
  assert.equal(result.readerId, 'plos-roc-auc');
  assert.equal(result.url, 'https://doi.org/' + doi);
  const material = await call('materials/' + result.readerId);
  assert.equal(material.status, 200);
  assert.equal(material.data.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
  assert.ok(material.data.sections.length > 5);
  const section = material.data.sections[1];
  const paragraphId = section.id + '-p1';
  const response = await call('analyze', 'POST', {
    paperId: result.readerId, contentVersion: material.data.version, question: 'ROC?',
    text: section.paragraphs[0], range: {start: {paragraphId}},
  });
  assert.equal(response.status, 200);
  assert.equal(response.data.citations[0].range.start.paragraphId, paragraphId);
});

test('Codex unavailability and cancellation leave the reading plan usable', async t => {
  const previousProvider = process.env.LUNJING_MODEL_PROVIDER;
  const previousBin = process.env.QUESTIONNAIRE_CODEX_BIN;
  process.env.LUNJING_MODEL_PROVIDER = 'codex';
  process.env.QUESTIONNAIRE_CODEX_BIN = join(tmpdir(), randomUUID(), 'codex.exe');
  t.after(() => {
    if (previousProvider === undefined) delete process.env.LUNJING_MODEL_PROVIDER;
    else process.env.LUNJING_MODEL_PROVIDER = previousProvider;
    if (previousBin === undefined) delete process.env.QUESTIONNAIRE_CODEX_BIN;
    else process.env.QUESTIONNAIRE_CODEX_BIN = previousBin;
  });
  assert.equal((await call('session')).data.pretestTimeoutSeconds, 60);
  const plan = await call('plans', 'POST', {
    paperId: 'scikit-learn',
    input: {profile: {default_depth: '能讲清楚'}},
  });
  assert.equal(plan.status, 201);
  const testInput = {planId:plan.data.planId, revision:1, count:1, mode:'quick'};
  const failed = await call('pretests', 'POST', testInput);
  assert.equal(failed.status, 503);
  assert.match(failed.data.error.message, /Codex 模型暂时不可用/);
  const cancelled = await call('pretests', 'POST', testInput, cookie, res => {
    res.once('newListener', event => {
      if (event === 'close') setImmediate(() => {
        res.destroyed = true;
        res.emit('close');
      });
    });
  });
  assert.equal(cancelled.destroyed, true);
  assert.equal(cancelled.status, undefined);
  assert.equal((await call('pretests', 'POST', {...testInput, mode:'skip'})).status, 201);
});

test('excerpt allows an explicit skip and stores an evidence-free initial portrait', async () => {
  const material = await call('materials/scikit-learn');
  assert.equal(material.status, 200);
  assert.equal(material.data.excerpt, true);
  const plan = await call('plans', 'POST', {
    paperId: material.data.id, contentVersion: material.data.version,
    input: {profile: {default_depth: '能讲清楚'}}
  });
  assert.equal(plan.status, 201);
  const skipped = await call('pretests', 'POST', {planId: plan.data.planId, revision: 1, mode: 'skip'});
  assert.equal(skipped.status, 201);
  assert.equal(skipped.data.paper_profile.completion_status, 'skipped');
  assert.deepEqual(skipped.data.paper_profile.concept_evidence, []);
  assert.equal(skipped.data.paper_profile.reading_plan.depth, '能讲清楚');
  assert.deepEqual((await call('pretests/' + skipped.data.test_id + '/paper-profile')).data, skipped.data.paper_profile);
});

test("plan revisions, owner isolation and exactly-once grading", async () => {
  const creation = await call("plans", "POST", {
    paperId: "radiation",
    contentVersion: "v1",
    input: { profile: { default_depth: "能讲清楚" } },
  });
  assert.equal(creation.status, 201);
  const id = creation.data.planId;
  assert.equal(
    (await call("plans/" + id, "GET", null, "lj_reader=" + randomUUID()))
      .status,
    404,
  );
  const edits = await Promise.all(
    ["能复现", "看懂大意"].map((depth) =>
      call("plans/" + id, "PATCH", { revision: 1, changes: { depth } }),
    ),
  );
  assert.deepEqual(edits.map((x) => x.status).sort(), [200, 409]);
  const created = await call("pretests", "POST", {
    planId: id,
    revision: 2,
    mode: "sample",
  });
  assert.equal(created.status, 201);
  const { test_id, questions } = created.data;
  assert.equal(questions.length, 5);
  assert.deepEqual(Object.keys(questions[0]).sort(), ["id", "options", "stem"]);
  const path = "pretests/" + test_id,
    answers = Object.fromEntries(questions.map((q) => [q.id, "UNSURE"]));
  assert.equal((await call(path + "/paper-profile")).status, 409);
  assert.equal(
    (await call(path + "/grade", "POST", { answers: { q1: "A" } })).status,
    422,
  );
  const graded = await call(path + "/grade", "POST", { answers });
  assert.equal(graded.status, 200);
  assert.equal(graded.data.paper_profile.completion_status, "submitted");
  assert.deepEqual(
    (await call(path + "/grade", "POST", { answers })).data,
    graded.data,
  );
  assert.equal(
    (await call(path + "/grade", "POST", { skip: true })).status,
    409,
  );
  assert.deepEqual(
    (await call(path + "/paper-profile")).data,
    graded.data.paper_profile,
  );
});
test("deduplicated visible time per subject and paper, with resolvable citations", async () => {
  const event = {
    schemaVersion: 2,
    eventId: "one",
    sessionId: "visit",
    paperId: "radiation",
    contentVersion: "v1",
    at: 10000,
    kind: "paragraph-visible",
    sectionId: "season",
    paragraphId: "season-p1",
    startedAt: 5000,
    endedAt: 10000,
    durationMs: 5000,
  };
  for (const e of [
    event,
    event,
    {
      ...event,
      eventId: "two",
      paragraphId: "season-p2",
      startedAt: 8000,
      durationMs: 2000,
    },
  ]) {
    assert.equal((await call("events", "POST", e)).status, 204);
  }
  const { data } = await call("me/summary?paperId=radiation");
  assert.equal(data.visibleMs, 5000);
  assert.equal(data.paragraphs.length, 2);
  assert.equal((await call("me/summary?paperId=attention")).data.visibleMs, 0);
  assert.equal(
    (
      await call(
        "me/summary?paperId=radiation",
        "GET",
        null,
        "lj_reader=" + randomUUID(),
      )
    ).data.visibleMs,
    0,
  );
  const r = await call("analyze", "POST", {
    paperId: "radiation",
    question: "峰值月份",
    text: "训练集在八月达到峰值",
  });
  assert.equal(r.data.citations[0].range.start.paragraphId, "season-p1");
  assert.match(r.data.explanation, /八月/);
});
