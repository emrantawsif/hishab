// Hishab UI. Screens render to HTML strings; clicks route through data-act.
// Bottom sheets live in #sheet-root so re-rendering the screen never resets a form.

import { $, esc, live, uid, todayISO, prettyDate, haptic } from './util.js';
import { store, COVERS, initials, makeParty, nextStamp, mergeParty, sanitizeParty, parseNames, memberInUse, lastActivity, crewList, makePerson, memberFromPerson, savePerson, adoptMembers } from './state.js';
import { INKS, PARTS, COLOR_PARTS, avatarSvg, avatarFromSeed, shuffleAvatar } from './avatar.js';
import { CURRENCIES, currency, formatMoney, evaluateAmount, hasOperator, partyStats, settlePlan, expenseShares, ledgerShares } from './money.js';
import { decodeParty, partyLink, extractJoinCode, summaryText, entryText, nudgeText } from './share.js';

const app = $('#app');
const sheetRoot = $('#sheet-root');
const toastRoot = $('#toast-root');

const TABS = [
  { id: 'entries', label: 'Entries' },
  { id: 'balances', label: 'Balances' },
  { id: 'settle', label: 'Settle up' },
];

const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installPrompt = null;
let route = { screen: 'home' };

const svg = paths => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICON = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  share: svg('<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  more: svg('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
  close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  auto: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'),
  chat: svg('<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/>'),
};

// ---------- helpers ----------

const money = (party, minor) => formatMoney(minor, party.currency);
const figure = (party, minor) => formatMoney(minor, party.currency, { symbol: false, fixed: true });
const symbolOf = party => currency(party.currency).symbol.trim();
const coverColor = party => COVERS[party.cover] || COVERS.red;

// You are whoever you picked in this ledger, or else your own crew character.
function meOf(party) {
  const isMember = id => id && party.members[id] && !party.members[id].deleted;
  const picked = store.db.me[party.id];
  if (isMember(picked)) return picked;
  return isMember(store.db.myId) ? store.db.myId : null;
}

function nameOf(party, id) {
  if (id === meOf(party)) return 'You';
  return party.members[id]?.name ?? 'Someone';
}

// For names that land mid-sentence: "Lena paid you".
const objectName = (party, id) => (id === meOf(party) ? 'you' : nameOf(party, id));

// A person's character portrait, or their initials in ink if they have none.
function monogram(member, size = '') {
  if (!member) return `<span class="mono ${size}">?</span>`;
  if (member.avatar) {
    return `<span class="ava ${size}" style="--c:${INKS[member.avatar.ink]}" title="${esc(member.name)}">${avatarSvg(member.avatar)}</span>`;
  }
  return `<span class="mono ${size}" style="--c:${esc(member.color)}" title="${esc(member.name)}">${esc(initials(member.name))}</span>`;
}

// Ledgers are numbered in the order they were opened, like volumes on a shelf.
function ledgerNumbers() {
  const ordered = Object.values(store.db.parties).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return Object.fromEntries(ordered.map((party, index) => [party.id, String(index + 1).padStart(2, '0')]));
}

function dateCell(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const monthName = new Date(year, month - 1, day).toLocaleDateString('en-GB', { month: 'short' });
  return `<span class="gutter date"><b>${day}</b><small>${monthName}</small></span>`;
}

const closeButton = `<button class="icon-btn" data-act="close-sheet" aria-label="Close">${ICON.close}</button>`;
const currencyOptions = selected =>
  Object.entries(CURRENCIES).map(([code, c]) => `<option value="${code}" ${code === selected ? 'selected' : ''}>${esc(c.label)}</option>`).join('');
const coverOptions = selected =>
  Object.entries(COVERS).map(([key, color]) => `<button type="button" class="swatch ${key === selected ? 'on' : ''}" data-cover="${key}" style="--cover:${color}" aria-label="${key} cover"></button>`).join('');

function toast(message, { action, onAction, duration } = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button class="toast-btn">${esc(action)}</button>` : ''}`;
  toastRoot.replaceChildren(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const hide = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  };
  el.querySelector('.toast-btn')?.addEventListener('click', () => { onAction(); hide(); });
  setTimeout(hide, duration ?? (action ? 5000 : 2600));
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = Object.assign(document.createElement('textarea'), { value: text });
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

function downloadJson(filename, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ledger';

// wa.me opens WhatsApp's chat picker with the message filled in; the group
// sits near the top because it's a recent chat.
const openWhatsApp = text => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');

// Building a link is async (compression), but phones only allow opening
// WhatsApp straight from a tap. So links are prepared after each render and
// read back synchronously when the tap comes.
const linkCache = new Map();
const linkKey = party => `${lastActivity(party)}:${Object.keys(party.expenses).length}:${Object.keys(party.payments).length}`;

function warmLink(party) {
  const key = linkKey(party);
  if (linkCache.get(party.id)?.key === key) return;
  partyLink(party).then(url => linkCache.set(party.id, { key, url }));
}

async function linkFor(party) {
  const cached = linkCache.get(party.id);
  if (cached?.key === linkKey(party)) return cached.url;
  const url = await partyLink(party);
  linkCache.set(party.id, { key: linkKey(party), url });
  return url;
}

function withLink(party, send) {
  const cached = linkCache.get(party.id);
  if (cached?.key === linkKey(party)) send(cached.url);
  else linkFor(party).then(send);
}

// ---------- routing ----------

function parseRoute() {
  const [, screen, id, tab] = location.hash.slice(1).split('/');
  if (screen === 'party' && store.party(id)) {
    return { screen: 'party', id, tab: TABS.some(t => t.id === tab) ? tab : 'entries' };
  }
  return { screen: 'home' };
}

let lastScreen = '';

function render() {
  route = parseRoute();
  const party = route.screen === 'party' ? store.party(route.id) : null;
  app.innerHTML = party ? renderParty(party) : renderHome();
  // Animate only when arriving on a screen, not on every re-render.
  const screen = `${route.screen}:${route.id ?? ''}`;
  if (screen !== lastScreen) app.querySelector('main')?.classList.add('enter');
  lastScreen = screen;
  document.title = party ? `${party.name} · Hishab` : 'Hishab';
  if (party) warmLink(party);
}

// ---------- home: the shelf of ledgers ----------

function themeIcon() {
  return { dark: ICON.moon, light: ICON.sun }[store.db.theme] || ICON.auto;
}

function installBanner() {
  if (isStandalone || store.db.installDismissed || (!installPrompt && !isIOS)) return '';
  return `<section class="install">
    <img src="icons/icon-192.png" alt="" width="40" height="40">
    <div class="grow"><b>Install Hishab</b><small>${isIOS ? 'Add it to your Home Screen. Works offline.' : 'Add it to your home screen. Works offline.'}</small></div>
    <button class="btn sm primary" data-act="install">Install</button>
    <button class="icon-btn sm" data-act="dismiss-install" aria-label="Dismiss">${ICON.close}</button>
  </section>`;
}

function progressBar(stats, extraClass = '') {
  const pct = Math.round(stats.progress * 100);
  return `<span class="progress ${extraClass} ${pct === 100 ? 'done' : ''}" role="progressbar" aria-label="Paid back" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></span>`;
}

const progressLabel = stats => (stats.progress === 1 ? 'Cleared' : `${Math.round(stats.progress * 100)}% paid back`);

// A ledger drawn as a 3D book: cover, first page, page edges and back board.
// The cover swings open on its spine when the book is tapped.
function bookHtml(party, { number = '', interactive = true } = {}) {
  const stats = partyStats(party);
  const me = interactive ? meOf(party) : null;
  const net = me ? stats.net[me] || 0 : 0;
  const status = !me ? '' : net > 0 ? `You are owed ${money(party, net)}` : net < 0 ? `You owe ${money(party, -net)}` : '';
  const tag = interactive ? 'button' : 'div';
  const attrs = interactive ? `data-act="open-party" data-id="${esc(party.id)}" aria-label="Open ${esc(party.name)}"` : '';
  return `<${tag} class="book ${interactive ? '' : 'static'}" style="--cover:${coverColor(party)}" ${attrs}>
    <span class="book-3d">
      <span class="book-back"></span>
      <span class="book-edge side"></span>
      <span class="book-edge foot"></span>
      <span class="book-page"></span>
      <span class="book-cover">
        <span class="book-label"><small>${number ? `No. ${number}` : 'Ledger'}</small><b>${esc(party.name)}</b></span>
        <span class="book-foot">
          <span>${live(party.members).length} people · ${money(party, stats.total)}</span>
          ${status ? `<span class="book-status">${status}</span>` : ''}
          ${stats.count ? `<span class="book-progress">${progressBar(stats, 'thin')}<small>${progressLabel(stats)}</small></span>` : ''}
        </span>
      </span>
    </span>
  </${tag}>`;
}

// Until you've picked your character, tapping the crew chooses you.
function crewStrip() {
  const crew = crewList();
  const myId = store.db.myId && store.db.crew[store.db.myId] ? store.db.myId : null;
  const choosing = !myId && crew.length > 0;
  return `
    <h2 class="section-title">Your crew</h2>
    ${choosing ? '<p class="choose">Choose your character</p>' : ''}
    <section class="crew ${choosing ? 'choosing' : ''}">
      ${crew.map((p, i) => `<button class="crew-member ${p.id === myId ? 'me' : ''}" style="--i:${i}" data-act="${choosing ? 'pick-me' : 'character'}" data-id="${esc(p.id)}">
        ${monogram(p, 'lg')}<span>${esc(p.name)}</span>${p.id === myId ? '<small>you</small>' : ''}
      </button>`).join('')}
      <button class="crew-member add" data-act="character" aria-label="Add a character"><span class="ava-add">${ICON.plus}</span><span>Add</span></button>
    </section>`;
}

function renderHome() {
  const parties = Object.values(store.db.parties).sort((a, b) => lastActivity(b) - lastActivity(a));
  const numbers = ledgerNumbers();
  return `
  <header class="band">
    <div class="band-row">
      <div class="wordmark"><img src="icons/pan-96.png" alt="" width="40" height="40">hishab</div>
      <div class="band-actions">
        <button class="icon-btn" data-act="theme" aria-label="Switch theme">${themeIcon()}</button>
        <button class="icon-btn" data-act="app-menu" aria-label="Menu">${ICON.more}</button>
      </div>
    </div>
  </header>
  <main class="page">
    ${installBanner()}
    ${crewStrip()}
    <h2 class="section-title">Your ledgers</h2>
    <section class="shelf">
      ${parties.map(p => bookHtml(p, { number: numbers[p.id] })).join('')}
      <button class="book book-new" data-act="new-party">${ICON.plus}<b>New ledger</b></button>
    </section>
    <button class="link-btn" data-act="paste-link">Open a ledger someone sent you</button>
  </main>`;
}

// ---------- a ledger ----------

function renderParty(party) {
  const stats = partyStats(party);
  const plan = settlePlan(stats.net);
  const members = live(party.members);
  const me = meOf(party);
  const myNet = me ? stats.net[me] || 0 : 0;
  const position = !me ? ''
    : myNet > 0 ? `<p class="position cr">You are owed <b>${money(party, myNet)}</b></p>`
      : myNet < 0 ? `<p class="position dr">You owe <b>${money(party, -myNet)}</b></p>`
        : stats.count ? '<p class="position">You are settled up</p>' : '';
  const body = {
    entries: () => renderEntries(party, stats),
    balances: () => renderBalances(party, stats),
    settle: () => renderSettle(party, stats, plan),
  }[route.tab]();

  return `
  <header class="band" style="--cover:${coverColor(party)}">
    <div class="band-row">
      <button class="icon-btn" data-act="home" aria-label="All ledgers">${ICON.back}</button>
      <div class="band-title">${esc(party.name)}</div>
      <div class="band-actions">
        <button class="icon-btn" data-act="share" aria-label="Share">${ICON.share}</button>
        <button class="icon-btn" data-act="party-settings" aria-label="Ledger settings">${ICON.gear}</button>
      </div>
    </div>
  </header>
  <main class="page ruled">
    <section class="summary">
      <div class="summary-total"><span>Total spent</span><b>${money(party, stats.total)}</b></div>
      ${members.length ? `<div class="summary-avg"><span>Per head</span><b>${money(party, Math.round(stats.total / members.length))}</b></div>` : ''}
      <p class="summary-meta">${members.length} people · ${stats.count} entr${stats.count === 1 ? 'y' : 'ies'}</p>
      ${position}
      ${stats.debt > 0 ? `<button class="meter" data-act="tab" data-tab="settle">
        <span class="meter-head"><span>Paid back</span><b>${stats.progress === 1 ? 'Cleared' : `${money(party, stats.debt - stats.outstanding)} of ${money(party, stats.debt)}`}</b></span>
        ${progressBar(stats)}
      </button>` : ''}
      <div class="people">
        ${members.map(m => `<button class="mono-btn" data-act="members" aria-label="${esc(m.name)}">${monogram(m)}</button>`).join('')}
        <button class="mono add" data-act="members" aria-label="Add or edit people">${ICON.plus}</button>
      </div>
      <button class="btn wa block" data-act="post-group">${ICON.chat} Post to WhatsApp group</button>
    </section>
    ${!me && members.length ? whoAreYou(members) : ''}
    <nav class="tabs" role="tablist">
      ${TABS.map(t => `<button role="tab" class="tab ${t.id === route.tab ? 'on' : ''}" aria-selected="${t.id === route.tab}" data-act="tab" data-tab="${t.id}">${t.label}${t.id === 'settle' && plan.length ? ` <span class="count">${plan.length}</span>` : ''}</button>`).join('')}
    </nav>
    <section class="tab-body">${body}</section>
  </main>
  <div class="fab-wrap"><button class="fab" data-act="add-expense">${ICON.plus} New entry</button></div>`;
}

function whoAreYou(members) {
  return `<section class="whoami">
    <p><b>Whose phone is this?</b> Pick your name so the ledger can say “you”.</p>
    <div class="chip-row">${members.map(m => `<button class="chip with-face" data-act="set-me" data-id="${esc(m.id)}">${monogram(m, 'xs')}${esc(m.name)}</button>`).join('')}</div>
  </section>`;
}

function ledgerHead(party, middle = 'Particulars', left = 'Date') {
  return `<div class="ledger-head"><span class="gutter">${left}</span><span>${middle}</span><span>${esc(symbolOf(party))}</span></div>`;
}

function renderEntries(party, stats) {
  const me = meOf(party);
  const items = [
    ...live(party.expenses).map(item => ({ kind: 'expense', item })),
    ...live(party.payments).map(item => ({ kind: 'payment', item })),
  ].sort((a, b) => b.item.date.localeCompare(a.item.date) || b.item.createdAt - a.item.createdAt);

  if (!items.length) {
    return `${ledgerHead(party)}<div class="blank">
      <p>No entries yet.</p>
      <p class="muted">Every bill you add goes on its own line here.</p>
      <button class="btn primary" data-act="add-expense">Add the first bill</button>
    </div>`;
  }

  const splits = ledgerShares(party);
  let lastDate = '';
  const rows = items.map(({ kind, item }) => {
    const date = item.date === lastDate ? '<span class="gutter date ditto" aria-hidden="true">〃</span>' : dateCell(item.date);
    lastDate = item.date;
    if (kind === 'payment') {
      return `<button class="entry paid" data-act="payment" data-id="${esc(item.id)}">
        ${date}
        <span class="entry-main"><span class="entry-title">${esc(nameOf(party, item.from))} paid ${esc(objectName(party, item.to))}</span><small>Settlement</small></span>
        <span class="entry-amt">${figure(party, item.amount)}</span>
        <span class="stamp" aria-hidden="true">Paid</span>
      </button>`;
    }
    const shares = splits[item.id];
    const payers = Object.keys(item.paidBy).filter(id => item.paidBy[id] > 0);
    const payerText = payers.length === 1 ? `${nameOf(party, payers[0])} paid` : `${payers.length} people paid`;
    const people = Object.keys(shares).length;
    let mine = '';
    if (me) {
      const delta = (item.paidBy[me] || 0) - (shares[me] || 0);
      if (delta > 0) mine = `<small class="cr">you lent ${figure(party, delta)}</small>`;
      else if (delta < 0) mine = `<small class="dr">you owe ${figure(party, -delta)}</small>`;
    }
    return `<button class="entry" data-act="edit-expense" data-id="${esc(item.id)}">
      ${date}
      <span class="entry-main"><span class="entry-title">${esc(item.title)}</span><small>${esc(payerText)} · split ${people} way${people === 1 ? '' : 's'}</small></span>
      <span class="entry-amt">${figure(party, item.amount)}${mine}</span>
    </button>`;
  }).join('');

  return `${ledgerHead(party)}${rows}
    <div class="ledger-total"><span class="gutter"></span><span>Total spent</span><b>${figure(party, stats.total)}</b></div>`;
}

function renderBalances(party, stats) {
  if (!stats.count) return `${ledgerHead(party, 'Person', '')}<div class="blank"><p>Nothing to balance yet.</p><p class="muted">Add a bill to see who is up and who is down.</p></div>`;
  const me = meOf(party);
  const rows = live(party.members).map(m => {
    const net = stats.net[m.id] || 0;
    const isMe = m.id === me;
    const note = net > 0 ? (isMe ? 'you get back' : 'gets back') : net < 0 ? (isMe ? 'you owe' : 'owes') : 'settled';
    const cls = net > 0 ? 'cr' : net < 0 ? 'dr' : '';
    return `<div class="entry static">
      <span class="gutter">${monogram(m, 'sm')}</span>
      <span class="entry-main"><span class="entry-title">${esc(nameOf(party, m.id))}</span><small>paid ${figure(party, stats.paid[m.id] || 0)} · share ${figure(party, stats.consumed[m.id] || 0)}</small></span>
      <span class="entry-amt ${cls}">${net === 0 ? '—' : figure(party, Math.abs(net))}<small>${note}</small></span>
    </div>`;
  }).join('');
  return `${ledgerHead(party, 'Person', '')}${rows}`;
}

function renderSettle(party, stats, plan) {
  const history = live(party.payments).sort((a, b) => b.createdAt - a.createdAt);
  const historyHtml = history.length ? `<h3 class="section-title">Payments made</h3>${history.map(p => `
    <button class="entry paid" data-act="payment" data-id="${esc(p.id)}">
      ${dateCell(p.date)}
      <span class="entry-main"><span class="entry-title">${esc(nameOf(party, p.from))} paid ${esc(objectName(party, p.to))}</span><small>Settlement</small></span>
      <span class="entry-amt">${figure(party, p.amount)}</span>
      <span class="stamp" aria-hidden="true">Paid</span>
    </button>`).join('')}` : '';

  if (!stats.count) return `<div class="blank"><p>Nothing to settle.</p><p class="muted">Once bills are in, this works out the fewest payments.</p></div>`;
  if (!plan.length) return `<div class="blank"><p>All square.</p><p class="muted">Nobody owes anybody.</p></div>${historyHtml}`;

  const me = meOf(party);
  return `<p class="note">${plan.length} payment${plan.length === 1 ? '' : 's'} settle everything.</p>
  ${plan.map(t => `
    <div class="transfer">
      <span class="gutter">${monogram(party.members[t.from], 'sm')}</span>
      <div class="transfer-body">
        <div class="transfer-line"><span><b>${esc(nameOf(party, t.from))}</b> ${t.from === me ? 'pay' : 'pays'} <b>${esc(objectName(party, t.to))}</b></span><span class="leader"></span><b class="transfer-amt">${money(party, t.amount)}</b></div>
        <div class="transfer-actions">
          ${t.from !== me ? `<button class="btn sm wa" data-act="nudge" data-from="${esc(t.from)}" data-to="${esc(t.to)}" data-amount="${t.amount}">${ICON.chat} Remind</button>` : ''}
          <button class="btn sm" data-act="mark-paid" data-from="${esc(t.from)}" data-to="${esc(t.to)}" data-amount="${t.amount}">Mark paid</button>
        </div>
      </div>
    </div>`).join('')}
  <button class="link-btn" data-act="record-payment">Record a different payment</button>
  ${historyHtml}`;
}

// ---------- bottom sheets ----------

let sheet = null;
let resolveBack = null;

async function openSheet(html, onMount) {
  if (sheet) await closeSheet();
  sheetRoot.innerHTML = `<div class="sheet-backdrop" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  sheetRoot.className = 'open';
  document.body.classList.add('no-scroll');
  sheet = { el: sheetRoot.querySelector('.sheet') };
  // An extra history entry lets the Android back button close the sheet.
  history.pushState({ sheet: true }, '');
  onMount?.(sheet.el);
  return sheet.el;
}

function teardownSheet() {
  sheet = null;
  document.body.classList.remove('no-scroll');
  sheetRoot.className = 'closing';
  setTimeout(() => {
    if (sheet) return;
    sheetRoot.className = '';
    sheetRoot.innerHTML = '';
  }, 200);
}

function closeSheet() {
  if (!sheet) return Promise.resolve();
  teardownSheet();
  return new Promise(resolve => {
    const done = () => { if (resolveBack === done) resolveBack = null; resolve(); };
    resolveBack = done;
    history.back();
    setTimeout(done, 400);
  });
}

window.addEventListener('popstate', () => {
  if (resolveBack) { resolveBack(); return; }
  if (sheet) teardownSheet();
});

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  haptic(30);
}

function pickCover(el, containerSelector) {
  let selected = null;
  $(containerSelector, el).addEventListener('click', event => {
    const option = event.target.closest('[data-cover]');
    if (!option) return;
    selected = option.dataset.cover;
    el.querySelectorAll(`${containerSelector} .swatch`).forEach(b => b.classList.toggle('on', b === option));
  });
  return () => selected;
}

function sheetNewParty() {
  const firstCover = Object.keys(COVERS)[Object.keys(store.db.parties).length % Object.keys(COVERS).length];
  const picked = new Set(crewList().map(p => p.id));
  const pickerHtml = () => crewList().map(p => `
    <button type="button" class="pick ${picked.has(p.id) ? 'on' : ''}" data-pid="${esc(p.id)}" aria-pressed="${picked.has(p.id)}">
      ${monogram(p, 'lg')}<span>${esc(p.name)}</span>
    </button>`).join('');
  openSheet(`
    <div class="sheet-head"><h2>New ledger</h2>${closeButton}</div>
    <div class="field"><label for="np-name">What’s it for</label><input id="np-name" class="input" maxlength="40" placeholder="Friday biryani" autocomplete="off"></div>
    <div class="field"><label>Who’s in</label>
      <div class="crew-pick" id="np-crew">${pickerHtml()}</div>
      <div class="add-row"><input id="np-guest" class="input" maxlength="40" placeholder="Someone new" autocomplete="off"><button type="button" class="btn sm" id="np-guest-add">Add</button></div>
      <small class="help">New people join your crew, so they’re ready next time.</small>
    </div>
    <div class="field"><label for="np-cur">Currency</label><select id="np-cur" class="input">${currencyOptions(store.db.lastCurrency)}</select></div>
    <div class="field"><label>Cover</label><div class="swatches" id="np-cover">${coverOptions(firstCover)}</div></div>
    <p class="form-error" id="np-error" aria-live="polite"></p>
    <button class="btn primary block" id="np-create">Open ledger</button>
  `, el => {
    const chosenCover = pickCover(el, '#np-cover');
    const crewBox = $('#np-crew', el);
    crewBox.addEventListener('click', event => {
      const tile = event.target.closest('[data-pid]');
      if (!tile) return;
      const id = tile.dataset.pid;
      if (picked.has(id)) picked.delete(id);
      else picked.add(id);
      tile.classList.toggle('on', picked.has(id));
      tile.setAttribute('aria-pressed', picked.has(id));
      haptic(8);
    });
    const addGuest = () => {
      const input = $('#np-guest', el);
      const [name] = parseNames(input.value);
      if (!name) return shake(input);
      const existing = crewList().find(p => p.name.toLowerCase() === name.toLowerCase());
      const person = existing || makePerson(name);
      if (!existing) store.update(db => { db.crew[person.id] = person; });
      picked.add(person.id);
      crewBox.innerHTML = pickerHtml();
      input.value = '';
    };
    $('#np-guest-add', el).addEventListener('click', addGuest);
    $('#np-guest', el).addEventListener('keydown', event => { if (event.key === 'Enter') addGuest(); });

    $('#np-create', el).addEventListener('click', async () => {
      const nameInput = $('#np-name', el);
      const people = crewList().filter(p => picked.has(p.id));
      if (people.length < 2) {
        $('#np-error', el).textContent = 'Pick at least two people to split with.';
        return shake(crewBox);
      }
      const currencyCode = $('#np-cur', el).value;
      const party = makeParty({ name: nameInput.value.trim() || nameInput.placeholder, currency: currencyCode, people, cover: chosenCover() || firstCover });
      store.update(db => {
        db.parties[party.id] = party;
        db.lastCurrency = currencyCode;
      });
      await closeSheet();
      location.hash = `/party/${party.id}`;
    });
  });
}

// The character sheet: build someone's portrait from parts. Saving updates
// them in every ledger they're in.
function sheetCharacter(personId = null) {
  const existing = personId ? store.db.crew[personId] : null;
  const person = existing ? structuredClone(existing) : makePerson('');
  let armed = false;
  const labels = { skin: 'Skin', hair: 'Hair', hairColor: 'Hair colour', beard: 'Beard', glasses: 'Glasses', hat: 'Hat', mood: 'Mood', ink: 'Ink colour' };
  const order = ['skin', 'hair', 'hairColor', 'beard', 'glasses', 'hat', 'mood', 'ink'];

  const optionsHtml = key => {
    if (COLOR_PARTS[key]) {
      return `<div class="swatches dots" data-part="${key}">${COLOR_PARTS[key].map((color, i) => `<button type="button" class="swatch dot ${person.avatar[key] === i ? 'on' : ''}" data-value="${i}" style="--cover:${color}" aria-label="${labels[key]} ${i + 1}"></button>`).join('')}</div>`;
    }
    return `<div class="tiles" data-part="${key}">${PARTS[key].map(value => {
      const preview = { ...person.avatar, [key]: value, ...(key === 'hair' ? { hat: 'none' } : {}) };
      return `<button type="button" class="tile ${person.avatar[key] === value ? 'on' : ''}" data-value="${value}" aria-label="${labels[key]}: ${value}"><span class="ava fill">${avatarSvg(preview)}</span><small>${value}</small></button>`;
    }).join('')}</div>`;
  };

  const record = () => {
    if (!existing) return '';
    const ledgers = Object.values(store.db.parties).filter(p => p.members[person.id] && !p.members[person.id].deleted);
    if (!ledgers.length) return '<p class="char-record">Not in any ledger yet.</p>';
    const byCurrency = {};
    for (const party of ledgers) byCurrency[party.currency] = (byCurrency[party.currency] || 0) + (partyStats(party).net[person.id] || 0);
    const lines = Object.entries(byCurrency).map(([code, net]) => net > 0 ? `gets back ${formatMoney(net, code)}` : net < 0 ? `owes ${formatMoney(-net, code)}` : 'all square');
    return `<p class="char-record">In ${ledgers.length} ledger${ledgers.length === 1 ? '' : 's'} · overall ${lines.join(', ')}</p>`;
  };

  openSheet(`
    <div class="sheet-head"><h2>${existing ? esc(existing.name) : 'New character'}</h2>${closeButton}</div>
    <div class="char-hero">
      <span class="ava xl" id="ch-face" style="--c:${INKS[person.avatar.ink]}">${avatarSvg(person.avatar)}</span>
      <button type="button" class="btn sm" id="ch-shuffle">Shuffle</button>
    </div>
    ${record()}
    <div class="field"><label for="ch-name">Name</label><input id="ch-name" class="input" maxlength="40" value="${esc(person.name)}" placeholder="Name" autocomplete="off"></div>
    <label class="check"><input type="checkbox" id="ch-me" ${store.db.myId === person.id ? 'checked' : ''}> This is me</label>
    <div id="ch-parts">${order.map(key => `<div class="field"><label>${labels[key]}</label>${optionsHtml(key)}</div>`).join('')}</div>
    <p class="form-error" id="ch-error" aria-live="polite"></p>
    <div class="sheet-actions">
      ${existing ? '<button class="btn danger" id="ch-delete">Remove</button>' : ''}
      <button class="btn primary grow" id="ch-save">${existing ? 'Save character' : 'Add to crew'}</button>
    </div>
  `, el => {
    const paint = () => {
      const face = $('#ch-face', el);
      face.innerHTML = avatarSvg(person.avatar);
      face.style.setProperty('--c', INKS[person.avatar.ink]);
      $('#ch-parts', el).innerHTML = order.map(key => `<div class="field"><label>${labels[key]}</label>${optionsHtml(key)}</div>`).join('');
    };
    $('#ch-parts', el).addEventListener('click', event => {
      const option = event.target.closest('[data-value]');
      const group = option?.closest('[data-part]');
      if (!option || !group) return;
      const key = group.dataset.part;
      person.avatar[key] = COLOR_PARTS[key] ? Number(option.dataset.value) : option.dataset.value;
      haptic(8);
      paint();
    });
    $('#ch-shuffle', el).addEventListener('click', () => {
      person.avatar = shuffleAvatar();
      const face = $('#ch-face', el);
      face.classList.remove('spin');
      void face.offsetWidth;
      face.classList.add('spin');
      haptic(15);
      paint();
    });
    $('#ch-save', el).addEventListener('click', async () => {
      const name = $('#ch-name', el).value.trim().replace(/\s+/g, ' ').slice(0, 40);
      if (!name) {
        $('#ch-error', el).textContent = 'Give them a name.';
        return shake($('#ch-name', el));
      }
      const clash = crewList().find(p => p.id !== person.id && p.name.toLowerCase() === name.toLowerCase());
      if (clash) {
        $('#ch-error', el).textContent = `${clash.name} is already in your crew.`;
        return shake($('#ch-name', el));
      }
      const isMe = $('#ch-me', el).checked;
      store.update(db => {
        savePerson(db, { ...person, name, at: nextStamp(existing?.at) });
        if (isMe) db.myId = person.id;
        else if (db.myId === person.id) db.myId = null;
      });
      await closeSheet();
      toast(existing ? `Saved ${name}` : `${name} joined your crew`);
    });
    $('#ch-delete', el)?.addEventListener('click', async event => {
      if (!armed) {
        armed = true;
        event.currentTarget.textContent = 'Tap again to remove';
        setTimeout(() => { armed = false; }, 4000);
        return;
      }
      const backup = store.db.crew[person.id];
      store.update(db => {
        delete db.crew[person.id];
        if (db.myId === person.id) db.myId = null;
      });
      await closeSheet();
      toast(`Removed ${backup.name} from your crew. Ledgers keep them.`, { action: 'Undo', onAction: () => store.update(db => { db.crew[backup.id] = backup; }) });
    });
  });
}

function sheetExpense(partyId, expenseId = null) {
  const party = store.party(partyId);
  const members = live(party.members);
  if (!members.length) return toast('Add some people first');
  const existing = expenseId ? party.expenses[expenseId] : null;
  const symbol = currency(party.currency).symbol;
  const fmt = minor => money(party, minor);
  const label = m => nameOf(party, m.id);
  const allIds = members.map(m => m.id);
  const toText = minor => (minor ? String(minor / 100) : '');

  const draft = {
    title: existing?.title ?? '',
    amountText: existing ? toText(existing.amount) : '',
    date: existing?.date ?? todayISO(),
    payMode: 'single',
    payer: meOf(party) || allIds[0],
    payAmounts: {},
    mode: existing?.split.mode === 'equal' ? 'equal' : existing ? 'exact' : 'equal',
    included: new Set(allIds),
    exact: {},
  };
  if (existing) {
    const payers = Object.entries(existing.paidBy).filter(([, v]) => v > 0);
    if (payers.length > 1) {
      draft.payMode = 'multi';
      draft.payAmounts = Object.fromEntries(payers.map(([id, v]) => [id, toText(v)]));
    } else if (payers.length === 1) {
      draft.payer = payers[0][0];
    }
    if (draft.mode === 'equal') {
      const weights = existing.split.weights;
      draft.included = new Set(Object.keys(weights).filter(id => weights[id] > 0));
    } else {
      // Exact entries, plus older weighted ones, open as exact amounts.
      draft.exact = Object.fromEntries(Object.entries(expenseShares(existing, party.currency)).map(([id, v]) => [id, toText(v)]));
    }
  }
  let attempted = false;

  const payerHtml = () => draft.payMode === 'single'
    ? `<div class="chip-row">${members.map(m => `<button type="button" class="chip with-face ${m.id === draft.payer ? 'on' : ''}" data-payer="${esc(m.id)}">${monogram(m, 'xs')}${esc(label(m))}</button>`).join('')}
        <button type="button" class="chip ghost" data-paymode="multi">Several people</button></div>`
    : `<div class="split-list">${members.map(m => `
        <label class="split-row">${monogram(m, 'sm')}<span class="grow">${esc(label(m))}</span>
          <span class="mini-cur">${esc(symbol)}</span><input class="input mini" inputmode="decimal" data-payamt="${esc(m.id)}" value="${esc(draft.payAmounts[m.id] ?? '')}" placeholder="0" autocomplete="off">
        </label>`).join('')}</div>
       <div class="split-foot"><span id="ex-pay-left"></span><button type="button" class="link" data-paymode="single">One person paid</button></div>`;

  const splitHtml = () => {
    if (draft.mode === 'equal') {
      const everyone = draft.included.size === members.length;
      return `<div class="chip-row">${members.map(m => `<button type="button" class="chip with-face ${draft.included.has(m.id) ? 'on' : ''}" data-inc="${esc(m.id)}">${monogram(m, 'xs')}${esc(label(m))}</button>`).join('')}</div>
        <div class="split-foot"><span id="ex-preview"></span><button type="button" class="link" data-incall="${everyone ? 'none' : 'all'}">${everyone ? 'Clear all' : 'Everyone'}</button></div>`;
    }
    return `<div class="split-list">${members.map(m => `
      <label class="split-row">${monogram(m, 'sm')}<span class="grow">${esc(label(m))}</span>
        <span class="mini-cur">${esc(symbol)}</span><input class="input mini" inputmode="decimal" data-exact="${esc(m.id)}" value="${esc(draft.exact[m.id] ?? '')}" placeholder="0" autocomplete="off">
      </label>`).join('')}</div>
      <div class="split-foot"><span id="ex-exact-left"></span></div>`;
  };

  const sum = values => values.reduce((total, v) => total + (v || 0), 0);

  function compute() {
    const amount = evaluateAmount(draft.amountText);
    const errors = [];
    if (!(amount > 0)) errors.push('Enter how much it cost.');
    const paidBy = {};
    if (draft.payMode === 'single') {
      paidBy[draft.payer] = amount || 0;
    } else {
      for (const [id, value] of Object.entries(draft.payAmounts)) {
        const paid = evaluateAmount(value);
        if (paid > 0) paidBy[id] = paid;
      }
      const paidTotal = sum(Object.values(paidBy));
      if (amount > 0 && paidTotal !== amount) {
        errors.push(`The payers add up to ${fmt(paidTotal)}, which is ${fmt(Math.abs(amount - paidTotal))} ${paidTotal < amount ? 'short' : 'too much'}.`);
      }
    }
    const weights = {};
    if (draft.mode === 'equal') {
      draft.included.forEach(id => { weights[id] = 1; });
      if (!draft.included.size) errors.push('Pick at least one person to split with.');
    } else {
      for (const id of allIds) {
        const value = evaluateAmount(draft.exact[id]);
        if (value > 0) weights[id] = value;
      }
      const assigned = sum(Object.values(weights));
      if (amount > 0 && assigned !== amount) errors.push(`The split adds up to ${fmt(assigned)}, not ${fmt(amount)}.`);
    }
    return { amount, paidBy, split: { mode: draft.mode, weights }, errors };
  }

  openSheet(`
    <div class="sheet-head"><h2>${existing ? 'Edit entry' : 'New entry'}</h2>${closeButton}</div>
    <div class="amount-box" id="ex-amount-box">
      <span class="amount-cur">${esc(symbol)}</span>
      <input id="ex-amount" class="amount-input" inputmode="decimal" placeholder="0.00" value="${esc(draft.amountText)}" autocomplete="off" aria-label="Amount">
    </div>
    <div class="calc-row">
      <span id="ex-eval" class="calc-eval"></span>
      <span class="calc-keys">${['+', '−', '×', '÷'].map(k => `<button type="button" class="calc-key" data-key="${k}" aria-label="Insert ${k}">${k}</button>`).join('')}</span>
    </div>
    <div class="field"><label for="ex-title">Particulars</label><input id="ex-title" class="input" maxlength="60" placeholder="Biryani, 2 kg" value="${esc(draft.title)}" autocomplete="off"></div>
    <div class="field"><label>Paid by</label><div id="ex-payer">${payerHtml()}</div></div>
    <div class="field"><label>Split</label>
      <div class="seg" id="ex-mode">${[['equal', 'Equally'], ['exact', 'Exact amounts']].map(([id, text]) => `<button type="button" class="seg-btn ${draft.mode === id ? 'on' : ''}" data-mode="${id}">${text}</button>`).join('')}</div>
      <div id="ex-split">${splitHtml()}</div>
    </div>
    <div class="field inline-field"><label for="ex-date">Date</label><input type="date" id="ex-date" class="input" value="${esc(draft.date)}"></div>
    <p class="form-error" id="ex-error" aria-live="polite"></p>
    <div class="sheet-actions">
      ${existing ? '<button class="btn danger" id="ex-delete">Delete</button>' : ''}
      <button class="btn primary grow" id="ex-save">${existing ? 'Save changes' : 'Add entry'}</button>
    </div>
  `, el => {
    const amountInput = $('#ex-amount', el);
    const find = selector => el.querySelector(selector);

    function refresh() {
      const result = compute();
      find('#ex-eval').textContent = hasOperator(draft.amountText) && result.amount > 0 ? `= ${fmt(result.amount)}` : '';
      if (draft.mode === 'equal') {
        const parts = result.amount > 0 && draft.included.size
          ? Object.values(expenseShares({ amount: result.amount, split: result.split }, party.currency))
          : [];
        const low = Math.min(...parts);
        const high = Math.max(...parts);
        find('#ex-preview').textContent = parts.length ? `${fmt(low)}${high !== low ? `–${fmt(high)}` : ''} each` : '';
      } else {
        const left = (result.amount || 0) - sum(Object.values(result.split.weights));
        find('#ex-exact-left').textContent = !result.amount ? '' : left === 0 ? 'Adds up' : left > 0 ? `${fmt(left)} left to assign` : `${fmt(-left)} too much`;
      }
      if (draft.payMode === 'multi') {
        const left = (result.amount || 0) - sum(Object.values(result.paidBy));
        find('#ex-pay-left').textContent = !result.amount ? '' : left === 0 ? 'Adds up' : left > 0 ? `${fmt(left)} not covered` : `${fmt(-left)} too much`;
      }
      find('#ex-error').textContent = attempted ? result.errors[0] ?? '' : '';
      return result;
    }

    el.addEventListener('input', event => {
      const t = event.target;
      if (t === amountInput) draft.amountText = t.value;
      else if (t.id === 'ex-title') draft.title = t.value;
      else if (t.id === 'ex-date') draft.date = t.value;
      else if (t.dataset.payamt) draft.payAmounts[t.dataset.payamt] = t.value;
      else if (t.dataset.exact) draft.exact[t.dataset.exact] = t.value;
      refresh();
    });

    // Keep the keyboard open while tapping calculator keys.
    el.addEventListener('pointerdown', event => {
      if (event.target.closest('.calc-key')) event.preventDefault();
    });

    el.addEventListener('click', event => {
      const b = event.target.closest('button');
      if (!b) return;
      const { dataset } = b;
      if (dataset.key) {
        const op = { '+': '+', '−': '-', '×': '*', '÷': '/' }[dataset.key];
        const start = amountInput.selectionStart ?? amountInput.value.length;
        const end = amountInput.selectionEnd ?? start;
        amountInput.value = amountInput.value.slice(0, start) + op + amountInput.value.slice(end);
        amountInput.focus();
        amountInput.setSelectionRange(start + 1, start + 1);
        draft.amountText = amountInput.value;
      } else if (dataset.payer) {
        draft.payer = dataset.payer;
        find('#ex-payer').innerHTML = payerHtml();
      } else if (dataset.paymode) {
        draft.payMode = dataset.paymode;
        if (draft.payMode === 'multi' && !Object.keys(draft.payAmounts).length) {
          draft.payAmounts = { [draft.payer]: draft.amountText ? toText(evaluateAmount(draft.amountText) || 0) : '' };
        }
        find('#ex-payer').innerHTML = payerHtml();
      } else if (dataset.mode) {
        draft.mode = dataset.mode;
        el.querySelectorAll('#ex-mode .seg-btn').forEach(o => o.classList.toggle('on', o === b));
        find('#ex-split').innerHTML = splitHtml();
      } else if (dataset.inc) {
        if (draft.included.has(dataset.inc)) draft.included.delete(dataset.inc);
        else draft.included.add(dataset.inc);
        find('#ex-split').innerHTML = splitHtml();
      } else if (dataset.incall) {
        draft.included = new Set(dataset.incall === 'all' ? allIds : []);
        find('#ex-split').innerHTML = splitHtml();
      } else {
        return;
      }
      refresh();
    });

    $('#ex-save', el).addEventListener('click', async () => {
      attempted = true;
      const result = refresh();
      if (result.errors.length) {
        shake(find(result.amount > 0 ? '#ex-error' : '#ex-amount-box'));
        return;
      }
      const title = (draft.title.trim() || 'Bill').slice(0, 60);
      const id = existing?.id ?? uid();
      store.update(db => {
        const target = db.parties[partyId];
        const previous = target.expenses[id];
        const now = Date.now();
        target.expenses[id] = {
          id,
          title,
          amount: result.amount,
          date: draft.date || todayISO(),
          paidBy: result.paidBy,
          split: result.split,
          createdAt: previous?.createdAt ?? now,
          at: nextStamp(previous?.at),
        };
      });
      haptic(15);
      await closeSheet();
      if (existing) return toast('Entry updated');
      // Prepare the link now so "Post to group" can open WhatsApp straight from the tap.
      const saved = store.party(partyId);
      const link = await linkFor(saved);
      toast(`Added ${title}: ${fmt(result.amount)}`, {
        action: 'Post to group',
        duration: 7000,
        onAction: () => openWhatsApp(entryText(saved, saved.expenses[id], link)),
      });
    });

    $('#ex-delete', el)?.addEventListener('click', async () => {
      setDeleted(partyId, 'expenses', existing.id, true);
      await closeSheet();
      toast(`Deleted ${existing.title}`, { action: 'Undo', onAction: () => setDeleted(partyId, 'expenses', existing.id, false) });
    });

    refresh();
    if (!existing) setTimeout(() => amountInput.focus(), 280);
  });
}

function setDeleted(partyId, key, id, deleted) {
  store.update(db => {
    const item = db.parties[partyId]?.[key][id];
    if (!item) return;
    if (deleted) item.deleted = true;
    else delete item.deleted;
    item.at = nextStamp(item.at);
  });
}

function sheetMembers(partyId) {
  const rows = () => {
    const party = store.party(partyId);
    const me = meOf(party);
    return live(party.members).map(m => `
      <div class="split-row">
        <button type="button" class="mono-btn" data-face="${esc(m.id)}" aria-label="Edit ${esc(m.name)}’s character">${monogram(m)}</button>
        <button type="button" class="member-name" data-face="${esc(m.id)}">${esc(m.name)}</button>
        ${m.id === me ? '<span class="tag">you</span>' : `<button type="button" class="chip small" data-isme="${esc(m.id)}">This is me</button>`}
        <button type="button" class="icon-btn sm" data-remove="${esc(m.id)}" aria-label="Remove ${esc(m.name)}">${ICON.close}</button>
      </div>`).join('');
  };
  const crewChips = () => {
    const party = store.party(partyId);
    const missing = crewList().filter(p => !party.members[p.id] || party.members[p.id].deleted);
    return missing.length
      ? `<div class="field"><label>Add from your crew</label><div class="chip-row">${missing.map(p => `<button type="button" class="chip with-face" data-addp="${esc(p.id)}">${monogram(p, 'xs')}${esc(p.name)}</button>`).join('')}</div></div>`
      : '';
  };

  openSheet(`
    <div class="sheet-head"><h2>People</h2>${closeButton}</div>
    <div class="split-list" id="mem-list">${rows()}</div>
    <div id="mem-crew">${crewChips()}</div>
    <div class="add-row">
      <input id="mem-new" class="input" placeholder="Someone new" maxlength="40" autocomplete="off">
      <button class="btn primary" id="mem-add">Add</button>
    </div>
    <small class="help">Tap a face to change someone’s character.</small>
  `, el => {
    const list = $('#mem-list', el);
    const redraw = () => {
      list.innerHTML = rows();
      $('#mem-crew', el).innerHTML = crewChips();
    };

    const addPerson = person => {
      store.update(db => {
        const target = db.parties[partyId];
        const previous = target.members[person.id];
        target.members[person.id] = { ...memberFromPerson(person), createdAt: previous?.createdAt ?? Date.now(), at: nextStamp(previous?.at) };
      });
      redraw();
      toast(`Added ${person.name}`);
    };

    function addNew() {
      const input = $('#mem-new', el);
      const [name] = parseNames(input.value);
      const party = store.party(partyId);
      if (!name || live(party.members).some(m => m.name.toLowerCase() === name.toLowerCase())) return shake(input);
      const person = crewList().find(p => p.name.toLowerCase() === name.toLowerCase()) || makePerson(name);
      store.update(db => { if (!db.crew[person.id]) db.crew[person.id] = person; });
      input.value = '';
      addPerson(person);
    }

    $('#mem-add', el).addEventListener('click', addNew);
    $('#mem-new', el).addEventListener('keydown', event => { if (event.key === 'Enter') addNew(); });
    $('#mem-crew', el).addEventListener('click', event => {
      const chip = event.target.closest('[data-addp]');
      if (chip) addPerson(store.db.crew[chip.dataset.addp]);
    });

    list.addEventListener('click', async event => {
      const b = event.target.closest('button');
      if (!b) return;
      const { remove, isme, face } = b.dataset;
      if (face) {
        // People from older ledgers become crew characters the first time they're edited.
        const member = store.party(partyId).members[face];
        if (!store.db.crew[face]) {
          store.update(db => { db.crew[face] = { id: face, name: member.name, avatar: member.avatar || avatarFromSeed(face + member.name), createdAt: Date.now(), at: 0 }; });
        }
        sheetCharacter(face);
      } else if (isme) {
        store.update(db => {
          db.me[partyId] = isme;
          if (db.crew[isme]) db.myId = isme;
        });
        redraw();
      } else if (remove) {
        const party = store.party(partyId);
        const member = party.members[remove];
        if (memberInUse(party, remove)) {
          toast(`${member.name} is on some entries. Remove them from those first.`);
          return;
        }
        setDeleted(partyId, 'members', remove, true);
        redraw();
        toast(`Removed ${member.name}`, { action: 'Undo', onAction: () => { setDeleted(partyId, 'members', remove, false); if (sheet) redraw(); } });
      }
    });
  });
}

async function sheetShare(partyId) {
  const party = store.party(partyId);
  const stats = partyStats(party);
  const plan = settlePlan(stats.net);
  const link = await linkFor(party);
  const text = summaryText(party, stats, plan, link);
  openSheet(`
    <div class="sheet-head"><h2>Share this ledger</h2>${closeButton}</div>
    <p class="muted">Friends open the link to see the ledger and add their own entries. When someone sends a link back, open it and the changes merge.</p>
    <button class="btn wa block" id="sh-wa">${ICON.chat} Post summary to WhatsApp group</button>
    <div class="share-grid">
      ${navigator.share ? '<button class="btn" id="sh-native">Share…</button>' : ''}
      <button class="btn" id="sh-copy">Copy link</button>
      <button class="btn" id="sh-text">Copy summary</button>
      <button class="btn" id="sh-backup">Download backup</button>
    </div>
    <details class="preview"><summary>Preview the message</summary><pre>${esc(text)}</pre></details>
    <small class="help">The ledger travels inside the link itself, so it never touches a server.</small>
  `, el => {
    $('#sh-wa', el).addEventListener('click', () => openWhatsApp(text));
    $('#sh-native', el)?.addEventListener('click', () => {
      navigator.share({ title: party.name, text: summaryText(party, stats, plan, ''), url: link }).catch(() => {});
    });
    $('#sh-copy', el).addEventListener('click', async () => toast((await copyText(link)) ? 'Link copied' : 'Couldn’t copy. Try the WhatsApp button.'));
    $('#sh-text', el).addEventListener('click', async () => toast((await copyText(text)) ? 'Summary copied' : 'Couldn’t copy. Try the WhatsApp button.'));
    $('#sh-backup', el).addEventListener('click', () => {
      downloadJson(`hishab-${slug(party.name)}.json`, { app: 'hishab', version: 1, exportedAt: new Date().toISOString(), parties: [party] });
    });
  });
}

function sheetPartySettings(partyId) {
  const party = store.party(partyId);
  let armed = false;
  openSheet(`
    <div class="sheet-head"><h2>Ledger settings</h2>${closeButton}</div>
    <div class="field"><label for="ps-name">Name</label><input id="ps-name" class="input" maxlength="40" value="${esc(party.name)}"></div>
    <div class="field"><label>Cover</label><div class="swatches" id="ps-cover">${coverOptions(party.cover || 'red')}</div></div>
    <div class="field"><label for="ps-cur">Currency</label><select id="ps-cur" class="input">${currencyOptions(party.currency)}</select><small class="help">This changes the symbol only. Nothing gets converted.</small></div>
    <button class="btn primary block" id="ps-save">Save</button>
    <button class="btn block" data-act="members">Manage people</button>
    <div class="danger-zone"><button class="btn danger block" id="ps-delete">Delete ledger from this phone</button></div>
  `, el => {
    const chosenCover = pickCover(el, '#ps-cover');
    $('#ps-save', el).addEventListener('click', async () => {
      const name = $('#ps-name', el).value.trim();
      if (!name) return shake($('#ps-name', el));
      store.update(db => {
        const target = db.parties[partyId];
        Object.assign(target, { name, cover: chosenCover() || target.cover || 'red', currency: $('#ps-cur', el).value, at: nextStamp(target.at) });
      });
      await closeSheet();
      toast('Saved');
    });
    $('#ps-delete', el).addEventListener('click', async event => {
      if (!armed) {
        armed = true;
        event.currentTarget.textContent = 'Tap again to delete for good';
        setTimeout(() => { armed = false; }, 4000);
        return;
      }
      const backup = store.party(partyId);
      const meBackup = store.db.me[partyId];
      store.update(db => {
        delete db.parties[partyId];
        delete db.me[partyId];
      });
      await closeSheet();
      location.hash = '/';
      toast(`Deleted ${backup.name}`, {
        action: 'Undo',
        onAction: () => store.update(db => { db.parties[partyId] = backup; db.me[partyId] = meBackup; }),
      });
    });
  });
}

function sheetPayment(partyId, paymentId) {
  const party = store.party(partyId);
  const payment = party.payments[paymentId];
  openSheet(`
    <div class="sheet-head"><h2>Payment</h2>${closeButton}</div>
    <div class="receipt">
      <p><b>${esc(nameOf(party, payment.from))}</b> paid <b>${esc(objectName(party, payment.to))}</b></p>
      <p class="receipt-amt">${money(party, payment.amount)}</p>
      <p class="muted">${prettyDate(payment.date)}</p>
      <span class="stamp big" aria-hidden="true">Paid</span>
    </div>
    <button class="btn danger block" id="pay-del">Delete this payment</button>
  `, el => {
    $('#pay-del', el).addEventListener('click', async () => {
      setDeleted(partyId, 'payments', paymentId, true);
      await closeSheet();
      toast('Payment deleted', { action: 'Undo', onAction: () => setDeleted(partyId, 'payments', paymentId, false) });
    });
  });
}

function sheetRecordPayment(partyId) {
  const party = store.party(partyId);
  const members = live(party.members);
  const payer = meOf(party) || members[0]?.id;
  const options = selected => members.map(m => `<option value="${esc(m.id)}" ${m.id === selected ? 'selected' : ''}>${esc(nameOf(party, m.id))}</option>`).join('');
  openSheet(`
    <div class="sheet-head"><h2>Record a payment</h2>${closeButton}</div>
    <div class="field"><label for="rp-from">Who paid</label><select id="rp-from" class="input">${options(payer)}</select></div>
    <div class="field"><label for="rp-to">To whom</label><select id="rp-to" class="input">${options(members.find(m => m.id !== payer)?.id)}</select></div>
    <div class="field"><label for="rp-amount">How much (${esc(symbolOf(party))})</label><input id="rp-amount" class="input" inputmode="decimal" placeholder="0.00" autocomplete="off"></div>
    <p class="form-error" id="rp-error" aria-live="polite"></p>
    <button class="btn primary block" id="rp-save">Record payment</button>
  `, el => {
    $('#rp-save', el).addEventListener('click', async () => {
      const from = $('#rp-from', el).value;
      const to = $('#rp-to', el).value;
      const amount = evaluateAmount($('#rp-amount', el).value);
      const error = $('#rp-error', el);
      if (from === to) { error.textContent = 'Pick two different people.'; return shake($('#rp-to', el)); }
      if (!(amount > 0)) { error.textContent = 'Enter an amount.'; return shake($('#rp-amount', el)); }
      recordPayment(partyId, from, to, amount);
      await closeSheet();
    });
  });
}

function recordPayment(partyId, from, to, amount) {
  const id = uid();
  const now = Date.now();
  store.update(db => {
    db.parties[partyId].payments[id] = { id, from, to, amount, date: todayISO(), createdAt: now, at: now };
  });
  haptic(20);
  const party = store.party(partyId);
  const undo = { action: 'Undo', onAction: () => setDeleted(partyId, 'payments', id, true) };
  const settled = !settlePlan(partyStats(party).net).length;
  toast(settled ? 'Recorded. Everyone is settled up.' : `Recorded: ${nameOf(party, from)} paid ${objectName(party, to)} ${money(party, amount)}`, undo);
}

function sheetImport(incoming) {
  const existing = store.party(incoming.id);
  const stats = partyStats(incoming);
  const members = live(incoming.members);
  openSheet(`
    <div class="import">
      ${bookHtml(incoming, { interactive: false })}
      <p class="muted">${members.length} people · ${stats.count} entries · ${money(incoming, stats.total)}</p>
    </div>
    <p class="center">${existing ? 'You already have this ledger. Their changes will be merged into yours; nothing is lost.' : 'Someone shared this ledger with you.'}</p>
    <button class="btn primary block" id="im-go">${existing ? 'Merge changes' : 'Add to my ledgers'}</button>
    <button class="btn ghost block" data-act="close-sheet">Not now</button>
    ${isIOS && !isStandalone ? '<small class="help center">Using the installed app? Copy this link, open Hishab, and use “Open a ledger someone sent you”.</small>' : ''}
  `, el => {
    $('#im-go', el).addEventListener('click', async () => {
      let changed = 0;
      store.update(db => {
        const local = db.parties[incoming.id];
        if (local) {
          const merged = mergeParty(local, incoming);
          db.parties[incoming.id] = merged.party;
          changed = merged.changed;
        } else {
          db.parties[incoming.id] = incoming;
        }
        adoptMembers(db, db.parties[incoming.id]);
      });
      await closeSheet();
      location.hash = `/party/${incoming.id}`;
      toast(!existing ? 'Ledger added' : changed ? `Merged ${changed} change${changed === 1 ? '' : 's'}` : 'Already up to date');
    });
  });
}

async function openJoinCode(code) {
  try {
    sheetImport(sanitizeParty(await decodeParty(code)));
  } catch {
    toast('That link looks broken. Ask for a fresh one.');
  }
}

async function handleJoinLink() {
  const code = extractJoinCode(location.hash);
  if (!code) return false;
  history.replaceState(null, '', location.pathname + location.search);
  render();
  await openJoinCode(code);
  return true;
}

function sheetPasteLink() {
  openSheet(`
    <div class="sheet-head"><h2>Open a shared ledger</h2>${closeButton}</div>
    <textarea id="pl-input" class="input" rows="3" placeholder="Paste the link here"></textarea>
    <p class="form-error" id="pl-error" aria-live="polite"></p>
    <div class="sheet-actions">
      ${navigator.clipboard?.readText ? '<button class="btn" id="pl-paste">Paste</button>' : ''}
      <button class="btn primary grow" id="pl-open">Open</button>
    </div>
  `, el => {
    const input = $('#pl-input', el);
    $('#pl-paste', el)?.addEventListener('click', async () => {
      try { input.value = await navigator.clipboard.readText(); } catch { input.focus(); }
    });
    $('#pl-open', el).addEventListener('click', async () => {
      const code = extractJoinCode(input.value);
      if (!code) {
        $('#pl-error', el).textContent = 'That doesn’t look like a Hishab link.';
        return shake(input);
      }
      await closeSheet();
      openJoinCode(code);
    });
  });
}

function sheetInstallHelp() {
  const steps = isIOS
    ? ['Open this page in <b>Safari</b>', 'Tap the <b>Share</b> button', 'Choose <b>Add to Home Screen</b>', 'Tap <b>Add</b>']
    : ['Open your browser menu', 'Tap <b>Install app</b> or <b>Add to Home screen</b>', 'Confirm'];
  openSheet(`
    <div class="sheet-head"><h2>Install Hishab</h2>${closeButton}</div>
    <ol class="steps">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
    <p class="muted">It opens full-screen like any other app and works offline.</p>
  `);
}

function sheetAppMenu() {
  openSheet(`
    <div class="sheet-head"><h2>Menu</h2>${closeButton}</div>
    <div class="menu">
      <button class="menu-item" id="m-paste">Open a shared ledger</button>
      <button class="menu-item" id="m-backup">Back up all ledgers</button>
      <label class="menu-item">Restore from a backup file<input type="file" id="m-restore" accept="application/json,.json" hidden></label>
      ${isStandalone ? '' : '<button class="menu-item" id="m-install">Install the app</button>'}
    </div>
    <p class="about">Hishab keeps your ledgers on this device. Nothing leaves it unless you share a link.</p>
  `, el => {
    $('#m-paste', el).addEventListener('click', sheetPasteLink);
    $('#m-install', el)?.addEventListener('click', () => actions.install());
    $('#m-backup', el).addEventListener('click', () => {
      const parties = Object.values(store.db.parties);
      if (!parties.length) return toast('Nothing to back up yet');
      downloadJson(`hishab-backup-${todayISO()}.json`, { app: 'hishab', version: 1, exportedAt: new Date().toISOString(), parties });
    });
    $('#m-restore', el).addEventListener('change', async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const incoming = (Array.isArray(data?.parties) ? data.parties : [data]).map(sanitizeParty);
        store.update(db => {
          for (const party of incoming) {
            const local = db.parties[party.id];
            db.parties[party.id] = local ? mergeParty(local, party).party : party;
          }
        });
        await closeSheet();
        toast(`Restored ${incoming.length} ledger${incoming.length === 1 ? '' : 's'}`);
      } catch {
        toast('That file isn’t a Hishab backup.');
      }
    });
  });
}

// ---------- actions ----------

const actions = {
  'close-sheet': () => closeSheet(),
  home: () => { location.hash = '/'; },
  'open-party': el => {
    const go = () => { location.hash = `/party/${el.dataset.id}`; };
    if (reducedMotion()) return go();
    el.classList.add('opening');
    haptic(10);
    setTimeout(go, 430);
  },
  'new-party': () => sheetNewParty(),
  tab: el => {
    history.replaceState(null, '', `#/party/${route.id}/${el.dataset.tab}`);
    render();
  },
  'add-expense': () => sheetExpense(route.id),
  'edit-expense': el => sheetExpense(route.id, el.dataset.id),
  members: () => sheetMembers(route.id),
  share: () => sheetShare(route.id),
  'post-group': () => {
    const party = store.party(route.id);
    const stats = partyStats(party);
    withLink(party, link => openWhatsApp(summaryText(party, stats, settlePlan(stats.net), link)));
  },
  'party-settings': () => sheetPartySettings(route.id),
  payment: el => sheetPayment(route.id, el.dataset.id),
  'record-payment': () => sheetRecordPayment(route.id),
  'set-me': el => store.update(db => {
    db.me[route.id] = el.dataset.id;
    if (!db.myId && db.crew[el.dataset.id]) db.myId = el.dataset.id;
  }),
  character: el => sheetCharacter(el.dataset.id || null),
  'pick-me': el => {
    store.update(db => { db.myId = el.dataset.id; });
    haptic(20);
    toast(`You’re ${store.db.crew[el.dataset.id].name}. Tap anyone to change their look.`);
  },
  // The PAID stamp comes down on the line first, then the payment is recorded.
  'mark-paid': el => {
    const partyId = route.id;
    const commit = () => recordPayment(partyId, el.dataset.from, el.dataset.to, Number(el.dataset.amount));
    const row = el.closest('.transfer');
    if (!row || reducedMotion()) return commit();
    row.querySelectorAll('button').forEach(b => { b.disabled = true; });
    row.insertAdjacentHTML('beforeend', '<span class="stamp thump" aria-hidden="true">Paid</span>');
    row.classList.add('stamped');
    setTimeout(() => haptic(35), 230);
    setTimeout(commit, 800);
  },
  nudge: el => {
    const party = store.party(route.id);
    openWhatsApp(nudgeText(party, { from: el.dataset.from, to: el.dataset.to, amount: Number(el.dataset.amount) }));
  },
  'paste-link': () => sheetPasteLink(),
  'app-menu': () => sheetAppMenu(),
  theme: () => {
    store.update(db => { db.theme = { auto: 'dark', dark: 'light', light: 'auto' }[db.theme] || 'auto'; });
    toast({ auto: 'Theme follows your phone', dark: 'Dark theme', light: 'Light theme' }[store.db.theme]);
  },
  install: async () => {
    if (!installPrompt) return sheetInstallHelp();
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null;
    render();
    if (outcome === 'accepted') toast('Installed. Look for it on your home screen.');
  },
  'dismiss-install': () => store.update(db => { db.installDismissed = true; }),
};

document.addEventListener('click', event => {
  const el = event.target.closest('[data-act]');
  const action = el && actions[el.dataset.act];
  if (!action) return;
  event.preventDefault();
  action(el, event);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && sheet) closeSheet();
});

// Books lean toward the finger (or mouse) that's on them.
let tiltedBook = null;

function resetTilt() {
  tiltedBook?.style.removeProperty('--tilt-x');
  tiltedBook?.style.removeProperty('--tilt-y');
  tiltedBook = null;
}

function tiltBook(event) {
  const book = event.target.closest?.('.book:not(.book-new):not(.static)');
  if (book !== tiltedBook) resetTilt();
  if (!book || reducedMotion()) return;
  const box = book.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width - 0.5;
  const y = (event.clientY - box.top) / box.height - 0.5;
  book.style.setProperty('--tilt-y', `${(x * 26).toFixed(1)}deg`);
  book.style.setProperty('--tilt-x', `${(-y * 20).toFixed(1)}deg`);
  tiltedBook = book;
}

document.addEventListener('pointermove', tiltBook);
document.addEventListener('pointerdown', tiltBook);
document.addEventListener('pointercancel', resetTilt);
document.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse') resetTilt(); });

// ---------- theme, install, boot ----------

function applyTheme() {
  const root = document.documentElement;
  if (store.db.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = store.db.theme;
  $('meta[name="theme-color"]').content = getComputedStyle(root).getPropertyValue('--cover-default').trim();
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  if (route.screen === 'home') render();
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  render();
});

window.addEventListener('hashchange', async () => {
  if (await handleJoinLink()) return;
  render();
});

store.subscribe(() => {
  applyTheme();
  render();
});

applyTheme();
render();
handleJoinLink();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
// Ask the browser not to evict our data when the phone is low on space.
navigator.storage?.persist?.().catch(() => {});
