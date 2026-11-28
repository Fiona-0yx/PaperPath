import { summarizeEvents } from "../shared/reader-summary.js";
let handshake;
export async function api(path, method = "GET", body, signal) {
  if (!handshake)
    handshake = fetch("/api/reader/session", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw Error("阅读服务未连接");
      })
      .catch((error) => {
        handshake = null;
        throw error;
      });
  await handshake;
  const response = await fetch("/api/reader/" + path, {
    method,
    signal,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(Error(data.error?.message || "阅读服务暂时不可用"), {
      status: response.status,
    });
  return data;
}
export function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function recordLearningEvent(type, detail) {
  const key = "lunjing-journal-v1";
  const journal = readLocal(key, {});
  const events = Array.isArray(journal.events) ? journal.events : [];
  if (type === "finish_test" && events.some(event => event.type === type && event.testId === detail.testId))
    return null;
  const event = { id: crypto.randomUUID(), time: new Date().toISOString(), type, ...detail };
  return writeLocal(key, { ...journal, events: [...events, event] }) ? event : null;
}
const storagePrefix = "lunjing.pending.";
const memory = new Map();
let running;
let needsFlush = false;
export function flush() {
  needsFlush = true;
  if (running) return running;
  running = (async () => {
    while (needsFlush) {
      needsFlush = false;
      const pending = new Map(memory);
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith(storagePrefix)) {
            const e = readLocal(key, null);
            if (e) pending.set(key, e);
          }
        }
      } catch {}
      for (const [key, e] of [...pending].sort((a, b) => a[1].at - b[1].at)) {
        try {
          await api("events", "POST", e);
        } catch (error) {
          if (error.status === 422) continue;
          return;
        }
        memory.delete(key);
        try {
          localStorage.removeItem(key);
        } catch {}
      }
    }
  })().finally(() => {
    running = null;
  });
  return running;
}
export function activity(paper, container, paragraphs) {
  const key = "lunjing.reader.paused";
  let paused = readLocal(key, false),
    visible = new Map();
  const sessionId = crypto.randomUUID();
  const archive = "lunjing.activity." + paper.id + ".";
  const localEvents = new Map();
  function event(kind, fields = {}) {
    if (paused) return;
    const e = {
      schemaVersion: 2,
      eventId: crypto.randomUUID(),
      sessionId,
      paperId: paper.id,
      contentVersion: "v1",
      at: Date.now(),
      kind,
      ...fields,
    };
    if (!writeLocal(archive + e.eventId, e)) localEvents.set(e.eventId, e);
    const k = storagePrefix + e.eventId;
    if (!writeLocal(k, e)) memory.set(k, e);
    flush();
  }
  const intervals = new Map();
  function finish(el, now) {
    const start = intervals.get(el);
    if (start === undefined) return;
    intervals.delete(el);
    const section = el.closest("section");
    if (now - start >= 1000)
      event("paragraph-visible", {
        sectionId: section.dataset.section || section.id,
        paragraphId: el.id,
        startedAt: start,
        endedAt: now,
        durationMs: now - start,
      });
  }
  function sample() {
    const now = Date.now();
    for (const el of paragraphs) {
      if (
        !paused &&
        !document.hidden &&
        !document.querySelector("dialog[open]") &&
        container.clientHeight &&
        visible.get(el)
      ) {
        if (!intervals.has(el)) intervals.set(el, now);
      } else finish(el, now);
    }
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        visible.set(
          entry.target,
          entry.isIntersecting &&
            entry.intersectionRect.height >=
              Math.min(
                entry.boundingClientRect.height,
                container.clientHeight,
              ) *
                0.5,
        );
      sample();
    },
    { threshold: Array.from({ length: 101 }, (_, i) => i / 100) },
  );
  paragraphs.forEach((el) => observer.observe(el));
  document.addEventListener("visibilitychange", sample);
  document.addEventListener("toggle", sample, true);
  addEventListener("pagehide", () => {
    for (const el of intervals.keys()) finish(el, Date.now());
  });
  addEventListener("pageshow", sample);
  addEventListener("online", flush);
  const retry = setInterval(flush, 15000);
  addEventListener("unload", () => clearInterval(retry));
  event("reader-open", {
    source: new URLSearchParams(location.search).get("source") || "shelf",
  });
  flush();
  return {
    event,
    sample,
    localSummary() {
      const events = [...localEvents.values()];
      try {
        for (const k of Object.keys(localStorage))
          if (k.startsWith(archive)) {
            const e = readLocal(k, null);
            if (e) events.push(e);
          }
      } catch {}
      return summarizeEvents(
        paper.id,
        events.sort((a, b) => a.at - b.at),
      );
    },
    get paused() {
      return paused;
    },
    toggle() {
      if (!paused) for (const el of intervals.keys()) finish(el, Date.now());
      paused = !paused;
      writeLocal(key, paused);
      sample();
    },
  };
}
