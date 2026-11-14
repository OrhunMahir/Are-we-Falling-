import { build } from 'esbuild';
import path from 'path';
await build({
  entryPoints: ['entry.js'], bundle: true, format: 'iife', minify: true, outfile: new URL('../../js/vendor/gltf.min.js', import.meta.url).pathname,
  plugins: [{ name: 'three-global', setup(b) { b.onResolve({ filter: /^three$/ }, () => ({ path: path.resolve('shim.js') })); } }],
});
console.log('ok');
