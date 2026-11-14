/* ARE WE FALLING? — the real cockpit behind the cabin's cockpit door.
   The two cabin seats used to find a stand-in room there, with a dummy at the controls. This file hangs the pilot's
   own cockpit in the cabin scene instead (js/cockpit3d.js in guest mode): the same flight built from the flight code,
   so the same panels sit on the same walls, the storm in the windows, and the captain in the left seat. The captain's
   head turns the way the real pilot looks around and they get up when the real pilot does: the lobby sends that with
   the flight state (st.vy, st.vp, st.up, see js/net.js).

   Who may walk in is decided in cabin.html (the flight attendant always, the intruder while the door stands cracked
   open). Nothing in here can be operated: it is the captain's cockpit, seen by a guest.
   Switch it off with cabin.html?cockpit=0: the stand-in room comes back. */
(function () {
  'use strict';
  const T = window.THREE, q = new URLSearchParams(location.search);
  if (!T || !window.KKCabin || q.get('cockpit') === '0') return;
  const OFF = -2.86;                 // cabin z = cockpit z + OFF: the cockpit's aft wall stands right behind the cabin's front wall
  const info = window.__cockpit = { ready: false, shown: false, err: null, off: OFF };
  const start0 = KKCabin.start;
  KKCabin.start = function (canvas, opts) {
    const cabin = start0.apply(this, arguments);
    if (cabin && cabin.scene) setTimeout(() => boot(cabin, opts || {}).catch((e) => { info.err = String((e && e.message) || e); console.error('cockpit:', e); }), 900);   // after the cabin's first frames
    return cabin;
  };
  const load = (src) => new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('cannot load ' + src)); document.head.appendChild(el); });

  async function boot(cabin, opts) {
    const KK = window.KK, scene = cabin.scene;
    if (!KK || !KK.genFlight) throw new Error('no flight rules on this page');
    // the cockpit scripts keep a reference to the game's sound at load time: here nothing may sound, so they get a mute one
    if (!window.KKAudio) { const mute = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : mute), apply: () => mute }); window.KKAudio = mute; }
    if (!window.KK3D) await load('js/cockpit3d.js');
    if (!window.KKDecoys) await load('js/decoys.js');
    if (!window.KKModules3D) await load('js/modules3d.js');
    const K3 = window.KK3D;
    if (!K3 || !K3.guest) throw new Error('js/cockpit3d.js has no guest mode');

    const root = new T.Group(), lights = new T.Group();
    root.position.z = lights.position.z = OFF; root.visible = false; root.userData.awfCockpit = lights.userData.awfCockpit = true;
    scene.add(root); scene.add(lights);
    if (!K3.guest(root, lights)) throw new Error('the cockpit is already in use on this page');

    // the same flight as on the pilot's screen: the code carries the mode in its first digit
    const seed = +opts.seed || 1, flight = KK.genFlight(seed, (KK.codeMode && KK.codeMode(seed)) || 'mayday');
    let st = {}, stAt = 0, t0 = performance.now();
    const quiet = { ac: flight.aircraft, done: () => true, audible: () => false, log() {}, subtitle() {}, strike() {}, solve() {} };
    const built = K3.build(flight, (m, P) => window.KKModules3D[m.id](P, m.state, quiet),
      [{ id: 'pa', title: 'PASSENGER ADDRESS', build: (P) => window.KKModules3D.pa(P, { state: () => ({ unrest: +st.u || 0, complaint: null, lastPA: null }), listen() {}, announce() { return false; } }) }]);
    const solved = {};

    // what stood behind the door until now: the cabin's black wall with four lamps, and the intruder layer's stand-in room
    if (cabin.setPeek) cabin.setPeek(false);
    let swept = 0;
    function sweep() {
      scene.children.forEach((o) => {
        if (o.userData.awfCockpit || !o.visible) return;
        if (o.isMesh && o.position.z < -0.5 && o.position.z > -0.7) o.visible = false;
        else if (o.isGroup && o.children.length > 30 && o.children.some((c) => c.isPointLight) && o.children.some((c) => c.userData && c.userData.arms)) o.visible = false;
      });
    }
    const doorLeaf = scene.children.find((o) => o.isGroup && Math.abs(o.position.x + 0.33) < 1e-6 && Math.abs(o.position.z - 0.03) < 1e-6);
    const ajar = () => (cabin.door ? cabin.door() : doorLeaf ? -doorLeaf.rotation.y / 1.45 : 1);   // 0 closed .. 1 open
    const flashL = scene.children.find((o) => o.isAmbientLight && o.color.getHex() === 0xcfe0ff);   // the cabin's lightning

    // the flight, as the lobby reports it twice a second
    window.addEventListener('message', (e) => {
      const d = e.data; if (!d || d.awf !== 1 || !d.st) return;
      st = d.st; stAt = performance.now();
      if (st.vy != null) K3.pilot({ yaw: +st.vy, pitch: +st.vp, up: +st.up });
      if (Array.isArray(st.o) && built && built.modules) Object.keys(built.modules).forEach((id) => { if (!solved[id] && st.o.indexOf(id) < 0 && st.ph === 'flight') { solved[id] = 1; built.modules[id].status().set(true, '#39d98a'); } });
    });

    let last = performance.now(), warm = 12, wasFlash = false;
    const P = cabin.player, prev = scene.onBeforeRender;
    scene.onBeforeRender = function () {
      if (prev) prev.apply(this, arguments);
      try {
        const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (swept < 600 && swept++ % 30 === 0) sweep();                     // the intruder layer builds its room a little later than we build ours
        const inside = P.z < -0.02, show = warm > 0 || inside || ajar() > 0.012;
        if (warm > 0) warm--;                                               // the first frames draw it once behind the closed door, so nothing has to load when the door opens
        root.visible = info.shown = show;
        const fl = flashL && flashL.intensity > 0.25; if (fl && !wasFlash) K3.lightning(); wasFlash = fl;
        const t = (now - t0) / 1000, live = now - stAt < 3000 && st.tot > 0, flying = !live || st.ph === 'flight';
        const left = live ? +st.tl : Math.max(0, 420 - t), total = live ? +st.tot : 420;
        K3.tick(dt, {
          light: show ? 1 : 0, t, roll: Math.sin(t * 0.31) * 0.05 + Math.sin(t * 0.83) * 0.02, shake: cabin.state.turb || 0,
          altFt: Math.max(0, Math.round(left / total * 2400) * 10), danger: flying && left < 30 ? 1 : 0, vs: 1800,
        });
      } catch (e) { if (!info.err) { info.err = String((e && e.message) || e); console.error('cockpit:', e); } }
    };
    info.ready = true; info.root = root; info.flight = flight; info.K3 = K3;
  }
})();
