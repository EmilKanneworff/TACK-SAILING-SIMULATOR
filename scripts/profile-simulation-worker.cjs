'use strict';

const { chromium } = require('@playwright/test');

const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = process.env.TACK_URL || 'http://localhost:4173/';
const assets = [
  'simulation/boats.js', 'archipelago.js', 'archipelago-relief.js', 'simulation/terrain.js',
  'settings.js', 'shelter.js', 'water-depth.js', 'wind-field.js', 'simulation/physics.js',
  'simulation/foils.js', 'simulation/recovery.js', 'simulation/weather.js', 'collisions.js', 'simulation/runtime.js'
];

function installKernel(root) {
  const sim = root.TackSimulation;
  function create(boats, field) {
    const entries = boats.map(({ id, boat, spawn }) => ({
      id, state: sim.createBoat(boat, spawn, { ...field, boatId: boat })
    }));
    const host = entries[0].state;
    const guests = entries.slice(1);
    for (const entry of entries) sim.placeAtSafeSpawn(entry.state);
    return {
      entries,
      step(count, control) {
        for (let i = 0; i < count; i++) {
          sim.stepBoat(host, control, field, sim.fixedDt);
          const now = host.time * 1000;
          for (const { state } of guests) {
            sim.stepFleetBoat(state, { steer: control.steer * .35, trim: 0, crewPose: 2,
              difficulty: 'hard' }, field, sim.fixedDt, host, now);
          }
          sim.resolveContacts(entries);
          sim.recovery.update(host, field, now);
        }
        return entries;
      }
    };
  }
  root.TackWorkerBenchmark = { create };
  if (typeof document === 'undefined') {
    let batch;
    root.onmessage = ({ data }) => {
      const start = performance.now();
      if (data.boats) batch = create(data.boats, data.field);
      const entries = data.boats ? batch.entries : batch.step(data.count, data.control);
      root.postMessage({ id: data.id, entries, compute: performance.now() - start });
    };
  }
}

function stats(values) {
  const sorted = Array.from(values).sort((a, b) => a - b);
  const value = p => +(sorted[Math.ceil(p * sorted.length) - 1]?.toFixed(2) ?? 0);
  return { n: sorted.length, p50: value(.5), p95: value(.95), p99: value(.99), max: value(1) };
}

async function setup(page, offThread) {
  await page.addScriptTag({ content: '(' + installKernel.toString() + ')(globalThis);' });
  return page.evaluate(async ({ offThread, assetPaths, kernel }) => {
    const game = SAILING_GAME, scene = game.scene;
    const field = { ...game.env };
    const profiles = ['laser','dinghy','yacht','ac75','ac72','laser'];
    const start = ArchipelagoData.spawn;
    const boats = profiles.map((boat, i) => ({
      id: String(i), boat,
      spawn: i === 0 ?
        { x: start.x, y: start.y, theta: -1.1, vx: 1.5 * Math.cos(-1.1), vy: 1.5 * Math.sin(-1.1) } :
        { x: start.x + (i + 1) * 25, y: start.y - (i + 1) * 25, vx: 0, vy: 0 }
    }));
    const workerSource = 'importScripts(' + assetPaths.map(asset => JSON.stringify(new URL('assets/' + asset, location.href).href)).join(',') +
      ');\n' + kernel;
    const load = performance.now();
    let worker, local, current, request = 0;
    function createWorker() {
      const file = URL.createObjectURL(new Blob([workerSource], { type: 'application/javascript' }));
      const worker = new Worker(file);
      URL.revokeObjectURL(file);
      return worker;
    }
    function ask(worker, data) {
      return new Promise((resolve, reject) => {
        const id = ++request;
        const timer = setTimeout(() => reject(Error('Worker simulation timed out')), 15000);
        worker.onerror = err => { clearTimeout(timer); reject(Error(err.message)); };
        worker.onmessage = event => {
          if (event.data.id !== id) return;
          clearTimeout(timer);
          resolve(event.data);
        };
        worker.postMessage({ ...data, id });
      });
    }
    let equivalence;
    if (offThread) {
      worker = createWorker();
      current = (await ask(worker, { boats, field })).entries;
    } else {
      local = TackWorkerBenchmark.create(boats, field);
      current = local.entries;
    }
    const loadMs = performance.now() - load;
    const fields = ['x','y','theta','heel','heave','time','rudder'];
    const read = entries => entries.map(({state}) => fields.map(key => state[key]));
    if (offThread) {
      const control = { steer: .31, crewPose: 2, difficulty: 'hard' };
      const separate = TackWorkerBenchmark.create(boats, field);
      const answer = await ask(worker, { count: 24, control });
      const exact = read(separate.step(24, control));
      equivalence = Math.max(...read(answer.entries).flatMap((row,i) => row.map((value,j) => Math.abs(value - exact[i][j]))));
      if (!(equivalence <= 1e-9)) throw Error('Worker changed replay: ' + equivalence);
      current = (await ask(worker, { boats, field })).entries;
    }

    // Use the game scene and the real remote actor presentation, without a
    // network session. There is one authority for every hull in either run.
    const actors = new FriVindFleet({ scene: () => scene, env: () => field,
      state: () => current[0].state }, () => {});
    actors.inWorld = true; actors.session = 'worker-trial'; actors.id = '0';
    actors.players = boats.map(({id,boat}) => ({ id, boat, name: 'Prøve ' + id }));
    const report = { frames: [], frameWork: [], render: [], solver: [], roundTrip: [], transportAndQueue: [],
      inputToScene: [], stepBatches: 0, droppedDebt: 0, loadMs, equivalence };
    const fixed = TackSimulation.fixedDt;
    const step = (count, control) => {
      const start = performance.now();
      if (worker) {
        pending = true;
        ask(worker, { count, control }).then(reply => {
          current = reply.entries;
          const elapsed = performance.now() - start;
          report.solver.push(reply.compute);
          report.roundTrip.push(elapsed);
          report.transportAndQueue.push(Math.max(0, elapsed - reply.compute));
          pending = false;
          report.stepBatches++;
        }, error => { window.workerTrialError = error.message; });
      } else {
        current = local.step(count, control);
        report.solver.push(performance.now() - start);
        report.stepBatches++;
      }
    };
    let steer = 0, pending = false, input = null, last = 0, mechanicalTime = 0, active = true;
    function keys(event) {
      if (event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') return;
      event.stopImmediatePropagation();
      event.preventDefault();
      if (event.type === 'keydown') {
        steer = event.code === 'ArrowRight' ? 1 : -1;
        input = { time: event.timeStamp, sign: steer };
      } else steer = 0;
    }
    window.addEventListener('keydown', keys, true);
    window.addEventListener('keyup', keys, true);
    function draw(now) {
      if (!active) return;
      const earlier = performance.now();
      const elapsed = last ? now - last : 0;
      if (last) report.frames.push(elapsed);
      last = now;
      const debt = mechanicalTime + Math.min(elapsed / 1000, .12);
      if (debt > .12) report.droppedDebt += debt - .12;
      mechanicalTime = Math.min(debt, .12);
      if (!pending && mechanicalTime + 1e-12 >= fixed) {
        const count = Math.min(7, Math.floor((mechanicalTime + 1e-12) / fixed));
        mechanicalTime = Math.max(0, mechanicalTime - count * fixed);
        step(count, { steer, trim: 0, crewPose: 2, difficulty: 'hard' });
      }
      const beforeRender = performance.now();
      for (const { id, state } of current.slice(1)) actors.boats.set(id,state);
      const host = current[0].state;
      actors.render(elapsed / 1000);
      scene.update({ ...host }, field, game.course, elapsed / 1000, { quality: 'high', cameraMode: 0 });
      report.render.push(performance.now() - beforeRender);
      if (input && Math.sign(host.rudder) === input.sign && Math.sign(host.steerIntent) === input.sign) {
        report.inputToScene.push(performance.now() - input.time);
        input = null;
      }
      report.frameWork.push(performance.now() - earlier);
      window.tackNativeFrame(draw);
    }
    window.suspendForWorkerTrial = true;
    window.tackNativeFrame(draw);
    window.resetWorkerTrial = () => {
      for (const v of Object.values(report)) if (Array.isArray(v)) v.length = 0;
      report.stepBatches = 0; report.droppedDebt = 0; report.start = performance.now(); report.startTime = current[0].state.time;
    };
    window.stopWorkerTrial = () => {
      active = false;
      worker?.terminate();
      const duration = performance.now() - report.start;
      const simulatedSeconds = current[0].state.time - report.startTime;
      const snapshotJsonBytes = new TextEncoder().encode(JSON.stringify(current)).byteLength;
      return { ...report, duration, simulatedSeconds, snapshotJsonBytes, actors: actors.actors.size + 1,
        finite: read(current).flat().every(Number.isFinite) };
    };
    const gl = scene.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { adapter: gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
      viewport: [window.innerWidth, window.innerHeight], buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight] };
  }, { offThread, assetPaths: assets, kernel: '(' + installKernel.toString() + ')(globalThis);' });
}

async function trial(browser, offThread) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      const actual = window.requestAnimationFrame.bind(window);
      window.tackNativeFrame = actual;
      window.requestAnimationFrame = callback => actual(function gated(now) {
        if (window.suspendForWorkerTrial) actual(gated);
        else callback(now);
      });
      localStorage.setItem('fri-vind.settings.v3', JSON.stringify({
        weather: { speed: 8, direction: 0, gusts: .22, waveHeight: .45, chop: .25 },
        personal: { difficulty: 'hard', quality: 'high', camera: 0, volume: 0 }
      }));
    });
    const load = performance.now();
    const response = await page.goto(url);
    await page.click('#startButton');
    await page.waitForFunction(() => SAILING_GAME.state.time > 1);
    const gameLoadMs = performance.now() - load;
    const device = await setup(page, offThread);
    await page.waitForTimeout(2000);
    await page.evaluate(() => resetWorkerTrial());
    for (const key of ['ArrowRight','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','ArrowLeft']) {
      await page.keyboard.down(key);
      await page.waitForTimeout(320);
      await page.keyboard.up(key);
      await page.waitForTimeout(520);
    }
    const out = await page.evaluate(() => {
      if (window.workerTrialError) throw Error(window.workerTrialError);
      return stopWorkerTrial();
    });
    return { mode: offThread ? 'worker' : 'main', revision: await response.headerValue('x-fri-vind-revision'),
      device, gameLoadMs: +gameLoadMs.toFixed(1), ...Object.fromEntries(Object.entries(out)
        .map(([k,v]) => [k, Array.isArray(v) ? stats(v) : v])) };
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ executablePath: chromePath, args: ['--enable-unsafe-swiftshader'] });
  try {
    console.log(JSON.stringify({ browser: browser.version(), quality: 'high', url }));
    const rounds = Number(process.env.TACK_WORKER_ROUNDS || 2);
    for (let i = 0; i < rounds; i++) {
      for (const offThread of i % 2 === 0 ? [false,true] : [true,false]) {
        console.log(JSON.stringify({ round: i + 1, ...await trial(browser, offThread) }));
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
