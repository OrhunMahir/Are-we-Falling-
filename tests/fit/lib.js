// shared helpers for the scratch scripts of this track: one browser, the intruder view on port 8801
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:' + (process.env.PORT || 8771);
const SHOTS = __dirname + '/shots'; require('fs').mkdirSync(SHOTS, { recursive: true });
async function open(url, opts) {
  opts = opts || {};
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: opts.w || 1280, height: opts.h || 720 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + ' ' + String(e.stack || '').split('\n').slice(0, 3).join(' | ')));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 300)); });
  p.on('requestfailed', (r) => errs.push('REQFAIL ' + r.url()));
  await p.goto(BASE + url, { waitUntil: 'load' });
  return { b, p, errs };
}
async function intruder(opts) {
  opts = opts || {};
  const s = await open('/cabin.html?embed=1&role=saboteur&seed=' + (opts.seed || 2417) + (opts.extra || ''), opts);
  await s.p.waitForFunction(() => window.__cabin && window.__cabin.play, null, { timeout: 60000 });
  await s.p.waitForFunction(() => { const sc = window.__cabin.cabin.scene; let n = 0, sk = 0; sc.traverse((o) => { if (o.name === 'facecup') n++; if (o.isSkinnedMesh) sk++; }); return n > 5 && sk > 0; }, null, { timeout: 90000 }).catch(() => s.errs.push('models did not load'));
  await s.p.waitForTimeout(opts.settle || 2000);
  if (!opts.hud) await s.p.addStyleTag({ content: '.ix, #ixVest { display: none !important; }' });
  return s;
}
const view = async (p, name, x, z, yaw, pitch, y, wait) => {
  await p.evaluate(([x, z, yaw, pitch, y]) => { const P = window.__cabin.cabin.player; P.seat = null; P.path = []; P.x = x; P.z = z; P.yaw = yaw; P.pitch = pitch; P.hold = 99; if (y) P.y = y; }, [x, z, yaw, pitch, y || 0]);
  await p.waitForTimeout(wait || 1200);
  if (name) await p.screenshot({ path: SHOTS + '/' + name + '.png' });
};
const freeze = (p, z, yaw, moving, x) => p.evaluate(([z, yaw, moving, x]) => { const a = window.__cabin.play._att; a.z = z; a.x = x || 0; a.yaw = yaw; a.wait = 9999; a.mode = 'patrol'; a.moving = moving; }, [z, yaw, moving, x || 0]);
module.exports = { open, intruder, view, freeze, BASE, SHOTS };

// a probe camera: takes over the cabin's camera inside scene.onBeforeRender (the cabin sets position and rotation
// every frame, so this runs after it). cam = { pos:[x,y,z], target:[x,y,z], fov, near, far } or null to give it back.
async function probeCam(p, cam) {
  await p.evaluate((cam) => {
    const sc = window.__cabin.cabin.scene, T = window.THREE;
    if (!sc.__probe) {
      sc.__probe = { cam: null, saved: null };
      const prev = sc.onBeforeRender;
      sc.onBeforeRender = function (r, s, camera) {
        if (prev) prev.apply(this, arguments);
        const pr = sc.__probe;
        if (pr.cam) {
          if (!pr.saved) pr.saved = { fov: camera.fov, near: camera.near, far: camera.far };
          const c = pr.cam; camera.fov = c.fov; camera.near = c.near; camera.far = c.far; camera.updateProjectionMatrix();
          camera.position.set(c.pos[0], c.pos[1], c.pos[2]); camera.up.set(c.up ? c.up[0] : 0, c.up ? c.up[1] : 1, c.up ? c.up[2] : 0); camera.lookAt(c.target[0], c.target[1], c.target[2]); camera.updateMatrixWorld(true);
        } else if (pr.saved) { camera.fov = pr.saved.fov; camera.near = pr.saved.near; camera.far = pr.saved.far; camera.up.set(0, 1, 0); camera.updateProjectionMatrix(); pr.saved = null; }
      };
    }
    sc.__probe.cam = cam;
  }, cam);
}
// quasi-orthographic cut: look at `target` from direction `dir` (unit-ish) through a slab of thickness `slab`
// around the target, showing `span` metres vertically
function cut(target, dir, span, slab, dist) {
  dist = dist || 30; const n = Math.hypot(dir[0], dir[1], dir[2]), d = dir.map((v) => v / n);
  return { pos: [target[0] + d[0] * dist, target[1] + d[1] * dist, target[2] + d[2] * dist], target, fov: 2 * Math.atan(span / 2 / dist) * 180 / Math.PI, near: dist - slab / 2, far: dist + slab / 2, up: Math.abs(d[1]) > 0.99 ? [0, 0, -1] : [0, 1, 0] };
}
module.exports.probeCam = probeCam; module.exports.cut = cut;
