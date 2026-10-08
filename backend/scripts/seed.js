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
const saraId = makeUser('sara@student.ac.in', 'Sara', '📝', "St. Xavier's", 'Copywriting, blogs, editing', 'Words person. Deadline friendly.');

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
