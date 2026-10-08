// Quick ledger engine check (Appendix B of the blueprint). Run: npm run ledger-check
const { db } = require('../src/db');
const { move, verifyChain } = require('../src/lib/ledger');

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
