// more online flows: tower hosts, pilot joins; public list; full lobby; second flight; pilot aborts; crash seen by all
const { launch, page, log } = require('./lib.js');
const Q = 'index.html?peer=127.0.0.1:9000';
async function open(p, name) { await p.waitForFunction(() => window.KKNet); await p.click('#btnOnline'); await p.fill('#netName', name); await p.dispatchEvent('#netName', 'change'); }
async function members(p) { return p.evaluate(() => window.KKNet.state.members.map((m) => m.name + ':' + m.role)); }
(async () => {
  const b = await launch(); let bad = 0; const fail = (s) => { bad++; log('BAD', s); };
  const H = await page(b, Q, 'H'), P = await page(b, Q, 'P');
  try {
    await open(H, 'TWRHOST'); await H.click('#netCreate'); await H.waitForSelector('#net.v-room', { timeout: 20000 });
    const code = (await H.textContent('#netRoomCode')).trim(); log('lobby', code);
    await H.click('#netTower');
    await open(P, 'FLYER'); await P.fill('#netCode', code.toLowerCase()); await P.click('#netJoin'); await P.waitForSelector('#net.v-room', { timeout: 40000 });
    await P.click('#netPilot');
    await H.waitForFunction(() => window.KKNet.state.members.some((m) => m.role === 'pilot' && !m.host), null, { timeout: 15000 });
    log('roles', JSON.stringify(await members(H)));
    // mode: blackbox chosen by the host shows on the guest
    await H.click('#netModes .net-mode:nth-child(1)');
    await P.waitForTimeout(800);
    log('guest mode buttons disabled:', await P.evaluate(() => [...document.querySelectorAll('#netModes .net-mode')].every((b) => b.disabled)), 'start button hidden on guest:', await P.evaluate(() => getComputedStyle(document.getElementById('netStart')).display === 'none'));
    await H.click('#netStart');
    await P.waitForFunction(() => window.__kk.G && window.__kk.G.phase === 'flight', null, { timeout: 60000 });
    log('guest pilot flying, host tower view:', await H.evaluate(() => window.KKNet.state.view));
    await H.waitForFunction(() => window.KKNet.state.lastSt && window.KKNet.state.lastSt.ph === 'flight', null, { timeout: 20000 });
    const hb = await H.evaluate(() => [document.getElementById('twTime').textContent, document.getElementById('twFix').textContent]);
    log('tower bar', hb);
    // handbook got the code
    await H.waitForTimeout(1500);
    const bookCode = await H.frames().find((f) => /manual\.html/.test(f.url())).evaluate(() => document.getElementById('code').value);
    const pCode = await P.evaluate(() => String(window.__kk.G.flight.seed));
    log('handbook code', bookCode, 'pilot code', pCode); if (bookCode !== pCode) fail('handbook code mismatch');
    // the pilot crashes: tower sees it, both back in the room after the pilot goes back
    await P.evaluate(() => window.__kk.crash('test crash'));
    await H.waitForFunction(() => /AIRCRAFT LOST/.test(document.getElementById('twBanner').textContent), null, { timeout: 20000 }).catch(() => fail('tower no crash banner'));
    await P.waitForFunction(() => document.getElementById('end').classList.contains('show'), null, { timeout: 40000 });
    log('pilot end buttons:', await P.evaluate(() => [document.getElementById('btnHome').textContent, getComputedStyle(document.getElementById('btnSwap')).display]));
    await P.click('#btnHome');
    await H.waitForSelector('#net.v-room', { timeout: 20000 }).catch(() => fail('host not back in room'));
    await P.waitForSelector('#net.v-room', { timeout: 20000 }).catch(() => fail('pilot not back in room'));
    log('after flight 1 inGame', await H.evaluate(() => window.KKNet.state.inGame), await P.evaluate(() => window.KKNet.state.inGame));
    // second flight; the pilot aborts with the X
    await H.waitForFunction(() => !document.getElementById('netStart').disabled, null, { timeout: 15000 });
    await H.click('#netStart');
    await P.waitForFunction(() => window.__kk.G && window.__kk.G.phase === 'flight', null, { timeout: 60000 });
    const code2 = await P.evaluate(() => window.__kk.G.flight.seed); log('flight 2 code', code2, 'mode', await P.evaluate(() => window.__kk.G.flight.mode));
    await P.click('#btnAbort');
    await P.waitForSelector('#net.v-room', { timeout: 20000 }).catch(() => fail('pilot not in room after abort'));
    await H.waitForSelector('#net.v-room', { timeout: 20000 }).catch(() => fail('host not in room after pilot abort'));
    // seats: guest takes tower -> no pilot -> cannot start
    await P.click('#netTower'); await H.waitForTimeout(1000);
    log('no pilot status:', await H.textContent('#netRoomStatus'), 'start disabled', await H.evaluate(() => document.getElementById('netStart').disabled));
    // a public lobby in the list
    const L = await page(b, Q, 'L'); await open(L, 'LOOKER');
    await L.waitForFunction(() => Object.values(window.KKNet.state.rooms).every((r) => r.s !== 'checking'), null, { timeout: 30000 });
    log('list', JSON.stringify(await L.evaluate(() => window.KKNet.state.rooms.ALPHA)));
    await L.click('#netRooms .net-room-b:nth-child(1)');   // ALPHA, empty: opens it
    await L.waitForSelector('#net.v-room', { timeout: 20000 });
    log('L hosts', await L.textContent('#netRoomCode'), await L.textContent('#netRoomHint'));
    const M = await page(b, Q, 'M'); await open(M, 'MEMBER');
    await M.waitForFunction(() => window.KKNet.state.rooms.ALPHA && window.KKNet.state.rooms.ALPHA.s === 'open', null, { timeout: 30000 }).catch(() => fail('ALPHA not listed open'));
    log('M sees ALPHA', JSON.stringify(await M.evaluate(() => window.KKNet.state.rooms.ALPHA)), await M.evaluate(() => document.querySelector('#netRooms .net-room-b').textContent));
    await M.click('#netRooms .net-room-b:nth-child(1)'); await M.waitForSelector('#net.v-room', { timeout: 30000 });
    log('L members', JSON.stringify(await members(L)));
    // fill the private lobby to 4, then a fifth is refused
    const X = [];
    for (const n of ['C3', 'C4', 'C5']) { const q = await page(b, Q, n); await open(q, n); await q.fill('#netCode', code); await q.click('#netJoin'); X.push(q); await q.waitForTimeout(500); }
    await X[1].waitForSelector('#net.v-room', { timeout: 40000 }).catch(() => fail('4th not in'));
    await X[2].waitForFunction(() => /full/i.test(document.getElementById('netStatus').textContent), null, { timeout: 40000 }).then(async () => log('5th:', await X[2].textContent('#netStatus'))).catch(async () => fail('5th not refused: ' + (await X[2].textContent('#netStatus')) + ' view ' + (await X[2].evaluate(() => window.KKNet.state.view))));
    log('H members', JSON.stringify(await members(H)));
    // a member leaves: host sees 3
    await X[0].click('#netLeave'); await H.waitForTimeout(1500);
    log('after leave', JSON.stringify(await members(H)));
    // host leaves: guests get "The lobby was closed"
    await H.click('#netLeave');
    await P.waitForSelector('#net.v-browse', { timeout: 20000 }).then(async () => log('guest after host left:', await P.textContent('#netToast'))).catch(() => fail('guest not back to browse'));
    for (const q of [H, P, L, M, ...X]) { const e = [...new Set(q.errs)]; if (e.length) log(q.name, 'errors', e.join(' | ')); }
  } catch (e) { fail(e.message.split('\n')[0]); }
  log(bad ? 'FAIL ' + bad : 'PASS');
  await b.close();
})();
