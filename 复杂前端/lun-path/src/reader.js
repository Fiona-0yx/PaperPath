import {activity} from './reader-api.js';
import {setupStudy} from './study-panel.js';
import {escape as esc} from './components.js';
import {papers, findPaper} from '../shared/papers.js';

const $ = id => document.getElementById(id);
const TYPE_META = {
  bookmark: {zh: '收藏', en: 'Saved'},
  question: {zh: '有疑问', en: 'Question'},
  explain: {zh: '需要解释', en: 'Explain'},
};

const shell = parent?.journalShell || null;
if (!shell) {
  $('paper').innerHTML = '<p style="padding:40px;color:#6f675b">请从书架打开论文。<br>This reader opens from the shelf.</p>';
} else {
  boot(shell);
}

function boot(shell) {
  const params = new URLSearchParams(location.search);
  const paper = findPaper(params.get('paper')) || papers[0];
  const L = (zh, en) => shell.language === 'en' ? en : zh;
  const menuEl = $('contextMenu');
  const toastEl = $('toast');
  const paperEl = $('paper');
  const notesListEl = $('notesList');
  const notesCountEl = $('notesCount');
  const notesToggleEl = $('notesToggle');
  const notesToggleBadge = $('notesToggleBadge');
  const notesCloseEl = $('notesClose');
  const scrimEl = $('sidebarScrim');
  const noteFiltersEl = $('noteFilters');
  const barTitleEl = $('barTitle');
  const backLinkEl = $('backLink');
  const langBtnEl = $('langBtn');
  const notesTitleEl = $('notesTitle');
  const notesToggleLabel = $('notesToggleLabel');

  let menuInfo = null;
  let filter = 'all';
  let toastTimer = null;

  let tracking;
  function reportEvent(kind,info,extra={}) {
    const fields={...extra,textLength:info?.text?.length||0};
    if(info?.sectionId && Number.isInteger(info.paragraphIndex) && info.paragraphIndex>=0){
      const paragraphId=info.sectionId+'-p'+(info.paragraphIndex+1);
      if(kind==='note-jump'){
        if(extra.crossPaper)return;
        const first=[...paperEl.querySelectorAll('.selectable')].find(p=>p.getBoundingClientRect().bottom>paperEl.getBoundingClientRect().top);
        fields.source='note';
        fields.from={paperId:paper.id,sectionId:first?.closest('section').dataset.section||info.sectionId,paragraphId:first?.id||paragraphId};
        fields.to={paperId:paper.id,sectionId:info.sectionId,paragraphId};
      }
    }
    tracking?.event(kind,fields);
  }

  document.documentElement.lang = shell.language === 'en' ? 'en' : 'zh-CN';
  document.title = L('论径 · 论文阅读', 'Lun Jing · Reading');

  // ——— static chrome ———
  backLinkEl.textContent = L('‹ 回到书架', '‹ Back to shelf');
  backLinkEl.href = '/#/shelf/' + paper.categoryId;
  barTitleEl.textContent = paper.title;
  langBtnEl.textContent = L('English', '中文');
  langBtnEl.onclick = () => shell.setLanguage(shell.language === 'en' ? 'zh' : 'en');
  notesTitleEl.textContent = L('阅读笔记', 'Reading notes');
  notesToggleLabel.textContent = L('笔记', 'Notes');

  // ——— paper body ———
  const difficulty = '★'.repeat(paper.difficulty) + '☆'.repeat(Math.max(0, 5 - paper.difficulty));
  paperEl.innerHTML =
    '<h1>' + esc(paper.title) + '</h1>' +
    '<p class="paper-sub">' + esc(paper.zhTitle) + ' · ' + L('难度', 'Difficulty') + ' ' + difficulty + '</p>' +
    '<p class="abstract">' + esc(paper.abstract) + '</p>' +
    paper.sections.map(section =>
      '<section id="section-' + esc(section.id) + '" data-section="' + esc(section.id) + '">' +
        '<h2>' + esc(section.heading) + '</h2>' +
        section.paragraphs.map((paragraph, index) =>
          '<div class="para-wrap" data-section="' + esc(section.id) + '" data-para="' + index + '">' +
            '<p class="selectable">' + esc(paragraph) + '</p>' +
            '<span class="para-tag">' + esc(section.heading) + ' · ' + (index + 1) + '</span>' +
          '</div>'
        ).join('') +
      '</section>'
    ).join('');

  // ——— selection ———
  function selectionInfo() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const element = node.nodeType === 1 ? node : node.parentElement;
    const wrap = element?.closest('.para-wrap');
    if (!wrap) return null;
    const section = paper.sections.find(s => s.id === wrap.dataset.section);
    return {
      text,
      context: wrap.textContent.replace(/\s+/g, ' ').trim(),
      sectionId: wrap.dataset.section,
      sectionHeading: section?.heading || '',
      paragraphIndex: Number(wrap.dataset.para) || 0,
    };
  }

  // ——— context menu ———
  const icons = {
    bookmark: '<svg class="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.5h10v13l-5-3.2-5 3.2z"/></svg>',
    question: '<svg class="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><path d="M7.7 7.4a2.4 2.4 0 1 1 3.1 2.3c-.55.2-.9.7-.9 1.3v.4"/><circle cx="10" cy="14" r=".6" fill="currentColor"/></svg>',
    explain: '<svg class="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.5 12 8l5.5 2-5.5 2-2 5.5L8 12 2.5 10 8 8z"/></svg>',
  };

  function showMenu(x, y, info) {
    menuInfo = info;
    const routeText = info.sectionHeading + ' · ' + L('第', '¶') + (info.paragraphIndex + 1) + L('段', '');
    menuEl.innerHTML =
      '<div class="menu-route" title="' + esc(info.text) + '">' + esc(routeText) + ' · ' + esc(info.text.slice(0, 14)) + (info.text.length > 14 ? '…' : '') + '</div>' +
      '<button type="button" role="menuitem" data-action="bookmark">' + icons.bookmark + '<span>' + L('收藏', 'Save') + '</span><span class="arrow">↵</span></button>' +
      '<button type="button" role="menuitem" data-action="question">' + icons.question + '<span>' + L('有疑问', 'Ask / doubt') + '</span><span class="arrow">↵</span></button>' +
      '<button type="button" role="menuitem" data-action="explain">' + icons.explain + '<span>' + L('发送选句和上下文以解释', 'Send quote and context') + '</span><span class="arrow">↵</span></button>' +
      '<div class="menu-hint">' + L('Esc 关闭 · 点击外部关闭', 'Esc or click outside to close') + '</div>';
    menuEl.hidden = false;
    const rect = menuEl.getBoundingClientRect();
    const pad = 8;
    let left = x, top = y;
    if (left + rect.width > innerWidth - pad) left = innerWidth - rect.width - pad;
    if (top + rect.height > innerHeight - pad) top = innerHeight - rect.height - pad;
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    menuEl.style.left = left + 'px';
    menuEl.style.top = top + 'px';
    menuEl.querySelector('button')?.focus({preventScroll: true});
  }

  function closeMenu(reason) {
    const wasOpen = !menuEl.hidden && Boolean(menuInfo);
    const info = menuInfo;
    menuEl.hidden = true;
    menuEl.innerHTML = '';
    menuInfo = null;
    if (wasOpen && reason) reportEvent('menu-dismissed', info, {reason});
  }

  paperEl.addEventListener('contextmenu', event => {
    const info = selectionInfo();
    if (!info) return; // no selection: keep the browser's own menu
    event.preventDefault();
    showMenu(event.clientX, event.clientY, info);
    reportEvent('menu-opened', info);
  });

  menuEl.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || !menuInfo) return;
    const info = menuInfo;
    closeMenu();
    handleMenuAction(button.dataset.action, info);
  });
  document.addEventListener('mousedown', event => {
    if (!menuEl.hidden && !menuEl.contains(event.target)) closeMenu('outside');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu('escape');
  });
  window.addEventListener('scroll', () => closeMenu('scroll'), {passive: true});
  window.addEventListener('resize', () => closeMenu('resize'));

  // ——— notes write path ———
  function handleMenuAction(action, info) {
    const note = {
      type: action,
      text: info.text,
      context: info.context,
      paperId: paper.id,
      paperTitle: paper.title,
      categoryId: paper.categoryId,
      sectionId: info.sectionId,
      sectionHeading: info.sectionHeading,
      paragraphIndex: info.paragraphIndex,
      createdAt: Date.now(),
      resolved: false,
    };
    if (action === 'explain') note.status = 'pending';
    const entry = shell.addReadingNote(note);
    reportEvent('action', info, {action, noteId: entry.id, noteType: action, source: 'menu'});
    renderNotes();
    if (action === 'bookmark') toast(L('已收藏，可在右侧笔记中查看', 'Saved to reading notes'));
    else if (action === 'question') toast(L('已记录疑问，可在右侧整理', 'Doubt recorded in the sidebar'));
    else {
      toast(L('已记录，正在请求解释…', 'Recorded; requesting explanation…'));
      requestAnalysis(entry);
    }
    window.getSelection()?.removeAllRanges();
  }

  async function requestAnalysis(note) {
    // No agent backend is shipped yet: attempt the documented endpoint, and on
    // any failure mark the note unavailable instead of inventing an answer.
    try {
      const response = await fetch('/api/reader/analyze', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          paperId: paper.id,
          text: note.text,
          context: note.context,
          section: note.sectionHeading,
        }),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      const explanation = data?.explanation || data?.summary;
      if (explanation) {
        shell.updateReadingNote(note.id, {status: 'done', explanation: String(explanation)});
        reportEvent('analysis-status', note, {noteId: note.id, noteType: 'explain', status: 'done'});
      } else {
        shell.updateReadingNote(note.id, {status: 'unavailable'});
        reportEvent('analysis-status', note, {noteId: note.id, noteType: 'explain', status: 'unavailable'});
      }
    } catch {
      shell.updateReadingNote(note.id, {status: 'unavailable'});
      reportEvent('analysis-status', note, {noteId: note.id, noteType: 'explain', status: 'unavailable'});
    }
    renderNotes();
  }

  // ——— sidebar ———
  const filters = [
    ['all', () => L('全部', 'All')],
    ['bookmark', () => L('收藏', 'Saved')],
    ['question', () => L('有疑问', 'Questions')],
    ['explain', () => L('需要解释', 'Explain')],
  ];
  noteFiltersEl.innerHTML = filters.map(([key, label]) =>
    '<button type="button" data-filter="' + key + '">' + label() + '</button>'
  ).join('');
  noteFiltersEl.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    filter = button.dataset.filter;
    reportEvent('filter', null, {filter});
    renderNotes();
  });

  function noteCount(notes) {
    return notes.length;
  }

  function statusLine(note) {
    if (note.type !== 'explain') return '';
    if (note.status === 'done' && note.explanation) {
      return '<p class="note-status">' + L('解释', 'Explanation') + '：' + esc(note.explanation) + '</p>';
    }
    if (note.status === 'pending') {
      return '<p class="note-status"><span class="pulse"></span>' + L('待 Agent 分析…', 'Pending agent analysis…') + '</p>';
    }
    return '<p class="note-status"><span class="pulse"></span>' + L('分析服务暂不可用 · 已记录待处理', 'Analysis unavailable · recorded for later') + '</p>';
  }

  function noteCard(note) {
    const meta = TYPE_META[note.type] || TYPE_META.question;
    const tag = L(meta.zh, meta.en);
    const locText = esc(note.sectionHeading || '') + '<span class="dot">·</span>' + L('第', '¶') + ((note.paragraphIndex || 0) + 1) + L('段', '');
    const context = note.context ? '…' + esc(note.context) + '…' : '';
    const resolveLabel = note.resolved ? L('标记未解决', 'Mark open') : L('标记已解决', 'Mark resolved');
    return '<li class="note-card ' + (note.resolved ? 'resolved ' : '') + '" data-note-id="' + esc(note.id) + '">' +
      '<div class="note-top">' +
        '<span class="note-badge ' + note.type + '">' + tag + '</span>' +
        '<span class="note-time">' + timeText(note.createdAt) + '</span>' +
      '</div>' +
      '<p class="note-text">' + esc(note.text) + '</p>' +
      (note.type !== 'bookmark' ? '<p class="note-context">' + context + '</p>' : '') +
      '<div class="note-loc">' + esc(note.paperTitle || '') + '<span class="dot">·</span>' + locText + '</div>' +
      statusLine(note) +
      '<div class="note-actions">' +
        '<button type="button" data-action="jump">' + L('查看原文', 'View source') + '</button>' +
        '<button type="button" data-action="resolve">' + resolveLabel + '</button>' +
        '<button type="button" data-action="delete" class="danger">' + L('删除', 'Delete') + '</button>' +
      '</div>' +
    '</li>';
  }

  function renderNotes() {
    const all = shell.intake.readingNotes || [];
    const shown = all
      .filter(note => filter === 'all' || note.type === filter)
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const total = noteCount(all);
    notesCountEl.textContent = total ? total + L(' 条', ' notes') : L('空', 'empty');
    notesToggleBadge.textContent = total;
    noteFiltersEl.querySelectorAll('[data-filter]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    });
    if (!shown.length) {
      notesListEl.innerHTML = '<li class="notes-empty"><b>' + L('还没有记录', 'Nothing yet') + '</b>' +
        L('在正文中选中一个词或句子，右键即可收藏或记录疑问。', 'Select some text and right-click to save it or note a doubt.') + '</li>';
      return;
    }
    notesListEl.innerHTML = shown.map(noteCard).join('');
  }

  notesListEl.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const card = button.closest('[data-note-id]');
    if (!card) return;
    const id = card.dataset.noteId;
    const notes = shell.intake.readingNotes || [];
    const note = notes.find(item => item.id === id);
    if (!note) return;
    if (button.dataset.action === 'delete') {
      shell.removeReadingNote(id);
      reportEvent('note-delete', note, {noteId: id, noteType: note.type});
      renderNotes();
      toast(L('已删除', 'Deleted'));
    } else if (button.dataset.action === 'resolve') {
      const next = !note.resolved;
      shell.updateReadingNote(id, {resolved: next});
      reportEvent('note-resolve', note, {noteId: id, noteType: note.type, resolved: next});
      renderNotes();
    } else if (button.dataset.action === 'jump') {
      const crossPaper = note.paperId !== paper.id;
      reportEvent('note-jump', note, {noteId: id, noteType: note.type, crossPaper});
      if (!crossPaper) {
        jumpTo(note);
      } else {
        parent.location.hash = '#/read/' + note.categoryId + '/' + note.paperId;
      }
    }
  });

  function jumpTo(note) {
    const target = paperEl.querySelector('[data-section="' + CSS.escape(note.sectionId) + '"][data-para="' + note.paragraphIndex + '"]');
    if (!target) return;
    target.scrollIntoView({behavior: 'smooth', block: 'center'});
    target.classList.add('flash');
    setTimeout(() => target.classList.remove('flash'), 1600);
  }

  // ——— mobile drawer ———
  function setDrawer(open) {
    document.body.classList.toggle('notes-open', open);
    notesToggleEl.setAttribute('aria-expanded', String(open));
  }
  notesToggleEl.addEventListener('click', () => setDrawer(true));
  notesCloseEl.addEventListener('click', () => setDrawer(false));
  scrimEl.addEventListener('click', () => setDrawer(false));

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  function timeText(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    const pad = value => String(value).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  renderNotes();
  const paragraphs=[...paperEl.querySelectorAll('.selectable')];
  for(const p of paragraphs){const w=p.closest('.para-wrap');p.id=w.dataset.section+'-p'+(Number(w.dataset.para)+1);}
  tracking=activity(paper,paperEl,paragraphs);
  setupStudy(paper,$('study-open'));
}
