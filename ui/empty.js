// Shown when this PC has no data yet.
export function renderEmpty(el, { importCsv }) {
  el.innerHTML = `<div>
    <h2>No lessons on this PC yet</h2>
    <p>Link your phone, or import a CSV exported from the Karvo app.</p>
    <div class="actions">
      <button class="btn" disabled title="Coming soon">Link your phone (coming soon)</button>
      <button class="btn primary" id="empty-import">Import CSV</button>
      <a class="btn" href="?demo" style="color:inherit;text-decoration:none">Try demo</a>
    </div></div>`;
  el.querySelector('#empty-import').onclick = importCsv;
}
