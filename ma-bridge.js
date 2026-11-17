#!/usr/bin/env node
// Huzz Hunter <-> Music Assistant bridge.
// Watches every Music Assistant player over the local websocket API and pushes
// the current track to Huzz Hunter, which shows it on that user's profile
// (art, title, artist, album, live progress) like Discord.
//
// Run on the Music Assistant host:  node ma-bridge.js [config.json]
// Config defaults to ~/.config/huzz-ma-bridge/config.json.
const fs = require('fs'), path = require('path'), os = require('os');

const HOME = process.env.HOME || os.homedir();
const CFG_PATH = process.argv[2] || path.join(HOME, '.config', 'huzz-ma-bridge', 'config.json');
let cfg;
try { cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')); } catch (e) { console.error('[ma-bridge] cannot read ' + CFG_PATH + ': ' + e.message); process.exit(1); }

const MA_WS = cfg.maUrl || 'ws://127.0.0.1:8096/ws';
const MA_PUBLIC = (cfg.maPublic || 'http://100.123.64.57:8095').replace(/\/+$/, '');
const HUZZ = (cfg.huzzUrl || 'http://127.0.0.1:3100').replace(/\/+$/, '');
const DATA = cfg.dataFile || '/opt/huzzhunters/data.json';
const POLL = Math.max(1500, (+cfg.interval || 3) * 1000);
const MAP = cfg.players || {}; // player id or display name -> Huzz account name ("*" = catch-all)
const ANNOUNCE = cfg.announce || ''; // optional channel that gets a "now playing" line on every track change
const TOKEN = String(cfg.token || readFile(cfg.tokenFile || path.join(path.dirname(CFG_PATH), 'token'), '')).trim();

function readFile(p, quiet) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { if (!quiet) console.error('[ma-bridge] ' + p + ': ' + e.message); return ''; }
}
const log = (...a) => console.log(new Date().toISOString(), '[ma-bridge]', ...a);

// The np key (and webhook key) live in Huzz's data.json, so nothing secret is duplicated here.
let npKey = cfg.npKey || '', hookKey = cfg.hookKey || '';
function readHuzzKeys() {
  if (npKey && hookKey) return;
  const raw = readFile(DATA, true);
  if (!raw) return log('cannot read ' + DATA + ' yet');
  try { const d = JSON.parse(raw); npKey = npKey || d.npkey || ''; hookKey = hookKey || d.key || ''; } catch (e) { log('bad ' + DATA + ': ' + e.message); }
}

let ws = null, seq = 0, ready = false;
const pending = new Map();
function rpc(command, args = {}, timeout = 12000) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== 1) return reject(new Error('socket closed'));
    const id = (++seq) + '-' + Date.now(), t = setTimeout(() => { pending.delete(id); reject(new Error('timeout ' + command)); }, timeout);
    pending.set(id, { resolve, reject, t });
    ws.send(JSON.stringify({ message_id: id, command, args }));
  });
}

function connect() {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const sock = new WebSocket(MA_WS);
    ws = sock;
    sock.onopen = async () => {
      try { await rpc('auth', { token: TOKEN }); ready = true; log('connected to Music Assistant at ' + MA_WS); finish(true); }
      catch (e) { log('auth failed: ' + e.message); finish(false); try { sock.close(); } catch {} }
    };
    sock.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      const p = m.message_id && pending.get(m.message_id);
      if (!p) return;
      clearTimeout(p.t); pending.delete(m.message_id);
      if (m.error_code) p.reject(new Error(m.error_code + (m.details ? ': ' + JSON.stringify(m.details).slice(0, 160) : ''))); else p.resolve(m.result);
    };
    sock.onerror = () => {};
    sock.onclose = () => { ready = false; pending.forEach(p => { clearTimeout(p.t); p.reject(new Error('socket closed')); }); pending.clear(); finish(false); };
  });
}

// Music Assistant hands out image URLs on whatever host it was reached from (often a LAN IP),
// so point them at the address every Huzz user can reach.
const fixArt = u => { try { const x = new URL(String(u || '')); return MA_PUBLIC + x.pathname + x.search; } catch { return ''; } };
const playerName = p => MAP[p.player_id] || MAP[p.display_name] || MAP[p.name] || MAP['*'] || p.display_name || '';

const sent = new Map(); // player_id -> { key, title, el, at, playing, name }
let pushing = false;
async function push(players) {
  if (!players.length) return true;
  if (pushing) return true;
  pushing = true;
  try {
    for (let i = 0; i < 3; i++) {
      if (!npKey) readHuzzKeys();
      if (!npKey) return false;
      try {
        const r = await fetch(HUZZ + '/huzz-hunter/api/np', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-np-key': npKey },
          body: JSON.stringify({ players })
        });
        if (r.status === 403) { npKey = ''; continue; }
        if (!r.ok) log('huzz answered ' + r.status);
        return r.ok;
      } catch (e) { log('huzz push failed: ' + e.message); await new Promise(r => setTimeout(r, 2000)); }
    }
    return false;
  } finally { pushing = false; }
}

async function announce(np) {
  if (!ANNOUNCE) return;
  if (!hookKey) readHuzzKeys();
  if (!hookKey) return;
  const line = '▶️ ' + np.t + (np.a ? ' — ' + np.a : '') + (np.al ? ' (' + np.al + ')' : '');
  try {
    await fetch(HUZZ + '/huzz-hunter/hook/' + encodeURIComponent(ANNOUNCE) + '/' + hookKey, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Music Assistant', text: line })
    });
  } catch (e) { log('announce failed: ' + e.message); }
}

async function poll() {
  const players = await rpc('players/all');
  const out = [], seen = new Set();
  for (const p of Array.isArray(players) ? players : []) {
    const cm = p.current_media || {};
    const name = playerName(p);
    if (!cm.title || !name) continue;
    seen.add(p.player_id);
    const playing = p.playback_state === 'playing';
    // The server's elapsed time is a snapshot: project it forward while the track plays.
    let el = Math.max(0, Math.round((cm.elapsed_time || 0) + (playing && cm.elapsed_time_last_updated ? Date.now() / 1000 - cm.elapsed_time_last_updated : 0)));
    // Pausing sometimes reports the start of the stream, so keep the spot it was paused at.
    const pauseHold = sent.get(p.player_id);
    if (!playing && pauseHold && pauseHold.title === cm.title && el < 2 && pauseHold.el >= 5) el = Math.round(pauseHold.el);
    const np = { t: cm.title, a: cm.artist || '', al: cm.album || '', art: fixArt(cm.image_url), dur: cm.duration || 0, el, p: playing ? 1 : 0, url: MA_PUBLIC, src: p.player_id };
    const key = [np.t, np.a, np.al, np.art, np.dur, np.p].join('|'), prev = sent.get(p.player_id);
    const projected = prev ? prev.el + (prev.playing ? (Date.now() - prev.at) / 1000 : 0) : -1;
    const trackChanged = !prev || prev.title !== np.t || prev.name !== name;
    if (!prev || prev.key !== key || Math.abs(el - projected) > 6 || Date.now() - (prev ? prev.at : 0) > 45000) {
      out.push({ name, np });
      sent.set(p.player_id, { key, title: np.t, el, at: Date.now(), playing, name });
    }
    if (trackChanged) announce(np);
  }
  // A player that stopped (closed tab, paused to idle, gone) clears its card once.
  for (const [pid, prev] of [...sent]) if (!seen.has(pid)) { out.push({ name: prev.name, np: null }); sent.delete(pid); }
  if (out.length) { const ok = await push(out); if (!ok) log('could not reach Huzz Hunter; will retry on the next track change'); }
}

async function main() {
  readHuzzKeys();
  const ok = await connect();
  if (!ok) { log('retrying in 5s'); return setTimeout(main, 5000); }
  const tick = async () => {
    try { await poll(); } catch (e) {
      log('poll failed: ' + e.message);
      if (!ready) { log('reconnecting'); if (!(await connect())) return setTimeout(tick, 5000); }
    }
    setTimeout(tick, POLL);
  };
  tick();
}

process.on('uncaughtException', e => log('error: ' + e.message));
process.on('unhandledRejection', e => log('error: ' + (e && e.message)));
main();
