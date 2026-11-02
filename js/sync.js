// Live ledgers. Each ledger is mirrored to a Firebase Realtime Database on
// the free Spark plan, through its REST API, so no SDK is loaded. Phones keep
// their own copy in localStorage; this module pulls friends' changes in,
// pushes ours out, and both sides merge item by item (newest edit wins), so
// edits made offline land safely once the phone is back online.

import { store, mergeParty, sanitizeParty, adoptMembers, lastActivity } from './state.js';

// From the Firebase console: Realtime Database → Data tab. Leaving it empty
// switches live sync off and the app falls back to sharing full links.
export const DB_URL = 'https://hishab-962aa-default-rtdb.europe-west1.firebasedatabase.app';

export const liveEnabled = () => Boolean(DB_URL);

const SECTIONS = ['members', 'expenses', 'payments'];
const known = new Map();      // ledger id → the server's copy, as last seen
const fetchedAt = new Map();
const pending = new Set();
let pushTimer = null;
let reconcileTimer = null;
let stream = null;            // { id, source } for the ledger on screen
let status = liveEnabled() ? 'idle' : 'off';
const statusListeners = new Set();

const ledgerUrl = id => `${DB_URL}/ledgers/${id}.json`;

export const liveLink = id => `${location.origin}${location.pathname}#live=${id}`;

export function extractLiveId(text) {
  const match = String(text ?? '').match(/[#&?]live=([a-z0-9]{10,24})/);
  return match ? match[1] : null;
}

// 'off' | 'idle' | 'connecting' | 'live' | 'offline'
export const liveStatus = () => status;
export function onStatus(listener) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}
function setStatus(next) {
  if (next === status) return;
  status = next;
  statusListeners.forEach(listener => listener(status));
}

function setAt(tree, keys, value) {
  let node = tree;
  for (const key of keys.slice(0, -1)) {
    if (!node[key] || typeof node[key] !== 'object') node[key] = {};
    node = node[key];
  }
  const last = keys[keys.length - 1];
  if (value === null) delete node[last];
  else node[last] = value;
}

// The server copy is untrusted: anyone with the link can write to it.
function partyFromTree(id, tree) {
  if (!tree || typeof tree !== 'object' || (!tree.meta && !SECTIONS.some(s => tree[s]))) return null;
  return sanitizeParty({ ...(tree.meta || {}), id, members: tree.members || {}, expenses: tree.expenses || {}, payments: tree.payments || {} });
}

export async function fetchLedger(id) {
  const response = await fetch(ledgerUrl(id), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Firebase answered ${response.status}`);
  const tree = (await response.json()) || {};
  known.set(id, tree);
  fetchedAt.set(id, Date.now());
  return partyFromTree(id, tree);
}

// Fold the server's copy into ours, then send whatever we have that's newer.
function reconcile(id) {
  const local = store.party(id);
  const incoming = partyFromTree(id, known.get(id));
  if (local && incoming) {
    const { party, changed } = mergeParty(local, incoming);
    if (changed) {
      store.update(db => {
        db.parties[id] = party;
        adoptMembers(db, party);
      });
    }
  }
  if (local) schedulePush(id);
}

export function schedulePush(id) {
  if (!liveEnabled()) return;
  pending.add(id);
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, 400);
}

async function flush() {
  for (const id of [...pending]) {
    pending.delete(id);
    try {
      await push(id);
    } catch {
      // Offline or refused: try again when the connection comes back.
      if (!stream) setStatus('offline');
      pending.add(id);
    }
  }
}

async function push(id) {
  const local = store.party(id);
  if (!local) return;
  if (!known.has(id)) {
    // Never seen the server's copy: read it before writing anything.
    await fetchLedger(id);
    reconcile(id);
    return;
  }
  const tree = known.get(id);
  const updates = {};
  if (!tree.meta || (local.at || 0) > (tree.meta.at || 0)) {
    updates.meta = { id: local.id, name: local.name, cover: local.cover, currency: local.currency, createdAt: local.createdAt, at: local.at };
  }
  for (const section of SECTIONS) {
    for (const [itemId, item] of Object.entries(local[section] || {})) {
      const theirs = tree[section]?.[itemId];
      if (!theirs || (item.at || 0) > (theirs.at || 0)) updates[`${section}/${itemId}`] = item;
    }
  }
  if (!Object.keys(updates).length) return;
  // POST with a method override and a plain-text body keeps this a simple
  // CORS request, so browsers skip the extra preflight round trip.
  const response = await fetch(`${ledgerUrl(id)}?x-http-method-override=PATCH`, { method: 'POST', body: JSON.stringify(updates) });
  if (!response.ok) throw new Error(`Firebase answered ${response.status}`);
  for (const [path, value] of Object.entries(updates)) setAt(tree, path.split('/'), JSON.parse(JSON.stringify(value)));
}

// The ledger on screen gets a live stream (Server-Sent Events); the rest are
// refreshed now and then, which keeps open connections well inside the free plan.
export function watch(id) {
  if (!liveEnabled() || stream?.id === id) return;
  unwatch();
  const source = new EventSource(ledgerUrl(id));
  stream = { id, source };
  setStatus('connecting');
  const apply = (event, isPatch) => {
    const { path, data } = JSON.parse(event.data);
    const keys = path.split('/').filter(Boolean);
    if (!keys.length && !isPatch) {
      known.set(id, data || {});
    } else {
      const tree = known.get(id) || {};
      if (isPatch) for (const [key, value] of Object.entries(data || {})) setAt(tree, [...keys, ...key.split('/')], value);
      else setAt(tree, keys, data);
      known.set(id, tree);
    }
    fetchedAt.set(id, Date.now());
    setStatus('live');
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(() => reconcile(id), 120);
  };
  source.addEventListener('put', event => apply(event, false));
  source.addEventListener('patch', event => apply(event, true));
  source.addEventListener('cancel', () => setStatus('offline'));
  source.onerror = () => setStatus(navigator.onLine ? 'connecting' : 'offline');
}

export function unwatch() {
  stream?.source.close();
  stream = null;
  setStatus(liveEnabled() ? 'idle' : 'off');
}

export async function refreshAll() {
  if (!liveEnabled() || !navigator.onLine) return;
  await Promise.all(Object.keys(store.db.parties).map(async id => {
    if (stream?.id === id || Date.now() - (fetchedAt.get(id) || 0) < 15000) return;
    try {
      await fetchLedger(id);
      reconcile(id);
    } catch { /* stays as it was; the next refresh tries again */ }
  }));
}

export function startSync() {
  if (!liveEnabled()) return;
  const seen = new Map();
  const pushChanged = db => {
    for (const party of Object.values(db.parties)) {
      const stamp = lastActivity(party);
      if (seen.get(party.id) === stamp) continue;
      seen.set(party.id, stamp);
      schedulePush(party.id);
    }
  };
  store.subscribe(pushChanged);
  pushChanged(store.db);
  window.addEventListener('online', () => {
    refreshAll();
    flush();
    if (stream) {
      const { id } = stream;
      unwatch();
      watch(id);
    }
  });
  window.addEventListener('offline', () => setStatus('offline'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshAll();
  });
  refreshAll();
}
