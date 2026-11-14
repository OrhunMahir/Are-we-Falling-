// side / front / top cuts of one passenger per model in its seat (a slab around the seat), as a sheet
const L = require('./lib.js');
const tag = process.argv[2] || 'e', extra = process.argv[3] || '';
(async () => {
  const s = await L.intruder({ settle: 2500, extra });
  await L.freeze(s.p, 1.2, 0, false);
  const list = await s.p.evaluate(() => {
    const sc = window.__cabin.cabin.scene, seen = {}, out = [];
    sc.children.forEach((o) => {
      if (!o.getObjectByName || !o.getObjectByName('facecup')) return;
      let mesh = null; o.traverse((m) => { if (m.isMesh && m.name !== 'facecup') mesh = m; });
      const k = mesh.geometry.attributes.position.count;
      (seen[k] = seen[k] || []).push({ x: o.position.x, z: o.position.z });
    });
    // prefer a seat in the middle of a block, so the neighbours show too
    Object.keys(seen).sort().forEach((k) => { const a = seen[k]; const pick = a.find((p) => Math.abs(Math.abs(p.x) - 1.04) < 0.01 && p.z > 3) || a[0]; out.push({ k: +k, x: pick.x, z: pick.z, n: a.length }); });
    return out;
  });
  console.log(JSON.stringify(list));
  const files = [];
  for (let i = 0; i < list.length; i++) {
    const m = list[i], sx = Math.sign(m.x);
    // side: look along x from the aisle side through a 0.46 slab around the seat's x
    await L.probeCam(s.p, L.cut([m.x, 0.72, m.z + 0.02], [-sx, 0, 0], 1.75, 0.47));
    await s.p.waitForTimeout(500); await s.p.screenshot({ path: L.SHOTS + '/' + tag + '-side-' + i + '.png' }); files.push(tag + '-side-' + i);
    // front: look along +z (from the front of the cabin) through a slab that holds this row only
    await L.probeCam(s.p, L.cut([m.x, 0.72, m.z + 0.05], [0, 0, -1], 1.75, 0.8));
    await s.p.waitForTimeout(500); await s.p.screenshot({ path: L.SHOTS + '/' + tag + '-front-' + i + '.png' }); files.push(tag + '-front-' + i);
  }
  await L.probeCam(s.p, null);
  console.log('errs', JSON.stringify(s.errs.filter((e) => !/deprecated|GPU stall/.test(e)).slice(0, 8)));
  await s.b.close();
  const { execFileSync } = require('child_process');
  execFileSync('python3', ['-c', `
from PIL import Image
d='${L.SHOTS}/'
names=${JSON.stringify(files)}
W,H=480,270
sheet=Image.new('RGB',(W*4,H*3))
for i,n in enumerate(names):
    im=Image.open(d+n+'.png').crop((320,0,960,720)).resize((240,270))
    sheet.paste(im,((i%8)*240,(i//8)*270))
sheet=sheet.crop((0,0,1920,540))
sheet.save(d+'${tag}-cuts.png')
`]);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
