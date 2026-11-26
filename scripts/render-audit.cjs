'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('@playwright/test');
const { changeScene, setupFleet } = require('./render-performance.cjs');

function installAudit(light) {
  const request = window.requestAnimationFrame.bind(window);
  let game, view, renderer, gl, timer, row, rows, previous, lastDraw, frozen = false;
  let parent, groups, passes, thaw, disjoint = 0;
  const sequence = {};
  const pending = [];
  let controls;

  function wrap(fn, name) {
    return function (...args) {
      if (!row) return fn.apply(this, args);
      const container = parent;
      const entry = { children: 0 };
      parent = entry;
      const start = performance.now();
      try {
        return fn.apply(this, args);
      } finally {
        const duration = performance.now() - start;
        parent = container;
        if (container) container.children += duration;
        const cost = row.cpu[name] ??= { inclusive: 0, own: 0, count: 0 };
        cost.inclusive += duration;
        cost.own += Math.max(0, duration - entry.children);
        cost.count++;
      }
    };
  }

  function wrapMethods(target, scopes) {
    for (const [key, name] of Object.entries(scopes)) {
      if (typeof target?.[key] === 'function') target[key] = wrap(target[key], name);
    }
  }

  function collect() {
    if (!timer || !pending.length) return;
    const invalid = gl.getParameter(timer.GPU_DISJOINT_EXT);
    for (let i = pending.length - 1; i >= 0; i--) {
      const { query, dest, key } = pending[i];
      if (!invalid && !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue;
      if (invalid) disjoint++;
      else dest[key] = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(query);
      pending.splice(i, 1);
    }
  }

  function gpu(draw, dest, key) {
    if (!timer || pending.length >= 16 || gl.getQuery(timer.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) return draw();
    const query = gl.createQuery();
    gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
    try {
      return draw();
    } finally {
      gl.endQuery(timer.TIME_ELAPSED_EXT);
      pending.push({ query, dest, key });
    }
  }

  function pass() {
    const target = renderer.getRenderTarget();
    if (!target) return 'main';
    if (target === view.hullWater.target) return 'reflection';
    if (target === view.sun.shadow.map) return 'shadow';
    return 'otherTarget';
  }

  const frame = (timestamp, callback) => {
    if (frozen) {
      request(time => frame(time, callback));
      return;
    }
    collect();
    if (!rows) return callback(timestamp);
    renderer.info.reset();
    row = { interval: previous === undefined ? null : timestamp - previous, cpu: {}, gpu: {} };
    previous = timestamp;
    const start = performance.now();
    try {
      callback(timestamp);
    } finally {
      row.cpuMs = performance.now() - start;
      const { calls, triangles } = renderer.info.render;
      if (calls) {
        row.drawInterval = lastDraw === undefined ? null : timestamp - lastDraw;
        lastDraw = timestamp;
        row.tier = view.graphicsProfile.id;
      }
      Object.assign(row, { calls, triangles, debtMs: game.simulationDebt * 1000, time: game.state.time });
      const budget = game.performanceBudget;
      if (budget) {
        row.cpuDetail = budget.cpuDetail;
        row.bottleneck = budget.load;
      }
      rows.push(row);
      row = null;
    }
  };
  window.requestAnimationFrame = callback => request(callback.name === 'frame' ? time => frame(time, callback) : callback);

  function install() {
    game = SAILING_GAME;
    view = game.scene;
    renderer = view.renderer;
    renderer.info.autoReset = false;
    gl = renderer.getContext();
    timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    if (light) return { renderer: gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
      gpuTimer: Boolean(timer), three: THREE.REVISION, light: true };
    wrapMethods(Object.getPrototypeOf(view), {
      update: 'sceneUpdate', buildBoat: 'boatBuild', resize: 'resize',
      updateBoat: 'boatAnimation', updateEffects: 'wakeUpdate', writeFoamRibbon: 'wakeGeometry',
      updateContactFoam: 'contactFoam', updateSprayGeometry: 'spray', updateWaterSamples: 'waterSamples',
      posePerson: 'crewPose', animatedCrewPose: 'crewMotion', updateFoilSailGrid: 'foilSailGrid',
      updateAtmosphere: 'lighting', updateRain: 'precipitation', updateSceneRange: 'terrainRange',
      buildCoastTreeSector: 'treeBuild', updateShoreFoam: 'shoreFoam',
      updateCamera: 'camera', updateWindStrokes: 'windArrows', updateMarks: 'raceMarks',
      setGraphicsProfile: 'graphicsProfile'
    });
    wrapMethods(view.hullWater, { sample: 'hullWaterContact', publish: 'hullWaterPublish',
      updateSurface: 'hullWaterGrid', reflect: 'mirrorSetup' });
    wrapMethods(view.surfaceFoam, { update: 'surfaceFoam' });
    wrapMethods(FriVindLobby, { render: 'lobbyRender', step: 'lobbyStep' });
    wrapMethods(FriVindLobby.fleet, { render: 'fleetGraphics', step: 'fleetPhysics' });
    wrapMethods(game.map, { update: 'map' });
    wrapMethods(TackSimulation.physics, { waveExposureField: 'waveExposure', wavePathField: 'wavePath' });
    const render = renderer.render;
    const submit = {
      main: wrap(render, 'mainSubmit'),
      reflection: wrap(render, 'mirrorSubmit')
    };
    renderer.render = function (...args) {
      const key = pass();
      if (!row) return render.apply(this, args);
      const fn = submit[key] || render;
      const draw = () => fn.apply(this, args);
      sequence[key] = (sequence[key] || 0) + 1;
      return sequence[key] % 2 ? gpu(draw, row.gpu, key) : draw();
    };
    return {
      renderer: gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
      gpuTimer: Boolean(timer),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      context: gl.getContextAttributes(), three: THREE.REVISION
    };
  }

  function tagObject(root, name) {
    if (root) root.traverse(o => groups.set(o, name));
  }

  function tagBoat(boat, prefix) {
    tagObject(boat.boatRoot, prefix + 'HullRig');
    for (const key of ['sailMesh', 'sailSkinMesh', 'jibMesh', 'wingMain', 'wingFlap',
      'spinnakerMesh', 'extraSailMesh', 'sailEdge', 'jibEdge', 'wingHinge', 'wingLeadingEdge']) {
      tagObject(boat[key], prefix + 'Sails');
    }
    for (const child of boat.hull?.children || []) {
      if (child.children.some(o => o.name === 'crew-torso')) tagObject(child, prefix + 'Crew');
    }
  }

  function inventory() {
    groups = new WeakMap();
    tagObject(view.coast, 'coastalFixtures');
    for (const root of [...view.coastTerrain, ...view.terrainRegions.map(region => region.merged), view.farCoast]) {
      tagObject(root, 'terrain');
    }
    tagObject(view.coastDecorations, 'trees');
    tagObject(view.shoreFoam, 'shoreFoam');
    tagBoat(view, 'local');
    const actorIds = new WeakMap();
    for (const [id, boat] of FriVindLobby.fleet.actors) {
      tagBoat(boat, 'remote');
      boat.boatRoot.traverse(o => actorIds.set(o, id));
    }
    for (const boat of FriVindLobby.fleet.silhouettes.values()) tagObject(boat.root, 'remoteLOD');
    for (const [key, name] of Object.entries({
      water: 'water', sky: 'sky', sunSprite: 'sky', birds: 'weather', rainLines: 'weather',
      wakeMesh: 'wake', fleetWakeMesh: 'wake', contactFoam: 'contactFoam', foamPoints: 'spray',
      breakingFoam: 'breakingFoam', windStrokeMesh: 'windArrows', markGroup: 'marks'
    })) tagObject(view[key], name);

    passes = {};
    const drawnActors = new Set();
    const direct = renderer.renderBufferDirect;
    renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      const info = renderer.info.render;
      const before = [info.calls, info.triangles, info.points, info.lines];
      const target = pass();
      direct.call(this, camera, scene, geometry, material, object, group);
      const bag = passes[target] ??= {};
      const counts = bag[groups.get(object) || 'other'] ??= {};
      const id = actorIds.get(object);
      if (target === 'main' && id && info.calls > before[0]) drawnActors.add(id);
      for (const [i, key] of ['calls', 'triangles', 'points', 'lines'].entries()) {
        counts[key] = (counts[key] || 0) + info[key] - before[i];
      }
    };
    try {
      renderer.info.reset();
      view.hullWater.lastReflection = -Infinity;
      view.hullWater.reflect(game.state, game.env);
      view.render();
      const { calls, triangles, points, lines } = renderer.info.render;
      return { passes, total: { calls, triangles, points, lines }, drawnActors: [...drawnActors].sort() };
    } finally {
      renderer.renderBufferDirect = direct;
    }
  }

  async function layers() {
    if (!timer) return null;
    const water = view.water;
    const basic = new THREE.MeshBasicMaterial({ color: '#315761' });
    const collectGroup = pattern => {
      const objects = [];
      view.scene.traverse(o => {
        if (o.visible && (o.isMesh || o.isPoints || o.isLine || o.isSprite) && pattern.test(groups.get(o) || '')) {
          objects.push(o);
        }
      });
      return objects;
    };
    const variants = {
      reference: {},
      waterBasic: { material: basic },
      noWater: { objects: [water] },
      noSky: { objects: collectGroup(/^sky$/) },
      noLand: { objects: [view.coast, view.farCoast] },
      noCrew: { objects: collectGroup(/Crew$/) },
      noBoats: { objects: collectGroup(/^(local|remote)/) },
      noSurfaceEffects: { objects: collectGroup(/^(wake|contactFoam|spray|breakingFoam|windArrows|shoreFoam|marks)$/) },
      noWeatherParticles: { objects: collectGroup(/^weather$/) },
      noWaterRain: { dryWater: true },
      shorterHorizon: { far: 1500 }
    };
    if (renderer.shadowMap.enabled) variants.shadowPass = { shadowOnly: true };
    const results = Object.fromEntries(Object.keys(variants).map(key => [key, []]));
    const original = water.material;
    const rain = view.waterUniforms.rain.value;
    const far = view.camera.far;
    const shadow = renderer.shadowMap.render;
    function setFar(value) {
      if (value === view.camera.far) return;
      view.camera.far = value;
      view.camera.updateProjectionMatrix();
    }
    try {
      // Alternate cases to reduce systematic effects from shader warm-up and clock changes.
      for (let sample = 0; sample < 18; sample++) {
        const names = Object.keys(variants);
        const ordered = [...names.slice(sample % names.length), ...names.slice(0, sample % names.length)];
        for (const name of ordered) {
          const config = variants[name];
          const objects = config.objects?.filter(o => o?.visible) || [];
          for (const object of objects) object.visible = false;
          water.material = config.material || original;
          view.waterUniforms.rain.value = config.dryWater ? 0 : rain;
          setFar(config.far ?? far);
          const dest = {};
          try {
            await new Promise(resolve => request(() => {
              collect();
              if (config.shadowOnly) {
                renderer.shadowMap.render = function (...args) {
                  return gpu(() => shadow.apply(this, args), dest, 'ms');
                };
                view.render();
              } else {
                gpu(() => view.render(), dest, 'ms');
              }
              resolve();
            }));
          } finally {
            renderer.shadowMap.render = shadow;
            for (const object of objects) object.visible = true;
            water.material = original;
          }
          if (sample >= 4) results[name].push(dest);
        }
      }
      for (let i = 0; pending.length && i < 30; i++) await new Promise(resolve => request(() => { collect(); resolve(); }));
      return Object.fromEntries(Object.entries(results).map(([key, samples]) => [key, samples.map(r => r.ms).filter(Number.isFinite)]));
    } finally {
      view.waterUniforms.rain.value = rain;
      setFar(far);
      basic.dispose();
    }
  }

  window.tackAudit = {
    wrap, install, inventory, layers,
    timing(callback, name) { return light ? callback : wrap(callback, name); },
    control(input, time) {
      if (!controls) return input;
      const command = controls.findLast(part => time >= part.time);
      return { ...input, ...command };
    },
    useControls(value) { controls = value; },
    traceGraphics() {
      const methods = {
        compileShader: 'compileShader', linkProgram: 'linkProgram',
        getProgramParameter: 'getProgramParameter', getActiveUniform: 'getActiveUniform',
        getActiveAttrib: 'getActiveAttrib', getUniformLocation: 'getUniformLocation',
        texImage2D: 'texImage2D', texStorage2D: 'texStorage2D', texSubImage2D: 'texSubImage2D',
        bufferData: 'bufferData', bufferSubData: 'bufferSubData'
      };
      const original = Object.fromEntries(Object.keys(methods).map(name => [name, gl[name]]));
      wrapMethods(gl, methods);
      this.stopGraphicsTrace = () => Object.assign(gl, original);
    },
    begin() {
      previous = lastDraw = undefined;
      rows = [];
      return { wall: performance.now(), simulated: game.state.time, debtMs: game.simulationDebt * 1000, disjoint };
    },
    async end(start) {
      const data = rows;
      rows = null;
      const wallMs = performance.now() - start.wall;
      const simulatedMs = (game.state.time - start.simulated) * 1000;
      const { geometries, textures } = renderer.info.memory;
      const snapshot = { wallMs, simulatedMs, geometries, textures, programs: renderer.info.programs.length,
        debtStartMs: start.debtMs, debtEndMs: game.simulationDebt * 1000,
        size: [renderer.domElement.width, renderer.domElement.height], tier: view.graphicsProfile.id,
        reflectionSize: [view.hullWater.target.width, view.hullWater.target.height],
        activeLand: view.coastTerrain.filter(o => o.visible).length,
        activeTreeSectors: view.coastDecorations.children.filter(o => o.visible).length,
        waterTriangles: view.water.geometry.index.count / 3, cameraHeight: view.camera.position.y,
        x: game.state.x, y: game.state.y, heading: game.state.theta,
        speed: Math.hypot(game.state.vx, game.state.vy), grounded: Boolean(game.state.ground?.contact),
        boat: game.state.boatId, disjoint: disjoint-start.disjoint, wave: game.env.waveHeight, rain: game.env.rain,
        remoteIds: [...FriVindLobby.fleet.actors.keys()], hasTouch: matchMedia('(pointer: coarse)').matches };
      for (let i = 0; pending.length && i < 20; i++) await new Promise(resolve => request(() => { collect(); resolve(); }));
      return { data, snapshot };
    },
    setThawHook(hook) { thaw = hook; },
    freeze(value) {
      if (frozen && !value) thaw();
      frozen = value;
    }
  };
}

const open = { x: -1900, y: -2170, heading: -.45, speed: 4, camera: 0 };
const stages = [
  { name: 'havn', boat: 'laser', x: 4, y: -47, heading: -1.5, speed: 2, camera: 0, isolate: true },
  { ...open, name: 'laser', boat: 'laser', isolate: true },
  { ...open, name: 'racer', boat: 'dinghy' },
  { ...open, name: 'turbaad', boat: 'yacht' },
  { ...open, name: 'monohull', boat: 'ac75', speed: 11, heave: 1.12 },
  { ...open, name: 'katamaran', boat: 'ac72', speed: 10 },
  { ...open, name: 'solo-flaadescene', boat: 'laser' },
  { ...open, name: 'to', boat: 'laser', remotes: 1 },
  { ...open, name: 'seks', boat: 'laser', remotes: 5, isolate: true },
  { name: 'turbaad-kyst', boat: 'yacht', x: -180, y: -340, heading: -.65, speed: 3, camera: 0, isolate: true },
  { ...open, name: 'katamaran-regn', boat: 'ac72', speed: 10, rain: .95, isolate: true },
  { ...open, name: 'laser-overblik', boat: 'laser', camera: 1 },
  { ...open, name: 'laser-foerste-person', boat: 'laser', camera: 4 },
  { ...open, name: 'stille-vand', boat: 'laser', camera: 2, visualOnly: true,
    weather: { speed: 4, waveHeight: 0, chop: 0, rain: 0, clouds: .1 } },
  { ...open, name: 'chop', boat: 'laser', camera: 2, heel: .24, visualOnly: true,
    weather: { speed: 13, waveHeight: .35, chop: 1, rain: 0, clouds: .35 } },
  { ...open, name: 'doenning', boat: 'yacht', heading: .8, camera: 3, heel: .28, speed: 7, visualOnly: true,
    weather: { speed: 9, waveHeight: 1.8, chop: 0, rain: 0, clouds: .12, daylight: .72 } }
];

function stats(values) {
  const samples = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!samples.length) return null;
  const rounded = n => Math.round(n * 1000) / 1000;
  const pct = p => rounded(samples[Math.ceil(samples.length * p) - 1]);
  return { n: samples.length, mean: rounded(samples.reduce((a, b) => a + b, 0) / samples.length),
    p50: pct(.5), p95: pct(.95), max: pct(1) };
}

function summarize({ data, snapshot }) {
  if (!data.length) throw Error('Ingen tidsmålinger');
  const drawn = data.filter(row => row.calls);
  const fixedSteps = data.reduce((n, row) => n + (row.cpu.fixedStep?.count || 0), 0);
  const fixedMs = data.reduce((n, row) => n + (row.cpu.fixedStep?.inclusive || 0), 0);
  const names = [...new Set(data.flatMap(row => Object.keys(row.cpu)))];
  return { ...snapshot, draws: drawn.length, callbacks: data.length,
    drawFps: +(drawn.length / snapshot.wallMs * 1000).toFixed(2),
    simulatedRatio: +(snapshot.simulatedMs / snapshot.wallMs).toFixed(3),
    skipped: data.length - drawn.length, fixedSteps, fixedMsPerStep: fixedSteps ? fixedMs / fixedSteps : null,
    fixedMsPerSimSecond: fixedSteps ? 1000 * fixedMs / snapshot.simulatedMs : null,
    tiers: Object.fromEntries([...new Set(drawn.map(row => row.tier))].map(tier =>
      [tier, drawn.filter(row => row.tier === tier).length])),
    frame: Object.fromEntries(['interval', 'cpuMs', 'drawInterval', 'calls', 'triangles', 'debtMs'].map(key =>
      [key, stats((['calls', 'triangles'].includes(key) ? drawn : data).map(row => row[key]))])),
    gpu: { mainWithShadows: stats(drawn.map(row => row.gpu.main)),
      mirrorWhenDrawn: stats(drawn.map(row => row.gpu.reflection)),
      mirrorPasses: drawn.filter(row => row.cpu.mirrorSubmit).length,
      mainWithoutQuery: drawn.filter(row => !Number.isFinite(row.gpu.main)).length },
    scopes: Object.fromEntries(names.map(name => [name, {
      inclusive: stats(data.map(row => row.cpu[name]?.inclusive)),
      own: stats(data.map(row => row.cpu[name]?.own)),
      calls: data.reduce((sum, row) => sum + (row.cpu[name]?.count || 0), 0)
    }]))
  };
}

function topFunctions({ nodes, samples = [], timeDeltas = [] }) {
  const lookup = new Map(nodes.map(node => [node.id, node.callFrame]));
  const totals = new Map();
  samples.forEach((id, i) => totals.set(id, (totals.get(id) || 0) + timeDeltas[i] / 1000));
  return [...totals].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([id, ms]) => ({
    name: lookup.get(id).functionName, url: lookup.get(id).url, line: lookup.get(id).lineNumber + 1,
    sampledMs: +ms.toFixed(3)
  }));
}

async function measure(browser, url, profile, throttle, mobile) {
  const viewport = mobile ? { width: 390, height: 664 } : { width: 1120, height: 700 };
  const deviceScaleFactor = mobile ? 3 : 1.5;
  const context = await browser.newContext({ viewport, deviceScaleFactor, isMobile: mobile, hasTouch: mobile });
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const traceFile = process.env.TACK_AUDIT_TRACE;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await cdp.send('Performance.enable');
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text().slice(0, 600)); });
    const light = process.env.TACK_AUDIT_LIGHT === '1';
    const replayControls = process.env.TACK_AUDIT_REPLAY === '1' ? [
      { time: 0, sheetTarget: .58, crewPose: 2 }, { time: 8, steer: .18, sheetTarget: .53 },
      { time: 10, steer: -.16, crewPose: 3 }, { time: 12, steer: 0, sheetTarget: .29, crewPose: 1 },
      { time: 17, steer: 0, sheetTarget: .61, crewPose: 2 }
    ] : null;
    await page.addInitScript(installAudit, light);
    await page.addInitScript(quality => localStorage.setItem('fri-vind.settings.v3',
      JSON.stringify({ personal: { quality: quality === 'minimum' ? 'low' : quality, camera: 0, difficulty: 'hard' } })), profile);
    await page.route(url, async route => {
      const response = await route.fetch();
      const original = await response.text();
      const html = original.replace('  if(!P||!W||!B', `
        fixedStep=tackAudit.timing(fixedStep,'fixedStep');
        const auditInput=input;
        input=tackAudit.timing(()=>tackAudit.control(auditInput(),state.time),'controlInput');
        interpolate=tackAudit.timing(interpolate,'interpolate');
        synchronizeRecovery=tackAudit.timing(synchronizeRecovery,'recoveryState');
        updateUI=tackAudit.timing(updateUI,'hud');
        updateLiveControls=tackAudit.timing(updateLiveControls,'liveControls');
        audio.update=tackAudit.timing(audio.update,'audio');
        tackAudit.setThawHook(() => { lastFrame=performance.now(); acc=0; });
        ${profile === 'minimum' ? "effectiveQuality='minimum';" : ''}
        if(!P||!W||!B`);
      if (html === original) throw Error('TACK initialization anchor missing');
      await route.fulfill({ response, body: html });
    });
    const begin = performance.now();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('#startButton:enabled').waitFor();
    const readyMs = performance.now() - begin;
    const build = await response.headerValue('x-fri-vind-revision');
    if (!build || build !== await page.locator('meta[name=fri-vind-revision]').getAttribute('content')) {
      throw Error('Build metadata differs from response header');
    }
    const device = await page.evaluate(() => tackAudit.install());
    const start = performance.now();
    const race = process.env.TACK_AUDIT_RACE === '1';
    await page.click(race ? '#introCourse' : '#startButton');
    await page.waitForFunction(() => SAILING_GAME.state.time > .05);
    const firstSailMs = performance.now() - start;
    const startup = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({
      file: new URL(entry.name).pathname.split('/').slice(3).join('/'),
      bytes: entry.encodedBodySize, decoded: entry.decodedBodySize, type: entry.initiatorType,
      durationMs: entry.duration
    })));
    const wanted = process.env.TACK_AUDIT_STAGES?.split(',');
    const selected = race ? [{ name: 'kapsejlads', boat: 'laser', camera: 0, race: true }]
      : stages.filter(stage => wanted ? wanted.includes(stage.name) : !stage.visualOnly);
    const chosen = Array.from({length: Number(process.env.TACK_AUDIT_REPEATS) || 1}, () => selected).flat();
    if (traceFile) await cdp.send('Tracing.start', {
      categories: 'devtools.timeline,blink,cc,gpu,v8,disabled-by-default-devtools.timeline',
      transferMode: 'ReturnAsStream', streamCompression: 'gzip'
    });
    const all = [];
    const duration = Number(process.env.TACK_AUDIT_MS || 3200);
    let camera = 0;
    const browserStats = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(a => [a.name, a.value]));
    for (const stage of chosen) {
      await page.evaluate(() => tackAudit.useControls(null));
      for (let i = 0; i < (stage.camera - camera + 5) % 5; i++) await page.keyboard.press('KeyC');
      camera = stage.camera;
      await page.evaluate(setupFleet, false);
      const preparation = process.env.TACK_AUDIT_WARM === '1' ? await page.evaluate(async id => {
        const {scene} = SAILING_GAME, started = performance.now();
        tackAudit.freeze(true);
        try {
          scene.buildBoat(id);
          const built = performance.now();
          const textures = new Set();
          scene.boatRoot.traverse(node => {
            for (const material of [].concat(node.material || [])) {
              for (const key of ['map', 'normalMap', 'bumpMap']) if (material[key]) textures.add(material[key]);
            }
          });
          for (const texture of textures) scene.renderer.initTexture(texture);
          const uploaded = performance.now();
          await scene.renderer.compileAsync(scene.boatRoot, scene.camera, scene.scene);
          return { buildMs: built-started, initTextureMs: uploaded-built,
            compileMs: performance.now()-uploaded, textures: textures.size };
        } finally { tackAudit.freeze(false); }
      }, stage.boat) : null;
      const transition = process.env.TACK_AUDIT_SWITCH === '1' ? await page.evaluate(() => {
        tackAudit.traceGraphics();
        return tackAudit.begin();
      }) : null;
      const replay = !stage.race ? await page.evaluate(changeScene, { ...stage, replayControls }) : null;
      if (stage.remotes) {
        await page.evaluate(setupFleet, stage.remotes);
        await page.evaluate(() => {
          const fleet = FriVindLobby.fleet;
          const state = SAILING_GAME.state;
          // Place the fleet ahead and inside the normal follow camera's field.
          const offsets = [[12, -5], [22, -4], [32, -16], [42, -30], [55, -23]];
          [...fleet.boats.values()].forEach((boat, i) => {
            boat.x = state.x + offsets[i][0];
            boat.y = state.y + offsets[i][1];
          });
        });
      }
      await page.waitForFunction(id => SAILING_GAME.scene.boatId === id && SAILING_GAME.state.time > .1, stage.boat);
      const switchTrace = transition ? await page.evaluate(async started => {
        tackAudit.stopGraphicsTrace();
        return tackAudit.end(started);
      }, transition) : null;
      await page.waitForTimeout(1100);
      const before = await browserStats();
      const started = await page.evaluate(() => tackAudit.begin());
      await page.waitForTimeout(duration);
      const measurement = await page.evaluate(started => tackAudit.end(started), started);
      const live = summarize(measurement);
      const after = await browserStats();
      await page.evaluate(() => tackAudit.freeze(true));
      const inventory = await page.evaluate(() => tackAudit.inventory());
      if (inventory.drawnActors.length !== (stage.remotes || 0)) {
        throw Error(`Forkert antal tegnede gæster i ${stage.name}: ${inventory.drawnActors.length}`);
      }
      const isolate = stage.isolate && process.env.TACK_AUDIT_LAYERS !== '0';
      const images = process.env.TACK_AUDIT_IMAGES;
      if (replay && (isolate || images)) {
        const data = await page.evaluate(({replay, stage, capture}) => {
          const {scene, course} = SAILING_GAME;
          const state = replay.state, env = replay.env;
          const dt = 1/60;
          for (let i = 0; i < 180; i++) TackSimulation.stepBoat(state, replay.controls[0], env, dt);
          scene.lastTime = -1;
          scene.cameraReady = false;
          scene.update(state, SailingSettings.live(env, state), course, dt,
            {cameraMode: stage.camera, quality: scene.graphicsProfile.id, windArrows: true});
          return capture ? scene.canvas.toDataURL('image/jpeg', .92).split(',')[1] : null;
        }, {replay, stage, capture: Boolean(images)});
        if (images) await fs.writeFile(path.join(images, stage.name + '.jpg'), Buffer.from(data, 'base64'));
      }
      const isolated = isolate ? await page.evaluate(() => tackAudit.layers()) : null;
      await page.evaluate(() => tackAudit.freeze(false));
      const inputResponse = process.env.TACK_AUDIT_INPUT === '1' ? await page.evaluate(async () => {
        const {state} = SAILING_GAME;
        tackAudit.useControls(null);
        const trials = [];
        // This uses the game's key handlers. Measurement is quantized to rAF.
        for (const [code, sign] of [['ArrowRight', 1], ['ArrowLeft', -1], ['ArrowRight', 1]]) {
          const rudder = state.rudder, started = performance.now();
          const key = type => window.dispatchEvent(new KeyboardEvent(type, {key: code, code, bubbles:true}));
          key('keydown');
          let elapsed = null;
          try {
            while (performance.now()-started < 600) {
              await new Promise(resolve => requestAnimationFrame(resolve));
              if ((state.rudder-rudder)*sign > .003) { elapsed = performance.now()-started; break; }
            }
          } finally { key('keyup'); }
          trials.push({code, rudderMs: elapsed});
          await new Promise(resolve => setTimeout(resolve, 160));
        }
        return trials;
      }) : null;
      const deltas = Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'LayoutCount']
        .filter(key => Number.isFinite(before[key]) && Number.isFinite(after[key])).map(key => [key, after[key] - before[key]]));
      const record = { stage, live, inventory, layers: isolated && Object.fromEntries(Object.entries(isolated).map(([name, s]) => [name, stats(s)])),
        browser: { deltas, jsHeapBytes: after.JSHeapUsedSize, nodes: after.Nodes },
        ...(replay ? { replay } : {}),
        ...(preparation ? { preparation } : {}),
        ...(inputResponse ? { inputResponse } : {}),
        ...(process.env.TACK_AUDIT_RAW === '1' ? { frames: measurement.data, ...(isolated ? { layerSamples: isolated } : {}) } : {}),
        ...(switchTrace ? { switchTrace: summarize(switchTrace) } : {}) };
      all.push(record);
      console.log(stage.name, live.tier, live.size, live.drawFps, live.simulatedRatio, live.frame.cpuMs.p95,
        live.gpu.mainWithShadows?.p95, inventory.total.calls, inventory.total.triangles);
    }
    if (traceFile) {
      const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
      await cdp.send('Tracing.end');
      const {stream} = await complete;
      const chunks = [];
      let chunk;
      do {
        chunk = await cdp.send('IO.read', { handle: stream });
        chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8'));
      } while (!chunk.eof);
      await cdp.send('IO.close', { handle: stream });
      await fs.writeFile(traceFile, Buffer.concat(chunks));
    }
    let cpuProfile = null;
    if (process.env.TACK_AUDIT_CPU === '1') {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
      await cdp.send('Profiler.start');
      await page.waitForTimeout(3500);
      const result = await cdp.send('Profiler.stop');
      cpuProfile = { stage: chosen.at(-1)?.name, durationMs: 3500,
        top: topFunctions(result.profile), profile: result.profile };
    }
    return { url, build, profile, throttle, mobile, viewport, deviceScaleFactor, device, readyMs,
      firstSailMs, startup, errors, all, cpuProfile };
  } finally {
    await context.close();
  }
}

async function main() {
  const [, , url, filename, profile = 'high', throttle = '1', mobile] = process.argv;
  if (!url || !filename) throw Error('node scripts/render-audit.cjs URL JSON [high|balanced|low|minimum|auto] [CPU-faktor] [mobile]');
  const executablePath = process.env.CHROME_PATH ||
    (os.platform() === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
  const browser = await chromium.launch({ executablePath, args: ['--enable-unsafe-swiftshader'] });
  try {
    const result = await measure(browser, url, profile, Number(throttle), mobile === 'mobile');
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    await fs.writeFile(filename, JSON.stringify({ revision, os: os.release(), arch: os.arch(),
      cpu: os.cpus()[0]?.model, cpuCount: os.cpus().length, ram: os.totalmem(), chrome: browser.version(), ...result },
    (key, value) => typeof value === 'number' && !Number.isFinite(value) ? { $number: String(value) } : value, 2) + '\n');
    if (result.errors.length) console.error(result.errors);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
