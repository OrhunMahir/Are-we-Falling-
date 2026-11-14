// underside / back / width profiles of the six Meshy passengers in figure space (group-local: feet y=0, front +Z), as placed today (1.22 m)
const L = require('./lib.js');
(async () => {
  const s = await L.intruder({ settle: 1500 });
  const r = await s.p.evaluate(() => {
    const T = window.THREE, sc = window.__cabin.cabin.scene, out = [];
    const v = new T.Vector3(), seen = {};
    sc.children.forEach((o) => {
      if (!o.getObjectByName || !o.getObjectByName('facecup')) return;
      let mesh = null; o.traverse((m) => { if (m.isMesh && m.name !== 'facecup') mesh = m; });
      if (seen[mesh.geometry.uuid]) return; seen[mesh.geometry.uuid] = 1;
      o.updateMatrixWorld(true);
      const M = new T.Matrix4().copy(o.matrixWorld).invert().multiply(mesh.matrixWorld);
      const pos = mesh.geometry.attributes.position, P = [];
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(M); P.push([v.x, v.y, v.z]); }
      const mm = (k) => [Math.min(...P.map((p) => p[k])), Math.max(...P.map((p) => p[k]))].map((x) => +x.toFixed(3));
      const zs = [], ys = [];
      for (let z = -0.45; z < 0.5; z += 0.05) { const q = P.filter((p) => p[2] >= z && p[2] < z + 0.05); zs.push(q.length ? [+z.toFixed(2), +Math.min(...q.map((p) => p[1])).toFixed(3), +Math.max(...q.map((p) => p[1])).toFixed(3), +Math.max(...q.map((p) => Math.abs(p[0]))).toFixed(3), q.length] : [+z.toFixed(2)]); }
      for (let y = 0; y < 1.25; y += 0.05) { const q = P.filter((p) => p[1] >= y && p[1] < y + 0.05); ys.push(q.length ? [+y.toFixed(2), +Math.min(...q.map((p) => p[2])).toFixed(3), +Math.max(...q.map((p) => p[2])).toFixed(3), +Math.min(...q.map((p) => p[0])).toFixed(3), +Math.max(...q.map((p) => p[0])).toFixed(3), q.length] : [+y.toFixed(2)]); }
      const cup = o.getObjectByName('facecup');
      out.push({ verts: pos.count, idx: mesh.geometry.index ? mesh.geometry.index.count : 0, x: mm(0), y: mm(1), z: mm(2), zs, ys, cup: cup.position.toArray().map((x) => +x.toFixed(3)), mat: mesh.material.type, side: mesh.material.side, attrs: Object.keys(mesh.geometry.attributes), meshName: mesh.name });
    });
    return out;
  });
  r.forEach((m, i) => {
    console.log('=== MODEL', i, 'verts', m.verts, 'idx', m.idx, 'x', m.x, 'y', m.y, 'z', m.z, 'cup', m.cup, m.mat, 'side', m.side, m.attrs.join(','), m.meshName);
    console.log('  by z: [z0, minY, maxY, max|x|, n]'); m.zs.forEach((a) => console.log('   ', JSON.stringify(a)));
    console.log('  by y: [y0, zBack, zFront, xmin, xmax, n]'); m.ys.forEach((a) => console.log('   ', JSON.stringify(a)));
  });
  console.log('errs', s.errs.slice(0, 5));
  await s.b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
