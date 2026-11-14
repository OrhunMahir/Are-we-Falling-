// the real cockpit seen from the cabin page: plain mode (flight attendant), a few fixed views
const L = require('../fit/lib.js');
const OUT = __dirname + '/shots/'; require('fs').mkdirSync(OUT, { recursive: true });
const tag = process.argv[2] || 'a', extra = process.argv[3] || '';
(async () => {
  const s = await L.open('/cabin.html?role=attendant&seed=2417' + extra);
  const p = s.p;
  await p.waitForFunction(() => window.__cabin && window.__cockpit && (window.__cockpit.ready || window.__cockpit.err), null, { timeout: 90000 });
  console.log('cockpit', JSON.stringify(await p.evaluate(() => ({ ready: window.__cockpit.ready, err: window.__cockpit.err, panels: window.KK3D && window.KK3D.panels().length, places: Object.keys(window.__cabin.cabin.places) }))));
  await p.addStyleTag({ content: '#dbg, #hint { display: none !important; }' });
  const shot = async (name, x, z, yaw, pitch, wait) => {
    await p.evaluate(([x, z, yaw, pitch]) => { const P = window.__cabin.cabin.player; P.seat = null; P.path = []; P.dest = null; P.x = x; P.z = z; P.yaw = yaw; P.pitch = pitch; P.hold = 99; P.settle = null; }, [x, z, yaw, pitch]);
    await p.waitForTimeout(wait || 1500);
    await p.screenshot({ path: OUT + tag + '-' + name + '.png' });
  };
  await shot('door-closed', 0, 1.3, 0, -0.05);
  await p.evaluate(() => window.__cabin.cabin.setDoor(true));
  await shot('door-open', 0, 1.3, 0, -0.05, 2500);
  await shot('aisle-open', 0, 4.5, 0, -0.03);
  await shot('in-fwd', 0, -0.9, 0, -0.12);
  await shot('in-left', 0, -1.2, 0.9, -0.2);
  await shot('in-right', 0, -1.2, -0.9, -0.2);
  await shot('kiss', -0.3, -2.14, 0.6, -0.42);
  await shot('in-back', 0, -1.9, Math.PI, -0.1);
  await shot('in-up', 0, -1.4, 0, 0.7);
  console.log('errs', JSON.stringify(s.errs.filter((e) => !/deprecated|GPU stall/.test(e)).slice(0, 8)));
  await s.b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
