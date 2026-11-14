/* KARA KUTU — everything in the cockpit that is NOT part of a failure: dozens of
   working-but-irrelevant panels, plus the fixed screens and the aircraft data placard. */
(function () {
  'use strict';
  const A = window.KKAudio;
  const TITLES = [
    ['AC BUS BREAKERS', 'brk'], ['DC BUS BREAKERS', 'brk'], ['AVIONICS BREAKERS', 'brk'], ['GALLEY BREAKERS', 'brk'], ['LIGHTING BREAKERS', 'brk'],
    ['FLT CTL BREAKERS', 'brk'], ['FUEL BREAKERS', 'brk'], ['STANDBY BREAKERS', 'brk'], ['ELEC POWER', 'korry'], ['GENERATORS', 'sw'], ['BATTERY', 'mix'],
    ['EXT POWER', 'korry'], ['BUS TIE', 'sw'], ['STANDBY POWER', 'mix'], ['ENGINE START', 'rot'], ['ENGINE ANTI-ICE', 'sw'], ['ENGINE VIBRATION', 'gauge'],
    ['APU FIRE', 'korry'], ['CARGO FIRE', 'korry'], ['APU', 'mix'], ['IGNITION', 'rot'], ['ENGINE OIL', 'gauge'], ['THRUST REVERSER', 'annun'], ['FADEC', 'korry'],
    ['COM RADIO 1', 'radio'], ['COM RADIO 2', 'radio'], ['COM RADIO 3', 'radio'], ['ADF RADIO', 'radio'], ['HF RADIO', 'radio'], ['DME', 'radio'],
    ['ILS RECEIVER', 'radio'], ['MARKER BEACON', 'annun'], ['WX RADAR', 'rot'], ['SELCAL', 'korry'], ['AUDIO SELECT CAPT', 'korry'], ['AUDIO SELECT F/O', 'korry'],
    ['SATCOM', 'keypad'], ['ACARS', 'keypad'], ['FMS CDU 1', 'keypad'], ['FMS CDU 2', 'keypad'], ['DATA LINK', 'keypad'], ['HYD QUANTITY', 'gauge'],
    ['BRAKE PRESSURE', 'gauge'], ['PNEUMATICS', 'korry'], ['BLEED AIR', 'sw'], ['ACCUMULATORS', 'gauge'], ['AUTOBRAKE', 'rot'], ['ANTI-SKID', 'sw'],
    ['NOSE WHEEL STEERING', 'mix'], ['CABIN PRESSURE', 'gauge'], ['CABIN LIGHTS', 'sw'], ['CABIN TEMP', 'rot'], ['CABIN SIGNS', 'sw'], ['SERVICE INTERPHONE', 'korry'],
    ['PASSENGER OXYGEN', 'mix'], ['CREW OXYGEN', 'gauge'], ['EVAC COMMAND', 'korry'], ['DOORS', 'annun'], ['CARGO DOORS', 'annun'], ['LAVATORY SMOKE', 'annun'],
    ['GALLEY POWER', 'sw'], ['WATER & WASTE', 'gauge'], ['LANDING LIGHTS', 'sw'], ['GEAR DOORS', 'annun'], ['TIRE PRESSURE', 'gauge'], ['BRAKE TEMP', 'gauge'],
    ['PARKING BRAKE', 'mix'], ['TAXI LIGHTS', 'sw'], ['TCAS', 'rot'], ['ADS-B', 'korry'], ['TRANSFER BUS', 'sw'], ['ELT', 'mix'], ['CVR / FDR', 'mix'], ['GPWS', 'korry'],
    ['FUEL PUMPS', 'korry'], ['FUEL CROSSFEED', 'sw'], ['FUEL QUANTITY', 'gauge'], ['FUEL JETTISON', 'mix'], ['AIR CONDITIONING', 'rot'], ['PACKS', 'korry'],
    ['WING ANTI-ICE', 'sw'], ['PROBE HEAT', 'korry'], ['WINDOW HEAT', 'sw'], ['WIPERS', 'rot'], ['RAIN REPELLENT', 'mix'], ['EXTERIOR LIGHTS', 'sw'],
    ['PANEL LIGHTS', 'rot'], ['DOME LIGHTS', 'mix'], ['FLIGHT CONTROLS', 'korry'], ['YAW DAMPER', 'sw'], ['SPOILERS', 'annun'], ['FLAPS / SLATS', 'gauge'],
    ['STAB TRIM', 'mix'], ['RUDDER TRIM', 'rot'], ['AILERON TRIM', 'mix'], ['AUTOPILOT', 'korry'], ['AUTOTHROTTLE', 'mix'], ['FLIGHT DIRECTOR', 'sw'],
    ['IRS 1', 'rot'], ['IRS 2', 'rot'], ['GPS', 'keypad'], ['AIR DATA', 'korry'], ['STANDBY INSTRUMENTS', 'gauge'], ['CLOCK / TIMER', 'mix'],
    ['MASTER CAUTION', 'annun'], ['SYSTEM TEST', 'korry'], ['MAINTENANCE', 'keypad'], ['PRINTER', 'mix'], ['EQUIPMENT COOLING', 'sw'], ['CARGO HEAT', 'rot'],
    ['CARGO SMOKE', 'annun'], ['OVERHEAT DETECT', 'annun'], ['ICE DETECT', 'annun'], ['STALL WARNING', 'mix'], ['MACH TRIM', 'sw'], ['GROUND PROX', 'korry'],
    ['EMER LIGHTS', 'sw'], ['ANNUNCIATOR TEST', 'annun'], ['DATA LOADER', 'keypad'], ['HEADSET / MIC', 'mix'], ['COFFEE MAKER', 'korry'], ['CUP HOLDER HEAT', 'sw'],
  ];
  const WORDS = ['PUMP 1', 'PUMP 2', 'L PACK', 'R PACK', 'BUS TIE', 'GEN 1', 'GEN 2', 'BAT 1', 'BAT 2', 'XFEED', 'ISOL', 'AUTO', 'MAN', 'TEST', 'ARM', 'STBY',
    'NORM', 'ALTN', 'FAULT', 'VALVE', 'INLET', 'OUTFLOW', 'HEAT', 'L WING', 'R WING', 'CTR', 'FWD', 'AFT', 'MAIN', 'AUX', 'SYS A', 'SYS B', 'RESET', 'OVRD',
    'LOW', 'HIGH', 'DIM', 'BRT', 'CAPT', 'F/O', 'EXT', 'APU GEN', 'IGN A', 'IGN B', 'CONT', 'FLT', 'GND', 'CH 1', 'CH 2', 'SEL', 'MASTER', 'EMER', 'DUMP',
    'SHUTOFF', 'BYPASS', 'TRIM', 'RAM AIR', 'SMOKE', 'DITCH', 'VOX', 'PA', 'SVC', 'INT', 'HOT MIC', 'MKR', 'VHF 1', 'VHF 2', 'HF 1', 'SAT', 'ZONE 1', 'ZONE 2',
    'ZONE 3', 'LOOP A', 'LOOP B', 'DISCH', 'SQUIB', 'INOP', 'ENG 1', 'ENG 2', 'TANK L', 'TANK R', 'TANK C', 'QTY', 'TEMP', 'PRESS', 'FLOW', 'RATE', 'MODE',
    'LOCK', 'UNLK', 'OPEN', 'CLOSE', 'UP', 'DOWN', 'RTO', 'MAX', 'MED', 'MIN', 'OFF', 'ON', 'AC 1', 'AC 2', 'DC 1', 'DC 2', 'ESS', 'BATT', 'INV', 'TR 1', 'TR 2'];
  const LIT = ['#ffb224', '#ffb224', '#f1f3f5', '#39d98a', '#3d8bff', '#39d98a'];
  const AMPS = ['1', '3', '5', '7.5', '10', '15', '20', '25', '35', '50'];
  const BCOL = [null, null, null, null, null, null, '#e23b2e', '#ffab1f', '#2f7df0', '#f1f3f5', '#2fcf6f'];

  let queue = [], lastRng = null;
  function next(rng) {
    if (rng !== lastRng || !queue.length) { queue = rng.shuffle(TITLES); lastRng = rng; }
    const [title, type] = queue.pop();
    return { title, build(P, r) { BUILD[type](P, r); statusLamp(P, r); } };
  }
  function statusLamp(P, r) {
    const v = r();
    if (v < 0.42) P.status().set(true, '#39d98a');
    else if (v < 0.55) P.status().set(true, '#ffb224');
    else if (v < 0.61) P.status().blink(0.8 + r() * 0.8, '#ffb224');
    else P.status().set(false, '#39d98a');
  }
  const click = () => A.sfx.click(), sw = () => A.sfx.switch();
  function words(r, n) { return r.shuffle(WORDS).slice(0, n); }
  function num(r, lo, hi, dec) { return (lo + r() * (hi - lo)).toFixed(dec || 0); }
  function big(c, x, y, s, size, color) { c.font = 'bold ' + size + 'px "Courier New", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(s, x, y); }

  const BUILD = {
    sw(P, r) {
      const w = words(r, 6);
      for (let i = 0; i < 6; i++) P.toggle(80 + (i % 3) * 130, i < 3 ? 100 : 222, { label: w[i], on: r.chance(0.5), top: r.chance(0.8) ? 'ON' : 'AUTO', onChange: sw });
      P.frame(16, 44, 388, 110); P.frame(16, 166, 388, 112);
    },
    korry(P, r) {
      const w = words(r, 12);
      for (let i = 0; i < 12; i++) {
        const b = P.button(62 + (i % 4) * 99, 76 + Math.floor(i / 4) * 78, { w: 38, h: 30, d: 5, label: w[i], lit: r.chance(0.3), litColor: r.pick(LIT), color: '#3a4047', onPress() { click(); b.setLit(!b.lit); } });
      }
    },
    brk(P, r) {
      for (let i = 0; i < 18; i++) {
        P.breaker(60 + (i % 6) * 60, 80 + Math.floor(i / 6) * 76, { label: r.pick(AMPS), color: r.pick(BCOL) || '#15171a', out: r.chance(0.04), onPull: null });
      }
      P.controls.forEach((c) => { const p = c.press; c.press = function () { click(); p.call(c); }; });
    },
    radio(P, r) {
      const f1 = num(r, 118, 136, 3), f2 = num(r, 118, 136, 3);
      P.display(26, 46, 368, 50, (c, x, y, w, h) => {
        P.glass(x, y, 160, h); P.glass(x + 208, y, 160, h);
        P.text(x + 30, y + 8, 'ACTIVE', { size: 6, color: '#9aa3ad' }); P.text(x + 236, y + 8, 'STBY', { size: 6, color: '#9aa3ad' });
        big(c, x + 80, y + 29, f1, 24, '#ffb224'); big(c, x + 288, y + 29, f2, 24, '#e9f0f7');
      });
      P.button(210, 70, { w: 26, h: 18, label: 'XFER', onPress: click });
      P.knob(100, 160, { r: 17, label: 'MHz', ticks: 9, angle: r() * 4 - 2, onTurn: click });
      P.knob(210, 160, { r: 13, label: 'VOL', ticks: 7, angle: r() * 4 - 2, onTurn: click });
      P.knob(320, 160, { r: 17, label: 'kHz', ticks: 9, angle: r() * 4 - 2, onTurn: click });
      const w = words(r, 3);
      for (let i = 0; i < 3; i++) { const b = P.button(100 + i * 110, 244, { w: 30, h: 20, label: w[i], lit: r.chance(0.3), litColor: r.pick(LIT), onPress() { click(); b.setLit(!b.lit); } }); }
    },
    gauge(P, r) {
      const w = words(r, 6);
      for (let i = 0; i < 3; i++) {
        const cx = 80 + i * 130, cy = 98, v = r(), red = r() * 0.3 + 0.65;
        P.display(cx - 44, cy - 44, 88, 88, (c) => {
          c.fillStyle = '#060708'; c.beginPath(); c.arc(cx, cy, 42, 0, 7); c.fill();
          c.strokeStyle = '#aab2bb'; c.lineWidth = 1.4; c.beginPath(); c.arc(cx, cy, 42, 0, 7); c.stroke();
          for (let k = 0; k <= 10; k++) {
            const a = -2.3 + (4.6 * k) / 10; c.strokeStyle = k / 10 > red ? '#ff4a3a' : '#e6ecf2'; c.lineWidth = 1.3;
            c.beginPath(); c.moveTo(cx + Math.sin(a) * 34, cy - Math.cos(a) * 34); c.lineTo(cx + Math.sin(a) * 40, cy - Math.cos(a) * 40); c.stroke();
          }
          const a = -2.3 + 4.6 * v; c.strokeStyle = '#fff'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a) * 31, cy - Math.cos(a) * 31); c.stroke();
          c.fillStyle = '#c9d0d8'; c.beginPath(); c.arc(cx, cy, 4, 0, 7); c.fill();
          P.text(cx, cy + 24, w[i], { size: 6.5, color: '#9aa3ad' });
        });
      }
      for (let i = 0; i < 3; i++) {
        if (r.chance(0.5)) P.toggle(80 + i * 130, 226, { label: w[3 + i], on: r.chance(0.5), onChange: sw });
        else P.knob(80 + i * 130, 216, { r: 14, label: w[3 + i], ticks: 5, angle: r() * 3 - 1.5, onTurn: click });
      }
    },
    mix(P, r) {
      const w = words(r, 12);
      P.frame(16, 44, 190, 234); P.frame(216, 44, 188, 234);
      for (let i = 0; i < 4; i++) P.toggle(64 + (i % 2) * 94, i < 2 ? 100 : 218, { label: w[i], on: r.chance(0.5), onChange: sw });
      P.knob(268, 100, { r: 20, label: w[4], ticks: 6, angle: r() * 3 - 1.5, onTurn: click });
      for (let i = 0; i < 3; i++) P.lamp(362, 72 + i * 32, { w: 22, h: 9, color: r.pick(LIT), on: r.chance(0.4), label: w[5 + i], size: 6 });
      for (let i = 0; i < 2; i++) { const b = P.button(270 + i * 76, 226, { w: 30, h: 24, label: w[9 + i], lit: r.chance(0.3), litColor: r.pick(LIT), onPress() { click(); b.setLit(!b.lit); } }); }
    },
    keypad(P, r) {
      const lines = ['RTE 1   EDDM/26L', 'FPLN ' + num(r, 100, 999) + '  WPT ' + r.pick(['ANORA', 'BETOS', 'MIQ', 'OTT', 'DKB']), 'ENTER DATA >'];
      P.display(26, 40, 368, 54, (c, x, y, w, h) => { P.glass(x, y, w, h); lines.forEach((l, i) => { c.font = 'bold 10px "Courier New", monospace'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = i === 2 ? '#ffb224' : '#57e08a'; c.fillText(l, x + 10, y + 12 + i * 15); }); });
      const K = 'ABCDEFGHIJKLMNOPQR'.split('');
      for (let i = 0; i < 18; i++) P.button(60 + (i % 6) * 60, 132 + Math.floor(i / 6) * 50, { w: 34, h: 26, d: 4, label: K[i], size: 8, name: 'KEY ' + K[i], onPress: click });
    },
    annun(P, r) {
      const w = words(r, 26);
      for (let i = 0; i < 15; i++) P.lamp(62 + (i % 5) * 74, 70 + Math.floor(i / 5) * 52, { w: 50, h: 17, color: r.pick(['#ffb224', '#ffb224', '#39d98a', '#3d8bff', '#f1f3f5', '#ff5a3a']), on: r.chance(0.28), label: w[i], size: 6.2 });
      P.button(120, 246, { w: 46, h: 22, label: 'LAMP TEST', onPress: click });
      P.knob(300, 240, { r: 13, label: w[25], ticks: 5, angle: r() * 3 - 1.5, onTurn: click });
      const b = P.button(210, 246, { w: 46, h: 22, label: w[24], lit: r.chance(0.4), litColor: '#ffb224', onPress() { click(); b.setLit(!b.lit); } });
    },
    rot(P, r) {
      const w = words(r, 12);
      for (let i = 0; i < 3; i++) {
        const cx = 80 + i * 130;
        P.knob(cx, 108, { r: 22, label: w[i], ticks: 5, angle: (r.int(0, 4) - 2) * 0.55, step: 0.55, onTurn: click });
        P.text(cx - 34, 76, w[3 + i], { size: 5.5, color: '#aeb6bf' }); P.text(cx + 34, 76, w[6 + i], { size: 5.5, color: '#aeb6bf' });
      }
      for (let i = 0; i < 4; i++) {
        if (i % 2) P.toggle(70 + i * 94, 232, { label: w[8 + i], on: r.chance(0.5), onChange: sw });
        else { const b = P.button(70 + i * 94, 228, { w: 34, h: 26, label: w[8 + i], lit: r.chance(0.4), litColor: r.pick(LIT), onPress() { click(); b.setLit(!b.lit); } }); }
      }
    },
  };

  // ---------------- fixed panels ----------------
  function fixedTitle(kind) { return kind === 'data' ? 'AIRCRAFT DATA PLACARD' : ''; }
  function fixed(kind, P, flight, K3) {
    const a = flight.aircraft;
    if (kind === 'data') {
      [['FLIGHT', 'KK ' + a.flight, 54], ['REGISTRATION', a.reg, 126], ['SOULS ON BOARD', String(a.souls), 198]].forEach(([l, v, y]) => {
        P.text(34, y, l, { size: 8.5, color: '#9aa3ad', align: 'left' });
        P.glass(30, y + 10, 220, 44); const c = P.ctx; c.font = 'bold 30px "Courier New", monospace'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#f3f6f9'; c.fillText(v, 42, y + 33);
      });
      P.frame(272, 48, 124, 204, 'STATUS LIGHTS');
      P.lamp(334, 96, { w: 70, h: 30, color: '#ffb224', on: a.apu, label: 'APU', labelAbove: true, size: 11 });
      P.lamp(334, 186, { w: 70, h: 30, color: '#3dc8ff', on: a.ice, label: 'ICE', labelAbove: true, size: 11 });
      P.text(334, 126, a.apu ? 'LIT' : 'DARK', { size: 7, color: '#8d959e' }); P.text(334, 216, a.ice ? 'LIT' : 'DARK', { size: 7, color: '#8d959e' });
      P.text(210, 278, 'READ THIS TO THE TOWER WHEN THEY ASK FOR THE PLACARD', { size: 6.5, color: '#8d959e' });
      return;
    }
    if (kind === 'pfd') {
      let d = null;
      d = P.display(14, 14, 392, 272, (c) => drawPFD(c, P, d && d.env));
      d.env = { roll: 0, altFt: 24000, danger: 0 };
      K3.every(0.1, (env) => { d.env = env; d.redraw(); });
      return;
    }
    if (kind === 'eng') {
      P.display(14, 14, 392, 272, (c, x, y, w, h) => {
        P.glass(x, y, w, h);
        [1, 2].forEach((n, i) => {
          const cx = 110 + i * 200, cy = 100, v = 0.74 + i * 0.03;
          c.strokeStyle = '#e6ecf2'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 46, Math.PI * 0.8, Math.PI * 2.1); c.stroke();
          c.strokeStyle = '#ff4a3a'; c.beginPath(); c.arc(cx, cy, 46, Math.PI * 2.0, Math.PI * 2.1); c.stroke();
          const ang = Math.PI * 0.8 + Math.PI * 1.3 * v; c.strokeStyle = '#57e08a'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(ang) * 42, cy + Math.sin(ang) * 42); c.stroke();
          big(c, cx, cy + 26, (v * 100).toFixed(1), 16, '#57e08a'); P.text(cx, cy - 62, 'N1  ENG ' + n, { size: 8, color: '#9aa3ad' });
          P.text(cx - 30, 190, 'N2', { size: 7, color: '#9aa3ad' }); big(c, cx + 10, 190, (88 + i * 1.4).toFixed(1), 13, '#e9f0f7');
          P.text(cx - 30, 212, 'FF', { size: 7, color: '#9aa3ad' }); big(c, cx + 10, 212, String(2480 + i * 60), 13, '#e9f0f7');
        });
        c.fillStyle = '#ff3b2a'; c.fillRect(120, 236, 180, 30); P.text(210, 251, 'MASTER WARNING', { size: 11, color: '#fff' });
      });
      return;
    }
    // copilot navigation display with weather radar
    P.display(14, 14, 392, 272, (c, x, y, w, h) => {
      P.glass(x, y, w, h); c.save(); c.beginPath(); c.rect(x + 2, y + 2, w - 4, h - 4); c.clip();
      const cx = 210, cy = 270;
      [[150, 110, 60, '#1f8a3a'], [170, 100, 38, '#d9c21f'], [178, 96, 20, '#d9321f'], [290, 150, 44, '#1f8a3a'], [296, 146, 22, '#d9c21f'], [90, 190, 30, '#1f8a3a']].forEach(([bx, by, br, col]) => { c.fillStyle = col; c.globalAlpha = 0.75; c.beginPath(); c.arc(bx, by, br, 0, 7); c.fill(); });
      c.globalAlpha = 1; c.strokeStyle = '#e6ecf2'; c.lineWidth = 1;
      [90, 170, 250].forEach((rr2) => { c.beginPath(); c.arc(cx, cy, rr2, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); });
      c.strokeStyle = '#e04adf'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx - 8, 170); c.lineTo(cx + 40, 90); c.lineTo(cx + 30, 30); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(cx, cy - 26); c.lineTo(cx - 8, cy - 8); c.lineTo(cx + 8, cy - 8); c.fill();
      c.restore(); P.text(60, 30, 'WX RADAR', { size: 8, color: '#57e08a' }); P.text(350, 30, 'HDG 262', { size: 8, color: '#57e08a' }); P.text(354, 268, 'RWY 26L', { size: 8, color: '#e04adf' });
    });
  }
  function drawPFD(c, P, env) {
    env = env || { roll: 0, altFt: 24000, danger: 0 };
    const x = 14, y = 14, w = 392, h = 272, cx = 196, cy = 150;
    P.glass(x, y, w, h);
    c.save(); c.beginPath(); c.rect(96, 44, 200, 212); c.clip();
    c.translate(cx, cy); c.rotate(-(env.roll || 0) * 2.2);
    const pitch = 14 + Math.sin((env.t || 0) * 0.8) * 4;
    c.fillStyle = '#2a6fd6'; c.fillRect(-300, -300, 600, 300 + pitch);
    c.fillStyle = '#7a4a22'; c.fillRect(-300, pitch, 600, 300);
    c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-300, pitch); c.lineTo(300, pitch); c.stroke();
    c.lineWidth = 1; c.font = 'bold 7px Arial'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    [-20, -10, 10, 20].forEach((p) => { const yy = pitch - p * 3.2; c.beginPath(); c.moveTo(-26, yy); c.lineTo(26, yy); c.stroke(); c.fillText(String(Math.abs(p)), 36, yy); });
    c.restore();
    c.strokeStyle = '#ffd21f'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 56, cy); c.lineTo(cx - 20, cy); c.lineTo(cx - 20, cy + 8); c.moveTo(cx + 56, cy); c.lineTo(cx + 20, cy); c.lineTo(cx + 20, cy + 8); c.stroke();
    c.fillStyle = '#ffd21f'; c.fillRect(cx - 3, cy - 3, 6, 6);
    // speed + altitude tapes
    c.fillStyle = '#15181c'; c.fillRect(28, 44, 58, 212); c.fillRect(306, 44, 86, 212);
    P.text(57, 34, 'SPD', { size: 7, color: '#9aa3ad' }); P.text(349, 34, 'ALT FT', { size: 7, color: '#9aa3ad' });
    c.fillStyle = '#000'; c.fillRect(30, cy - 13, 54, 26); c.fillRect(308, cy - 14, 82, 28);
    c.strokeStyle = '#fff'; c.lineWidth = 1; c.strokeRect(30, cy - 13, 54, 26); c.strokeRect(308, cy - 14, 82, 28);
    const low = env.altFt < 5000;
    big(c, 57, cy, String(Math.round(238 + Math.sin((env.t || 0) * 0.6) * 6)), 16, '#57e08a');
    big(c, 349, cy, String(Math.round(env.altFt)).padStart(5, '0'), 18, low ? '#ff5a3a' : '#57e08a');
    for (let i = -3; i <= 3; i++) { if (!i) continue; P.text(349, cy + i * 28, String(Math.max(0, Math.round(env.altFt / 500) * 500 - i * 500)), { size: 7, color: '#8d959e' }); }
    P.text(196, 30, env.danger ? 'PULL UP' : low ? 'TERRAIN' : 'ALT HOLD  FAIL', { size: 9, color: env.danger || low ? '#ff3b2a' : '#ffb224' });
    P.text(196, 268, 'HDG 262   V/S -' + (env.vs || 1800), { size: 8, color: '#57e08a' });
  }

  window.KKDecoys = { next, fixed, fixedTitle };
})();
