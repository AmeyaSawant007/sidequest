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
