const { chromium } = require('playwright');
const ARGS = ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'];
const ROOT = (process.env.ROOT || 'http://127.0.0.1:8765') + '/';   // the game served over http; PeerServer on 127.0.0.1:9000 for the online scripts
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
async function page(b, url, name, vp) {
  const c = await b.newContext({ viewport: vp || { width: 1280, height: 720 }, permissions: ['microphone'] });
  const p = await c.newPage(); p.name = name || url; p.errs = [];
  p.on('pageerror', (e) => p.errs.push('PAGEERR ' + e.message + ' ' + (e.stack||'').split('\n')[1]));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|WebGL|GPU stall/.test(m.text())) p.errs.push('CONSOLE ' + m.text().slice(0, 300)); });
  p.on('requestfailed', (r) => { if (!/peerjs|stun|turn/.test(r.url())) p.errs.push('REQFAIL ' + r.url()); });
  p.on('response', (r) => { if (r.status() >= 400) p.errs.push('HTTP ' + r.status() + ' ' + r.url()); });
  if (url) await p.goto(ROOT + url, { timeout: 90000 });
  return p;
}
const launch = () => chromium.launch({ args: ARGS });
module.exports = { launch, page, log, ROOT };
