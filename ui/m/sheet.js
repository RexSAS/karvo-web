// A bottom sheet for the iPhone app: returns the element and a close function.
export function openSheet(html, { onClose } = {}) {
  const el = document.createElement('div');
  el.className = 'm-sheet';
  el.innerHTML = html;
  const close = () => { el.remove(); onClose?.(); };
  el.addEventListener('click', e => { if (e.target === el) close(); });
  document.body.append(el);
  return { el, close };
}
