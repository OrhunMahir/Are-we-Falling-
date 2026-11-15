const { launch, page, log } = require('./lib.js');
const Q = 'index.html?peer=127.0.0.1:9000';
async function open(p, name) { await p.waitForFunction(() => window.KKNet); await p.click('#btnOnline'); await p.fill('#netName', name); }
(async () => {
  const b = await launch();
  const H = await page(b, Q, 'H'); await open(H, 'H'); await H.click('#netCreate'); await H.waitForSelector('#net.v-room');
  const code = (await H.textContent('#netRoomCode')).trim();
  for (const n of ['A', 'B', 'C', 'D']) {
    const q = await page(b, Q, n); await open(q, n); const t0 = Date.now();
    await q.fill('#netCode', code); await q.click('#netJoin');
    await q.waitForFunction(() => window.KKNet.state.view === 'room' || window.KKNet.state.error, null, { timeout: 120000 });
    log(n, Date.now() - t0, 'ms', await q.evaluate(() => [window.KKNet.state.view, window.KKNet.state.error, window.KKNet.state.dbg.slice(-3)]));
  }
  await b.close();
})();
