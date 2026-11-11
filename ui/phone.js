// Phones get their own screen instead of the PC layout: Android → the app on Play, iPhone → web app coming soon.
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.karvo';

/** 'ios' | 'android' | null (PCs and tablets get the normal site). */
export function phoneKind(ua) {
  if (/iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua) && /Mobile/.test(ua)) return 'android';
  return null;
}

// These pages replace the whole body (and index.html's logo gradients with it), so this copy carries its own.
const logo = `<svg viewBox="18 24.5 72 54" width="96" aria-hidden="true"><defs><linearGradient id="k-lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7BF"/><stop offset=".3" stop-color="#FFF"/><stop offset="1" stop-color="#DCE6F8"/></linearGradient><linearGradient id="k-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9D6FF"/><stop offset="1" stop-color="#5B8DDC"/></linearGradient></defs><circle cx="33.5" cy="41" r="6.2" fill="#F4C06A"/><path d="M56.6,33.6 L83,75 L63.5,75 C55.5,68.5 54,62.5 60.5,56.5 C68,49.5 66,41.5 56.6,33.6 Z" fill="url(#k-shade)"/><path d="M25,75 L53,28 C61.5,39 62.5,47.5 55,54.5 C48,61 49.5,68 57,75 Z" fill="url(#k-lit)"/></svg>`;

/** 'iphone' (Home Screen app) | 'install' (iPhone in Safari) | 'android' | null. */
export function phoneRoute(ua, standalone) {
  const kind = phoneKind(ua);
  return kind === 'ios' ? (standalone ? 'iphone' : 'install') : kind;
}

/** Replaces the page with the phone screen; returns true when it did (the caller then stops booting the PC app). */
// Testing aid, on any device: `karvo.skipHomeScreen()` in the console opens the iPhone app here (even in a tab or on a PC);
// `karvo.undo()` goes back to the normal site.
const BYPASS = 'karvo.skipHomeScreen';
const bypassed = () => { try { return localStorage.getItem(BYPASS) === '1'; } catch { return false; } };
const setBypass = v => { try { v ? localStorage.setItem(BYPASS, '1') : localStorage.removeItem(BYPASS); } catch {} location.reload(); };
if (typeof window !== 'undefined') window.karvo = { skipHomeScreen: () => setBypass(true), undo: () => setBypass(false) };

export function showPhoneScreen(route = phoneRoute(navigator.userAgent, navigator.standalone === true)) {
  if (bypassed()) route = 'iphone';
  if (!route) return false;
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
