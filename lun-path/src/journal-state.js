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
export function openQuestionnaire(fresh) {
  if (fresh) {
    Object.assign(intake, {answers:{}, drafts:{}, evidence:{}, portraitReady:false, autoSave:true});
  }
  intake.reviewAll = !fresh;
  intake.position = 'intro';
  intake.started = true;
  persistIntake();
}
let latestRequest;
export async function submitPortrait(language) {
  const snapshot = structuredClone({answers:intake.answers, evidence:intake.evidence});
  if (!persistIntake()) return { status: 'storage-error' };
  latestRequest = snapshot;
  const body = JSON.stringify(snapshot);
  let receipt;
  try {
    const params = new URLSearchParams({ include: 'report', lang: language });
    const response = await fetch('/api/questionnaire/analyze?' + params, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body,
      // Allow the server's longest Codex deadline plus time to write the report.
      signal: AbortSignal.timeout(135000)
    });
    if (!response.ok) return { status: 'report-error' };
    receipt = await response.json();
    if (!/^[a-f0-9]{64}$/.test(receipt.reportId) || receipt.report?.id !== receipt.reportId) {
      return { status: 'report-error' };
    }
  } catch {
    return { status: 'report-error' };
  }
  if (latestRequest !== snapshot) return { status: 'changed' };
  try {
    // Another tab may have saved a newer draft while the report was generated.
    const latest = JSON.parse(localStorage.getItem(key));
    if (!latest || [intake, latest].some(state =>
      body !== JSON.stringify({answers:state.answers, evidence:state.evidence}))) {
      return { status: 'changed' };
    }
    snapshot.reportId = receipt.reportId;
    latest.submitted = snapshot;
    localStorage.setItem(key, JSON.stringify(latest));
    intake.submitted = snapshot;
    return { status: 'saved', report: receipt.report };
  } catch {
    return { status: 'storage-error' };
  }
}
export function persistIntake() {
  try { localStorage.setItem(key, JSON.stringify(intake)); return true; }
  catch { return false; }
}
