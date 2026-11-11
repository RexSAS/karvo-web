// Shown when this PC has no data yet: Kevin asleep in the snow (the SVG carries its own small animation), and what to do.
const KEVIN = '<img class="kevin" src="img/kevin-sleepy.svg" alt="" width="220" height="213">';
export function renderEmpty(el, { importCsv, linkPhone, paired }) {
  el.innerHTML = paired
    ? `<div>${KEVIN}<h2>Waiting for your phone</h2><p>Open Karvo on your phone to connect. Your lessons will appear here.</p></div>`
    : `<div>${KEVIN}
    <h2>No lessons on this PC yet</h2>
    <p>${linkPhone ? 'Link your phone, or import' : 'Import'} a CSV exported from the Karvo app.</p>
    <div class="actions">
      ${linkPhone ? '<button class="btn primary" id="empty-link">Link your phone</button>' : ''}
      <button class="btn ${linkPhone ? '' : 'primary'}" id="empty-import">Import CSV</button>
      <a class="btn" href="?demo" style="color:inherit;text-decoration:none">Try demo</a>
    </div></div>`;
  el.querySelector('#empty-link')?.addEventListener('click', linkPhone);
  el.querySelector('#empty-import')?.addEventListener('click', importCsv);
}
