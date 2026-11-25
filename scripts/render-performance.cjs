'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('@playwright/test');

const viewport = { width: 1120, height: 700 };
const deviceScaleFactor = 1.5;
const stages = [
  { name: 'havn', boat: 'laser', x: 4, y: -47, heading: -1.5, speed: 2, camera: 0 },
  { name: 'kyst', boat: 'yacht', x: -180, y: -340, heading: -.65, speed: 3, camera: 0, turn: true },
  { name: 'aabent', boat: 'laser', x: -1900, y: -2170, heading: -.45, speed: 4, camera: 0 },
  { name: 'opretning', boat: 'laser', x: -1900, y: -2170, heading: -.45, speed: 4, camera: 0, recover: true },
  { name: 'foil', boat: 'ac75', x: -1610, y: -1930, heading: -.40, speed: 11, heave: 1.12, camera: 1 },
  { name: 'seks', boat: 'laser', x: -1900, y: -2170, heading: -.45, speed: 4, camera: 1, fleet: true },
  { name: 'retur', boat: 'laser', x: 4, y: -47, heading: -1.5, speed: 2, camera: 0 },
  { name: 'aabent-igen', boat: 'laser', x: -1900, y: -2170, heading: -.45, speed: 4, camera: 0 },
  { name: 'retur-igen', boat: 'laser', x: 4, y: -47, heading: -1.5, speed: 2, camera: 0 }
];

function installProbe() {
  let row, run, game, renderer, gl, extension, query, previous, previousDraw, sequence = 0;
  const reads = [];
  const request = window.requestAnimationFrame.bind(window);
  function wrap(fn, key, predicate = null) {
    return function (...args) {
      if (!row || (predicate && !predicate(...args))) return fn.apply(this, args);
      const start = performance.now();
      try { return fn.apply(this, args); }
      finally { row[key] = (row[key] || 0) + performance.now() - start; }
    };
  }
  const methods = (target, names) => {
    for (const [name, key] of Object.entries(names)) {
      if (target?.[name]) target[name] = wrap(target[name], key);
    }
  };

  function collectQueries() {
    if (!extension) return;
    const disjoint = gl.getParameter(extension.GPU_DISJOINT_EXT);
    for (let i = reads.length - 1; i >= 0; i--) {
      const [result, q] = reads[i];
      if (!disjoint && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) continue;
      if (!disjoint) result.gpu = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(q);
      reads.splice(i, 1);
    }
  }

  function frame(timestamp, callback) {
    collectQueries();
    if (!run) return callback(timestamp);
    renderer.info.reset();
    row = { interval: previous === null ? null : timestamp - previous };
    previous = timestamp;
    if (extension && reads.length < 16 && ++sequence % 3 === 0) {
      query = gl.createQuery();
      gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
    }
    const start = performance.now();
    try { callback(timestamp); }
    finally {
      if (query) {
        gl.endQuery(extension.TIME_ELAPSED_EXT);
        reads.push([row, query]);
        query = null;
      }
      const { calls, triangles } = renderer.info.render;
      if (calls>0) {
        row.drawInterval = previousDraw === null ? null : timestamp - previousDraw;
        previousDraw = timestamp;
      }
      Object.assign(row, { cpu: performance.now() - start, calls, triangles });
      run.push(row);
      row = null;
    }
  }

  window.requestAnimationFrame = callback => request(callback.name === 'frame' ? time => frame(time, callback) : callback);
  window.tackPerf = {
    wrap,
    install() {
      game = window.SAILING_GAME;
      const scene = game.scene;
      renderer = scene.renderer;
      renderer.info.autoReset = false;
      gl = renderer.getContext();
      extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      methods(scene, { update: 'scene', updateBoat: 'boat', animatedCrewPose: 'crew', updateEffects: 'waterContact',
        updateSceneRange: 'terrainRange', updateAtmosphere: 'atmosphere', buildBoat: 'boatBuild' });
      methods(scene.hullWater, { reflect: 'reflection' });
      methods(FriVindLobby.fleet, { step: 'fleetPhysics', render: 'fleetGraphics' });
      methods(game.map, { update: 'map' });
      renderer.render = wrap(renderer.render, 'renderer');
      return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        gpuTimer: Boolean(extension), three: THREE.REVISION };
    },
    async waterLayers() {
      if (!extension) return null;
      const view = game.scene, water = view.water, world = view.scene;
      const basic = new THREE.MeshBasicMaterial({ color: '#175061' });
      const values = { meshWithBasicShader: [], waterWithGameShader: [], planarReflection: [] };
      const measure = async draw => {
        const q = gl.createQuery();
        gl.beginQuery(extension.TIME_ELAPSED_EXT, q);
        try { draw(); } finally { gl.endQuery(extension.TIME_ELAPSED_EXT); }
        gl.flush();
        for(let limit = 0; limit < 100; limit++) {
          if (gl.getParameter(extension.GPU_DISJOINT_EXT)) break;
          if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
            const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
            gl.deleteQuery(q);
            return ms;
          }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        gl.deleteQuery(q);
        return null;
      };
      for (const [key, material] of [['meshWithBasicShader', basic], ['waterWithGameShader', water.material]]) {
        for (let i = 0; i < 15; i++) {
          const ms = await measure(() => {
            const visible = world.children.filter(o => o.visible && o !== water);
            const original = water.material;
            for (const o of visible) o.visible = false;
            water.material = material;
            try { renderer.render(world, view.camera); }
            finally {
              water.material = original;
              for (const o of visible) o.visible = true;
            }
          });
          if (i > 2 && ms !== null) values[key].push(ms);
        }
      }
      if (view.graphicsProfile.reflectionSize>0 && view.camera.position.y<39) {
        for (let i = 0; i < 15; i++) {
          const ms = await measure(() => {
            view.hullWater.lastReflection = -Infinity;
            view.hullWater.reflect(game.state, game.env);
          });
          if (i > 2 && ms !== null) values.planarReflection.push(ms);
        }
      }
      basic.dispose();
      return { triangles: water.geometry.index.count / 3,
        gpu: Object.fromEntries(Object.entries(values).map(([key, times]) => {
          times.sort((a,b)=>a-b);
          return [key,times.length?{n:times.length,p50:times[Math.ceil(times.length/2)-1],p95:times[Math.ceil(times.length*.95)-1]}:null];
        })) };
    },
    begin() { run = []; previous = previousDraw = null; return {wall: performance.now(), simulation:game.state.time}; },
    end() {
      const rows = run;
      run = null;
      const scene = game.scene;
      const ratio = renderer.getPixelRatio();
      const fleet = FriVindLobby.fleet;
      const { env } = game;
      return { rows, snapshot: { ratio, size: [renderer.domElement.width, renderer.domElement.height],
        tier: scene.graphicsProfile.id, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
        waterTriangles: scene.water.geometry.index.count / 3, activeLand: scene.coastTerrain.filter(tile => tile.visible).length,
        activeScenery: scene.coastDecorations.children.filter(group => group.visible && scene.coastDecorations.visible).length,
        shoreFoam: scene.shoreFoamTiles.filter(tile => tile.mesh.visible && scene.shoreFoam.visible).length,
        activeFixtures: scene.shoreFixtures?.filter(f => f.node?.visible).length ?? null,
        fixtureCache: scene.shoreFixtures?.filter(f => f.node).length ?? null,
        activeTerrainRegions: scene.terrainRegions?.filter(r => r.merged?.visible).length ?? null,
        simulationDebt: game.simulationDebt ?? null, fleetSize: 1 + fleet.boats.size, detailedRemotes: [...fleet.actors.values()].filter(a => a.boatRoot.visible).length,
        simpleRemotes: [...fleet.silhouettes?.values() || []].filter(a => a.root.visible).length,
        x: game.state.x, y: game.state.y, time: game.state.time, grounded: game.state.ground?.contact,
        boat:game.state.boatId, speed:env.speed, windDirection:env.direction, waveHeight:env.waveHeight, chop:env.chop } };
    }
  };
}

function changeScene(stage) {
  const { env, state, scene } = SAILING_GAME;
  const gusts = stage.boat === 'ac75' ? .2 : .08;
  Object.assign(env, { boatId: stage.boat, speed: stage.boat === 'ac75' ? 17 : 8, direction: 255, gusts,
    waveHeight: stage.boat === 'ac75' ? .60 : .38, chop: .42, rain: .36, clouds: .65 });
  const start = { x: stage.x, y: stage.y, theta: stage.heading, time: 0, sheet: .44,
    vx: stage.speed * Math.cos(stage.heading), vy: stage.speed * Math.sin(stage.heading) };
  if (stage.heave !== undefined) start.heave = stage.heave;
  const fresh = TackSimulation.createBoat(stage.boat, start, env);
  for (const key of Object.keys(state)) if (!Object.hasOwn(fresh, key)) delete state[key];
  Object.assign(state, fresh);
  scene.lastTime = -1;
  scene.cameraReady = false;
}

function setupFleet(enabled) {
  const fleet = FriVindLobby.fleet;
  if (!enabled) {
    if(fleet.inWorld) fleet.clear();
    return;
  }
  const {state, env} = SAILING_GAME;
  // Render five representative snapshots with the local player's prediction.
  // Live simulation and transport are exercised separately by test:six-rigs.
  fleet.send = () => {};
  fleet.joined({session:'graphics-benchmark', id:'own', host:true, nextSeq:0, phase:'lobby'}, [
    {id:'own', boat:state.boatId, host:true}, ...['dinghy','yacht','ac75','ac72','laser'].map((boat,i) =>
      ({id:'p'+i, boat, name:'Sejler '+(i+1)}))
  ]);
  fleet.inWorld = true;
  fleet.phase = 'free';
  fleet.synced = true;
  fleet.serverTime = Infinity;
  const distances = [[-12,-14],[7,-24],[-4,-48],[27,-76],[36,-153]];
  for(const [i,[x,y]] of distances.entries()){
    const player = fleet.players[i+1],boat = TackSimulation.createBoat(player.boat,
      {x:state.x+x,y:state.y+y,time:state.time,theta:state.theta,sheet:.43,vx:state.vx,vy:state.vy},env);
    fleet.boats.set(player.id,boat);
  }
}

function summarize(passes) {
  const cuts = [50, 95, 99];
  return passes.map(({ rows, snapshot, ...details }) => {
    const metric = key => {
      const onlyDraws = ['calls', 'triangles', 'gpu'].includes(key);
      const values = rows.filter(r=>!onlyDraws||r.calls>0).map(r => r[key]).filter(Number.isFinite).sort((a, b) => a - b);
      return values.length ? { n: values.length, ...Object.fromEntries(cuts.map(p =>
        ['p' + p, +values[Math.ceil(values.length * p / 100) - 1].toFixed(3)])), max:values.at(-1) } : null;
    };
    const keys = ['interval', 'drawInterval', 'cpu', 'simulation', 'scene', 'boat', 'crew', 'waterContact',
      'map', 'ui', 'interpolate', 'terrainRange', 'atmosphere', 'reflection', 'renderer', 'fleetPhysics', 'fleetGraphics', 'boatBuild', 'gpu', 'calls', 'triangles'];
    return { ...details, snapshot,
      stalls50: rows.filter(row => row.drawInterval > 50).length, stalls100: rows.filter(row => row.drawInterval > 100).length,
      skippedDraws: rows.filter(row=>row.calls===0).length,
      metrics: Object.fromEntries(keys.map(key => [key, metric(key)])) };
  });
}

async function measure(browser, url, destination, tier, throttle) {
  const context = await browser.newContext({ viewport, deviceScaleFactor });
  try {
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    if (throttle !== 1) await session.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 500)); });
    await page.addInitScript(installProbe);
    await page.addInitScript(quality => localStorage.setItem('fri-vind.settings.v3',
      JSON.stringify({ personal: { quality, camera: 0, difficulty: 'hard' } })), tier);
    await page.route(url, async route => {
      const response = await route.fetch();
      const original = await response.text();
      const html = original.replace('  if(!P||!W||!B',
        `  fixedStep=tackPerf.wrap(fixedStep,'simulation');updateUI=tackPerf.wrap(updateUI,'ui');
        updateLiveControls=tackPerf.wrap(updateLiveControls,'ui');interpolate=tackPerf.wrap(interpolate,'interpolate');
        if(!P||!W||!B`);
      if(html===original)throw Error('TACK simulation probe could not find initialization');
      await route.fulfill({ response, body: html });
    });
    const load = performance.now();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('#startButton:enabled').waitFor();
    const readyMs = performance.now() - load;
    const revision = await response.headerValue('x-fri-vind-revision');
    const have = await page.evaluate(() => document.querySelector('meta[name=fri-vind-revision]')?.content);
    if (!revision || revision !== have) throw Error('Frontendrevisionen stemmer ikke');
    const device = await page.evaluate(() => tackPerf.install());
    const start = performance.now();
    await page.click('#startButton');
    await page.waitForFunction(() => SAILING_GAME.state.time > .05);
    const firstSailMs = performance.now() - start;
    const passes = [], layers = {};
    const only = process.env.TACK_PERF_LAYERS === '1';
    const capture = process.env.TACK_PERF_IMAGES === '1';
    let camera = 0;
    async function setCamera(target) {
      for (let i = 0; i < (target - camera + 5) % 5; i++) await page.keyboard.press('KeyC');
      camera = target;
    }
    const selected=process.env.TACK_PERF_STAGES?.split(',');
    const stageList=selected?stages.filter(s=>selected.includes(s.name)):
      only||capture?stages.filter(s=>s.name==='havn'||s.name==='foil'):stages;
    for (const stage of stageList) {
      await setCamera(stage.camera);
      if (!stage.fleet) await page.evaluate(setupFleet, false);
      if (stage.boat !== 'laser' && !stage.fleet) await page.evaluate(() => tackPerf.begin());
      await page.evaluate(changeScene, stage);
      if (stage.fleet) await page.evaluate(setupFleet, true);
      await page.waitForFunction(id => SAILING_GAME.scene.boatId === id && SAILING_GAME.state.time > .1, stage.boat);
      if (stage.boat !== 'laser' && !stage.fleet) passes.push({ name: stage.name+'-indgang', ...await page.evaluate(() => tackPerf.end()) });
      if (stage.turn) {
        await page.evaluate(() => tackPerf.begin());
        await setCamera(3);
        await page.waitForTimeout(1700);
        passes.push({ name: 'kameraskift', ...await page.evaluate(() => tackPerf.end()) });
        await setCamera(stage.camera);
      }
      const began = await page.evaluate(recover => {
        const started = tackPerf.begin();
        if(recover){
          const s=SAILING_GAME.state;
          Object.assign(s,{heel:1.5,capsized:true,capsizeSide:1});
        }
        return started;
      },Boolean(stage.recover));
      if(stage.recover)await page.waitForFunction(()=>SAILING_GAME.state.lastRecovery&&!SAILING_GAME.state.recovering);
      else await page.waitForTimeout(Number(process.env.TACK_PERF_MS)||2400);
      // Allow the last asynchronous GPU timers to resolve on subsequent frames.
      const result = await page.evaluate(began => {
        const result=tackPerf.end(),wall=(performance.now()-began.wall)/1000;
        return {...result,wall,simulated:SAILING_GAME.state.time-began.simulation,
          recoverySeconds:SAILING_GAME.state.lastRecovery?.elapsedSeconds??null};
      },began);
      passes.push({ name: stage.name, camera: stage.camera, initial:stage, ...result });
      if (only) { layers[stage.name] = await page.evaluate(() => tackPerf.waterLayers()); }
      if (!only && (stage.name === 'havn' || stage.name === 'foil')) {
        // The seeded voyage bypasses the boat picker. Match its normal title
        // once the measurement is over for the comparison captures.
        await page.evaluate(() => {
          document.querySelector('#brandBoat').textContent = SailingBoats.get(SAILING_GAME.state.boatId).name.toUpperCase();
        });
        await page.screenshot({ path: path.join(destination, tier + '-' + stage.name + '.png') });
      }
    }
    return { revision, tier, throttle, device, readyMs: Math.round(readyMs), firstSailMs: Math.round(firstSailMs),
      errors, passes: summarize(passes), ...(only?{layers}:{}) };
  } finally { await context.close(); }
}

async function main() {
  const [, , url, destination, tier = 'low', throttleText = '1'] = process.argv;
  if (!url || !destination) throw Error('node scripts/render-performance.cjs URL MAPPE [low|balanced|high|auto] [CPU-faktor]');
  await fs.mkdir(destination, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] });
  try {
    const output = await measure(browser, url, destination, tier, Number(throttleText));
    const result = { machine: os.cpus()[0]?.model, arch: os.arch(), os: os.release(), ram: os.totalmem(),
      browser: browser.version(), viewport, deviceScaleFactor, ...output };
    await fs.writeFile(path.join(destination, tier + '.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(result.revision, result.device, result.readyMs, result.firstSailMs, result.errors);
    for (const pass of result.passes) console.log(pass.name, pass.metrics.drawInterval, pass.metrics.gpu,
      pass.metrics.calls.p50, pass.metrics.triangles.p50, pass.snapshot);
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
