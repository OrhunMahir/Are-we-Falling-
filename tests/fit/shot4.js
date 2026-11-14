// (1) the attendant walking, stopping, starting again: bone state and pictures; (2) masks on faces + angry cabin
const L = require('./lib.js');
const tag = process.argv[2] || 'f';
(async () => {
  const s = await L.intruder({ settle: 2500 });
  const p = s.p;
  const st = () => p.evaluate(() => { const c = window.__cabinFit.crew[0], a = window.__cabin.play._att; const b = (n) => { const x = c.mesh.skeleton.bones.find((q) => q.name === n); return x ? x.quaternion.toArray().map((v) => +v.toFixed(2)).join(',') : null; }; return { w: +c.w.toFixed(2), sp: +c.sp.toFixed(2), moving: a.moving, z: +a.z.toFixed(2), L: b('LeftUpLeg'), R: b('RightUpLeg'), arm: b('LeftArm') }; });
  // walk towards the rear from z 2: camera at z 5.6 looking forward at her
  await p.evaluate(() => { const a = window.__cabin.play._att; a.z = 2.0; a.x = 0; a.dir = 1; a.wait = 0; a.mode = 'patrol'; });
  await L.view(p, null, 0, 6.2, 0, -0.12, 0, 300);
  for (let i = 0; i < 4; i++) { await p.waitForTimeout(350); console.log('walk', JSON.stringify(await st())); await p.screenshot({ path: L.SHOTS + '/' + tag + '-walk' + i + '.png' }); }
  // stop her where she is
  await p.evaluate(() => { const a = window.__cabin.play._att; a.wait = 9999; a.dir = 1; });
  for (const ms of [60, 200, 400, 900]) { await p.waitForTimeout(ms); console.log('stop +' + ms, JSON.stringify(await st())); await p.screenshot({ path: L.SHOTS + '/' + tag + '-stop' + ms + '.png' }); }
  await p.evaluate(() => { const a = window.__cabin.play._att; a.wait = 0; });
  for (const ms of [80, 200, 400]) { await p.waitForTimeout(ms); console.log('go +' + ms, JSON.stringify(await st())); }
  await p.screenshot({ path: L.SHOTS + '/' + tag + '-go.png' });
  // masks and an angry cabin
  await L.freeze(p, 9.0, 0, false);
  await p.evaluate(() => { const S = window.__cabin.play.state; S.fx.masks = 60; S.unrest = 1; });
  await L.view(p, tag + '-masks', 0, 1.7, Math.PI, -0.15, 0, 5000);
  await L.view(p, tag + '-masks-row', 0, 4.25, Math.PI / 2, -0.3, 0, 1200);
  const rot = await p.evaluate(() => window.__cabinFit.pax.map((m) => +(m.rotation.y - Math.PI).toFixed(2)).slice(0, 12));
  console.log('turns', JSON.stringify(rot));
  console.log('errs', JSON.stringify(s.errs.filter((e) => !/deprecated|GPU stall/.test(e)).slice(0, 8)));
  await s.b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
