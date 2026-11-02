// App state: ledgers saved in localStorage, plus the merge that makes
// share links work as sync.

import { INKS, avatarFromSeed, sanitizeAvatar } from './avatar.js';
import { CURRENCIES, defaultCurrency } from './money.js';
import { cleanIban, live, todayISO, uid } from './util.js';

const STORAGE_KEY = 'hishab:v1';
const listeners = new Set();

// Cloth colours for the ledger covers.
export const COVERS = { red: '#8c1a1f', green: '#1f4d3a', navy: '#1f2f55', brown: '#6b3f1d', black: '#2a2622' };

// The biryani crew every phone starts with. Fixed ids mean everyone's copy
// of "Tonmoy" is the same person, so shared ledgers merge without duplicates.
const SEED_CREW = [
  ['Tawsif', { skin: 2, hair: 'side', hairColor: 0, beard: 'full', glasses: 'none', hat: 'none', mood: 'smile', ink: 0 }],
  ['Tonmoy', { skin: 2, hair: 'quiff', hairColor: 0, beard: 'stubble', glasses: 'square', hat: 'none', mood: 'grin', ink: 2 }],
  ['Afraaz', { skin: 1, hair: 'curly', hairColor: 1, beard: 'goatee', glasses: 'none', hat: 'none', mood: 'smile', ink: 3 }],
  ['Usama', { skin: 2, hair: 'short', hairColor: 0, beard: 'full', glasses: 'round', hat: 'none', mood: 'calm', ink: 4 }],
  ['Awais', { skin: 3, hair: 'buzz', hairColor: 0, beard: 'mustache', glasses: 'none', hat: 'cap', mood: 'grin', ink: 5 }],
  ['Tabish', { skin: 1, hair: 'short', hairColor: 1, beard: 'none', glasses: 'round', hat: 'none', mood: 'smile', ink: 1 }],
];

const seedCrew = () => Object.fromEntries(SEED_CREW.map(([name, avatar], i) => {
  const id = `c-${name.toLowerCase()}`;
  return [id, { id, name, avatar, createdAt: i + 1, at: 1 }];
}));

const emptyDb = () => ({
  version: 1, parties: {}, me: {}, crew: seedCrew(), myId: null,
  theme: 'auto', lastCurrency: defaultCurrency(), installDismissed: false,
  sound: true, handwriting: true, tipsSeen: false,
});

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && typeof parsed.parties === 'object') return { ...emptyDb(), ...parsed };
  } catch { /* private mode or corrupt data: start fresh */ }
  return emptyDb();
}

let db = load();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('Could not save to localStorage', err);
  }
}

export const store = {
  get db() { return db; },
  party: id => db.parties[id],
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  update(mutate) {
    mutate(db);
    persist();
    listeners.forEach(listener => listener(db));
  },
};

// Keep several open tabs in sync.
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  db = load();
  listeners.forEach(listener => listener(db));
});

// Strictly increasing per item, so an edit always beats the copy it replaced,
// even if this phone's clock runs behind a friend's.
export const nextStamp = previous => Math.max(Date.now(), (previous || 0) + 1);

export function initials(name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const letters = words.length > 1 ? words[0][0] + words[1][0] : [...words[0]].slice(0, 2).join('');
  return letters.toUpperCase();
}

// ---------- the crew ----------

export const crewList = () => live(db.crew);

export function makePerson(name) {
  const now = Date.now();
  const id = uid();
  return { id, name: name.trim().slice(0, 40), avatar: avatarFromSeed(id + name), createdAt: now, at: now };
}

// A ledger member is a copy of a crew person with the same id, so the same
// friend is the same member in every ledger.
// Bank details travel with the person, so friends can pay them back.
const payDetails = person => ({ iban: person.iban || '', holder: person.holder || '' });

export function memberFromPerson(person) {
  const now = Date.now();
  return { id: person.id, name: person.name, avatar: person.avatar, color: INKS[person.avatar.ink], ...payDetails(person), createdAt: now, at: now };
}

// Saving a character updates them everywhere they appear.
export function savePerson(target, person) {
  target.crew[person.id] = person;
  for (const party of Object.values(target.parties)) {
    const member = party.members[person.id];
    if (!member || member.deleted) continue;
    Object.assign(member, { name: person.name, avatar: person.avatar, color: INKS[person.avatar.ink], ...payDetails(person), at: nextStamp(member.at) });
  }
}

// People in a ledger someone shared join your crew, and newer details win.
export function adoptMembers(target, party) {
  const names = new Set(live(target.crew).map(p => p.name.toLowerCase()));
  for (const member of live(party.members)) {
    const person = target.crew[member.id];
    if (person) {
      if ((member.at || 0) > (person.at || 0) && member.avatar) {
        Object.assign(person, { name: member.name, avatar: member.avatar, ...payDetails(member), at: member.at });
      }
    } else if (member.avatar && !names.has(member.name.toLowerCase())) {
      target.crew[member.id] = { id: member.id, name: member.name, avatar: member.avatar, ...payDetails(member), createdAt: Date.now(), at: member.at || 0 };
    }
  }
  if (target.myId && party.members[target.myId] && !target.me[party.id]) target.me[party.id] = target.myId;
}

// Guests typed by name (and ledgers from before the crew existed).
export function makeMember(party, name) {
  const index = Object.keys(party.members).length;
  const now = Date.now();
  return { id: uid(), name: name.trim().slice(0, 40), color: INKS[index % INKS.length], createdAt: now, at: now };
}

export function makeParty({ name, currency, people, cover }) {
  const now = Date.now();
  const party = { id: uid(), name, currency, cover, createdAt: now, at: now, members: {}, expenses: {}, payments: {} };
  for (const person of people) party.members[person.id] = memberFromPerson(person);
  return party;
}

export function parseNames(text) {
  const seen = new Set();
  return String(text)
    .split(/[,\n;]+/)
    .map(name => name.trim().replace(/\s+/g, ' '))
    .filter(name => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function memberInUse(party, memberId) {
  const inExpense = live(party.expenses).some(e => e.paidBy[memberId] > 0 || e.split.weights[memberId] > 0);
  const inPayment = live(party.payments).some(p => p.from === memberId || p.to === memberId);
  return inExpense || inPayment;
}

export function lastActivity(party) {
  let latest = party.at || 0;
  for (const key of ['members', 'expenses', 'payments']) {
    for (const item of Object.values(party[key])) latest = Math.max(latest, item.at || 0);
  }
  return latest;
}

// Last-writer-wins per item. Deleted items stay as tombstones, so deletions
// spread through links too. Returns how many items came from `incoming`.
export function mergeParty(local, incoming) {
  const party = structuredClone(local);
  let changed = 0;
  if ((incoming.at || 0) > (party.at || 0)) {
    Object.assign(party, { name: incoming.name, cover: incoming.cover, currency: incoming.currency, at: incoming.at });
    changed += 1;
  }
  for (const key of ['members', 'expenses', 'payments']) {
    for (const [id, item] of Object.entries(incoming[key])) {
      const mine = party[key][id];
      if (!mine || (item.at || 0) > (mine.at || 0)) {
        party[key][id] = item;
        changed += 1;
      }
    }
  }
  return { party, changed };
}

// Links and backup files are untrusted input: rebuild every field with the
// expected type before it gets near the UI.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const COLOR_RE = /^#[0-9a-f]{3,8}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const text = (value, max) => String(value ?? '').slice(0, max);
const int = value => (Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0);
const positive = value => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0);
const tombstone = item => (item.deleted ? { deleted: true } : {});

function cleanMap(map, cleanItem) {
  const out = {};
  for (const [key, item] of Object.entries(map && typeof map === 'object' ? map : {})) {
    const id = text(item?.id || key, 24);
    if (!item || typeof item !== 'object' || UNSAFE_KEYS.has(id)) continue;
    out[id] = cleanItem({ ...item, id });
  }
  return out;
}

function cleanAmounts(map, wholeNumbers) {
  const out = {};
  for (const [id, value] of Object.entries(map && typeof map === 'object' ? map : {})) {
    const amount = wholeNumbers ? int(value) : positive(value);
    if (amount > 0 && !UNSAFE_KEYS.has(id)) out[text(id, 24)] = amount;
  }
  return out;
}

export function sanitizeParty(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.members || !raw.expenses) {
    throw new Error('Not a Hishab ledger');
  }
  return {
    id: text(raw.id, 24),
    name: text(raw.name, 40) || 'Ledger',
    cover: Object.hasOwn(COVERS, raw.cover) ? raw.cover : 'red',
    currency: Object.hasOwn(CURRENCIES, raw.currency) ? raw.currency : 'EUR',
    createdAt: int(raw.createdAt),
    at: int(raw.at),
    members: cleanMap(raw.members, m => {
      const avatar = sanitizeAvatar(m.avatar);
      return {
        id: m.id,
        name: text(m.name, 40) || 'Friend',
        color: avatar ? INKS[avatar.ink] : COLOR_RE.test(m.color) ? m.color : INKS[0],
        ...(avatar ? { avatar } : {}),
        iban: cleanIban(m.iban),
        holder: text(m.holder, 70),
        createdAt: int(m.createdAt),
        at: int(m.at),
        ...tombstone(m),
      };
    }),
    expenses: cleanMap(raw.expenses, e => {
      const mode = e.split?.mode === 'exact' ? 'exact' : 'equal';
      return {
        id: e.id,
        title: text(e.title, 60) || 'Entry',
        amount: int(e.amount),
        date: DATE_RE.test(e.date) ? e.date : todayISO(),
        paidBy: cleanAmounts(e.paidBy, true),
        split: { mode, weights: cleanAmounts(e.split?.weights, mode === 'exact') },
        createdAt: int(e.createdAt),
        at: int(e.at),
        ...tombstone(e),
      };
    }),
    payments: cleanMap(raw.payments, p => ({
      id: p.id,
      from: text(p.from, 24),
      to: text(p.to, 24),
      amount: int(p.amount),
      date: DATE_RE.test(p.date) ? p.date : todayISO(),
      createdAt: int(p.createdAt),
      at: int(p.at),
      ...tombstone(p),
    })),
  };
}
