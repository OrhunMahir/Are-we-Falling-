/* ARE WE FALLING? — the FLIGHT ATTENDANT seat played in first person.
   The counterpart of js/roles/intruder-play.js (Batu): the same cabin, the same Meshy passengers and the same effects,
   seen through the flight attendant's eyes. It sits on the cabin (js/cabin3d.js) through its public object and borrows
   the intruder layer's toolkit (KKIntruder.util), so load js/roles/intruder-play.js first.

     const play = KKAttendant.start(cabin, { seed, canvas, link, intruder, onTask(msg), onCockpit(inside), onDoor(open), onCaught(ok) });
     play.state       -> { clock, tasks, unrest, fx, carry, done }
     play.trouble(id) -> a sabotage with this id was finished somewhere: the task that undoes it comes onto the list
     play.setFlight({ clock, unrest, intruder })   what the lobby reports
     play.crash(), play.land(), play.stop()

   What the flight attendant does:
   - undoes the intruder's sabotage: every finished sabotage opens the task that answers it (js/roles/attendant.js);
     with no intruder on board the same trouble turns up by itself as a malfunction;
   - calms the passengers: standing in the aisle while the cabin is restless, hold E (this is the job the pilot's PA does
     when nobody sits in this seat);
   - brings the captain a black coffee: pour it in the front galley, carry it into the cockpit (the door opens for the crew),
     hand it over. It sobers the captain up and buys a few seconds;
   - watches the passengers. The intruder looks like everybody else. Catch somebody at work (press C next to them) and the
     intruder is out of the game; grab an innocent passenger and the cabin gets angrier.
   The link (KKLink in intruder-play.js, or the lobby in cabin.html) carries poses, effects and the catch between the two cabin seats. */
(function () {
  'use strict';
  const T = window.THREE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ROWS = 9, PITCH = 0.82, Z0 = 2.0;
  const H = Math.PI / 2;

  // ---------------------------------------------------------------- where the flight attendant may stand
  // The cabin as in intruder-play.js, plus the real cockpit behind the door (js/cabin-cockpit.js: cabin z = cockpit z - 2.86):
  // the aft part of the cockpit, and between the two pilots' seats up to the pedestal.
  function walkable(x, z, doorAjar) {
    if (z >= 0.55 && z <= 1.45) return x >= -0.55 && x <= 0.5;            // front: galley and cockpit door
    if (z > 1.45 && z < 9.3) return x >= -0.28 && x <= 0.28;              // the aisle
    if (z >= 9.3 && z <= 10.35 && x >= -0.4 && x <= 0.5) return true;     // rear galley
    if (x < -0.4 && x >= -1.38 && z >= 9.55 && z <= 10.45) return true;   // the lavatory
    if (z >= -0.1 && z < 0.55) return doorAjar && x >= -0.26 && x <= 0.26; // through the doorway
    if (z >= -1.85 && z < -0.1) return x >= -0.95 && x <= 0.95;           // the cockpit behind the seats
    if (z >= -2.35 && z < -1.85) return x >= -0.36 && x <= 0.36;          // between the seats
    return false;
  }
  function placeAt(x, z) {
    if (z < -0.1) return 'cockpit';
    if (x < -0.42 && z > 9.5) return 'lavatory';
    if (z < 0.85) return 'door';
    if (z < 1.45 || z > 9.3) return 'galley';
    return 'aisle';
  }
  const CAPTAIN = { x: -0.72, z: -2.5 };   // the captain's head, in cabin coordinates

  function start(cabin, opts) {
    opts = opts || {};
    const U = window.KKIntruder && window.KKIntruder.util;
    if (!U || !T) return null;
    const P = cabin.player, canvas = opts.canvas || document.querySelector('canvas'), snd = U.snd;
    const KK = window.KK || {}, seed = +opts.seed || 1;
    const pool = (KK.ROLES && KK.ROLES.attendant) || { tasks: [] };
    const mode = (KK.codeMode && KK.codeMode(seed)) || 'mayday';
    const modeTime = (KK.MODES && KK.MODES[mode] && KK.MODES[mode].time) || 420;
    const scale = modeTime / 240;                                         // the same scale the intruder's sabotage gets: a fix gives back what it took
    const S = { clock: opts.clock || modeTime, tasks: [], fx: {}, unrest: 0, carry: false, done: false, intruder: !!opts.intruder, coffees: 0 };
    const mk = (d) => ({ def: Object.assign({}, d, { effect: Math.round((d.effect || 0) * scale) }), done: false, prog: 0, idx: 0, last: '', back: 0 });
    pool.tasks.filter((t) => t.always).forEach((d) => S.tasks.push(mk(d)));

    // ---- HUD
    U.addStyles();
    const root = opts.hud || document.body;
    const el = (id, cls, html) => { const d = document.createElement('div'); d.id = id; d.className = 'ix ' + (cls || ''); if (html) d.innerHTML = html; root.appendChild(d); return d; };
    const css = document.createElement('style');
    css.textContent = `
      #axTasks { right:16px; top:14px; width:300px; max-height:72vh; overflow:hidden; }
      #axTasks.small .ixt p { display:none; }
      #axClock { display:flex; justify-content:space-between; font: 12px ui-monospace, Menlo, monospace; letter-spacing:2px; color:#8491a3; }
      #axClock b { font-size:30px; color:#d6dde8; } #axClock b.down { color:#ff3b30; } #axClock b.up { color:#3dff8b; }
      #axMood { left:16px; top:14px; width:230px; }
      #axMood small { font: 11px ui-monospace, Menlo, monospace; letter-spacing:2px; color:#8491a3; display:block; }
      #axMood .ixbar i { background:#3dff8b; } #axMood.amber .ixbar i { background:#ffb000; } #axMood.red .ixbar i { background:#ff3b30; }
      #axCarry { left:16px; top:96px; display:none; font: 12px ui-monospace, Menlo, monospace; letter-spacing:2px; color:#ffd27a; }
      #axCarry.show { display:block; }
      .ixt h4 small { font: 10px ui-monospace, Menlo, monospace; color:#8491a3; letter-spacing:1px; margin-left:6px; }
      #axEnd h1 { margin:0; font-size:56px; letter-spacing:4px; }
    `;
    document.head.appendChild(css);
    const dark = el('ixDark'), smoke = el('ixSmoke'), warn = el('ixWarn');
    const flash = el('ixFlash'); flash.style.cssText = 'inset:0;background:#fff;opacity:0;transition:opacity .15s';
    const hudTasks = el('axTasks', 'ix-box', '<div id="axClock">TIME TO IMPACT <b id="axClockT">7:00</b></div><div id="axList"></div>');
    if (window.innerWidth < 1000) hudTasks.classList.add('small');
    const hudMood = el('axMood', 'ix-box', '<small>CABIN MOOD</small><div class="ixbar"><i id="axMoodB"></i></div><small id="axWhere"></small>');
    const hudCarry = el('axCarry', 'ix-box', '☕ CARRYING A COFFEE · FOR THE CAPTAIN');
    const hudAct = el('ixAct', 'ix-box');
    const toastEl = el('ixToast', 'ix-box');
    el('ixCross');
    el('ixHint', 'ix-box', '<b>W A S D</b> walk · <b>MOUSE</b> look (click, or drag) · <b>E</b> work · <b>Q E</b> tap · <b>C</b> catch who is next to you · <b>F</b> sit / stand · <b>M</b> mute');
    const endEl = el('ixEnd', '', '<h1 id="axEndH"></h1><p id="axEndP"></p>');
    endEl.id = 'axEnd'; endEl.className = 'ix';
    endEl.style.cssText = 'inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(0,0,0,.78);text-align:center;pointer-events:none';
    const $ = (id) => document.getElementById(id);
    const NAMES = { seat: 'ANY SEAT', aisle: 'AISLE', lavatory: 'LAVATORY', galley: 'A GALLEY', door: 'COCKPIT DOOR', cockpit: 'COCKPIT' };
    const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    let cur = null, toastT = 0, clockFlashT = 0;
    const open = () => S.tasks.filter((t) => !t.done);
    function where(t) { return t.def.fetch && !S.carry ? t.def.fetch : t.def.place; }   // the coffee: first the galley, then the cockpit
    function paint() {
      const list = S.tasks.filter((t) => !t.done || t.back <= 0 || t.def.once);
      $('axList').innerHTML = (list.length ? list : []).map((t) => '<div class="ixt' + (t.done ? ' done' : '') + (t === cur ? ' here' : '') + '"><h4>' + esc(t.def.title) + '<span>+' + t.def.effect + ' s</span></h4><p>' + esc(t.def.fetch && S.carry ? t.def.brief2 || t.def.brief : t.def.brief) + '</p><em>' + (t.done ? 'DONE' : '▸ ' + (NAMES[where(t)] || where(t))) + '</em></div>').join('')
        + (open().filter((t) => t.def.undoes).length ? '' : '<div class="ixt"><p>' + (S.intruder ? 'Somebody on board wants this aircraft down. Watch the passengers: whoever stands up, lingers or fiddles with things.' : 'All quiet. Keep an eye on the cabin: things break on a flight like this.') + '</p></div>');
      cabin.setMarks(open().map(where).filter((p) => p !== 'seat' && p !== 'cockpit'));
    }
    function toast(txt, s) { toastEl.textContent = txt; toastEl.classList.add('show'); toastT = s || 2.6; }

    // ---- the cabin's scene: Meshy passengers, effects, the intruder as one of the passengers
    let W = null, intG = null, intSeat = null, intSeatId = null;
    const plants = [];
    const look = paxLook(seed);
    U.hookScene(cabin, canvas, (scene) => {
      W = U.makeWorldFx(scene);
      intG = U.makePerson(look); intG.visible = false; scene.add(intG);
      // the stand-in room behind the door is not needed when the real cockpit is there
      if (window.__cockpit && W.cockpit) W.cockpit.visible = false;
    }, () => {
      U.updateWorldFx(W, S.fx, performance.now() / 1000);
      if (window.__cockpit && W && W.cockpit) W.cockpit.visible = false;
      drawIntruder();
    });
    // the intruder seen from here: sitting, they are one more Meshy passenger in their seat; walking, a person in plain clothes
    const ip = { x: 0, z: 5, yaw: 0, tx: 0, tz: 5, tyaw: 0, seat: null, place: 'seat', moving: false, working: false, workT: -99, seen: false, heard: 0 };
    function seatFigure(id) {
      if (intSeatId === id) return;
      if (intSeat) { intSeat.parent && intSeat.parent.remove(intSeat); intSeat = null; }
      intSeatId = id;
      if (!id || !W) return;
      const s = cabin.seats.find((q) => q.id === id); if (!s) return;
      const src = W.pax && W.pax.find((q) => q.m);
      if (src) { intSeat = src.m.clone(true); intSeat.position.set(s.x, 0, s.z); intSeat.rotation.set(0, Math.PI, 0); W.scene.add(intSeat); }
      else { intSeat = U.makePerson(look); intSeat.position.set(s.x, -0.3, s.z); intSeat.userData.legL.rotation.x = intSeat.userData.legR.rotation.x = -1.35; W.scene.add(intSeat); }
    }
    function drawIntruder() {
      if (!intG) return;
      const sitting = !!ip.seat && ip.seen;
      seatFigure(sitting ? ip.seat : null);
      intG.visible = ip.seen && !sitting;
      if (intG.visible) { intG.position.set(ip.x, 0, ip.z); intG.rotation.y = ip.yaw; }
    }
    function plant(name, x, y, z, size) {
      if (!W) return;
      const g = new T.Group(); g.position.set(x, y, z); W.scene.add(g);
      const ok = window.KKModels && KKModels.load(name, (m) => { g.add(KKModels.fit(m, size, Math.random() * 6)); });
      if (!ok) g.add(new T.Mesh(new T.BoxGeometry(size, size * 0.7, size * 0.8), new T.MeshLambertMaterial({ color: 0x6f747a })));
      const b = new T.Mesh(new T.SphereGeometry(0.022, 8, 6), new T.MeshBasicMaterial({ color: 0xff2a1a })); b.position.y = size * 0.75; g.add(b);
      plants.push({ g, b, name, x, z });
    }

    // ---- the link: what the intruder's screen tells us
    if (opts.link) opts.link.on((m) => {
      if (!m || S.done) return;
      if (m.t === 'pose' && m.who === 'int') {
        ip.tx = +m.x || 0; ip.tz = +m.z || 0; ip.tyaw = +m.yaw || 0; ip.seat = m.seat || null; ip.place = m.place || ''; ip.moving = !!m.moving; ip.working = !!m.working; ip.heard = performance.now();
        if (ip.working) ip.workT = performance.now();
        if (!ip.seen) { ip.x = ip.tx; ip.z = ip.tz; ip.yaw = ip.tyaw; ip.seen = true; }
        S.intruder = true;
      } else if (m.t === 'fx') {
        if (m.type === 'panic') return;
        S.fx[m.type] = Math.max(S.fx[m.type] || 0, +m.dur || 8);
        if (m.type === 'smoke' && W) { W.smoke.userData.x = ip.place === 'lavatory' ? -1 : 0.3; W.smoke.userData.z = ip.z; snd.loop('int_alarm', 0.3); }
        if (m.type === 'blackout') { snd.play('int_blackout', 0.7); setTimeout(() => snd.play('sfx_pax_gasp', 0.6), 900); }
        if (m.type === 'masks') snd.play('sfx_pax_gasp', 0.7);
        if (m.type === 'calls') snd.play('int_calls', 0.5);
        if (m.type === 'turbulence') snd.play('sfx_turb_rattle', 0.5);
      } else if (m.t === 'plant') plant(m.name, +m.x || 0, +m.y || 0, +m.z || 0, m.name === 'intruder_emp' ? 0.32 : 0.26);
    });

    // ---- controls: walking and looking (the same feel as the intruder's seat, our own walls)
    const keys = {}, MINE = ['w', 'a', 's', 'd', 'q', 'e', 'c', 'm', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    let dragging = false, wasSeated = !!P.seat, stepT = 0;
    const onKeyCap = (e) => {
      const k = e.key.toLowerCase(); if (MINE.indexOf(k) < 0 || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
      e.stopImmediatePropagation(); e.stopPropagation();
      const down = e.type === 'keydown';
      if (down && !e.repeat) onPress(k);
      keys[k] = down;
    };
    const onPtrCap = (e) => {
      if (e.target !== canvas) return;
      e.stopImmediatePropagation(); e.stopPropagation();
      if (e.type === 'pointerdown') { dragging = true; if (!S.done && document.pointerLockElement !== canvas) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (er) {} } }
      if (e.type === 'pointerup') dragging = false;
    };
    const onUp = () => { dragging = false; };
    const onMouse = (e) => {
      if (S.done) return;
      const locked = document.pointerLockElement === canvas;
      if (!locked && !(dragging && (e.buttons & 1))) return;
      const k = locked ? 0.0024 : 0.005;
      P.yaw -= (e.movementX || 0) * k; P.pitch = clamp(P.pitch - (e.movementY || 0) * k, -1.35, 1.0); P.hold = 99;
    };
    const onBlur = () => { Object.keys(keys).forEach((k) => { keys[k] = false; }); };
    window.addEventListener('keydown', onKeyCap, true); window.addEventListener('keyup', onKeyCap, true);
    ['pointerdown', 'pointerup', 'pointermove'].forEach((t) => window.addEventListener(t, onPtrCap, true));
    window.addEventListener('pointerup', onUp); document.addEventListener('mousemove', onMouse); window.addEventListener('blur', onBlur);
    let doorWant = false;
    function walk(dt) {
      const seated = !!P.seat || (P.path && P.path.length);
      if (wasSeated && !seated) { P.yaw = P.z > 5 ? 0 : Math.PI; P.pitch = 0; P.hold = 99; }
      wasSeated = seated;
      const turn = (keys.arrowleft ? 1 : 0) - (keys.arrowright ? 1 : 0);
      if (turn) { P.yaw += turn * 2.2 * dt; P.hold = 99; }
      let walking = false;
      if (!seated) {
        const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0), r = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
        const ajar = cabin.door ? cabin.door() > 0.75 : true;
        if (f || r) {
          const sp = 1.7 * dt, sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
          const dx = (-sy * f + cy * r) * sp, dz = (-cy * f - sy * r) * sp;
          if (walkable(P.x + dx, P.z, ajar)) P.x += dx;
          if (walkable(P.x, P.z + dz, ajar)) P.z += dz;
          walking = true;
        }
        P.place = placeAt(P.x, P.z);
      }
      // the crew badge: the cockpit door opens as the flight attendant comes up to it, and shuts behind her
      const want = !seated && Math.abs(P.x) < 0.6 && P.z < 0.95;
      if (want !== doorWant) { doorWant = want; cabin.setDoor(want || S.crack > 0); if (opts.onDoor) opts.onDoor(want); }
      if (walking) { stepT -= dt; if (stepT <= 0) { snd.loop('int_steps', 0.3); stepT = 0.3; } } else snd.stop('int_steps');
      return walking;
    }

    // ---- tasks
    function trouble(id, label) {
      const want = String(id || '').toLowerCase();
      const d = pool.tasks.find((t) => t.undoes && String(t.undoes).toLowerCase() === want); if (!d) return false;
      let t = S.tasks.find((x) => x.def.id === d.id);
      if (t) { if (!t.done || d.once) return false; t.done = false; t.prog = 0; t.idx = 0; t.last = ''; }
      else { t = mk(d); S.tasks.push(t); }
      paint(); toast((label || 'TROUBLE IN THE CABIN') + ' · ' + d.title, 3); snd.play('sfx_ui_whoosh', 0.4);
      return true;
    }
    // no intruder on board: the same trouble now and then, as a malfunction that costs no time
    let flightT = 0, nextFault = 0;
    const frng = KK.makeRng ? KK.makeRng((seed * 131 + 17) >>> 0) : { int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)) };
    function faults(dt) {
      if (S.intruder || !S.flying) return;
      flightT += dt;
      if (!nextFault) nextFault = 20 + frng.int(0, 15);
      if (flightT < nextFault) return;
      nextFault = flightT + 40 + frng.int(0, 30);
      if (open().filter((t) => t.def.undoes).length >= 2) return;
      const can = pool.tasks.filter((d) => d.undoes && !S.tasks.some((t) => t.def.id === d.id && (!t.done || d.once)));
      if (!can.length) return;
      const d = can[frng.int(0, can.length - 1)];
      trouble(d.undoes, 'MALFUNCTION');
      const fx = { vent: 'smoke', oven: 'smoke', emp: 'blackout', masks: 'masks', calls: 'calls', trolley: 'block' }[d.undoes];   // what it looks like
      if (fx) S.fx[fx] = 30;
    }
    // where a task can be worked on right now
    function taskHere() {
      const here = P.seat ? 'seat' : P.place;
      const list = open().sort((a, b) => (a.def.fetch ? 1 : 0) - (b.def.fetch ? 1 : 0));   // trouble first, the coffee can wait
      return list.find((t) => {
        if (where(t) !== here) return false;
        if (here === 'cockpit' && t.def.fetch) return Math.hypot(P.x - CAPTAIN.x, P.z - CAPTAIN.z) < 1.0;   // hand the cup over: next to the captain's seat
        const pl = t.def.near && plants.filter((p) => p.name === t.def.near).pop();
        if (pl && P.seat) return Math.abs(P.seat.z - pl.z) < 0.9 && Math.sign(P.seat.x) === Math.sign(pl.x || P.seat.x);   // the device: in that row or the next
        return true;
      }) || null;
    }
    function onPress(k) {
      if (S.done) return;
      if (k === 'm') { snd.muted = !snd.muted; if (snd.muted) snd.stopAll(); toast(snd.muted ? 'SOUND OFF' : 'SOUND ON', 1.2); return; }
      if (k === 'c') { grab(); return; }
      if ((k === 'w' || k === 's' || k === 'a' || k === 'd' || k === 'arrowup' || k === 'arrowdown') && P.seat) toast('YOU ARE SITTING · PRESS F TO STAND UP', 1.8);
      const t = cur; if (!t || t.fetching) return;
      const d = t.def;
      if (d.input === 'mash' && (k === 'q' || k === 'e')) { if (k !== t.last) { t.last = k; t.prog += d.seconds / 14; } }
      else if (d.input === 'code' && (k === 'q' || k === 'e')) {
        const code = String(d.code || 'QE').toLowerCase();
        if (k === code[t.idx]) { t.idx++; t.prog = d.seconds * t.idx / code.length; snd.play('sfx_ui_whoosh', 0.3); }
        else { t.idx = k === code[0] ? 1 : 0; t.prog = d.seconds * t.idx / code.length; snd.play('sfx_task_fail', 0.4); }
      }
    }
    function finish(t) {
      t.done = true; t.prog = 0; t.idx = 0; t.last = '';
      const d = t.def;
      if (d.fetch) { S.carry = false; S.coffees++; t.back = S.coffees >= 3 ? Infinity : 50; }
      S.clock = Math.min(S.total || 9999, S.clock + d.effect);
      // what it ends on the intruder's screen and here: smoke, masks, the lights, the trolley...
      (d.clears || []).forEach((type) => { if (type !== 'panic') S.fx[type] = 0; });
      if ((d.clears || []).indexOf('door') >= 0) S.crack = 0;
      if (d.undoes === 'emp' || d.undoes === 'bomb') { const nm = d.undoes === 'emp' ? 'intruder_emp' : 'intruder_device'; const p = plants.filter((q) => q.name === nm).pop(); if (p) { W.scene.remove(p.g); plants.splice(plants.indexOf(p), 1); } }
      if (opts.link) opts.link.send({ t: 'clear', types: (d.clears || []).slice(0, 6) });
      const fx = (d.fx || []).concat((d.clears || []).indexOf('panic') >= 0 ? [{ type: 'calm', amount: 0.15 }] : []);
      if (opts.onTask) opts.onTask({ k: 'task', id: d.id, title: d.title, effect: d.effect, fx });
      snd.play('sfx_task_done', 0.6); if (d.sound) setTimeout(() => snd.play(d.sound, 0.85), 300);
      $('axClockT').className = 'up'; clockFlashT = 2;
      toast(d.title + ' · +' + d.effect + ' SECONDS', 2.4);
      cur = null; paint();
    }

    // ---- calming the passengers: what the captain's PA does when this seat is empty
    let calm = { prog: 0, cool: 0 };
    const canCalm = () => !P.seat && P.place === 'aisle' && S.unrest > 0.22 && calm.cool <= 0;
    function calmDone() {
      calm.prog = 0; calm.cool = 14;
      if (opts.onTask) opts.onTask({ k: 'task', id: 'calm', title: 'CALMED THE PASSENGERS', effect: 0, fx: [{ type: 'calm', amount: 0.3 }, { type: 'nocalm' }] });
      S.unrest = Math.max(0, S.unrest - 0.3);
      snd.play('att_calm', 0.85); toast('“PLEASE STAY IN YOUR SEATS, EVERYTHING IS UNDER CONTROL.”', 2.8);
    }

    // ---- catching the intruder: C next to somebody
    let grabCool = 0;
    function grab() {
      if (grabCool > 0) { toast('CATCH YOUR BREATH FIRST', 1.2); return; }
      if (P.seat) { toast('STAND UP FIRST (F)', 1.4); return; }
      // who is next to us, in front of us: the intruder, or one of the seated passengers
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      const cand = [];
      if (ip.seen) cand.push({ x: ip.x, z: ip.z, who: 'int' });
      cabin.seats.forEach((s) => { if (s.taken) cand.push({ x: s.x, z: s.z, who: 'pax' }); });
      let best = null, bd = 9;
      cand.forEach((c) => { const dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz); if (d > 1.35 || d < 0.01) return; const dot = (dx * fx + dz * fz) / d; if (dot < 0.55) return; const score = d - dot * 0.3; if (score < bd) { bd = score; best = c; } });
      if (!best) { toast('NOBODY WITHIN REACH · WALK UP TO THEM FIRST', 1.6); return; }
      grabCool = 4;
      snd.play('sfx_tackle', 0.7);
      const caughtInAct = best.who === 'int' && (ip.working || performance.now() - ip.workT < 6000 || ip.place === 'cockpit');
      if (caughtInAct) {
        if (opts.link) opts.link.send({ t: 'caught', ok: true });
        if (opts.onCaught) opts.onCaught(true);
        S.caught = true; ip.seen = false; seatFigure(null); intG.visible = false;
        setTimeout(() => snd.play('att_got', 0.9), 500);
        toast('GOT YOU · THE INTRUDER IS IN HANDCUFFS · +15 SECONDS', 3.5);
        warn.style.boxShadow = 'inset 0 0 140px rgba(61,255,139,.4)'; setTimeout(() => { warn.style.boxShadow = ''; }, 900);
      } else {
        grabCool = 12;
        if (opts.link && best.who === 'int') opts.link.send({ t: 'caught', ok: false });
        if (opts.onCaught) opts.onCaught(false);
        S.unrest = Math.min(1, S.unrest + 0.15);
        setTimeout(() => snd.play('pax_angry', 0.7), 300);
        toast(best.who === 'int' ? 'NOTHING ON THEM · YOU NEED TO CATCH THEM AT IT' : 'AN INNOCENT PASSENGER · THE CABIN IS UPSET', 3);
      }
    }

    // ---- the end of the flight, inside the cabin
    function endCard(ok, title, why) {
      if (S.done) return; S.done = true; cur = null;
      try { document.exitPointerLock(); } catch (e) {}
      snd.stopAll(); hudAct.classList.remove('show');
      $('axEndH').textContent = title; $('axEndH').style.color = ok ? '#3dff8b' : '#ff3b30'; $('axEndP').textContent = why;
      endEl.style.display = 'flex';
    }
    function crash() {
      if (S.crashT || S.done) return;
      S.crashT = 0.001; S.fx.masks = 99;
      snd.play('gpws_pullup', 0.9); snd.play('sfx_engine_fail', 0.8); setTimeout(() => snd.play('sfx_pax_scream', 0.9), 700);
      toast('BRACE · BRACE · BRACE', 3);
    }
    function land() {
      if (S.done) return;
      snd.play('sfx_touchdown', 0.8); setTimeout(() => snd.play('sfx_cheer', 0.8), 1200);
      setTimeout(() => endCard(true, 'ON THE GROUND', 'You kept the cabin together' + (S.caught ? ' and put the intruder in handcuffs.' : '.') + ' The passengers are clapping.'), 2500);
    }

    // ---- frame
    let last = performance.now(), alive = true, raf = 0, poseT = 0;
    function frame(now) {
      if (!alive) return; raf = requestAnimationFrame(frame);
      const dtw = Math.max(0, Math.min(0.25, (now - last) / 1000)), dt = Math.min(0.1, dtw); last = now;   // dtw: timers and task progress keep real time on a slow machine
      if (S.done) return;
      const walking = walk(dt);
      // through the cockpit door
      const inCk = P.place === 'cockpit';
      if (inCk !== !!S.inCockpit) { S.inCockpit = inCk; if (opts.onCockpit) opts.onCockpit(inCk); if (inCk) toast('THE COCKPIT · THE CAPTAIN IS FIGHTING THE CONTROLS', 2); }

      // the coffee comes back now and then
      S.tasks.forEach((t) => { if (t.done && t.back > 0 && isFinite(t.back)) { t.back -= dtw; if (t.back <= 0) { t.done = false; paint(); } } });
      const before = cur;
      cur = S.flying === false ? null : taskHere();
      if (cur !== before) paint();
      let label = '', pct = 0;
      if (cur) {
        const d = cur.def;
        if (d.fetch && !S.carry) {   // pour the coffee first
          cur.fetching = true;
          if (keys.e) cur.prog += dtw;
          pct = cur.prog / 2; label = 'HOLD <kbd>E</kbd> · POUR A BLACK COFFEE';
          if (cur.prog >= 2) { cur.prog = 0; S.carry = true; snd.play('sfx_ui_whoosh', 0.4); toast('COFFEE POURED · TAKE IT TO THE CAPTAIN', 2.2); paint(); }
        } else {
          cur.fetching = false;
          const mode = d.input || 'hold';
          if (mode === 'hold' && keys.e) cur.prog += dtw;
          pct = cur.prog / d.seconds;
          label = mode === 'hold' ? 'HOLD <kbd>E</kbd>' : mode === 'mash' ? 'ALTERNATE <kbd>Q</kbd><kbd>E</kbd> FAST' : 'TYPE <span class="seq">' + String(d.code).split('').map((c, i) => '<kbd' + (i < cur.idx ? ' class="ok"' : '') + '>' + c + '</kbd>').join('') + '</span>';
          label += ' · ' + esc(d.title);
          if (cur.prog >= d.seconds - 1e-6) finish(cur);
        }
      } else if (canCalm()) {
        if (keys.e) calm.prog += dtw; else calm.prog = Math.max(0, calm.prog - dtw * 0.5);
        pct = calm.prog / 3; label = 'HOLD <kbd>E</kbd> · CALM THE PASSENGERS';
        if (calm.prog >= 3) calmDone();
      }
      calm.cool -= dtw; grabCool -= dtw;
      if (label) { hudAct.classList.add('show'); hudAct.innerHTML = '<div style="font-size:18px;letter-spacing:1px">' + label + '</div><div class="ixbar"><i style="width:' + Math.min(100, pct * 100) + '%"></i></div>'; }
      else hudAct.classList.remove('show');
      hudCarry.classList.toggle('show', S.carry);

      // the intruder, smoothly
      const k = Math.min(1, dt * 10);
      ip.x += (ip.tx - ip.x) * k; ip.z += (ip.tz - ip.z) * k; ip.yaw = ip.tyaw;
      if (ip.seen && now - ip.workT > 400) ip.working = ip.working && now - ip.heard < 1500;
      if (intG && intG.visible) U.animPerson(intG, dt, { moving: ip.moving, working: ip.working });
      plants.forEach((p) => { p.b.visible = Math.sin(now / 160) > 0; });
      faults(dtw);

      // the cabin mood, the effects, the end
      Object.keys(S.fx).forEach((n) => { if (S.fx[n] < 90) S.fx[n] = Math.max(0, S.fx[n] - dtw); });
      if (!(S.fx.smoke > 0)) snd.stop('int_alarm');
      S.crack = Math.max(0, (S.crack || 0) - dtw);
      const u = clamp(S.unrest, 0, 1);
      $('axMoodB').style.width = Math.round(u * 100) + '%'; hudMood.className = 'ix ix-box' + (u > 0.75 ? ' red' : u > 0.45 ? ' amber' : '');
      $('axWhere').textContent = P.seat ? 'SEAT ' + P.seat.id : NAMES[P.place] || '';
      const dive = S.clock < 30 ? (30 - S.clock) / 30 : 0;
      cabin.setState({ unrest: S.crashT ? 1 : Math.max(u, dive * 0.8), turb: S.crashT ? 1 : Math.max(S.fx.turbulence > 0 ? 0.8 : 0, S.turb || 0, dive * 0.7) });
      if (S.crashT) {
        S.crashT += dt; S.fx.blackout = Math.random() > 0.75 ? 0.15 : 0;
        P.pitch = clamp(P.pitch - 0.12 * dt, -1.2, 1);
        if (S.crashT > 6.5) { flash.style.opacity = 1; snd.play('sfx_explode_big', 1); snd.play('sfx_crash', 0.9); S.crashT = -1; setTimeout(() => endCard(false, 'AIRCRAFT LOST', S.caught ? 'You caught the intruder, but the cockpit could not save her.' : 'The aircraft went down. Nobody walked away.'), 900); }
      }
      dark.style.opacity = S.fx.blackout > 0 ? (W ? 0.35 : 1) : 0;
      smoke.style.opacity = S.fx.smoke > 0 ? Math.min(W ? 0.3 : 0.6, S.fx.smoke / 8) : 0;
      if (!S.live) S.clock = Math.max(0, S.clock - dtw);   // on its own (no lobby): a stand-in clock
      $('axClockT').textContent = fmt(S.clock); if (clockFlashT > 0) { clockFlashT -= dt; if (clockFlashT <= 0) $('axClockT').className = ''; } else $('axClockT').className = S.clock < 60 ? 'down' : '';
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('show'); }

      // where we are, for the intruder's screen
      if (opts.link && now - poseT >= 150) { poseT = now; opts.link.send({ t: 'pose', who: 'att', x: +P.x.toFixed(2), z: +P.z.toFixed(2), yaw: +P.yaw.toFixed(2), seat: P.seat ? P.seat.id : null, place: P.place, moving: walking, tackle: grabCool > 2 }); }
    }
    raf = requestAnimationFrame(frame);
    paint();
    setTimeout(() => toast(S.intruder ? 'CABIN CREW · SOMEBODY ON BOARD IS NOT WHAT THEY SEEM' : 'CABIN CREW · KEEP THE PASSENGERS CALM', 3), 600);

    return {
      _ip: ip,
      state: S, trouble, crash, land, walkable, placeAt,
      setFlight(f) {
        if (!f) return;
        if (f.clock != null) { S.clock = Math.max(0, +f.clock); S.live = true; }
        if (f.total != null) S.total = +f.total;
        if (f.unrest != null) S.unrest = clamp(+f.unrest, 0, 1);
        if (f.turb != null) S.turb = clamp(+f.turb, 0, 1);
        if (f.intruder != null) S.intruder = !!f.intruder;
        if (f.flying != null) S.flying = !!f.flying;
        if (f.crack != null && f.crack) { S.crack = 12; cabin.setDoor(true); }
      },
      // the intruder's door sabotage: the door stands open for a while on this screen too
      cracked(sec) { S.crack = sec || 12; cabin.setDoor(true); },
      stop() {
        alive = false; cancelAnimationFrame(raf); snd.stopAll();
        window.removeEventListener('keydown', onKeyCap, true); window.removeEventListener('keyup', onKeyCap, true);
        ['pointerdown', 'pointerup', 'pointermove'].forEach((t) => window.removeEventListener(t, onPtrCap, true));
        window.removeEventListener('pointerup', onUp); document.removeEventListener('mousemove', onMouse); window.removeEventListener('blur', onBlur);
      },
    };
  }

  // one passenger's clothes, the same on every screen of a flight (the intruder's disguise)
  function paxLook(seed) {
    const r = (n) => ((seed * 7919 + n * 104729) % 9973) / 9973;
    const SK = [0xf0c8a4, 0xd9a47c, 0xb07a52, 0x8a5a3a, 0xf4d6bc], HA = [0x1c1612, 0x3a2a1c, 0x6b4a2a, 0xb9a27a, 0x101010];
    const SH = [0xb23a3a, 0x3a6ab2, 0x3f8f5a, 0xc9a13a, 0x7a4aa8, 0x2f3540, 0xc76a2f, 0x4aa3a8], PA = [0x23283a, 0x3a3f4a, 0x4a3a2c, 0x1a1d24];
    const female = r(1) < 0.5;
    return { female, shirt: SH[Math.floor(r(2) * SH.length)], pants: PA[Math.floor(r(3) * PA.length)], skin: SK[Math.floor(r(4) * SK.length)], hair: HA[Math.floor(r(5) * HA.length)], lips: female ? 0xb8434a : null };
  }

  window.KKAttendant = { start, walkable, placeAt, paxLook };
})();
