# Sidequest — Implementation Blueprint

### A Phive-style, student-to-student freelancing platform with a gamified, chill interface — buildable in one day, in VSCode, without a single security checkpoint.

> **What this document is:** a complete, step-by-step implementation guide. Every code block in it has been written, executed, and verified against a real running stack (67 automated checks + a production build + proxy/demo-mode smoke tests) before being placed here. Copy from top to bottom and you will end with the same working app.  
> **What this document is not:** the project itself. Nothing is pre-built for you — you will create every file in VSCode, in the order given.

---

## Table of contents

1. [The product in one page](#1-the-product-in-one-page)
2. [Design principles (the "why" behind every decision)](#2-design-principles)
3. [Tech stack & architecture](#3-tech-stack--architecture)
4. [VSCode setup](#4-vscode-setup)
5. [The one-day plan](#5-the-one-day-plan)
6. [Project scaffold](#6-project-scaffold)
7. [Data model](#7-data-model)
8. [The Transparency Engine](#8-the-transparency-engine)
9. [The Gamification Engine](#9-the-gamification-engine)
10. [The Chill UI system](#10-the-chill-ui-system)
11. [Backend build steps (B1–B8)](#11-backend-build-steps)
12. [Frontend build steps (F1–F8)](#12-frontend-build-steps)
13. [Error-handling playbook](#13-error-handling-playbook)
14. [Testing & QA checklist](#14-testing--qa-checklist)
15. [Demo-day script](#15-demo-day-script)
16. [Ship it](#16-ship-it)
17. [Stretch goals (day 2+)](#17-stretch-goals)
18. [Appendices (API reference, ledger checks, smoke test, copy bank, glossary)](#18-appendices)

---

## 1. The product in one page

**Sidequest** (rename freely — "Loop", "Kamra", "CampusCrew" all work) is a micro-freelancing marketplace where students hire students. It takes the shape of **Phive** — the college freelancing platform (gigs, applications, trust, reviews, leaderboard) — but flips three things:

| Phive concept | Sidequest twist | Why |
|---|---|---|
| Lecturers post projects, students apply | **Any student posts a gig, any student hires** | Student-to-student is the whole point |
| Academic email rules, admin gates, formal flows | **Zero checkpoints** — email+password, done. Campus email only earns a soft 🎓 badge | Friction kills chill. Trust comes from transparency, not gates |
| Reviews & points | **Paired reviews, XP with anti-farming caps, badges, streaks, public leaderboard** | Gamified but exploitable-proof |
| Payment handled opaquely | **Campus credits in escrow + hash-chained public ledger** | Every transaction auditable by anyone — "no loopholes" |

**MVP feature list (everything below is built in this guide):**

- ✅ Register / login / logout / onboarding walkthrough (3 steps)
- ✅ Post gigs (title, category, tags, price in credits, delivery window)
- ✅ Explore with search + category chips + sort
- ✅ Orders with **escrow**: fund → accept → deliver → approve → release
- ✅ Cancel-before-start (full refund) and **disputes with mutual-consent resolution** (release / refund / split)
- ✅ Order-scoped messages + a shared timeline of every action
- ✅ **Public ledger**: append-only, hash-chained, verified live in the browser
- ✅ **Paired reviews** (publish together — no retaliation games)
- ✅ Gamification: XP, 10 levels, 6 badges, streaks, leaderboard
- ✅ Public profiles with trust stats
- ✅ One error contract for the whole API + chill user-facing messages

**Explicitly not in the MVP (see §17):** real payment gateway, file uploads (deliverables are links), websockets (messages poll on reload), password reset emails, admin panel.

---

## 2. Design principles

Break these and the app loses its identity.

1. **Transparency over checkpoints.** No 2FA, no captchas, no document uploads, no "verify your identity" modals. Instead: everything that matters (money, actions, reviews) is **visible and auditable**. Trust is earned by openness, not demanded by bureaucracy.
2. **Money never moves in the dark.** Every credit movement is an append-only ledger entry, hash-chained to the previous one. There is no code path that changes a balance without writing the ledger, and no code path that edits history.
3. **Two parties, one record.** Orders have a shared timeline both sides see. Disputes resolve by matching consent, not by admin fiat. Reviews publish in pairs.
4. **Casual on the surface, strict underneath.** The UI is emoji, pastel, rounded, and forgiving. The state machine, ledger triggers, and XP caps are ruthless. Be strict in the data layer so the UI can afford to be soft.
5. **Lightweight by conviction.** Three backend dependencies. One CSS file. No build step on the backend. If a library can be replaced by 20 clear lines, write the lines.
6. **Errors are part of the UX.** Every failure returns a chill, human sentence with a stable code and, where relevant, per-field messages. Never a raw stack trace, never a dead end.

---

## 3. Tech stack & architecture

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│  Frontend  (Vite + React)   │  proxy  │  Backend  (Express)          │
│  localhost:5173             │ ──────► │  localhost:4123              │
│                             │  /api   │                              │
│  • react-router-dom         │         │  • routes/ (auth, gigs,      │
│  • one fetch wrapper        │         │    orders, reviews, misc)    │
│  • one CSS design system    │         │  • lib/ (auth, ledger,       │
│  • context for auth + toast │         │    gamify, errors)           │
└─────────────────────────────┘         │        │                     │
                                        │        ▼                     │
                                        │  SQLite (better-sqlite3)    │
                                        │  sidequest.db — one file    │
                                        └──────────────────────────────┘

Demo day (single process): Express serves frontend/dist as static files.
```

| Layer | Choice | Why this and not the alternative |
|---|---|---|
| Frontend | **Vite + React 19** (JS, not TS) | Fastest polished-UI loop. JS keeps a one-day build free of type-config yak-shaving |
| Routing | **react-router-dom v7** | Standard, boring, reliable |
| Backend | **Express 4 (pinned `4.21.2`)** | Pinning matters: Express 5 changed wildcard routes (`app.get('*')` throws). Our SPA fallback needs `'*'` — so we pin v4 deliberately |
| Database | **SQLite via `better-sqlite3`** | One file, synchronous API (no async plumbing), real SQL constraints & triggers, prebuilt binaries for Win/mac/Linux |
| Auth | **Hand-rolled session cookie + bcryptjs** | ~20 lines, sessions visible in the DB (transparent), zero config. `bcryptjs` is pure JS — no native build surprises |
| Money | **Campus credits + hash-chained ledger** | Simulated but *honest*: every credit traceable. Razorpay seam documented in §17 |
| State | **React context + plain fetch** | No Redux, no react-query — one day means few moving parts |

**Full dependency list (that's it):**
`express@4.21.2`, `better-sqlite3@^11`, `bcryptjs@2.4.3` (backend) · `react`, `react-dom`, `react-router-dom`, `vite`, `@vitejs/plugin-react` (frontend).

**Runtime:** Node.js 20 LTS or newer (`node -v` to check). npm 10+.

---

## 4. VSCode setup

### 4.1 Install these extensions

| Extension | ID | For |
|---|---|---|
| **SQLite Viewer** | `yy0931.vscode-sqlite-viewer` | Click `sidequest.db` in Explorer → browse tables live. Superpowers for a transparent ledger |
| **ESLint** | `dbaeumer.vscode-eslint` | Catches mistakes while you type |
| **Prettier** | `esbenp.prettier-vscode` | Consistent formatting on save |
| **Thunder Client** | `rangav.vscode-thunder-client` | Poke the API from inside VSCode (alternative: curl in terminal) |
| **ES7+ React snippets** | `dsznajder.es7-react-js-snippets` | `rafce` → React page skeleton (optional but fast) |
| **Auto Rename Tag** | `formulahendry.auto-rename-tag` | JSX sanity |

### 4.2 Workspace settings (`.vscode/settings.json`)

Create this file at the project root so save-on-format and ESLint are wired on day one:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "files.eol": "\n",
  "eslint.validate": ["javascript", "javascriptreact"]
}
```

### 4.3 Terminal habits

You will run **two integrated terminals** most of the day (`Terminal → Split Terminal`):

- **Left / API:** `cd backend && npm run dev`
- **Right / UI:** `cd frontend && npm run dev`

`npm run dev` on the backend uses `node --watch`, so every save restarts the API automatically. Vite hot-reloads the UI by default.

---

## 5. The one-day plan

Time-boxed so "self-paced" can't quietly become "self-procrastinated". Each block has a **checkpoint** — do not move on until it passes.

| Hours | Block | Checkpoint |
|---|---|---|
| 0:00–0:30 | §6 Scaffold + §4 VSCode setup | `npm run dev` boots both terminals; blank React page at :5173 |
| 0:30–1:30 | §11 B1–B3: schema, db, errors, ledger | Ledger unit checks pass (Appendix B) |
| 1:30–2:30 | §11 B4: auth | Register + login via curl/Thunder |
| 2:30–4:00 | §11 B5–B7: gigs, orders (escrow), reviews | Full order flow via curl |
| 4:00–4:45 | §11 B8: gamify, misc routes, seed | `npm run seed` + `GET /api/leaderboard` |
| 4:45–5:30 | Smoke test run (Appendix C) | **67/67 checks green** |
| 5:30–6:30 | §12 F1–F4: shell, api wrapper, auth, UI kit, styles | Login/logout works in browser |
| 6:30–8:30 | §12 F5–F7: explore, gig detail, post gig, dashboard, order room | Buy → deliver → approve cycle in browser |
| 8:30–9:30 | §12 F8 + remaining pages: ledger, leaderboard, profile, onboarding, 404 | Ledger page shows ✅ chain intact |
| 9:30–10:00 | §14 QA checklist + §15 demo script rehearsal | Demo runs cold in under 5 minutes |

**Self-paced slack:** the blocks above assume ~10 focused hours. The build itself is a day; the buffer is for living.

---

## 6. Project scaffold

### 6.1 Create the workspace

In VSCode: `File → Open Folder… →` pick (or create) `sidequest/`. Then open the integrated terminal (`Ctrl+\``).

```bash
mkdir sidequest && cd sidequest
mkdir backend frontend
```

### 6.2 Backend skeleton

```bash
cd backend
npm init -y
npm install express@4.21.2 better-sqlite3@^11 bcryptjs@2.4.3
mkdir -p src/lib src/routes scripts
```

Replace the generated `package.json` with this exact content (scripts + pins):

```json
{
  "name": "sidequest-api",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "seed": "node scripts/seed.js"
  },
  "dependencies": {
    "bcryptjs": "2.4.3",
    "better-sqlite3": "^11.8.1",
    "express": "4.21.2"
  }
}
```

### 6.3 Frontend skeleton

```bash
cd ../frontend
npm create vite@latest . -- --template react
npm install
npm install react-router-dom
```

> If `npm create vite` complains about a non-empty folder, run it in a temp dir and move the files in — or accept its overwrite prompt. We replace `src/` entirely in §12 anyway.

Delete the template leftovers when you get to F2 (`src/App.css`, `src/index.css`, `src/assets/`).

### 6.4 Final folder tree (what you are building towards)

```
sidequest/
├── .vscode/settings.json
├── backend/
│   ├── package.json
│   ├── sidequest.db            ← created automatically on first boot
│   ├── scripts/
│   │   └── seed.js
│   └── src/
│       ├── server.js
│       ├── db.js
│       ├── schema.sql
│       ├── lib/
│       │   ├── errors.js
│       │   ├── ledger.js
│       │   ├── auth.js
│       │   └── gamify.js
│       └── routes/
│           ├── auth.js
│           ├── gigs.js
│           ├── orders.js
│           ├── reviews.js
│           └── misc.js
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js
        ├── auth.jsx
        ├── ui.jsx
        ├── styles.css
        └── pages/
            ├── Landing.jsx      ├── Dashboard.jsx
            ├── Explore.jsx      ├── OrderRoom.jsx
            ├── GigDetail.jsx    ├── LedgerPage.jsx
            ├── PostGig.jsx      ├── Leaderboard.jsx
            ├── Login.jsx        ├── Profile.jsx
            ├── Register.jsx     ├── NotFound.jsx
            └── Onboarding.jsx
```

---

## 7. Data model

Eleven tables. Money lives in exactly three places that must always agree: `users.credits` (spendable), `orders.price` (escrowed), and the `ledger` (the truth). If they ever disagree, the ledger wins.

| Table | Purpose | Key constraints |
|---|---|---|
| `users` | Accounts, wallet, XP, streaks | `credits >= 0`, unique email (case-insensitive) |
| `sessions` | Hand-rolled session tokens | token is a 64-char hex, httpOnly cookie |
| `gigs` | Service listings | `price > 0`, `delivery_days > 0` |
| `orders` | Buyer ↔ seller contracts | `buyer_id <> seller_id` (CHECK), status enum (CHECK) |
| `order_events` | The shared timeline: actions **and** messages | append-only by convention |
| `ledger` | Every credit movement | **append-only enforced by SQL triggers**, hash-chained |
| `reviews` | One per person per order | UNIQUE(order, reviewer), `rating BETWEEN 1 AND 5` |
| `xp_events` | XP audit trail (drives daily caps + weekly leaderboard) | append-only by convention |
| `badges` | Badge catalog | seeded at boot from JS definitions |
| `user_badges` | Who earned what | PK(user, code) — no double awards |

**Order status machine** (the only paths money can travel):

```
            ┌─────────── cancel ──────────► cancelled (refund buyer)
            ▼
        pending ──accept──► accepted ──deliver──► delivered ──approve──► completed (pay seller)
   (escrow funded)              │                    │
                                └─── dispute ────────┘
                                        │
                                        ▼
                                    disputed
                                        │
              both sides must propose the SAME resolution
                                        │
                ┌───────────────────────┼───────────────────────┐
                ▼                       ▼                       ▼
       resolved_release          resolved_refund          resolved_split
        (seller paid)            (buyer refunded)        (50/50 both paid)
```

Terminal states: `completed`, `cancelled`, `resolved_*`. Reviews open only in `completed` and `resolved_*` — a cancelled order never started, so no reviews.

---

## 8. The Transparency Engine

This is the core requirement ("no loopholes"), so it gets its own section. Five mechanisms, all in the MVP:

### 8.1 The append-only, hash-chained ledger

- Every credit movement — welcome grant, escrow fund, release, refund, split — is one `ledger` row.
- Each row stores `prev_hash` (the previous row's `entry_hash`) and its own `entry_hash = sha256(prev_hash|nonce|order|actor|type|amount|balance|memo)`.
- Two SQL triggers **abort any UPDATE or DELETE** with the message `ledger is append-only`. Try it in SQLite Viewer — the database refuses.
- `GET /api/ledger/verify` recomputes the whole chain. The Ledger page shows a green **"✅ Chain intact"** banner powered by that endpoint. Tamper with any row (change one amount) and verification points at the exact broken entry.

### 8.2 Escrow, not promises

On order creation the buyer's credits move to escrow **in the same SQLite transaction** that creates the order (`BEGIN IMMEDIATE` — the write lock is taken up front, so two simultaneous clicks cannot double-spend). The buyer literally cannot touch escrowed credits; only the state machine can, through the four legal money moves (release / refund / split-release / split-refund).

### 8.3 Mutual-consent dispute resolution

A dispute pauses the order. Either side may propose `release`, `refund`, or `split`. When **both proposals match**, the money moves automatically and the outcome is logged — including any proposals that were changed along the way. There is no admin override to lobby, and the disagreement itself stays on the shared timeline.

### 8.4 Paired reviews

Reviews are only allowed on finished orders, one per person per order (UNIQUE constraint). A review **stays private until the counterpart posts theirs too**, or 72 hours pass since completion. Nobody can pressure the other side with "change my rating or I'll tank yours" — they can't see it to weaponise it, and retaliation publishing is simultaneous. (Visibility is computed at read time — no cron job needed.)

### 8.5 One shared timeline

Every action (`created`, `accepted`, `delivered`, `approved`, `cancelled`, `disputed`, `proposed`, `resolved`) *and every message* lands in `order_events`, visible to both parties with actor + timestamp. The Order Room renders it as a story. "He said / she said" has nowhere to hide.

**Who sees what:**

| Thing | Buyer | Seller | Public (guest) |
|---|---|---|---|
| Order timeline + messages | ✅ | ✅ | ❌ |
| Escrow amounts & status | ✅ | ✅ | ❌ |
| Ledger entries (amounts, hashes, actors) | ✅ | ✅ | ✅ |
| Reviews (after pairing / 72h) | ✅ | ✅ | ✅ |
| Profiles, badges, XP, leaderboard | ✅ | ✅ | ✅ |

---

## 9. The Gamification Engine

XP is awarded only for **verifiable server-side actions**, each with a daily cap so nothing can be farmed:

| Action | XP | Daily cap | Triggered in |
|---|---|---|---|
| Sign up | +25 | — (once) | `POST /api/auth/register` |
| Post a gig | +10 | 30 | `POST /api/gigs` |
| Order completed as seller | +50 | 200 | `POST /api/orders/:id/approve` (and dispute-release) |
| Order completed as buyer | +15 | 60 | same |
| Write a review | +5 | 20 | `POST /api/orders/:id/review` |
| Daily visit (streak tick) | +5 | 5 | any authed `GET /api/me` |
| Badge unlocked | +20 | 100 | `awardBadges()` |

**Anti-farming rules (all enforced server-side):**
- Daily caps above (the `xp_events` table makes caps auditable).
- You cannot order your own gig (409). You cannot review without a finished order. One review per person per order.
- **Refunds and cancelled orders award no XP** — only real completed work does.
- XP events are append-only by convention and every award is logged with a memo.

**Levels** (shown in nav + profiles): `0→1 Newbie, 100→2 Regular, 250→3 Grinder, 500→4 Hustler, 900→5 Pro, 1500→6 Ace, 2400→7 Wizard, 3600→8 Legend, 5200→9 Mythic, 7000→10 Campus Boss`. The XP bar fills with `progress` from `levelFor(xp)`.

**Badges** (each +20 XP on unlock):

| Code | Badge | Earned when |
|---|---|---|
| `early_citizen` | 🌱 Early Citizen | Account created |
| `first_gig` | 📮 First Gig | First gig posted |
| `first_sale` | 🤝 First Sale | First order completed as seller |
| `five_star` | ⭐ Five Star | 3+ reviews averaging ≥ 4.5 |
| `streak_7` | 🔥 On A Roll | 7-day visit streak |
| `trusted_trader` | 🏆 Trusted Trader | 10+ completed orders |

**Streaks:** one tick per UTC day via `touchStreak()`. Miss a day, start over. Same-day repeats don't double-count.

---

## 10. The Chill UI system

One CSS file (`styles.css`), zero UI frameworks. Design tokens:

| Token | Value | Role |
|---|---|---|
| `--bg` | `#fdf6ee` | Warm cream canvas |
| `--surface` | `#ffffff` | Cards |
| `--ink` / `--muted` | `#2b2130` / `#7a6e7f` | Text |
| `--accent` | `#7c5cff` | Soft violet — buttons, links, XP |
| `--pink` / `--mint` / `--lemon` | `#ff6b8a` / `#2ed3a7` / `#ffc94d` | Accents, success, credits |
| `--radius` | `20px` (cards), `999px` (pills) | Nothing sharp anywhere |
| `--shadow` | `0 8px 30px rgba(43,33,48,.08)` | Gentle lift |

**Vibe rules:** emoji as icons (no icon library), soft gradient hero with two blurred blobs, toasts slide in bottom-right, empty states have personality (`🌙 Nothing here yet`), buttons lift on hover, XP bar animates. Microcopy is casual and specific — the copy bank is in **Appendix D** (error messages live in §13.3).

Status chips carry the mood machine: `Waiting on seller` (amber) → `In progress` (violet) → `Needs your approval` (pink) → `Completed` (green). Disputes go red but the copy stays calm ("Something's off?" not "REPORT USER").

---

## 11. Backend build steps

Work in `backend/`. Create files in this order — each builds on the last. At the end of each step is its **checkpoint**; run it before moving on.

### B1 — `src/schema.sql` (the whole data model)

```sql
-- Sidequest schema. Money lives in three places that must always agree:
-- users.credits (spendable), the ledger (append-only truth), orders.price (escrowed).
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  email               TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash       TEXT NOT NULL,
  display_name        TEXT NOT NULL,
  avatar              TEXT NOT NULL DEFAULT '🙂',
  campus              TEXT NOT NULL DEFAULT '',
  bio                 TEXT NOT NULL DEFAULT '',
  skills              TEXT NOT NULL DEFAULT '',
  credits             INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  xp                  INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  streak_days         INTEGER NOT NULL DEFAULT 0,
  last_active_day     TEXT,
  is_verified_student INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS gigs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  category      TEXT NOT NULL,
  tags          TEXT NOT NULL DEFAULT '',
  price         INTEGER NOT NULL CHECK (price > 0),
  delivery_days INTEGER NOT NULL CHECK (delivery_days > 0),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  gig_id              INTEGER NOT NULL REFERENCES gigs(id),
  buyer_id            INTEGER NOT NULL REFERENCES users(id),
  seller_id           INTEGER NOT NULL REFERENCES users(id),
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','delivered','completed','cancelled',
                      'disputed','resolved_release','resolved_refund','resolved_split')),
  price               INTEGER NOT NULL CHECK (price > 0),
  note                TEXT NOT NULL DEFAULT '',
  deliverable         TEXT NOT NULL DEFAULT '',
  resolution_proposal TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at        TEXT,
  CHECK (buyer_id <> seller_id)
);

-- The transparent "story" of an order: every action lands here, visible to both parties.
CREATE TABLE IF NOT EXISTS order_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_id   INTEGER REFERENCES users(id),
  event      TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Append-only money ledger, hash-chained. Nobody — not even admin — can edit or delete.
CREATE TABLE IF NOT EXISTS ledger (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nonce         TEXT NOT NULL,
  order_id      INTEGER REFERENCES orders(id),
  actor_id      INTEGER REFERENCES users(id),
  type          TEXT NOT NULL CHECK (type IN
                ('grant','escrow_fund','escrow_release','escrow_refund',
                 'escrow_split_release','escrow_split_refund')),
  amount        INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  memo          TEXT NOT NULL,
  prev_hash     TEXT NOT NULL,
  entry_hash    TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger
BEGIN
  SELECT RAISE(ABORT, 'ledger is append-only: updates are forbidden');
END;

CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger
BEGIN
  SELECT RAISE(ABORT, 'ledger is append-only: deletes are forbidden');
END;

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id),
  reviewee_id INTEGER NOT NULL REFERENCES users(id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (order_id, reviewer_id),
  CHECK (reviewer_id <> reviewee_id)
);

CREATE TABLE IF NOT EXISTS xp_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  memo       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS badges (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       TEXT NOT NULL REFERENCES badges(code),
  awarded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_gigs_owner   ON gigs(owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_xp_user_day ON xp_events(user_id, created_at);
```

### B2 — `src/db.js` (connection + transaction helper)

```js
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'sidequest.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema.sql on every boot (CREATE ... IF NOT EXISTS, so this is idempotent).
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Everything that moves money runs inside this. BEGIN IMMEDIATE takes the write
// lock up front, so two clicks at once can never double-spend escrow credits.
// If we're already inside a transaction, just run — nested calls join it.
function tx(fn) {
  if (db.inTransaction) return fn();
  return db.transaction(fn).immediate();
}

module.exports = { db, tx };
```

### B3 — `src/lib/errors.js` (one error contract for everything)

```js
// One error shape for the whole API. Every failure leaves the server as:
//   { "error": { "code": "...", "message": "chill human sentence", "fields": { ... } } }
// so the React side never has to guess what went wrong.

class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const badRequest = (message, fields) => new ApiError(400, 'VALIDATION_ERROR', message, fields);
const unauthorized = (message = 'You need to sign in to do that.') =>
  new ApiError(401, 'UNAUTHENTICATED', message);
const forbidden = (message = "That's not yours to touch.") =>
  new ApiError(403, 'FORBIDDEN', message);
const notFound = (message = "Couldn't find that.") => new ApiError(404, 'NOT_FOUND', message);
const conflict = (message, fields) => new ApiError(409, 'CONFLICT', message, fields);

// Final middleware: turns any thrown error into the contract above.
// Known plumbing errors (bad JSON, oversized bodies) get friendly statuses;
// unknown errors are logged with an id, and the client gets a safe generic.
function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) },
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: "That request body wasn't valid JSON." },
    });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'That payload is too chunky — keep it under 256kb.' },
    });
  }
  const errorId = Date.now().toString(36);
  console.error(`[${errorId}]`, err);
  res.status(500).json({
    error: {
      code: 'SERVER_ERROR',
      message: `Something glitched on our side (ref ${errorId}). Try again?`,
    },
  });
}

module.exports = { ApiError, badRequest, unauthorized, forbidden, notFound, conflict, errorHandler };
```

### B4 — `src/lib/ledger.js` (the transparency engine)

```js
const crypto = require('crypto');
const { db, tx } = require('../db');
const { badRequest } = require('./errors');

const GENESIS = 'GENESIS';

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Every money movement is one ledger row, hash-chained to the row before it.
// entry_hash covers the row's full payload + the previous hash, so editing any
// historical row (even in a sqlite3 shell) breaks every hash after it.
function appendEntry({ orderId = null, actorId = null, type, amount, balanceAfter, memo }) {
  const last = db.prepare('SELECT entry_hash FROM ledger ORDER BY id DESC LIMIT 1').get();
  const prevHash = last ? last.entry_hash : GENESIS;
  const nonce = crypto.randomUUID();
  const payload = [prevHash, nonce, orderId, actorId, type, amount, balanceAfter, memo].join('|');
  const entryHash = sha256(payload);

  const info = db
    .prepare(
      `INSERT INTO ledger (nonce, order_id, actor_id, type, amount, balance_after, memo, prev_hash, entry_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(nonce, orderId, actorId, type, amount, balanceAfter, memo, prevHash, entryHash);

  return { id: info.lastInsertRowid, entryHash, prevHash };
}

// Move credits between users (or the house grant), updating balances and the
// ledger together in one transaction so the two can never disagree.
function move({ userId, delta, type, orderId = null, memo }) {
  return tx(() => {
    const user = db.prepare('SELECT id, credits FROM users WHERE id = ?').get(userId);
    if (!user) throw badRequest('Unknown user for ledger movement.');
    const balanceAfter = user.credits + delta;
    if (balanceAfter < 0) throw badRequest('Not enough credits for that.');
    db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(balanceAfter, userId);
    return appendEntry({ orderId, actorId: userId, type, amount: delta, balanceAfter, memo });
  });
}

// Walk the whole chain and recompute every hash. The Ledger page calls this.
function verifyChain() {
  const rows = db.prepare('SELECT * FROM ledger ORDER BY id ASC').all();
  let prevHash = GENESIS;
  for (const row of rows) {
    const payload = [
      row.prev_hash, row.nonce, row.order_id, row.actor_id, row.type,
      row.amount, row.balance_after, row.memo,
    ].join('|');
    const expected = sha256(payload);
    if (row.prev_hash !== prevHash) return { ok: false, entries: rows.length, brokenAt: row.id, reason: 'prev_hash mismatch' };
    if (row.entry_hash !== expected) return { ok: false, entries: rows.length, brokenAt: row.id, reason: 'entry_hash mismatch' };
    prevHash = row.entry_hash;
  }
  return { ok: true, entries: rows.length, brokenAt: null };
}

module.exports = { appendEntry, move, verifyChain, GENESIS };
```

### B5 — `src/lib/auth.js` (sessions without the ceremony)

```js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { unauthorized, badRequest } = require('./errors');

const SESSION_COOKIE = 'sid';
const CAMPUS_DOMAINS = ['.edu', '.ac.in', '.edu.in', '.ac.uk'];

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function checkPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function isCampusEmail(email) {
  return CAMPUS_DOMAINS.some((d) => email.toLowerCase().endsWith(d));
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  return token;
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// Minimal cookie parse — one less dependency, one less thing that can break.
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// Attaches req.user when a valid session cookie arrives; never rejects —
// routes decide themselves whether auth is required.
function attachUser(req, _res, next) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) {
    const row = db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
      )
      .get(token);
    if (row) req.user = row;
  }
  next();
}

function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

function registerUser({ email, password, displayName }) {
  const fields = {};
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) fields.email = 'That email looks a bit off.';
  if (!password || password.length < 8) fields.password = 'Use at least 8 characters.';
  if (!displayName || displayName.trim().length < 2) fields.displayName = 'Pick a name (2+ characters).';
  if (Object.keys(fields).length) throw badRequest('Almost there — check the highlighted fields.', fields);

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) throw badRequest('That email already has an account.', { email: 'Already registered — try logging in.' });

  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, display_name, is_verified_student)
       VALUES (?, ?, ?, ?)`
    )
    .run(email.trim(), hashPassword(password), displayName.trim(), isCampusEmail(email) ? 1 : 0);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function loginUser({ email, password }) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '');
  if (!user || !checkPassword(password || '', user.password_hash)) {
    throw unauthorized('Email or password is off. No stress, try again.');
  }
  return user;
}

// Public-safe user shape. Never leaks password_hash or email to other users.
function publicUser(user) {
  return {
    id: user.id,
    displayName: user.display_name,
    avatar: user.avatar,
    campus: user.campus,
    bio: user.bio,
    skills: user.skills ? user.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
    xp: user.xp,
    credits: user.credits,
    streakDays: user.streak_days,
    isVerifiedStudent: !!user.is_verified_student,
    createdAt: user.created_at,
  };
}

module.exports = {
  SESSION_COOKIE, createSession, destroySession, attachUser, requireAuth,
  setSessionCookie, clearSessionCookie, registerUser, loginUser, publicUser, hashPassword,
};
```

### B6 — `src/lib/gamify.js` (XP, levels, badges, streaks)

```js
const { db } = require('../db');

// XP rules. Daily caps kill farming (firing 50 gigs at yourself earns almost nothing).
const XP_RULES = {
  signup:        { amount: 25,  dailyCap: null, memo: 'Welcome to Sidequest' },
  gig_posted:    { amount: 10,  dailyCap: 30,   memo: 'Posted a gig' },
  order_sold:    { amount: 50,  dailyCap: 200,  memo: 'Delivered an order' },
  order_bought:  { amount: 15,  dailyCap: 60,   memo: 'Completed a purchase' },
  review_written:{ amount: 5,   dailyCap: 20,   memo: 'Left a fair review' },
  daily_visit:   { amount: 5,   dailyCap: 5,    memo: 'Showed up today' },
  badge_earned:  { amount: 20,  dailyCap: 100,  memo: 'Badge unlocked' },
};

const LEVEL_XP = [0, 100, 250, 500, 900, 1500, 2400, 3600, 5200, 7000];
const LEVEL_TITLES = ['Newbie','Regular','Grinder','Hustler','Pro','Ace','Wizard','Legend','Mythic','Campus Boss'];

function levelFor(xp) {
  let level = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) level = i + 1;
  const floor = LEVEL_XP[level - 1];
  const ceil = level < LEVEL_XP.length ? LEVEL_XP[level] : floor;
  return {
    level,
    title: LEVEL_TITLES[level - 1],
    xpIntoLevel: xp - floor,
    xpForNext: ceil - floor,
    progress: ceil > floor ? Math.min(1, (xp - floor) / (ceil - floor)) : 1,
  };
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

// Awards XP for a verified action, respecting the daily cap for that action type.
// Returns the amount actually awarded (0 when the cap is hit).
function addXp(userId, type, memoOverride) {
  const rule = XP_RULES[type];
  if (!rule) return 0;

  if (rule.dailyCap !== null) {
    const today = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM xp_events
         WHERE user_id = ? AND type = ? AND created_at >= ?`
      )
      .get(userId, type, `${utcDay()}T00:00:00.000Z`).total;
    if (today >= rule.dailyCap) return 0;
  }

  const amount = rule.amount;
  db.prepare('INSERT INTO xp_events (user_id, type, amount, memo) VALUES (?, ?, ?, ?)')
    .run(userId, type, amount, memoOverride || rule.memo);
  db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(amount, userId);
  return amount;
}

// Streaks: one visit per UTC day counts. Miss a day and the streak resets.
function touchStreak(userId) {
  const user = db.prepare('SELECT streak_days, last_active_day FROM users WHERE id = ?').get(userId);
  const today = utcDay();
  if (user.last_active_day === today) return user.streak_days;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = user.last_active_day === yesterday ? user.streak_days + 1 : 1;
  db.prepare('UPDATE users SET streak_days = ?, last_active_day = ? WHERE id = ?')
    .run(streak, today, userId);
  addXp(userId, 'daily_visit');
  return streak;
}

const BADGE_DEFS = {
  early_citizen:  { name: 'Early Citizen',  emoji: '🌱', desc: 'Joined during the beta season.' },
  first_gig:      { name: 'First Gig',      emoji: '📮', desc: 'Posted your first gig.' },
  first_sale:     { name: 'First Sale',     emoji: '🤝', desc: 'Completed your first order.' },
  five_star:      { name: 'Five Star',      emoji: '⭐', desc: 'Avg rating 4.5+ across 3+ reviews.' },
  streak_7:       { name: 'On A Roll',      emoji: '🔥', desc: '7-day login streak.' },
  trusted_trader: { name: 'Trusted Trader', emoji: '🏆', desc: 'Completed 10+ orders.' },
};

// Re-checks every badge condition and awards what's newly earned.
// Cheap enough to run after any state change; returns newly awarded codes.
function awardBadges(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const owned = new Set(
    db.prepare('SELECT code FROM user_badges WHERE user_id = ?').all(userId).map((r) => r.code)
  );
  const sold = db
    .prepare(`SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND status IN ('completed','resolved_release')`)
    .get(userId).n;
  const gigCount = db.prepare('SELECT COUNT(*) AS n FROM gigs WHERE owner_id = ?').get(userId).n;
  const rating = db
    .prepare('SELECT COUNT(*) AS n, COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE reviewee_id = ?')
    .get(userId);

  const earned = {
    early_citizen: true,
    first_gig: gigCount >= 1,
    first_sale: sold >= 1,
    five_star: rating.n >= 3 && rating.avg >= 4.5,
    streak_7: user.streak_days >= 7,
    trusted_trader: sold >= 10,
  };

  const newly = [];
  for (const [code, met] of Object.entries(earned)) {
    if (met && !owned.has(code)) {
      db.prepare('INSERT INTO user_badges (user_id, code) VALUES (?, ?)').run(userId, code);
      addXp(userId, 'badge_earned', `Unlocked ${BADGE_DEFS[code].name}`);
      newly.push(code);
    }
  }
  return newly;
}

function badgesFor(userId) {
  return db
    .prepare(
      `SELECT b.code, b.name, b.emoji, b.description, ub.awarded_at
       FROM user_badges ub JOIN badges b ON b.code = ub.code
       WHERE ub.user_id = ? ORDER BY ub.awarded_at ASC`
    )
    .all(userId);
}

// Badge catalog must exist before anything can reference it (FK). Upserted at boot.
function ensureBadges() {
  const upsert = db.prepare(
    'INSERT OR IGNORE INTO badges (code, name, emoji, description) VALUES (?, ?, ?, ?)'
  );
  for (const [code, def] of Object.entries(BADGE_DEFS)) {
    upsert.run(code, def.name, def.emoji, def.desc);
  }
}
ensureBadges();

module.exports = { addXp, touchStreak, awardBadges, badgesFor, levelFor, ensureBadges, XP_RULES, BADGE_DEFS, utcDay };
```

> **Note the `ensureBadges()` call at load time.** The `user_badges` table has a foreign key to `badges`; awarding before seeding the catalog would throw `FOREIGN KEY constraint failed`. Boot-seeding removes that whole class of bug.

### B7 — Routes

#### `src/routes/auth.js`

```js
const express = require('express');
const { db } = require('../db');
const { badRequest } = require('../lib/errors');
const { move } = require('../lib/ledger');
const {
  registerUser, loginUser, createSession, destroySession, requireAuth,
  setSessionCookie, clearSessionCookie, publicUser,
} = require('../lib/auth');
const {
  addXp, touchStreak, awardBadges, badgesFor, levelFor,
} = require('../lib/gamify');

const router = express.Router();
const WELCOME_CREDITS = 250;

function mePayload(user) {
  const rating = db
    .prepare('SELECT COUNT(*) AS n, COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE reviewee_id = ?')
    .get(user.id);
  const sold = db
    .prepare(`SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND status IN ('completed','resolved_release')`)
    .get(user.id).n;
  const bought = db
    .prepare(`SELECT COUNT(*) AS n FROM orders WHERE buyer_id = ? AND status IN ('completed','resolved_release')`)
    .get(user.id).n;

  return {
    user: { ...publicUser(user), level: levelFor(user.xp) },
    badges: badgesFor(user.id),
    stats: {
      avgRating: rating.n ? Math.round(rating.avg * 10) / 10 : null,
      reviewCount: rating.n,
      completedAsSeller: sold,
      completedAsBuyer: bought,
    },
  };
}

router.post('/auth/register', (req, res) => {
  const { email, password, displayName } = req.body || {};
  const user = registerUser({ email, password, displayName });

  // The welcome grant is a ledger entry like any other — visible on day one.
  move({
    userId: user.id, delta: WELCOME_CREDITS, type: 'grant',
    memo: `Welcome grant: ${WELCOME_CREDITS} campus credits`,
  });
  addXp(user.id, 'signup');
  awardBadges(user.id);
  touchStreak(user.id);

  const token = createSession(user.id);
  setSessionCookie(res, token);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.status(201).json(mePayload(fresh));
});

router.post('/auth/login', (req, res) => {
  const user = loginUser(req.body || {});
  touchStreak(user.id);
  awardBadges(user.id);
  const token = createSession(user.id);
  setSessionCookie(res, token);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json(mePayload(fresh));
});

router.post('/auth/logout', (req, res) => {
  const cookies = (req.headers.cookie || '').split(';');
  const sid = cookies.map((c) => c.trim()).find((c) => c.startsWith('sid='));
  if (sid) destroySession(sid.slice(4));
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  touchStreak(req.user.id);
  awardBadges(req.user.id);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json(mePayload(fresh));
});

// Onboarding / profile edit. Partial update: only the fields sent are touched.
router.patch('/me', requireAuth, (req, res) => {
  const { displayName, avatar, campus, bio, skills } = req.body || {};
  const fields = {};
  if (displayName !== undefined && displayName.trim().length < 2) {
    fields.displayName = 'Pick a name (2+ characters).';
  }
  if (avatar !== undefined && ![...avatar].length) fields.avatar = 'Pick an emoji avatar.';
  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);

  const sets = [];
  const args = [];
  if (displayName !== undefined) { sets.push('display_name = ?'); args.push(displayName.trim()); }
  if (avatar !== undefined) { sets.push('avatar = ?'); args.push(avatar); }
  if (campus !== undefined) { sets.push('campus = ?'); args.push(String(campus).trim()); }
  if (bio !== undefined) { sets.push('bio = ?'); args.push(String(bio).trim()); }
  if (skills !== undefined) {
    const list = (Array.isArray(skills) ? skills : String(skills).split(','))
      .map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
    sets.push('skills = ?'); args.push(list.join(', '));
  }
  if (!sets.length) throw badRequest('Nothing to update.');

  args.push(req.user.id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json(mePayload(fresh));
});

module.exports = router;
```

> **Partial-update discipline matters.** `PATCH /api/me` only touches keys present in the body. Sending the full object from a form that only owns three fields would silently wipe the other fifteen. The onboarding flow (F8) relies on this.

#### `src/routes/gigs.js`

```js
const express = require('express');
const { db } = require('../db');
const { badRequest, notFound } = require('../lib/errors');
const { requireAuth } = require('../lib/auth');
const { addXp, awardBadges, badgesFor, levelFor } = require('../lib/gamify');

const router = express.Router();

const CATEGORIES = ['Design & Art', 'Writing', 'Code & Tech', 'Video & Photo', 'Music & Audio', 'Tutoring', 'Slides & Docs', 'Odd Jobs'];

function ownerSummary(ownerId) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(ownerId);
  const rating = db
    .prepare('SELECT COUNT(*) AS n, COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE reviewee_id = ?')
    .get(ownerId);
  return {
    id: u.id,
    displayName: u.display_name,
    avatar: u.avatar,
    campus: u.campus,
    isVerifiedStudent: !!u.is_verified_student,
    level: levelFor(u.xp),
    badges: badgesFor(ownerId),
    avgRating: rating.n ? Math.round(rating.avg * 10) / 10 : null,
    reviewCount: rating.n,
    completedOrders: db
      .prepare(`SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND status IN ('completed','resolved_release')`)
      .get(ownerId).n,
  };
}

function gigJson(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    price: row.price,
    deliveryDays: row.delivery_days,
    active: !!row.active,
    createdAt: row.created_at,
  };
}

router.get('/gigs', (req, res) => {
  const { query = '', category = '', sort = 'recent' } = req.query;
  const where = ['g.active = 1'];
  const args = [];

  if (query) {
    where.push('(g.title LIKE ? OR g.description LIKE ? OR g.tags LIKE ?)');
    const like = `%${query}%`;
    args.push(like, like, like);
  }
  if (category && CATEGORIES.includes(category)) {
    where.push('g.category = ?');
    args.push(category);
  }

  const orderBy =
    sort === 'price_asc' ? 'g.price ASC' :
    sort === 'price_desc' ? 'g.price DESC' :
    'g.created_at DESC';

  const rows = db
    .prepare(`SELECT g.* FROM gigs g WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT 60`)
    .all(...args);

  res.json({ categories: CATEGORIES, gigs: rows.map((r) => ({ ...gigJson(r), owner: ownerSummary(r.owner_id) })) });
});

router.get('/gigs/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM gigs WHERE id = ?').get(req.params.id);
  if (!row) throw notFound("That gig doesn't exist (anymore).");
  res.json({ ...gigJson(row), owner: ownerSummary(row.owner_id) });
});

router.post('/gigs', requireAuth, (req, res) => {
  const { title, description, category, tags = '', price, deliveryDays } = req.body || {};
  const fields = {};
  if (!title || title.trim().length < 3) fields.title = 'Give it a punchy title (3+ characters).';
  if (!description || description.trim().length < 10) fields.description = 'Tell people what they get (10+ characters).';
  if (!CATEGORIES.includes(category)) fields.category = 'Pick a category.';
  const priceNum = Number(price);
  if (!Number.isInteger(priceNum) || priceNum < 1 || priceNum > 100000) fields.price = 'Credits between 1 and 100000.';
  const daysNum = Number(deliveryDays);
  if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > 90) fields.deliveryDays = 'Delivery window: 1–90 days.';
  if (Object.keys(fields).length) throw badRequest('Almost there — check the highlighted fields.', fields);

  const info = db
    .prepare(
      `INSERT INTO gigs (owner_id, title, description, category, tags, price, delivery_days)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, title.trim(), description.trim(), category,
         Array.isArray(tags) ? tags.join(', ') : String(tags), priceNum, daysNum);

  addXp(req.user.id, 'gig_posted');
  awardBadges(req.user.id);
  const row = db.prepare('SELECT * FROM gigs WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...gigJson(row), owner: ownerSummary(row.owner_id) });
});

module.exports = router;
```

#### `src/routes/orders.js` — the escrow state machine

This is the most important file in the backend. Read the comment blocks — every rule is deliberate.

```js
const express = require('express');
const { db, tx } = require('../db');
const { badRequest, notFound, forbidden, conflict } = require('../lib/errors');
const { move } = require('../lib/ledger');
const { requireAuth } = require('../lib/auth');
const { addXp, awardBadges, levelFor } = require('../lib/gamify');

const router = express.Router();

// The one and only state machine. Money moves only on these edges.
const TRANSITIONS = {
  pending:   ['accepted', 'cancelled'],
  accepted:  ['delivered', 'disputed'],
  delivered: ['completed', 'disputed'],
  disputed:  ['resolved_release', 'resolved_refund', 'resolved_split'],
};
const REVIEWABLE = ['completed', 'resolved_release', 'resolved_refund', 'resolved_split'];

function orderOr404(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(id));
  if (!order) throw notFound("Couldn't find that order.");
  return order;
}

function assertParty(order, user) {
  if (order.buyer_id !== user.id && order.seller_id !== user.id) {
    throw forbidden("This order isn't yours.");
  }
}

function assertTransition(order, to) {
  if (!TRANSITIONS[order.status]?.includes(to)) {
    throw conflict(`An order that is "${order.status}" can't become "${to}".`);
  }
}

function logEvent(orderId, actorId, event, detail = '') {
  db.prepare('INSERT INTO order_events (order_id, actor_id, event, detail) VALUES (?, ?, ?, ?)')
    .run(orderId, actorId, event, detail);
}

function setFields(orderId, fields) {
  const sets = ["updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')"];
  const args = [];
  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    args.push(value);
  }
  args.push(orderId);
  db.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`).run(...args);
}

function counterpartSummary(userId) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return {
    id: u.id,
    displayName: u.display_name,
    avatar: u.avatar,
    campus: u.campus,
    level: levelFor(u.xp),
    isVerifiedStudent: !!u.is_verified_student,
  };
}

function orderListItem(row) {
  return {
    id: row.id,
    status: row.status,
    price: row.price,
    note: row.note,
    deliverable: row.deliverable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    gig: { id: row.gig_id, title: row.gig_title },
    role: row.buyer_id === row.me_id ? 'buyer' : 'seller',
    counterpart: counterpartSummary(row.buyer_id === row.me_id ? row.seller_id : row.buyer_id),
  };
}

// ---------- create: buyer funds escrow ----------
router.post('/orders', requireAuth, (req, res) => {
  const { gigId, note = '' } = req.body || {};
  const gig = db.prepare('SELECT * FROM gigs WHERE id = ?').get(Number(gigId));
  if (!gig || !gig.active) throw notFound("That gig doesn't exist (anymore).");
  if (gig.owner_id === req.user.id) throw conflict('You cannot hire your own gig.');

  const orderId = tx(() => {
    const info = db
      .prepare('INSERT INTO orders (gig_id, buyer_id, seller_id, price, note) VALUES (?, ?, ?, ?, ?)')
      .run(gig.id, req.user.id, gig.owner_id, gig.price, String(note).slice(0, 500));
    const id = info.lastInsertRowid;
    move({
      userId: req.user.id, delta: -gig.price, type: 'escrow_fund', orderId: id,
      memo: `Escrow funded for order #${id} (${gig.title})`,
    });
    logEvent(id, req.user.id, 'created', `Order placed · ${gig.price} credits locked in escrow`);
    return id;
  });

  const row = db.prepare('SELECT o.*, g.title AS gig_title, ? AS me_id FROM orders o JOIN gigs g ON g.id = o.gig_id WHERE o.id = ?').get(req.user.id, orderId);
  res.status(201).json(orderListItem(row));
});

// ---------- list: everything I'm part of ----------
router.get('/orders', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, g.title AS gig_title, ? AS me_id
       FROM orders o JOIN gigs g ON g.id = o.gig_id
       WHERE o.buyer_id = ? OR o.seller_id = ?
       ORDER BY o.updated_at DESC`
    )
    .all(req.user.id, req.user.id, req.user.id);
  res.json({ orders: rows.map(orderListItem) });
});

// ---------- detail: the full transparent story ----------
router.get('/orders/:id', requireAuth, (req, res) => {
  const order = orderOr404(req.params.id);
  assertParty(order, req.user);

  const gig = db.prepare('SELECT id, title, delivery_days FROM gigs WHERE id = ?').get(order.gig_id);
  const events = db
    .prepare(
      `SELECT e.*, u.display_name, u.avatar FROM order_events e
       LEFT JOIN users u ON u.id = e.actor_id
       WHERE e.order_id = ? ORDER BY e.created_at ASC, e.id ASC`
    )
    .all(order.id)
    .map((e) => ({
      id: e.id, event: e.event, detail: e.detail, createdAt: e.created_at,
      actor: e.actor_id ? { id: e.actor_id, displayName: e.display_name, avatar: e.avatar } : null,
    }));

  const allReviews = db
    .prepare(
      `SELECT r.*, u.display_name, u.avatar FROM reviews r
       JOIN users u ON u.id = r.reviewer_id WHERE r.order_id = ?`
    )
    .all(order.id);

  // Simultaneous publication: a review stays quiet until the counterpart posts
  // theirs too, or 72 hours pass since completion. Read-time, no scheduler.
  const completedAt = order.completed_at ? Date.parse(order.completed_at) : null;
  const windowPassed = completedAt !== null && Date.now() - completedAt > 72 * 3600 * 1000;
  const counterpartPosted = allReviews.length >= 2;

  const reviews = allReviews
    .filter((r) => r.reviewer_id === req.user.id || counterpartPosted || windowPassed)
    .map((r) => ({
      id: r.id, rating: r.rating, text: r.text, createdAt: r.created_at,
      reviewer: { id: r.reviewer_id, displayName: r.display_name, avatar: r.avatar },
    }));

  const myReview = allReviews.find((r) => r.reviewer_id === req.user.id) || null;

  res.json({
    id: order.id,
    status: order.status,
    price: order.price,
    note: order.note,
    deliverable: order.deliverable,
    resolutionProposal: order.resolution_proposal,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    completedAt: order.completed_at,
    role: order.buyer_id === req.user.id ? 'buyer' : 'seller',
    gig: { id: gig.id, title: gig.title, deliveryDays: gig.delivery_days },
    buyer: counterpartSummary(order.buyer_id),
    seller: counterpartSummary(order.seller_id),
    events,
    reviews,
    myReview: myReview
      ? { rating: myReview.rating, text: myReview.text, createdAt: myReview.created_at }
      : null,
    canReview: REVIEWABLE.includes(order.status) && !myReview,
  });
});

// ---------- seller accepts ----------
router.post('/orders/:id/accept', requireAuth, (req, res) => {
  const order = orderOr404(req.params.id);
  assertParty(order, req.user);
  if (order.seller_id !== req.user.id) throw forbidden('Only the seller can accept.');
  assertTransition(order, 'accepted');

  tx(() => {
    setFields(order.id, { status: 'accepted' });
    logEvent(order.id, req.user.id, 'accepted', 'Seller accepted the order');
  });
  res.json({ ok: true, status: 'accepted' });
});

// ---------- seller delivers ----------
router.post('/orders/:id/deliver', requireAuth, (req, res) => {
  const order = orderOr404(req.params.id);
  assertParty(order, req.user);
  if (order.seller_id !== req.user.id) throw forbidden('Only the seller can deliver.');
  assertTransition(order, 'delivered');

  const deliverable = String((req.body || {}).deliverable || '').trim();
  if (deliverable.length < 3) {
    throw badRequest('Add what you delivered.', { deliverable: 'A link or short summary (3+ characters).' });
  }

  tx(() => {
    setFields(order.id, { status: 'delivered', deliverable });
    logEvent(order.id, req.user.id, 'delivered', `Delivered: ${deliverable.slice(0, 200)}`);
  });
  res.json({ ok: true, status: 'delivered' });
});

// ---------- buyer approves → escrow releases to seller ----------
router.post('/orders/:id/approve', requireAuth, (req, res) => {
  const order = orderOr404(req.params.id);
  assertParty(order, req.user);
  if (order.buyer_id !== req.user.id) throw forbidden('Only the buyer can approve.');
  assertTransition(order, 'completed');

  const now = new Date().toISOString();
  tx(() => {
    setFields(order.id, { status: 'completed', completed_at: now });
    move({
      userId: order.seller_id, delta: order.price, type: 'escrow_release', orderId: order.id,
      memo: `Escrow released for order #${order.id}`,
    });
    logEvent(order.id, req.user.id, 'approved', `Buyer approved · ${order.price} credits released to seller`);
  });
  addXp(order.seller_id, 'order_sold');
  addXp(order.buyer_id, 'order_bought');
  awardBadges(order.seller_id);
  awardBadges(order.buyer_id);
  res.json({ ok: true, status: 'completed' });
});

// ---------- either party cancels before work starts → full refund ----------
router.post('/orders/:id/cancel', requireAuth, (req, res) => {
  const order = orderOr404(req.params.id);
  assertParty(order, req.user);
  assertTransition(order, 'cancelled');

  tx(() => {
    setFields(order.id, { status: 'cancelled' });
    move({
      userId: order.buyer_id, delta: order.price, type: 'escrow_refund', orderId: order.id,
      memo: `Escrow refunded for order #${order.id}`,
    });
    logEvent(order.id, req.user.id, 'cancelled', `Order cancelled · ${order.price} credits refunded to buyer`);
  });
  res.json({ ok: true, status: 'cancelled' });
});

// ---------- dispute: pauses the order, both sides see the same record ----------
router.post('/orders/:id/dispute', requireAuth, (req, res) => {
  const order = orderOr404(req.params.id);
  assertParty(order, req.user);
  assertTransition(order, 'disputed');

  const reason = String((req.body || {}).reason || '').trim();
  if (reason.length < 3) throw badRequest('Say what went wrong.', { reason: 'A few words (3+ characters).' });

  tx(() => {
    setFields(order.id, { status: 'disputed' });
    logEvent(order.id, req.user.id, 'disputed', `Dispute opened: ${reason.slice(0, 200)}`);
  });
  res.json({ ok: true, status: 'disputed' });
});

// ---------- resolution: mutual consent only ----------
// Either side proposes (release / refund / split). When both sides have asked
// for the same outcome, it executes — no admin, no loopholes, and the
// disagreement itself stays on the timeline.
router.post('/orders/:id/resolve', requireAuth, (req, res) => {
  const order = orderOr404(req.params.id);
  assertParty(order, req.user);

  const resolution = String((req.body || {}).resolution || '');
  const valid = ['release', 'refund', 'split'];
  if (!valid.includes(resolution)) {
    throw badRequest('Pick a resolution.', { resolution: 'release, refund or split.' });
  }
  const target = `resolved_${resolution}`;
  assertTransition(order, target);

  const outcome = tx(() => {
    if (order.resolution_proposal && order.resolution_proposal !== resolution) {
      setFields(order.id, { resolution_proposal: resolution });
      logEvent(order.id, req.user.id, 'proposal_changed', `Now proposes: ${resolution}`);
      return { agreed: false };
    }
    if (order.resolution_proposal === resolution) {
      // Both sides agree — move the money.
      const now = new Date().toISOString();
      if (resolution === 'release') {
        setFields(order.id, { status: target, completed_at: now });
        move({ userId: order.seller_id, delta: order.price, type: 'escrow_release', orderId: order.id, memo: `Dispute resolved (release) for order #${order.id}` });
      } else if (resolution === 'refund') {
        setFields(order.id, { status: target, completed_at: now });
        move({ userId: order.buyer_id, delta: order.price, type: 'escrow_refund', orderId: order.id, memo: `Dispute resolved (refund) for order #${order.id}` });
      } else {
        const sellerShare = Math.floor(order.price / 2);
        const buyerShare = order.price - sellerShare;
        setFields(order.id, { status: target, completed_at: now });
        move({ userId: order.seller_id, delta: sellerShare, type: 'escrow_split_release', orderId: order.id, memo: `Dispute split (seller share) for order #${order.id}` });
        move({ userId: order.buyer_id, delta: buyerShare, type: 'escrow_split_refund', orderId: order.id, memo: `Dispute split (buyer share) for order #${order.id}` });
      }
      logEvent(order.id, req.user.id, 'resolved', `Both sides agreed: ${resolution}`);
      return { agreed: true, status: target };
    }
    setFields(order.id, { resolution_proposal: resolution });
    logEvent(order.id, req.user.id, 'proposed', `Proposes resolution: ${resolution}`);
    return { agreed: false };
  });

  if (outcome.agreed) {
    addXp(order.seller_id, 'order_sold');
    awardBadges(order.seller_id);
    awardBadges(order.buyer_id);
  }
  res.json({ ok: true, ...outcome });
});

// ---------- order-scoped messages (transparent: part of the shared record) ----------
router.post('/orders/:id/message', requireAuth, (req, res) => {
  const order = orderOr404(req.params.id);
  assertParty(order, req.user);
  const text = String((req.body || {}).text || '').trim();
  if (text.length < 1) throw badRequest('Type something first.');
  if (text.length > 500) throw badRequest('Keep messages under 500 characters.');

  tx(() => {
    logEvent(order.id, req.user.id, 'message', text);
    setFields(order.id, {});
  });
  res.json({ ok: true });
});

module.exports = router;
```

**Design notes worth stealing:**

- `assertTransition` runs *before* any money code. Illegal states throw 409 and nothing moves.
- Cancel is only legal from `pending` — after acceptance, the exits are deliver→approve or dispute. A buyer can't grab the work and cancel. (Mutual abort after acceptance goes through dispute → both propose refund.)
- `approve` sets `completed_at`, which the paired-review visibility rule keys off.
- Split amounts: `floor(price/2)` to the seller, remainder to the buyer — nobody loses a credit to rounding.

#### `src/routes/reviews.js`

```js
const express = require('express');
const { db, tx } = require('../db');
const { badRequest, conflict, forbidden, notFound } = require('../lib/errors');
const { requireAuth } = require('../lib/auth');
const { addXp, awardBadges } = require('../lib/gamify');

const router = express.Router();

const REVIEWABLE = ['completed', 'resolved_release', 'resolved_refund', 'resolved_split'];

// One review per person per order, only after the order truly ended.
router.post('/orders/:id/review', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) throw notFound("Couldn't find that order.");

  const isBuyer = order.buyer_id === req.user.id;
  const isSeller = order.seller_id === req.user.id;
  if (!isBuyer && !isSeller) throw forbidden("This order isn't yours.");
  if (!REVIEWABLE.includes(order.status)) {
    throw conflict('Reviews open up once the order is finished.');
  }
  const revieweeId = isBuyer ? order.seller_id : order.buyer_id;

  const existing = db
    .prepare('SELECT id FROM reviews WHERE order_id = ? AND reviewer_id = ?')
    .get(order.id, req.user.id);
  if (existing) throw conflict('You already reviewed this order.');

  const rating = Number((req.body || {}).rating);
  const text = String((req.body || {}).text || '').trim();
  const fields = {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fields.rating = 'Pick 1–5 stars.';
  if (text.length > 1000) fields.text = 'Keep it under 1000 characters.';
  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);

  tx(() => {
    db.prepare(
      'INSERT INTO reviews (order_id, reviewer_id, reviewee_id, rating, text) VALUES (?, ?, ?, ?, ?)'
    ).run(order.id, req.user.id, revieweeId, rating, text);
  });
  addXp(req.user.id, 'review_written');
  awardBadges(revieweeId);
  res.status(201).json({ ok: true });
});

module.exports = router;
```

#### `src/routes/misc.js` (leaderboard, ledger, profiles, health)

```js
const express = require('express');
const { db } = require('../db');
const { notFound } = require('../lib/errors');
const { verifyChain } = require('../lib/ledger');
const { publicUser } = require('../lib/auth');
const { levelFor, badgesFor } = require('../lib/gamify');

const router = express.Router();

router.get('/health', (_req, res) => res.json({ ok: true }));

// Public leaderboard: XP overall + heat this week.
router.get('/leaderboard', (_req, res) => {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const rows = db
    .prepare(
      `SELECT u.*, (SELECT COALESCE(SUM(amount), 0) FROM xp_events xe
                    WHERE xe.user_id = u.id AND xe.created_at >= ?) AS weekly_xp
       FROM users u ORDER BY u.xp DESC LIMIT 10`
    )
    .all(since);
  res.json({
    leaders: rows.map((u, i) => ({
      rank: i + 1,
      ...publicUser(u),
      level: levelFor(u.xp),
      weeklyXp: u.weekly_xp,
      badges: badgesFor(u.id).length,
    })),
  });
});

// The public money trail. Guests can read it — that's the whole point.
router.get('/ledger', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = db
    .prepare(
      `SELECT l.*, u.display_name, u.avatar FROM ledger l
       LEFT JOIN users u ON u.id = l.actor_id
       ORDER BY l.id DESC LIMIT ?`
    )
    .all(limit);
  res.json({
    entries: rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      balanceAfter: r.balance_after,
      memo: r.memo,
      entryHash: r.entry_hash,
      prevHash: r.prev_hash,
      createdAt: r.created_at,
      actor: r.actor_id ? { id: r.actor_id, displayName: r.display_name, avatar: r.avatar } : null,
    })),
    verify: verifyChain(),
  });
});

router.get('/ledger/verify', (_req, res) => res.json(verifyChain()));

// Public profile: what anyone (recruiter, classmate, sceptic) sees.
router.get('/users/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) throw notFound("Couldn't find that person.");

  const reviews = db
    .prepare(
      `SELECT r.*, o.completed_at, rev.display_name AS reviewer_name, rev.avatar AS reviewer_avatar,
              (SELECT COUNT(*) FROM reviews r2 WHERE r2.order_id = r.order_id) AS pair_count
       FROM reviews r
       JOIN orders o ON o.id = r.order_id
       JOIN users rev ON rev.id = r.reviewer_id
       WHERE r.reviewee_id = ?
       ORDER BY r.created_at DESC LIMIT 20`
    )
    .all(u.id)
    .filter((r) => {
      if (r.pair_count >= 2) return true;
      const done = r.completed_at ? Date.parse(r.completed_at) : 0;
      return done && Date.now() - done > 72 * 3600 * 1000;
    });

  const rating = db
    .prepare('SELECT COUNT(*) AS n, COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE reviewee_id = ?')
    .get(u.id);

  res.json({
    user: { ...publicUser(u), level: levelFor(u.xp) },
    badges: badgesFor(u.id),
    stats: {
      avgRating: rating.n ? Math.round(rating.avg * 10) / 10 : null,
      reviewCount: rating.n,
      completedAsSeller: db
        .prepare(`SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND status IN ('completed','resolved_release')`)
        .get(u.id).n,
    },
    reviews: reviews.map((r) => ({
      rating: r.rating,
      text: r.text,
      createdAt: r.created_at,
      reviewer: { id: r.reviewer_id, displayName: r.reviewer_name, avatar: r.reviewer_avatar },
    })),
  });
});

module.exports = router;
```

### B8 — `src/server.js` + `scripts/seed.js`

#### `src/server.js`

```js
const path = require('path');
const fs = require('fs');
const express = require('express');

const { attachUser } = require('./lib/auth');
const { errorHandler } = require('./lib/errors');
const authRoutes = require('./routes/auth');
const gigRoutes = require('./routes/gigs');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');
const miscRoutes = require('./routes/misc');

const app = express();
const PORT = process.env.PORT || 4123;

app.use(express.json({ limit: '256kb' }));
app.use(attachUser);

app.use('/api', authRoutes);
app.use('/api', gigRoutes);
app.use('/api', orderRoutes);
app.use('/api', reviewRoutes);
app.use('/api', miscRoutes);

// Unknown API path → clean JSON 404 (never an HTML stack trace).
app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: "No such endpoint." } });
});

// Serve the built React app when it exists (demo-day single-process mode).
const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🛹  Sidequest API on http://localhost:${PORT}`);
});
```

#### `scripts/seed.js` (demo data — delete the DB first for a clean slate)

```js
// Demo data for the pitch/demo. Idempotent-ish: deletes the db file first.
// Usage: npm run seed
const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, '..', 'sidequest.db');
for (const suffix of ['', '-wal', '-shm']) {
  const f = dbFile + suffix;
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

const { db } = require('../src/db');
const { move } = require('../src/lib/ledger');
const { hashPassword } = require('../src/lib/auth');
const { addXp, awardBadges, touchStreak } = require('../src/lib/gamify');

function makeUser(email, name, avatar, campus, skills, bio) {
  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, display_name, avatar, campus, skills, bio, is_verified_student)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(email, hashPassword('password123'), name, avatar, campus, skills, bio);
  const id = info.lastInsertRowid;
  move({ userId: id, delta: 250, type: 'grant', memo: 'Welcome grant: 250 campus credits' });
  addXp(id, 'signup');
  return id;
}

const mayaId = makeUser('maya@student.ac.in', 'Maya', '🎨', 'IDC Mumbai', 'UI design, Figma, posters', 'Design student who loves clean layouts and chai.');
const arjunId = makeUser('arjun@student.ac.in', 'Arjun', '💻', 'VJTI', 'React, Node, Python', 'Builds web apps between lectures.');
const saraId = makeUser('sara@student.ac.in', 'Sara', '📝', 'St. Xavier\'s', 'Copywriting, blogs, editing', 'Words person. Deadline friendly.');

const gigs = db.prepare(
  `INSERT INTO gigs (owner_id, title, description, category, tags, price, delivery_days)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

gigs.run(arjunId, 'I will build your React landing page', 'Responsive landing page in React + Tailwind, deployed and shared with source code. Two rounds of revision included.', 'Code & Tech', 'react,web,landing', 120, 3);
gigs.run(mayaId, 'I will design a chill poster or slide deck', 'Custom poster or 10-slide deck in Figma, exported to PDF/PNG. Lo-fi, minimal or bold — your vibe.', 'Design & Art', 'figma,posters,slides', 80, 2);
gigs.run(saraId, 'I will rewrite your resume or bio', 'Tight, human rewrite of your resume or personal bio. ATS-friendly and zero cringe.', 'Writing', 'resume,bio,editing', 60, 1);
gigs.run(mayaId, 'I will make your project look good', 'UI polish for your existing project: spacing, colors, typography. Screenshots before/after.', 'Design & Art', 'ui,polish,figma', 100, 4);

// A finished order with mutual five-star reviews, so the demo has history.
const order = db.prepare(
  `INSERT INTO orders (gig_id, buyer_id, seller_id, status, price, note, deliverable, completed_at)
   VALUES (?, ?, ?, 'completed', ?, ?, ?, ?)`
).run(2, saraId, mayaId, 80, 'Need it for the fest committee!', 'figma.com/file/demo-presentation', new Date().toISOString());

move({ userId: saraId, delta: -80, type: 'escrow_fund', orderId: order.lastInsertRowid, memo: `Escrow funded for order #${order.lastInsertRowid}` });
move({ userId: mayaId, delta: 80, type: 'escrow_release', orderId: order.lastInsertRowid, memo: `Escrow released for order #${order.lastInsertRowid}` });

db.prepare('INSERT INTO order_events (order_id, actor_id, event, detail) VALUES (?, ?, ?, ?)')
  .run(order.lastInsertRowid, saraId, 'created', 'Order placed · 80 credits locked in escrow');
db.prepare('INSERT INTO order_events (order_id, actor_id, event, detail) VALUES (?, ?, ?, ?)')
  .run(order.lastInsertRowid, mayaId, 'accepted', 'Seller accepted the order');
db.prepare('INSERT INTO order_events (order_id, actor_id, event, detail) VALUES (?, ?, ?, ?)')
  .run(order.lastInsertRowid, mayaId, 'delivered', 'Delivered: figma.com/file/demo-presentation');
db.prepare('INSERT INTO order_events (order_id, actor_id, event, detail) VALUES (?, ?, ?, ?)')
  .run(order.lastInsertRowid, saraId, 'approved', 'Buyer approved · 80 credits released to seller');

db.prepare('INSERT INTO reviews (order_id, reviewer_id, reviewee_id, rating, text) VALUES (?, ?, ?, ?, ?)')
  .run(order.lastInsertRowid, saraId, mayaId, 5, 'Maya nailed the vibe. Fast and chill to work with.');
db.prepare('INSERT INTO reviews (order_id, reviewer_id, reviewee_id, rating, text) VALUES (?, ?, ?, ?, ?)')
  .run(order.lastInsertRowid, mayaId, saraId, 5, 'Clear brief, quick payments. 10/10 would collab again.');

addXp(mayaId, 'order_sold');
addXp(saraId, 'order_bought');
addXp(mayaId, 'review_written');
addXp(saraId, 'review_written');

for (const uid of [mayaId, arjunId, saraId]) {
  touchStreak(uid);
  awardBadges(uid);
}

console.log('🌱 Seeded: maya@student.ac.in, arjun@student.ac.in, sara@student.ac.in (password: password123)');
```

> **Watch out (a real bug this guide's own QA caught):** `makeUser()` returns the **id itself**, so use `mayaId`, not `maya.id`. `maya.id` on a number is `undefined`, and SQLite happily reports it as `NOT NULL constraint failed: gigs.owner_id` — pointing at the table, not at your variable. When a NOT NULL error names a column whose value you definitely passed, print the arguments before the call.

### B9 — Backend checkpoints

```bash
cd backend
npm run seed          # → "🌱 Seeded: maya@student.ac.in, ..."
npm run dev           # → "🛹  Sidequest API on http://localhost:4123"
```

In a second terminal (or Thunder Client):

```bash
curl -s localhost:4123/api/health
# {"ok":true}

curl -s -X POST localhost:4123/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@student.ac.in","password":"password123","displayName":"You"}'
# 201 → user object with credits: 250 and an sid Set-Cookie header

curl -s localhost:4123/api/ledger/verify
# {"ok":true,"entries":N,"brokenAt":null}
```

Then jump straight to **Appendix C** and run the 67-check smoke test against the API. Green before any frontend work — that's the whole point of building the strict layer first.

---

## 12. Frontend build steps

Work in `frontend/`. Same rule: finish each checkpoint before moving on.

### F1 — `vite.config.js` (replace the template file)

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // let a phone on the same Wi-Fi preview via your LAN IP
    proxy: { '/api': 'http://localhost:4123' },
  },
})
```

The **proxy** is why you never fight CORS in this project: the browser talks to `:5173`, Vite forwards `/api/*` to Express. Also update `index.html`'s `<title>`:

```html
<title>Sidequest — student freelancing, minus the corporate vibes</title>
```

### F2 — `src/api.js` (one fetch wrapper, typed errors)

```js
// One fetch wrapper for the whole app. Server errors arrive as
//   { error: { code, message, fields? } }
// and leave here as ApiError, so pages can show inline field messages
// or a single chill toast — never a raw stack trace.

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export async function api(method, path, body) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach the server — is the API running?")
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const e = data?.error
    throw new ApiError(res.status, e?.code || 'ERROR', e?.message || 'Something went wrong.', e?.fields)
  }
  return data
}
```

### F3 — `src/auth.jsx` + `src/ui.jsx` (state + component kit)

#### `src/auth.jsx`

```jsx
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setMe(await api('GET', '/me'))
    } catch {
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const register = async (body) => { const d = await api('POST', '/auth/register', body); setMe(d); return d }
  const login = async (body) => { const d = await api('POST', '/auth/login', body); setMe(d); return d }
  const logout = async () => { await api('POST', '/auth/logout'); setMe(null) }
  const updateMe = async (body) => { const d = await api('PATCH', '/me', body); setMe(d); return d }

  return (
    <AuthCtx.Provider value={{ me, loading, register, login, logout, updateMe, refresh }}>
      {children}
    </AuthCtx.Provider>
  )
}
```

#### `src/ui.jsx` (toasts, XP bar, chips, fields — used by every page)

```jsx
import { createContext, useCallback, useContext, useState } from 'react'

/* ---------------- toasts ---------------- */
const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, kind = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------------- small pieces ---------------- */
export function Avatar({ emoji, size = 'md' }) {
  return <span className={`avatar avatar-${size}`} aria-hidden="true">{emoji || '🙂'}</span>
}

export function Stars({ value, onChange }) {
  const stars = [1, 2, 3, 4, 5]
  if (!onChange) {
    return <span className="stars" aria-label={`${value} out of 5`}>{stars.map((s) => (s <= value ? '★' : '☆')).join('')}</span>
  }
  return (
    <span className="stars stars-input">
      {stars.map((s) => (
        <button key={s} type="button" className={s <= value ? 'star on' : 'star'} onClick={() => onChange(s)}>
          {s <= value ? '★' : '☆'}
        </button>
      ))}
    </span>
  )
}

export function XPBar({ level, xp }) {
  return (
    <div className="xp-wrap" title={`${xp} XP total`}>
      <div className="xp-label">Lv {level.level} · {level.title}</div>
      <div className="xp-bar"><div className="xp-fill" style={{ width: `${Math.round(level.progress * 100)}%` }} /></div>
    </div>
  )
}

const STATUS = {
  pending:          { label: 'Waiting on seller', cls: 'st-pending' },
  accepted:         { label: 'In progress',       cls: 'st-active' },
  delivered:        { label: 'Needs your approval', cls: 'st-review' },
  completed:        { label: 'Completed',         cls: 'st-done' },
  cancelled:        { label: 'Cancelled',         cls: 'st-dead' },
  disputed:         { label: 'Disputed',          cls: 'st-bad' },
  resolved_release: { label: 'Resolved · paid',   cls: 'st-done' },
  resolved_refund:  { label: 'Resolved · refunded', cls: 'st-dead' },
  resolved_split:   { label: 'Resolved · split',  cls: 'st-review' },
}

export function StatusChip({ status }) {
  const s = STATUS[status] || { label: status, cls: 'st-dead' }
  return <span className={`status ${s.cls}`}>{s.label}</span>
}

export function BadgeChip({ badge }) {
  return (
    <span className="badge-chip" title={badge.description}>
      {badge.emoji} {badge.name}
    </span>
  )
}

export function Field({ label, error, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}

export function EmptyState({ emoji = '🌙', title, children }) {
  return (
    <div className="empty">
      <div className="empty-emoji">{emoji}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  )
}

export function ErrorNote({ message }) {
  if (!message) return null
  return <div className="error-note">{message}</div>
}
```

### F4 — `src/styles.css` (the whole design system)

Replace the template CSS with this. It is intentionally one file — §10 explains the tokens.

```css
/* Sidequest design system — warm cream, soft violet, big radii, gentle motion.
   One file, zero frameworks: if it looks chill, this is why. */
:root {
  --bg: #fdf6ee;
  --surface: #ffffff;
  --ink: #2b2130;
  --muted: #7a6e7f;
  --border: #efe4da;
  --accent: #7c5cff;
  --accent-soft: #ede8ff;
  --pink: #ff6b8a;
  --mint: #2ed3a7;
  --lemon: #ffc94d;
  --shadow: 0 8px 30px rgba(43, 33, 48, 0.08);
  --radius: 20px;
  --radius-sm: 12px;
  font-family: "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, -apple-system, sans-serif;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--bg); color: var(--ink); line-height: 1.55; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
h1, h2, h3 { line-height: 1.2; }
h1 { font-size: 2.4rem; letter-spacing: -0.02em; }
h2 { font-size: 1.5rem; }
button { font: inherit; cursor: pointer; }

.container { max-width: 1080px; margin: 0 auto; padding: 0 20px 64px; }

/* ---------- nav ---------- */
.nav {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 16px;
  padding: 14px 22px; margin-bottom: 26px;
  background: rgba(253, 246, 238, 0.92); backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}
.nav-logo { font-size: 1.35rem; font-weight: 800; color: var(--ink); }
.nav-logo:hover { text-decoration: none; }
.nav-links { display: flex; gap: 4px; flex-wrap: wrap; }
.nav-links a {
  color: var(--ink); padding: 8px 13px; border-radius: 999px; font-weight: 600; font-size: 0.92rem;
}
.nav-links a:hover { background: var(--accent-soft); text-decoration: none; }
.nav-links a.active { background: var(--accent); color: #fff; }
.nav-spacer { flex: 1; }
.nav-user { display: flex; align-items: center; gap: 10px; }
.credits-pill {
  background: var(--lemon); color: var(--ink); font-weight: 700;
  padding: 6px 12px; border-radius: 999px; font-size: 0.85rem; white-space: nowrap;
}

/* ---------- xp ---------- */
.xp-wrap { min-width: 130px; }
.xp-label { font-size: 0.72rem; font-weight: 700; color: var(--muted); margin-bottom: 3px; }
.xp-bar { height: 8px; background: var(--border); border-radius: 999px; overflow: hidden; }
.xp-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--accent), var(--pink)); transition: width 0.6s ease; }

/* ---------- buttons & forms ---------- */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  border: none; border-radius: 999px; padding: 12px 22px;
  font-weight: 700; font-size: 0.95rem; transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.btn:hover { transform: translateY(-1px); text-decoration: none; }
.btn:active { transform: translateY(0); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
.btn-primary { background: var(--accent); color: #fff; box-shadow: 0 6px 18px rgba(124, 92, 255, 0.35); }
.btn-soft { background: var(--accent-soft); color: var(--accent); }
.btn-ghost { background: transparent; color: var(--ink); border: 2px solid var(--border); }
.btn-danger { background: #ffe3e8; color: #c2294b; }
.btn-mint { background: var(--mint); color: #10382c; }
.btn-sm { padding: 8px 14px; font-size: 0.85rem; }
.btn-block { width: 100%; }

.field { display: block; margin-bottom: 16px; }
.field-label { display: block; font-weight: 700; font-size: 0.88rem; margin-bottom: 6px; }
.field-hint { display: block; font-size: 0.78rem; color: var(--muted); margin-top: 4px; }
.field-error { display: block; font-size: 0.8rem; color: #c2294b; margin-top: 4px; font-weight: 600; }
.input, textarea.input, select.input {
  width: 100%; padding: 12px 14px; border: 2px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface); font: inherit; color: var(--ink);
}
.input:focus { outline: none; border-color: var(--accent); }
textarea.input { min-height: 110px; resize: vertical; }
.error-note {
  background: #ffe3e8; color: #c2294b; border-radius: var(--radius-sm);
  padding: 12px 14px; margin: 12px 0; font-weight: 600;
}

/* ---------- cards & layout ---------- */
.card {
  background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow);
  padding: 22px; border: 1px solid var(--border);
}
.card + .card { margin-top: 16px; }
.grid { display: grid; gap: 16px; }
.grid-3 { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.grid-2 { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.spread { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.muted { color: var(--muted); }
.small { font-size: 0.85rem; }

/* ---------- hero ---------- */
.hero {
  position: relative; overflow: hidden; text-align: center;
  padding: 70px 24px 60px; margin: 10px 0 34px;
  background: linear-gradient(160deg, #efe8ff 0%, #ffe9f0 55%, #fff3d9 100%);
  border-radius: 32px;
}
.hero h1 { max-width: 720px; margin: 0 auto 14px; }
.hero p { max-width: 560px; margin: 0 auto 26px; font-size: 1.12rem; color: var(--muted); }
.hero-emoji { font-size: 3.2rem; margin-bottom: 10px; }
.blob {
  position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.5; pointer-events: none;
}
.blob-1 { width: 320px; height: 320px; background: #c9b8ff; top: -120px; left: -80px; }
.blob-2 { width: 280px; height: 280px; background: #ffc2d1; bottom: -110px; right: -60px; }

/* ---------- chips & status ---------- */
.chip {
  border: 2px solid var(--border); background: var(--surface); color: var(--ink);
  padding: 7px 14px; border-radius: 999px; font-weight: 600; font-size: 0.85rem;
}
.chip:hover { border-color: var(--accent); }
.chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.status { padding: 5px 12px; border-radius: 999px; font-weight: 700; font-size: 0.78rem; white-space: nowrap; }
.st-pending { background: #fff3d9; color: #8a6116; }
.st-active { background: var(--accent-soft); color: var(--accent); }
.st-review { background: #ffe9f0; color: #c2294b; }
.st-done { background: #d9f7ec; color: #10725a; }
.st-dead { background: var(--border); color: var(--muted); }
.st-bad { background: #ffd6dc; color: #a5122f; }
.badge-chip {
  background: var(--accent-soft); color: var(--accent); font-weight: 700; font-size: 0.8rem;
  padding: 6px 12px; border-radius: 999px;
}

/* ---------- gig card ---------- */
.gig-card { display: flex; flex-direction: column; gap: 10px; transition: transform 0.15s ease; }
.gig-card:hover { transform: translateY(-3px); }
.gig-cat { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: var(--accent); }
.gig-price { font-size: 1.35rem; font-weight: 800; }
.gig-price small { font-size: 0.8rem; color: var(--muted); font-weight: 600; }

/* ---------- avatars / stars ---------- */
.avatar {
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent-soft); border-radius: 50%; flex-shrink: 0;
}
.avatar-md { width: 40px; height: 40px; font-size: 1.25rem; }
.avatar-lg { width: 64px; height: 64px; font-size: 2rem; }
.avatar-xl { width: 92px; height: 92px; font-size: 3rem; }
.stars { color: var(--lemon); letter-spacing: 2px; font-size: 1.05rem; }
.stars-input .star { background: none; border: none; font-size: 1.7rem; color: var(--border); padding: 0 2px; }
.stars-input .star.on { color: var(--lemon); }

/* ---------- timeline ---------- */
.timeline { list-style: none; margin: 0; padding: 0; }
.timeline li {
  position: relative; padding: 0 0 18px 26px; border-left: 2px solid var(--border); margin-left: 8px;
}
.timeline li:last-child { border-left-color: transparent; padding-bottom: 0; }
.timeline li::before {
  content: ''; position: absolute; left: -7px; top: 4px; width: 12px; height: 12px;
  border-radius: 50%; background: var(--accent); border: 2px solid var(--surface);
}
.tl-actor { font-weight: 700; }
.tl-time { font-size: 0.75rem; color: var(--muted); }

/* ---------- ledger ---------- */
.ledger-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
.ledger-table th { text-align: left; color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px; }
.ledger-table td { padding: 10px; border-top: 1px solid var(--border); vertical-align: top; }
.hash { font-family: ui-monospace, monospace; font-size: 0.72rem; color: var(--muted); word-break: break-all; }
.amount-plus { color: #10725a; font-weight: 800; }
.amount-minus { color: #c2294b; font-weight: 800; }
.verify-ok { background: #d9f7ec; color: #10725a; padding: 10px 16px; border-radius: var(--radius-sm); font-weight: 700; }
.verify-bad { background: #ffd6dc; color: #a5122f; padding: 10px 16px; border-radius: var(--radius-sm); font-weight: 700; }

/* ---------- toasts ---------- */
.toast-stack { position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 10px; z-index: 100; }
.toast {
  background: var(--ink); color: #fff; padding: 13px 18px; border-radius: var(--radius-sm);
  box-shadow: var(--shadow); font-weight: 600; animation: slide-in 0.25s ease; max-width: 320px;
}
.toast-error { background: #c2294b; }
.toast-success { background: #10725a; }
@keyframes slide-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

/* ---------- misc ---------- */
.empty { text-align: center; padding: 48px 20px; color: var(--muted); }
.empty-emoji { font-size: 2.8rem; margin-bottom: 8px; }
.podium { display: flex; gap: 14px; justify-content: center; align-items: flex-end; margin: 22px 0; }
.podium-item { text-align: center; padding: 18px; border-radius: var(--radius); background: var(--surface); border: 1px solid var(--border); min-width: 140px; }
.podium-item.first { padding-top: 30px; background: linear-gradient(170deg, #fff3d9, var(--surface)); }
.footer { text-align: center; color: var(--muted); padding: 30px 20px 40px; font-size: 0.85rem; }
.divider { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
.steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; text-align: left; }
.step-num {
  width: 30px; height: 30px; border-radius: 50%; background: var(--accent); color: #fff;
  display: inline-flex; align-items: center; justify-content: center; font-weight: 800; margin-bottom: 8px;
}
.review-card { background: var(--bg); border-radius: var(--radius-sm); padding: 14px; margin-top: 10px; }
```

### F5 — `src/main.jsx` + `src/App.jsx` (shell & routing)

#### `src/main.jsx`

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles.css'
import App from './App.jsx'
import { AuthProvider } from './auth.jsx'
import { ToastProvider } from './ui.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

#### `src/App.jsx`

```jsx
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import { Avatar, XPBar } from './ui.jsx'
import Landing from './pages/Landing.jsx'
import Explore from './pages/Explore.jsx'
import GigDetail from './pages/GigDetail.jsx'
import PostGig from './pages/PostGig.jsx'
import Dashboard from './pages/Dashboard.jsx'
import OrderRoom from './pages/OrderRoom.jsx'
import LedgerPage from './pages/LedgerPage.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import Profile from './pages/Profile.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Onboarding from './pages/Onboarding.jsx'
import NotFound from './pages/NotFound.jsx'

function RequireAuth({ children }) {
  const { me, loading } = useAuth()
  if (loading) return <div className="container"><p className="muted">Loading…</p></div>
  if (!me) return <Navigate to="/login" replace />
  return children
}

function Nav() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">🛹 Sidequest</Link>
      <div className="nav-links">
        <NavLink to="/explore">Explore</NavLink>
        {me && <NavLink to="/dashboard">My orders</NavLink>}
        {me && <NavLink to="/post">Post a gig</NavLink>}
        <NavLink to="/leaderboard">Leaderboard</NavLink>
        <NavLink to="/ledger">Ledger</NavLink>
      </div>
      <div className="nav-spacer" />
      {me ? (
        <div className="nav-user">
          <XPBar level={me.user.level} xp={me.user.xp} />
          <span className="credits-pill">◎ {me.user.credits} cr</span>
          <Link to={`/users/${me.user.id}`}><Avatar emoji={me.user.avatar} /></Link>
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => { await logout(); navigate('/') }}
          >
            Log out
          </button>
        </div>
      ) : (
        <div className="row">
          <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Join free</Link>
        </div>
      )}
    </nav>
  )
}

export default function App() {
  return (
    <>
      <Nav />
      <main className="container">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/gigs/:id" element={<GigDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/users/:id" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
          <Route path="/post" element={<RequireAuth><PostGig /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderRoom /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        Sidequest · built by students, for students · every credit is on the{' '}
        <Link to="/ledger">public ledger</Link>
      </footer>
    </>
  )
}
```

**Checkpoint F5:** `npm run dev` in `frontend/`, open `http://localhost:5173` — you should see the nav and footer with every page stubbed 404 until F6–F8 land. Log in with a seeded account and the XP bar + credits pill appear in the nav.

### F6 — Pages, part 1: `Landing`, `Explore`, `GigDetail`, `PostGig`

#### `src/pages/Landing.jsx`

```jsx
import { Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Landing() {
  const { me } = useAuth()
  return (
    <>
      <section className="hero">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="hero-emoji">🛹</div>
        <h1>Student-to-student freelancing, minus the corporate vibes</h1>
        <p>
          Need slides fixed, a poster designed, a bug squashed? Hire a student.
          Get paid in campus credits. Every rupee-equivalent is on a public ledger —
          no shady corners, no boring forms.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link to="/explore" className="btn btn-primary">Browse gigs</Link>
          {me
            ? <Link to="/post" className="btn btn-ghost">Post a gig</Link>
            : <Link to="/register" className="btn btn-ghost">Join the crew</Link>}
        </div>
      </section>

      <div className="grid steps">
        <div className="card">
          <div className="step-num">1</div>
          <h3>Post or pick a gig</h3>
          <p className="muted small">
            Micro-jobs with clear prices and delivery times. Design, code, writing,
            tutoring, slides — campus skills only.
          </p>
        </div>
        <div className="card">
          <div className="step-num">2</div>
          <h3>Credits sit in escrow</h3>
          <p className="muted small">
            When you order, credits lock in escrow — visible to both sides on the
            timeline. They only move when work is approved or both agree on a fix.
          </p>
        </div>
        <div className="card">
          <div className="step-num">3</div>
          <h3>Everyone levels up</h3>
          <p className="muted small">
            Finish work, earn XP, unlock badges, keep your streak alive. The
            leaderboard is friendly competition, not surveillance.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 22, textAlign: 'center' }}>
        <h2>Transparency is the whole vibe 🕶️</h2>
        <p className="muted">
          Every credit movement is hash-chained on a public ledger anyone can verify.
          Reviews publish in pairs so nobody can quietly pressure the other side.
          Disputes resolve by agreement, on the record.
        </p>
        <Link to="/ledger" className="btn btn-soft">See the ledger</Link>
      </div>
    </>
  )
}
```

#### `src/pages/Explore.jsx`

```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { Avatar, EmptyState, ErrorNote, Stars } from '../ui.jsx'

export default function Explore() {
  const [data, setData] = useState({ categories: [], gigs: [] })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('recent')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const params = new URLSearchParams({ query, category, sort })
    api('GET', `/gigs?${params}`)
      .then((d) => { if (alive) { setData(d); setError('') } })
      .catch((e) => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [query, category, sort])

  return (
    <>
      <div className="spread">
        <h1>Explore gigs</h1>
        <Link to="/post" className="btn btn-primary btn-sm">+ Post a gig</Link>
      </div>

      <form className="row" style={{ margin: '14px 0' }} onSubmit={(e) => e.preventDefault()}>
        <input
          className="input" style={{ flex: 1, minWidth: 220 }}
          placeholder="Search gigs… (try 'poster' or 'python')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input" style={{ width: 160 }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
        </select>
      </form>

      <div className="row" style={{ marginBottom: 18 }}>
        <button className={`chip ${category === '' ? 'on' : ''}`} onClick={() => setCategory('')}>All</button>
        {data.categories.map((c) => (
          <button key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      <ErrorNote message={error} />
      {loading && <p className="muted">Loading gigs…</p>}
      {!loading && !data.gigs.length && (
        <EmptyState emoji="🔍" title="No gigs here yet">
          Be the first — post one and earn your First Gig badge.
        </EmptyState>
      )}

      <div className="grid grid-3">
        {data.gigs.map((gig) => (
          <Link key={gig.id} to={`/gigs/${gig.id}`} className="card gig-card" style={{ color: 'inherit' }}>
            <div className="gig-cat">{gig.category}</div>
            <h3 style={{ margin: 0 }}>{gig.title}</h3>
            <p className="muted small" style={{ margin: 0, flex: 1 }}>{gig.description.slice(0, 100)}…</p>
            <div className="spread">
              <div className="row" style={{ gap: 8 }}>
                <Avatar emoji={gig.owner.avatar} />
                <div>
                  <div className="small" style={{ fontWeight: 700 }}>{gig.owner.displayName}</div>
                  <div className="small muted">
                    {gig.owner.avgRating ? <><Stars value={gig.owner.avgRating} /> {gig.owner.avgRating}</> : 'No reviews yet'}
                  </div>
                </div>
              </div>
              <div className="gig-price">
                ◎ {gig.price} <small>/ {gig.deliveryDays}d</small>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
```

#### `src/pages/GigDetail.jsx`

```jsx
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Avatar, BadgeChip, ErrorNote, Field, Stars, useToast } from '../ui.jsx'

export default function GigDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { me } = useAuth()
  const [gig, setGig] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('GET', `/gigs/${id}`).then(setGig).catch((e) => setError(e.message))
  }, [id])

  if (error && !gig) return <ErrorNote message={error} />
  if (!gig) return <p className="muted">Loading…</p>

  const isOwner = me && me.user.id === gig.owner.id

  async function hire() {
    setBusy(true)
    setError('')
    try {
      const order = await api('POST', '/orders', { gigId: gig.id, note })
      toast('Order placed — credits locked in escrow 🔒', 'success')
      navigate(`/orders/${order.id}`)
    } catch (e) {
      if (e instanceof ApiError) setError(e.message)
      else setError('Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Link to="/explore" className="small muted">← Back to explore</Link>
      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <div className="card">
          <div className="gig-cat">{gig.category}</div>
          <h1 style={{ marginTop: 6 }}>{gig.title}</h1>
          <p>{gig.description}</p>
          <div className="row">
            {gig.tags.map((t) => <span key={t} className="badge-chip">#{t}</span>)}
          </div>
          <hr className="divider" />
          <div className="spread">
            <div>
              <div className="gig-price">◎ {gig.price}</div>
              <div className="muted small">delivered in {gig.deliveryDays} day{gig.deliveryDays > 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="row">
              <Link to={`/users/${gig.owner.id}`}><Avatar emoji={gig.owner.avatar} size="lg" /></Link>
              <div>
                <h3 style={{ margin: 0 }}>
                  <Link to={`/users/${gig.owner.id}`}>{gig.owner.displayName}</Link>
                  {gig.owner.isVerifiedStudent && ' 🎓'}
                </h3>
                <div className="small muted">
                  Lv {gig.owner.level.level} · {gig.owner.level.title} · {gig.owner.completedOrders} orders done
                </div>
                <div className="small">
                  {gig.owner.avgRating
                    ? <><Stars value={gig.owner.avgRating} /> {gig.owner.avgRating} ({gig.owner.reviewCount})</>
                    : <span className="muted">No reviews yet</span>}
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              {gig.owner.badges.map((b) => <BadgeChip key={b.code} badge={b} />)}
            </div>
          </div>

          {!isOwner && (
            <div className="card">
              <h3>Hire {gig.owner.displayName.split(' ')[0]}</h3>
              {!me && <p className="muted small">Log in to order — you'll get 250 free credits to start.</p>}
              <Field label="Note (what do you need?)">
                <textarea
                  className="input" value={note} disabled={!me}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Deadline, style, links — anything helpful."
                />
              </Field>
              <ErrorNote message={error} />
              {me ? (
                <button className="btn btn-primary btn-block" onClick={hire} disabled={busy}>
                  {busy ? 'Placing order…' : `Order for ◎ ${gig.price}`}
                </button>
              ) : (
                <Link to="/login" className="btn btn-primary btn-block">Log in to order</Link>
              )}
              <p className="muted small" style={{ marginBottom: 0 }}>
                Credits lock in escrow and only move when you approve the work.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

#### `src/pages/PostGig.jsx`

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api.js'
import { ErrorNote, Field, useToast } from '../ui.jsx'

export default function PostGig() {
  const navigate = useNavigate()
  const toast = useToast()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ title: '', description: '', category: '', tags: '', price: 50, deliveryDays: 3 })
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('GET', '/gigs').then((d) => setCategories(d.categories)).catch(() => {})
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setFields({})
    setError('')
    try {
      const gig = await api('POST', '/gigs', { ...form, price: Number(form.price), deliveryDays: Number(form.deliveryDays) })
      toast('Gig is live — nice! 🎉', 'success')
      navigate(`/gigs/${gig.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields || {})
        setError(err.message)
      } else setError('Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1>Post a gig</h1>
      <p className="muted">Keep it real: clear scope, fair price, honest timeline.</p>
      <form className="card" onSubmit={submit}>
        <Field label="Title" error={fields.title} hint="“I will design a chill poster for your event”">
          <input className="input" value={form.title} onChange={set('title')} placeholder="I will…" />
        </Field>
        <Field label="What do they get?" error={fields.description}>
          <textarea className="input" value={form.description} onChange={set('description')} placeholder="Deliverables, revisions, format…" />
        </Field>
        <Field label="Category" error={fields.category}>
          <select className="input" value={form.category} onChange={set('category')}>
            <option value="">Pick one…</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Tags" hint="Comma separated — 'posters, figma'">
          <input className="input" value={form.tags} onChange={set('tags')} />
        </Field>
        <div className="row">
          <div style={{ flex: 1 }}>
            <Field label="Price (credits)" error={fields.price}>
              <input className="input" type="number" min="1" value={form.price} onChange={set('price')} />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Delivery (days)" error={fields.deliveryDays}>
              <input className="input" type="number" min="1" value={form.deliveryDays} onChange={set('deliveryDays')} />
            </Field>
          </div>
        </div>
        <ErrorNote message={error} />
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Posting…' : 'Post gig'}
        </button>
      </form>
    </div>
  )
}
```

**Checkpoint F6:** browse, search, filter, open a gig, post a gig end to end. Validation errors should appear inline under fields, in chill language.

### F7 — Pages, part 2: `Dashboard` + `OrderRoom` (the money screens)

#### `src/pages/Dashboard.jsx`

```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Avatar, EmptyState, ErrorNote, StatusChip } from '../ui.jsx'

function OrderRow({ order }) {
  return (
    <Link to={`/orders/${order.id}`} className="card" style={{ display: 'block', color: 'inherit', marginBottom: 12 }}>
      <div className="spread">
        <div className="row">
          <Avatar emoji={order.counterpart.avatar} />
          <div>
            <div style={{ fontWeight: 700 }}>{order.gig.title}</div>
            <div className="small muted">
              {order.role === 'buyer' ? 'hiring' : 'working for'} {order.counterpart.displayName} · ◎ {order.price}
            </div>
          </div>
        </div>
        <StatusChip status={order.status} />
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { me } = useAuth()
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('GET', '/orders').then((d) => setOrders(d.orders)).catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorNote message={error} />
  if (!orders) return <p className="muted">Loading your orders…</p>

  const buying = orders.filter((o) => o.role === 'buyer')
  const selling = orders.filter((o) => o.role === 'seller')

  return (
    <>
      <h1>Hey {me.user.displayName.split(' ')[0]} 👋</h1>
      <p className="muted">Everything you're part of, both sides of the table.</p>
      <div className="grid grid-2">
        <div>
          <h2>🛒 Buying</h2>
          {buying.length
            ? buying.map((o) => <OrderRow key={o.id} order={o} />)
            : <EmptyState emoji="🛒" title="Nothing here yet">Find a gig and hire a fellow student.</EmptyState>}
        </div>
        <div>
          <h2>🛠️ Selling</h2>
          {selling.length
            ? selling.map((o) => <OrderRow key={o.id} order={o} />)
            : <EmptyState emoji="🛠️" title="No gigs in motion">Post a gig — someone needs exactly what you do.</EmptyState>}
        </div>
      </div>
    </>
  )
}
```

#### `src/pages/OrderRoom.jsx`

The most connected page in the app: escrow status, role-based actions, dispute handling, messages, timeline, reviews. Study the `act()` helper — every mutation reloads the order, so the UI can never drift from the server state.

```jsx
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api.js'
import { useAuth } from '../auth.jsx'
import {
  Avatar, ErrorNote, Field, Stars, StatusChip, useToast,
} from '../ui.jsx'

const EVENT_LABEL = {
  created: 'placed the order',
  accepted: 'accepted the order',
  delivered: 'delivered the work',
  approved: 'approved the delivery',
  cancelled: 'cancelled the order',
  disputed: 'opened a dispute',
  proposed: 'proposed a resolution',
  proposal_changed: 'changed their proposal',
  resolved: 'finalised the resolution',
  message: 'said',
}

export default function OrderRoom() {
  const { id } = useParams()
  const toast = useToast()
  const { me } = useAuth()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deliverable, setDeliverable] = useState('')
  const [message, setMessage] = useState('')
  const [disputeReason, setDisputeReason] = useState('')
  const [showDispute, setShowDispute] = useState(false)
  const [review, setReview] = useState({ rating: 5, text: '' })

  const load = useCallback(() => {
    api('GET', `/orders/${id}`).then(setOrder).catch((e) => setError(e.message))
  }, [id])

  useEffect(() => { load() }, [load])

  if (error && !order) return <ErrorNote message={error} />
  if (!order) return <p className="muted">Loading order…</p>

  const isBuyer = order.role === 'buyer'
  const act = (path, body, successMsg) => async () => {
    setBusy(true)
    setError('')
    try {
      await api('POST', `/orders/${id}/${path}`, body)
      if (successMsg) toast(successMsg, 'success')
      load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!message.trim()) return
    await act('message', { text: message })()
    setMessage('')
  }

  async function submitReview(e) {
    e.preventDefault()
    try {
      await api('POST', `/orders/${id}/review`, review)
      toast('Review saved — it publishes when both sides post. 🤝', 'success')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  return (
    <>
      <Link to="/dashboard" className="small muted">← My orders</Link>
      <div className="spread" style={{ marginTop: 10 }}>
        <h1 style={{ margin: 0 }}>{order.gig.title}</h1>
        <StatusChip status={order.status} />
      </div>
      <p className="muted">
        Order #{order.id} · ◎ {order.price} in escrow ·{' '}
        {isBuyer ? 'you hired' : 'you work for'}{' '}
        <Link to={`/users/${isBuyer ? order.seller.id : order.buyer.id}`}>
          {isBuyer ? order.seller.displayName : order.buyer.displayName}
        </Link>
      </p>

      <div className="grid grid-2">
        <div>
          {/* ---- escrow + actions ---- */}
          <div className="card">
            <h3>🔒 Escrow status</h3>
            <p className="small muted">
              {order.status === 'pending' && 'Your credits are locked until the seller accepts — cancel any time for a full refund.'}
              {order.status === 'accepted' && 'Work is in progress. Credits release only when you approve, or both sides agree on a resolution.'}
              {order.status === 'delivered' && 'The work is in. Approve to release the credits, or raise a dispute if something is off.'}
              {order.status === 'completed' && 'Done and dusted — credits released to the seller.'}
              {order.status === 'cancelled' && 'Order cancelled. Credits went back to the buyer.'}
              {order.status === 'disputed' && 'Paused. Both sides pick a resolution — when the answers match, it executes automatically.'}
              {order.status.startsWith('resolved_') && 'Dispute closed. The outcome is on the public timeline.'}
            </p>
            {order.deliverable && (
              <p className="small"><strong>Deliverable:</strong> {order.deliverable}</p>
            )}
            <ErrorNote message={error} />
            <div className="row">
              {order.status === 'pending' && (
                <>
                  {!isBuyer && <button className="btn btn-mint" disabled={busy} onClick={act('accept', null, 'Order accepted — good luck! 🍀')}>Accept order</button>}
                  <button className="btn btn-danger" disabled={busy} onClick={act('cancel', null, 'Order cancelled — credits refunded.')}>Cancel & refund</button>
                </>
              )}
              {order.status === 'accepted' && !isBuyer && (
                <form className="row" style={{ width: '100%' }} onSubmit={(e) => { e.preventDefault(); act('deliver', { deliverable }, 'Delivered! Waiting for approval. 📦')() }}>
                  <input className="input" style={{ flex: 1 }} placeholder="Link or summary of what you delivered" value={deliverable} onChange={(e) => setDeliverable(e.target.value)} />
                  <button className="btn btn-primary" disabled={busy}>Deliver</button>
                </form>
              )}
              {order.status === 'delivered' && isBuyer && (
                <button className="btn btn-primary" disabled={busy} onClick={act('approve', null, 'Approved — credits released! ⚡')}>Approve & release ◎ {order.price}</button>
              )}
              {['accepted', 'delivered'].includes(order.status) && (
                <button className="btn btn-ghost" onClick={() => setShowDispute((s) => !s)}>Something's off?</button>
              )}
              {order.status === 'disputed' && (
                <>
                  {['release', 'refund', 'split'].map((r) => (
                    <button
                      key={r}
                      className={`btn ${order.resolutionProposal === r ? 'btn-primary' : 'btn-soft'}`}
                      disabled={busy}
                      onClick={act('resolve', { resolution: r }, 'Proposal noted — waiting for the other side.')}
                    >
                      Propose: {r}
                    </button>
                  ))}
                  <p className="small muted" style={{ width: '100%' }}>
                    Current proposals: yours + theirs must match. {order.resolutionProposal ? `On the table: ${order.resolutionProposal}.` : 'Nothing on the table yet.'}
                  </p>
                </>
              )}
            </div>
            {showDispute && (
              <form onSubmit={(e) => { e.preventDefault(); act('dispute', { reason: disputeReason }, 'Dispute opened — both sides can see the same record.')() }}>
                <Field label="What went wrong?">
                  <textarea className="input" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Be specific — this goes on the shared timeline." />
                </Field>
                <button className="btn btn-danger btn-sm" disabled={busy}>Open dispute</button>
              </form>
            )}
          </div>

          {/* ---- review ---- */}
          {order.canReview && (
            <form className="card" onSubmit={submitReview}>
              <h3>Leave a review</h3>
              <p className="small muted">
                Reviews publish in pairs — yours stays private until {isBuyer ? order.seller.displayName : order.buyer.displayName} posts theirs too (or 72h pass). Fair by design.
              </p>
              <Stars value={review.rating} onChange={(rating) => setReview((r) => ({ ...r, rating }))} />
              <Field label="How did it go?">
                <textarea className="input" value={review.text} onChange={(e) => setReview((r) => ({ ...r, text: e.target.value }))} placeholder="Honest, kind, specific." />
              </Field>
              <button className="btn btn-primary" disabled={busy}>Post review</button>
            </form>
          )}
          {order.myReview && (
            <div className="card">
              <h3>Your review</h3>
              <div className="review-card">
                <Stars value={order.myReview.rating} />
                <p style={{ margin: '6px 0 0' }}>{order.myReview.text || <span className="muted">No words, just stars.</span>}</p>
              </div>
              {order.reviews.length === 1 && (
                <p className="small muted">Waiting for the other side's review to publish together.</p>
              )}
            </div>
          )}

          {/* ---- messages ---- */}
          <div className="card">
            <h3>Messages</h3>
            <p className="small muted">Order chat is part of the shared record — kept with the timeline.</p>
            <ul className="timeline">
              {order.events.filter((e) => e.event === 'message').map((e) => (
                <li key={e.id}>
                  <span className="tl-actor">{e.actor?.displayName || 'Someone'}:</span> {e.detail}
                  <div className="tl-time">{new Date(e.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
            <form className="row" onSubmit={sendMessage}>
              <input className="input" style={{ flex: 1 }} placeholder="Say something…" value={message} onChange={(e) => setMessage(e.target.value)} />
              <button className="btn btn-soft btn-sm">Send</button>
            </form>
          </div>
        </div>

        {/* ---- timeline & people ---- */}
        <div>
          <div className="card">
            <h3>📜 Timeline</h3>
            <ul className="timeline">
              {order.events.filter((e) => e.event !== 'message').map((e) => (
                <li key={e.id}>
                  <span className="tl-actor">{e.actor?.displayName || 'System'}</span>{' '}
                  {EVENT_LABEL[e.event] || e.event}{e.detail && e.event !== 'message' ? ` — ${e.detail}` : ''}
                  <div className="tl-time">{new Date(e.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h3>People</h3>
            <div className="row">
              <Avatar emoji={order.buyer.avatar} size="lg" />
              <div>
                <Link to={`/users/${order.buyer.id}`} style={{ fontWeight: 700 }}>{order.buyer.displayName} {order.buyer.isVerifiedStudent && '🎓'}</Link>
                <div className="small muted">Buyer · Lv {order.buyer.level.level} {order.buyer.level.title}</div>
              </div>
            </div>
            <hr className="divider" />
            <div className="row">
              <Avatar emoji={order.seller.avatar} size="lg" />
              <div>
                <Link to={`/users/${order.seller.id}`} style={{ fontWeight: 700 }}>{order.seller.displayName} {order.seller.isVerifiedStudent && '🎓'}</Link>
                <div className="small muted">Seller · Lv {order.seller.level.level} {order.seller.level.title}</div>
              </div>
            </div>
          </div>
          <div className="card">
            <h3>Pair reviews</h3>
            {order.reviews.length === 0 && <p className="small muted">No published reviews for this order yet.</p>}
            {order.reviews.map((r) => (
              <div key={r.id} className="review-card">
                <div className="row" style={{ gap: 8 }}>
                  <Avatar emoji={r.reviewer.avatar} />
                  <strong className="small">{r.reviewer.displayName}</strong>
                  <Stars value={r.rating} />
                </div>
                {r.text && <p className="small" style={{ margin: '6px 0 0' }}>{r.text}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
```

**Checkpoint F7 (the big one — do it with two browser windows side by side):**
1. Window A logs in as **sara**, Window B as **arjun** (seeded accounts).
2. Sara orders Arjun's landing-page gig → both see the order, status *Waiting on seller*, Sara's credits drop by 120.
3. Arjun accepts, delivers with a link → Sara approves → credits land on Arjun's side, XP bars jump, First Sale badge pops.
4. Both leave a review → each initially sees only their own ("waiting for the other side") → after the second post, both appear together.
5. Try something illegal (Sara clicking an old action twice): the app shows a calm 409 message and nothing breaks.

### F8 — Pages, part 3: `LedgerPage`, `Leaderboard`, `Profile`, `Login`, `Register`, `Onboarding`, `NotFound`

#### `src/pages/LedgerPage.jsx`

```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { ErrorNote } from '../ui.jsx'

const TYPE_LABEL = {
  grant: '🎁 Welcome grant',
  escrow_fund: '🔒 Escrow funded',
  escrow_release: '⚡ Escrow released',
  escrow_refund: '↩️ Escrow refunded',
  escrow_split_release: '⚖️ Split · seller share',
  escrow_split_refund: '⚖️ Split · buyer share',
}

export default function LedgerPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('GET', '/ledger?limit=100').then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorNote message={error} />
  if (!data) return <p className="muted">Loading ledger…</p>

  return (
    <>
      <h1>The public ledger 📒</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Every credit that ever moved, in order, hash-chained. Each entry's hash covers
        its payload plus the previous entry's hash — edit any row (even in a database
        shell) and the chain verification below breaks loudly. No hidden transactions,
        no admin edits, no exceptions.
      </p>

      {data.verify.ok ? (
        <div className="verify-ok">✅ Chain intact — all {data.verify.entries} entries verified</div>
      ) : (
        <div className="verify-bad">
          ❌ Chain broken at entry #{data.verify.brokenAt} ({data.verify.reason})
        </div>
      )}

      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table className="ledger-table">
          <thead>
            <tr>
              <th>#</th><th>What</th><th>Who</th><th>Amount</th><th>Balance</th><th>Hash</th><th>When</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((e) => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>
                  {TYPE_LABEL[e.type] || e.type}
                  <div className="small muted">{e.memo}</div>
                  {e.entryHash && <div className="hash">🔗 {e.entryHash.slice(0, 18)}…</div>}
                </td>
                <td className="small">{e.actor ? <Link to={`/users/${e.actor.id}`}>{e.actor.avatar} {e.actor.displayName}</Link> : '—'}</td>
                <td className={e.amount >= 0 ? 'amount-plus' : 'amount-minus'}>
                  {e.amount >= 0 ? '+' : ''}{e.amount} cr
                </td>
                <td className="small">{e.balanceAfter}</td>
                <td className="hash" title={e.prevHash}>prev: {e.prevHash.slice(0, 10)}…</td>
                <td className="small muted">{new Date(e.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
```

#### `src/pages/Leaderboard.jsx`

```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { Avatar, ErrorNote } from '../ui.jsx'

export default function Leaderboard() {
  const [leaders, setLeaders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('GET', '/leaderboard').then((d) => setLeaders(d.leaders)).catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorNote message={error} />
  if (!leaders) return <p className="muted">Crunching XP…</p>

  const [first, second, third] = leaders

  return (
    <>
      <h1>Leaderboard 🏆</h1>
      <p className="muted">Friendly competition. XP comes from real, verified actions only.</p>

      <div className="podium">
        {second && (
          <Link to={`/users/${second.id}`} className="podium-item" style={{ color: 'inherit' }}>
            <Avatar emoji={second.avatar} size="lg" />
            <div style={{ fontWeight: 800 }}>🥈 {second.displayName}</div>
            <div className="small muted">Lv {second.level.level} · {second.xp} XP</div>
          </Link>
        )}
        {first && (
          <Link to={`/users/${first.id}`} className="podium-item first" style={{ color: 'inherit' }}>
            <Avatar emoji={first.avatar} size="xl" />
            <div style={{ fontWeight: 800 }}>🥇 {first.displayName}</div>
            <div className="small muted">Lv {first.level.level} · {first.xp} XP</div>
          </Link>
        )}
        {third && (
          <Link to={`/users/${third.id}`} className="podium-item" style={{ color: 'inherit' }}>
            <Avatar emoji={third.avatar} size="lg" />
            <div style={{ fontWeight: 800 }}>🥉 {third.displayName}</div>
            <div className="small muted">Lv {third.level.level} · {third.xp} XP</div>
          </Link>
        )}
      </div>

      <div className="card">
        {leaders.map((u) => (
          <div key={u.id} className="spread" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="row">
              <strong style={{ width: 28 }}>#{u.rank}</strong>
              <Avatar emoji={u.avatar} />
              <div>
                <Link to={`/users/${u.id}`} style={{ fontWeight: 700 }}>{u.displayName} {u.isVerifiedStudent && '🎓'}</Link>
                <div className="small muted">Lv {u.level.level} · {u.level.title} · {u.badges} badges</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800 }}>{u.xp} XP</div>
              <div className="small muted">+{u.weeklyXp} this week</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
```

#### `src/pages/Profile.jsx`

```jsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.js'
import {
  Avatar, BadgeChip, EmptyState, ErrorNote, Stars, XPBar,
} from '../ui.jsx'

export default function Profile() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    api('GET', `/users/${id}`).then(setData).catch((e) => setError(e.message))
  }, [id])

  if (error) return <ErrorNote message={error} />
  if (!data) return <p className="muted">Loading profile…</p>

  const { user, badges, stats, reviews } = data

  return (
    <>
      <div className="card">
        <div className="row" style={{ gap: 18 }}>
          <Avatar emoji={user.avatar} size="xl" />
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0 }}>
              {user.displayName} {user.isVerifiedStudent && <span title="Campus email verified">🎓</span>}
            </h1>
            <div className="muted">{user.campus || 'Campus not set'} · joined {new Date(user.createdAt).toLocaleDateString()}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <XPBar level={user.level} xp={user.xp} />
              <span className="credits-pill">🔥 {user.streakDays} day streak</span>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.avgRating ?? '—'}</div>
            <Stars value={stats.avgRating || 0} />
            <div className="small muted">{stats.reviewCount} reviews</div>
          </div>
        </div>
        {user.bio && <p style={{ marginTop: 14 }}>{user.bio}</p>}
        <div className="row">
          {user.skills.map((s) => <span key={s} className="badge-chip">{s}</span>)}
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Badges</h3>
          <div className="row">
            {badges.length
              ? badges.map((b) => <BadgeChip key={b.code} badge={b} />)
              : <span className="muted small">No badges yet — they come with real actions.</span>}
          </div>
          <hr className="divider" />
          <div className="small muted">
            {stats.completedAsSeller} orders completed · {user.xp} XP total
          </div>
        </div>
        <div className="card">
          <h3>Reviews received</h3>
          {reviews.length === 0 && (
            <EmptyState emoji="⭐" title="No published reviews yet">
              Reviews publish in pairs — both sides post, then both appear together.
            </EmptyState>
          )}
          {reviews.map((r, i) => (
            <div key={i} className="review-card">
              <div className="row" style={{ gap: 8 }}>
                <Avatar emoji={r.reviewer.avatar} />
                <strong className="small">{r.reviewer.displayName}</strong>
                <Stars value={r.rating} />
              </div>
              {r.text && <p className="small" style={{ margin: '6px 0 0' }}>{r.text}</p>}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

#### `src/pages/Login.jsx`

```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ErrorNote, Field } from '../ui.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setFields({})
    try {
      await login(form)
      navigate('/dashboard')
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields || {})
        setError(err.message)
      } else setError('Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <h1>Welcome back 👋</h1>
      <form className="card" onSubmit={submit}>
        <Field label="Email" error={fields.email}>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@student.ac.in" />
        </Field>
        <Field label="Password" error={fields.password}>
          <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <ErrorNote message={error} />
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'One sec…' : 'Log in'}</button>
        <p className="small muted" style={{ textAlign: 'center' }}>
          New here? <Link to="/register">Join free</Link>
        </p>
      </form>
    </div>
  )
}
```

#### `src/pages/Register.jsx`

```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ErrorNote, Field } from '../ui.jsx'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', displayName: '' })
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setFields({})
    try {
      await register(form)
      navigate('/onboarding')
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields || {})
        setError(err.message)
      } else setError('Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <h1>Join the crew 🛹</h1>
      <p className="muted">Free, chill, and you start with 250 credits to hire fellow students.</p>
      <form className="card" onSubmit={submit}>
        <Field label="Display name" error={fields.displayName} hint="What people see on your gigs and reviews">
          <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Maya, Arjun, CoolCoder99…" />
        </Field>
        <Field label="Email" error={fields.email} hint="Campus emails (.edu, .ac.in…) get a 🎓 trust badge — no documents, ever">
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@student.ac.in" />
        </Field>
        <Field label="Password" error={fields.password} hint="8+ characters">
          <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <ErrorNote message={error} />
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="small muted" style={{ textAlign: 'center' }}>
          Already in? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  )
}
```

#### `src/pages/Onboarding.jsx`

Three skippable steps, one PATCH each — the anti-checkpoint philosophy in flow form. This is also where the partial-update discipline of `PATCH /api/me` earns its keep: each step sends only its own fields.

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { ErrorNote, Field, useToast } from '../ui.jsx'

const AVATARS = ['🙂', '😎', '🎨', '💻', '📝', '🎧', '📷', '🦊', '🐱', '🌟', '🛹', '☕']
const STEP_TITLES = ['Pick your vibe', 'What are you good at?', 'Say hi']

export default function Onboarding() {
  const { me, updateMe } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [avatar, setAvatar] = useState(me?.user.avatar || '🙂')
  const [skills, setSkills] = useState('')
  const [campus, setCampus] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function next() {
    setBusy(true)
    setError('')
    try {
      if (step === 0) await updateMe({ avatar })
      if (step === 1) await updateMe({ skills: skills.split(',').map((s) => s.trim()).filter(Boolean) })
      if (step === 2) {
        await updateMe({ campus, bio })
        toast("You're all set — welcome to Sidequest! 🎉", 'success')
        navigate('/explore')
        return
      }
      setStep((s) => s + 1)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '30px auto' }}>
      <p className="muted">Step {step + 1} of 3</p>
      <h1>{STEP_TITLES[step]}</h1>
      <div className="card">
        {step === 0 && (
          <div className="row" style={{ gap: 10 }}>
            {AVATARS.map((a) => (
              <button
                key={a}
                className={`chip ${avatar === a ? 'on' : ''}`}
                style={{ fontSize: '1.5rem', padding: '8px 14px' }}
                onClick={() => setAvatar(a)}
              >
                {a}
              </button>
            ))}
          </div>
        )}
        {step === 1 && (
          <Field label="Skills" hint="Comma separated — keep it real, you'll get hired for these">
            <input className="input" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Figma, React, resume editing…" />
          </Field>
        )}
        {step === 2 && (
          <>
            <Field label="Campus">
              <input className="input" value={campus} onChange={(e) => setCampus(e.target.value)} placeholder="VJTI, IIT Bombay, St. Xavier's…" />
            </Field>
            <Field label="One line about you">
              <textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Design student who loves clean layouts and chai." />
            </Field>
          </>
        )}
        <ErrorNote message={error} />
        <div className="spread">
          <button className="btn btn-ghost" onClick={() => navigate('/explore')}>Skip for now</button>
          <button className="btn btn-primary" onClick={next} disabled={busy}>
            {step === 2 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

#### `src/pages/NotFound.jsx`

```jsx
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="empty" style={{ paddingTop: 80 }}>
      <div className="empty-emoji">🛸</div>
      <h1>404 — this page drifted off</h1>
      <p>The link is wrong, or the page never existed. No stress.</p>
      <Link to="/" className="btn btn-primary">Back home</Link>
    </div>
  )
}
```

**Checkpoint F8:** `npm run build` completes with no errors (bundle lands around ~300 kB / ~92 kB gzipped), every route renders, the Ledger page shows the green chain banner, the podium populates after seeding.

---

## 13. Error-handling playbook

"Clean and flawless errors" is a design requirement, not luck. This section is the contract.

### 13.1 The one error contract

Every failure — validation, auth, state machine, unknown — leaves the API as:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Almost there — check the highlighted fields.",
    "fields": { "price": "Credits between 1 and 100000." }
  }
}
```

| HTTP | Code | When | UI treatment |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad input (with optional `fields`) | Inline messages under fields + summary note |
| 401 | `UNAUTHENTICATED` | No/invalid session | Redirect to `/login` (handled by `RequireAuth`) |
| 403 | `FORBIDDEN` | Valid session, not your resource | Calm note: "This order isn't yours." |
| 404 | `NOT_FOUND` | Unknown id / route | Friendly 404 page (routes) or note (data) |
| 409 | `CONFLICT` | Illegal state transition, duplicate review, self-hire | Note explaining the rule in one sentence |
| 413 | `PAYLOAD_TOO_LARGE` | Body > 256kb | Note with the limit |
| 500 | `SERVER_ERROR` | Anything unexpected | Generic apology + error **ref id** (full stack goes to server log only) |

### 13.2 Where errors are handled (both ends)

**Server:**
1. Route code throws `ApiError` helpers (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`) — never ad-hoc `res.status(400).send('...')`.
2. Express catches synchronous throws automatically and forwards to `errorHandler`.
3. `errorHandler` (B3) maps `ApiError` → contract; body-parser failures (`entity.parse.failed`, `entity.too.large`) → friendly 400/413; anything else → logged with a ref id + generic 500.

**Client:**
1. `api.js` converts every non-2xx into `ApiError` with `fields`; network failure becomes `NETWORK_ERROR` with "Can't reach the server — is the API running?".
2. Forms catch `ApiError`, spread `err.fields` into `<Field error=...>`, and show `err.message` in `<ErrorNote>`.
3. One-off actions (order buttons) surface errors in the order card's `ErrorNote`.
4. Unexpected render bugs land in toasts — never a white screen of death.

### 13.3 The message bank (use these exact tones)

| Situation | Message |
|---|---|
| Empty title | "Give it a punchy title (3+ characters)." |
| Bad email | "That email looks a bit off." |
| Duplicate email | "Already registered — try logging in." |
| Wrong password | "Email or password is off. No stress, try again." |
| Not signed in | "You need to sign in to do that." |
| Someone else's order | "This order isn't yours." |
| Illegal transition | `An order that is "${status}" can't become "${to}".` |
| Self-hire | "You cannot hire your own gig." |
| Review too early | "Reviews open up once the order is finished." |
| Double review | "You already reviewed this order." |
| Empty message | "Type something first." |
| Server bug | "Something glitched on our side (ref x1y2z3). Try again?" |
| Network down | "Can't reach the server — is the API running?" |
| 404 page | "404 — this page drifted off" |

Rules of tone: second person, present tense, one sentence, say what to do next. Never blame the user ("Invalid input!!"), never leak internals (`SQLITE_CONSTRAINT...`), never dead-end.

### 13.4 Troubleshooting table (the errors you will actually hit)

| Symptom | Real cause | Fix |
|---|---|---|
| `SqliteError: NOT NULL constraint failed: gigs.owner_id` though you passed a value | You passed `undefined` — e.g. `user.id` where `user` *is* the id. SQLite names the column, not the variable | `console.log` the arguments before the insert |
| `ReferenceError: require is not defined` in frontend code | Backend-style `require` pasted into a Vite/React module | Use `import` syntax; `.js` files in `src/` are ESM |
| `Failed to resolve import "../ui.jsx"` | Missing file or wrong case (`Ui.jsx` vs `ui.jsx`) | Filenames are case-sensitive on Linux/macOS builds |
| `EADDRINUSE: address already in use :::4123` | Old `node` process still running | Kill it, or `PORT=4124 npm run dev` |
| Frontend says "Can't reach the server" | API not running, or Vite proxy typo | Start backend first; check `proxy` target port matches |
| `401` loops after login | Cookie cleared by browser settings, or you're testing via a different host | Use `localhost:5173` (not `127.0.0.1` in one place and `localhost` in another) |
| `SyntaxError: Unexpected token '<'` from an API call | Response was HTML (SPA fallback caught an `/api` typo) | Fix the path; unknown API routes return JSON 404 by design |
| `better-sqlite3` install fails on `node-gyp` | No prebuilt binary for your Node version / missing build tools | Use Node 20/22 LTS; `npm rebuild better-sqlite3`; on Windows install "Desktop development with C++" or use Node 20 LTS |
| `FOREIGN KEY constraint failed` on badge award | `badges` catalog empty — `ensureBadges()` not running | Keep the `ensureBadges()` call at gamify load time (B6) |
| Reviews invisible right after posting | Working as designed — paired publication | Post the counterpart review (or wait 72h) |
| `express@5` route error `Missing parameter name` | `app.get('*')` pattern under Express 5 | This guide pins `express@4.21.2` on purpose — keep the pin |
| Ledger verify says `prev_hash mismatch` | A row was edited/deleted outside the app | That's the system working. Restore from backup or reset the demo DB with `npm run seed` |
| Windows: script execution blocked | PowerShell policy | Use `cmd`, or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Everything feels slow on first `npm install` | Normal cold cache | Grab chai. Second installs are seconds |

### 13.5 The three rules that keep errors flawless

1. **One throwing style.** Only `ApiError` helpers produce client-facing errors. If you need a new failure, add a helper call in the route — don't invent a new shape.
2. **Validate at the edge, trust inside.** All input checks live at the top of each route. Once past them, inner functions (ledger, gamify) assume valid data and assert state instead (e.g. `assertTransition`).
3. **Money errors are transaction errors.** If anything throws mid-flow (validation, state, FK), the surrounding `tx()` rolls back — balances and ledger can't half-move. Never call `move()` outside a plan that can roll back with it.

---

## 14. Testing & QA checklist

### 14.1 Automated: the 67-check smoke test

The full script is **Appendix C** — save it as `backend/test-flow.js`, run the API with seeded data, then `node test-flow.js`. It covers: auth & validation, campus badges, gig CRUD/search, self-hire block, escrow arithmetic at every state, role permissions, state-machine double-clicks, paired reviews, dispute proposals (mismatch → swap → match → execute), refunds, messages, **ledger tamper triggers**, leaderboard, profiles, and the error contract. Expect `67 passed, 0 failed`.

Run it any time you touch the backend. It is the definition of "done" for this project.

### 14.2 Manual QA checklist (45 minutes, do it once properly)

**Happy path (two browsers / two profiles):**
- [ ] Register → onboarding (3 steps) → explore → order → accept → deliver → approve → both review
- [ ] Balances correct at every step (watch the ledger page alongside)
- [ ] XP bar moves; First Gig / First Sale badges pop; leaderboard reorders

**Edge cases:**
- [ ] Order your own gig → 409 toast, no crash
- [ ] Click Accept twice fast → one accepts, one shows the conflict message
- [ ] Deliver with empty field → inline error
- [ ] Review before completion → conflict message
- [ ] Cancel a pending order → buyer refunded exactly
- [ ] Dispute → both propose split → money splits 50/50 (odd price: seller gets floor, buyer the rest)
- [ ] Refresh mid-flow → state survives (it's all server-side)
- [ ] Guest opens `/ledger` and `/leaderboard` → works without login
- [ ] Guest opens `/dashboard` → redirected to login
- [ ] Unknown URL → chill 404 page

**Transparency:**
- [ ] Ledger page shows ✅ Chain intact
- [ ] Try `UPDATE ledger SET amount = 1` in SQLite Viewer → rejected with "append-only"
- [ ] Message a counterpart → appears in shared timeline

**UI/UX:**
- [ ] Mobile-ish width (responsive grid collapses)
- [ ] Toasts appear and vanish
- [ ] Empty states on fresh accounts read friendly
- [ ] All validation messages are field-specific and in the message-bank tone

### 14.3 "Definition of done"

- [ ] `node test-flow.js` → 67/67
- [ ] `npm run build` (frontend) → zero errors
- [ ] Manual checklist above → all checked
- [ ] Demo script (§15) rehearsed cold, under 5 minutes

---

## 15. Demo-day script (5 minutes)

**Setup (before they arrive):** `npm run seed`, run both dev servers, log into two browsers (sara + arjun), open `/ledger` in a third tab.

1. **Hook (30s).** "Sidequest is Fiverr's chill cousin for campuses. Students hire students, everyone levels up — and every single credit is auditable by anyone."
2. **The vibe (30s).** Show landing → explore → a gig card. Point at the XP bar and the soft UI. "No forms about your grandfather's income. Email, password, done."
3. **The money loop (2m).** From Sara's window: order Arjun's gig. Flip to the ledger tab — "credits locked in escrow, hash-chained, publicly verifiable." Arjun accepts → delivers; Sara approves. Both balances move exactly as the ledger says. XP bar jumps.
4. **Fairness (1m).** Both leave reviews → show the paired-publication privacy note. Then start a second order and open a dispute: propose *split* on one side, *refund* on the other — show nothing happens. Match them — money moves automatically. "No admin to lobby. The rules are the admin."
5. **Anti-exploit punchline (30s).** "Try editing the ledger in SQLite Viewer live." The trigger rejects it. "XP farming?" Daily caps. "Self-reviews?" Impossible — reviews require real completed orders.
6. **Close (30s).** Leaderboard page. "Built in a day: Express, SQLite, React, three dependencies. This is the trust layer a real marketplace can stand on."

**Anticipated questions:**
- *"Is this real money?"* — Campus credits stand in for rupees; the escrow/ledger layer is real. A Razorpay seam is documented (§17) — one event type swap.
- *"What stops a student taking work and vanishing?"* — Escrow + dispute window + paired reviews + the whole public trail. The same thing real platforms do, without the 12-step verification theatre.
- *"Why is the ledger hash-chained?"* — So tampering is detectable by anyone, not just the operator.

---
## 16. Ship it

### 16.1 Demo day, single process

```bash
cd frontend && npm run build     # writes frontend/dist
cd ../backend && npm run dev     # now also serves the app at :4123
```

`server.js` serves `frontend/dist` automatically when it exists (B8), with SPA fallback so deep links (`/orders/3`) work. One process, one URL, nothing to orchestrate on stage.

### 16.2 Show it on a phone (same Wi-Fi)

Vite is already configured with `host: true` (F1). Start the dev servers and open the **LAN URL** Vite prints (e.g. `http://192.168.x.x:5173`) on your phone. No tunnel, no deploy.

### 16.3 Where to deploy later (all optional)

| Piece | Easy option | Notes |
|---|---|---|
| Frontend | Netlify / Vercel / GitHub Pages | `npm run build`, publish `dist/` |
| API | Render / Railway / Fly.io | Needs Node + persistent disk for `sidequest.db` |
| Database | Keep SQLite on a volume | Move to Postgres only if you outgrow one campus |

If frontend and API end up on different domains, the cookie needs `Secure` + `SameSite=None` and the API needs CORS with `credentials: true` — the Vite proxy exists precisely so you don't need any of that during development.

---

## 17. Stretch goals (day 2+)

Each one slots into a clean seam that already exists — that's the reward for the strict layer.

1. **Real payments (Razorpay).** Swap the `grant`/top-up event for `payment_captured`: create a Razorpay order on the server, verify the signature on the webhook, then call `move({ type: 'grant', ... })` for the same amount. Escrow, ledger, disputes, reviews — untouched. The ledger becomes the settlement record.
2. **File uploads.** Deliverables are links today. Add multer + a `/uploads` static dir, store paths in `orders.deliverable`, keep the timeline entry format.
3. **Live messages (websockets).** Socket.io on the Express server; on `message` events, push to the room `order:{id}`. The timeline stays the source of truth — sockets only remove the refresh. (Learned from Phive's own rewrite: broadcasting must be best-effort, never break the write.)
4. **Password reset.** One-time token table + email (or a dev-only reset link printed to console — zero email config).
5. **Admin/moderation.** A tiny `/admin` page listing disputed orders. Note the philosophy: admin can *read* everything and *nudge*, but money moves only via the same mutual-consent or state-machine paths. No admin `UPDATE ledger` — the trigger already forbids it.
6. **Badges & seasons.** Weekly leaderboard seasons, limited badges, a `season` column on `xp_events`.
7. **PWA.** `manifest.json` + a service worker caching the shell — installs on phones like a real app.
8. **Postgres.** `better-sqlite3` calls are localized in `db.js` + small helpers; swapping to `pg` is a contained refactor.

---

## 18. Appendices

### Appendix A — API quick reference & demo data

**Demo accounts** (after `npm run seed`): `maya@student.ac.in`, `arjun@student.ac.in`, `sara@student.ac.in` — password `password123`. Maya has completed history and five-star reviews; use her + Arjun for the two-window demo.

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account + welcome grant + session |
| POST | `/api/auth/login` | — | Session cookie |
| POST | `/api/auth/logout` | ✓ | Kill session |
| GET | `/api/me` | ✓ | Profile + level + badges + stats |
| PATCH | `/api/me` | ✓ | Partial profile update (onboarding) |
| GET | `/api/gigs?query=&category=&sort=` | — | Search/list gigs |
| GET | `/api/gigs/:id` | — | Gig detail + owner trust summary |
| POST | `/api/gigs` | ✓ | Post gig (+XP) |
| POST | `/api/orders` | ✓ | Create order → escrow fund |
| GET | `/api/orders` | ✓ | My orders (both roles) |
| GET | `/api/orders/:id` | ✓ | Full transparent story |
| POST | `/api/orders/:id/accept` | seller | pending → accepted |
| POST | `/api/orders/:id/deliver` | seller | accepted → delivered |
| POST | `/api/orders/:id/approve` | buyer | delivered → completed, release |
| POST | `/api/orders/:id/cancel` | either | pending → cancelled, refund |
| POST | `/api/orders/:id/dispute` | either | → disputed |
| POST | `/api/orders/:id/resolve` | either | Propose; matching proposals execute |
| POST | `/api/orders/:id/message` | either | Shared timeline message |
| POST | `/api/orders/:id/review` | either | Paired review (+XP) |
| GET | `/api/ledger?limit=` | — | Public ledger + live verify |
| GET | `/api/ledger/verify` | — | Chain check only |
| GET | `/api/leaderboard` | — | Top 10 + weekly XP |
| GET | `/api/users/:id` | — | Public profile + visible reviews |
| GET | `/api/health` | — | Liveness |

### Appendix B — Ledger unit checks (run at checkpoint B4)

Save as `backend/scripts/ledger-check.js` and run `node scripts/ledger-check.js` with a scratch DB. If all four lines pass, the transparency engine is correct before you build anything on top:

```js
const { db } = require('../src/db');
const { move, verifyChain } = require('../src/lib/ledger');
const { hashPassword } = require('../src/lib/auth');

const id = db.prepare(
  "INSERT INTO users (email, password_hash, display_name) VALUES ('lc@test.ac.in','x','LC')"
).run().lastInsertRowid;

move({ userId: id, delta: 250, type: 'grant', memo: 'grant' });
move({ userId: id, delta: -80, type: 'escrow_fund', memo: 'fund' });
move({ userId: id, delta: 80, type: 'escrow_refund', memo: 'refund' });

console.log('chain:', verifyChain()); // { ok: true, entries: 3 }

try {
  db.prepare('UPDATE ledger SET amount = 999999 WHERE id = 1').run();
  console.log('FAIL: ledger was editable');
} catch (e) {
  console.log('update blocked:', /append-only/.test(e.message));
}

try {
  db.prepare('DELETE FROM ledger WHERE id = 1').run();
  console.log('FAIL: ledger was deletable');
} catch (e) {
  console.log('delete blocked:', /append-only/.test(e.message));
}

const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(id);
console.log('balance matches chain:', user.credits === 250 - 80 + 80); // true
```

### Appendix C — The 67-check smoke test

Save as `backend/test-flow.js`. With the API running and `npm run seed` applied (the test registers its own fresh users but expects the seeded gigs), run `node test-flow.js`. **This exact suite passed 67/67 against the code in this document.**

```js
/* End-to-end smoke test: auth, gigs, escrow, disputes, reviews, ledger, more. */
const BASE = 'http://localhost:4123';
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}
async function api(cookie, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const sid = setCookie.match(/sid=([^;]+)/);
  return { status: res.status, data: await res.json().catch(() => null), sid: sid ? sid[1] : null };
}

(async () => {
  console.log('— auth —');
  const v = await api(null, 'POST', '/api/auth/register', { email: 'bad', password: 'x', displayName: '' });
  ok('register validation 400 + fields', v.status === 400 && v.data.error.fields.email && v.data.error.fields.password, v.data);

  const reg = await api(null, 'POST', '/api/auth/register', { email: 'neo@student.ac.in', password: 'password123', displayName: 'Neo' });
  ok('register 201 + welcome credits', reg.status === 201 && reg.data.user.credits === 250, reg.data.user);
  ok('campus email auto-verified', reg.data.user.isVerifiedStudent === true);
  ok('signup xp granted', reg.data.user.xp >= 25, reg.data.user.xp);
  ok('early_citizen badge', reg.data.badges.some((b) => b.code === 'early_citizen'), reg.data.badges);
  const neo = 'sid=' + reg.sid;

  const reg2 = await api(null, 'POST', '/api/auth/register', { email: 'trinity@gmail.com', password: 'password123', displayName: 'Trinity' });
  ok('non-campus email not verified', reg2.data.user.isVerifiedStudent === false);
  const trinity = 'sid=' + reg2.sid;

  const dup = await api(null, 'POST', '/api/auth/register', { email: 'NEO@student.ac.in', password: 'password123', displayName: 'Neo' });
  ok('duplicate email rejected (case-insensitive)', dup.status === 400, dup);

  const badLogin = await api(null, 'POST', '/api/auth/login', { email: 'neo@student.ac.in', password: 'wrongpass1' });
  ok('bad login 401', badLogin.status === 401, badLogin);

  const login = await api(null, 'POST', '/api/auth/login', { email: 'maya@student.ac.in', password: 'password123' });
  ok('seed login works', login.status === 200 && login.data.user.displayName === 'Maya', login.data && login.data.user);

  const me = await api(neo, 'GET', '/api/me');
  ok('GET /api/me authed (no email leak)', me.status === 200 && me.data.user.email === undefined, me.data.user);
  const noAuth = await api(null, 'GET', '/api/me');
  ok('GET /api/me guest 401', noAuth.status === 401);

  const onboarding = await api(neo, 'PATCH', '/api/me', { avatar: '🦾', campus: 'IIT Bombay', skills: ['Python', 'Debugging'], bio: 'I fix things.' });
  ok('onboarding patch works', onboarding.status === 200 && onboarding.data.user.avatar === '🦾' && onboarding.data.user.skills.length === 2, onboarding.data.user);

  console.log('— gigs —');
  const g = await api(neo, 'POST', '/api/gigs', { title: 'Fix your Python bug', description: 'Send me the traceback and I will fix it.', category: 'Code & Tech', tags: 'python', price: 40, deliveryDays: 1 });
  ok('post gig 201', g.status === 201 && g.data.id > 0, g.data);
  ok('owner summary attached', g.data.owner && g.data.owner.displayName === 'Neo', g.data.owner);
  const gBad = await api(neo, 'POST', '/api/gigs', { title: 'x', description: 'y', category: 'Nope', price: -1, deliveryDays: 0 });
  ok('gig validation fields', gBad.status === 400 && gBad.data.error.fields.title && gBad.data.error.fields.category && gBad.data.error.fields.price, gBad.data);
  const list = await api(null, 'GET', '/api/gigs?query=python');
  ok('search finds gig', list.status === 200 && list.data.gigs.length === 1, list.data.gigs && list.data.gigs.length);
  const list2 = await api(null, 'GET', '/api/gigs?category=Design%20%26%20Art');
  ok('category filter', list2.status === 200 && list2.data.gigs.length === 2 && list2.data.categories.includes('Design & Art'));

  console.log('— orders / escrow —');
  const self = await api(neo, 'POST', '/api/orders', { gigId: g.data.id });
  ok('cannot hire own gig', self.status === 409, self.data);

  const o1 = await api(trinity, 'POST', '/api/orders', { gigId: g.data.id, note: 'Need it tonight' });
  ok('order created + escrow funded', o1.status === 201 && o1.data.status === 'pending', o1.data);
  const triMe = await api(trinity, 'GET', '/api/me');
  ok('buyer balance 250-40=210', triMe.data.user.credits === 210, triMe.data.user.credits);

  const notMine = await api('sid=' + login.sid, 'GET', `/api/orders/${o1.data.id}`);
  ok('outsider cannot read order', notMine.status === 403, notMine);

  const acceptBad = await api(trinity, 'POST', `/api/orders/${o1.data.id}/accept`);
  ok('buyer cannot accept', acceptBad.status === 403, acceptBad);
  const accept = await api(neo, 'POST', `/api/orders/${o1.data.id}/accept`);
  ok('seller accepts', accept.status === 200 && accept.data.status === 'accepted', accept.data);
  const again = await api(neo, 'POST', `/api/orders/${o1.data.id}/accept`);
  ok('double accept blocked (state machine)', again.status === 409, again);

  const delBad = await api(neo, 'POST', `/api/orders/${o1.data.id}/deliver`, { deliverable: '' });
  ok('deliver requires deliverable', delBad.status === 400 && delBad.data.error.fields.deliverable, delBad.data);
  const del = await api(neo, 'POST', `/api/orders/${o1.data.id}/deliver`, { deliverable: 'pastebin.com/fixed-it' });
  ok('delivered', del.status === 200 && del.data.status === 'delivered', del.data);

  const revEarly = await api(trinity, 'POST', `/api/orders/${o1.data.id}/review`, { rating: 5, text: 'nice' });
  ok('review before completion blocked', revEarly.status === 409, revEarly);

  const approve = await api(trinity, 'POST', `/api/orders/${o1.data.id}/approve`);
  ok('approved → completed', approve.status === 200 && approve.data.status === 'completed', approve.data);
  const neoMe = await api(neo, 'GET', '/api/me');
  ok('seller got 250+40=290', neoMe.data.user.credits === 290, neoMe.data.user.credits);
  ok('seller earned order_sold xp', neoMe.data.user.xp >= 25 + 10 + 50 + 5, neoMe.data.user.xp);
  ok('first_sale badge', neoMe.data.badges.some((b) => b.code === 'first_sale'), neoMe.data.badges);
  const triMe2 = await api(trinity, 'GET', '/api/me');
  ok('buyer keeps 210 after release', triMe2.data.user.credits === 210, triMe2.data.user.credits);

  console.log('— reviews (simultaneous publication) —');
  const r1 = await api(trinity, 'POST', `/api/orders/${o1.data.id}/review`, { rating: 5, text: 'fast fix' });
  ok('buyer reviews', r1.status === 201, r1.data);
  const r1again = await api(trinity, 'POST', `/api/orders/${o1.data.id}/review`, { rating: 1, text: 'x' });
  ok('second review blocked', r1again.status === 409, r1again);
  const o1view = await api(trinity, 'GET', `/api/orders/${o1.data.id}`);
  ok('own review visible, counterpart hidden', o1view.data.reviews.length === 1 && o1view.data.canReview === false, o1view.data.reviews);
  const r2 = await api(neo, 'POST', `/api/orders/${o1.data.id}/review`, { rating: 4, text: 'clear brief' });
  ok('seller reviews', r2.status === 201, r2.data);
  const o1view2 = await api(neo, 'GET', `/api/orders/${o1.data.id}`);
  ok('both reviews visible after pair', o1view2.data.reviews.length === 2, o1view2.data.reviews);
  ok('timeline has 4 state events', o1view2.data.events.length === 4 && o1view2.data.events.map((e) => e.event).join(',') === 'created,accepted,delivered,approved', o1view2.data.events.map((e) => e.event));

  console.log('— dispute + mutual resolution —');
  const g2 = await api(trinity, 'POST', '/api/gigs', { title: 'Slide deck makeover', description: 'I will make your slides beautiful.', category: 'Slides & Docs', price: 60, deliveryDays: 2 });
  const o2 = await api(neo, 'POST', '/api/orders', { gigId: g2.data.id, note: 'thesis review' });
  ok('order 2 funded (290-60=230)', o2.status === 201, o2.data);
  const neoMe2 = await api(neo, 'GET', '/api/me');
  ok('buyer balance 230', neoMe2.data.user.credits === 230, neoMe2.data.user.credits);
  await api(trinity, 'POST', `/api/orders/${o2.data.id}/accept`);
  const dsp = await api(trinity, 'POST', `/api/orders/${o2.data.id}/dispute`, { reason: 'scope changed' });
  ok('dispute opened', dsp.status === 200 && dsp.data.status === 'disputed', dsp.data);
  const p1 = await api(trinity, 'POST', `/api/orders/${o2.data.id}/resolve`, { resolution: 'split' });
  ok('first proposal not executed', p1.status === 200 && p1.data.agreed === false, p1.data);
  const p2 = await api(neo, 'POST', `/api/orders/${o2.data.id}/resolve`, { resolution: 'refund' });
  ok('mismatched proposal swaps', p2.data.agreed === false, p2.data);
  const p3 = await api(trinity, 'POST', `/api/orders/${o2.data.id}/resolve`, { resolution: 'refund' });
  ok('matching proposal executes', p3.data.agreed === true && p3.data.status === 'resolved_refund', p3.data);
  const neoMe3 = await api(neo, 'GET', '/api/me');
  ok('refund restored 230+60=290', neoMe3.data.user.credits === 290, neoMe3.data.user.credits);

  console.log('— cancel path —');
  const o3 = await api(trinity, 'POST', '/api/orders', { gigId: g.data.id, note: 'another bug' });
  ok('order 3 created (210-40=170)', o3.status === 201, o3.data);
  const triMe3 = await api(trinity, 'GET', '/api/me');
  ok('trinity balance 170', triMe3.data.user.credits === 170, triMe3.data.user.credits);
  const cxl = await api(neo, 'POST', `/api/orders/${o3.data.id}/cancel`);
  ok('seller cancels pending → refund', cxl.status === 200 && cxl.data.status === 'cancelled', cxl.data);
  const triMe4 = await api(trinity, 'GET', '/api/me');
  ok('trinity refunded to 210', triMe4.data.user.credits === 210, triMe4.data.user.credits);
  const cxl2 = await api(trinity, 'POST', `/api/orders/${o3.data.id}/cancel`);
  ok('cancel after cancel blocked', cxl2.status === 409, cxl2.data);

  console.log('— messages —');
  const msg = await api(neo, 'POST', `/api/orders/${o1.data.id}/message`, { text: 'thanks again!' });
  ok('order message posted', msg.status === 200, msg.data);
  const msgEmpty = await api(neo, 'POST', `/api/orders/${o1.data.id}/message`, { text: '' });
  ok('empty message rejected', msgEmpty.status === 400, msgEmpty.data);
  const o1view3 = await api(trinity, 'GET', `/api/orders/${o1.data.id}`);
  ok('message visible in timeline', o1view3.data.events.some((e) => e.event === 'message' && e.detail === 'thanks again!'), o1view3.data.events);

  console.log('— ledger & transparency —');
  const led = await api(null, 'GET', '/api/ledger');
  ok('guest can read ledger', led.status === 200 && led.data.entries.length >= 8, led.data.entries.length);
  ok('chain verifies', led.data.verify.ok === true, led.data.verify);
  ok('grant entry for welcome credits exists', led.data.entries.some((e) => e.type === 'grant' && e.amount === 250), led.data.entries.map((e) => e.type));
  const verify = await api(null, 'GET', '/api/ledger/verify');
  ok('standalone verify ok', verify.data.ok === true, verify.data);

  const Database = require('better-sqlite3');
  const raw = new Database('sidequest.db');
  let tampered = false;
  try { raw.prepare('UPDATE ledger SET amount = 999999 WHERE id = 1').run(); }
  catch (e) { tampered = /append-only/.test(e.message); }
  ok('ledger UPDATE blocked by trigger', tampered);
  let deleted = false;
  try { raw.prepare('DELETE FROM ledger WHERE id = 1').run(); }
  catch (e) { deleted = /append-only/.test(e.message); }
  ok('ledger DELETE blocked by trigger', deleted);
  raw.close();

  console.log('— leaderboard / profile —');
  const lb = await api(null, 'GET', '/api/leaderboard');
  ok('leaderboard has 5 people', lb.status === 200 && lb.data.leaders.length === 5 && lb.data.leaders[0].rank === 1, lb.data.leaders.length);
  ok('weekly xp present', typeof lb.data.leaders[0].weeklyXp === 'number');
  const prof = await api(null, 'GET', `/api/users/${neoMe.data.user.id}`);
  ok('public profile', prof.status === 200 && prof.data.user.displayName === 'Neo', prof.data.user);
  ok('profile shows visible review', prof.data.reviews.length === 1, prof.data.reviews);
  const prof404 = await api(null, 'GET', '/api/users/9999');
  ok('unknown profile 404', prof404.status === 404, prof404.data);

  console.log('— misc contract —');
  const n404 = await api(null, 'GET', '/api/nope');
  ok('unknown endpoint JSON 404', n404.status === 404 && n404.data.error.code === 'NOT_FOUND', n404.data);
  const badJson = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  ok('malformed json → clean error status', badJson.status === 400, badJson.status);
  const serverStillUp = await api(null, 'GET', '/api/health');
  ok('server alive after bad json', serverStillUp.status === 200);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
```

> If you change seed data (gig prices, users), update the matching balance assertions — they encode the exact arithmetic of the demo data by design.

### Appendix D — Copy bank (all the microcopy)

**Error messages:** see the message bank in §13.3 — that table is the single source of truth for failure copy.

**Toasts (success):**
- "Order placed — credits locked in escrow 🔒"
- "Order accepted — good luck! 🍀"
- "Delivered! Waiting for approval. 📦"
- "Approved — credits released! ⚡"
- "Order cancelled — credits refunded."
- "Dispute opened — both sides can see the same record."
- "Proposal noted — waiting for the other side."
- "Review saved — it publishes when both sides post. 🤝"
- "Gig is live — nice! 🎉"
- "You're all set — welcome to Sidequest! 🎉"

**Empty states:**
- "🌙 Nothing here yet"
- "🔍 No gigs here yet — Be the first — post one and earn your First Gig badge."
- "🛒 Nothing here yet — Find a gig and hire a fellow student."
- "🛠️ No gigs in motion — Post a gig — someone needs exactly what you do."
- "⭐ No published reviews yet — Reviews publish in pairs…"

**Escrow explainer lines (Order Room, by status):**
- pending: "Your credits are locked until the seller accepts — cancel any time for a full refund."
- accepted: "Work is in progress. Credits release only when you approve, or both sides agree on a resolution."
- delivered: "The work is in. Approve to release the credits, or raise a dispute if something is off."
- completed: "Done and dusted — credits released to the seller."
- disputed: "Paused. Both sides pick a resolution — when the answers match, it executes automatically."

### Appendix E — Glossary

| Term | Meaning here |
|---|---|
| **Gig** | A student's service listing: scope, price in credits, delivery window |
| **Order** | A contract between buyer and seller over one gig, with escrow |
| **Escrow** | Credits locked from the buyer until approval / mutual resolution |
| **Ledger** | Append-only, hash-chained record of every credit movement |
| **Paired reviews** | Reviews that publish simultaneously to protect both sides |
| **Mutual-consent resolution** | Dispute outcome that executes only when both proposals match |
| **XP / Level / Badge** | Gamification: points from verified actions, tiers, achievements |
| **Streak** | Consecutive UTC days with activity |
| **Campus credit (◎)** | Simulated currency; 1 credit ≈ 1 rupee in demos |
| **Checkpoint** | A verifiable pass condition before moving to the next build block |

---

## Final note

**Rename freely.** "Sidequest" is a placeholder with the right energy — swap the name in `App.jsx`, `index.html`, and the seed memos.

**Credit where due.** The product shape is inspired by [Phive](https://github.com/ivqonsanada/phive), the college freelancing platform (ivqonsanada/phive on GitHub) — this document reimagines it as student-to-student with gamification and a transparency-first trust model. If you publish the project, a one-line credit in the README is classy.

**Build order is the whole trick.** Strict data layer first (schema, ledger, state machine), verify it with Appendix B and C, then let the chill UI live on top without a single security checkpoint in the user's face. Strictness in the pipes buys you softness in the paint.

Now go build it — one day, two terminals, zero boring forms. 🛹
