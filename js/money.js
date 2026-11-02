// Money math. Amounts are integer minor units (1 taka = 100 poisha) so a split
// always adds back up to the bill exactly.

import { live } from './util.js';

export const CURRENCIES = {
  EUR: { symbol: '€', label: 'Euro (€)', decimals: 2, locale: 'en-US' },
  USD: { symbol: '$', label: 'US Dollar ($)', decimals: 2, locale: 'en-US' },
  GBP: { symbol: '£', label: 'British Pound (£)', decimals: 2, locale: 'en-GB' },
  CHF: { symbol: 'CHF ', label: 'Swiss Franc (CHF)', decimals: 2, locale: 'en-US' },
  CAD: { symbol: 'C$', label: 'Canadian Dollar (C$)', decimals: 2, locale: 'en-US' },
  AUD: { symbol: 'A$', label: 'Australian Dollar (A$)', decimals: 2, locale: 'en-US' },
  AED: { symbol: 'AED ', label: 'UAE Dirham (AED)', decimals: 2, locale: 'en-US' },
  SAR: { symbol: 'SAR ', label: 'Saudi Riyal (SAR)', decimals: 2, locale: 'en-US' },
  MYR: { symbol: 'RM', label: 'Malaysian Ringgit (RM)', decimals: 2, locale: 'en-US' },
  INR: { symbol: '₹', label: 'Indian Rupee (₹)', decimals: 0, locale: 'en-IN' },
  BDT: { symbol: '৳', label: 'Bangladeshi Taka (৳)', decimals: 0, locale: 'en-IN' },
  PKR: { symbol: 'Rs ', label: 'Pakistani Rupee (Rs)', decimals: 0, locale: 'en-IN' },
  NPR: { symbol: 'Rs ', label: 'Nepali Rupee (Rs)', decimals: 0, locale: 'en-IN' },
};

export const currency = code => CURRENCIES[code] || CURRENCIES.EUR;

// First-run guess from the phone's time zone; the group can change it per ledger.
export function defaultCurrency() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const byZone = {
    'Europe/London': 'GBP', 'Europe/Zurich': 'CHF', 'Asia/Dhaka': 'BDT', 'Asia/Kolkata': 'INR', 'Asia/Calcutta': 'INR',
    'Asia/Karachi': 'PKR', 'Asia/Kathmandu': 'NPR', 'Asia/Dubai': 'AED', 'Asia/Riyadh': 'SAR', 'Asia/Kuala_Lumpur': 'MYR',
  };
  if (byZone[zone]) return byZone[zone];
  if (zone.startsWith('Europe/')) return 'EUR';
  if (zone.startsWith('Australia/')) return 'AUD';
  if (zone.startsWith('America/')) return 'USD';
  return 'EUR';
}

// `symbol: false` gives a bare figure for ledger columns; `fixed` keeps the
// currency's decimals so a column of figures lines up.
export function formatMoney(minor, code, { sign = false, symbol = true, fixed = false } = {}) {
  const c = currency(code);
  const abs = Math.abs(Math.round(minor));
  const digits = fixed && c.decimals ? c.decimals : abs % 100 === 0 ? 0 : 2;
  const number = (abs / 100).toLocaleString(c.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const prefix = minor < 0 ? '−' : sign && minor > 0 ? '+' : '';
  return `${prefix}${symbol ? c.symbol : ''}${number}`;
}

// The amount field doubles as a calculator: "350*6 + 120" → 222000 minor units.
// Returns null for anything that isn't a valid expression.
export function evaluateAmount(text) {
  const src = String(text ?? '')
    .replace(/(\d),(\d{1,2})(?![\d,])/g, '$1.$2') // "8,50" is a decimal comma; "1,250" and "1,25,000" are grouping
    .replace(/,/g, '')
    .replace(/[×xX]/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .trim();
  if (!src) return null;
  let pos = 0;
  const skipSpaces = () => { while (src[pos] === ' ') pos += 1; };

  function number() {
    skipSpaces();
    const match = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(pos));
    if (!match) throw new Error('number expected');
    pos += match[0].length;
    return parseFloat(match[0]);
  }
  function factor() {
    skipSpaces();
    if (src[pos] === '(') {
      pos += 1;
      const value = expression();
      skipSpaces();
      if (src[pos] !== ')') throw new Error(') expected');
      pos += 1;
      return value;
    }
    if (src[pos] === '-') { pos += 1; return -factor(); }
    if (src[pos] === '+') { pos += 1; return factor(); }
    return number();
  }
  function term() {
    let value = factor();
    for (;;) {
      skipSpaces();
      const op = src[pos];
      if (op !== '*' && op !== '/') return value;
      pos += 1;
      const right = factor();
      value = op === '*' ? value * right : value / right;
    }
  }
  function expression() {
    let value = term();
    for (;;) {
      skipSpaces();
      const op = src[pos];
      if (op !== '+' && op !== '-') return value;
      pos += 1;
      const right = term();
      value = op === '+' ? value + right : value - right;
    }
  }

  try {
    const value = expression();
    skipSpaces();
    if (pos !== src.length || !Number.isFinite(value)) return null;
    return Math.round(value * 100);
  } catch {
    return null;
  }
}

export const hasOperator = text => /\d\s*[-+*/×÷xX−]\s*[\d.(]/.test(String(text ?? ''));

// Largest-remainder split: integer parts proportional to weights that add up
// to `total` exactly. `step` = 100 splits in whole taka/rupees.
export function allocate(total, weights, step = 1) {
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum <= 0) return weights.map(() => 0);
  const units = Math.round(total / step);
  const exact = weights.map(w => (units * w) / weightSum);
  const parts = exact.map(Math.floor);
  let leftover = units - parts.reduce((sum, p) => sum + p, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - parts[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let k = 0; leftover > 0; k += 1, leftover -= 1) parts[byRemainder[k % parts.length].index] += 1;
  return parts.map(part => part * step);
}

const splitStep = (total, code) => (currency(code).decimals === 0 && total % 100 === 0 ? 100 : 1);

// How much each person consumed from one expense: { memberId: minor }.
export function expenseShares(expense, code) {
  const { mode, weights } = expense.split;
  const ids = Object.keys(weights).filter(id => weights[id] > 0).sort();
  if (mode === 'exact') return Object.fromEntries(ids.map(id => [id, Math.round(weights[id])]));
  const parts = allocate(
    expense.amount,
    ids.map(id => (mode === 'equal' ? 1 : weights[id])),
    splitStep(expense.amount, code),
  );
  return Object.fromEntries(ids.map((id, i) => [id, parts[i]]));
}

// Splits every expense in a ledger at once, so odd cents don't pile up on
// one person: €3.33 between 4 leaves 1 cent over, and that cent goes to
// whoever has been rounded down the most so far. Everyone ends up within a
// cent of their exact share. Returns { expenseId: { memberId: minor } }.
export function ledgerShares(party) {
  const drift = {}; // per person: what they were charged minus their exact share, so far
  const result = {};
  const expenses = live(party.expenses).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : 1));
  for (const expense of expenses) {
    const { mode, weights } = expense.split;
    const ids = Object.keys(weights).filter(id => weights[id] > 0).sort();
    if (mode === 'exact') {
      result[expense.id] = Object.fromEntries(ids.map(id => [id, Math.round(weights[id])]));
      continue;
    }
    const step = splitStep(expense.amount, party.currency);
    const units = Math.round(expense.amount / step);
    const weightSum = ids.reduce((sum, id) => sum + (mode === 'equal' ? 1 : weights[id]), 0);
    const exact = ids.map(id => (units * (mode === 'equal' ? 1 : weights[id])) / weightSum);
    const parts = exact.map(value => Math.floor(value + 1e-9));
    let leftover = units - parts.reduce((sum, p) => sum + p, 0);
    const order = ids
      .map((id, i) => ({ i, remainder: exact[i] - parts[i], drift: drift[id] || 0 }))
      .sort((a, b) => (Math.abs(b.remainder - a.remainder) > 1e-9 ? b.remainder - a.remainder : a.drift - b.drift || a.i - b.i));
    for (let k = 0; leftover > 0; k += 1, leftover -= 1) parts[order[k % order.length].i] += 1;
    result[expense.id] = Object.fromEntries(ids.map((id, i) => {
      drift[id] = (drift[id] || 0) + (parts[i] - exact[i]) * step;
      return [id, parts[i] * step];
    }));
  }
  return result;
}

// One net number per person: positive = gets money back, negative = owes.
export function partyStats(party) {
  const net = {}, paid = {}, consumed = {}, sent = {};
  const bump = (map, id, amount) => { map[id] = (map[id] || 0) + amount; };
  for (const member of live(party.members)) {
    net[member.id] = 0; paid[member.id] = 0; consumed[member.id] = 0; sent[member.id] = 0;
  }
  let total = 0;
  let count = 0;
  const shares = ledgerShares(party);
  for (const expense of live(party.expenses)) {
    total += expense.amount;
    count += 1;
    for (const [id, amount] of Object.entries(expense.paidBy)) {
      bump(net, id, amount);
      bump(paid, id, amount);
    }
    for (const [id, amount] of Object.entries(shares[expense.id])) {
      bump(net, id, -amount);
      bump(consumed, id, amount);
    }
  }
  const owedTo = () => Object.values(net).reduce((sum, value) => sum + Math.max(0, value), 0);
  const debt = owedTo();
  for (const payment of live(party.payments)) {
    bump(net, payment.from, payment.amount);
    bump(net, payment.to, -payment.amount);
    bump(sent, payment.from, payment.amount);
  }
  // How much of what the bills created has been paid back, 0..1.
  const outstanding = owedTo();
  const progress = debt ? Math.min(1, Math.max(0, (debt - outstanding) / debt)) : 1;
  return { net, paid, consumed, sent, total, count, debt, outstanding, progress };
}

// "Who pays whom" with few transfers: settle exact matches first, then
// greedily match the biggest debtor with the biggest creditor (≤ n−1 transfers).
export function settlePlan(net) {
  const debtors = [];
  const creditors = [];
  for (const [id, value] of Object.entries(net)) {
    if (value < 0) debtors.push({ id, amount: -value });
    else if (value > 0) creditors.push({ id, amount: value });
  }
  const plan = [];
  for (const debtor of debtors) {
    const match = creditors.find(creditor => creditor.amount > 0 && creditor.amount === debtor.amount);
    if (match) {
      plan.push({ from: debtor.id, to: match.id, amount: debtor.amount });
      match.amount = 0;
      debtor.amount = 0;
    }
  }
  const biggest = list =>
    list.reduce((best, item) => (item.amount > (best?.amount ?? 0) || (item.amount === best?.amount && item.id < best.id) ? item : best), null);
  for (;;) {
    const debtor = biggest(debtors);
    const creditor = biggest(creditors);
    if (!debtor || !creditor) break;
    const amount = Math.min(debtor.amount, creditor.amount);
    plan.push({ from: debtor.id, to: creditor.id, amount });
    debtor.amount -= amount;
    creditor.amount -= amount;
  }
  return plan.sort((a, b) => b.amount - a.amount);
}
