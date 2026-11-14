/* KARA KUTU — windshield view: storm, clouds, rain, lightning, ground and runway. */
(function () {
  'use strict';
  function Sky(canvas) {
    const c = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const s = {
      alt: 1,          // 1 = cruise, 0 = ground
      roll: 0, rollTarget: 0, shake: 0, flash: 0,
      mode: 'flight',  // flight | landing | title
      landT: 0, t: 0, damage: 0,
    };
    const clouds = [];
    for (let i = 0; i < 46; i++) clouds.push(newCloud(true));
    const rain = [];
    for (let i = 0; i < 130; i++) rain.push({ x: Math.random() * W, y: Math.random() * H, l: 10 + Math.random() * 22, v: 700 + Math.random() * 600 });
    const lights = [];
    for (let i = 0; i < 160; i++) lights.push({ x: Math.random() * 2 - 1, z: Math.random(), hue: Math.random() < 0.7 ? 40 : 200, tw: Math.random() * 6 });

    function newCloud(anywhere) {
      return {
        x: Math.random() * 2.4 - 1.2, y: Math.random() * 1.6 - 0.8,
        z: anywhere ? Math.random() : 1, r: 60 + Math.random() * 120, shade: Math.random(),
      };
    }

    function draw(dt) {
      s.t += dt;
      s.roll += (s.rollTarget - s.roll) * Math.min(1, dt * 1.5);
      s.shake = Math.max(0, s.shake - dt * 1.6);
      s.flash = Math.max(0, s.flash - dt * 2.8);
      const landing = s.mode === 'landing';
      if (landing) s.landT += dt;

      const wob = Math.sin(s.t * 0.7) * 0.035 + Math.sin(s.t * 1.9) * 0.012 * (1 + s.damage * 1.5);
      const roll = s.roll + (landing ? wob * 0.3 : wob * (1 + s.damage));
      const sx = (Math.random() - 0.5) * 26 * s.shake, sy = (Math.random() - 0.5) * 20 * s.shake;

      c.save();
      c.clearRect(0, 0, W, H);
      c.translate(W / 2 + sx, H / 2 + sy);
      c.rotate(roll);
      const R = Math.hypot(W, H);

      // horizon: high altitude -> low on the screen; near the ground it rises
      const low = 1 - s.alt;
      const hy = landing ? 10 - Math.min(1, s.landT / 7) * 30 : 150 - low * 150 + Math.sin(s.t * 0.5) * 6;

      // sky
      const g = c.createLinearGradient(0, -R, 0, hy);
      const storm = landing ? 0.35 : 0.75;
      g.addColorStop(0, mix('#05070d', '#0a1424', 1 - storm));
      g.addColorStop(0.6, mix('#1a2233', '#2c4468', 1 - storm));
      g.addColorStop(1, mix('#4a4f5c', '#c8875a', landing ? 0.8 : low * 0.5));
      c.fillStyle = g; c.fillRect(-R, -R, 2 * R, R + hy);

      // ground
      const gg = c.createLinearGradient(0, hy, 0, hy + 300);
      gg.addColorStop(0, '#1b2a2a'); gg.addColorStop(1, '#070b0b');
      c.fillStyle = gg; c.fillRect(-R, hy, 2 * R, R);
      c.fillStyle = 'rgba(255,190,120,0.18)'; c.fillRect(-R, hy - 2, 2 * R, 4);

      // city lights (only visible when the ground is on screen)
      const speed = landing ? 0.5 : 0.12 + low * 0.3;
      for (const L of lights) {
        L.z -= dt * speed * (0.3 + (1 - L.z));
        if (L.z <= 0.02) { L.z = 1; L.x = Math.random() * 2 - 1; }
        const p = 1 / L.z;
        const x = L.x * 260 * p, y = hy + 6 * p * (1 + low * 2.5);
        if (y > H) continue;
        const a = Math.min(1, (1 - L.z) * 2) * (0.5 + 0.5 * Math.sin(s.t * 3 + L.tw));
        c.fillStyle = 'hsla(' + L.hue + ',90%,70%,' + a.toFixed(3) + ')';
        const sz = Math.min(5, 0.8 * p * 0.5);
        c.fillRect(x, y, sz, sz * 0.6);
      }

      // runway
      if (landing) {
        const k = Math.min(1, s.landT / 7);
        const wNear = 120 + k * 900, wFar = 16 + k * 40, yFar = hy + 2, yNear = hy + 60 + k * 400;
        c.fillStyle = '#15171b';
        c.beginPath(); c.moveTo(-wFar, yFar); c.lineTo(wFar, yFar); c.lineTo(wNear, yNear); c.lineTo(-wNear, yNear); c.closePath(); c.fill();
        for (let i = 0; i < 22; i++) {
          const z = ((i / 22 + s.t * 0.9) % 1);
          const zz = z * z;
          const y = yFar + (yNear - yFar) * zz, w = wFar + (wNear - wFar) * zz;
          c.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.65 * zz) + ')';
          c.fillRect(-w - 3, y, 3 + 5 * zz, 2 + 3 * zz); c.fillRect(w, y, 3 + 5 * zz, 2 + 3 * zz);
          if (i % 2 === 0) { c.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.5 * zz) + ')'; c.fillRect(-1 - 3 * zz, y, 2 + 6 * zz, 4 + 24 * zz); }
        }
        c.fillStyle = '#39ff88';
        for (let i = -4; i <= 4; i++) c.fillRect(i * wFar / 4, yFar - 1, 2, 2);
      }

      // clouds rushing past
      const cs = landing ? 0.1 : 0.22 + s.damage * 0.08;
      clouds.sort((a, b) => b.z - a.z);
      for (const cl of clouds) {
        cl.z -= dt * cs;
        if (cl.z <= 0.03) Object.assign(cl, newCloud(false));
        const p = 1 / cl.z;
        const x = cl.x * 300 * p, y = cl.y * 120 * p + (landing ? -160 : 0), r = cl.r * p * 0.5;
        if (r > 900) continue;
        const a = Math.min(0.5, (1 - cl.z) * 0.9) * (landing ? Math.max(0, 1 - s.landT / 3) : 1) * (0.35 + 0.65 * s.alt + 0.2);
        if (a <= 0.01) continue;
        const sh = Math.floor(40 + cl.shade * 50 + s.flash * 150);
        const rg = c.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(' + sh + ',' + (sh + 6) + ',' + (sh + 16) + ',' + a.toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(' + sh + ',' + (sh + 6) + ',' + (sh + 16) + ',0)');
        c.fillStyle = rg; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      }
      c.restore();

      // rain on the glass (screen space)
      if (!landing || s.landT < 4) {
        c.strokeStyle = 'rgba(190,210,235,0.28)'; c.lineWidth = 1.2; c.beginPath();
        for (const r of rain) {
          r.y += r.v * dt; r.x -= r.v * dt * 0.35;
          if (r.y > H || r.x < -20) { r.y = -r.l; r.x = Math.random() * (W + 200); }
          c.moveTo(r.x, r.y); c.lineTo(r.x - r.l * 0.35, r.y + r.l);
        }
        c.stroke();
      }
      if (s.flash > 0) { c.fillStyle = 'rgba(220,230,255,' + (s.flash * 0.55).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
    }

    function mix(a, b, t) {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const ch = (sh) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * Math.max(0, Math.min(1, t)));
      return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
    }

    return {
      state: s, draw,
      lightning() { s.flash = 1; },
      jolt(v) { s.shake = Math.max(s.shake, v == null ? 1 : v); },
      reset(mode) { s.mode = mode || 'flight'; s.alt = 1; s.roll = 0; s.rollTarget = 0; s.shake = 0; s.flash = 0; s.landT = 0; s.damage = 0; },
    };
  }
  window.KKSky = Sky;
})();
