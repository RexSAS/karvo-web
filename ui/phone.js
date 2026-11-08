// Phones get their own screen instead of the PC layout: Android → the app on Play, iPhone → web app coming soon.
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.karvo';

/** 'ios' | 'android' | null (PCs and tablets get the normal site). */
export function phoneKind(ua) {
  if (/iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua) && /Mobile/.test(ua)) return 'android';
  return null;
}

const logo = `<svg viewBox="20 26 72 54" width="96" aria-hidden="true"><circle cx="38" cy="40" r="5" fill="#E8B964"/><path d="M72,48 L86,76 L58,76 Z" fill="#E3F2FD"/><path d="M54,30 L82,76 L26,76 Z" fill="#FFFFFF"/></svg>`;

/** 'iphone' (Home Screen app) | 'install' (iPhone in Safari) | 'android' | null. */
export function phoneRoute(ua, standalone) {
  const kind = phoneKind(ua);
  return kind === 'ios' ? (standalone ? 'iphone' : 'install') : kind;
}

/** Replaces the page with the phone screen; returns true when it did (the caller then stops booting the PC app). */
export function showPhoneScreen(route = phoneRoute(navigator.userAgent, navigator.standalone === true)) {
  if (!route) return false;
  // Testing aid: `karvo.skipHomeScreen()` in the console opens the iPhone app in a Safari tab; `karvo.undo()` brings the gate back.
  const BYPASS = 'karvo.skipHomeScreen';
  const flag = () => { try { return localStorage.getItem(BYPASS) === '1'; } catch { return false; } };
  const set = v => { try { v ? localStorage.setItem(BYPASS, '1') : localStorage.removeItem(BYPASS); } catch {} location.reload(); };
  window.karvo = { skipHomeScreen: () => set(true), undo: () => set(false) };
  if (route === 'install' && flag()) route = 'iphone';
  if (route === 'iphone') {
    import('./m/app.js').then(m => m.startIphone()).catch(() => {
      document.getElementById('splash')?.remove();
      document.body.innerHTML = '<section class="phone-page"><h1>Karvo</h1><p>Karvo couldn’t start. Check the connection and open it again.</p></section>';
    });
    return true;
  }
  document.getElementById('splash')?.remove();
  const page = document.createElement('section');
  page.className = 'phone-page';
  document.body.replaceChildren(page);
  if (route === 'android') {
    page.innerHTML = `${logo}<h1>Karvo for Android</h1>
      <p>On Android, Karvo is an app. Get it from Google Play, then use this site on your PC.</p>
      <a class="btn primary" href="${PLAY_URL}">Get it on Google Play</a>`;
    return true;
  }
  // Karvo runs only from the Home Screen: there iOS keeps its storage, in a Safari tab it may be cleared.
  const it = (navigator.language || '').startsWith('it');
  page.innerHTML = it
    ? `${logo}<h1>Aggiungi Karvo alla schermata Home</h1>
    <p>Le tue lezioni vengono salvate su questo iPhone. Per non perderle, aggiungi Karvo alla schermata Home:
    tocca <b>Condividi</b> <span aria-hidden="true">⬆︎</span>, poi <b>Aggiungi alla schermata Home</b>, e apri Karvo sempre da lì.</p>`
    : `${logo}<h1>Add Karvo to your Home Screen</h1>
    <p>Your lessons will be saved on this iPhone. To not lose them, add Karvo to your Home Screen:
    tap <b>Share</b> <span aria-hidden="true">⬆︎</span>, then <b>Add to Home Screen</b>, and always open Karvo from there.</p>`;
  return true;
}
