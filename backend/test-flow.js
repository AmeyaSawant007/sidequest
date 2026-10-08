/* End-to-end smoke test: auth, gigs, escrow, disputes, reviews, ledger, more.
   Run against a seeded API:  npm run seed && npm run dev   (then in another terminal:)  npm test
   Expected: 67 passed, 0 failed */
const BASE = 'http://localhost:4123';
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}
async function api(cookie, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const sid = setCookie.match(/sid=([^;]+)/);
  return { status: res.status, data: await res.json().catch(() => null), sid: sid ? sid[1] : null };
}

(async () => {
  console.log('— auth —');
  const v = await api(null, 'POST', '/api/auth/register', { email: 'bad', password: 'x', displayName: '' });
  ok('register validation 400 + fields', v.status === 400 && v.data.error.fields.email && v.data.error.fields.password, v.data);

  const reg = await api(null, 'POST', '/api/auth/register', { email: 'neo@student.ac.in', password: 'password123', displayName: 'Neo' });
  ok('register 201 + welcome credits', reg.status === 201 && reg.data.user.credits === 250, reg.data.user);
  ok('campus email auto-verified', reg.data.user.isVerifiedStudent === true);
  ok('signup xp granted', reg.data.user.xp >= 25, reg.data.user.xp);
  ok('early_citizen badge', reg.data.badges.some((b) => b.code === 'early_citizen'), reg.data.badges);
  const neo = 'sid=' + reg.sid;

  const reg2 = await api(null, 'POST', '/api/auth/register', { email: 'trinity@gmail.com', password: 'password123', displayName: 'Trinity' });
  ok('non-campus email not verified', reg2.data.user.isVerifiedStudent === false);
  const trinity = 'sid=' + reg2.sid;

  const dup = await api(null, 'POST', '/api/auth/register', { email: 'NEO@student.ac.in', password: 'password123', displayName: 'Neo' });
  ok('duplicate email rejected (case-insensitive)', dup.status === 400, dup);

  const badLogin = await api(null, 'POST', '/api/auth/login', { email: 'neo@student.ac.in', password: 'wrongpass1' });
  ok('bad login 401', badLogin.status === 401, badLogin);

  const login = await api(null, 'POST', '/api/auth/login', { email: 'maya@student.ac.in', password: 'password123' });
  ok('seed login works', login.status === 200 && login.data.user.displayName === 'Maya', login.data && login.data.user);

  const me = await api(neo, 'GET', '/api/me');
  ok('GET /api/me authed (no email leak)', me.status === 200 && me.data.user.email === undefined, me.data.user);
  const noAuth = await api(null, 'GET', '/api/me');
  ok('GET /api/me guest 401', noAuth.status === 401);

  const onboarding = await api(neo, 'PATCH', '/api/me', { avatar: '🦾', campus: 'IIT Bombay', skills: ['Python', 'Debugging'], bio: 'I fix things.' });
  ok('onboarding patch works', onboarding.status === 200 && onboarding.data.user.avatar === '🦾' && onboarding.data.user.skills.length === 2, onboarding.data.user);

  console.log('— gigs —');
  const g = await api(neo, 'POST', '/api/gigs', { title: 'Fix your Python bug', description: 'Send me the traceback and I will fix it.', category: 'Code & Tech', tags: 'python', price: 40, deliveryDays: 1 });
  ok('post gig 201', g.status === 201 && g.data.id > 0, g.data);
  ok('owner summary attached', g.data.owner && g.data.owner.displayName === 'Neo', g.data.owner);
  const gBad = await api(neo, 'POST', '/api/gigs', { title: 'x', description: 'y', category: 'Nope', price: -1, deliveryDays: 0 });
  ok('gig validation fields', gBad.status === 400 && gBad.data.error.fields.title && gBad.data.error.fields.category && gBad.data.error.fields.price, gBad.data);
  const list = await api(null, 'GET', '/api/gigs?query=python');
  ok('search finds gig', list.status === 200 && list.data.gigs.length === 1, list.data.gigs && list.data.gigs.length);
  const list2 = await api(null, 'GET', '/api/gigs?category=Design%20%26%20Art');
  ok('category filter', list2.status === 200 && list2.data.gigs.length === 2 && list2.data.categories.includes('Design & Art'));

  console.log('— orders / escrow —');
  const self = await api(neo, 'POST', '/api/orders', { gigId: g.data.id });
  ok('cannot hire own gig', self.status === 409, self.data);

  const o1 = await api(trinity, 'POST', '/api/orders', { gigId: g.data.id, note: 'Need it tonight' });
  ok('order created + escrow funded', o1.status === 201 && o1.data.status === 'pending', o1.data);
  const triMe = await api(trinity, 'GET', '/api/me');
  ok('buyer balance 250-40=210', triMe.data.user.credits === 210, triMe.data.user.credits);

  const notMine = await api('sid=' + login.sid, 'GET', `/api/orders/${o1.data.id}`);
  ok('outsider cannot read order', notMine.status === 403, notMine);

  const acceptBad = await api(trinity, 'POST', `/api/orders/${o1.data.id}/accept`);
  ok('buyer cannot accept', acceptBad.status === 403, acceptBad);
  const accept = await api(neo, 'POST', `/api/orders/${o1.data.id}/accept`);
  ok('seller accepts', accept.status === 200 && accept.data.status === 'accepted', accept.data);
  const again = await api(neo, 'POST', `/api/orders/${o1.data.id}/accept`);
  ok('double accept blocked (state machine)', again.status === 409, again);

  const delBad = await api(neo, 'POST', `/api/orders/${o1.data.id}/deliver`, { deliverable: '' });
  ok('deliver requires deliverable', delBad.status === 400 && delBad.data.error.fields.deliverable, delBad.data);
  const del = await api(neo, 'POST', `/api/orders/${o1.data.id}/deliver`, { deliverable: 'pastebin.com/fixed-it' });
  ok('delivered', del.status === 200 && del.data.status === 'delivered', del.data);

  const revEarly = await api(trinity, 'POST', `/api/orders/${o1.data.id}/review`, { rating: 5, text: 'nice' });
  ok('review before completion blocked', revEarly.status === 409, revEarly);

  const approve = await api(trinity, 'POST', `/api/orders/${o1.data.id}/approve`);
  ok('approved → completed', approve.status === 200 && approve.data.status === 'completed', approve.data);
  const neoMe = await api(neo, 'GET', '/api/me');
  ok('seller got 250+40=290', neoMe.data.user.credits === 290, neoMe.data.user.credits);
  ok('seller earned order_sold xp', neoMe.data.user.xp >= 25 + 10 + 50 + 5, neoMe.data.user.xp);
  ok('first_sale badge', neoMe.data.badges.some((b) => b.code === 'first_sale'), neoMe.data.badges);
  const triMe2 = await api(trinity, 'GET', '/api/me');
  ok('buyer keeps 210 after release', triMe2.data.user.credits === 210, triMe2.data.user.credits);

  console.log('— reviews (simultaneous publication) —');
  const r1 = await api(trinity, 'POST', `/api/orders/${o1.data.id}/review`, { rating: 5, text: 'fast fix' });
  ok('buyer reviews', r1.status === 201, r1.data);
  const r1again = await api(trinity, 'POST', `/api/orders/${o1.data.id}/review`, { rating: 1, text: 'x' });
  ok('second review blocked', r1again.status === 409, r1again);
  const o1view = await api(trinity, 'GET', `/api/orders/${o1.data.id}`);
  ok('own review visible, counterpart hidden', o1view.data.reviews.length === 1 && o1view.data.canReview === false, o1view.data.reviews);
  const r2 = await api(neo, 'POST', `/api/orders/${o1.data.id}/review`, { rating: 4, text: 'clear brief' });
  ok('seller reviews', r2.status === 201, r2.data);
  const o1view2 = await api(neo, 'GET', `/api/orders/${o1.data.id}`);
  ok('both reviews visible after pair', o1view2.data.reviews.length === 2, o1view2.data.reviews);
  ok('timeline has 4 state events', o1view2.data.events.length === 4 && o1view2.data.events.map((e) => e.event).join(',') === 'created,accepted,delivered,approved', o1view2.data.events.map((e) => e.event));

  console.log('— dispute + mutual resolution —');
  const g2 = await api(trinity, 'POST', '/api/gigs', { title: 'Slide deck makeover', description: 'I will make your slides beautiful.', category: 'Slides & Docs', price: 60, deliveryDays: 2 });
  const o2 = await api(neo, 'POST', '/api/orders', { gigId: g2.data.id, note: 'thesis review' });
  ok('order 2 funded (290-60=230)', o2.status === 201, o2.data);
  const neoMe2 = await api(neo, 'GET', '/api/me');
  ok('buyer balance 230', neoMe2.data.user.credits === 230, neoMe2.data.user.credits);
  await api(trinity, 'POST', `/api/orders/${o2.data.id}/accept`);
  const dsp = await api(trinity, 'POST', `/api/orders/${o2.data.id}/dispute`, { reason: 'scope changed' });
  ok('dispute opened', dsp.status === 200 && dsp.data.status === 'disputed', dsp.data);
  const p1 = await api(trinity, 'POST', `/api/orders/${o2.data.id}/resolve`, { resolution: 'split' });
  ok('first proposal not executed', p1.status === 200 && p1.data.agreed === false, p1.data);
  const p2 = await api(neo, 'POST', `/api/orders/${o2.data.id}/resolve`, { resolution: 'refund' });
  ok('mismatched proposal swaps', p2.data.agreed === false, p2.data);
  const p3 = await api(trinity, 'POST', `/api/orders/${o2.data.id}/resolve`, { resolution: 'refund' });
  ok('matching proposal executes', p3.data.agreed === true && p3.data.status === 'resolved_refund', p3.data);
  const neoMe3 = await api(neo, 'GET', '/api/me');
  ok('refund restored 230+60=290', neoMe3.data.user.credits === 290, neoMe3.data.user.credits);

  console.log('— cancel path —');
  const o3 = await api(trinity, 'POST', '/api/orders', { gigId: g.data.id, note: 'another bug' });
  ok('order 3 created (210-40=170)', o3.status === 201, o3.data);
  const triMe3 = await api(trinity, 'GET', '/api/me');
  ok('trinity balance 170', triMe3.data.user.credits === 170, triMe3.data.user.credits);
  const cxl = await api(neo, 'POST', `/api/orders/${o3.data.id}/cancel`);
  ok('seller cancels pending → refund', cxl.status === 200 && cxl.data.status === 'cancelled', cxl.data);
  const triMe4 = await api(trinity, 'GET', '/api/me');
  ok('trinity refunded to 210', triMe4.data.user.credits === 210, triMe4.data.user.credits);
  const cxl2 = await api(trinity, 'POST', `/api/orders/${o3.data.id}/cancel`);
  ok('cancel after cancel blocked', cxl2.status === 409, cxl2.data);

  console.log('— messages —');
  const msg = await api(neo, 'POST', `/api/orders/${o1.data.id}/message`, { text: 'thanks again!' });
  ok('order message posted', msg.status === 200, msg.data);
  const msgEmpty = await api(neo, 'POST', `/api/orders/${o1.data.id}/message`, { text: '' });
  ok('empty message rejected', msgEmpty.status === 400, msgEmpty.data);
  const o1view3 = await api(trinity, 'GET', `/api/orders/${o1.data.id}`);
  ok('message visible in timeline', o1view3.data.events.some((e) => e.event === 'message' && e.detail === 'thanks again!'), o1view3.data.events);

  console.log('— ledger & transparency —');
  const led = await api(null, 'GET', '/api/ledger');
  ok('guest can read ledger', led.status === 200 && led.data.entries.length >= 8, led.data.entries.length);
  ok('chain verifies', led.data.verify.ok === true, led.data.verify);
  ok('grant entry for welcome credits exists', led.data.entries.some((e) => e.type === 'grant' && e.amount === 250), led.data.entries.map((e) => e.type));
  const verify = await api(null, 'GET', '/api/ledger/verify');
  ok('standalone verify ok', verify.data.ok === true, verify.data);

  const Database = require('better-sqlite3');
  const raw = new Database('sidequest.db');
  let tampered = false;
  try { raw.prepare('UPDATE ledger SET amount = 999999 WHERE id = 1').run(); }
  catch (e) { tampered = /append-only/.test(e.message); }
  ok('ledger UPDATE blocked by trigger', tampered);
  let deleted = false;
  try { raw.prepare('DELETE FROM ledger WHERE id = 1').run(); }
  catch (e) { deleted = /append-only/.test(e.message); }
  ok('ledger DELETE blocked by trigger', deleted);
  raw.close();

  console.log('— leaderboard / profile —');
  const lb = await api(null, 'GET', '/api/leaderboard');
  ok('leaderboard has 5 people', lb.status === 200 && lb.data.leaders.length === 5 && lb.data.leaders[0].rank === 1, lb.data.leaders.length);
  ok('weekly xp present', typeof lb.data.leaders[0].weeklyXp === 'number');
  const prof = await api(null, 'GET', `/api/users/${neoMe.data.user.id}`);
  ok('public profile', prof.status === 200 && prof.data.user.displayName === 'Neo', prof.data.user);
  ok('profile shows visible review', prof.data.reviews.length === 1, prof.data.reviews);
  const prof404 = await api(null, 'GET', '/api/users/9999');
  ok('unknown profile 404', prof404.status === 404, prof404.data);

  console.log('— misc contract —');
  const n404 = await api(null, 'GET', '/api/nope');
  ok('unknown endpoint JSON 404', n404.status === 404 && n404.data.error.code === 'NOT_FOUND', n404.data);
  const badJson = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  ok('malformed json → clean error status', badJson.status === 400, badJson.status);
  const serverStillUp = await api(null, 'GET', '/api/health');
  ok('server alive after bad json', serverStillUp.status === 200);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
