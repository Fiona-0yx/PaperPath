// Slice the same laid-out HTML used on the resting page. Native input outlines,
// fonts, illustrations and button backgrounds travel with the original paper curl.
export function pageInk(book) {
  return Array.from(book.querySelectorAll(':scope > .journal-face'), face => {
    const template = face.cloneNode(true);
    const selects = face.querySelectorAll('select');
    template.querySelectorAll('select').forEach((select, i) => {
      for (const option of select.options) option.defaultSelected = option.index === selects[i].selectedIndex;
    });
    return {template, scroll: face.scrollTop, side: face.classList.contains('left') ? 'left' :
      face.matches('.right,.cover-title') ? 'right' : 'full'};
  });
}

export function mountInk(surface, ink, side, offset, scrolls) {
  const window = document.createElement('div');
  window.className = 'ink-window';
  window.inert = true;
  window.setAttribute('aria-hidden', 'true');
  const sheet = document.createElement('div');
  sheet.className = 'ink-sheet';
  sheet.style.left = offset;
  for (const part of ink) {
    if (part.side !== 'full' && part.side !== side) continue;
    const face = part.template.cloneNode(true);
    sheet.append(face);
    if (part.scroll) scrolls.push([face, part.scroll]);
  }
  window.append(sheet);
  surface.append(window);
}
