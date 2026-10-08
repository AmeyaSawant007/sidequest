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
