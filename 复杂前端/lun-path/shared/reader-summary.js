const union = (intervals) => {
  let end = 0,
    total = 0;
  for (const [a, b] of intervals.sort((x, y) => x[0] - y[0])) {
    total += Math.max(0, b - Math.max(a, end));
    end = Math.max(end, b);
  }
  return total;
};
export function summarizeEvents(paperId, events) {
  const periods = [],
    paragraphs = new Map(),
    resolved = new Map(),
    activeReturns = { toc: 0, answerSource: 0, note: 0 };
  for (const e of events) {
    if (e.kind === "paragraph-visible") {
      const interval = [e.startedAt, e.endedAt];
      periods.push(interval);
      if (!paragraphs.has(e.paragraphId)) paragraphs.set(e.paragraphId, []);
      paragraphs.get(e.paragraphId).push(interval);
    }
    if (e.kind === "position-jump" || e.kind === "note-jump") {
      const key = { "answer-source": "answerSource", toc: "toc", note: "note" }[
        e.source
      ];
      if (key) activeReturns[key]++;
    }
    if (e.kind === "note-resolve") resolved.set(e.noteId, e.resolved);
    if (e.kind === "note-delete") resolved.delete(e.noteId);
  }
  return {
    paperId,
    visibleMs: union(periods),
    paragraphs: Array.from(paragraphs, ([paragraphId, spans]) => ({
      paragraphId,
      visibleMs: union(spans),
    })),
    activeReturns,
    resolvedNoteCount: [...resolved.values()].filter(Boolean).length,
  };
}
