// solo pilot: every mode, solve every module the honest way through the panel controls; then a crash by mistakes; then abort
const { launch, page, log } = require('./lib.js');
const SOLVE = `(async () => {
  const KK = window.KK, G = window.__kk.G, cur = window.KK3D.current, a = G.flight.aircraft, out = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const m of G.flight.modules) {
    const P = cur.modules[m.id], k = P.keys, st = m.state, sol = KK.MODULES[m.id].solve(a, st);
    const pr = async (key) => { if (!k[key]) throw new Error('no key ' + m.id + ':' + key + ' have ' + Object.keys(k)); k[key].press(); await sleep(60); };
    if (m.id === 'breakers') await pr('brk' + sol.index);
    else if (m.id === 'fire') { for (const s of sol.seq) await pr(s === 'A' || s === 'B' ? s : s + st.side); }
    else if (m.id === 'radio') { let n = 0; while (KK.MODULES.radio.fmt(st.mhz, st.khz) !== sol.freq && n++ < 200) { const [M, K] = sol.freq.split('.').map(Number); if (st.mhz !== M) await pr('mhzUp'); else await pr('khzUp'); } await pr('tune'); }
    else if (m.id === 'hyd') { for (const w of KK.MODULES.hyd.SW) if (st.sw[w.key] !== sol.want[w.key]) await pr(w.key); await pr('confirm'); }
    else if (m.id === 'intercom') { for (let i = 0; i < 2; i++) { await pr('call'); const s2 = KK.MODULES.intercom.solve(a, st); await pr(s2.answers[st.stage]); } }
    else if (m.id === 'gear') { for (let i = 0; i < Math.abs(sol.net); i++) await pr(sol.net > 0 ? 'CW' : 'CCW'); await pr('RELEASE'); }
    else if (m.id === 'xpdr') { for (let i = 0; i < 4; i++) { let n = 0; while (String(st.digits[i]) !== sol.code[i] && n++ < 9) await pr('up' + i); } await pr('ident'); }
    else if (m.id === 'keys') { for (let i = 0; i < 2; i++) { const s2 = KK.MODULES.keys.solve(a, st); await pr('k' + s2.answers[st.stage]); } }
    out.push(m.id + (m.solved ? ':ok' : ':NOT') + ' strikes=' + G.strikes);
  }
  return out;
})()`;
(async () => {
  const b = await launch(); let bad = 0;
  const p = await page(b, 'index.html', 'solo');
  await p.waitForFunction(() => window.__kk && window.KK3D);
  await p.mouse.click(5, 5);
  for (const mode of ['short', 'mayday', 'blackbox']) {
    await p.evaluate((m) => { window.__kk.settings.mode = m; }, mode);
    await p.click('#btnFly');
    await p.waitForFunction(() => window.__kk.G && window.__kk.G.phase === 'flight', null, { timeout: 30000 });
    const info = await p.evaluate(() => { const G = window.__kk.G; return { code: G.flight.seed, mods: G.flight.modules.map((m) => m.id), faults: document.getElementById('faults').textContent }; });
    log(mode, JSON.stringify(info));
    // the handbook works out the same pictures as the cockpit panels
    const r = await p.evaluate(SOLVE); log(mode, r.join(' | '));
    if (r.some((x) => /NOT|strikes=[1-9]/.test(x))) { bad++; log('BAD solve'); }
    await p.waitForFunction(() => window.__kk.G && window.__kk.G.phase === 'landing', null, { timeout: 10000 }).catch(() => { bad++; log('BAD no landing'); });
    await p.waitForFunction(() => document.getElementById('end').classList.contains('show'), null, { timeout: 300000 }).catch(() => { bad++; log('BAD no end'); });   // a software-rendered landing is slow
    log(mode, 'end:', await p.textContent('#endTitle'), '|', (await p.textContent('#endStats')).replace(/\s+/g, ' '));
    await p.screenshot({ path: 'solo-end-' + mode + '.png' });
    await p.click('#btnHome'); await p.waitForTimeout(500);
  }
  // crash by three strikes
  await p.click('#btnFly');
  await p.waitForFunction(() => window.__kk.G && window.__kk.G.phase === 'flight', null, { timeout: 30000 });
  await p.evaluate(() => { const G = window.__kk.G, KK = window.KK, cur = window.KK3D.current; const m = G.flight.modules.find((x) => x.id === 'keys'); const s = KK.MODULES.keys.solve(G.flight.aircraft, m.state); const wrong = (s.answers[0] + 1) % 12; for (let i = 0; i < 3; i++) cur.modules.keys.keys['k' + wrong].press(); });
  await p.waitForFunction(() => document.getElementById('end').classList.contains('show'), null, { timeout: 30000 });
  log('crash end:', await p.textContent('#endTitle'), (await p.textContent('#endLog')).slice(0, 300));
  await p.screenshot({ path: 'solo-crash.png' });
  // time runs out
  await p.click('#btnAgain');
  await p.waitForFunction(() => window.__kk.G && window.__kk.G.phase === 'flight', null, { timeout: 30000 });
  await p.evaluate(() => { window.__kk.G.timeLeft = 2; });
  await p.waitForFunction(() => document.getElementById('end').classList.contains('show'), null, { timeout: 30000 });
  log('timeout end:', await p.textContent('#endTitle'));
  // abort mid flight
  await p.click('#btnAgain');
  await p.waitForFunction(() => window.__kk.G && window.__kk.G.phase === 'flight', null, { timeout: 30000 });
  await p.click('#btnAbort'); await p.waitForTimeout(500);
  log('after abort title shown:', await p.evaluate(() => document.getElementById('title').classList.contains('show') && !window.__kk.G));
  // whiskey, smoke, PA
  await p.click('#btnFly');
  await p.waitForFunction(() => window.__kk.G && window.__kk.G.phase === 'flight', null, { timeout: 30000 });
  const misc = await p.evaluate(async () => { const K3 = window.KK3D, G = window.__kk.G, out = {}; const t0 = G.timeLeft; out.drink = K3.hooks.onDrink(); out.dt = Math.round(G.timeLeft - t0); for (let i = 0; i < 8; i++) K3.hooks.onDrink(); out.sips = G.sips; out.smoke = K3.hooks.onSmoke(); for (let i = 0; i < 8; i++) K3.hooks.onSmoke(); out.cigs = G.cigs;
    G.cabin.unrest = 0.6; await new Promise((r) => setTimeout(r, 800)); const c = G.cabin.complaint; out.complaint = c && c.key; const want = window.KK.CABIN.answer(c.key, G.cabin.lastPA); const PAP = K3.current.extras.pa; PAP.keys[want].press(); out.calmed = G.cabin.calmed; out.unrest = +G.cabin.unrest.toFixed(2); return out; });
  log('misc', JSON.stringify(misc));
  log('errors:', [...new Set(p.errs)].join('\n') || 'none');
  log(bad ? 'FAIL ' + bad : 'PASS');
  await b.close();
})();
