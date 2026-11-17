/* Huzz Hunter extras: server rail, voice channels, emoji + stickers, reactions, themes. Loaded after the main script. */
(function () {
  let srv = localStorage.hs || 'home', layout = null, stickers = {}, voice = {}, myVC = null, stream = null, muted = false, deaf = false, ptab = 'e';
  const pcs = {}, QR = ['👍', '❤️', '😂', '🔥', '💀', '😭'];
  const EMOJI = {
    Faces: '😀 😂 🤣 😊 😍 🥰 😎 🤩 🥳 😏 😅 😭 😤 😡 🤯 😱 🥶 😴 🤔 🫡 🙄 😬 🥹 😇 🤪 😈 🤡 🥵',
    Vibes: '👍 👎 👏 🙌 🤝 🙏 💪 🫶 👀 🧠 💀 👑 🔥 ✨ 💯 ❤️ 💔 🗿 🫠 💅',
    Study: '📚 ✏️ 📝 🎯 ⏰ 🏆 🥇 📈 🧪 🔬 💡 🎧 ☕ 🍜 🌙 ⚡ 🚀 🎓'
  };
  const BASE = ['e:🔥', 'e:💀', 'e:😭', 'e:🗿', 'e:🫡', 'e:👑', 'e:🧠', 'e:📚', 'w:W', 'w:L', 'w:GG', 'w:locked in', 'w:huzz', 'w:ratio', 'w:cooked', 'w:lets go'];
  /* The server owner can lock in any account: their app shuts until the hours are studied.
     Kept on window because the profile card is rendered from a different closure. */
  window.hhOwner = false;
  /* Only once there is a session: an unauthenticated GET here just logged a 401 in the console. */
  if (localStorage.htk) get('/huzz-hunter/api/roles').then(r => {
    const own = (r && r.own) || {};
    window.hhOwner = !!me && Object.values(own).includes(me);
  }).catch(() => {});
  const THEMES = ['aubergine', 'midnight', 'forest', 'sunset', 'sakura', 'amoled', 'paper'];
  const WALLS = { None: '', Aurora: 'linear-gradient(135deg,#0f2027,#2c5364 50%,#3a1c71)', Sunset: 'linear-gradient(160deg,#41295a,#ff6a3d 60%,#f5b84b)', Ocean: 'radial-gradient(circle at 20% 20%,#0b3d91,#050b1f 70%)', Sakura: 'linear-gradient(135deg,#3a1c3f,#ff9ec4)', Matrix: 'linear-gradient(#000,#032b12)' };
  const root = document.documentElement;

  /* ---- look and feel ---- */
  root.dataset.theme = localStorage.ht || 'aubergine';
  if (localStorage.ha) root.style.setProperty('--gold', localStorage.ha);
  if (localStorage.hw) root.style.setProperty('--wall', localStorage.hw);
  if (localStorage.hg) root.style.setProperty('--glass', localStorage.hg + '%');
  if (localStorage.hsee) root.style.setProperty('--see', localStorage.hsee + '%');
  const setGlass = g => { root.style.setProperty('--glass', g + '%'); localStorage.hg = g; };
  const setSee = s => { root.style.setProperty('--see', s + '%'); localStorage.hsee = s; };
  const setTheme = t => { root.dataset.theme = t; localStorage.ht = t; root.style.removeProperty('--gold'); localStorage.removeItem('ha'); };
  /* Background: a picture, an animated GIF or a short clip in one layer behind the whole app.
     The picture is saved with the account, while sound and on/off are per device (hwaud/hwoff),
     so one person muting their laptop never mutes anyone else's wallpaper. */
  const audOn = () => localStorage.hwaud === '1';
  const wallOn = () => localStorage.hwoff !== '1';
  const savedLive = () => { try { return JSON.parse(localStorage.hwl || 'null'); } catch (e) { return null; } };
  const wallLive = () => {
    let l = document.getElementById('walllive');
    if (!l) { l = document.createElement('div'); l.id = 'walllive'; l.hidden = true; document.body.append(l); }
    return l;
  };
  const applyAud = () => {
    const l = document.getElementById('walllive'), v = l && l.querySelector('video');
    if (!v) return;
    v.muted = !audOn();
    v.volume = Math.max(0, Math.min(1, (+localStorage.hwvol || 45) / 100));
    if (audOn()) {
      const p = v.play();
      if (p && p.catch) p.catch(() => { v.muted = true; const q = v.play(); if (q && q.catch) q.catch(() => {}); });
    }
  };
  const paintCtl = () => {
    const c = document.getElementById('wallctl');
    if (!c) return;
    const l = document.getElementById('walllive'), any = l && !l.hidden && l.querySelector('video,img'), v = any && l.querySelector('video');
    c.hidden = !any;
    c.innerHTML = !any ? ''
      : (v ? `<button type="button" data-wc="aud" title="${audOn() ? 'Mute the wallpaper on this device' : 'Unmute the wallpaper on this device'}">${audOn() ? '🔊' : '🔇'}</button>` : '')
        + '<button type="button" data-wc="off" title="Hide the wallpaper on this device">✕</button>';
  };
  const renderWall = () => {
    const l = wallLive();
    l.querySelectorAll('video').forEach(v => { try { v.pause(); } catch (e) {} });
    l.innerHTML = ''; l.hidden = true; l.style.background = '';
    const live = wallOn() ? savedLive() : null, css = wallOn() ? (localStorage.hw || '') : '';
    root.style.removeProperty('--wall');
    if (css) { l.hidden = false; l.style.background = css; root.style.setProperty('--wall', css); }
    else if (live && live.u) {
      l.hidden = false;
      if (live.t === 'css') { l.style.background = live.u; }
      else if (live.t === 'vid') {
        const v = document.createElement('video');
        v.className = 'wallvid'; v.src = live.u; v.loop = true; v.autoplay = true;
        v.setAttribute('playsinline', ''); v.playsInline = true; v.preload = 'auto'; v.muted = !audOn();
        l.append(v);
        const p = v.play(); if (p && p.catch) p.catch(() => {});
      } else {
        const i = document.createElement('img');
        i.className = 'wallimg'; i.alt = ''; i.src = live.u; i.decoding = 'async'; i.draggable = false;
        l.append(i);
      }
    }
    document.body.classList.toggle('wallon', !l.hidden);
    /* keep the root transparent too, so phones do not paint the page colour over the wallpaper */
    document.documentElement.classList.toggle('wallon', !l.hidden);
    paintCtl(); applyAud();
  };
  /* quick controls on the wallpaper itself: sound on/off and hide, both only for this device */
  (function () {
    const c = document.createElement('div'); c.id = 'wallctl'; c.hidden = true; document.body.append(c);
    c.addEventListener('click', e => {
      const a = e.target.closest('[data-wc]'); if (!a) return;
      if (a.dataset.wc === 'aud') setAud(!audOn()); else wallOff(true);
    });
  })();
  const setWall = w => {
    try {
      if (w) { localStorage.hw = w; localStorage.removeItem('hwl'); localStorage.removeItem('hwoff'); }
      else { localStorage.removeItem('hw'); localStorage.removeItem('hwl'); }
    } catch (e) { alert('That image is too big to remember after a reload.'); }
    renderWall();
  };
  const setWallLive = (u, t) => {
    try { localStorage.hwl = JSON.stringify({ u, t: t === 'vid' ? 'vid' : 'img' }); localStorage.removeItem('hw'); localStorage.removeItem('hwoff'); } catch (e) {}
    renderWall();
  };
  const wallOff = on => { try { localStorage.hwoff = on ? '1' : '0'; } catch (e) {} renderWall(); };
  const setAud = on => { try { localStorage.hwaud = on ? '1' : '0'; } catch (e) {} applyAud(); paintCtl(); };
  const setVol = v => { try { localStorage.hwvol = v; } catch (e) {} applyAud(); };
  const vidLike = u => /\.(mp4|webm)(\?|#|$)/i.test(String(u || ''));
  /* One wallpaper for the whole site: whatever anyone picks, everyone gets. Only the local cache
     is written here; sound and the hide switch stay untouched, because those are per device. */
  const applyWall = w => {
    try {
      if (w && w.u) {
        localStorage.hwl = JSON.stringify({ u: w.u, t: w.t === 'vid' ? 'vid' : w.t === 'css' ? 'css' : 'img' });
        localStorage.removeItem('hw');
      } else { localStorage.removeItem('hwl'); localStorage.removeItem('hw'); }
    } catch (e) {}
    renderWall();
  };
  window.hhWallApply = applyWall;
  const clearWallShared = async () => {
    try {
      const r = await (await fetch('/huzz-hunter/api/wall', { method: 'DELETE', headers: { 'x-token': localStorage.htk || '', 'x-pass': localStorage.hp || '' } })).json();
      if (r && r.ok) return applyWall(null);
    } catch (e) {}
    applyWall(null);
  };
  const setWallShared = async css => {
    if (!css) return clearWallShared();
    try {
      const r = await (await fetch('/huzz-hunter/api/wall', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-token': localStorage.htk || '', 'x-pass': localStorage.hp || '' },
        body: JSON.stringify({ css })
      })).json();
      if (r && r.wall) return applyWall(r.wall);
      if (r && r.error) return alert(r.error);
    } catch (e) {}
    setWall(css); /* signed out or offline: at least this device shows it */
  };
  /* pull the shared wallpaper on load; a device that hid it keeps it hidden */
  const pullWall = async () => {
    if (!localStorage.htk) return;
    try {
      const r = await (await fetch('/huzz-hunter/api/wall', { headers: { 'x-token': localStorage.htk || '', 'x-pass': localStorage.hp || '' } })).json();
      if (!r || !r.ok) return;
      const w = r.wall, cur = savedLive();
      if (!w || !w.u) { if (cur) applyWall(null); return; }
      if (cur && cur.u === w.u) return;
      applyWall(w);
    } catch (e) {}
  };
  window.hhPullWall = pullWall;
  window.addEventListener('hh:login', pullWall);
  renderWall();
  /* Text over a busy wallpaper is hard to read: one switch lays a stronger scrim behind it. */
  const scrimOn = () => localStorage.hwscrim === '1';
  const setScrim = on => {
    try { localStorage.hwscrim = on ? '1' : '0'; } catch (e) {}
    document.body.classList.toggle('wscrim', !!on);
  };
  setScrim(scrimOn());
  (function tryPull(n) { setTimeout(() => { if (localStorage.htk) pullWall(); else if (n > 1) tryPull(n - 1); }, 900); })(8);
  /* browsers block sound until someone touches the page, so unmute on the first tap */
  document.addEventListener('pointerdown', () => { if (audOn()) applyAud(); }, { once: true, capture: true });
  function openSettings() {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="card">
      <div class="row"><h2 style="flex:1;margin:0">Look and feel</h2><button class="x" id="mx" aria-label="Close">×</button></div>
      <small>Theme</small><div class="row">${THEMES.map(t => `<button class="btn alt" data-th="${t}">${t}</button>`).join('')}</div>
      <small>Accent colour</small><div class="row"><input type="color" id="ac" value="${localStorage.ha || '#f5b84b'}"></div>
      <small>Your name</small><div class="row"><button class="btn alt" id="setdn">✎ Change display name</button></div>
      <small>Chat background — picture, GIF or video</small><div class="row">${Object.keys(WALLS).map(k => `<button class="btn alt" data-w="${k}">${k}</button>`).join('')}<button class="btn alt" id="wu">Upload image</button><button class="btn alt" id="wv">Upload GIF / video</button></div>
      <div class="row"><input class="in" id="wurl" placeholder="or paste an image / gif / mp4 link" style="flex:1"><button class="btn" id="wg">Use</button><button class="btn alt" id="wclear">Remove</button></div>
      <small class="mut" id="wstate">${wallOn() ? 'Wallpaper: on for you' : 'Wallpaper: off for you'}</small>
      <small>Only this device</small><div class="row"><button class="btn${wallOn() ? '' : ' alt'}" id="wshow">Show</button><button class="btn${wallOn() ? ' alt' : ''}" id="whide">Hide</button><button class="btn alt" id="waud">${audOn() ? '🔊 Sound on' : '🔇 Sound off'}</button></div>
      <small>Wallpaper volume — this device</small><div class="row"><input type="range" id="wvol" min="0" max="100" value="${localStorage.hwvol || 45}" style="flex:1"></div>
      <small class="mut">Ek hi background sabke liye hai — jo tum lagaoge wo sabko dikhega. Sound aur Show/Hide sirf tumhare device par lagte hain. GIF ya mp4/webm clip chat ke peeche loop hota hai.</small>
      <small>Panel glass (lower shows more wallpaper)</small><div class="row"><input type="range" id="gl" min="35" max="100" value="${localStorage.hg || 100}" style="flex:1"></div>
      <small>See-through panels (wallpaper mode)</small><div class="row"><input type="range" id="see" min="12" max="92" value="${localStorage.hsee || 46}" style="flex:1"></div>
      <small>Text over the wallpaper</small><div class="row"><button class="btn${scrimOn() ? '' : ' alt'}" id="wscrim">${scrimOn() ? 'Darkened ✓' : 'Darken text'}</button></div></div>`;
    document.body.append(m);
    m.onclick = e => { const d = e.target.dataset; if (e.target === m || e.target.id === 'mx') m.remove(); if (d.th) setTheme(d.th); if (d.w !== undefined) { const css = WALLS[d.w]; if (!css) setWallShared(''); else setWallShared(css); } };
    m.querySelector('#setdn').onclick = () => { m.remove(); window.hhQuickDn && window.hhQuickDn(); };
    m.querySelector('#ac').oninput = e => { root.style.setProperty('--gold', e.target.value); localStorage.ha = e.target.value; };
    m.querySelector('#gl').oninput = e => setGlass(e.target.value);
    m.querySelector('#see').oninput = e => setSee(e.target.value);
    const repaint = () => {
      m.querySelector('#wstate').textContent = wallOn() ? 'Wallpaper: on for you' : 'Wallpaper: off for you';
      m.querySelector('#wshow').className = 'btn' + (wallOn() ? '' : ' alt');
      m.querySelector('#whide').className = 'btn' + (wallOn() ? ' alt' : '');
      m.querySelector('#waud').textContent = audOn() ? '🔊 Sound on' : '🔇 Sound off';
    };
    m.querySelector('#wshow').onclick = () => { wallOff(false); repaint(); };
    m.querySelector('#whide').onclick = () => { wallOff(true); repaint(); };
    m.querySelector('#waud').onclick = () => { setAud(!audOn()); repaint(); };
    m.querySelector('#wvol').oninput = e => setVol(e.target.value);
    m.querySelector('#wscrim').onclick = () => {
      setScrim(!scrimOn());
      const b = m.querySelector('#wscrim');
      b.textContent = scrimOn() ? 'Darkened ✓' : 'Darken text';
      b.className = 'btn' + (scrimOn() ? '' : ' alt');
    };
    m.querySelector('#wg').onclick = () => {
      const u = m.querySelector('#wurl').value.trim().replace(/"/g, '');
      if (!u) return;
      if (vidLike(u)) setWallLive(u, 'vid');
      else setWallLive(u, 'img');
    };
    m.querySelector('#wclear').onclick = () => { clearWallShared(); m.querySelector('#wurl').value = ''; };
    /* Uploads go to the server, so a big GIF or clip is not squeezed into localStorage. */
    const uploadWall = async file => {
      const isVid = /^video\//.test(file.type) || /\.(mp4|webm)$/i.test(file.name);
      let r = null;
      try {
        r = await (await fetch('/huzz-hunter/api/wall?kind=' + (isVid ? 'vid' : 'img'), {
          method: 'POST', body: file,
          headers: { 'x-token': localStorage.htk || '', 'x-pass': localStorage.hp || '', 'content-type': 'application/octet-stream' }
        })).json();
      } catch (e) { r = null; }
      if (r && r.ok && r.wall) return applyWall(r.wall);
      if (r && r.error) alert(r.error);
      /* no server (or signed out): a small picture can still ride along as a data URL */
      if (!isVid) { const fr = new FileReader(); fr.onload = () => setWall(`url("${fr.result}")`); fr.readAsDataURL(file); }
    };
    m.querySelector('#wu').onclick = () => {
      const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
      f.onchange = () => { if (f.files[0]) uploadWall(f.files[0]); };
      f.click();
    };
    m.querySelector('#wv').onclick = () => {
      const f = document.createElement('input'); f.type = 'file'; f.accept = 'video/mp4,video/webm,image/gif,image/*';
      f.onchange = () => { if (f.files[0]) uploadWall(f.files[0]); };
      f.click();
    };
  }

  /* Display name: the quick way, without opening the whole profile editor. The handle (@name)
     never changes; the server broadcasts the new name so every list and message updates. */
  window.hhQuickDn = function () {
    document.querySelectorAll('.modal.qdn').forEach(x => x.remove());
    const who = localStorage.hn || '';
    const P = (window.hhPeople && window.hhPeople()) || {};
    const cur = (P[who] || {}).dn || '';
    const m = document.createElement('div'); m.className = 'modal qdn';
    m.innerHTML = `<div class="card">
      <div class="row" style="margin:0 0 8px"><b style="flex:1">Display name</b><button type="button" class="x" data-x aria-label="Close">×</button></div>
      <small class="mut">Chat, member list aur profile par yeh naam dikhta hai. Handle @${esc(who)} wahi rehta hai.</small>
      <input class="in" id="qdn" maxlength="24" placeholder="${esc(who)}" value="${esc(cur)}" autocomplete="off">
      <div class="row" style="margin-top:10px"><button type="button" class="btn" id="qsave">Save</button><button type="button" class="btn alt" id="qclear">Clear</button><button type="button" class="btn alt" id="qx">Cancel</button></div>
      <small class="mut" id="qerr" hidden></small></div>`;
    document.body.append(m);
    const inp = m.querySelector('#qdn'), err = m.querySelector('#qerr');
    m.addEventListener('click', e => { if (e.target === m || e.target.dataset.x !== undefined || e.target.id === 'qx') m.remove(); });
    const save = async v => {
      const btn = m.querySelector('#qsave'); btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const r = await api('/huzz-hunter/api/profile', { dn: v });
        if (!r || r.error) throw new Error((r && r.error) || 'the server did not accept it');
        m.remove();
        (window.hhToast || alert)(v ? 'Display name set: ' + v : 'Display name cleared — @' + who + ' shows again.');
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Save';
        err.hidden = false; err.textContent = 'Save nahi hua: ' + (e && e.message ? e.message : 'try again');
      }
    };
    m.querySelector('#qsave').onclick = () => save(inp.value.trim());
    m.querySelector('#qclear').onclick = () => save('');
    inp.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); save(inp.value.trim()); } };
    setTimeout(() => { inp.focus(); inp.select(); }, 60);
  };

  /* ---- server rail and channel list ---- */
  const rail = document.createElement('nav'); rail.id = 'rail'; document.body.prepend(rail);
  document.querySelector('.sec').hidden = true;
  function renderRail() {
    rail.innerHTML = '';
    /* DMs sit above every server, like Discord's home button */
    const dm = document.createElement('button');
    dm.id = 'dmhome'; dm.type = 'button'; dm.className = 'srv dmb'; dm.title = 'Direct messages';
    dm.onclick = () => window.openDMsPanel && window.openDMsPanel();
    rail.append(dm);
    Object.entries(layout).forEach(([k, s]) => {
      const b = document.createElement('button');
      b.className = 'srv' + (k === srv ? ' on' : ''); b.dataset.k = k;
      b.title = `${s.name} — right-click or long-press to change its name and icon`;
      b.innerHTML = (window.srvIcon || (ss => ss.icon || 'HH'))(s, k);
      b.onclick = () => { srv = localStorage.hs = k; if (!s.text.includes(cur)) cur = s.text[0]; show('chat'); renderMsgs(); renderRail(); };
      b.oncontextmenu = e => { e.preventDefault(); if (window.openServerEdit) window.openServerEdit(k); };
      let hold;
      b.onpointerdown = () => { clearTimeout(hold); hold = setTimeout(() => { if (window.openServerEdit) window.openServerEdit(k); }, 550); };
      ['pointerup', 'pointerleave', 'pointercancel', 'pointermove'].forEach(ev => b.addEventListener(ev, () => clearTimeout(hold)));
      rail.append(b);
    });
    const jb = document.createElement('button');
    jb.className = 'srv join'; jb.type = 'button'; jb.title = 'Server lobby — join a server with an invite';
    jb.textContent = '＋'; jb.onclick = () => openLobby(); rail.append(jb);
    const g = document.createElement('button'); g.className = 'srv gear'; g.title = 'Themes and wallpaper'; g.textContent = '⚙'; g.onclick = openSettings; rail.append(g);
    const h1 = document.querySelector('aside h1');
    if (h1) { h1.title = 'Click to rename this server or change its icon'; h1.style.cursor = 'pointer'; h1.onclick = () => window.openServerEdit && window.openServerEdit(srv); }
  }
  renderChans = function () {
    if (!layout) return;
    const s = layout[srv], el = $('#chs');
    el.innerHTML = '';
    if (!s) return;
    const cat = (label, kind) => {
      const h = document.createElement('div'); h.className = 'cat'; h.innerHTML = `<span>${label}</span><button aria-label="Add ${kind} channel">+</button>`;
      h.querySelector('button').onclick = () => { const n = prompt(`New ${kind} channel name`); if (n) api('/huzz-hunter/api/channel', { ch: n, srv, kind }); };
      el.append(h);
    };
    cat('Text channels', 'text');
    s.text.forEach(c => {
      const b = document.createElement('button'); b.className = 'ch' + (view === 'chat' && c === cur ? ' on' : '') + (unread[c] ? ' un' : '');
      b.innerHTML = `<span># ${esc(c)}</span>${unread[c] ? `<i>${unread[c]}</i>` : ''}`;
      b.onclick = () => { cur = c; unread[c] = 0; show('chat'); renderMsgs(); $('#box').focus(); };
      el.append(b);
    });
    cat('Voice channels', 'voice');
    s.voice.forEach(c => {
      const b = document.createElement('button'); b.className = 'ch' + (myVC === c ? ' on' : '') + (view === 'vchat' && vch === c ? ' on' : '');
      const hasBot = (voice[c] || []).includes('Music Assistant');
      b.innerHTML = `<span>🔊 ${esc(c)}</span><span class="vtx" title="Text chat for this voice channel">💬${vunread[c] ? `<i>${vunread[c]}</i>` : ''}</span><span class="vbot${hasBot ? ' on' : ''}" title="${hasBot ? 'Music Assistant is here — click to remove' : 'Add Music Assistant to this voice channel'}">🎵</span>`;
      b.onclick = e => {
        if (e.target.closest('.vtx')) { e.stopPropagation(); return vchatOpen(c); }
        if (e.target.closest('.vbot')) { e.stopPropagation(); if (window.hhBotVC) return window.hhBotVC(hasBot ? null : c); }
        return myVC === c ? leaveVC() : joinVC(c);
      };
      el.append(b);
      (voice[c] || []).forEach(n => {
        const d = document.createElement('div'); d.className = 'vm'; d.dataset.u = n;
        d.innerHTML = `<span class="av sm" style="background:${col(n)}">${esc(n[0].toUpperCase())}</span>${esc(n)}${liveMap[n] ? ' <small>studying</small>' : ''}`; el.append(d);
      });
    });
    const nav = document.querySelector('.nav'); nav.hidden = srv !== 'rag'; nav.previousElementSibling.hidden = srv !== 'rag';
    document.querySelector('aside h1').textContent = s.name;
  };

  /* ---- messages: stickers, custom emoji, reactions ---- */
  const stickerHtml = s => {
    const k = s.slice(2);
    if (s.startsWith('e:')) return `<div class="stk">${esc(k)}</div>`;
    if (s.startsWith('w:')) return `<div class="stk w">${esc(k)}</div>`;
    return stickers[k] ? `<img class="stk" src="${stickers[k]}" alt="${esc(k)}">` : `<small>[sticker ${esc(k)}]</small>`;
  };
  const rxHtml = re => Object.entries(re || {}).map(([e, l]) => `<button class="rc${l.includes(me) ? ' me' : ''}" data-e="${esc(e)}">${esc(e)} ${l.length}</button>`).join('');
  const _fmt = fmt;
  fmt = t => _fmt(t).replace(/:([a-z0-9_]{1,16}):/g, (m, n) => (stickers[n] ? `<img class="ce" src="${stickers[n]}" alt=":${n}:">` : m));
  addMsg = function (m) {
    const box = $('#msgs'), stick = box.scrollHeight - box.scrollTop - box.clientHeight < 80 || m.name === me;
    const grp = prev && prev.name === m.name && m.ts - prev.ts < 3e5, el = document.createElement('div');
    const time = new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el.className = 'm' + (grp ? ' g' : ''); el.dataset.id = m.id;
    el.innerHTML = (grp ? `<span class="t">${time}</span>` : `<div class="av" style="background:${col(m.name)}">${esc(m.name[0].toUpperCase())}</div>`)
      + `<div class="bw">${grp ? '' : `<span class="n">${esc(m.name)}</span>${m.bot ? '<span class="bot">bot</span>' : ''}<span class="t">${time}</span>`}<div class="b">${(m.st ? stickerHtml(m.st) : '') + (m.text ? fmt(m.text) : '')}</div><div class="rx">${rxHtml(m.re)}</div></div>`
      + `<div class="qr">${QR.map(e => `<button data-e="${e}">${e}</button>`).join('')}</div>`;
    box.append(el); prev = m;
    if (stick) box.scrollTop = box.scrollHeight;
  };
  $('#msgs').addEventListener('click', e => {
    const b = e.target.closest('[data-e]'); if (!b) return;
    api('/huzz-hunter/api/react', { channel: cur, id: b.closest('.m').dataset.id, emoji: b.dataset.e });
  });

  /* ---- emoji and sticker picker ---- */
  const pick = document.createElement('div'); pick.id = 'pick'; pick.hidden = true; document.body.append(pick);
  const eb = document.createElement('button'); eb.type = 'button'; eb.id = 'eb'; eb.textContent = '😊'; eb.title = 'Emoji and stickers'; $('#send').append(eb);
  /* an animated sticker keeps its frames: it is stored as a file, not squashed into one canvas frame */
  const isGifSticker = d => typeof d === 'string' && (/^data:image\/gif/.test(d) || /\.gif(?:$|\?)/i.test(d));
  async function looksAnimated(file) {
    if (file.type === 'image/gif') return true;
    if (!/^image\/(webp|png)$/.test(file.type)) return false;
    try {
      const head = new Uint8Array(await file.slice(0, 16384).arrayBuffer());
      return head.some((b, i) => head[i] === 0x61 && head[i + 1] === 0x63 && head[i + 2] === 0x54 && head[i + 3] === 0x4c) // acTL (animated png)
        || head.some((b, i) => head[i] === 0x41 && head[i + 1] === 0x4e && head[i + 2] === 0x4d && head[i + 3] === 0x46); // ANMF (animated webp)
    } catch { return false; }
  }
  function drawPick() {
    const cust = Object.entries(stickers), gifs = cust.filter(([, d]) => isGifSticker(d));
    pick.innerHTML = `<div class="row"><button class="btn ${ptab === 'e' ? '' : 'alt'}" data-t="e">Emoji</button><button class="btn ${ptab === 's' ? '' : 'alt'}" data-t="s">Stickers</button><button class="btn ${ptab === 'g' ? '' : 'alt'}" data-t="g">GIFs</button></div>`
      + (ptab === 'e'
        ? Object.entries(EMOJI).map(([k, v]) => `<small>${k}</small><div class="eg">${v.split(' ').map(x => `<button data-i="${x}">${x}</button>`).join('')}</div>`).join('')
          + (cust.length ? `<small>Custom, type :name:</small><div class="eg">${cust.map(([n, d]) => `<button data-i=":${n}:"><img class="ce" src="${d}" alt="${n}"></button>`).join('')}</div>` : '')
        : ptab === 'g'
          ? (gifs.length
            ? `<small>Animated, click to send</small><div class="eg st">${gifs.map(([n, d]) => `<button data-s="c:${n}" title=":${n}:"><img class="stk" src="${d}" alt="${n}"></button>`).join('')}</div>`
            : '<small class="csub">No GIFs yet — add an animated gif and it lands here.</small>')
            + `<button class="btn alt" data-add="1">+ Add a GIF</button>`
          : `<div class="eg st">${BASE.map(s => `<button data-s="${s}">${stickerHtml(s)}</button>`).join('')}${cust.map(([n, d]) => `<button data-s="c:${n}">${isGifSticker(d) ? '<span class="gifp">GIF</span>' : ''}<img class="stk" src="${d}" alt="${n}"></button>`).join('')}</div>`)
      + (ptab === 'g' ? '' : `<button class="btn alt" data-add="1">+ Add your own emoji, sticker or GIF</button>`);
  }
  function addSticker() {
    const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*,image/gif';
    f.onchange = async () => {
      const file = f.files[0]; if (!file) return;
      const name = (prompt('Name it (letters and numbers). Type :name: as an emoji, send it as a sticker, or drop a GIF for an animated sticker.') || '').trim();
      if (!name) return;
      if (await looksAnimated(file)) {
        const label = name.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!label) return (window.hhToast || alert)('Use letters and numbers for a sticker name.');
        const r = await fetch('/huzz-hunter/api/sticker/file?label=' + encodeURIComponent(label), { method: 'POST', body: file }).then(x => x.json()).catch(() => ({}));
        if (r.error) return (window.hhToast || alert)(r.error);
        stickers[label] = r.url; drawPick();
        return (window.hhToast || alert)('Animated sticker :' + label + ': added — it animates in chat.');
      }
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 128 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        api('/huzz-hunter/api/sticker', { label: name, data: c.toDataURL('image/webp', 0.85) }).then(r => {
          if (r.error) return alert(r.error);
          const key = name.toLowerCase().replace(/[^a-z0-9_]/g, '');
          if (key) stickers[key] = c.toDataURL('image/webp', 0.85);
          drawPick();
        });
      };
      img.src = URL.createObjectURL(file);
    };
    f.click();
  }
  /* the server settings panel (part 6) lists this set and can delete from it */
  window.hhStickers = () => stickers;
  window.hhAddSticker = () => addSticker();
  window.hhDelSticker = n => api('/huzz-hunter/api/sticker/del', { label: n });
  pick.onclick = e => {
    // Switching tabs re-renders the panel, which detaches the button that was just clicked.
    // The document-level "click outside closes it" handler would then think the click came
    // from outside and shut the picker, so keep clicks inside it to ourselves.
    e.stopPropagation();
    const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
    if (d.t) { ptab = d.t; drawPick(); }
    else if (d.i) { const b = $('#box'), p = b.selectionStart; b.value = b.value.slice(0, p) + d.i + b.value.slice(b.selectionEnd); b.focus(); b.selectionStart = b.selectionEnd = p + d.i.length; }
    else if (d.s) { api('/huzz-hunter/api/send', { channel: cur, st: d.s }); pick.hidden = true; }
    else if (d.add) addSticker();
  };
  eb.onclick = () => { pick.hidden = !pick.hidden; if (!pick.hidden) drawPick(); };
  document.addEventListener('click', e => { if (!pick.hidden && !pick.contains(e.target) && e.target !== eb) pick.hidden = true; });

  /* ---- voice channels (WebRTC, signalling goes through the server) ---- */
  /* Devices on different networks cannot reach each other through STUN alone, so a TURN relay
     runs on the same tailnet address as this site; it is only used when a direct path fails. */
  const TURN = { urls: ['turn:100.123.64.57:3478?transport=udp', 'turn:100.123.64.57:3478?transport=tcp', 'turn:server.tail6d2374.ts.net:3478?transport=udp'], username: 'huzz', credential: 'huzz-turn-3478' };
  const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }, TURN] };
  const sig = (to, data) => api('/huzz-hunter/api/signal', { to, data });
  /* Chrome's autoGainControl keeps riding the mic level and a plain getUserMedia can drop the
     whole audio device to a narrow call profile; ask for clean 48 kHz mono instead. */
  const MIC = () => ({ audio: Object.assign({ echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1, sampleRate: 48000 }, localStorage.hmic ? { deviceId: { exact: localStorage.hmic } } : {}) });
  async function openMic() {
    try { return await navigator.mediaDevices.getUserMedia(MIC()); }
    catch (e) {
      if (!localStorage.hmic) throw e;
      delete localStorage.hmic;
      return navigator.mediaDevices.getUserMedia(MIC());
    }
  }
  const audioSender = pc => pc.getSenders().find(s => !s.track || s.track.kind === 'audio') || null;
  const vp = document.createElement('div'); vp.id = 'vp'; vp.hidden = true; $('#me').before(vp);
  function renderVP() {
    window.hhVC = () => myVC;
    vp.hidden = !myVC;
    vp.innerHTML = myVC ? `<b>🔊 ${esc(myVC)}</b><div class="row"><button class="btn alt" id="vm">${muted ? 'Unmute' : 'Mute'}</button><button class="btn alt" id="vd">${deaf ? 'Undeafen' : 'Deafen'}</button><button class="btn alt" id="vs">Screen</button><button class="btn" id="vl">Leave</button></div><div class="vmlvl" id="vmlvl" title="Mic level"><i></i></div><select class="in" id="vmic" aria-label="Microphone" title="Microphone — pick the one you want to talk through"></select>` : '';
    if (!myVC) return;
    $('#vm').onclick = async () => {
      const before = muted; muted = !muted; renderVP();
      try { await muteMic(muted); } catch { muted = before; renderVP(); alert('Could not open a microphone. Allow mic access and try again.'); }
    };
    $('#vd').onclick = () => { deaf = !deaf; document.querySelectorAll('audio[id^=a-]').forEach(a => { a.muted = deaf; }); renderVP(); };
    const sel = $('#vmic');
    if (sel) {
      navigator.mediaDevices.enumerateDevices().then(list => {
        const ins = list.filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default');
        const cur = localStorage.hmic || '';
        sel.innerHTML = `<option value="">Default microphone</option>` + ins.map(d => `<option value="${esc(d.deviceId)}"${d.deviceId === cur ? ' selected' : ''}>${esc(d.label || 'Microphone')}</option>`).join('');
      }).catch(() => {});
      sel.onchange = async () => {
        localStorage.hmic = sel.value;
        if (!myVC) return;
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        if (muted) return;
        try { await muteMic(false); } catch { alert('That microphone did not open — pick another one.'); }
      };
    }
    $('#vl').onclick = leaveVC;
    $('#vs').onclick = () => window.hhToggleShare && window.hhToggleShare(myVC);
  }
  /* Muting stops the microphone device itself instead of just silencing the track: while a
     browser keeps the mic open Windows stays in call mode and Bluetooth headsets fall back to
     hands-free quality, which is what made every other sound on the PC feel broken. */
  async function muteMic(on) {
    if (on) {
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null;
      unwatch(me);
      await Promise.all(Object.values(pcs).map(pc => { const s = audioSender(pc); return s ? s.replaceTrack(null).catch(() => {}) : null; }));
      renderVP();
      return;
    }
    if (stream) return;
    stream = await openMic();
    audioCtx(); watchStream(me, stream, true);
    const track = stream.getAudioTracks()[0];
    await Promise.all(Object.values(pcs).map(pc => { const s = audioSender(pc); return s && track ? s.replaceTrack(track).catch(() => {}) : null; }));
    renderVP();
  }
  /* ---- who is talking: every client listens to the audio it already has, no server needed ---- */
  const SPEAK = {}, WATCH = {};
  function audioCtx() {
    if (!window.__hhAC) { try { window.__hhAC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (window.__hhAC && window.__hhAC.state === 'suspended') window.__hhAC.resume().catch(() => {});
    return window.__hhAC;
  }
  function watchStream(name, s, self) {
    if (!name || !s || WATCH[name]) return;
    const ac = audioCtx(); if (!ac) return;
    try {
      const src = ac.createMediaStreamSource(s), an = ac.createAnalyser();
      an.fftSize = 512; an.smoothingTimeConstant = .72;
      src.connect(an);
      WATCH[name] = { an, src, buf: new Uint8Array(an.frequencyBinCount), self: !!self, hot: 0, level: 0 };
    } catch (e) { /* a stream that cannot be analysed simply never lights up */ }
  }
  function unwatch(name) {
    const w = WATCH[name];
    if (w) { try { w.src.disconnect(); } catch (e) {} delete WATCH[name]; }
    delete SPEAK[name];
  }
  function unwatchAll() { Object.keys(WATCH).forEach(unwatch); }
  function paintTalk() {
    document.querySelectorAll('[data-u],[data-m]').forEach(el => el.classList.toggle('talking', !!SPEAK[el.dataset.u || el.dataset.m]));
    const lvl = document.getElementById('vmlvl');
    if (lvl) lvl.style.setProperty('--l', Math.min(1, ((WATCH[me] && WATCH[me].level) || 0) / 26).toFixed(2));
  }
  setInterval(() => {
    if (!Object.keys(WATCH).length) return;
    const now = Date.now();
    Object.keys(WATCH).forEach(n => {
      const w = WATCH[n];
      w.an.getByteFrequencyData(w.buf);
      let sum = 0;
      for (let i = 0; i < w.buf.length; i++) sum += w.buf[i];
      w.level = sum / w.buf.length;
      if (w.level > (w.self ? 9 : 6)) { w.hot = now; SPEAK[n] = true; }
      else if (now - w.hot > 280) SPEAK[n] = false;
    });
    paintTalk();
  }, 140);
  function mkPC(peer) {
    const pc = pcs[peer] = new RTCPeerConnection(ICE); pc.q = [];
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));
    else pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.onicecandidate = e => { if (e.candidate) sig(peer, { c: e.candidate }); };
    pc.ontrack = e => {
      let a = document.getElementById('a-' + peer);
      if (!a) { a = document.createElement('audio'); a.id = 'a-' + peer; a.autoplay = true; a.setAttribute('playsinline', ''); document.body.append(a); }
      a.srcObject = e.streams[0]; a.muted = deaf; a.volume = 1;
      // after a renegotiation some browsers keep the new track paused until play() is called
      a.play().catch(() => {});
      /* Phones, and Chrome with no earlier media on the page, refuse audio nobody tapped for.
         The first tap or key then unlocks it, instead of the call staying silent forever. */
      if (a.paused) {
        const kick = () => {
          a.play().catch(() => {});
          document.removeEventListener('pointerdown', kick, true);
          document.removeEventListener('keydown', kick, true);
        };
        document.addEventListener('pointerdown', kick, true);
        document.addEventListener('keydown', kick, true);
        setTimeout(() => { if (a.paused && window.hhToast) window.hhToast('Audio blocked — tap anywhere to hear the call.'); }, 1500);
      }
      watchStream(peer, e.streams[0]);
    };
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      if (st === 'failed') {
        if (window.hhToast) window.hhToast(peer + ' se audio connect nahi hua — network badal ke dekho.');
        try { pc.restartIce(); } catch (e) {}
      }
    };
    return pc;
  }
  function closePC(p) { pcs[p].close(); delete pcs[p]; unwatch(p); const a = document.getElementById('a-' + p); if (a) a.remove(); }
  async function joinVC(ch) {
    if (myVC) await leaveVC();
    try { stream = await openMic(); }
    catch { alert('Mic is not available. Browsers only allow it on localhost or https, and you must click Allow.'); return; }
    audioCtx(); watchStream(me, stream, true);
    myVC = ch; muted = false; deaf = false;
    const r = await api('/huzz-hunter/api/voice', { channel: ch });
    for (const p of r.peers || []) { const pc = mkPC(p); await pc.setLocalDescription(await pc.createOffer()); sig(p, { d: pc.localDescription }); }
    renderChans(); renderVP();
  }
  async function leaveVC() {
    Object.keys(pcs).forEach(closePC);
    unwatchAll();
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; myVC = null;
    await api('/huzz-hunter/api/voice', { channel: null });
    renderChans(); renderVP();
  }
  async function onSignal({ from, data }) {
    if (!myVC || (data && data.s)) return;
    const pc = pcs[from] || mkPC(from);
    if (data.d) {
      await pc.setRemoteDescription(data.d);
      pc.q.forEach(c => pc.addIceCandidate(c)); pc.q = [];
      if (data.d.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); sig(from, { d: pc.localDescription }); }
    } else if (data.c) { if (pc.remoteDescription) pc.addIceCandidate(data.c); else pc.q.push(data.c); }
  }

  /* ---- text chat for every voice channel + a TTS bot, so people who cannot talk are still heard ---- */
  let vch = null, vmsgs = [], vtts = {}, vunread = {};
  const vs = document.createElement('section');
  vs.id = 'v-vchat'; vs.className = 'v'; vs.hidden = true;
  document.querySelector('main').append(vs);
  const voicesNow = () => ('speechSynthesis' in window ? speechSynthesis.getVoices() : []);
  function speakLine(name, text) {
    if (!('speechSynthesis' in window) || deaf) return;
    const said = String(text || '')
      .replace(/```[\s\S]*?```/g, ' code ')
      .replace(/https?:\/\/\S+/gi, 'link')
      .replace(/:[a-z0-9_]{1,16}:/gi, '')
      .replace(/[*_`~#>|]/g, '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
      .replace(/\s+/g, ' ').trim();
    if (!said) return;
    // "zoro says:" before every line gets annoying — people can switch it off on their device.
    const sayName = localStorage.ttsname !== '0';
    const u = new SpeechSynthesisUtterance((sayName ? `${name} says: ${said}` : said).slice(0, 420));
    const v = voicesNow().find(x => x.name === (localStorage.hvoice || ''));
    if (v) u.voice = v;
    u.rate = Math.min(2, Math.max(0.6, +localStorage.hrate || 1));
    window.speechSynthesis.speak(u);
  }
  const vRow = m => `<div class="vm2" data-id="${esc(m.id)}"><span class="av" style="background:${col(m.name)}">${esc(m.name[0].toUpperCase())}</span><div class="vb"><b>${esc(m.name)}</b><small>${new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small><div>${esc(m.text)}</div></div></div>`;
  function drawVChat() {
    const on = !!vtts[vch];
    vs.innerHTML = `<header><span>🔊</span><b>${esc(vch || '')}</b><small>text chat for this voice channel — the bot reads messages out loud in the call</small><button type="button" class="btn ${on ? '' : 'alt'}" id="vtg" title="Let the bot read new messages out loud">${on ? '🔈 TTS on' : '🔇 TTS off'}</button><button type="button" class="btn alt" id="vset" title="Voice and speed">Voice</button></header>
      <div id="vmsgs">${vmsgs.map(vRow).join('')}</div>
      <form class="send" id="vform"><textarea id="vbox" rows="1" placeholder="Message #${esc(vch || 'the call')} — /help for the music bot."></textarea></form>`;
    const list = vs.querySelector('#vmsgs'), box = vs.querySelector('#vbox');
    list.scrollTop = list.scrollHeight;
    vs.querySelector('#vform').onsubmit = e => { e.preventDefault(); sendV(); };
    box.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendV(); } };
    vs.querySelector('#vtg').onclick = () => api('/huzz-hunter/api/vchat/tts', { ch: vch, on: !vtts[vch] });
    vs.querySelector('#vset').onclick = voiceSettings;
  }
  const addVRow = m => {
    const l = vs.querySelector('#vmsgs');
    if (!l) return drawVChat();
    l.insertAdjacentHTML('beforeend', vRow(m)); l.scrollTop = l.scrollHeight;
  };
  async function vchatOpen(ch) {
    vch = ch; vunread[ch] = 0; vmsgs = []; drawVChat(); show('vchat');
    const r = await get('/huzz-hunter/api/vchat?ch=' + enc(ch)).catch(() => ({}));
    if (r && r.ch === ch) { vmsgs = r.msgs || []; vtts[ch] = !!r.tts; drawVChat(); }
    const box = vs.querySelector('#vbox'); if (box) box.focus();
  }
  async function sendV() {
    const box = vs.querySelector('#vbox'), t = box.value.trim();
    if (!t || !vch) return;
    // the music bot lives in this room: commands typed here never go to the TTS chat
    if (t.startsWith('/')) {
      box.value = ''; box.focus();
      if (window.hhBotCommand) window.hhBotCommand(t);
      return;
    }
    box.value = ''; box.focus();
    const r = await api('/huzz-hunter/api/vchat', { ch: vch, text: t });
    if (r && r.error) (window.hhToast || alert)(r.error);
  }
  function voiceSettings() {
    const m = document.createElement('div'); m.className = 'modal';
    const opts = () => voicesNow().map(v => `<option value="${esc(v.name)}"${localStorage.hvoice === v.name ? ' selected' : ''}>${esc(v.name)} — ${esc(v.lang)}</option>`).join('') || '<option value="">No system voices found</option>';
    m.innerHTML = `<div class="card"><div class="row"><h2 style="flex:1;margin:0">TTS voice</h2><button class="x" aria-label="Close">×</button></div>
      <small>Which system voice the bot uses on this device</small><select class="in" id="tvs">${opts()}</select>
      <small>Speed</small><div class="row"><input type="range" id="trt" min="0.6" max="1.8" step="0.1" value="${+localStorage.hrate || 1}" style="flex:1"><button class="btn" id="ttest">Test</button></div>
      <label class="row ttsn" style="gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="tvn"${localStorage.ttsname === '0' ? '' : ' checked'}> <span>Say the name before each message (“zoro says: …”)</span></label>
      <small>Uncheck it and the bot reads the message straight away, with no name in front. Every device speaks with its own installed voices, so this is a per-device setting.</small></div>`;
    document.body.append(m);
    m.onclick = e => { if (e.target === m || e.target.classList.contains('x')) m.remove(); };
    m.querySelector('#tvs').onchange = e => { localStorage.hvoice = e.target.value; };
    m.querySelector('#trt').oninput = e => { localStorage.hrate = e.target.value; };
    m.querySelector('#ttest').onclick = () => speakLine(me, 'testing, one two three');
    m.querySelector('#tvn').onchange = e => { localStorage.ttsname = e.target.checked ? '1' : '0'; };
    if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { const s = m.querySelector('#tvs'); if (s && m.isConnected) s.innerHTML = opts(); };
  }
  window.hhOpenVChat = vchatOpen;

  /* ---- the lobby: your card, every server on this site and the full member list ---- */
  const lob = document.createElement('section');
  lob.id = 'v-lobby'; lob.className = 'v'; lob.hidden = true;
  document.querySelector('main').append(lob);
  const lobAv = (n, cls) => (window.hhAv ? window.hhAv(n, cls || 'sm') : `<span class="av ${cls || 'sm'}">${esc(String(n || '?')[0].toUpperCase())}</span>`);
  const lobDn = n => ((window.hhPeople && window.hhPeople()[n]) || {}).dn || n;
  const lobCopy = t => {
    const done = () => (window.hhToast || alert)('Invite link copied — send it to anyone.');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, () => prompt('Copy this invite link', t));
    else prompt('Copy this invite link', t);
  };
  let lobKey = '';
  async function lobInvite(key) {
    if (!key) return (window.hhToast || alert)('Join a server first — then its invite link appears here.');
    const r = await api('/huzz-hunter/api/server/invite', { srv: key });
    if (!r || r.error) return (window.hhToast || alert)((r && r.error) || 'Could not make an invite link.');
    const link = location.origin + location.pathname + '?invite=' + r.code;
    const box = lob.querySelector('#loblink'); if (box) box.value = link;
    lobCopy(link);
    return link;
  }
  async function loadLobby() {
    const srvBox = lob.querySelector('#lobsrv'), memBox = lob.querySelector('#lobmem');
    if (!srvBox || !memBox || !me) return;
    let d = null;
    try { d = await get('/huzz-hunter/api/lobby'); } catch (e) { d = null; }
    if (!d || d.error) { srvBox.innerHTML = '<small class="mut">Could not load the lobby just now — hit Refresh.</small>'; return; }
    const you = d.you || {}, set = (id, v) => { const el = lob.querySelector('#' + id); if (el) el.textContent = v; };
    const av = lob.querySelector('#lobmeav'); if (av) av.innerHTML = lobAv(me, '');
    set('lobmename', you.dn || me); set('lobmehandle', '@' + (you.name || me));
    set('lobmestatus', you.status || (d.online && d.online.includes(me) ? 'online — messages open' : 'offline'));
    const joined = (d.servers || []).filter(s => s.joined);
    lobKey = (joined.find(s => s.mine) || joined[0] || {}).key || '';
    const link = lob.querySelector('#loblink');
    if (link && !link.value) link.placeholder = joined.length ? 'Copy my server link gives you a shareable link' : 'Join a server first — then your link appears here';
    set('lobsrvcnt', (d.servers || []).length + ' total');
    srvBox.innerHTML = (d.servers || []).map(s => `<div class="lobrow">
      <span class="lobico">${/^(data:|https?:|\/)/.test(s.icon || '') ? `<img src="${esc(s.icon)}" alt="">` : esc(s.icon || String(s.name).slice(0, 2).toUpperCase())}</span>
      <span class="lobwho"><b>${esc(s.name)}</b><small>${s.members} member${s.members === 1 ? '' : 's'}${s.owner ? ' · owner @' + esc(s.owner) : ''}${s.joined ? ' · you are in' : ' · invite only'}</small></span>
      <span class="lobacts">${s.joined
      ? `<button type="button" class="btn" data-open="${esc(s.key)}">Open</button><button type="button" class="btn alt" data-inv="${esc(s.key)}">Invite link</button>`
      : '<span class="lobtag">ask for an invite</span>'}</span></div>`).join('')
      || '<small class="mut">No servers yet — press + in the rail and make the first one.</small>';
    const mem = (d.members || []).slice().sort((a, b) => (b.on ? 1 : 0) - (a.on ? 1 : 0) || String(a.name).localeCompare(String(b.name)));
    set('lobmemcnt', mem.length + ' member' + (mem.length === 1 ? '' : 's'));
    const fr = window.hhFr || { is: () => false, out: () => false };
    memBox.innerHTML = mem.map(m => {
      const mine = String(m.name).toLowerCase() === String(me).toLowerCase();
      const label = fr.is(m.name) ? 'Friends' : fr.out(m.name) ? 'Requested' : 'Add friend';
      return `<div class="lobrow${m.on ? ' on' : ''}">
        <span class="lobav">${lobAv(m.name)}<i class="lobdot" title="${m.on ? 'online' : 'offline'}"></i></span>
        <span class="lobwho"><b>${esc(m.dn || m.name)}</b><small>@${esc(m.name)}${m.bot ? ' · bot' : m.on ? ' · online now' : ''}</small></span>
        <span class="lobacts">${mine
      ? '<button type="button" class="btn alt" data-prof="' + esc(m.name) + '">My profile</button>'
      : `<button type="button" class="btn" data-dm="${esc(m.name)}">Message</button><button type="button" class="btn alt" data-fr="${esc(m.name)}">${label}</button><button type="button" class="btn alt" data-prof="${esc(m.name)}">Profile</button>`}</span></div>`;
    }).join('') || '<small class="mut">Nobody else has joined yet.</small>';
  }
  window.hhLobbyLoad = loadLobby;
  function openLobby() {
    lob.hidden = false;
    lob.innerHTML = `<div class="lobbywrap">
      <div class="card">
        <div class="row" style="margin:0 0 10px"><h2 style="flex:1;margin:0">Lobby</h2><button type="button" class="x" data-lob="close" aria-label="Close">×</button></div>
        <div class="lobme"><span id="lobmeav"></span><div class="lobwho" style="flex:1;min-width:0"><b id="lobmename">${esc(lobDn(me))}</b><div class="phandle" id="lobmehandle">@${esc(me || '')}</div><small class="mut" id="lobmestatus"></small></div></div>
        <div class="row" style="margin-top:10px"><input class="in" id="loblink" readonly placeholder="Press “Copy my server link”" style="flex:1"><button type="button" class="btn" data-lob="invite">Copy my server link</button><button type="button" class="btn alt" data-lob="profile">My profile</button></div>
        <small class="mut">This card is yours — anyone in the member list below can press Message to DM you or Add friend, and you can send them a server link whenever you want.</small>
      </div>
      <div class="card"><div class="row" style="margin:0 0 8px"><b style="flex:1">All servers on this site</b><small class="mut" id="lobsrvcnt"></small><button type="button" class="btn alt" data-lob="reload">Refresh</button></div><div id="lobsrv"><small class="mut">Loading…</small></div></div>
      <div class="card"><div class="row" style="margin:0 0 8px"><b style="flex:1">Everyone here — full member list</b><small class="mut" id="lobmemcnt"></small></div><div id="lobmem"><small class="mut">Loading…</small></div></div>
      <div class="card"><b>Have an invite?</b>
        <div class="row" style="margin-top:8px"><input class="in" id="ivcode" placeholder="Invite code or link" style="flex:1"><button type="button" class="btn" id="ivgo">Join server</button></div>
        <small id="ivres"></small>
        <small class="mut" style="display:block;margin-top:8px">Press Invite link on any server above and hand that link out — opening it drops someone straight into the server.</small>
      </div>
    </div>`;
    const go = () => {
      const raw = lob.querySelector('#ivcode').value.trim();
      const m = raw.match(/invite=([a-z0-9]+)/i);
      joinInvite(m ? m[1] : raw);
    };
    lob.querySelector('#ivgo').onclick = go;
    lob.querySelector('#ivcode').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    lob.addEventListener('click', e => {
      const t = e.target.closest('[data-lob]');
      if (t) {
        const a = t.dataset.lob;
        if (a === 'close') return show('chat');
        if (a === 'reload') return loadLobby();
        if (a === 'profile') return window.hhOpenProfile ? window.hhOpenProfile(me) : null;
        if (a === 'invite') return lobInvite(lobKey);
        return;
      }
      const op = e.target.closest('[data-open]');
      if (op) {
        const k = op.dataset.open;
        if (!layout[k]) return (window.hhToast || alert)('You are not in that server yet — ask for its invite link.');
        srv = k; cur = layout[k].text[0]; show('chat'); renderChans(); renderMsgs(); renderRail();
        return;
      }
      const inv = e.target.closest('[data-inv]'); if (inv) return lobInvite(inv.dataset.inv);
      const dm = e.target.closest('[data-dm]');
      if (dm) { if (window.hhOpenDM) return window.hhOpenDM(dm.dataset.dm); if (window.hhAskFriend) return window.hhAskFriend(dm.dataset.dm); return; }
      const fq = e.target.closest('[data-fr]'); if (fq && window.hhAskFriend) return window.hhAskFriend(fq.dataset.fr);
      const pr = e.target.closest('[data-prof]'); if (pr && window.hhOpenProfile) return window.hhOpenProfile(pr.dataset.prof);
    });
    show('lobby');
    loadLobby();
  }
  async function joinInvite(code) {
    code = String(code || '').trim();
    const out = document.querySelector('#ivres');
    if (!code) { if (out) out.textContent = 'Paste an invite code first.'; return; }
    window.__ivDone = 1;
    const r = await api('/huzz-hunter/api/invite/join', { code });
    if (r.error) { window.__ivDone = 0; if (out) out.textContent = r.error; else (window.hhToast || alert)(r.error); return; }
    if (out) out.textContent = `Joined ${r.name} — loading it now...`;
    history.replaceState(null, '', location.pathname);
    setTimeout(() => location.reload(), 450);
  }

  /* ---- hook into the main connection ---- */
  const _connect = connect;
  connect = function () {
    _connect();
    es.addEventListener('init', e => {
      const d = JSON.parse(e.data); layout = d.layout || {}; stickers = d.stickers || {}; voice = d.voice || {}; window.hhLayout = layout;
      renderRail(); renderVP();
      if (!Object.keys(layout).length) { srv = ''; openLobby(); }
      else {
        if (!layout[srv]) srv = Object.keys(layout)[0];
        if (!layout[srv].text.includes(cur)) cur = layout[srv].text[0];
        renderChans();
        if (view === 'chat') renderMsgs();
      }
      const iv = new URLSearchParams(location.search).get('invite');
      if (iv && !window.__ivDone) joinInvite(iv);
    });
    es.addEventListener('layout', e => { layout = JSON.parse(e.data); window.hhLayout = layout; Object.values(layout).forEach(s => s.text.forEach(c => { chans[c] = chans[c] || []; })); renderRail(); renderChans(); if (!lob.hidden && window.hhLobbyLoad) window.hhLobbyLoad(); });
    // Someone made a server: tell everybody, and refresh the lobby list if it is open.
    es.addEventListener('newserver', e => {
      let d = {}; try { d = JSON.parse(e.data); } catch (err) { return; }
      const who = d.by && d.by !== me ? ' — by @' + d.by : '';
      (window.hhToast || alert)('New server: ' + (d.name || 'untitled') + who);
      if (!lob.hidden && window.hhLobbyLoad) window.hhLobbyLoad();
    });
    es.addEventListener('stickers', e => { stickers = JSON.parse(e.data); if (!pick.hidden) drawPick(); });
    es.addEventListener('live', () => renderChans());
    es.addEventListener('voice', e => {
      voice = JSON.parse(e.data);
      if (myVC) { const here = voice[myVC] || []; Object.keys(pcs).forEach(p => { if (!here.includes(p)) closePC(p); }); }
      renderChans();
    });
    es.addEventListener('signal', e => onSignal(JSON.parse(e.data)));
    es.addEventListener('vchat', e => {
      const { ch, m } = JSON.parse(e.data);
      if (ch === vch) { vmsgs.push(m); addVRow(m); }
      else { vunread[ch] = (vunread[ch] || 0) + 1; renderChans(); }
      if (vtts[ch] && (myVC === ch || vch === ch)) speakLine(m.name, m.text);
    });
    es.addEventListener('vtts', e => {
      const { ch, on } = JSON.parse(e.data);
      vtts[ch] = on;
      if (ch === vch) drawVChat();
    });
    es.addEventListener('react', e => {
      const d = JSON.parse(e.data), m = (chans[d.channel] || []).find(x => x.id === d.id); if (m) m.re = d.re;
      const el = document.querySelector(`.m[data-id="${d.id}"] .rx`); if (el) el.innerHTML = rxHtml(d.re);
    });
  };
  if (es) { es.close(); connect(); }

  /* ---- confetti when a study session is saved ---- */
  const boom = () => {
    for (let i = 0; i < 36; i++) {
      const s = document.createElement('span'); s.className = 'cf'; s.textContent = ['🎉', '✨', '🔥', '📚', '⭐'][i % 5];
      s.style.cssText = `left:${Math.random() * 100}vw;animation-delay:${Math.random() * 0.6}s`; document.body.append(s); setTimeout(() => s.remove(), 3000);
    }
  };
  const _stop = stopStudy;
  stopStudy = async function () { const had = !!live; await _stop(); if (had && $('#res').textContent.includes('+')) boom(); };
  $('#stop').onclick = stopStudy;
})();

/* ---- part 2: media upload, chat backgrounds, "studying now" (only for people whose Arena is unlocked) ---- */
(function () {
  const IMG = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'], VID = ['mp4', 'webm', 'mov'], AUD = ['mp3', 'ogg', 'wav', 'm4a'];
  let studyOpen = false;

  /* media upload: attach button, paste, drag and drop */
  const attHtml = a => {
    const u = `/huzz-hunter/uploads/${a.f}`, ext = (a.f.split('.')[1] || '').toLowerCase(), n = esc(a.n);
    if (IMG.includes(ext)) return `<a href="${u}" target="_blank" rel="noopener"><img class="med" src="${u}" alt="${n}" loading="lazy"></a>`;
    if (VID.includes(ext)) return `<video class="med" src="${u}" controls preload="metadata"></video>`;
    if (AUD.includes(ext)) return `<audio src="${u}" controls></audio>`;
    return `<a class="file" href="${u}" download="${n}">📎 ${n} <small>${(a.s / 1048576).toFixed(1)} MB</small></a>`;
  };
  const _am = addMsg;
  addMsg = function (m) {
    const box = $('#msgs'), stick = box.scrollHeight - box.scrollTop - box.clientHeight < 80 || m.name === me;
    _am(m);
    if (!m.att) return;
    const el = box.lastElementChild; el.querySelector('.b').insertAdjacentHTML('beforeend', attHtml(m.att));
    if (stick) {
      const go = () => { box.scrollTop = box.scrollHeight; }; go();
      el.querySelectorAll('img,video').forEach(x => { x.addEventListener('load', go); x.addEventListener('loadedmetadata', go); });
    }
  };
  async function upload(file) {
    const box = $('#box'), ph = box.placeholder, text = box.value.trim();
    box.placeholder = `Uploading ${file.name || 'file'}...`; box.value = '';
    try {
      const r = await fetch(`/huzz-hunter/api/upload?channel=${enc(cur)}&who=${enc(me)}&name=${enc(file.name || 'pasted.png')}&text=${enc(text)}&p=${enc(pass)}`, { method: 'POST', body: file, headers: { 'x-pass': pass } });
      if (!r.ok) throw 0;
    } catch { alert('Upload failed. The limit is 25 MB per file.'); box.value = text; }
    box.placeholder = ph;
  }
  const fi = document.createElement('input'); fi.type = 'file'; fi.multiple = true; fi.hidden = true; document.body.append(fi);
  fi.onchange = () => { [...fi.files].forEach(upload); fi.value = ''; };
  const ub = document.createElement('button'); ub.type = 'button'; ub.id = 'ub'; ub.textContent = '📎'; ub.title = 'Upload photo, video or file'; ub.onclick = () => fi.click(); $('#send').append(ub);
  $('#box').addEventListener('paste', e => { const f = [...e.clipboardData.files]; if (f.length) { e.preventDefault(); f.forEach(upload); } });
  const vc = $('#v-chat');
  vc.addEventListener('dragover', e => { e.preventDefault(); vc.classList.add('drag'); });
  vc.addEventListener('dragleave', e => { if (!vc.contains(e.relatedTarget)) vc.classList.remove('drag'); });
  vc.addEventListener('drop', e => { e.preventDefault(); vc.classList.remove('drag'); [...e.dataTransfer.files].forEach(upload); });

  /* chat background, per chat or for all chats, saved on this device */
  const bgKey = () => 'hcb_' + cur;
  /* A saved clip is stored as vid:<url>; a picture/GIF stays a CSS background. */
  const vidSrc = v => {
    if (!/^vid:/i.test(v || '')) return '';
    const s = String(v).slice(4).trim(), m = /^url\(\s*["']?([^"')]+)["']?\s*\)$/i.exec(s);
    return m ? m[1] : s; // older saves kept the css wrapper, so unwrap it here too
  };
  const vidExt = u => /\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(u || '');
  function applyBg() {
    const raw = localStorage[bgKey()] || localStorage.hcb_all || '', d = (localStorage.hcd || 35) / 100;
    const box = $('#msgs'), vc = $('#v-chat');
    // anyone can switch the background off on their own device; the saved picture stays put
    if (localStorage.hcboff === '1') {
      const old = vc.querySelector('.cbgv');
      if (old) old.remove();
      vc.classList.remove('hasvid');
      vc.style.removeProperty('--cbd');
      box.style.background = '';
      box.classList.remove('hasbg');
      return;
    }
    let v = vc.querySelector('.cbgv');
    const src = vidSrc(raw);
    if (src) {
      if (!v) {
        v = document.createElement('video');
        v.className = 'cbgv'; v.muted = true; v.loop = true; v.autoplay = true;
        v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
        v.addEventListener('error', () => { if (window.hhToast) window.hhToast('Ye clip load nahi hui — link check karo.'); });
        vc.prepend(v);
      }
      if (v.getAttribute('src') !== src) { v.src = src; v.play().catch(() => {}); }
      vc.classList.add('hasvid');
      vc.style.setProperty('--cbd', d);
      box.style.background = '';
    } else {
      if (v) v.remove();
      vc.classList.remove('hasvid');
      box.style.background = raw ? `linear-gradient(rgba(0,0,0,${d}),rgba(0,0,0,${d})), ${raw} center/cover` : '';
    }
    box.classList.toggle('hasbg', !!raw);
  }
  const _rm = renderMsgs;
  renderMsgs = function () { _rm(); applyBg(); };
  const shrink = (file, cb) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', 0.72));
    };
    img.src = URL.createObjectURL(file);
  };
  function bgModal() {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="card"><div class="row"><h2 style="flex:1;margin:0">Chat background</h2><button class="x" id="bx" aria-label="Close">×</button></div>
      <small>Sits behind the messages like a group chat theme. Saved on this device only.</small>
      <div class="row"><label><input type="checkbox" id="ball"> Use for all chats</label><label><input type="checkbox" id="boff"> Background off</label></div>
      <div class="row"><button class="btn" id="bu">Upload image / GIF</button><button class="btn alt" id="bv">Upload video</button><button class="btn alt" id="br">Remove</button></div>
      <div class="row"><input class="in" id="burl" placeholder="or paste a picture, GIF or mp4/webm link" style="flex:1"><button class="btn" id="bg">Use</button></div>
      <small>Darken, so the text stays readable</small><div class="row"><input type="range" id="bd" min="0" max="80" value="${localStorage.hcd || 35}" style="flex:1"></div></div>`;
    document.body.append(m);
    const set = v => { try { localStorage.hcboff = '0'; localStorage[m.querySelector('#ball').checked ? 'hcb_all' : bgKey()] = v; } catch { alert('That image is too big to save.'); } applyBg(); };
    const off = m.querySelector('#boff');
    off.checked = localStorage.hcboff === '1';
    off.onchange = () => { try { localStorage.hcboff = off.checked ? '1' : '0'; } catch (e) {} applyBg(); };
    m.onclick = e => { if (e.target === m || e.target.id === 'bx') m.remove(); };
    /* GIFs and clips do not fit in localStorage, so they go to /uploads and only the link is kept. */
    const saveFile = async file => {
      (window.hhToast || alert)('Uploading…');
      const res = await fetch('/huzz-hunter/api/chatbg', { method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream', 'x-token': localStorage.htk || '', 'x-pass': localStorage.hp || '' }, body: file }).catch(() => null);
      const r = res ? await res.json().catch(() => ({})) : {};
      if (!r || !r.url) return (window.hhToast || alert)((r && r.error) || (res ? 'Upload failed (' + res.status + ').' : 'Upload failed — server se connect nahi hua.'));
      // a clip is a plain url behind vid:, only pictures go inside url("…") — wrapping the clip
      // made the <video> src invalid, which is why uploads never played
      set(r.vid ? 'vid:' + r.url : `url("${r.url}")`);
      (window.hhToast || alert)(r.vid ? 'Clip laga diya.' : 'Background laga diya.');
    };
    m.querySelector('#bu').onclick = () => {
      const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
      f.onchange = () => { const fl = f.files[0]; if (!fl) return; if (/gif$/i.test(fl.type) || fl.size > 700000) saveFile(fl); else shrink(fl, d => set(`url("${d}")`)); };
      f.click();
    };
    m.querySelector('#bv').onclick = () => {
      const f = document.createElement('input'); f.type = 'file'; f.accept = 'video/mp4,video/webm,video/ogg';
      f.onchange = () => { const fl = f.files[0]; if (fl) saveFile(fl); };
      f.click();
    };
    m.querySelector('#bg').onclick = () => { const u = m.querySelector('#burl').value.trim().replace(/"/g, ''); if (u) set(vidExt(u) ? 'vid:' + u : `url("${u}")`); };
    m.querySelector('#br').onclick = () => { localStorage.removeItem(bgKey()); localStorage.removeItem('hcb_all'); m.querySelector('#boff').checked = false; applyBg(); };
    m.querySelector('#bd').oninput = e => { localStorage.hcd = e.target.value; applyBg(); };
  }
  $('#v-chat header').insertAdjacentHTML('beforeend', '<button class="x" id="cbg" title="Chat background" aria-label="Chat background" style="margin-left:auto">🖼</button>');
  $('#cbg').onclick = bgModal;

  /* "studying now": the server only sends this to people whose Arena is unlocked */
  renderOnline = function () { $('#on').innerHTML = online.map(n => `<div class="who">${esc(n)}</div>`).join(''); };
  const sn = document.createElement('div'); sn.id = 'sn'; sn.hidden = true;
  [...document.querySelectorAll('aside .sec')].find(s => s.textContent.trim() === 'Online').before(sn);
  function drawStudying() {
    const rows = Object.entries(liveMap || {}).filter(([, v]) => v && v.s);
    sn.hidden = false;
    sn.innerHTML = '<div class="sec"><span>Studying now</span></div>' + (!studyOpen
      ? '<small class="pad">🔒 Unlock the Arena to see who is studying.</small>'
      : rows.length
        ? rows.map(([n, v]) => `<div class="sr"><b>${esc(n)}</b><small>${esc(v.s)} · ${hm(Math.max(0, (v.acc || 0) + ((v.hold || Date.now() + skew) - v.t) / 1000))}${v.hold ? ' (paused)' : ''}</small></div>`).join('')
        : '<small class="pad">Nobody is studying right now.</small>');
  }
  setInterval(drawStudying, 20000);
  const attach = () => {
    es.addEventListener('init', e => { studyOpen = !!JSON.parse(e.data).open; drawStudying(); });
    es.addEventListener('unlock', e => { studyOpen = !!JSON.parse(e.data).open; drawStudying(); });
    es.addEventListener('live', drawStudying);
  };
  const _c2 = connect;
  connect = function () { _c2(); attach(); };
  if (es) attach();
})();

/* ---- part 3: replies, mentions and notifications, member list ---- */
(function () {
  let notes = [], seen = 0, lay = null, users = [], replyTo = null, mre = null;
  const rxe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentionRe = () => (mre = mre || new RegExp('@(?:everyone' + [...users].sort((a, b) => b.length - a.length).map(n => '|' + rxe(n)).join('') + ')(?![\\w])', 'gi'));
  const mentionsMe = m => m.name !== me && ((m.rp && m.rp.n === me) || /@everyone(?![\w])/i.test(m.text || '') || new RegExp('@' + rxe(me) + '(?![\\w])', 'i').test(m.text || ''));
  const beep = () => { try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = 0.08; o.start(); o.stop(a.currentTime + 0.15); } catch {} };
  const popup = n => { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(`${n.from} ${({ reply: 'replied to you', dm: 'sent you a message' }[n.type] || 'mentioned you')} in ${chName(n.channel)}`, { body: n.text }); };
  document.addEventListener('click', () => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }, { once: true });

  /* mentions get highlighted in message text (text only, never inside tags) */
  const _f3 = fmt;
  fmt = t => _f3(t).split(/(<[^>]*>)/).map((s, i) => (i % 2 ? s : s.replace(mentionRe(), '<span class="mn">$&</span>'))).join('');

  /* replies */
  const rbar = document.createElement('div'); rbar.id = 'rbar'; rbar.hidden = true; $('#send').prepend(rbar);
  function setReply(m) {
    replyTo = m ? { id: m.id, n: m.name, t: (m.text || (m.st ? 'sticker' : m.att ? 'attachment' : '')).slice(0, 80) } : null;
    rbar.hidden = !m;
    if (!m) return;
    rbar.innerHTML = `<span>Replying to <b>@${esc(m.name)}</b> ${esc(replyTo.t)}</span><button type="button" class="x" aria-label="Cancel reply">×</button>`;
    rbar.querySelector('button').onclick = () => setReply(null);
    $('#box').focus();
  }
  $('#send').onsubmit = e => {
    e.preventDefault(); const t = $('#box').value.trim(); if (!t) return;
    $('#box').value = ''; api('/huzz-hunter/api/send', { channel: cur, text: t, rp: replyTo }); setReply(null);
  };
  $('#box').addEventListener('keydown', e => { if (e.key === 'Escape') setReply(null); });
  const _am3 = addMsg;
  addMsg = function (m) {
    _am3(m);
    const el = $('#msgs').lastElementChild;
    if (m.rp) el.querySelector('.bw').insertAdjacentHTML('afterbegin', `<div class="rp" data-go="${esc(m.rp.id)}"><b>@${esc(m.rp.n)}</b> ${esc(m.rp.t || '')}</div>`);
    if (mentionsMe(m)) el.classList.add('hl');
    el.querySelector('.qr').insertAdjacentHTML('afterbegin', '<button class="rb" title="Reply" aria-label="Reply">↩</button>');
  };
  const _rm3 = renderMsgs;
  renderMsgs = function () { _rm3(); setReply(null); if (window.__hhMarkCh) window.__hhMarkCh(cur); };
  function jumpMsg(id) {
    const el = document.querySelector(`.m[data-id="${id}"]`); if (!el) return;
    el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500);
  }
  $('#msgs').addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) return jumpMsg(g.dataset.go);
    const rb = e.target.closest('.rb');
    if (rb) { const m = (chans[cur] || []).find(x => x.id === rb.closest('.m').dataset.id); if (m) setReply(m); }
  });

  /* Notifications live in the chat header as a bell: they are personal, not part of a server. */
  const nb = document.createElement('button');
  nb.id = 'bell'; nb.type = 'button'; nb.className = 'x'; nb.title = 'Notifications'; nb.setAttribute('aria-label', 'Notifications');
  { const hd = document.querySelector('#v-chat header'); if (hd) hd.append(nb); }
  /* A note counts once. Opening its channel in chat (not only the bell) marks it read, and the
     bell can be cleared in one go, so the badge never nags about something already seen. */
  const noteKey = n => n.id || n.ts + '|' + n.channel;
  const readSet = () => { try { return new Set(JSON.parse(localStorage.hread || '[]')); } catch (e) { return new Set(); } };
  let READN = readSet();
  const isNew = n => n.ts > seen && !READN.has(noteKey(n));
  const saveRead = () => { try { localStorage.hread = JSON.stringify([...READN].slice(-300)); } catch (e) {} };
  const markRead = list => {
    let ch = false;
    list.forEach(n => { const k = noteKey(n); if (!READN.has(k)) { READN.add(k); ch = true; } });
    if (ch) { saveRead(); drawNb(); }
    return ch;
  };
  const markChannelRead = chn => markRead(notes.filter(n => n.channel === chn));
  window.__hhMarkCh = chn => markChannelRead(chn);
  const markAllRead = () => { markRead(notes); seen = Date.now() + skew; drawNb(); api('/huzz-hunter/api/notes/read', {}); };
  const drawNb = () => { const c = notes.filter(isNew).length; nb.textContent = c ? '🔔' + c : '🔔'; nb.classList.toggle('hasn', c > 0); };
  function jumpTo(ch, mid) {
    const keys = Object.keys(lay || {}), idx = keys.findIndex(k => lay[k].text.includes(ch)), btns = [...document.querySelectorAll('#rail .srv:not(.dmb):not(.gear)')];
    if (idx >= 0 && idx !== btns.findIndex(b => b.classList.contains('on'))) btns[idx].click();
    cur = ch; unread[ch] = 0; show('chat'); renderMsgs(); markChannelRead(ch);
    setTimeout(() => jumpMsg(mid), 50);
  }
  nb.onclick = () => {
    const m = document.createElement('div'), rows = [...notes].reverse(); m.className = 'modal';
    m.innerHTML = `<div class="card"><div class="row"><h2 style="flex:1;margin:0">Notifications</h2>${rows.length ? '<button class="btn alt" id="nall" style="margin-right:6px">Mark all read</button>' : ''}<button class="x" id="nx" aria-label="Close">×</button></div>`
      + (rows.length ? rows.map(n => `<button class="nt${isNew(n) ? ' new' : ''}" data-ch="${esc(n.channel)}" data-mid="${esc(n.id)}"><span><b>${esc(n.from)}</b> ${({ reply: 'replied to you', dm: 'sent you a message' }[n.type] || 'mentioned you')} in <b>${esc(chName(n.channel))}</b></span><small>${new Date(n.ts).toLocaleString()}</small><span>${esc(n.text)}</span></button>`).join('') : '<p><small>Nothing yet. Mentions (@name) and replies show up here.</small></p>') + '</div>';
    document.body.append(m);
    m.onclick = e => {
      if (e.target === m || e.target.id === 'nx') return m.remove();
      if (e.target.id === 'nall') { markAllRead(); return m.remove(); }
      const b = e.target.closest('.nt'); if (b) { m.remove(); jumpTo(b.dataset.ch, b.dataset.mid); }
    };
    seen = Date.now() + skew; drawNb(); api('/huzz-hunter/api/notes/read', {});
  };

  /* member list on the right (the old Online list in the sidebar is hidden) */
  [...document.querySelectorAll('aside .sec')].find(s => s.textContent.trim() === 'Online').hidden = true; $('#on').hidden = true;
  const ml = document.createElement('div'); ml.id = 'ml'; ml.hidden = localStorage.hml === '0'; document.body.append(ml);
  function drawML() {
    const on = new Set(online), list = [...users].sort((a, b) => a.localeCompare(b)), o = list.filter(n => on.has(n)), f = list.filter(n => !on.has(n));
    const row = (n, off) => `<button class="mr${off ? ' off' : ''}" data-m="${esc(n)}"><span class="av sm" style="background:${col(n)}">${esc(n[0].toUpperCase())}</span>${esc(n)}</button>`;
    ml.innerHTML = `<div class="sec"><span>Online — ${o.length}</span></div>${o.map(n => row(n)).join('')}<div class="sec"><span>Offline — ${f.length}</span></div>${f.map(n => row(n, 1)).join('')}`;
  }
  ml.onclick = e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    const box = $('#box'); box.value += (box.value && !box.value.endsWith(' ') ? ' ' : '') + '@' + b.dataset.m + ' ';
    if (view !== 'chat') show('chat'); box.focus();
  };
  $('#cbg').insertAdjacentHTML('afterend', '<button class="x" id="mlb" title="Members" aria-label="Toggle member list">👥</button>');
  $('#mlb').onclick = () => { ml.hidden = !ml.hidden; localStorage.hml = ml.hidden ? '0' : '1'; };

  /* wire up to the live connection */
  const attach = () => {
    es.addEventListener('init', e => {
      const d = JSON.parse(e.data); notes = d.notes || []; seen = d.seen || 0; users = d.users || []; lay = d.layout; mre = null;
      drawNb(); drawML(); if (view === 'chat') renderMsgs();
    });
    es.addEventListener('layout', e => { lay = JSON.parse(e.data); });
    es.addEventListener('wall', e => { try { const w = JSON.parse(e.data); window.hhWallApply && window.hhWallApply(w); } catch (x) {} });
    es.addEventListener('users', e => { users = JSON.parse(e.data); mre = null; drawML(); });
    es.addEventListener('online', drawML);
    es.addEventListener('note', e => {
      const n = JSON.parse(e.data); notes.push(n); drawNb();
      if (document.hidden || cur !== n.channel || view !== 'chat') { beep(); popup(n); }
    });
  };
  const _c3 = connect;
  connect = function () { _c3(); attach(); };
  if (es) attach();
})();

/* ---- part 4: accounts (name + PIN), direct messages, edit/delete, typing ---- */
(function () {
  let token = localStorage.htk || '', users = [], typers = {};

  /* every request and the live connection carry the login token */
  const F = window.fetch.bind(window);
  window.fetch = (u, o = {}) => {
    if (typeof u === 'string' && u.startsWith('/huzz-hunter/api/') && !u.startsWith('/huzz-hunter/api/auth')) o.headers = { ...(o.headers || {}), 'x-token': token };
    return F(u, o);
  };
  const ES = window.EventSource;
  window.EventSource = function (url, o) { return new ES(url + '&t=' + encodeURIComponent(token), o); };
  window.EventSource.prototype = ES.prototype;

  /* sign in or create an account */
  const pin = document.createElement('input'); pin.id = 'pin'; pin.type = 'password'; pin.placeholder = 'PIN (4+ characters)'; pin.autocomplete = 'current-password'; pin.required = true; pin.minLength = 4;
  $('#name').after(pin);
  $('#pass').hidden = true;
  $('#login h2').insertAdjacentHTML('afterend', '<small>New name? Pick a PIN and your account is created. Already have one? Use its PIN.</small>');
  $('#login').onsubmit = async e => {
    e.preventDefault();
    const p = $('#pass').value;
    const r = await F('/huzz-hunter/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-pass': p }, body: JSON.stringify({ name: $('#name').value.trim(), pin: pin.value }) }).then(x => x.json());
    if (r.error) { $('#err').textContent = r.error; if (/server password/i.test(r.error)) $('#pass').hidden = false; return; }
    me = r.name; pass = p; token = r.token; localStorage.hn = me; localStorage.hp = p; localStorage.htk = token;
    $('#err').textContent = ''; pin.value = '';
    const gate = $('#gate'), boot = $('#boot');
    if (gate) gate.hidden = true;
    if (boot) boot.hidden = false;
    connect();
    window.dispatchEvent(new Event('hh:login'));
  };
  const lo = document.createElement('button'); lo.id = 'lo'; lo.className = 'ch'; lo.textContent = 'Sign out';
  lo.onclick = () => { localStorage.removeItem('htk'); location.reload(); }; $('#me').after(lo);

  /* direct messages: a DM is a private channel named dm:<name>|<name> */
  const dmName = k => { const o = k.slice(3).split('|').find(x => x !== me.toLowerCase()) || me.toLowerCase(); return users.find(u => u.toLowerCase() === o) || o; };
  window.chName = c => (c.startsWith('dm:') ? 'your DMs' : '#' + c);
  /* ---- friends: DMs are friends-only, so nothing gets through until both sides accept ---- */
  let FR = { friends: [], incoming: [], outgoing: [] };
  const eqn = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  const isFr = n => (FR.friends || []).some(f => eqn(f, n));
  const inFr = n => (FR.incoming || []).some(f => eqn(f, n));
  const outFr = n => (FR.outgoing || []).some(f => eqn(f, n));
  window.hhFr = { is: isFr, in: inFr, out: outFr, all: () => FR };
  window.hhSetFr = s => { FR = s && Array.isArray(s.friends) ? s : FR; renderDMs(); if (document.querySelector('.modal.dmp')) window.openDMsPanel(); };
  const avSm = n => (window.hhAv ? window.hhAv(n, 'sm') : `<span class="av sm" style="background:${col(n)}">${esc((n[0] || '?').toUpperCase())}</span>`);
  async function loadFr() {
    try { const r = await get('/huzz-hunter/api/friends?user=' + enc(me)); if (r && Array.isArray(r.friends)) window.hhSetFr(r); } catch (e) {}
  }
  window.hhRefreshFriends = loadFr;
  const hhToast = window.hhToast = msg => {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.append(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(window.__tt); window.__tt = setTimeout(() => t.classList.remove('on'), 3400);
  };

  /* DMs are not a server: the rail button carries the unread count and opens the list. */
  function renderDMs() {
    const el = document.getElementById('dmhome');
    const keys = Object.keys(chans).filter(k => k.startsWith('dm:'));
    const n = keys.reduce((s, k) => s + (unread[k] || 0), 0) + (FR.incoming || []).length;
    if (!el) return;
    el.innerHTML = '💬' + (n ? `<i class="dmn">${n > 99 ? '99+' : n}</i>` : '');
    el.classList.toggle('on', view === 'chat' && cur.startsWith('dm:'));
  }
  /* the DM popup is gone - every entry point opens the full DM page instead */
  window.openDMsPanel = () => { if (window.hhOpenMessages) window.hhOpenMessages(); };
  const _rc = renderChans;
  renderChans = function () { _rc(); renderDMs(); };
  async function askFriend(n) {
    if (inFr(n)) { const r = await api('/huzz-hunter/api/friends/ok', { user: n }); if (r.error) return hhToast(r.error); await loadFr(); return openDM(n); }
    if (outFr(n)) return hhToast('Your friend request to ' + n + ' is still waiting for them to accept.');
    const r = await api('/huzz-hunter/api/friends/req', { user: n });
    hhToast(r.error || 'Friend request sent to ' + n + ' — DMs open when they accept.');
    loadFr();
  }
  window.hhAskFriend = askFriend;
  function openDM(n) {
    if (!isFr(n)) return askFriend(n);
    const k = 'dm:' + [me.toLowerCase(), n.toLowerCase()].sort().join('|');
    chans[k] = chans[k] || []; cur = k; unread[k] = 0; show('chat'); renderMsgs(); $('#box').focus();
  }
  const _rm4 = renderMsgs;
  renderMsgs = function () {
    _rm4();
    const dm = String(cur || '').startsWith('dm:');
    $('#title').textContent = dm ? dmName(cur) : cur; document.querySelector('#v-chat header span').textContent = dm ? '@' : '#';
    // a DM is not inside a server: hide the server name and its channel list while it is open
    document.body.classList.toggle('dmview', dm);
    typers = {}; drawTyping();
  };

  /* member menu: mention or message */
  const ml = document.getElementById('ml'), pm = document.createElement('div'); pm.id = 'pm'; pm.hidden = true; document.body.append(pm);
  ml.onclick = e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    const n = b.dataset.m, r = b.getBoundingClientRect();
    pm.innerHTML = `<button data-a="mention">@ Mention</button>${n === me ? '' : '<button data-a="dm">💬 Message</button>'}`;
    pm.dataset.n = n; pm.style.top = r.top + 'px'; pm.style.right = (innerWidth - r.left + 6) + 'px'; pm.hidden = false; e.stopPropagation();
  };
  pm.onclick = e => {
    const a = e.target.dataset.a, n = pm.dataset.n; pm.hidden = true;
    if (a === 'dm') openDM(n);
    if (a === 'mention') { const box = $('#box'); box.value += (box.value && !box.value.endsWith(' ') ? ' ' : '') + '@' + n + ' '; if (view !== 'chat') show('chat'); box.focus(); }
  };
  document.addEventListener('click', () => { pm.hidden = true; });

  /* edit and delete your own messages */
  const _am4 = addMsg;
  addMsg = function (m) {
    _am4(m);
    const el = $('#msgs').lastElementChild;
    if (m.edited) el.querySelector('.b').insertAdjacentHTML('beforeend', ' <small class="ed">(edited)</small>');
    if (m.name === me) el.querySelector('.qr').insertAdjacentHTML('beforeend', '<button class="ebn" title="Edit" aria-label="Edit">✏️</button><button class="dbn" title="Delete" aria-label="Delete">🗑</button>');
  };
  $('#msgs').addEventListener('click', e => {
    const b = e.target.closest('.ebn, .dbn'); if (!b) return;
    const id = b.closest('.m').dataset.id, m = (chans[cur] || []).find(x => x.id === id); if (!m) return;
    if (b.classList.contains('dbn')) { if (confirm('Delete this message?')) api('/huzz-hunter/api/edit', { channel: cur, id, del: true }); return; }
    const t = prompt('Edit message', m.text || ''); if (t && t.trim()) api('/huzz-hunter/api/edit', { channel: cur, id, text: t });
  });

  /* typing indicator */
  const tb = document.createElement('div'); tb.id = 'tb'; $('#send').before(tb);
  function drawTyping() {
    const n = Object.keys(typers);
    tb.textContent = !n.length ? '' : n.length === 1 ? `${n[0]} is typing...` : n.length === 2 ? `${n[0]} and ${n[1]} are typing...` : 'Several people are typing...';
  }
  let lastT = 0;
  $('#box').addEventListener('input', () => { if ($('#box').value && Date.now() - lastT > 3000) { lastT = Date.now(); api('/huzz-hunter/api/typing', { channel: cur }); } });

  /* live connection hooks */
  const _c4 = connect;
  connect = function () {
    _c4();
    /* The browser closes the stream while the page navigates away, which lands here too.
       Show the gate, but never drop the token on that: it logged people out on every refresh. */
    es.onerror = () => {
      if (es.readyState !== 2) return;
      if (window.hhAuthed) { setTimeout(() => { if (!es || es.readyState === 2) window.hhReconnect && window.hhReconnect(); }, 1500); return; }
      if (window.hhAuthFailed) window.hhAuthFailed('Please sign in again.');
    };
    es.addEventListener('init', e => { users = JSON.parse(e.data).users || []; renderDMs(); });
    es.addEventListener('users', e => { users = JSON.parse(e.data); renderDMs(); });
    es.addEventListener('friends', e => { if (window.hhSetFr) window.hhSetFr(JSON.parse(e.data)); });
    loadFr();
    es.addEventListener('typing', e => {
      const d = JSON.parse(e.data); if (d.channel !== cur || d.name === me) return;
      clearTimeout(typers[d.name]); typers[d.name] = setTimeout(() => { delete typers[d.name]; drawTyping(); }, 4000); drawTyping();
    });
    es.addEventListener('edit', e => {
      const d = JSON.parse(e.data), m = (chans[d.channel] || []).find(x => x.id === d.id); if (!m) return;
      m.text = d.text; m.edited = true;
      if (d.channel !== cur || view !== 'chat') return;
      if (m.st || m.att) return renderMsgs();
      const b = document.querySelector(`.m[data-id="${d.id}"] .b`); if (b) b.innerHTML = fmt(d.text) + ' <small class="ed">(edited)</small>';
    });
    es.addEventListener('del', e => {
      const d = JSON.parse(e.data); chans[d.channel] = (chans[d.channel] || []).filter(x => x.id !== d.id);
      if (d.channel === cur && view === 'chat') { const el = document.querySelector(`.m[data-id="${d.id}"]`); if (el) el.remove(); }
    });
  };

  /* boot: use the saved login, or show the sign-in screen */
  $('#err').textContent = '';
  if (es) es.close();
  if (token && me) connect(); else $('#gate').hidden = false;
})();

/* ---- part 5: profiles — avatar, banner, pronouns, custom status, bio, rank and study stats ---- */
(function () {
  const BAN = {
    plum: 'linear-gradient(135deg,#3a1c71,#8e2de2)',
    ocean: 'linear-gradient(135deg,#0b3d91,#00c6ff)',
    ember: 'linear-gradient(135deg,#ff512f,#f5b84b)',
    mint: 'linear-gradient(135deg,#11998e,#38ef7d)',
    rose: 'linear-gradient(135deg,#ff9ec4,#a18cd1)',
    mono: 'linear-gradient(135deg,#2a2548,#4a4570)',
    sunset: 'linear-gradient(135deg,#ff5f6d,#ffc371)',
    galaxy: 'linear-gradient(135deg,#0f0c29,#302b63 50%,#24243e)',
    cyber: 'linear-gradient(135deg,#00f5a0,#00d9f5 50%,#9b5cff)',
    gold: 'linear-gradient(135deg,#c98a1b,#fff1a8 50%,#f5b84b)',
    sakura: 'linear-gradient(135deg,#ffd1dc,#ff9ec4 50%,#c3a6ff)',
    toxic: 'linear-gradient(135deg,#0f2027,#2c5364 40%,#a8ff3e)',
    foxfire: 'linear-gradient(135deg,#1a0b00,#ff3d00 55%,#ffd166)',
    cursed: 'linear-gradient(135deg,#12000a,#ff1f4b 60%,#7b0f2b)',
    neoncity: 'linear-gradient(135deg,#0a0220,#7c4dff 45%,#00f5ff)',
    arena: 'linear-gradient(135deg,#08122b,#ff2b4f 55%,#00d0ff)',
    blossom: 'linear-gradient(135deg,#2a2438,#ff9ec4 55%,#8ec5ff)'
  };
  let PPL = {}, NP = {};
  window.hhNP = () => NP;
  /* the DM panel needs every known person, not just the ones connected right now */
  window.hhPeople = () => PPL;
  const dnOf = n => (PPL[n] || {}).dn || n;
  const avOf = n => (PPL[n] || {}).av || '';
  const DECO = { neon: 'Neon', fire: 'Fire', aurora: 'Aurora', rainbow: 'Rainbow', sakura: 'Sakura', glitch: 'Glitch', halo: 'Halo', electric: 'Electric', pulse: 'Pulse', gold: 'Gold', void: 'Void', ice: 'Ice', fox: 'Fox spirit', cursed: 'Cursed', mecha: 'Mecha', rgb: 'RGB', blade: 'Blade' };
  const NFXL = { rainbow: 'Rainbow', gradient: 'Gradient', glow: 'Glow', neon: 'Neon', shimmer: 'Shimmer', fire: 'Fire', glitch: 'Glitch', wave: 'Wave', arcade: 'Arcade', hologram: 'Hologram', blood: 'Blood', outline: 'Outline', chrome: 'Chrome' };
  const BFXL = { aurora: 'Aurora', flow: 'Flow', stars: 'Stars', rain: 'Rain', shimmer: 'Shimmer', waves: 'Waves', embers: 'Embers', scan: 'CRT scan', lightning: 'Lightning', hex: 'Hex grid', vhs: 'VHS', sparks: 'Slash sparks' };
  const PFXL = { sparkles: 'Sparkles', snow: 'Snow', hearts: 'Hearts', fireflies: 'Fireflies', embers: 'Embers', matrix: 'Matrix', stars: 'Shooting stars', petals: 'Petals', foxfire: 'Fox fire', slashes: 'Slashes', pixels: 'Bits', cyber: 'Data stream' };
  const PACK_IDS = ['kitsune', 'cursedking', 'neonrunner', 'ranked', 'sakurablade', 'sukunaedit'];
  const pkCls = v => (PACK_IDS.includes(v) ? ' pk-' + v : '');
  const hex6 = v => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : '');
  /* AMV edit backdrop: a real edit clip (YouTube link or an .mp4/.webm URL) plays over the
     card at low opacity, sound optional, and it never covers the banner or the avatar. */
  const ytId = v => { const m = String(v || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/); return m ? m[1] : ''; };
  const amvOk = v => { const s = String(v || '').trim(); return /^https?:\/\/[^\s"'<>]{4,300}$/i.test(s) || /^\/huzz-hunter\/uploads\/[a-f0-9]{24}\.(mp4|webm)$/i.test(s); };
  const amvPct = v => Math.min(70, Math.max(10, Math.round(+v || 35)));
  const amvLayer = (v, pct, z, fit, x, y) => {
    if (!amvOk(v)) return '';
    const u = String(v).trim(), id = ytId(u), o = (amvPct(pct) / 100).toFixed(2);
    const st = `--amo:${o};--amvz:${(Math.min(300, Math.max(100, Math.round(+z || 100))) / 100).toFixed(2)};--amvfit:${artFit(fit)};--artx:${artPos(x)}%;--arty:${artPos(y)}%`;
    const snd = '<button type="button" class="amvsnd" data-snd="1" aria-label="Sound on or off" title="Sound on / off">🔇</button>';
    return id
      ? `<div class="amv yt" style="${st}"><iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&iv_load_policy=3&disablekb=1&fs=0" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" tabindex="-1" title="AMV backdrop"></iframe></div>${snd}`
      : `<div class="amv" style="${st}"><video src="${esc(u)}" autoplay loop muted playsinline preload="auto"></video></div>${snd}`;
  };
  function mountAmv(root) {
    const box = root.querySelector('.amv'); if (!box) return;
    const v = box.querySelector('video'), f = box.querySelector('iframe'), b = root.querySelector('.amvsnd');
    let loud = false;
    const mark = () => { if (b) { b.textContent = loud ? '🔊' : '🔇'; b.classList.toggle('on', loud); } };
    const yt = cmd => { try { f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*'); } catch { /* not loaded yet */ } };
    if (b) b.onclick = e => {
      e.stopPropagation(); e.preventDefault();
      loud = !loud;
      if (v) { v.muted = !loud; if (loud) v.play().catch(() => {}); }
      else if (f) { yt(loud ? 'unMute' : 'mute'); yt('playVideo'); }
      mark();
    };
    /* the modal was opened by a click, so most browsers let the sound start straight away */
    if (v) { v.muted = false; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); loud = !v.muted; mark(); }
    else if (f) setTimeout(() => { yt('unMute'); yt('playVideo'); loud = true; mark(); }, 1200);
  }
  /* a display name with an optional animated style (rainbow, neon, glitch, wave...) */
  const nameHtml = (txt, nfx, a, b) => {
    const s = String(txt || '');
    if (!NFXL[nfx]) return esc(s);
    const st = (hex6(a) ? `--na:${a};` : '') + (hex6(b) ? `--nb:${b};` : '');
    const inner = nfx === 'wave' ? [...s].map((ch, i) => `<i style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</i>`).join('') : esc(s);
    return `<span class="nm nfx-${nfx}" data-t="${esc(s)}" style="${st}">${inner}</span>`;
  };
  window.hhAv = (n, cls) => avHtml(n, cls);
  const decoOf = n => { const d = (PPL[n] || {}).deco; return DECO[d] ? ' dc dc-' + d : ''; };
  const avHtml = (n, cls = '') => {
    const src = mediaUrl(avOf(n));
    return src
      ? `<span class="av ${cls} avi${decoOf(n)}"><img src="${src}" alt=""></span>`
      : `<span class="av ${cls}${decoOf(n)}" style="background:${col(n)}">${esc((n[0] || '?').toUpperCase())}</span>`;
  };
  /* Little avatar accessories. Our own chibi drawings, so nothing is fetched from elsewhere,
     and people can also drop their own transparent PNG in. */
  const ACC_SVG = {
    katana: '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="hhkg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#cfefff"/><stop offset="1" stop-color="#6fd3ff"/></linearGradient></defs><g transform="rotate(-42 16 16)"><path d="M14.4 2.4c1.9-.9 3.4-.2 3.4 1.5v15.4h-3.4V2.4Z" fill="url(#hhkg)" stroke="#2b3a4a" stroke-width=".7" stroke-linejoin="round"/><rect x="10.6" y="19.3" width="10.8" height="2.9" rx="1.45" fill="#f5b84b" stroke="#8a5a12" stroke-width=".6"/><rect x="14.5" y="22.2" width="3" height="7.6" rx="1.5" fill="#211d33" stroke="#4a4266" stroke-width=".6"/></g></svg>',
  };
  /* The chibi accessories are real sticker art we ship in assets/ (transparent PNGs). */
  const ACC_IMG = { zoro: '/huzz-hunter/assets/chibi-zoro.png', zerotwo: '/huzz-hunter/assets/chibi-zerotwo.png' };
  const accSrc = v => ACC_IMG[v] || (/^\/huzz-hunter\/(uploads|assets)\//.test(v || '') ? v : '');
  const badgeOne = k => ACC_IMG[k] ? `<img class="accimg" src="${ACC_IMG[k]}" alt="">` : (ACC_SVG[k] || '');
  /* A profile can carry a whole set of badges. The card never shows them all at once: it
     plays them one after another, so a big collection still leaves the profile clean. */
  const badgeList = p => {
    const out = [];
    const add = v => {
      const s = String(v || '');
      if (!s) return;
      const h = /^(data:image\/|blob:)/.test(s) ? `<img src="${esc(s)}" alt="">` : ACC_IMG[s] || ACC_SVG[s] ? badgeOne(s) : accSrc(s) ? `<img src="${esc(s)}" alt="">` : '';
      if (h && !out.includes(h)) out.push(h);
    };
    (Array.isArray(p.pchl) ? p.pchl : []).forEach(add);
    if (!out.length && p.pch) add(p.pch === 'png' ? p.pchv || '' : p.pch);
    return out.slice(0, 8);
  };
  const badgeHtml = p => badgeList(p)[0] || '';
  /* Take turns while the card is open: the current badge dives into the picture and the next
     swings in from the right. Stops by itself once the card leaves the page. */
  const mountBadges = (el, p) => {
    const box = el.querySelector('.pchar.has');
    if (box) { clearInterval(box.__rot); box.__rot = 0; }
    if (!box) return;
    const list = badgeList(p);
    if (list.length < 2) return;
    // the CSS turns this into a plain fade for people who ask for less motion
    const outMs = 470, inMs = 720;
    let i = 0, busy = false;
    // the first badge swings in too, so opening the card already shows what the set does
    const first = box.querySelector('.pchi');
    if (first) { first.classList.add('spinin'); setTimeout(() => first.classList.remove('spinin'), 760); }
    box.__rot = setInterval(() => {
      if (!document.body.contains(box)) return clearInterval(box.__rot);
      const inner = box.querySelector('.pchi'); if (!inner || busy) return;
      busy = true;
      inner.classList.remove('spinin');
      inner.classList.add('spinout');
      const av = box.parentElement && box.parentElement.querySelector('.pav');
      setTimeout(() => {
        if (!document.body.contains(box)) { busy = false; return clearInterval(box.__rot); }
        i = (i + 1) % list.length;
        inner.innerHTML = list[i];
        inner.classList.remove('spinout');
        void inner.offsetWidth;
        inner.classList.add('spinin');
        if (av) { av.classList.remove('hit'); void av.offsetWidth; av.classList.add('hit'); }
        setTimeout(() => { inner.classList.remove('spinin'); busy = false; }, inMs);
      }, outMs);
    }, 2600);
  };
  /* Uploaded pictures are written as /huzz-hunter/uploads/…, but a few old profiles kept a
     relative "uploads/…" path. With the page open at /huzz-hunter (no trailing slash) that
     resolved to /uploads/… and every avatar, banner and backdrop broke on the phone. */
  const mediaUrl = v => {
    if (typeof v !== 'string' || !v) return '';
    if (v.startsWith('data:') || v.startsWith('blob:') || v.startsWith('/') || /^https?:/i.test(v)) return v;
    if (/^(uploads|avatars|media)\//.test(v)) return '/huzz-hunter/' + v;
    if (/^huzz-hunter\//.test(v)) return '/' + v;
    return v;
  };
  const isMedia = v => { const u = mediaUrl(v); return typeof u === 'string' && (u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('/huzz-hunter/uploads/')); };
  // Single quotes: this string ends up inside a style="..." attribute, and inner double
  // quotes used to cut the attribute short, so the banner silently rendered as url("").
  const bg = v => BAN[v] ? `background:${BAN[v]}` : isMedia(v) ? `background:#14121f url('${mediaUrl(v)}') center/cover` : `background:${BAN.plum}`;
  /* backdrop fit + zoom chosen in the editor (cover / contain / fill, optional 16:9 band) */
  const artFit = v => (v === 'contain' || v === 'fill' ? v : 'cover');
  const artZoom = v => (Math.min(300, Math.max(100, Math.round(+v || 100))) / 100).toFixed(2);
  // backdrop framing: where the picture sits inside the card, 0-100% on each axis
  const artPos = v => Math.min(100, Math.max(0, Math.round(+v || 0))) || 50;
  const artVars = p => `--artz:${artZoom(p.artz)};--artx:${artPos(p.artx)}%;--arty:${artPos(p.arty)}%`;
  const warmSeen = new Set();
  /* A picture that fails once (a moved upload, a flaky phone connection) retries with a fresh
     URL instead of leaving Chrome's broken-image icon on the card. */
  document.addEventListener('error', e => {
    const im = e.target;
    if (!im || im.tagName !== 'IMG' || im.dataset.rt) return;
    const src = im.getAttribute('src') || '';
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
    im.dataset.rt = '1';
    im.src = src + (src.includes('?') ? '&' : '?') + 'r=' + Date.now();
  }, true);
  /* fetch a backdrop as soon as we know its address, so the card paints from cache */
  const warmArt = url => {
    if (!isMedia(url) || warmSeen.has(url)) return;
    warmSeen.add(url);
    const i = new Image(); i.decoding = 'async'; i.src = url;
  };
  /* Backdrops used to start downloading only after a profile was fetched, so the card showed up
     with an empty picture and filled in a moment later. The member payload now carries each
     backdrop address, so warm them in the background while the page is idle. */
  const warmPeople = () => {
    let urls = Object.keys(PPL || {}).map(n => (PPL[n] || {}).art).filter(Boolean);
    if (!urls.length || (navigator.connection && navigator.connection.saveData)) return;
    const go = () => urls.slice(0, 60).forEach((u, i) => setTimeout(() => warmArt(u), i * 120));
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 1800 }); else setTimeout(go, 500);
  };
  /* profile payloads are reused for a minute, and a hover fetches them early, so a click
     opens the card with everything already in hand instead of waiting on a round trip */
  const PCACHE = new Map();
  const fetchProf = async name => {
    const k = String(name || '').toLowerCase(), hit = PCACHE.get(k);
    if (hit && Date.now() - hit.t < 90000) return hit.p;
    const p = await get('/huzz-hunter/api/profile?user=' + enc(name));
    if (p && p.name) { PCACHE.set(k, { t: Date.now(), p }); warmArt(p.art); }
    return p;
  };
  const preProf = name => {
    const k = String(name || '').toLowerCase(), hit = PCACHE.get(k);
    if (hit && Date.now() - hit.t < 90000) return;
    fetchProf(name).catch(() => {});
  };

  /* ---- profile effects: a light canvas overlay that stops by itself once its card is closed ---- */
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const spark = (c, x, y, r) => { c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill(); };
  const glowDot = (c, x, y, r, rgb, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); };
  const kana = () => String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96));
  const FX = {
    sparkles: {
      n: () => 24,
      make: (R, W, H, init) => { const l = R(1.5, 4); return { x: R(0, W), y: R(0, H), r: R(3, 8), l, a: init ? R(0, l) : 0 }; },
      step(p, dt, W, H, c) { p.a += dt; const k = Math.max(0, Math.sin(Math.PI * p.a / p.l)); c.fillStyle = `rgba(255,236,150,${k.toFixed(3)})`; spark(c, p.x, p.y, p.r * (0.6 + k * 0.5)); return p.a < p.l; }
    },
    snow: {
      n: W => Math.round(W / 8),
      make: (R, W, H, init) => ({ x: R(0, W), y: init ? R(-6, H) : -6, r: R(1.2, 3.2), v: R(22, 60), s: R(0, 6.28), w: R(8, 22) }),
      step(p, dt, W, H, c) { p.y += p.v * dt; p.s += dt; p.x += Math.sin(p.s) * p.w * dt; c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.2832); c.fill(); return p.y < H + 6; }
    },
    hearts: {
      n: () => 14,
      make: (R, W, H, init) => ({ x: R(0, W), y: init ? R(0, H) : H + 14, v: R(24, 54), s: R(0, 6.28), w: R(6, 16), f: R(11, 20), e: ['💖', '💗', '💕', '❤️'][Math.floor(R(0, 4))] }),
      step(p, dt, W, H, c) { p.y -= p.v * dt; p.s += dt * 1.5; p.x += Math.sin(p.s) * p.w * dt; c.globalAlpha = Math.max(0, Math.min(1, p.y / (H * 0.45))); c.font = p.f + 'px serif'; c.fillText(p.e, p.x, p.y); c.globalAlpha = 1; return p.y > -20; }
    },
    fireflies: {
      n: () => 16,
      make: (R, W, H) => ({ x: R(0, W), y: R(0, H), vx: R(-12, 12), vy: R(-12, 12), ph: R(0, 6.28), r: R(5, 10) }),
      step(p, dt, W, H, c) { p.vx = Math.max(-18, Math.min(18, p.vx + (Math.random() - 0.5) * 40 * dt)); p.vy = Math.max(-18, Math.min(18, p.vy + (Math.random() - 0.5) * 40 * dt)); p.x = (p.x + p.vx * dt + W) % W; p.y = (p.y + p.vy * dt + H) % H; p.ph += dt * 2; glowDot(c, p.x, p.y, p.r, '190,255,120', (0.25 + 0.55 * Math.max(0, Math.sin(p.ph))).toFixed(3)); return true; }
    },
    embers: {
      n: W => Math.round(W / 14),
      make: (R, W, H, init) => ({ x: R(0, W), y: init ? R(0, H) : H + 4, v: R(30, 85), s: R(0, 6.28), w: R(5, 14), r: R(2, 5), g: Math.floor(R(100, 190)), l: R(1.5, 4), a: init ? R(0, 2) : 0 }),
      step(p, dt, W, H, c) { p.y -= p.v * dt; p.s += dt * 2; p.x += Math.sin(p.s) * p.w * dt; p.a += dt; const k = Math.max(0, 1 - p.a / p.l); glowDot(c, p.x, p.y, p.r * 2.2, '255,' + p.g + ',60', (k * 0.9).toFixed(3)); return k > 0 && p.y > -10; }
    },
    matrix: {
      n: W => Math.ceil(W / 16),
      make: (R, W, H, init, i) => ({ x: i * 16 + 4, y: init ? R(-H, H) : R(-80, 0), v: R(70, 160), len: Math.floor(R(5, 13)), ch: Array.from({ length: 14 }, kana) }),
      step(p, dt, W, H, c) { p.y += p.v * dt; if (Math.random() < 0.08) p.ch[Math.floor(Math.random() * p.ch.length)] = kana(); c.font = '13px monospace'; for (let j = 0; j < p.len; j++) { c.fillStyle = `rgba(${j === 0 ? '210,255,220' : '60,255,120'},${((1 - j / p.len) * 0.7).toFixed(3)})`; c.fillText(p.ch[j % p.ch.length], p.x, p.y - j * 14); } return p.y - p.len * 14 < H; }
    },
    stars: {
      n: () => 5,
      make: (R, W, H, init) => ({ x: R(W * 0.2, W * 1.1), y: R(-20, H * 0.5), len: R(50, 110), v: R(260, 440), w: init ? -R(0, 3) : -R(0.5, 3) }),
      step(p, dt, W, H, c) { p.w += dt; if (p.w < 0) return true; p.x -= p.v * dt * 0.8; p.y += p.v * dt * 0.6; const tx = p.x + p.len * 0.8, ty = p.y - p.len * 0.6, g = c.createLinearGradient(p.x, p.y, tx, ty); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = g; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(tx, ty); c.stroke(); return p.x > -120 && p.y < H + 60; }
    },
    petals: {
      n: W => Math.round(W / 22),
      make: (R, W, H, init) => ({ x: init ? R(0, W) : R(-20, W), y: init ? R(-10, H) : -12, s: R(4, 8), v: R(24, 52), vx: R(8, 26), r: R(0, 6.28), vr: R(-2, 2), q: R(0, 6.28) }),
      step(p, dt, W, H, c) { p.y += p.v * dt; p.q += dt * 2; p.x += (p.vx + Math.sin(p.q) * 14) * dt; p.r += p.vr * dt; c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = 'rgba(255,184,212,.88)'; c.beginPath(); c.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 6.2832); c.fill(); c.restore(); return p.y < H + 12 && p.x < W + 16; }
    },
    /* anime: kitsune fox-fire embers drifting up */
    foxfire: {
      n: W => Math.round(W / 26),
      make: (R, W, H, init) => ({ x: R(0, W), y: init ? R(0, H) : H + R(0, 18), v: R(22, 62), s: R(1.6, 3.4), q: R(0, 6.28), w: R(6, 20) }),
      step(p, dt, W, H, c) {
        p.y -= p.v * dt; p.q += dt * 3; p.x += Math.sin(p.q) * p.w * dt;
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 3.2);
        g.addColorStop(0, 'rgba(255,245,200,.95)'); g.addColorStop(.4, 'rgba(255,150,45,.8)'); g.addColorStop(1, 'rgba(255,60,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.s * 3.2, 0, 6.2832); c.fill(); return p.y > -24;
      }
    },
    /* anime: katana slashes across the card */
    slashes: {
      n: () => 3,
      make: (R, W, H, init) => ({ x: R(-20, W * .7), y: R(-10, H * .7), len: R(70, 150), sp: R(2.2, 3.8), life: 0, wait: init ? R(0, 1.8) : R(.3, 1.5), ang: R(-.9, -.3) }),
      step(p, dt, W, H, c) {
        if (p.wait > 0) { p.wait -= dt; return true; }
        p.life += dt * p.sp; if (p.life > 1) return false;
        const t = p.life, a = (1 - t).toFixed(2);
        c.strokeStyle = t < .45 ? `rgba(255,255,255,${a})` : `rgba(255,110,190,${a})`;
        c.lineWidth = 1.5 + (1 - t) * 3.5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + p.len * Math.cos(p.ang), p.y + p.len * Math.sin(p.ang)); c.stroke(); return true;
      }
    },
    /* gaming: falling RGB pixel bits */
    pixels: {
      n: W => Math.round(W / 16),
      make: (R, W, H, init) => ({ x: Math.floor(R(0, W / 6)) * 6, y: init ? R(0, H) : -R(6, 70), v: R(30, 95), s: R(2, 5), hue: R(0, 360), q: R(0, 6.28) }),
      step(p, dt, W, H, c) { p.y += p.v * dt; p.q += dt; c.fillStyle = `hsla(${(p.hue + p.q * 40) % 360},100%,63%,.85)`; c.fillRect(p.x, p.y, p.s, p.s); return p.y < H + 8; }
    },
    /* gaming: cyan data streams with a bright head */
    cyber: {
      n: W => Math.round(W / 26),
      make: (R, W, H, init) => ({ x: R(0, W), y: init ? R(0, H) : R(-70, 0), v: R(60, 150), s: R(1.4, 3), a: R(.3, .85) }),
      step(p, dt, W, H, c) {
        p.y += p.v * dt; c.strokeStyle = `rgba(0,245,255,${p.a})`; c.lineWidth = p.s;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x, p.y + p.s * 14); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(p.x - 1.5, p.y + p.s * 14, 3, 3); return p.y < H + 44;
      }
    }
  };
  function startFx(host, kind) {
    const F = FX[kind];
    /* reduced-motion no longer hides the profile effect: a still card is what people complained
       about on the desktop, and this canvas is a one-off decoration, not page motion. */
    if (!host || !F) return null;
    const cv = document.createElement('canvas'); cv.className = 'pfx'; host.append(cv);
    const c = cv.getContext('2d'), R = (a, b) => a + Math.random() * (b - a), dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, ps = [], raf = 0, last = 0;
    const fit = () => { W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); c.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const seed = () => { ps = Array.from({ length: F.n(W, H) }, (_, i) => F.make(R, W, H, true, i)); };
    fit(); seed();
    const tick = t => {
      if (!cv.isConnected) return;
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
      if (Math.abs(host.clientHeight - H) > 2 || Math.abs(host.clientWidth - W) > 2) { fit(); seed(); }
      c.clearRect(0, 0, W, H);
      ps.forEach((p, i) => { if (!F.step(p, dt, W, H, c)) ps[i] = F.make(R, W, H, false, i); });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); cv.remove(); };
  }
  /* 3D tilt + glare that follows the pointer (desktop only) */
  function tilt(card) {
    if (!card || reduced() || !(window.matchMedia && matchMedia('(hover: hover)').matches)) return;
    let raf = 0;
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 7).toFixed(2)}deg) rotateY(${((x - 0.5) * 9).toFixed(2)}deg)`;
        card.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); card.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      });
    });
    card.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); card.style.transform = ''; });
  }
  const ago = t => {
    if (!t) return 'a while ago';
    const s = Math.max(0, Math.floor((Date.now() + skew - t) / 1000));
    if (s < 90) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return new Date(t).toLocaleDateString();
  };
  const day = t => (t ? new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'the start');
  const kill = sel => { const o = document.querySelector(sel); if (o) o.remove(); };

  function openDM(n) {
    const k = 'dm:' + [me.toLowerCase(), n.toLowerCase()].sort().join('|');
    chans[k] = chans[k] || []; cur = k; unread[k] = 0; show('chat'); renderMsgs(); $('#box').focus();
  }
  window.hhOpenDM = openDM;

  /* ---- now playing: the Music Assistant bridge pushes this, the card and member list read it ---- */
  const npf = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const npPos = np => { const s = Math.max(0, (np.el || 0) + (np.p ? (Date.now() + skew - (np.at || 0)) / 1000 : 0)); return np.dur ? Math.min(np.dur, s) : s; };
  const npPct = np => { const pos = npPos(np); return np.dur ? Math.max(0, Math.min(100, pos / np.dur * 100)) : 0; };
  const npLabel = np => (np.p ? '🎧 Listening on Music Assistant' : '⏸ Paused on Music Assistant');
  /* Japanese titles are impossible to type into the music bot, so show the romaji in brackets. */
  const JP = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/;
  const RO = (() => { try { return JSON.parse(localStorage.hhro || '{}'); } catch (e) { return {}; } })();
  window.hhRomaji = async (t, a) => {
    if (!t || !JP.test(t)) return '';
    const key = (t + '|' + (a || '')).toLowerCase();
    if (key in RO) return RO[key] || '';
    try {
      const r = await (await fetch('/huzz-hunter/api/romaji?t=' + encodeURIComponent(t) + '&a=' + encodeURIComponent(a || ''), { headers: { 'x-token': localStorage.htk || '', 'x-pass': localStorage.hp || '' } })).json();
      RO[key] = (r && r.ok && r.r) || '';
    } catch (e) { RO[key] = ''; }
    try { localStorage.hhro = JSON.stringify(RO); } catch (e) {}
    return RO[key];
  };
  /* fill the (romaji) part of a title, and ignore the answer if the track moved on meanwhile */
  async function fillRo(el, np) {
    if (!el || !np || !np.t) return;
    const want = np.t + '|' + (np.a || '');
    if (el.dataset.for === want) return;
    el.dataset.for = want; el.textContent = ''; el.hidden = true;
    if (!JP.test(np.t)) return;
    const r = await window.hhRomaji(np.t, np.a);
    if (el.dataset.for !== want || !r) return;
    el.textContent = '(' + r + ')';
    el.hidden = false;
  }
  /* one plain-text line of what someone is playing — the member list and the DM rows wear it */
  const npText = np => (np && np.t ? (np.p ? '🎧 ' : '⏸ ') + np.t + (np.a ? ' · ' + np.a : np.al ? ' · ' + np.al : '') : '');
  window.hhNpText = n => npText(NP[n]);
  function npHtml(np) {
    if (!np || !np.t) return '';
    const sub = [np.a, np.al].filter(Boolean).join(' · ');
    return `<div class="pnp${np.p ? ' on' : ''}">
      <div class="pnp-art">${np.art ? `<img src="${esc(mediaUrl(np.art))}" alt="" draggable="false" loading="lazy">` : '<span>♪</span>'}</div>
      <div class="pnp-main">
        <div class="pnp-k">${npLabel(np)}</div>
        <div class="pnp-t" title="${esc(np.t)}"><span class="pnp-tn">${esc(np.t)}</span><span class="pnp-ro" hidden></span></div>
        <div class="pnp-s">${esc(sub || 'Music Assistant')}</div>
        <div class="pnp-bar"><i style="width:${npPct(np).toFixed(1)}%"></i></div>
        <div class="pnp-time"><span>${npf(npPos(np))}</span><span>${np.dur ? npf(np.dur) : '--:--'}</span></div>
      </div>
      <button type="button" class="pnp-lyr" title="Lyrics dekho" aria-label="Lyrics">📝</button>
      ${/^https?:/.test(np.url || '') ? `<a class="pnp-open" href="${esc(np.url)}" target="_blank" rel="noopener noreferrer" title="Open Music Assistant">Open</a>` : ''}
    </div>
    <button type="button" class="pnp-play" data-pt="${esc(np.t)}" data-pa="${esc(np.a || '')}" data-ma="${esc(np.url || '')}"><span>▶</span> Play on Music Assistant</button>`;
  }

  /* opens the profile owner's Music Assistant and starts that very song there */
  document.addEventListener('click', async e => {
    const b = e.target.closest('.pnp-play');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    if (b.dataset.busy === '1') return;
    const q = (b.dataset.pt + ' ' + (b.dataset.pa || '')).trim();
    const ma = b.dataset.ma || '';
    // open the tab first, otherwise the browser blocks a window opened after an await
    const tab = ma ? window.open(ma, '_blank') : null;
    b.dataset.busy = '1';
    b.classList.add('busy');
    const lbl = b.innerHTML;
    b.innerHTML = '<span>⏳</span> Starting…';
    let msg = 'Music Assistant se connect nahi hua.';
    try {
      const r = await post('/api/bot/play', { q });
      if (r && r.ok) msg = 'Playing on Music Assistant.';
      else if (r && r.error) msg = r.error;
    } catch (err) { /* keep the default message */ }
    toast(msg);
    b.dataset.busy = '';
    b.classList.remove('busy');
    b.innerHTML = lbl;
    if (!tab && ma) window.open(ma, '_blank');
  }, true);
  /* one tick a second: progress only, no re-render, so scrolling the card stays put */
  function paintNp(root, name) {
    const box = root.querySelector('.pnp'), np = NP[name];
    if (!box || !np) return;
    box.classList.toggle('on', !!np.p);
    const k = box.querySelector('.pnp-k'); if (k) k.textContent = npLabel(np);
    // a saved fix (or the next track) has to repaint the names too, not only the progress bar
    const tt = box.querySelector('.pnp-t');
    if (tt && np.t) { tt.title = np.t; const tn = tt.querySelector('.pnp-tn'); if (tn) tn.textContent = np.t; }
    const ro = tt && tt.querySelector('.pnp-ro');
    if (ro) fillRo(ro, np);
    const ss = box.querySelector('.pnp-s'); if (ss) ss.textContent = [np.a, np.al].filter(Boolean).join(' · ') || 'Music Assistant';
    const i = box.querySelector('.pnp-bar i'); if (i) i.style.width = npPct(np).toFixed(1) + '%';
    const t = box.querySelector('.pnp-time');
    if (t) t.innerHTML = `<span>${npf(npPos(np))}</span><span>${np.dur ? npf(np.dur) : '--:--'}</span>`;
  }

  /* Lyrics: whatever Music Assistant already has on the track, else LRCLIB (title + artist). */
  const npAuth = () => ({ 'x-token': localStorage.htk || '', 'x-pass': localStorage.hp || '' });
  /* Synced lyrics arrive with [mm:ss.xx] stamps and often repeat the same line twice; show clean
     lines once, so a track's lyrics do not read as a double take. */
  const tidyLyrics = raw => String(raw || '')
    .replace(/\r/g, '')
    .replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter((l, i, a) => l && l !== a[i - 1])
    .join('\n');
  window.hhNpLyrics = async np => {
    if (!np || !np.t) return;
    document.querySelectorAll('.modal.lyr').forEach(x => x.remove());
    const m = document.createElement('div'); m.className = 'modal lyr';
    m.innerHTML = `<div class="card"><div class="row" style="margin:0 0 8px"><b style="flex:1">Lyrics</b><button type="button" class="btn alt" id="lyr" aria-label="Fetch again">↻</button><button type="button" class="btn alt" id="lyx" aria-label="Close">✕</button></div>
      <small class="mut">${esc(np.t)}${np.a ? ' · ' + esc(np.a) : ''}</small>
      <pre class="lybody" id="lyb">Dhoondh raha hoon…</pre>
      <small class="mut" id="lysrc"></small></div>`;
    document.body.append(m);
    m.addEventListener('click', e => { if (e.target === m || e.target.id === 'lyx') m.remove(); });
    const body = m.querySelector('#lyb'), srcLine = m.querySelector('#lysrc');
    if (m.querySelector('#lyr')) m.querySelector('#lyr').onclick = () => { m.remove(); window.hhNpLyrics(np); };
    try {
      /* the cache-buster matters: an older wrong answer for the same URL used to stick in the browser */
      const res = await fetch('/huzz-hunter/api/lyrics?t=' + encodeURIComponent(np.t) + '&a=' + encodeURIComponent(np.a || '') + '&dur=' + (np.dur || 0) + '&_=' + Date.now(), { headers: npAuth(), cache: 'no-store' });
      if (res.status === 401) { body.textContent = 'Session expire ho gaya — sign out karke dobara sign in karo.'; if (srcLine) srcLine.textContent = ''; return; }
      const r = await res.json();
      if (r && r.ok && r.lyrics) {
        body.textContent = tidyLyrics(r.lyrics);
        if (srcLine) srcLine.textContent = 'source: ' + (r.src || 'lrclib') + (r.artist ? ' · ' + r.artist : '');
      } else { body.textContent = (r && r.error) || 'Lyrics nahi mile.'; if (srcLine) srcLine.textContent = ''; }
    } catch (e) { body.textContent = 'Lyrics nahi mile (network).'; }
  };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.pnp-lyr');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const box = b.closest('.modal.prof');
    const name = box && box.dataset.pn;
    const np = name ? NP[name] : null;
    if (np) window.hhNpLyrics(np); else if (window.hhToast) window.hhToast('Koi track nahi mil raha.');
  }, true);

  function card(p) {
    const HF = window.hhFr || { is: () => false, in: () => false, out: () => false };
    const np = NP[p.name] || p.np || null;
    const frA = HF.is(p.name) ? 'dm' : HF.in(p.name) ? 'frok' : HF.out(p.name) ? 'frwait' : 'fradd';
    const frT = HF.is(p.name) ? '💬 Message' : HF.in(p.name) ? '✓ Accept friend' : HF.out(p.name) ? '⏳ Request sent' : '👋 Add friend';
    const self = p.name === me, r = rank(p.xp), acc = p.accent || 'var(--gold)', bl = badgeList(p), locked = !!p.sl;
    const pct = r.to ? Math.max(0, Math.min(100, (p.xp - r.from) / (r.to - r.from) * 100)) : 100;
    const tags = (p.subj || []).filter(([, v]) => v > 0).map(([k, v]) => `<span class="tag">${esc(k)} <small>${hm(v)}</small></span>`).join('');
    const live = p.live ? `<div class="plive">📚 studying <b>${esc(p.live.s)}</b> · ${hm(Math.max(0, (p.live.acc || 0) + ((p.live.hold || Date.now() + skew) - p.live.t) / 1000))}${p.live.hold ? ' · paused' : ''}</div>` : '';
    return `      <div class="pbanner${p.banr === '169' ? ' ban169' : ''}${BFXL[p.bfx] ? ' bf bf-' + p.bfx : ''}" style="${bg(p.banner)}">${p.on ? '<span class="pdot">online</span>' : ''}<button class="x px" data-x aria-label="Close">×</button></div>
      <div class="part${pkCls(p.pack)}${p.art ? ' w' : ''}"${p.art ? ` style="${artVars(p)};background-image:url('${esc(mediaUrl(p.art))}')"` : ''}>${p.art ? `<img class="partimg" src="${esc(mediaUrl(p.art))}" alt="" draggable="false" fetchpriority="high" decoding="async" style="object-fit:${artFit(p.artfit)};transform:scale(${artZoom(p.artz)})">` : ''}</div>
      <div class="pchar${pkCls(p.pack)}${bl.length ? ' has' : ''}${bl.length || p.pack ? '' : ' off'}"${+p.pchs ? ` style="--pchsz:${Math.min(260, Math.max(60, Math.round(+p.pchs)))}px"` : ''}>${bl.length ? `<span class="pchi">${bl[0]}</span>` : ''}</div>
      ${amvLayer(p.amv, p.amvo, p.artz, p.artfit, p.artx, p.arty)}
      <div class="phead">
        <div class="pav${p.live ? ' studying' : ''}" data-u="${esc(p.name)}">${avHtml(p.name)}</div>
        <div class="pwho">
          <div class="pname" style="color:${p.accent ? esc(p.accent) : 'inherit'}">${nameHtml(p.dn || p.name, p.nfx, p.accent, p.acc2)}${p.pron ? `<span class="pron">${esc(p.pron)}</span>` : ''}</div>
          <div class="phandle">@${esc(p.name)}${p.bot ? ' <span class="pbot">BOT</span>' : ''}</div>
        </div>
      </div>
      <div class="pbody">${p.status || p.emoji ? `<div class="pstatus">${p.emoji ? `<span class="pemoji">${esc(p.emoji)}</span>` : ''}${esc(p.status || '')}</div>` : ''}${live}${p.bio ? `<p class="pbio">${esc(p.bio)}</p>` : '<p class="pbio dim">No bio yet.</p>'}${npHtml(np)}</div>
      ${locked ? `<div class="plock">🔒 <b>Ragdhamaxxing locked</b><small>Opens with the Arena</small></div>` : `<div class="prank">
        <div class="row" style="margin:0 0 4px"><b style="color:${acc}">${r.name}</b><small style="margin-left:auto">${r.to ? p.xp + ' / ' + r.to + ' XP' : p.xp + ' XP'}</small></div>
        <div class="bar"><i style="width:${pct}%;background:${acc}"></i></div>
      </div>`}
      <div class="pstats${locked ? ' locked' : ''}">
        <div><small>This week</small><b>${locked ? '🔒' : hm(p.week)}</b></div>
        <div><small>All time</small><b>${locked ? '🔒' : hm(p.total)}</b></div>
        <div><small>Streak</small><b>${locked ? '🔒' : p.streak + 'd'}</b></div>
        <div><small>Messages</small><b>${locked ? '🔒' : p.msgs}</b></div>
      </div>
      ${tags ? `<div class="ptags">${tags}</div>` : ''}
      <div class="pfoot"><span>Member since ${day(p.created)}</span><span>${p.on ? 'Online now' : 'Last seen ' + ago(p.last)}</span></div>
      <div class="row pactions">${self
        ? '<button class="btn" data-a="edit">Edit profile</button>'
        : `<button class="btn" data-a="${frA}">${frT}</button><button class="btn alt" data-a="mention">Mention</button>${p.bot ? '' : '<button class="btn alt" data-a="duel">Duel</button>'}${window.hhOwner ? `<button class="btn alt" data-a="lock">${p.lock ? '🔓 End lock in' : '🔒 Lock in'}</button>` : ''}`}</div>`;
  }

  /* A profile that fails to draw must never take the whole page with it. */
  async function openProfile(name) {
    try { await drawProfile(name); }
    catch (err) {
      console.error('profile failed:', err);
      (window.hhToast || alert)('That profile could not be opened. Refresh and try again.');
    }
  }

  async function drawProfile(name) {
    if (window.hhCloseDrawers) window.hhCloseDrawers();
    const p = await fetchProf(name);
    if (!p || !p.name) return alert('Could not load that profile.');
    PPL[p.name] = { dn: p.dn || '', av: p.av || '', deco: p.deco || '', nfx: p.nfx || '', acc: p.accent || '', acc2: p.acc2 || '', pack: p.pack || '' };
    warmArt(p.art);
    kill('.modal.prof');
    const m = document.createElement('div'); m.className = 'modal prof'; m.dataset.pn = p.name;
    m.innerHTML = `<div class="card${p.ctheme ? ' themed' : ''}${p.banr === '169' ? ' ban169' : ''}${pkCls(p.pack)}" style="--ac:${hex6(p.accent) || '#f5b84b'};--ac2:${hex6(p.acc2) || hex6(p.accent) || '#f5b84b'}">${card(p)}</div>`;
    document.body.append(m);
    const cd = m.querySelector('.card'); startFx(cd, p.pfx); tilt(cd); mountAmv(cd); mountBadges(cd, p);
    const npTimer = setInterval(() => { if (!document.body.contains(m)) return clearInterval(npTimer); paintNp(m, p.name); }, 1000);
    m.onclick = async e => {
      if (e.target === m || e.target.hasAttribute('data-x')) return m.remove();
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'dm') { m.remove(); openDM(p.name); }
      if (a === 'fradd' || a === 'frok') {
        const r = await api('/huzz-hunter/api/friends/' + (a === 'fradd' ? 'req' : 'ok'), { user: p.name });
        (window.hhToast || alert)(r.error || (a === 'fradd' ? 'Friend request sent to ' + p.name + '.' : 'You and ' + p.name + ' are friends now — say hi.'));
        if (window.hhRefreshFriends) await window.hhRefreshFriends();
        m.remove();
        return;
      }
      if (a === 'frwait') { (window.hhToast || alert)('Your friend request to ' + p.name + ' is waiting for them to accept.'); return; }
      if (a === 'mention') { m.remove(); const box = $('#box'); box.value += (box.value && !box.value.endsWith(' ') ? ' ' : '') + '@' + p.name + ' '; if (view !== 'chat') show('chat'); box.focus(); }
      if (a === 'duel') { m.remove(); const r = await api('/huzz-hunter/api/duel', { to: p.name }); alert(r.error || 'Duel request sent to ' + p.name + '.'); }
      if (a === 'lock') {
        if (p.lock) {
          const r = await api('/huzz-hunter/api/lockin/clear', { user: p.name });
          (window.hhToast || alert)(r.error || 'Lock in ended for ' + p.name + '.');
          m.remove(); return;
        }
        const h = Math.min(12, Math.max(1, +prompt('Lock ' + p.name + ' in for how many hours? (1-12)', '2') || 0));
        if (!h || Number.isNaN(h)) return;
        const r = await api('/huzz-hunter/api/lockin', { user: p.name, hours: h });
        (window.hhToast || alert)(r.error || p.name + ' is locked in for ' + h + 'h — their chat stays off until those hours are studied.');
        m.remove(); return;
      }
      if (a === 'edit') { m.remove(); editProfile(p); }
    };
  }
  window.hhOpenProfile = openProfile;

  /* downscale in the browser: avatars stay tiny, banners stay under the save limit */
  const dataBlob = d => {
    const m = /^data:([^;,]+)[^,]*,(.*)$/.exec(String(d || ''));
    if (!m) return null;
    try {
      const bin = atob(m[2]), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new Blob([u8], { type: m[1] });
    } catch (e) { return null; }
  };
  function shrink(file, maxW, square, cb) {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const w = img.width, h = img.height, c = document.createElement('canvas'), ctx = c.getContext('2d');
      if (square) {
        const s = Math.min(w, h);
        c.width = c.height = 320;
        ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, 320, 320);
      } else {
        const k = Math.min(1, maxW / Math.max(w, h));
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        ctx.drawImage(img, 0, 0, c.width, c.height);
      }
      URL.revokeObjectURL(url);
      const webp = c.toDataURL('image/webp', square ? 0.82 : 0.72);
      cb(webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', square ? 0.85 : 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(url); cb(''); };
    img.src = url;
  }

  /* ---- crop + zoom editor: drag to move, scroll / pinch / slider to zoom, then "Use this" ---- */
  function cropper(file, kind, done, opts) {
    const isAv = kind === 'av', isArt = kind === 'art';
    const SW = Math.max(240, Math.min(360, Math.floor(innerWidth * 0.84)));
    /* The shape the profile will show: a wide strip (4:1), a 16:9 picture, a square avatar, or
       the backdrop frame (4:5, the shape of the area the backdrop fills on the card). */
    let ratio = isAv ? 1 : isArt ? 4 / 5 : (+((opts || {}).ratio) === 16 / 9 ? 16 / 9 : 4);
    let ww = isAv ? Math.round(SW * 0.76) : SW - 24, wh = isAv ? ww : Math.round(ww / ratio);
    let SH = isAv ? SW : wh + 96, wx = Math.round((SW - ww) / 2), wy = Math.round((SH - wh) / 2);
    const url = URL.createObjectURL(file), img = new Image();
    const m = document.createElement('div'); m.className = 'modal crop';
    m.innerHTML = `<div class="card">
      <div class="row" style="margin:0 0 4px"><h2 style="flex:1;margin:0">${isAv ? 'Position your avatar' : isArt ? 'Frame your backdrop' : 'Position your banner'}</h2><button class="x" data-x aria-label="Close">×</button></div>
      <small class="mut">${isArt ? 'Drag the picture and zoom until the whole card area is filled exactly how you want it — the frame below is what people see.' : 'Drag to move. Scroll, pinch or use the slider to zoom in on your face.'}</small>
      ${isAv || isArt ? '' : `<div class="row artopts" style="margin:6px 0 0"><small style="min-width:70px">Crop shape</small><button type="button" class="chip" data-r="4">Wide 4:1</button><button type="button" class="chip" data-r="16">16:9</button></div>`}
      <div class="crop-stage" id="cstage" tabindex="0" style="width:${SW}px;height:${SH}px"><div class="crop-win${isAv ? ' round' : ''}" id="cwin" style="left:${wx}px;top:${wy}px;width:${ww}px;height:${wh}px"></div></div>
      <div class="crop-zoom"><button type="button" class="btn alt" data-z="-1" aria-label="Zoom out">−</button><input type="range" id="czoom" min="0" max="1000" value="0" aria-label="Zoom"><button type="button" class="btn alt" data-z="1" aria-label="Zoom in">+</button></div>
      <small class="mut" id="cnote"></small>
      <div class="row"><button type="button" class="btn alt" data-c="reset">Reset</button><span style="flex:1"></span><button type="button" class="btn alt" data-x>Cancel</button><button type="button" class="btn" data-c="ok" disabled>Use this</button></div>
    </div>`;
    document.body.append(m);
    const stage = m.querySelector('#cstage'), win = m.querySelector('#cwin'), zoom = m.querySelector('#czoom'), okb = m.querySelector('[data-c="ok"]'), note = m.querySelector('#cnote');
    let iw = 0, ih = 0, s = 1, x = 0, y = 0, minS = 1, maxS = 8, closed = false;
    const onKey = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(null); } };
    const close = out => {
      if (closed) return; closed = true;
      URL.revokeObjectURL(url); document.removeEventListener('keydown', onKey, true); m.remove();
      if (out) done(out);
    };
    document.addEventListener('keydown', onKey, true);
    const paint = () => {
      s = Math.min(maxS, Math.max(minS, s));
      x = Math.min(wx, Math.max(wx + ww - iw * s, x));
      y = Math.min(wy, Math.max(wy + wh - ih * s, y));
      img.style.transform = `translate(${x}px,${y}px) scale(${s})`;
      zoom.value = Math.round(Math.log(s / minS) / Math.log(maxS / minS) * 1000);
    };
    const zoomAt = (px, py, ns) => { ns = Math.min(maxS, Math.max(minS, ns)); x = px - (px - x) * (ns / s); y = py - (py - y) * (ns / s); s = ns; paint(); };
    const mid = f => zoomAt(wx + ww / 2, wy + wh / 2, s * f);
    const reset = () => { s = minS; x = wx + (ww - iw * s) / 2; y = wy + (wh - ih * s) / 2; paint(); };
    /* what the profile stores for this shape, so the editor and the card agree.
       ratio > 3 is the wide 4:1 strip; anything below it is the 16:9 picture. */
    const outSize = () => (isAv ? [320, 320] : isArt ? [720, 900] : ratio > 3 ? [1000, 250] : [960, 540]);
    const layout = () => {
      wh = isAv ? ww : Math.round(ww / ratio);
      SH = isAv ? SW : wh + 96;
      wx = Math.round((SW - ww) / 2); wy = Math.round((SH - wh) / 2);
      stage.style.height = SH + 'px';
      win.style.left = wx + 'px'; win.style.top = wy + 'px';
      win.style.width = ww + 'px'; win.style.height = wh + 'px';
      m.querySelectorAll('[data-r]').forEach(b => b.classList.toggle('on', (b.dataset.r === '4') === (ratio > 3)));
      if (note && !isAv) {
        const [ow, oh] = outSize();
        note.textContent = (isArt ? 'Backdrop' : ratio > 3 ? 'Wide 4:1' : '16:9') + ` — saved as ${ow}×${oh}. The frame always fills up, so drag or zoom to choose what stays inside it.`;
      }
    };
    const refit = () => {
      if (!iw) return;
      minS = Math.max(ww / iw, wh / ih); maxS = Math.max(minS * 8, 1.5);
      s = Math.min(maxS, Math.max(minS, s));
      reset();
    };
    layout();
    img.onload = () => {
      iw = img.naturalWidth; ih = img.naturalHeight;
      if (!iw || !ih) return img.onerror();
      img.style.width = iw + 'px'; img.style.height = ih + 'px';
      stage.prepend(img); refit(); okb.disabled = false; stage.focus();
    };
    img.onerror = () => { close(null); alert('That file could not be read as an image. Try a JPG or PNG.'); };
    img.draggable = false; img.alt = ''; img.src = url;

    const ptrs = new Map(); let last = null;
    stage.addEventListener('pointerdown', e => { try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } ptrs.set(e.pointerId, [e.clientX, e.clientY]); stage.classList.add('drag'); last = null; });
    stage.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId) || !iw) return;
      const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      const r = stage.getBoundingClientRect();
      if (ptrs.size === 1) { x += e.clientX - prev[0]; y += e.clientY - prev[1]; paint(); }
      else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), cx = (a[0] + b[0]) / 2 - r.left, cy = (a[1] + b[1]) / 2 - r.top;
        if (last) { x += cx - last.cx; y += cy - last.cy; if (last.d > 0) zoomAt(cx, cy, s * d / last.d); else paint(); }
        last = { d, cx, cy };
      }
    });
    const up = e => { ptrs.delete(e.pointerId); last = null; if (!ptrs.size) stage.classList.remove('drag'); };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', e => { if (!iw) return; e.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, s * Math.exp(-e.deltaY * 0.0018)); }, { passive: false });
    stage.addEventListener('keydown', e => {
      if (!iw) return;
      const st = e.shiftKey ? 30 : 10, k = e.key;
      if (k === 'ArrowLeft') x += st; else if (k === 'ArrowRight') x -= st; else if (k === 'ArrowUp') y += st; else if (k === 'ArrowDown') y -= st;
      else if (k === '+' || k === '=') return mid(1.15); else if (k === '-' || k === '_') return mid(1 / 1.15); else return;
      e.preventDefault(); paint();
    });
    zoom.oninput = () => { if (iw) mid(minS * Math.pow(maxS / minS, zoom.value / 1000) / s); };

    const render = () => {
      const [ow, oh] = outSize(), c = document.createElement('canvas'); c.width = ow; c.height = oh;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
      const sx = Math.max(0, (wx - x) / s), sy = Math.max(0, (wy - y) / s);
      g.drawImage(img, sx, sy, Math.min(iw - sx, ww / s), Math.min(ih - sy, wh / s), 0, 0, ow, oh);
      let out = '';
      for (const q of (isAv ? [0.86, 0.75, 0.6] : [0.78, 0.66, 0.54, 0.42])) {
        out = c.toDataURL('image/webp', q);
        if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', q);
        if (out.length <= (isAv ? 190000 : 290000)) break;
      }
      return out;
    };
    m.onclick = e => {
      if (e.target.closest('[data-x]')) return close(null);
      const z = e.target.closest('[data-z]'); if (z) return mid(+z.dataset.z > 0 ? 1.25 : 0.8);
      const rs = e.target.closest('[data-r]');
      if (rs) { ratio = rs.dataset.r === '16' ? 16 / 9 : 4; layout(); refit(); return; }
      const b = e.target.closest('[data-c]'); if (!b) return;
      if (b.dataset.c === 'reset') reset();
      if (b.dataset.c === 'ok') {
        const out = render();
        if (!out || out.length > (isAv ? 190000 : 290000)) return alert('That crop is still too heavy. Zoom in a little more or pick a simpler picture.');
        close(out);
      }
    };
  }

  /* animated pictures (gif / animated webp / apng) skip the canvas squash, which would flatten them */
  async function isAnimated(file) {
    try {
      if (!/^image\/(gif|webp|png)$/.test(file.type)) return false;
      if (file.size > 8388608) return file.type === 'image/gif';
      const b = new Uint8Array(await file.arrayBuffer());
      if (file.type === 'image/gif') { let n = 0; for (let i = 0; i < b.length - 3; i++) if (b[i] === 0x21 && b[i + 1] === 0xf9 && b[i + 2] === 4 && ++n > 1) return true; return false; }
      const s = file.type === 'image/webp' ? [0x41, 0x4e, 0x49, 0x4d] : [0x61, 0x63, 0x54, 0x4c];
      for (let i = 0; i < b.length - 3; i++) if (b[i] === s[0] && b[i + 1] === s[1] && b[i + 2] === s[2] && b[i + 3] === s[3]) return true;
    } catch (e) { /* treat as a still picture */ }
    return false;
  }

  function editProfile(p) {
    if (window.hhCloseDrawers) window.hhCloseDrawers();
    kill('.modal.prof'); kill('.modal.editp');
    let av = p.av || '', ban = p.banner || '', emo = p.emoji || '';
    let deco = DECO[p.deco] ? p.deco : '', nfx = NFXL[p.nfx] ? p.nfx : '', bfx = BFXL[p.bfx] ? p.bfx : '', pfx = PFXL[p.pfx] ? p.pfx : '', pk = PACK_IDS.includes(p.pack) ? p.pack : '';
    let art = p.art || '';
    /* banner shape: a wide strip (default) or a 16:9 picture */
    let banr = p.banr === '169' ? '169' : '';
    let artfit = artFit(p.artfit), artz = Math.min(300, Math.max(100, Math.round(+p.artz || 100))), artr = p.artr === '169' ? '169' : '';
    let artx = artPos(p.artx), arty = artPos(p.arty);
    let amv = amvOk(p.amv) ? String(p.amv).trim() : '', amo = amvPct(p.amvo);
    /* avatar badges: a set of the built-in chibis and the person's own PNGs, shown in turn */
    const isOwn = v => /^(\/huzz-hunter\/|data:image\/|blob:)/.test(String(v || ''));
    let pchl = (Array.isArray(p.pchl) ? p.pchl : []).filter(v => typeof v === 'string' && v).slice(0, 8);
    if (!pchl.length && p.pch) { const one = p.pch === 'png' ? (p.pchv || '') : p.pch; if (ACC_IMG[one] || ACC_SVG[one] || isOwn(one)) pchl = [one]; }
    let pchv = '';
    let pchsz = Math.min(230, Math.max(60, Math.round(+p.pchs || 126)));
    let acc = hex6(p.accent), acc2 = hex6(p.acc2), themed = !!p.ctheme, fxOn = null, fxStop = null;
    const initial = (p.name[0] || '?').toUpperCase();
    const avBox = v => {
      const dc = deco ? ` dc dc-${deco}` : '';
      return v ? `<span class="av avi${dc}"><img src="${v}" alt=""></span>` : `<span class="av${dc}" style="background:${col(p.name)}">${esc(initial)}</span>`;
    };
    const ICON = { sparkles: '✨', snow: '❄️', hearts: '💖', fireflies: '🌟', embers: '🔥', matrix: '🟩', stars: '🌠', petals: '🌸', foxfire: '🦊', slashes: '⚔️', pixels: '👾', cyber: '🧬' };
    /* Shop-style packs: one click sets the whole look (anime + gaming, our own art) */
    const PACKS = [
      { id: 'kitsune', name: 'Kitsune Foxfire', banner: 'foxfire', deco: 'fox', nfx: 'fire', bfx: 'sparks', pfx: 'foxfire', accent: '#ff7a18', acc2: '#ffd166' },
      { id: 'cursedking', name: 'Cursed King', banner: 'cursed', deco: 'cursed', nfx: 'blood', bfx: 'lightning', pfx: 'slashes', accent: '#ff1f4b', acc2: '#7b0f2b' },
      { id: 'neonrunner', name: 'Neon Runner', banner: 'neoncity', deco: 'mecha', nfx: 'hologram', bfx: 'hex', pfx: 'cyber', accent: '#00f5ff', acc2: '#ff2bd6' },
      { id: 'ranked', name: 'RGB Ranked', banner: 'arena', deco: 'rgb', nfx: 'arcade', bfx: 'vhs', pfx: 'pixels', accent: '#7c4dff', acc2: '#00ff9d' },
      { id: 'sakurablade', name: 'Sakura Blade', banner: 'blossom', deco: 'blade', nfx: 'outline', bfx: 'scan', pfx: 'petals', accent: '#ff9ec4', acc2: '#8ec5ff' },
      { id: 'sukunaedit', name: 'Cursed Edit', banner: 'cursed', deco: 'cursed', nfx: 'blood', bfx: 'lightning', pfx: 'slashes', accent: '#f2efe9', acc2: '#ff2233' }
    ];
    const applyPack = id => {
      const k = PACKS.find(x => x.id === id); if (!k) return;
      ban = k.banner; deco = k.deco; nfx = k.nfx; bfx = k.bfx; pfx = k.pfx; acc = k.accent; acc2 = k.acc2; themed = true; pk = k.id;
      m.querySelector('#pacc').value = acc; m.querySelector('#pacc2').value = acc2; m.querySelector('#pcth').checked = true;
      m.querySelectorAll('.pack').forEach(b => b.classList.toggle('on', b.dataset.p === id));
      refresh();
    };
    const sample = {
      deco: v => `<span class="av dc dc-${v} cs"></span>`,
      nfx: v => `<b class="cst">${nameHtml('Aa', v, acc || '#f5b84b', acc2 || '#c07bff')}</b>`,
      bfx: v => `<span class="csb bf bf-${v}"></span>`,
      pfx: v => `<span class="csi">${ICON[v]}</span>`
    };
    const chips = (k, map, cur) => `<div class="chips"><button type="button" class="chip${cur ? '' : ' on'}" data-k="${k}" data-v="">None</button>${Object.keys(map).map(v => `<button type="button" class="chip${cur === v ? ' on' : ''}" data-k="${k}" data-v="${v}">${sample[k](v)}<span>${map[v]}</span></button>`).join('')}</div>`;
    const m = document.createElement('div'); m.className = 'modal editp';
    m.innerHTML = `<div class="card">
      <div class="row" style="margin:0 0 10px"><h2 style="flex:1;margin:0">Edit profile</h2><button class="x" data-x aria-label="Close">×</button></div>
      <div class="epwrap" id="epwrap">
        <div class="epbar"><span>Preview — what others see</span><input type="range" class="eprange" id="epsize" min="80" max="900" step="20" aria-label="Preview size" title="Preview size"><button type="button" class="epbtn" id="epmini" title="Shrink / expand the preview" aria-label="Shrink or expand the preview">▾</button></div>
        <div class="epbox" id="epbox"><div class="card epcard" id="epprev"></div></div>
        <div class="epgrip" id="epgrip" title="Drag to make the preview smaller or bigger"></div>
      </div>
      <small>Display name</small>
      <input class="in" id="pdn" maxlength="24" placeholder="${esc(p.name)}" value="${esc(p.dn || '')}">
      <input class="in" id="ppron" maxlength="16" placeholder="pronouns (they/them)" value="${esc(p.pron || '')}" style="margin-top:6px">
      <small>Custom status</small>
      <input class="in" id="pstat" maxlength="60" placeholder="grinding physics" value="${esc(p.status || '')}">
      <div class="row" id="pemo">${['', '📚', '🔥', '💀', '🧠', '🎯', '☕', '🌙', '🎧', '🚀'].map(e => `<button type="button" class="emo${emo === e ? ' on' : ''}" data-e="${e}" aria-label="status emoji ${e || 'none'}">${e || '∅'}</button>`).join('')}</div>
      <small>About you</small>
      <textarea id="pbio" rows="4" maxlength="300" placeholder="What are you working towards?">${esc(p.bio || '')}</textarea>
      <small>Colours — accent, an optional second colour (gradients), and card tint</small>
      <div class="row colrow">
        <label class="colr">Accent <input type="color" id="pacc" value="${acc || '#f5b84b'}" aria-label="Accent colour"></label>
        <label class="colr">Second <input type="color" id="pacc2" value="${acc2 || acc || '#c07bff'}" aria-label="Second colour"></label>
        <button type="button" class="banset-w" data-do="acc2rm"${acc2 ? '' : ' hidden'}>Clear second</button>
        <label class="colr"><input type="checkbox" id="pcth"${themed ? ' checked' : ''}> Tint my whole card</label>
      </div>
      <small>Banner — gradient, or your own picture / GIF</small>
      <div class="row" id="pbans">${Object.keys(BAN).map(k => `<button type="button" class="banset${ban === k ? ' on' : ''}" data-b="${k}" style="${bg(k)}" aria-label="${k} banner"></button>`).join('')}<button type="button" class="btn alt" data-do="banup">Upload image / GIF</button><button type="button" class="banset-w" data-do="banrm"${ban ? '' : ' hidden'}>Clear</button></div>
      <div class="row artopts"><small style="min-width:70px">Banner shape</small><button type="button" class="chip" data-br="wide">Wide strip</button><button type="button" class="chip" data-br="169">16:9 picture</button></div>
      <small>Avatar — your profile picture (GIFs animate)</small>
      <div class="row"><button type="button" class="btn alt" data-do="avup">Upload avatar</button><button type="button" class="btn alt" data-do="avrm"${av ? '' : ' hidden'}>Remove</button></div>
      <small>Avatar badge — a little accessory beside your picture (None hides the grey circle)</small>
      <div class="row artopts" id="pchrow"><button type="button" class="chip" data-bd="katana">Katana</button><button type="button" class="chip" data-bd="zoro">Chubby Zoro</button><button type="button" class="chip" data-bd="zerotwo">Chubby Zero Two</button><button type="button" class="chip" data-do="pchup">＋ Your PNG</button></div>
      <div class="row" id="pchlist"></div>
      <div class="row pchrow"><small>Size</small><input type="range" id="pchsz" min="60" max="230" step="2" value="${pchsz}" aria-label="Badge size"><small id="pchszv">${pchsz}px</small></div>
      <div class="row"><button type="button" class="btn alt" data-do="pchrm"${pchl.length ? '' : ' hidden'}>Remove all badges</button></div>
      <small class="mut">Add as many as you like: with two or more, your profile plays them in turn — one dives into your picture, the next swings in from the right, and it keeps going while the card is open.</small>
      <small>Anime backdrop — a GIF/PNG that sits under the banner and over your card at low opacity. Drop an mp4/webm here instead and its edit plays there with its own music, at the same low opacity.</small>
      <div class="row"><button type="button" class="btn alt" data-do="artup">Upload backdrop / video</button><button type="button" class="btn alt" data-do="artcrop"${art ? '' : ' hidden'}>Crop / adjust</button><button type="button" class="btn alt" data-do="amvframe"${amv ? '' : ' hidden'}>Frame video</button><button type="button" class="btn alt" data-do="artrm"${art ? '' : ' hidden'}>Remove</button></div>
      <div class="row artopts"><small style="min-width:70px">Backdrop fit</small><button type="button" class="chip" data-af="cover">Fill the card</button><button type="button" class="chip" data-af="contain">Whole picture</button><button type="button" class="chip" data-af="fill">Stretch</button></div>
      <div class="row"><small style="min-width:70px">Zoom</small><input type="range" id="partz" min="100" max="300" step="5" value="${artz}" style="flex:1"><b id="partzv" style="min-width:46px;text-align:right">${artz}%</b></div>
      <small class="mut" id="partnote"></small>
      <small class="mut">Drag the backdrop preview above to move the picture, and the Zoom slider to fill the card exactly the way you want — nothing is left empty above or below it.</small>
      <small>AMV edit backdrop — paste a YouTube or mp4/webm link; the edit plays over your card at low opacity, with sound, and never covers your avatar or banner</small>
      <div class="row"><input class="in" id="pamv" placeholder="https://youtu.be/...  or  https://.../edit.mp4" style="flex:1;min-width:0" value="${esc(amv)}"><button type="button" class="btn alt" data-do="amvset">Use</button><button type="button" class="btn alt" data-do="amvrm"${amv ? '' : ' hidden'}>Remove</button></div>
      <div class="row"><button type="button" class="btn alt" data-do="amvup">Upload the edit (mp4 / webm, up to 26 MB)</button></div>
      <div class="row"><small style="min-width:70px">Opacity</small><input type="range" id="pamo" min="10" max="70" step="5" value="${amo}" style="flex:1"></div>
      <small class="mut" id="pupnote">Photos open a crop + zoom editor. Animated GIF / WebP / APNG upload as they are (avatars up to 2 MB, banners up to 6 MB).</small>
      <small>Crazy packs — anime &amp; gaming, one click sets banner, decoration, name style, effects and colours</small>
      <div class="row packs">${PACKS.map(k => `<button type="button" class="pack" data-p="${k.id}" aria-label="${k.name} pack"><i style="${bg(k.banner)}"></i><b>${k.name}</b></button>`).join('')}</div>
      <small>Avatar decoration</small>${chips('deco', DECO, deco)}
      <small>Name style</small>${chips('nfx', NFXL, nfx)}
      <small>Banner effect (works on top of any banner)</small>${chips('bfx', BFXL, bfx)}
      <small>Profile effect (floats over your whole card)</small>${chips('pfx', PFXL, pfx)}
      <button class="btn" id="psave" style="margin-top:14px;width:100%">Save profile</button>
    </div>`;
    document.body.append(m);
    m.querySelectorAll('.pack').forEach(b => { b.onclick = () => applyPack(b.dataset.p); });
    const setHtml = (el, h) => { if (el.__h !== h) { el.innerHTML = h; el.__h = h; } };
    /* The preview is the real profile card, only scaled down, so what you see here is exactly
       what other people get - same banner, same backdrop area, same height. */
    const jobs = [];
    const artStyle = () => (art ? artVars({ artz, artx, arty }) + `;background-image:url('${esc(art)}')` : '');
    const paintArt = () => {
      const pa = m.querySelector('#epprev .part');
      if (pa) pa.setAttribute('style', artStyle());
      const im = pa ? pa.querySelector('.partimg') : null;
      if (im) { im.style.objectFit = artFit(artfit); im.style.transform = 'scale(' + artZoom(artz) + ')'; }
      // a video backdrop is framed with the same numbers, so Zoom and the fit chips work on it too
      const am = m.querySelector('#epprev .amv');
      if (am) {
        am.style.setProperty('--amvz', artZoom(artz));
        am.style.setProperty('--amvfit', artFit(artfit));
        am.style.setProperty('--artx', artx + '%');
        am.style.setProperty('--arty', arty + '%');
      }
    };
    const bindArt = () => {
      const pa = m.querySelector('#epprev .part');
      const amvEl = m.querySelector('#epprev .amv');
      if (amvEl) { amvEl.style.pointerEvents = 'auto'; amvEl.style.cursor = amv ? 'grab' : ''; }
      if (!pa || pa.__dg) return;
      pa.__dg = 1; pa.style.pointerEvents = 'auto'; pa.style.cursor = art ? 'grab' : '';
      let dg = null;
      pa.addEventListener('pointerdown', e => {
        if (!art) return;
        dg = { x: e.clientX, y: e.clientY, ax: artx, ay: arty };
        pa.classList.add('dragging'); try { pa.setPointerCapture(e.pointerId); } catch (err) {}
      });
      pa.addEventListener('pointermove', e => {
        if (!dg) return;
        const r = pa.getBoundingClientRect();
        artx = Math.min(100, Math.max(0, Math.round(dg.ax - (e.clientX - dg.x) / Math.max(1, r.width) * 150)));
        arty = Math.min(100, Math.max(0, Math.round(dg.ay - (e.clientY - dg.y) / Math.max(1, r.height) * 150)));
        paintArt();
      });
      const end = () => { dg = null; pa.classList.remove('dragging'); };
      pa.addEventListener('pointerup', end); pa.addEventListener('pointercancel', end);
      pa.addEventListener('wheel', e => {
        if (!art) return;
        e.preventDefault();
        artz = Math.min(300, Math.max(100, artz + (e.deltaY < 0 ? 5 : -5)));
        paintArt(); showArt();
        const zr = m.querySelector('#partz'); if (zr) zr.value = artz;
        const zv = m.querySelector('#partzv'); if (zv) zv.textContent = artz + '%';
      }, { passive: false });
    };
    /* dragging a video backdrop shifts it exactly like a picture */
    const bindAmvDrag = () => {
      const el = m.querySelector('#epprev .amv'); if (!el || el.__dg) return;
      el.__dg = 1; el.style.pointerEvents = 'auto'; el.style.cursor = 'grab';
      let dg = null;
      el.addEventListener('pointerdown', e => {
        dg = { x: e.clientX, y: e.clientY, ax: artx, ay: arty };
        el.classList.add('dragging'); try { el.setPointerCapture(e.pointerId); } catch (err) {}
      });
      el.addEventListener('pointermove', e => {
        if (!dg) return;
        const r = el.getBoundingClientRect();
        artx = Math.min(100, Math.max(0, Math.round(dg.ax - (e.clientX - dg.x) / Math.max(1, r.width) * 150)));
        arty = Math.min(100, Math.max(0, Math.round(dg.ay - (e.clientY - dg.y) / Math.max(1, r.height) * 150)));
        paintArt();
      });
      const up = () => { dg = null; el.classList.remove('dragging'); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    };
    /* A big window for framing a video backdrop: the real card, its own Zoom + fit, drag, reset. */
    let frameW = null;
    const closeFrame = () => { if (frameW) { frameW.remove(); frameW = null; } };
    function bindFrameDrag(fw, paint) {
      const am = fw.querySelector('#fwbox .amv'); if (!am || am.__fdg) return;
      am.__fdg = 1; am.style.touchAction = 'none';
      const sync = () => {
        const e1 = m.querySelector('#epprev .amv');
        if (e1) { e1.style.setProperty('--artx', artx + '%'); e1.style.setProperty('--arty', arty + '%'); }
      };
      let dg = null;
      am.addEventListener('pointerdown', e => {
        dg = { x: e.clientX, y: e.clientY, ax: artx, ay: arty };
        am.classList.add('dragging'); try { am.setPointerCapture(e.pointerId); } catch (err) {}
      });
      am.addEventListener('pointermove', e => {
        if (!dg) return;
        const r = am.getBoundingClientRect();
        artx = Math.min(100, Math.max(0, Math.round(dg.ax - (e.clientX - dg.x) / Math.max(1, r.width) * 150)));
        arty = Math.min(100, Math.max(0, Math.round(dg.ay - (e.clientY - dg.y) / Math.max(1, r.height) * 150)));
        am.style.setProperty('--artx', artx + '%'); am.style.setProperty('--arty', arty + '%');
        sync();
      });
      const up = () => { dg = null; am.classList.remove('dragging'); };
      am.addEventListener('pointerup', up); am.addEventListener('pointercancel', up);
      am.addEventListener('wheel', e => {
        e.preventDefault();
        artz = Math.min(300, Math.max(100, artz + (e.deltaY < 0 ? 5 : -5)));
        paint();
      }, { passive: false });
    }
    const openFrame = () => {
      if (!amv) return;
      closeFrame();
      const fw = document.createElement('div'); fw.className = 'modal editp amvfw'; frameW = fw;
      fw.innerHTML = `<div class="card">
        <div class="row" style="margin:0 0 8px"><h2 style="flex:1;margin:0">Frame your video backdrop</h2><button class="x" data-fx aria-label="Close">×</button></div>
        <small class="mut">Drag the video, zoom it, and pick how it fills the card — this is exactly what your profile shows.</small>
        <div class="fwbox" id="fwbox"></div>
        <div class="row artopts"><small style="min-width:70px">Backdrop fit</small><button type="button" class="chip" data-ff="cover">Fill the card</button><button type="button" class="chip" data-ff="contain">Whole video</button><button type="button" class="chip" data-ff="fill">Stretch</button></div>
        <div class="row"><small style="min-width:70px">Zoom</small><input type="range" id="fwz" min="100" max="300" step="5" value="${artz}" style="flex:1"><b id="fwzv" style="min-width:46px;text-align:right">${artz}%</b></div>
        <small class="mut" id="fwnote"></small>
        <div class="row" style="margin-top:10px"><button type="button" class="btn alt" data-fxr>Reset</button><button type="button" class="btn" data-fxd style="flex:1">Done</button></div>
      </div>`;
      document.body.append(fw);
      const paint = () => {
        const box = fw.querySelector('#fwbox'), src = m.querySelector('#epprev');
        // the whole card element is cloned (not just its insides), so the backdrop area
        // keeps the exact size and position it has on a real profile
        const html = src ? src.outerHTML.replace('id="epprev"', 'id="fwcard"') : '';
        if (box && html && box.__h !== html) { box.innerHTML = html; box.__h = html; }
        const am = box ? box.querySelector('.amv') : null;
        if (am) {
          am.style.pointerEvents = 'auto'; am.style.cursor = 'grab';
          am.style.setProperty('--amvz', artZoom(artz));
          am.style.setProperty('--amvfit', artFit(artfit));
          am.style.setProperty('--artx', artx + '%');
          am.style.setProperty('--arty', arty + '%');
        }
        fw.querySelectorAll('[data-ff]').forEach(x => x.classList.toggle('on', x.dataset.ff === artfit));
        const zr = fw.querySelector('#fwz'); if (zr && +zr.value !== artz) zr.value = artz;
        const zv = fw.querySelector('#fwzv'); if (zv) zv.textContent = artz + '%';
        const nt = fw.querySelector('#fwnote');
        if (nt) nt.textContent = artfit === 'contain'
          ? 'Whole video keeps every pixel, but leaves empty bars — Fill the card covers everything.'
          : artfit === 'fill'
            ? 'Stretch fills the card, but the video can look squashed.'
            : 'Fill the card covers everything — drag and zoom to choose which part shows.';
        paintArt();
        const e2 = m.querySelector('#partz'); if (e2) e2.value = artz;
        const e3 = m.querySelector('#partzv'); if (e3) e3.textContent = artz + '%';
        bindFrameDrag(fw, paint);
      };
      fw.onclick = e => {
        if (e.target === fw || e.target.hasAttribute('data-fx') || e.target.closest('[data-fxd]')) return closeFrame();
        const ff = e.target.closest('[data-ff]');
        if (ff) { artfit = ff.dataset.ff; refresh(); return paint(); }
        if (e.target.closest('[data-fxr]')) { artfit = 'cover'; artz = 100; artx = 50; arty = 50; refresh(); return paint(); }
      };
      fw.querySelector('#fwz').oninput = e => { artz = +e.target.value; paint(); };
      paint();
    };
    const sizePrev = () => {
      const w = m.querySelector('.epwrap'), el = m.querySelector('#epprev'); if (!w || !el) return;
      // the preview is the card at its own width - no scaling, so nothing gets cropped off
      el.style.transform = '';
      w.style.height = '';
    };
    const previewData = () => ({
      ...p,
      dn: m.querySelector('#pdn').value || '',
      pron: m.querySelector('#ppron').value.trim(),
      status: m.querySelector('#pstat').value,
      emoji: emo, bio: m.querySelector('#pbio').value,
      av, banner: ban, banr, art, artfit, artz, artx, arty,
      amv, amvo: amo, deco, nfx, bfx, pfx, pack: pk, pch: '', pchv, pchl: pchl.slice(), pchs: pchsz,
      accent: acc || p.accent || '', acc2: acc2 || '', ctheme: themed ? 1 : 0
    });
    const refresh = () => {
      const el = m.querySelector('#epprev'); if (!el) return;
      el.className = 'card epcard' + (themed ? ' themed' : '') + (banr === '169' ? ' ban169' : '') + pkCls(pk);
      el.style.setProperty('--ac', acc || '#f5b84b'); el.style.setProperty('--ac2', acc2 || acc || '#f5b84b');
      setHtml(el, card(previewData()));
      setHtml(el.querySelector('.pav'), avBox(av));
      sizePrev(); bindArt(); bindAmvDrag(); mountBadges(el, previewData());
      m.querySelectorAll('[data-af]').forEach(x => x.classList.toggle('on', x.dataset.af === artfit));
      m.querySelectorAll('[data-br]').forEach(x => x.classList.toggle('on', (x.dataset.br === '169') === (banr === '169')));
      m.querySelectorAll('[data-bd]').forEach(x => x.classList.toggle('on', pchl.includes(x.dataset.bd)));
      const pb = m.querySelector('[data-do="pchrm"]'); if (pb) pb.hidden = !pchl.length;
      const lst = m.querySelector('#pchlist');
      if (lst) setHtml(lst, pchl.map((v, i) => {
        const own = isOwn(v), s = own ? v : (ACC_IMG[v] || ''), nm2 = own ? (s.startsWith('blob:') ? 'Uploading…' : 'Yours') : (v === 'zoro' ? 'Zoro' : v === 'zerotwo' ? 'Zero Two' : 'Katana');
        return `<button type="button" class="chip on pchone" data-pchx="${i}" title="Remove ${esc(nm2)}">${s ? `<img src="${esc(s)}" alt="">` : ''}<span>${i + 1}. ${esc(nm2)}</span>×</button>`;
      }).join(''));
      const szr = m.querySelector('#pchsz'), szv = m.querySelector('#pchszv');
      if (szr) {
        szr.value = pchsz;
        szr.oninput = () => { pchsz = Math.min(230, Math.max(60, Math.round(+szr.value || 126))); if (szv) szv.textContent = pchsz + 'px'; refresh(); };
      }
      const pn = m.querySelector('#partnote');
      if (pn) pn.textContent = !art
        ? 'Upload a backdrop and frame it here: it always fills the card, so no empty strip is left.'
        : artfit === 'contain'
          ? 'Whole picture keeps the art complete, but leaves empty bars top and bottom - pick Fill the card to cover everything.'
          : artfit === 'fill'
            ? 'Stretch covers the card, but your art can look squashed.'
            : 'Fill the card covers everything - drag the zoom (' + artz + '%) to choose the framing.';
      const zr = m.querySelector('#partz'); if (zr && +zr.value !== artz) zr.value = artz;
      const zv = m.querySelector('#partzv'); if (zv) zv.textContent = artz + '%';
      const cur = { deco, nfx, bfx, pfx };
      m.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x.dataset.v === cur[x.dataset.k]));
      m.querySelectorAll('.banset').forEach(x => x.classList.toggle('on', x.dataset.b === ban));
      m.querySelector('[data-do="banrm"]').hidden = !ban;
      m.querySelector('[data-do="avrm"]').hidden = !av;
      m.querySelector('[data-do="acc2rm"]').hidden = !acc2;
      m.querySelector('[data-do="artrm"]').hidden = !art && !amv;
      const acb = m.querySelector('[data-do="artcrop"]');
      if (acb) acb.hidden = !art || /\.(mp4|webm)(\?|$)/i.test(String(art));
      const vfb = m.querySelector('[data-do="amvframe"]');
      if (vfb) vfb.hidden = !amv;
      const zn = m.querySelector('#partnote');
      if (zn && !art && amv) zn.textContent = 'Your backdrop is a video: set how it fills the card with the fit buttons, then Zoom (or scroll on the preview) and drag it to frame it.';
      m.querySelector('[data-do="amvrm"]').hidden = !amv;
      if (fxOn !== pfx) { if (fxStop) fxStop(); fxStop = startFx(el, pfx); fxOn = pfx; }
    };
    const upload = async (file, kind) => {
      const isAv = kind === 'av', isAmv = kind === 'amv', isPch = kind === 'pch', lim = isAv ? 2097152 : isAmv ? 26 * 1048576 : isPch ? 3145728 : 6291456, note = m.querySelector('#pupnote');
      if (file.size > lim) return alert(`That file is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${lim / 1048576} MB for ${isAv ? 'avatars' : isAmv ? 'edit videos' : 'banners'}. Try shrinking it (or use a shorter edit).`);
      note.textContent = 'Uploading...';
      // Show the picture from the local file straight away, then swap in the server address
      // when it lands - waiting for the round trip is what made the preview feel dead.
      const local = URL.createObjectURL(file);
      const prevUrl = isAv ? av : kind === 'art' ? art : isAmv ? amv : isPch ? pchv : ban;
      if (isAv) av = local; else if (kind === 'art') art = local; else if (isAmv) amv = local; else if (isPch) { pchv = local; pchl = pchl.concat(local); } else ban = local;
      refresh();
      const job = fetch('/huzz-hunter/api/pmedia?kind=' + kind, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-pass': pass }, body: file }).then(x => x.json());
      jobs.push(job.catch(() => null));
      try {
        const r = await job;
        if (!r || !r.url) throw new Error((r && r.error) || 'the upload failed');
        if (isAv) av = r.url; else if (kind === 'art') art = r.url; else if (isPch) { pchv = r.url; pchl = pchl.map(v => (v === local ? r.url : v)).filter((v, i, a2) => a2.indexOf(v) === i); } else if (isAmv) { amv = r.url; const i = m.querySelector('#pamv'); if (i) i.value = r.url; } else ban = r.url;
        URL.revokeObjectURL(local);
        note.textContent = (isAmv ? 'Your edit is ready and will play with sound - hit Save.' : 'Animated ' + (isAv ? 'avatar' : kind === 'art' ? 'backdrop' : 'banner') + ' ready - hit Save.');
        refresh();
      } catch (err) {
        // put the old picture back so the preview never keeps a broken blob
        if (isAv) av = prevUrl; else if (kind === 'art') art = prevUrl; else if (isPch) { pchv = prevUrl; pchl = pchl.filter(v => v !== local); } else if (isAmv) amv = prevUrl; else ban = prevUrl;
        URL.revokeObjectURL(local); refresh();
        note.textContent = 'Photos open a crop + zoom editor. Animated GIF / WebP / APNG upload as they are (avatars up to 2 MB, banners up to 6 MB).';
        alert('Could not upload that: ' + (err && err.message ? err.message : 'try again'));
      }
    };
    const pickFile = kind => {
      const old = m.querySelector('#pfile'); if (old) old.remove();
      const f = document.createElement('input');
      f.type = 'file'; f.accept = kind === 'amv' ? 'video/mp4,video/webm' : kind === 'art' ? 'image/*,video/mp4,video/webm' : 'image/*'; f.id = 'pfile';
      f.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
      m.append(f);
      f.onchange = async () => {
        const file = f.files && f.files[0];
        f.remove();
        if (!file) return;
        const isVid = /^video\/(mp4|webm)$/.test(file.type) || /\.(mp4|webm)$/i.test(file.name);
        if (kind === 'amv') return isVid ? upload(file, kind) : alert('Pick an mp4 or webm video.');
        // A video dropped on the backdrop uploader becomes the video backdrop, so its music plays too.
        if (isVid && kind === 'art') return upload(file, 'amv');
        if (!/^image\//.test(file.type)) return alert('Pick an image file (png, jpg, webp or gif).');
        if (kind === 'art') {
          if (await isAnimated(file)) return upload(file, kind);
          // Frame the backdrop exactly like a profile picture: drag + zoom with the result in
          // front of you, and the crop already fills the card, so nothing is left empty.
          return cropper(file, 'art', d => {
            if (!d) return;
            art = d; artfit = 'cover'; artz = 100; artx = 50; arty = 50; artr = '';
            refresh();
            const blob = dataBlob(d);
            if (blob) upload(blob, 'art');
          }, {});
        }
        if (kind === 'pch') return upload(file, 'pch');
        if (await isAnimated(file)) return upload(file, kind);
        cropper(file, kind, d => {
          if (!d) return;
          if (kind === 'av') av = d; else ban = d;
          refresh();
          const blob = dataBlob(d);
          if (blob) upload(blob, kind);
        }, { ratio: banr === '169' ? 16 / 9 : 4 });
      };
      f.click();
    };
    m.onclick = e => {
      if (e.target === m || e.target.hasAttribute('data-x')) return m.remove();
      const ch = e.target.closest('[data-k]');
      if (ch) { const k = ch.dataset.k, v = ch.dataset.v; if (k === 'deco') deco = v; if (k === 'nfx') nfx = v; if (k === 'bfx') bfx = v; if (k === 'pfx') pfx = v; pk = ''; m.querySelectorAll('.pack').forEach(x => x.classList.remove('on')); return refresh(); }
      const bd = e.target.closest('[data-bd]');
      if (bd) {
        const k = bd.dataset.bd;
        if (!['katana', 'zoro', 'zerotwo'].includes(k)) return;
        pchl = pchl.includes(k) ? pchl.filter(v => v !== k) : pchl.concat(k).slice(0, 8);
        return refresh();
      }
      const px = e.target.closest('[data-pchx]');
      if (px) { pchl = pchl.filter((_, i) => i !== +px.dataset.pchx); return refresh(); }
      const af = e.target.closest('[data-af]'), ar = e.target.closest('[data-ar]'), br = e.target.closest('[data-br]');
      if (br) { banr = br.dataset.br === '169' ? '169' : ''; return refresh(); }
      if (af) { artfit = af.dataset.af; return refresh(); }
      if (ar) return;
      const em = e.target.closest('[data-e]'), b = e.target.closest('[data-b]'), a = e.target.closest('[data-do]');
      if (em) { emo = em.dataset.e; m.querySelectorAll('.emo').forEach(x => x.classList.toggle('on', x.dataset.e === emo)); return refresh(); }
      if (b) { ban = ban === b.dataset.b ? '' : b.dataset.b; return refresh(); }
      if (!a) return;
      const act = a.dataset.do;
      if (act === 'banrm') { ban = ''; refresh(); }
      if (act === 'avrm') { av = ''; refresh(); }
      if (act === 'amvframe') { openFrame(); return; }
      if (act === 'pchup') { pickFile('pch'); return; }
      if (act === 'pchrm') { pchl = []; pchv = ''; refresh(); return; }
      if (act === 'artrm') { art = ''; amv = ''; const ai = m.querySelector('#pamv'); if (ai) ai.value = ''; refresh(); }
      if (act === 'artcrop') {
        if (!art) return;
        const note2 = m.querySelector('#pupnote');
        if (note2) note2.textContent = 'Loading your backdrop...';
        fetch(art).then(r => r.blob()).then(b => {
          if (note2) note2.textContent = 'Drag and zoom inside the frame, then hit ✓.';
          const f = new File([b], 'backdrop.png', { type: b.type && /^image\//.test(b.type) ? b.type : 'image/png' });
          cropper(f, 'art', d => {
            if (!d) return;
            art = d; artfit = 'cover'; artz = 100; artx = 50; arty = 50;
            refresh();
            const blob = dataBlob(d);
            if (blob) upload(blob, 'art');
          }, {});
        }).catch(() => (window.hhToast || alert)('Could not load the current backdrop.'));
        return;
      }
      if (act === 'amvset') {
        const v = m.querySelector('#pamv').value.trim();
        if (!v) { amv = ''; refresh(); return; }
        if (!amvOk(v)) { (window.hhToast || alert)('Paste a full http(s) link — YouTube or an mp4/webm file.'); return; }
        amv = v; refresh();
        (window.hhToast || alert)(ytId(v) ? 'YouTube edit ready — open your profile to see it, hit the speaker for sound.' : 'Video backdrop ready — hit Save.');
        return;
      }
      if (act === 'amvrm') { amv = ''; const i = m.querySelector('#pamv'); if (i) i.value = ''; refresh(); }
      if (act === 'acc2rm') { acc2 = ''; refresh(); }
      if (act === 'avup' || act === 'banup' || act === 'artup' || act === 'amvup') pickFile(act === 'avup' ? 'av' : act === 'artup' ? 'art' : act === 'amvup' ? 'amv' : 'ban');
    };
    let tmr = 0;
    const liveRefresh = () => { clearTimeout(tmr); tmr = setTimeout(refresh, 140); };
    m.querySelector('#pdn').oninput = liveRefresh;
    m.querySelector('#ppron').oninput = liveRefresh;
    m.querySelector('#pbio').oninput = liveRefresh;
    m.querySelector('#pstat').oninput = liveRefresh;
    m.querySelector('#pacc').oninput = e => { acc = e.target.value; refresh(); };
    m.querySelector('#pacc2').oninput = e => { acc2 = e.target.value; refresh(); };
    m.querySelector('#pamo').oninput = e => { amo = +e.target.value; const lb = m.querySelector('#epamv .amv'); if (lb) lb.style.setProperty('--amo', (amvPct(amo) / 100).toFixed(2)); };
    /* keep the framed part of the card in view, so the zoom is visible even in a small preview */
    const showArt = () => {
      const box = m.querySelector('#epbox'), pa = m.querySelector('#epprev .part');
      if (!box || !pa || box.scrollHeight <= box.clientHeight + 4) return;
      const want = Math.max(0, pa.offsetTop - 6);
      if (box.scrollTop < want - 10 || box.scrollTop > want + 10) box.scrollTop = want;
    };
    m.querySelector('#partz').oninput = e => {
      artz = +e.target.value; paintArt(); showArt();
      const zv = m.querySelector('#partzv'); if (zv) zv.textContent = artz + '%';
    };
    m.querySelector('#pcth').onchange = e => { themed = e.target.checked; refresh(); };
    m.querySelector('#psave').onclick = async () => {
      const btn = m.querySelector('#psave'); btn.disabled = true; btn.textContent = 'Saving...';
      if (jobs.length) { try { await Promise.all(jobs); } catch (err) {} }
      try {
        const r = await api('/huzz-hunter/api/profile', {
          dn: m.querySelector('#pdn').value, pron: m.querySelector('#ppron').value,
          status: m.querySelector('#pstat').value, emoji: emo, bio: m.querySelector('#pbio').value,
          accent: acc || '', acc2: acc2 || '', ctheme: themed ? 1 : 0, banner: ban, av, deco, nfx, bfx, pfx, pack: pk,
          art, artfit, artz, artx, arty, artr: '', banr, amv, amvo: amo, pch: '', pchv, pchl: pchl.slice(), pchs: pchsz
        });
        if (r.error) throw new Error(r.error);
        // A signed-out request answers with an empty body, so check ok: without this the
        // editor used to close as if it had saved and the profile silently stayed empty.
        if (!r.ok) throw new Error('the server did not accept the save — refresh and sign in again');
        PCACHE.delete(String(me).toLowerCase());
        m.remove(); openProfile(me);
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Save profile';
        alert('Could not save your profile: ' + (err && err.message ? err.message : 'the request failed') + '\n\nIf you added a big image, try a smaller one.');
      }
    };
    refresh();
    /* The preview can get out of the way: drag the grip at its bottom edge to size it, or
       press the chevron to fold it down to the title bar. The size is remembered. */
    (() => {
      const box = m.querySelector('#epbox'), wp = m.querySelector('#epwrap');
      const grip = m.querySelector('#epgrip'), mini = m.querySelector('#epmini');
      if (!box || !wp) return;
      const rng = m.querySelector('#epsize');
      const set = h => {
        h = Math.max(0, Math.round(h));
        box.style.maxHeight = h + 'px';
        if (rng && +rng.value !== h) rng.value = h;
        try { localStorage.setItem('hh.eph', String(h)); } catch (err) {}
        return h;
      };
      let saved = 0;
      try { saved = +localStorage.getItem('hh.eph') || 0; } catch (err) {}
      set(saved && saved > 60 ? saved : 340);
      if (rng) rng.oninput = () => {
        wp.classList.remove('mini');
        if (mini) mini.textContent = '▾';
        set(+rng.value);
      };
      if (mini) mini.onclick = () => {
        const on = wp.classList.toggle('mini');
        mini.textContent = on ? '▴' : '▾';
        mini.title = on ? 'Expand the preview' : 'Shrink the preview';
      };
      if (grip) {
        let st = null;
        grip.addEventListener('pointerdown', e => {
          st = { y: e.clientY, h: box.getBoundingClientRect().height };
          try { grip.setPointerCapture(e.pointerId); } catch (err) {}
          document.body.style.userSelect = 'none';
        });
        grip.addEventListener('pointermove', e => {
          if (!st) return;
          const h = Math.max(0, Math.min(1200, st.h + (e.clientY - st.y)));
          if (h < 90 && st.h > 0) { wp.classList.add('mini'); const mi = m.querySelector('#epmini'); if (mi) mi.textContent = '▴'; return; }
          wp.classList.remove('mini'); const mi = m.querySelector('#epmini'); if (mi) mi.textContent = '▾';
          set(h);
        });
        const stop = () => { st = null; document.body.style.userSelect = ''; };
        grip.addEventListener('pointerup', stop); grip.addEventListener('pointercancel', stop);
        grip.addEventListener('dblclick', () => set(300));
        let ms = null;
        const mv = e => {
          if (!ms) return;
          const h = Math.max(0, Math.min(1200, ms.h + (e.clientY - ms.y)));
          if (h < 90) { wp.classList.add('mini'); if (mini) mini.textContent = '▴'; return; }
          wp.classList.remove('mini'); if (mini) mini.textContent = '▾';
          set(h);
        };
        const up = () => {
          ms = null; document.body.style.userSelect = '';
          document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        };
        grip.addEventListener('mousedown', e => {
          e.preventDefault();
          ms = { y: e.clientY, h: box.getBoundingClientRect().height };
          document.body.style.userSelect = 'none';
          document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
        });
      }
    })();
  }

  function paintML() {
    document.querySelectorAll('#ml [data-m]').forEach(b => {
      const q = PPL[b.dataset.m] || {};
      // the member list wears the same pack as the profile, like Discord's themed rows
      b.className = 'mr' + (b.classList.contains('off') ? ' off' : '') + pkCls(q.pack);
      const nt = npText(NP[b.dataset.m]);
      b.innerHTML = avHtml(b.dataset.m, 'sm')
        + `<span class="mr-t"><span class="mr-n">${nameHtml(dnOf(b.dataset.m), q.nfx, q.acc, q.acc2)}`
        + (nt ? `<span class="mnp${NP[b.dataset.m].p ? '' : ' off'}" title="Music Assistant">${NP[b.dataset.m].p ? '🎧' : '⏸'}</span>` : '')
        + (q.bot ? ' <span class="pbot">BOT</span>' : '') + '</span>'
        + (nt ? `<span class="mr-np" title="${esc(nt)}">${esc(nt.slice(2).trim())}</span>` : '') + '</span>';
      const rc = window.hhRoleColor ? window.hhRoleColor(b.dataset.m) : '';
      b.classList.toggle('rolec', !!rc);
      if (rc) { b.style.setProperty('--role', rc); const nmEl = b.querySelector('.nm'); if (nmEl) nmEl.classList.add('rolec'); }
      else b.style.removeProperty('--role');
    });
  }
  window.hhPaintML = paintML;
  function paintMe() {
    const el = document.getElementById('me'); if (!el || !me) return;
    el.innerHTML = `<button class="mecard">${avHtml(me, 'sm')}<span><b>${nameHtml(dnOf(me), (PPL[me] || {}).nfx, (PPL[me] || {}).acc, (PPL[me] || {}).acc2)}</b><small>@${esc(me)} · profile</small></span></button><button class="meedit" type="button" title="Change display name" aria-label="Change display name">✎</button>`;
    el.querySelector('.mecard').onclick = () => openProfile(me);
    el.querySelector('.meedit').onclick = () => window.hhQuickDn && window.hhQuickDn();
  }

  /* avatars on chat messages */
  const _am5 = addMsg;
  addMsg = function (m) {
    _am5(m);
    const el = $('#msgs').lastElementChild; if (!el) return;
    el.dataset.pn = m.name;
    if (m.ts) el.dataset.ts = m.ts; // the day separators and read receipts both read this

    const av = el.querySelector('.av'), src = avOf(m.name);
    if (av && src) { av.classList.add('avi'); av.style.background = 'transparent'; av.innerHTML = `<img src="${src}" alt="">`; }
    const dc = decoOf(m.name).trim(); if (av && dc) av.classList.add(...dc.split(' '));
    const pp = PPL[m.name] || {}, nEl = el.querySelector('.n');
    if (nEl && pp.nfx) nEl.innerHTML = nameHtml(nEl.textContent, pp.nfx, pp.acc, pp.acc2);
    const rc = window.hhRoleColor ? window.hhRoleColor(m.name) : '';
    if (nEl && rc) { nEl.style.setProperty('--role', rc); nEl.classList.add('rolec'); }
  };
  $('#msgs').addEventListener('click', e => {
    const av = e.target.closest('.m .av'); if (!av) return;
    const row = av.closest('.m'); if (row && row.dataset.pn) openProfile(row.dataset.pn);
  });
  /* clicking someone's face in the member list opens their profile (names still open the mention menu) */
  /* warm the card + backdrop on hover / keyboard focus, before the click lands */
  const preName = t => {
    const el = t && t.closest && t.closest('[data-pn],[data-m]'); if (!el) return;
    const n = el.dataset.pn || el.dataset.m;
    if (n && n !== me) preProf(n);
  };
  document.addEventListener('pointerover', e => preName(e.target), { passive: true });
  document.addEventListener('focusin', e => preName(e.target));
  const ml = document.getElementById('ml');
  if (ml) ml.addEventListener('click', e => {
    const av = e.target.closest('[data-m] .av'); if (!av) return;
    e.stopPropagation(); openProfile(av.closest('[data-m]').dataset.m);
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal.prof, .modal.editp').forEach(x => x.remove()); });

  const attach = () => {
    es.addEventListener('init', e => {
      const d = JSON.parse(e.data); PPL = d.people || {}; NP = d.np || {};
      warmPeople();
      preProf(me);
      /* my own card is opened most, so its backdrop is fetched and decoded right away */
      { const a = (PPL[me] || {}).art; if (a) warmArt(a); }
      fetchProf(me).then(p => { if (p) { warmArt(p.art); warmArt(p.banner); } }).catch(() => {});
      paintMe(); paintML(); if (view === 'chat') renderMsgs();
    });
    es.addEventListener('people', e => { PPL = JSON.parse(e.data); warmPeople(); paintMe(); paintML(); if (view === 'chat') renderMsgs(); });
    es.addEventListener('np', e => {
      NP = JSON.parse(e.data) || {};
      paintML();
      document.querySelectorAll('.modal.prof').forEach(m => paintNp(m, m.dataset.pn));
      if (window.hhRenderDMSide) window.hhRenderDMSide();
      if (window.hhSyncDM) window.hhSyncDM();
    });
    es.addEventListener('users', () => paintML());
    es.addEventListener('online', () => paintML());
  };
  const _c5 = connect;
  connect = function () { _c5(); attach(); };
  if (es) attach();
})();

/* ---- part 6: server icons and names, plus the phone layout (drawers instead of a squeezed sidebar) ---- */
(function () {
  const isMobile = () => innerWidth <= 780;
  const activeSrv = () => localStorage.hs || 'home';

  window.srvIcon = (s, k) => {
    const ic = s.icon || '';
    if (ic.startsWith('data:image/')) return `<img class="srv-img" src="${ic}" alt="">`;
    if (ic) return esc(ic);
    return esc((s.name || '').slice(0, 2).toUpperCase() || (k === 'rag' ? '📚' : 'HH'));
  };

  /* scrim behind the mobile drawers */
  const scrim = document.createElement('div'); scrim.id = 'scrim';
  document.body.append(scrim);
  const closeDrawers = () => document.body.classList.remove('drawer-open', 'members-open', 'dmside-open');
  window.hhCloseDrawers = closeDrawers;
  scrim.onclick = closeDrawers;

  /* hamburger in the chat header (phone only) */
  const hb = document.createElement('button');
  hb.id = 'drawerbtn'; hb.className = 'x only-mobile'; hb.textContent = '☰'; hb.setAttribute('aria-label', 'Channels');
  const head = document.querySelector('#v-chat header');
  if (head) {
    head.prepend(hb);
    hb.onclick = () => { document.body.classList.toggle('drawer-open'); document.body.classList.remove('members-open'); };
  }

  /* member list becomes a drawer on phones */
  const ml = document.getElementById('ml'), mlb = document.getElementById('mlb');
  function syncML() {
    if (!ml) return;
    if (isMobile()) ml.hidden = false;
    else { ml.hidden = localStorage.hml === '0'; document.body.classList.remove('members-open'); }
  }
  if (mlb) mlb.onclick = () => {
    if (isMobile()) { document.body.classList.toggle('members-open'); document.body.classList.remove('drawer-open'); }
    else { ml.hidden = !ml.hidden; localStorage.hml = ml.hidden ? '0' : '1'; }
  };
  syncML();
  addEventListener('resize', () => { syncML(); if (!isMobile()) closeDrawers(); });

  /* a drawer can never get stuck open on a phone: switching views, tapping the chat, or Esc closes it */
  document.addEventListener('pointerdown', e => {
    if (!isMobile()) return;
    const b = document.body.classList;
    if (!b.contains('drawer-open') && !b.contains('members-open') && !b.contains('dmside-open')) return;
    if (e.target.closest('aside,#ml,#rail,#scrim,#drawerbtn,#mlb,#pm,#dmside,#dlbtn,.modal')) return;
    closeDrawers();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawers(); });
  const _show = window.show;
  if (typeof _show === 'function') window.show = function (v) { closeDrawers(); return _show.apply(this, arguments); };

  /* picking a channel, member or server closes the drawer */
  document.addEventListener('click', e => { if (e.target.closest('#chs .ch, .nav .ch, .dmp .ch, #ml .mr, #rail .srv:not(.dmb)')) closeDrawers(); });

  /* square server icon, downscaled in the browser */
  function shrinkIcon(file, cb) {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const w = img.width, h = img.height, s = Math.min(w, h), c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      const webp = c.toDataURL('image/webp', 0.85);
      cb(webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); cb(''); };
    img.src = url;
  }

  function openServerEdit(k) {
    const s = (window.hhLayout || {})[k];
    if (!s) return alert('Servers are still loading. Try again in a second.');
    const old = document.querySelector('.modal.srvedit'); if (old) old.remove();
    let icon = s.icon || '';
    const pv = () => (icon.startsWith('data:image/') ? `<img class="srv-img" src="${icon}" alt="">` : esc(icon || (s.name || '').slice(0, 2).toUpperCase()));
    const m = document.createElement('div'); m.className = 'modal srvedit';
    m.innerHTML = `<div class="card">
      <div class="row" style="margin:0 0 10px"><h2 style="flex:1;margin:0">Server settings</h2><button class="x" data-x aria-label="Close">×</button></div>
      <small>Server name</small>
      <input class="in" id="srvname" maxlength="24" value="${esc(s.name || '')}">
      <small>Icon — the round button on the far left</small>
      <div class="row"><span class="srv big" id="srvpv">${pv()}</span><button type="button" class="btn alt" data-do="up">Upload image</button><button type="button" class="btn alt" data-do="rm"${icon ? '' : ' hidden'}>Remove</button></div>
      <small>Or use up to 3 letters / an emoji</small>
      <input class="in" id="srvtext" maxlength="4" placeholder="HH" value="${esc(icon.startsWith('data:') ? '' : icon)}">
      <small>Stickers and custom emoji — the 😊 picker's set, shared by the whole server</small>
      <div class="stklist" id="srvstk"></div>
      <button type="button" class="btn alt" data-do="addstk">+ Add a sticker</button>
      <small>Invite people — send them this link, or just the code</small>
      <div class="row"><input class="in" id="srvinv" readonly placeholder="Press Invite to make a link" style="flex:1;min-width:0"><button type="button" class="btn" data-do="inv">Invite</button></div>
      <button type="button" class="btn alt" data-do="leave">Leave this server</button>
      <button class="btn" id="srvsave" style="margin-top:14px;width:100%">Save server</button>
    </div>`;
    document.body.append(m);
    const setIcon = v => { icon = v; m.querySelector('#srvpv').innerHTML = pv(); m.querySelector('[data-do="rm"]').hidden = !v; };
    const drawStk = (map) => {
      const list = Object.entries(map || (window.hhStickers ? window.hhStickers() : {}));
      m.querySelector('#srvstk').innerHTML = list.length
        ? list.map(([n, d]) => `<span class="stki"><img src="${d}" alt=""><span>:${esc(n)}:</span><button type="button" class="x" data-del="${esc(n)}" title="Delete :${esc(n)}:" aria-label="Delete sticker ${esc(n)}">✕</button></span>`).join('')
        : '<small class="csub">No custom stickers yet.</small>';
    };
    drawStk();
    m.onclick = async e => {
      if (e.target === m || e.target.hasAttribute('data-x')) return m.remove();
      const del = e.target.closest('[data-del]');
      if (del) {
        const n = del.dataset.del; del.disabled = true;
        const r = await (window.hhDelSticker ? window.hhDelSticker(n) : { error: 'Reload the page first.' });
        if (!r || !r.ok) { del.disabled = false; return alert((r && r.error) || 'Could not delete that sticker.'); }
        return drawStk(r.stickers);
      }
      const a = e.target.dataset.do;
      if (a === 'addstk') return window.hhAddSticker && window.hhAddSticker();
      if (!a) return;
      if (a === 'inv') {
        const btn = e.target; btn.disabled = true;
        const r = await api('/huzz-hunter/api/server/invite', { srv: k });
        btn.disabled = false;
        if (r.error) return alert(r.error);
        const link = location.origin + location.pathname + '?invite=' + r.code;
        m.querySelector('#srvinv').value = link;
        try { await navigator.clipboard.writeText(link); btn.textContent = 'Copied'; } catch { btn.textContent = 'Ready'; }
        setTimeout(() => { if (btn.isConnected) btn.textContent = 'Invite'; }, 2000);
        return;
      }
      if (a === 'leave') {
        if (e.target.dataset.ok !== '1') {
          e.target.dataset.ok = '1'; e.target.textContent = 'Press again to leave';
          const self = e.target;
          setTimeout(() => { if (self.isConnected) { self.dataset.ok = ''; self.textContent = 'Leave this server'; } }, 2600);
          return;
        }
        e.target.disabled = true;
        const r = await api('/huzz-hunter/api/server/leave', { srv: k });
        if (r.error) { e.target.disabled = false; e.target.dataset.ok = ''; e.target.textContent = 'Leave this server'; return alert(r.error); }
        m.remove(); localStorage.removeItem('hs'); location.reload();
        return;
      }
      if (a === 'rm') { setIcon(''); m.querySelector('#srvtext').value = ''; }
      if (a === 'up') {
        const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
        f.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
        m.append(f);
        f.onchange = () => {
          const file = f.files && f.files[0]; f.remove();
          if (!file) return;
          shrinkIcon(file, d => {
            if (!d) return alert('That file could not be read as an image.');
            if (d.length > 190000) return alert('That image is too heavy. Try a smaller or simpler picture.');
            setIcon(d); m.querySelector('#srvtext').value = '';
          });
        };
        f.click();
      }
    };
    m.querySelector('#srvtext').oninput = e => { if (e.target.value.trim()) setIcon(e.target.value.trim()); };
    m.querySelector('#srvsave').onclick = async () => {
      const btn = m.querySelector('#srvsave'); btn.disabled = true; btn.textContent = 'Saving...';
      try {
        const r = await api('/huzz-hunter/api/server', { srv: k, title: m.querySelector('#srvname').value, icon });
        if (r.error) throw new Error(r.error);
        m.remove();
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Save server';
        alert('Could not save the server: ' + (err && err.message ? err.message : 'request failed'));
      }
    };
  }
  window.openServerEdit = openServerEdit;
})();

/* ---- part 7: live coinflip room — one server-decided flip everyone watches together, chat underneath ---- */
(function () {
  const main = document.querySelector('main');
  if (!main || document.getElementById('v-coin')) return;
  /* the coin lives in the Miscellaneous server as #coinflip — part 8 opens it from there */
  window.hhOpenCoin = () => { show('coin'); load(); };

  const sec = document.createElement('section');
  sec.id = 'v-coin'; sec.className = 'v'; sec.hidden = true;
  sec.innerHTML = `<div class="card">
      <div class="crow">
        <div><b>Coinflip</b><small class="csub">The server picks the side, so everyone in here watches the same flip land at the same moment.</small></div>
        <span class="clive">live</span>
      </div>
      <div class="cstage"><div class="coin" id="coin"><i class="cfh">H</i><i class="cft">T</i></div></div>
      <div class="cres" id="coinres">Call it, then flip.</div>
      <div class="crow cbtns"><button class="btn alt" data-call="heads">Heads</button><button class="btn alt" data-call="tails">Tails</button><button class="btn" data-call="">Just flip</button></div>
      <div class="cboard" id="coinboard"></div>
    </div>
    <div class="card" style="margin-top:12px"><b>Recent flips</b><ul class="chist" id="coinhist"></ul></div>
    <div class="card" style="margin-top:12px">
      <div class="crow"><b>Room chat</b><small class="csub">Settle the call here while it spins.</small></div>
      <div class="cmsgs" id="coinmsgs"></div>
      <form class="crow cform" id="coinform"><input class="in" id="cointext" maxlength="200" placeholder="Say something…" aria-label="Coin chat message"><button class="btn" type="submit">Send</button></form>
    </div>`;
  main.append(sec);

  const $ = s => sec.querySelector(s);
  const coin = $('#coin');
  let hist = [], chat = [], turns = 0, gate = 0;
  const fmt = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  function drawBoard(s) {
    const rows = Object.entries(s || {}).sort((a, b) => (b[1].w - a[1].w) || (a[1].l - b[1].l));
    $('#coinboard').innerHTML = rows.length
      ? rows.map(([n, v]) => `<span class="cchip"><b>${esc(n)}</b> ${v.w}W–${v.l}L${v.run > 1 ? ` <em>🔥${v.run}</em>` : ''}</span>`).join('')
      : '<small class="csub">No calls yet — be the first.</small>';
  }
  function drawHist() {
    $('#coinhist').innerHTML = hist.length
      ? hist.map(r => `<li><span class="cside">${r.side === 'heads' ? 'H' : 'T'}</span> <b>${esc(r.by)}</b> <span class="csub">${r.call ? `called ${r.call} · ${r.call === r.side ? '<em class="cwin">won</em>' : '<em class="closs">lost</em>'}` : 'flipped'}</span> <small class="csub" style="margin-left:auto">${fmt(r.at)}</small></li>`).join('')
      : '<li class="csub">No flips yet.</li>';
  }
  function drawChat() {
    const box = $('#coinmsgs');
    box.innerHTML = chat.length
      ? chat.map(m => `<div class="cm"><span class="cmn">${esc(m.n)}</span> <span class="cmt">${esc(m.t)}</span> <small>${fmt(m.at)}</small></div>`).join('')
      : '<small class="csub">Nothing said yet.</small>';
    box.scrollTop = box.scrollHeight;
  }
  function settle(r) {
    const who = r.by === me ? 'You' : r.by;
    $('#coinres').innerHTML = r.call
      ? `${esc(who)} called <b>${r.call}</b> → <b class="cs-${r.side}">${r.side === 'heads' ? 'HEADS' : 'TAILS'}</b> ${r.call === r.side ? '<em class="cwin">✓ won</em>' : '<em class="closs">✗ lost</em>'}`
      : `${esc(who)} flipped → <b class="cs-${r.side}">${r.side === 'heads' ? 'HEADS' : 'TAILS'}</b>`;
  }
  const angle = (side, extra) => (turns += extra, turns * 360 + (side === 'tails' ? 180 : 0));
  function spin(r) {
    gate = Date.now() + 1600;
    coin.style.transition = 'transform 1.5s cubic-bezier(.15,.75,.25,1)';
    coin.style.transform = `rotateY(${angle(r.side, 5)}deg)`;
    $('#coinres').textContent = `${r.by === me ? 'You' : r.by} ${r.call ? `called ${r.call}` : 'flipped'}…`;
    setTimeout(() => settle(r), 1550);
  }
  function landed(r) {
    coin.style.transition = 'none';
    coin.style.transform = `rotateY(${angle(r.side, 0)}deg)`;
    settle(r);
  }
  function arrive(r) {
    const wait = r.at - Date.now();
    if (wait > 900) return landed(r);
    setTimeout(() => spin(r), Math.max(0, wait));
  }
  let tries = 0;
  async function load() {
    try {
      const d = await get('/huzz-hunter/api/coin');
      tries = 0;
      hist = d.hist || []; chat = d.chat || [];
      drawHist(); drawChat(); drawBoard(d.stats);
      if (d.last) arrive(d.last);
    } catch (e) { if (tries++ < 3) setTimeout(load, 700); }
  }
  sec.addEventListener('click', async e => {
    const c = e.target.dataset.call;
    if (c === undefined) return;
    if (Date.now() < gate) return;
    gate = Date.now() + 2200;
    try {
      const r = await api('/huzz-hunter/api/coin', { call: c });
      if (r.error) throw new Error(r.error);
      drawBoard(r.stats);
    } catch (err) {
      gate = 0;
      alert('Could not flip: ' + (err && err.message ? err.message : 'try again'));
    }
  });
  $('#coinform').onsubmit = async e => {
    e.preventDefault();
    const inp = $('#cointext'), t = inp.value.trim();
    if (!t) return;
    inp.value = '';
    try { const r = await api('/huzz-hunter/api/coin/chat', { text: t }); if (r.error) alert(r.error); }
    catch (err) { alert('Message did not send.'); }
  };

  function wire() {
    if (!es || es.__coinWired) return;
    es.__coinWired = 1;
    es.addEventListener('coin', e => {
      const d = JSON.parse(e.data);
      hist.unshift(d.round); hist = hist.slice(0, 12);
      drawHist(); drawBoard(d.stats); arrive(d.round);
    });
    es.addEventListener('coinchat', e => {
      chat.push(JSON.parse(e.data)); chat = chat.slice(-60);
      if (!sec.hidden) drawChat();
    });
  }
  wire();
  const _connect = connect;
  connect = function () { _connect(); wire(); };
})();

/* ---- part 8: Miscellaneous server — watch party (synced video) + screen share ---- */
(function () {
  const main = document.querySelector('main'), chs = document.querySelector('#chs');
  if (!main || document.getElementById('v-watch')) return;

  const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }, { urls: ['turn:100.123.64.57:3478?transport=udp', 'turn:100.123.64.57:3478?transport=tcp', 'turn:server.tail6d2374.ts.net:3478?transport=udp'], username: 'huzz', credential: 'huzz-turn-3478' }] };
  const stage = document.createElement('div'); stage.id = 'stage'; stage.hidden = true; document.body.append(stage);
  const sigS = (to, data) => api('/huzz-hunter/api/signal', { to, data: { s: 1, ...data } });
  let share = null, screen = {}, vpcs = {}, hpcs = {};

  function tile(name, stream) {
    let el = document.getElementById('st-' + name);
    if (!el) {
      el = document.createElement('div'); el.id = 'st-' + name; el.className = 'stile';
      el.innerHTML = '<video autoplay playsinline muted></video><b></b><button type="button" aria-label="Close">✕</button>';
      el.querySelector('button').onclick = () => {
        const pc = vpcs[name]; if (pc) { pc.close(); delete vpcs[name]; }
        el.remove(); if (!stage.children.length) stage.hidden = true;
      };
      stage.append(el);
    }
    const vid = el.querySelector('video');
    vid.srcObject = stream;
    /* double-click a shared screen for real browser fullscreen (Esc returns) */
    vid.title = 'Double-click for fullscreen';
    vid.ondblclick = () => { const p = vid.requestFullscreen ? vid.requestFullscreen() : null; if (p && p.catch) p.catch(() => {}); };
    el.querySelector('b').textContent = name === me ? 'You are sharing' : name + ' is sharing';
    stage.hidden = false;
    return el;
  }

  async function startShare(room) {
    if (share) return;
    let st;
    try { st = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false }); }
    catch (e) { alert('Screen share needs https and a click on the screen picker. Nothing was shared.'); return; }
    share = { room, stream: st };
    tile('me', st);
    const track = st.getVideoTracks()[0];
    if (track) track.onended = () => stopShare();
    await api('/huzz-hunter/api/screen', { room, on: true });
  }
  async function stopShare() {
    if (!share) return;
    const { room, stream } = share; share = null;
    stream.getTracks().forEach(t => t.stop());
    Object.keys(hpcs).forEach(k => { hpcs[k].close(); delete hpcs[k]; });
    const el = document.getElementById('st-me'); if (el) el.remove();
    if (!stage.children.length) stage.hidden = true;
    await api('/huzz-hunter/api/screen', { room, on: false });
  }
  window.hhToggleShare = room => (share ? stopShare() : startShare(room));

  async function offerTo(peer) {
    if (!share) return;
    try {
      if (hpcs[peer]) { hpcs[peer].close(); delete hpcs[peer]; }
      const pc = hpcs[peer] = new RTCPeerConnection(ICE); pc.q = [];
      share.stream.getTracks().forEach(t => pc.addTrack(t, share.stream));
      pc.onicecandidate = e => { if (e.candidate) sigS(peer, { c: e.candidate }); };
      await pc.setLocalDescription(await pc.createOffer());
      sigS(peer, { d: pc.localDescription });
    } catch (e) {}
  }
  const want = host => { if (!vpcs[host]) sigS(host, { want: 1 }); };
  const pend = {};

  async function onScreenSignal(from, data) {
    try {
      /* Voice-channel signals share this event; only screen-share ones carry the `s` flag, and
         answering the audio offers here used to build a second, useless connection. */
      if (!data || !data.s) return;
      if (data.want) { if (share) await offerTo(from); return; }
      /* an answer or a candidate must land on the connection that made the offer */
      let pc = hpcs[from] || vpcs[from];
      if (!pc) {
        if (data.c) { (pend[from] = pend[from] || []).push(data.c); return; }
        if (!data.d || data.d.type !== 'offer') return;
        pc = vpcs[from] = new RTCPeerConnection(ICE); pc.q = [];
        pc.onicecandidate = e => { if (e.candidate) sigS(from, { c: e.candidate }); };
        pc.ontrack = e => tile(from, e.streams[0]);
      }
      if (data.d) {
        await pc.setRemoteDescription(data.d);
        (pend[from] || []).forEach(c => pc.addIceCandidate(c).catch(() => {}));
        delete pend[from];
        pc.q.forEach(c => pc.addIceCandidate(c).catch(() => {}));
        pc.q = [];
        if (data.d.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); sigS(from, { d: pc.localDescription }); }
      } else if (data.c) { if (pc.remoteDescription) await pc.addIceCandidate(data.c); else pc.q.push(data.c); }
    } catch (e) {}
  }

  const sec = document.createElement('section');
  sec.id = 'v-watch'; sec.className = 'v'; sec.hidden = true;
  sec.innerHTML = `<div class="card">
      <div class="crow"><div><b>Watch party</b><small class="csub">Paste a YouTube link or a direct .mp4 — everyone jumps to the same second, so you can watch and still do your own work.</small></div><span class="clive">live</span></div>
      <div class="crow wload"><input class="in" id="wurl" placeholder="https://youtube.com/watch?v=…   or   https://…/movie.mp4" aria-label="Video link"><button class="btn" id="wgo">Load</button></div>
      <div class="wstage" id="wstage"></div>
      <div class="crow wctl"><button class="btn alt" data-w="-10">−10s</button><button class="btn" id="wplay">Play</button><button class="btn alt" data-w="10">+10s</button><button class="btn alt" id="wsync">Sync</button><button class="btn alt" id="wshare">Share screen</button></div>
      <p class="csub" id="wstat">Nothing loaded yet.</p>
    </div>
    <div class="card" style="margin-top:12px"><b>Watch chat</b><div class="cmsgs" id="wmsgs"></div>
      <form class="crow cform" id="wform"><input class="in" id="wtext" maxlength="200" placeholder="Say something…" aria-label="Watch chat message"><button class="btn" type="submit">Send</button></form>
    </div>`;
  main.append(sec);

  const $ = s => sec.querySelector(s);
  const W = { url: '', t: 0, playing: false, at: 0, by: '' };
  let yt = null, vet = null, curUrl = '', ytLoading = false, tries = 0, wchat = [];
  const ytid = u => { const m = String(u || '').match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{8,})/); return m ? m[1] : ''; };
  const posOf = w => (w.t || 0) + (w.playing ? Math.max(0, Date.now() - (w.at || 0)) / 1000 : 0);
  const clock = s => { s = Math.max(0, Math.floor(s)); const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0, x = s % 60; return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };

  function myRooms() {
    const r = [];
    const v = window.hhVC && window.hhVC();
    if (v) r.push(v);
    if (!sec.hidden) r.push('watchparty');
    return r;
  }
  function applyScreen() {
    const mine = myRooms();
    const active = [];
    Object.entries(screen || {}).forEach(([room, s]) => {
      if (!mine.includes(room)) return;
      if (s.by === me) { if (!share) api('/huzz-hunter/api/screen', { room, on: false }); }
      else { active.push(s.by); want(s.by); }
    });
    /* the sharer stopped (or left): drop their tile and connection */
    Object.keys(vpcs).forEach(p => {
      if (active.includes(p)) return;
      vpcs[p].close(); delete vpcs[p];
      const el = document.getElementById('st-' + p); if (el) el.remove();
    });
    if (!stage.children.length) stage.hidden = true;
  }

  function loadYT(cb) {
    if (window.YT && window.YT.Player) return cb();
    if (ytLoading) { const t = setInterval(() => { if (window.YT && window.YT.Player) { clearInterval(t); cb(); } }, 250); return; }
    ytLoading = true;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api';
    s.onload = () => loadYT(cb);
    s.onerror = () => { $('#wstat').textContent = 'YouTube did not load — check the connection.'; };
    document.head.append(s);
  }
  function mount(url) {
    curUrl = url; const box = $('#wstage'); box.innerHTML = ''; yt = null; vet = null;
    const id = ytid(url);
    if (id) {
      const d = document.createElement('div'); d.id = 'ytp'; box.append(d);
      loadYT(() => { try { yt = new YT.Player('ytp', { videoId: id, playerVars: { controls: 0, rel: 0, playsinline: 1 }, events: { onReady: () => apply() } }); } catch (e) {} });
    } else if (/^https?:\/\//i.test(url)) {
      const v = document.createElement('video');
      v.src = url; v.playsInline = true; v.controls = false; v.preload = 'auto';
      v.onloadedmetadata = () => apply();
      box.append(v); vet = v;
    }
  }
  function apply() {
    const pos = posOf(W);
    if (yt && yt.seekTo) {
      const c = (yt.getCurrentTime && yt.getCurrentTime()) || 0;
      if (Math.abs(c - pos) > 1.5) yt.seekTo(pos, true);
      if (W.playing) yt.playVideo(); else yt.pauseVideo();
    } else if (vet) {
      if (Math.abs(vet.currentTime - pos) > 1.5) vet.currentTime = pos;
      if (W.playing) vet.play().catch(() => {}); else vet.pause();
    }
    $('#wplay').textContent = W.playing ? 'Pause' : 'Play';
    $('#wstat').textContent = W.url ? (W.by || 'someone') + ' · ' + (W.playing ? 'playing' : 'paused') + ' at ' + clock(pos) : 'Nothing loaded yet.';
  }
  function onWatch(w) {
    if (!w || !w.url) return;
    Object.assign(W, w);
    if (W.url !== curUrl) { $('#wurl').value = W.url; mount(W.url); }
    apply();
  }
  function send(t, playing) {
    if (!W.url) return alert('Load a video first.');
    api('/huzz-hunter/api/watch', { url: W.url, t, playing }).then(r => { if (r && r.error) alert(r.error); });
  }
  $('#wgo').onclick = () => {
    const u = $('#wurl').value.trim();
    if (!u) return;
    api('/huzz-hunter/api/watch', { url: u, t: 0, playing: true }).then(r => { if (r && r.error) alert(r.error); });
  };
  $('#wplay').onclick = () => send(posOf(W), !W.playing);
  sec.querySelectorAll('[data-w]').forEach(b => b.onclick = () => send(Math.max(0, posOf(W) + +b.dataset.w), W.playing));
  $('#wsync').onclick = apply;
  $('#wshare').onclick = () => window.hhToggleShare('watchparty');
  $('#wform').onsubmit = async e => {
    e.preventDefault();
    const inp = $('#wtext'), t = inp.value.trim();
    if (!t) return;
    inp.value = '';
    try { const r = await api('/huzz-hunter/api/watch/chat', { text: t }); if (r.error) alert(r.error); }
    catch (err) { alert('Message did not send.'); }
  };
  function drawWChat() {
    const box = $('#wmsgs');
    box.innerHTML = wchat.length
      ? wchat.map(m => `<div class="cm"><span class="cmn">${esc(m.n)}</span> <span class="cmt">${esc(m.t)}</span> <small>${new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>`).join('')
      : '<small class="csub">Nothing said yet.</small>';
    box.scrollTop = box.scrollHeight;
  }
  async function loadWatch() {
    try {
      const d = await get('/huzz-hunter/api/watch');
      tries = 0; wchat = d.chat || []; drawWChat();
      if (d.watch) onWatch(d.watch);
    } catch (e) { if (tries++ < 3) setTimeout(loadWatch, 700); }
  }
  async function loadScreen() {
    if (!localStorage.htk) return;
    try { const d = await get('/huzz-hunter/api/screen'); screen = d.screen || {}; applyScreen(); } catch (e) {}
  }
  setInterval(() => { if (!sec.hidden) apply(); }, 4000);

  /* the misc tools open from their channels */
  if (chs) chs.addEventListener('click', e => {
    const b = e.target.closest('.ch'); if (!b) return;
    const label = ((b.querySelector('span') || b).textContent || '').replace(/^\s*#\s*/, '').trim();
    if (label === 'watchparty') { e.preventDefault(); e.stopPropagation(); document.body.classList.remove('drawer-open'); show('watch'); loadWatch(); loadScreen(); }
    else if (label === 'coinflip' && window.hhOpenCoin) { e.preventDefault(); e.stopPropagation(); document.body.classList.remove('drawer-open'); window.hhOpenCoin(); }
  }, true);

  function wire() {
    if (!es || es.__watchWired) return;
    es.__watchWired = 1;
    es.addEventListener('watch', e => onWatch(JSON.parse(e.data)));
    es.addEventListener('watchchat', e => { wchat.push(JSON.parse(e.data)); wchat = wchat.slice(-60); if (!sec.hidden) drawWChat(); });
    es.addEventListener('screen', e => { screen = JSON.parse(e.data) || {}; applyScreen(); });
    es.addEventListener('signal', e => { const d = JSON.parse(e.data); if (d && d.data && d.data.s) onScreenSignal(d.from, d.data); });
    es.addEventListener('init', e => { const d = JSON.parse(e.data); if (d.screen) { screen = d.screen; applyScreen(); } });
  }
  wire();
  setTimeout(loadScreen, 900);
  const _connect = connect;
  connect = function () { _connect(); wire(); };
})();

/* ---- part 9: create servers, delete channels, Discord-style roles with colours ---- */
(function () {
  let ROLES = {}, RMEM = {}, ROWN = {}, BANS = {}, TMO = {};
  const toast = m => (window.hhToast || alert)(m);
  // the server the rail has highlighted — works no matter where the page keeps its own copy
  const railOn = () => { const b = document.querySelector('#rail .srv.on:not(.dmb):not(.gear)'); return b && b.dataset.k; };
  const curSrv = () => localStorage.hs || railOn() || 'home';
  const roleOf = u => { const k = curSrv(); const id = (RMEM[k] || {})[u]; return id ? (ROLES[k] || []).find(r => r.id === id) : null; };
  window.hhRoleColor = u => { const r = roleOf(u); return r ? r.color : ''; };
  window.hhRoles = () => ({ roles: ROLES, mem: RMEM, own: ROWN });
  /* role colours are painted by us, because the member list is rebuilt from scratch
     whenever someone comes online — that used to wipe the role class straight off. */
  function paintRoles() {
    document.querySelectorAll('#ml [data-m]').forEach(b => {
      const rc = window.hhRoleColor(b.dataset.m);
      b.classList.toggle('rolec', !!rc);
      if (rc) { b.style.setProperty('--role', rc); const n = b.querySelector('.nm'); if (n) n.classList.add('rolec'); }
      else b.style.removeProperty('--role');
    });
    document.querySelectorAll('#msgs .m').forEach(el => {
      const rc = window.hhRoleColor(el.dataset.pn || ''), n = el.querySelector('.n');
      if (!n) return;
      n.classList.toggle('rolec', !!rc);
      if (rc) n.style.setProperty('--role', rc);
    });
  }
  window.hhPaintRoles = paintRoles;
  function setRoleData(r) {
    if (!r) return;
    if (r.roles) ROLES = r.roles;
    if (r.mem) RMEM = r.mem;
    if (r.own) ROWN = r.own;
    if (r.bans) BANS = r.bans;
    if (r.timeouts) TMO = r.timeouts;
    paintRoles();
    if (window.hhPaintML) window.hhPaintML();
  }
  async function loadRoles() { if (!localStorage.htk) return; try { setRoleData(await get('/huzz-hunter/api/roles')); } catch (e) {} }
  const _rc9 = renderChans;
  renderChans = function () { _rc9(); paintRoles(); };
  const mlEl = document.getElementById('ml');
  if (mlEl) new MutationObserver(() => paintRoles()).observe(mlEl, { childList: true });
  const _c9 = connect;
  connect = function () { _c9(); es.addEventListener('roles', e => setRoleData(JSON.parse(e.data))); loadRoles(); };
  if (es) { es.addEventListener('roles', e => setRoleData(JSON.parse(e.data))); loadRoles(); }

  /* + button above the gear */
  const plus = document.createElement('button');
  plus.id = 'srvadd'; plus.type = 'button'; plus.className = 'srv plus'; plus.title = 'Create a server'; plus.textContent = '+';
  plus.onclick = () => openCreate();
  const railEl = document.getElementById('rail');
  const keepPlus = () => { if (railEl && !railEl.contains(plus)) railEl.insertBefore(plus, railEl.querySelector('.gear') || null); };
  keepPlus();
  if (railEl) new MutationObserver(keepPlus).observe(railEl, { childList: true });

  function openCreate() {
    document.querySelector('.modal.newserv')?.remove();
    const m = document.createElement('div'); m.className = 'modal newserv';
    m.innerHTML = `<div class="card">
      <div class="row" style="margin:0 0 10px"><h2 style="flex:1;margin:0">Create a server</h2><button type="button" class="x" data-x aria-label="Close">×</button></div>
      <small>Server name</small>
      <input class="in" id="nsname" maxlength="24" placeholder="Anime Hub">
      <small>Icon — up to 3 letters or an emoji</small>
      <input class="in" id="nsicon" maxlength="4" placeholder="AH">
      <small class="csub">You become the owner: only you can add or delete channels and roles.</small>
      <button class="btn" id="nsgo" style="margin-top:12px;width:100%">Create server</button>
    </div>`;
    document.body.append(m);
    m.onclick = async e => {
      if (e.target === m || e.target.closest('[data-x]')) return m.remove();
      if (!e.target.closest('#nsgo')) return;
      const name = m.querySelector('#nsname').value.trim();
      if (!name) return m.querySelector('#nsname').focus();
      const btn = m.querySelector('#nsgo'); btn.disabled = true; btn.textContent = 'Creating...';
      const r = await api('/huzz-hunter/api/server/new', { title: name, icon: m.querySelector('#nsicon').value.trim() });
      if (r.error) { btn.disabled = false; btn.textContent = 'Create server'; return toast(r.error); }
      m.remove(); toast('Server created — you own it.');
      setTimeout(() => { const b = document.querySelector('#rail .srv[data-k="' + r.key + '"]'); if (b) b.click(); }, 450);
    };
    setTimeout(() => { const f = m.querySelector('#nsname'); if (f) f.focus(); }, 60);
  }
  window.hhCreateServer = openCreate;

  /* channels + roles live inside the existing server-settings modal, owner only */
  const origEdit = window.openServerEdit;
  window.openServerEdit = function (k) {
    if (origEdit) origEdit(k);
    const modal = document.querySelector('.modal.srvedit');
    if (!modal) return;
    const card = modal.querySelector('.card'), save = card.querySelector('#srvsave');
    const box = card.querySelector('.srvadmin') || document.createElement('div');
    box.className = 'srvadmin';
    if (!box.isConnected) card.insertBefore(box, save);
    drawAdmin(box, k);
  };

  function drawAdmin(box, k) {
    const owner = ROWN[k] || '';
    const isOwner = !!owner && owner === me;
    const roles = ROLES[k] || [];
    const mem = RMEM[k] || {};
    const S = (window.hhLayout || {})[k] || { text: [], voice: [] };
    const people = Object.keys(window.hhPeople ? window.hhPeople() : {}).sort((a, b) => a.localeCompare(b));
    const tags = [...(S.text || []).map(c => ['#', c, 'text']), ...(S.voice || []).map(c => ['🔊', c, 'voice'])];
    box.innerHTML = `
      <small>Channels${isOwner ? ' — ✕ deletes (press twice)' : ''}</small>
      <div class="chanlist">${tags.map(([sig, c, kind]) => `<span class="chantag"><b>${sig}</b>${esc(c)}${isOwner ? `<button type="button" class="chdel" data-chdel="${esc(c)}" data-kind="${kind}" aria-label="Delete channel ${esc(c)}">✕</button>` : ''}</span>`).join('') || '<small class="csub">No channels.</small>'}</div>
      <small>Roles${owner && !isOwner ? ' — owned by ' + esc(owner) : ''} — a role colours that member’s name in this server</small>
      ${isOwner ? `<div class="roleadd"><input class="in" id="rname" maxlength="20" placeholder="Role name (Admin, Mod, VIP…)"><div class="row" style="gap:8px;align-items:center;margin-top:6px"><input type="color" id="rcol" value="#8b9dff" aria-label="Role colour"><button type="button" class="btn alt" data-do="addrole">+ Add role</button></div></div>` : ''}
      <div class="rolelist">${roles.length ? roles.map(r => `<div class="rolerow"><i style="background:${r.color}"></i><b style="color:${r.color}">${esc(r.name)}</b>${isOwner ? `<input type="color" value="${r.color}" data-rcol="${r.id}" aria-label="Colour of ${esc(r.name)}"><button type="button" class="rl-del" data-rl="${r.id}" aria-label="Delete role ${esc(r.name)}">✕</button>` : ''}</div>`).join('') : '<small class="csub">No roles yet.</small>'}</div>
      <small>Who has which role here</small>
      <div class="memroles">${people.length ? people.map(u => `<div class="memrow"><span class="memn">${esc(u)}</span><select data-ru="${esc(u)}"${isOwner ? '' : ' disabled'}><option value="">— no role —</option>${roles.map(r => `<option value="${r.id}"${mem[u] === r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>`).join('') : '<small class="csub">Nobody here yet.</small>'}</div>
      <small>Moderation — kick from this server, timeout, or ban from the site</small>
      <div class="modlist">${people.length ? people.map(u => {
        const t = TMO[k + '|' + String(u).toLowerCase()];
        const left = t ? Math.max(1, Math.round((t.until - Date.now()) / 60000)) : 0;
        const isBan = !!BANS[String(u).toLowerCase()];
        return `<div class="memrow modrow"><span class="memn">${esc(u)}${left ? ` <em class="toleft">${left}m muted</em>` : ''}${isBan ? ' <em class="banleft">banned</em>' : ''}</span><button type="button" class="mbtn" data-kick="${esc(u)}"${isOwner ? '' : ' disabled'}>Kick</button><select class="msel" data-to="${esc(u)}"${isOwner ? '' : ' disabled'}><option value="">Timeout…</option><option value="5">5 min</option><option value="30">30 min</option><option value="60">1 hour</option><option value="1440">1 day</option><option value="0">Clear timeout</option></select><button type="button" class="mbtn${isBan ? ' on' : ''}" data-ban="${esc(u)}"${isOwner ? '' : ' disabled'}>${isBan ? 'Unban' : 'Ban'}</button></div>`;
      }).join('') : '<small class="csub">Nobody here yet.</small>'}</div>`;
    box.onclick = async e => {
      if (!isOwner) return;
      const add = e.target.closest('[data-do="addrole"]'), del = e.target.closest('[data-rl]'), chd = e.target.closest('[data-chdel]');
      let r = null;
      if (add) {
        const nmIn = box.querySelector('#rname'), name = nmIn.value.trim();
        if (!name) return nmIn.focus();
        r = await api('/huzz-hunter/api/role/new', { srv: k, rname: name, color: box.querySelector('#rcol').value });
        if (r.error) return toast(r.error);
        setRoleData(r); return drawAdmin(box, k);
      }
      if (del) { r = await api('/huzz-hunter/api/role/del', { srv: k, id: del.dataset.rl }); if (r.error) return toast(r.error); setRoleData(r); return drawAdmin(box, k); }
      const kb = e.target.closest('[data-kick]'), bb = e.target.closest('[data-ban]');
      if (kb) {
        r = await api('/huzz-hunter/api/mod/kick', { srv: k, user: kb.dataset.kick });
        if (r.error) return toast(r.error);
        toast(kb.dataset.kick + ' is out of this server.');
        await loadRoles(); return drawAdmin(box, k);
      }
      if (bb) {
        const u = bb.dataset.ban, isBan = !!BANS[String(u).toLowerCase()];
        if (!isBan && bb.dataset.ok !== '1') {
          bb.dataset.ok = '1'; bb.textContent = 'sure?';
          setTimeout(() => { if (bb.isConnected) { bb.dataset.ok = ''; bb.textContent = 'Ban'; } }, 2600);
          return;
        }
        r = await api(isBan ? '/huzz-hunter/api/mod/unban' : '/huzz-hunter/api/mod/ban', { user: u });
        if (r.error) return toast(r.error);
        toast(isBan ? u + ' can join again.' : u + ' is banned from the site.');
        await loadRoles(); return drawAdmin(box, k);
      }
      if (chd) {
        if (chd.dataset.ok !== '1') {
          chd.dataset.ok = '1'; chd.textContent = 'sure?';
          setTimeout(() => { if (chd.isConnected) { chd.dataset.ok = ''; chd.textContent = '✕'; } }, 2600);
          return;
        }
        r = await api('/huzz-hunter/api/channel/del', { srv: k, channel: chd.dataset.chdel, kind: chd.dataset.kind });
        if (r.error) return toast(r.error);
        toast('Channel deleted.'); return drawAdmin(box, k);
      }
    };
    box.onchange = async e => {
      if (!isOwner) return;
      const tos = e.target.closest('[data-to]');
      if (tos) {
        const u = tos.dataset.to, mins = +tos.value || 0;
        const r = await api('/huzz-hunter/api/mod/timeout', { srv: k, user: u, mins });
        if (r.error) return toast(r.error);
        toast(mins ? u + ' timed out for ' + mins + ' min.' : 'Timeout cleared for ' + u + '.');
        tos.value = '';
        await loadRoles(); return drawAdmin(box, k);
      }
      const sel = e.target.closest('[data-ru]'), col = e.target.closest('[data-rcol]');
      if (sel) {
        const r = await api('/huzz-hunter/api/role/set', { srv: k, user: sel.dataset.ru, role: sel.value });
        if (r.error) return toast(r.error);
        setRoleData(r); toast(sel.value ? 'Role given to ' + sel.dataset.ru + '.' : 'Role removed from ' + sel.dataset.ru + '.');
      }
      if (col) {
        const r = await api('/huzz-hunter/api/role/edit', { srv: k, id: col.dataset.rcol, color: col.value });
        if (r.error) return toast(r.error);
        setRoleData(r); drawAdmin(box, k);
      }
    };
  }
})();

/* ===== part 11: read receipts ("seen by") + a full DM page ===== */
(function () {
  const low = v => String(v || '').toLowerCase();
  const meL = () => low(me);
  let READ = {}, lastMark = 0, headerExtra = null;

  /* who has read this channel up to ts (never you) */
  function readers(ch, ts) {
    const r = READ[ch] || {};
    return Object.keys(r).filter(u => +r[u] >= ts && low(u) !== meL());
  }

  /* Receipts stay quiet now: a small ⋯ appears on hover and says who has read the message. */
  function paintSeen() {
    const box = document.getElementById('msgs');
    if (!box) return;
    box.querySelectorAll('.mmore').forEach(e => e.remove());
    box.querySelectorAll('.seenpop').forEach(e => e.remove());
    const ch = cur;
    if (!ch) return;
    // several parts of the app rebuild a message row, so read the message itself rather than
    // trusting whatever attributes the last rebuild happened to keep.
    const byId = new Map((chans[ch] || []).map(m => [String(m.id || ''), m]));
    box.querySelectorAll('.m').forEach(el => {
      const msg = byId.get(String(el.dataset.id || ''));
      const ts = +((msg && msg.ts) || el.dataset.ts) || 0;
      const pn = (msg && msg.name) || el.dataset.pn || '';
      if (!ts || low(pn) !== meL()) return;
      if (Date.now() + (typeof skew === 'number' ? skew : 0) - ts < 1200) return; // still sending
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mmore'; b.textContent = '⋯';
      b.title = 'Seen info';
      b.setAttribute('aria-label', 'Who has seen this message');
      b.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); seenPop(b, ts); };
      el.append(b);
    });
  }

  /* the little panel behind ⋯: names + times, or "not seen yet" */
  function seenPop(btn, ts) {
    document.querySelectorAll('.seenpop').forEach(e => e.remove());
    const ch = cur, read = READ[ch] || {}, dm = String(ch || '').startsWith('dm:');
    const who = Object.keys(read)
      .filter(u => +read[u] >= ts && low(u) !== meL())
      .sort((a, b) => +read[a] - +read[b]);
    const when = v => new Date(+v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const el = document.createElement('div');
    el.className = 'seenpop';
    el.innerHTML = who.length
      ? '<b>Seen by ' + who.length + '</b>' + who.map(u => '<div class="sprow"><span>' + esc(u) + '</span><small>' + when(read[u]) + '</small></div>').join('')
      : '<b>' + (dm ? 'Not seen yet' : 'No one has seen this yet') + '</b><small>Sent ' + when(ts) + '</small>';
    document.body.append(el);
    const r = btn.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
    el.style.top = (r.bottom + 6 + h > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
    const close = ev => {
      if (ev && ev.type === 'keydown' && ev.key !== 'Escape') return;
      if (ev && ev.type === 'pointerdown' && el.contains(ev.target)) return;
      el.remove();
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', close, true);
    };
    setTimeout(() => {
      document.addEventListener('pointerdown', close, true);
      document.addEventListener('keydown', close, true);
    }, 0);
  }

  /* tell the server how far you have read in the channel you are looking at */
  function markRead(force) {
    const ch = cur;
    if (!ch || view !== 'chat' || document.hidden) return;
    const now = Date.now();
    if (!force && now - lastMark < 1200) return;
    lastMark = now;
    api('/huzz-hunter/api/read', { channel: ch, ts: now + (typeof skew === 'number' ? skew : 0) }).catch(() => {});
  }
  window.hhPaintSeen = paintSeen;
  /* receipts should also refresh when a tab comes back into view or the thread is scrolled */
  document.addEventListener('visibilitychange', () => { if (!document.hidden) markRead(true); });
  const msgsBox = document.getElementById('msgs');
  if (msgsBox) msgsBox.addEventListener('scroll', () => markRead(), { passive: true });

  /* ---- the DM page: conversations on the left, the thread takes the page ---- */
  const P = () => (window.hhPeople ? window.hhPeople() : {});
  const dnOf = u => (P()[u] || {}).dn || u;
  const dmPeer = k => {
    const o = String(k || '').slice(3).split('|').find(x => x !== meL()) || '';
    return Object.keys(P()).find(u => low(u) === o) || o;
  };
  let side = document.getElementById('dmside');
  if (!side) { side = document.createElement('div'); side.id = 'dmside'; document.body.append(side); }

  function backToServer() {
    let c = window.hhLastCh;
    if (!c || String(c).startsWith('dm:')) c = Object.keys(chans).find(k => !String(k).startsWith('dm:'));
    if (!c) { const L = window.hhLayout || {}; const k = Object.keys(L)[0]; c = k && L[k].text && L[k].text[0]; }
    if (!c) c = 'general';
    window.hhDmHome = false; document.body.classList.remove('dmhome');
    cur = c; unread[c] = 0; show('chat'); renderMsgs();
  }
  window.hhBackToServer = backToServer;

  function renderSide() {
    if (!side || !document.body.classList.contains('dmview')) return;
    const keys = Object.keys(chans).filter(k => String(k).startsWith('dm:'));
    const conv = keys.map(k => ({ k, o: dmPeer(k), un: unread[k] || 0 })).filter(c => c.o);
    const all = window.hhFr ? window.hhFr.all() : { friends: [], incoming: [] };
    const friends = (all.friends || []).filter(f => low(f) !== meL())
      .sort((a, b) => String(dnOf(a)).localeCompare(String(dnOf(b))));
    const reqs = all.incoming || [];
    const on = new Set(online || []);
    const av = o => '<span class="dpav">' + (window.hhAv ? window.hhAv(o, 'sm') : '') + (on.has(o) ? '<i class="dpon"></i>' : '') + '</span>';
    const npOf = o => (window.hhNpText ? window.hhNpText(o) : '');
    const who = (o, extra) => '<span class="dpwho"><b>' + esc(dnOf(o)) + '</b><small>@' + esc(o) + (on.has(o) ? ' · online' : '') + (extra || '') + '</small>'
      + (npOf(o) ? '<small class="dpnp" title="' + esc(npOf(o).slice(2).trim()) + '">' + esc(npOf(o)) + '</small>' : '') + '</span>';
    side.innerHTML = '<div class="dsh"><span>💬 Messages</span><button type="button" class="x" id="dsx" title="Back to the server" aria-label="Back to the server">×</button></div>'
      + (reqs.length
        ? '<div class="dslbl">Requests<i>' + reqs.length + '</i></div>' + reqs.map(u => '<div class="dsreq">' + who(u, ' · wants to be friends')
          + '<button type="button" class="dpok" data-acc="' + esc(u) + '">Accept</button><button type="button" class="dpno" data-dec="' + esc(u) + '" aria-label="Decline">✕</button></div>').join('')
        : '')
      + '<div class="dsadd"><input id="dsf" maxlength="24" placeholder="Add a friend by @name" aria-label="Friend name"><button type="button" class="btn" id="dsfr">Add</button></div>'
      + '<div class="dslbl">Friends<i>' + friends.length + '</i></div>'
      + '<div class="dsn">' + (friends.length
        ? friends.map(f => { const c = conv.find(x => low(x.o) === low(f)); return '<button type="button" class="dsrow' + (c && c.k === cur ? ' on' : '') + '" data-u="' + esc(f) + '">' + av(f) + who(f) + (c && c.un ? '<i class="dpun">' + c.un + '</i>' : '<span class="dpico">💬</span>') + '</button>'; }).join('')
        : '<small class="mut">No friends yet — add one above, or from a profile.</small>') + '</div>'
      + '<div class="dslbl">Conversations</div>'
      + '<div class="dsn">' + (conv.length
        ? conv.map(c => '<button type="button" class="dsrow' + (c.k === cur ? ' on' : '') + '" data-k="' + esc(c.k) + '">' + av(c.o) + who(c.o, c.un ? ' · ' + c.un + ' new' : '') + (c.un ? '<i class="dpun">' + c.un + '</i>' : '') + '</button>').join('')
        : '<small class="mut">No conversations yet — open a friend above.</small>') + '</div>'
      + '<div class="dsf"><small class="mut">Only friends can DM each other. Accept a request to start talking.</small>'
      + '<div class="dpad"><input id="dsq" placeholder="Search people" aria-label="Search people"><button type="button" class="btn alt" id="dsgo">DM</button></div></div>';
    const x = side.querySelector('#dsx'); if (x) x.onclick = backToServer;
    side.querySelectorAll('[data-u]').forEach(b => { b.onclick = () => { if (window.hhCloseDmSide) window.hhCloseDmSide(); if (window.hhOpenDM) window.hhOpenDM(b.dataset.u); }; });
    side.querySelectorAll('[data-k]').forEach(b => {
      b.onclick = () => { if (window.hhCloseDmSide) window.hhCloseDmSide(); window.hhDmHome = false; document.body.classList.remove('dmhome'); cur = b.dataset.k; unread[cur] = 0; show('chat'); renderMsgs(); const box = document.getElementById('box'); if (box) box.focus(); };
    });
    side.querySelectorAll('[data-acc]').forEach(b => {
      b.onclick = async () => {
        const r = await api('/huzz-hunter/api/friends/ok', { user: b.dataset.acc });
        if (r.error) return (window.hhToast || alert)(r.error);
        (window.hhToast || alert)('You and ' + b.dataset.acc + ' are friends now.');
        if (window.hhRefreshFriends) await window.hhRefreshFriends(); renderSide();
      };
    });
    side.querySelectorAll('[data-dec]').forEach(b => {
      b.onclick = async () => {
        await api('/huzz-hunter/api/friends/no', { user: b.dataset.dec });
        if (window.hhRefreshFriends) await window.hhRefreshFriends(); renderSide();
      };
    });
    const addBtn = side.querySelector('#dsfr'), addInp = side.querySelector('#dsf');
    if (addBtn) addBtn.onclick = async () => {
      const v = (addInp.value || '').trim().replace(/^@/, '');
      if (!v) return addInp.focus();
      const r = await api('/huzz-hunter/api/friends/req', { user: v });
      (window.hhToast || alert)(r.error || 'Friend request sent to ' + v + ' — you can DM once they accept.');
      if (!r.error) addInp.value = '';
      if (window.hhRefreshFriends) await window.hhRefreshFriends(); renderSide();
    };
    if (addInp) addInp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (addBtn) addBtn.click(); } };
    const go = side.querySelector('#dsgo'), q = side.querySelector('#dsq');
    if (go) go.onclick = () => {
      const v = (q.value || '').trim(); if (!v) return q.focus();
      const list = Object.keys(P());
      const hit = list.find(u => low(u) === low(v)) || list.find(u => low(dnOf(u)) === low(v)) || list.find(u => low(u).includes(low(v)));
      if (!hit) return (window.hhToast || alert)('No account with that name.');
      if (window.hhOpenDM) window.hhOpenDM(hit);
    };
    if (q) q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (go) go.click(); } };
  }
  window.hhRenderDMSide = renderSide;
  /* Phone: the DM list is a drawer too, otherwise a conversation could never be switched. */
  const dlb = document.createElement('button');
  dlb.id = 'dlbtn'; dlb.type = 'button'; dlb.className = 'x only-mobile'; dlb.textContent = '☰';
  dlb.setAttribute('aria-label', 'All direct messages');
  const dhead = document.querySelector('#v-chat header');
  if (dhead) {
    dhead.prepend(dlb);
    dlb.onclick = () => { document.body.classList.toggle('dmside-open'); if (document.body.classList.contains('dmside-open')) renderSide(); };
  }
  window.hhCloseDmSide = () => document.body.classList.remove('dmside-open');
  function showDmHome() {
    window.hhDmHome = true;
    document.body.classList.add('dmview', 'dmhome', 'dmside-open');
    renderSide();
    const t = document.getElementById('title'); if (t) t.textContent = 'Direct messages';
    const box = document.getElementById('msgs');
    if (box) box.innerHTML = '<div class="dmhomebox"><b>No conversation open</b><small>Pick a friend on the left, or add someone by @name. Only friends can DM each other.</small></div>';
    const h = document.getElementById('dmstatus'); if (h) h.textContent = 'pick a conversation';
  }
  /* the rail button and every "Message" entry point land here: the list is the page, so if
     there is a conversation it opens, otherwise the page itself works as the people picker */
  function openMessages() {
    if (cur && String(cur).startsWith('dm:')) { window.hhDmHome = false; document.body.classList.remove('dmhome'); show('chat'); renderMsgs(); return; }
    const conv = Object.keys(chans).filter(k => String(k).startsWith('dm:'));
    if (conv.length) {
      const pick = conv.map(k => ({ k, un: unread[k] || 0 })).sort((a, b) => b.un - a.un)[0].k;
      const peer = dmPeer(pick);
      if (peer) { window.hhDmHome = false; if (window.hhOpenDM) return window.hhOpenDM(peer); }
    }
    window.hhDmHome = false;
    showDmHome();
  }
  window.hhOpenMessages = openMessages;
  window.openDMsPanel = openMessages;

  function syncDM() {
    const dm = String(cur || '').startsWith('dm:') || !!window.hhDmHome;
    const wasHome = document.body.classList.contains('dmhome');
    document.body.classList.toggle('dmview', dm);
    document.body.classList.toggle('dmhome', !!window.hhDmHome);
    /* landing on the DM home (phone) should show the conversation list straight away */
    if (window.hhDmHome && !wasHome && isMobile()) document.body.classList.add('dmside-open');
    const head = document.querySelector('#v-chat header');
    if (head) {
      if (!document.getElementById('dmback')) {
        const b = document.createElement('button');
        b.id = 'dmback'; b.type = 'button'; b.className = 'x'; b.title = 'Back to the server'; b.textContent = '←';
        b.onclick = backToServer; head.prepend(b);
      }
      if (!headerExtra) { headerExtra = document.createElement('small'); headerExtra.id = 'dmstatus'; headerExtra.className = 'mut'; head.append(headerExtra); }
    }
    if (dm) {
      const peer = dmPeer(cur);
      const isOn = (online || []).some(u => low(u) === low(peer));
      const fr = window.hhFr ? window.hhFr.is(peer) : false;
      const npt = window.hhNpText ? window.hhNpText(peer) : '';
      if (headerExtra) headerExtra.textContent = (npt ? npt + ' · ' : '') + (fr ? 'friends' : 'not friends yet') + ' · ' + (isOn ? 'online' : 'offline') + ' · private DM';
      renderSide();
    } else if (headerExtra) headerExtra.textContent = '';
  }

  window.hhSyncDM = syncDM;

  const _rm = window.renderMsgs;
  if (typeof _rm === 'function') window.renderMsgs = function () {
    if (window.hhDmHome) return;
    if (cur && !String(cur).startsWith('dm:')) window.hhLastCh = cur;
    _rm.apply(this, arguments);
    paintSeen(); markRead(true); syncDM();
  };

  /* the rail button opens the DM page, or the people picker when there is no conversation yet */
  const dmBtn = document.getElementById('dmhome');
  if (dmBtn) {
    dmBtn.title = 'Direct messages';
    dmBtn.onclick = () => { if (window.openDMsPanel) window.openDMsPanel(); };
  }

  function attach(ev) {
    if (!ev) return;
    ev.addEventListener('init', e => {
      try { READ = JSON.parse(e.data).read || {}; } catch (err) { READ = {}; }
      paintSeen(); renderSide();
    });
    ev.addEventListener('read', e => {
      let d = null; try { d = JSON.parse(e.data); } catch (err) { return; }
      (READ[d.channel] = READ[d.channel] || {})[d.name] = d.ts;
      if (d.channel === cur) paintSeen();
    });
    ev.addEventListener('msg', () => setTimeout(() => { paintSeen(); markRead(); renderSide(); }, 80));
    ev.addEventListener('friends', () => setTimeout(renderSide, 80));
    ev.addEventListener('online', () => { if (document.body.classList.contains('dmview')) renderSide(); });
  }
  try { if (typeof es !== 'undefined' && es) attach(es); } catch (err) {}
  const _od = window.hhOpenDM;
  if (typeof _od === 'function') window.hhOpenDM = function () {
    window.hhDmHome = false; document.body.classList.remove('dmhome');
    return _od.apply(this, arguments);
  };
  const _c = window.connect;
  if (typeof _c === 'function') window.connect = function () { _c.apply(this, arguments); try { if (typeof es !== 'undefined' && es) attach(es); } catch (err) {} };
})();
/* ===== part 18: the music bot can sit in a voice channel, and /help lists what it does ===== */
(function () {
  const BOT = 'Music Assistant';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const time = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  async function post(path, body) {
    try {
      const r = await fetch('/huzz-hunter' + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-token': ls('htk'), 'x-pass': ls('hp') }, body: JSON.stringify(body || {}) });
      return await r.json().catch(() => ({}));
    } catch (e) { return {}; }
  }
  /* command replies are local: they never land in the channel for everybody else */
  function botSay(html) {
    // replies belong in the voice channel text chat, which is the only place the bot listens
    const vc = document.getElementById('v-vchat'), inVc = !!(vc && !vc.hidden);
    const box = inVc ? vc.querySelector('#vmsgs') : document.getElementById('msgs');
    if (!box) return;
    const el = document.createElement('div');
    if (inVc) {
      el.className = 'vm2 botline';
      el.innerHTML = '<span class="av" style="background:#7aa2f7">M</span><div class="vb"><b>' + BOT + '</b><small>bot · ' + time() + '</small><div>' + html + '</div></div>';
    } else {
      el.className = 'm';
      el.innerHTML = '<div class="av" style="background:#7aa2f7">M</div><div class="bw"><span class="n">' + BOT + '</span><span class="bot">bot</span><span class="t">' + time() + '</span><div class="b">' + html + '</div><div class="rx"></div></div>';
    }
    box.append(el); box.scrollTop = box.scrollHeight;
  }
  const vcList = () => {
    const L = window.hhLayout || {}, out = [];
    Object.values(L).forEach(s => (s && s.voice ? s.voice : []).forEach(v => { if (v && !out.includes(v)) out.push(v); }));
    // the sidebar always knows the voice channels, even before a layout event arrives
    document.querySelectorAll('.ch').forEach(b => {
      if (!b.querySelector('.vbot')) return;
      const sp = b.firstElementChild, n = (sp ? sp.textContent : '').replace(/^\W+/, '').trim();
      if (n && !out.includes(n)) out.push(n);
    });
    return out;
  };
  const help = () => botSay('<div class="bothelp"><b>What I do</b>'
    + '<small>' + BOT + ' is the house music bot. What is playing on Music Assistant shows up like Discord: cover art, track, artist, album and a live progress bar on profiles, the member list and the now-playing card.</small>'
    + '<b>Commands</b><table>'
    + '<tr><td>/help</td><td>this list</td></tr>'
    + '<tr><td>/join [voice channel]</td><td>bring me into a voice channel (default: the one you are in)</td></tr>'
    + '<tr><td>/leave</td><td>take me out of the voice channels</td></tr>'
    + '<tr><td>/play &lt;song&gt;</td><td>start a track on Music Assistant</td></tr>'
    + '<tr><td>/np</td><td>what is playing right now</td></tr>'
    + '<tr><td>/vc</td><td>which voice channels this server has</td></tr>'
    + '</table><b>Adding me to a voice channel</b>'
    + '<small>Hover a voice channel in the sidebar and press the 🎵 button, or type /join. Everyone sees me join, and I leave a line in that room\'s 💬 text chat.</small>'
    + '<small class="mut">Commands work only in a voice channel\'s 💬 text chat (this window) — not in the server text channels. These replies are only shown to you. Playback itself stays in Music Assistant.</small></div>');
  const join = async arg => {
    const list = vcList();
    let ch = arg ? list.find(v => v.toLowerCase() === arg.toLowerCase().replace(/^#/, '')) : '';
    if (!ch && !arg) ch = (window.hhVC && window.hhVC()) || (list.length === 1 ? list[0] : '');
    if (!ch && list.length) return botSay('Pick one: ' + list.map(v => '<b>#' + esc(v) + '</b>').join(', ') + ' — e.g. <b>/join ' + esc(list[0]) + '</b>.');
    if (!ch) return botSay('This server has no voice channel yet.');
    const r = await post('/api/bot/vc', { channel: ch });
    if (r.error) return botSay(esc(r.error));
    botSay('🎵 In <b>#' + esc(ch) + '</b> — type <b>/np</b> to see what is playing.');
  };
  const leave = async () => { await post('/api/bot/vc', { channel: null }); botSay('Left the voice channels. Type <b>/join</b> when you want me back.'); };
  const np = () => {
    const NP = (window.hhNP && window.hhNP()) || {}, s = NP[BOT];
    if (!s || !s.t) return botSay('Nothing is playing on Music Assistant right now.');
    const f = n => Math.floor(n / 60) + ':' + String(Math.max(0, Math.round(n)) % 60).padStart(2, '0');
    botSay('<b>' + esc(s.t) + '</b><br><small>' + esc([s.a, s.al].filter(Boolean).join(' · ') || 'Music Assistant') + '</small><br><small>'
      + (s.p ? '▶ playing' : '⏸ paused') + ' · ' + f(s.el || 0) + (s.dur ? ' / ' + f(s.dur) : '') + '</small>');
  };
  /* /play: the server asks Music Assistant to start the first match on its active player */
  const play = async arg => {
    if (!arg) return botSay('What should I play? e.g. <b>/play lofi beats</b>');
    botSay('🎧 Looking for <b>' + esc(arg) + '</b> on Music Assistant…');
    const r = await post('/api/bot/play', { q: arg });
    /* never claim a track is playing when the server did not actually confirm it */
    if (!r || !r.ok) return botSay('⚠️ ' + esc((r && r.error) || 'Music Assistant did not take that — check that you are signed in and try again.'));
    botSay('▶ <b>' + esc(r.t || arg) + '</b>' + (r.a ? ' — ' + esc(r.a) : '')
      + '<br><small>Playing on Music Assistant. <b>/np</b> shows the live progress.</small>');
  };
  const vcs = () => {
    const list = vcList();
    botSay(list.length ? 'Voice channels: ' + list.map(v => '<b>#' + esc(v) + '</b>').join(', ') + '. Use <b>/join channel</b>.' : 'This server has no voice channel yet.');
  };
  const run = t => {
    const parts = t.slice(1).trim().split(/\s+/), c = (parts[0] || '').toLowerCase(), arg = parts.slice(1).join(' ');
    if (c === 'help' || c === 'commands' || c === 'h') return help();
    if (c === 'join' || c === 'summon') return join(arg);
    if (c === 'leave' || c === 'bye') return leave();
    if (c === 'play' || c === 'p') return play(arg);
    if (c === 'np' || c === 'nowplaying' || c === 'music') return np();
    if (c === 'vc' || c === 'voice') return vcs();
    return botSay('I do not know <b>/' + esc(c) + '</b>. Type <b>/help</b>.');
  };
  window.hhBotVC = async ch => {
    const r = await post('/api/bot/vc', { channel: ch || null });
    if (window.hhToast) window.hhToast(r.error || (ch ? BOT + ' joined #' + ch : BOT + ' left the voice channels'));
  };
  window.hhBotCommand = run;

  const box = document.getElementById('box'), form = document.getElementById('send');
  if (form) {
    const orig = form.onsubmit;
    form.onsubmit = function (e) {
      const t = (box && box.value || '').trim();
      if (t.startsWith('/')) {
        e.preventDefault();
        if (box) { box.value = ''; box.style.height = ''; }
        (window.hhToast || alert)('Music Assistant sirf voice channel ke 💬 text chat mein commands leta hai — sidebar mein 🔊 channel par 💬 dabao.');
        return false;
      }
      return orig ? orig.apply(this, arguments) : undefined;
    };
  }
  if (box) box.addEventListener('keydown', e => { if (e.key === 'Tab' && !box.value) { e.preventDefault(); box.value = '/'; } });
})();
/* ---- part 25: a real daily diary + step-by-step plans, private per account, saved on the server ---- */
(function () {
  const broot = document.getElementById('dyroot'), proot = document.getElementById('plroot');
  if (!broot || !proot) return;
  const qs = () => '?name=' + encodeURIComponent(localStorage.hn || '') + '&p=' + encodeURIComponent(localStorage.hp || '');
  const hdr = () => ({ 'x-token': localStorage.htk || '', 'x-pass': localStorage.hp || '' });
  const jget = async (u, extra) => (await fetch('/huzz-hunter/api/' + u + qs() + (extra ? '&' + extra : ''), { headers: hdr() })).json();
  const jpost = async (u, b) => (await fetch('/huzz-hunter/api/' + u + qs(), { method: 'POST', headers: { 'Content-Type': 'application/json', ...hdr() }, body: JSON.stringify(b) })).json();
  const todayKey = () => new Date().toLocaleDateString('en-CA');
  const nid = () => Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);
  const dayLabel = d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const MOODS = ['🔥', '😄', '🙂', '😐', '😴', '😔', '😤'];

  /* ---------------- diary ---------------- */
  const D = { date: todayKey(), day: null, dates: [], index: [], streak: 0, loaded: false };
  /* Plans are needed on the diary side too: a plan with the same name as the page shows under it.
     Declared here (not further down) so the diary paints can read it safely. */
  const P = { items: [], notes: '', loaded: false };
  const BLANK = () => ({ title: '', mood: '', text: '', todos: [], goals: [], cleared: '', stuck: '', why: '' });
  const day = () => (D.day = D.day || BLANK());
  const el = id => broot.querySelector('#' + id);
  let dst = null, dstate = '';

  broot.innerHTML = `<div class="dywrap">
    <div class="card dybook">
      <div class="dytop">
        <button type="button" class="dyarw" id="dyprev" aria-label="Previous day">‹</button>
        <div class="dytitle">
          <input id="dytitle" class="dyname" maxlength="80" aria-label="Diary title" placeholder="Day 1 — apna title">
          <small id="dydate"></small>
          <small id="dysub"></small>
        </div>
        <button type="button" class="dyarw" id="dynext" aria-label="Next day">›</button>
        <button type="button" class="btn alt" id="dytoday">Today</button>
      </div>
      <div class="dymoods" id="dymood"></div>
      <label class="dylbl" for="dytext">Today's page</label>
      <textarea id="dytext" class="dytext" rows="7" placeholder="Aaj kya hua, kaisa laga, kya seekha…"></textarea>
      <div class="dycols">
        <div>
          <div class="dylbl">To-do <small id="dytodoc"></small></div>
          <div class="dylist" id="dytodos"></div>
          <div class="dyadd"><input id="dyin" maxlength="200" placeholder="Naya to-do…" aria-label="New to-do"><button type="button" class="btn" id="dyaddb">Add</button></div>
        </div>
        <div>
          <div class="dylbl">Goals</div>
          <div class="dylist" id="dygoals"></div>
          <div class="dyadd"><input id="dygin" maxlength="200" placeholder="Naya goal…" aria-label="New goal"><button type="button" class="btn alt" id="dygb">Add</button></div>
        </div>
      </div>
      <div class="dyrev">
        <label>Kya clear hua / ho gaya<textarea id="dycleared" rows="3" placeholder="Jo samajh aaya ya jo kar liya"></textarea></label>
        <label>Kya nahi hua<textarea id="dystuck" rows="3" placeholder="Jo reh gaya"></textarea></label>
      </div>
      <label class="dylbl" for="dywhy">Reason — kyun nahi hua</label>
      <textarea id="dywhy" rows="3" placeholder="Time kam tha? Neend? Distraction? Agli baar kya badlega?"></textarea>
      <div class="dyfoot"><small id="dysave"></small></div>
      <div class="dylink" id="dylink" hidden></div>
    </div>
    <div class="card dypast">
      <div class="row" style="margin:0 0 8px"><b style="flex:1">Past pages</b><small id="dystreak"></small></div>
      <div id="dydates" class="dydates"></div>
    </div>
  </div>`;

  const rowsHtml = (arr, kind) => (arr.length
    ? arr.map((x, i) => `<div class="dyitem${x.d ? ' done' : ''}"><input type="checkbox" data-k="${kind}" data-i="${i}"${x.d ? ' checked' : ''} aria-label="Done"><span>${esc(x.t)}</span><button type="button" class="dyx" data-del="${kind}" data-i="${i}" aria-label="Delete">×</button></div>`).join('')
    : `<small class="dymut">${kind === 'todo' ? 'Kuch add karo — aaj ka chhota kaam.' : 'Ek goal likho jise tu chase kar raha hai.'}</small>`);

  function paintLists() {
    const d = day();
    el('dytodos').innerHTML = rowsHtml(d.todos, 'todo');
    el('dygoals').innerHTML = rowsHtml(d.goals, 'goal');
    el('dytodoc').textContent = d.todos.length ? `${d.todos.filter(x => x.d).length}/${d.todos.length} done` : '';
    el('dymood').innerHTML = MOODS.map(m => `<button type="button" class="dymo${d.mood === m ? ' on' : ''}" data-mood="${m}" aria-label="Mood ${m}">${m}</button>`).join('');
    el('dysub').textContent = [d.todos.length ? `${d.todos.filter(x => x.d).length}/${d.todos.length} to-dos` : '', d.goals.length ? `${d.goals.length} goals` : '', D.streak ? `${D.streak}-day streak` : ''].filter(Boolean).join(' · ');
    el('dystreak').textContent = D.streak ? '🔥 ' + D.streak : '';
  }
  const pageIndex = () => (D.index.length || !D.dates.length ? D.index : D.dates.map(d => ({ d, t: '' })));
  const dayNo = () => Math.max(1, pageIndex().filter(x => x.d <= D.date).length);
  function paintDates() {
    const rows = pageIndex();
    el('dydates').innerHTML = rows.length
      ? rows.map(x => `<button type="button" class="dydate${x.d === D.date ? ' on' : ''}" data-date="${x.d}"><b>${esc(x.t || dayLabel(x.d))}</b><small>${esc(dayLabel(x.d))}${x.d === todayKey() ? ' · today' : ''}</small></button>`).join('')
      : '<small class="dymut">Abhi koi page nahi — aaj se shuru karo.</small>';
  }
  /* A plan whose name is the same as this page's title sits right under the page, so the steps,
     progress and "what did not happen" stay with the day that talks about them. */
  const LBL = { todo: 'To-do', doing: 'Doing', done: 'Done', blocked: 'Blocked' };
  const sameName = (a, b) => { const x = String(a || '').trim().toLowerCase(), y = String(b || '').trim().toLowerCase(); return !!x && x === y; };
  function paintLinked() {
    const box = el('dylink'); if (!box) return;
    const want = day().title;
    const hits = want ? P.items.filter(p => sameName(p.title, want)) : [];
    box.hidden = !hits.length;
    if (!hits.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="dylk-h">Same name wala plan</div>' + hits.map(p => {
      const i = P.items.indexOf(p), tot = p.steps.length, dn = p.steps.filter(s => s.d).length;
      return `<div class="dylk">
        <div class="dylk-t"><span>${esc(p.title)}</span><small>${LBL[p.status] || ''}${p.due ? ' · due ' + esc(p.due) : ''}</small></div>
        <div class="plbar"><span><i style="width:${tot ? Math.round(dn / tot * 100) : 0}%"></i></span><small>${dn}/${tot} steps</small></div>
        <div class="plsteps">${p.steps.length
          ? p.steps.map((s, j) => `<div class="dyitem${s.d ? ' done' : ''}"><input type="checkbox" data-lstep="${i}:${j}"${s.d ? ' checked' : ''} aria-label="Step done"><span>${esc(s.t)}</span></div>`).join('')
          : '<small class="dymut">Plan mein koi step nahi — Plans tab mein add karo.</small>'}</div>
        ${p.cleared ? `<div class="dysmall">Clear: ${esc(p.cleared)}</div>` : ''}
        ${p.stuck ? `<div class="dysmall">Nahi hua: ${esc(p.stuck)}</div>` : ''}
      </div>`;
    }).join('');
  }
  function paintHead() {
    const d = day(), t = el('dytitle');
    if (t) { t.value = d.title || ''; t.placeholder = 'Day ' + dayNo() + ' — apna title'; }
    el('dydate').textContent = dayLabel(D.date) + (D.date === todayKey() ? ' · today' : '');
    el('dytext').value = d.text; el('dycleared').value = d.cleared; el('dystuck').value = d.stuck; el('dywhy').value = d.why;
    paintLists(); paintDates(); paintLinked();
  }
  async function loadDay(date) {
    const r = await jget('diary', date ? 'date=' + encodeURIComponent(date) : '');
    if (!r || !r.ok) { dstate = 'Could not load'; el('dysave').textContent = dstate; return; }
    D.date = r.date || todayKey(); D.day = r.day || BLANK(); D.dates = r.dates || []; D.index = r.index || D.dates.map(d => ({ d, t: '' })); D.streak = r.streak || 0; D.loaded = true;
    paintHead(); el('dysave').textContent = '';
    if (!P.loaded) loadPlans();
  }
  function saveDay() {
    clearTimeout(dst); dstate = 'Saving…'; el('dysave').textContent = dstate;
    dst = setTimeout(async () => {
      const r = await jpost('diary', { date: D.date, patch: day() });
      if (r && r.ok) {
        D.dates = r.dates || D.dates; D.index = r.index || D.index; D.streak = r.streak || 0;
        // A new page comes back already named "Day N" — show it in the field.
        const cd = day(), ti = el('dytitle');
        if (r.day && r.day.title && !cd.title) { cd.title = r.day.title; if (ti && !ti.value) ti.value = r.day.title; }
        paintLists(); paintDates(); dstate = 'Saved';
      }
      else dstate = 'Could not save';
      el('dysave').textContent = dstate;
    }, 600);
  }
  function addItem(kind) {
    const inp = el(kind === 'todo' ? 'dyin' : 'dygin'), t = (inp.value || '').trim();
    if (!t) return inp.focus();
    day()[kind === 'todo' ? 'todos' : 'goals'].push({ id: nid(), t: t.slice(0, 200), d: 0 });
    inp.value = ''; paintLists(); saveDay(); inp.focus();
  }
  broot.addEventListener('click', e => {
    const m = e.target.closest('[data-mood]');
    if (m) { day().mood = day().mood === m.dataset.mood ? '' : m.dataset.mood; paintLists(); return saveDay(); }
    const del = e.target.closest('[data-del]');
    if (del) { day()[del.dataset.del === 'todo' ? 'todos' : 'goals'].splice(+del.dataset.i, 1); paintLists(); return saveDay(); }
    const dt = e.target.closest('[data-date]');
    if (dt) return loadDay(dt.dataset.date);
    const id = e.target.id;
    if (id === 'dyprev' || id === 'dynext') { const t = new Date(D.date + 'T12:00:00'); t.setDate(t.getDate() + (id === 'dynext' ? 1 : -1)); return loadDay(t.toLocaleDateString('en-CA')); }
    if (id === 'dytoday') return loadDay(todayKey());
    if (id === 'dyaddb') return addItem('todo');
    if (id === 'dygb') return addItem('goal');
  });
  broot.addEventListener('change', e => {
    const lc = e.target.closest('input[data-lstep]');
    if (lc) {
      const a = lc.dataset.lstep.split(':').map(Number);
      P.items[a[0]].steps[a[1]].d = lc.checked ? 1 : 0;
      paintPlans(); savePlans(); return;
    }
    const c = e.target.closest('input[data-k]');
    if (!c) return;
    day()[c.dataset.k === 'todo' ? 'todos' : 'goals'][+c.dataset.i].d = c.checked ? 1 : 0;
    paintLists(); saveDay();
  });
  broot.addEventListener('input', e => {
    const id = e.target.id, d = day();
    if (id === 'dytitle') { d.title = e.target.value.slice(0, 80); paintLinked(); saveDay(); }
    else if (id === 'dytext') { d.text = e.target.value; saveDay(); }
    else if (id === 'dycleared') { d.cleared = e.target.value; saveDay(); }
    else if (id === 'dystuck') { d.stuck = e.target.value; saveDay(); }
    else if (id === 'dywhy') { d.why = e.target.value; saveDay(); }
  });
  broot.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'dyin') { e.preventDefault(); addItem('todo'); }
    if (e.target.id === 'dygin') { e.preventDefault(); addItem('goal'); }
  });
  window.hhDrawDiary = () => (D.loaded ? paintLists() : loadDay(D.date));

  /* ---------------- plans ---------------- */
  const STATUS = { todo: 'To-do', doing: 'Doing', done: 'Done', blocked: 'Blocked' };
  let pst = null;

  proot.innerHTML = `<div class="plwrap">
    <div class="card">
      <div class="row plhead"><b style="flex:1">Plans — step by step</b><small id="plsum"></small><button type="button" class="btn" id="plnew">New plan</button></div>
      <div id="pllist"></div>
    </div>
    <div class="card"><b>Notes</b><textarea id="plnotes" rows="10" placeholder="Formulas, ideas, weekly plan…"></textarea></div>
  </div>`;

  const planCard = (p, i) => {
    const tot = p.steps.length, dn = p.steps.filter(s => s.d).length, pc = tot ? Math.round(dn / tot * 100) : 0;
    return `<div class="plan${p.status === 'done' ? ' done' : ''}${p.status === 'blocked' ? ' blocked' : ''}" data-i="${i}">
      <div class="pltop">
        <input class="in pltitle" data-f="title" value="${esc(p.title || '')}" maxlength="200" placeholder="Plan ka naam — e.g. Physics ch.4 Friday tak" aria-label="Plan title">
        <select class="in plst" data-f="status" aria-label="Status">${['todo', 'doing', 'done', 'blocked'].map(s => `<option value="${s}"${p.status === s ? ' selected' : ''}>${STATUS[s]}</option>`).join('')}</select>
        <input class="in pldue" type="date" data-f="due" value="${esc(p.due || '')}" aria-label="Due date">
        <button type="button" class="dyx" data-pdel="${i}" aria-label="Delete plan">×</button>
      </div>
      <div class="plbar"><span><i style="width:${pc}%"></i></span><small>${dn}/${tot} steps${p.due ? ' · due ' + esc(p.due) : ''}</small></div>
      <div class="plsteps">${p.steps.length
        ? p.steps.map((s, j) => `<div class="dyitem${s.d ? ' done' : ''}"><input type="checkbox" data-si="${i}" data-step="${j}"${s.d ? ' checked' : ''} aria-label="Step done"><span>${esc(s.t)}</span><button type="button" class="dyx" data-sdel="${i}:${j}" aria-label="Delete step">×</button></div>`).join('')
        : '<small class="dymut">Steps mein todo — chhote chhote, ek time par ek.</small>'}</div>
      <div class="dyadd"><input data-sin="${i}" maxlength="200" placeholder="Agla step…" aria-label="New step"><button type="button" class="btn alt" data-sadd="${i}">Add step</button></div>
      <div class="dyrev">
        <label>Kya clear hua<textarea data-f="cleared" rows="2" placeholder="Jo ho gaya / samajh aaya">${esc(p.cleared || '')}</textarea></label>
        <label>Kya nahi hua<textarea data-f="stuck" rows="2" placeholder="Jo atka">${esc(p.stuck || '')}</textarea></label>
      </div>
      <label class="dylbl">Reason — kyun nahi hua / kya block hua</label>
      <textarea data-f="whyNot" rows="2" placeholder="Honest reason, taaki agli baar plan better ho">${esc(p.whyNot || '')}</textarea>
    </div>`;
  };
  function paintPlans() {
    const done = P.items.filter(p => p.status === 'done').length;
    const tot = P.items.reduce((a, p) => a + p.steps.length, 0), sdone = P.items.reduce((a, p) => a + p.steps.filter(s => s.d).length, 0);
    proot.querySelector('#plsum').textContent = P.items.length ? `${done}/${P.items.length} plans · ${sdone}/${tot} steps` : '';
    proot.querySelector('#pllist').innerHTML = P.items.length ? P.items.map(planCard).join('')
      : '<small class="dymut">Koi plan nahi. "New plan" dabao, phir uske andar chhote steps likho — jo tick hote jayenge, aur "kya nahi hua + kyun" bhi likh sako.</small>';
    paintLinked();
  }
  function savePlans() {
    clearTimeout(pst);
    pst = setTimeout(() => jpost('plans', { plans: { items: P.items, notes: P.notes } }), 700);
  }
  async function loadPlans() {
    const r = await jget('plans');
    if (!r || !r.ok) return;
    P.items = (r.plans && r.plans.items) || []; P.notes = (r.plans && r.plans.notes) || ''; P.loaded = true;
    const n = proot.querySelector('#plnotes'); if (n && document.activeElement !== n) n.value = P.notes;
    paintPlans();
  }
  const addPlan = () => {
    P.items.unshift({ id: nid(), title: '', why: '', status: 'todo', due: '', steps: [], cleared: '', stuck: '', whyNot: '', created: Date.now() });
    paintPlans(); const inp = proot.querySelector('.pltitle'); if (inp) inp.focus(); savePlans();
  };
  function addStep(i) {
    const inp = proot.querySelector('[data-sin="' + i + '"]'), t = (inp.value || '').trim();
    if (!t) return inp.focus();
    P.items[i].steps.push({ id: nid(), t: t.slice(0, 200), d: 0 });
    inp.value = ''; paintPlans(); savePlans();
  }
  proot.addEventListener('click', e => {
    if (e.target.id === 'plnew') return addPlan();
    const del = e.target.closest('[data-pdel]');
    if (del) { P.items.splice(+del.dataset.pdel, 1); paintPlans(); return savePlans(); }
    const sd = e.target.closest('[data-sdel]');
    if (sd) { const a = sd.dataset.sdel.split(':').map(Number); P.items[a[0]].steps.splice(a[1], 1); paintPlans(); return savePlans(); }
    const sa = e.target.closest('[data-sadd]');
    if (sa) return addStep(+sa.dataset.sadd);
  });
  proot.addEventListener('input', e => {
    const f = e.target.dataset.f; if (!f) return;
    const card = e.target.closest('.plan'); if (!card) return;
    P.items[+card.dataset.i][f] = e.target.value;
    if (e.target.id === 'plnotes') P.notes = e.target.value;
    savePlans();
  });
  proot.addEventListener('change', e => {
    const c = e.target.closest('input[data-step]');
    if (c) { P.items[+c.dataset.si].steps[+c.dataset.step].d = c.checked ? 1 : 0; paintPlans(); return savePlans(); }
    const f = e.target.dataset.f;
    if (!f || !e.target.closest('.plan')) return;
    P.items[+e.target.closest('.plan').dataset.i][f] = e.target.value;
    if (f === 'status' || f === 'due') paintPlans();
    savePlans();
  });
  proot.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.dataset.sin !== undefined) { e.preventDefault(); addStep(+e.target.dataset.sin); }
  });
  window.hhDrawPlans = () => (P.loaded ? paintPlans() : loadPlans());
})();

/* ===== part 51: day dividers, back-to-latest pill, connection notice ===== */
(function () {
  const box = document.getElementById('msgs'), vc = document.getElementById('v-chat');
  if (!box || !vc) return;
  const atBottom = () => box.scrollHeight - box.scrollTop - box.clientHeight < 90;

  /* --- Today / Yesterday / date, so a long chat stays readable --- */
  const dayName = ts => {
    const d = new Date(ts), now = new Date(), yd = new Date(now.getTime() - 864e5);
    if (d.toDateString() === now.toDateString()) return 'Today';
    if (d.toDateString() === yd.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  };
  const sepFor = ts => {
    const s = document.createElement('div');
    s.className = 'dsep';
    s.textContent = dayName(ts);
    return s;
  };
  /* Mark days only where something changed: a fresh message usually needs one tiny check instead
     of walking the whole channel again, which is what used to make a busy chat feel slow. */
  const markDays = els => {
    els.forEach(el => {
      if (!el.isConnected || !el.classList.contains('m')) return;
      const ts = +el.dataset.ts; if (!ts) return;
      const key = new Date(ts).toDateString();
      const prev = el.previousElementSibling;
      const hasSep = !!prev && prev.classList.contains('dsep');
      const before = hasSep ? prev.previousElementSibling : prev;
      const same = !!before && before.classList.contains('m') && new Date(+before.dataset.ts).toDateString() === key;
      if (!same && !hasSep) el.before(sepFor(ts));
      else if (same && hasSep) prev.remove();
    });
  };
  const drawDays = () => {
    box.querySelectorAll('.dsep').forEach(e => e.remove());
    markDays([...box.querySelectorAll('.m')]);
  };

  /* --- scrolled up? a pill takes you back and counts what you missed --- */
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'tobtm';
  pill.hidden = true;
  pill.innerHTML = '<span>↓</span><i hidden></i>';
  vc.append(pill);
  let behind = 0;
  const paint = () => {
    const show = !atBottom() && !!box.querySelector('.m');
    pill.hidden = !show;
    const i = pill.querySelector('i');
    i.hidden = !behind;
    i.textContent = behind > 99 ? '99+' : String(behind);
  };
  pill.onclick = () => { behind = 0; box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' }); paint(); };
  box.addEventListener('scroll', paint, { passive: true });

  const _r = renderMsgs;
  renderMsgs = function () { _r(); behind = 0; drawDays(); paint(); };

  new MutationObserver(ms => {
    const fresh = [];
    let gone = false;
    ms.forEach(m => {
      m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('m')) fresh.push(n); });
      if (m.removedNodes.length) gone = true;
    });
    if (gone) behind = 0;
    if (fresh.length) { behind = atBottom() ? 0 : behind + fresh.length; markDays(fresh); }
    paint();
  }).observe(box, { childList: true });

  /* --- the live feed drops silently, so the page says it out loud --- */
  const Orig = window.EventSource;
  if (!Orig) return;
  const bar = document.createElement('div');
  bar.className = 'netbar';
  bar.hidden = true;
  bar.innerHTML = '<span class="ndot"></span>Reconnecting — messages thodi der mein aayenge';
  document.body.append(bar);
  let down = false;
  const state = on => {
    bar.hidden = !on;
    if (down && !on && window.hhToast) window.hhToast('Back online.');
    down = on;
  };
  window.EventSource = function (u, c) {
    const e = new Orig(u, c);
    e.addEventListener('open', () => state(false));
    e.addEventListener('error', () => { if (e.readyState !== 2) state(true); });
    return e;
  };
  window.EventSource.prototype = Orig.prototype;
  window.EventSource.CONNECTING = 0; window.EventSource.OPEN = 1; window.EventSource.CLOSED = 2;
})();

/* ===== part 54: @mention autocomplete — type @ and pick a name ===== */
(function () {
  const box = document.getElementById('box'), form = document.getElementById('send');
  if (!box || !form) return;
  const pop = document.createElement('div');
  pop.className = 'mnp';
  pop.hidden = true;
  form.append(pop);
  let items = [], sel = 0, at = -1, open = false;

  const everyone = { n: 'everyone', dn: 'everyone', all: true };
  const pool = () => {
    const P = (window.hhPeople && window.hhPeople()) || {};
    return Object.keys(P).filter(Boolean).map(n => ({ n, dn: (P[n] && P[n].dn) || n }));
  };
  const tokenAt = () => {
    const pos = box.selectionStart == null ? box.value.length : box.selectionStart;
    const m = /(^|\s)@([A-Za-z0-9_.\-]{0,24})$/.exec(box.value.slice(0, pos));
    return m ? { start: pos - m[2].length - 1, q: m[2] } : null;
  };
  const paint = () => {
    pop.innerHTML = items.map((x, i) => `<button type="button" class="mni${i === sel ? ' on' : ''}" data-i="${i}"><b>@${esc(x.n)}</b>${x.dn && x.dn !== x.n ? `<small>${esc(x.dn)}</small>` : ''}${x.all ? '<small>everyone in the channel</small>' : ''}</button>`).join('');
    pop.hidden = false;
  };
  const close = () => { pop.hidden = true; open = false; items = []; };
  const refresh = () => {
    const t = tokenAt();
    if (!t) return close();
    const q = t.q.toLowerCase();
    const list = pool().filter(x => !q || x.n.toLowerCase().includes(q) || x.dn.toLowerCase().includes(q));
    if (!q || 'everyone'.startsWith(q)) list.unshift(everyone);
    items = list.slice(0, 7);
    if (!items.length) return close();
    at = t.start; sel = 0; open = true; paint();
  };
  const pick = i => {
    const it = items[i];
    if (!it || at < 0) return;
    const pos = box.selectionStart == null ? box.value.length : box.selectionStart;
    const head = box.value.slice(0, at), tail = box.value.slice(pos);
    const ins = '@' + it.n + ' ';
    box.value = head + ins + tail;
    const caret = head.length + ins.length;
    box.setSelectionRange(caret, caret);
    close();
    box.focus();
  };
  pop.addEventListener('mousedown', e => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    e.preventDefault();
    pick(+b.dataset.i);
  });
  box.addEventListener('input', refresh);
  box.addEventListener('blur', () => setTimeout(close, 150));
  box.addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      paint();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation(); pick(sel);
    } else if (e.key === 'Escape') {
      e.stopPropagation(); close();
    }
  }, true);
})();

/* ===== part 59: Space pauses or resumes Music Assistant from anywhere in the chat ===== */
(function () {
  const toast = m => { if (window.hhToast) window.hhToast(m); };
  const typing = el => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  let busy = false, paused = false;
  const paintBtns = () => document.querySelectorAll('.mabtn').forEach(b => {
    b.textContent = paused ? '⏸' : '▶';
    b.title = paused ? 'Resume Music Assistant' : 'Pause Music Assistant';
    b.setAttribute('aria-label', b.title);
  });
  const toggle = () => {
    if (busy) return;
    busy = true;
    fetch('/huzz-hunter/api/ma/toggle', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-token': localStorage.htk || '', 'x-pass': localStorage.hp || '' },
      body: '{}',
      cache: 'no-store'
    }).then(res => {
      if (res.status === 401) throw new Error('signin');
      return res.json();
    }).then(r => {
      if (r && r.error) return toast(r.error);
      paused = !!r.paused; paintBtns();
      toast(paused ? '⏸ Music paused' : '▶ Music playing');
    }).catch(() => toast('Music Assistant se connect nahi hua.')).finally(() => { busy = false; });
  };
  window.hhMaToggle = toggle;
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (typing(e.target) || typing(document.activeElement)) return;
    if (document.body.classList.contains('lockin')) return;
    e.preventDefault();
    toggle();
  });
  /* A visible control too: the Space shortcut is invisible, and on a phone there is no keyboard. */
  const head = document.querySelector('#v-chat header');
  if (head) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'x mabtn';
    b.onclick = toggle;
    /* next to the channel name: at the end of the header it got pushed off-screen on a phone */
    const title = head.querySelector('#title');
    if (title && title.after) title.after(b); else head.append(b);
    paintBtns();
  }
})();

/* ---- part 26: search every channel you can see (Ctrl/Cmd+K) ---- */
(function () {
  const head = document.querySelector('#v-chat header');
  if (!head || document.getElementById('srchbtn')) return;

  const btn = document.createElement('button');
  btn.id = 'srchbtn'; btn.type = 'button'; btn.className = 'x';
  btn.title = 'Search messages (Ctrl+K)'; btn.setAttribute('aria-label', 'Search messages'); btn.textContent = '🔍';
  const title = head.querySelector('#title');
  if (title && title.after) title.after(btn); else head.append(btn);

  const wrap = document.createElement('div');
  wrap.id = 'srch'; wrap.hidden = true;
  wrap.innerHTML = '<div class="srchbox"><input id="srchin" type="search" placeholder="Search every channel you are in…" autocomplete="off" aria-label="Search messages"><button type="button" id="srchx" aria-label="Close search">✕</button></div><div id="srchres" role="listbox" aria-live="polite"></div>';
  document.body.append(wrap);
  const inp = wrap.querySelector('#srchin'), out = wrap.querySelector('#srchres');

  const close = () => { wrap.hidden = true; inp.value = ''; out.innerHTML = ''; };
  const open = () => { wrap.hidden = false; setTimeout(() => inp.focus(), 30); };
  btn.onclick = open;
  wrap.querySelector('#srchx').onclick = close;
  addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') { e.preventDefault(); wrap.hidden ? open() : close(); }
    else if (e.key === 'Escape' && !wrap.hidden) close();
  });

  const where = ch => (String(ch).startsWith('dm:') ? '💬' : '#' + ch);
  let seq = 0;
  async function run() {
    const q = inp.value.trim();
    if (q.length < 2) { out.innerHTML = '<p class="srchempty">Type at least two characters.</p>'; return; }
    const mine = ++seq;
    out.innerHTML = '<p class="srchempty">Searching…</p>';
    const r = await get('/huzz-hunter/api/search?q=' + enc(q));
    if (mine !== seq) return;
    if (!r || r.error) { out.innerHTML = `<p class="srchempty">${esc((r && r.error) || 'Search failed.')}</p>`; return; }
    const hits = r.hits || [];
    if (!hits.length) { out.innerHTML = '<p class="srchempty">Nothing found in the channels you can see.</p>'; return; }
    out.innerHTML = hits.map(h => `<button type="button" class="srchhit" data-ch="${esc(h.ch)}" data-id="${esc(h.id)}"><span class="srchmeta">${esc(where(h.ch))} · ${esc(h.name)} · ${new Date(h.ts).toLocaleString()}</span><span class="srchtext">${esc(h.text)}</span></button>`).join('');
  }
  let t;
  inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 260); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(t); run(); } });

  out.addEventListener('click', e => {
    const hit = e.target.closest('.srchhit'); if (!hit) return;
    const ch = hit.dataset.ch, id = hit.dataset.id;
    close();
    cur = ch; unread[ch] = 0; show('chat'); renderMsgs();
    const sel = window.CSS && CSS.escape ? CSS.escape(id) : String(id).replace(/[^\w-]/g, '');
    const el = document.querySelector(`.m[data-id="${sel}"]`);
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('srchflash'); setTimeout(() => el.classList.remove('srchflash'), 1800); }
    else (window.hhToast || alert)('That message is older than the ones loaded here, so it sits above this view.');
  });

  const css = document.createElement('style');
  css.textContent = `#srchbtn{font-size:15px}
#srch{position:fixed;inset:0;z-index:40;background:rgba(10,9,18,.74);backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;padding:12vh 16px 16px}
.srchbox{display:flex;gap:8px;width:min(680px,100%)}
#srchin{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:13px 16px;font-size:16px;color:var(--text)}
#srchx{background:var(--raise);border:1px solid var(--line);color:var(--text);border-radius:12px;padding:0 15px;cursor:pointer}
#srchres{width:min(680px,100%);margin-top:10px;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:12px;max-height:60vh}
#srchres:empty{display:none}
.srchhit{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:10px 14px;cursor:pointer;color:var(--text)}
.srchhit:hover{background:var(--raise)}
.srchmeta{display:block;font-size:12px;color:var(--mute)}
.srchtext{display:block;overflow-wrap:anywhere;white-space:pre-wrap}
.srchempty{padding:14px;color:var(--mute);margin:0}
.srchflash{outline:2px solid var(--gold);outline-offset:2px;border-radius:10px}`;
  document.head.append(css);
})();
