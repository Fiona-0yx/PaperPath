import { api } from './reader-api.js';
import { intake, persistIntake } from './journal-state.js';
import { escape as h } from './components.js';

let pending;
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
  const fresh = () => intake.recommendation?.report?.locale === language && JSON.stringify(intake.recommendation.snapshot) ===
    JSON.stringify({answers:intake.submitted?.answers, evidence:intake.submitted?.evidence || {}});
  function render() {
    if (!container.isConnected) return;
    const report = intake.recommendation?.report;
    if (inBlog && report) sendToBlog('recommended-papers', report);
    container.innerHTML = '<h2>' + L('接下来读什么','What to read next') + '</h2>' +
      '<p>' + (inBlog ? L('选择一篇论文，在下方推荐列表中查看。','Select a paper to see it in your recommendation list below.') : L('根据已提交的画像推荐。站内教学材料可直接试读，外部论文打开原文网站。','Recommendations use your submitted portrait. Teaching materials open here; external papers open their original websites.')) + '</p>' +
      '<p role="status">' + h(pending ? L('正在分析画像并整理推荐…','Preparing your recommendations…') : message) + '</p>' +
      (report && !fresh() ? '<p>' + L('画像已修改，下面保留的是上次结果，请更新推荐。','Your portrait has changed. Update the previous recommendations below.') + '</p>' : '') +
      '<button class="recommend-refresh" ' + (pending || !intake.submitted ? 'disabled' : '') + '>' + L(report ? '更新推荐' : '生成推荐', report ? 'Update recommendations' : 'Get recommendations') + '</button> ' +
      '<a href="#/journal">' + L('修改画像','Edit portrait') + '</a>' +
      (!intake.submitted ? '<p>' + L('请先在手账封底提交画像。','Submit your portrait from the journal first.') + '</p>' : '') +
      (report ? '<p class="recommend-status">' + L(report.modelStatus === 'available' ? '已结合模型分析与问卷规则。' : '当前展示规则推荐；模型未启用或暂不可用。', report.modelStatus === 'available' ? 'Based on questionnaire rules and model analysis.' : 'Rule-based recommendations; model analysis is not enabled or unavailable.') + '</p>' +
      '<h3>' + L('站内试读 · 教学材料','Read here · teaching materials') + '</h3>' +
      (report.localPapers.length ? '<ul>' + report.localPapers.map(p => '<li><a data-local-paper data-paper-id="' + h(p.id) + '" href="#/read/' + encodeURIComponent(p.categoryId) + '/' + encodeURIComponent(p.id) + '?source=recommendation">' + h(p.title) + '</a><p>' + h(p.reason) + '</p></li>').join('') + '</ul>' : '<p>' + L('你选择的方向暂没有站内正文。可阅读下面的外部论文，或到书架选择其他教学材料。','There is no local text for your selected field yet. Use an original paper below or browse other teaching materials.') + '</p>') +
      '<h3>' + L('推荐论文 · 外部原文','Recommended papers · external sources') + '</h3>' +
      (report.readingPlan.clarification ? '<p>' + h(report.readingPlan.clarification) + '</p>' : '') +
      '<ul>' + report.readingPlan.directions.map(d => '<li><a data-paper-id="' + h(d.paper.id) + '" target="_blank" rel="noopener noreferrer" href="' + safeUrl(d.paper.url) + '">' + h(d.paper.title) + '</a><p>' + h(d.guide) + '</p>' +
        (report.readingPlan.primaryRecommendation?.paperId === d.paper.id ? '<p>' + h(report.readingPlan.primaryRecommendation.reason) + '</p>' : '') + '</li>').join('') + '</ul>' +
      (inBlog ? '<p>'+L('打开论文卡片后，先完成基于原文摘录的读前测试。','Open a paper card to take its pre-reading assessment based on an original excerpt.')+'</p>' : '') +
      '<ul>' + report.readingPlan.advice.map(a => '<li>' + h(a) + '</li>').join('') + '</ul>' : '');
    container.querySelector('button').onclick = generate;
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
  else if (!intake.submitted) {
    api('recommendations').then(result => {
      if (intake.submitted) return;
      intake.submitted = result.snapshot;
      intake.recommendation = result;
      // Preserve any unsent draft rather than replacing it with an older snapshot.
      if (!Object.keys(intake.answers).length) {
        intake.answers = structuredClone(result.snapshot.answers);
        intake.evidence = structuredClone(result.snapshot.evidence);
      }
      intake.portraitReady = true;
      intake.started = true;
      persistIntake();
      if (container.isConnected) window.dispatchEvent(new Event('portrait-submitted'));
    }).catch(() => {});
  }
}
function safeUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? h(url.href) : '#'; }
  catch { return '#'; }
}
