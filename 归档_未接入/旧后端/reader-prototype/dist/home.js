const notes = [];
for (const [key, url] of [
  ['lunjing.attention.demo.v1', 'read.html'],
  ['lunjing.radiation.demo.v1', 'read.html?paper=radiation']
]) {
  try {
    const records = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(records)) {
      for (const item of records) {
        if (item?.type === 'question') notes.push({ ...item, url });
      }
    }
  } catch { /* Storage may be disabled in private browsing. */ }
}
const recent = document.querySelector('#recent');
document.querySelector('#note-count').textContent = notes.length;
document.querySelector('#empty').hidden = notes.length > 0;
for (const note of notes.sort((a, b) => b.time - a.time)) {
  const row = document.createElement('li');
  const link = document.createElement('a');
  link.href = note.url + '#' + encodeURIComponent(note.section);
  link.textContent = note.question;
  row.append(link);
  recent.append(row);
}
window.addEventListener('pageshow', event => {
  if (event.persisted) location.reload();
});
const backTop = document.querySelector('.back-top');
new IntersectionObserver(([entry]) => {
  backTop.hidden = entry.isIntersecting;
}).observe(document.querySelector('.hero'));
