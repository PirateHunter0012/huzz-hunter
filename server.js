// Huzz Hunter server. No dependencies: `node server.js`.
// Env: PORT (3000), PASSWORD (shared password, set before exposing online), NEED_HOURS (10, weekly study needed for the Arena).
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const PORT = process.env.PORT || 3000, PASS = process.env.PASSWORD || '';
const NEED = (+process.env.NEED_HOURS || 10) * 3600;
const FILE = path.join(__dirname, 'data.json'), SNAP = path.join(__dirname, 'snapshots');
const UP = path.join(__dirname, 'uploads'), MAX = (+process.env.MAX_MB || 25) * 1048576;
fs.mkdirSync(UP, { recursive: true });
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4' };

let db = { key: crypto.randomBytes(8).toString('hex'), channels: { general: [], random: [], ragdamaxxing: [] }, sessions: [], live: {}, duels: [], bonus: {}, msgs: {} };
/* A truncated or half-written data.json must never be treated as "a brand new site": that would
   start empty and the next save would wipe the real data. Parse strictly, fall back to a snapshot,
   and refuse to boot if nothing usable is left. */
const readJson = f => { try { const t = fs.readFileSync(f, 'utf8'); if (!t.trim()) return null; return JSON.parse(t); } catch (e) { return null; } };
if (fs.existsSync(FILE)) {
  const loaded = readJson(FILE);
  if (loaded) db = { ...db, ...loaded };
  else {
    let fixed = null, from = '';
    try {
      const names = fs.readdirSync(SNAP).filter(n => /^data-\d+\.json$/.test(n)).sort().reverse();
      for (const n of names) { const s = readJson(path.join(SNAP, n)); if (s) { fixed = s; from = n; break; } }
    } catch (e) {}
    if (!fixed) {
      console.error('data.json is unreadable and no snapshot could be restored — refusing to start so nothing overwrites it.');
      process.exit(1);
    }
    console.error('data.json was unreadable; started from snapshot', from);
    try { fs.copyFileSync(FILE, FILE + '.broken-' + Date.now()); } catch (e) {}
    db = { ...db, ...fixed };
  }
}
db.layout = db.layout || { home: { name: 'Huzz Hunter', text: ['general', 'random'], voice: ['Lounge', 'Gaming'] }, rag: { name: 'Ragdamaxxing', text: ['ragdamaxxing', 'study-wins'], voice: ['Silent study', 'Pomodoro room'] } };
db.stickers = db.stickers || {};
/* A hand-edited, half-restored or older data.json must not crash the app on boot: every list the
   rest of this file iterates is forced into the shape it expects before anything else runs. */
Object.values(db.layout).forEach(s => {
  if (!s || typeof s !== 'object') return;
  if (!Array.isArray(s.text)) s.text = [];
  if (!Array.isArray(s.voice)) s.voice = [];
});
if (!db.channels || typeof db.channels !== 'object') db.channels = {};
Object.keys(db.channels).forEach(k => { if (!Array.isArray(db.channels[k])) db.channels[k] = []; });
['sessions', 'duels', 'freqs'].forEach(k => { if (!Array.isArray(db[k])) db[k] = []; });
// Lock in: a member (or the owner on their behalf) can shut the whole app until set study hours are done.
db.lockin = db.lockin || {};
db.voice = {};
// Text chat that belongs to a voice channel, plus which of those channels have the TTS bot reading messages out.
db.vtext = db.vtext || {}; db.vtts = db.vtts || {};
db.coin = db.coin || { hist: [], chat: [], stats: {}, last: null };
// A third server for things that are not studying, so the study servers stay clean.
if (!db.layout.misc) {
  db.layout.misc = { name: 'Miscellaneous', text: ['misc', 'coinflip', 'watchparty'], voice: ['Chill', 'Movie night'] };
}
db.screen = {};
db.watch = db.watch || null;
db.watchchat = db.watchchat || [];
Object.values(db.layout).forEach(s => s.text.forEach(c => { db.channels[c] = db.channels[c] || []; }));
Object.keys(db.channels).forEach(c => { if (!c.startsWith('dm:') && !Object.values(db.layout).some(s => s.text.includes(c))) db.layout.home.text.push(c); });
const leaveVoice = n => Object.values(db.voice).forEach(l => { const i = l.indexOf(n); if (i >= 0) l.splice(i, 1); });
db.users = db.users || {}; db.notes = db.notes || {}; db.seen = db.seen || {};
// Diary pages and plans are private to one account and live on the server, so every device sees them.
db.diary = db.diary || {}; db.plans = db.plans || {};
// Chat wallpaper: one picture, animated GIF, clip or gradient for the WHOLE site, like a theme.
// Anything signed in can change it and everyone sees it; sound and hide stay per device.
db.wall = db.wall || {};
db.wallg = db.wallg || null;
if (!db.wallg) {
  const legacy = Object.values(db.wall).filter(w => w && w.u).sort((a, b) => (b.at || 0) - (a.at || 0))[0];
  if (legacy) db.wallg = legacy;
}
// Read receipts: for each channel, the last timestamp every person has actually looked at.
db.read = db.read || {};
[...Object.keys(db.msgs), ...db.sessions.map(x => x.n), ...Object.values(db.channels).flat().filter(m => !m.bot).map(m => m.name)].forEach(n => { if (n && !db.users[n]) db.users[n] = { last: 0 }; });
// Pings: @name, @everyone, or a reply to someone's message. Stored per person so they survive being offline.
function notify(channel, msg) {
  if (channel.startsWith('dm:')) {
    const other = channel.slice(3).split('|').find(x => x !== msg.name.toLowerCase()), acct = other && Object.hasOwn(db.accts, other) ? db.accts[other] : null;
    if (acct) {
      const x = { id: msg.id, ts: msg.ts, type: 'dm', from: msg.name, channel, text: (msg.text || (msg.st ? 'sticker' : 'attachment')).slice(0, 120) };
      db.notes[acct.name] = (db.notes[acct.name] || []).concat(x).slice(-60);
      clients.forEach((cn, res) => { if (cn === acct.name) send(res, 'note', x); });
    }
    return;
  }
  const t = msg.text || '', to = new Map(), every = /@everyone(?![\w])/i.test(t);
  Object.keys(db.users).forEach(n => {
    if (n === msg.name) return;
    if (every || new RegExp('@' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w])', 'i').test(t)) to.set(n, 'mention');
  });
  if (msg.rp && msg.rp.n && msg.rp.n !== msg.name && !to.has(msg.rp.n)) to.set(msg.rp.n, 'reply');
  to.forEach((type, n) => {
    const x = { id: msg.id, ts: msg.ts, type, from: msg.name, channel, text: t.slice(0, 120) };
    db.notes[n] = (db.notes[n] || []).concat(x).slice(-60);
    clients.forEach((cn, res) => { if (cn === n) send(res, 'note', x); });
  });
}
db.accts = db.accts || {}; db.tokens = db.tokens || {};
/* Tokens now expire. Ones from before this change get a fresh 30 days so nobody is thrown out
   mid-session, and dead tokens are dropped at boot instead of living in data.json forever. */
db.tokexp = db.tokexp || {};
const TOKEN_MS = 30 * 86400000;
Object.keys(db.tokens).forEach(t => { if (!(db.tokexp[t] > 0)) db.tokexp[t] = Date.now() + TOKEN_MS; });
Object.keys(db.tokens).forEach(t => { if (!(db.tokexp[t] > Date.now())) { delete db.tokens[t]; delete db.tokexp[t]; } });
// Music Assistant bot: the bridge signs in with a token, never a PIN, and pushes player state here.
db.np = db.np || {}; db.npkey = db.npkey || crypto.randomBytes(16).toString('hex');
db.npfix = db.npfix || {};
const BOT = 'Music Assistant';
if (!Object.hasOwn(db.accts, BOT.toLowerCase())) {
  db.accts[BOT.toLowerCase()] = { name: BOT, bot: 1, created: Date.now(), p: { dn: 'Music Assistant', accent: '#7c5cff', bio: 'House music bot. What is playing on Music Assistant shows up here like Discord: art, track, artist, album and a live progress bar.' } };
}
// The bot belongs in the member list and always reads as online, the way a Discord music bot does.
db.users[BOT] = db.users[BOT] || { last: Date.now() };
db.friends = db.friends || {}; db.freqs = db.freqs || [];
// Servers have one owner (who may create channels and roles). Legacy servers belong to zoro if that account exists.
db.srvown = db.srvown || {}; db.srvroles = db.srvroles || {}; db.srvmem = db.srvmem || {};
db.bans = db.bans || {}; db.timeouts = db.timeouts || {};
// Server membership. Accounts that already existed when this shipped joined every server that
// existed then, so nobody loses their channels; accounts made after this start in the lobby.
db.srvjoin = db.srvjoin || {}; db.invites = db.invites || {};
if (!db.srvjoin._born) {
  const old = Object.keys(db.accts || {});
  Object.keys(db.layout || {}).forEach(k => { db.srvjoin[k] = [...new Set([...(db.srvjoin[k] || []), ...old])]; });
  db.srvjoin._born = 1;
}
Object.keys(db.layout || {}).forEach(k => { if (db.srvown[k] && !(db.srvjoin[k] || []).includes(db.srvown[k])) (db.srvjoin[k] = db.srvjoin[k] || []).push(db.srvown[k]); });
// The music bot sits in every server, like a Discord music bot, so it shows up in the member list.
Object.keys(db.layout || {}).forEach(k => { db.srvjoin[k] = [...new Set([...(db.srvjoin[k] || []), BOT])]; });
['home', 'rag', 'misc'].forEach(k => { if (db.layout && db.layout[k] && !db.srvown[k] && db.accts && db.accts.zoro) db.srvown[k] = db.accts.zoro.name; });
const fails = {};
/* Small token buckets for the endpoints that write: keyed by account and window, so a normal
   fast chat is untouched but a stuck key or a script cannot flood a channel in seconds. */
const buckets = new Map();
const allow = (n, key, max, ms) => {
  const now = Date.now(), k = key + ':' + String(n).toLowerCase();
  let b = buckets.get(k);
  if (!b || now - b.at > ms) { b = { at: now, n: 0 }; buckets.set(k, b); }
  b.n++;
  if (buckets.size > 4000) buckets.forEach((v, kk) => { if (now - v.at > 600000) buckets.delete(kk); });
  return b.n <= max;
};
const okCh = (ch, n) => !ch.startsWith('dm:') || ch.slice(3).split('|').includes(String(n).toLowerCase());
const allTo = (ev, d, ch) => { const w = ch && ch.startsWith('dm:') ? ch.slice(3).split('|') : null; clients.forEach((n, res) => { if (!w || w.includes(n.toLowerCase())) send(res, ev, d); }); };
/* Log and step aside so systemd can start a clean process instead of one in an unknown state. */
process.on('uncaughtException', e => { console.error('fatal:', (e && e.stack) || e); process.exit(1); });
process.on('unhandledRejection', e => { console.error('fatal promise:', (e && (e.stack || e.message)) || e); process.exit(1); });
db.live = {};
let timer, lastSaveAt = Date.now(), saveQueued = false;
/* Saving is serialised and every write gets its own temp file. Two overlapping writes to the
   same data.json.tmp could interleave: one would rename the file away while the other was still
   writing into it, leaving data.json half old and half new (and unreadable on the next boot). */
let writing = false, dirty = false, gen = 0, tmpSeq = 0;
const tmpPath = () => FILE + '.tmp.' + process.pid + '.' + (++tmpSeq);
const writeDb = () => {
  saveQueued = false;
  if (writing) { dirty = true; return; }
  let body;
  try { body = JSON.stringify(db); } catch (e) { console.error('save failed:', e.message); return; }
  writing = true;
  const my = ++gen, tmp = tmpPath();
  fs.writeFile(tmp, body, err => {
    if (err) { writing = false; console.error('save failed:', err.message); return fs.unlink(tmp, () => {}); }
    fs.rename(tmp, FILE, e => {
      writing = false;
      // A saveNow() landed while this write was in flight: its copy is newer, so drop ours.
      if (my !== gen) { fs.unlink(tmp, () => {}); }
      else if (e) console.error('save rename failed:', e.message);
      else lastSaveAt = Date.now();
      if (dirty) { dirty = false; writeDb(); }
    });
  });
};
const save = () => {
  clearTimeout(timer);
  if (saveQueued) return;
  saveQueued = true;
  timer = setTimeout(writeDb, 300);
};
// Login tokens must survive a restart, so write them straight away instead of waiting for the debounce.
// Bumping gen invalidates any async write already in flight, so it cannot rename stale data over this.
const saveNow = () => {
  clearTimeout(timer); saveQueued = false; dirty = false;
  ++gen;
  const tmp = tmpPath();
  try {
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE); lastSaveAt = Date.now();
  } catch (e) { console.error('save failed:', e.message); fs.unlink(tmp, () => {}); }
};
/* Rolling snapshots (every 15 min, last 48) give the boot guard something to fall back on. */
const snapshot = () => {
  try {
    fs.mkdirSync(SNAP, { recursive: true });
    fs.writeFileSync(path.join(SNAP, 'data-' + Date.now() + '.json'), JSON.stringify(db));
    const list = fs.readdirSync(SNAP).filter(n => /^data-\d+\.json$/.test(n)).sort();
    list.slice(0, Math.max(0, list.length - 48)).forEach(n => { try { fs.unlinkSync(path.join(SNAP, n)); } catch (e) {} });
  } catch (e) {}
};
setInterval(snapshot, 15 * 60000).unref();
saveNow();
setTimeout(snapshot, 60000).unref();
/* Static text (HTML/JS/CSS): gzip once per file version, ETag for 304s. extras.js+extras.css were
   ~435 KB uncompressed on every load; gzip brings that down to roughly a fifth. */
const textCache = new Map();
const sendText = (req, res, file, type, noStore) => {
  let st; try { st = fs.statSync(file); } catch (e) { res.writeHead(404); return res.end(); }
  const tag = '"' + st.size.toString(16) + '-' + Math.round(st.mtimeMs).toString(16) + '"';
  const h = { 'Content-Type': type, ETag: tag, Vary: 'Accept-Encoding', 'Cache-Control': noStore ? 'no-store, must-revalidate' : 'public, max-age=60, must-revalidate' };
  /* old WebViews (installed app shells) ignore no-store alone; these two still mean "always ask". */
  if (noStore) { h.Expires = '0'; h.Pragma = 'no-cache'; }
  if (req.headers['if-none-match'] === tag) { res.writeHead(304, h); return res.end(); }
  const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const key = file + ':' + st.mtimeMs + (gz ? ':gz' : '');
  let body = textCache.get(key);
  if (!body) {
    body = fs.readFileSync(file);
    if (gz) body = zlib.gzipSync(body, { level: 6 });
    if (textCache.size > 20) textCache.clear();
    textCache.set(key, body);
  }
  if (gz) h['Content-Encoding'] = 'gzip';
  h['Content-Length'] = body.length;
  res.writeHead(200, h);
  res.end(body);
};

const clients = new Map();
const send = (res, ev, d) => res.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`);
const all = (ev, d) => clients.forEach((_, res) => send(res, ev, d));
/* Drop a person's live streams (used when they are banned: the socket has to stop feeding them). */
const disconnect = n => clients.forEach((cn, res) => { if (cn === n) { try { res.end(); } catch (e) {} clients.delete(res); } });
const online = () => [...new Set([BOT, ...clients.values()])];
const clean = (s, n) => String(s || '').trim().slice(0, n);
/* A display name has to stay on one line: a newline breaks the member list and the chat header,
   and control characters have no business being in an account name. */
const nm = b => clean(b.name, 24).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 24) || 'anon';
// ---- friends: DMs are friends-only, so a request has to be accepted first ----
const friendsOf = n => (db.friends[n] = db.friends[n] || []);
const isFr = (a, b) => (db.friends[a] || []).some(x => x.toLowerCase() === String(b).toLowerCase());
const frState = n => ({
  friends: (db.friends[n] || []).slice(),
  incoming: db.freqs.filter(f => f.to === n).map(f => f.from),
  outgoing: db.freqs.filter(f => f.from === n).map(f => f.to)
});
const pushFr = n => clients.forEach((cn, res) => { if (cn === n) send(res, 'friends', frState(n)); });
const befriend = (a, b) => {
  db.freqs = db.freqs.filter(f => !((f.from === a && f.to === b) || (f.from === b && f.to === a)));
  [a, b].forEach(n => { const l = friendsOf(n); if (!l.some(x => x.toLowerCase() === String(n === a ? b : a).toLowerCase())) l.push(n === a ? b : a); });
  save(); pushFr(a); pushFr(b);
  return { ok: true, state: frState(a) };
};
// ---- server ownership and roles ----
const ownerOf = k => db.srvown[k] || '';
const inSrv = (k, n) => (db.srvjoin[k] || []).includes(n);
const mySrvs = n => Object.keys(db.layout).filter(k => inSrv(k, n));
const srvLayoutOf = n => Object.fromEntries(mySrvs(n).map(k => [k, db.layout[k]]));
const pushLayout = () => { clients.forEach((n, res) => send(res, 'layout', srvLayoutOf(n))); };
const pushLayoutTo = n => { clients.forEach((cn, res) => { if (cn === n) send(res, 'layout', srvLayoutOf(n)); }); };
const canMgr = (k, n) => { const o = ownerOf(k); return !!o && o === n; };
const roleOut = () => ({ ok: true, roles: db.srvroles, mem: db.srvmem, own: db.srvown, bans: db.bans, timeouts: db.timeouts });
// ---- moderation: site bans and per-server timeouts ----
const banOf = n => db.bans[String(n || '').toLowerCase()] || null;
const toKey = (k, n) => clean(k, 16) + '|' + String(n || '').toLowerCase();
const toOf = (k, n) => {
  const key = toKey(k, n), t = db.timeouts[key];
  if (!t) return null;
  if (+t.until <= Date.now()) { delete db.timeouts[key]; save(); return null; }
  return t;
};
const srvOfChannel = ch => Object.keys(db.layout).find(k => [...(db.layout[k].text || []), ...(db.layout[k].voice || [])].includes(ch)) || '';
/* Can this account use this channel at all? A DM needs to be one of its two people; a server
   channel needs membership in the server that owns it. Channels from an older layout that no
   server lists stay open, so nothing that used to work suddenly stops. */
const inCh = (ch, n) => {
  const c = String(ch || '');
  if (!c) return false;
  if (c.startsWith('dm:')) return okCh(c, n);
  const k = srvOfChannel(c);
  return !k || inSrv(k, n);
};
// A timeout counts wherever the person tries to talk: the channel’s own server first, then any
// server that has them timed out, so a rename or a moved channel cannot slip past it.
const timeoutFor = (ch, n) => {
  if (!n || String(ch || '').startsWith('dm:')) return null;
  const own = toOf(srvOfChannel(ch), n);
  if (own) return own;
  const low = String(n).toLowerCase();
  let found = null;
  Object.keys(db.timeouts).forEach(key => {
    if (key.slice(key.indexOf('|') + 1) !== low) return;
    const t = db.timeouts[key];
    if (+t.until > Date.now()) found = found || t;
    else delete db.timeouts[key];
  });
  return found;
};
// Anyone who owns a server here may lock in / unlock another account (the owner check on the
// client uses the same list, so the button only shows where it actually works).
const runsServer = n => !!n && Object.values(db.srvown).includes(n);
const liveMap = () => Object.fromEntries(Object.entries(db.live).map(([k, v]) => [k, { s: v.s, t: v.t, acc: v.acc || 0, hold: v.hold || 0 }]));
// Seconds studied in a session: earlier stretches plus the one running now. A paused session
// keeps its clock frozen at `hold`, so paused time never counts as study time.
const liveSecs = l => Math.max(0, (l.acc || 0) + (((l.hold || Date.now()) - l.t) / 1e3));
// ---- lock in ----
// Only real study time counts: finished sessions since the lock started, plus the stretch of the
// session that is running right now. Paused time is ignored, exactly like the timer.
const lockDone = n => {
  const l = db.lockin[n]; if (!l) return 0;
  const live = db.live[n];
  const extra = live ? Math.max(0, liveSecs(live) - Math.max(0, (l.at - live.t) / 1e3)) : 0;
  return sum(n, l.at) + extra;
};
const lockInfo = n => {
  const l = db.lockin[n]; if (!l) return null;
  const need = Math.max(600, Math.round(+l.h || 0)), done = Math.round(lockDone(n));
  if (done >= need) { delete db.lockin[n]; save(); return null; }
  return { need, done, at: l.at, by: l.by || '' };
};
// Who is studying (and for how long) is only sent to people whose Arena is unlocked this week.
const isOpen = n => sum(n, weekStart()) >= NEED;
const liveCast = () => clients.forEach((n, res) => { const open = isOpen(n); send(res, 'live', open ? liveMap() : {}); send(res, 'unlock', { open }); });
setInterval(liveCast, 60000);
// Drop now-playing state nobody refreshed (player closed, or the bridge went down).
setInterval(() => {
  const before = Object.keys(db.np).length;
  Object.keys(db.np).forEach(n => { if (!npOut(n)) delete db.np[n]; });
  if (Object.keys(db.np).length !== before) { save(); all('np', npAll()); }
}, 60000);

function post(channel, name, text, bot, extra) {
  // Locked in: no chatting until the set hours are actually studied.
  if (!bot && lockInfo(name)) return false;
  // Timed out in this server: the messages stay blocked until the clock runs out.
  if (!bot && timeoutFor(channel, name)) return false;
  // A channel belongs to a server: a non-member (a kicked account, or a stranger who guessed
  // the channel name) must not be able to post into it.
  if (!bot && !inCh(channel, name)) return false;
  if (channel.startsWith('dm:')) {
    const w = channel.slice(3).split('|');
    if (w.length !== 2 || !w.includes(name.toLowerCase()) || !w.every(x => Object.hasOwn(db.accts, x))) return false;
    // friends only: a DM channel cannot be posted in until both sides accepted
    if (!isFr(db.accts[w[0]].name, db.accts[w[1]].name)) return false;
    db.channels[channel] = db.channels[channel] || [];
  }
  const list = db.channels[channel];
  if (!list || (!text && !(extra && (extra.st || extra.att)))) return false;
  const msg = { id: crypto.randomUUID(), name, text, ts: Date.now(), bot: !!bot, ...extra };
  list.push(msg);
  if (list.length > 500) list.shift();
  if (!bot) db.msgs[name] = (db.msgs[name] || 0) + 1;
  save();
  allTo('msg', { channel, msg }, channel);
  notify(channel, msg);
  return true;
}

// ---- study maths: week starts Monday 00:00 (server time) ----
const weekStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return +d; };
const sum = (n, from = 0, to = Infinity) => db.sessions.reduce((a, x) => a + (x.n === n && x.t >= from && x.t < to ? x.secs : 0), 0);
const xp = n => db.sessions.reduce((a, x) => a + (x.n === n ? x.xp : 0), 0) + (db.bonus[n] || 0);

const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; };
const startOfMonth = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return +d; };
function stats(n) {
  const ss = db.sessions.filter(x => x.n === n), ds = new Set(ss.map(x => new Date(x.t).toDateString()));
  let streak = 0; const d = new Date();
  if (!ds.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (ds.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
  // A day-by-day run for any window, so the charts can show a week, a month or a quarter.
  const run = k => [...Array(k)].map((_, i) => {
    const e = new Date(); e.setDate(e.getDate() - (k - 1) + i); e.setHours(0, 0, 0, 0);
    return {
      l: k <= 7 ? e.toLocaleDateString('en', { weekday: 'short' }) : e.getDate() + '/' + (e.getMonth() + 1),
      secs: sum(n, +e, +e + 864e5)
    };
  });
  // All-time view: the last twkve months, which is how far a study year really feels.
  const months = [...Array(12)].map((_, i) => {
    const e = new Date(); e.setDate(1); e.setHours(0, 0, 0, 0); e.setMonth(e.getMonth() - (11 - i));
    const nx = new Date(e); nx.setMonth(nx.getMonth() + 1);
    return { l: e.toLocaleDateString('en', { month: 'short' }), secs: sum(n, +e, +nx) };
  });
  const ws = weekStart(), subj = {}, subjWeek = {}, byDay = {};
  ss.forEach(x => {
    subj[x.s] = (subj[x.s] || 0) + x.secs;
    if (x.t >= ws) subjWeek[x.s] = (subjWeek[x.s] || 0) + x.secs;
    const k = new Date(x.t).toDateString();
    byDay[k] = (byDay[k] || 0) + x.secs;
  });
  const best = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0] || null;
  const longest = ss.reduce((a, x) => (x.secs > (a ? a.secs : 0) ? x : a), null);
  const total = sum(n), activeDays = ds.size;
  return {
    today: sum(n, startOfDay(Date.now())), week: sum(n, ws), month: sum(n, startOfMonth()), total, xp: xp(n), streak,
    days: run(7), days30: run(30), months, subj, subjWeek,
    best: best ? { d: best[0], secs: best[1] } : null,
    longest: longest ? { secs: longest.secs, s: longest.s } : null,
    activeDays, first: ss.length ? Math.min(...ss.map(x => x.t)) : 0,
    avgDay: activeDays ? Math.round(total / activeDays) : 0,
    sessions: ss.length, msgs: db.msgs[n] || 0
  };
}

// ---- profiles: display name, avatar, banner, pronouns, custom status, bio ----
const BANNERS = ['plum', 'ocean', 'ember', 'mint', 'rose', 'mono', 'sunset', 'galaxy', 'cyber', 'gold', 'sakura', 'toxic', 'foxfire', 'cursed', 'neoncity', 'arena', 'blossom'];
const DECOS = ['neon', 'fire', 'aurora', 'rainbow', 'sakura', 'glitch', 'halo', 'electric', 'pulse', 'gold', 'void', 'ice', 'fox', 'cursed', 'mecha', 'rgb', 'blade'];
const NFX = ['rainbow', 'gradient', 'glow', 'neon', 'shimmer', 'fire', 'glitch', 'wave', 'arcade', 'hologram', 'blood', 'outline', 'chrome'];
const BFX = ['aurora', 'flow', 'stars', 'rain', 'shimmer', 'waves', 'embers', 'scan', 'lightning', 'hex', 'vhs', 'sparks'];
const BADGES = ['katana', 'zoro', 'zerotwo', 'png'];
const PFX = ['sparkles', 'snow', 'hearts', 'fireflies', 'embers', 'matrix', 'stars', 'petals', 'foxfire', 'slashes', 'pixels', 'cyber'];
// The Shop-style packs: the whole look (profile aura + member list row) keys off this id.
const PACKS = ['kitsune', 'cursedking', 'neonrunner', 'ranked', 'sakurablade', 'sukunaedit'];
const acctOf = n => (Object.hasOwn(db.accts, String(n || '').toLowerCase()) ? db.accts[String(n || '').toLowerCase()] : null);
const imgOk = (v, max) => typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= max;
// Everyone sees each other's avatar and display name, so keep it small and public.
// Animated avatars/banners (gif, animated webp, png) are stored as files; the profile only keeps their short URL.
const sniffImg = b => {
  if (b.length < 12) return '';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.toString('latin1', 0, 4) === 'GIF8') return 'gif';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return '';
};
// AMV backdrops: a real video file uploaded by the account, so the edit plays with its own sound.
const sniffVid = b => {
  if (b.length < 12) return '';
  if (b.toString('latin1', 4, 8) === 'ftyp') return 'mp4';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
  return '';
};
// Delete a replaced picture, but only if this account uploaded it and it is no longer in use.
const dropOldMedia = (a, v) => {
  const p = a.p || {};
  if (!v || v === p.av || v === p.banner || !(a.pm || []).includes(v)) return;
  a.pm = a.pm.filter(x => x !== v);
  fs.unlink(path.join(UP, path.basename(v)), () => {});
};
// Pictures the profile still points at. A badge set lives in pchl, so its files must never be
// pruned just because the account uploaded something newer.
const keptMedia = p => new Set([p.av, p.banner, p.art, p.amv, p.pchv, ...(Array.isArray(p.pchl) ? p.pchl : [])].filter(Boolean));
// `art` is the profile backdrop address only (never the picture itself), so the browser can start
// downloading it with the member list instead of waiting until someone opens the card.
const people = () => Object.fromEntries(Object.values(db.accts).map(a => { const p = a.p || {}; return [a.name, { dn: p.dn || '', av: p.av || '', deco: p.deco || '', nfx: p.nfx || '', acc: p.accent || '', acc2: p.acc2 || '', pack: p.pack || '', art: /^\/huzz-hunter\/uploads\//.test(String(p.art || '')) ? p.art : '', bot: a.bot ? 1 : 0 }]; }));
// ---- now playing: the bridge writes this, profiles and the member list read it ----
const NP_TTL = 15 * 60000;
// Manual artist/album fixes: the bridge sometimes brings "Unknown" from Music Assistant, so a
// person can correct a track by its title and the fix is applied to every later push.
const npKey = s => String(s || '').trim().toLowerCase();
/* A saved per-track fix must survive Music Assistant decorating the title ("(Remastered)",
   "- Sped Up", "(feat. …)"), otherwise the same song looks up lyrics as if it were new. */
const npBase = s => npKey(s)
  .replace(/[([{][^)\]}]*[)\]}]/g, ' ')
  .replace(/\s*[-–—]\s*(remaster(ed)?|sped up|slowed( down)?|reverb|live|acoustic|instrumental|radio edit|.*\b(mix|version))\b.*$/i, ' ')
  .replace(/[^a-z0-9\u00c0-\uffff]+/g, ' ')
  .trim();
const fixFor = t => {
  const direct = db.npfix[npKey(t)];
  if (direct) return direct;
  const base = npBase(t);
  if (!base) return null;
  const hit = Object.keys(db.npfix).find(k => npBase(db.npfix[k].t || k) === base);
  return hit ? db.npfix[hit] : null;
};
// ---- metadata lookup: LRCLIB gives artist/album/lyrics, iTunes fills the gaps ----
const jgetj = async (url, ms = 7000) => {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'user-agent': 'huzz-hunter/1.0' } });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; } finally { clearTimeout(t); }
};
const normTitle = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const metaLookup = async (title, artist, dur) => {
  const want = normTitle(title);
  if (!want) return { error: 'No track title.' };
  /* Several songs share a title ("Double Take" alone has a dozen), so the artist matters as much
     as the name: a name match with the wrong artist is worth less than an exact artist + duration
     hit, and a wrong artist is never allowed to win outright. */
  const art = normTitle(artist || '');
  const score = (name, len, who) => {
    let s = normTitle(name) === want ? 3 : normTitle(name).includes(want) ? 1 : -5;
    if (dur && len) s += Math.abs(len - dur) <= 4 ? 4 : Math.abs(len - dur) <= 12 ? 2 : Math.abs(len - dur) <= 25 ? 0 : -3;
    if (art) {
      const w = normTitle(who || '');
      s += w === art ? 4 : w && (w.includes(art) || art.includes(w)) ? 2 : -3;
    }
    return s;
  };
  let best = null;
  const lr = await jgetj('https://lrclib.net/api/search?track_name=' + encodeURIComponent(title) + (artist ? '&artist_name=' + encodeURIComponent(artist) : ''));
  if (Array.isArray(lr) && lr.length) {
    const pick = lr.map(x => ({ x, s: score(x.trackName, x.duration, x.artistName) })).sort((a, b) => b.s - a.s)[0];
    if (pick && pick.s >= 4) best = pick.x;
  }
  /* nothing convincing under that artist: search the bare title and only keep a duration-exact entry */
  if (!best && art) {
    const loose = await jgetj('https://lrclib.net/api/search?track_name=' + encodeURIComponent(title));
    if (Array.isArray(loose) && loose.length) {
      const pick = loose.map(x => ({ x, s: score(x.trackName, x.duration, x.artistName) })).sort((a, b) => b.s - a.s)[0];
      if (pick && pick.s >= 5) best = pick.x;
    }
  }
  if (!best) {
    const it = await jgetj('https://itunes.apple.com/search?entity=song&limit=8&term=' + encodeURIComponent(title + (artist ? ' ' + artist : '')));
    const pick = ((it && it.results) || []).map(x => ({ x, s: score(x.trackName, Math.round((x.trackTimeMillis || 0) / 1000)) })).sort((a, b) => b.s - a.s)[0];
    if (pick && pick.s >= 3) best = { trackName: pick.x.trackName, artistName: pick.x.artistName, albumName: pick.x.collectionName, duration: Math.round((pick.x.trackTimeMillis || 0) / 1000), src: 'itunes' };
  }
  if (!best) return { ok: false, error: 'Online kuch match nahi mila — naam thoda theek se likho.' };
  const lyrics = String(best.plainLyrics || best.syncedLyrics || '').trim();
  return { ok: true, artist: best.artistName || '', album: best.albumName || '', lyrics: lyrics.slice(0, 8000), dur: Math.round(best.duration || 0), src: best.src || 'lrclib' };
};
// The bridge drops its Music Assistant websocket now and then and reports "nothing playing" for a
// tick or two. Keep the last track through a short grace window so the card and the member list do
// not blink out mid-song; it disappears only if the player really stays gone.
const NP_GRACE = +process.env.NP_GRACE || 120000;
const npOut = n => {
  const v = db.np[n];
  if (!v || Date.now() - v.at > NP_TTL) return null;
  if (v.gone && Date.now() - v.gone > NP_GRACE) return null;
  return { t: v.t, a: v.a, al: v.al, art: v.art, dur: v.dur, el: v.el, at: v.at, p: v.gone ? 0 : v.p, url: v.url, src: v.src };
};
const npAll = () => Object.fromEntries(Object.keys(db.np).map(n => [n, npOut(n)]).filter(([, v]) => v));
// ---- /play: the bot asks the Music Assistant API on this machine to start a track ----
const MA_URL = process.env.MA_URL || 'ws://127.0.0.1:8096/ws';
const MA_TIMEOUT = 5000;
function maCall(messages) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket !== 'function') return reject(new Error('Music Assistant control needs Node 22 or newer on this machine.'));
    let sock = null, done = false, last = null, id = 0, queue = messages.slice();
    const finish = (err, val) => {
      if (done) return;
      done = true; clearTimeout(timer);
      try { if (sock) sock.close(); } catch (e) {}
      err ? reject(err) : resolve(val);
    };
    const timer = setTimeout(() => finish(new Error('Music Assistant did not answer in time.')), MA_TIMEOUT);
    const next = () => {
      if (!queue.length) return finish(null, last);
      const m = queue.shift();
      try { sock.send(JSON.stringify({ message_id: String(++id), command: m.command, args: m.args || {} })); } catch (e) { finish(e); }
    };
    try { sock = new WebSocket(MA_URL); } catch (e) { return finish(e); }
    sock.onopen = next;
    sock.onerror = () => finish(new Error('Music Assistant is not reachable at ' + MA_URL + '.'));
    sock.onclose = () => finish(new Error('Music Assistant closed the connection before answering.'));
    sock.onmessage = ev => {
      let d = null;
      try { d = JSON.parse(ev.data); } catch (e) { return; }
      if (!d || !d.message_id || String(d.message_id) !== String(id)) return;
      if (d.error_code) return finish(new Error(d.details || d.error_code));
      last = d.result;
      next();
    };
  });
}
// Shared credentials for the Music Assistant API (the same token /play already uses).
const maAuth = () => {
  let tok = process.env.MA_TOKEN || '';
  if (!tok && process.env.MA_TOKEN_FILE) { try { tok = fs.readFileSync(process.env.MA_TOKEN_FILE, 'utf8').trim(); } catch (e) { tok = ''; } }
  const user = process.env.MA_USER || '', pass = process.env.MA_PASS || '';
  if (!tok && !(user && pass)) return null;
  return tok ? { command: 'auth', args: { token: tok } } : { command: 'auth', args: { username: user, password: pass } };
};
// Space in the chat: pause or resume whatever Music Assistant is playing on its active player.
const maToggle = async () => {
  const auth = maAuth();
  if (!auth) return { error: 'Music Assistant control is not set up yet.' };
  try {
    const queues = await maCall([auth, { command: 'player_queues/all' }]);
    const list = Array.isArray(queues) ? queues.filter(q => q && q.queue_id) : [];
    const queue = list.find(q => q.active && q.available !== false) || list.find(q => q.available !== false) || list[0];
    if (!queue) return { error: 'Music Assistant has no player queue right now.' };
    const wasPlaying = queue.state === 'playing';
    await maCall([auth, { command: 'player_queues/play_pause', args: { queue_id: queue.queue_id } }]);
    return { ok: true, paused: wasPlaying };
  } catch (err) {
    return { error: (err && err.message) || 'Music Assistant did not answer.' };
  }
};
const maPlay = async (by, q) => {
  q = clean(q, 120);
  if (!q) return { error: 'What should I play? Try /play lofi beats.' };
  let tok = process.env.MA_TOKEN || '';
  if (!tok && process.env.MA_TOKEN_FILE) { try { tok = fs.readFileSync(process.env.MA_TOKEN_FILE, 'utf8').trim(); } catch (e) { tok = ''; } }
  const user = process.env.MA_USER || '', pass = process.env.MA_PASS || '';
  if (!tok && !(user && pass)) return { error: 'Music Assistant control is not set up yet: set MA_TOKEN (or MA_USER + MA_PASS) for the service, then try again.' };
  const auth = tok ? { command: 'auth', args: { token: tok } } : { command: 'auth', args: { username: user, password: pass } };
  try {
    const queues = await maCall([auth, { command: 'player_queues/all' }]);
    const list = Array.isArray(queues) ? queues.filter(x => x && x.queue_id) : [];
    // Only a queue whose player is actually reachable can start audio; idle/offline ones answer
    // "The player is not available", so prefer an available one and fall back only after that.
    const reachable = q => !!q && q.available !== false;
    const queue = list.find(q => reachable(q) && q.active) || list.find(reachable) || list.find(q => q.active) || list[0];
    if (!queue) return { error: 'Music Assistant has no player queue to play on right now.' };
    // MA 2.x answers with { tracks, albums, playlists, … }; older builds answered with a plain list.
    const search = async query => {
      const found = await maCall([auth, { command: 'music/search', args: { search_query: query, media_types: ['track', 'album', 'playlist'], limit: 5 } }]);
      const items = Array.isArray(found)
        ? found
        : ['tracks', 'albums', 'playlists', 'artists'].flatMap(k => ((found && found[k]) || []));
      return items.find(x => x && x.uri) || null;
    };
    // Romaji typed for a Japanese song usually will not match MA's Japanese metadata, so try the
    // original title we have already romanized before giving up.
    let hit = null;
    if (!/\u3040-\u30ff\u4e00-\u9fff/.test(q)) {
      const want = q.toLowerCase().replace(/[^a-z0-9]+/g, '');
      const orig = Object.keys(db.romaji || {}).find(k => {
        const r = db.romaji[k] && db.romaji[k].r;
        return r && r.toLowerCase().replace(/[^a-z0-9]+/g, '') === want;
      });
      if (orig && orig !== q) hit = await search(orig);
    }
    if (!hit) hit = await search(q);
    if (!hit) return { error: 'Nothing in Music Assistant matched “' + q + '”.' };
    // MA 2.10 wants the whole serialised media item; older builds took a media_id (uri).
    let lastErr = null;
    try { await maCall([auth, { command: 'player_queues/play_media', args: { queue_id: queue.queue_id, media: hit, option: 'replace' } }]); }
    catch (e) {
      lastErr = e;
      try { await maCall([auth, { command: 'player_queues/play_media', args: { queue_id: queue.queue_id, media_id: hit.uri, option: 'replace' } }]); lastErr = null; }
      catch (e2) { lastErr = e2; }
    }
    if (lastErr) return { error: String((lastErr && lastErr.message) || lastErr) };
    return { ok: true, t: hit.name || q, a: (hit.artists || []).map(x => x && x.name).filter(Boolean).join(', '), by };
  } catch (e) { return { error: String((e && e.message) || e) }; }
};
/* Japanese titles cannot be typed into a search box, so keep a romanized copy (pykakasi) for the
   now-playing card and for /play, which turns the romaji back into the real title. */
const ROMAJI_PY = require('path').join(__dirname, 'romaji.py');
const JP = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/;
function romajiOf(t, a) {
  t = clean(t, 160); a = clean(a, 120);
  if (!t || (!JP.test(t) && !JP.test(a))) return Promise.resolve(null);
  db.romaji = db.romaji || {};
  const key = (t + '\u0000' + a).toLowerCase(), hit = db.romaji[key];
  if (hit && (hit.r || Date.now() - (hit.at || 0) < 36e5)) return Promise.resolve(hit.r || null);
  return new Promise(resolve => {
    require('child_process').execFile('python3', [ROMAJI_PY, t, a], { timeout: 9000 }, (err, stdout) => {
      let r = null;
      try { const d = JSON.parse(String(stdout || '{}')); r = d && d.title ? clean(d.title, 160) : null; } catch (e) { r = null; }
      db.romaji[key] = { r, at: Date.now() };
      save();
      resolve(r);
    });
  });
}
// Old accounts had no sign-up date: use their first message or study session.
Object.values(db.accts).forEach(a => {
  if (a.created) return;
  const ts = [...db.sessions.filter(x => x.n === a.name).map(x => x.t), ...Object.values(db.channels).flat().filter(m => m && m.name === a.name).map(m => m.ts)].filter(Boolean);
  a.created = ts.length ? Math.min(...ts) : Date.now();
});
// Pictures used to live as base64 inside the profile, so every profile open re-downloaded the
// whole image. Move them into /uploads once: the JSON stays tiny and the browser can cache them.
let movedInline = 0;
Object.values(db.accts).forEach(a => {
  const p = (a.p = a.p || {});
  for (const k of ['av', 'banner', 'art']) {
    if (typeof p[k] === 'string' && p[k].startsWith('data:image/')) {
      const u = storePic(a, p[k], 400000);
      if (u) { p[k] = u; movedInline++; }
    }
  }
});
if (movedInline) console.log('[huzz] moved ' + movedInline + ' inline picture(s) into /uploads');
save();
// A picture the profile keeps: an /uploads file (already ours) or an inline data URL that we
// turn into a file right here. Returns '' when the value is not an acceptable picture.
function storePic(a, value, max) {
  const v = String(value || '');
  if (!v) return '';
  if (v.startsWith('/huzz-hunter/uploads/') && (a.pm || []).includes(v)) return v;
  if (!imgOk(v, max)) return '';
  const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(v);
  if (!m) return '';
  const buf = Buffer.from(m[2], 'base64');
  const ext = buf.length ? sniffImg(buf) : '';
  if (!ext) return '';
  const f = crypto.randomBytes(12).toString('hex') + '.' + ext, url = '/huzz-hunter/uploads/' + f;
  try { fs.writeFileSync(path.join(UP, f), buf); } catch { return ''; }
  a.pm = [...(a.pm || []), url];
  if (a.pm.length > 24) a.pm = a.pm.slice(-24);
  return url;
}
function prof(name, viewer) {
  const a = acctOf(name), n = a ? a.name : String(name || ''), p = (a && a.p) || {}, s = stats(n), l = db.live[n];
  const open = isOpen(viewer);
  // Study numbers stay private until the viewer's Arena unlocks, the same rule as the live map,
  // so a profile never leaks the ragdamaxxing stats to someone who has not earned access yet.
  const sl = !open && n !== viewer ? 1 : 0;
  return {
    name: n, dn: p.dn || '', pron: p.pron || '', status: p.status || '', emoji: p.emoji || '', bio: p.bio || '',
    banner: p.banner || '', accent: p.accent || '', av: p.av || '', acc2: p.acc2 || '', ctheme: p.ctheme ? 1 : 0,
    deco: p.deco || '', nfx: p.nfx || '', bfx: p.bfx || '', pfx: p.pfx || '', pack: p.pack || '', art: p.art || '',
    artfit: p.artfit || '', artz: p.artz || 0, artr: p.artr || '', artx: p.artx || 0, arty: p.arty || 0, banr: p.banr || '',
    amv: p.amv || '', amvo: p.amvo || 0, pch: p.pch || '', pchv: p.pchv || '', pchs: p.pchs || 0,
    pchl: Array.isArray(p.pchl) ? p.pchl.slice(0, 8) : [],
    lock: lockInfo(n),
    created: (a && a.created) || 0, last: (db.users[n] || {}).last || 0, on: online().includes(n), bot: !!(a && a.bot), np: npOut(n),
    week: sl ? 0 : s.week, total: sl ? 0 : s.total, today: sl ? 0 : s.today, streak: sl ? 0 : s.streak,
    xp: sl ? 0 : s.xp, msgs: sl ? 0 : s.msgs, sessions: sl ? 0 : s.sessions, sl,
    subj: sl ? [] : Object.entries(s.subj).sort((x, y) => y[1] - x[1]).slice(0, 4),
    // Study habits stay private until the Arena unlocks, same rule as the live map.
    live: l && (open || n === viewer) ? { s: l.s, t: l.t, acc: l.acc || 0, hold: l.hold || 0 } : null
  };
}

function settle() {
  const now = Date.now();
  let done = 0;
  db.duels.forEach(d => {
    if (d.st !== 'live' || now < d.end) return;
    d.sa = sum(d.a, d.start, d.end); d.sb = sum(d.b, d.start, d.end);
    d.win = d.sa === d.sb ? 'draw' : d.sa > d.sb ? d.a : d.b;
    d.st = 'done';
    if (d.win !== 'draw') db.bonus[d.win] = (db.bonus[d.win] || 0) + 150;
    done++;
  });
  return done;
}
/* Duels used to settle only when somebody opened the Arena, so a finished duel could sit
   "live" for days and the winner never got the 150 XP. Settle on a timer instead. */
setInterval(() => { if (settle()) save(); }, 30000);

const H = {
  'POST /api/send': b => {
    const ch = clean(b.channel, 80), n = nm(b), t = timeoutFor(ch, n);
    if (t) return { error: 'You are timed out here for ' + Math.max(1, Math.round((t.until - Date.now()) / 60000)) + ' more minutes.' };
    if (!ch) return { error: 'Pick a channel first.' };
    if (!inCh(ch, n)) return { error: 'That channel is not available to your account.' };
    if (!db.channels[ch] && !ch.startsWith('dm:')) return { error: 'That channel no longer exists.' };
    if (!allow(n, 'chat:burst', 12, 5000) || !allow(n, 'chat:min', 90, 60000)) return { error: 'Slow down a little — that is a lot of messages.' };
    const ok = post(ch, n, clean(b.text, 2000), false, { ...(b.st ? { st: clean(b.st, 40) } : {}), ...(b.rp && b.rp.id ? { rp: { id: clean(b.rp.id, 40), n: clean(b.rp.n, 24), t: clean(b.rp.t, 80) } } : {}) });
    // A bare { ok: false } looked like a dead button in the client; say what went wrong instead.
    return ok ? { ok } : { error: lockInfo(n) ? 'Locked in — finish your study hours first.' : 'That message could not be sent.' };
  },
  /* ---- moderation endpoints (server owner only) ---- */
  'POST /api/mod/kick': b => {
    const k = clean(b.srv, 16), u = clean(b.user, 24), me2 = nm(b);
    if (!canMgr(k, me2)) return { error: 'Only the server owner can kick someone.' };
    if (!u || u === me2 || ownerOf(k) === u) return { error: 'That member cannot be kicked.' };
    db.srvjoin[k] = (Array.isArray(db.srvjoin[k]) ? db.srvjoin[k] : []).filter(x => x !== u);
    if (db.srvmem[k]) delete db.srvmem[k][u];
    Object.keys(db.voice).forEach(c => { if (srvOfChannel(c) === k) db.voice[c] = (db.voice[c] || []).filter(x => x !== u); });
    save(); pushLayoutTo(u); all('voice', db.voice);
    return { ok: true };
  },
  'POST /api/mod/timeout': b => {
    const k = clean(b.srv, 16), u = clean(b.user, 24), me2 = nm(b);
    const mins = Math.max(0, Math.min(10080, Math.round(+b.mins || 0)));
    if (!canMgr(k, me2)) return { error: 'Only the server owner can time someone out.' };
    if (!u || u === me2 || ownerOf(k) === u) return { error: 'That member cannot be timed out.' };
    if (!mins) { delete db.timeouts[toKey(k, u)]; save(); return { ok: true, until: 0, timeouts: db.timeouts }; }
    db.timeouts[toKey(k, u)] = { until: Date.now() + mins * 60000, by: me2, mins, name: u };
    save();
    return { ok: true, until: db.timeouts[toKey(k, u)].until, timeouts: db.timeouts };
  },
  'POST /api/mod/ban': b => {
    const u = clean(b.user, 24), me2 = nm(b);
    if (!runsServer(me2)) return { error: 'Only a server owner can ban someone.' };
    if (!u || u === me2) return { error: 'You cannot ban yourself.' };
    // Use the account's real spelling: a ban on "Zoro" must still find the token stored for "zoro".
    const acct = acctOf(u), target = acct ? acct.name : u;
    if (Object.values(db.srvown).includes(target) || target === me2) return { error: 'A server owner cannot be banned.' };
    db.bans[target.toLowerCase()] = { name: target, by: me2, at: Date.now(), reason: clean(b.reason, 120) };
    Object.keys(db.tokens).forEach(t => { if (db.tokens[t] === target) { delete db.tokens[t]; delete db.tokexp[t]; } });
    Object.keys(db.srvjoin || {}).forEach(s => { db.srvjoin[s] = (Array.isArray(db.srvjoin[s]) ? db.srvjoin[s] : []).filter(x => x !== target); });
    Object.keys(db.voice).forEach(c => db.voice[c] = (db.voice[c] || []).filter(x => x !== target));
    save(); all('voice', db.voice);
    // The ban has to bite now, not on their next reload: close the live streams too.
    disconnect(target); all('online', online());
    return { ok: true, bans: db.bans };
  },
  'POST /api/mod/unban': b => {
    const me2 = nm(b), u = String(clean(b.user, 24)).toLowerCase();
    if (!runsServer(me2)) return { error: 'Only a server owner can unban someone.' };
    if (!db.bans[u]) return { error: 'That account is not banned.' };
    delete db.bans[u]; save();
    return { ok: true, bans: db.bans };
  },
  'GET /api/friends': b => frState(nm(b)),
  'POST /api/friends/req': b => {
    const me = nm(b), to = clean(b.user, 24), acct = acctOf(to);
    if (!acct) return { error: 'No account with that name.' };
    const other = acct.name;
    if (other === me) return { error: 'That is you.' };
    if (isFr(me, other)) return { ok: true, state: frState(me) };
    if (db.freqs.some(f => f.from === other && f.to === me)) return befriend(me, other);
    if (db.freqs.some(f => f.from === me && f.to === other)) return { ok: true, state: frState(me) };
    db.freqs.push({ from: me, to: other, ts: Date.now() });
    save(); pushFr(other); pushFr(me);
    return { ok: true, state: frState(me) };
  },
  'POST /api/friends/ok': b => {
    const me = nm(b), from = clean(b.user, 24), acct = acctOf(from);
    if (!acct) return { error: 'No account with that name.' };
    if (!db.freqs.some(f => f.from === acct.name && f.to === me)) return { error: 'No request from them.' };
    return befriend(me, acct.name);
  },
  'POST /api/friends/no': b => {
    const me = nm(b), from = clean(b.user, 24), acct = acctOf(from), other = acct ? acct.name : from;
    db.freqs = db.freqs.filter(f => !((f.from === me && f.to === other) || (f.from === other && f.to === me)));
    save(); pushFr(me); if (acct) pushFr(acct.name);
    return { ok: true, state: frState(me) };
  },
  'POST /api/friends/del': b => {
    const me = nm(b), other = acctOf(clean(b.user, 24));
    if (!other) return { error: 'No account with that name.' };
    [me, other.name].forEach(n => { db.friends[n] = (db.friends[n] || []).filter(x => x.toLowerCase() !== String(n === me ? other.name : me).toLowerCase()); });
    save(); pushFr(me); pushFr(other.name);
    return { ok: true, state: frState(me) };
  },
  'POST /api/channel': b => {
    const k = clean(b.srv, 16) || 'home', s = db.layout[k];
    if (!s) return { error: 'No such server.' };
    if (!canMgr(k, nm(b))) return { error: 'Only the server owner can add channels.' };
    // b.name is the signed-in user (the dispatcher sets it), so the channel name comes in as b.ch
    const n = clean(b.ch || b.title, 24).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!n) return { error: 'Give the channel a name (letters and numbers).' };
    if (Object.values(db.layout).some(x => x.text.includes(n) || x.voice.includes(n))) return { error: 'A channel with that name already exists.' };
    if (b.kind === 'voice') s.voice.push(n); else { s.text.push(n); db.channels[n] = []; }
    save(); pushLayout();
    return { ok: true, channel: n };
  },
  // Server name and icon: the round buttons down the far left.
  'POST /api/server': b => {
    const s = db.layout[clean(b.srv, 16)];
    if (!s) return { error: 'No such server.' };
    if (!canMgr(clean(b.srv, 16), nm(b))) return { error: 'Only the server owner can change this server.' };
    const n = clean(b.title, 24);
    if (n) s.name = n;
    if (b.icon !== undefined) {
      const v = String(b.icon || '');
      if (imgOk(v, 200000)) s.icon = v;
      else if (v && v.length <= 8) s.icon = v;
      else delete s.icon;
    }
    save(); pushLayout();
    return { ok: true, name: s.name };
  },
  // Create a server: you own it, and it starts with one channel named after it.
  'POST /api/server/new': b => {
    const me2 = nm(b), name = clean(b.title, 24);
    if (!name) return { error: 'Give the server a name.' };
    if (Object.keys(db.layout).length >= 12) return { error: '12 servers is the limit.' };
    const taken = slug => Object.values(db.layout).some(s => s.text.includes(slug) || s.voice.includes(slug));
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'server';
    let i = 2; while (taken(slug)) { slug = (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 16) || 'server') + '-' + i++; }
    const k = 's' + crypto.randomBytes(3).toString('hex');
    db.layout[k] = { name, icon: clean(b.icon, 4) || name.slice(0, 2).toUpperCase(), text: [slug], voice: [] };
    db.channels[slug] = [];
    db.srvown[k] = me2;
    (db.srvjoin[k] = db.srvjoin[k] || []).push(me2);
    save(); pushLayout();
    // A server someone else just made has to show up for everyone, not only for its owner.
    all('newserver', { key: k, name, by: me2 });
    return { ok: true, key: k, channel: slug };
  },
  'POST /api/channel/del': b => {
    const k = clean(b.srv, 16), s = db.layout[k];
    if (!s) return { error: 'No such server.' };
    if (!canMgr(k, nm(b))) return { error: 'Only the server owner can delete channels.' };
    const kind = b.kind === 'voice' ? 'voice' : 'text', ch = clean(b.channel, 80);
    if (!s[kind].includes(ch)) return { error: 'No such channel.' };
    if (kind === 'text' && s.text.length <= 1) return { error: 'A server needs at least one text channel.' };
    s[kind] = s[kind].filter(x => x !== ch);
    if (kind === 'text') { delete db.channels[ch]; delete db.read[ch]; }
    // A deleted voice room must not leave people "in" it or keep its text/TTS state forever.
    else { delete db.voice[ch]; delete db.vtext[ch]; delete db.vtts[ch]; }
    save(); pushLayout(); all('voice', db.voice);
    return { ok: true, layout: db.layout };
  },
  // Invites: any member can make a code and hand the link to whoever they want in the server.
  'POST /api/server/invite': b => {
    const k = clean(b.srv, 16), n = nm(b);
    if (!db.layout[k]) return { error: 'No such server.' };
    if (!inSrv(k, n)) return { error: 'You are not in that server.' };
    let code;
    do { code = crypto.randomBytes(4).toString('hex'); } while (db.invites[code]);
    db.invites[code] = { srv: k, by: n, ts: Date.now() };
    save();
    return { ok: true, code, srv: k, name: db.layout[k].name };
  },
  'GET /api/invite': b => {
    const iv = db.invites[clean(b.code, 24).toLowerCase()];
    if (!iv || !db.layout[iv.srv]) return { error: 'That invite is not valid any more.' };
    return { ok: true, srv: iv.srv, name: db.layout[iv.srv].name, by: iv.by };
  },
  'POST /api/invite/join': b => {
    const iv = db.invites[clean(b.code, 24).toLowerCase()], n = nm(b);
    if (!iv || !db.layout[iv.srv]) return { error: 'That invite is not valid any more.' };
    const list = db.srvjoin[iv.srv] = db.srvjoin[iv.srv] || [];
    if (!list.includes(n)) list.push(n);
    save(); pushLayoutTo(n);
    return { ok: true, srv: iv.srv, name: db.layout[iv.srv].name };
  },
  // Leaving: you stop seeing that server's channels. The owner stays, so a server is never orphaned.
  'POST /api/server/leave': b => {
    const k = clean(b.srv, 16), n = nm(b);
    if (!db.layout[k]) return { error: 'No such server.' };
    if (db.srvown[k] === n) return { error: 'You own this server, so you cannot leave it.' };
    db.srvjoin[k] = (db.srvjoin[k] || []).filter(x => x !== n);
    save(); pushLayoutTo(n);
    return { ok: true, mine: mySrvs(n) };
  },
  'GET /api/roles': () => roleOut(),
  'POST /api/role/new': b => {
    const k = clean(b.srv, 16);
    if (!db.layout[k]) return { error: 'No such server.' };
    if (!canMgr(k, nm(b))) return { error: 'Only the server owner can create roles.' };
    const list = (db.srvroles[k] = db.srvroles[k] || []);
    if (list.length >= 15) return { error: '15 roles is the limit for one server.' };
    const color = /^#[0-9a-f]{6}$/i.test(String(b.color || '')) ? String(b.color).toLowerCase() : '#8b9dff';
    list.push({ id: crypto.randomBytes(3).toString('hex'), name: clean(b.rname, 20) || 'new role', color });
    save(); all('roles', roleOut());
    return roleOut();
  },
  'POST /api/role/edit': b => {
    const k = clean(b.srv, 16), r = (db.srvroles[k] || []).find(x => x.id === b.id);
    if (!r) return { error: 'No such role.' };
    if (!canMgr(k, nm(b))) return { error: 'Only the server owner can change roles.' };
    const n = clean(b.rname, 20); if (n) r.name = n;
    if (/^#[0-9a-f]{6}$/i.test(String(b.color || ''))) r.color = String(b.color).toLowerCase();
    save(); all('roles', roleOut());
    return roleOut();
  },
  'POST /api/role/del': b => {
    const k = clean(b.srv, 16);
    if (!canMgr(k, nm(b))) return { error: 'Only the server owner can delete roles.' };
    db.srvroles[k] = (db.srvroles[k] || []).filter(x => x.id !== b.id);
    const mem = db.srvmem[k] || {};
    Object.keys(mem).forEach(u => { if (mem[u] === b.id) delete mem[u]; });
    save(); all('roles', roleOut());
    return roleOut();
  },
  'POST /api/role/set': b => {
    const k = clean(b.srv, 16), user = clean(b.user, 24);
    if (!db.layout[k]) return { error: 'No such server.' };
    if (!canMgr(k, nm(b))) return { error: 'Only the server owner can give roles.' };
    const acct = acctOf(user); if (!acct) return { error: 'No such member.' };
    const mem = (db.srvmem[k] = db.srvmem[k] || {});
    if (!b.role) delete mem[acct.name];
    else if (!(db.srvroles[k] || []).some(r => r.id === b.role)) return { error: 'No such role.' };
    else mem[acct.name] = b.role;
    save(); all('roles', roleOut());
    return roleOut();
  },
  // Coinflip room: the server decides the side and the start time, so every
  // browser in the room sees the same coin land on the same side together.
  'GET /api/coin': () => ({ hist: db.coin.hist, stats: db.coin.stats, chat: db.coin.chat, last: db.coin.last }),
  'POST /api/coin': b => {
    const who = nm(b), c = clean(b.call, 6).toLowerCase();
    const call = c === 'heads' || c === 'tails' ? c : '';
    const side = crypto.randomInt(2) ? 'heads' : 'tails';
    const round = { id: crypto.randomBytes(4).toString('hex'), by: who, call, side, at: Date.now() + 250 };
    if (call) {
      const s = db.coin.stats[who] = db.coin.stats[who] || { w: 0, l: 0, run: 0, best: 0 };
      if (call === side) { s.w++; s.run++; s.best = Math.max(s.best, s.run); } else { s.l++; s.run = 0; }
    }
    db.coin.last = round;
    db.coin.hist.unshift(round);
    db.coin.hist = db.coin.hist.slice(0, 12);
    save();
    all('coin', { round, stats: db.coin.stats });
    return { ok: true, round, stats: db.coin.stats };
  },
  // The chat under the coin, so the call can be argued about in the same place.
  'POST /api/coin/chat': b => {
    const t = clean(b.text, 200);
    if (!t) return { error: 'Say something first.' };
    const m = { id: crypto.randomBytes(4).toString('hex'), n: nm(b), t, at: Date.now() };
    db.coin.chat.push(m);
    db.coin.chat = db.coin.chat.slice(-60);
    save(); all('coinchat', m);
    return { ok: true, m };
  },
  // Watch party: one shared player, everybody jumps to the same second.
  'GET /api/watch': () => ({ watch: db.watch, chat: db.watchchat }),
  'POST /api/watch': b => {
    const url = clean(b.url, 300);
    if (url && !/^https?:\/\//i.test(url)) return { error: 'Paste a link that starts with http.' };
    const base = url || (db.watch && db.watch.url) || '';
    if (!base) return { error: 'Load a video first.' };
    const t = Math.max(0, Math.min(+b.t || 0, 60 * 60 * 12));
    db.watch = { url: base, t, playing: !!b.playing, at: Date.now(), by: nm(b) };
    save(); all('watch', db.watch);
    return { ok: true, watch: db.watch };
  },
  'POST /api/watch/chat': b => {
    const t = clean(b.text, 200);
    if (!t) return { error: 'Say something first.' };
    const m = { id: crypto.randomBytes(4).toString('hex'), n: nm(b), t, at: Date.now() };
    db.watchchat.push(m); db.watchchat = db.watchchat.slice(-60);
    save(); all('watchchat', m);
    return { ok: true, m };
  },
  // Screen share: only the announcement passes through the server, the video is peer to peer.
  'GET /api/screen': () => ({ screen: db.screen }),
  'POST /api/screen': b => {
    const room = clean(b.room, 40), who = nm(b);
    if (!room) return { error: 'No room.' };
    if (b.on) db.screen[room] = { by: who, at: Date.now() };
    else if (db.screen[room] && db.screen[room].by === who) delete db.screen[room];
    all('screen', db.screen);
    return { ok: true, screen: db.screen };
  },
  // The server keeps the clock, so study time can't be faked from the browser.
  'POST /api/study/start': b => {
    const n = nm(b), cur = db.live[n];
    /* A second tab, a refresh or a phone picking up the same account used to restart the clock
       and silently throw the running session away. Keep the session that is already going. */
    if (cur && !b.restart) return { t: cur.t, acc: cur.acc || 0, hold: cur.hold || 0, s: cur.s, now: Date.now(), resumed: 1 };
    db.live[n] = { s: clean(b.subject, 30) || 'General', t: Date.now(), acc: 0, hold: 0 };
    liveCast();
    const l = db.live[n];
    return { t: l.t, acc: 0, hold: 0, s: l.s, now: Date.now(), resumed: 0 };
  },
  // Pause / resume: the clock stops where it is, and resumes from that same second.
  'POST /api/study/pause': b => {
    const l = db.live[nm(b)];
    if (!l) return {};
    if (!l.hold) { l.hold = Date.now(); save(); liveCast(); }
    return { t: l.t, acc: l.acc || 0, hold: l.hold || 0, now: Date.now() };
  },
  'POST /api/study/resume': b => {
    const l = db.live[nm(b)];
    if (!l) return {};
    if (l.hold) { l.acc = Math.round((l.acc || 0) + (l.hold - l.t) / 1e3); l.t = Date.now(); l.hold = 0; save(); liveCast(); }
    return { t: l.t, acc: l.acc || 0, hold: 0, now: Date.now() };
  },
  'POST /api/study/stop': b => {
    const n = nm(b), l = db.live[n];
    if (!l) return {};
    const secs = Math.min(Math.floor(liveSecs(l)), 6 * 3600);
    const x = { n, s: l.s, t: Date.now(), secs, xp: Math.floor(secs / 60) + 10 * Math.floor(secs / 1500) };
    delete db.live[n];
    if (secs >= 30) db.sessions.push(x);
    save(); liveCast();
    return x;
  },
  // Throw the running timer away: no session, no XP, nothing on the clock.
  'POST /api/study/discard': b => {
    const n = nm(b), was = liveSecs(db.live[n] || { t: Date.now() });
    delete db.live[n];
    save(); liveCast();
    return { ok: true, secs: Math.round(was) };
  },
  // Lock in: shut the app for this account (or for anyone, if the server owner asks) until the
  // hours are really studied. Only the timer keeps working, and chatting is refused server-side.
  'POST /api/lockin': b => {
    const n = nm(b), target = clean(b.user, 24) || n;
    if (target !== n && !runsServer(n)) return { error: 'Only a server owner can lock in someone else.' };
    if (!acctOf(target)) return { error: 'No account for that name.' };
    const hours = Math.min(12, Math.max(1, Math.round((+b.hours || 2) * 2) / 2));
    db.lockin[target] = { h: Math.round(hours * 3600), at: Date.now(), by: n };
    save(); all('lockin', db.lockin);
    return { ok: true, hours, lock: lockInfo(target) || null };
  },
  'POST /api/lockin/clear': b => {
    const n = nm(b), target = clean(b.user, 24) || n;
    if (target !== n && !runsServer(n)) return { error: 'Only a server owner can unlock someone else.' };
    delete db.lockin[target];
    save(); all('lockin', db.lockin);
    return { ok: true };
  },
  // Studied away from the timer? Log it: the same 1 XP per minute the timer gives, minus the 25-minute bonus.
  'POST /api/study/offline': b => {
    const n = nm(b), mins = Math.round(+b.mins || 0);
    if (!(mins >= 1 && mins <= 720)) return { error: 'Log between 1 and 720 minutes.' };
    let t = Date.now();
    if (b.date) {
      const d = new Date(String(b.date) + 'T12:00:00');
      if (Number.isNaN(+d)) return { error: 'That date does not look right.' };
      if (+d > Date.now() + 864e5) return { error: 'You cannot log a session in the future.' };
      t = +d;
    }
    const secs = mins * 60, x = { n, s: clean(b.subject, 30) || 'Offline', t, secs, xp: Math.floor(secs / 60), off: 1 };
    db.sessions.push(x); save(); liveCast();
    return { ok: true, ...x };
  },
  'GET /api/me': b => ({ ...stats(nm(b)), live: db.live[nm(b)] || null, lock: lockInfo(nm(b)), now: Date.now(), need: NEED }),
  'GET /api/profile': b => prof(clean(b.user, 24) || nm(b), nm(b)),
  // The lobby: every server on this site (not only the ones you joined) and the full member
  // list, so a new server and a new account are both visible to everyone.
  'GET /api/lobby': b => {
    const n = nm(b), P = people(), on = new Set(online());
    const members = Object.entries(P).map(([name, p]) => ({
      name, dn: p.dn || '', av: p.av || '', deco: p.deco || '', nfx: p.nfx || '',
      acc: p.acc || '', acc2: p.acc2 || '', pack: p.pack || '', art: p.art || '', bot: p.bot ? 1 : 0,
      on: on.has(name), last: (db.users[name] || {}).last || 0
    }));
    const servers = Object.keys(db.layout).map(k => ({
      key: k, name: db.layout[k].name, icon: db.layout[k].icon || '',
      owner: db.srvown[k] || '', members: (db.srvjoin[k] || []).length,
      joined: inSrv(k, n), mine: db.srvown[k] === n
    })).sort((a, c) => c.members - a.members || a.name.localeCompare(c.name));
    return { ok: true, you: prof(n, n), servers, members, online: [...on] };
  },
  'POST /api/profile': b => {
    const n = nm(b), a = acctOf(n);
    if (!a) return { error: 'No account for that name.' };
    const p = a.p = a.p || {};
    const text = (k, v, len) => { if (v === undefined) return; const s = clean(v, len); if (s) p[k] = s; else delete p[k]; };
    text('dn', b.dn, 24); text('pron', b.pron, 16); text('status', b.status, 60); text('bio', b.bio, 300); text('emoji', b.emoji, 8);
    if (b.accent !== undefined) { const c = String(b.accent || ''); if (/^#[0-9a-f]{6}$/i.test(c)) p.accent = c; else delete p.accent; }
    const oldAv = p.av, oldBan = p.banner, oldArt = p.art;
    if (b.banner !== undefined) { const v = storePic(a, b.banner, 300000), raw = String(b.banner || ''); if (BANNERS.includes(raw)) p.banner = raw; else if (v) p.banner = v; else delete p.banner; }
    if (b.av !== undefined) { const v = storePic(a, b.av, 200000); if (v) p.av = v; else delete p.av; }
    if (b.art !== undefined) { const v = storePic(a, b.art, 400000); if (v) p.art = v; else delete p.art; }
    // Backdrop framing: fit mode, zoom percentage and the optional 16:9 band.
    if (b.artfit !== undefined) { const v = String(b.artfit || ''); if (['cover', 'contain', 'fill'].includes(v)) p.artfit = v; else delete p.artfit; }
    if (b.artz !== undefined) { const v = Math.round(+b.artz || 0); if (v >= 100 && v <= 300) p.artz = v; else delete p.artz; }
    // Where the backdrop sits inside the card (0-100% on each axis), so a picture can be
    // dragged until it frames the way the owner wants.
    for (const k of ['artx', 'arty']) {
      if (b[k] === undefined) continue;
      const v = Math.round(+b[k]);
      if (v >= 1 && v <= 99) p[k] = v; else delete p[k];
    }
    if (b.artr !== undefined) { if (String(b.artr || '') === '169') p.artr = '169'; else delete p.artr; }
    // Banner shape: the default wide strip, or a real 16:9 picture.
    if (b.banr !== undefined) { if (String(b.banr || '') === '169') p.banr = '169'; else delete p.banr; }
    // AMV edit backdrop: a plain http(s) link (YouTube, or an .mp4/.webm file), nothing else.
    if (b.amv !== undefined) { const v = String(b.amv || '').trim(); if (!v) delete p.amv; else if ((a.pm || []).includes(v) || /^https?:\/\/[^\s"'<>]{4,300}$/i.test(v)) p.amv = v; else return { error: 'That video link does not look like an http(s) URL.' }; }
    if (b.amvo !== undefined) { const v = Math.round(+b.amvo || 0); if (v >= 10 && v <= 70) p.amvo = v; else delete p.amvo; }
    const pick = (k, list) => { if (b[k] === undefined) return; const v = String(b[k] || ''); if (list.includes(v)) p[k] = v; else delete p[k]; };
    pick('deco', DECOS); pick('nfx', NFX); pick('bfx', BFX); pick('pfx', PFX); pick('pack', PACKS); pick('pch', BADGES);
    // A badge can also be the person's own PNG (a little accessory next to the avatar).
    if (b.pchv !== undefined) { const v = storePic(a, b.pchv, 150000); if (v) p.pchv = v; else delete p.pchv; }
    // Badge size in pixels, so people can make the chibi as big or small as they like.
    if (b.pchs !== undefined) { const v = Math.round(+b.pchs || 0); if (v >= 60 && v <= 260) p.pchs = v; else delete p.pchs; }
    // A whole set of badges: the built-in chibis and/or the person's own PNGs. The card shows
    // one at a time, so a set never fills the profile.
    if (b.pchl !== undefined) {
      const out = [];
      for (const it of (Array.isArray(b.pchl) ? b.pchl : []).slice(0, 8)) {
        const s = String(it || '');
        if (!s) continue;
        if (BADGES.includes(s) && s !== 'png') { if (!out.includes(s)) out.push(s); continue; }
        const v = storePic(a, s, 150000);
        if (v && !out.includes(v)) out.push(v);
      }
      if (out.length) p.pchl = out; else delete p.pchl;
    } else if (b.pch !== undefined) {
      // Older clients send a single badge: keep it as the whole set.
      const s = String(b.pch || '');
      if (BADGES.includes(s) && s !== 'png') p.pchl = [s];
      else if (s === 'png' && p.pchv) p.pchl = [p.pchv];
      else delete p.pchl;
    }
    if (b.acc2 !== undefined) { const c = String(b.acc2 || ''); if (/^#[0-9a-f]{6}$/i.test(c)) p.acc2 = c; else delete p.acc2; }
    if (b.ctheme !== undefined) { if (+b.ctheme === 1) p.ctheme = 1; else delete p.ctheme; }
    dropOldMedia(a, oldAv); dropOldMedia(a, oldBan); dropOldMedia(a, oldArt);
    save(); all('people', people());
    return { ok: true, profile: prof(n, n) };
  },
  'GET /api/board': b => {
    const week = sum(nm(b), weekStart());
    if (week < NEED) return { locked: true, week, need: NEED };
    settle();
    const names = [...new Set([...db.sessions.map(x => x.n), ...Object.keys(db.live)])];
    return { week, need: NEED, rows: names.map(p => ({ n: p, week: sum(p, weekStart()), total: sum(p), xp: xp(p), live: db.live[p] ? db.live[p].s : null })), duels: db.duels.slice(-20) };
  },
  /* Search the channels this account can actually see. Newest first and capped, so a common
     word cannot turn into a megabyte of JSON on a phone. */
  'GET /api/search': b => {
    const n = nm(b), q = clean(b.q, 80).toLowerCase();
    if (q.length < 2) return { ok: true, q, hits: [] };
    const mine = new Set(mySrvs(n).flatMap(k => [...(db.layout[k].text || [])]));
    const hits = [], low = n.toLowerCase();
    for (const ch of Object.keys(db.channels)) {
      const dm = ch.startsWith('dm:');
      if (dm ? !ch.slice(3).split('|').includes(low) : !mine.has(ch)) continue;
      const list = db.channels[ch] || [];
      for (let i = list.length - 1; i >= 0 && hits.length < 120; i--) {
        const m = list[i];
        if (m && typeof m.text === 'string' && m.text.toLowerCase().includes(q)) hits.push({ ch, id: m.id, name: m.name, text: m.text.slice(0, 240), ts: m.ts });
      }
    }
    hits.sort((a, c) => c.ts - a.ts);
    return { ok: true, q, hits: hits.slice(0, 40) };
  },
  'POST /api/ma/toggle': () => maToggle(),
  'POST /api/duel': b => {
    const a = nm(b), acct = acctOf(clean(b.to, 24)), c = acct ? acct.name : '';
    if (!c || c === a) return { error: 'Pick someone with an account to duel.' };
    if (sum(a, weekStart()) < NEED) return { error: 'You need the weekly study hours to start a duel.' };
    if (db.duels.some(d => d.st !== 'done' && [d.a, d.b].includes(a) && [d.a, d.b].includes(c))) return { error: 'You already have a duel with them.' };
    db.duels.push({ id: crypto.randomUUID().slice(0, 8), a, b: c, st: 'pending' });
    save();
    return { ok: true };
  },
  'POST /api/edit': b => {
    const ch = clean(b.channel, 80), n = nm(b), m = inCh(ch, n) ? (db.channels[ch] || []).find(x => x.id === b.id) : null;
    if (!m || m.name !== n) return {};
    if (b.del) { db.channels[ch] = db.channels[ch].filter(x => x !== m); save(); allTo('del', { channel: ch, id: m.id }, ch); return {}; }
    const t = clean(b.text, 2000);
    if (!t) return {};
    m.text = t; m.edited = true; save(); allTo('edit', { channel: ch, id: m.id, text: t }, ch);
    return {};
  },
  'POST /api/typing': b => { const ch = clean(b.channel, 80), n = nm(b); if (inCh(ch, n) && allow(n, 'typing', 40, 10000)) allTo('typing', { channel: ch, name: n }, ch); return {}; },
  // "Seen by …": a person marks how far they have read in a channel, and everyone in that
  // channel gets the receipt, so the sender can see exactly who has read their message.
  'POST /api/read': b => {
    const ch = clean(b.channel, 80), n = nm(b);
    if (!inCh(ch, n)) return {};
    const ts = Math.min(Date.now() + 5000, Math.max(1, Math.round(+b.ts || 0) || Date.now()));
    const map = (db.read[ch] = db.read[ch] || {});
    if (ts - (map[n] || 0) > 2500) { map[n] = ts; save(); allTo('read', { channel: ch, name: n, ts }, ch); }
    return { ok: true };
  },
  'POST /api/notes/read': b => { db.seen[nm(b)] = Date.now(); save(); return {}; },
  'POST /api/react': b => {
    const ch = clean(b.channel, 80), n = nm(b);
    const m = inCh(ch, n) ? (db.channels[ch] || []).find(x => x.id === b.id) : null, e = clean(b.emoji, 8);
    if (!m || !e) return {};
    m.re = m.re || {};
    const l = m.re[e] = m.re[e] || [], i = l.indexOf(n);
    if (i < 0) l.push(n); else l.splice(i, 1);
    if (!l.length) delete m.re[e];
    save(); allTo('react', { channel: ch, id: m.id, re: m.re }, ch);
    return {};
  },
  'POST /api/sticker': b => {
    const n = clean(b.label, 16).toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!n || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(b.data || '') || b.data.length > 90000) return { error: 'Need a name and a small image.' };
    db.stickers[n] = b.data; save(); all('stickers', db.stickers);
    return { ok: true };
  },
  'POST /api/sticker/del': b => {
    const n = clean(b.label, 16).toLowerCase();
    if (!n) return { error: 'No sticker name.' };
    if (!Object.hasOwn(db.stickers, n)) return { error: 'That sticker is already gone.' };
    const v = db.stickers[n];
    delete db.stickers[n]; save(); all('stickers', db.stickers);
    if (typeof v === 'string' && v.startsWith('/huzz-hunter/uploads/')) fs.unlink(path.join(UP, path.basename(v)), () => {});
    return { ok: true, stickers: db.stickers };
  },
  'GET /api/vchat': b => { const ch = clean(b.ch, 32); return { ch, msgs: db.vtext[ch] || [], tts: !!db.vtts[ch] }; },
  'POST /api/vchat': b => {
    const ch = clean(b.ch, 32), t = clean(b.text, 500), n = nm(b);
    if (!ch || !t || !inCh(ch, n)) return {};
    if (!allow(n, 'vchat', 20, 10000)) return { error: 'Slow down a little — that is a lot of messages.' };
    const m = { id: crypto.randomUUID().slice(0, 8), name: n, text: t, ts: Date.now() };
    db.vtext[ch] = (db.vtext[ch] || []).concat(m).slice(-80);
    save(); all('vchat', { ch, m });
    return { ok: true, m };
  },
  'POST /api/vchat/tts': b => {
    const ch = clean(b.ch, 32);
    if (!ch) return {};
    const on = !!b.on;
    if (on) db.vtts[ch] = true; else delete db.vtts[ch];
    save(); all('vtts', { ch, on });
    return { ok: true, on };
  },
  'POST /api/voice': b => {
    const n = nm(b), ch = clean(b.channel, 32);
    const to = timeoutFor(ch, n);
    if (to) return { error: 'You are timed out here for ' + Math.max(1, Math.round((to.until - Date.now()) / 60000)) + ' more minutes.' };
    if (ch && !mySrvs(n).some(k => (db.layout[k].voice || []).includes(ch))) return { error: 'That voice channel is not available to your account.' };
    leaveVoice(n);
    const peers = ch ? [...(db.voice[ch] || [])] : [];
    if (ch) { db.voice[ch] = db.voice[ch] || []; db.voice[ch].push(n); }
    all('voice', db.voice);
    return { peers };
  },
  'POST /api/bot/vc': b => {
    const ch = clean(b.channel, 32), by = nm(b);
    Object.values(db.voice).forEach(l => { const i = l.indexOf(BOT); if (i >= 0) l.splice(i, 1); });
    if (ch) {
      const known = Object.values(db.layout).some(s => (s.voice || []).includes(ch));
      if (!known) return { error: 'That voice channel is gone.' };
      db.voice[ch] = db.voice[ch] || [];
      db.voice[ch].push(BOT);
      const m = { id: crypto.randomUUID().slice(0, 8), name: BOT, text: 'Music Assistant is in the room. Type /help right here to see what I can do.', ts: Date.now(), bot: 1 };
      db.vtext[ch] = (db.vtext[ch] || []).concat(m).slice(-80);
      all('vchat', { ch, m });
      save();
    }
    all('voice', db.voice);
    return { ok: true, channel: ch || null, by };
  },
  // ---- diary: one private page per day, per account ----
  'GET /api/diary': b => {
    const n = nm(b), all = db.diary[n] || {}, date = dayKey(b.date) || todayKey();
    return { ok: true, date, day: all[date] || null, dates: Object.keys(all).sort().reverse(), index: diaryIndex(all), streak: diaryStreak(all) };
  },
  'POST /api/diary': b => {
    const n = nm(b), date = dayKey(b.date);
    if (!date) return { error: 'Pick a real date.' };
    const all = (db.diary[n] = db.diary[n] || {}), cur = all[date] || {}, fresh = !all[date];
    const d = dayClean({ ...cur, ...(b.patch && typeof b.patch === 'object' ? b.patch : {}) });
    // A brand new page names itself "Day N" (N = how many pages exist up to that date);
    // the person can rename it any time, and clearing the title keeps it cleared.
    if (fresh && !d.title) d.title = 'Day ' + Math.max(1, Object.keys(all).filter(k => k <= date).length + 1);
    const empty = !d.title && !d.text && !d.cleared && !d.stuck && !d.why && !d.mood && !d.todos.length && !d.goals.length;
    if (empty) delete all[date]; else all[date] = { ...d, at: Date.now() };
    save();
    return { ok: true, date, day: all[date] || null, dates: Object.keys(all).sort().reverse(), index: diaryIndex(all), streak: diaryStreak(all) };
  },
  // ---- plans: steps you tick off, plus what cleared and what blocked ----
  'GET /api/plans': b => ({ ok: true, plans: db.plans[nm(b)] || { items: [], notes: '' } }),
  'POST /api/plans': b => {
    const n = nm(b), p = planClean(b.plans || b);
    db.plans[n] = { ...p, at: Date.now() };
    save();
    return { ok: true, plans: db.plans[n] };
  },
  'POST /api/signal': b => {
    const to = clean(b.to, 24), from = nm(b);
    clients.forEach((n, res) => { if (n === to) send(res, 'signal', { from, data: b.data }); });
    return {};
  },
  'POST /api/duel/accept': b => {
    const d = db.duels.find(x => x.id === b.id && x.st === 'pending' && x.b === nm(b));
    if (!d || sum(d.b, weekStart()) < NEED) return { error: 'Not allowed.' };
    d.st = 'live'; d.start = Date.now(); d.end = d.start + 864e5;
    save();
    return { ok: true };
  }
};

/* ---- diary + plans: small, strict shapes so a bad client cannot bloat the data file ---- */
const todayKey = () => new Date().toLocaleDateString('en-CA');
const dayKey = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
const itemList = (arr, max, len) => (Array.isArray(arr) ? arr.slice(0, max) : []).map(x => ({
  id: clip(x && x.id, 24) || crypto.randomBytes(5).toString('hex'),
  t: clip(x && x.t, len).trim(), d: x && x.d ? 1 : 0
})).filter(x => x.t);
const dayClean = d => ({
  title: clip(d && d.title, 80), mood: clip(d && d.mood, 8), text: clip(d && d.text, 6000),
  todos: itemList(d && d.todos, 60, 200), goals: itemList(d && d.goals, 40, 200),
  cleared: clip(d && d.cleared, 3000), stuck: clip(d && d.stuck, 3000), why: clip(d && d.why, 3000)
});
// How many days in a row someone wrote a page (today or yesterday ends the run).
// Light index for the "past pages" list: the person's own title plus the date.
const diaryIndex = all => Object.keys(all).sort().reverse().map(k => ({ d: k, t: (all[k] && all[k].title) || '' }));
const diaryStreak = all => {
  let n = 0, t = Date.now();
  for (let i = 0; i < 400; i++) {
    const k = new Date(t).toLocaleDateString('en-CA');
    if (!all[k]) { if (i === 0) { t -= 864e5; continue; } break; }
    n++; t -= 864e5;
  }
  return n;
};
const planClean = p => ({
  notes: clip(p && p.notes, 8000),
  items: (Array.isArray(p && p.items) ? p.items.slice(0, 40) : []).map(x => ({
    id: clip(x && x.id, 24) || crypto.randomBytes(5).toString('hex'),
    title: clip(x && x.title, 200), why: clip(x && x.why, 1000),
    status: ['todo', 'doing', 'done', 'blocked'].includes(x && x.status) ? x.status : 'todo',
    due: dayKey(x && x.due),
    steps: itemList(x && x.steps, 25, 200),
    cleared: clip(x && x.cleared, 2000), stuck: clip(x && x.stuck, 2000), whyNot: clip(x && x.whyNot, 2000),
    created: +(x && x.created) || Date.now()
  }))
});

/* Bodies are collected as bytes and decoded once. Concatenating chunks as strings split every
   multi-byte character that landed on a chunk boundary, so Hindi/Japanese/emoji text arrived
   corrupted. Oversized bodies are drained and flagged instead of destroying the socket, which
   used to leave the route hanging with no response at all. */
const BODY_LIMIT = 9e5;
const readBody = req => new Promise(resolve => {
  const chunks = [];
  let size = 0;
  req.on('data', c => {
    size += c.length;
    if (size <= BODY_LIMIT) chunks.push(c);
    else req.tooBig = true;
  });
  req.on('end', () => {
    if (req.tooBig) return resolve({});
    try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { resolve({}); }
  });
  req.on('error', () => resolve({}));
});

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const BASE_PATH = '/huzz-hunter';
  /* A page opened at /huzz-hunter (no trailing slash) resolves every relative picture path
     against the site root, so old "uploads/…" avatars and banners 404ed on the phone while the
     desktop URL with the slash worked. Bounce the bare path to the slash form first. */
  if (u.pathname === BASE_PATH && req.method === 'GET') {
    res.writeHead(301, { Location: BASE_PATH + '/' + (u.search || '') });
    return res.end();
  }
  if (u.pathname === BASE_PATH || u.pathname === BASE_PATH + '/') {
    u.pathname = '/';
  } else if (u.pathname.startsWith(BASE_PATH + '/')) {
    u.pathname = u.pathname.slice(BASE_PATH.length);
  }

  /* Constant-time compare, so a shared password cannot be guessed by timing the response. */
  const safeEq = (a, b) => {
    const A = Buffer.from(String(a == null ? '' : a)), B = Buffer.from(String(b == null ? '' : b));
    if (A.length !== B.length) { crypto.timingSafeEqual(A, A); return false; }
    return crypto.timingSafeEqual(A, B);
  };
  const scrypt = (pin, salt) => new Promise((res, rej) => crypto.scrypt(String(pin), salt, 32, (e, k) => e ? rej(e) : res(k)));
  const passOk = !PASS || safeEq(req.headers['x-pass'], PASS) || safeEq(u.searchParams.get('p'), PASS);
  const tok = req.headers['x-token'] || u.searchParams.get('t') || '';
  const tokLive = !!tok && Object.hasOwn(db.tokens, tok) && (db.tokexp[tok] || 0) > Date.now();
  const who = tokLive ? db.tokens[tok] : null;
  const authed = passOk && !!who;
  /* JSON above ~2 KB is gzipped: the lobby, the member list and the channel backlog are big
     documents, and phones on mobile data feel every uncompressed kilobyte. */
  const json = (code, d) => {
    let body = Buffer.from(JSON.stringify(d === undefined ? {} : d));
    const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Accept-Encoding' };
    if (body.length > 2048 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      body = zlib.gzipSync(body, { level: 5 });
      h['Content-Encoding'] = 'gzip';
    }
    h['Content-Length'] = body.length;
    res.writeHead(code, h);
    res.end(body);
  };

  if (u.pathname === '/healthz') {
    let kb = 0; try { kb = Math.round(fs.statSync(FILE).size / 1024); } catch (e) {}
    return json(200, { ok: true, up: Math.round(process.uptime()), rssMB: Math.round(process.memoryUsage().rss / 1048576), dbKB: kb, savedAgo: Math.round((Date.now() - lastSaveAt) / 1000) });
  }

  /* Baseline security headers for every response (the CSP only pins framing, so nothing breaks). */
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');

  if (u.pathname === '/') return sendText(req, res, path.join(__dirname, 'index.html'), 'text/html; charset=utf-8', true);

  if (req.method === 'POST' && u.pathname === '/api/auth') {
    /* Throttle by address too: the per-name counter alone lets one IP spray every account. */
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'local';
    const ipk = 'ip:' + ip, ipf = fails[ipk] || { n: 0, until: 0 };
    if (ipf.until > Date.now()) return json(429, { error: 'Too many attempts from this address. Wait a minute.' });
    const bumpIp = () => { ipf.n++; if (ipf.n >= 20) { ipf.n = 0; ipf.until = Date.now() + 60000; } fails[ipk] = ipf; };
    if (!passOk) { bumpIp(); return json(401, { error: 'Wrong server password.' }); }
    const b = await readBody(req), name = clean(b.name, 24), pin = String(b.pin || ''), k = name.toLowerCase(), now = Date.now();
    if (req.tooBig) return json(413, { error: 'That request was too big.' });
    if (banOf(name)) return json(403, { error: 'That account is banned from this site.' });
    if (!name || name.includes('|') || /[\u0000-\u001f\u007f]/.test(name) || /^(__proto__|constructor|prototype)$/i.test(name) || pin.length < 4) return json(400, { error: 'Pick a name (no | symbol, one line) and a PIN of at least 4 characters.' });
    const f = fails[k] || { n: 0, until: 0 }, a = Object.hasOwn(db.accts, k) ? db.accts[k] : null;
    if (a && a.bot) return json(403, { error: 'That name is a bot account. Pick another name.' });
    if (f.until > now) return json(429, { error: 'Too many wrong tries. Wait a minute.' });
    let acct = a;
    if (!a) {
      const salt = crypto.randomBytes(16).toString('hex');
      acct = db.accts[k] = { name, salt, hash: (await scrypt(pin, salt)).toString('hex'), created: now };
    } else {
      const got = await scrypt(pin, a.salt);
      const want = Buffer.from(String(a.hash || ''), 'hex');
      if (want.length !== got.length || !crypto.timingSafeEqual(got, want)) {
                f.n++; if (f.n >= 5) { f.n = 0; f.until = now + 60000; }
      fails[k] = f; bumpIp();
      return json(401, { error: 'Wrong PIN for that name.' });
      }
    }
    fails[k] = { n: 0, until: 0 };
    const mine = Object.keys(db.tokens).filter(t => db.tokens[t] === acct.name);
    mine.slice(0, Math.max(0, mine.length - 4)).forEach(t => { delete db.tokens[t]; delete db.tokexp[t]; });
    const token = crypto.randomBytes(24).toString('hex');
    db.tokens[token] = acct.name; db.tokexp[token] = Date.now() + TOKEN_MS; saveNow();
    return json(200, { token, name: acct.name, created: !a });
  }
  if (req.method === 'POST' && u.pathname === '/api/upload') {
    if (!authed) return json(401, {});
    const name = clean(u.searchParams.get('name'), 80) || 'file', ext = (name.match(/\.[a-z0-9]{1,5}$/i) || [''])[0].toLowerCase();
    const f = crypto.randomBytes(12).toString('hex') + ext, fp = path.join(UP, f), out = fs.createWriteStream(fp);
    let size = 0, dead = false;
    out.on('error', () => {});
    const kill = () => { if (dead) return; dead = true; req.unpipe(out); out.destroy(); req.resume(); fs.unlink(fp, () => {}); };
    req.on('data', c => { size += c.length; if (size > MAX && !dead) { kill(); json(413, { error: 'too big' }); } });
    req.on('aborted', kill);
    out.on('finish', () => {
      if (dead) return;
      const ok = post(clean(u.searchParams.get('channel'), 80), who, clean(u.searchParams.get('text'), 500), false, { att: { f, n: name, s: size } });
      if (!ok) fs.unlink(fp, () => {});
      json(ok ? 200 : 400, { ok });
    });
    req.pipe(out);
    return;
  }
  /* Chat background files: a GIF or a short mp4/webm clip lives in /uploads, the page keeps the link. */
  if (req.method === 'POST' && u.pathname === '/api/chatbg') {
    if (!authed) return json(401, {});
    const LIM = 24 * 1048576, chunks = [];
    let size = 0;
    req.on('data', c => { size += c.length; if (size <= LIM) chunks.push(c); if (size > LIM + 1048576) req.destroy(); });
    req.on('end', () => {
      if (size > LIM) return json(413, { error: 'That file is too big (24 MB max).' });
      const buf = Buffer.concat(chunks), img = sniffImg(buf), ext = img || sniffVid(buf);
      if (!ext) return json(400, { error: 'That is not a picture, GIF or mp4/webm clip.' });
      const f = crypto.randomBytes(12).toString('hex') + '.' + ext;
      fs.writeFile(path.join(UP, f), buf, err => err
        ? json(500, { error: 'Could not save that file.' })
        : json(200, { ok: true, url: '/huzz-hunter/uploads/' + f, vid: !img }));
    });
    return;
  }
  if (req.method === 'POST' && u.pathname === '/api/pmedia') {
    if (!authed) return json(401, {});
    const acct = acctOf(who);
    if (!acct) return json(400, { error: 'No account for that name.' });
    const kind = u.searchParams.get('kind');
    const LIM = kind === 'ban' ? 6 * 1048576 : kind === 'amv' ? 26 * 1048576 : 2 * 1048576, chunks = [];
    let size = 0;
    req.on('data', c => { size += c.length; if (size <= LIM) chunks.push(c); if (size > LIM + 4 * 1048576) req.destroy(); });
    req.on('end', () => {
      if (size > LIM) return json(413, { error: `That file is too big (the limit is ${LIM / 1048576} MB).` });
      const buf = Buffer.concat(chunks), ext = kind === 'amv' ? sniffVid(buf) : sniffImg(buf);
      if (!ext) return json(400, { error: kind === 'amv' ? 'That is not an mp4 or webm video.' : 'That is not a png, jpg, gif or webp picture.' });
      const f = crypto.randomBytes(12).toString('hex') + '.' + ext, url = '/huzz-hunter/uploads/' + f;
      fs.writeFile(path.join(UP, f), buf, err => {
        if (err) return json(500, { error: 'Could not save that file.' });
        const p = acct.p || {}, keep = keptMedia(p); keep.add(url);
        acct.pm = [...(acct.pm || []), url];
        for (const x of [...acct.pm]) {
          // room for a whole badge set (up to 8) plus avatar, banner, backdrop and edit
          if (acct.pm.length <= 16) break;
          if (!keep.has(x)) { acct.pm = acct.pm.filter(y => y !== x); fs.unlink(path.join(UP, path.basename(x)), () => {}); }
        }
        save();
        json(200, { url });
      });
    });
    return;
  }
  // Animated stickers (gifs, animated webp/png) are far too big for a data URI, so the browser
  // posts the raw file here and the sticker list keeps its short /uploads URL.
  if (req.method === 'POST' && u.pathname === '/api/sticker/file') {
    if (!authed) return json(401, {});
    const n = clean(u.searchParams.get('label'), 16).toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!n) return json(400, { error: 'Give that sticker a name (letters and numbers).' });
    const LIM = 4 * 1048576, chunks = [];
    let size = 0;
    req.on('data', c => { size += c.length; if (size <= LIM) chunks.push(c); if (size > 12 * 1048576) req.destroy(); });
    req.on('end', () => {
      if (size > LIM) return json(413, { error: 'That GIF is too big (the limit is 4 MB).' });
      const buf = Buffer.concat(chunks), ext = sniffImg(buf);
      if (!ext) return json(400, { error: 'That is not a png, jpg, gif or webp picture.' });
      const old = db.stickers[n], f = crypto.randomBytes(12).toString('hex') + '.' + ext;
      fs.writeFile(path.join(UP, f), buf, err => {
        if (err) return json(500, { error: 'Could not save that file.' });
        db.stickers[n] = '/huzz-hunter/uploads/' + f;
        if (typeof old === 'string' && old.startsWith('/huzz-hunter/uploads/')) fs.unlink(path.join(UP, path.basename(old)), () => {});
        save(); all('stickers', db.stickers);
        json(200, { ok: true, url: db.stickers[n] });
      });
    });
    return;
  }
  const um = u.pathname.match(/^\/uploads\/([a-f0-9]{24}(?:\.[a-z0-9]{1,5})?)$/);
  if (um) {
    const fp = path.join(UP, um[1]); let st;
    try { st = fs.statSync(fp); } catch { return json(404, {}); }
    const type = MIME[path.extname(um[1]).slice(1)];
    const h = { 'Content-Type': type || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable' };
    if (!type) h['Content-Disposition'] = 'attachment';
    const r = (req.headers.range || '').match(/bytes=(\d*)-(\d*)/);
    if (r && (r[1] || r[2])) {
      const a = r[1] ? +r[1] : st.size - +r[2], b = r[1] && r[2] ? Math.min(+r[2], st.size - 1) : st.size - 1;
      if (a > b || a >= st.size) { res.writeHead(416); return res.end(); }
      res.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 });
      return fs.createReadStream(fp, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { ...h, 'Content-Length': st.size });
    return fs.createReadStream(fp).pipe(res);
  }
  // Shipped artwork (the chibi avatar accessories): plain files from ./assets, nothing else.
  if (u.pathname.startsWith('/assets/')) {
    const f = path.join(__dirname, 'assets', path.basename(u.pathname)), ext = path.extname(f).slice(1).toLowerCase();
    if (!['png', 'webp', 'gif', 'jpg'].includes(ext) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=604800' });
    return fs.createReadStream(f).pipe(res);
  }
  if (u.pathname === '/extras.js' || u.pathname === '/extras.css') {
    return sendText(req, res, path.join(__dirname, u.pathname.slice(1)), u.pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8', false);
  }
  if (u.pathname === '/events') {
    if (!authed) return json(401, { error: 'wrong password' });
    if (banOf(who)) return json(403, { error: 'banned' });
    const name = who;
    /* A reload loop or a flaky phone can stack streams for one account; keep the newest few and
       drop the oldest, so memory cannot grow without bound. */
    let same = 0, oldest = null;
    clients.forEach((cn, r) => { if (cn === name) { same++; if (!oldest) oldest = r; } });
    if (same >= 6 && oldest) { try { oldest.end(); } catch (e) {} clients.delete(oldest); }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    clients.set(res, name);
    if (!db.users[name]) { db.users[name] = { last: 0 }; save(); all('users', Object.keys(db.users)); }
    db.users[name].last = Date.now();
    const mine = mySrvs(name), mineCh = new Set(mine.flatMap(k => [...(db.layout[k].text || []), ...(db.layout[k].voice || [])]));
    const recent = Object.fromEntries(Object.entries(db.channels).filter(([k]) => k.startsWith('dm:') ? k.slice(3).split('|').includes(name.toLowerCase()) : mineCh.has(k)).map(([k, v]) => [k, v.slice(-200)]));
    // Every account belongs in the member list, not only the ones that happened to connect
    // since the last restart, so nobody disappears from the server's member list.
    const seenNames = new Set();
    const memberNames = [...Object.values(db.accts).map(a => a.name), ...Object.keys(db.users)]
      .filter(n => { const k = String(n).toLowerCase(); if (seenNames.has(k)) return false; seenNames.add(k); return true; });
    const visRead = Object.fromEntries(Object.keys(recent).map(k => [k, db.read[k] || {}]));
    send(res, 'init', { channels: recent, online: online(), live: isOpen(name) ? liveMap() : {}, open: isOpen(name), layout: srvLayoutOf(name), lobby: !mine.length,    stickers: db.stickers, voice: db.voice, users: memberNames, people: people(), np: npAll(), read: visRead, notes: db.notes[name] || [], seen: db.seen[name] || 0, roles: db.srvroles, mem: db.srvmem, own: db.srvown, watch: db.watch, screen: db.screen });
    all('online', online());
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => {
      clearInterval(ping); clients.delete(res); all('online', online());
      let cleared = 0;
      Object.keys(db.screen).forEach(k => { if (db.screen[k].by === name) { delete db.screen[k]; cleared = 1; } });
      if (cleared) all('screen', db.screen);
      if (!online().includes(name)) { leaveVoice(name); all('voice', db.voice); db.users[name].last = Date.now(); save(); }
    });
    return;
  }

  // Incoming webhook: POST /hook/<channel>/<key> with {"text","username"}; Discord-style {"content","embeds"} works too.
  const hook = u.pathname.match(/^\/hook\/([^/]+)\/([^/]+)$/);
  if (req.method === 'POST' && hook) {
    if (hook[2] !== db.key) return json(403, { error: 'bad key' });
    if (!db.channels[hook[1]]) return json(404, { error: 'no such channel' });
    const b = await readBody(req);
    const embeds = (b.embeds || []).map(e => [e.title, e.description, e.url].filter(Boolean).join(' - '));
    post(hook[1], clean(b.username, 24) || 'webhook', clean([b.text || b.content, ...embeds].filter(Boolean).join('\n'), 2000), true);
    return json(200, { ok: true });
  }

  // Music Assistant bridge: player state for one or more accounts at once (x-np-key, no user token).
  if (req.method === 'POST' && u.pathname === '/api/np') {
    const key = String(req.headers['x-np-key'] || u.searchParams.get('k') || '');
    const good = key.length === db.npkey.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(db.npkey));
    if (!good) return json(403, { error: 'bad np key' });
    const b = await readBody(req), items = Array.isArray(b.players) ? b.players : [{ name: b.name, np: b.np }];
    let changed = 0;
    for (const it of items) {
      const a = it && acctOf(clean(it.name, 24));
      if (!a) continue;
      const v = it.np;
      if (!v || !clean(v.t, 120)) {
        const cur = db.np[a.name];
        if (!cur) continue;
        if (!cur.gone) { cur.gone = Date.now(); cur.p = 0; changed++; }
        continue;
      }
      const art = String(v.art || '').slice(0, 400), link = String(v.url || '').slice(0, 200);
      const tt = clean(v.t, 120), fx = db.npfix[npKey(tt)] || null;
      db.np[a.name] = {
        t: tt, a: (fx && fx.a) || clean(v.a, 120), al: (fx && fx.al) || clean(v.al, 120),
        art: /^https?:\/\//i.test(art) ? art : '', url: /^https?:\/\//i.test(link) ? link : '',
        dur: Math.max(0, Math.min(86400, Math.round(+v.dur || 0))), el: Math.max(0, Math.min(86400, Math.round(+v.el || 0))),
        at: Date.now(), p: v.p ? 1 : 0, src: clean(v.src, 40)
      };
      changed++;
    }
    if (changed) { save(); all('np', npAll()); }
    return json(200, { ok: true, changed });
  }

  // Look a track up online (LRCLIB first, iTunes as a fallback) for artist, album and lyrics.
  if (u.pathname === '/api/meta' && req.method === 'GET') {
    if (!authed) return json(401, {});
    return json(200, await metaLookup(clean(u.searchParams.get('t'), 120), clean(u.searchParams.get('a'), 120), Math.round(+u.searchParams.get('dur') || 0)));
  }
  if (u.pathname === '/api/lyrics' && req.method === 'GET') {
    if (!authed) return json(401, {});
    const t = clean(u.searchParams.get('t'), 120), fix = fixFor(t);
    if (fix && fix.lyrics) return json(200, { ok: true, lyrics: fix.lyrics, src: 'saved' });
    const m = await metaLookup(t, clean(u.searchParams.get('a'), 120), Math.round(+u.searchParams.get('dur') || 0));
    return json(200, m && m.lyrics ? { ok: true, lyrics: m.lyrics, src: m.src, artist: m.artist, album: m.album } : { ok: false, error: (m && m.error) || 'Lyrics nahi mile.' });
  }
  /* Romaji for a Japanese title, so the music bot can be asked in Latin letters. */
  if (u.pathname === '/api/romaji' && req.method === 'GET') {
    if (!authed) return json(401, {});
    const r = await romajiOf(clean(u.searchParams.get('t'), 160), clean(u.searchParams.get('a'), 120));
    return json(200, { ok: !!r, r: r || '' });
  }

  // Manual artist/album corrections for a track Music Assistant got wrong (or left Unknown).
  if (u.pathname === '/api/npfix') {
    if (!authed) return json(401, {});
    if (req.method === 'GET') return json(200, { ok: true, fixes: db.npfix });
    if (req.method === 'DELETE') {
      const k = npKey(clean((await readBody(req)).title, 120));
      delete db.npfix[k]; save();
      Object.values(db.np).forEach(v => { if (npKey(v.t) === k) { delete v.a; } });
      all('np', npAll());
      return json(200, { ok: true, fixes: db.npfix });
    }
    const b = await readBody(req), title = clean(b.title, 120);
    if (!title) return json(400, { error: 'No track title to fix.' });
    const k = npKey(title), a = clean(b.artist, 120), al = clean(b.album, 120);
    const live = Object.values(db.np).filter(v => npKey(v.t) === k);
    if (!a && !al) {
      const old = db.npfix[k];
      delete db.npfix[k];
      if (old && old.orig) live.forEach(v => { v.a = old.orig.a || ''; v.al = old.orig.al || ''; });
    } else {
      const prev = db.npfix[k];
      const orig = prev && prev.orig ? prev.orig : { a: (live[0] && live[0].a) || '', al: (live[0] && live[0].al) || '' };
      const ly = clean(b.lyrics, 8000) || (prev && prev.lyrics) || '';
      db.npfix[k] = { t: title, a, al, orig, lyrics: ly, by: who, at: Date.now() };
      live.forEach(v => { v.a = a || v.a; v.al = al || v.al; });
    }
    save();
    all('np', npAll());
    return json(200, { ok: true, fixes: db.npfix });
  }

  // Chat wallpaper: one image, animated GIF, clip or gradient for the whole site, like the theme.
  // Anyone signed in may change it and every open tab gets it live; hide/sound stay on the device.
  if (u.pathname === '/api/wall' && ['GET', 'POST', 'DELETE'].includes(req.method)) {
    if (!authed) return json(401, {});
    const setWallForAll = w => { db.wallg = w; save(); all('wall', db.wallg || null); };
    if (req.method === 'GET') return json(200, { ok: true, wall: db.wallg || null, shared: true });
    if (req.method === 'DELETE') {
      const w = db.wallg;
      setWallForAll(null);
      if (w && String(w.u).startsWith('/huzz-hunter/uploads/')) fs.unlink(path.join(UP, path.basename(w.u)), () => {});
      return json(200, { ok: true, wall: null });
    }
    // A gradient picked from the presets travels as its CSS text, so it needs no upload.
    if (/application\/json/i.test(req.headers['content-type'] || '')) {
      const b = await readBody(req), css = clean(b.css, 400);
      if (!/^(linear|radial)-gradient\([a-z0-9#%.,()+\s-]+\)$/i.test(css)) return json(400, { error: 'That is not a gradient background.' });
      const old = db.wallg;
      setWallForAll({ u: css, t: 'css', at: Date.now(), by: who });
      if (old && String(old.u).startsWith('/huzz-hunter/uploads/')) fs.unlink(path.join(UP, path.basename(old.u)), () => {});
      return json(200, { ok: true, wall: db.wallg });
    }
    const kind = u.searchParams.get('kind') === 'vid' ? 'vid' : 'img';
    const LIM = kind === 'vid' ? 26 * 1048576 : 8 * 1048576, chunks = [];
    let size = 0;
    req.on('data', c => { size += c.length; if (size <= LIM) chunks.push(c); if (size > LIM + 4 * 1048576) req.destroy(); });
    req.on('end', () => {
      if (size > LIM) return json(413, { error: `That file is too big (the limit is ${Math.round(LIM / 1048576)} MB).` });
      const buf = Buffer.concat(chunks), ext = kind === 'vid' ? sniffVid(buf) : sniffImg(buf);
      if (!ext) return json(400, { error: kind === 'vid' ? 'That is not an mp4 or webm video.' : 'That is not a png, jpg, gif or webp picture.' });
      const f = crypto.randomBytes(12).toString('hex') + '.' + ext, url = '/huzz-hunter/uploads/' + f;
      fs.writeFile(path.join(UP, f), buf, err => {
        if (err) return json(500, { error: 'Could not save that file.' });
        const old = db.wallg;
        if (old && String(old.u).startsWith('/huzz-hunter/uploads/')) fs.unlink(path.join(UP, path.basename(old.u)), () => {});
        setWallForAll({ u: url, t: kind, at: Date.now(), by: who });
        json(200, { ok: true, wall: db.wallg });
      });
    });
    return;
  }

  // /play from the bot: start a track on Music Assistant, its bridge then pushes the now playing.
  if (req.method === 'POST' && u.pathname === '/api/bot/play') {
    if (!authed) return json(401, {});
    const b = await readBody(req);
    return json(200, await maPlay(who, b.q || b.query));
  }

  const h = H[`${req.method} ${u.pathname}`];
  if (!h) return json(404, {});
  if (!authed) return json(401, {});
  // One bad request must not leave the caller hanging (a hung fetch is what looks like a crash).
  let out;
  /* Routes that talk to Music Assistant answer with a promise; without the await the client got
     an empty {} and never learned whether the track paused, so Space looked dead. */
  try {
    const body = req.method === 'POST' ? await readBody(req) : Object.fromEntries(u.searchParams);
    if (req.tooBig) return json(413, { error: 'That request was too big.' });
    out = await h({ ...body, name: who });
  }
  catch (err) {
    console.error('route failed:', req.method, u.pathname, (err && err.stack) || err);
    return json(500, { error: 'Something went wrong on the server. Try again.' });
  }
  json(200, out);
}).listen(PORT, () => {
  console.log(`Huzz Hunter running at http://localhost:${PORT}  (friends on your wifi: http://<your-ip>:${PORT})`);
  console.log(PASS ? 'Password: on' : 'Password: OFF (set PASSWORD=... before putting this online)');
  /* Never print the webhook or now-playing secrets: the journal is readable and gets shared in logs. */
  console.log(`Webhook: POST /hook/<channel>/<key>  (key in data.json as .key)`);
  console.log(`Bot: ${BOT}  |  now playing: POST /api/np with x-np-key (key in data.json as .npkey)`);
});
