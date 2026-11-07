// Shown when this PC has no data yet.
export function renderEmpty(el, { importCsv, linkPhone, paired }) {
  el.innerHTML = paired
    ? `<div><h2>Waiting for your phone</h2><p>Open Karvo on your phone to connect. Your lessons will appear here.</p></div>`
    : `<div>
    <h2>No lessons on this PC yet</h2>
    <p>Link your phone, or import a CSV exported from the Karvo app.</p>
    <div class="actions">
      <button class="btn primary" id="empty-link">Link your phone</button>
      <button class="btn" id="empty-import">Import CSV</button>
      <a class="btn" href="?demo" style="color:inherit;text-decoration:none">Try demo</a>
    </div></div>`;
  el.querySelector('#empty-link')?.addEventListener('click', linkPhone);
  el.querySelector('#empty-import')?.addEventListener('click', importCsv);
}
