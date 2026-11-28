import { analyzeQuestionnaire } from '../../../论径后端/recommendation/questionnaire-report.mjs';
import { enrichQuestionnaire } from '../../../论径后端/recommendation/questionnaire-model.mjs';
import { recommendPapers } from '../../../论径后端/recommendation/recommend-papers.mjs';
import { papers } from '../shared/papers.js';

export async function recommendations(snapshot, locale = 'zh') {
  const analysis = analyzeQuestionnaire(snapshot, { locale });
  // Only use a model when the deployment explicitly configures one.
  const env = { ...process.env };
  env.QUESTIONNAIRE_MODEL_PROVIDER ||= env.QUESTIONNAIRE_MODEL_BASE_URL ? 'http' : 'none';
  const model = await enrichQuestionnaire(analysis, { locale, env });
  const readingPlan = recommendPapers(analysis, model, locale);
  const categories = new Set(readingPlan.directions.map(d => d.category));
  const localPapers = papers.filter(p => categories.has(p.categoryId) && p.sections?.length).map(p => ({
    id: p.id, categoryId: p.categoryId, title: p.title, abstract: p.abstract,
    contentVersion: p.version || 'v1',
    reason: locale === 'en' ? 'Teaching material in your selected field; full text is available here.' : '与你选择的方向对应的教学材料，本站已有正文，可先试读。',
  }));
  return { locale, modelStatus: model.status, readingPlan, localPapers, analysis,
    generatedAt: new Date().toISOString() };
}
