// three seats (pilot, tower, ROLE): ROLE=saboteur -> the quiet-line clock; ROLE=attendant -> one landing at touchdown, banner, frames blanked, flight 2
const { launch, page, log } = require('./lib.js');
const Q = 'index.html?peer=127.0.0.1:9000', ROLE = process.env.ROLE || 'attendant';
async function open(p, name) { await p.waitForFunction(() => window.KKNet); await p.click('#btnOnline'); await p.fill('#netName', name); }
const frameOf = (p) => p.frames().find((f) => /cabin\.html\?embed=1.*seed=/.test(f.url()));
async function inF(p, fn, arg) { const f = frameOf(p); if (!f) return null; try { return await f.evaluate(fn, arg); } catch (e) { return null; } }
async function until(p, fn, arg, ms, label) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await inF(p, fn, arg); if (r) return r; await p.waitForTimeout(400); } throw new Error('timeout ' + label); }
(async () => {
  const b = await launch(); let bad = 0; const fail = (s) => { bad++; log('BAD', s); };
  const H = await page(b, Q, 'H'), T = await page(b, Q, 'T'), C = await page(b, Q, 'C');
  try {
    await open(H, 'PILOT'); await H.click('#netCreate'); await H.waitForSelector('#net.v-room');
    const code = (await H.textContent('#netRoomCode')).trim();
    for (const p of [T, C]) { await open(p, p.name); await p.fill('#netCode', code); await p.click('#netJoin'); await p.waitForSelector('#net.v-room', { timeout: 40000 }); }
    await C.click(ROLE === 'saboteur' ? '#netSab' : '#netAtt');
    await H.waitForFunction(() => !document.getElementById('netStart').disabled && /INTRUDER|ATTENDANT/.test(document.getElementById('netMembers').textContent), null, { timeout: 15000 });
    await H.click('#netStart');
    await until(C, () => window.__cabin && window.__cabin.play && window.__cabin.play.state.clock < 400 && window.__cabin.play.state.clock > 0, null, 150000, 'layer');
    log('layer up');
    if (ROLE === 'saboteur') {
      // the pilot's reports to this seat stop for 8 s while its clock shows 2 s
      await H.evaluate(() => { const N = window.KKNet.state, m = N.members.find((x) => x.name === 'C'), c = N.conns[m.id]; const o = c.send.bind(c); window.__mute = true; c.send = (d) => { if (window.__mute && d && d.t === 'st') return; return o(d); }; });
      await C.waitForTimeout(1500);
      await inF(C, () => { window.__cabin.play.state.clock = 2; });
      await C.waitForTimeout(8000);
      const st = await inF(C, () => { const s = window.__cabin.play.state; return { clock: +s.clock.toFixed(2), crashT: s.crashT || 0, done: s.done }; });
      log('intruder after a quiet line', JSON.stringify(st)); if (st.crashT || st.done) fail('intruder crashed on its own');
      await H.evaluate(() => { window.__mute = false; });
      await C.waitForTimeout(2000);
      log('clock back', await inF(C, () => +window.__cabin.play.state.clock.toFixed(1)), JSON.stringify(await C.evaluate(() => { const N = window.KKNet.state; return { st: N.lastSt && [N.lastSt.ph, N.lastSt.tl], view: N.view, dbg: N.dbg.slice(-5), src: document.getElementById('twBook').getAttribute('src') }; })), 'frame url', (frameOf(C) || { url: () => 'none' }).url());
      await H.evaluate(() => window.__kk.crash('test'));
      const e = await until(C, () => document.getElementById('ixEnd').classList.contains('show') && document.getElementById('ixEndH').textContent, null, 200000, 'end');
      log('intruder end:', e);
    } else {
      await inF(C, () => { window.__snd = []; const s = KKIntruder.util.snd, p = s.play; s.play = function (n, v) { window.__snd.push(n); return p.call(this, n, v); }; });
      await H.evaluate(() => window.__kk.land());
      await C.waitForFunction(() => /Brace for touchdown/.test(document.getElementById('twBanner').textContent), null, { timeout: 30000 }).then(() => log('approach banner ok')).catch(async () => fail('approach banner: ' + (await C.textContent('#twBanner')) + ' ' + JSON.stringify(await C.evaluate(() => [window.KKNet.state.dbg.slice(-4), window.KKNet.state.members.map((m) => m.role)]))));
      const preEnd = await inF(C, () => document.getElementById('axEnd').style.display);
      log('end card before touchdown?', preEnd);
      const aEnd = await until(C, () => document.getElementById('axEnd').style.display === 'flex' && document.getElementById('axEndH').textContent, null, 300000, 'attendant end');
      log('attendant end:', aEnd, 'pilot phase then', await H.evaluate(() => [window.__kk.G.phase, +window.__kk.G.endT.toFixed(1)]));
      await H.waitForFunction(() => window.__kk.G.phase === 'won', null, { timeout: 400000 });
      await C.waitForTimeout(4000);
      const snds = await inF(C, () => window.__snd.filter((x) => /touchdown|cheer/.test(x)));
      log('landing sounds', JSON.stringify(snds)); if (!snds || snds.filter((x) => /touchdown/.test(x)).length !== 1) fail('touchdown count');
      log('banner after won:', await C.textContent('#twBanner'));
      await H.waitForFunction(() => document.getElementById('end').classList.contains('show'), null, { timeout: 200000 });
      await H.click('#btnHome');
      for (const p of [T, C]) await p.waitForSelector('#net.v-room', { timeout: 30000 });
      await T.waitForTimeout(1000);
      for (const p of [T, C]) { const src = await p.evaluate(() => document.getElementById('twBook').getAttribute('src')); log(p.name, 'frame after flight:', src); if (src !== 'about:blank') fail('frame not blanked'); }
      await H.waitForFunction(() => !document.getElementById('netStart').disabled, null, { timeout: 15000 }); await H.click('#netStart');
      const seed2 = await H.evaluate(async () => { for (let i = 0; i < 100; i++) { if (window.__kk.G) return window.__kk.G.flight.seed; await new Promise((r) => setTimeout(r, 300)); } });
      await until(C, (s) => window.__cabin && window.__cabin.seed === s && window.__cabin.play && window.__cabin.play.state.live, seed2, 150000, 'flight 2').then(() => log('cabin follows flight 2', seed2)).catch((e) => fail(e.message));
      await T.waitForFunction(() => { const f = document.getElementById('twBook'); try { return f.contentWindow.document.getElementById('code').value; } catch (e) { return ''; } }, null, { timeout: 60000 }).then(async (h) => log('tower handbook code flight 2', await h.jsonValue(), 'want', seed2)).catch(() => fail('tower handbook no code'));
    }
    for (const q of [H, T, C]) { const e = [...new Set(q.errs)]; if (e.length) log(q.name, 'errors', e.join(' | ')); }
  } catch (e) { fail(e.message.split('\n')[0]); }
  log(bad ? 'FAIL ' + bad : 'PASS');
  await b.close();
})();
