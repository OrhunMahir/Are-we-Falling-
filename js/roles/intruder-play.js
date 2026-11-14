/* ARE WE FALLING? — the INTRUDER seat played in first person (Batu).
   Sits on top of Orhun's cabin (js/cabin3d.js) through its public object; it never edits the cabin.

     const play = KKIntruder.start(cabin, { seed, canvas, seat, link, onEnd({ won, why }) });
     play.state           -> { clock, tasks, suspicion, done, fx }
     play.pose()          -> { x, z, yaw, seat, place, working }    what other screens need to draw the intruder
     play.setAttendant(p) -> a remote flight attendant's pose { x, z, yaw, moving, tackle }
     play.caught()        -> the remote attendant caught the intruder

   The flight attendant:
   - 3 players (pilot, tower, intruder): the attendant is the AI here. She patrols, gets suspicious when she
     sees loud work or someone hanging around the cockpit door, chases at full suspicion and tackles on contact.
   - 4 players: pass `link` (see KKLink below). The attendant is the other player (js/roles/attendant-catch.js);
     this screen only draws her where her screen says she is, and ends when she catches the intruder.

   The cabin's scene is reached without editing cabin3d.js: `cabin.scene` if the cabin ever exposes it,
   otherwise the scene is taken from the cabin renderer's next render call. That gives the effects a home in 3D:
   lights really go out, smoke fills the cabin, masks drop over the rows, the EMP sits in the bin, the device
   blinks under the seat, the loose trolley stands in the aisle, and every person drawn here keeps one look. */
(function () {
  'use strict';
  const T = window.THREE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const AUDIO = 'audio/';
  const ROWS = 9, PITCH = 0.82, Z0 = 2.0;

  // ---------------------------------------------------------------- sound
  const snd = {
    muted: false, loops: {},
    play(name, vol) { if (!name || this.muted) return null; const a = new Audio(AUDIO + name + '.mp3'); a.volume = clamp(vol == null ? 0.8 : vol, 0, 1); const p = a.play(); if (p && p.catch) p.catch(() => {}); return a; },
    loop(name, vol) { if (this.muted) return; if (this.loops[name]) { this.loops[name].volume = clamp(vol == null ? 0.4 : vol, 0, 1); return; } const a = new Audio(AUDIO + name + '.mp3'); a.loop = true; a.volume = clamp(vol == null ? 0.4 : vol, 0, 1); const p = a.play(); if (p && p.catch) p.catch(() => {}); this.loops[name] = a; },
    stop(name) { const a = this.loops[name]; if (a) { a.pause(); delete this.loops[name]; } },
    stopAll() { Object.keys(this.loops).forEach((k) => this.stop(k)); },
  };

  // ---------------------------------------------------------------- where a person may stand
  function walkable(x, z, doorOpen) {
    if (z >= 0.55 && z <= 1.45) return x >= -0.55 && x <= 0.5;            // front: galley and cockpit door
    if (z > 1.45 && z < 9.3) return x >= -0.28 && x <= 0.28;              // the aisle between the seats
    if (z >= 9.3 && z <= 10.35 && x >= -0.4 && x <= 0.5) return true;     // rear galley
    if (x < -0.4 && x >= -1.38 && z >= 9.55 && z <= 10.45) return true;   // inside the lavatory
    if (doorOpen && z >= -1.3 && z < 0.55) return x >= -0.32 && x <= 0.32; // into the cockpit, between the pilots' seats
    return false;
  }
  function placeAt(x, z) {
    if (z < 0.55) return 'cockpit';
    if (x < -0.42 && z > 9.5) return 'lavatory';
    if (z < 0.85) return 'door';
    if (z < 1.45 || z > 9.3) return 'galley';
    return 'aisle';
  }

  // ---------------------------------------------------------------- the cabin's scene, with a hook before every render
  // cabin.scene if the cabin exposes it; otherwise we catch the scene while the cabin adds a throwaway actor to it
  // (cabin.setActor calls scene.add), and run our updates from scene.onBeforeRender, right before every frame.
  function hookScene(cabin, canvas, onScene, preRender) {
    if (!T) return null;
    let scene = cabin.scene || null;
    if (!scene && cabin.setActor) {
      const O = T.Object3D.prototype, orig = O.add;
      O.add = function () { if (this.isScene && !scene) scene = this; return orig.apply(this, arguments); };
      try { cabin.setActor('__kkprobe', { role: 'attendant', at: 'aisle' }); cabin.setActor('__kkprobe', null); } catch (e) { console.warn(e); } finally { O.add = orig; }
    }
    if (!scene) { console.warn('intruder: cabin scene not found, effects stay on screen only'); return null; }
    onScene(scene);
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = function () { try { preRender(scene); } catch (e) { console.error(e); } if (prev) prev.apply(this, arguments); };
    return scene;
  }

  // ---------------------------------------------------------------- people with one fixed look
  const mats = {};
  const lam = (c) => mats[c] || (mats[c] = T ? new T.MeshLambertMaterial({ color: c }) : null);
  const LOOKS = {
    attendant: { shirt: 0x1d2c52, pants: 0x1d2c52, scarf: 0xd43a3a, skin: 0xf0c8a4, hair: 0x3a2a1c, bun: true },
    intruder: { shirt: 0x5b6b4a, pants: 0x2a2f3c, skin: 0xd9a47c, hair: 0x1c1612, cap: 0x7a2a2a },
  };
  function makePerson(look) {
    const g = new T.Group();
    const add = (geo, c, x, y, z, parent) => { const m = new T.Mesh(geo, lam(c)); m.position.set(x, y, z); (parent || g).add(m); return m; };
    // legs swing from the hip: a pivot group at hip height, the leg hangs below it
    const leg = (x) => { const h = new T.Group(); h.position.set(x, 0.84, 0); g.add(h); add(new T.BoxGeometry(0.13, 0.84, 0.18), look.pants, 0, -0.42, 0, h); add(new T.BoxGeometry(0.14, 0.07, 0.24), 0x16181c, 0, -0.81, -0.03, h); return h; };
    const legL = leg(-0.08), legR = leg(0.08);
    add(new T.BoxGeometry(0.38, 0.52, 0.23), look.shirt, 0, 1.1, 0);
    const head = new T.Group(); head.position.set(0, 1.5, 0); g.add(head);
    add(new T.SphereGeometry(0.115, 14, 10), look.skin, 0, 0, 0, head);
    add(new T.SphereGeometry(0.124, 14, 8, 0, Math.PI * 2, 0, 1.75), look.hair, 0, 0.012, 0.012, head);
    if (look.bun) add(new T.SphereGeometry(0.07, 10, 8), look.hair, 0, 0.05, 0.13, head);
    if (look.cap) { add(new T.CylinderGeometry(0.127, 0.127, 0.07, 14), look.cap, 0, 0.09, 0, head); add(new T.BoxGeometry(0.2, 0.02, 0.13), look.cap, 0, 0.065, -0.14, head); }
    [-1, 1].forEach((s) => add(new T.BoxGeometry(0.026, 0.026, 0.02), 0x16181c, s * 0.042, 0.012, -0.108, head));
    if (look.scarf) add(new T.BoxGeometry(0.22, 0.07, 0.22), look.scarf, 0, 1.38, 0);
    const arms = [-1, 1].map((s) => { const a = new T.Group(); a.position.set(s * 0.225, 1.33, 0); add(new T.BoxGeometry(0.09, 0.4, 0.1), look.shirt, 0, -0.19, 0, a); g.add(a); return a; });
    g.userData = { head, arms, legL, legR, t: 0 };
    return g;
  }
  // pose a person: moving swings arms and legs, working raises the arms, tackle throws them forward, seated sinks
  function animPerson(g, dt, st) {
    const u = g.userData; u.t += dt * (st.moving ? 9 : 2);
    const sw = st.moving ? Math.sin(u.t) * 0.45 : 0;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    const up = st.tackle ? -1.5 : st.working ? -1.1 + Math.sin(u.t * 4) * 0.25 : 0;
    u.arms[0].rotation.x = up || -sw; u.arms[1].rotation.x = up || sw;
    g.position.y = st.seated ? -0.32 : 0;
    u.legL.visible = u.legR.visible = !st.seated;
  }

  // ---------------------------------------------------------------- effects that live in the cabin
  function makeWorldFx(scene) {
    const W = { scene, lights: [], smoke: null, masks: null, trolley: null, planted: [] };
    scene.traverse((o) => { if (o.isLight) W.lights.push({ l: o, base: o.intensity }); });
    // smoke: soft grey sprites that drift up and along the cabin
    const sc = document.createElement('canvas'); sc.width = sc.height = 64; const g = sc.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(190,190,185,0.9)'); gr.addColorStop(1, 'rgba(120,120,118,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(sc);
    W.smoke = new T.Group(); scene.add(W.smoke);
    for (let i = 0; i < 26; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false })); s.userData = { ph: Math.random() * 10, sp: 0.15 + Math.random() * 0.3 }; W.smoke.add(s); }
    W.smoke.userData = { x: -1, z: 10, k: 0 };
    // oxygen masks: one above every seat, they drop out of the panel and swing on their cords
    W.masks = new T.Group(); W.masks.visible = false; scene.add(W.masks);
    const cup = new T.CylinderGeometry(0.055, 0.04, 0.075, 12), bag = new T.BoxGeometry(0.07, 0.12, 0.04), cord = new T.BoxGeometry(0.005, 1, 0.005);
    const hatchG = new T.BoxGeometry(0.22, 0.015, 0.16);
    [-1.52, -1.04, -0.56, 0.56, 1.04, 1.52].forEach((x) => { for (let r = 0; r < ROWS; r++) {
      const m = new T.Group(); m.position.set(x * 0.92, 1.86 - Math.abs(x) * 0.06, Z0 + r * PITCH - 0.3);
      const c = new T.Mesh(cord, lam(0xe8e2c8)); m.add(c);
      const k = new T.Mesh(cup, lam(0xf2d024)); m.add(k);
      const b = new T.Mesh(bag, lam(0xeef3f5)); m.add(b);
      const h = new T.Mesh(hatchG, lam(0xc9ced2)); h.position.set(0, 0.02, 0); m.add(h);
      m.userData = { ph: Math.random() * 6, c, k, b, h, delay: Math.random() * 0.35, len: 0.55 + Math.random() * 0.1 };
      W.masks.add(m);
    } });
    // the same masks on every passenger's face once they have pulled them down
    W.faces = [];
    const faceCup = new T.CylinderGeometry(0.052, 0.04, 0.07, 12);
    scene.traverse((o) => { const u = o.userData; if (u && u.head && u.arms && u.head.isObject3D) { const f = new T.Mesh(faceCup, lam(0xf2d024)); f.rotation.x = Math.PI / 2; f.position.set(0, -0.03, -0.12); f.visible = false; u.head.add(f); W.faces.push({ f, delay: 0.8 + Math.random() * 2.2 }); } });
    W.maskT = -1;
    // call buttons: a blue lamp over every row that blinks while the bells ring
    W.calls = new T.Group(); W.calls.visible = false; scene.add(W.calls);
    const lampG = new T.BoxGeometry(0.05, 0.02, 0.05), lampM = new T.MeshBasicMaterial({ color: 0x4aa8ff });
    for (let r = 0; r < ROWS; r++) [-0.82, 0.82].forEach((x) => { const l = new T.Mesh(lampG, lampM); l.position.set(x, 1.73, Z0 + r * PITCH - 0.1); l.userData.ph = Math.random() * 6; W.calls.add(l); });
    // the loose drinks trolley
    W.trolley = new T.Group(); W.trolley.visible = false; scene.add(W.trolley);
    const tb = new T.Mesh(new T.BoxGeometry(0.34, 0.95, 0.75), lam(0xb9bec3)); tb.position.y = 0.5; W.trolley.add(tb);
    const tt = new T.Mesh(new T.BoxGeometry(0.36, 0.04, 0.77), lam(0x6f777f)); tt.position.y = 0.99; W.trolley.add(tt);
    W.trolley.position.set(0, 0, 4.8); W.trolley.rotation.y = 0.3;
    // the cockpit behind the door: the cabin only paints a black wall there, so hide it and build the room
    scene.traverse((o) => { if (o.isMesh && o.position.z < -0.5 && o.position.z > -0.7 && o.parent === scene) o.visible = false; });
    const C = new T.Group(); scene.add(C); W.cockpit = C;
    const cb = (w, h, d, x, y, z, c, basic) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), basic ? new T.MeshBasicMaterial({ color: c }) : lam(c)); m.position.set(x, y, z); C.add(m); return m; };
    cb(2.2, 0.04, 1.9, 0, -0.02, -0.95, 0x22262e);                                   // floor
    cb(0.06, 2.2, 1.9, -1.1, 1.0, -0.95, 0x9aa2aa); cb(0.06, 2.2, 1.9, 1.1, 1.0, -0.95, 0x9aa2aa);   // side walls
    cb(2.2, 0.06, 1.9, 0, 2.1, -0.95, 0x8b939b);                                      // ceiling with switches
    for (let i = 0; i < 18; i++) cb(0.05, 0.02, 0.05, -0.8 + (i % 9) * 0.2, 2.06, -0.5 - Math.floor(i / 9) * 0.3, [0x3dff8b, 0xffb000, 0xff3b30, 0x37c0ff][i % 4], true);
    W.glass = cb(2.0, 0.75, 0.04, 0, 1.45, -1.88, 0x0b1424, true);                   // windshield: the storm outside
    cb(2.1, 0.12, 0.08, 0, 1.06, -1.86, 0x2c3138);
    const panel = cb(1.9, 0.5, 0.35, 0, 0.88, -1.6, 0x2c3138);                       // the main panel
    W.lamps = [];
    for (let i = 0; i < 24; i++) W.lamps.push(cb(0.07, 0.05, 0.01, -0.8 + (i % 12) * 0.145, 0.95 + Math.floor(i / 12) * 0.12, -1.42, [0x3dff8b, 0xffb000, 0xff3b30, 0x37c0ff][i % 4], true));
    [-0.45, 0.45].forEach((x) => cb(0.34, 0.24, 0.02, x, 1.0, -1.42, 0x1b6a8f, true));   // two screens
    cb(0.36, 0.5, 0.7, 0, 0.5, -1.1, 0x23272e);                                       // centre console
    [-0.62, 0.62].forEach((x) => { cb(0.5, 0.12, 0.5, x, 0.45, -0.85, 0x3a3f48); cb(0.5, 0.75, 0.1, x, 0.85, -0.6, 0x3a3f48); });   // seats
    W.pilot = makePerson({ shirt: 0xf2f2f2, pants: 0x1a1d24, skin: 0xd9a47c, hair: 0x2a1c12, scarf: 0x1d2c52 });
    W.pilot.position.set(-0.62, -0.32, -0.85); W.pilot.userData.legL.visible = W.pilot.userData.legR.visible = false; C.add(W.pilot);
    W.pilot.userData.arms.forEach((a) => { a.rotation.x = -1.0; });
    const pl = new T.PointLight(0x9fc4ff, 1.2, 3, 1.5); pl.position.set(0, 1.6, -1.0); C.add(pl);
    return W;
  }
  function plant(W, name, x, y, z, size, blink) {
    if (!W) return;
    const g = new T.Group(); g.position.set(x, y, z); W.scene.add(g);
    const ok = window.KKModels && KKModels.load(name, (m) => { g.add(KKModels.fit(m, size, Math.random() * 6)); });
    if (!ok) g.add(new T.Mesh(new T.BoxGeometry(size, size * 0.7, size * 0.8), lam(0x6f747a)));
    if (blink) { const b = new T.Mesh(new T.SphereGeometry(0.022, 8, 6), new T.MeshBasicMaterial({ color: 0xff2a1a })); b.position.y = size * 0.75; g.add(b); g.userData.blink = b; }
    W.planted.push(g);
  }
  function updateWorldFx(W, fx, t) {
    if (!W) return;
    const dark = fx.blackout > 0 ? 0.07 : 1;
    W.lights.forEach((L) => { if (dark < 1) L.l.intensity = L.base * dark; else if (L.l.intensity < L.base * 0.2) L.l.intensity = L.base; });
    const sk = fx.smoke > 0 ? Math.min(1, fx.smoke / 6) : 0, su = W.smoke.userData;
    su.k += (sk - su.k) * 0.03;
    W.smoke.children.forEach((s, i) => {
      const u = s.userData, f = ((t * u.sp + u.ph) % 4) / 4;
      s.position.set(su.x + Math.sin(u.ph + t * 0.4) * 0.6 + (su.x < 0 ? f * 0.9 : 0), 0.9 + f * 1.3, su.z + (su.z > 5 ? -1 : 1) * (f * 3.5 + (i % 5) * 0.5));
      const sz = 0.6 + f * 1.4; s.scale.set(sz, sz, 1); s.material.opacity = su.k * 0.55 * Math.sin(f * Math.PI);
    });
    // masks: drop with a little bounce, swing, then the passengers put them on
    const on = fx.masks > 0;
    if (on && W.maskT < 0) W.maskT = t;
    if (!on) W.maskT = -1;
    W.masks.visible = on;
    const since = on ? t - W.maskT : 0;
    if (on) W.masks.children.forEach((m) => {
      const u = m.userData, a = Math.max(0, since - u.delay);
      const drop = a <= 0 ? 0 : Math.min(1, a / 0.35), bounce = a > 0.35 ? Math.exp(-(a - 0.35) * 4) * Math.sin((a - 0.35) * 18) * 0.08 : 0;
      const len = u.len * drop + bounce;
      u.c.scale.y = Math.max(0.01, len); u.c.position.y = -len / 2;
      u.k.position.y = -len - 0.04; u.b.position.set(0.05, -len + 0.02, 0);
      u.h.rotation.x = drop > 0 ? -1.2 : 0;
      m.rotation.z = Math.sin(t * 2.2 + u.ph) * 0.16 * drop; m.rotation.x = Math.sin(t * 1.7 + u.ph) * 0.1 * drop;
    });
    W.faces.forEach((p) => { p.f.visible = on && since > p.delay; });
    W.calls.visible = fx.calls > 0;
    if (W.calls.visible) W.calls.children.forEach((l) => { l.visible = Math.sin(t * 5 + l.userData.ph) > -0.2; });
    W.trolley.visible = fx.block > 0;
    W.planted.forEach((g) => { if (g.userData.blink) g.userData.blink.visible = Math.sin(t * 6) > 0; });
    // the cockpit: warning lamps blink, lightning behind the windshield, the pilot fights the controls
    if (W.lamps) W.lamps.forEach((l, i) => { l.visible = (i % 3 === 0) ? Math.sin(t * 7 + i) > 0 : true; });
    if (W.glass) W.glass.material.color.setHex(Math.random() > 0.985 ? 0xc9d8ff : (fx.crash > 0 ? 0x3a2a24 : 0x0b1424));
    if (W.pilot) { const a = W.pilot.userData.arms, k = fx.crash > 0 ? 1.6 : 1; a[0].rotation.x = -1.0 + Math.sin(t * 9 * k) * 0.15 * k; a[1].rotation.x = -1.0 + Math.cos(t * 8 * k) * 0.15 * k; W.pilot.userData.head.rotation.y = Math.sin(t * 1.3) * 0.3; }
  }

  // ---------------------------------------------------------------- shared HUD styles
  function addStyles() {
    if (document.getElementById('ixStyles')) return;
    const css = document.createElement('style'); css.id = 'ixStyles';
    css.textContent = `
      .ix { position:absolute; font-family: "Arial Narrow", Arial, sans-serif; color:#d6dde8; pointer-events:none; }
      .ix-box { background: rgba(8,11,16,.8); border:1px solid #39414e; border-radius:6px; padding:10px 14px; }
      #ixTasks { right:16px; top:14px; width:300px; max-height:70vh; overflow:hidden; }
      #ixTasks.small .ixt p { display:none; }
      #ixClock { display:flex; justify-content:space-between; font: 12px ui-monospace, Menlo, monospace; letter-spacing:2px; color:#8491a3; }
      #ixClock b { font-size:30px; color:#d6dde8; } #ixClock b.down { color:#ff3b30; }
      .ixt { border-top:1px solid #2a313c; margin-top:8px; padding-top:8px; }
      .ixt h4 { margin:0; font-size:16px; letter-spacing:1px; display:flex; justify-content:space-between; }
      .ixt h4 span { font: 12px ui-monospace, Menlo, monospace; color:#ffb000; }
      .ixt p { margin:3px 0 0; font-size:13px; color:#8491a3; line-height:1.25; }
      .ixt em { font-style:normal; font: 11px ui-monospace, Menlo, monospace; color:#ffb000; letter-spacing:1px; }
      .ixt.done { opacity:.45; } .ixt.done h4 { text-decoration: line-through; } .ixt.here { border-top-color:#ffb000; }
      #ixSus { left:16px; top:62px; width:230px; }
      #ixSus small { font: 11px ui-monospace, Menlo, monospace; letter-spacing:2px; color:#8491a3; display:block; }
      .ixbar { height:8px; background:#1b1f26; border-radius:4px; margin-top:6px; overflow:hidden; } .ixbar i { display:block; height:100%; width:0; background:#ffb000; transition: width .15s; }
      #ixSus.hot .ixbar i { background:#ff3b30; } #ixSus.hot small:first-child { color:#ff3b30; }
      #ixAct { left:50%; bottom:80px; transform:translateX(-50%); width:440px; max-width:90vw; text-align:center; display:none; }
      #ixAct.show { display:block; } #ixAct kbd { font: 14px ui-monospace, Menlo, monospace; background:#ffb000; color:#000; border-radius:3px; padding:0 7px; margin:0 3px; }
      #ixAct .seq kbd { background:#39414e; color:#d6dde8; } #ixAct .seq kbd.ok { background:#3dff8b; color:#000; }
      #ixToast { left:50%; top:20%; transform:translateX(-50%); font-size:24px; letter-spacing:1px; opacity:0; transition:opacity .3s; text-align:center; }
      #ixToast.show { opacity:1; }
      #ixCross { left:50%; top:50%; width:6px; height:6px; margin:-3px 0 0 -3px; border-radius:50%; background:rgba(255,255,255,.6); }
      #ixHint { left:50%; bottom:14px; transform:translateX(-50%); font: 11.5px ui-monospace, Menlo, monospace; letter-spacing:1px; color:#8491a3; white-space:nowrap; max-width:96vw; overflow:hidden; }
      #ixHint b { color:#d6dde8; font-weight:400; }
      #ixVest { position:absolute; left:0; right:0; bottom:0; width:100%; height:60%; pointer-events:none; }
      #ixDark { inset:0; background: radial-gradient(ellipse at 50% 60%, rgba(0,0,0,.25), rgba(0,0,0,.85)); opacity:0; transition: opacity .25s; }
      #ixSmoke { inset:0; background: radial-gradient(ellipse at 40% 30%, rgba(170,170,165,.3), rgba(90,90,88,.55)); opacity:0; transition: opacity 1.5s; }
      #ixWarn { inset:0; box-shadow: inset 0 0 120px rgba(255,40,30,.0); transition: box-shadow .3s; }
      #ixEnd { inset:0; display:none; align-items:center; justify-content:center; flex-direction:column; background: rgba(0,0,0,.82); pointer-events:auto; text-align:center; }
      #ixEnd.show { display:flex; } #ixEnd h1 { margin:0; font-size:60px; letter-spacing:4px; } #ixEnd p { color:#8491a3; font-size:18px; max-width:640px; }
      #ixEnd button { margin-top:18px; font-size:18px; letter-spacing:2px; padding:10px 22px; background:#ffb000; border:0; border-radius:4px; cursor:pointer; }
    `;
    document.head.appendChild(css);
  }

  // ---------------------------------------------------------------- first-person controls shared by both cabin seats
  function fpsControls(cabin, canvas, opts) {
    const P = cabin.player, keys = {}, MINE = ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'm'];
    let dragging = false, wasSeated = !!P.seat, stepT = 0;
    const onKeyCap = (e) => {
      const k = e.key.toLowerCase(); if (MINE.indexOf(k) < 0) return;
      e.stopImmediatePropagation(); e.stopPropagation();
      const down = e.type === 'keydown';
      if (down && !e.repeat && opts.onPress) opts.onPress(k);
      keys[k] = down;
    };
    const onPtrCap = (e) => {
      if (e.target !== canvas) return;
      e.stopImmediatePropagation(); e.stopPropagation();
      if (e.type === 'pointerdown') { dragging = true; if (!opts.done() && document.pointerLockElement !== canvas) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (er) {} } }
      if (e.type === 'pointerup') dragging = false;
    };
    const onUp = () => { dragging = false; };
    const onMouse = (e) => {
      if (opts.done()) return;
      const locked = document.pointerLockElement === canvas;
      if (!locked && !(dragging && (e.buttons & 1))) return;
      const k = locked ? 0.0024 : 0.005;
      P.yaw -= (e.movementX || 0) * k; P.pitch = clamp(P.pitch - (e.movementY || 0) * k, -1.35, 1.0); P.hold = 99;
    };
    window.addEventListener('keydown', onKeyCap, true); window.addEventListener('keyup', onKeyCap, true);
    ['pointerdown', 'pointerup', 'pointermove'].forEach((t) => window.addEventListener(t, onPtrCap, true));
    window.addEventListener('pointerup', onUp); document.addEventListener('mousemove', onMouse);
    return {
      keys,
      update(dt, doorOpen) {   // returns true while the player walks
        const seated = !!P.seat || (P.path && P.path.length);
        if (wasSeated && !seated) { P.yaw = P.z > 5 ? 0 : Math.PI; P.pitch = 0; P.hold = 99; }
        wasSeated = seated;
        const turn = (keys.arrowleft ? 1 : 0) - (keys.arrowright ? 1 : 0);
        if (turn) { P.yaw += turn * 2.2 * dt; P.hold = 99; }
        let walking = false;
        if (!seated) {
          const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0), r = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
          if (f || r) {
            const sp = (opts.speed || 1.7) * dt, sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
            const dx = (-sy * f + cy * r) * sp, dz = (-cy * f - sy * r) * sp;
            if (walkable(P.x + dx, P.z, doorOpen)) P.x += dx;
            if (walkable(P.x, P.z + dz, doorOpen)) P.z += dz;
            walking = true;
          }
          P.place = placeAt(P.x, P.z);
        }
        if (walking) { stepT -= dt; if (stepT <= 0) { snd.loop('int_steps', 0.35); stepT = 0.3; } } else { snd.stop('int_steps'); }
        return walking;
      },
      stop() {
        window.removeEventListener('keydown', onKeyCap, true); window.removeEventListener('keyup', onKeyCap, true);
        ['pointerdown', 'pointerup', 'pointermove'].forEach((t) => window.removeEventListener(t, onPtrCap, true));
        window.removeEventListener('pointerup', onUp); document.removeEventListener('mousemove', onMouse);
      },
    };
  }

  // ---------------------------------------------------------------- the intruder seat
  function start(cabin, opts) {
    opts = opts || {};
    const P = cabin.player, canvas = opts.canvas || document.querySelector('canvas');
    const remoteAtt = !!opts.link;
    const pool = (window.KK && KK.ROLES && (KK.ROLES.saboteur || KK.ROLES.intruder)) || { perFlight: 3, tasks: [] };
    const seed = +opts.seed || 1;
    const rng = window.KK && KK.makeRng ? KK.makeRng((seed * 31 + 3) >>> 0) : { int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)) };
    // the mode sets the clock, how many tasks are dealt and how hard each one hits
    // no mode given (the lobby): the flight code carries it, 1xxx short hop, 2xxx mayday, 3xxx black box
    const fromCode = window.KK && KK.codeMode ? KK.codeMode(seed) : null;
    const mode = opts.mode && window.KK && KK.MODES && KK.MODES[opts.mode] ? opts.mode : fromCode || 'mayday';
    const modeTime = (window.KK && KK.MODES && KK.MODES[mode] && KK.MODES[mode].time) || 420;
    const scale = (pool.effectScale && pool.effectScale[mode]) || modeTime / 240;
    const count = (pool.perMode && pool.perMode[mode]) || pool.perFlight || 4;
    const deck = pool.tasks.slice();
    for (let i = deck.length - 1; i > 0; i--) { const j = rng.int(0, i); const t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
    const tasks = deck.slice(0, count).map((d) => {
      const def = Object.assign({}, d, { effect: -Math.round(-d.effect * scale) });   // e.g. -3 s becomes -5 s in MAYDAY, -8 s in BLACK BOX
      return { def, done: false, prog: 0, presses: 0, last: '', code: 0 };
    });
    const S = { clock: opts.clock || modeTime, mode, scale, tasks, suspicion: 0, done: false, caught: false, door: false, fx: {}, unrest: 0 };

    // ---- HUD
    addStyles();
    const root = opts.hud || document.body;
    const el = (id, cls, html) => { const d = document.createElement('div'); d.id = id; d.className = 'ix ' + (cls || ''); if (html) d.innerHTML = html; root.appendChild(d); return d; };
    const dark = el('ixDark'), smoke = el('ixSmoke'), warn = el('ixWarn');
    const flash = el('ixFlash'); flash.style.cssText = 'inset:0;background:#fff;opacity:0;transition:opacity .15s';
    const vestCanvas = document.createElement('canvas'); vestCanvas.id = 'ixVest'; root.appendChild(vestCanvas);
    const hudTasks = el('ixTasks', 'ix-box', '<div id="ixClock">TIME TO IMPACT <b id="ixClockT">7:00</b></div><div id="ixList"></div>');
    if (window.innerWidth < 1000) hudTasks.classList.add('small');
    const hudSus = el('ixSus', 'ix-box', '<small>SUSPICION</small><div class="ixbar"><i id="ixSusB"></i></div>' + (remoteAtt ? '<small>+ A SECOND FLIGHT ATTENDANT (PLAYER)</small>' : '') + '<small id="ixWhere"></small>');
    const hudAct = el('ixAct', 'ix-box');
    const toastEl = el('ixToast', 'ix-box');
    el('ixCross');
    el('ixHint', 'ix-box', '<b>F</b> stand up · <b>W A S D</b> walk · <b>MOUSE</b> look (click, or drag) · <b>← →</b> turn · <b>E</b> work · <b>Q</b> act natural · <b>M</b> mute');
    const endEl = el('ixEnd', '', '<h1 id="ixEndH"></h1><p id="ixEndP"></p><button id="ixEndB">PLAY AGAIN</button>');
    const $ = (id) => document.getElementById(id);
    $('ixEndB').onclick = () => location.reload();
    const NAMES = { seat: 'ANY SEAT', aisle: 'AISLE', lavatory: 'LAVATORY', galley: 'A GALLEY', door: 'COCKPIT DOOR', cockpit: 'COCKPIT' };
    const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    let cur = null, toastT = 0;
    function paint() {
      $('ixList').innerHTML = tasks.map((t) => '<div class="ixt' + (t.done ? ' done' : '') + (t === cur ? ' here' : '') + '"><h4>' + t.def.title + '<span>' + t.def.effect + ' s</span></h4><p>' + t.def.brief + '</p><em>' + (t.done ? 'DONE' : '▸ ' + (NAMES[t.def.place] || t.def.place)) + '</em></div>').join('');
      cabin.setMarks(tasks.filter((t) => !t.done).map((t) => t.def.place).filter((p) => p !== 'seat'));
    }
    function toast(txt, s) { toastEl.textContent = txt; toastEl.classList.add('show'); toastT = s || 2.6; }

    // ---- the cabin scene: effects and people in 3D
    let W = null, attG = null, remG = null;
    const att = { x: 0, z: 1.1, yaw: Math.PI, dir: 1, wait: 2, mode: 'patrol', moving: false, tackle: false, target: null, seenFor: 0 };
    const rem = { x: 0, z: 9.8, yaw: 0, moving: false, tackle: false, seen: false };
    hookScene(cabin, canvas, (scene) => {
      W = makeWorldFx(scene);
      attG = makePerson(LOOKS.attendant); scene.add(attG);                                   // the AI attendant, always on board
      if (remoteAtt) { remG = makePerson(Object.assign({}, LOOKS.attendant, { scarf: 0x2a7ad4, hair: 0x8a5a2a })); remG.visible = false; scene.add(remG); }   // the player attendant (4 players)
    }, () => {
      if (attG) { attG.position.set(att.x, 0, att.z); attG.rotation.y = att.yaw; }
      if (remG) { remG.visible = rem.seen; remG.position.set(rem.x, 0, rem.z); remG.rotation.y = rem.yaw; }
      updateWorldFx(W, S.fx, performance.now() / 1000);
    });

    // ---- the chest bomb, drawn by its own little renderer on top
    let vest = null, vr = null, vs = null, vc = null;
    if (T) {
      try {
        vr = new T.WebGLRenderer({ canvas: vestCanvas, alpha: true, antialias: true }); vr.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        vs = new T.Scene(); vc = new T.PerspectiveCamera(40, 2, 0.05, 20); vc.position.set(0, 0, 3);
        vs.add(new T.HemisphereLight(0xffffff, 0x334455, 2.0)); const dl = new T.DirectionalLight(0xffffff, 1.4); dl.position.set(1, 2, 3); vs.add(dl);
        const ok = window.KKModels && KKModels.load('intruder_vest', (m) => { vest = KKModels.fit(m, 1.6, 0); vest.children[0].position.y -= 0.8; vs.add(vest); });
        if (!ok) {
          vest = new T.Group();
          for (let i = -1; i <= 1; i++) { const st = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.9, 12), new T.MeshLambertMaterial({ color: 0xc8302a })); st.position.x = i * 0.26; vest.add(st); }
          vs.add(vest);
        }
      } catch (e) { vr = null; }
    }

    // ---- the AI flight attendant (3 players)
    function attAI(dt) {
      const dx = P.x - att.x, dz = P.z - att.z, dist = Math.hypot(dx, dz);
      const hidden = P.place === 'lavatory' || S.fx.blackout > 0;
      if (S.suspicion >= 100 && att.mode !== 'chase') { att.mode = 'chase'; snd.play('att_stop', 0.9); toast('SHE IS COMING FOR YOU · HIDE OR SIT DOWN AND ACT NATURAL', 2.6); }
      if (att.mode === 'chase' && S.suspicion < 60) { att.mode = 'patrol'; toast('SHE LOST INTEREST', 1.6); }
      if (S.fx.calls > 0 && att.mode !== 'chase') att.mode = 'calls';
      else if (att.mode === 'calls') att.mode = 'patrol';
      let tz = null, tx = 0, speed = 0.55;
      if (att.mode === 'chase') { speed = 1.45; tz = hidden && P.place === 'lavatory' ? 9.75 : clamp(P.z, 0.7, 10.2); tx = P.place === 'lavatory' ? -0.3 : 0; }
      else if (att.mode === 'calls') { speed = 1.1; if (!att.target) att.target = Z0 + Math.floor(Math.random() * ROWS) * PITCH; tz = att.target; if (Math.abs(att.z - tz) < 0.1) att.target = Z0 + Math.floor(Math.random() * ROWS) * PITCH; }
      else if (att.wait > 0) att.wait -= dt;
      else { tz = att.dir > 0 ? 9.0 : 1.1; if (Math.abs(att.z - tz) < 0.05) { att.dir = -att.dir; att.wait = 1.5 + Math.random() * 2.5; } }
      if (S.fx.block > 0 && att.z < 4.4 && tz != null && tz > 4.4) tz = 4.35;            // the trolley blocks the aisle
      att.moving = false;
      if (tz != null) {
        const d = tz - att.z;
        if (Math.abs(d) > 0.03) { att.z += Math.sign(d) * Math.min(Math.abs(d), speed * dt); att.yaw = d > 0 ? Math.PI : 0; att.moving = true; }
        att.x += (tx - att.x) * Math.min(1, dt * 3);
      }
      if (att.mode === 'chase' && !hidden && dist < 3) att.yaw = Math.atan2(-dx, -dz);
      // what she notices
      const sees = dist < 3.4 && !hidden;
      const loud = cur && cur.prog > 0 && ((cur.def.input === 'hold' && keys().e) || cur.def.input !== 'hold');
      if (sees && loud) S.suspicion += (cur.def.noise || 0.3) * 34 * dt;
      else if (sees && (P.place === 'door' || P.place === 'cockpit')) S.suspicion += 7 * dt;   // hanging around the cockpit door
      else S.suspicion -= (P.seat && keys().q ? 14 : P.seat ? 6 : 3.5) * dt;
      S.suspicion = clamp(S.suspicion, 0, 100);
      att.tackle = att.mode === 'chase' && dist < 0.8 && !hidden;
      if (att.tackle && S.suspicion >= 60) end(false, 'The flight attendant tackled you in the aisle. The device on your chest never went off.');
    }

    // ---- 4 players: a second flight attendant, played by a person on another screen (Efe's seat)
    let remote = { x: 0, z: 9.8, yaw: 0, moving: false, tackle: false };
    function setAttendant(p) { if (p) { remote = Object.assign(remote, p); rem.seen = true; } }
    if (remoteAtt) opts.link.on((m) => {
      if (m.t === 'pose' && m.who === 'att') setAttendant(m);
      if (m.t === 'caught') end(false, 'The other flight attendant picked you out of the crowd and pinned you down.');
    });
    function remoteStep(dt) { rem.x += (remote.x - rem.x) * Math.min(1, dt * 10); rem.z += (remote.z - rem.z) * Math.min(1, dt * 10); rem.yaw = remote.yaw; rem.moving = remote.moving; rem.tackle = remote.tackle; }

    // ---- controls
    const ctl = fpsControls(cabin, canvas, { done: () => S.done, onPress });
    const keys = () => ctl.keys;
    function onPress(k) {
      if (S.done) return;
      if (k === 'm') { snd.muted = !snd.muted; if (snd.muted) snd.stopAll(); else snd.loop('int_tick', 0.12); toast(snd.muted ? 'SOUND OFF' : 'SOUND ON', 1.2); return; }
      if ((k === 'w' || k === 's' || k === 'a' || k === 'd' || k === 'arrowup' || k === 'arrowdown') && P.seat) toast('YOU ARE SITTING · PRESS F TO STAND UP', 1.8);
      if (k === 'q' && !cur) { toast(P.seat ? 'ACTING NATURAL… (HOLD Q)' : 'SIT DOWN TO ACT NATURAL', 1.2); return; }
      if (!cur) return;
      const d = cur.def;
      if (k === 'q' && d.input === 'hold') { cur.prog = 0; stopTaskSound(); toast('ACTING NATURAL…', 1.2); return; }
      if (d.input === 'mash' && (k === 'q' || k === 'e')) { if (k !== cur.last) { cur.presses++; cur.last = k; cur.prog = cur.presses / (d.seconds * 2) * d.seconds; startTaskSound(); } }
      if (d.input === 'code' && (k === 'q' || k === 'e')) {
        const want = d.code[cur.code].toLowerCase();
        if (k === want) { cur.code++; snd.play('sfx_ui_whoosh', 0.3); cur.prog = cur.code >= d.code.length ? d.seconds : cur.code / d.code.length * d.seconds; startTaskSound(); }
        else { cur.code = 0; cur.prog = 0; S.suspicion = clamp(S.suspicion + 6, 0, 100); snd.play('sfx_task_fail', 0.5); toast('WRONG CODE', 1.0); }
      }
    }
    let taskSound = null;
    function startTaskSound() { if (!taskSound && cur) taskSound = snd.play(cur.def.sound, 0.7); }
    function stopTaskSound() { if (taskSound) { taskSound.pause(); taskSound = null; } }

    // ---- what a finished task does
    function applyFx(t) {
      S.clock = Math.max(0, S.clock + t.def.effect);
      (t.def.fx || []).forEach((f) => {
        if (f.type === 'panic') S.unrest = clamp(S.unrest + (f.amount || 0.3), 0, 1);
        else S.fx[f.type] = Math.max(S.fx[f.type] || 0, f.dur || 8);
        if (f.type === 'blackout') { snd.play('int_blackout', 0.8); setTimeout(() => snd.play('int_v_lights', 0.9), 900); setTimeout(() => snd.play('sfx_pax_gasp', 0.6), 1300); }
        if (f.type === 'smoke') { snd.loop('int_alarm', 0.35); if (W) { W.smoke.userData.x = P.place === 'lavatory' ? -1 : 0.3; W.smoke.userData.z = P.z; } setTimeout(() => snd.play('sfx_cough', 0.5), 2500); }
        if (f.type === 'masks') snd.play('sfx_pax_gasp', 0.7);
        if (f.type === 'door') {
          S.door = true; cabin.setDoor(true);
          if (!tasks.some((x) => x.def.id === 'switch')) {   // a bonus job waits next to the pilot
            tasks.push({ def: { id: 'switch', bonus: true, title: 'FLIP THE PILOT\'S SWITCH', place: 'cockpit', brief: 'Walk into the cockpit while the door is open and flip a switch on the overhead panel behind the pilot\'s back.', input: 'hold', seconds: 3, effect: -Math.round(3 * scale), fx: [{ type: 'turbulence', dur: 6 }], noise: 1, sound: 'sfx_sparks' }, done: false, prog: 0, presses: 0, last: '', code: 0 });
            setTimeout(() => toast('THE COCKPIT DOOR IS OPEN · GET IN BEFORE IT CLOSES', 2.6), 600);
          }
        }
        if (f.type === 'calls') snd.play('int_calls', 0.6);
        if (f.type === 'turbulence') snd.play('sfx_turb_rattle', 0.6);
        if (opts.link) opts.link.send({ t: 'fx', type: f.type, dur: f.dur || 8, amount: f.amount || 0 });
      });
      if (t.def.id === 'emp') plant(W, 'intruder_emp', P.x > 0 ? 1.15 : -1.15, 1.75, P.z, 0.32, true);
      if (t.def.id === 'bomb' && P.seat) plant(W, 'intruder_device', P.seat.x, 0.08, P.seat.z - 0.05, 0.26, true);
      if (t.def.id === 'rumour') snd.play('int_rumour', 0.9);
      snd.play('sfx_task_done', 0.6);
      if (opts.link) opts.link.send({ t: 'task', id: t.def.id, effect: t.def.effect });
      if (opts.onTask) opts.onTask(t.def);
    }

    // ---- main loop
    let last = performance.now(), alive = true, raf = 0, poseT = 0;
    // the flight ends in the cabin: the dive, the screams, the impact. The lobby calls play.crash() / play.land().
    function crash() {
      if (S.crashT || S.done) return;
      S.crashT = 0.001; S.fx.crash = 99; S.fx.masks = Math.max(S.fx.masks || 0, 99);
      snd.play('gpws_pullup', 0.9); snd.play('sfx_engine_fail', 0.8); setTimeout(() => snd.play('sfx_pax_scream', 0.9), 700); snd.loop('int_alarm', 0.4);
      toast('THE AIRCRAFT IS GOING DOWN', 3);
    }
    function land() { end(false, 'The pilot and the tower got the aircraft onto the runway. The device on your chest never went off.', 'THE AIRCRAFT LANDED', false); }
    function end(won, why, title, caught) {
      if (S.done) return; S.done = true; S.caught = caught != null ? caught : !won; stopTaskSound(); snd.stopAll();
      try { document.exitPointerLock(); } catch (e) {}
      $('ixEndH').textContent = title || (won ? 'THE AIRCRAFT IS GOING DOWN' : 'CAUGHT');
      $('ixEndH').style.color = won ? '#ff3b30' : '#3dff8b';
      $('ixEndP').textContent = why;
      endEl.classList.add('show');
      snd.play(won ? 'mus_intruder_win' : 'mus_intruder_caught', 0.8);
      if (!won) { snd.play('sfx_tackle', 0.8); setTimeout(() => snd.play('int_v_caught', 0.9), 400); setTimeout(() => snd.play('att_got', 0.9), 1600); } else setTimeout(() => snd.play('int_v_win', 0.9), 1500);
      if (opts.link) opts.link.send({ t: 'end', won });
      if (opts.onEnd) opts.onEnd({ won, why });
    }
    function frame(now) {
      if (!alive) return; raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (S.done) return;
      const walking = ctl.update(dt, S.door);
      const k = ctl.keys;
      // stepping through the open cockpit door: tell the page and the lobby, so they can switch to Orhun's real cockpit
      const inCk = P.place === 'cockpit';
      if (inCk !== !!S.inCockpit) {
        S.inCockpit = inCk;
        if (opts.onCockpit) opts.onCockpit(inCk);
        if (opts.link) opts.link.send({ t: 'cockpit', in: inCk });
        try { if (window.parent !== window) window.parent.postMessage({ awf: 1, cab: { k: 'cockpit', in: inCk } }, '*'); } catch (e) {}
        if (inCk) { toast('YOU ARE IN THE COCKPIT', 1.6); snd.play('sfx_cockpit_alarm', 0.4); }
      }

      // which task can be done here
      const here = P.seat ? 'seat' : P.place;
      const before = cur;
      cur = tasks.find((t) => !t.done && t.def.place === here) || null;
      if (cur !== before) { stopTaskSound(); paint(); }
      let working = false;
      if (cur) {
        const d = cur.def;
        if (d.input === 'hold' && k.e) { cur.prog += dt; startTaskSound(); }
        working = (d.input === 'hold' && k.e) || (d.input !== 'hold' && cur.prog > 0);
        hudAct.classList.add('show');
        const pct = Math.min(100, cur.prog / d.seconds * 100);
        const how = d.input === 'hold' ? 'HOLD <kbd>E</kbd>' : d.input === 'mash' ? 'ALTERNATE <kbd>Q</kbd><kbd>E</kbd> FAST' : 'TYPE <span class="seq">' + d.code.split('').map((c, i) => '<kbd' + (i < cur.code ? ' class="ok"' : '') + '>' + c + '</kbd>').join('') + '</span>';
        hudAct.innerHTML = '<div style="font-size:18px;letter-spacing:1px">' + how + ' · ' + d.title + '</div><div class="ixbar"><i style="width:' + pct + '%"></i></div>';
        if (cur.prog >= d.seconds) {
          cur.done = true; stopTaskSound(); applyFx(cur);
          toast(d.title + ' · ' + d.effect + ' SECONDS', 2.4);
          cur = null; paint();
          // every job done: the round does NOT end, the intruder stays on board and rides it out with everybody
          if (!S.allDone && tasks.every((t) => t.done || t.def.bonus)) { S.allDone = true; setTimeout(() => { toast('EVERY SABOTAGE IS DONE · NOW RIDE IT DOWN WITH THEM', 3.5); snd.play('int_v_win', 0.9); }, 1500); }
        }
      } else hudAct.classList.remove('show');

      // the flight attendant
      attAI(dt);
      if (remoteAtt) remoteStep(dt);
      if (attG) animPerson(attG, dt, { moving: att.moving, tackle: att.tackle });
      if (remG) animPerson(remG, dt, { moving: rem.moving, tackle: rem.tackle });
      $('ixSusB').style.width = S.suspicion + '%'; hudSus.classList.toggle('hot', S.suspicion > 65);
      const remNear = rem.seen && Math.hypot(P.x - rem.x, P.z - rem.z) < 2.5;
      warn.style.boxShadow = 'inset 0 0 140px rgba(255,40,30,' + (att.mode === 'chase' ? 0.55 : S.suspicion > 65 || remNear ? 0.25 : 0) + ')';
      if (S.suspicion > 65 || remNear) snd.loop('sfx_heartbeat', 0.35); else snd.stop('sfx_heartbeat');
      if (att.mode === 'chase') snd.loop('sfx_run_steps', 0.3); else snd.stop('sfx_run_steps');
      $('ixWhere').textContent = P.seat ? 'SEAT ' + P.seat.id : NAMES[P.place] || '';

      // send our pose to the other screens
      poseT -= dt;
      if (opts.link && poseT <= 0) { poseT = 0.1; opts.link.send({ t: 'pose', who: 'int', x: +P.x.toFixed(2), z: +P.z.toFixed(2), yaw: +P.yaw.toFixed(2), seat: P.seat ? P.seat.id : null, place: P.place, moving: walking, working }); }

      // effects run down
      Object.keys(S.fx).forEach((n) => { S.fx[n] = Math.max(0, S.fx[n] - dt); });
      if (!(S.fx.smoke > 0)) snd.stop('int_alarm');
      if (S.door && !(S.fx.door > 0) && P.z > 0.6) { S.door = false; cabin.setDoor(false); }
      S.unrest = Math.max(0, S.unrest - 0.015 * dt);
      // the last 30 seconds the aircraft shakes harder and harder, and in the dive everything goes
      const dive = S.clock < 30 ? (30 - S.clock) / 30 : 0;
      cabin.setState({ unrest: S.crashT ? 1 : Math.max(S.unrest, dive * 0.8), turb: S.crashT ? 1 : Math.max(S.fx.turbulence > 0 ? 0.85 : 0, dive * 0.7) });
      if (S.crashT) {
        S.crashT += dt;
        S.fx.blackout = Math.random() > 0.75 ? 0.15 : 0;
        P.pitch = clamp(P.pitch - 0.12 * dt, -1.2, 1);   // the nose goes down, the floor tilts
        if (S.crashT > 6.5) {
          flash.style.opacity = 1; snd.play('sfx_explode_big', 1); snd.play('sfx_crash', 0.9);
          setTimeout(() => end(true, S.allDone ? 'Every sabotage worked. Nobody walked away, and nobody ever knew it was the passenger in seat ' + (opts.seat || '7C') + '.' : 'The aircraft went down before the crew could save it.', 'AIRCRAFT LOST · YOU WIN'), 900);
          S.crashT = -1;
        }
      }
      dark.style.opacity = S.fx.blackout > 0 ? (W ? 0.35 : 1) : 0;
      smoke.style.opacity = S.fx.smoke > 0 ? Math.min(W ? 0.3 : 0.6, S.fx.smoke / 8) : 0;

      // the clock and the toast
      S.clock = Math.max(0, S.clock - dt);
      $('ixClockT').textContent = fmt(S.clock); $('ixClockT').className = S.clock < 60 ? 'down' : '';
      if (S.clock <= 0 && !S.crashT) crash();
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
    setTimeout(() => toast((remoteAtt ? 'TWO FLIGHT ATTENDANTS ON BOARD, ONE IS A PLAYER' : 'A FLIGHT ATTENDANT PATROLS THE AISLE') + ' · ' + tasks.length + ' SABOTAGE TASKS', 3), 600);

    return {
      state: S,
      pose: () => ({ x: P.x, z: P.z, yaw: P.yaw, seat: P.seat ? P.seat.id : null, place: P.place, working: !!(cur && cur.prog > 0) }),
      setAttendant,
      caught: () => end(false, 'The flight attendant caught you.'),
      crash, land,   // the lobby: call these when the flight phase becomes 'crashed' / 'landing' instead of stop()
      _att: att,   // for testing: the AI attendant's state
      stop() { alive = false; cancelAnimationFrame(raf); snd.stopAll(); ctl.stop(); },
    };
  }

  /* KKLink: the tiny message pipe the two cabin seats use. Locally it is a BroadcastChannel, so two browser
     tabs on the same computer can play intruder against attendant. In the real game Orhun can replace it with
     the lobby connection: anything with send(obj) and on(fn) works. Messages:
       { t:'pose', who:'int'|'att', x, z, yaw, seat, place, moving, working, tackle }
       { t:'fx', type, dur, amount }   { t:'task', id, effect }   { t:'caught' }   { t:'end', won } */
  const KKLink = {
    local(room) {
      const ch = 'BroadcastChannel' in window ? new BroadcastChannel('awf-cabin-' + (room || 'test')) : null, subs = [];
      if (ch) ch.onmessage = (e) => subs.forEach((f) => { try { f(e.data); } catch (er) { console.error(er); } });
      return { send(m) { if (ch) ch.postMessage(m); }, on(f) { subs.push(f); } };
    },
  };

  window.KKIntruder = { start, walkable, placeAt, util: { snd, hookScene, makePerson, animPerson, LOOKS, makeWorldFx, updateWorldFx, addStyles, fpsControls } };
  window.KKLink = KKLink;
})();
