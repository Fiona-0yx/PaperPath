const keyFor = ({ pid, start, end, text }) =>
  JSON.stringify(Number.isInteger(start) ? [pid, start, end] : [pid, text]);

export function paperBehavior(notes, events) {
  const passages = new Map();
  const anchors = new Map(notes.map(note => [JSON.stringify([note.pid, note.text]), note]));
  function get(location) {
    const key = keyFor(location);
    if (!passages.has(key)) {
      const { pid, section, start, end, text } = location;
      passages.set(key, { key, pid, section, start, end, text, questions: new Set() });
    }
    return passages.get(key);
  }

  for (const event of events) {
    if (event.type !== 'ask_ai' || !event.pid || !event.question?.trim()) continue;
    // Older questions contain the selected text but did not store its offsets.
    const location = Number.isInteger(event.start) ? event : anchors.get(JSON.stringify([event.pid, event.text])) || event;
    get(location).questions.add(event.question.trim());
  }

  for (const note of notes) {
    if (!['red', 'blue', 'green'].includes(note.color) && !note.question) continue;
    const entry = get(note);
    if (note.question) entry.questions.add(note.question.trim());
    entry.resolved ||= note.resolved === true;
    entry.doubt ||= !note.resolved && ['red', 'blue'].includes(note.color);
  }

  return [...passages.values()].map(({ questions, resolved, doubt, ...entry }) => ({
    ...entry,
    questions: [...questions],
    status: doubt ? 'needs-help' : resolved ? 'resolved' :
      questions.size > 1 ? 'follow-up' : questions.size ? 'asked' : 'reader-marked',
  }));
}
