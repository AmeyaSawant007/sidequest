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
