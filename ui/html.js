// Escape text before it goes into innerHTML: student names and notes come from CSV files.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => MAP[c]);

// "Report a problem": opens the mail app with the address and device info filled in (same address as PRIVACY.md).
export const reportMailto = (subject, prompt, version) => 'mailto:andreafaveri@rxsas.it?subject=' + encodeURIComponent(subject)
  + '&body=' + encodeURIComponent(`${prompt}\n\n\n---\nKarvo ${version}\n${navigator.userAgent}`);
