import { findPaper } from '../../../复杂前端/lun-path/shared/papers.js';
import { paperCatalog } from '../../../论径后端/recommendation/paper-catalog.mjs';

const covers = {
  'machine-learning': 'botanic-gardens', 'neural-networks': 'gardens-by-the-bay',
  'deep-learning': 'marina-bay-sands', 'computer-vision': 'singapore-river',
  'natural-language': 'joo-chiat'
};
export function savedReport() {
  try { return JSON.parse(localStorage.getItem('lunjing-intake-v1'))?.recommendation?.report; }
  catch { return null; }
}
export function recommendedArticles(report) {
  if (!report?.readingPlan) return [];
  const directions = report.readingPlan.directions || [];
  const external = directions.map(({ category, title, paper, guide }) => ({
    id: paper.id, category, categoryName: title, article_title: paper.title,
    article_description: guide, year: paper.year, materialKind: 'excerpt',
    reason: report.readingPlan.primaryRecommendation?.paperId === paper.id
      ? report.readingPlan.primaryRecommendation.reason : '',
    original: /^https?:\/\//i.test(paper.url) ? paper.url : null
  }));
  const local = (report.localPapers || []).map(p => ({
    id: p.id, category: p.categoryId, categoryName: directions.find(d => d.category === p.categoryId)?.title,
    article_title: p.title, article_description: p.abstract, reason: p.reason,
    materialKind: p.materialKind || (p.id === 'radiation' ? 'reading-note' : 'teaching'),
    reader: './lun-path/index.html#/read/' + encodeURIComponent(p.categoryId) + '/' + encodeURIComponent(p.id) + '?source=recommendation'
  }));
  const online = (report.paperSearch?.papers || []).filter(p => /^https:\/\/doi\.org\//i.test(p.url)).map(p => ({
    id: p.readerId || p.id, category: p.categoryId, categoryName: directions.find(d => d.category === p.categoryId)?.title,
    article_title: p.title, article_description: p.venue, year: p.year, venue: p.venue, doi: p.doi,
    original: p.url, materialKind: p.readerId ? 'open-text' : 'external', externalOnly: !p.readerId,
  }));
  return [...new Map([...external, ...local, ...online].map(p => [p.id, {
    ...p, article_cover: './lun-path/assets/botanical/' + (covers[p.category] || 'botanic-gardens') + '.png'
  }])).values()];
}
export function paperForRoute(id) {
  const recommendation = recommendedArticles(savedReport()).find(paper => paper.id === id);
  const local = findPaper(id);
  if (local) return {
    ...recommendation,
    id, category: local.categoryId, article_title: local.title,
    article_description: recommendation?.article_description || local.abstract,
    reader: true, materialKind: local.materialKind || (id === 'radiation' ? 'reading-note' : 'teaching'),
  };
  const entry = paperCatalog.find(paper => paper.id === id);
  if (!entry) return null;
  return {
    ...recommendation,
    id, category: entry.category, article_title: entry.title,
    article_description: recommendation?.article_description || entry.guide[0],
    year: entry.year, excerpt: true, materialKind: 'excerpt', original: entry.url,
  };
}
