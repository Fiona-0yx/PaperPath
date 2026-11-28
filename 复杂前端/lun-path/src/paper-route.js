export function paperRoute(paperId, { categoryId, paragraph, source = 'history' } = {}) {
  if (/(?:^|\/)lun-path\/(?:index\.html)?$/.test(location.pathname)) {
    const query = new URLSearchParams({ paper: paperId, source });
    if (categoryId) query.set('category', categoryId);
    if (paragraph) query.set('paragraph', paragraph);
    return new URL('../index.html#/article?' + query, location.href).href;
  }
  if (!categoryId) return null;
  const query = new URLSearchParams({ source });
  if (paragraph) query.set('paragraph', paragraph);
  return '#/read/' + encodeURIComponent(categoryId) + '/' + encodeURIComponent(paperId) + '?' + query;
}
