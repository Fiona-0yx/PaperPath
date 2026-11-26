import { groveCategories } from '../shared/grove-categories.js';
import { paperCatalog } from './paper-catalog.mjs';

function namedPapers(fields) {
  const direction = fields.direction.answer;
  const text = direction?.text || direction?.other || fields.intro.answer?.text || '';
  // Match short affirmative topic statements. Leave ambiguous prose to the model.
  const topics = text.toLowerCase().split(/[，,。.!！?？、；;\n]/)
    .map(s => s.trim().replace(/^(?:(?:我)?(?:想|希望)(?:学习|了解|读|做|研究|复现|入门)?|(?:i (?:want|would like) to (?:learn about|learn|study|read about|reproduce))\s+)/, '').trim());
  return paperCatalog.filter(paper => paper.keywords.some(term => topics.includes(term)));
}

// Filter by interest first. Within a field, an expressly named method outranks level and practice fit.
function firstPaper(category, fields, named) {
  const choice = id => fields[id].answer?.values?.[0];
  const experienced = [2, 3].includes(choice('reading'));
  const wantsPractice = choice('outcome') === 2;
  const codesIndependently = [2, 3].includes(choice('python'));
  const preferredLevel = experienced && choice('outcome') !== 0 ? 'advanced' : 'starter';
  function score(paper) {
    const levelFit = paper.level === preferredLevel ? 2 : 0;
    const practiceFit = wantsPractice && paper.handsOn ? (codesIndependently ? 3 : 1) : 0;
    return (named.includes(paper) ? 6 : 0) + levelFit + practiceFit;
  }
  return paperCatalog.filter(paper => paper.category === category)
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0];
}

function readingAdvice(analysis, model, index) {
  const priorities = ['difficulty', 'english', 'outcome', 'reading'];
  const selected = [];
  const covered = new Set();
  function add(text, ids) {
    const relevant = ids.filter(id => priorities.includes(id));
    if (selected.length >= 2 || !relevant.some(id => !covered.has(id)) || selected.includes(text)) return;
    selected.push(text);
    relevant.forEach(id => covered.add(id));
  }
  for (const item of model.suggestions ?? []) {
    if (item.text.length <= (index ? 180 : 85)) add(item.text, item.evidenceIds);
  }
  for (const id of priorities) {
    for (const item of analysis.recommendations) {
      if (item.basedOn.includes(id)) add(item.message[index], item.basedOn);
    }
  }
  return selected;
}

export function recommendPapers(analysis, model, locale = 'zh') {
  const index = locale === 'en' ? 1 : 0;
  const fields = Object.fromEntries(analysis.fields.map(field => [field.id, field]));
  const named = namedPapers(fields);
  const explicit = analysis.paperDirections.map(item => item.category).filter(Boolean);
  const interests = explicit.length ? explicit : named.length ? named.map(paper => paper.category) : model.interestCategories ?? [];
  const directions = groveCategories.filter(category => interests.includes(category.id)).flatMap(category => {
    const paper = firstPaper(category.id, fields, named);
    if (!paper) return [];
    const {id, title, year, url, guide} = paper;
    return [{
      category: category.id,
      title: category.title[locale],
      paper: {id, title, year, url, sampleUrl: '/papers/' + id},
      guide: guide[index]
    }];
  });
  let clarification = null;
  if (!directions.length) {
    clarification = ['还没有匹配到具体论文。请在问卷「兴趣方向」勾选想试读的领域，再更新报告。',
      'Choose a field in the questionnaire’s Interests section and update the report to get a matching paper.'][index];
  } else if (!explicit.length || fields.direction.source === 'intro') {
    clarification = ['根据你的文字先选了以下方向，可在问卷「兴趣方向」中调整。',
      'These topics were inferred from your words. You can change them in the Interests section.'][index];
  }
  return {directions, advice:readingAdvice(analysis, model, index), clarification};
}
