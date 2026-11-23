import test from 'node:test';
import assert from 'node:assert/strict';
import { branches, papers, nextQuestion, analyzeIntroduction, scoreAssessment, getTutorReply, createInitialState } from '../shared/domain.js';
import { createServer } from '../server/index.mjs';

test('goal and experience change the next question and choices', () => {
  const project = nextQuestion({ goal: 'project', direction: 'plants' });
  const report = nextQuestion({ goal: 'report', direction: 'plants' });
  assert.equal(project.question.field, 'experience');
  assert.equal(report.question.field, 'output');
  const output = experience => nextQuestion({ goal: 'project', direction: 'plants', experience, deadline: 'week' }).question;
  assert.notEqual(output('beginner').title.en, output('trained').title.en);
  assert.notEqual(output('reproduced').title.zh, output('beginner').title.zh);
  assert.equal(output('trained').options[0].value, 'improve');
  assert.equal(output('beginner').options[0].value, 'overview');
});
test('answers are not repeated and skips terminate within five questions', () => {
  const history = [];
  for (let i = 0; i < 5; i++) {
    const next = nextQuestion({}, history);
    assert.equal(next.action, 'ask');
    assert.ok(!history.some(h => h.field === next.question.field));
    assert.equal(next.question.allowOther, true);
    assert.ok(next.question.options.some(o => o.value === 'uncertain'));
    history.push({ field: next.question.field, value: 'skip' });
  }
  const final = nextQuestion({}, history);
  assert.equal(final.action, 'complete');
  assert.ok(Object.values(final.profile).every(v => v === ''));
  assert.notEqual(nextQuestion({ goal: 'project' }).question.field, 'goal');
  assert.notEqual(nextQuestion({}, [{ field: 'goal', value: 'report' }]).question.field, 'goal');
});
test('introduction extraction preserves explicit evidence and does not infer missing facts', () => {
  const empty = analyzeIntroduction('我喜欢植物，也许以后做竞赛。');
  assert.ok(Object.values(empty.profile).every(v => v === ''));
  assert.equal(empty.unknowns.length, 5);
  const text = '目标：参加植物竞赛；经验：初学。';
  const result = analyzeIntroduction(text);
  assert.equal(result.profile.goal, '参加植物竞赛');
  assert.equal(result.profile.experience, '初学');
  assert.equal(result.profile.direction, '');
  assert.equal(result.profile.deadline, '');
  assert.equal(result.profile.output, '');
  for (const item of result.evidence) assert.ok(text.includes(item.quote));
});
test('open answers and uncertainty are ungraded, ordinary answers are graded', () => {
  for (const paper of papers) for (const stage of ['diagnostic', 'final']) {
    const spec = paper[stage];
    assert.equal(scoreAssessment({ paperId: paper.id, stage, answer: spec.correct }).correct, true);
    assert.equal(scoreAssessment({ paperId: paper.id, stage, answer: 1 - spec.correct }).score, 0);
    const open = scoreAssessment({ paperId: paper.id, stage, answer: 'other', other: 'I have another hypothesis.' });
    assert.equal(open.correct, null);
    assert.equal(open.score, null);
    assert.equal(open.status, 'reflection');
    assert.equal(scoreAssessment({ paperId: paper.id, stage, answer: 2 }).status, 'uncertain');
    assert.throws(() => scoreAssessment({ paperId: paper.id, stage, answer: 99 }), RangeError);
  }
});
test('all fixtures and assessment/term/tutor quotes trace to original English sections', () => {
  assert.equal(papers.length, 6);
  for (const branch of branches) assert.ok(papers.filter(p => p.branch === branch.id).length >= 2);
  for (const paper of papers) {
    assert.equal(paper.fixture, true);
    assert.equal(paper.demo, true);
    assert.ok(paper.coverTitle.length < 50);
    assert.ok(paper.authors.every(a => a.includes('fictional')));
    assert.ok(!/[\u4e00-\u9fff]/u.test(paper.abstract + paper.title + paper.sections.map(s => s.title + s.body).join('')));
    for (const item of [...paper.terms, paper.diagnostic, paper.final]) {
      assert.ok(paper.sections.find(s => s.id === item.sectionId)?.body.includes(item.quote));
    }
    const reply = getTutorReply({ paperId: paper.id, question: paper.terms[0].term, lang: 'en' });
    assert.equal(reply.isLLM, false);
    assert.ok(paper.sections.find(s => s.id === reply.sectionId).body.includes(reply.quote));
  }
});
test('initial state is independent across calls; NLP explicitly maps only to workflow', () => {
  const a = createInitialState();
  a.notes.push('private'); a.profile.goal = 'report';
  const b = createInitialState();
  assert.deepEqual(b.notes, []);
  assert.equal(b.profile.goal, '');
  const direction = nextQuestion({ goal: 'project' }).question;
  assert.match(direction.why.en, /general research workflows/);
});
test('HTTP routes, JSON/enums/body limits and private file isolation', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, value) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  assert.equal((await (await fetch(base + '/api/health')).json()).modelConfigured, false);
  const listing = await (await fetch(base + '/api/papers?branch=methods')).json();
  assert.equal(listing.papers.length, 2);
  assert.ok(listing.papers.every(p => p.branch === 'methods'));
  assert.equal((await fetch(base + '/api/papers?branch=fake')).status, 400);
  assert.equal((await post('/api/planner/next', { profile: {}, history: [] })).status, 200);
  const paperId = papers[0].id;
  assert.equal((await (await post('/api/assessment', { paperId, answer: 'other', other: 'Alternative' })).json()).status, 'reflection');
  assert.equal((await post('/api/assessment', { paperId, answer: 0, stage: 'bogus' })).status, 400);
  assert.equal((await post('/api/tutor', { paperId, question: 'What is leakage?' })).status, 200);
  assert.equal((await post('/api/critic', { paperId, text: 'It works everywhere.' })).status, 200);
  const updated = await (await post('/api/profile/update', { profile: { direction: 'nlp' }, text: '目标：报告。' })).json();
  assert.equal(updated.profile.direction, 'nlp');
  assert.equal(updated.profile.goal, '报告');
  assert.equal(updated.profile.deadline, '');
  assert.equal((await post('/api/tutor', { paperId, lang: 'xx' })).status, 400);
  assert.equal((await post('/api/tutor', { paperId, sectionId: 'fake' })).status, 400);
  const invalid = await fetch(base + '/api/planner/next', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, 'INVALID_JSON');
  assert.equal((await post('/api/planner/next', { text: 'a'.repeat(66000) })).status, 413);
  assert.equal((await fetch(base + '/server/index.mjs')).status, 404);
  assert.equal((await fetch(base + '/package.json')).status, 404);
  assert.equal((await fetch(base + '/shared/domain.js')).headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal((await fetch(base + '/api/tutor')).status, 405);
});
