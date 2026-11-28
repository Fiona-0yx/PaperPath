import { groveCategories } from '../shared/grove-categories.js';
import { paperCatalog } from './paper-catalog.mjs';
import { canCode, outcomeChoice, paperGuide } from './paper-guide.mjs';

const taskKeywords = {
  alexnet: ['图像分类', '图片分类', 'image classification'],
  dropout: ['防止过拟合', '缓解过拟合', 'prevent overfitting', 'reduce overfitting']
};

function namedPapers(fields) {
  const direction = fields.direction.answer;
  const text = direction?.text ?? (direction?.other || fields.intro.answer?.text || '');
  // Strip only affirmative wording and match the complete remaining topic.
  const topics = text.toLowerCase().split(/[，,。.!！?？；;\n]/)
    .filter(clause => !/(?:不想|不做|不学|不研究|不考虑|不涉及|不用|不是|没打算|无需|排除|\b(?:not|never|avoid|exclude|without|neither|nor)\b|n['’]t\b)/.test(clause))
    .flatMap(clause => clause.split('、'))
    .map(clause => clause.trim()
      .replace(/^(?:而是\s*|(?:but|instead)\s+)/, '')
      .replace(/^(?:这学期的?|我的|本学期的?)?(?:课程作业|课程项目|研究项目|项目|课题|目标|任务)(?:的主题)?是(?:想|要)?(?:做|研究|复现|了解)?/, '')
      .replace(/^(?:我)?(?:更想|主要想|想要|想|希望|打算|计划|准备)(?:学习|了解|读|做|研究|复现|入门)?/, '')
      .replace(/^my (?:course project|course assignment|project|assignment|research topic|goal|task) (?:is|focuses on)\s+/, '')
      .replace(/^i (?:want|would like|plan) to (?:learn about|learn|study|read about|read|reproduce|work on|do|build)\s+/, '')
      .replace(/^(?:一个\s*|an?\s+|to (?:do|study|work on)\s+)/, '')
      .replace(/(?:的?(?:课程)?项目|方向|课题|\s+(?:course )?project)$/, '')
      .trim());
  return new Map(paperCatalog.flatMap(paper => {
    const match = [...paper.keywords, ...(taskKeywords[paper.id] ?? [])].find(term => topics.includes(term));
    return match ? [[paper.id, {paper, match}]] : [];
  }));
}

function readingPreferences(fields) {
  const reading = fields.reading.answer?.values?.[0];
  const experienced = [2, 3].includes(reading);
  const outcome = outcomeChoice(fields.outcome.answer);
  const wantsPractice = outcome === 2;
  const canRunCode = canCode(fields.python.answer);
  const wantsOverview = outcome === 0;
  const preferredLevel = experienced && !wantsOverview ? 'advanced' : 'starter';
  return {reading, preferredLevel, wantsPractice, canRunCode, wantsOverview};
}

function rankedPaper(paper, preferences, named) {
  const {preferredLevel, wantsPractice, canRunCode} = preferences;
  const match = named.get(paper.id)?.match;
  const levelFit = paper.level === preferredLevel ? 2 : 0;
  const practiceFit = wantsPractice && paper.handsOn ? (canRunCode ? 3 : 1) : 0;
  return {paper, match, levelFit, practiceFit, score: (match ? 6 : 0) + levelFit + practiceFit};
}

function primaryReason(first, second, preferences, locale) {
  const L = (zh, en) => locale === 'en' ? en : zh;
  const {paper, match, levelFit, practiceFit} = first;
  const tied = first.score === second?.score;
  const reason = [];
  if (match) reason.push(L(
    `这篇论文直接对应你提到的「${match}」。`,
    `This paper directly addresses “${match},” a topic you mentioned.`
  ));
  if (practiceFit) reason.push(L(
    preferences.canRunCode ? '你希望做复现，也有运行 Python 代码的经验，可以从论文中的一个可练习步骤开始。' :
      '你希望做复现，可以从论文中的一个可练习步骤开始。',
    preferences.canRunCode ? 'Your goal is reproduction and you have experience running Python code, so start with one step you can try.' :
      'Your goal is reproduction, so start with one step from the paper that you can try.'
  ));
  if (levelFit && !practiceFit) {
    if (paper.level === 'advanced') reason.push(L(
      '你已有论文阅读经历，可以从这篇的方法切入。', 'Your prior paper-reading experience supports starting with this paper’s method.'
    ));
    else if (preferences.wantsOverview || [0, 1].includes(preferences.reading)) reason.push(L(
      '这篇适合从短片段起步，先建立对研究问题的认识。', 'This paper gives you a short entry point for getting oriented to the research question.'
    ));
  }
  if (tied) reason.push(L(
    '有几个方向同样适合起步，暂按书架顺序将这篇放在首位。', 'Several directions are equally suitable as starting points, so this paper comes first in shelf order.'
  ));
  if (!reason.length) reason.push(L(
    '可以从这篇的导读开始试读。', 'Start with this paper’s reading guide for a first pass.'
  ));
  return reason.join(L('', ' '));
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
  const inferred = [...named.values()].map(({paper}) => paper.category);
  const interests = explicit.length ? explicit : named.size ? inferred : model.interestCategories ?? [];
  const preferences = readingPreferences(fields);
  const ranked = groveCategories.filter(category => interests.includes(category.id)).flatMap(category => {
    const [first] = paperCatalog.filter(paper => paper.category === category.id)
      .map(paper => rankedPaper(paper, preferences, named))
      .sort((a, b) => b.score - a.score || a.paper.id.localeCompare(b.paper.id));
    return first ? [{...first, category}] : [];
  }).sort((a, b) => b.score - a.score);
  const directions = ranked.map(({category, paper}) => {
    const {id, title, year, url} = paper;
    return {
      category: category.id,
      title: category.title[locale],
      paper: {id, title, year, url, sampleUrl: '/papers/' + id},
      guide: paperGuide(paper, fields, locale)
    };
  });
  let clarification = null;
  if (!directions.length) {
    clarification = ['还没有匹配到具体论文。请在问卷「兴趣方向」勾选想试读的领域，再更新报告。',
      'Choose a field in the questionnaire’s Interests section and update the report to get a matching paper.'][index];
  } else if (!explicit.length || fields.direction.source === 'intro') {
    clarification = ['根据你的文字先选了以下方向，可在问卷「兴趣方向」中调整。',
      'These topics were inferred from your words. You can change them in the Interests section.'][index];
  }
  const [first, second] = ranked;
  const primaryRecommendation = first
    ? {paperId: first.paper.id, reason: primaryReason(first, second, preferences, locale)}
    : null;
  return {directions, advice:readingAdvice(analysis, model, index), clarification, primaryRecommendation};
}
