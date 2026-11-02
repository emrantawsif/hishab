# hishab

A shared ledger for splitting bills with friends. It installs on Android and
iOS like a normal app, works offline, and costs nothing to host.

## Features

- **Your crew**: Tawsif, Tonmoy, Afraaz, Usama, Awais and Tabish are built in, and anyone new you add joins too. Each person is a character with a portrait you build (skin, hair, beard, glasses, hat, mood, ink colour) or shuffle. Pick "Choose your character" once so every ledger knows who "you" are. Characters travel inside share links, so the whole group sees the same faces
- **Ledgers**: one ledger per occasion, drawn as a cloth-bound book on your shelf. Books tilt under your finger and the cover swings open when you tap one
- **Ledger pages**: dates in the margin, a "Particulars" column, double-ruled totals, and each friend's initials in their own ink colour
- **Two ways to split**: equally between whoever was there, or exact amounts per person
- **Several payers** for one bill
- **Calculator amount field**: type `45*2+10` and get €100. Decimal commas (`8,50`) work too
- **Fewest payments**: "who pays whom" with the smallest practical number of transfers
- **PAID stamp**: marking a payment slams a rubber stamp onto the line
- **Paid-back meter**: every ledger shows how much of its debt has been paid back, until it reads "Cleared"
- **WhatsApp group**: post a ledger report to your group in one tap: dates, total, per head and who pays whom; after adding a bill, tap "Post to group"; remind anyone who owes
- **Live ledgers**: share a short link once; after that every bill and payment shows up on everyone's phone within a second or two, with a green **Live** badge in the header. Entries added offline sync when the phone reconnects, and edits merge item by item (newest edit wins)
- **Free backend**: live sync uses a Firebase Realtime Database on the free Spark plan (no card, so it can't bill). Phones keep their own copy too, so the app still opens and works offline. Clear `DB_URL` in `js/sync.js` and the app falls back to carrying the whole ledger inside the link
- Dark and light themes, backup and restore to a file, undo for every delete, 13 currencies (defaults from your time zone)

See [docs/splitwise-teardown.md](docs/splitwise-teardown.md) for the teardown of Splitwise that shaped these choices.

## Put it online for free (GitHub Pages)

You need a free GitHub account. That's all.

1. Go to **github.com → New repository**. Name it `hishab` and make it **Public**
   (the free plan only serves Pages from public repos).
2. Click **"uploading an existing file"** and drag in everything in this folder
   (`index.html`, `manifest.webmanifest`, `sw.js`, `.nojekyll`, and the `css`, `js`, `icons`, `docs` folders). Commit.
3. Open **Settings → Pages**. Under *Build and deployment*, choose
   **Deploy from a branch → `main` → `/ (root)`** and save.
4. Wait about a minute. Your app is live at
   `https://<your-username>.github.io/hishab/`

If you use git instead:

```bash
git init && git add . && git commit -m "Hishab: first serving"
gh repo create hishab --public --source . --push
gh api -X POST repos/{owner}/hishab/pages -f "source[branch]=main" -f "source[path]=/"
```

### How many sites can GitHub host for free?

- **One user site** per account: `<username>.github.io`, from a repo with that exact name.
- **One project site per repository**, with no fixed cap on repositories, so in practice as many as you like: `<username>.github.io/<repo>/`.
- Limits: each site up to **1 GB**, about **100 GB/month bandwidth** (a soft limit), about **10 builds/hour**,
  public repos only on the free plan, and not for commercial shops.

## Install it like an app

- **Android (Chrome)**: open the link and tap **Install** in the banner, or use menu ⋮ → *Install app*.
- **iPhone (Safari)**: open the link and tap **Share ⬆︎ → Add to Home Screen**.

On iPhone, the installed app keeps its own storage, separate from Safari. If a
friend's link opens in Safari, copy it, open Hishab, and tap **"Got an invite link?"**.

## Run it locally

```bash
python -m http.server 5500
```

Then open <http://localhost:5500>. No build step, no npm, no dependencies.

## How it works

| File | Job |
|---|---|
| `js/avatar.js` | Character portraits built from parts, drawn as SVG |
| `js/money.js` | Integer money math, calculator parser, largest-remainder splits, balances, settle plan |
| `js/state.js` | localStorage, the crew, newest-edit-wins merge, input cleaning for links and backups |
| `js/share.js` | Ledger ⇄ compressed link, WhatsApp messages |
| `js/sync.js` | Live ledgers over the Firebase REST API: live stream for the open ledger, push and merge, offline retry |
| `js/app.js` | Screens, 3D books, stamp, bottom sheets, routing, install prompt |
| `sw.js` | Offline cache (network first, falls back to cache after 3 s) |

After changing files, bump `CACHE` in `sw.js` (for example `hishab-v6`) so installed apps drop old files.

## Live sync setup (already done for this copy)

1. Create a free Firebase project (Analytics off), then a **Realtime Database** in locked mode.
2. Paste these rules in the database's **Rules** tab and publish:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "ledgers": {
      "$ledger": {
        ".read": "$ledger.matches(/^[a-z0-9]{10,24}$/)",
        ".write": "$ledger.matches(/^[a-z0-9]{10,24}$/)",
        "$section": {
          ".validate": "$section === 'meta' || $section === 'members' || $section === 'expenses' || $section === 'payments'"
        }
      }
    }
  }
}
```

3. Put the database URL in `DB_URL` in `js/sync.js`.

Anyone with a ledger's link can read and write that one ledger; nobody can list ledgers. Never upgrade the project to the Blaze plan, and it stays free.
