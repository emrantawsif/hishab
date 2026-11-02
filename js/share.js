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

// WhatsApp messages. Text between ``` renders in monospace there, so the
// settle-up lines form aligned ledger columns.

const nameOf = (party, id) => party.members[id]?.name ?? 'Someone';

export function summaryText(party, stats, plan, link) {
  const money = minor => formatMoney(minor, party.currency);
  const people = live(party.members).length;
  const perHead = money(Math.round(stats.total / Math.max(people, 1)));
  const lines = [`*${party.name}*`, `Total ${money(stats.total)} · ${perHead} per head · ${people} people`, ''];
  if (plan.length) {
    const from = plan.map(t => nameOf(party, t.from));
    const to = plan.map(t => nameOf(party, t.to));
    const figures = plan.map(t => formatMoney(t.amount, party.currency, { symbol: false, fixed: true }));
    const width = list => Math.max(...list.map(s => s.length));
    const rows = plan.map((_, i) => `${from[i].padEnd(width(from))} → ${to[i].padEnd(width(to))}  ${figures[i].padStart(width(figures))}`);
    lines.push(`Who pays whom (${currency(party.currency).symbol.trim()})`, '```' + rows.join('\n') + '```');
  } else {
    lines.push('Everyone is settled up.');
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
