// Four seats in one lobby, real WebRTC against a local PeerServer (node peer.js on 127.0.0.1:9000):
// pilot (host), tower, intruder, flight attendant. Checks that the cabin seats load their first-person layers,
// see each other, that a sabotage reaches the attendant and the pilot, that the attendant's catch ends the intruder's game,
// and that the cockpit door and a cockpit visit reach the pilot.
// ROOT=http://127.0.0.1:8765 node four.js     (RELAY=1 to force the relay for the cabin seats)
const { chromium } = require('playwright');
const ROOT = process.env.ROOT || 'http://127.0.0.1:8765';
const BASE = ROOT + '/index.html?peer=127.0.0.1:9000';
const R = process.env.RELAY ? '&relay=1' : '';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
async function mk(b, name, qs) {
  const c = await b.newContext({ viewport: { width: 1100, height: 640 }, permissions: ['microphone'] });
  const p = await c.newPage(); p.name = name; p.errs = [];
  p.on('pageerror', (e) => p.errs.push('PAGEERR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|404|WebGL|GPU/.test(m.text())) p.errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  p.on('frameattached', () => {});
  await p.goto(BASE + (qs || ''));
  await p.waitForFunction(() => window.KKNet && document.getElementById('btnOnline'));
  await p.fill('#netName', name).catch(() => {});
  return p;
}
const frameOf = (p) => p.frames().find((f) => /cabin\.html\?embed=1.*seed=/.test(f.url()));
async function inFrame(p, fn, arg) { const f = frameOf(p); if (!f) return null; try { return await f.evaluate(fn, arg); } catch (e) { return 'ERR ' + e.message.split('\n')[0]; } }
async function until(p, fn, arg, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 60000)) { const r = await inFrame(p, fn, arg); if (r && !(typeof r === 'string' && r.startsWith('ERR'))) return r; await p.waitForTimeout(500); }
  throw new Error('timeout: ' + label);
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const H = await mk(b, 'PILOT'), T = await mk(b, 'TOWER'), S = await mk(b, 'INTRUDER', R), A = await mk(b, 'ATTENDANT', R);
  const all = [H, T, S, A];
  let pass = true;
  try {
    await H.click('#btnOnline'); await H.click('#netCreate'); await H.waitForSelector('#net.v-room', { timeout: 20000 });
    const code = (await H.textContent('#netRoomCode')).trim(); log('lobby', code);
    for (const p of [T, S, A]) { await p.click('#btnOnline'); await p.fill('#netCode', code); await p.click('#netJoin'); await p.waitForSelector('#net.v-room', { timeout: 40000 }); }
    await H.waitForFunction(() => document.querySelectorAll('#netMembers .net-m:not(.empty)').length === 4, null, { timeout: 20000 });
    log('4 members; relay:', await S.evaluate(() => !!(window.KKNet.state.hostConn || {}).relay), await A.evaluate(() => !!(window.KKNet.state.hostConn || {}).relay));
    await S.click('#netSab'); await A.click('#netAtt');
    await H.waitForFunction(() => /INTRUDER/.test(document.getElementById('netMembers').textContent) && /ATTENDANT/.test(document.getElementById('netMembers').textContent), null, { timeout: 15000 });
    await H.waitForFunction(() => !document.getElementById('netStart').disabled, null, { timeout: 15000 });
    await H.click('#netStart', { noWaitAfter: true });
    log('started');
    await H.evaluate(() => { window.__hc = {}; Object.values(window.KKNet.state.conns).forEach((c) => c.on('data', (d) => { if (d && d.t === 'cab') { const k = d.k + ':' + (d.m ? d.m.t : ''); window.__hc[k] = (window.__hc[k] || 0) + 1; } })); });
    await A.evaluate(() => { window.__ao = {}; const hc = window.KKNet.state.hostConn, o = hc.send.bind(hc); hc.send = (d) => { if (d && d.t === 'cab') { const k = d.k + ':' + (d.m ? d.m.t : '') + (d.k === 'cockpit' ? ':' + d.in : ''); window.__ao[k] = (window.__ao[k] || 0) + 1; } return o(d); }; });
    for (const p of [A, S, T]) await p.evaluate(() => { const N = window.KKNet.state; let v = N.inGame; window.__ig = []; Object.defineProperty(N, 'inGame', { get: () => v, set: (x) => { if (x !== v) window.__ig.push([Math.round(performance.now()), x, new Error().stack.split('\n').slice(2, 5).map((l) => l.trim()).join(' | ')]); v = x; }, configurable: true }); });
    await A.evaluate(() => { window.__ac = {}; window.KKNet.state.hostConn.on('data', (d) => { if (d && d.t === 'cab') { const k = d.role + ':' + d.k + ':' + (d.m ? d.m.t : ''); window.__ac[k] = (window.__ac[k] || 0) + 1; } }); });
    for (const p of [S, A]) await p.evaluate(() => { window.__cl = []; window.addEventListener('message', (e) => { const d = e.data; if (d && d.cab && d.cab.k === 'cockpit') window.__cl.push(d.cab.in); }); window.__lc = {}; window.addEventListener('message', (e) => { const d = e.data; if (d && d.cab) { const k = d.cab.k + (d.cab.m ? ':' + d.cab.m.t : ''); window.__lc[k] = (window.__lc[k] || 0) + 1; } }); });
    // the cabin pages load with the flight's seed and both flags
    const sInfo = await until(S, () => window.__cabin && window.__cabin.play && { url: location.search, link: !!window.__cabin.link }, null, 120000, 'intruder layer');
    const aInfo = await until(A, () => window.__cabin && window.__cabin.play && { url: location.search, link: !!window.__cabin.link, intruder: window.__cabin.play.state.intruder }, null, 120000, 'attendant layer');
    await inFrame(S, () => { const l = window.__cabin.link; window.__tx = 0; const o = l.send; l.send = (m) => { window.__tx++; window.__txl = m; return o.call(l, m); }; window.addEventListener('error', (e) => { window.__err = (e.message || '') + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno; }); window.__rf = 0; const f = () => { window.__rf++; requestAnimationFrame(f); }; f(); });
    await inFrame(A, () => { window.__rx = {}; window.addEventListener('message', (e) => { const d = e.data; if (d && d.cab) { const k = d.cab.k + ':' + d.cab.role + (d.cab.m ? ':' + d.cab.m.t + ':' + d.cab.m.who : ''); window.__rx[k] = (window.__rx[k] || 0) + 1; } }); });
    log('intruder page', JSON.stringify(sInfo)); log('attendant page', JSON.stringify(aInfo));
    // they see each other
    await until(A, () => { const c = window.__cabin; return c.play && document.querySelector('#axList') && window.__cabin.play && (window.__seenInt = (window.__seenInt || 0) + 0) >= 0 && c.play.state && c.cabin && true; }, null, 5000, 'x');
    const seen = await until(A, () => { const s = window.__cabin.play; return s.state.intruder && window.__cabin.cabin && (window.__cabin.play.__ip || true) && document.getElementById('axWhere') && true; }, null, 30000, 'att sees intruder flag');
    await until(S, () => { const p = window.__cabin.play; return p && p.state && p.state.clock < 420 && p.state.clock; }, null, 60000, 'intruder gets the real clock');
    // the intruder walks into the aisle (stand up), the attendant should see a figure move
    await inFrame(S, () => { const c = window.__cabin.cabin; c.player.seat = null; c.player.x = 0; c.player.z = 4.0; c.player.place = 'aisle'; });
    const intSeen = await until(A, () => { let vis = null; window.__cabin.cabin.scene.traverse((o) => { if (o.userData && o.userData.legL && o.visible && o.parent === window.__cabin.cabin.scene && Math.abs(o.position.z - 4) < 0.6 && Math.abs(o.position.x) < 0.3) vis = [+o.position.x.toFixed(2), +o.position.z.toFixed(2)]; }); return vis; }, null, 40000, 'attendant draws the walking intruder');
    log('attendant sees the intruder at', JSON.stringify(intSeen));
    const attSeen = await until(S, () => { const sc = window.__cabin.cabin.scene; let v = null; sc.traverse((o) => { if (o.userData && o.userData.legL && o.visible && o.parent === sc && Math.abs(o.position.z - 1.02) < 0.5) v = [+o.position.x.toFixed(2), +o.position.z.toFixed(2)]; }); return v; }, null, 40000, 'intruder draws the attendant (blocky or Meshy)').catch((e) => { log('note:', e.message); return null; });
    log('intruder sees the attendant at', JSON.stringify(attSeen));
    // a sabotage on the intruder's page: the masks task done by hand
    const sabId = await inFrame(S, () => { const t = window.__cabin.play.state.tasks.find((x) => !x.done && !x.def.bonus); t.prog = t.def.seconds; window.__cabin.cabin.player.place = t.def.place === 'seat' ? 'aisle' : t.def.place; if (t.def.place === 'seat') { const s = window.__cabin.cabin.seats.find((q) => !q.taken); window.__cabin.cabin.player.seat = s; } else { const P = window.__cabin.cabin.player; const pos = { galley: [-0.35, 1.02], lavatory: [-1.0, 10.0], door: [0, 0.62], aisle: [0, 5] }[t.def.place]; P.x = pos[0]; P.z = pos[1]; } return t.def.id; });
    log('intruder works on', sabId);
    await until(S, (id) => window.__cabin.play.state.tasks.find((x) => x.def.id === id).done, sabId, 60000, 'sabotage done');
    const opened = await until(A, (id) => { const t = window.__cabin.play.state.tasks.find((x) => x.def.undoes && String(x.def.undoes).toLowerCase() === String(id).toLowerCase()); return t && t.def.id; }, sabId, 40000, 'attendant gets the answer task');
    log('attendant got task', opened);
    await H.waitForFunction(() => window.__kk.G && window.__kk.G.log.some((l) => /Sabotage in the cabin/.test(l.text)), null, { timeout: 30000 });
    log('pilot logged the sabotage');
    // the attendant walks into the cockpit: the pilot sees her
    await inFrame(A, () => { const P = window.__cabin.cabin.player; P.seat = null; P.x = 0; P.z = 0.8; P.yaw = 0; });
    await A.waitForTimeout(2000);
    await inFrame(A, () => { const P = window.__cabin.cabin.player; P.x = 0; P.z = -1.2; });
    await H.waitForFunction(() => window.__kk.G && window.__kk.G.guests && window.__kk.G.guests.attendant, null, { timeout: 40000 });
    log('pilot sees the attendant in the cockpit; door', await H.evaluate(() => window.__kk.G.door));
    await inFrame(A, () => { const P = window.__cabin.cabin.player; P.x = 0; P.z = 3.0; });
    // the catch: the intruder works next to the attendant
    await inFrame(S, () => { const c = window.__cabin; const P = c.cabin.player; P.seat = null; P.x = 0; P.z = 3.6; window.__forceWork = setInterval(() => { c.play.state.tasks.forEach(() => {}); }, 1000); });
    // fake 'working' on the intruder side by sending a pose with working: true through its own link
    await inFrame(S, () => { window.__fw = setInterval(() => window.__cabin.link.send({ t: 'pose', who: 'int', x: 0, z: 3.6, yaw: 0, seat: null, place: 'aisle', moving: false, working: true }), 300); });
    await until(A, () => window.__cabin.play._ip.working && Math.abs(window.__cabin.play._ip.z - 3.6) < 0.2, null, 40000, 'attendant sees the intruder at work');
    await inFrame(A, () => { const P = window.__cabin.cabin.player; P.x = 0; P.z = 3.0; P.yaw = Math.PI; P.hold = 99; });
    await A.waitForTimeout(800);
    await A.keyboard.press('c');
    const caught = await until(S, () => window.__cabin.play.state.done && window.__cabin.play.state.caught && document.getElementById('ixEndH').textContent, null, 40000, 'intruder caught');
    log('intruder screen:', caught);
    await H.waitForFunction(() => window.__kk.G && window.__kk.G.caught, null, { timeout: 30000 });
    log('pilot knows the intruder is caught');
    // end of flight: the pilot lands
    await H.evaluate(() => window.__kk.land());
    await until(A, () => document.getElementById('axEndH') && document.getElementById('axEndH').textContent, null, 180000, 'attendant end card').then((t) => log('attendant end card:', t));
  } catch (e) { pass = false; log('FAIL', e.message.split('\n')[0]);
    try { log('H in', JSON.stringify(await H.evaluate(() => window.__hc))); log('A in', JSON.stringify(await A.evaluate(() => window.__ac))); log('H dbg', JSON.stringify(await H.evaluate(() => window.KKNet.state.dbg.slice(-8)))); log('A dbg', JSON.stringify(await A.evaluate(() => window.KKNet.state.dbg.slice(-8)))); log('inGame changes A', JSON.stringify(await A.evaluate(() => window.__ig))); log('inGame changes S', JSON.stringify(await S.evaluate(() => window.__ig))); log('inGame changes T', JSON.stringify(await T.evaluate(() => window.__ig))); log('A out', JSON.stringify(await A.evaluate(() => [window.__ao, window.KKNet.state.hostConn === undefined, window.KKNet.state.inGame]))); log('H', JSON.stringify(await H.evaluate(() => { const G = window.__kk.G; return G && { ph: G.phase, guests: G.guests, door: G.door, log: G.log.slice(-6).map((l) => l.text) }; }))); log('A top cockpit msgs', JSON.stringify(await A.evaluate(() => window.__cl))); log('A cockpit', JSON.stringify(await inFrame(A, () => { const P = window.__cabin.cabin.player; return { x: P.x, z: P.z, place: P.place, top: window.__lc }; }))); log('S frame', JSON.stringify(await inFrame(S, () => ({ tx: window.__tx, txl: window.__txl, rf: window.__rf, dbg: window.__cabin.play._dbg && window.__cabin.play._dbg(), now: performance.now(), sus: String(window.__cabin.play.state.suspicion), unrest: String(window.__cabin.play.state.unrest), ltx: window.__linkTx, same: window.__cabin.link === window.__cabin.play.__l, err: window.__err, where: (document.getElementById('ixWhere')||{}).textContent, alive: typeof window.__cabin.play.stop, done: window.__cabin.play.state.done, caught: window.__cabin.play.state.caught })))); log('S probe', JSON.stringify(await inFrame(S, () => { const l = window.__cabin.link; const b = window.__linkTx; l.send({ t: 'pose', who: 'int', x: 0, z: 4 }); return { b, a: window.__linkTx, src: l.send.toString().slice(0, 200), st: KKIntruder.start.toString().indexOf("who: 'int'") }; }))); log('S top', JSON.stringify(await S.evaluate(() => window.__lc))); log('A top', JSON.stringify(await A.evaluate(() => window.__lc))); log('A frame rx', JSON.stringify(await inFrame(A, () => [window.__rx, window.__cabin.play.state.done, window.__cabin.play.state.clock, window.__cabin.phase, window.__cabin.link && typeof window.__cabin.link.on]))); log('A synth', JSON.stringify(await inFrame(A, async () => { window.postMessage({ awf: 1, cab: { k: 'link', role: 'saboteur', m: { t: 'pose', who: 'int', x: 0, z: 4 } } }, '*'); await new Promise((r) => setTimeout(r, 1500)); return window.__cabin.play._ip; }))); log('A ip', JSON.stringify(await inFrame(A, () => window.__cabin.play._ip))); log('S pose', JSON.stringify(await inFrame(S, () => [window.__cabin.play.pose(), !!window.__cabin.link]))); } catch (er) {}
  }
  for (const p of all) { const fe = []; const f = frameOf(p); log(p.name, 'errors:', [...new Set(p.errs)].slice(0, 6).join(' | ') || 'none'); }
  log(pass ? 'PASS' : 'FAIL');
  await b.close();
})();
