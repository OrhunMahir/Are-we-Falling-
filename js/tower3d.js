/* ARE WE FALLING? — the tower player's room: a control tower cab in 3D behind the handbook.
   Through the windows: the storm, the runway lights and, after a while, the aircraft itself. */
(function () {
  'use strict';
  const T = window.THREE;
  function start(canvas) {
    if (!T) return null;
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
    const frameM = lam(0x15181c), desk = lam(0x23282f), deskTop = lam(0x2c323a);
    for (let i = -3; i <= 3; i++) { const m = box(0.09, 2.0, 0.09, i * 1.5, 1.95, -2.3 + Math.abs(i) * 0.16, frameM, cab); m.rotation.z = 0; }
    box(11, 0.5, 0.3, 0, 3.15, -2.2, frameM, cab); box(11, 0.14, 0.34, 0, 0.98, -2.2, frameM, cab); box(11, 0.1, 4, 0, 3.4, -0.6, frameM, cab);
    const glass = new T.Mesh(new T.PlaneGeometry(11, 2.1), new T.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.045, depthWrite: false })); glass.position.set(0, 2.0, -2.25); cab.add(glass);
    box(11, 0.9, 1.3, 0, 0.45, -1.7, desk, cab); const top = box(11, 0.05, 1.34, 0, 0.92, -1.68, deskTop, cab); top.rotation.x = 0.1;
    const back = box(11, 0.3, 0.08, 0, 1.06, -2.28, desk, cab); back.rotation.x = -0.5;
    // radar scope
    const rc = document.createElement('canvas'); rc.width = rc.height = 256; const rx = rc.getContext('2d');
    rx.fillStyle = '#04150c'; rx.beginPath(); rx.arc(128, 128, 126, 0, 7); rx.fill(); rx.strokeStyle = '#1f8a4c'; rx.lineWidth = 2;
    [40, 80, 120].forEach((r) => { rx.beginPath(); rx.arc(128, 128, r, 0, 7); rx.stroke(); }); rx.beginPath(); rx.moveTo(8, 128); rx.lineTo(248, 128); rx.moveTo(128, 8); rx.lineTo(128, 248); rx.stroke();
    const rtex = new T.CanvasTexture(rc); rtex.colorSpace = T.SRGBColorSpace;
    const scope = new T.Mesh(new T.CircleGeometry(0.2, 40), basic(0xffffff, { map: rtex })); scope.rotation.x = -Math.PI / 2 + 0.1; scope.position.set(-2.05, 0.955, -1.62); cab.add(scope);
    const sweep = new T.Mesh(new T.PlaneGeometry(0.2, 0.012).translate(0.1, 0, 0), basic(0x6dffa6, { transparent: true, opacity: 0.9 })); sweep.rotation.x = -Math.PI / 2 + 0.1; sweep.position.set(-2.05, 0.957, -1.62); cab.add(sweep);
    const blip = new T.Mesh(new T.CircleGeometry(0.008, 10), basic(0xbfffd6)); blip.rotation.x = -Math.PI / 2 + 0.1; blip.position.set(-2.05, 0.958, -1.62); cab.add(blip);
    box(0.5, 0.05, 0.5, -2.05, 0.93, -1.62, lam(0x111417), cab);
    // lit keys, binders, mug, lamp, handset
    const keyCols = [0xffb224, 0x39d98a, 0x3d8bff, 0xff4a3a, 0xf1f3f5];
    for (let i = 0; i < 24; i++) box(0.05, 0.02, 0.04, 1.75 + (i % 8) * 0.075, 0.965 + Math.floor(i / 8) * 0.004, -1.55 - Math.floor(i / 8) * 0.07, basic(Math.random() < 0.45 ? keyCols[i % 5] : 0x30363e), cab);
    [0xb23a2e, 0x2d6fb5, 0x3a8f4f, 0xc9a54a].forEach((c, i) => { const b = box(0.07, 0.3, 0.24, -3.0 - i * 0.085, 1.1, -1.75, lam(c), cab); b.rotation.z = i === 3 ? 0.18 : 0; box(0.072, 0.07, 0.01, b.position.x, 1.12, -1.628, lam(0xefe6cf), cab); });
    const mug = new T.Mesh(new T.CylinderGeometry(0.045, 0.04, 0.1, 16), lam(0xe8e2d2)); mug.position.set(2.75, 1.0, -1.4); cab.add(mug);
    const coffee = new T.Mesh(new T.CircleGeometry(0.04, 16), basic(0x2a1608)); coffee.rotation.x = -Math.PI / 2; coffee.position.set(2.75, 1.049, -1.4); cab.add(coffee);
    box(0.03, 0.4, 0.03, 3.3, 1.15, -1.9, lam(0x101214), cab); const shade = new T.Mesh(new T.ConeGeometry(0.13, 0.14, 16, 1, true), new T.MeshLambertMaterial({ color: 0x2f7d57, emissive: 0x0d2a1c, side: T.DoubleSide })); shade.position.set(3.2, 1.36, -1.8); cab.add(shade);
    const lamp = new T.PointLight(0xffc98a, 2.2, 6, 1.6); lamp.position.set(3.2, 1.3, -1.75); cab.add(lamp);
    box(0.34, 0.03, 0.24, 0, 0.955, -1.45, lam(0xe9e3d0), cab).rotation.x = 0.1;   // flight strips, seen when the folder is put down
    box(0.5, 0.02, 0.18, 0.75, 0.955, -1.4, lam(0x16191d), cab).rotation.x = 0.1;
    // ---------------- the writing desk right under the viewer: the handbook lies here
    const dc = document.createElement('canvas'); dc.width = dc.height = 512; const dx = dc.getContext('2d');
    dx.fillStyle = '#3a2c20'; dx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) { const y = Math.random() * 512; dx.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '20,12,6' : '120,90,60') + ',' + (0.05 + Math.random() * 0.12) + ')'; dx.lineWidth = 0.6 + Math.random() * 2.2; dx.beginPath(); dx.moveTo(0, y); dx.bezierCurveTo(170, y + (Math.random() - 0.5) * 14, 340, y + (Math.random() - 0.5) * 14, 512, y + (Math.random() - 0.5) * 8); dx.stroke(); }
    const dtex = new T.CanvasTexture(dc); dtex.colorSpace = T.SRGBColorSpace; dtex.wrapS = dtex.wrapT = T.RepeatWrapping; dtex.repeat.set(5, 1.2);
    const wood = new T.MeshLambertMaterial({ color: 0xffffff, map: dtex });
    box(11, 0.06, 1.9, 0, 0.87, -0.2, wood, cab); box(11, 0.06, 0.05, 0, 0.9, -1.13, lam(0x15181c), cab);
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
    plane.scale.setScalar(3.2); plane.visible = false;
    const smokeTexD = puff('rgba(28,26,26,0.9)', 'rgba(20,20,20,0)'), smokeTexL = puff('rgba(200,205,212,0.55)', 'rgba(180,186,194,0)');
    const smoke = [];
    for (let i = 0; i < 70; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: smokeTexD, transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; sp.userData = { life: 0 }; scene.add(sp); smoke.push(sp); }
    const wreck = mkGlow(0xff6a1a, 10); wreck.visible = false; scene.add(wreck);
    const wreckL = new T.PointLight(0xff6a1a, 0, 0, 1.2); scene.add(wreckL);

    // ---------------- state
    const S = { link: false, ph: 'demo', p: 0, target: 0, strikes: 0, open: [], t: 0, endT: 0, pos: new T.Vector3(), yaw: 0, mx: 0, my: 0, peek: false, emit: 0, boltT: 0, nextBolt: 5, crashAt: new T.Vector3(), landD: 0 };
    function setState(d) {
      if (!d) return;
      if (!S.link) { S.link = true; S.p = 0; }
      const prev = S.ph;
      S.ph = d.ph === 'intro' ? 'flight' : d.ph;
      if (d.tot > 0 && d.tl != null) S.target = Math.max(0, Math.min(1, 1 - d.tl / d.tot));
      S.strikes = d.k || 0; S.open = Array.isArray(d.o) ? d.o : [];
      if (S.ph === 'flight' && (prev === 'won' || prev === 'crashed' || prev === 'lobby' || d.f !== S.seed)) { S.p = Math.min(S.target, 0.02); S.endT = 0; wreck.visible = false; wreckL.intensity = 0; }
      S.seed = d.f;
      if (S.ph !== prev) { S.endT = 0; if (S.ph === 'crashed') { S.crashAt.copy(S.pos); S.crashAt.y = 2; } if (S.ph === 'landing' || S.ph === 'won') S.landD = S.landD || 0; }
      if (S.ph === 'lobby') { S.link = false; S.ph = 'demo'; S.p = 0; wreck.visible = false; wreckL.intensity = 0; }
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
    const _p = new T.Vector3(), _q = new T.Vector3();
    let last = performance.now(), raf = 0, alive = true;
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.08, (now - last) / 1000); last = now; S.t += dt;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w && h && (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio()))) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
      // gentle head movement following the mouse
      // looking down at the handbook on the desk, or up and out of the windows (the head follows the mouse a little)
      const yaw = S.peek ? -S.mx * 0.55 - 0.12 : 0, pitch = S.peek ? 0.02 - S.my * 0.12 : DESK_PITCH;
      const ck = Math.min(1, dt * 4.2);
      camera.rotation.order = 'YXZ'; camera.rotation.y += (yaw - camera.rotation.y) * ck; camera.rotation.x += (pitch - camera.rotation.x) * ck;
      camera.position.lerp(S.peek ? EYE : DESK, ck);
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
      const onFire = S.open.indexOf('fire') >= 0 || S.strikes >= 2, mist = S.open.indexOf('hyd') >= 0, flicker = S.open.indexOf('breakers') >= 0;
      if (S.ph === 'demo') { S.p += dt / 150; if (S.p > 1.35) S.p = 0; }
      else if (S.ph === 'flight') S.p += (S.target - S.p) * Math.min(1, dt * 0.8);
      let vis = true;
      if (S.ph === 'crashed') {
        S.endT += dt; vis = S.endT < 0.9;
        if (vis) { S.pos.y = Math.max(3, S.pos.y - dt * 60); S.pos.addScaledVector(dir, dt * 70); plane.rotation.x -= dt * 0.5; S.crashAt.copy(S.pos).setY(2); }
        else {
          if (!wreck.visible) { wreck.visible = true; flash.intensity = 5; }
          wreck.position.copy(S.crashAt).setY(8); const f = 60 + Math.sin(S.t * 23) * 14 + Math.random() * 12; wreck.scale.set(f * 1.6, f, 1);
          wreckL.position.copy(wreck.position); wreckL.intensity = 400 + Math.random() * 250;
          S.emit += dt * 9; while (S.emit > 1) { S.emit--; _p.copy(S.crashAt).setY(10); puffAt(_p, true, 46, 22); }
        }
      } else if (S.ph === 'landing' || S.ph === 'won') {
        S.endT += dt; const k = Math.min(1, S.endT / 9);
        const td = _p.copy(A).addScaledVector(dir, 140).setY(4.5);                     // touchdown point
        if (k < 1) S.pos.lerp(td, Math.min(1, dt * (0.35 + k * 1.2)));
        else { S.landD = Math.min(rwLen - 220, (S.landD || 0) + dt * Math.max(8, 70 - (S.endT - 9) * 9)); S.pos.copy(td).addScaledVector(dir, S.landD); }
        plane.rotation.x = k < 1 ? 0.06 : 0;
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
        plane.position.copy(S.pos); plane.rotation.y = Math.atan2(-dir.x, -dir.z);
        const far = Math.max(0, Math.min(1, (S.p - 0.07) / 0.12)), blinkOn = !flicker || Math.sin(S.t * 31) > -0.2;
        navR.material.opacity = navG.material.opacity = far * (blinkOn ? 1 : 0.1);
        strobe.material.opacity = far * ((S.t % 1.3) < 0.07 ? 1 : 0);
        landL.material.opacity = far * (flicker && Math.sin(S.t * 17) > 0.3 ? 0.15 : 0.95);
        fire.visible = onFire && S.ph !== 'won'; if (fire.visible) { const f = 20 + Math.sin(S.t * 27) * 5 + Math.random() * 6; fire.scale.set(f, f, 1); }
        // smoke and vapour trail from the damaged side
        const rate = (onFire ? 9 : 0) + S.strikes * 3 + (mist ? 4 : 0) + (S.ph === 'demo' || (!onFire && !mist && !S.strikes) ? 0.8 : 0);
        S.emit += dt * rate;
        while (S.emit > 1) { S.emit--; _q.set(onFire || S.strikes ? 8.5 : -8.5, -2, 6).multiplyScalar(3.2).applyEuler(plane.rotation).add(S.pos); puffAt(_q, onFire || S.strikes > 0, onFire ? 20 : 12, 3); }
        blip.position.set(-2.05 + Math.sin(0.6) * (1 - Math.min(1, S.p)) * 0.17, 0.958, -1.62 - Math.cos(0.6) * (1 - Math.min(1, S.p)) * 0.17);
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
