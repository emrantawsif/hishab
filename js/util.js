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

// IBANs: stored without spaces, shown in groups of four, checked with the
// standard mod-97 test so a typo is caught before anyone sends money.
export const cleanIban = text => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 34);
export const formatIban = iban => (iban || '').replace(/(.{4})(?=.)/g, '$1 ');

export function ibanValid(iban) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
  let rest = 0;
  for (const digit of digits) rest = (rest * 10 + Number(digit)) % 97;
  return rest === 1;
}

export function haptic(ms = 12) {
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}
