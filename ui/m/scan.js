// QR scanner for pairing: the rear camera, frames decoded with jsQR (iPhone Safari has no built-in QR reader for pages).
import jsQR from '../../vendor/jsQR.js';
import { esc } from '../html.js';
import { t } from './i18n.js';

export function openScanner({ onCode }) {
  const el = document.createElement('div');
  el.className = 'm-scan';
  el.innerHTML = `<video playsinline muted autoplay></video><div class="m-scan-frame"></div>
    <p class="m-scan-hint">${esc(t('scanHint'))}</p><button class="btn m-scan-close">${esc(t('cancel'))}</button>`;
  document.body.append(el);
  const video = el.querySelector('video'), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  let stream = null, timer = null, done = false;
  const close = () => { done = true; clearInterval(timer); stream?.getTracks().forEach(tr => tr.stop()); el.remove(); };
  el.querySelector('.m-scan-close').onclick = close;
  navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(s => {
    if (done) { s.getTracks().forEach(tr => tr.stop()); return; }
    stream = s; video.srcObject = s;
    timer = setInterval(() => {
      if (!video.videoWidth) return;
      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
      if (code?.data.startsWith('karvo:link?')) { const text = code.data; close(); onCode(text); }
    }, 200);
  }).catch(() => {
    el.querySelector('.m-scan-hint').textContent = t('cameraDenied');
  });
  return { close };
}
