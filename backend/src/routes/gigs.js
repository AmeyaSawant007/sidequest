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
