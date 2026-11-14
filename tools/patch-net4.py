#!/usr/bin/env python3
"""ARE WE FALLING? - lobby fix (post-jam): js/net.js and css/net.css, exact-string replacements.
Usage: python3 patch-net4.py <game folder>      (the folder that holds index.html, js/, css/)
Every replacement must match exactly once; nothing is written unless all of them match. Running it twice is refused."""
import sys, io, os

root = sys.argv[1] if len(sys.argv) > 1 else '.'
R = []   # (file, old, new)

def rep(f, old, new):
    R.append((f, old, new))

NET = 'js/net.js'

# ---------------------------------------------------------------- state
rep(NET,
"""    dbg: [], stream: null, micMode: 'off', micErr: '', ptt: false, calls: {}, audio: {}, fx: store.get('awf_fx') !== '0', talk: {}, myLevel: 0,
  };
  const pending = {};
""",
"""    dbg: [], stream: null, micMode: 'off', micErr: '', ptt: false, calls: {}, audio: {}, fx: store.get('awf_fx') !== '0', talk: {}, myLevel: 0,
    joining: false, joinCode: '', viaRelay: Date.now() - (+store.get('awf_relay') || 0) < 1800000, diag: '', ice: null, relayed: '', dropAt: 0, rx: 0, listAt: 0, game: 0, played: 0,
  };
  // gen counts the peers that were thrown away, flow the things the player asked for: whatever comes back for an older number is dropped
  const pending = {}, probes = {}; let gen = 0, flow = 0, opening = null;
""")

rep(NET,
"""  const myId = () => (N.peer ? N.peer.id : null);
""",
"""  const myId = () => (N.peer ? N.peer.awfId || N.peer.id : null);   // PeerJS forgets its id while the lobby service is away, the lobby must not
  const sockUp = (p) => { try { return !!(p && !p.destroyed && !p.disconnected && p.socket && p.socket._wsOpen()); } catch (e) { return false; } };   // is the line to the lobby service open right now?
""")

# ---------------------------------------------------------------- DOM: a small line for details under an error
rep(NET,
"""      '<div id="netStatus" class="net-status"></div>' +
    '</div>' +
""",
"""      '<div id="netStatus" class="net-status"></div><div id="netDiag" class="net-diag"></div>' +
    '</div>' +
""")

# ---------------------------------------------------------------- openPeer
rep(NET,
"""      const to = setTimeout(() => { if (!done) { done = true; try { p.destroy(); } catch (e) {} rej(new Error('timeout')); } }, 12000);
      p.on('open', () => { if (done) return; done = true; clearTimeout(to); res(p); });
      p.on('error', (e) => {
        if (!done) { done = true; clearTimeout(to); try { p.destroy(); } catch (x) {} rej(e); return; }
        if (p !== N.peer) return;
        if (e && e.type === 'peer-unavailable') { Object.keys(pending).forEach((id2) => { if (String(e.message || '').indexOf(id2) >= 0) pending[id2](); }); return; }
        if (e && (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' || e.type === 'socket-closed')) { clearTimeout(p.awfT); p.awfT = setTimeout(() => { if (N.peer === p && !p.destroyed && p.disconnected) toast('Connection to the lobby service is unstable.'); }, 6000); }
      });
""",
"""      const to = setTimeout(() => { if (!done) { done = true; try { p.destroy(); } catch (e) {} rej(new Error('offline')); } }, 12000);
      p.on('open', () => { if (done) return; done = true; clearTimeout(to); res(p); });
      p.on('error', (e) => {
        const t = e && e.type;
        if (t === 'network' || t === 'server-error') N.dropAt = Date.now();
        if (!done) { done = true; clearTimeout(to); try { p.destroy(); } catch (x) {} rej(e); return; }
        if (p !== N.peer) return;
        if (t === 'peer-unavailable') {   // the lobby service says that nobody has that name
          const who = String(e.message || '').split(' ').pop();
          if (pending[who]) pending[who](); if (probes[who]) probes[who].gone();
          return;
        }
        if (t === 'unavailable-id' && N.isHost) {   // while this lobby was away from the lobby service, somebody else opened one under its name
          p.awfLost = true;
          if (Object.keys(N.conns).some((id) => !N.conns[id].relay)) toast('This lobby lost its name on the lobby service. Your crew can keep playing, nobody new can join.', 9000);
          else hostGone('taken');
        }
      });
""")

# ---------------------------------------------------------------- setPeer, dropPeer, ensurePeer, connectTo
rep(NET,
"""    N.peer = p;
    p.on('connection', onConnection);
    p.on('call', onCall);
    let tries = 0;
    p.on('open', () => { tries = 0; });
    p.on('disconnected', () => {   // come back after a moment, a little longer each time
      if (N.peer !== p || p.destroyed) return;
      setTimeout(() => { if (N.peer === p && !p.destroyed && p.disconnected) { try { p.reconnect(); } catch (e) {} } }, Math.min(8000, 500 * Math.pow(2, tries++)));
    });
    try { p.socket.on('message', (m) => { if (N.peer === p && m && m.type === 'CANDIDATE' && m.payload && m.payload.awf) onRelay(String(m.src), m.payload.awf); }); } catch (e) {}
  }
  function dropPeer() {
""",
"""    N.peer = p; p.awfId = p.id;
    p.on('connection', onConnection);
    p.on('call', onCall);
    let tries = 0, last = 0, att = 0;
    p.on('open', () => { tries = 0; });
    p.on('disconnected', () => {   // come back after a moment, a little longer each time (the lobby service keeps messages for five seconds only)
      if (N.peer !== p || p.destroyed || p.awfLost) return;
      const now = Date.now(); if (now - last > 30000) tries = 0; last = N.dropAt = now;
      setTimeout(() => {
        if (N.peer !== p || p.destroyed || !p.disconnected) return;
        const k = ++att;
        try { p.reconnect(); } catch (e) {}
        // PeerJS does not notice a reconnect that hangs: look again, and start over
        setTimeout(() => { if (k === att && N.peer === p && !p.destroyed && !p.disconnected && !sockUp(p)) { try { p.disconnect(); } catch (e) {} } }, 8000);
      }, Math.min(3000, 500 * Math.pow(2, tries++)));
    });
    try { p.socket.on('message', (m) => { if (N.peer !== p) return; N.rx = Date.now(); if (m && m.type === 'CANDIDATE' && m.payload && m.payload.awf) onRelay(String(m.src), m.payload.awf); }); } catch (e) {}
  }
  function dropPeer() {
    gen++; opening = null;
""")

rep(NET,
"""    N.conns = {}; N.members = []; N.code = null; N.isHost = false; N.inGame = false; N.lastSt = null;
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
""",
"""    N.conns = {}; N.members = []; N.code = null; N.isHost = false; N.inGame = false; N.lastSt = null; N.game = 0; N.played = 0;
  }
  /* a peer for looking around and joining. One whose line to the lobby service is down is of no use: PeerJS refuses to connect with it, so a new one is opened. */
  function ensurePeer() {
    if (sockUp(N.peer) && !N.isHost) return Promise.resolve(N.peer);
    if (opening) return opening;   // somebody already waits for one
    dropPeer(); const mine = gen;
    const pr = opening = openPeer().then((p) => {
      if (opening === pr) opening = null;
      if (mine !== gen) { try { p.destroy(); } catch (e) {} throw new Error('stale'); }
      setPeer(p); return p;
    }, (e) => { if (opening === pr) opening = null; throw e; });
    return pr;
  }
  function watch(c) {   // what the direct way found out, for the details line under an error
    const d = N.ice = { st: 'new', host: 0, srflx: 0, relay: 0 };
    try {
      const pc = c.peerConnection; if (!pc || !pc.addEventListener) return;
      pc.addEventListener('icecandidate', (e) => { const k = e && e.candidate, t = k && (k.type || (/ typ (\\w+)/.exec(k.candidate || '') || [])[1]); if (t === 'prflx') d.srflx++; else if (t && d[t] != null) d[t]++; });
      pc.addEventListener('iceconnectionstatechange', () => { d.st = pc.iceConnectionState; });
    } catch (e) {}
  }
  function connectTo(id, meta, ms) {
    return new Promise((res, rej) => {
      let done = false, c = null;
      const un = () => fin(rej, new Error('unavailable'));
      const fin = (f, v) => { if (done) return; done = true; clearTimeout(to); if (pending[id] === un) delete pending[id]; if (f === rej) { try { c && c.close(); } catch (e) {} } f(v); };
      const to = setTimeout(() => fin(rej, new Error('timeout')), ms || 9000);
      pending[id] = un;
      try { c = N.peer.connect(id, { reliable: true, serialization: 'json', metadata: meta }); } catch (e) { c = null; }
      if (!c) { fin(rej, new Error('offline')); return; }   // PeerJS gives nothing back while the line to the lobby service is down
      watch(c);
      c.on('open', () => fin(res, c));
      c.on('error', (e) => fin(rej, e));
    });
  }
""")

# ---------------------------------------------------------------- the relay
rep(NET,
"""  function relaySend(dst, body) { try { N.peer.socket.send({ type: 'CANDIDATE', dst, payload: { awf: body } }); } catch (e) {} }
  function makeRelay(id, meta) {
    const h = {}, c = {
      peer: id, metadata: meta || {}, relay: true, open: false,
      on(ev, f) { (h[ev] = h[ev] || []).push(f); return c; },
      emit(ev, v) { (h[ev] || []).slice().forEach((f) => { try { f(v); } catch (e) {} }); },
      send(d) { if (c.open) relaySend(id, { k: 'd', d }); },
""",
"""  function relaySend(dst, body) { try { N.peer.socket.send({ type: 'CANDIDATE', dst, payload: { awf: body } }); } catch (e) {} }
  /* A message to our own name comes straight back from the lobby service. N.rx (the time of the last message from the service) then tells a dead line from a quiet one. */
  function echo() { relaySend(myId(), { k: 'e' }); }
  function makeRelay(id, meta) {
    const h = {}, c = {
      peer: id, metadata: meta || {}, relay: true, open: false, seen: Date.now(),
      on(ev, f) { (h[ev] = h[ev] || []).push(f); return c; },
      emit(ev, v) { (h[ev] || []).slice().forEach((f) => { try { f(v); } catch (e) {} }); },
      send(d) {
        if (!c.open) return;
        if (d && d.t === 'st' && d.ph === 'flight') {   // the lobby service is not a data channel: one flight report a second is enough, unless something happened
          const now = Date.now(), key = [d.k, d.s, d.n, d.sab].join();
          if (key === c.stK && now - c.stT < 900) return;
          c.stK = key; c.stT = now;
        }
        relaySend(id, { k: 'd', d });
      },
""")

rep(NET,
"""  function onRelay(src, m) {
    if (!m || typeof m !== 'object') return;
    let c = relays[src];
""",
"""  function onRelay(src, m) {
    if (!m || typeof m !== 'object') return;
    if (m.k === 'e') return;   // our own echo (see echo below): it only had to arrive
    if (m.k === 'q') { if (N.isHost && N.code) relaySend(src, { k: 'i', d: info() }); return; }   // the lobby list of somebody asks who is here
    if (m.k === 'i') { if (probes[src] && m.d && typeof m.d === 'object') probes[src].info(m.d); return; }
    let c = relays[src];
""")

rep(NET,
"""    else if (m.k === 'd') { if (c.open) c.emit('data', m.d); }
""",
"""    else if (m.k === 'd') { if (c.open) { c.seen = Date.now(); c.emit('data', m.d); } }
""")

rep(NET,
"""      let done = false; const c = makeRelay(id, meta);
      const fin = (f, v) => { if (done) return; done = true; clearTimeout(to); delete pending[id]; f(v); };
      const to = setTimeout(() => { if (relays[id] === c) delete relays[id]; fin(rej, new Error('timeout')); }, ms || 8000);
      pending[id] = () => { if (relays[id] === c) delete relays[id]; fin(rej, new Error('unavailable')); };
      c.on('open', () => fin(res, c)); c.on('error', (e) => fin(rej, e));
      relaySend(id, { k: 'hi', meta });
    });
  }
  /* the direct way first; if the other browser is there but cannot be reached, the relay */
  function connectAny(id, meta, ms) {
    return connectTo(id, meta, N.viaRelay ? 2500 : ms).catch((e) => {
      if (!e || e.message !== 'timeout') throw e;
      return relayConnect(id, meta, 8000).then((c) => { N.viaRelay = true; return c; });
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
""",
"""      let done = false; const c = makeRelay(id, meta);
      const hi = () => relaySend(id, { k: 'hi', meta });   // PeerJS drops what is sent while the line is down, without a word: so ask until somebody answers
      const un = () => { N.relayed = 'nobody there'; fin(rej, new Error('unavailable')); };
      const fin = (f, v) => { if (done) return; done = true; clearTimeout(to); clearInterval(iv); if (pending[id] === un) delete pending[id]; if (f === rej && relays[id] === c) delete relays[id]; f(v); };
      const to = setTimeout(() => { N.relayed = 'no answer'; fin(rej, new Error('timeout')); }, ms || 8000), iv = setInterval(hi, 1500);
      pending[id] = un;
      c.on('open', () => { N.relayed = 'answered'; fin(res, c); }); c.on('error', (e) => fin(rej, e));
      N.relayed = 'asked'; hi();
    });
  }
  /* the direct way first; if that does not work for whatever reason, the relay. Only "nobody has that name" ends it at once. */
  function connectAny(id, meta, ms, note) {
    const p = N.peer;
    return connectTo(id, meta, N.viaRelay ? 2500 : ms).then((c) => {
      if (N.viaRelay) { N.viaRelay = false; store.set('awf_relay', '0'); }
      return c;
    }, (e) => {
      if (N.peer !== p) throw new Error('stale');
      if (e && e.message === 'unavailable') throw e;
      if (note) note();
      return relayConnect(id, meta, 6000).then((c) => { N.viaRelay = true; store.set('awf_relay', String(Date.now())); return c; });   // next time the direct way gets less patience
    });
  }
  function details(t) {
    const i = N.ice;
    return 'DETAILS · lobby service ' + (sockUp(N.peer) ? 'connected' : 'not connected') +
      (i ? ' · direct way ' + i.st + ' (' + i.host + ' local, ' + i.srflx + ' public, ' + i.relay + ' relayed)' : '') +
      (N.relayed ? ' · relay ' + N.relayed : '') + (t ? ' · ' + String(t).slice(0, 24) : '');
  }
  function fail(e) {
    const t = e && (e.type || e.message);
    if (t === 'stale') return;   // an older attempt that something newer has replaced
    N.status = '';
    N.error = t === 'nolib' ? 'Online play is not available in this copy of the game.'
      : t === 'browser-incompatible' ? 'This browser cannot do online play. Try Chrome, Edge, Firefox or Safari.'
      : t === 'unavailable' ? 'No lobby answered with that code.'
      : t === 'timeout' ? 'The lobby did not answer. Try again. If it keeps failing, reload the page on both computers.'
      : 'Could not reach the lobby service. Check the internet connection and try again. Same-room play still works.';
    N.diag = t === 'nolib' || t === 'browser-incompatible' ? '' : details(t);
    N.joining = false; render();
  }
""")

# ---------------------------------------------------------------- lobby list, host, join
rep(NET,
"""  function probe(name) {
    N.rooms[name] = { s: 'checking' };
    connectAny(PREFIX + name, { probe: 1 }, 7000).then((c) => {
      const to = setTimeout(() => { N.rooms[name] = { s: 'empty' }; try { c.close(); } catch (e) {} render(); }, 4000);
      c.on('data', (d) => { if (d && d.t === 'info') { clearTimeout(to); N.rooms[name] = { s: 'open', n: d.n, inGame: d.inGame, need: d.need }; try { c.close(); } catch (e) {} render(); } });
    }).catch(() => { N.rooms[name] = { s: 'empty' }; render(); });
  }
  function refresh() {
    N.error = ''; N.status = 'Looking for lobbies…'; render();
    ensurePeer().then(() => { N.status = ''; ROOMS.forEach(probe); render(); }).catch(fail);
  }
""",
"""  /* The list asks every public lobby through the lobby service who is in it. No WebRTC connection is opened for that:
     eight of them for every look at the list were slow on strict networks and a lot of traffic for the lobby service. */
  function probe(name) {
    const id = PREFIX + name; if (probes[id]) probes[id].stop();
    N.rooms[name] = { s: 'checking' };
    const ask = () => relaySend(id, { k: 'q' });
    const pr = probes[id] = {
      iv: setInterval(ask, 2500),
      to: setTimeout(() => pr.end({ s: 'empty', quiet: true }), 9000),   // neither an answer nor a "nobody there"
      stop() { clearInterval(pr.iv); clearTimeout(pr.to); if (probes[id] === pr) delete probes[id]; },
      end(r) {
        pr.stop(); N.rooms[name] = r;
        if (r.quiet && N.view === 'browse' && !N.error && !N.joining && N.rx < N.listAt && ROOMS.every((x) => N.rooms[x] && N.rooms[x].quiet)) {   // not a single word came back, not even our own echo
          N.error = 'The lobby service does not answer on this network right now. Press REFRESH to try again.'; N.diag = details('silent');
          if (!N.isHost) dropPeer();   // the next look opens a new line
        }
        render();
      },
      info(d) { pr.end({ s: 'open', n: Math.max(0, Math.min(MAX, Math.round(+d.n) || 0)), inGame: !!d.inGame, need: d.need === 'PILOT' || d.need === 'TOWER' ? d.need : '' }); },
      gone() { pr.end({ s: 'empty' }); },
    };
    ask();
  }
  const LOOKING = 'Looking for lobbies…';
  function refresh() {
    const f = ++flow; N.joining = false;
    N.error = ''; N.diag = ''; N.status = LOOKING; render();
    ensurePeer().then(() => {
      if (N.status === LOOKING) N.status = '';
      N.listAt = Date.now(); echo(); setTimeout(echo, 2500); setTimeout(echo, 5000);
      ROOMS.forEach(probe); render();
    }).catch((e) => { if (f === flow) fail(e); });
  }
""")

rep(NET,
"""    N.error = ''; N.status = 'Opening lobby ' + code + '…'; render();
    dropPeer();
    return openPeer(PREFIX + code).then((p) => {
      setPeer(p); N.code = code; N.isHost = true; N.inGame = false; N.status = '';
""",
"""    const f = ++flow; N.joining = false;
    N.error = ''; N.diag = ''; N.status = 'Opening lobby ' + code + '…'; render();
    dropPeer(); const mine = gen;
    return openPeer(PREFIX + code).then((p) => {
      if (mine !== gen || f !== flow) { try { p.destroy(); } catch (e) {} return; }   // the player went somewhere else meanwhile
      setPeer(p); N.code = code; N.isHost = true; N.inGame = false; N.status = '';
""")

rep(NET,
"""    }).catch((e) => {
      if (e && e.type === 'unavailable-id') { if (isPublic) return join(code); if ((tries || 0) < 4) return host(genCode(), false, (tries || 0) + 1); }
      fail(e);
    });
  }
  function join(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) { N.error = 'Type the lobby code first.'; render(); return Promise.resolve(); }
    N.error = ''; N.status = 'Joining lobby ' + code + '…'; N.joining = true; render();
    return ensurePeer().then(() => connectAny(PREFIX + code, { name: myName() }, 7000)).then((c) => {
      N.hostConn = c; N.code = code; N.isHost = false; N.joining = false; N.hostSeen = Date.now();
      c.on('data', (d) => onMsg(d, c.peer));
      c.on('close', () => { if (N.hostConn === c) hostGone(); });
      c.send({ t: 'hello', name: myName(), mic: micLive() });
      if (c.relay) toast('This network blocks the direct connection, so the lobby runs through the relay. Voice chat may stay silent.', 8000);
      // connected, but the lobby never showed up: say so instead of waiting forever
      setTimeout(() => { if (N.hostConn === c && N.view === 'browse') { N.hostConn = null; try { c.close(); } catch (e) {} dropPeer(); N.status = ''; N.error = 'The lobby did not answer. Try again.'; render(); } }, 9000);
    }).catch(fail);
  }
""",
"""    }).catch((e) => {
      if (f !== flow) return;
      if (e && e.type === 'unavailable-id') { if (isPublic) return join(code); if ((tries || 0) < 4) return host(genCode(), false, (tries || 0) + 1); }
      fail(e);
    });
  }
  function join(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) { N.error = 'Type the lobby code first.'; render(); return Promise.resolve(); }
    if (N.joining && N.joinCode === code) return Promise.resolve();   // a second press does not start over (another code does)
    const f = ++flow, id = PREFIX + code; N.joinCode = code;
    const say = (t) => { if (f === flow) { N.status = 'Joining lobby ' + code + ' · ' + t; render(); } };
    N.error = ''; N.diag = ''; N.ice = null; N.relayed = ''; N.joining = true; say('reaching the lobby service…');
    const attempt = (n) => {
      const t0 = Date.now();
      return ensurePeer().then(() => {
        if (f !== flow) throw new Error('stale');
        echo();
        say(n ? 'no answer yet, trying again…' : 'calling the host…');
        return connectAny(id, { name: myName() }, n ? 3000 : 6000, () => say('no direct connection on this network, trying the relay…'));
      }).catch((e) => {
        // One more try where it can help: the line to the lobby service was shaky a moment ago, or nothing at all came back, not even our own echo (a dead line does not say that it is dead).
        const t = e && (e.type || e.message), shaky = Date.now() - N.dropAt < 120000, deaf = N.rx < t0;
        const again = f === flow && n < 1 && (t === 'unavailable' ? shaky : t === 'timeout' ? shaky || deaf : t === 'network' || t === 'server-error');
        if (!again) throw e;
        say('no answer yet, trying again…');
        if (t === 'timeout' && deaf) dropPeer();
        return new Promise((r) => setTimeout(r, 1500)).then(() => attempt(n + 1));
      });
    };
    return attempt(0).then((c) => {
      if (f !== flow) { try { c.close(); } catch (e) {} return; }
      N.hostConn = c; N.code = code; N.isHost = false; N.joining = false; N.hostSeen = Date.now();
      c.on('data', (d) => onMsg(d, c.peer));
      c.on('close', () => { if (N.hostConn === c) hostGone(); });
      const hello = () => { try { c.send({ t: 'hello', name: myName(), mic: micLive() }); } catch (e) {} };
      hello(); say('connected, waiting for the crew list…');
      if (c.relay) toast('This network blocks the direct connection, so the lobby runs through the relay. Voice chat may stay silent.', 8000);
      // until the crew list is here, say hello again now and then; with no answer at all, say so instead of waiting forever
      const iv = setInterval(() => { if (N.hostConn !== c || N.view !== 'browse') clearInterval(iv); else hello(); }, 2000);
      setTimeout(() => { clearInterval(iv); if (N.hostConn === c && N.view === 'browse') { N.hostConn = null; try { c.close(); } catch (e) {} dropPeer(); N.status = ''; N.error = 'The lobby did not answer. Try again.'; N.diag = details('no crew list'); render(); } }, 9000);
    }).catch((e) => { if (f === flow) fail(e); });
  }
""")

rep(NET,
"""  function closeOnline() {
    dropPeer();
""",
"""  function closeOnline() {
    flow++; N.joining = false;
    dropPeer();
""")

# ---------------------------------------------------------------- host side
rep(NET,
"""  function onConnection(c) {
    if (!N.isHost) { c.on('open', () => { try { c.close(); } catch (e) {} }); return; }
""",
"""  function onConnection(c) {
    if (!c.relay) setTimeout(() => { if (!c.open) { try { c.close(); } catch (e) {} } }, 20000);   // a direct attempt that never got through: PeerJS would keep it and its connection for ever
    if (!N.isHost) { c.on('open', () => { try { c.close(); } catch (e) {} }); return; }
""")

rep(NET,
"""      const old = N.conns[c.peer];
      if (old && old !== c && old.relay && !c.relay) { try { c.close(); } catch (e) {} return; }   // this player already came in through the relay
""",
"""      const old = N.conns[c.peer];
      if (old && old !== c && old.relay && !c.relay && Date.now() - old.seen < 6000) { try { c.close(); } catch (e) {} return; }   // this player already came in through the relay, and is talking there
""")

rep(NET,
"""  function roster() {
    cast({ t: 'roster', members: N.members, mode: N.mode, inGame: N.inGame, code: N.code });
    syncCalls(); render();
  }
""",
"""  const rosterMsg = () => ({ t: 'roster', members: N.members, mode: N.mode, inGame: N.inGame, code: N.code, g: N.game });   // g: the number of the flight, so that a start is not missed and not taken twice
  function roster() {
    cast(rosterMsg());
    syncCalls(); render();
  }
""")

rep(NET,
"""    N.inGame = true; roster();
    cast({ t: 'start', mode: N.mode }); onStart(N.mode);
  }
""",
"""    N.inGame = true; N.game++; roster();
    cast({ t: 'start', mode: N.mode, g: N.game }); onStart(N.mode, N.game);
  }
""")

# ---------------------------------------------------------------- everybody
rep(NET,
"""      N.inGame = !!d.inGame; N.status = '';
      if (N.view === 'browse') { showView('room'); enableMic(); }
      if (N.inGame && myRole() !== 'pilot' && N.view === 'room') showView('tower');
      syncCalls(); render();
    } else if (d.t === 'start') onStart(d.mode);
""",
"""      N.inGame = !!d.inGame; N.status = '';
      if (N.view === 'browse') { showView('room'); enableMic(); }
      // the crew list also carries the state of the flight: a start or an end that got lost on the way is made up for here
      const g = Math.round(+d.g) || 0;
      if (N.inGame && g && g !== N.played) onStart(d.mode, g);
      else if (N.inGame && g && myRole() === 'pilot' && !N.flying && kk() && !kk().G) act({ t: 'st', ph: 'lobby' });
      else if (!N.inGame && N.view === 'tower') onState({ t: 'st', ph: 'lobby' });
      if (N.inGame && myRole() !== 'pilot' && N.view === 'room') showView('tower');
      syncCalls(); render();
    } else if (d.t === 'start') onStart(d.mode, Math.round(+d.g) || 0);
""")

rep(NET,
"""  function onStart(mode) { N.grace = Date.now() + 60000;
""",
"""  function onStart(mode, g) {
    if (g && g === N.played) return;   // the same start, heard a second time
    if (g) N.played = g;
    N.grace = Date.now() + 60000;
""")

# ---------------------------------------------------------------- heartbeat
rep(NET,
"""  let lastTick = Date.now();
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
""",
"""  let lastTick = Date.now(), beat = 0;
  const patience = (c) => (c && c.relay ? 45000 : 20000);   // the relay loses messages whenever the lobby service hiccups: more patience there
  setInterval(() => {
    const now = Date.now(), froze = now - lastTick > 6000; lastTick = now;
    if (!N.code) return;
    // a machine that is busy loading the cockpit is not a dead one: after a start, or after our own freeze, the clocks start again
    if (froze || now < (N.grace || 0)) { N.members.forEach((m) => { m.seen = now; }); N.hostSeen = now; }
    let relayed = false;
    if (N.isHost) {
      cast({ t: 'ping' });
      beat++;
      Object.keys(N.conns).forEach((id) => { const c = N.conns[id]; if (!c.relay) return; relayed = true; if (beat % 2 === 0) { try { c.send(rosterMsg()); } catch (e) {} } });   // the crew list again every five seconds, in case one got lost
      N.members.slice().forEach((m) => { if (m.id !== myId() && now - (m.seen || now) > patience(N.conns[m.id])) { const c = N.conns[m.id]; dropMember(m.id, 'silent ' + (now - m.seen)); try { c && c.close(); } catch (e) {} } });
    } else if (N.hostConn) {
      relayed = !!N.hostConn.relay;
      try { N.hostConn.send({ t: 'ping' }); } catch (e) {}
      if (now - (N.hostSeen || now) > patience(N.hostConn)) { const c = N.hostConn; N.hostConn = null; try { c.close(); } catch (e) {} hostGone('silent'); }
    }
    // the line to the lobby service: it matters while people can still join, and all the time for whoever plays through the relay
    if (sockUp(N.peer)) { if (!N.upAt) N.upAt = now; if (now - N.upAt > 5000) N.downAt = 0; } else { N.upAt = 0; if (!N.downAt) N.downAt = now; }
    if (N.downAt && now - N.downAt > 12000 && now - (N.saidAt || 0) > 30000 && (relayed || (N.isHost && N.view === 'room')) && N.peer && !N.peer.awfLost) { N.saidAt = now; toast('Connection to the lobby service is unstable.'); }
  }, 2500);
""")

# ---------------------------------------------------------------- render, export
rep(NET,
"""      $('netStatus').className = 'net-status' + (N.error ? ' err' : '');
""",
"""      $('netStatus').className = 'net-status' + (N.error ? ' err' : '');
      $('netDiag').textContent = N.error ? N.diag || '' : '';
""")

rep(NET,
"""        const st = r.s === 'checking' ? 'checking…' : r.s === 'empty' ? 'empty · open it' : full ? 'full'""",
"""        const st = r.s === 'checking' ? 'checking…' : r.s === 'empty' ? (r.quiet ? 'no answer · try it' : 'empty · open it') : full ? 'full'""")

rep(NET,
"""  window.KKNet = { open, state: N, host, join, start, act, enableMic, show: showView };
""",
"""  window.KKNet = { open, state: N, host, join, start, act, enableMic, show: showView, details: () => details('') };
""")

# ---------------------------------------------------------------- css
rep('css/net.css',
""".net-status.err, .net-note.err { color: #ff6b5f; }
""",
""".net-status.err, .net-note.err { color: #ff6b5f; }
.net-diag { min-height: 13px; margin-top: 5px; font-size: 10px; letter-spacing: .6px; color: var(--dim); opacity: .85; }
""")

# ---------------------------------------------------------------- apply
texts = {}
for f, old, new in R:
    p = os.path.join(root, f)
    if f not in texts:
        texts[f] = io.open(p, encoding='utf-8', newline='').read()
bad = 0
for i, (f, old, new) in enumerate(R):
    n = texts[f].count(old)
    if n != 1:
        bad += 1
        print('NO MATCH' if n == 0 else 'MATCHES %d TIMES' % n, '#%d in %s: %r' % (i, f, old[:70]))
if bad:
    print('nothing written (%d of %d replacements do not fit; already patched, or the file changed)' % (bad, len(R)))
    sys.exit(1)
for f, old, new in R:
    texts[f] = texts[f].replace(old, new, 1)
for f, t in texts.items():
    io.open(os.path.join(root, f), 'w', encoding='utf-8', newline='').write(t)
    print('patched', f)
