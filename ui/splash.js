// Plays the logo animation once per page load, then fades into the app.
export function runSplash(el = document.getElementById('splash')) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), reduced ? 0 : 400); }, reduced ? 0 : 1000);
}
