import { analyzeQuestionnaire } from '../../../论径后端/recommendation/questionnaire-report.mjs';
import { enrichQuestionnaire } from '../../../论径后端/recommendation/questionnaire-model.mjs';
import { recommendPapers } from '../../../论径后端/recommendation/recommend-papers.mjs';
import { papers } from '../shared/papers.js';
import { searchPapers } from './paper-search.mjs';

export async function recommendations(snapshot, locale = 'zh') {
  const analysis = analyzeQuestionnaire(snapshot, { locale });
  // Only use a model when the deployment explicitly configures one.
  const env = { ...process.env };
  env.QUESTIONNAIRE_MODEL_PROVIDER ||= env.LUNJING_MODEL_PROVIDER?.trim() === 'codex' ? 'codex' :
    env.QUESTIONNAIRE_MODEL_BASE_URL ? 'http' : 'none';
  const model = await enrichQuestionnaire(analysis, { locale, env });
  const readingPlan = recommendPapers(analysis, model, locale);
  const categories = new Set(readingPlan.directions.map(d => d.category));
  const localPapers = papers.filter(p => categories.has(p.categoryId) && p.sections?.length).map(p => ({
    id: p.id, categoryId: p.categoryId, title: p.title, abstract: p.abstract,
    contentVersion: p.version || 'v1',
    materialKind: p.materialKind || (p.id === 'radiation' ? 'reading-note' : 'teaching'),
    reason: locale === 'en' ? 'This in-site reading material matches your selected field.' : '与你选择的方向相关，可在站内开始阅读。',
  }));
  const paperSearch = await searchPapers(readingPlan.directions[0]?.category,
    [...readingPlan.directions.map(direction => direction.paper.title), ...localPapers.map(paper => paper.title)]);
  return { locale, modelStatus: model.status, readingPlan, localPapers, paperSearch, analysis,
    generatedAt: new Date().toISOString() };
}
