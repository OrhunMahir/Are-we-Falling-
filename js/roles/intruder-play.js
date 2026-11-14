/* ARE WE FALLING? — the INTRUDER seat played in first person (Batu).
   Sits on top of Orhun's cabin (js/cabin3d.js) through its public object only; it never edits the cabin.

     const play = KKIntruder.start(cabin, { seed, hud: element, onEnd(result) {} });
     play.state  -> { clock, tasks, suspicion, caught, done }

   What it adds to the cabin:
   - free first-person walking with W A S D (mouse look with pointer lock, click the view to grab the mouse)
   - the sabotage tasks from KK.ROLES.saboteur, done with E (hold), Q+E (mash) or a Q/E code
   - task effects: turbulence and panic through cabin.setState, blackout, smoke and dropped masks as screen
     overlays, the cockpit door through cabin.setDoor, sounds from audio/int_*.mp3
   - the bomb strapped to the chest (Meshy model intruder_vest), seen when looking down
   - a flight attendant who patrols the aisle; doing loud things near her fills the SUSPICION bar
   The cabin's own W/S, click-to-walk and drag-to-look are kept away from it while this runs. F still
   stands up and sits down in the nearest free seat (the cabin does that part). */
(function () {
  'use strict';
  const T = window.THREE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const AUDIO = 'audio/';

  // ---------------------------------------------------------------- sound
  const snd = {
    muted: false, loops: {},
    play(name, vol) { if (!name || this.muted) return null; const a = new Audio(AUDIO + name + '.mp3'); a.volume = vol == null ? 0.8 : vol; const p = a.play(); if (p && p.catch) p.catch(() => {}); return a; },
    loop(name, vol) { if (this.loops[name]) return; const a = new Audio(AUDIO + name + '.mp3'); a.loop = true; a.volume = vol == null ? 0.4 : vol; const p = a.play(); if (p && p.catch) p.catch(() => {}); this.loops[name] = a; },
    stop(name) { const a = this.loops[name]; if (a) { a.pause(); delete this.loops[name]; } },
    stopAll() { Object.keys(this.loops).forEach((k) => this.stop(k)); },
  };

  // where a person may stand (metres, cabin coordinates: x across, z from the cockpit wall to the back)
  function walkable(x, z, doorOpen) {
    if (z >= 0.55 && z <= 1.45) return x >= -0.55 && x <= 0.5;            // front: galley and cockpit door
    if (z > 1.45 && z < 9.3) return x >= -0.28 && x <= 0.28;              // the aisle between the seats
    if (z >= 9.3 && z <= 10.35 && x >= -0.4 && x <= 0.5) return true;     // rear galley
    if (x < -0.4 && x >= -1.38 && z >= 9.55 && z <= 10.45) return true;   // inside the lavatory
    if (doorOpen && z >= -0.4 && z < 0.55) return x >= -0.3 && x <= 0.3;  // into the cockpit when the door is open
    return false;
  }
  function placeAt(x, z) {
    if (z < 0.55) return 'cockpit';
    if (x < -0.42 && z > 9.5) return 'lavatory';
    if (z < 0.85) return 'door';
    if (z < 1.45) return 'galley';
    if (z > 9.3) return 'galley';                                           // the rear galley counts as a galley too
    return 'aisle';
  }

  function start(cabin, opts) {
    opts = opts || {};
    const P = cabin.player, canvas = opts.canvas || document.querySelector('canvas');
    const pool = (window.KK && KK.ROLES && (KK.ROLES.saboteur || KK.ROLES.intruder)) || { perFlight: 3, tasks: [] };
    const seed = +opts.seed || 1;
    const rng = window.KK && KK.makeRng ? KK.makeRng((seed * 31 + 3) >>> 0) : { int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)) };
    const deck = pool.tasks.slice();
    for (let i = deck.length - 1; i > 0; i--) { const j = rng.int(0, i); const t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
    const tasks = deck.slice(0, pool.perFlight || 4).map((def) => ({ def, done: false, prog: 0, presses: 0, last: '', code: 0 }));
    const S = { clock: opts.clock || 420, tasks, suspicion: 0, caught: false, done: false, door: false, fx: {}, unrest: 0, turb: 0 };

    // ---------------------------------------------------------------- HUD
    const root = opts.hud || document.body;
    const css = document.createElement('style');
    css.textContent = `
      .ix { position:absolute; font-family: "Arial Narrow", Arial, sans-serif; color:#d6dde8; pointer-events:none; }
      .ix-box { background: rgba(8,11,16,.8); border:1px solid #39414e; border-radius:6px; padding:10px 14px; }
      #ixTasks { right:16px; top:14px; width:320px; }
      #ixClock { display:flex; justify-content:space-between; font: 12px ui-monospace, Menlo, monospace; letter-spacing:2px; color:#8491a3; }
      #ixClock b { font-size:30px; color:#d6dde8; } #ixClock b.down { color:#ff3b30; }
      .ixt { border-top:1px solid #2a313c; margin-top:8px; padding-top:8px; }
      .ixt h4 { margin:0; font-size:17px; letter-spacing:1px; display:flex; justify-content:space-between; }
      .ixt h4 span { font: 12px ui-monospace, Menlo, monospace; color:#ffb000; }
      .ixt p { margin:3px 0 0; font-size:13.5px; color:#8491a3; line-height:1.25; }
      .ixt em { font-style:normal; font: 11px ui-monospace, Menlo, monospace; color:#ffb000; letter-spacing:1px; }
      .ixt.done { opacity:.45; } .ixt.done h4 { text-decoration: line-through; } .ixt.here { border-top-color:#ffb000; }
      #ixSus { left:16px; top:62px; width:230px; }
      #ixSus small { font: 11px ui-monospace, Menlo, monospace; letter-spacing:2px; color:#8491a3; }
      .ixbar { height:8px; background:#1b1f26; border-radius:4px; margin-top:6px; overflow:hidden; } .ixbar i { display:block; height:100%; width:0; background:#ffb000; transition: width .15s; }
      #ixSus.hot .ixbar i { background:#ff3b30; }
      #ixAct { left:50%; bottom:80px; transform:translateX(-50%); width:420px; text-align:center; display:none; }
      #ixAct.show { display:block; } #ixAct kbd { font: 14px ui-monospace, Menlo, monospace; background:#ffb000; color:#000; border-radius:3px; padding:0 7px; margin:0 3px; }
      #ixAct .seq kbd { background:#39414e; color:#d6dde8; } #ixAct .seq kbd.ok { background:#3dff8b; color:#000; }
      #ixToast { left:50%; top:20%; transform:translateX(-50%); font-size:24px; letter-spacing:1px; opacity:0; transition:opacity .3s; }
      #ixToast.show { opacity:1; }
      #ixCross { left:50%; top:50%; width:6px; height:6px; margin:-3px 0 0 -3px; border-radius:50%; background:rgba(255,255,255,.6); }
      #ixHint { left:50%; bottom:14px; transform:translateX(-50%); font: 11.5px ui-monospace, Menlo, monospace; letter-spacing:1px; color:#8491a3; white-space:nowrap; }
      #ixHint b { color:#d6dde8; font-weight:400; }
      #ixVest { position:absolute; left:0; right:0; bottom:0; width:100%; height:60%; pointer-events:none; }
      #ixDark { inset:0; background: radial-gradient(ellipse at 50% 60%, rgba(0,0,0,.55), rgba(0,0,0,.96)); opacity:0; transition: opacity .25s; }
      #ixSmoke { inset:0; background: radial-gradient(ellipse at 40% 30%, rgba(170,170,165,.55), rgba(90,90,88,.85)); opacity:0; transition: opacity 1.5s; filter: blur(2px); }
      #ixMasks { inset:0; opacity:0; transition: opacity .3s; }
      #ixMasks i { position:absolute; top:0; width:3px; background:#e8e2c8; }
      #ixMasks i::after { content:''; position:absolute; left:-14px; bottom:-26px; width:30px; height:26px; border-radius:0 0 15px 15px; background:#f2d024; }
      #ixEnd { inset:0; display:none; align-items:center; justify-content:center; flex-direction:column; background: rgba(0,0,0,.82); pointer-events:auto; }
      #ixEnd.show { display:flex; } #ixEnd h1 { margin:0; font-size:64px; letter-spacing:4px; } #ixEnd p { color:#8491a3; font-size:18px; }
      #ixEnd button { margin-top:18px; font-size:18px; letter-spacing:2px; padding:10px 22px; background:#ffb000; border:0; border-radius:4px; cursor:pointer; }
    `;
    document.head.appendChild(css);
    const el = (id, cls, html) => { const d = document.createElement('div'); d.id = id; d.className = 'ix ' + (cls || ''); if (html) d.innerHTML = html; root.appendChild(d); return d; };
    const dark = el('ixDark'), smoke = el('ixSmoke'), masks = el('ixMasks');
    for (let i = 0; i < 14; i++) { const m = document.createElement('i'); m.style.left = (4 + i * 7 + (i % 3) * 1.5) + '%'; m.style.height = (8 + (i * 37) % 18) + '%'; masks.appendChild(m); }
    const vestCanvas = document.createElement('canvas'); vestCanvas.id = 'ixVest'; root.appendChild(vestCanvas);
    const hudTasks = el('ixTasks', 'ix-box', '<div id="ixClock">TIME TO IMPACT <b id="ixClockT">7:00</b></div><div id="ixList"></div>');
    const hudSus = el('ixSus', 'ix-box', '<small>SUSPICION</small><div class="ixbar"><i id="ixSusB"></i></div><small id="ixWhere"></small>');
    const hudAct = el('ixAct', 'ix-box');
    const toastEl = el('ixToast', 'ix-box');
    el('ixCross');
    el('ixHint', 'ix-box', '<b>CLICK</b> grab the mouse · <b>W A S D</b> walk · <b>MOUSE</b> look · <b>E</b> work · <b>Q</b> act natural · <b>F</b> sit, stand · <b>M</b> mute');
    const endEl = el('ixEnd', '', '<h1 id="ixEndH"></h1><p id="ixEndP"></p><button id="ixEndB">PLAY AGAIN</button>');
    const $ = (id) => document.getElementById(id);
    $('ixEndB').onclick = () => location.reload();

    const NAMES = { seat: 'ANY SEAT', aisle: 'AISLE', lavatory: 'LAVATORY', galley: 'A GALLEY', door: 'COCKPIT DOOR', cockpit: 'COCKPIT' };
    const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    let cur = null, toastT = 0;
    function paint() {
      $('ixList').innerHTML = tasks.map((t) => '<div class="ixt' + (t.done ? ' done' : '') + (t === cur ? ' here' : '') + '"><h4>' + t.def.title + '<span>' + t.def.effect + ' s</span></h4><p>' + t.def.brief + '</p><em>' + (t.done ? 'DONE' : '▸ ' + (NAMES[t.def.place] || t.def.place)) + '</em></div>').join('');
      cabin.setMarks(tasks.filter((t) => !t.done).map((t) => (t.def.place === 'galley' ? 'galley' : t.def.place)).filter((p) => p !== 'seat'));
    }
    function toast(txt, s) { toastEl.textContent = txt; toastEl.classList.add('show'); toastT = s || 2.6; }

    // ---------------------------------------------------------------- the chest bomb (own little renderer on top)
    let vest = null, vr = null, vs = null, vc = null;
    if (T) {
      try {
        vr = new T.WebGLRenderer({ canvas: vestCanvas, alpha: true, antialias: true }); vr.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        vs = new T.Scene(); vc = new T.PerspectiveCamera(40, 2, 0.05, 20); vc.position.set(0, 0, 3);
        vs.add(new T.HemisphereLight(0xffffff, 0x334455, 2.0)); const dl = new T.DirectionalLight(0xffffff, 1.4); dl.position.set(1, 2, 3); vs.add(dl);
        const ok = window.KKModels && KKModels.load('intruder_vest', (m) => { vest = KKModels.fit(m, 1.6, 0); vest.children[0].position.y -= 0.8; vs.add(vest); });
        if (!ok) {   // a stand-in when the model is missing: three red sticks and a timer
          vest = new T.Group();
          for (let i = -1; i <= 1; i++) { const st = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.9, 12), new T.MeshLambertMaterial({ color: 0xc8302a })); st.position.x = i * 0.26; vest.add(st); }
          const tm = new T.Mesh(new T.BoxGeometry(0.5, 0.22, 0.1), new T.MeshBasicMaterial({ color: 0x220000 })); tm.position.z = 0.15; vest.add(tm); vs.add(vest);
        }
      } catch (e) { vr = null; }
    }

    // ---------------------------------------------------------------- the flight attendant who patrols
    const att = { z: 1.1, dir: 1, wait: 2, x: 0 };
    function attStep(dt) {
      if (att.wait > 0) { att.wait -= dt; return; }
      const calls = S.fx.calls > 0;                                          // ringing bells pull her to the rows
      const speed = calls ? 1.1 : 0.55;
      att.z += att.dir * speed * dt;
      if (att.z > 9.0) { att.z = 9.0; att.dir = -1; att.wait = 1.5 + Math.random() * 2; }
      if (att.z < 1.1) { att.z = 1.1; att.dir = 1; att.wait = 2 + Math.random() * 3; }
      if (S.fx.block > 0 && att.dir > 0 && att.z > 4.6 && att.z < 5.0) att.wait = 0.4;   // the loose trolley holds her up
    }
    let attT = 0;
    function attDraw(dt) { attT -= dt; if (attT > 0) return; attT = 0.12; cabin.setActor('attendant', { role: 'attendant', at: { x: att.x, z: att.z, yaw: att.dir > 0 ? Math.PI : 0 } }); }

    // ---------------------------------------------------------------- input (kept away from the cabin's own handlers)
    const keys = {};
    const MINE = ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'm'];
    const onKeyCap = (e) => {
      const k = e.key.toLowerCase(); if (MINE.indexOf(k) < 0) return;
      e.stopImmediatePropagation(); e.stopPropagation();
      const down = e.type === 'keydown';
      if (down && !e.repeat) onPress(k);
      keys[k] = down;
    };
    const onPtrCap = (e) => { if (e.target === canvas) { e.stopImmediatePropagation(); e.stopPropagation(); if (e.type === 'pointerdown' && !S.done && document.pointerLockElement !== canvas) { try { canvas.requestPointerLock(); } catch (er) {} } } };
    const onMouse = (e) => { if (document.pointerLockElement !== canvas || S.done) return; P.yaw -= e.movementX * 0.0024; P.pitch = clamp(P.pitch - e.movementY * 0.0024, -1.35, 1.0); P.hold = 99; };
    window.addEventListener('keydown', onKeyCap, true); window.addEventListener('keyup', onKeyCap, true);
    ['pointerdown', 'pointerup', 'pointermove'].forEach((t) => window.addEventListener(t, onPtrCap, true));
    document.addEventListener('mousemove', onMouse);

    function onPress(k) {
      if (S.done) return;
      if (k === 'm') { snd.muted = !snd.muted; if (snd.muted) snd.stopAll(); else snd.loop('int_tick', 0.12); toast(snd.muted ? 'SOUND OFF' : 'SOUND ON', 1.2); return; }
      if (!cur) return;
      const d = cur.def;
      if (k === 'q' && d.input === 'hold') { cur.prog = 0; stopTaskSound(); toast('ACTING NATURAL…', 1.2); return; }
      if (d.input === 'mash' && (k === 'q' || k === 'e')) { if (k !== cur.last) { cur.presses++; cur.last = k; cur.prog = cur.presses / (d.seconds * 2) * d.seconds; startTaskSound(); } }
      if (d.input === 'code' && (k === 'q' || k === 'e')) {
        const want = d.code[cur.code].toLowerCase();
        if (k === want) { cur.code++; snd.play('sfx_ui_whoosh', 0.3); if (cur.code >= d.code.length) cur.prog = d.seconds; else cur.prog = cur.code / d.code.length * d.seconds; startTaskSound(); }
        else { cur.code = 0; cur.prog = 0; S.suspicion = clamp(S.suspicion + 6, 0, 100); snd.play('sfx_task_fail', 0.5); toast('WRONG CODE', 1.0); }
      }
    }
    let taskSound = null;
    function startTaskSound() { if (!taskSound && cur) taskSound = snd.play(cur.def.sound, 0.7); }
    function stopTaskSound() { if (taskSound) { taskSound.pause(); taskSound = null; } }

    // ---------------------------------------------------------------- effects of a finished task
    function applyFx(t) {
      S.clock = Math.max(0, S.clock + t.def.effect);
      (t.def.fx || []).forEach((f) => {
        if (f.type === 'panic') S.unrest = clamp(S.unrest + (f.amount || 0.3), 0, 1);
        else S.fx[f.type] = Math.max(S.fx[f.type] || 0, f.dur || 8);
        if (f.type === 'blackout') { snd.play('int_blackout', 0.8); setTimeout(() => snd.play('int_v_lights', 0.9), 900); }
        if (f.type === 'smoke') snd.loop('int_alarm', 0.35);
        if (f.type === 'masks') snd.play('sfx_pax_gasp', 0.7);
        if (f.type === 'door') { S.door = true; cabin.setDoor(true); }
        if (f.type === 'calls') snd.play('int_calls', 0.6);
      });
      if (t.def.id === 'rumour') snd.play('int_rumour', 0.9);
      snd.play('sfx_task_done', 0.6);
    }

    // ---------------------------------------------------------------- main loop
    let last = performance.now(), alive = true, raf = 0, stepT = 0;
    function end(won, why) {
      if (S.done) return; S.done = true; stopTaskSound(); snd.stopAll();
      try { document.exitPointerLock(); } catch (e) {}
      $('ixEndH').textContent = won ? 'THE AIRCRAFT IS GOING DOWN' : 'CAUGHT';
      $('ixEndH').style.color = won ? '#ff3b30' : '#3dff8b';
      $('ixEndP').textContent = why;
      endEl.classList.add('show');
      snd.play(won ? 'mus_intruder_win' : 'mus_intruder_caught', 0.8);
      if (!won) { snd.play('sfx_tackle', 0.8); setTimeout(() => snd.play('int_v_caught', 0.9), 400); } else setTimeout(() => snd.play('int_v_win', 0.9), 1500);
      if (opts.onEnd) opts.onEnd({ won, why });
    }
    function frame(now) {
      if (!alive) return; raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (S.done) return;

      // walking: our own W A S D, the cabin draws the camera from P
      const seated = !!P.seat || (P.path && P.path.length);
      if (!seated) {
        const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0), r = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
        if (f || r) {
          const sp = 1.7 * dt, sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
          const dx = (-sy * f + cy * r) * sp, dz = (-cy * f - sy * r) * sp;
          if (walkable(P.x + dx, P.z, S.door)) P.x += dx;
          if (walkable(P.x, P.z + dz, S.door)) P.z += dz;
          stepT -= dt; if (stepT <= 0) { snd.loop('int_steps', 0.35); stepT = 0.3; }
        } else if (stepT > -1) { stepT = -2; snd.stop('int_steps'); }
        P.place = placeAt(P.x, P.z);
      } else snd.stop('int_steps');

      // which task can be done here
      const here = P.seat ? 'seat' : P.place;
      const before = cur;
      cur = tasks.find((t) => !t.done && t.def.place === here) || null;
      if (cur !== before) { stopTaskSound(); paint(); }
      if (cur) {
        const d = cur.def;
        if (d.input === 'hold') { if (keys.e) { cur.prog += dt; startTaskSound(); } }
        hudAct.classList.add('show');
        const pct = Math.min(100, cur.prog / d.seconds * 100);
        const how = d.input === 'hold' ? 'HOLD <kbd>E</kbd>' : d.input === 'mash' ? 'ALTERNATE <kbd>Q</kbd><kbd>E</kbd> FAST' : 'TYPE <span class="seq">' + d.code.split('').map((c, i) => '<kbd' + (i < cur.code ? ' class="ok"' : '') + '>' + c + '</kbd>').join('') + '</span>';
        hudAct.innerHTML = '<div style="font-size:18px;letter-spacing:1px">' + how + ' · ' + d.title + '</div><div class="ixbar"><i style="width:' + pct + '%"></i></div>';
        const working = (d.input === 'hold' && keys.e) || (d.input !== 'hold' && cur.prog > 0);
        if (working) {   // loud work near the attendant gives you away
          const dist = Math.hypot(P.x - att.x, P.z - att.z), sees = dist < 3.2 && !(S.fx.blackout > 0) && here !== 'lavatory';
          if (sees) S.suspicion = clamp(S.suspicion + (d.noise || 0.3) * 32 * dt * (S.fx.smoke > 0 ? 0.5 : 1), 0, 100);
        }
        if (cur.prog >= d.seconds) {
          cur.done = true; stopTaskSound(); applyFx(cur);
          toast(d.title + ' · ' + d.effect + ' SECONDS', 2.4);
          cur = null; paint();
          if (tasks.every((t) => t.done)) setTimeout(() => end(true, 'Every sabotage is done. Nobody suspected the passenger in seat ' + (opts.seat || '7C') + '.'), 1800);
        }
      } else hudAct.classList.remove('show');

      // suspicion cools down when you behave
      if (!cur || !cur.prog) S.suspicion = Math.max(0, S.suspicion - 4 * dt);
      if (S.suspicion >= 100) end(false, 'The flight attendant saw what you were doing and pinned you to the floor.');
      $('ixSusB').style.width = S.suspicion + '%'; hudSus.classList.toggle('hot', S.suspicion > 65);
      if (S.suspicion > 65) snd.loop('sfx_heartbeat', 0.35); else snd.stop('sfx_heartbeat');
      $('ixWhere').textContent = P.seat ? 'SEAT ' + P.seat.id : NAMES[P.place] || '';

      // effects run down
      Object.keys(S.fx).forEach((k) => { S.fx[k] = Math.max(0, S.fx[k] - dt); });
      if (!(S.fx.smoke > 0)) snd.stop('int_alarm');
      if (S.door && !(S.fx.door > 0) && P.z > 0.6) { S.door = false; cabin.setDoor(false); }
      S.unrest = Math.max(0, S.unrest - 0.015 * dt);
      const turb = S.fx.turbulence > 0 ? 0.85 : 0;
      cabin.setState({ unrest: S.unrest, turb });
      dark.style.opacity = S.fx.blackout > 0 ? (Math.random() > 0.97 ? 0.6 : 1) : 0;
      smoke.style.opacity = S.fx.smoke > 0 ? Math.min(0.75, S.fx.smoke / 8) : 0;
      masks.style.opacity = S.fx.masks > 0 ? 1 : 0;

      // the attendant, the clock, the toast
      attStep(dt); attDraw(dt);
      S.clock = Math.max(0, S.clock - dt);
      $('ixClockT').textContent = fmt(S.clock); $('ixClockT').className = S.clock < 60 ? 'down' : '';
      if (S.clock <= 0) end(true, 'The clock ran out before the aircraft could land.');
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('show'); }

      // the chest bomb slides into view when looking down
      if (vr && vest) {
        const w = vestCanvas.clientWidth || 1280, h = vestCanvas.clientHeight || 400;
        if (vestCanvas.width !== Math.round(w * vr.getPixelRatio())) { vr.setSize(w, h, false); vc.aspect = w / h; vc.updateProjectionMatrix(); }
        const down = clamp((-P.pitch - 0.35) / 0.7, 0, 1);
        vest.position.set(Math.sin(now / 900) * 0.02, -2.2 + down * 1.9, 0); vest.rotation.x = -0.5 + down * 0.35;
        vestCanvas.style.opacity = down > 0.02 ? 1 : 0;
        vr.render(vs, vc);
      }
    }
    raf = requestAnimationFrame(frame);
    paint();
    snd.loop('int_tick', 0.12);
    setTimeout(() => snd.play('int_v_seat', 0.8), 1200);

    return {
      state: S,
      stop() {
        alive = false; cancelAnimationFrame(raf); snd.stopAll();
        window.removeEventListener('keydown', onKeyCap, true); window.removeEventListener('keyup', onKeyCap, true);
        ['pointerdown', 'pointerup', 'pointermove'].forEach((t) => window.removeEventListener(t, onPtrCap, true));
        document.removeEventListener('mousemove', onMouse);
      },
    };
  }
  window.KKIntruder = { start, walkable, placeAt };
})();
