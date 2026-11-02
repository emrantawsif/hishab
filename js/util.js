// Small helpers shared by every module.

export const $ = (selector, root = document) => root.querySelector(selector);

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);

export function uid(length = 10) {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

// Items are never hard-deleted (see mergeParty), so lists skip tombstones.
export const live = map =>
  Object.values(map || {})
    .filter(item => !item.deleted)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

export function todayISO(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function prettyDate(iso) {
  if (!iso) return '';
  if (iso === todayISO()) return 'Today';
  if (iso === todayISO(new Date(Date.now() - 86400000))) return 'Yesterday';
  const [year, month, day] = iso.split('-').map(Number);
  const options = { day: 'numeric', month: 'short' };
  if (year !== new Date().getFullYear()) options.year = 'numeric';
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', options);
}

export const pick = list => list[Math.floor(Math.random() * list.length)];

export function haptic(ms = 12) {
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}
