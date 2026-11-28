import assert from 'node:assert/strict';
import test from 'node:test';
import { enrichQuestionnaire } from '../server/questionnaire-model.mjs';
import { analyzeQuestionnaire } from '../server/questionnaire-report.mjs';

function fieldsById(report) {
  return Object.fromEntries(report.fields.map(field => [field.id, field]));
}

test('the questionnaire produces bilingual evidence and recommendations from specific answers', () => {
  const snapshot = {
    answers: {
      intro: { source: 'self', text: '想入门神经网络。' },
      education: { source: 'self', values: [0, 0] },
      purpose: { source: 'self', values: [0] },
      direction: { source: 'intro', values: [1], quote: '想入门神经网络' },
      reading: { source: 'self', values: [0, null] },
      english: { source: 'self', values: [1] },
      foundation: { source: 'check', values: [1] },
      python: { source: 'self', values: [0] },
      difficulty: { source: 'self', values: [1, 3], other: '实验设置' },
      outcome: { source: 'self', values: [2] }
    }
  };
  const original = structuredClone(snapshot);
  const report = analyzeQuestionnaire(snapshot);
  const fields = fieldsById(report);

  assert.equal(report.version, 1);
  assert.deepEqual(report.fields.map(field => field.id), Object.keys(snapshot.answers));
  assert.deepEqual(report.fields.map(field => field.page), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const field of report.fields) {
    assert.equal(field.label.length, 2);
    assert.equal(field.question.length, 2);
  }
  assert.deepEqual(fields.intro.value, ['想入门神经网络。', '想入门神经网络。']);
  assert.match(fields.education.value[1], /Year 1.*Computing or AI/);
  assert.deepEqual(fields.purpose.value, ['课程作业', 'Coursework']);
  assert.equal(fields.direction.status, 'inferred');
  assert.equal(fields.direction.sourcePage, 1);
  assert.equal(fields.direction.answer.quote, '想入门神经网络');
  assert.deepEqual(fields.direction.value, ['神经网络', 'Neural networks']);
  assert.equal(fields.reading.status, 'self_reported');
  assert.match(fields.reading.value[1], /None yet.*Unknown/);
  assert.equal(fields.foundation.status, 'correct');
  assert.deepEqual(fields.foundation.attempts.map(attempt => attempt.status), ['correct']);
  assert.deepEqual(fields.difficulty.value, [
    '数学公式、不知道从哪篇开始、实验设置', 'Equations, Choosing a first paper, 实验设置'
  ]);
  for (const id of ['direction', 'reading', 'foundation']) {
    assert.ok(report.unknowns.some(item => item.id === id && item.reason.length === 2));
  }
  assert.ok(report.recommendations.some(item => item.basedOn.includes('english')));
  assert.ok(report.recommendations.some(item => item.basedOn.includes('difficulty')));
  assert.ok(report.recommendations.some(item => item.basedOn.includes('outcome') && item.basedOn.includes('python')));
  assert.ok(report.limitations.some(([, english]) => /single gradient descent item/.test(english)));
  assert.deepEqual(snapshot, original);
});

test('a last-page correction preserves the ordered, question-scoped history', () => {
  const wrong = { source: 'check', values: [0] };
  const correct = { source: 'check', values: [1] };
  const open = { source: 'check', values: [1], other: '想用一个例子核对。' };
  const edited = { source: 'self', text: '我想重新学习梯度下降。', edited: true };
  const evidence = { foundation: [wrong, correct, open] };
  const openReport = analyzeQuestionnaire({ answers: { foundation: open }, evidence });
  const current = fieldsById(openReport).foundation;
  assert.equal(current.status, 'unconfirmed');
  assert.ok(openReport.unknowns.some(item => item.id === 'foundation'));
  assert.deepEqual(current.attempts.map(attempt => attempt.status), ['incorrect', 'correct', 'unconfirmed']);

  const modified = fieldsById(analyzeQuestionnaire({ answers: { foundation: edited }, evidence })).foundation;
  assert.equal(modified.source, 'self');
  assert.equal(modified.status, 'self_reported');
  assert.deepEqual(modified.answer, edited);
  assert.deepEqual(modified.attempts, current.attempts);
});

test('a legacy edit to the introduction invalidates its old inference', () => {
  const intro = { source: 'self', text: '我并非想入门神经网络。', edited: true };
  const report = analyzeQuestionnaire({
    answers: { intro, direction: { source: 'intro', values: [1], quote: '想入门神经网络' } }
  });
  const fields = fieldsById(report);
  assert.deepEqual(fields.intro.answer, intro);
  assert.equal(fields.direction.status, 'unknown');
  assert.ok(report.unknowns.some(item => item.id === 'direction'));
});

test('the questionnaire preserves more than one hundred historical attempts', () => {
  const attempts = Array.from({ length: 105 }, (_, index) => ({ source: 'check', values: [index % 2] }));
  const report = analyzeQuestionnaire({
    answers: { foundation: attempts.at(-1) }, evidence: { foundation: attempts }
  });
  assert.deepEqual(fieldsById(report).foundation.attempts.map(attempt => attempt.answer.values[0]),
    attempts.map(attempt => attempt.values[0]));
});

test('missing and explicitly skipped answers remain unknown', () => {
  const report = analyzeQuestionnaire({ answers: { direction: { source: 'unknown' } }, evidence: {} });
  const fields = fieldsById(report);
  assert.ok(report.fields.every(field => field.source === 'unknown' && field.status === 'unknown'));
  assert.equal(fields.reading.answer, null);
  assert.deepEqual(fields.direction.answer, { source: 'unknown' });
  assert.deepEqual(fields.direction.value, ['未知', 'Unknown']);
  assert.deepEqual(new Set(report.unknowns.map(item => item.id)), new Set(Object.keys(fields)));
  assert.ok(report.recommendations.some(item => item.basedOn.includes('direction')));
});

test('the questionnaire rejects invalid input with a stable client error', async t => {
  const cases = {
    'missing snapshot': undefined,
    'missing answers': {},
    'non-object answers': { answers: [] },
    'unknown question': { answers: { missing: { source: 'unknown' } } },
    'out-of-range choice': { answers: { purpose: { source: 'self', values: [5] } } },
    'wrong source for a check': { answers: { foundation: { source: 'self', values: [1] } } },
    'unsupported inference': { answers: { direction: { source: 'intro', values: [1], quote: '想入门神经网络' } } },
    'negated inference': {
      answers: {
        intro: { source: 'self', text: '我并非想入门神经网络。' },
        direction: { source: 'intro', values: [1], quote: '想入门神经网络' }
      }
    },
    'inference quote with a fabricated extra clause': {
      answers: {
        intro: { source: 'self', text: '想入门神经网络。为了完成课程作业。' },
        direction: { source: 'intro', values: [1], quote: '想入门神经网络。为了完成课程作业' }
      }
    },
    'history for a self-report': { answers: {}, evidence: { direction: [] } },
    'self-report in answer history': { answers: {}, evidence: { foundation: [{ source: 'self', text: 'example' }] } }
  };
  for (const [name, snapshot] of Object.entries(cases)) {
    await t.test(name, () => {
      assert.throws(() => analyzeQuestionnaire(snapshot), { status: 400, code: 'INVALID_QUESTIONNAIRE' });
    });
  }
});

const modelConfig = {
  QUESTIONNAIRE_MODEL_BASE_URL: 'https://model.example/v1/',
  QUESTIONNAIRE_MODEL_NAME: 'test-model',
  QUESTIONNAIRE_MODEL_API_KEY: 'test-key'
};

const modelInput = {
  fields: [
    {
      id: 'difficulty',
      status: 'self_reported',
      source: 'self',
      label: ['阅读困难', 'Reading difficulties'],
      value: ['数学公式', 'Equations']
    },
    { id: 'english', status: 'unknown', source: 'unknown' }
  ]
};

const completeOutput = {
  answerAnalysis: { text: 'The learner reports difficulty with equations.', evidenceIds: ['difficulty'] },
  paperDirections: [{
    topic: 'Reading mathematical methods', reason: 'Practice interpreting notation in context.',
    readingQuestion: 'What quantity does each symbol represent?', evidenceIds: ['difficulty']
  }],
  suggestions: [{ text: 'Start with an annotated equation.', evidenceIds: ['difficulty'] }]
};

function completion(output) {
  return Response.json({ choices: [{ message: { content: JSON.stringify(output) } }] });
}

function assertCompleteResult(result, provider) {
  assert.equal(result.status, 'available');
  assert.equal(result.provider, provider);
  for (const [section, expected] of Object.entries(completeOutput)) {
    const actual = result[section];
    const withoutSource = ({ source, ...value }) => value;
    assert.deepEqual(Array.isArray(actual) ? actual.map(withoutSource) : withoutSource(actual), expected);
  }
}

function assertModelStatus(result, status, provider) {
  assert.equal(result.status, status);
  assert.equal(result.provider, provider);
}

test('the configured model receives localized evidence and returns supplementary suggestions', async () => {
  const expected = { text: 'Start with an annotated equation.', evidenceIds: ['difficulty'] };
  const originalReport = structuredClone(modelInput);
  const requests = [];
  const result = await enrichQuestionnaire(modelInput, {
    env: modelConfig,
    locale: 'en',
    fetchImpl: async (url, options) => {
      requests.push({ url: url.href, ...options, body: JSON.parse(options.body) });
      return completion({ suggestions: [expected] });
    }
  });

  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(request.url, 'https://model.example/v1/chat/completions');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.Authorization, 'Bearer test-key');
  assert.equal(request.body.model, 'test-model');
  assert.deepEqual(JSON.parse(request.body.messages[1].content), {
    language: 'English',
    evidence: [{
      id: 'difficulty', label: 'Reading difficulties', value: 'Equations',
      status: 'self_reported', source: 'self'
    }]
  });
  assert.equal(result.status, 'available');
  assert.equal(result.provider, 'http');
  assert.deepEqual(result.suggestions, [{ source: 'model', ...expected }]);
  assert.deepEqual(modelInput, originalReport);
});

test('explicit and default Codex providers accept a complete report', async () => {
  for (const env of [{}, { ...modelConfig, QUESTIONNAIRE_MODEL_PROVIDER: 'codex' }]) {
    const calls = [];
    const result = await enrichQuestionnaire(modelInput, {
      env, locale: 'en', fetchImpl: () => assert.fail('Unexpected HTTP request'),
      runCodex: async request => { calls.push(request); return completeOutput; }
    });
    assertCompleteResult(result, 'codex');
    assert.equal(calls.length, 1);
    const [{ prompt, schema, signal }] = calls;
    assert.match(prompt, /English/);
    assert.match(prompt, /difficulty/);
    assert.match(prompt, /Equations/);
    assert.doesNotMatch(prompt, /"id"\s*:\s*"english"/);
    assert.deepEqual(Object.keys(schema.properties).sort(), ['answerAnalysis', 'paperDirections', 'suggestions']);
    assert.ok(signal instanceof AbortSignal);
  }
});

test('the HTTP provider accepts the complete output structure', async () => {
  const result = await enrichQuestionnaire(modelInput, {
    env: { ...modelConfig, QUESTIONNAIRE_MODEL_PROVIDER: 'http' },
    runCodex: () => assert.fail('Unexpected Codex request'),
    fetchImpl: async () => completion(completeOutput)
  });
  assertCompleteResult(result, 'http');
});

test('Codex can suggest confirming a topic before proposing a paper direction', async () => {
  const result = await enrichQuestionnaire(modelInput, {
    env: {}, runCodex: async () => ({ ...completeOutput, paperDirections: [] })
  });
  assertModelStatus(result, 'available', 'codex');
  assert.deepEqual(result.paperDirections, []);
  assert.deepEqual(result.suggestions[0].evidenceIds, ['difficulty']);
});

test('the model is skipped when disabled, partially configured, or missing usable evidence', async () => {
  let calls = 0;
  const countCalls = async () => { calls++; };
  const stubs = { fetchImpl: countCalls, runCodex: countCalls };
  assertModelStatus(await enrichQuestionnaire(modelInput, {
    ...stubs, env: { ...modelConfig, QUESTIONNAIRE_MODEL_PROVIDER: 'none' }
  }), 'disabled', 'none');
  assertModelStatus(await enrichQuestionnaire(modelInput, {
    ...stubs, env: { QUESTIONNAIRE_MODEL_PROVIDER: 'http', QUESTIONNAIRE_MODEL_NAME: 'test-model' }
  }), 'unavailable', 'http');
  for (const [env, provider] of [[{}, 'codex'], [modelConfig, 'http']]) {
    assertModelStatus(await enrichQuestionnaire({ fields: [modelInput.fields[1]] }, {
      ...stubs, env
    }), 'unavailable', provider);
  }
  assert.equal(calls, 0);
});

test('the model falls back on transport, HTTP, malformed response, and invalid citation failures', async t => {
  const scenarios = {
    transport: async () => { throw new Error('Test provider unavailable'); },
    HTTP: async () => new Response(null, { status: 503 }),
    malformed: async () => new Response('Invalid JSON'),
    'unknown field citation': async () => completion({ suggestions: [{ text: 'Start here.', evidenceIds: ['english'] }] })
  };
  for (const [name, fetchImpl] of Object.entries(scenarios)) {
    await t.test(name, async () => {
      assertModelStatus(await enrichQuestionnaire(modelInput, {
        env: modelConfig, fetchImpl
      }), 'unavailable', 'http');
    });
  }
});

test('the model falls back and cancels its signal when it exceeds the deadline', async () => {
  for (const [env, provider] of [[{}, 'codex'], [modelConfig, 'http']]) {
    let signal;
    const pending = options => {
      signal = options.signal;
      return new Promise(() => {});
    };
    const result = await enrichQuestionnaire(modelInput, {
      env: { ...env, QUESTIONNAIRE_MODEL_TIMEOUT_MS: '5' },
      fetchImpl: (_url, options) => pending(options), runCodex: pending
    });
    assertModelStatus(result, 'unavailable', provider);
    assert.equal(signal.aborted, true);
  }
});

test('Codex failures and incomplete or uncited output preserve the rule report', async t => {
  const scenarios = {
    'CLI failure': async () => { throw new Error('Test Codex failure'); },
    'legacy output': async () => ({ suggestions: completeOutput.suggestions }),
    'unknown field citation': async () => ({
      ...completeOutput,
      paperDirections: [{ ...completeOutput.paperDirections[0], evidenceIds: ['english'] }]
    })
  };
  for (const [name, runCodex] of Object.entries(scenarios)) {
    await t.test(name, async () => {
      assertModelStatus(await enrichQuestionnaire(modelInput, { env: {}, runCodex }), 'unavailable', 'codex');
    });
  }
});
