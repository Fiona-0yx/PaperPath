import { api } from './reader-api.js';
import { intake, persistIntake } from './journal-state.js';
import { escape as h } from './components.js';
import { openPaper } from '../shared/open-paper.js';
import { paperRoute } from './paper-route.js';

let pending;
let portraitRequest;
export function restoreSubmittedPortrait() {
  if (intake.submitted) return;
  portraitRequest ??= api('recommendations').then(result => {
    if (intake.submitted) return;
    intake.submitted = result.snapshot;
    intake.recommendation = result;
    // Preserve any unsent draft.
    if (!Object.keys(intake.answers).length) {
      intake.answers = structuredClone(result.snapshot.answers);
      intake.evidence = structuredClone(result.snapshot.evidence);
    }
    intake.portraitReady = true;
    intake.started = true;
    persistIntake();
    window.dispatchEvent(new Event('portrait-submitted'));
  }).catch(() => {}).finally(() => { portraitRequest = null; });
  return portraitRequest;
}

export function mountRecommendations(container, language) {
  const inBlog = window.parent !== window && window.name === 'blog-home-grove';
  const sendToBlog = (type, report, id) => window.parent.postMessage({type, report, id}, location.origin);
  container.onclick = event => {
    const link = event.target.closest('a[data-paper-id]');
    if (!inBlog || !link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    sendToBlog('focus-paper', intake.recommendation.report, link.dataset.paperId);
  };
  const L = (zh, en) => language === 'en' ? en : zh;
  let message = '';
  const search = { query: '', pending: false, result: null, error: '' };
  const matchingPortrait = () => intake.recommendation?.report?.locale === language && JSON.stringify(intake.recommendation.snapshot) ===
    JSON.stringify({answers:intake.submitted?.answers, evidence:intake.submitted?.evidence || {}});
  const fresh = () => matchingPortrait() && Boolean(intake.recommendation.report.paperSearch);
  const localLabel = p => p.materialKind === 'open-text' ? L('开放获取 · 站内正文','Open-access text') :
    p.materialKind === 'reading-note' || p.id === 'radiation'
      ? L('站内阅读摘记','Reading notes') : L('站内教学材料','Teaching material');
  function searchStatus() {
    if (search.pending) return L('正在检索 Crossref…','Searching Crossref…');
    if (search.error) return search.error;
    const result = search.result;
    if (!result) return '';
    if (result.status === 'local') return L('找到 1 篇已采集的开放获取论文。','Found 1 locally available open-access paper.');
    if (result.status === 'empty') return L('Crossref 未返回匹配的论文。试试完整题目或更具体的关键词。','Crossref found no matching papers. Try the full title or more specific keywords.');
    if (result.status === 'unavailable') {
      if (result.reason === 'busy') return L('检索请求较多，请稍后再试。','Search is busy. Please try again shortly.');
      if (result.reason === 'disabled') return L('当前环境已关闭联网检索。','Online search is disabled in this environment.');
      return L('暂时无法连接 Crossref，请稍后重试。','Crossref is unreachable. Try again later.');
    }
    return L('找到 ' + result.papers.length + ' 条书目。',result.papers.length + ' records found.');
  }
  function searchResults() {
    if (!container.isConnected) return;
    const form = container.querySelector('.paper-search-form');
    form.querySelector('button').disabled = search.pending;
    form.querySelector('[role="status"]').textContent = searchStatus();
    container.querySelector('.paper-search-results').innerHTML = paperLinks(search.result?.papers, L);
  }
  async function submitSearch(event) {
    event.preventDefault();
    if (search.pending) return;
    search.query = event.currentTarget.elements.query.value.trim();
    if (search.query.length < 2 || !/[\p{L}\p{N}]/u.test(search.query)) {
      search.result = null;
      search.error = L('请输入至少两个字符的论文题目或关键词。','Enter at least two characters of a paper title or keyword.');
      searchResults();
      return;
    }
    Object.assign(search, { pending:true, result:null, error:'' });
    searchResults();
    try {
      search.result = await api('paper-search', 'POST', {query:search.query});
    } catch {
      search.error = L('检索暂不可用，请检查网络后重试。','Search is unavailable. Check your connection and try again.');
    } finally {
      search.pending = false;
      searchResults();
    }
  }
  function render() {
    if (!container.isConnected) return;
    const report = intake.recommendation?.report;
    if (inBlog && report) sendToBlog('recommended-papers', report);
    container.innerHTML = '<h2>' + L('接下来读什么','What to read next') + '</h2>' +
      '<p>' + L('提交画像后可查看推荐，带「站内正文」的论文可在论径阅读。','Submit your portrait for recommendations. Papers with an in-site text are available in the reader.') + '</p>' +
      '<p role="status">' + h(pending ? L('正在分析画像并整理推荐…','Preparing your recommendations…') : message) + '</p>' +
      (report && !matchingPortrait() ? '<p>' + L('画像已修改，下面保留的是上次结果，请更新推荐。','Your portrait has changed. Update the previous recommendations below.') + '</p>' : '') +
      '<button class="recommend-refresh" ' + (pending || !intake.submitted ? 'disabled' : '') + '>' + L(report ? '更新推荐' : '生成推荐', report ? 'Update recommendations' : 'Get recommendations') + '</button> ' +
      '<a href="#/journal">' + L('修改画像','Edit portrait') + '</a>' +
      (!intake.submitted ? '<p>' + L('请先在手账封底提交画像。','Submit your portrait from the journal first.') + '</p>' : '') +
      (report ? '<p class="recommend-status">' + L(report.modelStatus === 'available' ? '已结合模型分析与问卷规则。' : '当前展示规则推荐；模型未启用或暂不可用。', report.modelStatus === 'available' ? 'Based on questionnaire rules and model analysis.' : 'Rule-based recommendations; model analysis is not enabled or unavailable.') + '</p>' +
      '<h3>' + L('站内试读','Read here') + '</h3>' +
      (report.localPapers.length ? '<ul>' + report.localPapers.map(p => '<li><a data-local-paper data-paper-id="' + h(p.id) + '" href="#/read/' + encodeURIComponent(p.categoryId) + '/' + encodeURIComponent(p.id) + '?source=recommendation">' + h(p.title) + '</a><p>' + localLabel(p) + ' · ' + h(p.reason) + '</p></li>').join('') + '</ul>' : '<p>' + L('你选择的方向暂没有教学材料，可查看下面的论文。','Use the papers below to explore your selected field.') + '</p>') +
      '<h3>' + L('推荐论文 · 内置目录','Recommended papers · curated catalogue') + '</h3>' +
      (report.readingPlan.clarification ? '<p>' + h(report.readingPlan.clarification) + '</p>' : '') +
      '<ul>' + report.readingPlan.directions.map(d => '<li><a data-paper-id="' + h(d.paper.id) + '" target="_blank" rel="noopener noreferrer" href="' + safeUrl(d.paper.url) + '">' + h(d.paper.title) + '</a><p>' + h(d.guide) + '</p>' +
        (inBlog ? '<p>' + L('可在推荐卡片阅读站内原文摘录。','Open the recommendation card for the source excerpt.') + '</p>' : '') +
        (report.readingPlan.primaryRecommendation?.paperId === d.paper.id ? '<p>' + h(report.readingPlan.primaryRecommendation.reason) + '</p>' : '') + '</li>').join('') + '</ul>' +
      (report.paperSearch?.status === 'online' ? '<h3>' + L('优先方向 · Crossref 联网推荐','Top interest · Crossref results') +
        '</h3>' + paperLinks(report.paperSearch.papers, L) : report.paperSearch?.status === 'fallback' ?
        '<p class="recommend-status">' + L(report.paperSearch.reason === 'empty' ? 'Crossref 暂无更多匹配，已保留内置目录。' : '联网推荐暂不可用，已使用内置目录。', report.paperSearch.reason === 'empty' ? 'Crossref found no additional matches. Showing the curated catalogue.' : 'Online recommendations unavailable. Showing the curated catalogue.') + '</p>' : '') +
      '<ul>' + report.readingPlan.advice.map(a => '<li>' + h(a) + '</li>').join('') + '</ul>' : '') +
      '<h3>' + L('检索论文','Search papers') + '</h3>' +
      '<p>' + L('按题目、关键词或 DOI 检索 Crossref 书目。','Search Crossref by title, keyword, or DOI.') + '</p>' +
      '<form class="paper-search-form"><label for="paper-search-query">' + L('论文题目或关键词','Paper title or keyword') +
      '</label><div><input id="paper-search-query" name="query" type="search" maxlength="120" minlength="2" required value="' + h(search.query) +
      '"><button class="recommend-refresh">' + L('检索','Search') + '</button></div><p role="status"></p></form>' +
      '<button class="recommend-refresh" type="button" data-open-paper-example>' + L('试搜开放获取示例','Search the open-access sample') + '</button>' +
      '<div class="paper-search-results"></div>';
    container.querySelector('button.recommend-refresh').onclick = generate;
    const form = container.querySelector('.paper-search-form');
    form.onsubmit = submitSearch;
    form.elements.query.oninput = event => { search.query = event.target.value; };
    container.querySelector('[data-open-paper-example]').onclick = () => {
      if (search.pending) return;
      form.elements.query.value = openPaper.doi;
      form.requestSubmit();
    };
    searchResults();
  }
  async function generate() {
    if (pending || !intake.submitted) return;
    const snapshot = structuredClone({answers:intake.submitted.answers, evidence:intake.submitted.evidence || {}});
    pending = api('recommendations', 'POST', {...snapshot, locale:language});
    render();
    try {
      const result = await pending;
      intake.recommendation = result;
      message = persistIntake() ? L('推荐已保存。','Recommendations saved.') : L('推荐已存服务端，本机存储不可用。','Saved on the server; local storage is unavailable.');
    } catch (error) {
      message = L('推荐暂未更新，画像和上次结果已保留。请重试：','Update failed. Your portrait and previous result are retained. Retry: ') + error.message;
    } finally { pending = null; render(); }
  }
  render();
  if (pending) {
    pending.then(() => {
      if (container.isConnected && !fresh()) generate();
      else render();
    }, render);
  }
  else if (intake.submitted && !fresh()) generate();
  else if (!intake.submitted) restoreSubmittedPortrait();
}
function paperLinks(papers, L) {
  if (!papers?.length) return '';
  return '<ul>' + papers.map(p => {
    const reader = p.readerId && paperRoute(p.readerId, { categoryId: p.categoryId, source: 'search' });
    const readHere = reader ? '<p><a href="' + h(reader) + '"' + (reader.startsWith('http') ? ' target="_top"' : '') +
      '>' + L('站内阅读正文','Read the in-site text') + '</a></p>' : '';
    return '<li><a data-crossref-paper target="_blank" rel="noopener noreferrer" href="' +
      safeUrl(p.url) + '">' + h(p.title) + '</a><p>' + h([p.venue, p.year, p.doi].filter(Boolean).join(' · ')) +
      '</p>' + readHere + '</li>';
  }).join('') + '</ul>';
}
function safeUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? h(url.href) : '#'; }
  catch { return '#'; }
}
