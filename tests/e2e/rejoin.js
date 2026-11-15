// A cabin player loses the line mid-flight: they reconnect by themselves and keep their seat.
// Needs: node peer.js (PeerServer on 127.0.0.1:9000) and a static server on ROOT.
const { chromium } = require('playwright');
const ROOT = process.env.ROOT || 'http://127.0.0.1:8765';
const BASE = ROOT + '/index.html?peer=127.0.0.1:9000';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
async function mk(b, name) {
  const c = await b.newContext({ viewport: { width: 1000, height: 600 }, permissions: ['microphone'] });
  const p = await c.newPage(); p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(BASE); await p.waitForFunction(() => window.KKNet && document.getElementById('btnOnline'));
  await p.fill('#netName', name).catch(() => {});
  return p;
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const H = await mk(b, 'PILOT'), T = await mk(b, 'TOWER'), A = await mk(b, 'ATTENDANT');
  let pass = true;
  try {
    await H.click('#btnOnline'); await H.click('#netCreate'); await H.waitForSelector('#net.v-room', { timeout: 20000 });
    const code = (await H.textContent('#netRoomCode')).trim(); log('lobby', code);
    for (const p of [T, A]) { await p.click('#btnOnline'); await p.fill('#netCode', code); await p.click('#netJoin'); await p.waitForSelector('#net.v-room', { timeout: 40000 }); }
    await A.click('#netAtt');
    await H.waitForFunction(() => /ATTENDANT/.test(document.getElementById('netMembers').textContent), null, { timeout: 15000 });
    await H.waitForFunction(() => !document.getElementById('netStart').disabled, null, { timeout: 15000 });
    await H.click('#netStart', { noWaitAfter: true });
    await H.waitForFunction(() => window.__kk.G && window.__kk.G.phase === 'flight', null, { timeout: 120000 });
    await A.waitForFunction(() => window.KKNet.state.inGame && window.KKNet.state.view === 'tower', null, { timeout: 60000 });
    const before = await A.evaluate(() => document.getElementById('twBook').contentWindow.location.href);
    log('flying; attendant frame', before.split('/').pop());
    // the host drops the attendant's line
    await H.evaluate(() => { const N = window.KKNet.state; const id = N.members.find((m) => m.role === 'attendant').id; N.conns[id].close(); });
    log('line cut');
    await A.waitForFunction(() => { const N = window.KKNet.state; return N.hostConn && N.inGame && N.members.some((m) => m.id === N.peer.id && m.role === 'attendant'); }, null, { timeout: 60000 });
    const after = await A.evaluate(() => [window.KKNet.state.view, document.getElementById('twBook').contentWindow.location.href.split('/').pop()]);
    log('back in, seat attendant, view/frame', JSON.stringify(after));
    if (after[0] !== 'tower') throw new Error('view changed: ' + after[0]);
    const seats = await H.evaluate(() => window.KKNet.state.members.map((m) => m.role).sort().join(','));
    log('host seats', seats);
    if (seats !== 'attendant,pilot,tower') throw new Error('seats ' + seats);
    // the cabin still reaches the pilot
    // (the message must come from the frame itself, so it is posted from there)
    await A.evaluate(() => { const w = document.getElementById('twBook').contentWindow; w.eval("window.parent.postMessage({ awf: 1, cab: { k: 'cockpit', in: true } }, '*')"); });
    await H.waitForFunction(() => window.__kk.G.guests && window.__kk.G.guests.attendant, null, { timeout: 30000 });
    log('pilot sees the attendant after the rejoin');
  } catch (e) { pass = false; log('FAIL', e.message.split('\n')[0]); }
  for (const p of [H, T, A]) if (p.errs.length) { pass = false; log('errors', p.errs.slice(0, 3)); }
  log(pass ? 'PASS' : 'FAIL'); await b.close(); process.exit(pass ? 0 : 1);
})();
