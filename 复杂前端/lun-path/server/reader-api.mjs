import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { runCodexJson } from "../../../论径后端/recommendation/questionnaire-codex.mjs";
import { summarizeEvents } from "../shared/reader-summary.js";
import { selectedPaper } from "./selected-papers.mjs";
import { recommendations } from './recommendations.mjs';
import { searchByKeyword } from './paper-search.mjs';

const worker = fileURLToPath(
  new URL("../../../论径后端/reader_worker.py", import.meta.url),
);
const folder =
  process.env.LUNJING_DATA_DIR ||
  fileURLToPath(new URL("../data/", import.meta.url));
let db;
function database() {
  if (db) return db;
  if (folder !== ":memory:") mkdirSync(folder, { recursive: true });
  db = new DatabaseSync(
    folder === ":memory:" ? folder : join(folder, "reader.sqlite3"),
  );
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, owner TEXT, paper TEXT, revision INTEGER, input TEXT, plan TEXT);
    CREATE TABLE IF NOT EXISTS tests (id TEXT PRIMARY KEY, owner TEXT, paper TEXT, planId TEXT, revision INTEGER, session TEXT, student TEXT, submission TEXT, report TEXT);
    CREATE TABLE IF NOT EXISTS events (owner TEXT, id TEXT, paper TEXT, at INTEGER, payload TEXT, PRIMARY KEY(owner,id));
    CREATE INDEX IF NOT EXISTS paper_events ON events(owner,paper,at);
    CREATE TABLE IF NOT EXISTS portraits (owner TEXT PRIMARY KEY, snapshot TEXT, report TEXT);`);
  return db;
}
const fail = (status, code, message) => {
  throw Object.assign(new Error(message), { status, code });
};
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const identifier = (v) =>
  typeof v === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const codexEnabled = () => process.env.LUNJING_MODEL_PROVIDER?.trim() === "codex";
const pretestTimeoutSeconds = () => codexEnabled() ? 60 : 20;
function callWorker(task, response) {
  return new Promise((resolve, reject) => {
    const quickTest = task.op === "test" && task.mode === "quick";
    const codex = codexEnabled() && (task.op === "answer" ||
      (task.op === "test" && !["sample", "skip"].includes(task.mode)));
    const controller = new AbortController();
    const child = execFile(
      process.env.LUNJING_PYTHON || "python",
      ["-B", worker, ...(codex ? ["--codex-bridge"] : [])],
      { windowsHide: true, timeout: quickTest ? pretestTimeoutSeconds() * 1000 : codex ? 120000 : 210000,
        maxBuffer: 2 * 1024 * 1024 },
      (error, out) => {
        controller.abort();
        response?.off?.("close", stopWorker);
        try {
          if (response?.destroyed)
            fail(503, "REQUEST_CLOSED", "已停止出题");
          if (quickTest && error?.killed)
            fail(504, "MODEL_TIMEOUT", `在线出题超过 ${pretestTimeoutSeconds()} 秒，请重试或选择其他方式继续。`);
          if (error)
            fail(
              503,
              "WORKER_UNAVAILABLE",
              "Python 服务不可用，请检查 Python 和 jsonschema。",
            );
          const reply = JSON.parse(codex ? out.trimEnd().split("\n").at(-1) : out);
          if (reply.status) fail(reply.status, "READER_WORKER", reply.message);
          resolve(reply.result);
        } catch (e) {
          reject(e);
        }
      },
    );
    const stopWorker = () => {
      if (!response.writableEnded) {
        controller.abort();
        child.kill();
      }
    };
    response?.once?.("close", stopWorker);
    child.stdin.on("error", () => {});
    if (codex) {
      const lines = createInterface({input: child.stdout, crlfDelay: Infinity});
      lines.on("line", async line => {
        try {
          const request = JSON.parse(line).completion;
          if (!request) return;
          const result = await runCodexJson({...request, signal:controller.signal});
          if (!controller.signal.aborted) child.stdin.write(JSON.stringify({result}) + "\n");
        } catch {
          if (!controller.signal.aborted) child.stdin.write("{}\n");
        }
      });
      child.stdin.write(JSON.stringify(task) + "\n");
    } else {
      child.stdin.end(JSON.stringify(task));
    }
  });
}
function own(table, id, owner) {
  const row = database()
    .prepare("SELECT * FROM " + table + " WHERE id=? AND owner=?")
    .get(id, owner);
  if (!row) fail(404, "NOT_FOUND", "记录不存在");
  return row;
}
function requireMethod(req, ...allowed) {
  if (!allowed.includes(req.method))
    fail(405, "METHOD_NOT_ALLOWED", "请求方式错误");
}
function paperFor(id, version) {
  const paper = selectedPaper(id);
  if (!paper) fail(404, "PAPER_NOT_FOUND", "论文不存在");
  if (version !== undefined && version !== (paper.version || "v1"))
    fail(409, "CONTENT_CHANGED", "原文已更新");
  return paper;
}
const envelope = (row) => ({
  planId: row.id,
  paperId: row.paper,
  revision: row.revision,
  plan: JSON.parse(row.plan),
});
function summary(owner, paperId) {
  const rows = database()
    .prepare(
      "SELECT payload FROM events WHERE owner=? AND paper=? ORDER BY at,rowid",
    )
    .all(owner, paperId);
  return summarizeEvents(
    paperId,
    rows.map((row) => JSON.parse(row.payload)),
  );
}
function overview(owner) {
  const rows = database()
    .prepare("SELECT payload FROM events WHERE owner=? ORDER BY at,rowid")
    .all(owner);
  const byAction = {},
    days = new Set(),
    resolved = new Set();
  const funnel = { menuOpened: 0, dismissed: 0, acted: 0 },
    lifecycle = { resolved: 0, deleted: 0, jumped: 0 };
  for (const row of rows) {
    const e = JSON.parse(row.payload);
    days.add(new Date(e.at).toISOString().slice(0, 10));
    if (e.kind === "menu-opened") funnel.menuOpened++;
    if (e.kind === "menu-dismissed") funnel.dismissed++;
    if (e.kind === "action") {
      funnel.acted++;
      byAction[e.action] = (byAction[e.action] || 0) + 1;
    }
    if (e.kind === "note-resolve") {
      if (e.resolved) resolved.add(e.noteId);
      else resolved.delete(e.noteId);
    }
    if (e.kind === "note-delete") {
      resolved.delete(e.noteId);
      lifecycle.deleted++;
    }
    if (e.kind === "note-jump") lifecycle.jumped++;
  }
  lifecycle.resolved = resolved.size;
  return {
    total: rows.length,
    updatedAt: Date.now(),
    span: { days: days.size },
    byAction,
    funnel,
    lifecycle,
  };
}
function point(value, paper, withOffset = false) {
  if (!object(value)) fail(422, "INVALID_POSITION", "缺少原文位置");
  const section = paper.sections.find((s) => s.id === value.sectionId);
  const index =
    section?.paragraphs.findIndex(
      (_, i) => section.id + "-p" + (i + 1) === value.paragraphId,
    ) ?? -1;
  if (index < 0 || (value.paperId && value.paperId !== paper.id))
    fail(422, "INVALID_POSITION", "未知段落");
  const result = { sectionId: section.id, paragraphId: value.paragraphId };
  if (withOffset) {
    if (
      !Number.isInteger(value.offset) ||
      value.offset < 0 ||
      value.offset > section.paragraphs[index].length
    )
      fail(422, "INVALID_OFFSET", "选区超出段落");
    result.offset = value.offset;
  }
  return result;
}
export function saveEvent(body, owner) {
  const paper = paperFor(body.paperId, body.contentVersion);
  const kinds = [
    "reader-open",
    "paragraph-visible",
    "menu-opened",
    "menu-dismissed",
    "action",
    "question-saved",
    "ai-question-sent",
    "note-resolve",
    "note-delete",
    "position-jump",
    "note-jump",
    "analysis-status",
    "filter",
  ];
  if (
    !kinds.includes(body.kind) ||
    !identifier(body.eventId) ||
    !identifier(body.sessionId) ||
    !Number.isSafeInteger(body.at) ||
    body.at <= 0 ||
    body.at > 8.64e15 ||
    !body.contentVersion
  )
    fail(422, "INVALID_EVENT", "事件标识、版本或时间无效");
  const e = { schemaVersion: 2 };
  for (const k of [
    "eventId",
    "sessionId",
    "paperId",
    "contentVersion",
    "kind",
    "at",
  ])
    e[k] = body[k];
  for (const k of [
    "source",
    "action",
    "reason",
    "noteId",
    "selectionId",
    "filter",
    "status",
  ])
    if (identifier(body[k])) e[k] = body[k];
  if (typeof body.resolved === "boolean") e.resolved = body.resolved;
  if (body.range)
    e.range = {
      start: point(body.range.start, paper, true),
      end: point(body.range.end, paper, true),
    };
  if (Number.isSafeInteger(body.textLength) && body.textLength >= 0)
    e.textLength = body.textLength;
  if (body.kind === "paragraph-visible") {
    Object.assign(e, point(body, paper));
    const { startedAt, endedAt, durationMs } = body;
    if (
      !Number.isSafeInteger(startedAt) ||
      startedAt <= 0 ||
      !Number.isSafeInteger(endedAt) ||
      durationMs !== endedAt - startedAt ||
      durationMs < 1000
    )
      fail(422, "INVALID_INTERVAL", "无效可见区间");
    Object.assign(e, { startedAt, endedAt, durationMs });
  }
  if (["position-jump", "note-jump"].includes(e.kind)) {
    if (!["toc", "answer-source", "note"].includes(e.source))
      fail(422, "INVALID_SOURCE", "回看来源无效");
    e.from = { paperId: paper.id, ...point(body.from, paper) };
    e.to = { paperId: paper.id, ...point(body.to, paper) };
  }
  if (
    ["question-saved", "note-resolve", "note-delete"].includes(e.kind) &&
    !e.noteId
  )
    fail(422, "INVALID_NOTE", "缺少手记编号");
  if (e.kind === "note-resolve" && typeof e.resolved !== "boolean")
    fail(422, "INVALID_NOTE", "缺少解决状态");
  database()
    .prepare("INSERT OR IGNORE INTO events VALUES(?,?,?,?,?)")
    .run(owner, e.eventId, paper.id, e.at, JSON.stringify(e));
}
export function subject(req, res) {
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host)
    fail(403, "ORIGIN", "请求来源无效");
  const existing = /(?:^|;\s*)lj_reader=([a-f\d-]{36})(?:;|$)/.exec(
    req.headers.cookie || "",
  );
  if (existing) return existing[1];
  const token = randomUUID();
  res.setHeader(
    "Set-Cookie",
    "lj_reader=" +
      token +
      "; Path=/api/reader; HttpOnly; SameSite=Strict; Max-Age=31536000",
  );
  return token;
}

export async function readerRoute(req, res, url, read, json) {
  const owner = subject(req, res);
  const parts = url.pathname.slice("/api/reader/".length).split("/");
  const [resource, id, action] = parts;
  const payload = async () => {
    let body;
    try {
      body = JSON.parse(await read(req, 32 * 1024));
    } catch (e) {
      if (e.status) throw e;
      fail(400, "INVALID_JSON", "无效 JSON");
    }
    if (!object(body)) fail(400, "INVALID_BODY", "请求必须为对象");
    return body;
  };
  if (resource === "session" && parts.length === 1) {
    requireMethod(req, "GET");
    return json(res, { ok: true, pretestTimeoutSeconds: pretestTimeoutSeconds() });
  }
  if (resource === 'materials' && parts.length === 2) {
    requireMethod(req, 'GET');
    return json(res, paperFor(id));
  }
  if (resource === 'paper-search' && parts.length === 1) {
    requireMethod(req, 'POST');
    const { query } = await payload();
    if (typeof query !== 'string' || query.length > 120 || /[\u0000-\u001f\u007f]/u.test(query))
      fail(400, 'INVALID_QUERY', '请输入 2 至 120 个字符的论文题目或关键词');
    const keyword = query.trim().replace(/\s+/gu, ' ');
    if (keyword.length < 2 || !/[\p{L}\p{N}]/u.test(keyword))
      fail(400, 'INVALID_QUERY', '请输入 2 至 120 个字符的论文题目或关键词');
    return json(res, await searchByKeyword(keyword));
  }
  if (resource === 'recommendations' && parts.length === 1) {
    requireMethod(req, 'GET', 'POST');
    if (req.method === 'GET') {
      const row = database().prepare('SELECT snapshot,report FROM portraits WHERE owner=?').get(owner);
      if (!row) fail(404, 'NO_PORTRAIT', '尚未提交画像');
      return json(res, { snapshot: JSON.parse(row.snapshot), report: JSON.parse(row.report) });
    }
    const b = await payload();
    const snapshot = { answers: b.answers, evidence: b.evidence || {} };
    const report = await recommendations(snapshot, b.locale === 'en' ? 'en' : 'zh');
    report.id = randomUUID();
    database().prepare('INSERT INTO portraits VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET snapshot=excluded.snapshot,report=excluded.report')
      .run(owner, JSON.stringify(snapshot), JSON.stringify(report));
    return json(res, { snapshot, report }, 201);
  }
  if (resource === "me" && id === "overview" && parts.length === 2) {
    requireMethod(req, "GET");
    return json(res, overview(owner));
  }
  if (resource === "me" && id === "summary" && parts.length === 2) {
    requireMethod(req, "GET");
    const paper = paperFor(url.searchParams.get("paperId"));
    return json(res, summary(owner, paper.id));
  }
  if (resource === "plans" && parts.length === 1) {
    requireMethod(req, "POST");
    const b = await payload(),
      paper = paperFor(b.paperId, b.contentVersion);
    if (!object(b.input)) fail(422, "INVALID_INPUT", "缺少 input");
    const input = {
      ...b.input,
      paper: {
        title: paper.title,
        abstract: paper.abstract,
        language: paper.language || "英文",
        section_titles: paper.sections.map((s) => s.heading),
      },
    };
    const plan = await callWorker({ op: "plan", input }),
      planId = randomUUID();
    database()
      .prepare("INSERT INTO plans VALUES(?,?,?,?,?,?)")
      .run(
        planId,
        owner,
        paper.id,
        1,
        JSON.stringify(input),
        JSON.stringify(plan),
      );
    return json(res, { planId, paperId: paper.id, revision: 1, plan }, 201);
  }
  if (resource === "plans" && parts.length === 2) {
    requireMethod(req, "GET", "PATCH");
    const row = own("plans", id, owner);
    if (req.method === "GET") return json(res, envelope(row));
    const b = await payload();
    if (!object(b.changes)) fail(422, "INVALID_CHANGES", "缺少修改内容");
    if (b.revision !== row.revision)
      fail(409, "STALE_PLAN", "方案已更新，请重新读取");
    const plan = await callWorker({
      op: "edit",
      input: JSON.parse(row.input),
      plan: JSON.parse(row.plan),
      changes: b.changes,
    });
    const updated = database()
      .prepare(
        "UPDATE plans SET plan=?,revision=revision+1 WHERE id=? AND revision=?",
      )
      .run(JSON.stringify(plan), id, b.revision);
    if (!updated.changes) fail(409, "STALE_PLAN", "方案已更新，请重新读取");
    return json(res, envelope(own("plans", id, owner)));
  }
  if (resource === "pretests" && parts.length === 1) {
    requireMethod(req, "POST");
    const b = await payload();
    if (!identifier(b.planId)) fail(422, "INVALID_PLAN", "缺少方案编号");
    const row = own("plans", b.planId, owner);
    if (b.revision !== row.revision)
      fail(409, "STALE_PLAN", "方案已更新，请重新读取");
    if (
      b.mode === "sample" &&
      (row.paper !== "radiation" || b.count !== undefined)
    )
      fail(422, "INVALID_SAMPLE", "样题仅适用于净辐射五题");
    const { session, student } = await callWorker({
      op: "test",
      input: JSON.parse(row.input),
      plan: JSON.parse(row.plan),
      count: b.count,
      mode: b.mode,
    }, b.mode === "quick" || codexEnabled() ? res : undefined);
    if (own("plans", b.planId, owner).revision !== row.revision)
      fail(409, "STALE_PLAN", "出题期间方案已更新");
    database()
      .prepare("INSERT INTO tests VALUES(?,?,?,?,?,?,?,NULL,NULL)")
      .run(
        student.test_id,
        owner,
        row.paper,
        row.id,
        row.revision,
        JSON.stringify(session),
        JSON.stringify(student),
      );
    return json(res, student, 201);
  }
  if (resource === "pretests" && id && parts.length <= 3) {
    const row = own("tests", id, owner);
    if (!action) {
      requireMethod(req, "GET");
      return json(res, JSON.parse(row.student));
    }
    if (action === "paper-profile") {
      requireMethod(req, "GET");
      const profile = JSON.parse(row.report || row.student).paper_profile;
      if (!profile) fail(409, "UNGRADED", "尚未提交作答");
      return json(res, profile);
    }
    if (action === "grade") {
      requireMethod(req, "POST");
      const b = await payload();
      if (
        !(
          (b.skip === true && b.answers === undefined) ||
          (b.skip === undefined && object(b.answers))
        )
      )
        fail(422, "INVALID_ANSWERS", "请提交完整作答或整体跳过");
      const submission = b.skip
        ? "skip"
        : JSON.stringify(
            Object.entries(b.answers).sort(([a], [c]) => a.localeCompare(c)),
          );
      if (!row.report) {
        const result = await callWorker({
          op: "grade",
          session: JSON.parse(row.session),
          answers: b.answers,
          skip: b.skip,
        });
        database()
          .prepare(
            "UPDATE tests SET submission=?,report=? WHERE id=? AND report IS NULL",
          )
          .run(submission, JSON.stringify(result), id);
      }
      const saved = own("tests", id, owner);
      if (saved.submission !== submission)
        fail(409, "ALREADY_GRADED", "本次测试已经提交");
      return json(res, JSON.parse(saved.report));
    }
  }
  if (resource === "analyze" && parts.length === 1) {
    requireMethod(req, "POST");
    const b = await payload(),
      paper = paperFor(b.paperId, b.contentVersion);
    const question = b.question || b.text;
    if (typeof question !== "string" || !question.trim())
      fail(422, "EMPTY_QUESTION", "请输入问题");
    let profile;
    if (b.test_id) {
      const row = own("tests", b.test_id, owner);
      if (row.paper !== paper.id)
        fail(422, "PAPER_MISMATCH", "画像属于另一篇论文");
      profile = JSON.parse(row.report || row.student).paper_profile;
    }
    const terms = new Set(question.toLowerCase().match(/[a-z0-9]+/g) || []);
    for (const run of question.match(/[\u3400-\u9fff]+/g) || []) {
      if (run.length === 1) terms.add(run);
      for (let i = 1; i < run.length; i++) terms.add(run.slice(i - 1, i + 1));
    }
    let best = null;
    for (const s of paper.sections)
      for (const [i, text] of s.paragraphs.entries()) {
        const paragraphId = s.id + "-p" + (i + 1);
        const anchored = b.range?.start?.paragraphId === paragraphId;
        const score =
          (anchored ? 1000 : 0) +
          (b.text && text.includes(b.text) ? 500 : 0) +
          [...terms].filter((t) => text.toLowerCase().includes(t)).length;
        if (score > 0 && (!best || score > best.score))
          best = { sectionId: s.id, paragraphId, text, score };
      }
    if (!best)
      return json(res, {
        explanation: "本文中没有找到可核对的依据。",
        citations: [],
        mode: "retrieval",
      });
    const start = {
      sectionId: best.sectionId,
      paragraphId: best.paragraphId,
      offset: 0,
    };
    const mode = b.mode === "model" ? "model" : "retrieval";
    const detailed = b.mode === "model" && Boolean(profile) && Array.isArray(b.history);
    const section = paper.sections.find(s=>s.id===best.sectionId);
    const behaviorStatuses = ['needs-help', 'resolved', 'follow-up', 'reader-marked'];
    const readingBehavior = (Array.isArray(b.readingBehavior) ? b.readingBehavior : [])
      .filter(item => item?.pid === best.paragraphId && behaviorStatuses.includes(item.status))
      .slice(0, 4).map(({ status }) => status);
    const answer =
      mode === "model"
        ? await callWorker({
            op: "answer",
            question,
            passage: best.text,
            profile,
            requestedDetail: b.requestedDetail,
            ...(detailed && {detailed:true, selectedText:String(b.text||'').slice(0,3000),
              section:section.heading, context:section.paragraphs.slice(Math.max(0,section.paragraphs.indexOf(best.text)-1),section.paragraphs.indexOf(best.text)+2),
              abstract:paper.abstract, history:b.history.slice(-3), readingBehavior}),
          }, codexEnabled() ? res : undefined)
        : "原文摘录 · " + best.text;
    return json(res, {
      ...(detailed ? answer : {explanation:answer}),
      mode,
      citations: [
        {
          paperId: paper.id,
          contentVersion: paper.version || "v1",
          range: { start, end: { ...start, offset: best.text.length } },
        },
      ],
    });
  }
  fail(404, "NOT_FOUND", "接口不存在");
}
