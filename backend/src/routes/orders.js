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
