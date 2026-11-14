'use strict';
const { startServer, makeBrowser, sleep, ts } = require('./harness.js');
const PORT = +process.env.PORT || 9171;
const say = (s) => console.log('\n' + ts(), '=====', s);
const res = [];
const ok = (name, cond, extra) => { res.push([name, !!cond]); console.log(ts(), cond ? 'PASS' : 'FAIL', name, extra || ''); };
process.on('unhandledRejection', (e) => console.log(ts(), 'UNHANDLED REJECTION', e && (e.stack || e.message)));
process.on('uncaughtException', (e) => console.log(ts(), 'UNCAUGHT', e && e.stack));
(async () => {
  await startServer(PORT);
  let r;
  say('P public lobby shows up in the list without WebRTC');
  const H = makeBrowser('hostA', PORT); await H.K.host('ALPHA', true);
  const A = makeBrowser('A', PORT); A.click('btnOnline'); await sleep(1500); A.snap('list 1.5 s');
  ok('ALPHA is open 1/4 needs TOWER after 1.5 s', A.N.rooms.ALPHA && A.N.rooms.ALPHA.s === 'open' && A.N.rooms.ALPHA.n === 1 && A.N.rooms.ALPHA.need === 'TOWER', JSON.stringify(A.N.rooms.ALPHA));
  await sleep(6000); ok('other rooms empty', ['BRAVO', 'HOTEL'].every((x) => A.N.rooms[x].s === 'empty' && !A.N.rooms[x].quiet) && !A.N.error);
  ok('no RTCPeerConnection open for the list', A.openPCs() === 0 && H.openPCs() === 0);

  say('Q half-open line (looks open, nothing flows): the list says so, REFRESH opens a new line');
  const Q = makeBrowser('Q', PORT); Q.click('btnOnline'); await sleep(7000);
  Q.liveWS().forEach((w) => w.mute()); Q.click('netRefresh'); await sleep(9800); Q.snap('list on a dead line');
  ok('Q: says that the lobby service does not answer', /does not answer/.test(Q.N.error), Q.N.error + ' | ' + Q.N.diag);
  Q.click('netRefresh'); await sleep(1500); Q.snap('after REFRESH');
  ok('Q: REFRESH finds ALPHA again', Q.N.rooms.ALPHA && Q.N.rooms.ALPHA.s === 'open' && !Q.N.error, JSON.stringify(Q.N.rooms.ALPHA) + Q.N.error);

  say('R half-open line, then JOIN: second try on a new line gets in');
  const R = makeBrowser('R', PORT); R.click('btnOnline'); await sleep(7000);
  R.liveWS().forEach((w) => w.mute());
  let last = null; const t0 = Date.now(); const iv = setInterval(() => { const s = R.N.status + ' | ' + R.N.error; if (s !== last) { last = s; R.log('+' + ((Date.now() - t0) / 1000).toFixed(1) + 's', s); } }, 50);
  R.K.join('ALPHA'); r = await R.waitOutcome(40000); clearInterval(iv); R.log('JOIN', JSON.stringify(r));
  ok('R joined on the second try', r.view === 'room', r.ms + 'ms ' + r.error);
  R.click('netLeave'); await sleep(400);

  say('T CREATE pressed while the list is still opening its peer (slow /id)');
  const T = makeBrowser('T', PORT, { fetchDelay: 1500 }); T.click('btnOnline'); await sleep(200);
  T.K.host('HHHH', false); await sleep(4000); T.snap('after 4 s');
  ok('T is the host of HHHH and kept its peer', T.N.isHost && T.N.view === 'room' && T.N.peer && T.N.peer.awfId === 'awf1-HHHH' && T.liveWS().length === 1, 'ws=' + T.liveWS().length);
  const T2 = makeBrowser('T2', PORT); T2.click('btnOnline'); await sleep(500); T2.K.join('HHHH'); r = await T2.waitOutcome(30000);
  ok('a guest reaches that host through the relay', r.view === 'room' && T.N.members.length === 2, r.ms + 'ms ' + r.error);

  say('U JOIN pressed while the list is still opening its peer: one peer, join works');
  const U = makeBrowser('U', PORT, { fetchDelay: 1200 }); U.click('btnOnline'); await sleep(200);
  U.K.join('ALPHA'); r = await U.waitOutcome(30000);
  ok('U joined', r.view === 'room', r.ms + 'ms ' + r.error);
  ok('U opened one line only', U.wsCtl.all.length === 1, 'sockets=' + U.wsCtl.all.length);
  U.click('netLeave'); await sleep(400);

  say('V another code typed while a join is under way: the new one wins, the old one leaves no message');
  const V = makeBrowser('V', PORT); V.click('btnOnline'); await sleep(7000);
  V.K.join('NOPE'); await sleep(1000); V.K.join('ALPHA'); r = await V.waitOutcome(30000);
  ok('V is in ALPHA', r.view === 'room' && V.N.code === 'ALPHA', r.ms + 'ms ' + r.error);
  await sleep(7000); ok('V: no late error from the first code', !V.N.error && V.N.view === 'room', V.N.error);
  V.click('netLeave'); await sleep(400);

  say('X leave the online screen during a join: nothing comes back later');
  const X = makeBrowser('X', PORT); X.click('btnOnline'); await sleep(7000);
  X.K.join('ALPHA'); await sleep(1500); X.click('netClose'); await sleep(9000); X.snap('after close');
  ok('X: view off, no error, not in a lobby', X.N.view === 'off' && !X.N.error && !X.N.code && !X.N.hostConn, X.N.view + ' ' + X.N.error);
  ok('host does not keep X as a member', !H.N.members.some((m) => /^CREW/.test(m.name) && m.id !== 'awf1-ALPHA') || H.N.members.length === 1, 'members=' + H.N.members.length);

  say('Y public room click on an empty room hosts it; on a taken one joins it');
  const Y = makeBrowser('Y', PORT); Y.click('btnOnline'); await sleep(7000);
  await Y.K.host('ALPHA', true); r = await Y.waitOutcome(30000);
  ok('Y clicked ALPHA as if empty and ended up as a guest of the real host', Y.N.view === 'room' && !Y.N.isHost && Y.N.code === 'ALPHA', r.ms + 'ms ' + r.error);

  say('Z host loses the line for 15 s: the toast says so once, guests stay');
  H.wsCtl.mode = 'refuse'; H.liveWS().forEach((w) => w.kill()); await sleep(16000);
  ok('host was told that the lobby service is unstable, once', H.toasts.filter((t) => /unstable/.test(t)).length === 1, JSON.stringify(H.toasts.filter((t) => /unstable/.test(t))));
  H.wsCtl.mode = 'ok'; await sleep(8000);
  ok('host line is back and Y is still a member', H.liveWS().length === 1 && H.N.members.length >= 2 && Y.N.view === 'room', 'members=' + H.N.members.length + ' Yview=' + Y.N.view);

  console.log('\n' + res.filter((x) => x[1]).length + ' of ' + res.length + ' passed');
  res.filter((x) => !x[1]).forEach((x) => console.log('FAILED:', x[0]));
  process.exit(0);
})();
