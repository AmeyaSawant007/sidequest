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
