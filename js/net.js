/* ARE WE FALLING? — optional online lobbies and voice chat (WebRTC through PeerJS).
   Nothing here is needed for same-room play: if the network or the library is missing, the game works as before. */
(function () {
  'use strict';
  const KK = window.KK;
  const PREFIX = 'awf1-', MAX = 4;
  // two seats are needed (pilot, tower); the two cabin seats are optional and play in cabin.html
  const SEATS = ['pilot', 'tower', 'saboteur', 'attendant'], CAB_SEAT = { saboteur: 1, attendant: 1 }, SEAT_NAME = { pilot: 'PILOT', tower: 'TOWER', saboteur: 'INTRUDER', attendant: 'ATTENDANT' };
  const ROOMS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL'];
  const params = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);
  const kk = () => window.__kk;
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  const N = {
    peer: null, code: null, isHost: false, hostConn: null, conns: {}, members: [], mode: 'short', inGame: false,
    view: 'off', flying: false, lastSt: null, status: '', error: '', rooms: {},
    dbg: [], stream: null, micMode: 'off', micErr: '', ptt: false, calls: {}, audio: {}, fx: store.get('awf_fx') !== '0', talk: {}, myLevel: 0,
  };
  const pending = {};
  const clean = (s) => String(s || '').replace(/[^\w \-.]/g, '').trim().slice(0, 14).toUpperCase();
  const myId = () => (N.peer ? N.peer.id : null);
  const me = () => N.members.find((m) => m.id === myId());
  const myRole = () => { const m = me(); return m ? m.role : null; };
  const myName = () => clean($('netName') && $('netName').value) || 'CREW ' + (100 + Math.floor(Math.random() * 900));
  const micLive = () => !!N.stream && (N.micMode === 'open' || N.micMode === 'ptt');

  // ------------------------------------------------------------------ DOM
  const root = document.createElement('div'); root.id = 'net';
  root.innerHTML =
    '<div class="net-browse net-card">' +
      '<div class="net-head"><b>ARE WE <i>FALLING?</i></b><span>ONLINE LOBBIES</span><button class="net-x" id="netClose" title="Back to the title">✕</button></div>' +
      '<p class="net-lead">Play from two places. One of you flies, the others read the handbook. Voice chat is built in, so nobody needs a second app.</p>' +
      '<label class="net-l">YOUR CALLSIGN</label><input id="netName" maxlength="14" autocomplete="off" spellcheck="false" placeholder="CAPTAIN">' +
      '<div class="net-row"><button id="netCreate" class="net-btn pri">CREATE A PRIVATE LOBBY</button>' +
      '<div class="net-join"><input id="netCode" maxlength="8" autocomplete="off" spellcheck="false" placeholder="CODE"><button id="netJoin" class="net-btn">JOIN</button></div></div>' +
      '<div class="net-sub"><label class="net-l">PUBLIC LOBBIES</label><button id="netRefresh" class="net-link">REFRESH</button></div>' +
      '<div id="netRooms" class="net-rooms"></div>' +
      '<div id="netStatus" class="net-status"></div>' +
    '</div>' +
    '<div class="net-room net-card">' +
      '<div class="net-head"><b>LOBBY <i id="netRoomCode"></i></b><span id="netRoomHint"></span><button class="net-x" id="netLeave" title="Leave the lobby">✕</button></div>' +
      '<div class="net-cols"><div>' +
        '<label class="net-l">CREW</label><div id="netMembers" class="net-members"></div>' +
        '<label class="net-l">YOUR SEAT</label><div class="net-row"><button id="netPilot" class="net-btn seat">PILOT<small>flies the cockpit</small></button><button id="netTower" class="net-btn seat">TOWER<small>reads the handbook</small></button></div>' +
        '<div class="net-row"><button id="netSab" class="net-btn seat opt">INTRUDER<small>optional · in the cabin, against the crew</small></button><button id="netAtt" class="net-btn seat opt">ATTENDANT<small>optional · in the cabin, with the crew</small></button></div>' +
      '</div><div>' +
        '<label class="net-l">FLIGHT</label><div id="netModes" class="net-modes"></div>' +
        '<label class="net-l">VOICE</label><div class="net-row"><button id="netMic" class="net-btn"></button><button id="netFx" class="net-btn"></button></div>' +
        '<div class="net-meter"><i id="netMeter"></i></div><div id="netMicNote" class="net-note"></div>' +
      '</div></div>' +
      '<div class="net-foot"><div id="netRoomStatus" class="net-status"></div><button id="netStart" class="net-btn pri big">START THE FLIGHT</button></div>' +
    '</div>' +
    '<div class="net-tower">' +
      '<div class="net-bar"><div class="tb"><label>TIME TO IMPACT</label><b id="twTime">-:--</b></div><div class="tb"><label>STRUCTURE</label><b id="twDmg"></b></div><div class="tb"><label>FIXED</label><b id="twFix">0 / 0</b></div>' +
      '<div class="tb grow"><label>RADIO</label><b id="twTalk">SILENT</b></div><button id="twPtt" class="net-btn">HOLD TO TALK</button><button id="twMic" class="net-btn"></button><button id="twLeave" class="net-btn">LEAVE</button></div>' +
      '<div id="twBanner" class="net-banner"></div><iframe id="twBook" title="Tower emergency handbook"></iframe>' +
    '</div>' +
    '<div id="netToast" class="net-toast"></div>';
  document.body.appendChild(root);
  document.body.appendChild($('netToast'));
  const chip = document.createElement('button'); chip.id = 'voiceChip'; chip.title = 'Voice chat: click to change the microphone mode';
  const corner = document.querySelector('#cockpit .corner'); if (corner) corner.insertBefore(chip, corner.firstChild);
  $('netName').value = clean(store.get('awf_name'));
  $('netName').addEventListener('change', () => { store.set('awf_name', clean($('netName').value)); if (N.code) act({ t: 'hello', name: myName(), mic: micLive() }); });

  function showView(v) {
    N.view = v;
    const cab = v === 'tower' && CAB_SEAT[myRole()];
    root.className = v === 'off' || v === 'fly' ? '' : 'show v-' + v + (cab ? ' cab' : '');
    document.body.classList.toggle('net-online', !!N.code);
    document.body.classList.toggle('net-cover', v !== 'off' && v !== 'fly');
    if (v === 'tower') {   // the tower reads the handbook, the cabin seats get the cabin
      const f = $('twBook'), want = cab ? 'cabin.html?embed=1&role=' + myRole() : 'manual.html';
      if (f.getAttribute('src') !== want) f.setAttribute('src', want);
      if (kk().music) kk().music(false);
    }
    syncEnd(); render();
  }
  let toastT = null;
  function toast(t, ms) { const e = $('netToast'); e.textContent = t; e.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('show'), ms || 4500); }
  function syncEnd() {
    const on = !!N.code, home = $('btnHome'), swap = $('btnSwap');
    if (home) home.textContent = on ? 'BACK TO LOBBY' : 'TITLE';
    if (swap) swap.style.display = on ? 'none' : '';
  }

  // ------------------------------------------------------------------ peers
  function peerOpts() {
    const o = { debug: 0 }, p = params.get('peer');
    if (p) { const a = p.split(':'); o.host = a[0]; o.port = parseInt(a[1], 10) || 9000; o.path = '/'; o.secure = false; }
    return o;
  }
  function openPeer(id) {
    return new Promise((res, rej) => {
      if (!window.Peer) { rej(new Error('nolib')); return; }
      let done = false, p;
      try { p = id ? new window.Peer(id, peerOpts()) : new window.Peer(peerOpts()); } catch (e) { rej(e); return; }
      const to = setTimeout(() => { if (!done) { done = true; try { p.destroy(); } catch (e) {} rej(new Error('timeout')); } }, 12000);
      p.on('open', () => { if (done) return; done = true; clearTimeout(to); res(p); });
      p.on('error', (e) => {
        if (!done) { done = true; clearTimeout(to); try { p.destroy(); } catch (x) {} rej(e); return; }
        if (p !== N.peer) return;
        if (e && e.type === 'peer-unavailable') { Object.keys(pending).forEach((id2) => { if (String(e.message || '').indexOf(id2) >= 0) pending[id2](); }); return; }
        if (e && (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' || e.type === 'socket-closed')) toast('Connection to the lobby service is unstable.');
      });
    });
  }
  function setPeer(p) {
    N.peer = p;
    p.on('connection', onConnection);
    p.on('call', onCall);
    p.on('disconnected', () => { if (N.peer === p && !p.destroyed) { try { p.reconnect(); } catch (e) {} } });
  }
  function dropPeer() {
    Object.keys(N.calls).forEach(closeCall);
    Object.keys(N.conns).forEach((id) => { try { N.conns[id].close(); } catch (e) {} });
    if (N.hostConn) { const c = N.hostConn; N.hostConn = null; try { c.close(); } catch (e) {} }
    if (N.peer) { const p = N.peer; N.peer = null; try { p.destroy(); } catch (e) {} }
    N.conns = {}; N.members = []; N.code = null; N.isHost = false; N.inGame = false; N.lastSt = null;
  }
  function ensurePeer() {
    if (N.peer && !N.peer.destroyed && !N.isHost) return Promise.resolve(N.peer);
    dropPeer();
    return openPeer().then((p) => { setPeer(p); return p; });
  }
  function connectTo(id, meta, ms) {
    return new Promise((res, rej) => {
      let done = false, c;
      const fin = (f, v) => { if (done) return; done = true; clearTimeout(to); delete pending[id]; f(v); };
      const to = setTimeout(() => { try { c && c.close(); } catch (e) {} fin(rej, new Error('timeout')); }, ms || 9000);
      pending[id] = () => fin(rej, new Error('unavailable'));
      try { c = N.peer.connect(id, { reliable: true, serialization: 'json', metadata: meta }); } catch (e) { fin(rej, e); return; }
      c.on('open', () => fin(res, c));
      c.on('error', (e) => fin(rej, e));
    });
  }
  function fail(e) {
    const t = e && (e.type || e.message);
    N.status = '';
    N.error = t === 'nolib' ? 'Online play is not available in this copy of the game.'
      : t === 'browser-incompatible' ? 'This browser cannot do online play. Try Chrome, Edge, Firefox or Safari.'
      : t === 'unavailable' || t === 'timeout' && N.joining ? 'No lobby answered with that code.'
      : 'Could not reach the lobby service. Check the internet connection and try again. Same-room play still works.';
    N.joining = false; render();
  }

  // ------------------------------------------------------------------ lobby list
  function probe(name) {
    N.rooms[name] = { s: 'checking' };
    connectTo(PREFIX + name, { probe: 1 }, 7000).then((c) => {
      const to = setTimeout(() => { N.rooms[name] = { s: 'empty' }; try { c.close(); } catch (e) {} render(); }, 4000);
      c.on('data', (d) => { if (d && d.t === 'info') { clearTimeout(to); N.rooms[name] = { s: 'open', n: d.n, inGame: d.inGame, need: d.need }; try { c.close(); } catch (e) {} render(); } });
    }).catch(() => { N.rooms[name] = { s: 'empty' }; render(); });
  }
  function refresh() {
    N.error = ''; N.status = 'Looking for lobbies…'; render();
    ensurePeer().then(() => { N.status = ''; ROOMS.forEach(probe); render(); }).catch(fail);
  }
  function genCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }

  function host(code, isPublic, tries) {
    N.error = ''; N.status = 'Opening lobby ' + code + '…'; render();
    dropPeer();
    return openPeer(PREFIX + code).then((p) => {
      setPeer(p); N.code = code; N.isHost = true; N.inGame = false; N.status = '';
      N.mode = kk().settings.mode || 'short';
      N.members = [{ id: p.id, name: myName(), role: 'pilot', mic: micLive(), host: true }];
      showView('room'); enableMic();
    }).catch((e) => {
      if (e && e.type === 'unavailable-id') { if (isPublic) return join(code); if ((tries || 0) < 4) return host(genCode(), false, (tries || 0) + 1); }
      fail(e);
    });
  }
  function join(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) { N.error = 'Type the lobby code first.'; render(); return Promise.resolve(); }
    N.error = ''; N.status = 'Joining lobby ' + code + '…'; N.joining = true; render();
    return ensurePeer().then(() => connectTo(PREFIX + code, { name: myName() }, 10000)).then((c) => {
      N.hostConn = c; N.code = code; N.isHost = false; N.joining = false; N.hostSeen = Date.now();
      c.on('data', (d) => onMsg(d, c.peer));
      c.on('close', () => { if (N.hostConn === c) hostGone(); });
      c.send({ t: 'hello', name: myName(), mic: micLive() });
    }).catch(fail);
  }
  function hostGone(why) {
    N.dbg.push('hostGone ' + (why || 'close') + ' ' + (Date.now() - (N.hostSeen || 0)));
    const flying = N.view === 'fly';
    N.hostConn = null; dropPeer();
    toast(flying ? 'Lobby connection lost. Keep flying.' : 'The lobby was closed.', 6000);
    if (!flying) { showView('browse'); refresh(); } else { document.body.classList.remove('net-online'); syncEnd(); render(); }
  }
  function leave() {
    if (N.view === 'fly') return;
    dropPeer(); N.status = ''; N.error = '';
    showView('browse'); refresh();
  }
  function closeOnline() {
    dropPeer();
    if (N.stream) { N.stream.getTracks().forEach((t) => t.stop()); N.stream = null; N.micMode = 'off'; }
    showView('off');
  }

  // ------------------------------------------------------------------ host side
  function info() {
    const need = !N.members.some((m) => m.role === 'pilot') ? 'PILOT' : !N.members.some((m) => m.role === 'tower') ? 'TOWER' : '';
    return { t: 'info', n: N.members.length, max: MAX, inGame: N.inGame, need };
  }
  function onConnection(c) {
    if (!N.isHost) { c.on('open', () => { try { c.close(); } catch (e) {} }); return; }
    if (c.metadata && c.metadata.probe) { c.on('open', () => { c.send(info()); setTimeout(() => { try { c.close(); } catch (e) {} }, 3000); }); return; }
    c.on('data', (d) => onMsg(d, c.peer));
    c.on('close', () => dropMember(c.peer));
    c.on('open', () => {
      if (N.members.length >= MAX) { c.send({ t: 'full' }); setTimeout(() => { try { c.close(); } catch (e) {} }, 800); return; }
      N.conns[c.peer] = c;
      const role = !N.members.some((m) => m.role === 'tower') ? 'tower' : !N.members.some((m) => m.role === 'pilot') ? 'pilot' : 'tower';
      N.members.push({ id: c.peer, name: clean(c.metadata && c.metadata.name) || 'CREW', role, mic: false, seen: Date.now() });
      roster();
    });
  }
  function dropMember(id, why) {
    N.dbg.push('drop ' + (why || 'close') + ' ' + id.slice(0, 6));
    if (!N.isHost || !N.conns[id]) return;
    delete N.conns[id];
    const m = N.members.find((x) => x.id === id);
    N.members = N.members.filter((x) => x.id !== id);
    closeCall(id);
    if (m) toast(m.name + ' left the lobby.');
    if (m && m.role === 'pilot' && N.inGame) { const d = { t: 'st', ph: 'lobby' }; cast(d); onState(d); }
    roster();
  }
  function cast(d, except) { Object.keys(N.conns).forEach((id) => { if (id !== except) { try { N.conns[id].send(d); } catch (e) {} } }); }
  function roster() {
    cast({ t: 'roster', members: N.members, mode: N.mode, inGame: N.inGame, code: N.code });
    syncCalls(); render();
  }
  function hostHandle(d, from) {
    const m = N.members.find((x) => x.id === from); if (!m) return;
    m.seen = Date.now();
    if (d.t === 'hello') { m.name = clean(d.name) || m.name; m.mic = !!d.mic; roster(); }
    else if (d.t === 'mic') { m.mic = !!d.on; roster(); }
    else if (d.t === 'role') {
      if (N.inGame || SEATS.indexOf(d.role) < 0) return;
      if (d.role !== 'tower') N.members.forEach((x) => { if (x.role === d.role) x.role = 'tower'; });   // one pilot, one saboteur, one attendant
      m.role = d.role; roster();
    } else if (d.t === 'cab') {   // something a cabin seat did: everybody else hears about it
      if (!CAB_SEAT[m.role] || !N.inGame) return;
      d.role = m.role; cast(d, from); if (from !== myId()) onCab(d);
    } else if (d.t === 'st') { if (m.role === 'pilot') { cast(d, from); onState(d); if (d.ph === 'lobby') roster(); } }
  }
  /* send an action to the lobby: the host applies it, everybody else asks the host */
  function act(d) {
    if (!N.code) return;
    if (N.isHost) hostHandle(d, myId()); else if (N.hostConn) { try { N.hostConn.send(d); } catch (e) {} }
  }
  function canStart() {
    return N.isHost && !N.inGame && N.members.length >= 2 && N.members.filter((m) => m.role === 'pilot').length === 1 && N.members.some((m) => m.role === 'tower');
  }
  function start() {
    if (!canStart()) return;
    N.inGame = true; roster();
    cast({ t: 'start', mode: N.mode }); onStart(N.mode);
  }

  // ------------------------------------------------------------------ everybody
  function onMsg(d, from) {
    if (!d || typeof d !== 'object') return;
    if (N.isHost) { hostHandle(d, from); return; }
    N.hostSeen = Date.now();
    if (d.t === 'roster') {
      N.members = Array.isArray(d.members) ? d.members.slice(0, MAX).map((m) => ({ id: String(m.id), name: clean(m.name) || 'CREW', role: SEATS.indexOf(m.role) >= 0 ? m.role : 'tower', mic: !!m.mic, host: !!m.host })) : [];
      if (KK.MODES[d.mode]) N.mode = d.mode;
      N.inGame = !!d.inGame; N.status = '';
      if (N.view === 'browse') { showView('room'); enableMic(); }
      if (N.inGame && myRole() !== 'pilot' && N.view === 'room') showView('tower');
      syncCalls(); render();
    } else if (d.t === 'start') onStart(d.mode);
    else if (d.t === 'st') onState(d);
    else if (d.t === 'cab') onCab(d);
    else if (d.t === 'full') { N.hostConn = null; dropPeer(); N.status = ''; N.error = 'That lobby is full.'; showView('browse'); }
  }
  function onStart(mode) { N.grace = Date.now() + 60000;
    if (KK.MODES[mode]) N.mode = mode;
    N.inGame = true; N.lastSt = null;
    if (myRole() === 'pilot') { showView('fly'); kk().settings.mode = N.mode; kk().startFlight(); N.flying = true; }
    else showView('tower');
  }
  const tidy = (t, n) => String(t || '').replace(/[^\w \-.']/g, '').trim().slice(0, n || 40).toUpperCase();
  /* a cabin seat finished a task or moved: the pilot's game takes the effect, the cabin views show each other */
  function onCab(d) {
    if (!d || !CAB_SEAT[d.role]) return;
    if (d.k === 'task') {
      const eff = Math.max(-30, Math.min(30, Math.round(+d.effect || 0))), title = tidy(d.title), sab = d.role === 'saboteur';
      if (myRole() === 'pilot') { if (kk() && kk().cabinTask) kk().cabinTask({ role: d.role, id: tidy(d.id, 16), title, effect: eff, fx: Array.isArray(d.fx) ? d.fx.slice(0, 4) : [] }); }
      else if (myRole() === 'tower') toast((sab ? 'SABOTAGE IN THE CABIN · ' : 'CABIN CREW · ') + title + ' · ' + (eff > 0 ? '+' : '') + eff + ' SECONDS', 5000);
    }
    try { const f = $('twBook'); if (f && f.contentWindow && CAB_SEAT[myRole()]) f.contentWindow.postMessage({ awf: 1, cab: { k: d.k, role: d.role, at: tidy(d.at, 12).toLowerCase(), id: tidy(d.id, 16) } }, '*'); } catch (e) {}
  }
  // the cabin page (in the frame) reports what its player does
  window.addEventListener('message', (e) => {
    const f = $('twBook'), d = e.data;
    if (!f || e.source !== f.contentWindow || !d || d.awf !== 1 || !d.cab || !CAB_SEAT[myRole()] || !N.inGame) return;
    const c = d.cab;
    if (c.k === 'task') act({ t: 'cab', k: 'task', id: tidy(c.id, 16), title: tidy(c.title), effect: Math.max(-30, Math.min(30, Math.round(+c.effect || 0))), fx: Array.isArray(c.fx) ? c.fx.slice(0, 4).map((x) => ({ type: tidy(x && x.type, 12).toLowerCase(), amount: Math.max(0, Math.min(1, +(x && x.amount) || 0)) })) : [] });
    else if (c.k === 'pos') act({ t: 'cab', k: 'pos', at: tidy(c.at, 12) });
  });
  function toBook(d) { try { const f = $('twBook'); if (f && f.contentWindow) f.contentWindow.postMessage({ awf: 1, st: d }, '*'); } catch (e) {} }
  function onState(d) {
    toBook(d);
    if (d.ph === 'lobby') { N.inGame = false; N.lastSt = null; if (N.view === 'tower') showView('room'); render(); return; }
    N.lastSt = d;
    if (N.view === 'tower') renderTower();
  }
  // the pilot's browser reports the flight twice a second
  setInterval(() => {
    if (!N.code || !N.inGame || myRole() !== 'pilot' || !kk()) return;
    const G = kk().G;
    if (!G) { N.flying = false; N.inGame = false; act({ t: 'st', ph: 'lobby' }); showView('room'); return; }
    act({ t: 'st', f: G.flight.seed, ph: G.phase, tl: Math.max(0, Math.round(G.timeLeft)), tot: G.total, k: G.strikes, s: G.solved, n: G.flight.modules.length, o: G.flight.modules.filter((m) => !m.solved).map((m) => m.id), u: +G.cabin.unrest.toFixed(2), tb: G.turb > 0 ? +(G.turbP || 0).toFixed(2) : 0 });
  }, 500);
  // heartbeat: a closed tab or a dead connection is noticed within about ten seconds
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now(), froze = now - lastTick > 6000; lastTick = now;
    if (!N.code) return;
    // a machine that is busy loading the cockpit is not a dead one: after a start, or after our own freeze, the clocks start again
    if (froze || now < (N.grace || 0)) { N.members.forEach((m) => { m.seen = now; }); N.hostSeen = now; }
    if (N.isHost) {
      cast({ t: 'ping' });
      N.members.slice().forEach((m) => { if (m.id !== myId() && now - (m.seen || now) > 20000) { const c = N.conns[m.id]; dropMember(m.id, 'silent ' + (now - m.seen)); try { c && c.close(); } catch (e) {} } });
    } else if (N.hostConn) {
      try { N.hostConn.send({ t: 'ping' }); } catch (e) {}
      if (now - (N.hostSeen || now) > 20000) { const c = N.hostConn; N.hostConn = null; try { c.close(); } catch (e) {} hostGone('silent'); }
    }
  }, 2500);
  // if the lobby dies while the pilot is flying, the overlay stays away until the flight is over
  setInterval(() => { if (N.view === 'fly' && !N.code && kk() && !kk().G) showView('off'); }, 700);

  // ------------------------------------------------------------------ voice
  let ctx = null;
  function fxCtx() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }
  document.addEventListener('pointerdown', () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); });
  let myAn = null;
  function enableMic() {
    if (N.stream) return Promise.resolve(true);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { N.micErr = 'Voice chat needs a browser with microphone support.'; render(); return Promise.resolve(false); }
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }).then((s) => {
      N.stream = s; N.micErr = '';
      const saved = store.get('awf_mic'); N.micMode = saved === 'ptt' || saved === 'muted' ? saved : 'open';
      applyMic();
      const c = fxCtx(); if (c) { try { myAn = c.createAnalyser(); myAn.fftSize = 256; c.createMediaStreamSource(s).connect(myAn); } catch (e) { myAn = null; } }
      if (N.code) { callAll(true); act({ t: 'mic', on: micLive() }); }
      render(); return true;
    }).catch(() => { N.micErr = 'Microphone is blocked. Allow it in the browser, then press the button again. You can still hear the others.'; render(); return false; });
  }
  function applyMic() {
    const on = N.micMode === 'open' || (N.micMode === 'ptt' && N.ptt);
    if (N.stream) N.stream.getAudioTracks().forEach((t) => { t.enabled = on; });
  }
  function cycleMic() {
    if (!N.stream) { enableMic(); return; }
    N.micMode = N.micMode === 'open' ? 'ptt' : N.micMode === 'ptt' ? 'muted' : 'open';
    store.set('awf_mic', N.micMode); N.ptt = false; applyMic(); act({ t: 'mic', on: micLive() }); render();
  }
  function setPtt(v) { if (N.micMode !== 'ptt' || N.ptt === v) return; N.ptt = v; applyMic(); render(); }
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyV' && !e.repeat && !/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) setPtt(true); });
  window.addEventListener('keyup', (e) => { if (e.code === 'KeyV') setPtt(false); });
  window.addEventListener('blur', () => setPtt(false));

  function closeCall(id) {
    const r = N.calls[id]; if (!r) return;
    delete N.calls[id]; detach(id);
    try { r.call.close(); } catch (e) {}
  }
  function wire(call, out) {
    const id = call.peer;
    N.calls[id] = { call, out, at: Date.now() };
    const gone = () => { if (N.calls[id] && N.calls[id].call === call) { delete N.calls[id]; detach(id); render(); } };
    call.on('stream', (s) => attach(id, s));
    call.on('close', gone); call.on('error', gone);
  }
  function place(id) {
    if (!N.stream || !N.peer || id === myId()) return;
    closeCall(id);
    try { const call = N.peer.call(id, N.stream); if (call) wire(call, true); } catch (e) {}
  }
  function callAll(force) { N.members.forEach((m) => { if (m.id !== myId() && (force || !N.calls[m.id])) place(m.id); }); }
  function syncCalls() {
    Object.keys(N.calls).forEach((id) => { if (!N.members.some((m) => m.id === id)) closeCall(id); });
    if (N.stream) callAll(false);
  }
  function onCall(call) {
    if (!N.code) { try { call.close(); } catch (e) {} return; }
    const ex = N.calls[call.peer];
    // both sides dialled at once: the smaller id keeps its own call
    if (ex && ex.out && Date.now() - ex.at < 4000 && myId() < call.peer) { try { call.close(); } catch (e) {} return; }
    if (ex) closeCall(call.peer);
    try { call.answer(N.stream || undefined); } catch (e) { return; }
    wire(call, false);
  }
  function detach(id) {
    const r = N.audio[id]; if (!r) return;
    delete N.audio[id]; delete N.talk[id];
    try { r.a.pause(); r.a.srcObject = null; } catch (e) {}
    (r.nodes || []).forEach((n) => { try { n.disconnect(); } catch (e) {} });
  }
  function curve() { const n = 256, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); } return c; }
  function attach(id, s) {
    detach(id);
    const a = new Audio(); a.autoplay = true; a.playsInline = true; a.srcObject = s;
    const r = { a, s, nodes: [], an: null };
    const c = fxCtx();
    if (c) {
      try {
        const src = c.createMediaStreamSource(s); r.nodes.push(src);
        r.an = c.createAnalyser(); r.an.fftSize = 256; src.connect(r.an); r.nodes.push(r.an);
        if (N.fx) {   // aviation radio: narrow band, a little grit
          const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 420;
          const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3100;
          const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1700; pk.Q.value = 0.9; pk.gain.value = 5;
          const ws = c.createWaveShaper(); ws.curve = curve();
          const g = c.createGain(); g.gain.value = 1.15;
          src.connect(hp); hp.connect(lp); lp.connect(pk); pk.connect(ws); ws.connect(g); g.connect(c.destination);
          r.nodes.push(hp, lp, pk, ws, g);
          a.muted = true;   // the element keeps the stream flowing, the filter chain makes the sound
        }
      } catch (e) { a.muted = false; }
    }
    const p = a.play(); if (p && p.catch) p.catch(() => {});
    N.audio[id] = r; render();
  }
  function level(an, buf) { an.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; } return Math.sqrt(s / buf.length); }
  const lbuf = new Uint8Array(256);
  setInterval(() => {
    if (N.view === 'off') return;
    const now = Date.now(); let ch = false;
    Object.keys(N.audio).forEach((id) => { const r = N.audio[id]; if (r.an && level(r.an, lbuf) > 0.02) { if (!N.talk[id] || now - N.talk[id] > 600) ch = true; N.talk[id] = now; } });
    N.myLevel = myAn && micLive() && (N.micMode === 'open' || N.ptt) ? level(myAn, lbuf) : 0;
    const mt = $('netMeter'); if (mt) mt.style.width = Math.min(100, Math.round(N.myLevel * 400)) + '%';
    renderTalk();
    if (ch && N.view === 'room') renderMembers();
  }, 160);
  function talkers() { const now = Date.now(); return N.members.filter((m) => N.talk[m.id] && now - N.talk[m.id] < 700).map((m) => m.name); }
  function micLabel() {
    return !N.stream ? 'MIC: OFF · TURN ON' : N.micMode === 'open' ? 'MIC: OPEN' : N.micMode === 'ptt' ? 'MIC: PUSH TO TALK' : 'MIC: MUTED';
  }
  function renderTalk() {
    const t = talkers(), txt = t.length ? t.join(', ') + ' TALKING' : 'SILENT';
    const tw = $('twTalk'); if (tw && tw.textContent !== txt) { tw.textContent = txt; tw.className = t.length ? 'on' : ''; }
    const live = N.micMode === 'open' || (N.micMode === 'ptt' && N.ptt);
    const c = !N.code ? '' : (!N.stream ? 'MIC OFF' : N.micMode === 'muted' ? 'MIC MUTED' : N.micMode === 'ptt' ? (N.ptt ? 'TALKING' : 'HOLD V TO TALK') : 'MIC OPEN') + (t.length ? ' · ' + t[0] + ' ●' : '');
    if (chip.textContent !== c) chip.textContent = c;
    chip.className = (N.code ? 'show' : '') + (N.stream && live ? ' live' : '') + (t.length ? ' rx' : '');
  }

  // ------------------------------------------------------------------ render
  function renderMembers() {
    const box = $('netMembers'); box.innerHTML = '';
    const now = Date.now();
    N.members.forEach((m) => {
      const row = document.createElement('div'); row.className = 'net-m' + (m.id === myId() ? ' me' : '') + (N.talk[m.id] && now - N.talk[m.id] < 700 ? ' talk' : '');
      const n = document.createElement('b'); n.textContent = m.name + (m.id === myId() ? ' (you)' : '');
      const r = document.createElement('span'); r.className = 'role ' + m.role; r.textContent = SEAT_NAME[m.role] || 'TOWER';
      const mic = document.createElement('span'); mic.className = 'mic'; mic.textContent = (m.mic ? 'MIC ON' : 'NO MIC') + (m.host ? ' · HOST' : '');
      row.appendChild(n); row.appendChild(r); row.appendChild(mic); box.appendChild(row);
    });
    for (let i = N.members.length; i < MAX; i++) { const row = document.createElement('div'); row.className = 'net-m empty'; row.textContent = 'open seat'; box.appendChild(row); }
  }
  function renderTower() {
    const d = N.lastSt, b = $('twBanner');
    const fmt = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    $('twTime').textContent = d ? fmt(d.tl) : '-:--';
    $('twTime').className = d && d.tl < 30 && d.ph === 'flight' ? 'red' : '';
    let dots = ''; for (let i = 0; i < KK.MAX_STRIKES; i++) dots += '<i class="' + (d && i < d.k ? 'hit' : '') + '"></i>';
    $('twDmg').innerHTML = dots;
    $('twFix').textContent = d ? d.s + ' / ' + d.n : '0 / 0';
    const ph = d ? d.ph : 'wait', role = myRole();
    if (CAB_SEAT[role]) {   // the cabin seats: the saboteur is glad about a crash
      const sab = role === 'saboteur', down = ph === 'crashed', up = ph === 'won' || ph === 'landing';
      b.className = 'net-banner ' + (up || down ? (up !== sab ? 'ok show' : 'bad show') : ph === 'wait' || ph === 'intro' ? 'show' : '');
      b.textContent = up ? (sab ? 'THE AIRCRAFT IS ON THE GROUND. The crew beat you. Waiting for the pilot to come back to the lobby.' : 'ON THE GROUND. You kept the cabin together. Waiting for the pilot to come back to the lobby.')
        : down ? (sab ? 'AIRCRAFT LOST. That was your doing. Waiting for the pilot to come back to the lobby.' : 'AIRCRAFT LOST. Waiting for the pilot to come back to the lobby.')
        : ph === 'wait' || ph === 'intro' ? (sab ? 'You are a passenger like everybody else. Nobody knows what you are up to.' : 'Cabin crew, take your position. The flight is about to get rough.') : '';
      return;
    }
    b.className = 'net-banner ' + (ph === 'won' || ph === 'landing' ? 'ok show' : ph === 'crashed' ? 'bad show' : ph === 'wait' || ph === 'intro' ? 'show' : '');
    b.textContent = ph === 'won' ? 'ON THE GROUND. Everybody walked away. Waiting for the pilot to come back to the lobby.'
      : ph === 'landing' ? 'ALL SYSTEMS STABLE. The aircraft is cleared to land.'
      : ph === 'crashed' ? 'AIRCRAFT LOST. Waiting for the pilot to come back to the lobby.'
      : ph === 'intro' ? 'MAYDAY. The pilot is in the cockpit. Ask for the OPEN FAILURES list.'
      : ph === 'wait' ? 'Waiting for the aircraft…' : '';
  }
  function render() {
    if (N.view === 'browse') {
      $('netStatus').textContent = N.error || N.status || '';
      $('netStatus').className = 'net-status' + (N.error ? ' err' : '');
      const box = $('netRooms'); box.innerHTML = '';
      ROOMS.forEach((name) => {
        const r = N.rooms[name] || { s: 'checking' };
        const b = document.createElement('button'); b.className = 'net-room-b ' + r.s + (r.s === 'open' && (r.n >= MAX) ? ' full' : '');
        const full = r.s === 'open' && r.n >= MAX;
        const st = r.s === 'checking' ? 'checking…' : r.s === 'empty' ? 'empty · open it' : full ? 'full' : r.n + ' / ' + MAX + (r.inGame ? ' · in flight' : r.need ? ' · needs ' + r.need : ' · ready');
        b.innerHTML = '<b>' + name + '</b><span>' + st + '</span>';
        b.disabled = r.s === 'checking' || full;
        b.onclick = () => { if (r.s === 'open') join(name); else host(name, true); };
        box.appendChild(b);
      });
    } else if (N.view === 'room') {
      $('netRoomCode').textContent = N.code || '';
      $('netRoomHint').textContent = ROOMS.indexOf(N.code) >= 0 ? 'PUBLIC LOBBY · ANYONE CAN JOIN' : 'PRIVATE · SHARE THIS CODE WITH YOUR CREW';
      renderMembers();
      const role = myRole();
      $('netPilot').classList.toggle('sel', role === 'pilot'); $('netTower').classList.toggle('sel', role === 'tower');
      $('netSab').classList.toggle('sel', role === 'saboteur'); $('netAtt').classList.toggle('sel', role === 'attendant');
      $('netPilot').disabled = $('netTower').disabled = $('netSab').disabled = $('netAtt').disabled = N.inGame;
      const mb = $('netModes'); mb.innerHTML = '';
      Object.keys(KK.MODES).forEach((k) => {
        const m = KK.MODES[k], b = document.createElement('button');
        b.className = 'net-mode' + (N.mode === k ? ' sel' : ''); b.disabled = !N.isHost || N.inGame;
        b.innerHTML = '<b>' + m.name + '</b><span>' + m.desc + '</span>';
        b.onclick = () => { N.mode = k; roster(); };
        mb.appendChild(b);
      });
      $('netMic').textContent = micLabel(); $('netMic').classList.toggle('sel', micLive());
      $('netFx').textContent = 'RADIO EFFECT: ' + (N.fx ? 'ON' : 'OFF');
      $('netMicNote').textContent = N.micErr || (N.micMode === 'ptt' ? 'Hold V (or the HOLD TO TALK button) while you speak.' : N.stream ? 'Say something: the bar moves when the microphone hears you. Headphones avoid echo.' : 'Turn the microphone on to talk to your crew.');
      $('netMicNote').className = 'net-note' + (N.micErr ? ' err' : '');
      const pilots = N.members.filter((m) => m.role === 'pilot').length, towers = N.members.filter((m) => m.role === 'tower').length;
      const why = N.inGame ? 'A flight is in progress.' : N.members.length < 2 ? 'Waiting for a second player. Share the code ' + N.code + '.' : pilots !== 1 ? 'Somebody has to take the PILOT seat.' : !towers ? 'Somebody has to take the TOWER seat.' : N.isHost ? 'Crew complete. Start when everybody is ready.' : 'Crew complete. Waiting for the host to start.';
      $('netRoomStatus').textContent = why; $('netRoomStatus').className = 'net-status';
      $('netStart').style.display = N.isHost ? '' : 'none'; $('netStart').disabled = !canStart();
    } else if (N.view === 'tower') {
      renderTower();
      $('twMic').textContent = micLabel(); $('twMic').classList.toggle('sel', micLive());
      $('twPtt').style.display = N.micMode === 'ptt' ? '' : 'none'; $('twPtt').classList.toggle('sel', N.ptt);
    }
    renderTalk();
  }

  // ------------------------------------------------------------------ wiring
  $('netClose').onclick = closeOnline;
  $('netRefresh').onclick = refresh;
  $('netCreate').onclick = () => host(genCode(), false);
  $('netJoin').onclick = () => join($('netCode').value);
  $('netCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') join($('netCode').value); e.stopPropagation(); });
  $('netName').addEventListener('keydown', (e) => e.stopPropagation());
  $('netLeave').onclick = leave;
  $('twLeave').onclick = () => { dropPeer(); showView('browse'); refresh(); };
  $('netPilot').onclick = () => act({ t: 'role', role: 'pilot' });
  $('netTower').onclick = () => act({ t: 'role', role: 'tower' });
  $('netSab').onclick = () => act({ t: 'role', role: 'saboteur' });
  $('netAtt').onclick = () => act({ t: 'role', role: 'attendant' });
  $('netMic').onclick = cycleMic; $('twMic').onclick = cycleMic; chip.onclick = (e) => { e.stopPropagation(); cycleMic(); };
  $('netFx').onclick = () => { N.fx = !N.fx; store.set('awf_fx', N.fx ? '1' : '0'); Object.keys(N.audio).forEach((id) => attach(id, N.audio[id].s)); render(); };
  $('netStart').onclick = start;
  const tp = $('twPtt');
  tp.addEventListener('pointerdown', (e) => { e.preventDefault(); setPtt(true); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => tp.addEventListener(ev, () => setPtt(false)));
  ['beforeunload', 'pagehide'].forEach((ev) => window.addEventListener(ev, () => { try { if (N.peer) N.peer.destroy(); } catch (e) {} }));

  function open() {
    if (kk() && kk().G) return;
    N.error = ''; N.status = '';
    if (!window.Peer) { showView('browse'); fail(new Error('nolib')); return; }
    showView('browse'); refresh();
  }
  const btn = $('btnOnline'); if (btn) btn.onclick = open;
  window.KKNet = { open, state: N, host, join, start, act, enableMic, show: showView };
})();
