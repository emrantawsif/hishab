# Splitwise teardown: what to keep, what to kill

A reverse-engineering pass over Splitwise, done before building Hishab: how it
works under the hood, what friends actually use, and where it hurts.

## 1. How Splitwise works

| Layer | What Splitwise does | What it really is |
|---|---|---|
| **Groups** | A group holds members, expenses and payments | A ledger that only appends |
| **Expense** | Cost, description, date, category, payer(s), split | One row: who *paid* and who *consumed* |
| **Split types** | Equally, exact amounts, percentages, shares, adjustments | Different ways to turn one total into per-person amounts |
| **Balances** | "You owe X / X owes you" | For each person: everything they paid − everything they consumed ± payments |
| **Simplify debts** | Fewer transfers in a group | Greedy matching of the biggest debtor with the biggest creditor |
| **Settle up** | Record a cash/bank payment | A payment is just an expense from A to B |
| **Sync** | Server accounts, every friend must sign up | Central database, login required |

The core insight: **every feature reduces to one number per person (net
balance)**. Expenses push it up for payers and down for consumers. Payments
move money between two people. "Who pays whom" is computed from the nets alone.

### Rounding trick worth copying
Splitwise never loses a poisha. When ৳1000 is split 3 ways, someone pays ৳334 and
two pay ৳333. We use the **largest-remainder method** on integer minor units and
split in whole taka when the bill is in whole taka.

### Debt simplification
Finding the smallest possible number of transfers is NP-hard in general. The
greedy approach (match the largest debtor with the largest creditor and repeat)
always finishes in **at most n − 1 transfers**. We first pair people whose
amounts match exactly, which saves a transfer in common cases.

## 2. Pain points (why the group gave up on it)

- **Daily expense cap on the free plan** (reported as 3 to 5 per day), plus a cooldown timer and ads before adding expenses. One biryani night easily has 6 or more bills (rice, meat, spices, drinks, dessert, gas, Uber).
- **Everyone needs an account.** The friend who "will sign up later" never does.
- **Built for flatmates, not for one-off events.** Recurring bills, groups and friend lists add friction for a single party.
- **Getting money back feels awkward.** No playful nudge, no fun.

## 3. What Hishab does differently

| Splitwise | Hishab |
|---|---|
| Accounts and servers | No accounts. Data lives on your phone; the share link *is* the sync |
| Capped free tier and ads | Unlimited, free forever, hosted on GitHub Pages |
| Store app | Installable web app (PWA) for Android and iOS, works offline |
| Plain number field | Amount field is a calculator: type `45*2+10` |
| "Simplify debts" toggle | Always simplified, with a one-tap **WhatsApp reminder** |
| Generic app look | A shop-ledger design: 3D cloth-bound books, ruled pages, a PAID rubber stamp |
| Balances only | A paid-back meter per ledger that fills until it reads "Cleared" |

## 4. Sync without a server

The whole party is JSON → compressed (deflate) → base64url → put in the link
**after the `#`**. Browsers never send the part after `#` to a server, so GitHub
never sees your data.

Merging works like a CRDT (a data type that merges cleanly): every member,
expense and payment has an id and an `at` timestamp. On merge, the newer copy
wins. A deleted item stays as a marker (a "tombstone") so the deletion spreads
too. Two friends can add expenses offline, swap links, and end up with the same
ledger.

Limits: there is no live push. People see each other's changes only when a link
is shared. A free Firebase or Supabase backend could add real-time sync later if
the group wants it.
