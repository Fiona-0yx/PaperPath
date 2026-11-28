import { openPaper } from '../shared/open-paper.js';

const topics = new Map([
  ['machine-learning', 'machine learning'],
  ['neural-networks', 'neural network'],
  ['deep-learning', 'deep learning'],
  ['computer-vision', 'computer vision'],
  ['natural-language', 'natural language processing'],
]);
const chineseTopics = new Map([
  ['机器学习', 'machine-learning'],
  ['神经网络', 'neural-networks'],
  ['深度学习', 'deep-learning'],
  ['计算机视觉', 'computer-vision'],
  ['自然语言处理', 'natural-language'],
]);

const provider = 'Crossref';
const openResult = {
  id: 'crossref:' + openPaper.doi, categoryId: openPaper.categoryId,
  title: openPaper.title, doi: openPaper.doi, url: openPaper.original,
  year: openPaper.year, venue: openPaper.venue, readerId: openPaper.id,
};
const cache = new Map();
let active;
let nextRequestAt = 0;

function metadataText(value, limit) {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, limit) : '';
}

function paperMetadata(item, categoryId) {
  const doi = typeof item?.DOI === 'string' ? item.DOI.trim().toLowerCase() : '';
  const title = metadataText(item?.title?.[0], 320);
  if (!title || doi.length > 300 || !/^10\.\d{4,}(?:\.\d+)*\/[!-~]+$/u.test(doi) ||
      doi.split('/').some(part => part === '.' || part === '..')) return null;
  const year = item.published?.['date-parts']?.[0]?.[0];
  const url = 'https://doi.org/' + doi.split('/').map(encodeURIComponent).join('/');
  return {
    id: 'crossref:' + doi, categoryId, title, doi, url,
    year: Number.isInteger(year) && year > 0 ? year : null,
    venue: metadataText(item['container-title']?.[0], 180),
    ...(doi === openPaper.doi && { readerId: openPaper.id, categoryId: openPaper.categoryId }),
  };
}

async function fetchPapers(query, categoryId) {
  const url = new URL('https://api.crossref.org/works');
  const params = new URLSearchParams({
    'query.bibliographic': query,
    filter: 'type:journal-article,type:proceedings-article',
    select: 'DOI,title,published,container-title',
    rows: '8',
  });
  url.search = params.toString().replaceAll('+', '%20');
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(4500),
  });
  if (response.status === 429) nextRequestAt = Date.now() + 60_000;
  if (!response.ok) throw new Error('Crossref responded with an error');
  const items = (await response.json())?.message?.items;
  if (!Array.isArray(items)) throw new Error('Crossref did not return a result list');
  const papers = new Map();
  const relevantTitle = categoryId && new RegExp('\\b' + query.replaceAll(' ', '[\\s-]+') + 's?\\b', 'iu');
  for (const item of items.slice(0, 8)) {
    const paper = paperMetadata(item, categoryId);
    if (paper && (!relevantTitle || relevantTitle.test(paper.title))) papers.set(paper.doi, paper);
  }
  return [...papers.values()];
}

async function catalogueLookup(query, categoryId) {
  if (process.env.LUNJING_PAPER_SEARCH === 'off')
    return { papers: [], reason: 'disabled' };
  const key = categoryId || 'query:' + query.toLowerCase();
  const saved = cache.get(key);
  if (saved?.expires > Date.now()) return saved;
  if (active?.key === key) return active.result;
  if (active || Date.now() < nextRequestAt) return { papers: [], reason: 'busy' };
  const result = fetchPapers(query, categoryId)
    .then(papers => ({ papers, expires: Date.now() + 3_600_000 }))
    .catch(() => ({ papers: [], reason: 'unavailable', expires: Date.now() + 30_000 }))
    .then(entry => {
      cache.delete(key);
      if (cache.size >= 48) cache.delete(cache.keys().next().value);
      cache.set(key, entry);
      return entry;
    })
    .finally(() => { active = null; });
  nextRequestAt = Date.now() + 1000;
  active = { key, result };
  return result;
}

export async function searchPapers(categoryId, existingTitles = []) {
  const topic = topics.get(categoryId);
  if (!topic) return { provider, status: 'not-requested', papers: [] };
  const saved = await catalogueLookup(topic, categoryId);
  const normalizeTitle = title => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const titles = new Set(existingTitles.map(normalizeTitle));
  const papers = [];
  for (const paper of saved.papers) {
    const title = normalizeTitle(paper.title);
    if (!titles.has(title)) {
      papers.push(paper);
      titles.add(title);
    }
    if (papers.length === 3) break;
  }
  return papers.length
    ? { provider, categoryId, status: 'online', papers }
    : { provider, categoryId, status: 'fallback', reason: saved.reason || 'empty', papers };
}

export async function searchByKeyword(query) {
  const categoryId = chineseTopics.get(query);
  const { papers, reason } = await catalogueLookup(topics.get(categoryId) || query, categoryId);
  const normalized = query.toLowerCase().replace(/^https?:\/\/doi\.org\//, '');
  if ([openPaper.doi, openPaper.title.toLowerCase()].includes(normalized) &&
      !papers.some(paper => paper.doi === openPaper.doi)) {
    return { provider, status: papers.length ? 'online' : 'local', papers: [openResult, ...papers].slice(0, 8) };
  }
  return { provider, status: reason ? 'unavailable' : papers.length ? 'online' : 'empty', reason, papers };
}
