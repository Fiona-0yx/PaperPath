import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeQuestionnaire } from '../server/questionnaire-report.mjs';
import { recommendPapers } from '../server/recommend-papers.mjs';
import { enrichQuestionnaire } from '../server/questionnaire-model.mjs';
import { paperCatalog } from '../server/paper-catalog.mjs';
import { groveCategories } from '../shared/grove-categories.js';

const select = (...values) => ({source:'self', values});
const plan = (answers, model = {}, locale = 'zh') =>
  recommendPapers(analyzeQuestionnaire({answers}, {locale}), model, locale);

test('every explicit field gets one linked paper and a bilingual paper-specific reading task', () => {
  const answers = {direction:select(0, 1, 2, 3, 4)};
  const english = plan(answers, {}, 'en');
  const chinese = plan(answers);
  assert.deepEqual(chinese.directions.map(d => d.category), groveCategories.map(c => c.id));
  assert.equal(new Set(chinese.directions.map(d => d.paper.id)).size, 5);
  assert.equal(chinese.clarification, null);
  for (const [i, d] of chinese.directions.entries()) {
    const paper = paperCatalog.find(p => p.id === d.paper.id);
    assert.equal(paper.category, d.category);
    assert.match(d.paper.url, /^https:\/\//);
    assert.deepEqual(english.directions[i].paper, d.paper);
    assert.equal(d.guide, paper.guide[0]);
    assert.equal(english.directions[i].guide, paper.guide[1]);
  }
});

test('the same field produces different papers for an introductory reader and a reader aiming to reproduce', () => {
  const direction = select(3);
  const introductory = plan({direction, reading:select(0, 0), outcome:select(0)});
  const reproduce = plan({direction, outcome:select(2), python:select(2)});
  assert.equal(introductory.directions[0].paper.id, 'alexnet');
  assert.equal(reproduce.directions[0].paper.id, 'resnet');
  assert.equal(plan({direction, reading:select(3, 1)}).directions[0].paper.id, 'resnet');
});

test('edits override suggestions, unmatched interests ask for clarification, advice is bounded', () => {
  const model = {interestCategories:['computer-vision'], suggestions:[{text:'先概括一张图。',evidenceIds:['difficulty']}]};
  const edited = {source:'self', text:'自然语言处理', edited:true};
  const readingPlan = plan({direction:edited, difficulty:select(1), outcome:select(1), english:select(0)}, model);
  assert.deepEqual(readingPlan.directions.map(d => d.category), ['natural-language']);
  assert.equal(readingPlan.advice.length, 2);
  assert.equal(readingPlan.advice[0], model.suggestions[0].text);
  assert.deepEqual(plan({direction:{source:'self',other:'天文学',values:[]}}).directions, []);
  assert.ok(plan({}).clarification);
});

test('a free-text interest can map through Codex to a real catalog entry, with a visible qualification', async () => {
  const analysis = analyzeQuestionnaire({answers:{direction:{source:'self',text:'想研究不同上下文里词的含义',edited:true}}});
  const note = {text:'先看输入句和译文。', evidenceIds:['direction']};
  const model = await enrichQuestionnaire(analysis, {env:{}, runCodex:async ({schema}) => {
    assert.ok(schema.properties.interestCategories);
    return {answerAnalysis:note, suggestions:[note], paperDirections:[], interestCategories:['natural-language','bogus']};
  }});
  const result = recommendPapers(analysis, model);
  assert.deepEqual(result.directions.map(d => d.paper.id), ['glove']);
  assert.ok(result.clarification);
});

test('an expressly named method gets its paper locally and a negated method does not', () => {
  const interest = text => ({direction:{source:'self',text,edited:true}});
  assert.equal(plan(interest('想做机器翻译')).directions[0].paper.id, 'transformer');
  assert.deepEqual(plan(interest('我不想做机器翻译')).directions, []);
});
