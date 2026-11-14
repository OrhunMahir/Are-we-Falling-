#!/usr/bin/env python3
"""ARE WE FALLING? - the real cockpit for the two cabin seats (post-jam).
Exact-string replacements in js/cockpit3d.js, js/cabin3d.js, cabin.html, js/net.js and js/game.js.
The new files js/cabin-cockpit.js (and js/cabin-fit.js) are copied next to them, not written by this script.

Usage: python3 patch-cockpit5.py <game folder> [--check]     (the folder that holds index.html, js/, css/)
Every replacement must match exactly once; nothing is written unless all of them match in every file.
A file that already carries the change is left alone, so running it twice does no harm."""
import sys, io, os

root = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else '.'
check = '--check' in sys.argv
R = []        # (file, old, new)
MARK = {}     # file -> a string that is only there once the file is patched

def rep(f, old, new):
    R.append((f, old, new))

# ====================================================================================================== js/cockpit3d.js
CK = 'js/cockpit3d.js'
MARK[CK] = 'function guest(root, lights)'

rep(CK,
"""  let gen = 0, clock = 0, enabled = false, hover = null, maxAniso = 4;
""",
"""  let gen = 0, clock = 0, enabled = false, hover = null, maxAniso = 4;
  let guestMode = false, guestLights = null, guestL = null, storm = null, doorG = null;   // guest mode: this cockpit drawn inside the cabin page, see guest()
""")

# ---------------------------------------------------------------- the aft wall: a doorway for guests, a door that opens for the captain
rep(CK,
"""    B(2.7, 2.7, 0.06, 0, 1.35, 2.79, wall);
    B(0.62, 1.92, 0.03, 0, 0.96, 2.75, lam('#454a51'));    // cockpit door
    B(0.03, 0.12, 0.05, 0.22, 1.0, 2.72, lam('#b9bec5'));
""",
"""    if (guestMode) {   // seen by a cabin seat: a real doorway (the cabin's own door hangs in it), a back for the captain's seat, pedals under the feet
      [-1, 1].forEach((s) => B(1.02, 2.7, 0.06, s * 0.84, 1.35, 2.79, wall)); B(0.66, 0.76, 0.06, 0, 2.32, 2.79, wall);
      B(0.5, 0.7, 0.09, -0.72, 0.8, 0.57, seat);             // (the captain's own view has no seat back: it would hide the left console)
      B(0.46, 0.05, 0.24, -0.72, 0.115, -0.29, dark);
    } else {
      B(2.7, 2.7, 0.06, 0, 1.35, 2.79, wall);
      // the cockpit door swings away into the galley while somebody from the cabin walks in or out (see visitor())
      const wc = document.createElement('canvas'); wc.width = 32; wc.height = 96; const wx = wc.getContext('2d');
      const wg = wx.createLinearGradient(0, 0, 0, 96); wg.addColorStop(0, '#4a4234'); wg.addColorStop(0.12, '#1c2028'); wg.addColorStop(0.75, '#0e1116'); wg.addColorStop(1, '#1a1e2b'); wx.fillStyle = wg; wx.fillRect(0, 0, 32, 96);
      const wt = new T.CanvasTexture(wc); wt.colorSpace = T.SRGBColorSpace;
      const way = new T.Mesh(new T.PlaneGeometry(0.62, 1.92), new T.MeshBasicMaterial({ map: wt })); way.rotation.y = Math.PI; way.position.set(0, 0.96, 2.758); scene.add(way);
      doorG = new T.Group(); doorG.position.set(-0.31, 0, 2.75); scene.add(doorG);
      B(0.62, 1.92, 0.03, 0.31, 0.96, 0, lam('#454a51'), doorG);    // cockpit door
      B(0.03, 0.12, 0.05, 0.53, 1.0, -0.03, lam('#b9bec5'), doorG);
    }
""")

# ---------------------------------------------------------------- lights
rep(CK,
"""    scene.add(new T.AmbientLight(0x9aa6bc, 2.2));
""",
"""    if (guestMode) {   // the host scene has its own ambient light; these three stay inside the cockpit (a range each) and tick() sets how bright they are
      guestL = [[0xffe2b8, 5, 0, 2.3, 0.9, 4.6], [0x9fc0ff, 2.5, 0, 1.5, -0.6, 4], [0xff2a1a, 0, 0, 1.7, -0.3, 4]].map((d) => { const l = new T.PointLight(d[0], 0, d[5], 2); l.position.set(d[2], d[3], d[4]); l.userData.base = d[1]; guestLights.add(l); return l; });
      alarmL = guestL[2];
      return;
    }
    scene.add(new T.AmbientLight(0x9aa6bc, 2.2));
""")

# ---------------------------------------------------------------- build(): no camera to reset for a guest, visitors leave with the old flight
rep(CK,
"""    focus = null; restore = null; stand(false, true); EYE.copy(SEAT); resetView();
""",
"""    focus = null; restore = null; if (!guestMode) { stand(false, true); EYE.copy(SEAT); resetView(); }
    Object.keys(visitors).forEach((r) => { visitors[r].on = false; visitors[r].f.g.visible = false; }); if (doorG) doorG.rotation.y = 0;
""")

rep(CK,
"""    updateHands(dt);
    renderer.render(scene, camera);
""",
"""    updateHands(dt); updateVisitors(dt);
    renderer.render(scene, camera);
""")

# ---------------------------------------------------------------- people, guest mode
rep(CK,
"""  // test / debug helpers
  function screenOf(c) {
""",
"""  // ------------------------------------------------------------------ people
  // The captain as the two cabin seats see them (guest mode), and whoever walks in from the cabin as the captain sees them.
  const LOOKS = {
    pilot: { shirt: '#1a2438', pants: '#1a1d24', skin: '#d9a47c', hair: '#2a1c12', collar: '#eef0f3', tie: '#0c1322', rings: '#d8b24a', headset: '#101214' },
    attendant: { shirt: '#1d2c52', pants: '#1d2c52', skin: '#f0c8a4', hair: '#3a2a1c', scarf: '#d43a3a', bun: true, skirt: true, lips: '#c2283a' },
    saboteur: { shirt: '#3b4252', pants: '#22262e', skin: '#c99872', hair: '#15110e', hood: '#2b303b' },
  };
  const UPPER = 0.31, FORE = 0.3, HIP = 0.87, FIG = 0.94, DOWN = new T.Vector3(0, -1, 0);
  const _g1 = new T.Vector3(), _g2 = new T.Vector3(), _g3 = new T.Vector3(), _g4 = new T.Vector3(), _g5 = new T.Vector3();
  // a blocky person, feet at y 0, looking along -z. Legs and torso hang on the hips; the arms are placed by poseFigure()
  function makeFigure(look) {
    const g = new T.Group(), mats = {}, m = (c) => mats[c] || (mats[c] = lam(c));
    const bx = (w, h, d, x, y, z, c, p) => B(w, h, d, x, y, z, m(c), p);
    const hips = new T.Group(); hips.position.y = HIP; g.add(hips);
    bx(0.35, 0.17, 0.215, 0, 0, 0, look.pants, hips);
    if (look.skirt) bx(0.37, 0.34, 0.25, 0, -0.2, 0, look.shirt, hips);
    const legC = look.skirt ? look.skin : look.pants;
    const legs = [-1, 1].map((s) => {
      const th = new T.Group(); th.position.set(s * 0.088, -0.03, 0); hips.add(th);
      bx(0.145, 0.42, 0.165, 0, -0.21, 0, legC, th);
      const sh = new T.Group(); sh.position.y = -0.42; th.add(sh);
      bx(0.12, 0.4, 0.14, 0, -0.2, 0, legC, sh); bx(0.125, 0.07, 0.25, 0, -0.385, -0.045, '#16181c', sh);
      return { th, sh, swing: 0 };
    });
    const torso = new T.Group(); hips.add(torso);
    bx(look.skirt ? 0.35 : 0.39, 0.5, 0.225, 0, 0.33, 0, look.shirt, torso);
    bx(0.11, 0.08, 0.11, 0, 0.61, 0, look.skin, torso);
    if (look.collar) { bx(0.15, 0.055, 0.02, 0, 0.555, -0.116, look.collar, torso); bx(0.21, 0.035, 0.12, 0, 0.59, 0.045, look.collar, torso); }
    if (look.tie) bx(0.05, 0.26, 0.02, 0, 0.41, -0.119, look.tie, torso);
    if (look.rings) {   // a captain: four gold stripes on each shoulder, wings on the chest
      [-1, 1].forEach((s) => [-0.045, -0.015, 0.015, 0.045].forEach((z) => bx(0.1, 0.012, 0.014, s * 0.145, 0.587, z, look.rings, torso)));
      bx(0.07, 0.02, 0.01, -0.1, 0.47, -0.116, look.rings, torso);
    }
    if (look.scarf) bx(0.2, 0.07, 0.2, 0, 0.6, 0, look.scarf, torso);
    const head = new T.Group(); head.position.y = 0.76; head.rotation.order = 'YXZ'; torso.add(head);
    bx(0.2, 0.23, 0.21, 0, 0, 0, look.skin, head);
    bx(0.22, 0.07, 0.23, 0, 0.115, 0.005, look.hair, head); bx(0.22, 0.17, 0.05, 0, 0.04, 0.095, look.hair, head);
    [-1, 1].forEach((s) => {
      bx(0.034, 0.034, 0.01, s * 0.048, 0.02, -0.106, '#ffffff', head); bx(0.018, 0.024, 0.01, s * 0.048, 0.018, -0.111, '#16181c', head);
      bx(0.05, 0.012, 0.01, s * 0.048, 0.055, -0.108, look.hair, head); bx(0.02, 0.055, 0.045, s * 0.108, 0, 0.005, look.skin, head);
    });
    bx(0.03, 0.04, 0.03, 0, -0.02, -0.115, look.skin, head); bx(0.06, 0.014, 0.01, 0, -0.07, -0.106, look.lips || '#7a3a34', head);
    if (look.headset) { bx(0.246, 0.02, 0.04, 0, 0.158, 0.01, look.headset, head); [-1, 1].forEach((s) => bx(0.032, 0.09, 0.08, s * 0.118, 0.005, 0.01, look.headset, head)); bx(0.012, 0.012, 0.11, -0.12, -0.055, -0.05, look.headset, head); bx(0.03, 0.022, 0.022, -0.1, -0.062, -0.106, look.headset, head); }
    if (look.bun) { bx(0.12, 0.12, 0.09, 0, 0.06, 0.15, look.hair, head); bx(0.22, 0.04, 0.03, 0, 0.1, -0.1, look.hair, head); }
    if (look.hood) { bx(0.25, 0.3, 0.06, 0, 0, 0.115, look.hood, head); bx(0.25, 0.055, 0.25, 0, 0.14, 0, look.hood, head); [-1, 1].forEach((s) => bx(0.03, 0.27, 0.21, s * 0.115, -0.005, 0.02, look.hood, head)); }
    const arms = [-1, 1].map((s) => {
      const up = new T.Group(), fo = new T.Group(); g.add(up); g.add(fo);
      bx(0.1, UPPER, 0.105, 0, -UPPER / 2, 0, look.shirt, up);
      bx(0.09, FORE - 0.08, 0.095, 0, -(FORE - 0.08) / 2, 0, look.shirt, fo); bx(0.08, 0.085, 0.085, 0, -FORE + 0.04, 0, look.skin, fo);
      if (look.rings) { bx(0.094, 0.022, 0.099, 0, -FORE + 0.092, 0, look.collar, fo); [0.125, 0.15].forEach((y) => bx(0.096, 0.012, 0.101, 0, -FORE + y, 0, look.rings, fo)); }
      return { s, up, fo };
    });
    g.scale.setScalar(FIG);
    return { g, hips, torso, head, legs, arms, k: 1, stride: look.skirt ? 0.3 : 0.5 };
  }
  // k: 1 standing .. 0 sitting. hands: where the two hands should be, in the figure's own space; w: how much (0 lets them hang)
  function poseFigure(f, k, hands, w) {
    const sit = 1 - k * k * (3 - 2 * k);
    f.legs.forEach((l) => { l.th.rotation.x = 1.47 * sit + l.swing * (1 - sit); l.sh.rotation.x = -1.27 * sit - Math.max(0, -l.swing) * 0.9 * (1 - sit); });
    f.arms.forEach((arm, i) => {
      const S = _g1.set(arm.s * 0.238, 0.5, 0).applyEuler(f.torso.rotation).add(f.hips.position);
      const to = _g2.set(arm.s * 0.02, -(UPPER + FORE) * 0.985, -0.045 - f.legs[1 - i].swing * 0.16).add(S);   // hanging, swinging against the legs
      if (hands && w > 0) to.lerp(hands[i], Math.min(1, w));
      const dir = _g3.copy(to).sub(S), dist = Math.max(0.1, Math.min(UPPER + FORE - 0.003, dir.length())); dir.normalize();
      const along = (UPPER * UPPER - FORE * FORE + dist * dist) / (2 * dist), out = Math.sqrt(Math.max(0, UPPER * UPPER - along * along));
      const pole = _g4.set(arm.s * 0.55, -0.55, 0.62); pole.addScaledVector(dir, -pole.dot(dir)).normalize();   // the elbow bends outwards, down and back
      const E = _g5.copy(S).addScaledVector(dir, along).addScaledVector(pole, out);
      arm.up.position.copy(S); arm.up.quaternion.setFromUnitVectors(DOWN, _g4.copy(E).sub(S).normalize());
      arm.fo.position.copy(E); arm.fo.quaternion.setFromUnitVectors(DOWN, _g4.copy(S).addScaledVector(dir, dist).sub(E).normalize());
    });
  }

  // ---- the captain in a guest cockpit: hands on the yoke, the head where the real pilot looks (pilot() below), up when they stand up
  let captain = null;
  const cap = { yaw: 0, pitch: -0.2, up: 0, heard: -99, y: 0, p: -0.25, hands: [new T.Vector3(), new T.Vector3()] };
  const SEAT_AT = [-0.72, 0.2], STAND_AT = [-0.52, 1.32];   // standing: a step to the left of where the real pilot stands, so the aisle stays free for the guest
  function updateCaptain(dt) {
    const f = captain; if (!f) return;
    const lost = clock - cap.heard > 4;                    // nothing heard from the real pilot: the eyes wander over the panels
    f.k += Math.max(-dt / 0.95, Math.min(dt / 1.15, (lost ? 0 : cap.up) - f.k));
    const k = f.k, e = k * k * (3 - 2 * k), body = e * Math.PI;   // standing, the captain faces the aft walls
    const ty = lost ? Math.sin(clock * 0.43) * 0.5 + Math.sin(clock * 0.19) * 0.3 : cap.yaw, tp = lost ? -0.3 + Math.sin(clock * 0.31) * 0.15 : cap.pitch;
    cap.y += wrap(ty - cap.y) * Math.min(1, dt * 5); cap.p += (tp - cap.p) * Math.min(1, dt * 5);
    const rel = wrap(cap.y - body), twist = Math.max(-0.55, Math.min(0.55, rel * 0.35)), lean = -0.35 * (1 - e) - Math.sin(k * Math.PI) * 0.2;
    f.g.position.set(SEAT_AT[0] + (STAND_AT[0] - SEAT_AT[0]) * e, 0, SEAT_AT[1] + (STAND_AT[1] - SEAT_AT[1]) * e);
    f.g.rotation.y = body;
    f.hips.position.y = (0.6 / FIG) * (1 - e) + HIP * e + Math.sin(clock * 1.3) * 0.003;
    f.torso.rotation.set(lean, twist, 0);
    f.head.rotation.set(Math.max(-0.7, Math.min(0.6, cap.p * 0.85)) - lean * Math.cos(rel), Math.max(-1.3, Math.min(1.3, rel - twist)), 0);
    f.g.updateWorldMatrix(true, false);
    cap.hands.forEach((h, i) => { h.set((i ? 1 : -1) * 0.18, 0.07, 0.035); yoke.localToWorld(h); f.g.worldToLocal(h); });
    poseFigure(f, k, cap.hands, 1 - e);
  }

  // ---- somebody from the cabin in the captain's own cockpit. They come in through the door. The flight attendant walks up
  // beside the seated captain; the intruder stays in the doorway, and so does she while the captain is on their feet
  // (the captain stands right where she would be). In the doorway a figure covers the door and none of the aft panels.
  const visitors = {};
  const GATE = [0, 2.62, 0], BESIDE = [-0.22, 0.95, 0.58], DOORWAY = [0, 2.5, 0], PAIR = { attendant: [-0.17, 2.38, 0], saboteur: [0.15, 2.58, 0] };   // x, z, facing
  const atDoor = (role) => { const v = visitors[role]; return !!v && v.on && (role === 'saboteur' || !!pose.to); };
  function spotFor(role) {
    if (!visitors[role].on) return GATE;
    if (!atDoor(role)) return BESIDE;
    return atDoor(role === 'saboteur' ? 'attendant' : 'saboteur') ? PAIR[role] : DOORWAY;
  }
  function visitor(role, on) {
    if (guestMode || !renderer || !PAIR[role]) return;
    let v = visitors[role];
    if (!v) { if (!on) return; const f = makeFigure(LOOKS[role]); f.g.visible = false; scene.add(f.g); v = visitors[role] = { f, on: false, x: 0, z: 0, yaw: 0, ph: Math.random() * 6, kiss: 0 }; }
    v.on = !!on;
  }
  function updateVisitors(dt) {
    let open = 0;                                           // the door stands open for as long as somebody from the cabin is in here
    Object.keys(visitors).forEach((role) => {
      const v = visitors[role], f = v.f;
      if (!f.g.visible) {                                   // still outside: they step in once the door has swung open
        if (!v.on) return;
        open = 1; if (doorG && doorG.rotation.y > -1) return;
        v.x = GATE[0]; v.z = GATE[1]; v.yaw = 0; f.g.visible = true;
      }
      open = 1;
      const sp = spotFor(role), dx = sp[0] - v.x, dz = sp[1] - v.z, d = Math.hypot(dx, dz);
      let walk = 0;
      if (d > 0.012) { const s = Math.min(1, 1.3 * dt / d); v.x += dx * s; v.z += dz * s; walk = 1; v.yaw += wrap(Math.atan2(-dx, -dz) - v.yaw) * Math.min(1, dt * 9); }
      else if (!v.on) { f.g.visible = false; return; }
      else v.yaw += wrap(sp[2] - v.yaw) * Math.min(1, dt * 5);
      v.kiss = Math.max(0, v.kiss - dt);
      const kk = Math.sin(Math.min(1, v.kiss / 1.1) * Math.PI), calm = role === 'saboteur' ? 0 : 1;   // kk: leaning in for the kiss
      f.g.position.set(v.x, Math.abs(Math.sin(clock * 9 + v.ph)) * 0.012 * walk, v.z); f.g.rotation.y = v.yaw;
      f.legs.forEach((l, i) => { l.swing = walk * Math.sin(clock * 9 + v.ph + i * Math.PI) * f.stride; });
      f.torso.rotation.set(-0.02 - kk * 0.42 + Math.sin(clock * 1.1 + v.ph) * 0.012, Math.sin(clock * 0.5 + v.ph) * 0.05, 0);
      f.head.rotation.set(-kk * 0.2 - (calm ? 0 : 0.12), Math.sin(clock * 0.37 + v.ph) * (calm ? 0.15 : 0.45), 0);
      poseFigure(f, 1, null, 0);
    });
    if (doorG) doorG.rotation.y += ((open ? -1.4 : 0) - doorG.rotation.y) * Math.min(1, dt * 6);
  }

  // ------------------------------------------------------------------ guest mode
  // The same cockpit inside another page's scene: js/cabin-cockpit.js hangs it behind the cabin's cockpit door for the two
  // cabin seats. No renderer, camera, input, hands or sky of its own: the host draws it and calls tick() every frame.
  function buildStorm() {   // the weather in the windows
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#04060a'); g.addColorStop(0.36, '#0b111b'); g.addColorStop(0.56, '#1c2a3b'); g.addColorStop(0.63, '#27384c'); g.addColorStop(0.67, '#0f151e'); g.addColorStop(1, '#05070a');
    c.fillStyle = g; c.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 150; i++) {
      const dark = i % 3 === 0, x = Math.random() * 1024, y = (dark ? 240 : 170) + Math.random() * 190, r = 26 + Math.random() * 90;
      for (let k = -1; k <= 1; k++) {   // drawn three times so the picture closes around the cylinder
        const q = c.createRadialGradient(x + k * 1024, y, 0, x + k * 1024, y, r); q.addColorStop(0, dark ? 'rgba(2,3,5,0.55)' : 'rgba(86,108,138,0.2)'); q.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = q; c.fillRect(x + k * 1024 - r, y - r, r * 2, r * 2);
      }
    }
    c.strokeStyle = 'rgba(160,180,210,0.05)'; c.lineWidth = 1;
    for (let i = 0; i < 420; i++) { const x = Math.random() * 1024, y = Math.random() * 512, l = 14 + Math.random() * 30; c.beginPath(); c.moveTo(x, y); c.lineTo(x - l * 0.3, y + l); c.stroke(); }
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.wrapS = T.RepeatWrapping;
    const mat = new T.MeshBasicMaterial({ map: tex, side: T.BackSide, fog: false });
    const m = new T.Mesh(new T.CylinderGeometry(14, 14, 16, 40, 1, true, 0.5236, 5.236), mat); m.position.set(0, 2.5, 0); scene.add(m);
    storm = { mat, tex, flash: 0 };
  }
  function guest(root, lights) {
    if (renderer || guestMode || !root) return null;   // one cockpit a page, and never on the captain's own page
    guestMode = true; scene = root; guestLights = lights || root;
    panelGeom = new T.PlaneGeometry(PW * MM, PH * MM);
    boxes = Pool(bake(new T.BoxGeometry(1, 1, 1).translate(0, 0, 0.5)), 7000);
    cyls = Pool(bake(new T.CylinderGeometry(1, 1, 1, 18).rotateX(Math.PI / 2).translate(0, 0, 0.5)), 9000);
    scene.add(boxes.mesh); scene.add(cyls.mesh);
    hl = new T.Object3D(); hl.matrixAutoUpdate = false;   // the hover brackets: nothing is hovered here
    buildSlots(); buildShell(); buildStorm();
    captain = makeFigure(LOOKS.pilot); captain.k = 0; scene.add(captain.g);
    return api;
  }
  // one frame of a guest cockpit. e: { roll, shake, altFt, danger, t, vs, light } (light 0 = nobody can see it: asleep)
  function tick(dt, e) {
    if (!guestMode) return;
    if (e) env = e;
    const lit = env.light == null ? 1 : env.light;
    guestL[0].intensity = guestL[0].userData.base * lit; guestL[1].intensity = guestL[1].userData.base * lit * (1 + storm.flash * 2.5);
    if (!(lit > 0)) { guestL[2].intensity = 0; return; }
    clock += dt;
    guestL[2].intensity = env.danger ? env.danger * 7 * (0.5 + 0.5 * Math.sin(clock * 9)) * lit : 0;
    updateBobble(dt);
    yoke.rotation.z = Math.max(-0.7, Math.min(0.7, -(env.roll || 0) * 3.2 + Math.sin(clock * 2.3) * 0.02));
    storm.flash = Math.max(0, storm.flash - dt * 5); storm.mat.color.setScalar(1 + storm.flash * (Math.random() > 0.35 ? 3 : 1)); storm.tex.offset.x += dt * 0.004;
    for (let i = blinkers.length - 1; i >= 0; i--) { if (blinkers[i].dead) blinkers.splice(i, 1); else blinkers[i].fn(clock); }
    tickers.forEach((t) => { t.acc += dt; if (t.acc >= t.every) { t.acc = 0; t.fn(env, clock); } });
    updateCaptain(dt);
  }

  // test / debug helpers
  function screenOf(c) {
""")

rep(CK,
"""    lightning() { strikeBolt(); },
""",
"""    lightning() { if (guestMode) { if (storm) storm.flash = 1; } else strikeBolt(); },
    guest, tick, visitor,
    // guest mode: where the real pilot looks (view yaw and pitch) and whether they stand
    pilot(s) { if (!s) return; if (s.yaw != null) cap.yaw = +s.yaw || 0; if (s.pitch != null) cap.pitch = +s.pitch || 0; cap.up = s.up ? 1 : 0; cap.heard = clock; },
    kiss() { const v = visitors.attendant; if (v && v.f.g.visible) v.kiss = 1.1; },   // the flight attendant in the cockpit leans in
    figures() { return { captain, visitors }; },
""")

# ====================================================================================================== js/cabin3d.js
CB = 'js/cabin3d.js'
MARK[CB] = 'setPass(v)'

rep(CB,
"""     cabin.setDoor(true)                  cockpit door open or closed
""",
"""     cabin.setDoor(true)                  cockpit door open or closed
     cabin.setPass(true)                  this player may walk through the cockpit door: it opens for them, 'cockpit' becomes a place
     cabin.door()                         how far the cockpit door stands open, 0..1
     cabin.setPeek(false)                 hides the black wall behind the door (js/cabin-cockpit.js puts the real cockpit there)
""")

rep(CB,
"""    lavatory: { x: -1.0, z: 10.0, yaw: H, label: 'LAVATORY' },
  };
""",
"""    lavatory: { x: -1.0, z: 10.0, yaw: H, label: 'LAVATORY' },
    cockpit: { x: -0.3, z: -2.14, yaw: 0.6, pitch: -0.42, label: 'COCKPIT' },   // inside, beside the captain's seat (js/cabin-cockpit.js draws the room)
  };
""")

# the tube and the carpet end at the cockpit wall now: the cockpit begins right behind it
rep(CB,
"""    const shell = new T.Mesh(new T.CylinderGeometry(2, 2, LEN + 0.6, 28, 1, true), new T.MeshLambertMaterial({ color: 0xc9ced2, side: T.BackSide }));
    shell.rotation.x = H; shell.position.set(0, 0.75, LEN / 2); scene.add(shell);
    box(4, 0.04, LEN + 0.6, 0, -0.02, LEN / 2, 0x262c3d);                         // carpet
""",
"""    const shell = new T.Mesh(new T.CylinderGeometry(2, 2, LEN + 0.36, 28, 1, true), new T.MeshLambertMaterial({ color: 0xc9ced2, side: T.BackSide }));
    shell.rotation.x = H; shell.position.set(0, 0.75, LEN / 2 + 0.12); scene.add(shell);   // from the cockpit wall (z -0.06) to the tail
    box(4, 0.04, LEN + 0.36, 0, -0.02, LEN / 2 + 0.12, 0x262c3d);                 // carpet
""")

rep(CB,
"""    box(0.9, 2, 0.02, 0, 1, -0.6, basic(0x05080d));                                 // what you see through the open door
    [[-0.16, 1.2, 0x37c0ff], [0.1, 1.28, 0xffb347], [0.2, 1.12, 0x5dff8a], [-0.05, 1.05, 0xff5a4a]].forEach((d) => box(0.07, 0.04, 0.01, d[0], d[1], -0.58, basic(d[2])));
""",
"""    const peek = [box(0.9, 2, 0.02, 0, 1, -0.6, basic(0x05080d))];                  // what you see through the open door when no cockpit is built behind it
    [[-0.16, 1.2, 0x37c0ff], [0.1, 1.28, 0xffb347], [0.2, 1.12, 0x5dff8a], [-0.05, 1.05, 0xff5a4a]].forEach((d) => peek.push(box(0.07, 0.04, 0.01, d[0], d[1], -0.58, basic(d[2]))));
""")

rep(CB,
"""      if (seatById[at]) return { x: seatById[at].x, z: seatById[at].z, yaw: 0, seated: true };
""",
"""      if (seatById[at]) return { x: seatById[at].x, z: seatById[at].z, yaw: 0, seated: true };
      if (at === 'cockpit') return { x: -0.34, z: -1.25, yaw: -0.35, seated: false };   // the other seat in the cockpit: beside the aisle, so nobody walks through them
""")

rep(CB,
"""    const subs = {};
    const emit = (ev, d) => (subs[ev] || []).forEach((fn) => { try { fn(d); } catch (e) { console.error(e); } });
""",
"""    let pass = false, knock = 0;   // pass: this player may walk through the cockpit door; knock: seconds the door stays open for them
    const subs = {};
    const emit = (ev, d) => (subs[ev] || []).forEach((fn) => { try { fn(d); } catch (e) { console.error(e); } });
""")

rep(CB,
"""      if (!seat && !place) return false;
      if (seat && (seat.taken || seat === P.seat)) return false;
""",
"""      if (!seat && !place) return false;
      if (place === 'cockpit' && !pass) return false;
      if (seat && (seat.taken || seat === P.seat)) return false;
""")

rep(CB,
"""      const d = P.dest || {}; P.seat = d.seat || null; P.place = d.place || placeAt(); P.dest = null; P.hold = 0;
      emit('arrive', at());
    }
    const placeAt = () => (P.x < -0.3 && P.z > 9.3 ? 'lavatory' : P.z < 0.85 ? 'door' : P.z < 1.4 ? 'galley' : 'aisle');
""",
"""      const d = P.dest || {}; P.seat = d.seat || null; P.place = d.place || placeAt(); P.dest = null; P.hold = 0;
      emit('arrive', at());
      if (hover && hover.userData.place) emit('hover', { place: aim(hover.userData.place) });   // at the cockpit door the same click means something else now
    }
    const placeAt = () => (P.x < -0.3 && P.z > 9.3 ? 'lavatory' : P.z < -0.1 ? 'cockpit' : P.z < 0.85 ? 'door' : P.z < 1.4 ? 'galley' : 'aisle');
    const aim = (pl) => (pl === 'door' && pass && !moving() && P.place === 'door' ? 'cockpit' : pl);   // standing at the cockpit door, a click on it walks in
""")

rep(CB,
"""      if (h !== hover) { hover = h; canvas.style.cursor = h ? 'pointer' : 'grab'; emit('hover', h ? (h.userData.seat ? { seat: h.userData.seat.id } : { place: h.userData.place }) : null); }
    };
    const onUp = (e) => { const d = drag; drag = null; if (d && d.moved <= 6) { const h = hit(e); if (h) goTo(h.userData.seat ? h.userData.seat.id : h.userData.place); } };
""",
"""      if (h !== hover) { hover = h; canvas.style.cursor = h ? 'pointer' : 'grab'; emit('hover', h ? (h.userData.seat ? { seat: h.userData.seat.id } : { place: aim(h.userData.place) }) : null); }
    };
    const onUp = (e) => { const d = drag; drag = null; if (d && d.moved <= 6) { const h = hit(e); if (h) goTo(h.userData.seat ? h.userData.seat.id : aim(h.userData.place)); } };
""")

rep(CB,
"""      let heading = null;
      if (moving()) {
        const q = P.path[0], dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz), sp = (Math.abs(dx) > Math.abs(dz) ? 1.1 : 1.9) * dt;
        if (d <= sp) { P.x = q.x; P.z = q.z; P.path.shift(); if (!moving()) arrive(); } else { P.x += dx / d * sp; P.z += dz / d * sp; if (d > 0.25) heading = Math.atan2(-dx, -dz); }
      } else if (!P.seat && Math.abs(P.x) < 0.5 && P.place !== 'lavatory') {
        const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
        if (f) { const before = P.place; P.x = 0; P.z = clamp(P.z - Math.cos(P.yaw) * f * 1.9 * dt, 0.6, 10.3); P.place = placeAt(); if (P.place !== before) { emit('leave', { place: before }); emit('arrive', at()); } }
      }
""",
"""      let heading = null;
      const ajar = -door.rotation.y / 1.45;   // the cockpit door: 0 closed .. 1 open
      if (moving()) {
        const q = P.path[0], dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz), sp = (Math.abs(dx) > Math.abs(dz) ? 1.1 : 1.9) * dt;
        if (pass && q.z < 0.6 && P.z < 1.7) knock = 0.5;                                   // on the way in: the door opens as they come near
        if (q.z < 0.6 && P.z >= 0.6 && P.z < 0.72 && ajar < 0.8) heading = 0;              // and they wait in front of it until it has swung clear
        else if (d <= sp) { P.x = q.x; P.z = q.z; P.path.shift(); if (!moving()) arrive(); } else { P.x += dx / d * sp; P.z += dz / d * sp; if (d > 0.25) heading = Math.atan2(-dx, -dz); }
      } else if (!P.seat && Math.abs(P.x) < 0.5 && P.place !== 'lavatory') {
        const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
        if (f) {
          const before = P.place, step = -Math.cos(P.yaw) * f * 1.9 * dt;
          if (pass && step < 0 && P.z < 0.75) knock = 0.5;                                 // walking at the cockpit door opens it
          P.x = 0; P.z = clamp(P.z + step, pass && (P.z < 0.6 || ajar >= 0.8) ? PLACES.cockpit.z : 0.6, 10.3); P.place = placeAt();
          if (P.place !== before) { emit('leave', { place: before }); emit('arrive', at()); }
        }
      }
""")

rep(CB,
"""      door.rotation.y += ((doorOpen ? -1.45 : 0) - door.rotation.y) * Math.min(1, dt * 5);
      lock.material.color.setHex(doorOpen ? 0x35d06a : 0xff3b30);
""",
"""      knock = Math.max(0, knock - dt);
      const swing = doorOpen || (pass && (knock > 0 || P.z < 0.6));   // cracked open by somebody, or this player is walking through
      door.rotation.y += ((swing ? -1.45 : 0) - door.rotation.y) * Math.min(1, dt * 5);
      lock.material.color.setHex(swing ? 0x35d06a : 0xff3b30);
""")

rep(CB,
"""      if (hover) { const o = hover; glow.visible = true;""",
"""      if (hover && !(hover.userData.place === 'door' && pass && (P.z < 0.6 || (P.dest && P.dest.place === 'cockpit')))) { const o = hover; glow.visible = true;""")   # no highlight on the door while this player walks through it

rep(CB,
"""      setDoor(v) { doorOpen = !!v; },
""",
"""      setDoor(v) { doorOpen = !!v; },
      setPass(v) { pass = !!v; },
      door: () => -door.rotation.y / 1.45,
      setPeek(v) { peek.forEach((m) => { m.visible = !!v; }); },
""")

# ====================================================================================================== cabin.html
CH = 'cabin.html'
MARK[CH] = 'js/cabin-cockpit.js'

rep(CH,
"""<script src="js/cabin3d.js"></script>
<script>
/* The cabin page. Two ways to run it:
""",
"""<script src="js/cabin3d.js"></script>
<script src="js/cabin-fit.js" onerror="void 0"></script>
<script src="js/cabin-cockpit.js" onerror="void 0"></script>
<script>
/* The cabin page. Two ways to run it:
""")

rep(CH,
"""  const up = (m) => { try { if (embed && window.parent !== window) window.parent.postMessage({ awf: 1, cab: m }, '*'); } catch (e) {} };
""",
"""  const up = (m) => { try { if (embed && window.parent !== window) window.parent.postMessage({ awf: 1, cab: m }, '*'); } catch (e) {} };
  // Who may walk into the cockpit. 'crew': the flight attendant at any time, the intruder only while the door stands cracked
  // open (Orhun's call, 14.11.). 'open': both, at any time; try it with cabin.html?cockpit=open, or change the default here.
  const COCKPIT_RULE = q.get('cockpit') === 'open' ? 'open' : 'crew';
""")

rep(CH,
"""  if (!cabin) { $('whereT').textContent = 'NO 3D ON THIS DEVICE'; return; }
""",
"""  if (!cabin) { $('whereT').textContent = 'NO 3D ON THIS DEVICE'; return; }
  const realCockpit = !!(window.__cockpit && cabin.setPass && cabin.places.cockpit);   // js/cabin-cockpit.js is on board: the room behind the door is the pilot's cockpit
""")

rep(CH,
"""      let here = P.seat ? P.seat.id : KKIntruder.placeAt(P.x, P.z); if (here === 'cockpit') here = 'door';
""",
"""      let here = P.seat ? P.seat.id : KKIntruder.placeAt(P.x, P.z); if (here === 'cockpit' && !realCockpit) here = 'door';
      if (COCKPIT_RULE === 'open' && realCockpit && S.fx && !S.done) { S.door = true; S.fx.door = Math.max(S.fx.door || 0, 2); cabin.setDoor(true); }   // 'open': the door never locks for the intruder
""")

rep(CH,
"""  const NAMES = { seat: 'ANY SEAT', aisle: 'AISLE', lavatory: 'LAVATORY', galley: 'GALLEY', door: 'COCKPIT DOOR' };
""",
"""  const NAMES = { seat: 'ANY SEAT', aisle: 'AISLE', lavatory: 'LAVATORY', galley: 'GALLEY', door: 'COCKPIT DOOR', cockpit: 'COCKPIT' };
  // with the real cockpit behind the door, KISS THE PILOT is done in there, beside the captain (its `place` in the pool still says 'door')
  const spotOf = (def) => (realCockpit && def.id === 'kiss' ? 'cockpit' : def.place);
  if (realCockpit) cabin.setPass(role === 'attendant' || COCKPIT_RULE === 'open');
""")

rep(CH,
"""  let clock = embed ? 0 : 420, phase = embed ? 'intro' : 'flight', cur = null, eDown = false, toastT = 0, lastAt = '';
""",
"""  let clock = embed ? 0 : 420, phase = embed ? 'intro' : 'flight', cur = null, eDown = false, toastT = 0, lastAt = '';
  let wasCk = false, crackT = 0, otherIn = false, doorWant = false;   // in the cockpit; the door: cracked open by the intruder (seconds left), the other seat inside
""")

rep(CH,
"""'</p><em>' + (t.done ? 'DONE' : '▸ ' + (NAMES[t.def.place] || esc(t.def.place))) + '</em></div>').join('')
""",
"""'</p><em>' + (t.done ? 'DONE' : '▸ ' + (NAMES[spotOf(t.def)] || esc(spotOf(t.def)))) + '</em></div>').join('')
""")

rep(CH,
"""    cabin.setMarks(tasks.filter((t) => !t.done).map((t) => t.def.place));
""",
"""    cabin.setMarks(tasks.filter((t) => !t.done).map((t) => spotOf(t.def)));
""")

rep(CH,
"""    if (a.place !== 'moving' && here !== lastAt) { lastAt = here; up({ k: 'pos', at: here }); }
    const before = cur;
    cur = phase === 'flight' ? tasks.find((t) => !t.done && t.def.place === a.place) || null : null;
""",
"""    if (a.place !== 'moving' && here !== lastAt) { lastAt = here; up({ k: 'pos', at: here }); }
    const inCk = realCockpit && cabin.player.z < -0.1;   // through the cockpit door: the pilot hears about it and sees who it is
    if (inCk !== wasCk) { wasCk = inCk; up({ k: 'cockpit', in: inCk }); }
    const before = cur;
    cur = phase === 'flight' ? tasks.find((t) => !t.done && spotOf(t.def) === a.place) || null : null;
""")

rep(CH,
"""    up({ k: 'task', id: t.def.id, title: t.def.title, effect: t.def.effect, fx });
    cur = null; paint(); where();
""",
"""    up({ k: 'task', id: t.def.id, title: t.def.title, effect: t.def.effect, fx });
    if ((t.def.clears || []).indexOf('door') >= 0) crackT = 0;   // locked again
    cur = null; paint(); where();
""")

rep(CH,
"""  cabin.on('hover', (h) => { $('hoverT').textContent = !h ? '' : h.seat ? 'CLICK: SIT IN ' + h.seat : 'CLICK: GO TO THE ' + NAMES[h.place]; });
""",
"""  cabin.on('hover', (h) => { $('hoverT').textContent = !h ? '' : h.seat ? 'CLICK: SIT IN ' + h.seat : h.place === 'cockpit' ? 'CLICK: STEP INTO THE COCKPIT' : 'CLICK: GO TO THE ' + NAMES[h.place]; });
""")

rep(CH,
"""    const t = def && openTask(def.id);
    if (t) toast((label || 'TROUBLE IN THE CABIN') + ' · ' + def.title);
""",
"""    const t = def && openTask(def.id);
    if (t && (def.clears || []).indexOf('door') >= 0) crackT = 12;   // the cockpit door stands open, as long as it does on the intruder's screen
    if (t) toast((label || 'TROUBLE IN THE CABIN') + ' · ' + def.title);
""")

rep(CH,
"""      if (d.cab.k === 'pos' && d.cab.at) cabin.setActor('other', { role: d.cab.role, at: d.cab.at });
""",
"""      if (d.cab.k === 'pos' && d.cab.at) { cabin.setActor('other', { role: d.cab.role, at: d.cab.at }); otherIn = d.cab.at === 'cockpit'; }
""")

rep(CH,
"""    where(); faults(dt);
""",
"""    where(); faults(dt);
    crackT = Math.max(0, crackT - dt);
    if ((crackT > 0 || otherIn) !== doorWant) { doorWant = !doorWant; cabin.setDoor(doorWant); }
    if (realCockpit && role !== 'attendant' && COCKPIT_RULE !== 'open') cabin.setPass(cabin.door() > 0.5 || cabin.player.z < 0.6);   // anybody else gets in only through an open door
""")

# ====================================================================================================== js/net.js (on top of the lobby fix)
NT = 'js/net.js'
MARK[NT] = 'kk().cabinCockpit(!!d.in, d.role)'

rep(NT,
"""    } else if (d.k === 'cockpit' && d.role === 'saboteur') {   // the intruder walked through the open cockpit door, or left again
      if (myRole() === 'pilot') { if (kk() && kk().cabinCockpit) kk().cabinCockpit(!!d.in); }
      else if (myRole() === 'tower') toast(d.in ? 'SOMEONE IS IN THE COCKPIT' : 'THE COCKPIT IS CLEAR AGAIN', 5000);
    }
""",
"""    } else if (d.k === 'cockpit') {   // a cabin seat walked through the cockpit door, or left again: the pilot sees who stands behind them
      if (myRole() === 'pilot') { if (kk() && kk().cabinCockpit) kk().cabinCockpit(!!d.in, d.role); }
      else if (myRole() === 'tower' && d.role === 'saboteur') toast(d.in ? 'SOMEONE IS IN THE COCKPIT' : 'THE COCKPIT IS CLEAR AGAIN', 5000);
    }
""")

rep(NT,
"""    if (!G) { N.flying = false; N.inGame = false; act({ t: 'st', ph: 'lobby' }); showView('room'); return; }
    act({ t: 'st', f: G.flight.seed,""",
"""    if (!G) { N.flying = false; N.inGame = false; act({ t: 'st', ph: 'lobby' }); showView('room'); return; }
    const K3 = kk().K3 || {}, vw = K3.view || {};   // vy, vp, up: where the pilot looks and whether they stand; the cabin seats see the captain do the same
    act({ t: 'st', vy: +(+vw.yaw || 0).toFixed(2), vp: +(+vw.pitch || 0).toFixed(2), up: K3.pose && K3.pose.to ? 1 : 0, f: G.flight.seed,""")

# ====================================================================================================== js/game.js
GM = 'js/game.js'
MARK[GM] = 'function cabinCockpit(inside, role)'

rep(GM,
"""    if (sab) A.sfx.warn(); else A.sfx.chime();
""",
"""    if (sab) A.sfx.warn(); else A.sfx.chime();
    if (!sab && d.id === 'KISS') K3.kiss();   // if the flight attendant stands in the cockpit, they lean in
""")

rep(GM,
"""  // the intruder walked into the cockpit through the open door (or left again): the pilot hears about it
  function cabinCockpit(inside) {
    if (!G || G.phase !== 'flight') return;
    if (inside) { A.sfx.warn(); subtitle('SOMEONE IS IN THE COCKPIT', 4200); log('Somebody came through the cockpit door.'); }
    else log('The cockpit is clear again.');
  }
""",
"""  // a cabin seat walked into the cockpit through the door (or left again): the pilot hears about it, and finds them standing there
  function cabinCockpit(inside, role) {
    const who = role === 'attendant' ? 'attendant' : 'saboteur', flying = !!G && G.phase === 'flight', on = !!inside && flying;
    K3.visitor(who, on);
    if (!flying) return;
    const seen = G.guests || (G.guests = {}); if (!!seen[who] === on) return; seen[who] = on;   // only a change is news
    if (who === 'attendant') { if (on) { A.sfx.click(); subtitle('THE FLIGHT ATTENDANT STEPS INTO THE COCKPIT', 3200); log('The flight attendant came into the cockpit.'); } else log('The flight attendant went back to the cabin.'); return; }
    if (on) { A.sfx.warn(); subtitle('SOMEONE IS IN THE COCKPIT', 4200); log('Somebody came through the cockpit door.'); }
    else log('The cockpit is clear again.');
  }
""")

# ====================================================================================================== apply
def main():
    files = {}
    for f, old, new in R:
        if f not in files:
            p = os.path.join(root, f)
            if not os.path.isfile(p):
                print('MISSING', p); return 2
            files[f] = io.open(p, encoding='utf-8', newline='').read()
    done = set(f for f in files if MARK.get(f) and MARK[f] in files[f])
    out = dict(files)
    bad = 0
    for f, old, new in R:
        if f in done:
            continue
        n = out[f].count(old)
        if n != 1:
            bad += 1
            print('NO MATCH (%d) in %s: %r' % (n, f, old[:90]))
            continue
        out[f] = out[f].replace(old, new)
    if bad:
        print('nothing written: %d replacement(s) did not match' % bad); return 1
    for f in sorted(files):
        if f in done:
            print('already patched, left alone:', f)
        elif check:
            print('would patch:', f)
        else:
            io.open(os.path.join(root, f), 'w', encoding='utf-8', newline='').write(out[f])
            print('patched:', f)
    return 0

if __name__ == '__main__':
    sys.exit(main())
