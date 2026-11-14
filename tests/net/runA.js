'use strict';
// patch4 scenarios in the plain-Node harness (real net.js + real PeerJS client, fake RTCPeerConnection that never opens, controllable WebSocket, real PeerServer)
const { startServer, makeBrowser, sleep, ts } = require('./harness.js');
const RealWS = require('/tmp/claude-0/-home-user/a7084b7f-7c98-5dca-8588-0245675a10ff/scratchpad/nettest/node_modules/ws');
const PORT = +process.env.PORT || 9161;
const say = (s) => console.log('\n' + ts(), '=====', s);
const res = [];
const ok = (name, cond, extra) => { res.push([name, !!cond]); console.log(ts(), cond ? 'PASS' : 'FAIL', name, extra || ''); };
process.on('unhandledRejection', (e) => console.log(ts(), 'UNHANDLED REJECTION', e && (e.stack || e.message)));
process.on('uncaughtException', (e) => console.log(ts(), 'UNCAUGHT', e && e.stack));
(async () => {
  await startServer(PORT);
  const old = new RealWS('ws://127.0.0.1:' + PORT + '/peerjs?key=peerjs&id=awf1-OLD1&token=tok&version=1.5.4');
  setInterval(() => { if (old.readyState === 1) old.send(JSON.stringify({ type: 'HEARTBEAT' })); }, 5000);
  const H = makeBrowser('host', PORT); await H.K.host('PPJ4', false);
  ok('host opened', H.N.view === 'room' && H.N.isHost && H.N.members.length === 1);
  let r, t;

  say('A relay join, signalling healthy');
  const A = makeBrowser('A', PORT); A.click('btnOnline'); await sleep(7000); A.snap('list');
  ok('A list: all 8 rooms empty by EXPIRE, no error', Object.keys(A.N.rooms).length === 8 && Object.values(A.N.rooms).every((x) => x.s === 'empty' && !x.quiet) && !A.N.error, JSON.stringify(A.N.rooms));
  ok('A list opened no RTCPeerConnection (one is PeerJS testing the browser)', A.openPCs() === 0 && A.pcs.length <= 1, 'pcs=' + A.pcs.length);
  A.K.join('PPJ4'); r = await A.waitOutcome(30000); A.log('JOIN', JSON.stringify(r));
  ok('A joined through the relay in about 6 s', r.view === 'room' && r.ms > 5500 && r.ms < 7500 && A.N.hostConn && A.N.hostConn.relay, r.ms + 'ms');
  ok('host sees 2 members', H.N.members.length === 2);
  ok('A: my seat known', A.N.members.some((m) => m.id === A.N.peer.id) && A.N.members.length === 2);
  // second join attempt is quick because the relay is remembered
  A.click('netLeave'); await sleep(400);
  ok('host back to 1 member after leave', H.N.members.length === 1, 'members=' + H.N.members.length);
  t = Date.now(); A.K.join('PPJ4'); r = await A.waitOutcome(30000);
  ok('A joins again in about 2.5 s (relay remembered)', r.view === 'room' && r.ms < 3600, r.ms + 'ms');
  A.click('netLeave'); await sleep(400);

  say('B socket cut (re-open possible), JOIN 300 ms later');
  const B = makeBrowser('B', PORT); B.click('btnOnline'); await sleep(7000);
  B.liveWS().forEach((w) => w.kill()); await sleep(300); B.snap('after cut');
  B.K.join('PPJ4'); r = await B.waitOutcome(30000); B.log('JOIN', JSON.stringify(r));
  ok('B joined although its line had just dropped', r.view === 'room', r.ms + 'ms ' + r.error);
  B.click('netLeave'); await sleep(400);

  say('B2 socket cut, re-open refused: honest message; then network back: join works');
  const B2 = makeBrowser('B2', PORT); B2.click('btnOnline'); await sleep(7000);
  B2.wsCtl.mode = 'refuse'; B2.liveWS().forEach((w) => w.kill()); await sleep(300);
  B2.K.join('PPJ4'); r = await B2.waitOutcome(30000); B2.log('JOIN refused', JSON.stringify(r), '|', B2.N.diag);
  ok('B2 refused: "Could not reach the lobby service"', /Could not reach the lobby service/.test(r.error) && r.ms < 6000, r.ms + 'ms');
  B2.click('netRefresh'); await sleep(300); B2.snap('refresh while refused');
  ok('B2 refresh while refused shows the error, not 8 empty rooms', /Could not reach/.test(B2.N.error));
  B2.wsCtl.mode = 'ok'; B2.N.error = ''; B2.K.join('PPJ4'); r = await B2.waitOutcome(30000); B2.log('JOIN back', JSON.stringify(r));
  ok('B2 joins once the network is back', r.view === 'room', r.ms + 'ms ' + r.error);
  B2.click('netLeave'); await sleep(400);

  say('C socket cut, re-open hangs (black hole), JOIN 1 s later; then network back');
  const C = makeBrowser('C', PORT); C.click('btnOnline'); await sleep(7000);
  C.wsCtl.mode = 'hang'; C.liveWS().forEach((w) => w.kill()); await sleep(1000);
  C.K.join('PPJ4'); r = await C.waitOutcome(40000); C.log('JOIN hang', JSON.stringify(r), '|', C.N.diag);
  ok('C hang: "Could not reach the lobby service" (not "No lobby answered")', /Could not reach the lobby service/.test(r.error), r.ms + 'ms ' + r.error);
  C.wsCtl.mode = 'ok'; C.N.error = ''; C.K.join('PPJ4'); r = await C.waitOutcome(30000); C.log('JOIN back', JSON.stringify(r));
  ok('C joins once the network is back', r.view === 'room', r.ms + 'ms ' + r.error);
  C.click('netLeave'); await sleep(400);

  say('D ICE failed after 3 s');
  const D = makeBrowser('D', PORT, { iceFailAfter: 3000 }); D.click('btnOnline'); await sleep(7000);
  D.K.join('PPJ4'); r = await D.waitOutcome(30000); D.log('JOIN', JSON.stringify(r));
  ok('D joined through the relay right after ICE failed', r.view === 'room' && r.ms < 4500, r.ms + 'ms ' + r.error);
  D.click('netLeave'); await sleep(400);

  say('G lobby id registered but silent (old build / zombie): one clear message, no flip on a double press');
  const G = makeBrowser('G', PORT); G.click('btnOnline'); await sleep(9500); G.snap('list');
  let last = null; const seen = []; const t0 = Date.now(); const iv = setInterval(() => { const s = G.N.status + ' | ' + G.N.error; if (s !== last) { last = s; seen.push(s); G.log('+' + ((Date.now() - t0) / 1000).toFixed(1) + 's', s); } }, 50);
  G.K.join('OLD1'); await sleep(2000); G.K.join('OLD1'); await sleep(24000); clearInterval(iv);
  ok('G one final message "The lobby did not answer"', /The lobby did not answer/.test(G.N.error) && seen.filter((s) => / \| ./.test(s)).length === 1, JSON.stringify(seen.filter((s) => / \| ./.test(s))));
  G.log('diag:', G.N.diag);
  G.N.error = ''; G.K.join('PPJ4'); r = await G.waitOutcome(30000);
  ok('G joins a real lobby afterwards', r.view === 'room', r.ms + 'ms ' + r.error);
  G.click('netLeave'); await sleep(400);

  say('W wrong code: fast "No lobby answered"');
  const W = makeBrowser('W', PORT); W.click('btnOnline'); await sleep(7000);
  W.K.join('ZZZZ'); r = await W.waitOutcome(30000); W.log('JOIN', JSON.stringify(r), '|', W.N.diag);
  ok('W wrong code answered in about 5-7 s', /No lobby answered/.test(r.error) && r.ms < 8000, r.ms + 'ms ' + r.error);

  say('E no leaked RTCPeerConnections after two lists');
  const E = makeBrowser('E', PORT); E.click('btnOnline'); await sleep(9000); E.click('netRefresh'); await sleep(9000); E.snap('second list');
  ok('E no RTCPeerConnection for the list', E.openPCs() === 0 && E.pcs.length <= 1, 'open=' + E.openPCs() + ' total=' + E.pcs.length);

  say('F host identity while disconnected, and START during a blip');
  const F2 = makeBrowser('F2', PORT); F2.click('btnOnline'); await sleep(6500); F2.K.join('PPJ4'); r = await F2.waitOutcome(30000);
  ok('F2 in', r.view === 'room' && H.N.members.length === 2);
  H.wsCtl.mode = 'refuse'; H.liveWS().forEach((w) => w.kill()); await sleep(300);
  ok('host id still known while disconnected', H.N.members.some((m) => m.id === 'awf1-PPJ4') && H.N.peer.id === null);
  H.K.act({ t: 'role', role: 'tower' }); ok('host can change seat while disconnected', H.N.members.find((m) => m.host).role === 'tower');
  H.K.act({ t: 'role', role: 'pilot' });
  H.wsCtl.mode = 'ok'; await sleep(4500); H.snap('host back');
  ok('host line back within 4.5 s', H.liveWS().length === 1 && !H.N.peer.disconnected);
  await sleep(6000);
  ok('F2 still in the lobby after the host blip (crew list repeats)', F2.N.view === 'room' && F2.N.members.length === 2 && F2.N.members.find((m) => m.host).role === 'pilot', JSON.stringify(F2.N.members.map((m) => m.role)));

  say('S start reaches a relay member whose line is down at that moment');
  F2.wsCtl.mode = 'refuse'; F2.liveWS().forEach((w) => w.kill()); await sleep(300);
  H.sandbox.__kk.G = { flight: { seed: 1234, modules: [{ id: 'a', solved: false }] }, phase: 'flight', timeLeft: 200, total: 240, strikes: 0, solved: 0, cabin: { unrest: 0.1 }, turb: 0 };
  H.click('netStart'); await sleep(300);
  ok('host is flying', H.N.view === 'fly' && H.N.inGame);
  ok('F2 has not heard the start (line down)', F2.N.view === 'room');
  F2.wsCtl.mode = 'ok'; await sleep(11000);
  ok('F2 got the start from the repeated crew list', F2.N.view === 'tower' && F2.N.inGame, F2.N.view);
  await sleep(1500); ok('F2 gets flight reports', F2.N.lastSt && F2.N.lastSt.ph === 'flight' && F2.N.lastSt.tl === 200, JSON.stringify(F2.N.lastSt));
  // the flight ends while F2's line is down: F2 must come back to the room
  F2.wsCtl.mode = 'refuse'; F2.liveWS().forEach((w) => w.kill()); await sleep(300);
  H.sandbox.__kk.G = null; await sleep(900);
  ok('host back in the room', H.N.view === 'room' && !H.N.inGame);
  F2.wsCtl.mode = 'ok'; await sleep(11000);
  ok('F2 back in the room after a lost end of flight', F2.N.view === 'room' && !F2.N.inGame, F2.N.view);
  ok('host closed the direct attempts that never opened', H.openPCs() <= 1, 'open=' + H.openPCs());

  console.log('\n' + res.filter((x) => x[1]).length + ' of ' + res.length + ' passed');
  res.filter((x) => !x[1]).forEach((x) => console.log('FAILED:', x[0]));
  process.exit(0);
})();
