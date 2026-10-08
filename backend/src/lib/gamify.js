const { db } = require('../db');

// XP rules. Daily caps kill farming (firing 50 gigs at yourself earns almost nothing).
const XP_RULES = {
  signup:        { amount: 25,  dailyCap: null, memo: 'Welcome to Sidequest' },
  gig_posted:    { amount: 10,  dailyCap: 30,   memo: 'Posted a gig' },
  order_sold:    { amount: 50,  dailyCap: 200,  memo: 'Delivered an order' },
  order_bought:  { amount: 15,  dailyCap: 60,   memo: 'Completed a purchase' },
  review_written:{ amount: 5,   dailyCap: 20,   memo: 'Left a fair review' },
  daily_visit:   { amount: 5,   dailyCap: 5,    memo: 'Showed up today' },
  badge_earned:  { amount: 20,  dailyCap: 100,  memo: 'Badge unlocked' },
};

const LEVEL_XP = [0, 100, 250, 500, 900, 1500, 2400, 3600, 5200, 7000];
const LEVEL_TITLES = ['Newbie','Regular','Grinder','Hustler','Pro','Ace','Wizard','Legend','Mythic','Campus Boss'];

function levelFor(xp) {
  let level = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) level = i + 1;
  const floor = LEVEL_XP[level - 1];
  const ceil = level < LEVEL_XP.length ? LEVEL_XP[level] : floor;
  return {
    level,
    title: LEVEL_TITLES[level - 1],
    xpIntoLevel: xp - floor,
    xpForNext: ceil - floor,
    progress: ceil > floor ? Math.min(1, (xp - floor) / (ceil - floor)) : 1,
  };
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

// Awards XP for a verified action, respecting the daily cap for that action type.
// Returns the amount actually awarded (0 when the cap is hit).
function addXp(userId, type, memoOverride) {
  const rule = XP_RULES[type];
  if (!rule) return 0;

  if (rule.dailyCap !== null) {
    const today = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM xp_events
         WHERE user_id = ? AND type = ? AND created_at >= ?`
      )
      .get(userId, type, `${utcDay()}T00:00:00.000Z`).total;
    if (today >= rule.dailyCap) return 0;
  }

  const amount = rule.amount;
  db.prepare('INSERT INTO xp_events (user_id, type, amount, memo) VALUES (?, ?, ?, ?)')
    .run(userId, type, amount, memoOverride || rule.memo);
  db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(amount, userId);
  return amount;
}

// Streaks: one visit per UTC day counts. Miss a day and the streak resets.
function touchStreak(userId) {
  const user = db.prepare('SELECT streak_days, last_active_day FROM users WHERE id = ?').get(userId);
  const today = utcDay();
  if (user.last_active_day === today) return user.streak_days;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = user.last_active_day === yesterday ? user.streak_days + 1 : 1;
  db.prepare('UPDATE users SET streak_days = ?, last_active_day = ? WHERE id = ?')
    .run(streak, today, userId);
  addXp(userId, 'daily_visit');
  return streak;
}

const BADGE_DEFS = {
  early_citizen:  { name: 'Early Citizen',  emoji: '🌱', desc: 'Joined during the beta season.' },
  first_gig:      { name: 'First Gig',      emoji: '📮', desc: 'Posted your first gig.' },
  first_sale:     { name: 'First Sale',     emoji: '🤝', desc: 'Completed your first order.' },
  five_star:      { name: 'Five Star',      emoji: '⭐', desc: 'Avg rating 4.5+ across 3+ reviews.' },
  streak_7:       { name: 'On A Roll',      emoji: '🔥', desc: '7-day login streak.' },
  trusted_trader: { name: 'Trusted Trader', emoji: '🏆', desc: 'Completed 10+ orders.' },
};

// Re-checks every badge condition and awards what's newly earned.
// Cheap enough to run after any state change; returns newly awarded codes.
function awardBadges(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const owned = new Set(
    db.prepare('SELECT code FROM user_badges WHERE user_id = ?').all(userId).map((r) => r.code)
  );
  const sold = db
    .prepare(`SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND status IN ('completed','resolved_release')`)
    .get(userId).n;
  const gigCount = db.prepare('SELECT COUNT(*) AS n FROM gigs WHERE owner_id = ?').get(userId).n;
  const rating = db
    .prepare('SELECT COUNT(*) AS n, COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE reviewee_id = ?')
    .get(userId);

  const earned = {
    early_citizen: true,
    first_gig: gigCount >= 1,
    first_sale: sold >= 1,
    five_star: rating.n >= 3 && rating.avg >= 4.5,
    streak_7: user.streak_days >= 7,
    trusted_trader: sold >= 10,
  };

  const newly = [];
  for (const [code, met] of Object.entries(earned)) {
    if (met && !owned.has(code)) {
      db.prepare('INSERT INTO user_badges (user_id, code) VALUES (?, ?)').run(userId, code);
      addXp(userId, 'badge_earned', `Unlocked ${BADGE_DEFS[code].name}`);
      newly.push(code);
    }
  }
  return newly;
}

function badgesFor(userId) {
  return db
    .prepare(
      `SELECT b.code, b.name, b.emoji, b.description, ub.awarded_at
       FROM user_badges ub JOIN badges b ON b.code = ub.code
       WHERE ub.user_id = ? ORDER BY ub.awarded_at ASC`
    )
    .all(userId);
}

// Badge catalog must exist before anything can reference it (FK). Upserted at boot.
function ensureBadges() {
  const upsert = db.prepare(
    'INSERT OR IGNORE INTO badges (code, name, emoji, description) VALUES (?, ?, ?, ?)'
  );
  for (const [code, def] of Object.entries(BADGE_DEFS)) {
    upsert.run(code, def.name, def.emoji, def.desc);
  }
}
ensureBadges();

module.exports = { addXp, touchStreak, awardBadges, badgesFor, levelFor, ensureBadges, XP_RULES, BADGE_DEFS, utcDay };
