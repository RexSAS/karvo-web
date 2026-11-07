// "Link your phone": shows a QR for 2 minutes and waits for the phone to say hello (spec "Pairing").
import qrcode from '../vendor/qrcode.js';
import { newPairing, pcName } from '../link/pairing.js';
import { b64url } from '../link/crypto.js';
import { createConnection, deleteRoom } from '../link/connection.js';

const QR_SECONDS = 120;

export function openLinkDialog({ relayUrl, appVersion, onLinked }) {
  const d = document.createElement('dialog');
  d.className = 'link-dialog';
  document.body.append(d);
  let conn = null, record = null, timer = null;

  const cleanup = async keepRoom => {
    clearInterval(timer);
    if (conn) { await conn.stop(); conn = null; }
    if (record && !keepRoom) deleteRoom(record, relayUrl);
  };
  const close = async () => { await cleanup(false); d.close(); d.remove(); };

  async function fresh() {
    await cleanup(false);
    const myName = pcName(navigator.userAgent), p = newPairing(myName);
    record = { roomId: b64url(p.roomId), secret: b64url(p.secret), peerName: '', unregistered: true };
    const qr = qrcode(0, 'M'); qr.addData(p.qrText); qr.make();
    let left = QR_SECONDS;
    d.innerHTML = `<h3>Link your phone</h3>
      <p class="sub">In Karvo on your phone: Settings → Linked PCs → Link a PC, then scan this code.</p>
      <div class="qr" data-qr="${p.qrText}">${qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true })}</div>
      <p class="sub" data-left>Expires in 2:00</p>
      <div class="err" role="alert"></div>
      <div class="btns"><button type="button" class="btn" data-cancel>Cancel</button></div>`;
    d.querySelector('[data-cancel]').onclick = close;
    const mine = conn = createConnection({ record, relayUrl, appVersion, myName });
    mine.on('peer', async peer => {
      if (mine !== conn) return;
      clearInterval(timer);
      const linked = { roomId: record.roomId, secret: record.secret, peerName: peer.name, linkedAt: new Date().toISOString() };
      conn = null; record = null; // hand the live connection over; don't stop or delete it
      d.close(); d.remove();
      onLinked(mine, linked);
    });
    mine.on('state', s => { if (s === 'outdated') d.querySelector('.err').textContent = 'Update Karvo on your phone, then try again.'; });
    await mine.start();
    timer = setInterval(async () => {
      left--;
      const el = d.querySelector('[data-left]');
      if (left > 0) { el.textContent = `Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; return; }
      await cleanup(false); record = null;
      d.querySelector('.qr').innerHTML = '<p class="sub">This code expired.</p>';
      el.innerHTML = '<button type="button" class="btn primary" data-new>New code</button>';
      d.querySelector('[data-new]').onclick = fresh;
    }, 1000);
  }

  d.addEventListener('cancel', e => { e.preventDefault(); close(); });
  d.showModal();
  fresh();
}
