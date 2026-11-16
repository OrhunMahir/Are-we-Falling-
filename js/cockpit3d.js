/* ARE WE FALLING? — 3D cockpit: scene, first-person head look, panel toolkit with instanced
   controls, pilot hands, storm outside. Game rules live in rules.js / modules3d.js. */
(function () {
  'use strict';
  const T = window.THREE;
  const TEX = 1.2;                 // texture pixels per panel millimetre
  const PW = 420, PH = 300;        // panel size (mm)
  const CW = 430, CH = 310;        // slot pitch (mm)
  const MM = 0.001;
  const EYE = new T.Vector3(-0.72, 1.25, 0.18);          // where the pilot's eyes are right now (moves when standing up)
  const SEAT = EYE.clone(), STAND = new T.Vector3(-0.08, 1.72, 1.3);
  const pose = { k: 0, to: 0 };                          // 0 = strapped in the seat, 1 = standing in the aisle
  const FONT = 'Arial, Helvetica, sans-serif';

  // Every surface is a grid of panel slots. r = reading direction, u = "top of text" direction.
  const SURFACES = [
    { id: 'main', name: 'MAIN PANEL', tier: 0, cols: 6, rows: 2, c: [0, 0.746, -1.043], r: [1, 0, 0], u: [0, 0.978, -0.208] },
    { id: 'ovhd', name: 'OVERHEAD', tier: 0, cols: 3, rows: 4, c: [-0.3, 2.2, -0.62], r: [1, 0, 0], u: [0, 0.643, 0.766] },
    { id: 'ped', name: 'PEDESTAL', tier: 0, cols: 2, rows: 4, c: [0, 0.46, -0.235], r: [1, 0, 0], u: [0, 0.065, -0.998] },
    { id: 'left', name: 'LEFT CONSOLE', tier: 0, cols: 3, rows: 2, c: [-1.175, 0.8, 0.14], r: [0, 0, -1], u: [-0.423, 0.906, 0] },
    { id: 'right', name: 'RIGHT CONSOLE', tier: 1, cols: 3, rows: 2, c: [1.175, 0.8, 0.14], r: [0, 0, 1], u: [0.423, 0.906, 0] },
    { id: 'aoh', name: 'AFT OVERHEAD', tier: 1, cols: 3, rows: 2, c: [-0.3, 2.62, 0.2], r: [1, 0, 0], u: [0, 0, 1] },
    { id: 'engr', name: 'ENGINEER STATION', tier: 2, stand: true, cols: 3, rows: 3, c: [1.28, 1.3, 1.75], r: [0, 0, 1], u: [0, 1, 0] },
    { id: 'aftl', name: 'AFT LEFT WALL', tier: 2, stand: true, cols: 3, rows: 3, c: [-1.28, 1.35, 1.75], r: [0, 0, -1], u: [0, 1, 0] },
    { id: 'afta', name: 'AFT WALL', tier: 2, stand: true, cols: 2, rows: 3, c: [-0.82, 1.3, 2.7], r: [-1, 0, 0], u: [0, 1, 0] },
    { id: 'aftb', name: 'AFT WALL', tier: 2, stand: true, cols: 2, rows: 3, c: [0.82, 1.3, 2.7], r: [-1, 0, 0], u: [0, 1, 0] },
  ];
  const FIXED = { 'main:1:0': 'pfd', 'main:2:0': 'data', 'main:3:0': 'eng', 'main:4:0': 'pfd2' };

  let renderer, scene, camera, canvas, skyCanvas, skyTex, skyMesh;
  let boxes, cyls, panelGeom, hl, yoke, alarmL, flashL, bolt, boltT = 0;
  const clouds = [];
  let slots = [], panels = [], pickMeshes = [], blinkers = [], tickers = [];
  const propMeshes = [];
  let bottle = null, drinkT = 0;
  let ashtray = null, smokeT = 0, smokeNow = 0;
  let gen = 0, clock = 0, enabled = false, hover = null, maxAniso = 4;
  let guestMode = false, guestLights = null, guestL = null, storm = null, doorG = null;   // guest mode: this cockpit drawn inside the cabin page, see guest()
  const view = { yaw: 0, pitch: -0.2, fov: 62, tilt: 0 };
  const keys = {};
  const hooks = { onHover: null, onDrink: null, onSmoke: null };

  const _m = new T.Matrix4(), _q = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3(),
    _e = new T.Euler(), _c = new T.Color(), _v = new T.Vector3(), _v2 = new T.Vector3();

  // ------------------------------------------------------------------ geometry helpers
  function bake(geom) {
    // Controls are drawn unlit ("backlit"); face shading is baked into vertex colours.
    const n = geom.attributes.normal, col = new Float32Array(n.count * 3);
    const L = new T.Vector3(-0.35, 0.55, 0.76).normalize();
    for (let i = 0; i < n.count; i++) {
      const d = n.getX(i) * L.x + n.getY(i) * L.y + n.getZ(i) * L.z;
      const s = 0.3 + 0.7 * Math.max(0, d);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = s;
    }
    geom.setAttribute('color', new T.BufferAttribute(col, 3));
    return geom;
  }
  function Pool(geom, max) {
    const mat = new T.MeshBasicMaterial({ vertexColors: true });
    const mesh = new T.InstancedMesh(geom, mat, max);
    mesh.count = 0; mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    _c.set('#000'); mesh.setColorAt(0, _c);
    return { mesh, max, add() { if (mesh.count >= max) return max - 1; return mesh.count++; }, reset() { mesh.count = 0; } };
  }
  function setPart(pool, idx, P, x, y, z, sx, sy, sz, rz, rx) {
    _p.set((x - PW / 2) * MM, (PH / 2 - y) * MM, z * MM);
    _e.set(rx || 0, 0, rz || 0, 'ZXY'); _q.setFromEuler(_e);
    _s.set(sx * MM, sy * MM, sz * MM);
    _m.compose(_p, _q, _s).premultiply(P.matrix);
    pool.mesh.setMatrixAt(idx, _m); pool.mesh.instanceMatrix.needsUpdate = true;
  }
  function setCol(pool, idx, hex) {
    _c.set(hex); pool.mesh.setColorAt(idx, _c); pool.mesh.instanceColor.needsUpdate = true;
  }
  function later(ms, fn) { const g = gen; setTimeout(() => { if (g === gen) fn(); }, ms); }

  // ------------------------------------------------------------------ panel toolkit
  const FACES = ['#2c3138', '#30353b', '#282d33', '#33373c', '#2a3036'];
  function Panel(slot, title, o) {
    o = o || {};
    this.slot = slot; this.matrix = slot.matrix; this.title = title || '';
    this.controls = []; this.keys = {}; this.displays = [];
    const cv = document.createElement('canvas');
    cv.width = Math.round(PW * TEX); cv.height = Math.round(PH * TEX);
    this.canvas = cv; this.ctx = cv.getContext('2d'); this.ctx.scale(TEX, TEX);
    this.tex = new T.CanvasTexture(cv);
    this.tex.colorSpace = T.SRGBColorSpace; this.tex.anisotropy = maxAniso;
    this.mesh = new T.Mesh(panelGeom, new T.MeshBasicMaterial({ map: this.tex }));
    this.mesh.matrixAutoUpdate = false; this.mesh.matrix.copy(slot.matrix); this.mesh.matrixWorld.copy(slot.matrix);
    this.mesh.userData.panel = this;
    scene.add(this.mesh); pickMeshes.push(this.mesh); panels.push(this);
    this.face = o.face || FACES[(slot.index * 7 + 3) % FACES.length];
    this.symbol = o.symbol || null;
    this.drawBase(o);
  }
  const PP = Panel.prototype;
  PP.touch = function () { this.tex.needsUpdate = true; };
  PP.drawBase = function (o) {
    const c = this.ctx;
    c.fillStyle = '#0b0c0e'; c.fillRect(0, 0, PW, PH);
    const g = c.createLinearGradient(0, 0, 0, PH);
    g.addColorStop(0, this.face); g.addColorStop(1, shade(this.face, -0.18));
    c.fillStyle = g; rr(c, 2, 2, PW - 4, PH - 4, 5); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.13)'; c.lineWidth = 1; rr(c, 3, 3, PW - 6, PH - 6, 4.5); c.stroke();
    if (!o.screen) {
      c.fillStyle = 'rgba(0,0,0,0.34)'; c.fillRect(4, 4, PW - 8, 22);
      c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(4, 26, PW - 8, 0.8);
    }
    if (this.symbol) {   // every panel carries a pictogram that changes each flight
      c.fillStyle = '#0c0e10'; rr(c, 4, 2, 44, 36, 6); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.2; rr(c, 4, 2, 44, 36, 6); c.stroke();
      c.font = '27px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
      c.fillText(this.symbol[0], 26, 21.5);
    }
    [[11, 11], [PW - 11, 11], [11, PH - 11], [PW - 11, PH - 11]].forEach(([x, y], i) => {
      if (this.symbol && i === 0) return;
      c.fillStyle = '#1a1c1f'; c.beginPath(); c.arc(x, y, 4.4, 0, 7); c.fill();
      c.fillStyle = '#8b9199'; c.beginPath(); c.arc(x, y, 3.3, 0, 7); c.fill();
      c.strokeStyle = '#2a2d31'; c.lineWidth = 1.1; c.beginPath();
      const a = (this.slot.index * 1.7 + i * 2.1) % 3.14;
      c.moveTo(x - Math.cos(a) * 3, y - Math.sin(a) * 3); c.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); c.stroke();
    });
  };
  PP.text = function (x, y, s, o) {
    o = o || {}; const c = this.ctx, size = o.size || 7.5;
    c.font = (o.bold === false ? '' : 'bold ') + size + 'px ' + (o.mono ? '"Courier New", monospace' : FONT);
    c.fillStyle = o.color || '#dde4eb'; c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    try { c.letterSpacing = (o.spacing || 0.3) + 'px'; } catch (e) {}
    String(s).split('\n').forEach((l, i) => c.fillText(l, x, y + i * (size + 1.5)));
  };
  PP.frame = function (x, y, w, h, label, o) {
    o = o || {}; const c = this.ctx;
    c.strokeStyle = o.color || 'rgba(225,232,240,0.55)'; c.lineWidth = 0.9; rr(c, x, y, w, h, 3); c.stroke();
    if (label) {
      c.font = 'bold 7px ' + FONT; const tw = c.measureText(label).width + 8;
      c.fillStyle = shade(this.face, -0.08); c.fillRect(x + w / 2 - tw / 2, y - 4, tw, 8);
      this.text(x + w / 2, y, label, { size: 7 });
    }
  };
  PP.shadow = function (x, y, w, h, round) {
    const c = this.ctx;
    for (let k = 0; k < 2; k++) {
      c.fillStyle = k ? 'rgba(0,0,0,0.34)' : 'rgba(0,0,0,0.2)'; const g = k ? 0 : 1.6;
      if (round) { c.beginPath(); c.arc(x + 1.2, y + 2.6, w / 2 + 0.6 + g, 0, 7); c.fill(); } else c.fillRect(x - w / 2 - g, y - h / 2 + 1 - g, w + 2 + g * 2, h + 3 + g * 2);
    }
  };
  PP.reg = function (c) {
    const P = this; c.panel = P; P.controls.push(c);
    if (c.key != null) P.keys[c.key] = c;
    c.world = function (out) {
      return (out || new T.Vector3()).set((c.x - PW / 2) * MM, (PH / 2 - c.y) * MM, (c.z || 8) * MM).applyMatrix4(P.matrix);
    };
    return c;
  };
  // push button (optionally lit)
  PP.button = function (x, y, o) {
    o = o || {}; const P = this, w = o.w || 18, h = o.h || 18, d = o.d || 6;
    P.shadow(x, y, w, h);
    if (o.label) P.text(x, y + (o.labelAbove ? -h / 2 - 7 - (String(o.label).split('\n').length - 1) * 8 : h / 2 + 7.5), o.label, { size: o.size || 7, color: o.labelColor });
    const i = boxes.add(); let lit = !!o.lit, out = 0, colOff = o.color || '#474d55', colOn = o.litColor || '#ffb224';
    const place = (dz) => setPart(boxes, i, P, x, y, out + (dz || 0), w, h, d);
    place(0); setCol(boxes, i, lit ? colOn : colOff);
    const c = P.reg({
      x, y, w: w + 4, h: h + 4, z: d, key: o.key, name: o.name || String(o.label || 'BUTTON').replace(/\n/g, ' '),
      press() { place(-d * 0.55); later(130, () => place(0)); if (o.onPress) o.onPress(c); },
      setLit(v, col) { lit = !!v; if (col) colOn = col; setCol(boxes, i, lit ? colOn : colOff); },
      setColor(col) { colOff = col; if (!lit) setCol(boxes, i, col); },
      setOut(z) { out = z; c.z = d + z; place(0); },
      get lit() { return lit; },
    });
    return c;
  };
  // toggle switch
  PP.toggle = function (x, y, o) {
    o = o || {}; const P = this;
    P.shadow(x, y, 13, 13, true);
    if (o.label) P.text(x, y - 21 - (String(o.label).split('\n').length - 1) * 8.5, o.label, { size: o.size || 7 });
    P.text(x, y - 12.5, o.top == null ? 'ON' : o.top, { size: 5.8, color: '#aeb6bf' });
    P.text(x, y + 13.5, o.bot == null ? 'OFF' : o.bot, { size: 5.8, color: '#aeb6bf' });
    const ib = cyls.add(), il = cyls.add(), it = cyls.add(); let on = !!o.on;
    setPart(cyls, ib, P, x, y, 0, 6.5, 6.5, 3); setCol(cyls, ib, '#7d848c');
    const place = () => {
      const a = on ? -0.52 : 0.52;
      setPart(cyls, il, P, x, y, 2, 2.3, 2.3, 15, 0, a);
      setPart(cyls, it, P, x, y - Math.sin(-a) * 15, 2 + Math.cos(a) * 14, 3.3, 3.3, 3.2, 0, a);
    };
    setCol(cyls, il, '#d5dae0'); setCol(cyls, it, o.tip || '#f2f4f6'); place();
    const c = P.reg({
      x, y, w: 22, h: 30, z: 16, key: o.key, name: o.name || String(o.label || 'SWITCH').replace(/\n/g, ' '),
      press() { on = !on; place(); if (o.onChange) o.onChange(on, c); },
      set(v) { on = !!v; place(); },
      get on() { return on; },
    });
    return c;
  };
  // rotary knob: click right half = clockwise, left half = counter-clockwise
  PP.knob = function (x, y, o) {
    o = o || {}; const P = this, r = o.r || 11;
    P.shadow(x, y, r * 2 + 4, r * 2 + 4, true);
    if (o.label) P.text(x, y + r + 10, o.label, { size: o.size || 7 });
    if (o.ticks) {
      const c2 = P.ctx; c2.strokeStyle = '#c9d0d8'; c2.lineWidth = 0.8;
      for (let k = 0; k < o.ticks; k++) {
        const a = -2.2 + (4.4 * k) / (o.ticks - 1);
        c2.beginPath(); c2.moveTo(x + Math.sin(a) * (r + 3.5), y - Math.cos(a) * (r + 3.5)); c2.lineTo(x + Math.sin(a) * (r + 6.5), y - Math.cos(a) * (r + 6.5)); c2.stroke();
      }
    }
    const isk = cyls.add(), ib = cyls.add(), ip = boxes.add(); let a = o.angle || 0;
    setPart(cyls, isk, P, x, y, 0, r + 2.5, r + 2.5, 3); setCol(cyls, isk, '#16181b');
    setPart(cyls, ib, P, x, y, 2.5, r, r, 10); setCol(cyls, ib, o.color || '#2d3238');
    const place = () => setPart(boxes, ip, P, x + Math.sin(a) * r * 0.55, y - Math.cos(a) * r * 0.55, 12.2, 1.8, r * 0.8, 0.8, -a);
    setCol(boxes, ip, '#f4f4f4'); place();
    const c = P.reg({
      x, y, w: r * 2 + 6, h: r * 2 + 6, z: 13, key: o.key, name: o.name || String(o.label || 'KNOB').replace(/\n/g, ' '),
      turn(dir) { a += dir * (o.step || 0.5236); place(); if (o.onTurn) o.onTurn(dir, c); },
      press(hx) { c.turn(hx != null && hx < x ? -1 : 1); },
      setAngle(v) { a = v; place(); },
    });
    return c;
  };
  // circuit breaker
  PP.breaker = function (x, y, o) {
    o = o || {}; const P = this, s = o.s || 1;
    P.shadow(x, y, 14 * s, 14 * s, true);
    if (o.label) P.text(x, y + 9 * s + 6, o.label, { size: o.size || 6.5 });
    const ic = cyls.add(), is = cyls.add(); let out = !!o.out;
    setPart(cyls, ic, P, x, y, 0, 7 * s, 7 * s, 2.6 * s); setCol(cyls, ic, o.color || '#15171a');
    const place = () => { setPart(cyls, is, P, x, y, 2 * s, 4.7 * s, 4.7 * s, (out ? 13 : 4.5) * s); setCol(cyls, is, out ? '#e9ebee' : (o.cap || '#0d0e10')); };
    place();
    const c = P.reg({
      x, y, w: 16 * s, h: 16 * s, z: 8 * s, key: o.key, name: o.name || String(o.label || 'BREAKER').replace(/\n/g, ' '),
      press() { if (o.onPull) o.onPull(c); else { out = !out; place(); } },
      setOut(v) { out = !!v; place(); },
      get out() { return out; },
    });
    return c;
  };
  // indicator lamp (not clickable)
  PP.lamp = function (x, y, o) {
    o = o || {}; const P = this, w = o.w || 12, h = o.h || 7;
    if (o.label) P.text(x, y + (o.labelAbove ? -h / 2 - 6 : h / 2 + 6.5), o.label, { size: o.size || 6.5 });
    const c2 = P.ctx; c2.fillStyle = '#0a0b0c'; c2.fillRect(x - w / 2 - 1.2, y - h / 2 - 1.2, w + 2.4, h + 2.4);
    const i = boxes.add(); let on = !!o.on, color = o.color || '#ffb224', bl = null;
    setPart(boxes, i, P, x, y, 0, w, h, 2.4);
    const show = (v) => setCol(boxes, i, v ? color : shade(color, -0.86));
    show(on);
    const L = {
      set(v, col) { if (col) color = col; on = !!v; if (bl) { bl.dead = true; bl = null; } show(on); return L; },
      blink(hz, col) { if (col) color = col; if (bl) bl.dead = true; const ph = Math.random(); bl = { fn(t) { show(((t * hz + ph) % 1) < 0.5); } }; blinkers.push(bl); return L; },
      get on() { return on; },
    };
    return L;
  };
  // dynamic canvas region (gauges, digits, text)
  PP.display = function (x, y, w, h, fn) {
    const P = this, d = { redraw() { P.ctx.save(); fn(P.ctx, x, y, w, h, P); P.ctx.restore(); P.touch(); } };
    P.ctx.save(); fn(P.ctx, x, y, w, h, P); P.ctx.restore();
    P.displays.push(d); return d;
  };
  // dark glass window with glowing text, used by many displays
  PP.glass = function (x, y, w, h) {
    const c = this.ctx; c.fillStyle = '#050607'; rr(c, x, y, w, h, 2.5); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 0.8; rr(c, x, y, w, h, 2.5); c.stroke();
  };
  // crank wheel
  PP.wheel = function (x, y, o) {
    o = o || {}; const P = this, r = o.r || 28;
    P.shadow(x, y, r * 2, r * 2, true);
    const iw = cyls.add(), ih = cyls.add(), ig = cyls.add(); let a = 0;
    setPart(cyls, iw, P, x, y, 0, r, r, 6); setCol(cyls, iw, '#30353b');
    setPart(cyls, ih, P, x, y, 5, 7, 7, 5); setCol(cyls, ih, '#9aa1a9');
    const place = () => setPart(cyls, ig, P, x + Math.sin(a) * r * 0.68, y - Math.cos(a) * r * 0.68, 5, 4.6, 4.6, 17);
    setCol(cyls, ig, '#d23b2a'); place();
    const c = P.reg({
      x, y, w: r * 2, h: r * 2, z: 20, key: o.key, name: o.name || 'CRANK',
      turn(dir) { if (o.onTurn) o.onTurn(dir, c); },
      press(hx) { c.turn(hx != null && hx < x ? -1 : 1); },
      setAngle(v) { a = v; place(); },
    });
    return c;
  };
  // title-bar status lamp
  PP.status = function () {
    if (!this._st) this._st = this.lamp(PW - 30, 15, { w: 13, h: 7, color: '#39d98a' });
    return this._st;
  };

  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function shade(hex, k) {
    _c.set(hex); const f = (v) => Math.max(0, Math.min(255, Math.round((k < 0 ? v * (1 + k) : v + (1 - v) * k) * 255)));
    const o = { r: 0, g: 0, b: 0 }; _c.getRGB(o, T.SRGBColorSpace);
    return 'rgb(' + f(o.r) + ',' + f(o.g) + ',' + f(o.b) + ')';
  }

  // ------------------------------------------------------------------ static scene
  function lam(color) { return new T.MeshLambertMaterial({ color }); }
  function B(w, h, d, x, y, z, mat, parent) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), typeof mat === 'string' ? lam(mat) : mat);
    if (m.material.userData.tile) tileUV(m.geometry, w, h, d, m.material.userData.tile);
    m.position.set(x, y, z); (parent || scene).add(m); return m;
  }
  // A box's faces each get the whole texture by default, so one tile would stretch over a 2.7 m wall and shrink on a
  // 0.3 m console. Scale each face's uv by its size in metres instead: every surface shows the texture at the same density.
  function tileUV(geo, w, h, d, size) {
    const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // +x -x +y -y +z -z
    for (let i = 0; i < uv.count; i++) { const f = dims[Math.floor(i / 4)] || dims[0]; uv.setXY(i, uv.getX(i) * f[0] / size, uv.getY(i) * f[1] / size); }
    uv.needsUpdate = true;
  }
  // ---- the shell's surfaces: lined wall panels with screws, a padded ceiling, ribbed rubber floor, console metal and
  // seat fabric. Drawn once on small canvases and tiled by tileUV(). The colours stay close to the old flat ones.
  const surfs = {};
  function surf(kind) {
    if (surfs[kind]) return surfs[kind];
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    let seed = kind.length * 977 + 13; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const noise = (n, a, sz) => { for (let i = 0; i < n; i++) { const v = rnd() < 0.5 ? 0 : 255; x.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (a * rnd()) + ')'; x.fillRect(rnd() * S, rnd() * S, sz, sz); } };
    const screw = (sx, sy, r) => { x.fillStyle = 'rgba(0,0,0,0.55)'; x.beginPath(); x.arc(sx, sy + 0.8, r, 0, 7); x.fill(); x.fillStyle = 'rgba(190,198,208,0.55)'; x.beginPath(); x.arc(sx, sy, r * 0.8, 0, 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 1; x.beginPath(); x.moveTo(sx - r * 0.6, sy); x.lineTo(sx + r * 0.6, sy); x.stroke(); };
    const seam = (rx, ry, rw, rh, r) => { x.lineWidth = 2; x.strokeStyle = 'rgba(0,0,0,0.6)'; rr(x, rx, ry, rw, rh, r); x.stroke(); x.lineWidth = 1; x.strokeStyle = 'rgba(255,255,255,0.09)'; rr(x, rx + 2, ry + 2, rw - 4, rh - 4, r); x.stroke(); };
    let size = 0.8;
    if (kind === 'wall') {             // one tile: one 0.8 m panel, slightly brushed, a screw in each corner
      const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#33373e'); g.addColorStop(1, '#282b31'); x.fillStyle = g; x.fillRect(0, 0, S, S);
      for (let i = 0; i < 140; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.012 + rnd() * 0.02) + ')'; x.fillRect(0, rnd() * S, S, 1); }
      noise(1600, 0.07, 1); seam(3, 3, S - 6, S - 6, 10);
      [[16, 16], [S - 16, 16], [16, S - 16], [S - 16, S - 16]].forEach((q) => screw(q[0], q[1], 4));
      x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(40, S * 0.62, S - 80, 3);   // a pressed rib across the panel
      x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(40, S * 0.62 + 3, S - 80, 1);
    } else if (kind === 'ceil') {      // padded headliner: soft quilted squares
      size = 0.6; x.fillStyle = '#3c4047'; x.fillRect(0, 0, S, S);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const g = x.createRadialGradient(i * 128 + 64, j * 128 + 60, 6, i * 128 + 64, j * 128 + 64, 78); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
        x.fillStyle = g; x.fillRect(i * 128, j * 128, 128, 128); x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 2; x.strokeRect(i * 128 + 1, j * 128 + 1, 126, 126);
      }
      noise(2600, 0.06, 1);
    } else if (kind === 'floor') {     // ribbed rubber mat
      size = 0.5; x.fillStyle = '#191b1f'; x.fillRect(0, 0, S, S); noise(2400, 0.08, 1);
      for (let yy = 8; yy < S; yy += 16) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, yy, S, 4); x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(0, yy + 4, S, 1); }
    } else if (kind === 'dark') {      // console and glareshield metal: near black, fine grain, a screw now and then
      size = 0.5; x.fillStyle = '#18191d'; x.fillRect(0, 0, S, S); noise(3000, 0.07, 1);
      seam(2, 2, S - 4, S - 4, 6); [[12, 12], [S - 12, 12], [12, S - 12], [S - 12, S - 12]].forEach((q) => screw(q[0], q[1], 3));
    } else if (kind === 'trim') {      // window posts and frames: painted, a little lighter
      size = 0.4; x.fillStyle = '#3d4148'; x.fillRect(0, 0, S, S); noise(2000, 0.06, 1);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, S / 2 - 1, S, 2);
    } else if (kind === 'seat') {      // woven seat fabric with stitched panels
      size = 0.25; x.fillStyle = '#2b3848'; x.fillRect(0, 0, S, S);
      for (let i = 0; i < S; i += 3) { x.fillStyle = 'rgba(0,0,0,' + (0.08 + rnd() * 0.08) + ')'; x.fillRect(i, 0, 1, S); x.fillStyle = 'rgba(255,255,255,' + (0.02 + rnd() * 0.03) + ')'; x.fillRect(0, i, S, 1); }
      x.setLineDash([5, 4]); x.strokeStyle = 'rgba(160,175,195,0.35)'; x.lineWidth = 1.5; x.strokeRect(10, 10, S - 20, S - 20); x.setLineDash([]);
    }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = maxAniso;
    const mat = new T.MeshLambertMaterial({ map: t }); mat.userData.tile = size;
    return (surfs[kind] = mat);
  }
  // the cockpit door: a reinforced panel with a viewer, a placard and a kick plate (one texture over the whole face)
  function doorMat() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 384; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, '#41464e'); g.addColorStop(0.5, '#4b5058'); g.addColorStop(1, '#3d4249'); x.fillStyle = g; x.fillRect(0, 0, 128, 384);
    x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 2; rr(x, 10, 12, 108, 150, 6); x.stroke(); rr(x, 10, 176, 108, 150, 6); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = 1; rr(x, 12, 14, 104, 146, 5); x.stroke(); rr(x, 12, 178, 104, 146, 5); x.stroke();
    x.fillStyle = '#0c0e12'; x.beginPath(); x.arc(64, 70, 6, 0, 7); x.fill(); x.strokeStyle = '#9aa1a9'; x.lineWidth = 2; x.beginPath(); x.arc(64, 70, 7, 0, 7); x.stroke();
    x.fillStyle = '#c9a227'; x.fillRect(30, 104, 68, 18); x.fillStyle = '#111'; x.font = 'bold 9px monospace'; x.textAlign = 'center'; x.fillText('FLIGHT DECK', 64, 116);
    x.fillStyle = '#5c626b'; x.fillRect(4, 340, 120, 40); for (let i = 8; i < 124; i += 8) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(i, 344, 2, 32); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = maxAniso;
    return new T.MeshLambertMaterial({ map: t });
  }

  function buildSlots() {
    slots = [];
    SURFACES.forEach((sf) => {
      const r = new T.Vector3().fromArray(sf.r).normalize(), u = new T.Vector3().fromArray(sf.u).normalize();
      const n = new T.Vector3().crossVectors(r, u).normalize();
      const c = new T.Vector3().fromArray(sf.c);
      for (let row = 0; row < sf.rows; row++) for (let col = 0; col < sf.cols; col++) {
        const pos = c.clone().addScaledVector(r, (col - (sf.cols - 1) / 2) * CW * MM).addScaledVector(u, ((sf.rows - 1) / 2 - row) * CH * MM);
        const matrix = new T.Matrix4().makeBasis(r, u, n).setPosition(pos);
        const id = sf.id + ':' + col + ':' + row;
        slots.push({ id, index: slots.length, surf: sf, col, row, tier: sf.tier, fixed: FIXED[id] || null, matrix, inv: matrix.clone().invert(), pos, normal: n, up: u });
      }
    });
  }

  function buildShell() {
    const wall = surf('wall'), dark = surf('dark'), trim = surf('trim'), seat = surf('seat');
    B(2.8, 0.05, 4.2, 0, -0.025, 0.7, surf('floor'));
    B(2.8, 0.05, 4.2, 0, 2.725, 0.7, surf('ceil'));
    const lens = new T.Mesh(new T.CircleGeometry(0.11, 20), new T.MeshBasicMaterial({ color: '#fff1d6' })); lens.rotation.x = Math.PI / 2; lens.position.set(0, 2.698, 0.9); scene.add(lens);   // the dome light's lens
    B(0.3, 0.012, 0.3, 0, 2.7, 0.9, trim);
    B(2.7, 0.95, 0.06, 0, 2.245, -1.28, wall);            // wall above windshield
    B(2.7, 1.12, 0.06, 0, 0.56, -1.28, dark);              // below windshield
    B(0.07, 0.66, 0.07, 0, 1.44, -1.25, trim);
    [-1, 1].forEach((s) => {
      B(0.1, 0.66, 0.1, s * 1.3, 1.44, -1.25, trim);
      B(0.06, 1.12, 2.0, s * 1.35, 0.56, -0.28, wall);
      B(0.06, 0.95, 2.0, s * 1.35, 2.245, -0.28, wall);
      B(0.06, 0.66, 0.08, s * 1.35, 1.44, -0.25, trim);
      B(0.06, 2.7, 2.1, s * 1.35, 1.35, 1.77, wall);
      B(0.32, 0.5, 1.36, s * 1.19, 0.25, 0.14, dark);     // side console body
    });
    if (guestMode) {   // seen by a cabin seat: a real doorway (the cabin's own door hangs in it), a back for the captain's seat, pedals under the feet
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
      B(0.62, 1.92, 0.03, 0.31, 0.96, 0, doorMat(), doorG);    // cockpit door
      [-1, 1].forEach((sd) => B(0.05, 1.98, 0.05, sd * 0.335, 0.99, 2.76, trim)); B(0.72, 0.05, 0.05, 0, 1.97, 2.76, trim);   // door frame
      B(0.03, 0.12, 0.05, 0.53, 1.0, -0.03, lam('#b9bec5'), doorG);
    }
    B(2.66, 0.035, 0.52, 0, 1.128, -1.02, dark);           // glareshield
    B(2.66, 0.72, 0.03, 0, 0.78, -1.1, dark).rotation.x = -0.21;
    B(0.9, 0.4, 1.26, 0, 0.2, -0.235, dark);               // pedestal body
    B(1.4, 0.03, 1.3, -0.3, 2.223, -0.639, dark).rotation.x = -0.698; B(1.4, 0.03, 0.68, -0.3, 2.645, 0.2, dark);
    // seats
    B(0.5, 0.12, 0.5, 0.72, 0.45, 0.66, seat); B(0.5, 0.7, 0.09, 0.72, 0.8, 0.93, seat); B(0.14, 0.45, 0.14, 0.72, 0.2, 0.66, dark);   // slid back on its rails: its back used to hide the right console
    B(0.5, 0.12, 0.5, -0.72, 0.45, 0.3, seat); B(0.14, 0.45, 0.14, -0.72, 0.2, 0.3, dark);
    B(0.46, 0.1, 0.46, 0.5, 0.45, 2.0, seat); B(0.12, 0.45, 0.12, 0.5, 0.2, 2.0, dark); B(0.44, 0.56, 0.08, 0.5, 0.79, 2.24, seat);   // observer seat with its back
    // thrust levers on the pedestal's front edge (decor)
    [-0.05, 0.05].forEach((x) => { B(0.03, 0.2, 0.03, x, 0.6, -0.9, lam('#9aa1a9')).rotation.x = 0.35; B(0.06, 0.045, 0.05, x, 0.7, -0.865, lam('#e9ebee')); });
    makeBottle(); makeBobble(); makeAshtray();
    // yokes
    yoke = makeYoke(-0.72); makeYoke(0.72);
    // lights
    if (guestMode) {   // the host scene has its own ambient light; these three stay inside the cockpit (a range each) and tick() sets how bright they are
      guestL = [[0xffe2b8, 5, 0, 2.3, 0.9, 4.6], [0x9fc0ff, 2.5, 0, 1.5, -0.6, 4], [0xff2a1a, 0, 0, 1.7, -0.3, 4]].map((d) => { const l = new T.PointLight(d[0], 0, d[5], 2); l.position.set(d[2], d[3], d[4]); l.userData.base = d[1]; guestLights.add(l); return l; });
      alarmL = guestL[2];
      return;
    }
    scene.add(new T.AmbientLight(0x9aa6bc, 2.2));
    const dome = new T.PointLight(0xffe2b8, 5, 0, 2); dome.position.set(0, 2.3, 0.9); scene.add(dome);
    const fwd = new T.PointLight(0x9fc0ff, 2.5, 0, 2); fwd.position.set(0, 1.5, -0.6); scene.add(fwd);
    alarmL = new T.PointLight(0xff2a1a, 0, 0, 2); alarmL.position.set(0, 1.7, -0.3); scene.add(alarmL);
    flashL = new T.DirectionalLight(0xcfe0ff, 0); flashL.position.set(0.2, 1, -2); scene.add(flashL);
  }
  // the captain's whiskey: a clickable prop on the glareshield
  function makeBottle() {
    const g = new T.Group(); const home = new T.Vector3(-1.02, 1.146, -0.93); g.position.copy(home);
    const glass = new T.MeshPhongMaterial({ color: '#7a3d10', emissive: '#2a1203', specular: '#ffffff', shininess: 120, transparent: true, opacity: 0.55, side: T.DoubleSide });
    const whisky = new T.MeshPhongMaterial({ color: '#d98a1e', emissive: '#7a3f06', specular: '#ffd9a0', shininess: 60, transparent: true, opacity: 0.92 });
    // a proper bottle silhouette: heel, body, shoulder, neck, lip
    const prof = [[0, 0], [0.037, 0], [0.041, 0.006], [0.041, 0.158], [0.039, 0.172], [0.03, 0.19], [0.018, 0.208], [0.0145, 0.222], [0.0145, 0.262], [0.0175, 0.266], [0.0175, 0.274], [0.0135, 0.276]];
    const body = new T.Mesh(new T.LatheGeometry(prof.map((p) => new T.Vector2(p[0], p[1])), 28), glass); g.add(body);
    const liquid = new T.Mesh(new T.CylinderGeometry(0.0375, 0.0375, 0.15, 24).translate(0, 0.075, 0), whisky); liquid.position.y = 0.006; g.add(liquid);
    // label: cream paper with a little aircraft
    const lc = document.createElement('canvas'); lc.width = 512; lc.height = 200; const x = lc.getContext('2d');
    x.fillStyle = '#efe4c8'; x.fillRect(0, 0, 512, 200); x.strokeStyle = '#7a1410'; x.lineWidth = 6; x.strokeRect(10, 10, 492, 180); x.lineWidth = 2; x.strokeRect(20, 20, 472, 160);
    x.fillStyle = '#7a1410'; x.textAlign = 'center'; x.font = 'bold 22px Georgia, serif'; x.fillText('★  FINEST  CRUISING  ★', 256, 52);
    x.fillStyle = '#1b1712'; x.font = 'bold 50px Georgia, serif'; x.fillText('OLD ALTITUDE', 256, 108);
    x.font = 'italic 24px Georgia, serif'; x.fillText('Captain’s Reserve · 40%', 256, 144); x.font = '16px Georgia, serif'; x.fillText('AGED 35,000 FEET', 256, 170);
    const lt = new T.CanvasTexture(lc); lt.colorSpace = T.SRGBColorSpace; lt.anisotropy = 4;
    const label = new T.Mesh(new T.CylinderGeometry(0.0416, 0.0416, 0.07, 28, 1, true, -1.25, 2.5), new T.MeshLambertMaterial({ map: lt, emissive: '#3a352a' })); label.position.y = 0.082; label.rotation.y = 0.55; g.add(label);
    const cap = new T.Mesh(new T.CylinderGeometry(0.0185, 0.0185, 0.03, 20), new T.MeshPhongMaterial({ color: '#c9a54a', specular: '#fff3c0', shininess: 90 })); cap.position.y = 0.288; g.add(cap);
    const seal = new T.Mesh(new T.CylinderGeometry(0.0152, 0.0152, 0.03, 20), lam('#7a1410')); seal.position.y = 0.245; g.add(seal);
    const proxy = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.34, 8), new T.MeshBasicMaterial()); proxy.position.set(home.x, 1.3, home.z); proxy.visible = false; scene.add(proxy);
    const ctrl = { name: 'WHISKEY · TAKE A SIP', x: 0, y: 0, w: 0, h: 0, panel: null, world(out) { return (out || new T.Vector3()).copy(home).setY(home.y + 0.2); }, press() { if (drinkT <= 0 && smokeT <= 0 && (!hooks.onDrink || hooks.onDrink() !== false)) drinkT = 1.5; } };
    api.bottle = ctrl; proxy.userData.ctrl = ctrl; propMeshes.push(proxy); pickMeshes.push(proxy);
    scene.add(g); bottle = { g, home, liquid };
  }
  function updateBottle(dt) {
    if (!bottle) return;
    const lv = env.bottle == null ? 1 : Math.max(0.03, env.bottle);
    bottle.liquid.scale.y += (lv - bottle.liquid.scale.y) * Math.min(1, dt * 3);
    if (drinkT > 0) {
      drinkT -= dt; const k = Math.sin(Math.min(1, Math.max(0, 1 - drinkT / 1.5)) * Math.PI);   // out and back
      _v.set(0, 0, -1).applyQuaternion(camera.quaternion); _p.copy(camera.position).addScaledVector(_v, 0.3); _p.y -= 0.2;
      bottle.g.position.lerpVectors(bottle.home, _p, k); bottle.g.rotation.x = k * 1.9; bottle.g.rotation.y = view.yaw;
    } else { bottle.g.position.copy(bottle.home); bottle.g.rotation.set(0, 0, 0); }
  }

  // the captain's ashtray: one drag clears the head, too many fill the cockpit with smoke
  function makeAshtray() {
    const home = new T.Vector3(-0.62, 1.146, -0.88), g = new T.Group(); g.position.copy(home);
    const chrome = new T.MeshPhongMaterial({ color: '#8d949c', specular: '#ffffff', shininess: 110 });
    const dish = new T.Mesh(new T.CylinderGeometry(0.052, 0.043, 0.02, 24), chrome); dish.position.y = 0.01; g.add(dish);
    const ash = new T.Mesh(new T.CylinderGeometry(0.043, 0.043, 0.004, 24), lam('#34322f')); ash.position.y = 0.0205; g.add(ash);
    [[0.014, 0.6], [-0.016, -1.1], [0.002, 2.2]].forEach((b) => { const st = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, 0.024, 8).rotateX(Math.PI / 2), lam('#d9cdb8')); st.rotation.y = b[1]; st.position.set(b[0], 0.027, b[0] * 0.9 - 0.006); g.add(st); });
    scene.add(g);
    // the lit one rests on the rim: ember at -z, filter at +z
    const cig = new T.Group();
    cig.add(new T.Mesh(new T.CylinderGeometry(0.0042, 0.0042, 0.062, 10).rotateX(Math.PI / 2).translate(0, 0, -0.013), lam('#f3f0e8')));
    cig.add(new T.Mesh(new T.CylinderGeometry(0.0044, 0.0044, 0.024, 10).rotateX(Math.PI / 2).translate(0, 0, 0.03), lam('#c9853a')));
    // the burning end: a thin glowing band under a grey ash tip, and a small soft halo that breathes
    const emberMat = new T.MeshBasicMaterial({ color: '#d94a12' });
    const ember = new T.Mesh(new T.CylinderGeometry(0.0041, 0.0042, 0.0035, 12).rotateX(Math.PI / 2), emberMat); ember.position.z = -0.0455; cig.add(ember);
    const ashTip = new T.Mesh(new T.CylinderGeometry(0.0032, 0.004, 0.0045, 12).rotateX(Math.PI / 2), lam('#6d6862')); ashTip.position.z = -0.0495; cig.add(ashTip);
    const gc = document.createElement('canvas'); gc.width = gc.height = 64; const gx = gc.getContext('2d');
    const gg = gx.createRadialGradient(32, 32, 0, 32, 32, 32); gg.addColorStop(0, 'rgba(255,200,120,1)'); gg.addColorStop(0.18, 'rgba(255,120,40,0.75)'); gg.addColorStop(0.5, 'rgba(255,70,10,0.18)'); gg.addColorStop(1, 'rgba(255,60,0,0)'); gx.fillStyle = gg; gx.fillRect(0, 0, 64, 64);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(gc), transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, opacity: 0.5 }));
    glow.position.z = -0.047; glow.scale.setScalar(0.016); cig.add(glow);
    const rest = new T.Vector3(home.x + 0.034, home.y + 0.031, home.z + 0.022); cig.position.copy(rest); cig.rotation.set(0.28, 0.75, 0); scene.add(cig);   // NB: the stub must stay above the dish so the hand can pinch it
    const restQ = cig.quaternion.clone();
    const pc = document.createElement('canvas'); pc.width = pc.height = 64; const x = pc.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const ptex = new T.CanvasTexture(pc);
    const mk = () => { const sp = new T.Sprite(new T.SpriteMaterial({ map: ptex, transparent: true, depthWrite: false, fog: false, opacity: 0, color: 0xd2d3cf })); sp.visible = false; sp.material.rotation = Math.random() * 6.28; scene.add(sp); return sp; };
    const puffs = []; for (let i = 0; i < 40; i++) { const sp = mk(); sp.userData = { life: 1, max: 1, v: new T.Vector3(), s0: 0, s1: 0, a: 0 }; puffs.push(sp); }
    const haze = []; for (let i = 0; i < 16; i++) { const sp = mk(); const sc = 0.9 + Math.random() * 1.1; sp.scale.set(sc * 1.4, sc, 1); sp.userData = { x: -1.3 + Math.random() * 2.6, y: 0.85 + Math.random() * 1.1, z: -1.0 + Math.random() * 1.2, a: 0.09 + Math.random() * 0.1 }; sp.position.set(sp.userData.x, sp.userData.y, sp.userData.z); haze.push(sp); }
    const proxy = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.13, 8), new T.MeshBasicMaterial()); proxy.position.set(home.x, home.y + 0.05, home.z); proxy.visible = false; scene.add(proxy);
    const ctrl = { name: 'ASHTRAY · HAVE A SMOKE', x: 0, y: 0, w: 0, h: 0, panel: null, world(out) { return (out || new T.Vector3()).copy(home).setY(home.y + 0.05); }, press() { if (smokeT <= 0 && drinkT <= 0 && (!hooks.onSmoke || hooks.onSmoke() !== false)) { smokeT = SMOKE_DUR; smokeHand.hide = hands.find((h) => h.ctrl === ctrl) || hands[0]; smokeHand.hide.phase = 'rest'; smokeHand.hide.cb = null; smokeHand.hide.ctrl = null; smokeHand.hide.reachK = 0; } } };
    api.ashtray = ctrl; proxy.userData.ctrl = ctrl; propMeshes.push(proxy); pickMeshes.push(proxy);
    ashtray = { cig, ember, emberMat, glow, rest, restQ, puffs, haze, wt: 0, blown: false, tip: new T.Vector3(), held: false };
    makeSmokeHand();
  }
  // ---- the hand that smokes it: index and middle finger around the filter, up to the lips and back
  const SMOKE_DUR = 3.0;
  const smokeHand = { g: null, arm: null, hide: null };
  const _hq = new T.Quaternion(), _hq2 = new T.Quaternion(), _hp = new T.Vector3(), _hp2 = new T.Vector3(), _hb = new T.Matrix4(),
    _hx = new T.Vector3(), _hy = new T.Vector3(), _hz = new T.Vector3(), CIG_IN_HAND = new T.Vector3(0, 0.03, -0.015);
  function makeSmokeHand() {
    // local frame: fingers along +y, the cigarette crosses them along z (ember -z), thumb on -x (it is the left hand)
    const g = new T.Group(), skin = lam('#d19a76'), nail = lam('#e7c3ad'), cuff = lam('#eef0f3'), gold = lam('#d8b24a');
    const fing = (x, len, rz) => { const f = new T.Group(); f.position.set(x, 0, 0); f.rotation.z = rz; g.add(f); B(0.0155, len, 0.015, 0, len / 2, 0, skin, f); B(0.011, 0.008, 0.003, 0, len - 0.006, -0.0072, nail, f); return f; };
    fing(-0.0115, 0.074, 0.11);    // index
    fing(0.0115, 0.08, -0.11);     // middle: the stub sits between the two
    [[0.03, 0.0], [0.045, 0.004]].forEach((r) => { B(0.0148, 0.026, 0.02, r[0] - 0.002, 0.004, 0.011 + r[1], skin, g); });   // ring and little finger curled into the palm
    B(0.072, 0.085, 0.027, 0.006, -0.043, 0.004, skin, g);    // palm
    const th = B(0.02, 0.055, 0.02, -0.04, -0.03, 0.012, skin, g); th.rotation.z = 0.55; th.rotation.x = -0.3;
    const cm = new T.Mesh(new T.CylinderGeometry(0.043, 0.046, 0.05, 12), cuff); cm.position.set(0.004, -0.11, 0.004); g.add(cm);
    [0.135, 0.142].forEach((y) => { const r = new T.Mesh(new T.CylinderGeometry(0.0468, 0.0472, 0.005, 12), gold); r.position.set(0.004, -y, 0.004); g.add(r); });
    const arm = new T.Mesh(new T.CylinderGeometry(0.044, 0.052, 1, 12).rotateX(Math.PI / 2).translate(0, 0, 0.5), lam('#1a2438'));
    g.visible = arm.visible = false; scene.add(g); scene.add(arm);
    smokeHand.g = g; smokeHand.arm = arm;
  }
  // a hand pose from where the filter should be (camera space), which way the ember points, and which way the fingers lean
  function camPose(fx, fy, fz, dx, dy, dz, ux, uy, uz, outP, outQ) {
    _hz.set(-dx, -dy, -dz).normalize(); _hy.set(ux, uy, uz); _hy.addScaledVector(_hz, -_hy.dot(_hz)).normalize(); _hx.crossVectors(_hy, _hz);
    _hb.makeBasis(_hx, _hy, _hz); outQ.setFromRotationMatrix(_hb).premultiply(camera.quaternion);
    // filter end of the stub = CIG_IN_HAND + 0.042 along z
    outP.set(0, CIG_IN_HAND.y, CIG_IN_HAND.z + 0.042).applyQuaternion(outQ).negate();
    _v2.set(fx, fy, fz).applyQuaternion(camera.quaternion).add(camera.position); outP.add(_v2);
  }
  function pickPose(outP, outQ) {   // fingers down over the dish, pinching the stub where it lies
    outQ.copy(ashtray.restQ).multiply(_hq2.setFromAxisAngle(_v2.set(0, 0, 1), Math.PI * 0.86));
    outP.copy(CIG_IN_HAND).applyQuaternion(outQ).negate().add(ashtray.rest);
  }
  const _pa = new T.Vector3(), _qa = new T.Quaternion(), _pb = new T.Vector3(), _qb = new T.Quaternion();
  function seg(u, a, b) { const k = Math.max(0, Math.min(1, (u - a) / (b - a))); return k * k * (3 - 2 * k); }
  function poseSmokeHand(u) {
    const a = ashtray, g = smokeHand.g;
    if (!a.held) { a.held = true; g.add(a.cig); a.cig.position.copy(CIG_IN_HAND); a.cig.quaternion.identity(); }
    let drag = 0;
    const mouth = (p, q) => camPose(-0.02, -0.06 + Math.sin(clock * 2) * 0.002, -0.12, -1, 0.5, -0.7, 0.2, 1, -0.5, p, q);
    const low = (p, q) => camPose(-0.12, -0.11, -0.26, -0.6, 0.4, -1, 0.1, 1, -0.3, p, q);
    if (u < 0.27) {                      // pinch it and bring it up
      pickPose(_pa, _qa); mouth(_pb, _qb); const k = seg(u, 0.05, 0.27);
      g.position.lerpVectors(_pa, _pb, k); g.position.y += Math.sin(k * Math.PI) * 0.06; g.quaternion.slerpQuaternions(_qa, _qb, k);
    } else if (u < 0.47) {               // the drag
      mouth(_pb, _qb); drag = seg(u, 0.29, 0.34) * (1 - seg(u, 0.44, 0.47));
      _hp.set(0, 0, 0.006 * drag).applyQuaternion(camera.quaternion); g.position.copy(_pb).add(_hp); g.quaternion.copy(_qb);
    } else if (u < 0.65) {               // away from the face, breathe out
      mouth(_pa, _qa); low(_pb, _qb); const k = seg(u, 0.47, 0.56);
      g.position.lerpVectors(_pa, _pb, k); g.quaternion.slerpQuaternions(_qa, _qb, k);
    } else if (u < 0.88) {               // back on the rim
      low(_pa, _qa); pickPose(_pb, _qb); const k = seg(u, 0.65, 0.88);
      g.position.lerpVectors(_pa, _pb, k); g.position.y += Math.sin(k * Math.PI) * 0.04; g.quaternion.slerpQuaternions(_qa, _qb, k);
    } else {                             // let go and pull the hand away
      if (a.held) dropCig();
      pickPose(_pa, _qa); low(_pb, _qb); _pb.y -= 0.25; const k = seg(u, 0.88, 1);
      g.position.lerpVectors(_pa, _pb, k); g.quaternion.slerpQuaternions(_qa, _qb, k * 0.5);
    }
    g.visible = true; armTo(g);
    return drag;
  }
  function armTo(g) {   // the sleeve runs from the cuff to a shoulder at the lower left of the view
    const arm = smokeHand.arm; _hp.set(0.004, -0.15, 0.004); g.localToWorld(_hp);
    _hp2.set(-0.3, -0.5, 0.12).applyQuaternion(camera.quaternion).add(camera.position);
    const d = _hp2.distanceTo(_hp), len = Math.min(d, 0.4);   // never longer than a forearm: it used to stretch across the cockpit while the hand was at the ashtray
    if (d > len) _hp2.sub(_hp).multiplyScalar(len / d).add(_hp);
    arm.position.copy(_hp2); arm.lookAt(_hp); arm.scale.set(0.8, 0.8, Math.max(0.05, len)); arm.visible = true;
  }
  function dropCig() { const a = ashtray; a.held = false; scene.add(a.cig); a.cig.position.copy(a.rest); a.cig.quaternion.copy(a.restQ); }
  function endSmoke() {
    if (ashtray.held) dropCig(); ashtray.blown = false; smokeT = 0;
    if (smokeHand.g) smokeHand.g.visible = smokeHand.arm.visible = false;
    const h = smokeHand.hide; smokeHand.hide = null; if (h) h.g.visible = h.arm.visible = h.op > 0.03;
  }
  function puff(pos, vx, vy, vz, s0, s1, a, max) {
    const sp = ashtray.puffs.find((q) => q.userData.life >= q.userData.max); if (!sp) return;
    const u = sp.userData; u.life = 0; u.max = max; u.v.set(vx, vy, vz); u.s0 = s0; u.s1 = s1; u.a = a; sp.position.copy(pos); sp.visible = true;
  }
  function updateAshtray(dt) {
    if (!ashtray) return;
    const a = ashtray, target = Math.max(0, env.smoke || 0);
    smokeNow += (target - smokeNow) * Math.min(1, dt * 1.5); if (smokeNow < 0.004 && !target) smokeNow = 0;
    scene.fog.density = smokeNow * 0.6;
    let drag = 0;   // 0..1, how hard the pilot is pulling on it right now
    if (smokeT > 0) {
      const u = 1 - smokeT / SMOKE_DUR; smokeT -= dt;
      drag = poseSmokeHand(u);
      if (!a.blown && u > 0.5) {   // breathe out (game.js plays the exhale 1.5 s after the click)
        a.blown = true; _v.set(0, 0, -1).applyQuaternion(camera.quaternion); _p.copy(camera.position).addScaledVector(_v, 0.16); _p.y -= 0.07;
        for (let i = 0; i < 9; i++) puff(_p, _v.x * (0.3 + Math.random() * 0.4) + (Math.random() - 0.5) * 0.12, _v.y * 0.3 + 0.03 + Math.random() * 0.06, _v.z * (0.3 + Math.random() * 0.4) + (Math.random() - 0.5) * 0.12, 0.05, 0.45 + Math.random() * 0.35, 0.4, 2.4 + Math.random() * 1.2);
      }
      if (smokeT <= 0) endSmoke();
    } else if (a.held) endSmoke(); else a.blown = false;
    // the ember: a slow uneven smoulder, brighter and hotter while the pilot draws on it
    const fl = 0.5 + 0.22 * Math.sin(clock * 7.3) + 0.16 * Math.sin(clock * 17.1 + 1.3) + 0.12 * Math.sin(clock * 31.7 + 2.1);
    const heat = Math.min(1, 0.18 + fl * 0.25 + drag * 0.85);
    a.emberMat.color.setRGB(0.62 + 0.38 * heat, 0.16 + 0.42 * heat * heat, 0.04 + 0.12 * heat * heat * heat);
    a.glow.material.opacity = 0.22 + 0.28 * heat; a.glow.scale.setScalar(0.009 + 0.009 * heat);
    // it burns down with every drag: the paper gets shorter, and when nothing is left the ember goes out and the smoke stops
    const burnt = env.cig != null && env.cig <= 0 && smokeT <= 0;
    if (env.cig != null) {
      const k = 0.3 + 0.7 * Math.max(0, Math.min(1, env.cig)), tipZ = 0.018 - 0.062 * k, ch = a.cig.children;
      ch[0].scale.z = k; ch[0].position.z = 0.018 * (1 - k); a.ember.position.z = tipZ - 0.0015; ch[3].position.z = tipZ - 0.0055; a.glow.position.z = tipZ - 0.003;
      if (burnt) { a.emberMat.color.setRGB(0.2, 0.19, 0.18); a.glow.material.opacity = 0; }
    }
    a.wt -= dt;
    if (a.wt <= 0 && drag < 0.2 && enabled && !burnt) {   // the thin thread that rises from the ember
      a.wt = 0.2; a.glow.getWorldPosition(a.tip);
      puff(a.tip, (Math.random() - 0.5) * 0.02, 0.06 + Math.random() * 0.03, (Math.random() - 0.5) * 0.02, 0.012, 0.075, 0.26, 2.4);
    }
    for (let i = 0; i < a.puffs.length; i++) {
      const sp = a.puffs[i], u = sp.userData; if (u.life >= u.max) continue;
      u.life += dt; const t = u.life / u.max;
      if (t >= 1) { sp.visible = false; continue; }
      sp.position.addScaledVector(u.v, dt); u.v.multiplyScalar(1 - Math.min(1, dt * 0.9)); u.v.x += Math.sin(clock * 3 + i) * dt * 0.01;
      const sc = u.s0 + (u.s1 - u.s0) * t; sp.scale.set(sc, sc, 1); sp.material.opacity = u.a * (1 - t) * Math.min(1, t * 8);
    }
    for (let i = 0; i < a.haze.length; i++) {
      const sp = a.haze[i], u = sp.userData; sp.visible = smokeNow > 0.03; if (!sp.visible) continue;
      sp.material.opacity = Math.min(0.42, smokeNow * u.a);
      sp.position.set(u.x + Math.sin(clock * 0.13 + i) * 0.18, u.y + Math.sin(clock * 0.09 + i * 2.1) * 0.07, u.z);
    }
  }

  // a little aircraft on a spring, nodding on the glareshield
  let bobble = null;
  function makeBobble() {
    const g = new T.Group(); g.position.set(-0.3, 1.146, -0.9); g.rotation.y = -0.35; g.scale.setScalar(1.15);
    const ph = (c, sh) => new T.MeshPhongMaterial({ color: c, specular: '#ffffff', shininess: sh || 70 });
    const yel = ph('#ffb21e'), org = ph('#f07a12'), steel = ph('#c8ced6', 120), blk = ph('#15171a', 30), wht = ph('#ffffff', 40);
    const base = new T.Mesh(new T.CylinderGeometry(0.03, 0.036, 0.012, 20), org); base.position.y = 0.006; g.add(base);
    [-1, 1].forEach((s) => { const f = new T.Mesh(new T.SphereGeometry(0.014, 12, 8), org); f.scale.set(1, 0.5, 1.5); f.position.set(s * 0.02, 0.006, 0.03); g.add(f); });
    const rings = [];
    for (let i = 0; i < 6; i++) { const r = new T.Mesh(new T.TorusGeometry(0.02 - i * 0.0012, 0.0028, 6, 18), steel); r.rotation.x = Math.PI / 2; r.position.y = 0.016 + i * 0.008; g.add(r); rings.push(r); }
    const head = new T.Group(); head.position.y = 0.062; g.add(head);
    const fus = new T.Mesh(new T.SphereGeometry(0.04, 20, 14), yel); fus.scale.set(1, 0.95, 1.5); fus.position.y = 0.036; head.add(fus);
    const wing = new T.Mesh(new T.BoxGeometry(0.2, 0.007, 0.042), org); wing.position.set(0, 0.03, 0.0); head.add(wing);
    [-1, 1].forEach((s) => { const t = new T.Mesh(new T.SphereGeometry(0.012, 10, 8), org); t.scale.set(1, 0.6, 2); t.position.set(s * 0.1, 0.03, 0); head.add(t); });
    const fin = new T.Mesh(new T.BoxGeometry(0.007, 0.04, 0.03), org); fin.position.set(0, 0.07, -0.05); fin.rotation.x = -0.35; head.add(fin);
    const stab = new T.Mesh(new T.BoxGeometry(0.075, 0.006, 0.022), org); stab.position.set(0, 0.045, -0.055); head.add(stab);
    [-1, 1].forEach((s) => {
      const e = new T.Mesh(new T.SphereGeometry(0.0105, 12, 10), wht); e.position.set(s * 0.016, 0.047, 0.05); head.add(e);
      const p = new T.Mesh(new T.SphereGeometry(0.0055, 10, 8), blk); p.position.set(s * 0.016, 0.047, 0.059); head.add(p);
    });
    const smile = new T.Mesh(new T.TorusGeometry(0.012, 0.0022, 6, 14, Math.PI), blk); smile.rotation.z = Math.PI; smile.position.set(0, 0.032, 0.058); head.add(smile);
    const nose = new T.Mesh(new T.SphereGeometry(0.008, 10, 8), ph('#e23b2e')); nose.position.set(0, 0.04, 0.062); head.add(nose);
    scene.add(g);
    // a Meshy model replaces the hand-built toy when one is packed with the game (js/models.js)
    if (window.KKModels && KKModels.has('bobble')) KKModels.load('bobble', (m) => { const made = head.children.slice(); head.add(KKModels.fit(m, 0.2, Math.PI / 2 - 0.6)); made.forEach((c) => { c.visible = false; }); });
    bobble = { head, rings, x: 0, z: 0, vx: 0, vz: 0, kick: 0 };
  }
  function updateBobble(dt) {
    if (!bobble) return;
    const b = bobble, d = Math.min(dt, 0.05);
    // a soft spring: turbulence and jolts push it, it settles back by itself and never swings far
    const push = (env.shake || 0) * 14 + b.kick; b.kick = 0;
    b.vx += (-64 * b.x - 1.3 * b.vx + (Math.random() - 0.5) * (7 + push * 8) + Math.sin(clock * 2.9) * 2.6) * d;
    b.vz += (-52 * b.z - 1.2 * b.vz + (Math.random() - 0.5) * (7 + push * 8) + Math.sin(clock * 2.1 + 1) * 2.2 + (env.roll || 0) * 30) * d;
    b.x = Math.max(-0.34, Math.min(0.34, b.x + b.vx * d)); b.z = Math.max(-0.38, Math.min(0.38, b.z + b.vz * d));
    b.head.rotation.x = b.x; b.head.rotation.z = b.z; b.head.position.x = -b.z * 0.03; b.head.position.z = b.x * 0.03;
    b.rings.forEach((r, i) => { const k = i / 5; r.position.x = -b.z * 0.03 * k; r.position.z = b.x * 0.03 * k; r.rotation.x = Math.PI / 2 + b.x * k; r.rotation.y = b.z * k; });
  }

  function makeYoke(x) {
    const g = new T.Group(); g.position.set(x, 0.69, -0.42);
    const m = lam('#1d2024'), grip = lam('#101214');
    const col = B(0.07, 0.58, 0.07, x, 0.37, -0.56, m); col.rotation.x = -0.4;
    B(0.12, 0.08, 0.07, 0, 0, 0, m, g);
    B(0.36, 0.04, 0.04, 0, -0.01, 0, m, g);
    [-1, 1].forEach((s) => { B(0.04, 0.16, 0.045, s * 0.18, 0.06, 0, grip, g); B(0.07, 0.03, 0.045, s * 0.16, 0.14, 0, grip, g); });
    B(0.05, 0.03, 0.005, 0, 0, 0.037, lam('#c9a54a'), g);
    scene.add(g); return g;
  }

  function buildSky() {
    skyTex = new T.CanvasTexture(skyCanvas); skyTex.colorSpace = T.SRGBColorSpace;
    const geo = new T.CylinderGeometry(60, 60, 54, 48, 1, true, Math.PI - 2.36, 4.72);
    skyMesh = new T.Mesh(geo, new T.MeshBasicMaterial({ map: skyTex, side: T.DoubleSide, fog: false }));
    skyMesh.scale.x = -1; skyMesh.position.set(0, 5.5, 0); scene.add(skyMesh);
    // drifting cloud puffs between the aircraft and the horizon
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 30 + Math.random() * 68, y = 44 + Math.random() * 40, r = 18 + Math.random() * 24;
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    }
    const ctex = new T.CanvasTexture(cv);
    for (let i = 0; i < 34; i++) {
      const mat = new T.SpriteMaterial({ map: ctex, transparent: true, depthWrite: false, fog: false, opacity: 0.25 + Math.random() * 0.4, color: new T.Color().setHSL(0.6, 0.12, 0.2 + Math.random() * 0.22) });
      const sp = new T.Sprite(mat); sp.userData.o = mat.opacity; respawn(sp, true); scene.add(sp); clouds.push(sp);
    }
    // lightning bolt
    const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(new Float32Array(16 * 3), 3));
    bolt = new T.Line(bg, new T.LineBasicMaterial({ color: 0xe8f0ff, fog: false })); bolt.visible = false; bolt.frustumCulled = false; scene.add(bolt);
  }
  function respawn(sp, anywhere) {
    const side = Math.random() < 0.3;
    sp.position.set(side ? (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 14) : (Math.random() * 2 - 1) * 16, -2 + Math.random() * 9, anywhere ? -20 - Math.random() * 42 : -62);
    const s = 5 + Math.random() * 9; sp.scale.set(s * 1.8, s, 1);
    sp.userData.v = 9 + Math.random() * 10;
  }
  function strikeBolt() {
    const pos = bolt.geometry.attributes.position; let x = (Math.random() * 2 - 1) * 22, z = -38 - Math.random() * 14;
    for (let i = 0; i < 16; i++) { pos.setXYZ(i, x, 26 - i * 2.1, z); x += (Math.random() - 0.5) * 3.2; }
    pos.needsUpdate = true; bolt.visible = true; boltT = 0.22; flashL.intensity = 4;
  }

  // ------------------------------------------------------------------ hands
  const hands = [];
  function makeHand(side) {
    const mats = [], lm = (c) => { const m = lam(c); m.transparent = true; mats.push(m); return m; };
    const g = new T.Group(), skin = lm('#d19a76'), cuff = lm('#eef0f3'), gold = lm('#d8b24a');
    const finger = B(0.019, 0.017, 0.085, 0, 0, -0.0425, skin, g);
    B(0.064, 0.03, 0.05, -side * 0.036, -0.012, -0.082, skin, g);
    B(0.088, 0.03, 0.1, -side * 0.024, -0.004, -0.135, skin, g);
    const th = B(0.024, 0.022, 0.065, side * 0.032, -0.012, -0.105, skin, g); th.rotation.y = side * 0.5;
    const cg = new T.CylinderGeometry(0.043, 0.046, 0.05, 12).rotateX(Math.PI / 2);
    const cm = new T.Mesh(cg, cuff); cm.position.set(-side * 0.02, -0.004, -0.205); g.add(cm);
    [0.25, 0.265].forEach((z) => { const r = new T.Mesh(new T.CylinderGeometry(0.0468, 0.0472, 0.005, 12).rotateX(Math.PI / 2), gold); r.position.set(-side * 0.02, -0.004, -z); g.add(r); });
    const ag = new T.CylinderGeometry(0.043, 0.05, 1, 12).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    const armMat = lm('#1a2438'); const arm = new T.Mesh(ag, armMat);
    scene.add(g); scene.add(arm);
    return { side, g, arm, armMat, finger, th, grip: 0, gripR: 0.024, twist: 0, pos: new T.Vector3(), dir: new T.Vector3(0, 0.4, -1).normalize(), from: new T.Vector3(), to: new T.Vector3(), toDir: new T.Vector3(), fromDir: new T.Vector3(), t: 0, dur: 0.2, phase: 'rest', hold: 0, jab: 0, cb: null, ctrl: null, az: 0, reachK: 0, s: 1, mats, op: 1 };
  }
  const _rest = new T.Vector3(), _restDir = new T.Vector3(), _sh = new T.Vector3(), _wr = new T.Vector3();
  function restPose(h) {
    if (pose.k > 0.25) {   // standing: the hands hang just below the view
      _rest.set(h.side * 0.26, -0.55, -0.12).applyAxisAngle(_v2.set(0, 1, 0), view.yaw).add(camera.position);
      _restDir.set(0, 0.3, -1).applyAxisAngle(_v2.set(0, 1, 0), view.yaw).normalize(); return;
    }
    _rest.set(h.side * 0.18, 0.075, 0.03); yoke.localToWorld(_rest);
    _restDir.set(-h.side * 0.5, 0.55, -0.67).normalize();
    _rest.addScaledVector(_restDir, 0.105);
  }
  const _cs = new T.Vector3(), _gn = new T.Vector3();
  function shoulder(h, az, out, rk) {
    if (rk === undefined) rk = h.reachK;
    const k = 1 + (h.s - 1) * rk;
    out.set(h.side * 0.23 * k, -0.3 * k, 0.12).applyAxisAngle(_v2.set(0, 1, 0), az).add(EYE);
    // while reaching, the arm always comes in from the lower corner of the screen on its own side
    if (rk > 0) { _cs.set(h.side * 0.34 * k, -0.5 * k, 0.1 * k).applyQuaternion(camera.quaternion).add(camera.position); out.lerp(_cs, rk); }
    return out;
  }
  function reach(c, cb) {
    const target = c.world(), d = _v.copy(target).sub(camera.position), dist = d.length();
    _p.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const h = hands[d.dot(_p) < 0 ? 0 : 1];
    if (h.phase === 'hold' && h.ctrl === c) { h.hold = 0.34; h.jab = 1; cb(); return; }
    if (h.cb) { const f = h.cb; h.cb = null; f(); }
    h.from.copy(h.pos); h.fromDir.copy(h.dir);
    h.s = Math.max(1, 62 / view.fov); const maxR = 0.8 * h.s;
    if (dist > maxR + 0.02) h.to.copy(camera.position).addScaledVector(d, maxR / dist); else h.to.copy(target);
    h.az = Math.atan2(-d.x, -d.z);
    shoulder(h, Math.abs(h.az) > 1 ? h.az : 0, _sh, 1);
    h.toDir.copy(h.to).sub(_sh).normalize();
    h.dur = Math.max(0.13, Math.min(0.28, h.from.distanceTo(h.to) * 0.42)) * (1 + 0.3 * (env.drunk || 0));
    h.t = 0; h.phase = 'out'; h.cb = cb; h.ctrl = c;
  }
  function updateHands(dt) {
    hands.forEach((h) => {
      restPose(h);
      if (h.phase === 'rest') { h.pos.copy(_rest); h.dir.copy(_restDir); h.reachK = Math.max(0, h.reachK - dt * 4); }
      else if (h.phase === 'out') {
        h.t = Math.min(1, h.t + dt / h.dur); const k = 1 - Math.pow(1 - h.t, 3);
        h.pos.lerpVectors(h.from, h.to, k); h.pos.y += Math.sin(k * Math.PI) * 0.05;
        h.dir.lerpVectors(h.fromDir, h.toDir, k).normalize(); h.reachK = Math.min(1, h.reachK + dt * 6);
        if (h.t >= 1) { h.phase = 'hold'; h.hold = 0.24; h.jab = 1; const f = h.cb; h.cb = null; if (f) f(); }
      } else if (h.phase === 'hold') {
        h.jab = Math.max(0, h.jab - dt * 9);
        h.pos.copy(h.to).addScaledVector(h.toDir, -0.014 * (1 - h.jab) * (1 - h.grip)); h.dir.copy(h.toDir);
        if (focus && focus.c === h.ctrl) {   // turning a knob: the hand stays on it, two fingers around the cap
          h.hold = 0.3; h.grip = Math.min(1, h.grip + dt * 7);
          h.dir.lerp(_gn.copy(h.ctrl.panel.slot.normal).negate(), 0.3 * h.grip).normalize(); h.pos.addScaledVector(h.dir, 0.007 * h.grip);
        }
        h.hold -= dt; if (h.hold <= 0) { h.phase = 'back'; h.t = 0; h.from.copy(h.pos); h.fromDir.copy(h.dir); h.ctrl = null; }
      } else {
        h.t = Math.min(1, h.t + dt / 0.24); const k = h.t * h.t * (3 - 2 * h.t);
        h.pos.lerpVectors(h.from, _rest, k); h.dir.lerpVectors(h.fromDir, _restDir, k).normalize(); h.reachK = Math.max(0, 1 - k);
        if (h.t >= 1) h.phase = 'rest';
      }
      if (!(focus && focus.c === h.ctrl && h.phase === 'hold')) h.grip = Math.max(0, h.grip - dt * 7);
      h.twist *= Math.exp(-dt * 4.5);
      h.g.position.copy(h.pos); h.g.lookAt(_v.copy(h.pos).add(h.dir));
      const gk = h.grip, gs = 1 - 0.3 * gk, R = h.gripR / gs;
      h.g.scale.setScalar(gs);
      if (gk > 0.001) h.g.rotateZ(-h.side * 0.5 * gk + h.twist * gk);
      const curl = 1 - h.reachK;                       // fist on the yoke, pointing finger when reaching
      h.finger.scale.z = 1 - curl * 0.55 - gk * 0.25; h.finger.position.z = -0.0425 - curl * 0.03 + gk * 0.0105; h.finger.position.y = -curl * 0.012;
      h.finger.position.x = -h.side * (R + 0.0095) * gk;
      // the thumb comes round to the other side of the knob
      h.th.position.set(h.side * (0.032 + (R - 0.003 - 0.032) * gk), -0.012 + 0.01 * gk, -0.105 + 0.057 * gk);
      h.th.rotation.y = h.side * (0.5 - 0.2 * gk); h.th.scale.z = 1 + 0.5 * gk;
      shoulder(h, Math.abs(h.az) > 1 ? h.az * h.reachK : 0, _sh);
      _wr.copy(h.pos).addScaledVector(h.dir, -0.2);
      // resting arms fade out when the pilot looks down past them, so they never hide a panel
      const opTo = h.phase === 'rest' && (pose.k > 0.03 || view.pitch < -0.42 || view.fov < 50 || Math.abs(view.yaw) > 0.55) ? 0.0 : 1;
      if (Math.abs(opTo - h.op) > 0.01) { h.op += (opTo - h.op) * Math.min(1, dt * 8); h.mats.forEach((m) => { m.opacity = h.op; m.depthWrite = h.op > 0.9; }); h.g.visible = h.arm.visible = h.op > 0.03; }
      // only the forearm is drawn, so the sleeve never fills the screen
      _sh.sub(_wr).setLength((0.4 - 0.2 * h.reachK) * (1 + (h.s - 1) * h.reachK)).add(_wr);
      const thin = 1 - 0.3 * h.reachK;
      h.arm.position.copy(_sh); h.arm.lookAt(_wr); h.arm.scale.set(thin, thin, Math.max(0.05, _sh.distanceTo(_wr)));
      h.armMat.opacity = h.op * (1 - 0.5 * h.reachK); h.armMat.depthWrite = h.armMat.opacity > 0.9;
      if (smokeHand.hide === h) h.g.visible = h.arm.visible = false;   // this hand is busy with the cigarette
    });
  }

  // ------------------------------------------------------------------ picking + input
  const ray = new T.Raycaster(), ndc = new T.Vector2(), _o = new T.Vector3(), _d = new T.Vector3(), _h = [0, 0];
  function pick(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickMeshes, false);
    if (!hits.length) return null;
    if (hits[0].object.userData.ctrl) return { panel: null, ctrl: hits[0].object.userData.ctrl, hx: 0, hy: 0 };
    const P = hits[0].object.userData.panel; if (!P) return null;
    // controls stick out of the panel, so test the ray at the panel face, mid height and top of each one
    _o.copy(ray.ray.origin).applyMatrix4(P.slot.inv); _d.copy(ray.ray.direction).transformDirection(P.slot.inv);
    const at = (z, out) => { const t = (z * MM - _o.z) / _d.z; out[0] = (_o.x + _d.x * t) / MM + PW / 2; out[1] = PH / 2 - (_o.y + _d.y * t) / MM; return out; };
    let best = null, bd = 1e9, hx = at(0, _h)[0], hy = _h[1];
    P.controls.forEach((c) => {
      for (let k = 0; k < 3; k++) {
        at(c.z * (k === 0 ? 0.55 : k === 1 ? 1 : 0), _h);
        const dx = Math.abs(_h[0] - c.x) - c.w / 2, dy = Math.abs(_h[1] - c.y) - c.h / 2;
        if (dx <= 2 && dy <= 2) { const d = Math.hypot(_h[0] - c.x, _h[1] - c.y) + k * 2; if (d < bd) { bd = d; best = c; hx = _h[0]; hy = _h[1]; } }
      }
    });
    return { panel: P, ctrl: best, hx, hy };
  }
  function setHover(hit) {
    const c = hit && hit.ctrl;
    if (c !== hover) {
      hover = c;
      if (c && c.panel) {
        hl.visible = true;
        _p.set((c.x - PW / 2) * MM, (PH / 2 - c.y) * MM, 0.004); _q.identity(); _s.set((c.w + 8) * MM, (c.h + 8) * MM, 1);
        hl.matrix.compose(_p, _q, _s).premultiply(c.panel.matrix); hl.matrixWorldNeedsUpdate = true;
      } else hl.visible = false;
      canvas.style.cursor = c ? 'pointer' : 'grab';
    }
    if (hooks.onHover) hooks.onHover(hit ? { blocked: c ? blocked(hit) : '', symbol: hit.panel && hit.panel.symbol ? hit.panel.symbol[0] : '', panel: hit.panel && hit.panel.symbol ? hit.panel.symbol[1] : '', ctrl: c ? c.name : '', surface: hit.panel ? hit.panel.slot.surf.name : 'COCKPIT' } : null);
  }
  // rear walls can only be reached standing, everything else only from the seat
  function blocked(hit) {
    const need = !!(hit.panel && hit.panel.slot.surf.stand);
    if (need && !(pose.to === 1 && pose.k > 0.85)) return 'stand';
    if (!need && !(pose.to === 0 && pose.k < 0.15)) return 'sit';
    return '';
  }
  function stand(v, instant) {
    v = v ? 1 : 0; if (pose.to === v && !instant) return;
    pose.to = v; if (instant) pose.k = v;
    if (hooks.onPose) hooks.onPose(!!v, !!instant);
  }
  // turning a knob: the view closes in on it, then scroll / drag / A-D turn it as far as needed
  let focus = null, restore = null;
  const wrap = (a) => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  function enterFocus(c) {
    if (focus) return;
    const d = c.world().sub(EYE);
    focus = { c, yaw: view.yaw, pitch: view.pitch, fov: view.fov, ty: Math.atan2(-d.x, -d.z), tp: Math.asin(d.y / d.length()), tf: Math.min(view.fov, 16), acc: 0 };
    restore = null; hl.visible = false; canvas.style.cursor = 'ew-resize';
    hands.forEach((h) => { if (h.ctrl === c) { const far = c.world().distanceTo(camera.position) || 1; h.gripR = Math.max(0.012, Math.min(0.03, ((c.w || 54) - 6) / 2 * MM)) * Math.min(1, h.to.distanceTo(camera.position) / far); h.twist = 0; } });
    if (hooks.onFocus) hooks.onFocus(c);
  }
  function exitFocus() {
    if (!focus) return;
    restore = { yaw: focus.yaw, pitch: focus.pitch, fov: focus.fov }; focus = null; canvas.style.cursor = 'grab';
    if (hooks.onFocus) hooks.onFocus(null);
  }
  function turnFocus(dir) { if (focus && focus.c.turn) { focus.c.turn(dir); if (focus.c.panel && focus.c.panel.decoy && hooks.onDecoy) hooks.onDecoy(focus.c); hands.forEach((h) => { if (h.ctrl === focus.c) h.twist = Math.max(-0.8, Math.min(0.8, h.twist + dir * 0.4)); }); } }
  function dirAt(cx, cy, out) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); return out.copy(ray.ray.direction);
  }
  function applyCam() {
    view.pitch = Math.max(-1.35, Math.min(1.5, view.pitch));
    view.fov = Math.max(11, Math.min(78, view.fov));
    camera.fov = view.fov; camera.updateProjectionMatrix();
    camera.rotation.set(view.pitch, view.yaw, camera.rotation.z, 'YXZ'); camera.updateMatrixWorld(true);
  }
  function zoomAt(cx, cy, factor) {
    const d0 = dirAt(cx, cy, new T.Vector3());
    view.fov *= factor; applyCam();
    const d1 = dirAt(cx, cy, new T.Vector3());
    view.yaw += Math.atan2(-d0.x, -d0.z) - Math.atan2(-d1.x, -d1.z);
    view.pitch += Math.asin(Math.max(-1, Math.min(1, d0.y))) - Math.asin(Math.max(-1, Math.min(1, d1.y)));
    applyCam();
  }
  function bindInput() {
    let down = null, drag = false;
    canvas.addEventListener('pointerdown', (e) => {
      if (!enabled) return;
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY }; drag = false;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!enabled) return;
      if (down && focus) {
        if (Math.abs(e.clientX - down.x) > 6) drag = true;
        focus.acc += e.clientX - down.lx; down.lx = e.clientX;
        while (Math.abs(focus.acc) >= 24) { const s = focus.acc > 0 ? 1 : -1; focus.acc -= s * 24; turnFocus(s); }
      } else if (down) {
        restore = null;
        if (!drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { drag = true; canvas.style.cursor = 'grabbing'; }
        if (drag) {
          const r = canvas.getBoundingClientRect(), k = (view.fov * Math.PI / 180) / r.height;
          const mx = e.clientX - down.lx, my = e.clientY - down.ly, cr = Math.cos(view.tilt), sr = Math.sin(view.tilt);
          view.yaw += (mx * cr - my * sr) * k; view.pitch += (mx * sr + my * cr) * k;
          down.lx = e.clientX; down.ly = e.clientY; applyCam();
        }
      } else if (!focus) setHover(pick(e.clientX, e.clientY));
    });
    const up = (e) => {
      if (!enabled || !down) { down = null; return; }
      const wasDrag = drag; down = null; drag = false;
      if (focus) { if (!wasDrag) exitFocus(); return; }
      canvas.style.cursor = 'grab';
      if (wasDrag) return;
      const hit = pick(e.clientX, e.clientY);
      if (hit && hit.ctrl) {
        const why = blocked(hit); if (why) { if (hooks.onBlocked) hooks.onBlocked(why); return; }
        const c = hit.ctrl, hx = hit.hx, hy = hit.hy;
        if (c.turn) reach(c, () => enterFocus(c)); else reach(c, () => { c.press(hx, hy); if (c.panel && c.panel.decoy && hooks.onDecoy) hooks.onDecoy(c); });
      }
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', () => { down = null; drag = false; });
    canvas.addEventListener('wheel', (e) => {
      if (!enabled || !focus) return;
      e.preventDefault(); e.stopImmediatePropagation(); focus.wacc = (focus.wacc || 0) - Math.max(-100, Math.min(100, e.deltaY));
      while (Math.abs(focus.wacc) >= 100) { const s = focus.wacc > 0 ? 1 : -1; focus.wacc -= s * 100; turnFocus(s); }
    }, { passive: false });
    canvas.addEventListener('wheel', (e) => { if (!enabled) return; e.preventDefault(); restore = null; zoomAt(e.clientX, e.clientY, Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.004)); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (!focus || !enabled) return;
      if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'ArrowUp' || e.code === 'KeyW') turnFocus(1);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowDown' || e.code === 'KeyS') turnFocus(-1);
      else if (e.code === 'Enter' || e.code === 'Escape' || e.code === 'Space') exitFocus();
      else return;
      e.preventDefault(); e.stopImmediatePropagation();
    });
    window.addEventListener('keydown', (e) => { if (focus) return; keys[e.code] = true; if (enabled && (e.code === 'Space' || e.code === 'KeyR')) { resetView(); e.preventDefault(); } if (enabled && e.code === 'KeyF' && !e.repeat) stand(!pose.to); });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('blur', () => { Object.keys(keys).forEach((k) => { keys[k] = false; }); });
  }
  function resetView() { view.yaw = pose.to ? Math.PI : 0; view.pitch = pose.to ? -0.05 : -0.2; view.fov = 62; view.tilt = 0; applyCam(); }

  function resize() {
    if (!renderer) return;
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    renderer.setPixelRatio(Math.max(1, Math.min(2.5, s * (window.devicePixelRatio || 1))));
    renderer.setSize(1280, 720, false);
  }

  // ------------------------------------------------------------------ public
  function init(cv, skyCv) {
    canvas = cv; skyCanvas = skyCv;
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    scene = new T.Scene(); scene.background = new T.Color('#05070b'); scene.fog = new T.FogExp2(0x8c8d89, 0);   // cigarette smoke, see updateAshtray
    camera = new T.PerspectiveCamera(view.fov, 1280 / 720, 0.03, 400);
    camera.rotation.order = 'YXZ'; camera.position.copy(EYE);
    panelGeom = new T.PlaneGeometry(PW * MM, PH * MM);
    boxes = Pool(bake(new T.BoxGeometry(1, 1, 1).translate(0, 0, 0.5)), 7000);
    cyls = Pool(bake(new T.CylinderGeometry(1, 1, 1, 18).rotateX(Math.PI / 2).translate(0, 0, 0.5)), 9000);
    scene.add(boxes.mesh); scene.add(cyls.mesh);
    // hover brackets
    const hc = document.createElement('canvas'); hc.width = hc.height = 64; const h2 = hc.getContext('2d');
    h2.strokeStyle = '#7fe3ff'; h2.lineWidth = 5;
    [[2, 20, 2, 2, 20, 2], [44, 2, 62, 2, 62, 20], [62, 44, 62, 62, 44, 62], [20, 62, 2, 62, 2, 44]].forEach((p) => { h2.beginPath(); h2.moveTo(p[0], p[1]); h2.lineTo(p[2], p[3]); h2.lineTo(p[4], p[5]); h2.stroke(); });
    hl = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(hc), transparent: true, depthTest: false }));
    hl.matrixAutoUpdate = false; hl.visible = false; hl.renderOrder = 10; hl.frustumCulled = false; scene.add(hl);
    buildSlots(); buildShell(); buildSky();
    hands.push(makeHand(-1), makeHand(1));
    bindInput(); resize(); window.addEventListener('resize', resize);
    applyCam();
  }

  function clear() {
    gen++;
    panels.forEach((P) => { scene.remove(P.mesh); P.tex.dispose(); P.mesh.material.dispose(); P.canvas.width = P.canvas.height = 1; });
    panels = []; pickMeshes = propMeshes.slice(); blinkers = []; tickers = [];
    boxes.reset(); cyls.reset(); hover = null; hl.visible = false;
    hands.forEach((h) => { h.phase = 'rest'; h.cb = null; h.ctrl = null; h.reachK = 0; });
  }

  // build(flight, mount): mount(module, panel) wires one failure module onto its panel.
  function build(flight, mount, extras) {
    clear();
    const KK = window.KK, rng = KK.makeRng((flight.seed ^ 0x3d5eed) >>> 0);
    const maxTier = flight.mode === 'short' ? 0 : flight.mode === 'mayday' ? 1 : 2;
    const free = rng.shuffle(slots.filter((s) => !s.fixed));
    const pool = free.filter((s) => s.tier <= maxTier);
    const used = new Set(), out = { modules: {} };
    const SY = KK.assignSymbols(flight), syms = SY.pool, fixedSym = { pa: SY.pa, data: SY.data };   // new pictures on every flight
    const ctrls = [];
    flight.modules.forEach((m, i) => {
      const slot = pool[i]; used.add(slot.id);
      const P = new Panel(slot, KK.MODULES[m.id].title, { symbol: SY.modules[m.id] });
      P.moduleId = m.id; out.modules[m.id] = P;
      P.status().blink(2.2, '#ff3b2a');
      ctrls.push(mount(m, P)); P.touch();
    });
    out.extras = {};
    (extras || []).forEach((x, i) => {
      const slot = free.filter((s) => s.tier === 0 && !used.has(s.id))[0]; used.add(slot.id);
      const P = new Panel(slot, x.title, { symbol: fixedSym[x.id] || syms.pop() }); out.extras[x.id] = P;
      ctrls.push(x.build(P)); P.touch();
    });
    const D = window.KKDecoys;
    slots.forEach((s) => {
      if (used.has(s.id)) return;
      if (s.fixed) { const P = new Panel(s, D.fixedTitle(s.fixed), { screen: s.fixed !== 'data', symbol: s.fixed === 'data' ? fixedSym.data : null }); D.fixed(s.fixed, P, flight, api); P.touch(); return; }
      const d = D.next(rng); const P = new Panel(s, d.title, { symbol: syms.pop() }); P.decoy = true; d.build(P, rng); P.touch();
    });
    focus = null; restore = null; if (!guestMode) { stand(false, true); EYE.copy(SEAT); resetView(); }
    Object.keys(visitors).forEach((r) => { visitors[r].on = false; visitors[r].f.g.visible = false; }); if (doorG) doorG.rotation.y = 0; forced = false;
    out.controllers = ctrls;
    api.current = out;
    return out;
  }

  let env = { roll: 0, shake: 0, alt: 1, danger: 0 };
  function frame(dt, e) {
    if (!renderer) return;
    if (e) env = e;
    clock += dt;
    const turn = 1.5 * dt * (view.fov / 62);
    if (focus || restore) {   // glide onto the knob, and back out again afterwards
      const g = focus ? { yaw: focus.ty, pitch: focus.tp, fov: focus.tf } : restore, k = Math.min(1, dt * 9);
      const dy = wrap(g.yaw - view.yaw); view.yaw += dy * k; view.pitch += (g.pitch - view.pitch) * k; view.fov += (g.fov - view.fov) * k;
      if (!focus && Math.abs(dy) < 0.004 && Math.abs(g.fov - view.fov) < 0.2) restore = null;
      if (!enabled && focus) exitFocus();
    } else if (enabled) {
      if (keys.ArrowLeft || keys.KeyA) view.yaw += turn;
      if (keys.ArrowRight || keys.KeyD) view.yaw -= turn;
      if (keys.ArrowUp || keys.KeyW) view.pitch += turn;
      if (keys.ArrowDown || keys.KeyS) view.pitch -= turn;
      if (keys.KeyQ || keys.Minus || keys.NumpadSubtract) view.fov *= 1 + dt * 1.6;
      if (keys.KeyE || keys.Equal || keys.NumpadAdd) view.fov *= 1 - dt * 1.6;
    }
    const sh = env.shake || 0;
    // standing up and sitting down: push off, rise, step back into the aisle
    if (pose.k !== pose.to) pose.k = pose.to > pose.k ? Math.min(1, pose.k + dt / 1.15) : Math.max(0, pose.k - dt / 0.95);
    const pk = pose.k, pe = pk * pk * (3 - 2 * pk), rise = Math.min(1, pe * 1.6), step = Math.max(0, (pe - 0.3) / 0.7);
    EYE.set(SEAT.x + (STAND.x - SEAT.x) * step, SEAT.y + (STAND.y - SEAT.y) * rise + Math.sin(pk * Math.PI * 4) * 0.018 * Math.sin(pk * Math.PI), SEAT.z + (STAND.z - SEAT.z) * step - Math.sin(pk * Math.PI) * 0.1);
    const tb = env.turb || 0;   // turbulence: the whole cockpit heaves, the head never rolls
    camera.position.set(EYE.x + (Math.random() - 0.5) * 0.03 * sh + Math.sin(clock * 8.3) * 0.008 * tb, EYE.y + (Math.random() - 0.5) * 0.03 * sh + Math.sin(clock * 1.3) * 0.004 + (Math.sin(clock * 10.7) + Math.sin(clock * 17.9)) * 0.012 * tb, EYE.z);
    // head tilt: lean the head so the panel in the middle of the view reads upright
    let tiltTo = 0;
    ndc.set(0, 0); ray.setFromCamera(ndc, camera);
    const ch = ray.intersectObjects(pickMeshes, false);
    if (ch.length && ch[0].distance < 4 && ch[0].object.userData.panel) {
      _e.set(view.pitch, view.yaw, 0, 'YXZ'); _q.setFromEuler(_e).invert();
      _v.copy(ch[0].object.userData.panel.slot.up).applyQuaternion(_q);
      if (Math.hypot(_v.x, _v.y) > 0.25) tiltTo = Math.max(-1.25, Math.min(1.25, -Math.atan2(_v.x, _v.y)));
      else tiltTo = view.tilt;
    }
    view.tilt = 0;   // the head never rolls: only yaw and pitch
    const dk = env.drunk || 0;
    camera.rotation.z = 0; skyMesh.rotation.z = (env.roll || 0) * 0.5;
    applyCam();
    if (pk > 0 && pk < 1) { camera.rotation.x -= Math.sin(pk * Math.PI) * 0.2; camera.updateMatrixWorld(true); }   // lean forward while getting up
    if (dk > 0.05) {   // the room sways
      camera.rotation.y += (Math.sin(clock * 0.9) * 0.022 + Math.sin(clock * 2.3) * 0.006) * dk;
      camera.rotation.x += Math.cos(clock * 0.7) * 0.015 * dk; camera.updateMatrixWorld(true);
    }
    updateBottle(dt); updateBobble(dt); updateAshtray(dt);
    yoke.rotation.z = Math.max(-0.7, Math.min(0.7, -(env.roll || 0) * 3.2 + Math.sin(clock * 2.3) * 0.02));
    skyTex.needsUpdate = true;
    // a puff is a flat picture that turns with the head, so it has to be gone before it could reach into the cockpit
    clouds.forEach((sp) => { sp.position.z += sp.userData.v * dt; const z = sp.position.z; sp.material.opacity = sp.userData.o * Math.max(0, Math.min(1, (-18 - z) / 8)) * Math.max(0, Math.min(1, (z + 62) / 6)); if (z > -18) respawn(sp, false); });
    if (boltT > 0) { boltT -= dt; bolt.visible = boltT > 0 && (boltT > 0.14 || boltT < 0.08); }
    flashL.intensity = Math.max(0, flashL.intensity - dt * 14);
    alarmL.intensity = env.danger ? env.danger * 7 * (0.5 + 0.5 * Math.sin(clock * 9)) : 0;
    for (let i = blinkers.length - 1; i >= 0; i--) { if (blinkers[i].dead) blinkers.splice(i, 1); else blinkers[i].fn(clock); }
    tickers.forEach((t) => { t.acc += dt; if (t.acc >= t.every) { t.acc = 0; t.fn(env, clock); } });
    updateHands(dt); updateVisitors(dt);
    renderer.render(scene, camera);
  }

  // ------------------------------------------------------------------ people
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
    if (!v) {
      if (!on) return; const f = makeFigure(LOOKS[role]); f.g.visible = false; scene.add(f.g); v = visitors[role] = { f, on: false, x: 0, z: 0, yaw: 0, ph: Math.random() * 6, kiss: 0 };
    }
    v.on = !!on;
  }
  let forced = false;                                       // the intruder cracked the door: it stands open with nobody in it
  function updateVisitors(dt) {
    let open = forced ? 1 : 0;                                           // the door stands open for as long as somebody from the cabin is in here
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
    const v = c.world().project(camera), r = canvas.getBoundingClientRect();
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, front: v.z < 1 };
  }
  function lookAt(c, fov) {
    const d = c.world().sub(EYE); view.yaw = Math.atan2(-d.x, -d.z); view.pitch = Math.asin(d.y / d.length());
    if (fov) view.fov = fov; applyCam();
  }

  const api = {
    init, build, frame, clear, resetView, screenOf, lookAt, hooks, view, PW, PH, EYE, stand, pose,
    setEnabled(v) { if (enabled === v) return; enabled = v; if (!v) setHover(null); },
    lightning() { if (guestMode) { if (storm) storm.flash = 1; } else strikeBolt(); },
    guest, tick, visitor,
    // guest mode: where the real pilot looks (view yaw and pitch) and whether they stand
    pilot(s) { if (!s) return; if (s.yaw != null) cap.yaw = +s.yaw || 0; if (s.pitch != null) cap.pitch = +s.pitch || 0; cap.up = s.up ? 1 : 0; cap.heard = clock; },
    kiss() { const v = visitors.attendant; if (v && v.f.g.visible) v.kiss = 1.1; },   // the flight attendant in the cockpit leans in (hands the captain a coffee)
    setDoor(v) { forced = !!v; },
    figures() { return { captain, visitors }; },
    every(sec, fn) { tickers.push({ every: sec, acc: sec, fn }); },
    pickAt(x, y) { const h = pick(x, y); return h && { panel: h.panel && h.panel.title, ctrl: h.ctrl && h.ctrl.name }; },
    panels() { return panels; },
    rr, shade,
    current: null,
  };
  window.KK3D = api;
})();
