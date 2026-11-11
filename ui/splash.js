// Plays the logo animation once per page load, then fades into the app.
export function runSplash(el = document.getElementById('splash')) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 'ready' on the body lets the first screen rise in while the splash fades (styles.css).
  setTimeout(() => { el.classList.add('out'); document.body.classList.add('ready'); setTimeout(() => el.remove(), reduced ? 0 : 600); }, reduced ? 0 : 1400);
}
