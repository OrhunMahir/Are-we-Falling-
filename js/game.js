/* KARA KUTU — cockpit game loop. */
(function () {
  'use strict';
  const KK = window.KK, A = window.KKAudio;
  const $ = (id) => document.getElementById(id);
  const START_ALT = 24000;

  // ---------- stage scaling ----------
  const stage = $('stage');
  function fit() {
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
  }
  window.addEventListener('resize', fit); fit();
  // going in and out of fullscreen: some browsers report the new size late, so measure again after the change has settled
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => {
    [0, 250, 800].forEach((ms) => setTimeout(() => { try { window.dispatchEvent(new Event('resize')); } catch (e) { fit(); } }, ms));
  }));

  function show(id) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('show', el.id === id));
  }

  // ---------- settings ----------
  const settings = { mode: 'short', players: 2, cabin: true };
  try { const m = localStorage.getItem('kk_mode'); if (m && KK.MODES[m]) settings.mode = m; } catch (e) {}
  const params = new URLSearchParams(location.search);
  const fixedSeed = params.get('seed') ? parseInt(params.get('seed'), 10) : null;

  // ---------- title ----------
  const titleSky = window.KKSky($('titleSky'));
  titleSky.reset('title'); titleSky.state.alt = 0.75; titleSky.state.damage = 0.4;
  const sky = window.KKSky($('sky'));
  const K3 = window.KK3D;
  K3.init($('view3d'), $('sky'));

  function buildModes() {
    const box = $('modes'); box.innerHTML = '';
    Object.keys(KK.MODES).forEach((k) => {
      const m = KK.MODES[k];
      const b = document.createElement('button');
      b.className = 'mode' + (settings.mode === k ? ' sel' : '');
      b.innerHTML = '<b>' + m.name + '</b><span>' + m.desc + '</span>';
      b.onclick = () => { settings.mode = k; try { localStorage.setItem('kk_mode', k); } catch (e) {} A.init(); A.sfx.click(); buildModes(); };
      box.appendChild(b);
    });
  }
  buildModes();

  function buildQR() {
    const url = new URL('manual.html', location.href); url.search = ''; url.hash = '';
    const local = location.protocol === 'file:' || /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname);
    $('btnTower').href = url.href;
    const box = $('qr');
    if (local) {
      box.innerHTML = '<div class="qr-local">Running from a local file.<br>Open <b>manual.html</b> on a second device,<br>or print it.</div>';
      $('qrUrl').textContent = '';
      return;
    }
    try {
      const qr = window.qrcode(0, 'M'); qr.addData(url.href); qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
      $('qrUrl').textContent = url.host + url.pathname;
    } catch (e) { box.textContent = url.href; }
  }
  buildQR();

  function setMuteLabels() {
    $('btnMute').textContent = 'SOUND: ' + (A.isMuted() ? 'OFF' : 'ON');
    $('btnMute2').classList.toggle('off', A.isMuted());
  }
  $('btnMute').onclick = () => { A.init(); A.setMuted(!A.isMuted()); setMuteLabels(); };
  $('btnMute2').onclick = () => { A.setMuted(!A.isMuted()); setMuteLabels(); };
  // fullscreen: the title button, the round button in the cockpit corner, the lobby and tower buttons and the P key. The pages in the frame call it too.
  function toggleFull() {
    const d = document, el = d.documentElement;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else { const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (p && p.catch) p.catch(() => {}); }
    } catch (e) {}
  }
  window.__awfFull = toggleFull;
  ['btnFull', 'btnFull2'].forEach((id) => { $(id).onclick = (e) => { toggleFull(); e.currentTarget.blur(); }; });   // blur: SPACE must not press the button again
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) toggleFull();
  });
  $('btnFly').onclick = () => startFlight();
  $('btnAgain').onclick = () => startFlight();
  $('btnSwap').onclick = () => startFlight();
  $('btnHome').onclick = () => toTitle();
  $('btnAbort').onclick = () => { if (G && G.phase === 'flight') { endCleanup(); toTitle(); } };

  let musicOn = false;
  function titleMusic(on) {
    if (!A.ready()) return;
    if (on && !musicOn) { A.loop('music', 0.55, 'music'); musicOn = true; }
    if (!on && musicOn) { A.stopLoop('music', 1.2); musicOn = false; }
  }
  // audio can only start after a user gesture
  document.addEventListener('pointerdown', function first() {
    A.init();
    if ($('title').classList.contains('show')) titleMusic(true);
    document.removeEventListener('pointerdown', first);
  });

  function toTitle() { stopLandCam(); show('title'); A.stopAllLoops(0.5); musicOn = false; titleMusic(true); G = null; }

  // ---------- game state ----------
  let G = null;
  let controllers = [];

  function startFlight() {
    stopLandCam();
    A.init();
    titleMusic(false);
    A.stopAllLoops(0.3); musicOn = false;
    const seed = fixedSeed != null ? fixedSeed : KK.newCode(settings.mode);
    const flight = KK.genFlight(seed, settings.mode);
    G = {
      flight, total: flight.time, timeLeft: flight.time, strikes: 0,
      // "stress" is the shared tension value (0..1). Mistakes and low altitude raise it;
      // the cabin loop, the shaking and future cabin-crew gameplay all read it.
      stress: 0,
      solved: 0, phase: 'intro', log: [], called: {}, t: 0, nextThunder: 6 + Math.random() * 8, endT: 0,
      players: settings.players,
      drunk: 0, sips: 0, smoke: 0, cigs: 0, coughT: 0,
      cabin: { unrest: 0.12, complaint: null, lastPA: null, cool: 0, calmed: 0, panics: 0, lastKey: null },
    };
    buildCockpit(); blink(0);
    show('cockpit');
    sky.reset('flight');
    log('MAYDAY declared. ' + flight.modules.length + ' system failures.');
    // intro
    const ov = $('overlay');
    ov.className = 'overlay show intro';
    ov.innerHTML = '<div class="ov-big">MAYDAY</div><div class="ov-sub">Read the FLIGHT CODE and the failed systems to the tower.<br>The tower tells you which picture to look for.<br>Drag to look around · scroll to zoom · click to operate</div>';
    A.sfx.warn();
    A.play('mayday', { gain: 0.9 });
    if (A.has('sfx_cockpit')) A.loop('sfx_cockpit', 0.5); else A.startDrone();
    A.loop('sfx_panic', 0.05);
    setTimeout(() => {
      if (!G || G.flight !== flight) return;
      ov.className = 'overlay';
      G.phase = 'flight';
      setTimeout(() => { if (G && G.flight === flight && G.phase === 'flight') { subtitle('TOWER: “Mayday acknowledged. I have the emergency handbook open. Tell me exactly what you see.”', 6000); A.play('atc_intro', { radio: true, gain: 0.8 }); } }, 2600);
    }, 2600);
  }

  function buildCockpit() {
    controllers.forEach((c) => c && c.destroy && c.destroy());
    controllers = [];
    const a = G.flight.aircraft;
    const built = K3.build(G.flight, (m, P) => {
      const def = KK.MODULES[m.id];
      const api = {
        ac: a,
        done: () => m.solved || !G || G.phase !== 'flight',
        audible: () => G && G.phase === 'flight',
        log: (t) => log(t),
        subtitle: (t, ms) => subtitle(t, ms),
        strike: (why) => strike(def.short, why, P),
        solve: (why) => { m.solved = true; P.status().set(true, '#39d98a'); solved(def.short, why); renderFaults(); },
      };
      return window.KKModules3D[m.id](P, m.state, api);
    }, [{ id: 'pa', title: 'PASSENGER ADDRESS', build: (P) => window.KKModules3D.pa(P, { state: () => (G ? G.cabin : { unrest: 0 }), listen: cabinListen, announce: cabinAnnounce }) }]);
    controllers = built.controllers;
    renderFaults(); renderCabin();
    renderHud();
  }
  // ---------- the cabin: restless passengers, calmed by the captain's announcements ----------
  function renderCabin() {
    if (!G) return;
    const cb = G.cabin, u = Math.max(0, Math.min(1, cb.unrest));
    $('cabinFill').style.width = Math.round(u * 100) + '%';
    $('cabin').className = (u > 0.75 ? 'red' : u > 0.45 ? 'amber' : '') + (cb.complaint ? ' shout' : '');
    $('cabinTxt').textContent = cb.complaint ? 'SHOUTING · USE THE PA' : 'QUIET';
  }
  function cabinComplain(key) {
    const cb = G.cabin, C = KK.CABIN.COMPLAINTS;
    let c = key && C.find((x) => x.key === key && x.key !== cb.lastKey);
    if (!c) do { c = C[Math.floor(Math.random() * C.length)]; } while (c.key === cb.lastKey);
    cb.complaint = c; cb.lastKey = c.key;
    log('Passengers shouting through the door (' + c.key.toLowerCase() + ').');
    cabinListen();
  }
  function cabinListen() {
    if (!G || G.phase !== 'flight') return;
    const c = G.cabin.complaint;
    if (!c) { subtitle('The cabin is quiet. Nothing to hear.', 2200); return; }
    A.play(c.clip, { gain: 0.95 });
    subtitle('PASSENGER (through the door): “' + c.text + '”', 6500);
  }
  function cabinAnnounce(key) {
    if (!G || G.phase !== 'flight') return false;
    const cb = G.cabin;
    if (!cb.complaint) { subtitle('The cabin is quiet. No announcement needed.', 2200); A.sfx.click(); return false; }
    const want = KK.CABIN.answer(cb.complaint.key, cb.lastPA), pa = KK.CABIN.PA.find((p) => p.key === key);
    cb.lastPA = key;
    if (key === want) {
      cb.unrest = Math.max(0, cb.unrest - 0.55); cb.complaint = null; cb.cool = 8; cb.calmed++;
      A.sfx.chime(); setTimeout(() => A.play(pa.clip, { gain: 0.9, radio: true }), 350);
      subtitle('CAPTAIN (PA): “' + pa.text + '”', 7000);
      log('Announcement "' + key + '" calmed the cabin.', 'good');
    } else {
      cb.unrest = Math.min(0.99, cb.unrest + 0.18); A.sfx.warn();
      subtitle('WRONG ANNOUNCEMENT · THE CABIN GETS LOUDER', 2600);
      log('Announcement "' + key + '" made the cabin angrier.', 'bad');
    }
    renderCabin();
    return key === want;
  }
  function cabinTick(dt) {
    const cb = G.cabin, prog = 1 - G.timeLeft / G.total;
    if (!settings.cabin) return;
    if (cb.cool > 0) cb.cool -= dt; else cb.unrest = Math.min(1, cb.unrest + dt * 0.0075 * (1 + prog * 1.5));
    if (!cb.complaint && cb.unrest >= 0.45) cabinComplain();
    if (cb.unrest >= 1) {
      cb.panics++; cb.unrest = 0.5; cb.complaint = null; cb.cool = 3;
      G.timeLeft = Math.max(0.5, G.timeLeft - KK.CABIN.PANIC_PENALTY);
      log('Panic in the cabin. Passengers out of their seats, altitude lost.', 'bad');
      A.sfx.strike(); sky.jolt(0.8);
      subtitle('PANIC IN THE CABIN · ALTITUDE LOST', 3000);
      $('cockpit').classList.add('hit'); setTimeout(() => $('cockpit').classList.remove('hit'), 600);
    }
    renderCabin();
  }

  function renderFaults() {
    if (!G) return;
    $('faults').innerHTML = '<label>FAILED SYSTEMS</label>' + G.flight.modules.map((m) =>
      '<div class="' + (m.solved ? 'ok' : '') + '">' + KK.MODULES[m.id].title + '</div>').join('') +
      '<span class="code">FLIGHT CODE <b>' + G.flight.seed + '</b><small>read it to the tower</small></span>';
  }
  // ---------- whiskey: every sip buys time and blurs the cockpit ----------
  const MAX_SIPS = 6, SIP_SECONDS = 8;
  K3.hooks.onDrink = () => {
    if (!G || G.phase !== 'flight') return false;
    if (G.sips >= MAX_SIPS) { subtitle('The bottle is empty.', 2200); return false; }
    G.sips++; G.drunk = Math.min(5, G.drunk + 1);
    G.timeLeft = Math.min(G.total, G.timeLeft + SIP_SECONDS);
    setTimeout(() => A.play(G && G.drunk >= 2.6 ? 'whisky_drunk' : 'whisky_sip', { gain: 1 }), 500);
    subtitle('LIQUID COURAGE · +' + SIP_SECONDS + ' SECONDS' + (G.drunk >= 2 ? ' · the labels start to swim' : ''), 3200);
    log('The captain took a sip of whiskey (' + G.sips + ' of ' + MAX_SIPS + ').');
    return true;
  };
  // ---------- the cabin seats: what the saboteur and the flight attendant do in the cabin lands here ----------
  function cabinTask(d) {
    if (!G || G.phase !== 'flight' || !d) return;
    const sab = d.role === 'saboteur', eff = Math.max(-30, Math.min(30, +d.effect || 0)), sign = (eff > 0 ? '+' : '') + eff;
    G.timeLeft = Math.max(5, Math.min(G.total, G.timeLeft + eff));
    const g = G;
    setTimeout(() => {   // a moment later, so the pilot reads the message before the cabin reacts
      if (G !== g || G.phase !== 'flight') return;
      (d.fx || []).forEach((f) => {
        if (!f) return;
        if (f.type === 'turbulence') turbulence(0.7);
        else if (f.type === 'panic') G.cabin.unrest = Math.min(1, G.cabin.unrest + (+f.amount || 0.25) * 0.6);
        else if (f.type === 'masks' || f.type === 'smoke') { G.cabin.unrest = Math.min(1, G.cabin.unrest + 0.12); if (!G.cabin.complaint) cabinComplain(); }
        else if (f.type === 'blackout') { K3.lightning(); turbulence(0.3); }
        else if (f.type === 'calm') G.cabin.unrest = Math.max(0, G.cabin.unrest - (+f.amount || 0.15));   // the flight attendant put an end to a panic
        else if (f.type === 'coffee') { G.drunk = Math.max(0, G.drunk - 2.5); renderDrunk(); }            // a black coffee from the flight attendant: the labels stop swimming
      });
    }, 3000);
    if (!sab && !(d.fx || []).some((f) => f && f.type === 'nocalm')) G.cabin.unrest = Math.max(0, G.cabin.unrest - 0.2);   // the flight attendant calms the cabin with every job done, unless the task says 'nocalm' (the kiss: time only)
    if (sab) A.sfx.warn(); else A.sfx.chime();
    if (!sab && d.id === 'COFFEE') K3.kiss();   // the flight attendant in the cockpit leans in and hands the captain the cup
    subtitle((sab ? 'SABOTAGE IN THE CABIN · ' : 'CABIN CREW · ') + d.title + (eff ? ' · ' + sign + ' SECONDS' : ''), 4200);
    log((sab ? 'Sabotage in the cabin: ' : 'The flight attendant: ') + String(d.title).toLowerCase() + (eff ? ' (' + sign + ' s).' : '.'));
  }
  // ---------- the ashtray: a drag buys a little time and clears the head, but the smoke stays in the cockpit for a while, and the cigarette burns down ----------
  const DRAG_SMOKE = 0.3, SMOKE_MAX = 1.6, SMOKE_CLEAR = 40;   // SMOKE_CLEAR: seconds for one full unit of smoke to drift away
  const MAX_DRAGS = 5, DRAG_SECONDS = 5;
  K3.hooks.onSmoke = () => {
    if (!G || G.phase !== 'flight') return false;
    if (G.cigs >= MAX_DRAGS) { subtitle('The cigarette is burned down.', 2200); return false; }
    G.cigs++; G.smoke = Math.min(SMOKE_MAX, G.smoke + DRAG_SMOKE); G.drunk = Math.max(0, G.drunk - 0.8);
    G.timeLeft = Math.min(G.total, G.timeLeft + DRAG_SECONDS);
    A.sfx.lighter(); setTimeout(() => A.sfx.exhale(), 1500);
    subtitle('A DRAG · +' + DRAG_SECONDS + ' SECONDS · ' + (G.cigs >= MAX_DRAGS ? 'that was the last of it' : G.smoke > 1.05 ? 'you can barely see the panels' : G.smoke > 0.6 ? 'the cockpit is getting hazy' : 'steadier head, thicker air'), 3000);
    log('The captain had a smoke (' + G.cigs + ' of ' + MAX_DRAGS + ').');
    return true;
  };
  let blurNow = -1, hazeNow = -1;
  function renderDrunk() {
    const d = G ? G.drunk : 0, s = G ? G.smoke || 0 : 0, px = Math.max(0, d - 0.7) * 1.35 + Math.max(0, s - 0.7) * 1.2, key = px + s * 4;
    if (Math.abs(key - blurNow) > 0.06) {
      blurNow = key; const f = [];
      if (px > 0.05) f.push('blur(' + px.toFixed(2) + 'px)');
      if (d > 0.74) f.push('saturate(' + (1 + d * 0.12).toFixed(2) + ')');
      if (s > 0.03) f.push('contrast(' + (1 - Math.min(0.45, s * 0.3)).toFixed(2) + ')', 'brightness(' + (1 + Math.min(0.12, s * 0.07)).toFixed(2) + ')');
      $('view3d').style.filter = f.join(' ');
    }
    if (Math.abs(s - hazeNow) > 0.008 || (s === 0 && hazeNow !== 0)) { hazeNow = s; $('haze').style.opacity = Math.min(0.6, s * 0.4).toFixed(3); }
  }
  // heavy eyelids: the more whiskey, the slower and longer the blinks
  const lid = { t: 0, dur: 0, next: 4, k: 0 };
  function blink(dt) {
    const d = G && G.phase === 'flight' ? G.drunk : 0;
    let k = 0;
    if (d >= 0.9) {
      const droop = Math.max(0, Math.min(1, (d - 1.6) / 3)) * 0.2;
      if (lid.t > 0) {
        lid.t -= dt; const u = 1 - Math.max(0, lid.t) / lid.dur;                       // 0..1 through the blink
        k = u < 0.3 ? u / 0.3 : u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45;                     // close fast, stay shut, open slowly
      } else {
        lid.next -= dt;
        if (lid.next <= 0) { lid.dur = 0.45 + d * 0.22 + (d > 3 && Math.random() < 0.3 ? 1.1 : 0); lid.t = lid.dur; lid.next = Math.max(1.4, 5.2 - d * 0.8) * (0.6 + Math.random() * 0.8); }
      }
      k = Math.max(k, droop);
    } else { lid.t = 0; lid.next = 2.5; }
    if (Math.abs(k - lid.k) > 0.004 || (k === 0 && lid.k !== 0)) {
      lid.k = k;
      $('lidT').style.display = $('lidB').style.display = k > 0 ? 'block' : 'none';
      $('lidT').style.height = Math.round(720 * 0.6 * k) + 'px'; $('lidB').style.height = Math.round(720 * 0.46 * k) + 'px';
    }
  }
  function slur(t) {
    const d = G ? G.drunk : 0; if (d < 1.4) return t;
    const a = t.split('');
    for (let i = 0; i < a.length - 1; i++) if (/[A-Z]/.test(a[i]) && /[A-Z]/.test(a[i + 1]) && Math.random() < 0.09 * d) { const x = a[i]; a[i] = a[i + 1]; a[i + 1] = x; i++; }
    return a.join('');
  }
  // ---------- standing up to reach the walls behind the seats ----------
  K3.hooks.onPose = (up, instant) => {
    $('btnStand').textContent = up ? 'SIT DOWN (F)' : 'STAND UP (F)';
    if (instant || !G || G.phase !== 'flight') return;
    A.sfx.clunk(); setTimeout(() => A.sfx.switch(), up ? 700 : 500);
    subtitle(up ? 'You unbuckle and stand up. The front panels are out of reach now.' : 'You drop back into the seat and buckle up.', 2600);
  };
  K3.hooks.onDecoy = () => wrongSwitch();
  K3.hooks.onFocus = (c) => { $('knobHint').className = c ? 'show' : ''; if (c) A.sfx.click(); };
  K3.hooks.onBlocked = (why) => {
    A.sfx.click();
    subtitle(why === 'stand' ? 'TOO FAR FROM THE SEAT · STAND UP FIRST (F)' : 'OUT OF REACH WHILE STANDING · SIT DOWN FIRST (F)', 2600);
  };
  $('btnStand').onclick = () => { if (G && G.phase === 'flight') K3.stand(!K3.pose.to); };
  K3.hooks.onHover = (h) => {
    const el = $('lookAt');
    if (!h) { el.className = ''; return; }
    if (h.ctrl) h.ctrl = h.blocked ? (h.blocked === 'stand' ? 'STAND UP TO REACH (F)' : 'SIT DOWN TO REACH (F)') : slur(h.ctrl);
    el.className = 'show' + (h.ctrl ? ' ctrl' : '');
    el.innerHTML = '<small>' + h.surface + (h.panel ? ' · ' + (h.symbol ? h.symbol + ' ' : '') + h.panel : '') + '</small>' + (h.ctrl ? '<b>' + h.ctrl + '</b>' : '');
  };

  function fmtTime(t) { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
  function stamp() { return fmtTime(G.total - G.timeLeft); }
  function log(text, kind) { if (G) G.log.push({ t: stamp(), text, kind: kind || '' }); }

  function altitude() { return Math.max(0, Math.round((G.timeLeft / G.total) * START_ALT / 10) * 10); }

  function renderHud() {
    $('hudAlt').textContent = String(altitude()).padStart(5, '0');
    $('hudTime').textContent = fmtTime(G.timeLeft);
    let d = '';
    for (let i = 0; i < KK.MAX_STRIKES; i++) d += '<i class="' + (i < G.strikes ? 'hit' : '') + '"></i>';
    $('hudDmg').innerHTML = d;
    $('cockpit').classList.toggle('danger', G.timeLeft < 30 && G.phase === 'flight');
    $('master').classList.toggle('on', G.strikes > 0 || G.timeLeft < 30);
  }

  let subTimer = null;
  function subtitle(text, ms) {
    const el = $('subtitle'); el.textContent = text; el.classList.add('show');
    clearTimeout(subTimer); subTimer = setTimeout(() => el.classList.remove('show'), ms || 4000);
  }

  // a wrong switch upsets the aircraft: it shakes for a few seconds and the cabin gets angry
  function turbulence(power) {
    if (!G || G.phase !== 'flight') return;
    G.turb = Math.max(G.turb || 0, 1.3 + power * 2.6); G.turbP = Math.max(G.turbP || 0, 0.35 + power * 0.65);
    A.sfx.rattle(power);
  }
  function wrongSwitch() {
    if (!G || G.phase !== 'flight') return;
    const now = performance.now(); if (now - (G.lastWrong || 0) < 900) return; G.lastWrong = now;
    turbulence(0.35);
    if (settings.cabin) G.cabin.unrest = Math.min(0.99, G.cabin.unrest + 0.07);
    G.stress = Math.min(1, G.stress + 0.05);
    subtitle('WRONG SWITCH · TURBULENCE · THE CABIN IS GETTING ANGRY', 2200);
    log('Wrong switch: turbulence, the passengers are getting angry.', 'bad');
  }
  function strike(modName, why, modEl) {
    if (!G || G.phase !== 'flight') return;
    G.strikes++;
    G.timeLeft = Math.max(0.5, G.timeLeft - KK.STRIKE_PENALTY);
    G.stress = Math.min(1, G.stress + 0.34);
    if (settings.cabin) { G.cabin.unrest = Math.min(0.99, G.cabin.unrest + 0.3); if (!G.cabin.complaint) setTimeout(() => { if (G && G.phase === 'flight' && !G.cabin.complaint) cabinComplain('SHAKING'); }, 1400); }
    log(modName + ': ' + why, 'bad');
    A.sfx.strike(); sky.jolt(1); turbulence(1); sky.state.damage = G.strikes / KK.MAX_STRIKES;
    sky.state.rollTarget = (Math.random() < 0.5 ? -1 : 1) * 0.06 * G.strikes;
    $('cockpit').classList.add('hit'); setTimeout(() => $('cockpit').classList.remove('hit'), 600);
    A.setLoopGain('sfx_panic', 0.08 + G.stress * 0.4);
    renderHud();
    if (G.strikes >= KK.MAX_STRIKES) { crash('Structural failure after ' + G.strikes + ' wrong actions.'); return; }
    setTimeout(() => { if (G && G.phase === 'flight') A.play(G.strikes === 1 ? 'gpws_strike' : 'gpws_sink', { gain: 0.8 }); }, 450);
    subtitle('WRONG ACTION — ALTITUDE LOST · ' + (KK.MAX_STRIKES - G.strikes) + ' MISTAKE' + (KK.MAX_STRIKES - G.strikes === 1 ? '' : 'S') + ' LEFT', 2600);
  }

  function solved(modName, why) {
    if (!G) return;
    G.solved++;
    log(modName + ': ' + why, 'good');
    A.sfx.solved();
    if (G.solved >= G.flight.modules.length) land();
  }

  // ---------- endings ----------
  function land() {
    G.phase = 'landing'; G.endT = 0; G.landAltStart = altitude();
    log('All systems stable. Cleared to land runway 26L.', 'good');
    controllers.forEach((c) => c && c.destroy && c.destroy());
    K3.stand(false, true); K3.resetView(); K3.view.pitch = 0.03; G.drunk = 0; G.smoke = 0; renderDrunk(); blink(0);
    sky.state.mode = 'landing'; sky.state.landT = 0; sky.state.rollTarget = 0; sky.state.damage = 0;
    const ov = $('overlay'); ov.className = 'overlay show landing';
    ov.innerHTML = '<div class="ov-big ok">CLEARED TO LAND</div><div class="ov-sub">Runway 26 Left</div>';
    A.setLoopGain('sfx_panic', 0.03);
    A.play('atc_final', { radio: true, gain: 0.85 });
    subtitle('TOWER: “All systems are stable. Runway two six left is yours. Bring her home.”', 5000);
    $('cockpit').classList.remove('danger'); $('cockpit').classList.add('landing');
    startLandCam();
  }
  // the landing is shown from the tower: the same scene the tower player is looking at
  let landCam = null;
  function startLandCam() {
    stopLandCam();
    try {
      if (!window.KKTower || !window.THREE) return;
      const cam = window.KKTower.start($('landCam')); if (!cam) return;
      landCam = cam; cam.setPeek(true);
      const st = { f: G.flight.seed, ph: 'flight', tl: G.total * 0.08, tot: G.total, k: G.strikes, o: [] };
      cam.setState(st); cam.state.p = 0.9;
      setTimeout(() => { if (landCam === cam) cam.setState(Object.assign({}, st, { ph: 'landing' })); }, 500);
    } catch (e) { landCam = null; }
  }
  function stopLandCam() {
    $('cockpit').classList.remove('landcam');
    if (landCam) { const c = landCam; landCam = null; setTimeout(() => { try { c.stop(); } catch (e) {} }, 1000); }
  }
  function finishLanding() {
    G.phase = 'won';
    log('Touchdown. ' + G.flight.aircraft.souls + ' souls safe.', 'good');
    A.stopLoop('sfx_panic', 0.3);
    A.play('sfx_cheer', { bus: 'sfx', gain: 0.9 });
    setTimeout(() => A.play('atc_win', { radio: true, gain: 0.85 }), 1800);
    setTimeout(() => showEnd(true), landCam ? 4200 : 2600);
  }
  function crash(why) {
    if (!G || G.phase === 'crashed') return;
    G.phase = 'crashed'; G.drunk = 0; G.smoke = 0; renderDrunk(); blink(0);
    log(why, 'bad'); log('END OF RECORDING.', 'bad');
    controllers.forEach((c) => c && c.destroy && c.destroy());
    A.stopAllLoops(0.05);
    if (!A.play('sfx_crash', { bus: 'sfx', gain: 1 })) A.sfx.boom();
    sky.jolt(2);
    const ov = $('overlay'); ov.className = 'overlay show crash'; ov.innerHTML = '';
    $('cockpit').classList.remove('danger');
    setTimeout(() => A.play('atc_lose', { radio: true, gain: 0.8 }), 2400);
    setTimeout(() => showEnd(false), 3000);
  }
  function endCleanup() {
    controllers.forEach((c) => c && c.destroy && c.destroy()); controllers = [];
    A.stopAllLoops(0.3); $('overlay').className = 'overlay'; $('cockpit').classList.remove('danger', 'landing');
  }

  function showEnd(won) {
    const a = G.flight.aircraft;
    $('cockpit').classList.remove('landing'); stopLandCam();
    show('end');
    $('end').classList.remove('won', 'lost'); $('end').classList.add(won ? 'won' : 'lost');
    A.stopAllLoops(1.5);
    $('endEyebrow').textContent = won ? 'FLIGHT KK ' + a.flight + ' · ' + a.reg : 'FLIGHT KK ' + a.flight + ' · ' + a.reg + ' · RECORDER RECOVERED';
    $('endTitle').textContent = won ? 'ON THE GROUND' : 'WE WERE FALLING';
    $('endSub').innerHTML = won
      ? '<b>' + a.souls + ' souls</b> walked away. The tower is buying the drinks.'
      : 'The black box was found in the wreckage. This is what it recorded.';
    const used = G.total - G.timeLeft;
    $('endStats').innerHTML =
      stat('RESULT', won ? 'LANDED' : 'LOST') +
      stat('FAILURES FIXED', G.solved + ' / ' + G.flight.modules.length) +
      stat('MISTAKES', G.strikes + ' / ' + KK.MAX_STRIKES) +
      stat(won ? 'TIME TO SPARE' : 'FLIGHT TIME', won ? fmtTime(G.timeLeft) : fmtTime(used)) +
      stat('CABIN', G.cabin.calmed + ' calmed · ' + G.cabin.panics + ' panic' + (G.cabin.panics === 1 ? '' : 's')) +
      stat('WHISKEY', G.sips + (G.sips === 1 ? ' sip' : ' sips')) +
      stat('CIGARETTES', G.cigs + (G.cigs === 1 ? ' drag' : ' drags')) +
      stat('MODE', KK.MODES[G.flight.mode].name) +
      stat('FLIGHT CODE', String(G.flight.seed));
    const lg = $('endLog'); lg.innerHTML = '';
    G.log.forEach((l, i) => {
      const row = document.createElement('div');
      row.className = 'lg ' + l.kind; row.style.animationDelay = Math.min(i * 0.12, 3) + 's';
      row.innerHTML = '<span>' + l.t + '</span>' + l.text;
      lg.appendChild(row);
    });
    $('overlay').className = 'overlay';
  }
  function stat(k, v) { return '<div class="st"><label>' + k + '</label><b>' + v + '</b></div>'; }

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (document.body.classList.contains('net-cover')) { /* the online lobby covers the stage: nothing to draw */ }
    else if ($('title').classList.contains('show')) {
      titleSky.state.rollTarget = Math.sin(now / 4000) * 0.08;
      if (Math.random() < dt * 0.12) titleSky.lightning();
      titleSky.draw(dt);
    } else if (G && $('cockpit').classList.contains('show')) {
      tick(dt);
      let tb = 0;
      if (G.turb > 0) { G.turb -= dt; tb = G.phase === 'flight' ? Math.min(1, G.turb / 0.8) * (G.turbP || 0) : 0; if (tb > 0) sky.jolt(tb * (0.5 + 0.5 * Math.random())); if (G.turb <= 0) G.turbP = 0; }
      if (landCam) { landCam.state.mx = Math.sin(now / 2300) * 0.03; landCam.state.my = 0; }   // a steady shot, zoomed on the runway
      const covered = landCam && G.phase !== 'flight' && G.endT > 4.6;   // the tower shot hides the cockpit: no need to draw both
      if (!covered) sky.draw(dt);
      K3.setEnabled(G.phase === 'flight');
      if (!covered) K3.frame(dt, { drunk: G.phase === 'flight' ? G.drunk : 0, roll: sky.state.roll, shake: sky.state.shake, altFt: G.phase === 'landing' ? parseInt($('hudAlt').textContent, 10) || 0 : altitude(), danger: G.phase === 'flight' && G.timeLeft < 30 ? 1 : 0, t: G.t, bottle: 1 - G.sips / MAX_SIPS, turb: tb, smoke: G.phase === 'flight' ? G.smoke : 0, cig: 1 - G.cigs / MAX_DRAGS });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function callout(key, clip, text) {
    if (G.called[key]) return; G.called[key] = true;
    A.play(clip, { gain: 0.8 }); if (text) subtitle(text, 2500);
  }

  function tick(dt) {
    G.t += dt;
    if (G.phase === 'flight') {
      G.timeLeft -= dt;
      const alt = altitude();
      sky.state.alt = G.timeLeft / G.total;
      // tension rises as the ground comes closer
      const base = G.strikes / KK.MAX_STRIKES * 0.8;
      const low = Math.max(0, 1 - G.timeLeft / 45) * 0.6;
      G.stress = Math.max(base, Math.min(1, base + low));
      if (alt <= 10000) callout('10k', 'gpws_10000');
      if (alt <= 5000) callout('5k', 'gpws_5000');
      if (alt <= 2500) callout('low', 'gpws_toolow', 'TOO LOW — TERRAIN');
      if (alt <= 1000) callout('1k', 'gpws_1000');
      if (G.timeLeft <= G.total / 2 && G.solved < G.flight.modules.length) {
        if (!G.called.mid) { G.called.mid = true; A.play('atc_mid', { radio: true, gain: 0.8 }); subtitle('TOWER: “You are dropping fast. Stay with me. One system at a time.”', 4500); }
      }
      if (G.timeLeft <= 11) {
        if (!G.called.pull || G.t - G.called.pull > 3.2) { G.called.pull = G.t; if (!A.play('gpws_pullup', { gain: 0.9 })) A.sfx.warn(); sky.jolt(0.35); }
      } else if (G.timeLeft < 30) {
        if (!G.called.wt || G.t - G.called.wt > 1.4) { G.called.wt = G.t; A.sfx.warn(); }
      }
      if (G.t > G.nextThunder) {
        G.nextThunder = G.t + 7 + Math.random() * 12;
        sky.lightning(); sky.jolt(0.3); K3.lightning();
        $('flash').classList.add('on'); setTimeout(() => $('flash').classList.remove('on'), 120);
        A.play('sfx_thunder', { bus: 'sfx', gain: 0.5 });
      }
      G.drunk = Math.max(0, G.drunk - dt / 9); G.smoke = Math.max(0, G.smoke - dt / SMOKE_CLEAR);
      if (G.smoke > 1.05 && G.t > G.coughT) { G.coughT = G.t + 4.5 + Math.random() * 3; A.sfx.cough(); sky.jolt(0.14); }
      renderDrunk(); blink(dt);
      cabinTick(dt);
      A.setLoopGain('sfx_panic', 0.05 + Math.max(G.stress, G.cabin.unrest * 0.85) * 0.4);
      renderHud();
      if (G.timeLeft <= 0) { G.timeLeft = 0; renderHud(); crash('Controlled flight into terrain. Time ran out with ' + (G.flight.modules.length - G.solved) + ' failures open.'); }
    } else if (G.phase === 'landing') {
      G.endT += dt;
      const k = Math.min(1, G.endT / 7);
      const alt = Math.round(G.landAltStart * Math.pow(1 - k, 2) / 10) * 10;
      $('hudAlt').textContent = String(alt).padStart(5, '0');
      sky.state.alt = 0.1 * (1 - k);
      if (G.endT > 3.4 && !G.called.land) { G.called.land = true; A.play('gpws_landing', { gain: 0.8 }); $('overlay').className = 'overlay'; if (landCam) $('cockpit').classList.add('landcam'); }
      const late = landCam ? 2.4 : 0;   // the tower shot stays on the roll-out a little longer; touchdown is at 7 s on every screen (tower3d.js)
      if (G.endT > 7 && !G.called.td) { G.called.td = true; sky.jolt(0.8); if (!A.play('sfx_touchdown', { bus: 'sfx', gain: 0.9 })) A.sfx.clunk(); }
      if (G.endT > 8.2 + late) finishLanding();
    }
  }

  // test hook
  // a cabin seat walked into the cockpit through the door (or left again): the pilot hears about it, and finds them standing there
  function cabinCockpit(inside, role) {
    const who = role === 'attendant' ? 'attendant' : 'saboteur', flying = !!G && G.phase === 'flight', on = !!inside && flying;
    K3.visitor(who, on);
    if (!flying) return;
    const seen = G.guests || (G.guests = {}); if (!!seen[who] === on) return; seen[who] = on;   // only a change is news
    if (who === 'attendant') { if (on) { A.sfx.click(); subtitle('THE FLIGHT ATTENDANT STEPS INTO THE COCKPIT', 3200); log('The flight attendant came into the cockpit.'); } else log('The flight attendant went back to the cabin.'); return; }
    if (on) { A.sfx.warn(); subtitle('SOMEONE IS IN THE COCKPIT', 4200); log('Somebody came through the cockpit door.'); }
    else log('The cockpit is clear again.');
  }
  // the cockpit door from the cabin side: the intruder cracked it, or the flight attendant holds it open. The cabin seats read it back from `st.dr`.
  function cabinDoor(open, role) {
    if (!G) return;
    const by = G.doorBy || (G.doorBy = {}), was = !!G.door;
    by[role === 'attendant' ? 'attendant' : 'saboteur'] = !!open;
    G.door = !!(by.attendant || by.saboteur);
    K3.setDoor(!!by.saboteur && G.phase === 'flight');
    if (G.phase !== 'flight' || was === G.door) return;
    if (G.door && by.saboteur && role !== 'attendant') { A.sfx.warn(); subtitle('THE COCKPIT DOOR HAS BEEN FORCED OPEN', 3600); log('The cockpit door was forced open from the cabin.', 'bad'); }
    else if (!G.door && role !== 'attendant') log('The cockpit door is shut again.');
  }
  // the flight attendant grabbed a passenger: the intruder (ok) or an innocent one
  function cabinCaught(ok) {
    if (!G || G.phase !== 'flight') return;
    if (ok) {
      G.timeLeft = Math.min(G.total, G.timeLeft + 15); G.cabin.unrest = Math.max(0, G.cabin.unrest - 0.25);
      A.sfx.solved(); subtitle('CABIN CREW · THE INTRUDER IS IN HANDCUFFS · +15 SECONDS', 4600); log('The flight attendant caught the intruder (+15 s).', 'good');
      G.caught = true;
    } else {
      G.cabin.unrest = Math.min(0.99, G.cabin.unrest + 0.15);
      A.sfx.warn(); subtitle('CABIN CREW · THE ATTENDANT GRABBED THE WRONG PASSENGER · THE CABIN IS UPSET', 3600); log('The flight attendant grabbed an innocent passenger.', 'bad');
    }
    renderCabin();
  }
  window.__kk = { get G() { return G; }, land, startFlight, settings, crash, K3, toTitle, music: titleMusic, cabinTask, cabinCockpit, cabinDoor, cabinCaught };
})();
