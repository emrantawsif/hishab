// Share links carry the whole ledger, compressed, after the "#". Browsers never
// send that part to the server, so GitHub Pages never sees anyone's data.

import { currency, formatMoney } from './money.js';
import { live } from './util.js';

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '==='.slice((base64.length + 3) % 4));
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

async function pipe(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// "z" = deflate-compressed JSON, "j" = plain JSON for very old browsers.
export async function encodeParty(party) {
  const bytes = new TextEncoder().encode(JSON.stringify(party));
  if (typeof CompressionStream === 'function') return 'z' + toBase64Url(await pipe(bytes, new CompressionStream('deflate')));
  return 'j' + toBase64Url(bytes);
}

export async function decodeParty(code) {
  const bytes = fromBase64Url(code.slice(1));
  const raw = code[0] === 'z' ? await pipe(bytes, new DecompressionStream('deflate')) : bytes;
  return JSON.parse(new TextDecoder().decode(raw));
}

export const partyLink = async party => `${location.origin}${location.pathname}#join=${await encodeParty(party)}`;

export function extractJoinCode(text) {
  const match = String(text ?? '').match(/[#&?]join=([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

// WhatsApp messages. Text between ``` renders in monospace there, so tables
// line up as ledger columns. Phones fit about 30 monospace characters a line.

const nameOf = (party, id) => party.members[id]?.name ?? 'Someone';
const shortName = name => (name.length > 9 ? `${name.slice(0, 8)}…` : name);

// Columns: left-aligned first, right-aligned figures after it.
function table(rows) {
  const widths = rows[0].map((_, col) => Math.max(...rows.map(row => row[col].length)));
  return rows.map(row => row.map((cell, col) => (col === 0 ? cell.padEnd(widths[col]) : cell.padStart(widths[col]))).join(' ').trimEnd()).join('\n');
}

function dateRange(isoDates) {
  if (!isoDates.length) return '';
  const day = (iso, options) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', options);
  };
  const first = isoDates[0];
  const last = isoDates[isoDates.length - 1];
  if (first === last) return day(first, { day: 'numeric', month: 'short', year: 'numeric' });
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return sameMonth
    ? `${day(first, { day: 'numeric' })}–${day(last, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : `${day(first, { day: 'numeric', month: 'short' })} – ${day(last, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

// The ledger report posted to the group.
export function summaryText(party, stats, plan, link) {
  const money = minor => formatMoney(minor, party.currency);
  const figure = minor => formatMoney(minor, party.currency, { symbol: false, fixed: true });
  const signed = minor => (minor > 0 ? '+' : minor < 0 ? '-' : '') + figure(Math.abs(minor));
  const symbol = currency(party.currency).symbol.trim();
  const people = live(party.members);
  const bills = live(party.expenses);
  const header = [dateRange(bills.map(e => e.date).sort()), `${people.length} people`, `${bills.length} bill${bills.length === 1 ? '' : 's'}`];
  const lines = [`*${party.name}* · ledger report`, header.filter(Boolean).join(' · '), ''];

  if (!bills.length) {
    lines.push('No bills yet.');
  } else {
    const biggest = [...bills].sort((a, b) => b.amount - a.amount)[0];
    lines.push(
      `Total spent: *${money(stats.total)}*`,
      `Per head: *${money(Math.round(stats.total / Math.max(people.length, 1)))}*`,
      `Biggest bill: ${biggest.title}, ${money(biggest.amount)}`,
      '',
      `*Everyone* (${symbol})`,
      '```' + table([
        ['', 'Paid', 'Share', 'Balance'],
        ...people.map(m => [shortName(m.name), figure(stats.paid[m.id] || 0), figure(stats.consumed[m.id] || 0), signed(stats.net[m.id] || 0)]),
      ]) + '```',
    );
    if (live(party.payments).length) lines.push('_Balance counts payments already made._');
    lines.push('');
    if (plan.length) {
      lines.push(`*Who pays whom* (${symbol})`, '```' + table(plan.map(t => [`${shortName(nameOf(party, t.from))} → ${shortName(nameOf(party, t.to))}`, figure(t.amount)])) + '```');
      if (stats.progress > 0) lines.push(`Paid back so far: ${money(stats.debt - stats.outstanding)} of ${money(stats.debt)} (${Math.round(stats.progress * 100)}%)`);
    } else {
      lines.push('*Everyone is settled up.*');
    }
  }
  if (link) lines.push('', `Open the ledger: ${link}`);
  return lines.join('\n');
}

export function entryText(party, expense, link) {
  const payers = Object.keys(expense.paidBy).filter(id => expense.paidBy[id] > 0);
  const who = payers.length === 1 ? nameOf(party, payers[0]) : `${payers.length} people`;
  const ways = Object.keys(expense.split.weights).length;
  return [
    `*${party.name}*: ${who} paid ${formatMoney(expense.amount, party.currency)} for ${expense.title}, split ${ways} way${ways === 1 ? '' : 's'}.`,
    '',
    `Open the ledger: ${link}`,
  ].join('\n');
}

export function nudgeText(party, transfer) {
  return `Hi ${nameOf(party, transfer.from)}, quick reminder from *${party.name}*: you owe ${nameOf(party, transfer.to)} ${formatMoney(transfer.amount, party.currency)}.`;
}
