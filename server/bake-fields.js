'use strict';
const { gzipSync } = require('node:zlib');

function packGrid(values, columns, bytes) {
  const count = values.length;
  const packed = Buffer.allocUnsafe(count * bytes);
  for (let i = 0; i < count; i++) {
    const column = i % columns;
    const left = column ? values[i - 1] : 0;
    const above = i >= columns ? values[i - columns] : 0;
    const diagonal = i >= columns && column ? values[i - columns - 1] : 0;
    const delta = values[i] - left - above + diagonal;
    for (let lane = 0; lane < bytes; lane++) packed[lane * count + i] = delta >>> (lane * 8);
  }
  return packed;
}

function bakeFields() {
  const world = {};
  for (const install of [
    require('../assets/archipelago'),
    require('../assets/archipelago-relief'),
    require('../assets/simulation/terrain'),
    require('../assets/water-depth'),
    require('../assets/wind-field')
  ]) install(world);
  const { width, data } = world.SailingWaterDepth;
  const rgba = data();
  const depth = Uint16Array.from({ length: rgba.length / 4 }, (_, i) => rgba[i * 4] * 256 + rgba[i * 4 + 1]);
  const { land, relief, cover, w: windWidth } = world.SailingWind.groundRaster();
  // Predict adjacent samples and group byte lanes so gzip can compress them.
  // The wind raster uses the original Float32 bits throughout this process.
  const wind = array => packGrid(new Uint32Array(array.buffer), windWidth, 4);
  const arrays = Buffer.concat([packGrid(depth, width, 2), land, wind(relief), wind(cover)]);
  const packed = gzipSync(arrays, { level: 9 });
  const loader = `/* Exact depth and land samples generated from the simulation's world. */
{
  const url = new URL('archipelago-fields.bin', globalThis.document?.currentScript.src ?? self.location.href);
  globalThis.TackArchipelagoFieldsReady = (async () => {
    const response = await fetch(url);
    if (!response.ok || !response.body) throw Error('Kunne ikke hente øhavets dybde- og terrændata.');
    performance.mark('tack-fields-response');
    const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
    const raw = await new Response(stream).arrayBuffer();
    if (raw.byteLength !== ${arrays.byteLength}) throw Error('Øhavets dybde- og terrændata er ufuldstændige.');
    performance.mark('tack-fields-decompressed');
    const packed = new Uint8Array(raw);
    const readGrid = (offset, columns, bytes, values) => {
      const count = values.length;
      for (let i = 0; i < count; i++) {
        const column = i % columns;
        const left = column ? values[i - 1] : 0;
        const above = i >= columns ? values[i - columns] : 0;
        const diagonal = i >= columns && column ? values[i - columns - 1] : 0;
        let delta = 0;
        for (let lane = 0; lane < bytes; lane++) delta |= packed[offset + lane * count + i] << (lane * 8);
        values[i] = delta + left + above - diagonal;
      }
      return values;
    };
    const values = readGrid(0, ${width}, 2, new Uint16Array(${depth.length}));
    const depth = new Uint8Array(values.length * 4);
    for (let i = 0; i < values.length; i++) {
      depth[i * 4] = values[i] >>> 8;
      depth[i * 4 + 1] = values[i] & 255;
      depth[i * 4 + 3] = 255;
    }
    const land = new Uint8Array(raw, ${depth.byteLength}, ${land.length});
    const wind = offset => new Float32Array(readGrid(offset, ${windWidth}, 4, new Uint32Array(land.length)).buffer);
    const relief = wind(${depth.byteLength + land.length});
    const cover = wind(${depth.byteLength + land.length + relief.byteLength});
    globalThis.TackArchipelagoFields = { depth, wind: { land, relief, cover } };
    performance.mark('tack-fields-ready');
  })().catch(error => { globalThis.TackArchipelagoFieldsError = error; });
}
`;
  return { packed, loader };
}

module.exports = { bakeFields };
