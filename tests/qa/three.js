// three seats: pilot, tower, one cabin seat (ROLE=saboteur|attendant). Cabin page loads, AI or malfunctions work, end plays in the cabin.
const { launch, page, log } = require('./lib.js');
const Q = 'index.html?peer=127.0.0.1:9000', ROLE = process.env.ROLE || 'saboteur', END = process.env.END || 'crash';
async function open(p, name) { await p.waitForFunction(() => window.KKNet); await p.click('#btnOnline'); await p.fill('#netName', name); }
const frameOf = (p) => p.frames().find((f) => /cabin\.html\?embed=1.*seed=/.test(f.url()));
async function until(p, fn, arg, ms, label) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const f = frameOf(p); if (f) { try { const r = await f.evaluate(fn, arg); if (r) return r; } catch (e) {} } await p.waitForTimeout(500); } throw new Error('timeout ' + label); }
(async () => {
  const b = await launch(); let bad = 0; const fail = (s) => { bad++; log('BAD', s); };
  const H = await page(b, Q, 'H'), T = await page(b, Q, 'T'), C = await page(b, Q, 'C');
  try {
    await open(H, 'PILOT'); await H.click('#netCreate'); await H.waitForSelector('#net.v-room');
    const code = (await H.textContent('#netRoomCode')).trim();
    for (const p of [T, C]) { await open(p, p.name); await p.fill('#netCode', code); await p.click('#netJoin'); await p.waitForSelector('#net.v-room', { timeout: 40000 }); }
    await C.click(ROLE === 'saboteur' ? '#netSab' : '#netAtt');
    await H.waitForFunction(() => !document.getElementById('netStart').disabled, null, { timeout: 15000 });
    await H.click('#netStart'); log('started', ROLE);
    const info = await until(C, () => window.__cabin && window.__cabin.play && { url: location.search, link: !!window.__cabin.link }, null, 150000, 'layer');
    log('cabin', JSON.stringify(info));
    if (/att=1|sab=1&att/.test(info.url) && ROLE === 'saboteur') fail('att flag with no attendant');
    await C.screenshot({ path: 'three-' + ROLE + '-start.png' });
    if (ROLE === 'saboteur') {
      // AI attendant exists; do a blackout sabotage and see the pilot get it
      const id = await until(C, () => { const t = window.__cabin.play.state.tasks.find((x) => !x.done && !x.def.bonus && x.def.place !== 'seat'); if (!t) return 'none'; t.prog = t.def.seconds; const P = window.__cabin.cabin.player; P.seat = null; const pos = { galley: [-0.35, 1.02], lavatory: [-1.0, 10.0], door: [0, 0.62], aisle: [0, 5] }[t.def.place]; P.x = pos[0]; P.z = pos[1]; P.place = t.def.place; return t.def.id; }, null, 30000, 'pick task');
      log('sabotage', id);
      await H.waitForFunction(() => window.__kk.G.log.some((l) => /Sabotage in the cabin/.test(l.text)), null, { timeout: 60000 }).catch(() => fail('pilot no sabotage log'));
      log('pilot log', JSON.stringify(await H.evaluate(() => window.__kk.G.log.slice(-3).map((l) => l.text))));
      log('tower toast', await T.textContent('#netToast'));
    } else {
      // no intruder: a malfunction turns up by itself within ~35 s of flight time
      const tr = await until(C, () => { const t = window.__cabin.play.state.tasks.find((x) => x.def.undoes && !x.done); return t && t.def.id; }, null, 240000, 'malfunction').catch((e) => { fail(e.message); return null; });
      log('malfunction task', tr);
      // the coffee: carry it to the captain
      const cf = await until(C, () => { const c = window.__cabin, t = c.play.state.tasks.find((x) => x.def.fetch); return t ? { id: t.def.id, place: t.def.place, fetch: t.def.fetch } : 'nocoffee'; }, null, 20000, 'coffee');
      log('coffee def', JSON.stringify(cf));
    }
    // the end
    if (END === 'crash') await H.evaluate(() => window.__kk.crash('test')); else await H.evaluate(() => window.__kk.land());
    const endTxt = await until(C, () => { const e = document.getElementById(window.__cabin.role === 'saboteur' ? 'ixEndH' : 'axEndH'); return e && e.textContent; }, null, 400000, 'cabin end card').catch((e) => { fail(e.message); return null; });
    log('cabin end card:', endTxt, '| banner:', await C.textContent('#twBanner'));
    await C.screenshot({ path: 'three-' + ROLE + '-' + END + '.png' });
    // back to the lobby: the pilot returns
    await H.waitForFunction(() => document.getElementById('end').classList.contains('show'), null, { timeout: 200000 });
    await H.click('#btnHome');
    await C.waitForSelector('#net.v-room', { timeout: 30000 }).catch(() => fail('cabin seat not back in room'));
    for (const q of [H, T, C]) { const e = [...new Set(q.errs)]; if (e.length) log(q.name, 'errors', e.join(' | ')); }
  } catch (e) { fail(e.message.split('\n')[0]); }
  log(bad ? 'FAIL ' + bad : 'PASS');
  await b.close();
})();
