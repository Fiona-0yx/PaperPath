function append(parent, tag, text) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  parent.append(el);
  return el;
}

function paperUrl(value) {
  if (!URL.canParse(value)) return null;
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
}
function linkTo(parent, href, text) {
  const link = append(parent, 'a', text);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener';
  return link;
}

export function openReportDialog(language) {
  const L = (zh, en) => language === 'en' ? en : zh;
  const dialog = append(document.body, 'dialog');
  dialog.className = 'report-dialog';
  dialog.lang = L('zh-CN', 'en');
  dialog.setAttribute('aria-labelledby', 'report-title');
  const header = append(dialog, 'header');
  append(header, 'h1', L('问卷分析报告', 'Your reading report')).id = 'report-title';
  const close = append(header, 'button', L('关闭', 'Close'));
  close.type = 'button';
  close.autofocus = true;
  close.onclick = () => dialog.close();
  const content = append(dialog, 'div');
  content.className = 'report-content';
  const status = append(content, 'p', L('正在根据本次作答生成报告…', 'Preparing your report from these answers…'));
  status.setAttribute('role', 'status');
  dialog.setAttribute('aria-busy', 'true');
  dialog.addEventListener('close', () => {
    dialog.remove();
    document.querySelector('[data-show-report]')?.focus();
  }, {once: true});
  dialog.showModal();

  function section(title) {
    const block = append(content, 'section');
    append(block, 'h2', title);
    return block;
  }

  function display(report) {
    if (!dialog.open) return;
    content.replaceChildren();
    const {readingPlan, analysis, model} = report;
    if (readingPlan) {
      if (readingPlan.clarification) append(content, 'p', readingPlan.clarification);
      if (readingPlan.directions.length) {
        const block = section(L('推荐阅读', 'Recommended reading'));
        for (const {title, paper, guide} of readingPlan.directions) {
          const entry = append(block, 'article');
          const first = readingPlan.directions.length > 1 && readingPlan.primaryRecommendation?.paperId === paper.id;
          if (first) entry.className = 'first-reading';
          append(entry, 'h3', first ? L('建议先读 · ', 'Read first · ') + title : title);
          const citation = append(entry, 'p');
          const original = paperUrl(paper.url);
          const sample = /^\/papers\/[a-z0-9-]+$/.test(paper.sampleUrl) ? paper.sampleUrl : null;
          const href = sample ?? original;
          if (href) linkTo(citation, href, paper.title);
          else append(citation, 'span', paper.title);
          if (paper.year) append(citation, 'span', ` (${paper.year})`);
          if (sample) {
            append(citation, 'span', L(' · 本地样例', ' · Local sample'));
            if (original) {
              append(citation, 'span', ' · ');
              linkTo(citation, original, L('在线原文', 'Original paper'));
            }
          }
          if (first) append(entry, 'p', readingPlan.primaryRecommendation.reason);
          append(entry, 'p', guide);
        }
      }

      const advice = readingPlan.advice.slice(0, 2);
      if (advice.length) {
        const block = section(L('阅读建议', 'Reading suggestions'));
        const list = append(block, 'ul');
        for (const tip of advice) append(list, 'li', tip);
      }
    } else {
      const directions = model?.paperDirections?.length ? model.paperDirections : analysis?.paperDirections;
      if (directions?.length) {
        const block = section(L('推荐论文方向', 'Suggested paper topics'));
        for (const {topic, readingQuestion} of directions) {
          const entry = append(block, 'article');
          append(entry, 'h3', topic);
          append(entry, 'p', readingQuestion);
        }
      }
    }
    dialog.setAttribute('aria-busy', 'false');
  }

  return { display, close: () => dialog.close() };
}
