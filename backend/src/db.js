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
