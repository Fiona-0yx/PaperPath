import {escape as esc} from './components.js';
import {papers, findPaper, termEntry, paragraphTranslation, abstractTranslation} from '../shared/papers.js';

const $ = id => document.getElementById(id);

const TYPE_META = {
  bookmark: {zh: '收藏', en: 'Saved'},
  question: {zh: '疑惑', en: 'Doubt'},
  translate: {zh: '翻译', en: 'Translate'},
  explain: {zh: '需要解释', en: 'Explain'}, // legacy notes created before 翻译 existed
};
const LEVELS = ['starter', 'basic', 'advanced'];
const LEVEL_META = {
  starter: {zh: '入门', en: 'Starter'},
  basic: {zh: '基础', en: 'Basic'},
  advanced: {zh: '进阶', en: 'Advanced'},
};
const MASTERY = [
  ['got', '理解了', 'Got it'],
  ['shaky', '还有点晕', 'Shaky'],
  ['lost', '没懂', 'Not yet'],
];

const outerShell = (() => {
  try { return (parent && parent !== window && parent.journalShell) || null; }
  catch { return null; } // cross-origin parent: run standalone
})();
const shell = outerShell || standaloneShell();

if (!shell) {
  $('paper').innerHTML = '<p style="padding:40px;color:#6f675b">阅读页加载失败。<br>The reader could not start.</p>';
} else {
  boot(shell);
}

// When the page is opened outside the app shell (直接打开这张 html), reading and
// note-taking still work: notes live in their own localStorage bucket.
function standaloneShell() {
  const KEY = 'lunjing-reader-standalone-v1';
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {readingNotes: []}; }
    catch { return {readingNotes: []}; }
  };
  const intake = load();
  if (!Array.isArray(intake.readingNotes)) intake.readingNotes = [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(intake)); } catch { /* ignore */ } };
  const id = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return {
    intake,
    standalone: true,
    language: (() => { try { return localStorage.getItem('lunjing-interface-language') || 'zh'; } catch { return 'zh'; } })(),
    setLanguage(next) { try { localStorage.setItem('lunjing-interface-language', next); } catch { /* ignore */ } location.reload(); },
    addReadingNote(note) {
      const entry = {...note, id: note.id || id(), createdAt: note.createdAt || Date.now()};
      intake.readingNotes.push(entry);
      save();
      return entry;
    },
    removeReadingNote(noteId) {
      const index = intake.readingNotes.findIndex(item => item.id === noteId);
      if (index !== -1) intake.readingNotes.splice(index, 1);
      save();
    },
    updateReadingNote(noteId, patch) {
      const note = intake.readingNotes.find(item => item.id === noteId);
      if (note) Object.assign(note, patch);
      save();
      return note;
    },
  };
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
  const notesProfileEl = $('notesProfile');
  const chipEl = $('selectionChip');

  let menuInfo = null;
  let chipInfo = null;
  let filter = 'all';
  let toastTimer = null;
  let lastSelection = null;

  // Level inferred from the intake answers already collected by the journal.
  // Keywords only: nothing here is presented as a model verdict.
  const profileLevel = abilityLevel(shell.intake || {});

  // ——— event reporting (backend statistics for later agent analysis) ———
  const userId = (() => {
    try {
      let id = localStorage.getItem('lunjing-reader-uid');
      if (!id || id.length < 6) {
        id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        localStorage.setItem('lunjing-reader-uid', id);
      }
      return id;
    } catch { return 'u-anon'; }
  })();

  function reportEvent(kind, info, extra) {
    const text = info?.text || '';
    const payload = {
      kind,
      userId,
      paperId: paper.id,
      paperTitle: paper.title,
      categoryId: paper.categoryId,
      sectionId: info?.sectionId || '',
      sectionHeading: info?.sectionHeading || '',
      paragraphIndex: info?.paragraphIndex ?? -1,
      textLength: text.length,
      text: text.slice(0, 200),
      lang: shell.language,
      at: Date.now(),
      ...(extra || {}),
    };
    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) navigator.sendBeacon('/api/reader/events', new Blob([body], {type: 'application/json'}));
      else fetch('/api/reader/events', {method: 'POST', headers: {'Content-Type': 'application/json'}, body, keepalive: true}).catch(() => {});
    } catch { /* ignore: statistics are best-effort */ }
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
  const chipLabels = {question: L('疑惑', 'Doubt'), bookmark: L('收藏', 'Save'), translate: L('翻译', 'Translate')};
  chipEl.querySelectorAll('[data-action]').forEach(button => {
    button.textContent = chipLabels[button.dataset.action] || '';
  });
  if (notesProfileEl) {
    notesProfileEl.textContent = L('个人中心', 'Profile');
    notesProfileEl.href = '/#/profile';
    notesProfileEl.target = '_parent';
  }

  // ——— paper body ———
  const difficulty = '★'.repeat(paper.difficulty) + '☆'.repeat(Math.max(0, 5 - paper.difficulty));
  paperEl.innerHTML =
    '<h1>' + esc(paper.title) + '</h1>' +
    '<p class="paper-sub">' + esc(paper.zhTitle) + ' · ' + L('难度', 'Difficulty') + ' ' + difficulty + '</p>' +
    '<div class="para-wrap" data-section="abstract" data-para="0">' +
      '<p class="abstract selectable">' + esc(paper.abstract) + '</p>' +
      '<span class="para-tag">' + L('摘要', 'Abstract') + '</span>' +
    '</div>' +
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
  function sectionHeading(id) {
    if (id === 'abstract') return L('摘要', 'Abstract');
    return paper.sections.find(section => section.id === id)?.heading || '';
  }

  function infoFromRange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const element = node.nodeType === 1 ? node : node.parentElement;
    const wrap = element?.closest?.('.para-wrap');
    if (!wrap || !paperEl.contains(wrap)) return null;
    return {
      text,
      context: wrap.textContent.replace(/\s+/g, ' ').trim(),
      sectionId: wrap.dataset.section,
      sectionHeading: sectionHeading(wrap.dataset.section),
      paragraphIndex: Number(wrap.dataset.para) || 0,
    };
  }

  function selectionInfo() {
    return infoFromRange() || lastSelection;
  }

  document.addEventListener('selectionchange', () => {
    const info = infoFromRange();
    lastSelection = info;
    if (info) showChip(info);
    else hideChip();
  });

  // ——— floating chip (the discoverable path next to the selection) ———
  function showChip(info) {
    chipInfo = info;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return hideChip();
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    chipEl.hidden = false;
    const width = chipEl.offsetWidth || 190;
    let left = rect.left + rect.width / 2 - width / 2;
    let top = rect.top - (chipEl.offsetHeight || 36) - 8;
    if (top < 60) top = rect.bottom + 8;
    left = Math.max(8, Math.min(left, innerWidth - width - 8));
    chipEl.style.left = left + 'px';
    chipEl.style.top = top + 'px';
  }
  function hideChip() {
    chipEl.hidden = true;
    chipInfo = null;
  }

  chipEl.addEventListener('mousedown', event => event.preventDefault());
  chipEl.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const info = chipInfo || selectionInfo();
    if (!info) return;
    hideChip();
    handleMenuAction(button.dataset.action, info);
  });

  // ——— context menu ———
  const icons = {
    bookmark: '<svg class="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.5h10v13l-5-3.2-5 3.2z"/></svg>',
    question: '<svg class="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><path d="M7.7 7.4a2.4 2.4 0 1 1 3.1 2.3c-.55.2-.9.7-.9 1.3v.4"/><circle cx="10" cy="14" r=".6" fill="currentColor"/></svg>',
    translate: '<svg class="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h7M6.5 5v10M4 15h5"/><path d="M5.5 9.5c1.6 2.4 3.4 3.6 5.5 4.2"/><path d="M13 8h4l-2 8"/></svg>',
  };

  function showMenu(x, y, info) {
    menuInfo = info;
    const routeText = info.sectionHeading + ' · ' + L('第', '¶') + (info.paragraphIndex + 1) + L('段', '');
    menuEl.innerHTML =
      '<div class="menu-route" title="' + esc(info.text) + '">' + esc(routeText) + ' · ' + esc(info.text.slice(0, 14)) + (info.text.length > 14 ? '…' : '') + '</div>' +
      '<button type="button" role="menuitem" data-action="question">' + icons.question + '<span>' + L('疑惑', 'Doubt') + '</span><span class="arrow">↵</span></button>' +
      '<button type="button" role="menuitem" data-action="bookmark">' + icons.bookmark + '<span>' + L('收藏', 'Save') + '</span><span class="arrow">↵</span></button>' +
      '<button type="button" role="menuitem" data-action="translate">' + icons.translate + '<span>' + L('翻译', 'Translate') + '</span><span class="arrow">↵</span></button>' +
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

  // Bound on document so the menu also works on headings/abstract and any
  // wrapper the layout may add later.
  document.addEventListener('contextmenu', event => {
    if (!paperEl.contains(event.target)) return;
    const info = selectionInfo();
    if (!info) {
      toast(L('先选中一段文字，再右键', 'Select some text first, then right-click'));
      return; // no selection: keep the browser's own menu
    }
    event.preventDefault();
    hideChip();
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
  window.addEventListener('scroll', () => { closeMenu('scroll'); hideChip(); }, {passive: true});
  window.addEventListener('resize', () => { closeMenu('resize'); hideChip(); });

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
    const entry = shell.addReadingNote(note);
    reportEvent('action', info, {action, noteId: entry.id, noteType: action, source: 'menu'});
    renderNotes();
    if (action === 'bookmark') toast(L('已收藏 · 右侧可管理', 'Saved · manage it in the sidebar'));
    else if (action === 'question') toast(L('已记录疑惑 · 右侧查看讲解', 'Doubt recorded · open the sidebar'));
    else toast(L('已记录 · 右侧查看译文', 'Recorded · translation in the sidebar'));
    window.getSelection()?.removeAllRanges();
    lastSelection = null;
    hideChip();
  }

  // ——— sidebar ———
  const filters = [
    ['all', () => L('全部', 'All')],
    ['bookmark', () => L('收藏', 'Saved')],
    ['question', () => L('疑惑', 'Doubt')],
    ['translate', () => L('翻译', 'Translate')],
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

  function typeOf(note) {
    return note.type === 'explain' ? 'question' : note.type;
  }

  function levelOf(note) {
    return LEVELS.includes(note.level) ? note.level : profileLevel;
  }

  function explanationBlock(note) {
    const entry = termEntry(paper.id, note.text);
    const level = levelOf(note);
    const levelName = L(LEVEL_META[level].zh, LEVEL_META[level].en);
    const head = '<div class="note-block"><p class="block-label">' + L('讲解', 'Explanation') +
      '<span class="level-chip">' + L('按画像', 'level') + '：' + esc(levelName) + '</span>' +
      '<button type="button" class="mini" data-action="level">' + L('换个层次', 'Switch level') + '</button></p>';
    if (!entry) {
      return head +
        '<p class="note-body">' + L('离线知识库里没有这个词条，暂无讲解。等 AI 讲解服务接入后会补上。', 'No offline entry for this phrase yet. An AI explanation will appear once the service is connected.') + '</p></div>';
    }
    const body = level === 'advanced' ? entry.advanced : entry.basic;
    const probes = (entry.probes || []).slice(0, 2);
    const probeHtml = probes.length
      ? '<div class="probe-list"><p class="block-label">' + L('追问 · 帮助细化画像', 'Follow-up questions') + '</p>' +
        probes.map((question, index) => {
          const saved = (note.probes || [])[index];
          return '<div class="probe" data-probe="' + index + '">' +
            '<p class="probe-q">' + esc(question) + '</p>' +
            (saved
              ? '<p class="probe-a">' + L('你的回答：', 'Your answer: ') + esc(saved) + '</p>'
              : '<div class="probe-input-row"><input type="text" class="probe-input" maxlength="160" placeholder="' + L('用自己的话答一句', 'Answer in your own words') + '"><button type="button" class="mini" data-action="probe">' + L('记录', 'Save') + '</button></div>') +
            '</div>';
        }).join('') + '</div>'
      : '';
    return head +
      '<p class="note-body"><b>' + esc(entry.zh) + '</b> · ' + esc(body) + '</p>' +
      probeHtml + '</div>';
  }

  function translationBlock(note) {
    const entry = termEntry(paper.id, note.text);
    const paragraph = note.sectionId === 'abstract'
      ? abstractTranslation(paper.id)
      : paragraphTranslation(paper.id, note.sectionId, note.paragraphIndex);
    const termPart = entry
      ? '<p class="note-body"><b>' + esc(note.text) + '</b> · ' + esc(entry.zh) + '</p>'
      : '';
    const body = paragraph
      ? '<p class="note-body note-translation">' + esc(paragraph) + '</p>'
      : '<p class="note-body">' + L('这一段暂时没有离线译文。', 'No offline translation for this paragraph yet.') + '</p>';
    return '<div class="note-block"><p class="block-label">' + L('译文', 'Translation') + '</p>' + termPart + body + '</div>';
  }

  function masteryBlock(note) {
    const current = note.mastery || '';
    const buttons = MASTERY.map(([key, zh, en]) =>
      '<button type="button" class="mastery' + (current === key ? ' on' : '') + '" data-action="mastery" data-mastery="' + key + '">' +
      L(zh, en) + '</button>').join('');
    return '<div class="mastery-row" role="group" aria-label="' + L('是否理解掌握', 'Did you understand it') + '">' +
      '<span class="mastery-label">' + L('是否理解掌握', 'Understood?') + '</span>' + buttons + '</div>';
  }

  function bookmarkActions(note) {
    return '<div class="note-remark-row">' +
      '<input type="text" class="note-remark" maxlength="200" value="' + esc(note.remark || '') + '" placeholder="' + L('给这条收藏加个备注', 'Add a remark') + '">' +
      '<button type="button" class="mini" data-action="remark">' + L('保存', 'Save') + '</button>' +
      '</div>';
  }

  function noteCard(note) {
    const kind = typeOf(note);
    const meta = TYPE_META[kind] || TYPE_META.question;
    const tag = L(meta.zh, meta.en);
    const locText = esc(note.sectionHeading || '') + '<span class="dot">·</span>' + L('第', '¶') + ((note.paragraphIndex || 0) + 1) + L('段', '');
    const context = note.context ? '…' + esc(note.context) + '…' : '';
    const resolveLabel = note.resolved ? L('标记未解决', 'Mark open') : L('标记已解决', 'Mark resolved');
    const bodyBlock = kind === 'question' ? explanationBlock(note) : kind === 'translate' ? translationBlock(note) : '';
    return '<li class="note-card ' + (note.resolved ? 'resolved ' : '') + '" data-note-id="' + esc(note.id) + '">' +
      '<div class="note-top">' +
        '<span class="note-badge ' + kind + '">' + tag + '</span>' +
        '<span class="note-time">' + timeText(note.createdAt) + '</span>' +
      '</div>' +
      '<p class="note-text">' + esc(note.text) + '</p>' +
      (kind !== 'bookmark' ? '<p class="note-context">' + context + '</p>' : '') +
      '<div class="note-loc">' + esc(note.paperTitle || '') + '<span class="dot">·</span>' + locText + '</div>' +
      bodyBlock +
      (kind === 'bookmark' ? bookmarkActions(note) : '') +
      masteryBlock(note) +
      '<div class="note-actions">' +
        '<button type="button" data-action="jump">' + L('查看原文', 'View source') + '</button>' +
        (kind === 'bookmark' ? '<a class="cta" href="/#/profile" target="_parent">' + L('个人中心', 'Profile') + '</a>' : '') +
        '<button type="button" data-action="resolve">' + resolveLabel + '</button>' +
        '<button type="button" data-action="delete" class="danger">' + L('删除', 'Delete') + '</button>' +
      '</div>' +
    '</li>';
  }

  function renderNotes() {
    const all = shell.intake.readingNotes || [];
    const shown = all
      .filter(note => filter === 'all' || typeOf(note) === filter)
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const total = all.length;
    notesCountEl.textContent = total ? total + L(' 条', ' notes') : L('空', 'empty');
    notesToggleBadge.textContent = total;
    noteFiltersEl.querySelectorAll('[data-filter]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    });
    if (!shown.length) {
      notesListEl.innerHTML = '<li class="notes-empty"><b>' + L('还没有记录', 'Nothing yet') + '</b>' +
        L('选中正文里的词句，右键或点浮出的按钮即可收藏、记疑惑或翻译。', 'Select a phrase and right-click (or use the floating buttons) to save it, note a doubt, or translate it.') + '</li>';
      return;
    }
    notesListEl.innerHTML = shown.map(noteCard).join('');
  }

  function currentNote(id) {
    return (shell.intake.readingNotes || []).find(item => item.id === id) || null;
  }

  notesListEl.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const card = button.closest('[data-note-id]');
    if (!card) return;
    const id = card.dataset.noteId;
    const note = currentNote(id);
    if (!note) return;
    const action = button.dataset.action;
    if (action === 'delete') {
      shell.removeReadingNote(id);
      reportEvent('note-delete', note, {noteId: id, noteType: typeOf(note)});
      renderNotes();
      toast(L('已删除', 'Deleted'));
    } else if (action === 'resolve') {
      const next = !note.resolved;
      shell.updateReadingNote(id, {resolved: next});
      reportEvent('note-resolve', note, {noteId: id, noteType: typeOf(note), resolved: next});
      renderNotes();
    } else if (action === 'jump') {
      const crossPaper = note.paperId !== paper.id;
      reportEvent('note-jump', note, {noteId: id, noteType: typeOf(note), crossPaper});
      if (!crossPaper) {
        jumpTo(note);
      } else {
        parent.location.hash = '#/read/' + note.categoryId + '/' + note.paperId;
      }
    } else if (action === 'mastery') {
      const value = button.dataset.mastery;
      const next = note.mastery === value ? '' : value;
      shell.updateReadingNote(id, {mastery: next});
      reportEvent('note-mastery', note, {noteId: id, noteType: typeOf(note), mastery: next || 'cleared'});
      renderNotes();
    } else if (action === 'level') {
      const current = levelOf(note);
      const next = LEVELS[(LEVELS.indexOf(current) + 1) % LEVELS.length];
      shell.updateReadingNote(id, {level: next});
      reportEvent('note-level', note, {noteId: id, noteType: typeOf(note), level: next});
      renderNotes();
    } else if (action === 'probe') {
      const row = button.closest('.probe');
      const input = row?.querySelector('.probe-input');
      const answer = (input?.value || '').trim();
      if (!answer) {
        toast(L('先用一句话回答，再记录', 'Type a short answer first'));
        return;
      }
      const probes = Array.isArray(note.probes) ? note.probes.slice() : [];
      probes[Number(row.dataset.probe) || 0] = answer;
      shell.updateReadingNote(id, {probes});
      reportEvent('note-probe', note, {noteId: id, noteType: typeOf(note), probes: probes.filter(Boolean).length});
      renderNotes();
      toast(L('已记录你的理解', 'Answer saved'));
    } else if (action === 'remark') {
      const input = card.querySelector('.note-remark');
      const remark = (input?.value || '').trim();
      shell.updateReadingNote(id, {remark});
      reportEvent('note-remark', note, {noteId: id, noteType: typeOf(note)});
      renderNotes();
      toast(L('备注已保存', 'Remark saved'));
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
  reportEvent('reader-open', null, {});
}

// Coarse keyword mapping from the journal answers to an explanation level.
function abilityLevel(intake) {
  const parts = [];
  for (const answer of Object.values(intake.answers || {})) {
    if (!answer || typeof answer !== 'object') continue;
    if (answer.text) parts.push(answer.text);
    if (answer.other) parts.push(answer.other);
  }
  for (const note of intake.readingNotes || []) {
    if (note.mastery === 'lost' && note.text) parts.push(note.text);
  }
  const blob = parts.join(' ');
  if (/入门|零基础|没学过|刚开始|新手|不了解|不清楚/.test(blob)) return 'starter';
  if (/熟练|系统学|有项目|做过|进阶|熟悉|深入/.test(blob)) return 'advanced';
  return 'basic';
}
