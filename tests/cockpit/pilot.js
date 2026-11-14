// the captain's own cockpit with visitors from the cabin
const L = require('../fit/lib.js');
const OUT = __dirname + '/shots/'; require('fs').mkdirSync(OUT, { recursive: true });
const tag = process.argv[2] || 'p';
(async () => {
  const s = await L.open('/index.html');
  const p = s.p;
  await p.waitForTimeout(1500);
  await p.click('#btnFly');
  await p.waitForFunction(() => window.__kk && window.__kk.G && window.__kk.G.phase === 'flight', null, { timeout: 120000 });
  await p.waitForTimeout(2500);
  const look = async (yaw, pitch, fov, wait) => { await p.evaluate(([yaw, pitch, fov]) => { const v = KK3D.view; v.yaw = yaw; v.pitch = pitch; v.fov = fov; }, [yaw, pitch, fov]); await p.waitForTimeout(wait || 1500); };
  const fig = () => p.evaluate(() => { const f = KK3D.figures(), o = {}; Object.keys(f.visitors).forEach((r) => { const v = f.visitors[r]; o[r] = { on: v.on, vis: v.f.g.visible, x: +v.x.toFixed(2), z: +v.z.toFixed(2) }; }); return o; });
  const until = async (fn, ms) => { try { await p.waitForFunction(fn, null, { timeout: ms || 60000, polling: 200 }); return true; } catch (e) { return false; } };
  await look(0, -0.2, 62); await p.screenshot({ path: OUT + tag + '-0-fwd.png' });
  // the flight attendant comes in
  await p.evaluate(() => window.__kk.cabinCockpit(true, 'attendant'));
  await look(Math.PI, -0.1, 62, 700); await p.screenshot({ path: OUT + tag + '-1-att-enters.png' });
  console.log('att settled', await until(() => { const v = KK3D.figures().visitors.attendant; return v && Math.hypot(v.x + 0.22, v.z - 0.95) < 0.03; }, 90000), JSON.stringify(await fig()));
  await look(-2.2, -0.15, 62); await p.screenshot({ path: OUT + tag + '-2-att-beside.png' });
  await look(-1.5, -0.25, 62); await p.screenshot({ path: OUT + tag + '-2b-right-console.png' });
  await look(0, -0.2, 62); await p.screenshot({ path: OUT + tag + '-2c-fwd.png' });
  await p.evaluate(() => window.__kk.cabinTask({ role: 'attendant', id: 'KISS', title: 'KISS THE PILOT', effect: 5, fx: [{ type: 'nocalm' }] }));
  await look(-2.2, -0.15, 62, 900); await p.screenshot({ path: OUT + tag + '-3-kiss.png' });
  // the intruder too
  await p.evaluate(() => window.__kk.cabinCockpit(true, 'saboteur'));
  await look(Math.PI, -0.1, 62, 900); await p.screenshot({ path: OUT + tag + '-4-sab-enters.png' });
  console.log('sab settled', await until(() => { const v = KK3D.figures().visitors.saboteur; return v && Math.hypot(v.x - 0, v.z - 2.5) < 0.03; }, 90000), JSON.stringify(await fig()));
  await look(Math.PI, -0.1, 62); await p.screenshot({ path: OUT + tag + '-5-sab-in.png' });
  // the captain stands up: both are at the door
  await p.evaluate(() => KK3D.stand(true));
  await until(() => KK3D.pose.k > 0.99, 60000);
  console.log('standing', await until(() => { const v = KK3D.figures().visitors.attendant; const w = KK3D.figures().visitors.saboteur; return v && Math.hypot(v.x + 0.17, v.z - 2.38) < 0.03 && Math.hypot(w.x - 0.15, w.z - 2.58) < 0.03; }, 90000), JSON.stringify(await fig()));
  await look(Math.PI, -0.05, 62); await p.screenshot({ path: OUT + tag + '-6-standing.png' });
  await look(Math.PI - 0.6, -0.05, 62); await p.screenshot({ path: OUT + tag + '-6b-standing-left.png' });
  // the intruder leaves: the flight attendant has the doorway to herself
  await p.evaluate(() => window.__kk.cabinCockpit(false, 'saboteur'));
  console.log('att alone at the door', await until(() => { const f = KK3D.figures().visitors; return !f.saboteur.f.g.visible && Math.hypot(f.attendant.x, f.attendant.z - 2.5) < 0.03; }, 90000), JSON.stringify(await fig()));
  await look(Math.PI, -0.05, 62); await p.screenshot({ path: OUT + tag + '-6c-att-doorway.png' });
  await look(Math.PI + 0.5, -0.05, 62); await p.screenshot({ path: OUT + tag + '-6d-aft-right.png' });
  console.log('door', await p.evaluate(() => { let d = null; KK3D.scene && KK3D.scene.traverse((o) => { if (o.isGroup && Math.abs(o.position.x + 0.31) < 1e-6 && Math.abs(o.position.z - 2.75) < 1e-6) d = +o.rotation.y.toFixed(2); }); return d; }));
  // both leave
  await p.evaluate(() => { window.__kk.cabinCockpit(false, 'saboteur'); window.__kk.cabinCockpit(false, 'attendant'); });
  await look(Math.PI, -0.05, 62, 600); await p.screenshot({ path: OUT + tag + '-7-leaving.png' });
  console.log('gone', await until(() => { const f = KK3D.figures().visitors; return !f.attendant.f.g.visible && !f.saboteur.f.g.visible; }, 90000), JSON.stringify(await fig()));
  await p.waitForTimeout(2500); await p.screenshot({ path: OUT + tag + '-8-gone.png' });
  console.log('log', JSON.stringify(await p.evaluate(() => window.__kk.G.log.slice(-8))));
  console.log('errs', JSON.stringify(s.errs.filter((e) => !/deprecated|GPU stall/.test(e)).slice(0, 8)));
  await s.b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
