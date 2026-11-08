// A bottom sheet for the iPhone app: returns the element and a close function.
export function openSheet(html, { onClose } = {}) {
  const el = document.createElement('div');
  el.className = 'm-sheet';
  el.innerHTML = html;
  let closed = false;
  // Slides back down before leaving; onClose runs at once so callers never wait on the animation.
  const close = () => {
    if (closed) return; closed = true;
    el.classList.add('out'); onClose?.();
    setTimeout(() => el.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
  };
  el.addEventListener('click', e => { if (e.target === el) close(); });
  document.body.append(el);
  return { el, close };
}
