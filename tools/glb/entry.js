import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
window.THREE.GLTFLoader = GLTFLoader;
// KKModels.load('bobble', cb): parses a model embedded as base64 in js/models.js (works from file:// too)
window.KKModels = {
  // scale the model so its longest side is `size`, centre it and put its underside on y = 0
  fit(m, size, yaw) {
    const T = window.THREE; m.rotation.y = yaw || 0; m.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(m), d = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3()), k = size / Math.max(d.x, d.y, d.z);
    m.scale.multiplyScalar(k); m.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    m.traverse((o) => { if (o.material && o.material.metalness !== undefined) { o.material.metalness = Math.min(o.material.metalness, 0.15); o.material.roughness = Math.max(o.material.roughness, 0.55); } });
    const g = new T.Group(); g.add(m); return g;
  },
  has(name) { return !!(window.KK_GLB && window.KK_GLB[name]); },
  load(name, cb) {
    try {
      const b64 = window.KK_GLB && window.KK_GLB[name]; if (!b64) return false;
      const bin = atob(b64), n = bin.length, buf = new Uint8Array(n);
      for (let i = 0; i < n; i++) buf[i] = bin.charCodeAt(i);
      new GLTFLoader().parse(buf.buffer, '', (g) => { try { cb(g.scene); } catch (e) { console.warn('model ' + name, e); } }, (e) => console.warn('model ' + name, e));
      return true;
    } catch (e) { console.warn('model ' + name, e); return false; }
  },
};
