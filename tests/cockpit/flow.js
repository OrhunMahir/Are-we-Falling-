// the flight attendant walks into the cockpit by clicking, does KISS THE PILOT inside, walks out with the keys
const L = require('../fit/lib.js');
const OUT = __dirname + '/shots/'; require('fs').mkdirSync(OUT, { recursive: true });
const tag = process.argv[2] || 'f', extra = process.argv[3] || '';
const log = (...a) => console.log(...a);
(async () => {
  const s = await L.open('/cabin.html?role=attendant&seed=2417' + extra);
  const p = s.p;
  await p.waitForFunction(() => window.__cabin && window.__cockpit && (window.__cockpit.ready || window.__cockpit.err), null, { timeout: 90000 });
  await p.evaluate(() => { const sc = window.__cabin.cabin.scene, prev = sc.onBeforeRender; sc.onBeforeRender = function (r, s2, cam) { if (prev) prev.apply(this, arguments); window.__cam = cam; }; });
  const st = () => p.evaluate(() => { const c = window.__cabin.cabin, a = c.at(); return { place: a.place, x: a.x, z: a.z, door: +c.door().toFixed(2), shown: window.__cockpit.shown, where: document.getElementById('whereT').textContent, hover: document.getElementById('hoverT').textContent, hold: document.getElementById('hold').classList.contains('show') ? document.getElementById('holdT').textContent : '', tasks: window.__cabin.tasks.map((t) => t.def.id + (t.done ? ':done' : '')).join(','), clock: Math.round(window.__cabin.clock) }; });
  const scr = (x, y, z) => p.evaluate(([x, y, z]) => { const v = new THREE.Vector3(x, y, z).project(window.__cam); const r = document.getElementById('cab').getBoundingClientRect(); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height }; }, [x, y, z]);
  const waitStill = async (ms) => { const t0 = Date.now(); for (;;) { await p.waitForTimeout(250); const a = await p.evaluate(() => window.__cabin.cabin.at().place); if (a !== 'moving' || Date.now() - t0 > (ms || 20000)) return; } };
  const until = async (fn, ms, arg) => { try { await p.waitForFunction(fn, arg, { timeout: ms || 60000, polling: 200 }); return true; } catch (e) { return false; } };
  const face = (yaw, pitch) => p.evaluate(([yaw, pitch]) => { const P = window.__cabin.cabin.player; P.yaw = yaw; P.pitch = pitch; P.hold = 99; P.settle = null; }, [yaw, pitch]);
  log('start', JSON.stringify(await st()));
  // 1. click the cockpit door from the galley
  await face(0, -0.05); await p.waitForTimeout(700);
  let c = await scr(0, 1.5, 0.1); await p.mouse.move(c.x, c.y); await p.waitForTimeout(500);
  log('hover1', JSON.stringify((await st()).hover));
  await p.mouse.click(c.x, c.y); await until(() => window.__cabin.cabin.at().place === 'door');
  await p.waitForTimeout(1200);
  log('at door', JSON.stringify(await st()));
  await p.screenshot({ path: OUT + tag + '-1-door.png' });
  // 2. click it again: walk in
  await face(0, -0.05); await p.waitForTimeout(500);
  c = await scr(0, 1.5, 0.1); await p.mouse.move(c.x + 3, c.y + 3); await p.waitForTimeout(500);
  log('hover2', JSON.stringify((await st()).hover));
  await p.mouse.click(c.x, c.y);
  await until(() => window.__cabin.cabin.door() > 0.4); log('opening', JSON.stringify(await st()));
  await p.screenshot({ path: OUT + tag + '-2-opening.png' });
  log('arrived', await until(() => window.__cabin.cabin.at().place === 'cockpit', 90000));
  await p.evaluate(() => { window.__cabin.cabin.player.hold = 0; }); await p.waitForTimeout(6000);
  log('inside', JSON.stringify(await st()));
  await p.screenshot({ path: OUT + tag + '-3-inside.png' });
  // 3. the kiss
  await p.keyboard.down('e'); await until(() => document.getElementById('holdB').style.width.replace('%', '') > 40, 30000); await p.screenshot({ path: OUT + tag + '-4-kissing.png' });
  log('kiss done', await until(() => window.__cabin.tasks[0].done, 60000)); await p.keyboard.up('e');
  await p.waitForTimeout(1500);
  log('kissed', JSON.stringify(await st()));
  await p.screenshot({ path: OUT + tag + '-5-after.png' });
  // 4. walk out backwards with S
  await face(0, -0.1);
  await p.keyboard.down('s'); log('out', await until(() => window.__cabin.cabin.player.z > 1.3, 90000)); await p.keyboard.up('s');
  log('out', JSON.stringify(await st()));
  log('door shut', await until(() => window.__cabin.cabin.door() < 0.03, 60000), JSON.stringify(await st()));
  await p.screenshot({ path: OUT + tag + '-6-out.png' });
  // 5. and in again with W, straight through
  await p.keyboard.down('w'); log('w-in', await until(() => window.__cabin.cabin.player.z < -2.1, 120000)); await p.keyboard.up('w');
  log('w-in', JSON.stringify(await st()));
  // 6. click the door from inside: back to the door place
  await face(Math.PI, -0.05); await p.waitForTimeout(800);
  c = await scr(0, 0.6, 0.1); await p.mouse.move(c.x, c.y); await p.waitForTimeout(500); log('hover-back', JSON.stringify((await st()).hover));
  await p.mouse.click(c.x, c.y); log('back', await until(() => window.__cabin.cabin.at().place === 'door', 90000));
  log('back at', JSON.stringify(await st()));
  log('door shut', await until(() => window.__cabin.cabin.door() < 0.03, 60000), JSON.stringify(await st()));
  log('errs', JSON.stringify(s.errs.filter((e) => !/deprecated|GPU stall/.test(e)).slice(0, 8)), 'cockpit err', await p.evaluate(() => window.__cockpit.err));
  await s.b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
