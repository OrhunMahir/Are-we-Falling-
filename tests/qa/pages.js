const { launch, page, log } = require('./lib.js');
(async () => {
  const b = await launch();
  for (const [u, w] of [['manual.html', 6000], ['manual.html?t3d=1', 12000], ['intruder.html?seed=1234', 25000], ['cabin.html?role=saboteur', 25000], ['cabin.html?role=attendant', 25000], ['classic.html', 3000], ['index.html', 3000]]) {
    const p = await page(b, u, u);
    await p.waitForTimeout(w);
    if (/manual/.test(u)) { await p.fill('#code', '2345').catch(() => {}); await p.waitForTimeout(800); log(u, 'code table:', ((await p.textContent('#codeOut').catch(() => '')) || '').slice(0, 160)); }
    await p.screenshot({ path: 'pg-' + u.replace(/[^\w]/g, '_') + '.png' });
    log(u, 'url now', p.url().replace(/.*8765\//, ''), 'errors:', [...new Set(p.errs)].join(' | ') || 'none');
    await p.context().close();
  }
  await b.close();
})();
