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
  if (persistIntake()) return true;
  intake.submitted = previous;
  return false;
}
export function persistIntake() {
  try { localStorage.setItem(key, JSON.stringify(intake)); return true; }
  catch { return false; }
}
