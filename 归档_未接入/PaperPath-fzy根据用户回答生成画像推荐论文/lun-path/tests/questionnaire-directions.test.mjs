import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeQuestionnaire } from '../server/questionnaire-report.mjs';
import { groveCategories } from '../shared/grove-categories.js';

const selected = (...values) => ({ source: 'self', values });
const directions = answers => analyzeQuestionnaire({ answers }).paperDirections;

test('each homepage category has a distinct topic and trial-reading question', () => {
  const result = directions({ direction: selected(0, 1, 2, 3, 4) });
  assert.deepEqual(result.map(item => item.topic.split(' · ')[0]), groveCategories.map(category => category.title.zh));
  assert.equal(new Set(result.map(item => item.readingQuestion)).size, 5);
  assert.ok(result.every(item => item.evidenceIds.length === 1 && item.evidenceIds[0] === 'direction'));
});

test('reproduction outcomes change the topic and novice reading history changes the suggested depth', () => {
  const direction = selected(3);
  const [starting] = directions({ direction });
  const [reproducing] = directions({ direction, outcome: selected(2), reading: selected(0, 1) });
  assert.notEqual(reproducing.topic, starting.topic);
  assert.deepEqual(reproducing.evidenceIds, ['direction', 'outcome', 'reading']);
  assert.match(reproducing.reason, /短材料/);
  assert.match(reproducing.readingQuestion, /验证集/);
});

test('the check changes only the neural-network concept prompt and only for a current wrong answer', () => {
  const direction = selected(1, 3);
  const wrongAnswer = { source: 'check', values: [0] };
  const [neural, vision] = directions({ direction, foundation: wrongAnswer });
  assert.match(neural.reason, /本次梯度下降自检答错/);
  assert.ok(neural.evidenceIds.includes('foundation'));
  assert.ok(!vision.evidenceIds.includes('foundation'));
  const corrected = analyzeQuestionnaire({
    answers: { direction, foundation: { source: 'self', text: '仍需练习', edited: true } },
    evidence: { foundation: [wrongAnswer] }
  }).paperDirections;
  assert.ok(!corrected[0].evidenceIds.includes('foundation'));
});

test('missing, ambiguous and inferred topics are explicitly qualified', () => {
  assert.match(directions({})[0].topic, /确认/);
  const edited = text => ({ source: 'self', text, edited: true });
  assert.match(directions({ direction: edited('神经网络、但我想先了解其他方向') })[0].topic, /确认/);
  assert.match(directions({ direction: edited('计算机视觉') })[0].topic, /^计算机视觉/);
  const [inferred] = directions({
    intro: { source: 'self', text: '想入门神经网络。' },
    direction: { source: 'intro', values: [1], quote: '想入门神经网络' }
  });
  assert.match(inferred.reason, /确认后再选文/);
});

test('English report localizes generated reading directions and preserves free-form wording', () => {
  const original = '想知道如何识别鸟类 / Identifying birds';
  const answers = {
    intro: { source: 'self', text: original },
    direction: { source: 'self', text: '神经网络、计算机视觉', edited: true },
    outcome: selected(2),
    reading: selected(0, 1),
    foundation: { source: 'check', values: [0] }
  };
  const english = analyzeQuestionnaire({ answers }, { locale: 'en' });
  const chinese = analyzeQuestionnaire({ answers });
  const [neural, vision] = english.paperDirections;
  assert.match(neural.topic, /^Neural Networks · Loss functions/);
  assert.match(neural.reason, /short excerpt.*gradient descent/);
  assert.match(neural.readingQuestion, /opposite direction/);
  assert.match(vision.topic, /Data augmentation ablation/);
  assert.match(vision.readingQuestion, /validation metric/);
  assert.match(chinese.paperDirections[0].topic, /^神经网络/);
  assert.deepEqual(neural.evidenceIds, chinese.paperDirections[0].evidenceIds);
  assert.deepEqual(english.fields.find(field => field.id === 'intro').value, [original, original]);
  assert.equal(english.fields.find(field => field.id === 'direction').answer.text, answers.direction.text);
  assert.match(analyzeQuestionnaire({ answers: {} }, { locale: 'en' }).paperDirections[0].topic, /^Choose a topic/);
});
