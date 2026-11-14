const L = require('../fit/lib.js');
(async () => {
  const s = await L.open('/cabin.html?role=attendant&seed=2417');
  const p = s.p;
  await p.waitForFunction(() => window.__cabin && window.__cockpit && (window.__cockpit.ready || window.__cockpit.err), null, { timeout: 90000 });
  await p.evaluate(() => { const sc = window.__cabin.cabin.scene, prev = sc.onBeforeRender; sc.onBeforeRender = function (r, s2, cam) { if (prev) prev.apply(this, arguments); window.__cam = cam; }; });
  await p.evaluate(() => { const P = window.__cabin.cabin.player; P.yaw = 0; P.pitch = -0.05; P.hold = 99; P.settle = null; });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const cam = window.__cam, v = new THREE.Vector3(0, 1.0, 0.1).project(cam), el = document.getElementById('cab').getBoundingClientRect();
    const x = el.left + (v.x * 0.5 + 0.5) * el.width, y = el.top + (-v.y * 0.5 + 0.5) * el.height, e = document.elementFromPoint(x, y);
    const P = window.__cabin.cabin.player;
    return { x, y, v: [v.x, v.y, v.z], el: e && (e.id || e.tagName), cam: cam.position.toArray(), rot: [cam.rotation.x, cam.rotation.y], P: { x: P.x, z: P.z, yaw: P.yaw, pitch: P.pitch, hold: P.hold } };
  });
  console.log(JSON.stringify(r));
  await p.mouse.move(r.x, r.y); await p.waitForTimeout(600);
  console.log('hover', await p.evaluate(() => document.getElementById('hoverT').textContent));
  await p.mouse.move(r.x + 40, r.y + 40); await p.waitForTimeout(600);
  console.log('hover', await p.evaluate(() => document.getElementById('hoverT').textContent));
  await p.screenshot({ path: __dirname + '/shots/dbg.png' });
  await s.b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
