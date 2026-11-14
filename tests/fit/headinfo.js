const L = require('./lib.js');
(async () => {
  const s = await L.intruder({ settle: 2000 });
  const r = await s.p.evaluate(() => {
    const T = window.THREE, c = window.__cabinFit.crew[0], sk = c.mesh.skeleton, head = sk.bones.find((b) => b.name === 'Head');
    const geo = c.mesh.geometry, pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    const own = {}; head.traverse((b) => { const i = sk.bones.indexOf(b); if (i >= 0) own[i] = 1; });
    const toBone = new T.Matrix4().multiplyMatrices(sk.boneInverses[sk.bones.indexOf(head)], c.mesh.bindMatrix), v = new T.Vector3(), pts = [];
    for (let i = 0; i < pos.count; i++) { const w = (own[si.getX(i)] ? sw.getX(i) : 0) + (own[si.getY(i)] ? sw.getY(i) : 0) + (own[si.getZ(i)] ? sw.getZ(i) : 0) + (own[si.getW(i)] ? sw.getW(i) : 0); if (w > 0.5) { v.fromBufferAttribute(pos, i).applyMatrix4(toBone); pts.push([v.x, v.y, v.z]); } }
    const mm = (k) => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))].map((x) => +x.toFixed(2));
    // front surface map: for y bands (2 units) and x bands (2 units): max z
    const rows = [];
    for (let y = 30; y >= -8; y -= 2) { const row = []; for (let x = -10; x <= 10; x += 2) { const q = pts.filter((p) => Math.abs(p[0] - x) < 1 && Math.abs(p[1] - y) < 1); row.push(q.length ? Math.max(...q.map((p) => p[2])).toFixed(0).padStart(4) : '   .'); } rows.push(String(y).padStart(4) + ' |' + row.join('')); }
    return { n: pts.length, x: mm(0), y: mm(1), z: mm(2), rows, kids: head.children.map((k) => k.name + ' ' + k.position.toArray().map((a) => a.toFixed(1)).join(',')) };
  });
  console.log(JSON.stringify({ n: r.n, x: r.x, y: r.y, z: r.z, kids: r.kids }));
  console.log('   x:  -10  -8  -6  -4  -2   0   2   4   6   8  10'); r.rows.forEach((l) => console.log(l));
  await s.b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
