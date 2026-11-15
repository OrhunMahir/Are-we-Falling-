/* Plain-Node harness: runs the REAL net.js + REAL vendored peerjs.min.js inside vm contexts with a stub DOM,
   a fake RTCPeerConnection (the direct path never opens = "P2P blocked") and a controllable WebSocket,
   against a local PeerServer on 127.0.0.1. No browser involved. */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const BASE = process.env.BASE || path.join(__dirname, '..', '..');
const NM = process.env.NM || path.join(BASE, 'node_modules');   // npm i ws peer (or NM=/path/to/node_modules)
const RealWS = require(path.join(NM, 'ws'));
const { PeerServer } = require(path.join(NM, 'peer'));
const PEERJS = fs.readFileSync(path.join(BASE, 'js/vendor/peerjs.min.js'), 'utf8');
const NETJS = fs.readFileSync(process.env.NETJS || path.join(BASE, 'js/net.js'), 'utf8');
const T0 = Date.now();
const ts = () => ((Date.now() - T0) / 1000).toFixed(1).padStart(5) + 's';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer(port) {
  return new Promise((res) => { const s = PeerServer({ port, host: '127.0.0.1', path: '/' }, () => res(s)); });
}

function makeBrowser(name, port, o) {
  o = o || {};
  const log = (...a) => console.log(ts(), '[' + name + ']', ...a);
  const els = {}, toasts = [], pcs = [], wsCtl = { mode: 'ok', all: [] };
  function el(id) {
    const attrs = {}, cls = new Set();
    const e = {
      id, value: '', innerHTML: '', className: '', style: {}, disabled: false, firstChild: null, contentWindow: null, onclick: null,
      classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: (c, v) => { if (v === undefined ? !cls.has(c) : v) cls.add(c); else cls.delete(c); }, contains: (c) => cls.has(c) },
      addEventListener() {}, appendChild() {}, insertBefore() {}, blur() {}, querySelectorAll() { return []; },
      setAttribute(k, v) { attrs[k] = v; }, getAttribute(k) { return k in attrs ? attrs[k] : null; },
    };
    let text = '';
    Object.defineProperty(e, 'textContent', { get: () => text, set: (v) => { text = v; if (id === 'netToast') { toasts.push(v); log('TOAST:', v); } } });
    return e;
  }
  const doc = { getElementById: (id) => els[id] || (els[id] = el(id)), createElement: () => el(''), body: el('body'), querySelector: () => null, addEventListener() {} };
  class FakePC extends EventTarget {
    constructor() {
      super(); this.signalingState = 'stable'; this.iceConnectionState = 'new'; this.closed = false; this.born = Date.now(); pcs.push(this);
      if (o.iceFailAfter) this._t = setTimeout(() => { if (!this.closed) { this.iceConnectionState = 'failed'; if (this.oniceconnectionstatechange) this.oniceconnectionstatechange(); } }, o.iceFailAfter);
    }
    createDataChannel(label, c) { return { label, ordered: !!(c && c.ordered), readyState: 'connecting', close() {}, addEventListener() {}, send() {} }; }
    async createOffer() { return { type: 'offer', sdp: 'v=0\r\n' }; }
    async createAnswer() { return { type: 'answer', sdp: 'v=0\r\n' }; }
    async setLocalDescription(d) { this.localDescription = d; }
    async setRemoteDescription(d) { this.remoteDescription = d; }
    async addIceCandidate() {}
    addTrack() {} addTransceiver() {} getStats() { return Promise.resolve(new Map()); } getSenders() { return []; } getReceivers() { return []; }
    close() { this.closed = true; this.signalingState = 'closed'; clearTimeout(this._t); }
  }
  class WS {
    constructor(url) {
      this.url = url; this.readyState = 0; wsCtl.all.push(this); this.sent = [];
      if (wsCtl.mode === 'refuse') { setTimeout(() => { this.readyState = 3; if (this.onclose) this.onclose({ code: 1006 }); }, 80); return; }
      if (wsCtl.mode === 'hang') return;   // stays CONNECTING for ever (black-holed network)
      const w = this._ws = new RealWS(url);
      w.on('open', () => { this.readyState = 1; if (this.onopen) this.onopen(); });
      w.on('message', (d) => { if (this.onmessage) this.onmessage({ data: d.toString() }); });
      w.on('close', () => { this.readyState = 3; if (this.onclose) this.onclose({ code: 1006 }); });
      w.on('error', () => {});
    }
    send(d) { this.sent.push(d); if (this._ws && this._ws.readyState === 1) this._ws.send(d); }
    close() { this.readyState = 3; if (this._ws) this._ws.close(); }
    kill() { if (this._ws) this._ws.terminate(); }
    mute() { const w = this._ws; this._ws = null; this._muted = w; if (w) w.removeAllListeners('message'); }   // half-open: looks open, nothing flows   // the network cuts the socket
    zombie() { const w = this._ws; this._ws = null; this.readyState = 3; this._zombie = w; if (w) w.removeAllListeners('message'); if (this.onclose) this.onclose({ code: 1006 }); }   // only the browser side sees the cut; the server keeps the old socket
  }
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, EventTarget, Event, URL, URLSearchParams, TextEncoder, TextDecoder, fetch: (...a) => new Promise((r) => setTimeout(r, o.fetchDelay || 0)).then(() => fetch(...a)),
    document: doc, location: { search: '?peer=127.0.0.1:' + port + (o.search || ''), protocol: 'http:', hostname: '127.0.0.1' },
    localStorage: { getItem: () => null, setItem() {} },
    navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', platform: 'Linux' },
    RTCPeerConnection: FakePC, RTCSessionDescription: function (d) { return d; }, RTCIceCandidate: function (d) { return d; },
    WebSocket: WS, Audio: function () { return { play() {}, pause() {} }; },
    KK: { MODES: { short: { name: 'SHORT', desc: '' } }, MAX_STRIKES: 3 }, __kk: { settings: { mode: 'short' }, music() {}, startFlight() {}, G: null },
    addEventListener() {},
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(PEERJS, ctx, { filename: 'peerjs.min.js' });
  vm.runInContext(NETJS, ctx, { filename: 'net.js' });
  const K = sandbox.KKNet, N = K.state;
  const b = {
    name, K, N, toasts, pcs, wsCtl, els, log, sandbox, click: (id) => doc.getElementById(id).onclick(),
    liveWS: () => wsCtl.all.filter((w) => w.readyState === 1),
    openPCs: () => pcs.filter((p) => !p.closed).length,
    snap: (label) => log(label + ':', JSON.stringify({ view: N.view, status: N.status, error: N.error, code: N.code, isHost: N.isHost, members: N.members.length, peerId: N.peer ? N.peer.id : undefined, disc: N.peer ? N.peer.disconnected : undefined, open: N.peer ? N.peer.open : undefined, rooms: Object.keys(N.rooms).map((r) => N.rooms[r].s[0]).join(''), openPCs: pcs.filter((p) => !p.closed).length })),
    /* resolves when N.error or view==='room' or timeout; reports elapsed */
    async waitOutcome(maxMs) { const t = Date.now(); while (Date.now() - t < maxMs) { if (N.error || N.view === 'room') break; await sleep(50); } return { ms: Date.now() - t, error: N.error, view: N.view }; },
  };
  return b;
}
module.exports = { startServer, makeBrowser, sleep, ts };
