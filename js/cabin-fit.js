/* ARE WE FALLING? — cabin-fit: makes the Meshy people fit the cabin.

   js/roles/intruder-play.js swaps the cabin's passengers for Meshy figures and adds a rigged flight attendant.
   Those models were made without the cabin around them: a passenger is wider and deeper than a seat and "sits"
   without a chair, so it goes through the backrest, the cushion and its neighbours; the attendant has no face and
   stands frozen in the middle of a step, which pulls her skirt apart.

   This file corrects that from the outside, without touching the role files. It watches the cabin's scene and
     - reshapes every passenger model once: a little smaller, lifted onto the cushion with the lower legs drawn
       down to the floor, elbows inside the seat, back against the backrest, knees clear of the seat in front,
       and it puts the oxygen mask cup on the face instead of over the knees;
     - gives the attendant a face and a standing pose that the walk cycle blends into whenever she stops.

   cabin.html loads it right after js/cabin3d.js. cabin.html?fit=0 switches it off (to compare). Outside the cabin it
   only offers KKCrewFit (a face and a standing pose for a crew model), see the end of this file. */
(function () {
  'use strict';
  const T = window.THREE, K = window.KKCabin;
  if (!T) return;
  const inCabin = !!(K && K.start) && !/[?&]fit=0\b/.test(location.search);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  if (inCabin) {
    const start = K.start;
    K.start = function () {
      const cabin = start.apply(this, arguments);
      try { if (cabin && cabin.scene) attach(cabin.scene); } catch (e) { console.warn('cabin-fit', e); }
      return cabin;
    };
  }

  const fit = { pax: [], crew: [], models: [] };   // what was found, also for tests (window.__cabinFit)
  window.__cabinFit = fit;

  function attach(scene) {
    const done = new WeakSet(), prev = scene.onBeforeRender;
    let last = performance.now();
    // The role layer hooks the same callback after us and calls us last, so its own per-frame work is already done here.
    scene.onBeforeRender = function () {
      const now = performance.now(), dt = clamp((now - last) / 1000, 0, 0.1); last = now;
      try {
        const ch = scene.children;
        for (let i = 0; i < ch.length; i++) { const o = ch[i]; if (!done.has(o)) { done.add(o); look(o); } }
        for (let i = 0; i < fit.pax.length; i++) settle(fit.pax[i]);
        for (let i = 0; i < fit.crew.length; i++) stand(fit.crew[i], dt);
      } catch (e) { if (!fit.err) { fit.err = e; console.warn('cabin-fit', e); } }
      if (prev) prev.apply(this, arguments);
    };
  }
  // something new in the scene: a Meshy passenger carries a 'facecup', a crew member has a skinned mesh
  function look(o) {
    if (!o.isGroup) return;
    let cup = null, mesh = null, skinned = null, meshes = 0;
    o.traverse((m) => { if (m.name === 'facecup') cup = m; else if (m.isSkinnedMesh) skinned = m; else if (m.isMesh) { mesh = m; meshes++; } });
    if (cup && mesh && meshes === 1 && !skinned) passenger(o, mesh, cup);
    else if (skinned && skinned.skeleton) crewMember(o, skinned);
  }

  // ------------------------------------------------------------------ passengers
  // The seat as js/cabin3d.js builds it, in metres from the seat's centre on the floor, seen from the passenger
  // (who looks along +z here): seats are 0.48 apart, the cushion's top is at 0.505, the backrest leans back.
  const SEAT = { half: 0.225, top: 0.505, heel: 0.18, knee: 0.5, toe: 0.58 };
  const backAt = (y) => (y < 0.5 ? null : y <= 1.105 ? 0.22 + (y - 0.8) * 0.12 : y <= 1.285 ? 0.28 + (y - 1.19) * 0.12 : null);   // front face of the backrest, then of the headrest
  const SIZE = 0.86, SINK = 0.012, GAP = 0.012, TURN = 0.16;

  function passenger(group, mesh, cup) {
    const geo = mesh.geometry;
    if (!geo.userData.awfFit) { try { geo.userData.awfFit = reshape(group, mesh) || { failed: true }; } catch (e) { geo.userData.awfFit = { failed: true }; console.warn('cabin-fit: passenger', e); } fit.models.push(geo.userData.awfFit); }
    const f = geo.userData.awfFit;
    if (f.failed) return;
    cup.position.set(f.mouth[0], f.mouth[1], f.mouth[2]);
    fit.pax.push(group);
  }
  // the role layer turns the whole figure with the head of the passenger it replaced: keep that inside the seat
  function settle(m) { const a = m.rotation.y - Math.PI; if (a > TURN) m.rotation.y = Math.PI + TURN; else if (a < -TURN) m.rotation.y = Math.PI - TURN; }

  // Reshape one passenger model (all its copies share the geometry). Works in the figure's own space:
  // feet on y = 0, looking along +z, centred on the seat.
  function reshape(group, mesh) {
    const geo = mesh.geometry, pos = geo.attributes.position, n = pos.count, v = new T.Vector3();
    group.updateMatrixWorld(true);
    const M = new T.Matrix4().copy(group.matrixWorld).invert().multiply(mesh.matrixWorld), Mi = new T.Matrix4().copy(M).invert();
    const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), U = new Float32Array(n);
    let H = 0, floor = Infinity;
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(M); X[i] = v.x; Y[i] = v.y; Z[i] = v.z; if (v.y > H) H = v.y; if (v.y < floor) floor = v.y; }
    for (let i = 0; i < n; i++) Y[i] -= floor;
    H -= floor;
    if (!(H > 0.3)) return null;

    // the soles tell where the legs are: everything behind their back edge is body, and its lowest point sits on the cushion
    let zSole = Infinity;
    for (let i = 0; i < n; i++) if (Y[i] < 0.035 * H && Z[i] < zSole) zSole = Z[i];
    const zs = zSole - 0.02 * H;
    let yb = Infinity;
    for (let i = 0; i < n; i++) if (Z[i] < zs && Y[i] < yb) yb = Y[i];
    yb = clamp(yb, 0.1 * H, 0.3 * H);
    const lift = (SEAT.top - SINK) / SIZE - yb;

    // the lower leg is drawn out to keep the feet on the floor. These models have a ring of points at the ankle and
    // one at the knee with nothing between: find that gap (the lowest wide one), keep what is below it and lift the rest.
    const ys = [];
    for (let i = 0; i < n; i++) if (Z[i] >= zs && Y[i] < yb + 0.1 * H) ys.push(Y[i]);
    ys.sort((a, b) => a - b);
    let g0 = 0.07 * H, g1 = Math.max(yb, 0.09 * H), best = -Infinity;
    for (let i = 1; i < ys.length; i++) {
      const a = ys[i - 1], b = ys[i], size = b - a;
      if (size < 0.02 * H || a < 0.04 * H || a > yb - 0.01 * H) continue;
      const score = size - 0.5 * (a - 0.04 * H);
      if (score > best) { best = score; g0 = a; g1 = b; }
    }
    for (let i = 0; i < n; i++) U[i] = Y[i] >= g1 || (Z[i] < zs && Y[i] >= yb - 1e-4) ? 1 : Y[i] <= g0 ? 0 : (Y[i] - g0) / (g1 - g0);

    // elbows and feet inside the seat: squeeze sideways from the highest point that is too wide down, the head stays as it is
    const lim = SEAT.half / SIZE, band = 0.02 * H, wide = [];
    let most = 0, topWide = 0;
    for (let i = 0; i < n; i++) { const b = Math.floor(Y[i] / band), a = Math.abs(X[i]); if (!(wide[b] >= a)) wide[b] = a; }
    for (let b = 0; b < wide.length; b++) if (wide[b] > lim && b * band < 0.8 * H) { topWide = (b + 1) * band; if (wide[b] > most) most = wide[b]; }
    const q = most ? clamp(lim / most, 0.6, 1) : 1;
    const qAt = (y) => (q === 1 ? 1 : q + (1 - q) * smooth((y - topWide) / (0.05 * H)));

    // back against the backrest: move the figure forward until nothing is inside the backrest or the headrest
    let d = -Infinity;
    for (let i = 0; i < n; i++) { const b = backAt(SIZE * (Y[i] + lift * U[i])); if (b != null) d = Math.max(d, (GAP - b) / SIZE - Z[i]); }
    if (!isFinite(d)) d = 0;
    // a figure with its feet under itself would stand inside the seat's base: bring the lower legs forward, the knees with them
    const heel = clamp(SEAT.heel / SIZE - d - zSole, 0, 0.32 * H);
    const legs = (i) => (Z[i] >= zs ? heel * (1 - smooth((Y[i] - (yb - 0.03 * H)) / (0.06 * H))) : 0);
    // and nothing through the seat in front: press the legs together front to back if they reach that far
    const zq = zs + d;
    let kz = 1;
    for (let i = 0; i < n; i++) {
      const z = Z[i] + d + legs(i); if (z <= zq + 0.01) continue;
      const y = SIZE * (Y[i] + lift * U[i]), far = (y < 0.38 ? SEAT.toe : y < 0.8 ? SEAT.knee : Infinity) / SIZE;
      if (z > far) kz = Math.min(kz, (far - zq) / (z - zq));
    }
    kz = clamp(kz, 0.6, 1);

    let face = -Infinity;
    for (let i = 0; i < n; i++) {
      let z = Z[i] + d + legs(i); if (z > zq) z = zq + (z - zq) * kz;
      if (Math.abs(X[i]) < 0.05 * H && Math.abs(Y[i] - 0.755 * H) < 0.035 * H && z > face) face = z;
      v.set(SIZE * X[i] * qAt(Y[i]), SIZE * (Y[i] + lift * U[i]) + floor, SIZE * z).applyMatrix4(Mi);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    if (!isFinite(face)) face = d;
    const r3 = (x) => +x.toFixed(3);
    return { H: r3(H), sole: r3(zSole), seat: r3(yb), ankle: r3(g0), knee: r3(g1), lift: r3(lift), squeeze: r3(q), upTo: r3(topWide), forward: r3(d), heel: r3(heel), press: r3(kz), mouth: [0, SIZE * (0.755 * H + lift), SIZE * face + 0.02] };
  }

  // ------------------------------------------------------------------ the crew
  const glbs = {};
  function parse(name) {
    return glbs[name] || (glbs[name] = new Promise((res) => {
      const b64 = window.KK_GLB && window.KK_GLB[name];
      if (!b64 || !T.GLTFLoader) return res(null);
      try {
        const bin = atob(b64), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        new T.GLTFLoader().parse(buf.buffer, '', (g) => res(poses(g)), () => res(null));
      } catch (e) { res(null); }
    }));
  }
  // from a freshly parsed model: how many points it has (to recognise it), its rest pose and the average of its walk cycle
  function poses(gltf) {
    let mesh = null; const rest = {}, mean = {};
    gltf.scene.traverse((o) => { if (o.isSkinnedMesh) mesh = o; if (o.isBone) rest[o.name] = { q: o.quaternion.clone(), p: o.position.clone() }; });
    const clip = gltf.animations && gltf.animations[0];
    if (!mesh || !clip) return null;
    clip.tracks.forEach((tr) => {
      const dot = tr.name.lastIndexOf('.'), bone = tr.name.slice(0, dot), prop = tr.name.slice(dot + 1), a = tr.values, m = (mean[bone] = mean[bone] || {});
      if (prop === 'quaternion') {
        let x = 0, y = 0, z = 0, w = 0;
        for (let i = 0; i < a.length; i += 4) { const s = a[0] * a[i] + a[1] * a[i + 1] + a[2] * a[i + 2] + a[3] * a[i + 3] < 0 ? -1 : 1; x += s * a[i]; y += s * a[i + 1]; z += s * a[i + 2]; w += s * a[i + 3]; }
        m.q = new T.Quaternion(x, y, z, w).normalize();
      } else if (prop === 'position') {
        let x = 0, y = 0, z = 0; const k = a.length / 3;
        for (let i = 0; i < a.length; i += 3) { x += a[i]; y += a[i + 1]; z += a[i + 2]; }
        m.p = new T.Vector3(x / k, y / k, z / k);
      }
    });
    return { points: mesh.geometry.attributes.position.count, rest, mean };
  }
  const LEG = /UpLeg|Leg|Foot|Toe/;
  function crewMember(outer, mesh) {
    const c = { outer, mesh, name: '', idle: null, w: 1, sp: 0, px: null, pz: null };
    fit.crew.push(c);
    const names = Object.keys(window.KK_GLB || {}).filter((k) => /^crew/.test(k)), points = mesh.geometry.attributes.position.count;
    (function next(i) {
      if (i >= names.length) return;
      parse(names[i]).then((p) => {
        if (!p || p.points !== points) return next(i + 1);
        c.name = names[i];
        // standing: legs and hips as the model was built (straight, feet together), everything above them as the
        // walk cycle carries it on average (arms down, a relaxed back)
        c.idle = mesh.skeleton.bones.map((bone) => {
          const r = p.rest[bone.name], m = p.mean[bone.name] || {}, low = LEG.test(bone.name) || bone.name === 'Hips';
          const q = low ? r && r.q : m.q || (r && r.q);
          return q ? { bone, q: q.clone(), p: bone.name === 'Hips' && r ? r.p.clone() : null, dq: new T.Quaternion(), dp: new T.Vector3(), has: false } : null;
        }).filter(Boolean);
        try { if (c.name === 'crew_att') face(c); } catch (e) { console.warn('cabin-fit: face', e); }
      });
    })(0);
  }
  // Called every frame after the role layer has moved the model and (while walking) written the walk cycle into the bones.
  // Standing still, that layer holds one frame from the middle of a step: blend into the standing pose instead.
  function stand(c, dt) {
    const p = c.outer.position;
    const sp = c.px == null || dt <= 0 ? 0 : Math.hypot(p.x - c.px, p.z - c.pz) / dt; c.px = p.x; c.pz = p.z;
    c.sp += (Math.min(sp, 3) - c.sp) * Math.min(1, dt * 14);
    if (!c.idle) return;
    const moving = c.sp > 0.15;
    c.w = clamp(c.w + (moving ? -dt / 0.22 : dt / 0.3), 0, 1);
    const k = smooth(c.w), a = 1 - Math.exp(-dt * 9);
    for (let i = 0; i < c.idle.length; i++) {
      const b = c.idle[i];
      if (moving || !b.has) { if (k > 0) { b.bone.quaternion.slerp(b.q, k); if (b.p) b.bone.position.lerp(b.p, k); } }   // the bones hold the walk cycle
      else { b.bone.quaternion.copy(b.dq).slerp(b.q, a); if (b.p) b.bone.position.copy(b.dp).lerp(b.p, a); }          // go on from what was shown last
      b.dq.copy(b.bone.quaternion); if (b.p) b.dp.copy(b.bone.position); b.has = true;
    }
  }

  // The attendant's texture has no face. Eyes, brows and a mouth are small shapes on the head bone, placed on the
  // surface of the head as the model has it (measured here, in the bone's own space: y up, z out of the face).
  function face(c) {
    const head = c.mesh.skeleton.bones.find((b) => b.name === 'Head');
    if (!head || head.getObjectByName('awfFace')) return;
    const sk = c.mesh.skeleton, geo = c.mesh.geometry, pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    const own = {}; head.traverse((b) => { const i = sk.bones.indexOf(b); if (i >= 0) own[i] = 1; });
    const toBone = new T.Matrix4().multiplyMatrices(sk.boneInverses[sk.bones.indexOf(head)], c.mesh.bindMatrix), v = new T.Vector3();
    const P = new Float32Array(pos.count * 3), mine = new Uint8Array(pos.count);
    let count = 0;
    for (let i = 0; i < pos.count; i++) {
      const w = (own[si.getX(i)] ? sw.getX(i) : 0) + (own[si.getY(i)] ? sw.getY(i) : 0) + (own[si.getZ(i)] ? sw.getZ(i) : 0) + (own[si.getW(i)] ? sw.getW(i) : 0);
      v.fromBufferAttribute(pos, i).applyMatrix4(toBone); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
      if (w > 0.5) { mine[i] = 1; count++; }
    }
    if (count < 30) return;
    // the bone sits at the chin and its 'head_end' child at the top of the head, 27.3 units up in this model
    const end = head.children.find((k) => k.name === 'head_end'), u = end && end.position.y > 1 ? end.position.y / 27.3 : 1;
    // how far out the surface of the head is at a spot on the face: the frontmost triangle over that spot
    const idx = geo.index, tris = idx ? idx.count / 3 : pos.count / 3;
    const depth = (x, y) => {
      let z = -Infinity;
      for (let t = 0; t < tris; t++) {
        const a = idx ? idx.getX(t * 3) : t * 3, b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, d = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        if (!mine[a] || !mine[b] || !mine[d]) continue;
        const ax = P[a * 3], ay = P[a * 3 + 1], bx = P[b * 3], by = P[b * 3 + 1], dx = P[d * 3], dy = P[d * 3 + 1];
        const den = (by - dy) * (ax - dx) + (dx - bx) * (ay - dy); if (Math.abs(den) < 1e-9) continue;
        const l1 = ((by - dy) * (x - dx) + (dx - bx) * (y - dy)) / den, l2 = ((dy - ay) * (x - dx) + (ax - dx) * (y - dy)) / den, l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        const zz = l1 * P[a * 3 + 2] + l2 * P[b * 3 + 2] + l3 * P[d * 3 + 2]; if (zz > z) z = zz;
      }
      return z;
    };
    const g = new T.Group(); g.name = 'awfFace'; head.add(g);
    const mat = (c2) => new T.MeshLambertMaterial({ color: c2 });
    const dark = mat(0x1a1210), white = mat(0xffffff), lips = mat(0xb5303a), brow = mat(0x2a1a14);
    const F = FACE, eyeY = F.eyeY * u;
    const zL = depth(-F.eyeX * u, eyeY), zR = depth(F.eyeX * u, eyeY);
    if (!isFinite(zL) || !isFinite(zR)) { head.remove(g); return; }
    [-1, 1].forEach((s) => {
      const eyeZ = s < 0 ? zL : zR;
      const e = new T.Mesh(new T.SphereGeometry(1, 14, 10), dark); e.scale.set(F.eyeW * u, F.eyeH * u, 0.6 * u); e.position.set(s * F.eyeX * u, eyeY, eyeZ - 0.15 * u); g.add(e);
      const h = new T.Mesh(new T.SphereGeometry(0.42 * u, 8, 6), white); h.position.set(s * F.eyeX * u + 0.42 * u, eyeY + 0.62 * u, eyeZ + 0.28 * u); g.add(h);
      const bz = depth(s * F.eyeX * u, eyeY + F.browUp * u);
      const b = new T.Mesh(new T.BoxGeometry(F.eyeW * 2.2 * u, 0.42 * u, 0.5 * u), brow); b.position.set(s * F.eyeX * u, eyeY + F.browUp * u, isFinite(bz) ? bz : eyeZ); b.rotation.z = -s * 0.1; g.add(b);
    });
    // a small smile: the lower part of a ring
    const arc = Math.PI * 0.6, mouthY = F.mouthY * u, mz = depth(0, mouthY + F.mouthW * 0.4 * u), mouthZ = isFinite(mz) ? mz : (zL + zR) / 2;
    const m = new T.Mesh(new T.TorusGeometry(F.mouthW * u, 0.3 * u, 6, 14, arc), lips);
    m.rotation.z = -Math.PI / 2 - arc / 2; m.position.set(0, mouthY + F.mouthW * 0.8 * u, mouthZ - 0.05 * u); m.scale.z = 0.7; g.add(m);
    c.face = g;
  }
  // in the head bone's units: the chin is at 0, the hair strands over the forehead end at about 8
  const FACE = { eyeX: 3.3, eyeY: 5.4, eyeW: 1.25, eyeH: 1.6, browUp: 2.5, mouthY: 1.7, mouthW: 1.7 };
  // the same face and standing pose for a crew model shown somewhere else (the attendant visiting the pilot's cockpit, js/cockpit3d.js)
  window.KKCrewFit = { member: crewMember, stand };
})();
