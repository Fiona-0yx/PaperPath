import { recordLearningEvent } from './reader-api.js';

const key = 'lunjing-intake-v1';
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.version === 1 && saved.answers && saved.drafts) return saved;
  } catch { /* A new journal is still available with storage disabled. */ }
  return {version:1, position:'cover', answers:{}, drafts:{}, started:false};
}
export const intake = load();
// Previous versions saved the last open spread and an optional submitted portrait.
intake.portraitReady ??= intake.position === 'summary' || Boolean(intake.submitted);
// Older journals kept only the current self-check answer.
intake.evidence ??= {};
// Reading notes are added by the paper reader (bookmark / question / explain).
// They live beside the portrait so the reader and the portrait read the same
// state; missing arrays are tolerated so older saved journals keep working.
intake.readingNotes ??= [];
// Cached rule-based reading statistics (right-click / note activity), refreshed
// from /api/reader/summary when the portrait opens and kept for later profiling.
intake.readerStats ??= null;
export function readingNoteId() {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
export function addReadingNote(note) {
  const entry = {...note, id: note.id || readingNoteId(), createdAt: note.createdAt || Date.now()};
  intake.readingNotes.push(entry);
  persistIntake();
  return entry;
}
export function removeReadingNote(id) {
  const at = intake.readingNotes.findIndex(note => note.id === id);
  if (at < 0) return false;
  intake.readingNotes.splice(at, 1);
  return persistIntake();
}
export function updateReadingNote(id, patch) {
  const note = intake.readingNotes.find(note => note.id === id);
  if (!note) return false;
  Object.assign(note, patch);
  return persistIntake();
}
export function recordCheck(id, answer) {
  const history = intake.evidence[id] ??= [];
  if (JSON.stringify(history.at(-1)) !== JSON.stringify(answer)) history.push(structuredClone(answer));
}
for (const [id, answer] of Object.entries(intake.answers)) {
  if (answer.source === 'check') recordCheck(id, answer);
}
export function submitPortrait() {
  const previous = intake.submitted;
  intake.submitted = structuredClone({answers:intake.answers, evidence:intake.evidence});
  if (persistIntake()) {
    if (JSON.stringify(previous) !== JSON.stringify(intake.submitted))
      recordLearningEvent('portrait_saved', { source: 'self-report' });
    return true;
  }
  intake.submitted = previous;
  return false;
}
export function persistIntake() {
  try { localStorage.setItem(key, JSON.stringify(intake)); return true; }
  catch { return false; }
}
