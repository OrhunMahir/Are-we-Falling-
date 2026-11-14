/* ARE WE FALLING? — the aircraft cabin: the room the saboteur and the flight attendant play in.
   It knows nothing about the game or about tasks. It builds the cabin, walks one player through it
   and reports where that player is. Contract (see ROADMAP.md, "The cabin"):

     const cabin = KKCabin.start(canvas, { seed: 2417, role: 'saboteur' | 'attendant', seat: '4C' });
     cabin.goTo('lavatory' | 'galley' | 'door' | 'aisle' | '4C')   walk there (a seat id sits down)
     cabin.at()                 -> { place: 'seat' | 'aisle' | 'lavatory' | 'galley' | 'door' | 'moving', seat, x, z }
     cabin.on('arrive' | 'leave' | 'hover', fn)
     cabin.seats                -> [{ id, row, x, z, taken }]      taken = a passenger sits there
     cabin.places               -> { door, galley, aisle, lavatory }
     cabin.setState({ unrest, turb })     0..1 each: angry passengers, shaking
     cabin.setMarks(['lavatory'])         glowing rings on the floor where something is to do
     cabin.setActor('p2', { role, at })   another player: at is a place name or a seat id; null removes
     cabin.setDoor(true)                  cockpit door open or closed
     cabin.stop()
*/
(function () {
  'use strict';
  const T = window.THREE;
  const ROWS = 9, PITCH = 0.82, Z0 = 2.0, LEN = 11, SIT = 1.15, STAND = 1.62;
  const COLS = [-1.52, -1.04, -0.56, 0.56, 1.04, 1.52], LET = 'ABCDEF';
  const H = Math.PI / 2;
  const PLACES = {
    door: { x: 0, z: 0.62, yaw: 0, label: 'COCKPIT DOOR' },
    galley: { x: -0.35, z: 1.02, yaw: -H, pitch: -0.22, label: 'GALLEY' },
    aisle: { x: 0, z: 5.3, yaw: 0, label: 'AISLE' },
    lavatory: { x: -1.0, z: 10.0, yaw: H, label: 'LAVATORY' },
  };
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angTo = (cur, tgt, k) => { let d = (tgt - cur) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return cur + d * k; };

  function start(canvas, opts) {
    opts = opts || {};
    if (!T) return null;
    let renderer;
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const scene = new T.Scene(); scene.background = new T.Color(0x07090d);
    const camera = new T.PerspectiveCamera(66, 16 / 9, 0.05, 40); camera.rotation.order = 'YXZ';
    const rnd = mulberry32((+opts.seed || 1) * 7919 + 13);
    const mats = {};
    const lam = (c) => mats[c] || (mats[c] = new T.MeshLambertMaterial({ color: c }));
    const basic = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
    const box = (w, h, d, x, y, z, m, parent) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), typeof m === 'number' ? lam(m) : m); b.position.set(x, y, z); (parent || scene).add(b); return b; };
    const label = (text, w, h, bg, fg, x, y, z, ry, parent) => {
      const c = document.createElement('canvas'); c.width = 256; c.height = Math.max(16, Math.round(256 * h / w)); const g = c.getContext('2d');
      g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg; g.font = '700 ' + Math.round(c.height * 0.62) + 'px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 1);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t })); m.position.set(x, y, z); m.rotation.y = ry || 0; (parent || scene).add(m); return m;
    };

    // ---------------- the tube
    const shell = new T.Mesh(new T.CylinderGeometry(2, 2, LEN + 0.6, 28, 1, true), new T.MeshLambertMaterial({ color: 0xc9ced2, side: T.BackSide }));
    shell.rotation.x = H; shell.position.set(0, 0.75, LEN / 2); scene.add(shell);
    box(4, 0.04, LEN + 0.6, 0, -0.02, LEN / 2, 0x262c3d);                         // carpet
    box(0.7, 0.006, LEN, 0, 0.003, LEN / 2, 0x363d55);                           // aisle runner
    const floorL = [box(0.03, 0.01, 7.6, -0.36, 0.008, 5.4, basic(0x7dffb0)), box(0.03, 0.01, 7.6, 0.36, 0.008, 5.4, basic(0x7dffb0))];
    box(3.0, 0.05, LEN, 0, 2.13, LEN / 2, 0xd7dadd);                              // ceiling panel
    const strips = [box(0.16, 0.02, LEN - 0.8, -0.55, 2.1, LEN / 2, basic(0xfff1d4)), box(0.16, 0.02, LEN - 0.8, 0.55, 2.1, LEN / 2, basic(0xfff1d4))];
    const rowsMid = Z0 + (ROWS - 1) * PITCH / 2, rowsLen = ROWS * PITCH + 0.5;
    [-1, 1].forEach((s) => {                                                       // overhead bins
      const bin = box(0.8, 0.4, rowsLen, s * 1.23, 1.87, rowsMid, 0xe3e5e7); bin.rotation.z = s * 0.14;
      box(0.02, 0.03, rowsLen, s * 0.84, 1.74, rowsMid, 0x8b9299);
    });
    const glass = [];
    for (let r = 0; r < ROWS; r++) [-1, 1].forEach((s) => {                        // windows
      const z = Z0 + r * PITCH - 0.12;
      const wg = new T.Group(); wg.position.set(s * 1.94, 1.05, z); wg.rotation.z = s * 0.15; scene.add(wg);   // leans with the wall
      const fr = new T.Mesh(new T.PlaneGeometry(0.34, 0.46), lam(0xeceeef)); fr.rotation.y = -s * H; wg.add(fr);
      const gl = new T.Mesh(new T.PlaneGeometry(0.24, 0.35), basic(0x3d4a61)); gl.position.x = -s * 0.008; gl.rotation.y = -s * H; wg.add(gl); glass.push(gl);
    });

    // ---------------- seats and passengers
    const seats = [], dummy = new T.Object3D(), N = ROWS * 6;
    const inst = (geo, c) => { const m = new T.InstancedMesh(geo, lam(c), N); scene.add(m); return m; };
    const iCush = inst(new T.BoxGeometry(0.44, 0.13, 0.46), 0x27406e), iBack = inst(new T.BoxGeometry(0.44, 0.66, 0.09), 0x223862), iHead = inst(new T.BoxGeometry(0.3, 0.19, 0.07), 0x3d5a94);
    const put = (im, i, x, y, z, rx) => { dummy.position.set(x, y, z); dummy.rotation.set(rx || 0, 0, 0); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); };
    const SKIN = [0xf0c8a4, 0xd9a47c, 0xb07a52, 0x8a5a3a, 0xf4d6bc], HAIR = [0x1c1612, 0x3a2a1c, 0x6b4a2a, 0xb9a27a, 0x8a8a8a, 0x101010], SHIRT = [0xb23a3a, 0x3a6ab2, 0x3f8f5a, 0xc9a13a, 0x7a4aa8, 0xd9d9d9, 0x2f3540, 0xc76a2f, 0x4aa3a8], PANTS = [0x23283a, 0x3a3f4a, 0x4a3a2c, 0x1a1d24];
    const gTorso = new T.BoxGeometry(0.36, 0.5, 0.22), gHeadS = new T.SphereGeometry(0.115, 12, 10), gHair = new T.SphereGeometry(0.123, 12, 8, 0, Math.PI * 2, 0, 1.75), gThigh = new T.BoxGeometry(0.34, 0.13, 0.44), gArm = new T.BoxGeometry(0.085, 0.36, 0.09), gEye = new T.BoxGeometry(0.026, 0.026, 0.02), gLegs = new T.BoxGeometry(0.3, 0.84, 0.2);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    function person(seated, look) {
      look = look || {}; const g = new T.Group(), dy = seated ? 0.03 : 0.36, dz = seated ? 0.1 : 0;
      const shirt = look.shirt != null ? look.shirt : pick(SHIRT), skin = look.skin != null ? look.skin : pick(SKIN);
      const torso = new T.Mesh(gTorso, lam(shirt)); torso.position.set(0, 0.76 + dy, dz); g.add(torso);
      const head = new T.Group(); head.position.set(0, 1.15 + dy, dz); g.add(head);
      head.add(new T.Mesh(gHeadS, lam(skin)));
      const hair = new T.Mesh(gHair, lam(look.hair != null ? look.hair : pick(HAIR))); hair.position.set(0, 0.012, 0.012); head.add(hair);
      [-1, 1].forEach((s) => { const e = new T.Mesh(gEye, lam(0x16181c)); e.position.set(s * 0.042, 0.012, -0.108); head.add(e); });
      const legs = new T.Mesh(seated ? gThigh : gLegs, lam(look.pants != null ? look.pants : pick(PANTS))); legs.position.set(0, seated ? 0.57 : 0.42, seated ? -0.1 : 0); g.add(legs);
      const arms = [-1, 1].map((s) => { const a = new T.Group(); a.position.set(s * 0.215, 0.98 + dy, dz); const m = new T.Mesh(gArm, lam(shirt)); m.position.y = -0.17; a.add(m); g.add(a); return a; });
      if (look.scarf) { const sc = new T.Mesh(new T.BoxGeometry(0.2, 0.06, 0.2), lam(look.scarf)); sc.position.set(0, 1.03 + dy, dz); g.add(sc); }
      g.userData = { head, arms, ph: rnd() * 9, thr: 0.12 + rnd() * 0.8, k: 0 };
      return g;
    }
    const people = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < 6; c++) {
      const i = r * 6 + c, x = COLS[c], z = Z0 + r * PITCH;
      put(iCush, i, x, 0.44, z); put(iBack, i, x, 0.8, z + 0.265, 0.12); put(iHead, i, x, 1.19, z + 0.315, 0.12);
      const s = { id: (r + 1) + LET[c], row: r + 1, x, z, taken: rnd() < 0.66 };
      if (opts.seat === s.id) s.taken = false;
      seats.push(s);
      if (s.taken) { const p = person(true); p.position.set(x, 0, z); scene.add(p); people.push(p); }
    }
    for (let r = 0; r < ROWS; r++) [-1.04, 1.04].forEach((x) => box(1.42, 0.37, 0.36, x, 0.19, Z0 + r * PITCH + 0.03, 0x1a1e27));
    [iCush, iBack, iHead].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    const seatById = {}; seats.forEach((s) => { seatById[s.id] = s; });

    // ---------------- front: cockpit wall and door, galley, exit
    const WALL = 0xbcc2c7, METAL = 0x9aa2aa;
    box(1.68, 2.5, 0.08, -1.17, 1.1, 0, WALL); box(1.68, 2.5, 0.08, 1.17, 1.1, 0, WALL); box(0.66, 0.4, 0.08, 0, 2.14, 0, WALL);
    box(0.9, 2, 0.02, 0, 1, -0.6, basic(0x05080d));                                 // what you see through the open door
    [[-0.16, 1.2, 0x37c0ff], [0.1, 1.28, 0xffb347], [0.2, 1.12, 0x5dff8a], [-0.05, 1.05, 0xff5a4a]].forEach((d) => box(0.07, 0.04, 0.01, d[0], d[1], -0.58, basic(d[2])));
    const door = new T.Group(); door.position.set(-0.33, 0, 0.03); scene.add(door);
    box(0.66, 1.94, 0.05, 0.33, 0.97, 0, 0x8b939b, door); label('COCKPIT', 0.36, 0.08, '#20262e', '#e8edf2', 0.33, 1.62, 0.03, 0, door);
    const lock = box(0.05, 0.05, 0.02, 0.56, 1.05, 0.035, basic(0xff3b30), door);
    box(1.3, 0.95, 1.05, 1.2, 0.475, 0.77, METAL); box(1.3, 0.62, 1.05, 1.2, 1.76, 0.77, 0xb9bec3);        // galley
    for (let i = 0; i < 3; i++) box(0.02, 0.8, 0.3, 0.545, 0.45, 0.42 + i * 0.35, 0x6f777f);
    const pot = new T.Mesh(new T.CylinderGeometry(0.07, 0.08, 0.2, 12), lam(0x30343a)); pot.position.set(0.8, 1.05, 0.6); scene.add(pot);
    box(0.3, 0.12, 0.22, 0.85, 1.01, 1.0, 0xd8dde2);
    label('GALLEY', 0.5, 0.11, '#20262e', '#ffd27a', 0.54, 1.86, 0.77, -H);
    box(0.52, 0.5, 0.1, -1.2, 0.62, 0.1, 0x27406e); box(0.9, 1.9, 0.03, -1.25, 0.98, 0.06, 0xd0d4d8);       // jump seat and exit door
    label('EXIT', 0.3, 0.11, '#0c3a1c', '#7dffb0', -1.25, 2.0, 0.09, 0);
    const belt = label('FASTEN SEAT BELT', 0.62, 0.085, '#1a1408', '#ffb347', 0, 2.03, 1.54, 0);
    [-1, 1].forEach((s) => { box(1.36, 2.3, 0.06, s * 1.13, 1.05, 1.5, WALL); box(1.36, 2.3, 0.06, s * 1.13, 1.05, 9.25, WALL); });
    box(0.9, 0.2, 0.06, 0, 2.03, 1.5, WALL);

    // ---------------- rear: lavatory on the left, second galley on the right
    box(0.05, 2.3, 0.4, -0.42, 1.05, 9.45, WALL); box(0.05, 2.3, 0.4, -0.42, 1.05, 10.55, WALL); box(0.05, 0.3, 0.7, -0.42, 2.07, 10.0, WALL);
    box(1.5, 2.3, 0.05, -1.15, 1.05, 10.76, WALL); box(4, 2.5, 0.08, 0, 1.1, 10.98, WALL);
    const lavDoor = new T.Group(); lavDoor.position.set(-0.45, 0, 9.65); scene.add(lavDoor);   // a sliding door
    box(0.04, 1.9, 0.7, 0, 0.96, 0.35, 0xdfe2e5, lavDoor);
    label('LAVATORY', 0.5, 0.1, '#20262e', '#e8edf2', -0.39, 2.06, 10.0, H);
    const occ = box(0.02, 0.05, 0.16, -0.39, 1.86, 10.0, basic(0x35d06a));
    box(0.42, 0.4, 0.5, -1.5, 0.2, 10.0, 0xeef0f2); box(0.44, 0.04, 0.52, -1.5, 0.42, 10.0, 0xd5d9dd); box(0.12, 0.5, 0.5, -1.72, 0.6, 10.0, 0xeef0f2);   // toilet
    box(0.6, 0.1, 0.36, -1.15, 0.86, 10.55, 0xcfd4d9); box(0.5, 0.55, 0.02, -1.15, 1.4, 10.72, basic(0x9fb6c9));                                            // sink, mirror
    const vent = (function () { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#3a4048'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#0c0e11'; for (let i = 0; i < 6; i++) g.fillRect(8, 6 + i * 9.5, 112, 5); const t = new T.CanvasTexture(c); const m = new T.Mesh(new T.PlaneGeometry(0.44, 0.22), new T.MeshBasicMaterial({ map: t })); m.position.set(-1.68, 1.72, 10.0); m.rotation.y = H; scene.add(m); return m; })();
    box(1.3, 0.95, 1.35, 1.2, 0.475, 10.02, METAL); box(1.3, 0.62, 1.35, 1.2, 1.76, 10.02, 0xd5d8db);
    for (let i = 0; i < 4; i++) box(0.02, 0.8, 0.28, 0.545, 0.45, 9.52 + i * 0.33, 0x6f777f);

    // ---------------- light
    scene.add(new T.AmbientLight(0xa9b4c9, 1.7));
    const flash = new T.AmbientLight(0xcfe0ff, 0); scene.add(flash);
    const lamps = [2.3, 5.2, 8.1].map((z) => { const l = new T.PointLight(0xfff0dc, 3.2, 7.5, 1.3); l.position.set(0, 1.95, z); scene.add(l); return l; });
    const lavL = new T.PointLight(0xdfeaff, 1.6, 3, 1.4); lavL.position.set(-1.1, 1.9, 10.0); scene.add(lavL);

    // ---------------- things to click, marks, other players
    const picks = [], hid = new T.MeshBasicMaterial({ visible: false });
    seats.forEach((s) => { const m = box(0.46, 1.0, 0.5, s.x, 0.75, s.z + 0.08, hid); m.userData.seat = s; picks.push(m); });
    [['door', 0.7, 1.94, 0.3, 0, 0.97, 0.1], ['galley', 0.3, 1.3, 1.05, 0.5, 0.9, 0.77], ['lavatory', 0.2, 1.9, 0.7, -0.4, 0.96, 10.0]].forEach((p) => { const m = box(p[1], p[2], p[3], p[4], p[5], p[6], hid); m.userData.place = p[0]; picks.push(m); });
    const glow = box(1, 1, 1, 0, -5, 0, basic(0xffc14d, { transparent: true, opacity: 0.22, depthWrite: false })); glow.visible = false;
    const marks = {};
    Object.keys(PLACES).forEach((k) => { const p = PLACES[k]; const m = new T.Mesh(new T.RingGeometry(0.17, 0.24, 28), basic(0xffc14d, { transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -H; m.position.set(p.x, 0.02, p.z); m.visible = false; scene.add(m); marks[k] = m; });
    const actors = {};
    function spot(at) {
      if (at && typeof at === 'object') return { x: at.x, z: at.z, yaw: at.yaw || 0, seated: false };
      if (seatById[at]) return { x: seatById[at].x, z: seatById[at].z, yaw: 0, seated: true };
      const p = PLACES[at] || PLACES.aisle; return { x: p.x, z: p.z, yaw: p.yaw, seated: false };
    }
    function setActor(id, a) {
      if (actors[id]) { scene.remove(actors[id].g); delete actors[id]; }
      if (!a) return;
      const sp = spot(a.at), look = a.role === 'attendant' ? { shirt: 0x1d2c52, pants: 0x1d2c52, scarf: 0xd43a3a } : {};
      const g = person(sp.seated, look); g.position.set(sp.x, 0, sp.z); g.rotation.y = sp.yaw; scene.add(g);
      actors[id] = { g, role: a.role, at: a.at };
    }

    // ---------------- the player
    const S = { unrest: 0, turb: 0, t: 0 };
    const P = { x: 0, z: 1.0, y: STAND, yaw: 0, pitch: 0, seat: null, place: 'aisle', path: [], dest: null, hold: 0 };
    const subs = {};
    const emit = (ev, d) => (subs[ev] || []).forEach((fn) => { try { fn(d); } catch (e) { console.error(e); } });
    const moving = () => P.path.length > 0;
    const at = () => ({ place: moving() ? 'moving' : P.place, seat: P.seat ? P.seat.id : null, x: +P.x.toFixed(2), z: +P.z.toFixed(2) });
    function goTo(target) {
      const seat = seatById[target], place = !seat && PLACES[target] ? target : null;
      if (!seat && !place) return false;
      if (seat && (seat.taken || seat === P.seat)) return false;
      const pts = [];
      if (P.seat) pts.push({ x: P.seat.x, z: P.seat.z - 0.3 }, { x: 0, z: P.seat.z - 0.3 });
      else if (P.x < -0.3 && P.z > 9.3) pts.push({ x: 0, z: 10.0 });
      else if (Math.abs(P.x) > 0.02) pts.push({ x: 0, z: P.z });
      if (seat) pts.push({ x: 0, z: seat.z - 0.3 }, { x: seat.x, z: seat.z - 0.3 }, { x: seat.x, z: seat.z + 0.1 });
      else { const p = PLACES[place]; pts.push({ x: 0, z: p.z }); if (p.x) pts.push({ x: p.x, z: p.z }); }
      if (!moving()) emit('leave', at());
      P.seat = null; P.path = pts; P.dest = { seat: seat || null, place: seat ? 'seat' : place };
      return true;
    }
    function arrive() {
      const d = P.dest || {}; P.seat = d.seat || null; P.place = d.place || placeAt(); P.dest = null; P.hold = 0;
      emit('arrive', at());
    }
    const placeAt = () => (P.x < -0.3 && P.z > 9.3 ? 'lavatory' : P.z < 0.85 ? 'door' : P.z < 1.4 ? 'galley' : 'aisle');
    function toggleSeat() {
      if (moving()) return;
      if (P.seat) { const s = P.seat; emit('leave', at()); P.seat = null; P.path = [{ x: s.x, z: s.z - 0.3 }, { x: 0, z: s.z - 0.3 }]; P.dest = { place: 'aisle' }; return; }
      let best = null, bd = 1e9;
      seats.forEach((s) => { if (s.taken) return; const d = Math.abs(s.z - 0.3 - P.z) + Math.abs(s.x) * 0.5; if (d < bd) { bd = d; best = s; } });
      if (best) goTo(best.id);
    }
    // start: the attendant stands in the galley, anybody else sits in a free seat
    (function () {
      let s = opts.seat && seatById[opts.seat];
      if (!s && opts.role !== 'attendant') { const free = seats.filter((q) => !q.taken), mid = free.filter((q) => q.row > 2 && q.row < 9); s = (mid.length ? mid : free)[Math.floor(rnd() * (mid.length || free.length))]; }
      if (s) { P.seat = s; P.place = 'seat'; P.x = s.x; P.z = s.z + 0.1; P.y = SIT; } else { P.x = 0; P.z = PLACES.galley.z; P.place = 'galley'; P.yaw = Math.PI; }
    })();

    // ---------------- input
    const keys = {}, ray = new T.Raycaster(), ndc = new T.Vector2();
    let drag = null, hover = null;
    const hit = (e) => {
      const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera); ray.far = 9;
      const h = ray.intersectObjects(picks, false)[0], st = h && h.object.userData.seat;
      return h && !(st && (st.taken || st === P.seat)) ? h.object : null;
    };
    const onDown = (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; try { canvas.setPointerCapture(e.pointerId); } catch (er) {} };
    const onMove = (e) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
        P.yaw += dx * 0.0042; P.pitch = clamp(P.pitch + dy * 0.0042, -1.1, 1.1); P.hold = 1.4;   // P.yaw and P.pitch are the camera's rotation.y and rotation.x
      }
      const h = drag && drag.moved > 6 ? null : hit(e);
      if (h !== hover) { hover = h; canvas.style.cursor = h ? 'pointer' : 'grab'; emit('hover', h ? (h.userData.seat ? { seat: h.userData.seat.id } : { place: h.userData.place }) : null); }
    };
    const onUp = (e) => { const d = drag; drag = null; if (d && d.moved <= 6) { const h = hit(e); if (h) goTo(h.userData.seat ? h.userData.seat.id : h.userData.place); } };
    const onKey = (e) => { const k = e.key.toLowerCase(); keys[k] = e.type === 'keydown'; if (e.type === 'keydown' && k === 'f' && !e.repeat) toggleSeat(); };
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
    canvas.style.cursor = 'grab'; canvas.style.touchAction = 'none';

    // ---------------- frame
    let alive = true, raf = 0, last = performance.now(), lw = 0, lh = 0, bolt = 0, doorOpen = false;
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; S.t += dt;
      const w = canvas.clientWidth || 1280, h = canvas.clientHeight || 720;
      if (w !== lw || h !== lh) { lw = w; lh = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }

      // walking
      let heading = null;
      if (moving()) {
        const q = P.path[0], dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz), sp = (Math.abs(dx) > Math.abs(dz) ? 1.1 : 1.9) * dt;
        if (d <= sp) { P.x = q.x; P.z = q.z; P.path.shift(); if (!moving()) arrive(); } else { P.x += dx / d * sp; P.z += dz / d * sp; if (d > 0.25) heading = Math.atan2(-dx, -dz); }
      } else if (!P.seat && Math.abs(P.x) < 0.5 && P.place !== 'lavatory') {
        const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
        if (f) { const before = P.place; P.x = 0; P.z = clamp(P.z - Math.cos(P.yaw) * f * 1.9 * dt, 0.6, 10.3); P.place = placeAt(); if (P.place !== before) { emit('leave', { place: before }); emit('arrive', at()); } }
      }
      const seated = P.seat && !moving();
      const eye = seated ? SIT : STAND - (P.z > 1.5 && P.z < 9.25 ? 0.28 * clamp((Math.abs(P.x) - 0.4) / 0.4, 0, 1) : 0);   // duck under the bins
      P.y += (eye - P.y) * Math.min(1, dt * 6);
      P.hold = Math.max(0, P.hold - dt);
      if (!P.hold && !drag) {
        if (heading != null) P.yaw = angTo(P.yaw, heading, Math.min(1, dt * 5));
        else if (!moving() && P.settle) { P.yaw = angTo(P.yaw, P.settle.yaw, Math.min(1, dt * 4)); P.pitch += (P.settle.pitch - P.pitch) * Math.min(1, dt * 4); if (S.t > P.settle.until) P.settle = null; }
      }
      const tb = S.turb, shx = tb ? Math.sin(S.t * 23) * 0.012 * tb : 0, shy = tb ? (Math.sin(S.t * 17.3) + Math.sin(S.t * 31.1) * 0.5) * 0.02 * tb : 0;
      camera.position.set(P.x + shx, P.y + shy, P.z); camera.rotation.set(P.pitch + shy * 0.6, P.yaw, shx * 1.5);

      // doors
      const nearLav = Math.hypot(P.x + 0.42, P.z - 10.0) < 0.8 && P.x > -0.85;
      lavDoor.position.z += ((nearLav ? 10.37 : 9.65) - lavDoor.position.z) * Math.min(1, dt * 7);
      occ.material.color.setHex(P.place === 'lavatory' || (P.dest && P.dest.place === 'lavatory') ? 0xff3b30 : 0x35d06a);
      door.rotation.y += ((doorOpen ? -1.45 : 0) - door.rotation.y) * Math.min(1, dt * 5);
      lock.material.color.setHex(doorOpen ? 0x35d06a : 0xff3b30);

      // the cabin lives
      bolt -= dt; if (bolt < -4 - Math.random() * 9) bolt = 0.22;
      const fl = bolt > 0 ? (Math.random() > 0.4 ? 1 : 0.3) : 0, flick = tb > 0.5 && Math.sin(S.t * 41) > 0.55 ? 0.35 : 1;
      flash.intensity = fl * 0.9; glass.forEach((g) => g.material.color.setHex(fl ? 0xdbe6ff : 0x3d4a61));
      lamps.forEach((l) => { l.intensity = 3.2 * flick; }); strips.forEach((s) => s.material.color.setHex(flick < 1 ? 0x6b6657 : 0xfff1d4));
      belt.visible = tb > 0.02 || S.unrest > 0.3 ? Math.sin(S.t * 6) > -0.6 : true;
      floorL.forEach((f) => { f.material.color.setHex(S.unrest > 0.75 ? (Math.sin(S.t * 8) > 0 ? 0x7dffb0 : 0x1d4a30) : 0x2f7a52); });
      for (let i = 0; i < people.length; i++) {
        const u = people[i].userData, angry = S.unrest > u.thr;
        u.k += ((angry ? 1 : 0) - u.k) * Math.min(1, dt * 3);
        u.head.rotation.y = Math.sin(S.t * (0.5 + u.thr) + u.ph) * (0.25 + u.k * 0.7); u.head.rotation.x = Math.sin(S.t * 0.7 + u.ph * 2) * 0.08 + tb * Math.sin(S.t * 19 + u.ph) * 0.1;
        u.arms[0].rotation.x = u.k * (2.5 + Math.sin(S.t * 9 + u.ph) * 0.4); u.arms[1].rotation.x = u.k * (2.3 + Math.sin(S.t * 8 + u.ph * 3) * 0.5);
        people[i].position.y = tb * Math.sin(S.t * 21 + u.ph) * 0.012;
      }
      const pulse = 1 + Math.sin(S.t * 4) * 0.12;
      Object.keys(marks).forEach((k) => { if (marks[k].visible) marks[k].scale.set(pulse, pulse, 1); });
      if (hover) { const o = hover; glow.visible = true; glow.position.copy(o.position); const g = o.geometry.parameters; glow.scale.set(g.width + 0.02, g.height + 0.02, g.depth + 0.02); } else glow.visible = false;
      renderer.render(scene, camera);
    }
    subs.arrive = [function (a) { const yaw = a.place === 'seat' ? 0 : (PLACES[a.place] || {}).yaw; if (yaw != null && a.place !== 'aisle') P.settle = { yaw, pitch: (PLACES[a.place] || {}).pitch || 0, until: S.t + 1.2 }; }];
    raf = requestAnimationFrame(frame);

    return {
      seats, places: PLACES, state: S, player: P, goTo, at, setActor, scene,
      on(ev, fn) { (subs[ev] = subs[ev] || []).push(fn); },
      stand() { if (P.seat) toggleSeat(); },
      setState(st) { if (!st) return; if (st.unrest != null) S.unrest = clamp(+st.unrest, 0, 1); if (st.turb != null) S.turb = clamp(+st.turb, 0, 1); },
      setMarks(list) { Object.keys(marks).forEach((k) => { marks[k].visible = (list || []).indexOf(k) >= 0; }); },
      setDoor(v) { doorOpen = !!v; },
      stop() {
        alive = false; cancelAnimationFrame(raf);
        canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp);
        window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
        try { renderer.dispose(); } catch (e) {}
      },
    };
  }
  window.KKCabin = { start, PLACES };
})();
