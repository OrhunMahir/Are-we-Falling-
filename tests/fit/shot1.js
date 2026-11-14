// first look: fit numbers + a few views of the cabin (aisle forward/back, a row from the side, a seat neighbour)
const L = require('./lib.js');
const tag = process.argv[2] || 'a', extra = process.argv[3] || '';
(async () => {
  const s = await L.intruder({ settle: 2500, extra });
  const info = await s.p.evaluate(() => { const f = window.__cabinFit; return f ? { models: f.models, pax: f.pax.length, crew: f.crew.map((c) => ({ name: c.name, idle: c.idle ? c.idle.length : 0, face: !!c.face })), err: f.err ? String(f.err.stack || f.err) : null } : null; });
  console.log(JSON.stringify(info, null, 1).replace(/\n\s+/g, ' ').replace(/\} \{/g, '}\n{'));
  await L.freeze(s.p, 6.3, 0, false);
  await L.view(s.p, tag + '-aisle-back', 0, 1.6, Math.PI, -0.12);          // from the front galley looking down the cabin
  await L.view(s.p, tag + '-aisle-fwd', 0, 9.0, 0, -0.1);                   // from the rear looking forward (backs of the seats)
  await L.view(s.p, tag + '-row-side', 0, 4.25, Math.PI / 2, -0.35);         // looking sideways across a row from the aisle
  await L.view(s.p, tag + '-row-side2', 0, 5.9, -Math.PI / 2, -0.35);
  await L.view(s.p, tag + '-row-down', 0, 5.1, Math.PI * 0.75, -0.75);
  await L.view(s.p, tag + '-att', 0, 4.6, Math.PI, -0.15);                    // the attendant standing in the aisle 1.7 m away
  console.log('errs', JSON.stringify(s.errs.filter((e) => !/deprecated|GPU stall/.test(e)).slice(0, 8)));
  await s.b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
