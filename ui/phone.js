// Phones get their own screen instead of the PC layout: Android → the app on Play, iPhone → web app coming soon.
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.karvo';

/** 'ios' | 'android' | null (PCs and tablets get the normal site). */
export function phoneKind(ua) {
  if (/iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua) && /Mobile/.test(ua)) return 'android';
  return null;
}

const logo = `<svg viewBox="20 26 72 54" width="96" aria-hidden="true"><circle cx="38" cy="40" r="5" fill="#E8B964"/><path d="M72,48 L86,76 L58,76 Z" fill="#E3F2FD"/><path d="M54,30 L82,76 L26,76 Z" fill="#FFFFFF"/></svg>`;

/** Replaces the page with the phone screen; returns true when it did (the caller then stops booting the PC app). */
export function showPhoneScreen(kind = phoneKind(navigator.userAgent)) {
  if (!kind) return false;
  document.getElementById('splash')?.remove();
  const page = document.createElement('section');
  page.className = 'phone-page';
  document.body.replaceChildren(page);
  if (kind === 'android') {
    page.innerHTML = `${logo}<h1>Karvo for Android</h1>
      <p>On Android, Karvo is an app. Get it from Google Play, then use this site on your PC.</p>
      <a class="btn primary" href="${PLAY_URL}">Get it on Google Play</a>`;
    return true;
  }
  const soon = () => { page.innerHTML = `${logo}<h1>Karvo for iPhone</h1><p>The iPhone web app will be available soon.</p>`; };
  if (navigator.standalone) { soon(); return true; } // already opened from the Home Screen
  page.innerHTML = `${logo}<h1>Add Karvo to your Home Screen</h1>
    <p>Your lessons will be saved on this iPhone. To not lose them, add Karvo to your Home Screen:
    tap <b>Share</b> <span aria-hidden="true">⬆︎</span>, then <b>Add to Home Screen</b>, and always open Karvo from there.</p>
    <button class="btn primary" type="button">OK</button>`;
  page.querySelector('button').onclick = soon;
  return true;
}
