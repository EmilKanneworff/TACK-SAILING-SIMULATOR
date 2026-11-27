/* Local glTF subset used by scripts/prepare-laser.py. The original art is
   embedded to keep the same entry point on HTTP and file://. */
(function (global) {
  'use strict';

  let model;
  function read(T) {
    const source = global.TackLaserGlb;
    if (!source) return null;
    const decoded = global.atob(source);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    const header = new DataView(bytes.buffer);
    if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 ||
        header.getUint32(8, true) !== bytes.length) throw Error('Ugyldig Laser-model');
    const jsonEnd = 20 + header.getUint32(12, true);
    const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, jsonEnd)));
    const bufferStart = jsonEnd + 8;

    function attribute(id, size) {
      const accessor = gltf.accessors[id], view = gltf.bufferViews[accessor.bufferView];
      const type = { 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[accessor.componentType];
      if (!type || view.byteStride || accessor.sparse) throw Error('Ikke-understøttet Laser-geometri');
      const values = new type(bytes.buffer, bufferStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0),
        accessor.count * size);
      return new T.BufferAttribute(values, size);
    }

    const parts = {};
    for (const node of gltf.nodes) {
      if (node.mesh === undefined) continue;
      if (node.translation || node.rotation || node.scale) throw Error('Laser-mesh skal være eksporteret i lokale koordinater');
      parts[node.name] = gltf.meshes[node.mesh].primitives.map(primitive => {
        const geometry = new T.BufferGeometry(), attributes = primitive.attributes;
        geometry.setAttribute('position', attribute(attributes.POSITION, 3));
        geometry.setAttribute('normal', attribute(attributes.NORMAL, 3));
        if (attributes.TEXCOORD_0 !== undefined) geometry.setAttribute('uv', attribute(attributes.TEXCOORD_0, 2));
        geometry.setIndex(attribute(primitive.indices, 1));
        geometry.userData.sharedGraphics = true;
        return { geometry, finish: gltf.materials[primitive.material] };
      });
    }
    if (!['Hull','Deck','Fittings','Vest'].every(name => parts[name]?.length)) throw Error('Laser-modellen mangler dele');
    delete global.TackLaserGlb;
    return parts;
  }

  function available(T) {
    if (model !== undefined) return !!model;
    try { model = read(T); }
    catch (error) {
      model = null;
      console.warn('TACK bruger reservegrafik til Laserjollen.', error.message);
    }
    return !!model;
  }

  function create(T, name, maps = {}) {
    const group = new T.Group();
    group.name = 'Laser · ' + name;
    for (const { geometry, finish } of model[name]) {
      const pbr = finish.pbrMetallicRoughness;
      const material = new T.MeshStandardMaterial({
        color: new T.Color().fromArray(pbr.baseColorFactor),
        roughness: pbr.roughnessFactor,
        metalness: pbr.metallicFactor,
        // Closed surfaces have outward normals. The thin textured deck pads
        // are top-facing and do not need a second face.
        envMapIntensity: name === 'Vest' ? .26 : .52
      });
      if (finish.name === 'Deck grip') {
        material.bumpMap = maps.deck;
        material.bumpScale = .002;
      }
      if (name === 'Vest' && /^Vest/.test(finish.name) && maps.fabric) {
        material.normalMap = maps.fabric;
        material.normalScale.set(.18, .18);
      }
      material.name = finish.name;
      const mesh = new T.Mesh(geometry, material);
      mesh.name = finish.name;
      mesh.castShadow = name !== 'Fittings';
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  global.TackLaserDetail = { available, create };
})(globalThis);
