/* ARE WE FALLING? — audio. Voice lines / SFX / music are ElevenLabs MP3s in audio/.
   Every sound has a procedural fallback, so the game still works if a file is missing. */
(function () {
  'use strict';
  const FILES = [
    'call_smoke', 'call_door', 'call_faint', 'call_window', 'call_injured', 'call_sparks',
    'atc_intro', 'atc_win', 'atc_lose', 'atc_mid', 'atc_final', 'mayday',
    'gpws_pullup', 'gpws_sink', 'gpws_toolow', 'gpws_10000', 'gpws_5000', 'gpws_1000', 'gpws_landing', 'gpws_strike',
    'sfx_panic', 'sfx_cheer', 'sfx_crash', 'sfx_cockpit', 'sfx_touchdown', 'sfx_thunder', 'music',
    'pax_shake', 'pax_fall', 'pax_seat', 'pax_angry', 'pa_weather', 'pa_descent', 'pa_seats', 'pa_drinks', 'whisky_sip', 'whisky_drunk',
  ];
  let ctx = null, master = null, voiceBus = null, sfxBus = null, musicBus = null;
  const buffers = {};
  const loops = {};
  let muted = false, vol = 1;
  // Opened straight from disk (file://) browsers refuse fetch(), so play through <audio> tags instead.
  const FILE_MODE = location.protocol === 'file:';
  const elLoops = {};
  function elPlay(name, gain, loopIt) {
    const el = new Audio('audio/' + name + '.mp3');
    el.volume = Math.max(0, Math.min(1, (gain == null ? 1 : gain) * (muted ? 0 : 0.9 * vol)));
    el.loop = !!loopIt; el._gain = gain == null ? 1 : gain;
    const p = el.play(); if (p && p.catch) p.catch(() => {});
    return el;
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9 * vol;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 1.0; voiceBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
    if (!FILE_MODE) FILES.forEach(load);
  }
  function load(name) {
    return fetch('audio/' + name + '.mp3')
      .then((r) => { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); })
      .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then((buf) => { buffers[name] = buf; if (pendingLoops[name]) { const p = pendingLoops[name]; delete pendingLoops[name]; loop(name, p.gain, p.bus); } })
      .catch(() => { /* fallback sounds are used instead */ });
  }
  const pendingLoops = {};
  const has = (name) => (FILE_MODE ? FILES.indexOf(name) >= 0 : !!buffers[name]);

  function play(name, opts) {
    opts = opts || {};
    if (FILE_MODE && ctx && FILES.indexOf(name) >= 0) {
      const el = elPlay(name, (opts.gain == null ? 1 : opts.gain) * (opts.bus === 'sfx' ? 0.7 : 1));
      if (opts.onend) el.onended = opts.onend;
      return { stop: () => { try { el.pause(); } catch (e) {} } };
    }
    if (!ctx || !buffers[name]) return null;
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    const g = ctx.createGain(); g.gain.value = opts.gain == null ? 1 : opts.gain;
    let node = src;
    if (opts.radio) {
      // band-limited "radio" colour
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
      const ws = ctx.createWaveShaper(); ws.curve = distCurve(6);
      src.connect(hp); hp.connect(ws); ws.connect(lp); node = lp;
    }
    node.connect(g); g.connect(opts.bus === 'sfx' ? sfxBus : opts.bus === 'music' ? musicBus : voiceBus);
    src.start();
    if (opts.onend) src.onended = opts.onend;
    return { stop: () => { try { src.stop(); } catch (e) {} }, duration: src.buffer.duration, gainNode: g };
  }
  function distCurve(k) {
    const n = 512, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    return c;
  }
  function loop(name, gain, bus) {
    if (!ctx) return;
    if (FILE_MODE) {
      if (elLoops[name]) { setLoopGain(name, gain); return; }
      if (FILES.indexOf(name) >= 0) elLoops[name] = elPlay(name, gain * (bus === 'music' ? 0.5 : 0.7), true);
      return;
    }
    if (loops[name]) { setLoopGain(name, gain); return; }
    if (!buffers[name]) { pendingLoops[name] = { gain, bus }; return; }
    const src = ctx.createBufferSource(); src.buffer = buffers[name]; src.loop = true;
    // skip the MP3 encoder padding at both ends so the loop point is not audible
    if (src.buffer.duration > 3) { src.loopStart = 0.06; src.loopEnd = src.buffer.duration - 0.08; }
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(bus === 'music' ? musicBus : sfxBus);
    src.start();
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 1.2);
    loops[name] = { src, g };
  }
  function setLoopGain(name, gain) {
    if (pendingLoops[name]) pendingLoops[name].gain = gain;
    if (elLoops[name]) { elLoops[name]._gain = gain * 0.7; elLoops[name].volume = Math.max(0, Math.min(1, gain * 0.7 * (muted ? 0 : 0.9 * vol))); return; }
    const l = loops[name]; if (!l) return;
    l.g.gain.cancelScheduledValues(ctx.currentTime);
    l.g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.6);
  }
  function stopLoop(name, fade) {
    delete pendingLoops[name];
    if (elLoops[name]) { try { elLoops[name].pause(); } catch (e) {} delete elLoops[name]; return; }
    const l = loops[name]; if (!l) return;
    delete loops[name];
    const t = ctx.currentTime + (fade == null ? 0.8 : fade);
    l.g.gain.cancelScheduledValues(ctx.currentTime);
    l.g.gain.linearRampToValueAtTime(0, t);
    try { l.src.stop(t + 0.05); } catch (e) {}
  }
  function stopAllLoops(fade) { Object.keys(loops).concat(Object.keys(pendingLoops), Object.keys(elLoops)).forEach((n) => stopLoop(n, fade)); stopDrone(); }

  // ---------- procedural sounds ----------
  function tone(freq, dur, type, gain, when, bus) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain == null ? 0.2 : gain, t0 + 0.008);
    g.gain.setValueAtTime(gain == null ? 0.2 : gain, t0 + Math.max(0.01, dur - 0.02));
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noiseBurst(dur, gain, freq, when) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (when || 0);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1800; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = gain == null ? 0.3 : gain;
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t0);
  }
  const sfx = {
    click() { noiseBurst(0.035, 0.35, 2600); tone(180, 0.03, 'square', 0.05); },
    clunk() { noiseBurst(0.09, 0.5, 500); tone(90, 0.09, 'sine', 0.25); },
    switch() { noiseBurst(0.03, 0.4, 3400); tone(240, 0.025, 'square', 0.06, 0.02); },
    crank() { noiseBurst(0.06, 0.3, 900); tone(140, 0.05, 'triangle', 0.1); },
    solved() { tone(660, 0.1, 'sine', 0.22); tone(880, 0.1, 'sine', 0.22, 0.1); tone(1320, 0.22, 'sine', 0.2, 0.2); },
    rattle(p) {   // loose panels and cups in turbulence
      p = p == null ? 1 : p; const n = 6 + Math.round(p * 12);
      for (let i = 0; i < n; i++) noiseBurst(0.045, 0.12 + 0.22 * p, 600 + Math.random() * 1500, i * 0.11 + Math.random() * 0.05);
      tone(52, 0.9 + p * 1.4, 'sawtooth', 0.07 + 0.1 * p); noiseBurst(0.8 + p * 1.2, 0.1 + 0.2 * p, 160);
    },
    lighter() { noiseBurst(0.03, 0.35, 3200); noiseBurst(0.03, 0.3, 2800, 0.09); noiseBurst(0.5, 0.07, 1100, 0.14); },
    exhale() { noiseBurst(1.1, 0.13, 620); },
    cough() { for (let i = 0; i < 3; i++) { noiseBurst(0.13, 0.4, 420 + Math.random() * 160, i * 0.22); tone(150 - i * 14, 0.09, 'sawtooth', 0.05, i * 0.22); } },
    strike() {
      tone(110, 0.5, 'sawtooth', 0.3); tone(116, 0.5, 'sawtooth', 0.3); noiseBurst(0.5, 0.5, 300);
    },
    chime() { tone(784, 0.35, 'sine', 0.2); tone(622, 0.6, 'sine', 0.2, 0.33); },
    morse(on) { /* handled by morseTone */ },
    warn() { tone(880, 0.12, 'square', 0.07); tone(660, 0.12, 'square', 0.07, 0.16); },
    tick() { tone(1200, 0.02, 'square', 0.04); },
    static(dur) { noiseBurst(dur || 0.25, 0.15, 2500); },
    boom() { // fallback crash
      noiseBurst(1.6, 1.0, 120); tone(50, 1.2, 'sine', 0.6); noiseBurst(0.4, 0.8, 1500);
    },
  };

  // sustained morse tone, gated by the radio module
  let morseOsc = null, morseGain = null;
  function morseTone(on) {
    if (!ctx) return;
    if (!morseOsc) {
      morseOsc = ctx.createOscillator(); morseOsc.type = 'sine'; morseOsc.frequency.value = 1020;
      morseGain = ctx.createGain(); morseGain.gain.value = 0;
      morseOsc.connect(morseGain); morseGain.connect(sfxBus); morseOsc.start();
    }
    morseGain.gain.setTargetAtTime(on ? 0.09 : 0, ctx.currentTime, 0.005);
  }

  // procedural engine drone (used when sfx_cockpit.mp3 is missing)
  let drone = null;
  function startDrone() {
    if (!ctx || drone) return;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.0;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 62;
    const og = ctx.createGain(); og.gain.value = 0.035;
    src.connect(lp); lp.connect(g); o.connect(og); og.connect(g); g.connect(sfxBus);
    src.start(); o.start();
    g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.5);
    drone = { src, o, g };
  }
  function stopDrone() {
    if (!drone) return;
    const d = drone; drone = null;
    d.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    try { d.src.stop(ctx.currentTime + 0.5); d.o.stop(ctx.currentTime + 0.5); } catch (e) {}
  }

  function setVolume(v) {
    vol = Math.max(0, Math.min(1, +v || 0));
    if (master) master.gain.value = muted ? 0 : 0.9 * vol;
    Object.keys(elLoops).forEach((n) => { elLoops[n].volume = muted ? 0 : Math.max(0, Math.min(1, elLoops[n]._gain * 0.9 * vol)); });
  }
  function setMuted(m) {
    muted = m; if (master) master.gain.value = m ? 0 : 0.9 * vol;
    Object.keys(elLoops).forEach((n) => { elLoops[n].volume = m ? 0 : Math.max(0, Math.min(1, elLoops[n]._gain * 0.9 * vol)); });
  }

  window.KKAudio = {
    init, play, loop, stopLoop, setLoopGain, stopAllLoops, has, sfx, morseTone, startDrone, stopDrone,
    setMuted, setVolume, getVolume: () => vol, isMuted: () => muted, ready: () => !!ctx,
  };
})();
