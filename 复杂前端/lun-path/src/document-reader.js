import { findPaper } from "../shared/papers.js";
import { activity, api, flush, readLocal, writeLocal } from "./reader-api.js";
import { setupStudy } from "./study-panel.js";

const $ = (id) => document.getElementById(id);
const paper = findPaper(new URLSearchParams(location.search).get("paper"));
if (!paper) throw Error("论文不存在");
const article = $("paper");
const radiation = paper.id === "radiation";
if (radiation)
  article
    .querySelector(".paper")
    .replaceChildren($("radiation-paper").content.cloneNode(true));
document.title = paper.title + " · 论径";
document
  .querySelector(".headline")
  .append(...["h1", ".meta", ".subtitle"].map((s) => article.querySelector(s)));
const related = findPaper(radiation ? "attention" : "radiation");
function shellUrl(hash) {
  return new URL("../index.html#/" + hash, location.href).href;
}
$("shelf-link").href = shellUrl("shelf/" + paper.categoryId);
$("recommend").href = shellUrl(
  "read/" + related.categoryId + "/" + related.id + "?source=recommendation",
);
$("recommend").target = "_parent";
$("related-title").textContent = related.title;
$("recommend").querySelector(".thumb").textContent = radiation ? "Q·K" : "Rₙ";

const sections = [...article.querySelectorAll("section")];
const paragraphs = sections.flatMap((section) =>
  [...section.querySelectorAll("p")].map((p, i) => {
    p.id = section.id + "-p" + (i + 1);
    return p;
  }),
);
const recorder = activity(paper, article, paragraphs);
const study = setupStudy(paper, $("study-open"));
const noteKey = "lunjing." + paper.id + ".demo.v1";
const records = readLocal(noteKey, []);
const notes = Array.isArray(records) ? records : [];
const draftKey = "lunjing.draft." + paper.id;
let draft = readLocal(draftKey, null),
  selection = null;
function place(p) {
  return {
    paperId: paper.id,
    sectionId: p.closest("section").id,
    paragraphId: p.id,
  };
}
function current() {
  const line = article.getBoundingClientRect().top + 30;
  return (
    paragraphs.filter((p) => p.getBoundingClientRect().top <= line).at(-1) ||
    paragraphs[0]
  );
}
function switchPane(id) {
  document.body.dataset.pane = id;
  document
    .querySelectorAll("button[data-pane]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.pane === id)),
    );
  recorder.sample();
}
document
  .querySelectorAll("button[data-pane]")
  .forEach((b) => (b.onclick = () => switchPane(b.dataset.pane)));
switchPane("paper");

function endpoint(node, n) {
  const el = (node.nodeType === 1 ? node : node.parentElement)?.closest(
    "section p",
  );
  if (!el || !paragraphs.includes(el)) return null;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.setEnd(node, n);
  return { ...place(el), offset: r.toString().length };
}
function textPoint(ep) {
  const el = $(ep.paragraphId);
  if (!el || el.closest("section")?.id !== ep.sectionId) return null;
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let left = ep.offset;
  while (walk.nextNode()) {
    const n = walk.currentNode;
    if (n.length >= left) return [n, left];
    left -= n.length;
  }
  return null;
}
function asRange(ref) {
  if (!ref) return null;
  const start = textPoint(ref.start),
    end = textPoint(ref.end);
  if (!start || !end) return null;
  const r = document.createRange();
  r.setStart(...start);
  r.setEnd(...end);
  return r;
}
function quoteText(ref) {
  const first = paragraphs.indexOf($(ref.start.paragraphId)),
    last = paragraphs.indexOf($(ref.end.paragraphId));
  return paragraphs
    .slice(first, last + 1)
    .map((p, i) =>
      p.textContent.slice(
        i === 0 ? ref.start.offset : 0,
        first + i === last ? ref.end.offset : undefined,
      ),
    )
    .join("\n");
}
function jump(target, source, noteId) {
  const from = place(current());
  switchPane("paper");
  const range = asRange(target.range);
  const matches =
    range &&
    (!target.quote || quoteText(target.range) === target.quote) &&
    (!target.version || target.version === "v1");
  const section = $(target.section || target.range?.start.sectionId);
  const p = matches
    ? $(target.range.start.paragraphId)
    : section?.querySelector("p");
  if (!p) return;
  article.scrollTop +=
    p.getBoundingClientRect().top - article.getBoundingClientRect().top - 18;
  if (matches && window.Highlight) {
    CSS.highlights.set("origin", new Highlight(range));
    setTimeout(() => CSS.highlights.delete("origin"), 1600);
  } else {
    p.classList.add("flash");
    setTimeout(() => p.classList.remove("flash"), 1600);
  }
  if (target.range && !matches)
    $("status").textContent = "原文已更新，已定位到所属章节。";
  recorder.event(source === "note" ? "note-jump" : "position-jump", {
    source,
    noteId,
    from,
    to: place(p),
  });
}
const links = sections.map((s) => {
  const b = document.createElement("a");
  b.href = "#" + s.id;
  b.textContent = s.querySelector("h2").textContent;
  b.onclick = (e) => {
    e.preventDefault();
    jump({ section: s.id }, "toc");
  };
  $("contents").append(b);
  return b;
});
function label() {
  const section = $(draft?.section) || current().closest("section");
  $("anchor").textContent =
    "关于「" +
    section.querySelector("h2").textContent +
    "」" +
    (draft?.quote ? " · " + draft.quote : "");
}
function update() {
  const section = current().closest("section");
  links.forEach((b, i) =>
    b.toggleAttribute("data-active", sections[i] === section),
  );
  links.forEach((b, i) => {
    if (sections[i] === section) b.setAttribute("aria-current", "location");
    else b.removeAttribute("aria-current");
  });
  label();
}
article.addEventListener("scroll", update, { passive: true });
$("question").value = draft?.question || "";
$("question").oninput = () => {
  draft = {
    ...(draft || { section: current().closest("section").id }),
    question: $("question").value,
  };
  writeLocal(draftKey, draft);
  label();
};

const menu = document.createElement("div");
menu.className = "quote-menu";
menu.hidden = true;
menu.setAttribute("role", "group");
menu.innerHTML =
  '<button data-action="question">记疑问</button> <button data-action="ask">问 AI</button>';
document.body.append(menu);
function dismiss(reason) {
  if (selection && reason)
    recorder.event("menu-dismissed", {
      selectionId: selection.selectionId,
      reason,
      range: selection.range,
    });
  selection = null;
  menu.hidden = true;
}
function show(range, quote, rect) {
  if (selection && JSON.stringify(selection.range) === JSON.stringify(range))
    return;
  dismiss("changed");
  selection = {
    selectionId: crypto.randomUUID(),
    range,
    quote,
    section: range.start.sectionId,
    version: "v1",
  };
  menu.hidden = false;
  menu.style.left =
    Math.max(4, Math.min(innerWidth - menu.offsetWidth - 4, rect.left)) + "px";
  menu.style.top =
    Math.max(
      4,
      Math.min(innerHeight - menu.offsetHeight - 4, rect.bottom + 6),
    ) + "px";
  recorder.event("menu-opened", {
    selectionId: selection.selectionId,
    range,
    textLength: quote.length,
  });
}
let selectionTimer;
document.addEventListener("selectionchange", () => {
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => {
    const s = getSelection();
    if (!s.rangeCount || s.isCollapsed) {
      dismiss("collapsed");
      return;
    }
    const r = s.getRangeAt(0),
      start = endpoint(r.startContainer, r.startOffset),
      end = endpoint(r.endContainer, r.endOffset);
    if (start && end && r.toString().trim())
      show(
        { start, end },
        quoteText({ start, end }),
        r.getBoundingClientRect(),
      );
    else dismiss("outside");
  }, 260);
});
paragraphs.forEach((p) => {
  const b = document.createElement("button");
  b.className = "paragraph-action";
  b.textContent = "段落操作";
  b.onclick = () => {
    const pos = place(p);
    show(
      {
        start: { ...pos, offset: 0 },
        end: { ...pos, offset: p.textContent.length },
      },
      p.textContent,
      b.getBoundingClientRect(),
    );
    menu.querySelector("button").focus();
  };
  p.after(b);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") dismiss("escape");
});
menu.onpointerdown = (e) => e.preventDefault();
menu.onclick = (e) => {
  const action = e.target.dataset.action;
  if (!action || !selection) return;
  const ref = selection;
  recorder.event("action", {
    action,
    selectionId: ref.selectionId,
    range: ref.range,
  });
  draft = { ...ref, question: $("question").value };
  writeLocal(draftKey, draft);
  dismiss();
  getSelection().removeAllRanges();
  switchPane("chat");
  label();
  $("question").focus();
  $("status").textContent =
    action === "ask"
      ? "写下你想问的问题，再点「提问」。"
      : "写下疑问，再点「仅记手记」。";
};
document.addEventListener("pointerdown", (e) => {
  if (!menu.contains(e.target) && !article.contains(e.target))
    dismiss("outside");
});
const cancel = document.createElement("button");
cancel.type = "button";
cancel.textContent = "取消草稿";
$("questions").querySelector(".actions").append(cancel);
function clearDraft() {
  draft = null;
  writeLocal(draftKey, null);
  $("question").value = "";
  label();
}
cancel.onclick = () => {
  clearDraft();
  $("status").textContent = "草稿已取消。";
};
function showNotes() {
  const list = $("notes");
  list.replaceChildren();
  const entries = notes.filter((n) => n?.type === "question");
  $("count").textContent = entries.length;
  for (const n of entries.slice().reverse()) {
    const row = document.createElement("li"),
      source = document.createElement("button"),
      resolve = document.createElement("button");
    source.textContent =
      ($(n.section)?.querySelector("h2")?.textContent || n.section) +
      " · " +
      n.question;
    source.onclick = () => jump(n, "note", n.id);
    resolve.textContent = n.resolved ? "已解决 · 重新打开" : "标记已解决";
    resolve.onclick = () => {
      n.id ||= crypto.randomUUID();
      n.resolved = !n.resolved;
      const ok = writeLocal(noteKey, notes);
      recorder.event("note-resolve", {
        noteId: n.id,
        resolved: n.resolved,
        range: n.range,
      });
      showNotes();
      if (!ok) $("status").textContent = "仅在本页暂存";
    };
    row.append(source, resolve);
    list.append(row);
  }
  if (!entries.length) list.textContent = "还没有记下问题。";
}
async function ask(n) {
  const feed = $("messages"),
    msg = document.createElement("p");
  msg.className = "message";
  msg.textContent = n.question;
  feed.append(msg);
  const reply = document.createElement("p");
  reply.className = "message";
  reply.textContent = "正在查阅本文…";
  feed.append(reply);
  try {
    const data = await api("analyze", "POST", {
      paperId: paper.id,
      contentVersion: "v1",
      question: n.question,
      range: n.range,
      text: n.quote,
      mode: $("online-model").checked ? "model" : "retrieval",
      test_id: study.testId,
    });
    reply.textContent = data.explanation;
    for (const citation of data.citations) {
      const link = document.createElement("button");
      link.className = "source-link";
      link.textContent =
        "查看原文 · " +
        $(citation.range.start.sectionId).querySelector("h2").textContent;
      link.onclick = () => jump(citation, "answer-source");
      feed.append(link);
    }
  } catch (error) {
    const p = $(n.range?.start.paragraphId) || $(n.section)?.querySelector("p");
    reply.textContent =
      "服务暂不可用。" +
      (p ? "本地章节摘录 · " + p.textContent : "问题已保存在本机。");
  }
  feed.scrollTop = feed.scrollHeight;
}
$("questions").onsubmit = (e) => {
  e.preventDefault();
  const question = $("question").value.trim();
  if (!question) return;
  const n = {
    ...draft,
    type: "question",
    id: crypto.randomUUID(),
    time: Date.now(),
    section: draft?.section || current().closest("section").id,
    question,
    resolved: false,
  };
  notes.push(n);
  const stored = writeLocal(noteKey, notes);
  recorder.event("question-saved", { noteId: n.id, range: n.range });
  if (e.submitter?.value === "ask") {
    recorder.event("ai-question-sent", { noteId: n.id, range: n.range });
    ask(n);
  }
  clearDraft();
  showNotes();
  $("status").textContent = stored
    ? "已保存，可从已记问题返回原文。"
    : "仅在本页暂存";
};
$("suggest").textContent = radiation
  ? "训练集和测试集的峰值分别在哪个月？"
  : "查询、键和值各有什么作用？";
$("suggest").onclick = () => {
  $("question").value = $("suggest").textContent;
  $("question").dispatchEvent(new Event("input"));
  $("questions").requestSubmit(document.querySelector(".send"));
};
const activityDialog = document.createElement("dialog");
activityDialog.className = "study-dialog";
document.body.append(activityDialog);
activityDialog.innerHTML =
  '<div class="study-top"><h2>本篇阅读记录</h2><button>关闭</button></div><p>记录段落可见时长、主动回看和手记处理。问题与引文保存在本机。</p><button id="pause-record"></button><div id="record-summary" role="status"></div>';
activityDialog.querySelector(".study-top button").onclick = () =>
  activityDialog.close();
async function stats() {
  $("pause-record").textContent = recorder.paused ? "恢复记录" : "暂停记录";
  const data = recorder.localSummary();
  $("record-summary").textContent =
    "本机可见时长 " +
    (data.visibleMs / 1000).toFixed(1) +
    " 秒 · 已解决 " +
    data.resolvedNoteCount +
    " 条 · 回看 " +
    Object.values(data.activeReturns).reduce((a, b) => a + b, 0) +
    " 次";
  for (const p of data?.paragraphs || []) {
    const row = document.createElement("p");
    row.textContent =
      p.paragraphId + " · " + (p.visibleMs / 1000).toFixed(1) + " 秒";
    $("record-summary").append(row);
  }
  const sync = document.createElement("p");
  $("record-summary").append(sync);
  try {
    await flush();
    const server = await api(
      "me/summary?paperId=" + encodeURIComponent(paper.id),
    );
    sync.textContent =
      "服务端已收到 " + (server.visibleMs / 1000).toFixed(1) + " 秒可见记录。";
  } catch {
    sync.textContent = "当前离线，待网络恢复后同步。";
  }
}
$("activity-open").onclick = () => {
  activityDialog.showModal();
  stats();
};
$("pause-record").onclick = () => {
  recorder.toggle();
  stats();
};
update();
showNotes();
