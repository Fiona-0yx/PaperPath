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
    article_description: guide, year: paper.year,
    reason: report.readingPlan.primaryRecommendation?.paperId === paper.id
      ? report.readingPlan.primaryRecommendation.reason : '',
    original: /^https?:\/\//i.test(paper.url) ? paper.url : null
  }));
  const local = (report.localPapers || []).map(p => ({
    id: p.id, category: p.categoryId, categoryName: directions.find(d => d.category === p.categoryId)?.title,
    article_title: p.title, article_description: p.abstract, reason: p.reason,
    reader: './lun-path/index.html#/read/' + encodeURIComponent(p.categoryId) + '/' + encodeURIComponent(p.id) + '?source=recommendation'
  }));
  return [...new Map([...external, ...local].map(p => [p.id, {
    ...p, article_cover: './lun-path/assets/botanical/' + (covers[p.category] || 'botanic-gardens') + '.png'
  }])).values()];
}
