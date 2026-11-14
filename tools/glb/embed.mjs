// node embed.mjs bobble=../../meshy/bobble.glb airliner=../../meshy/airliner.glb  ->  js/models.js
// Shrinks each model (textures to 512 px JPEG/PNG, welded and simplified mesh) and embeds it as base64.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, flatten, join } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';

const OUT = new URL('../../js/models.js', import.meta.url).pathname;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const out = {};
for (const arg of process.argv.slice(2)) {
  const [name, file] = arg.split('=');
  const doc = await io.read(file);
  const tris = () => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices() ? p.getIndices().getCount() / 3 : p.getAttribute('POSITION').getCount() / 3), 0), 0);
  const before = tris();
  await MeshoptSimplifier.ready;
  await doc.transform(dedup(), flatten(), join(), weld());
  const target = 14000;
  if (tris() > target) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: target / tris(), error: 0.01 }));
  await doc.transform(textureCompress({ encoder: sharp, resize: [512, 512], targetFormat: 'jpeg', quality: 82, slots: /^(?!normalTexture).*$/ }), textureCompress({ encoder: sharp, resize: [512, 512] }), prune());
  const glb = await io.writeBinary(doc);
  out[name] = Buffer.from(glb).toString('base64');
  console.log(name, file, 'triangles', before, '->', tris(), 'bytes', fs.statSync(file).size, '->', glb.length);
}
fs.writeFileSync(OUT, '// 3D models made with Meshy, embedded so the game also runs from a file\nwindow.KK_GLB = ' + JSON.stringify(out) + ';\n');
console.log('wrote js/models.js', fs.statSync(OUT).size);
