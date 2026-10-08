const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { unauthorized, badRequest } = require('./errors');

const SESSION_COOKIE = 'sid';
const CAMPUS_DOMAINS = ['.edu', '.ac.in', '.edu.in', '.ac.uk'];

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function checkPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function isCampusEmail(email) {
  return CAMPUS_DOMAINS.some((d) => email.toLowerCase().endsWith(d));
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  return token;
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// Minimal cookie parse — one less dependency, one less thing that can break.
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// Attaches req.user when a valid session cookie arrives; never rejects —
// routes decide themselves whether auth is required.
function attachUser(req, _res, next) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) {
    const row = db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
      )
      .get(token);
    if (row) req.user = row;
  }
  next();
}

function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

function registerUser({ email, password, displayName }) {
  const fields = {};
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) fields.email = 'That email looks a bit off.';
  if (!password || password.length < 8) fields.password = 'Use at least 8 characters.';
  if (!displayName || displayName.trim().length < 2) fields.displayName = 'Pick a name (2+ characters).';
  if (Object.keys(fields).length) throw badRequest('Almost there — check the highlighted fields.', fields);

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) throw badRequest('That email already has an account.', { email: 'Already registered — try logging in.' });

  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, display_name, is_verified_student)
       VALUES (?, ?, ?, ?)`
    )
    .run(email.trim(), hashPassword(password), displayName.trim(), isCampusEmail(email) ? 1 : 0);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function loginUser({ email, password }) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '');
  if (!user || !checkPassword(password || '', user.password_hash)) {
    throw unauthorized('Email or password is off. No stress, try again.');
  }
  return user;
}

// Public-safe user shape. Never leaks password_hash or email to other users.
function publicUser(user) {
  return {
    id: user.id,
    displayName: user.display_name,
    avatar: user.avatar,
    campus: user.campus,
    bio: user.bio,
    skills: user.skills ? user.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
    xp: user.xp,
    credits: user.credits,
    streakDays: user.streak_days,
    isVerifiedStudent: !!user.is_verified_student,
    createdAt: user.created_at,
  };
}

module.exports = {
  SESSION_COOKIE, createSession, destroySession, attachUser, requireAuth,
  setSessionCookie, clearSessionCookie, registerUser, loginUser, publicUser, hashPassword,
};
