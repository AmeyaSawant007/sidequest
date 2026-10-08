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
