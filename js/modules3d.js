/* KARA KUTU — the seven failure modules as 3D cockpit panels. Layout is in panel
   millimetres (420 x 300). All answers are checked against rules.js. */
(function () {
  'use strict';
  const A = window.KKAudio;
  const M = window.KK.MODULES;
  const BCOL = { RED: '#e23b2e', AMBER: '#ffab1f', BLUE: '#2f7df0', WHITE: '#f1f3f5', GREEN: '#2fcf6f' };
  const B = {};

  function big(c, x, y, s, size, color) {
    c.font = 'bold ' + size + 'px "Courier New", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = color || '#ffb224'; c.fillText(s, x, y);
  }

  // ---------------- CIRCUIT BREAKERS ----------------
  B.breakers = function (P, st, api) {
    const sol = M.breakers.solve(api.ac, st);
    P.text(210, 48, 'BUS FAULT  ·  PULL ONE BREAKER', { size: 9, color: '#ffb224' });
    P.frame(28, 78, 364, 150, 'ESSENTIAL BUS');
    st.breakers.forEach((b, i) => {
      const x = 70 + i * 70;
      P.text(x, 98, String(i + 1), { size: 9, color: '#aeb6bf' });
      const c = P.breaker(x, 140, {
        s: 1.9, color: BCOL[b.color], key: 'brk' + i, name: b.color + ' BREAKER ' + b.amps + ' A',
        onPull() {
          if (api.done()) return;
          if (i === sol.index) { A.sfx.clunk(); c.setOut(true); api.solve('Breaker ' + window.KK.ORD[i] + ' pulled. Short circuit isolated.'); }
          else api.strike('Wrong breaker pulled (' + window.KK.ORD[i] + ', ' + b.color + ' ' + b.amps + 'A).');
        },
      });
      P.text(x, 178, b.color, { size: 8.5, color: BCOL[b.color] });
      P.text(x, 192, b.amps + ' A', { size: 10 });
    });
    P.text(210, 256, 'LEFT  →  RIGHT', { size: 7, color: '#8d959e' });
  };

  // ---------------- ENGINE FIRE ----------------
  B.fire = function (P, st, api) {
    const sol = M.fire.solve(api.ac, st);
    let pos = 0; const lit = []; const lamps = {};
    [1, 2].forEach((n) => {
      const cx = n === 1 ? 82 : 338, burning = n === st.side;
      P.frame(cx - 66, 36, 132, 252, 'ENG ' + n);
      P.text(cx - 30, 54, 'FIRE', { size: 9, color: '#ff6a5a' });
      const lamp = P.lamp(cx + 18, 54, { w: 40, h: 13, color: '#ff2a1a' });
      if (burning) { if (st.light === 'FLASHING') lamp.blink(3, '#ff2a1a'); else lamp.set(true); }
      lamps[n] = lamp;
      P.display(cx - 58, 68, 116, 36, (c, x, y, w, h) => {
        P.glass(x, y, 55, h); P.glass(x + 61, y, 55, h);
        P.text(x + 27, y + 8, 'EGT °C', { size: 6, color: '#9aa3ad' }); P.text(x + 88, y + 8, 'OIL PSI', { size: 6, color: '#9aa3ad' });
        big(c, x + 27, y + 23, String(burning ? st.egt : 505 + n * 13), 15, burning ? '#ff8a3a' : '#57e08a');
        big(c, x + 88, y + 23, String(burning ? st.oil : 58 + n * 3), 15, burning ? '#ff8a3a' : '#57e08a');
      });
      [['IDLE', 'THRUST IDLE', 128, '#4a5058', 18, 6], ['CUTOFF', 'FUEL CUTOFF', 174, '#4a5058', 18, 6], ['HANDLE', 'FIRE HANDLE', 228, '#8e1f16', 26, 17]].forEach(([k, label, y, color, h, d]) => {
        const b = P.button(cx, y, { w: 84, h, d, color, label, size: 7.5, litColor: '#39d98a', key: k + n, name: 'ENG ' + n + ' ' + label, onPress: () => press(k, n, b) });
      });
    });
    P.text(210, 112, 'EXTING', { size: 8 });
    ['A', 'B'].forEach((k, i) => {
      const b = P.button(210, 150 + i * 66, { w: 32, h: 32, d: 8, color: '#5a4a1a', label: 'BOTTLE ' + k, size: 7.5, litColor: '#39d98a', key: k, name: 'EXTINGUISHER BOTTLE ' + k, onPress: () => press(k, st.side, b) });
    });
    function reset() { pos = 0; lit.forEach((b) => b.setLit(false)); lit.length = 0; }
    function press(k, side, b) {
      if (api.done()) return;
      if (side !== st.side) { reset(); api.strike('Control of the healthy engine ' + side + ' was touched.'); return; }
      if (b.lit) return;
      if (sol.seq[pos] === k) {
        A.sfx.clunk(); b.setLit(true); lit.push(b); pos++;
        if (pos === sol.seq.length) { lamps[st.side].set(false); api.solve('Engine ' + st.side + ' fire extinguished.'); }
      } else { reset(); api.strike('Engine fire drill out of order (' + M.fire.STEPS[k] + ').'); }
    }
  };

  // ---------------- NAV RADIO ----------------
  B.radio = function (P, st, api) {
    const sol = M.radio.solve(api.ac, st);
    let soundOn = true;
    const lamp = P.lamp(62, 78, { w: 30, h: 30, color: '#ffc21f', label: 'IDENT', size: 8 });
    const disp = P.display(110, 50, 190, 56, (c, x, y, w, h) => {
      P.glass(x, y, w, h); P.text(x + 30, y + 9, 'NAV 1  MHz', { size: 6, color: '#9aa3ad' });
      big(c, x + w / 2, y + 33, M.radio.fmt(st.mhz, st.khz), 30, '#ffb224');
    });
    P.toggle(360, 86, { label: 'TONE', on: true, key: 'tone', name: 'IDENT TONE', onChange(v) { soundOn = v; A.sfx.switch(); if (!v) A.morseTone(false); } });
    const stepM = (d) => { if (api.done()) return; A.sfx.click(); st.mhz = d > 0 ? (st.mhz >= 118 ? 108 : st.mhz + 1) : (st.mhz <= 108 ? 118 : st.mhz - 1); disp.redraw(); };
    const stepK = (d) => { if (api.done()) return; A.sfx.click(); st.khz = (st.khz + (d > 0 ? 5 : 95)) % 100; disp.redraw(); };
    P.frame(36, 126, 124, 106); P.frame(176, 126, 124, 106);
    P.knob(98, 172, { r: 24, label: 'MHz', size: 9, ticks: 11, step: 0.42, name: 'MHz KNOB · CLICK, THEN TURN', onTurn: stepM });
    P.knob(238, 172, { r: 24, label: 'kHz', size: 9, ticks: 11, step: 0.42, name: 'kHz KNOB · CLICK, THEN TURN', onTurn: stepK });
    // direct handles (used by the automatic playthrough)
    P.keys.mhzUp = { press: () => stepM(1) }; P.keys.mhzDn = { press: () => stepM(-1) }; P.keys.khzUp = { press: () => stepK(1) }; P.keys.khzDn = { press: () => stepK(-1) };
    P.button(358, 178, {
      w: 62, h: 34, d: 8, color: '#6b4a12', label: 'TUNE', size: 9, key: 'tune', name: 'TUNE',
      onPress() {
        if (api.done()) return;
        if (M.radio.fmt(st.mhz, st.khz) === sol.freq) { stop(); lamp.set(true, '#39d98a'); api.solve('Beacon ' + st.ident + ' tuned on ' + sol.freq + '.'); }
        else api.strike('Radio tuned to ' + M.radio.fmt(st.mhz, st.khz) + ', no beacon there.');
      },
    });
    P.text(210, 262, 'BEACON IDENT: THREE LETTERS IN MORSE, THEN A LONG GAP', { size: 6.5, color: '#8d959e' });
    const U = 0.2, seq = [];
    st.ident.split('').forEach((ch, li) => {
      M.radio.MORSE[ch].split('').forEach((sym, si) => {
        seq.push([true, sym === '.' ? U : U * 3]);
        seq.push([false, si === M.radio.MORSE[ch].length - 1 ? (li === 2 ? U * 14 : U * 4.5) : U]);
      });
    });
    let idx = 0, timer = null, stopped = false;
    function step() {
      if (stopped) return;
      const [on, dur] = seq[idx];
      lamp.set(on);
      if (soundOn && api.audible()) A.morseTone(on); else A.morseTone(false);
      idx = (idx + 1) % seq.length; timer = setTimeout(step, dur * 1000);
    }
    function stop() { stopped = true; clearTimeout(timer); A.morseTone(false); }
    timer = setTimeout(step, 600);
    return { destroy: stop };
  };

  // ---------------- HYDRAULICS ----------------
  B.hyd = function (P, st, api) {
    const sol = M.hyd.solve(api.ac, st);
    P.display(24, 34, 372, 92, (c, x, y, w, h) => {
      [['g', 'GREEN', '#2fcf6f'], ['b', 'BLUE', '#3d8bff'], ['y', 'YELLOW', '#ffd21f']].forEach(([k, name, col], i) => {
        const gx = x + i * 126; P.glass(gx, y, 120, h);
        P.text(gx + 60, y + 10, name, { size: 8, color: col });
        c.fillStyle = '#1a1d21'; c.fillRect(gx + 10, y + 20, 100, 12);
        c.fillStyle = st[k] < 1000 ? '#ff3b2a' : col; c.fillRect(gx + 10, y + 20, Math.max(2, st[k] / 30), 12);
        c.strokeStyle = '#fff'; c.lineWidth = 0.7; [1000, 1500].forEach((v) => { c.beginPath(); c.moveTo(gx + 10 + v / 30, y + 18); c.lineTo(gx + 10 + v / 30, y + 34); c.stroke(); });
        big(c, gx + 50, y + 54, String(st[k]), 22, '#f3f6f9'); P.text(gx + 98, y + 57, 'PSI', { size: 7, color: '#9aa3ad' });
        P.text(gx + 60, y + 78, st[k] < 1000 ? 'LOW PRESS' : 'NORMAL', { size: 6.5, color: st[k] < 1000 ? '#ff6a5a' : '#7d8791' });
      });
    });
    const sw = {};
    M.hyd.SW.forEach((w, i) => {
      sw[w.key] = P.toggle(50 + i * 80, 196, {
        label: w.label.replace(' ENG PUMP', '\nENG PUMP').replace(' ELEC PUMP', '\nELEC PUMP'), top: w.on, bot: w.off, on: st.sw[w.key], key: w.key, name: w.label,
        onChange(v, c) { if (api.done()) { c.set(!v); return; } st.sw[w.key] = v; A.sfx.switch(); },
      });
    });
    P.button(210, 258, {
      w: 96, h: 22, d: 7, color: '#1f5a36', label: 'CONFIRM', size: 8.5, key: 'confirm', name: 'CONFIRM HYDRAULIC CONFIG',
      onPress() {
        if (api.done()) return;
        if (M.hyd.SW.every((w) => st.sw[w.key] === sol.want[w.key])) api.solve('Hydraulic systems reconfigured.');
        else api.strike('Hydraulic configuration confirmed with a wrong switch.');
      },
    });
  };

  // ---------------- CABIN INTERCOM ----------------
  B.intercom = function (P, st, api) {
    const sol = M.intercom.solve(api.ac, st);
    let answered = false, playing = null, ringTimer = null, dead = false, status = 'CREW CALLING';
    const ALT = { GREEN: '#2fcf6f', AMBER: '#ffab1f', RED: '#ff3b2a' };
    const cur = () => st.calls[st.stage];
    const call = P.button(62, 76, { w: 52, h: 38, d: 8, color: '#1d4a2c', litColor: '#4dff8f', label: 'ANSWER / REPLAY', size: 7, key: 'call', name: 'ANSWER CABIN CALL', onPress: answer });
    let ringBlink = setInterval(() => { if (!answered && !dead) call.setLit(!call.lit); }, 380);
    const info = P.display(112, 44, 290, 66, (c, x, y, w, h) => {
      P.glass(x, y, 96, h); P.text(x + 48, y + 11, 'CABIN ALT', { size: 7, color: '#9aa3ad' });
      c.fillStyle = ALT[cur().alt]; window.KK3D.rr(c, x + 10, y + 22, 76, 34, 4); c.fill();
      P.text(x + 48, y + 39, cur().alt, { size: 13, color: '#0b0c0e' });
      P.glass(x + 104, y, 186, h);
      P.text(x + 197, y + 13, 'CALL ' + (st.stage + 1) + ' / 2', { size: 8, color: '#9aa3ad' });
      P.text(x + 197, y + 39, status, { size: 13, color: status === 'CABIN SECURE' ? '#39d98a' : '#ffb224' });
    });
    P.frame(24, 128, 372, 156, 'PA  ·  CABIN ORDERS');
    const btn = {};
    M.intercom.PA_KEYS.forEach((k, i) => {
      const b = P.button(85 + (i % 3) * 125, 168 + Math.floor(i / 3) * 62, { w: 92, h: 28, d: 7, color: '#3d444d', litColor: '#39d98a', label: M.intercom.PA[k], size: 8.5, key: k, name: 'PA: ' + M.intercom.PA[k], onPress: () => press(k, b) });
      btn[k] = b;
    });
    function setStatus(s) { status = s; info.redraw(); }
    function ring() { if (dead || api.done()) return; if (!answered) A.sfx.chime(); ringTimer = setTimeout(ring, 4200); }
    function answer() {
      if (api.done()) return;
      const c = M.intercom.CALLS.find((x) => x.key === cur().key);
      answered = true; call.setLit(true); setStatus('CREW ON LINE');
      if (playing) playing.stop();
      playing = A.play(c.clip, { gain: 1.15 });
      api.subtitle('CABIN CREW: “' + c.text + '”', 11000);
      api.log('Cabin call answered: ' + c.key + '.');
    }
    function press(k, b) {
      if (api.done()) return;
      if (!answered) { setStatus('ANSWER THE CALL'); A.sfx.warn(); return; }
      if (k === sol.answers[st.stage]) {
        A.sfx.clunk(); b.setLit(true); setTimeout(() => b.setLit(false), 900);
        if (playing) playing.stop();
        st.stage++;
        if (st.stage >= st.calls.length) {
          st.stage = st.calls.length - 1; dead = true; clearTimeout(ringTimer); call.setLit(false);
          setStatus('CABIN SECURE'); api.solve('Cabin secured after two crew calls.');
        } else { answered = false; setStatus('CREW CALLING AGAIN'); A.sfx.chime(); }
      } else api.strike('Wrong cabin order given (' + M.intercom.PA[k] + ').');
    }
    ringTimer = setTimeout(ring, 900);
    return { destroy() { dead = true; clearTimeout(ringTimer); clearInterval(ringBlink); if (playing) playing.stop(); } };
  };

  // ---------------- LANDING GEAR ----------------
  B.gear = function (P, st, api) {
    const sol = M.gear.solve(api.ac, st);
    const GC = { GREEN: '#2fcf6f', RED: '#ff3b2a', DARK: '#3a3d42' };
    P.frame(24, 38, 150, 150, 'GEAR POSITION');
    const lamps = [['NOSE', 99, 72], ['LEFT', 62, 132], ['RIGHT', 136, 132]].map(([n, x, y], i) =>
      P.lamp(x, y, { w: 30, h: 26, color: st.lights[i] === 'DARK' ? '#2fcf6f' : GC[st.lights[i]], on: st.lights[i] !== 'DARK', label: n, size: 8 }));
    P.text(99, 214, 'GREEN = DOWN + LOCKED\nRED = IN TRANSIT\nDARK = NO SIGNAL', { size: 6.2, color: '#8d959e' });
    P.text(300, 42, 'MANUAL EXTENSION', { size: 8.5 });
    const disp = P.display(232, 52, 136, 36, (c, x, y, w, h) => {
      P.glass(x, y, w, h); const n = Math.abs(st.turns);
      big(c, x + 30, y + 19, st.turns === 0 ? '--' : st.turns > 0 ? 'CW' : 'CCW', 14, '#9fd8ff');
      big(c, x + 78, y + 19, String(n).padStart(2, '0'), 24, '#ffb224'); P.text(x + 114, y + 21, 'TURNS', { size: 6.5, color: '#9aa3ad' });
    });
    const turn = (d) => { if (api.done()) return; st.turns += d; A.sfx.crank(); disp.redraw(); wheel.setAngle(st.turns * 0.7854); };
    const wheel = P.wheel(300, 150, { r: 32, name: 'GEAR CRANK (left side = CCW, right side = CW)', onTurn: (d) => turn(d) });
    P.button(236, 150, { w: 28, h: 28, label: '⟲ CCW', size: 8, key: 'CCW', name: 'CRANK COUNTER-CLOCKWISE', onPress: () => turn(-1) });
    P.button(364, 150, { w: 28, h: 28, label: 'CW ⟳', size: 8, key: 'CW', name: 'CRANK CLOCKWISE', onPress: () => turn(1) });
    P.button(252, 246, { w: 64, h: 22, label: 'RESET', size: 8, key: 'RESET', name: 'RESET CRANK COUNTER', onPress() { if (api.done()) return; st.turns = 0; A.sfx.click(); disp.redraw(); wheel.setAngle(0); } });
    P.button(348, 246, {
      w: 64, h: 22, d: 8, color: '#8e1f16', label: 'RELEASE', size: 8, key: 'RELEASE', name: 'RELEASE GEAR',
      onPress() {
        if (api.done()) return;
        if (st.turns === sol.net) { lamps.forEach((l) => l.set(true, '#2fcf6f')); api.solve('Landing gear cranked down and locked.'); }
        else { st.turns = 0; disp.redraw(); wheel.setAngle(0); api.strike('Gear released with the wrong crank setting.'); }
      },
    });
  };

  // ---------------- TRANSPONDER ----------------
  B.xpdr = function (P, st, api) {
    const sol = M.xpdr.solve(api.ac, st);
    P.text(210, 46, 'RADAR CONTACT LOST  ·  SET SQUAWK', { size: 9, color: '#ffb224' });
    const disp = P.display(60, 96, 300, 62, (c, x, y, w, h) => {
      st.digits.forEach((d, i) => { P.glass(x + i * 80, y, 60, h); big(c, x + i * 80 + 30, y + 33, String(d), 42, '#ffb224'); });
    });
    st.digits.forEach((d, i) => {
      const x = 90 + i * 80;
      P.button(x, 78, { w: 40, h: 18, label: '', key: 'up' + i, name: 'DIGIT ' + (i + 1) + ' UP', onPress() { if (api.done()) return; st.digits[i] = (st.digits[i] + 1) % 8; A.sfx.click(); disp.redraw(); } });
      P.text(x + 30, 78, '▲', { size: 8 });
      P.button(x, 176, { w: 40, h: 18, label: '', key: 'dn' + i, name: 'DIGIT ' + (i + 1) + ' DOWN', onPress() { if (api.done()) return; st.digits[i] = (st.digits[i] + 7) % 8; A.sfx.click(); disp.redraw(); } });
      P.text(x + 30, 176, '▼', { size: 8 });
    });
    P.button(210, 236, {
      w: 110, h: 28, d: 8, color: '#6b4a12', label: 'IDENT', size: 9.5, key: 'ident', name: 'IDENT (SEND SQUAWK)',
      onPress() {
        if (api.done()) return;
        if (st.digits.join('') === sol.code) api.solve('Squawk ' + sol.code + ' set. Radar contact restored.');
        else api.strike('Wrong squawk code sent (' + st.digits.join('') + ').');
      },
    });
  };

  // ---------------- OVERRIDE KEYS (unlabelled colours, rule chosen by the panel's symbol) ----------------
  B.keys = function (P, st, api) {
    const sol = M.keys.solve(api.ac, st);
    P.text(196, 46, 'MANUAL OVERRIDE  ·  PRESS ONE KEY', { size: 9, color: '#ffb224' });
    const disp = P.display(318, 34, 84, 24, (c, x, y, w, h) => { P.glass(x, y, w, h); P.text(x + w / 2, y + 12.5, 'STAGE ' + (st.stage + 1) + ' / 2', { size: 8, color: '#ffb224' }); });
    P.frame(26, 66, 368, 216);
    const btns = [];
    const paint = () => btns.forEach((b, i) => { const col = st.grids[st.stage][i]; b.setColor(BCOL[col]); b.name = col + ' KEY'; });
    for (let i = 0; i < 12; i++) {
      const b = P.button(78 + (i % 4) * 88, 106 + Math.floor(i / 4) * 68, { w: 58, h: 42, d: 9, key: 'k' + i, onPress: () => press(i) });
      btns.push(b);
    }
    paint();
    function press(i) {
      if (api.done()) return;
      const col = st.grids[st.stage][i];
      if (i === sol.answers[st.stage]) {
        A.sfx.clunk();
        if (st.stage >= 1) api.solve('Override accepted after two keys.');
        else { st.stage++; paint(); disp.redraw(); api.log('First override key accepted.'); }
      } else api.strike('Wrong override key (' + col + ', row ' + (Math.floor(i / 4) + 1) + ', column ' + (i % 4 + 1) + ').');
    }
  };

  // ---------------- PASSENGER ADDRESS (not a failure: the cabin, all flight long) ----------------
  B.pa = function (P, cab) {
    const C = window.KK.CABIN;
    const lamp = P.status(); lamp.set(false, '#3d8bff');
    const disp = P.display(24, 36, 372, 62, (c, x, y, w, h) => {
      const s = cab.state(), u = Math.max(0, Math.min(1, s.unrest));
      P.glass(x, y, w, h); P.text(x + 10, y + 11, 'CABIN PANIC', { size: 7.5, color: '#9aa3ad', align: 'left' });
      c.fillStyle = '#1a1d21'; c.fillRect(x + 10, y + 20, 250, 14);
      c.fillStyle = u > 0.75 ? '#ff3b2a' : u > 0.45 ? '#ffb224' : '#39d98a'; c.fillRect(x + 10, y + 20, 250 * u, 14);
      c.strokeStyle = '#fff'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + 10 + 250 * 0.45, y + 18); c.lineTo(x + 10 + 250 * 0.45, y + 36); c.stroke();
      P.text(x + 10, y + 49, s.complaint ? 'PASSENGERS ARE SHOUTING  ·  MAKE AN ANNOUNCEMENT' : 'CABIN QUIET', { size: 8, color: s.complaint ? '#ffb224' : '#57e08a', align: 'left' });
      P.text(x + 316, y + 16, 'LAST PA', { size: 6.5, color: '#9aa3ad' }); P.text(x + 316, y + 36, s.lastPA || '--', { size: 12, color: '#e9f0f7' });
    });
    let was = false;
    window.KK3D.every(0.4, () => { const s = cab.state(); disp.redraw(); if (!!s.complaint !== was) { was = !!s.complaint; if (was) lamp.blink(2.5, '#3d8bff'); else lamp.set(false, '#3d8bff'); } });
    P.button(62, 150, { w: 56, h: 40, d: 8, color: '#27405f', label: 'LISTEN', size: 8.5, key: 'listen', name: 'LISTEN AT THE COCKPIT DOOR', onPress: () => cab.listen() });
    P.text(62, 196, 'REPEATS WHAT\nTHEY SHOUT', { size: 6, color: '#8d959e' });
    P.frame(112, 116, 284, 166, 'CAPTAIN ANNOUNCEMENTS');
    C.PA.forEach((a, i) => {
      P.button(184 + (i % 2) * 140, 158 + Math.floor(i / 2) * 66, { w: 104, h: 30, d: 7, color: '#3d444d', litColor: '#3d8bff', label: a.key, size: 9, key: a.key, name: 'ANNOUNCE: ' + a.key, onPress: (b) => { if (cab.announce(a.key)) { b.setLit(true); setTimeout(() => b.setLit(false), 1500); } } });
    });
    return { destroy() {} };
  };

  window.KKModules3D = B;
})();
