// close-ups of the attendant (front, three quarter, side, from a seat) + fit numbers
const L = require('./lib.js');
const tag = process.argv[2] || 'b', extra = process.argv[3] || '';
(async () => {
  const s = await L.intruder({ settle: 2500, extra });
  const info = await s.p.evaluate(() => { const f = window.__cabinFit; return f ? { crew: f.crew.map((c) => ({ name: c.name, idle: c.idle ? c.idle.length : 0, face: !!c.face, w: c.w })), err: f.err ? String(f.err.stack || f.err) : null } : null; });
  console.log(JSON.stringify(info));
  await L.freeze(s.p, 6.3, 0, false);            // she stands at z 6.3 and looks towards the front (yaw 0 = facing -z)
  await s.p.waitForTimeout(1200);
  await L.view(s.p, tag + '-att-far', 0, 3.6, Math.PI, -0.08);
  await L.view(s.p, tag + '-att-near', 0, 5.2, Math.PI, 0.0);
  await L.probeCam(s.p, { pos: [0, 1.55, 5.55], target: [0, 1.52, 6.3], fov: 30, near: 0.05, far: 30 });
  await s.p.waitForTimeout(700); await s.p.screenshot({ path: L.SHOTS + '/' + tag + '-head-front.png' });
  await L.probeCam(s.p, { pos: [0.55, 1.58, 5.75], target: [0, 1.52, 6.3], fov: 30, near: 0.05, far: 30 });
  await s.p.waitForTimeout(700); await s.p.screenshot({ path: L.SHOTS + '/' + tag + '-head-34.png' });
  await L.probeCam(s.p, { pos: [0.8, 1.52, 6.3], target: [0, 1.52, 6.3], fov: 30, near: 0.05, far: 30 });
  await s.p.waitForTimeout(700); await s.p.screenshot({ path: L.SHOTS + '/' + tag + '-head-side.png' });
  await L.probeCam(s.p, { pos: [0, 0.95, 4.4], target: [0, 0.85, 6.3], fov: 50, near: 0.05, far: 30 });
  await s.p.waitForTimeout(700); await s.p.screenshot({ path: L.SHOTS + '/' + tag + '-body-front.png' });
  await L.probeCam(s.p, { pos: [1.9, 0.95, 6.3], target: [0, 0.85, 6.3], fov: 50, near: 0.05, far: 30 });
  await s.p.waitForTimeout(700); await s.p.screenshot({ path: L.SHOTS + '/' + tag + '-body-side.png' });
  await L.probeCam(s.p, null);
  console.log('errs', JSON.stringify(s.errs.filter((e) => !/deprecated|GPU stall/.test(e)).slice(0, 8)));
  await s.b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
