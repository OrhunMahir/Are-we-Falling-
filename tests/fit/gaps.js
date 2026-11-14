const L = require('./lib.js');
(async () => {
  const s = await L.intruder({ settle: 1200 });
  const r = await s.p.evaluate(() => {
    const T = window.THREE, sc = window.__cabin.cabin.scene, out = [], v = new T.Vector3(), seen = {};
    sc.children.forEach((o) => {
      if (!o.getObjectByName || !o.getObjectByName('facecup')) return;
      let mesh = null; o.traverse((m) => { if (m.isMesh && m.name !== 'facecup') mesh = m; });
      if (seen[mesh.geometry.uuid]) return; seen[mesh.geometry.uuid] = 1;
      o.updateMatrixWorld(true);
      const M = new T.Matrix4().copy(o.matrixWorld).invert().multiply(mesh.matrixWorld);
      const pos = mesh.geometry.attributes.position, P = [];
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(M); P.push([v.x, v.y, v.z]); }
      const H = 1.22;
      let zSole = 9; P.forEach((p) => { if (p[1] < 0.035 * H && p[2] < zSole) zSole = p[2]; });
      const zs = zSole - 0.02 * H;
      let yb = 9; P.forEach((p) => { if (p[2] < zs && p[1] < yb) yb = p[1]; });
      const hist = (pts) => { const h = {}; pts.forEach((p) => { const k = (Math.round(p[1] * 100) / 100).toFixed(2); h[k] = (h[k] || 0) + 1; }); return Object.keys(h).sort((a, b) => a - b).map((k) => k + ':' + h[k]).join(' '); };
      out.push({ verts: pos.count, zSole: +zSole.toFixed(3), zs: +zs.toFixed(3), yb: +yb.toFixed(3),
        front: hist(P.filter((p) => p[2] >= zs && p[1] < yb + 0.12 * H)), back: hist(P.filter((p) => p[2] < zs && p[1] < yb + 0.12 * H)),
        soleX: [Math.min(...P.filter((p) => p[1] < 0.03).map((p) => p[0])), Math.max(...P.filter((p) => p[1] < 0.03).map((p) => p[0]))].map((x) => +x.toFixed(3)),
        soleZ: [Math.min(...P.filter((p) => p[1] < 0.03).map((p) => p[2])), Math.max(...P.filter((p) => p[1] < 0.03).map((p) => p[2]))].map((x) => +x.toFixed(3)) });
    });
    return out;
  });
  r.forEach((m, i) => { console.log('MODEL', i, JSON.stringify({ verts: m.verts, zSole: m.zSole, zs: m.zs, yb: m.yb, soleX: m.soleX, soleZ: m.soleZ })); console.log('  front:', m.front); console.log('  back :', m.back); });
  await s.b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
