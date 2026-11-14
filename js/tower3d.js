/* ARE WE FALLING? — the tower player's room: a control tower cab in 3D behind the handbook.
   Through the windows: the storm, the runway lights and, after a while, the aircraft itself. */
(function () {
  'use strict';
  const T = window.THREE;
  // start(canvas, opts): opts.view 'tower' (default) is the controller's seat in the cab;
  // 'outside' films the same scene from outside cameras (chase, runway side, tower) for end screens.
  function start(canvas, opts) {
    if (!T) return null;
    const OUT = !!(opts && opts.view === 'outside');
    let renderer;
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const scene = new T.Scene(); scene.fog = new T.Fog(0x141a24, 900, 5200);
    const camera = new T.PerspectiveCamera(58, 16 / 9, 0.1, 9000);
    const EYE = new T.Vector3(0, 31.5, 0); camera.position.copy(EYE);
    const lam = (c, e) => new T.MeshLambertMaterial({ color: c, emissive: e || 0x000000 });
    const basic = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
    const box = (w, h, d, x, y, z, m, parent) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); (parent || scene).add(b); return b; };

    // ---------------- sky
    const sc = document.createElement('canvas'); sc.width = 8; sc.height = 512; const sx = sc.getContext('2d');
    const gr = sx.createLinearGradient(0, 0, 0, 512);
    [[0, '#05080f'], [0.3, '#101826'], [0.44, '#27303f'], [0.485, '#5a4048'], [0.497, '#d9813f'], [0.502, '#3a2620'], [0.52, '#0b0d10'], [1, '#050607']].forEach((s) => gr.addColorStop(s[0], s[1]));
    sx.fillStyle = gr; sx.fillRect(0, 0, 8, 512);
    const skyTex = new T.CanvasTexture(sc); skyTex.colorSpace = T.SRGBColorSpace;
    const skyMat = new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false });
    const sky = new T.Mesh(new T.SphereGeometry(7000, 24, 16), skyMat); sky.position.y = 30; scene.add(sky);
    const puff = (inner, outer) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
    const cloudTex = puff('rgba(70,80,98,0.85)', 'rgba(40,48,62,0)');
    const clouds = [];
    for (let i = 0; i < 46; i++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.55 + Math.random() * 0.35, depthWrite: false, fog: false }));
      const a = (Math.random() - 0.5) * 2.6, d = 1800 + Math.random() * 3200;
      sp.position.set(Math.sin(a) * d, 420 + Math.random() * 900, -Math.cos(a) * d); const s = 500 + Math.random() * 900; sp.scale.set(s * 1.9, s * 0.62, 1);
      sp.userData.v = 4 + Math.random() * 8; scene.add(sp); clouds.push(sp);
    }

    // ---------------- airfield
    const ground = new T.Mesh(new T.PlaneGeometry(14000, 14000), basic(0x0a0d0f)); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const A = new T.Vector3(380, 0, -760), B = new T.Vector3(-520, 0, -170);          // runway: far threshold A, near end B
    const dir = new T.Vector3().subVectors(B, A).normalize(), side = new T.Vector3(-dir.z, 0, dir.x), rwLen = A.distanceTo(B);
    const rw = new T.Mesh(new T.PlaneGeometry(rwLen + 60, 46), basic(0x191b1e)); rw.rotation.x = -Math.PI / 2; rw.rotation.z = Math.atan2(-dir.z, dir.x);
    rw.position.copy(A).add(B).multiplyScalar(0.5); rw.position.y = 0.05; scene.add(rw);
    const pts = [], cols = []; const lightAt = (v, y, c) => { pts.push(v.x, y, v.z); cols.push(c[0], c[1], c[2]); };
    const W = [1, 0.95, 0.8], G = [0.2, 1, 0.45], R = [1, 0.15, 0.1], BL = [0.25, 0.45, 1], AM = [1, 0.65, 0.15], _t = new T.Vector3();
    for (let d = 0; d <= rwLen; d += 55) [-1, 1].forEach((s) => lightAt(_t.copy(A).addScaledVector(dir, d).addScaledVector(side, s * 24), 0.8, d > rwLen - 280 ? AM : W));
    for (let k = -4; k <= 4; k++) { lightAt(_t.copy(A).addScaledVector(side, k * 5.5), 0.8, G); lightAt(_t.copy(B).addScaledVector(side, k * 5.5), 0.8, R); }
    for (let d = 60; d <= 720; d += 60) for (let k = -2; k <= 2; k++) lightAt(_t.copy(A).addScaledVector(dir, -d).addScaledVector(side, k * 6 * (d > 400 ? 0.4 : 1)), 1.2, W);   // approach lights
    for (let d = 0; d <= rwLen; d += 40) lightAt(_t.copy(A).addScaledVector(dir, d).addScaledVector(side, 150 + Math.sin(d * 0.004) * 30), 0.5, BL);     // taxiway
    for (let k = 0; k < 4; k++) lightAt(_t.copy(A).addScaledVector(dir, 90).addScaledVector(side, -40 - k * 7), 1, k < 2 ? R : W);                    // PAPI
    for (let i = 0; i < 260; i++) { const a = (Math.random() - 0.5) * 2.9, d = 2400 + Math.random() * 3200; pts.push(Math.sin(a) * d, 2 + Math.random() * 30, -Math.cos(a) * d); const c = Math.random() < 0.7 ? AM : W; cols.push(c[0] * 0.8, c[1] * 0.8, c[2] * 0.8); }   // far town
    const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); pg.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    const glow = puff('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    scene.add(new T.Points(pg, new T.PointsMaterial({ size: 9, map: glow, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, fog: false, blending: T.AdditiveBlending })));
    // hangars and apron
    for (let i = 0; i < 5; i++) { const h = box(70 + Math.random() * 40, 16 + Math.random() * 10, 46, -260 + i * 120, 9, -95 - Math.random() * 20, lam(0x20252c)); box(30, 4, 0.6, h.position.x, 7, h.position.z - 23.5, basic(0xffc46a)); }

    // ---------------- the cab around the viewer
    const cab = new T.Group(); cab.position.set(0, 30, 0); scene.add(cab);
    const frameM = lam(0x15181c), desk = lam(0x23282f);
    for (let i = -3; i <= 3; i++) { const m = box(0.09, 2.0, 0.09, i * 1.5, 1.95, -2.3 + Math.abs(i) * 0.16, frameM, cab); m.rotation.z = 0; }
    box(11, 0.5, 0.3, 0, 3.15, -2.2, frameM, cab); box(11, 0.14, 0.34, 0, 0.98, -2.2, frameM, cab); box(11, 0.1, 4, 0, 3.4, -0.6, frameM, cab);
    const glass = new T.Mesh(new T.PlaneGeometry(11, 2.1), new T.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.045, depthWrite: false })); glass.position.set(0, 2.0, -2.25); cab.add(glass);
    box(11, 0.84, 1.3, 0, 0.42, -1.7, desk, cab);   // console body under the one wooden desk top (see the writing desk below)
    const back = box(11, 0.3, 0.08, 0, 1.06, -2.28, desk, cab); back.rotation.x = -0.5;
    // radar scope
    const rc = document.createElement('canvas'); rc.width = rc.height = 256; const rx = rc.getContext('2d');
    rx.fillStyle = '#04150c'; rx.beginPath(); rx.arc(128, 128, 126, 0, 7); rx.fill(); rx.strokeStyle = '#1f8a4c'; rx.lineWidth = 2;
    [40, 80, 120].forEach((r) => { rx.beginPath(); rx.arc(128, 128, r, 0, 7); rx.stroke(); }); rx.beginPath(); rx.moveTo(8, 128); rx.lineTo(248, 128); rx.moveTo(128, 8); rx.lineTo(128, 248); rx.stroke();
    const rtex = new T.CanvasTexture(rc); rtex.colorSpace = T.SRGBColorSpace;
    const scope = new T.Mesh(new T.CircleGeometry(0.2, 40), basic(0xffffff, { map: rtex })); scope.rotation.x = -Math.PI / 2; scope.position.set(-2.05, 0.912, -1.62); cab.add(scope);
    const sweep = new T.Mesh(new T.PlaneGeometry(0.2, 0.012).translate(0.1, 0, 0), basic(0x6dffa6, { transparent: true, opacity: 0.9 })); sweep.rotation.x = -Math.PI / 2; sweep.position.set(-2.05, 0.914, -1.62); cab.add(sweep);
    const blip = new T.Mesh(new T.CircleGeometry(0.008, 10), basic(0xbfffd6)); blip.rotation.x = -Math.PI / 2; blip.position.set(-2.05, 0.915, -1.62); cab.add(blip);
    box(0.5, 0.02, 0.5, -2.05, 0.9, -1.62, lam(0x111417), cab);
    // lit keys, binders, mug, lamp, handset
    const keyCols = [0xffb224, 0x39d98a, 0x3d8bff, 0xff4a3a, 0xf1f3f5];
    for (let i = 0; i < 24; i++) box(0.05, 0.02, 0.04, 1.75 + (i % 8) * 0.075, 0.912 + Math.floor(i / 8) * 0.004, -1.55 - Math.floor(i / 8) * 0.07, basic(Math.random() < 0.45 ? keyCols[i % 5] : 0x30363e), cab);
    [0xb23a2e, 0x2d6fb5, 0x3a8f4f, 0xc9a54a].forEach((c, i) => { const b = box(0.07, 0.3, 0.24, -3.0 - i * 0.085, 1.05, -1.75, lam(c), cab); b.rotation.z = i === 3 ? 0.18 : 0; box(0.072, 0.07, 0.01, b.position.x, 1.07, -1.628, lam(0xefe6cf), cab); });
    const mug = new T.Mesh(new T.CylinderGeometry(0.045, 0.04, 0.1, 16), lam(0xe8e2d2)); mug.position.set(2.75, 0.95, -1.4); cab.add(mug);
    const coffee = new T.Mesh(new T.CircleGeometry(0.04, 16), basic(0x2a1608)); coffee.rotation.x = -Math.PI / 2; coffee.position.set(2.75, 0.999, -1.4); cab.add(coffee);
    box(0.03, 0.4, 0.03, 3.3, 1.1, -1.9, lam(0x101214), cab); const shade = new T.Mesh(new T.ConeGeometry(0.13, 0.14, 16, 1, true), new T.MeshLambertMaterial({ color: 0x2f7d57, emissive: 0x0d2a1c, side: T.DoubleSide })); shade.position.set(3.2, 1.31, -1.8); cab.add(shade);
    const lamp = new T.PointLight(0xffc98a, 2.2, 6, 1.6); lamp.position.set(3.2, 1.25, -1.75); cab.add(lamp);
    box(0.34, 0.01, 0.24, 0, 0.905, -1.45, lam(0xe9e3d0), cab);   // flight strips, seen when the folder is put down
    box(0.5, 0.02, 0.18, 0.75, 0.91, -1.4, lam(0x16191d), cab);
    // ---------------- the writing desk right under the viewer: the handbook lies here
    const dc = document.createElement('canvas'); dc.width = dc.height = 512; const dx = dc.getContext('2d');
    dx.fillStyle = '#3a2c20'; dx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) { const y = Math.random() * 512; dx.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '20,12,6' : '120,90,60') + ',' + (0.05 + Math.random() * 0.12) + ')'; dx.lineWidth = 0.6 + Math.random() * 2.2; dx.beginPath(); dx.moveTo(0, y); dx.bezierCurveTo(170, y + (Math.random() - 0.5) * 14, 340, y + (Math.random() - 0.5) * 14, 512, y + (Math.random() - 0.5) * 8); dx.stroke(); }
    const dtex = new T.CanvasTexture(dc); dtex.colorSpace = T.SRGBColorSpace; dtex.wrapS = dtex.wrapT = T.RepeatWrapping; dtex.repeat.set(5, 1.2);
    const wood = new T.MeshLambertMaterial({ color: 0xffffff, map: dtex });
    box(11, 0.06, 3.05, 0, 0.87, -0.775, wood, cab);   // one desk top from the window to the viewer
    const deskL = new T.PointLight(0xffd9a0, 2.6, 5, 1.3); deskL.position.set(0.9, 1.75, -0.7); cab.add(deskL);
    // things around the handbook
    const mug2 = new T.Mesh(new T.CylinderGeometry(0.05, 0.043, 0.1, 20), lam(0xb8332a)); mug2.position.set(1.0, 0.95, -0.82); cab.add(mug2);
    const cof2 = new T.Mesh(new T.CircleGeometry(0.044, 20), basic(0x24130a)); cof2.rotation.x = -Math.PI / 2; cof2.position.set(1.0, 0.999, -0.82); cab.add(cof2);
    const hd = new T.Mesh(new T.TorusGeometry(0.03, 0.009, 8, 16, Math.PI), lam(0xb8332a)); hd.position.set(1.06, 0.95, -0.82); hd.rotation.z = -Math.PI / 2; cab.add(hd);
    const pen = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.2, 8), lam(0x1d4f9c)); pen.rotation.set(Math.PI / 2, 0, 0.5); pen.position.set(-0.98, 0.908, -0.35); cab.add(pen);
    const pencil = new T.Mesh(new T.CylinderGeometry(0.007, 0.007, 0.22, 6), lam(0xe0b21a)); pencil.rotation.set(Math.PI / 2, 0, -0.25); pencil.position.set(-1.05, 0.908, -0.5); cab.add(pencil);
    [[-0.95, -0.9, 0.12, 0xf3e9a6], [-1.1, -0.84, -0.2, 0xffb0c0], [0.98, -0.45, 0.08, 0xe9e3d0]].forEach((n) => { const b = box(0.16, 0.004, 0.16, n[0], 0.903, n[1], lam(n[3]), cab); b.rotation.y = n[2]; });
    for (let i = 0; i < 14; i++) box(0.07, 0.022, 0.05, -0.6 + (i % 7) * 0.2, 0.912, -1.0 - Math.floor(i / 7) * 0.07, basic(Math.random() < 0.55 ? keyCols[i % 5] : 0x30363e), cab);
    box(1.5, 0.02, 0.2, 0, 0.9, -1.03, lam(0x14171b), cab);
    const DESK = new T.Vector3(0, 31.78, 0.1), DESK_PITCH = -68 * Math.PI / 180;
    scene.add(new T.AmbientLight(0x8fa3c8, 1.5));
    const flash = new T.AmbientLight(0xcfe0ff, 0); scene.add(flash);
    const bolt = new T.Line(new T.BufferGeometry().setFromPoints(new Array(9).fill(0).map(() => new T.Vector3())), new T.LineBasicMaterial({ color: 0xeaf2ff, fog: false })); bolt.visible = false; scene.add(bolt);

    // ---------------- the aircraft
    const plane = new T.Group(); scene.add(plane);
    const body = lam(0xe6eaf0, 0x767c86), dark = lam(0x4a525e, 0x23272e);
    const fus = new T.Mesh(new T.CylinderGeometry(2.1, 2.1, 34, 14).rotateX(Math.PI / 2), body); plane.add(fus);
    const nose = new T.Mesh(new T.SphereGeometry(2.1, 14, 10), body); nose.scale.z = 2.2; nose.position.z = -17; plane.add(nose);
    const tail = new T.Mesh(new T.ConeGeometry(2.1, 9, 14).rotateX(-Math.PI / 2), body); tail.position.z = 21.5; plane.add(tail);
    const wing = box(38, 0.5, 6, 0, -0.6, 1, body, plane); wing.rotation.y = 0;
    box(13, 0.4, 3.4, 0, 0.6, 21, body, plane); const fin = box(0.5, 7.5, 5, 0, 4.2, 21, lam(0xe85d00, 0x5a2400), plane); fin.rotation.x = -0.35;
    [-1, 1].forEach((s) => { const e = new T.Mesh(new T.CylinderGeometry(1.25, 1.1, 5.5, 12).rotateX(Math.PI / 2), dark); e.position.set(s * 8.5, -2.1, -1.5); plane.add(e); });
    if (window.KKModels && KKModels.has('airliner')) { const made = plane.children.slice(); KKModels.load('airliner', (m) => { const g = KKModels.fit(m, 46, -Math.PI / 2); g.position.y = -6; m.traverse((o) => { if (o.material && o.material.color) o.material.color.multiplyScalar(0.62); }); plane.add(g); made.forEach((c) => { c.visible = false; }); }); }
    const mkGlow = (c, s) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: glow, color: c, transparent: true, depthWrite: false, fog: false, blending: T.AdditiveBlending })); sp.scale.set(s, s, 1); return sp; };
    const navR = mkGlow(0xff2a1a, 6), navG = mkGlow(0x2aff6a, 6), strobe = mkGlow(0xffffff, 11), landL = mkGlow(0xfff2c4, 15), fire = mkGlow(0xff7a1a, 26);
    navR.position.set(-19, -0.4, 1); navG.position.set(19, -0.4, 1); strobe.position.set(0, 3, 6); landL.position.set(0, -1.5, -19); fire.position.set(8.5, -2, 2);
    plane.add(navR, navG, strobe, landL, fire);
    plane.scale.setScalar(3.2); plane.visible = false; plane.rotation.order = 'YXZ';
    // the tower itself, only seen from the outside cameras
    const shaft = new T.Mesh(new T.CylinderGeometry(3.4, 4.2, 30, 20), lam(0x3a3f47)); shaft.position.set(0, 15, -0.5); scene.add(shaft);
    const shell = new T.Group(); shell.visible = OUT; cab.add(shell);
    box(12.4, 0.45, 5.4, 0, 3.75, -0.6, lam(0x23272d), shell); box(12.4, 0.5, 5.4, 0, -0.2, -0.6, lam(0x2c3138), shell);
    const tint = new T.MeshBasicMaterial({ color: 0x1c2a3a, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false });
    [[0, 1.75, 1.95, 12, 0], [-6.1, 1.75, -0.6, 5.2, Math.PI / 2], [6.1, 1.75, -0.6, 5.2, Math.PI / 2]].forEach((g) => { const m = new T.Mesh(new T.PlaneGeometry(g[3], 3.5), tint); m.position.set(g[0], g[1], g[2]); m.rotation.y = g[4]; shell.add(m); });
    const beacon = mkGlow(0xff2a1a, 3); beacon.position.set(0, 4.3, -0.6); shell.add(beacon);
    const smokeTexD = puff('rgba(28,26,26,0.9)', 'rgba(20,20,20,0)'), smokeTexL = puff('rgba(200,205,212,0.55)', 'rgba(180,186,194,0)');
    const smoke = [];
    for (let i = 0; i < 150; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: smokeTexD, transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; sp.userData = { life: 0 }; scene.add(sp); smoke.push(sp); }
    const wreck = mkGlow(0xff6a1a, 10); wreck.visible = false; scene.add(wreck);
    const wreckL = new T.PointLight(0xff6a1a, 0, 0, 1.2); scene.add(wreckL);

    // ---------------- the impact on the cab: flying glass, fire on the desk, smoke, shaking, the screen going dark
    const shardGeo = new T.BufferGeometry(); shardGeo.setAttribute('position', new T.Float32BufferAttribute([-0.5, -0.4, 0, 0.55, -0.2, 0, -0.1, 0.6, 0], 3));
    const shards = [];
    for (let i = 0; i < 70; i++) {
      const m = new T.Mesh(shardGeo, new T.MeshBasicMaterial({ color: 0xd8ecff, transparent: true, opacity: 0.75, side: T.DoubleSide, depthWrite: false }));
      m.visible = false; m.userData = { v: new T.Vector3(), w: new T.Vector3() }; cab.add(m); shards.push(m);
    }
    const cabFires = [];
    for (let i = 0; i < 9; i++) { const f = mkGlow(i % 3 ? 0xff5a14 : 0xffb43a, 1); f.visible = false; f.userData = { x: -4.6 + i * 1.15 + (Math.random() - 0.5) * 0.5, y: 1.15 + Math.random() * 0.9, z: -2.0 + Math.random() * 0.5, s: 1.6 + Math.random() * 1.8, ph: Math.random() * 7 }; f.position.set(f.userData.x, f.userData.y, f.userData.z); cab.add(f); cabFires.push(f); }
    const cabFireL = new T.PointLight(0xff7a2a, 0, 14, 1.4); cabFireL.position.set(0, 1.8, -1.6); cab.add(cabFireL);
    const fade = new T.Mesh(new T.PlaneGeometry(4, 4), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
    fade.position.z = -0.2; fade.renderOrder = 999; camera.add(fade); scene.add(camera);
    box(11, 0.04, 6, 0, 0, -0.4, lam(0x1b1d21), cab);   // cab floor, seen when the controller goes down
    // screen overlays in front of the camera: glass stuck in the "eyes" (cracks and shards) and blood running down
    function overlay(order) {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 576; const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
      const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
      m.position.z = -0.21; m.renderOrder = order; m.visible = false; camera.add(m); return { c, x: c.getContext('2d'), tex, m };
    }
    const crackL = overlay(998), bloodL = overlay(997);
    let wounds = [], drips = [];
    function fitOverlays() {   // cover the whole view whatever the window shape
      const h = 2 * 0.21 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)), w = h * camera.aspect;
      crackL.m.scale.set(w, h, 1); bloodL.m.scale.set(w, h, 1);
    }
    function glassHits() {   // a few shards hit the face: cracks round each one, then they start to bleed
      const x = crackL.x; x.clearRect(0, 0, 1024, 576); wounds = [];
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2, r = 0.45 + Math.random() * 0.5;        // keep the middle of the view a little clearer
        const px = 512 + Math.cos(a) * r * 470, py = 288 + Math.sin(a) * r * 260, sz = 18 + Math.random() * 34;
        wounds.push({ x: px, y: py + sz * 0.5, s: sz });
        x.strokeStyle = 'rgba(235,245,255,0.75)'; x.lineWidth = 1.4;
        for (let k = 0; k < 9; k++) {                                                   // cracks running out of the hit
          let cx = px, cy = py; const ca = Math.random() * Math.PI * 2; x.beginPath(); x.moveTo(cx, cy);
          for (let seg = 0; seg < 4; seg++) { cx += Math.cos(ca + (Math.random() - 0.5) * 0.8) * (14 + Math.random() * 30); cy += Math.sin(ca + (Math.random() - 0.5) * 0.8) * (14 + Math.random() * 30); x.lineTo(cx, cy); }
          x.stroke();
        }
        x.beginPath(); for (let k = 0; k < 4; k++) { const ka = a + k * 1.7 + Math.random() * 0.6, kr = sz * (k % 2 ? 0.45 : 1); x[k ? 'lineTo' : 'moveTo'](px + Math.cos(ka) * kr, py + Math.sin(ka) * kr); } x.closePath();
        const g = x.createLinearGradient(px - sz, py - sz, px + sz, py + sz); g.addColorStop(0, 'rgba(250,253,255,0.95)'); g.addColorStop(0.5, 'rgba(160,190,215,0.8)'); g.addColorStop(1, 'rgba(60,80,100,0.9)');
        x.fillStyle = g; x.fill(); x.strokeStyle = 'rgba(20,30,40,0.8)'; x.lineWidth = 1.5; x.stroke();
      }
      crackL.tex.needsUpdate = true; crackL.m.visible = true; crackL.m.material.opacity = 1;
      drips = []; wounds.forEach((w) => { for (let k = 0; k < 2; k++) drips.push({ x: w.x + (Math.random() - 0.5) * w.s, y: w.y, v: 25 + Math.random() * 45, wd: 3 + Math.random() * 6, len: 0 }); });
      for (let k = 0; k < 7; k++) drips.push({ x: Math.random() * 1024, y: 0, v: 20 + Math.random() * 40, wd: 4 + Math.random() * 8, len: 0 });   // from the forehead
      bloodL.m.visible = true; S.bloodT = 0;
    }
    function drawBlood(t) {   // t: seconds since the glass hit
      const x = bloodL.x; x.clearRect(0, 0, 1024, 576);
      const k = Math.min(1, t / 2.5);
      const g = x.createRadialGradient(512, 288, 120 + 200 * (1 - k), 512, 288, 620);
      g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(0.55, 'rgba(110,0,0,' + (0.35 * k) + ')'); g.addColorStop(1, 'rgba(60,0,0,' + (0.9 * k) + ')');
      x.fillStyle = g; x.fillRect(0, 0, 1024, 576);
      wounds.forEach((w) => { const r = w.s * (0.7 + Math.min(1, t) * 0.9); const wg = x.createRadialGradient(w.x, w.y, 0, w.x, w.y, r); wg.addColorStop(0, 'rgba(120,0,4,0.95)'); wg.addColorStop(1, 'rgba(120,0,4,0)'); x.fillStyle = wg; x.fillRect(w.x - r, w.y - r, r * 2, r * 2); });
      x.fillStyle = 'rgba(115,0,6,0.92)';
      drips.forEach((d) => {
        d.len = Math.min(576, d.v * t * (0.6 + 0.4 * Math.sin(t * 2 + d.x)));
        x.fillRect(d.x - d.wd / 2, d.y, d.wd, d.len); x.beginPath(); x.arc(d.x, d.y + d.len, d.wd * 0.75, 0, 7); x.fill();
      });
      bloodL.tex.needsUpdate = true; bloodL.m.material.opacity = Math.min(1, t * 1.6);
    }
    // what the controller does after the hit: sits stunned, stands up, staggers back a few steps and goes down
    const smooth = (a, b, v) => { const u = Math.max(0, Math.min(1, (v - a) / (b - a))); return u * u * (3 - 2 * u); };
    function deathCam(t) {
      const up = smooth(1.1, 2.3, t), walk = Math.max(0, Math.min(1, (t - 2.3) / 2.1)), fall = Math.max(0, Math.min(1, (t - 4.4) / 0.75)), f2 = fall * fall;
      const step = Math.abs(Math.sin(walk * Math.PI * 3)), sway = Math.sin(walk * Math.PI * 3);
      let y = EYE.y + 0.7 * up - 0.09 * step * (walk > 0 && walk < 1 ? 1 : 0), z = 0.25 * up + 1.5 * walk, x = sway * 0.12 * walk;
      y += (30.28 - y) * f2; z += 0.35 * f2; x += 0.3 * f2;
      if (fall >= 1) y += Math.abs(Math.sin(Math.min(1, (t - 5.15) * 3) * Math.PI)) * 0.06 * Math.max(0, 1 - (t - 5.15) * 3);   // a small bounce on the floor
      camera.position.set(x, y, z);
      const stun = t < 1.1 ? Math.sin(t * 9) * 0.03 * (1.1 - t) : 0;
      camera.rotation.order = 'YXZ';
      camera.rotation.y = sway * 0.22 * walk + 0.3 * f2 + stun;
      camera.rotation.x = 0.02 - 0.22 * up + 0.08 * step * walk - 0.35 * f2 + (t < 0.4 ? 0.12 * Math.sin(t * 8) : 0);
      camera.rotation.z = sway * 0.07 * walk + 1.35 * f2;
      if (S.shake > 0) { const a = S.shake * S.shake; camera.position.x += (Math.random() - 0.5) * 0.4 * a; camera.position.y += (Math.random() - 0.5) * 0.3 * a; }
      if (fall > 0 && fall < 1) S.shakeFall = 1; else if (fall >= 1 && S.shakeFall) { S.shakeFall = 0; S.shake = 0.35; }   // thud
    }
    function impact() {
      S.hit = true; S.shake = 1; flash.intensity = 7; glass.visible = false;
      shards.forEach((m) => {
        m.position.set((Math.random() - 0.5) * 10, 1.1 + Math.random() * 2, -2.25); m.scale.setScalar(0.04 + Math.random() * 0.16);
        m.userData.v.set((Math.random() - 0.5) * 4 + m.position.x * 0.3, Math.random() * 3, 3 + Math.random() * 7); m.userData.w.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
        m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); m.material.opacity = 0.75; m.visible = true;
      });
    }
    function clearImpact() {
      S.hit = false; S.shake = 0; S.glassHit = false; glass.visible = true; fade.material.opacity = 0; cabFireL.intensity = 0;
      crackL.m.visible = false; bloodL.m.visible = false; crackL.m.material.opacity = 0; bloodL.m.material.opacity = 0;
      shards.forEach((m) => { m.visible = false; }); cabFires.forEach((f) => { f.visible = false; });
    }
    function impactFrame(dt, t) {   // t: seconds since the impact
      S.shake = Math.max(0, S.shake - dt * 0.7);
      shards.forEach((m) => {
        if (!m.visible) return; const u = m.userData;
        u.v.y -= 9.8 * dt; m.position.addScaledVector(u.v, dt); m.rotation.x += u.w.x * dt; m.rotation.y += u.w.y * dt;
        if (m.position.y < 0.9 && m.position.z < 0.9) { m.position.y = 0.9; u.v.set(0, 0, 0); u.w.set(0, 0, 0); }   // lands on the desk
        if (m.position.z > 1.4 || m.position.y < -1) m.visible = false;                                                // flew past the viewer
      });
      cabFires.forEach((f, i) => {   // the fire spreads along the desk from the middle outwards
        const on = t > 0.15 + Math.abs(i - 4) * 0.22; f.visible = on; if (!on) return;
        const g = Math.min(1, (t - 0.15 - Math.abs(i - 4) * 0.22) * 1.5), fl = f.userData.s * g * (0.85 + Math.sin(S.t * 13 + f.userData.ph) * 0.12 + Math.random() * 0.12);
        f.scale.set(fl, fl * 1.35, 1); f.position.y = f.userData.y + Math.sin(S.t * 5 + f.userData.ph) * 0.05;
      });
      cabFireL.intensity = Math.min(1, t * 2) * (9 + Math.random() * 5);
      S.emit2 = (S.emit2 || 0) + dt * 6;
      while (S.emit2 > 1) { S.emit2--; _p.set((Math.random() - 0.5) * 9, 31.6 + Math.random(), -2 + Math.random() * 0.6); puffAt(_p, true, 2.4, 0.7); }   // smoke filling the cab
      if (!OUT && !S.glassHit && t > 0.22) { S.glassHit = true; glassHits(); S.shake = Math.max(S.shake, 0.8); }
      if (S.glassHit) { fitOverlays(); drawBlood(t - 0.22); }
      if (!OUT) fade.material.opacity = Math.min(1, Math.max(0, (t - 5.0) / 1.6));   // eyes close after the fall
    }

    // ---------------- state
    const S = { link: false, ph: 'demo', p: 0, target: 0, strikes: 0, open: [], t: 0, endT: 0, pos: new T.Vector3(), yaw: 0, mx: 0, my: 0, peek: false, emit: 0, boltT: 0, nextBolt: 5, crashAt: new T.Vector3(), landD: 0, cP: [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()], cD: 5, cTan: new T.Vector3(), lP: [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()], lD: 7, tdDone: false, shot: '' };
    // crash into the tower: the nose ends at the cab windows (cab glass at z -2.25, the nose is about 72 m ahead of the plane's origin)
    const HIT = new T.Vector3(0, 31.5, -74);
    function planCrash() {
      if (S.pos.lengthSq() < 1) pathPos(Math.min(1, Math.max(S.p, S.target)), S.pos);   // never drawn yet: start where it would be on the approach
      const P = S.cP; P[0].copy(S.pos);
      P[1].copy(S.pos).addScaledVector(dir, 500); P[1].y = Math.max(90, S.pos.y * 0.7);       // keep going a moment, then bank round
      P[2].copy(HIT).add(new T.Vector3(0, 20, -650));                                         // line up with the windows, a little high
      P[3].copy(HIT);
      const len = P[0].distanceTo(P[1]) + P[1].distanceTo(P[2]) + P[2].distanceTo(P[3]);
      S.cD = Math.max(4, Math.min(7, len / 330)); S.crashAt.set(0, 0, -30);
    }
    // landing: a curve from wherever the aircraft is down to the touchdown point, then a braking roll-out
    const TD = new T.Vector3().copy(A).addScaledVector(dir, 140).setY(4.5);
    function planLanding() {
      if (S.pos.lengthSq() < 1) pathPos(Math.min(1, Math.max(S.p, S.target)), S.pos);
      const P = S.lP; P[0].copy(S.pos);
      P[1].copy(S.pos).addScaledVector(dir, Math.min(600, S.pos.distanceTo(TD) * 0.35)); P[1].y = S.pos.y * 0.55 + 10;
      P[2].copy(TD).addScaledVector(dir, -260).setY(18); P[3].copy(TD);
      S.lD = 6.5; S.tdDone = false; S.landD = 0;   // fixed: the pilot screen plays the touchdown sound 7 s after landing starts (js/game.js), and every screen must agree
    }
    function bez(P, k, out) { const u = 1 - k; return out.set(0, 0, 0).addScaledVector(P[0], u * u * u).addScaledVector(P[1], 3 * u * u * k).addScaledVector(P[2], 3 * u * k * k).addScaledVector(P[3], k * k * k); }
    function crashPos(k, out) {   // cubic Bezier through cP
      const P = S.cP, u = 1 - k;
      return out.set(0, 0, 0).addScaledVector(P[0], u * u * u).addScaledVector(P[1], 3 * u * u * k).addScaledVector(P[2], 3 * u * k * k).addScaledVector(P[3], k * k * k);
    }
    function setState(d) {
      if (!d) return;
      if (!S.link) { S.link = true; S.p = 0; }
      const prev = S.ph;
      S.ph = d.ph === 'intro' ? 'flight' : d.ph;
      if (d.tot > 0 && d.tl != null) S.target = Math.max(0, Math.min(1, 1 - d.tl / d.tot));
      S.strikes = d.k || 0; S.open = Array.isArray(d.o) ? d.o : [];
      if (S.ph === 'flight' && (prev === 'won' || prev === 'crashed' || prev === 'lobby' || d.f !== S.seed)) { S.p = Math.min(S.target, 0.02); S.endT = 0; wreck.visible = false; wreckL.intensity = 0; clearImpact(); }
      S.seed = d.f;
      if (S.ph !== prev) { S.endT = 0; if (S.ph === 'crashed') planCrash(); if ((S.ph === 'landing' || S.ph === 'won') && prev !== 'landing' && prev !== 'won') planLanding(); }
      if (S.ph === 'lobby') { S.link = false; S.ph = 'demo'; S.p = 0; wreck.visible = false; wreckL.intensity = 0; clearImpact(); }
    }
    function pathPos(p, out) {
      const back = (1 - p) * 2500;
      return out.copy(A).addScaledVector(dir, -back - 120).setY(26 + (1 - p) * 430);
    }
    function puffAt(pos, dark, size, rise) {
      const sp = smoke.find((s) => s.userData.life <= 0); if (!sp) return;
      sp.material.map = dark ? smokeTexD : smokeTexL; sp.material.needsUpdate = true;
      sp.position.copy(pos); sp.userData = { life: 1, max: 5 + Math.random() * 3, age: 0, size, rise, dx: (Math.random() - 0.5) * 3, dz: (Math.random() - 0.5) * 3 }; sp.visible = true;
    }
    const _p = new T.Vector3(), _q = new T.Vector3(), _c = new T.Vector3(), _l = new T.Vector3(), TOWER = new T.Vector3(0, 30, -0.5);
    // outside cameras: a few fixed and chase shots, cut between by phase
    function outsideCam(dt) {
      let shot = 'chase', hold = false;
      const chase = () => { _c.copy(S.pos).addScaledVector(dir, -190).addScaledVector(side, 70); _c.y = S.pos.y + 45; _l.copy(S.pos); };
      if (S.ph === 'crashed') {
        if (S.endT < S.cD * 0.55) chase();
        else { shot = 'crashside'; hold = true; _c.set(-95, 46, -70); _l.copy(S.hit ? TOWER : S.pos).lerp(TOWER, S.hit ? 1 : Math.max(0, (S.endT / S.cD - 0.55) * 1.5)); }
      } else if (S.ph === 'landing' || S.ph === 'won') {
        const tr = S.endT - S.lD;
        if (S.endT < S.lD * 0.6) chase();
        else if (tr < 3.5) { shot = 'rwside'; hold = true; _c.copy(TD).addScaledVector(dir, 160).addScaledVector(side, 85).setY(7); _l.copy(S.pos); }
        else { shot = 'rwend'; hold = true; _c.copy(TD).addScaledVector(dir, 560).addScaledVector(side, -45).setY(5); _l.copy(S.pos); }
      } else if (!plane.visible) { shot = 'tower'; hold = true; _c.set(260, 60, 220); _l.copy(TOWER); }
      else chase();
      if (shot !== S.shot || !hold) { if (shot !== S.shot) camera.position.copy(_c); else camera.position.lerp(_c, Math.min(1, dt * 3)); }   // a new shot is a cut
      S.shot = shot; camera.lookAt(_l);
      if (S.shake > 0) camera.position.add(_q.set((Math.random() - 0.5) * 3 * S.shake, (Math.random() - 0.5) * 2 * S.shake, 0));
    }
    let last = performance.now(), raf = 0, alive = true;
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.08, (now - last) / 1000); last = now; S.t += dt;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w && h && (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio()))) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
      // gentle head movement following the mouse
      // looking down at the handbook on the desk, or up and out of the windows (the head follows the mouse a little)
      if (!OUT) {   // the controller's own eyes
      let yaw = S.peek ? -S.mx * 0.55 - 0.12 : 0, pitch = S.peek ? 0.02 - S.my * 0.12 : DESK_PITCH;
      // on a crash the head comes up by itself and follows the aircraft until it hits the windows
      const ending = S.ph === 'landing' || S.ph === 'won', look = S.peek || S.ph === 'crashed' || ending;
      if (S.ph === 'crashed' || ending) {
        if (ending || S.endT < S.cD) { _p.subVectors(S.pos, EYE); yaw = Math.max(-1.1, Math.min(1.1, Math.atan2(-_p.x, -_p.z))); pitch = Math.max(-0.25, Math.min(0.3, Math.atan2(_p.y, Math.hypot(_p.x, _p.z)))); }
        else { yaw = 0; pitch = 0.02; }
      }
      const ck = Math.min(1, dt * (S.ph === 'crashed' || ending ? 3 : 4.2));
      camera.rotation.order = 'YXZ'; camera.rotation.y += (yaw - camera.rotation.y) * ck; camera.rotation.x += (pitch - camera.rotation.x) * ck;
      camera.position.lerp(look ? EYE : DESK, ck);
      if (S.shake > 0) { const a = S.shake * S.shake; camera.position.add(_q.set((Math.random() - 0.5) * 0.5 * a, (Math.random() - 0.5) * 0.4 * a, (Math.random() - 0.5) * 0.3 * a)); camera.rotation.z = (Math.random() - 0.5) * 0.08 * a; } else camera.rotation.z = 0;
      if (S.ph === 'crashed' && S.hit) deathCam(S.endT - S.cD);   // takes the camera over after the hit
      } else outsideCam(dt);
      clouds.forEach((c) => { c.position.x -= c.userData.v * dt; if (c.position.x < -4200) c.position.x = 4200; });
      sweep.rotation.z = -S.t * 1.6;
      // lightning
      S.nextBolt -= dt;
      if (S.nextBolt <= 0) {
        S.nextBolt = 6 + Math.random() * 12; S.boltT = 0.28; flash.intensity = 2.6;
        const a = (Math.random() - 0.5) * 1.6, d = 3000 + Math.random() * 1500; let x = Math.sin(a) * d, z = -Math.cos(a) * d; const arr = bolt.geometry.attributes.position;
        for (let i = 0; i < 9; i++) { arr.setXYZ(i, x, 900 - i * 112, z); x += (Math.random() - 0.5) * 160; } arr.needsUpdate = true;
      }
      if (S.boltT > 0) { S.boltT -= dt; bolt.visible = S.boltT > 0.14 || (S.boltT > 0.04 && S.boltT < 0.09); } else bolt.visible = false;
      flash.intensity = Math.max(0, flash.intensity - dt * 9);

      // aircraft
      const onFire = S.open.indexOf('fire') >= 0 || S.strikes >= 2 || S.ph === 'crashed', mist = S.open.indexOf('hyd') >= 0, flicker = S.open.indexOf('breakers') >= 0;
      if (S.ph === 'demo') { S.p += dt / 150; if (S.p > 1.35) S.p = 0; }
      else if (S.ph === 'flight') S.p += (S.target - S.p) * Math.min(1, dt * 0.8);
      let vis = true;
      if (S.ph === 'crashed') {
        S.endT += dt;
        const k = Math.min(1, S.endT / S.cD), e = k * (0.7 + 0.3 * k);   // speeds up towards the end
        vis = k < 1;
        if (vis) { crashPos(e, S.pos); crashPos(Math.min(1, e + 0.01), _q); S.cTan.subVectors(_q, S.pos).normalize(); }
        else {
          if (!S.hit) { impact(); wreck.visible = true; }
          impactFrame(dt, S.endT - S.cD);
          wreck.position.copy(S.crashAt).setY(8); const f = 60 + Math.sin(S.t * 23) * 14 + Math.random() * 12; wreck.scale.set(f * 0.7, f * 0.45, 1);   // kept small: it burns right below the windows and must not wash out the fire in the cab
          wreckL.position.copy(wreck.position); wreckL.intensity = 400 + Math.random() * 250;
          S.emit += dt * (OUT ? 3.5 : 9); while (S.emit > 1) { S.emit--; _p.copy(S.crashAt).setY(10); puffAt(_p, true, OUT ? 30 : 46, 22); }   // thinner outside, or it hides the tower
        }
      } else if (S.ph === 'landing' || S.ph === 'won') {
        S.endT += dt;
        if (S.endT < S.lD) {                       // final approach, slowing down, flare at the end
          const k = S.endT / S.lD, e = k * (1.3 - 0.3 * k);
          bez(S.lP, e, S.pos); bez(S.lP, Math.min(1, e + 0.01), _q); S.cTan.subVectors(_q, S.pos).normalize();
          plane.lookAt(_q.copy(S.pos).sub(S.cTan));
          plane.rotateX(0.04 + 0.13 * smooth(0.72, 1, k)); plane.rotateZ(Math.sin(Math.min(1, k * 1.5) * Math.PI) * 0.14);
        } else {                                   // touchdown, tyre smoke, a small bounce, braking to a stop
          const tr = S.endT - S.lD, v0 = 65, a = 5.5, s = tr < v0 / a ? v0 * tr - 0.5 * a * tr * tr : v0 * v0 / (2 * a);
          S.landD = Math.min(rwLen - 220, s); S.pos.copy(TD).addScaledVector(dir, S.landD);
          if (tr < 0.6) S.pos.y += Math.sin(tr / 0.6 * Math.PI) * 1.1;
          if (!S.tdDone) { S.tdDone = true; for (let i = 0; i < 12; i++) { _p.copy(TD).addScaledVector(side, (i % 2 ? 1 : -1) * (10 + Math.random() * 4)).addScaledVector(dir, -6 - Math.random() * 8).setY(1.5); puffAt(_p, false, 7 + Math.random() * 5, 1.2); } }
          plane.rotation.set(0.17 * (1 - smooth(0, 1.3, tr)), Math.atan2(-dir.x, -dir.z), 0);
        }
      } else {
        const p = Math.min(1.35, S.p);
        if (p <= 1) pathPos(p, S.pos); else S.pos.copy(A).addScaledVector(dir, -120 + (p - 1) * 2600).setY(26 + (p - 1) * 900);   // demo: low pass and climb away
        const wob = 1 + S.strikes * 1.6;
        S.pos.y += Math.sin(S.t * 0.9) * 2.2 * wob; S.pos.addScaledVector(side, Math.sin(S.t * 0.53) * 3 * wob);
        plane.rotation.z = Math.sin(S.t * 0.8) * 0.035 * wob + (S.strikes ? Math.sin(S.t * 2.1) * 0.03 * S.strikes : 0);
        plane.rotation.x = p > 1 ? 0.2 : -0.045;
        vis = p > 0.07;
      }
      plane.visible = vis;
      if (vis) {
        plane.position.copy(S.pos);
        if (S.ph === 'crashed') {   // nose along the flight path (the nose is local -z), banked in the turn, shaking
          const k = S.endT / S.cD; plane.lookAt(_q.copy(S.pos).sub(S.cTan));
          plane.rotateZ(Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.75 + Math.sin(S.t * 19) * 0.04 * (1 + k * 3));
        } else if (S.ph !== 'landing' && S.ph !== 'won') plane.rotation.y = Math.atan2(-dir.x, -dir.z);
        const far = Math.max(0, Math.min(1, (S.p - 0.07) / 0.12)), blinkOn = !flicker || Math.sin(S.t * 31) > -0.2;
        navR.material.opacity = navG.material.opacity = far * (blinkOn ? 1 : 0.1);
        strobe.material.opacity = far * ((S.t % 1.3) < 0.07 ? 1 : 0);
        landL.material.opacity = far * (flicker && Math.sin(S.t * 17) > 0.3 ? 0.15 : 0.95);
        fire.visible = onFire && S.ph !== 'won'; if (fire.visible) { const f = 20 + Math.sin(S.t * 27) * 5 + Math.random() * 6; fire.scale.set(f, f, 1); }
        // smoke and vapour trail from the damaged side
        const rate = (onFire ? 9 : 0) + S.strikes * 3 + (mist ? 4 : 0) + (S.ph === 'demo' || (!onFire && !mist && !S.strikes) ? 0.8 : 0);
        S.emit += dt * rate;
        while (S.emit > 1) { S.emit--; _q.set(onFire || S.strikes ? 8.5 : -8.5, -2, 6).multiplyScalar(3.2).applyEuler(plane.rotation).add(S.pos); puffAt(_q, onFire || S.strikes > 0, onFire ? 20 : 12, 3); }
        blip.position.set(-2.05 + Math.sin(0.6) * (1 - Math.min(1, S.p)) * 0.17, 0.915, -1.62 - Math.cos(0.6) * (1 - Math.min(1, S.p)) * 0.17);
      }
      smoke.forEach((sp) => {
        const u = sp.userData; if (u.life <= 0) return;
        u.age += dt; u.life = 1 - u.age / u.max;
        if (u.life <= 0) { sp.visible = false; return; }
        sp.position.x += (u.dx + 5) * dt; sp.position.z += u.dz * dt; sp.position.y += u.rise * dt;
        const s = u.size * (1 + u.age * 0.9); sp.scale.set(s, s, 1); sp.material.opacity = Math.min(1, u.age * 3) * u.life * 0.8;
      });
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);
    const onMove = (e) => { S.mx = (e.clientX / window.innerWidth) * 2 - 1; S.my = (e.clientY / window.innerHeight) * 2 - 1; };
    window.addEventListener('pointermove', onMove);
    return {
      setState, state: S,
      setPeek(v) { S.peek = !!v; },
      stop() { alive = false; cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); try { renderer.dispose(); } catch (e) {} },
    };
  }
  window.KKTower = { start };
})();
