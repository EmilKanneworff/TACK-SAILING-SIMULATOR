'use strict';

const { spawn } = require('node:child_process');
const { once } = require('node:events');
const os = require('node:os');
const { chromium } = require('@playwright/test');
const { WebSocket } = require('ws');
const { introOption } = require('./browser-setup.cjs');

const target = process.env.TACK_URL || 'http://localhost:4173/';
const port = Number(process.env.TACK_PROFILE_PORT || 34786);
const live = 'ws://127.0.0.1:' + port;
const guestBoats = ['dinghy', 'yacht', 'ac75', 'ac72', 'laser'];
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function summarize(values) {
  if (!values.length) return { n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  function at(p) { return +sorted[Math.ceil(p * sorted.length) - 1].toFixed(3); }
  return { n: values.length, p50: at(.50), p95: at(.95), max: at(1),
    sum: +values.reduce((sum, x) => sum + x, 0).toFixed(3) };
}

function classifyProfile(profile, elapsed, frames) {
  const nodes = new Map(profile.nodes.map(node => [node.id, node]));
  const parents = new Map();
  for (const node of nodes.values()) {
    for (const child of node.children || []) parents.set(child, node.id);
  }
  const categories = new Map();
  const onFile = (stack, suffix) => stack.some(node => node.url.endsWith(suffix));
  const named = (stack, expression) => stack.some(node => expression.test(node.functionName));
  for (const node of nodes.values()) {
    const stack = [];
    for (let id = node.id; id !== undefined; id = parents.get(id)) stack.push(nodes.get(id).callFrame);
    const top = stack[0];
    const solver = named(stack, /^(stepPrepared|stepBoat|stepFleetBoat|probeStepBoat|probeStepFleetBoat)$/);
    const field = named(stack, /^(waveAt|analyticWaveAt|waveBand|wavePathField|waveExposureField|waterContact|windAt|sailAirAt|seaTarget|prepareGrid|samplePath)$/)
      || ['/wind-field.js','/shelter.js','/water-depth.js'].some(file => onFile(stack, file));
    let label;
    if (/^\((idle|program|root)\)$/.test(top.functionName)) label = top.functionName;
    else if (top.functionName === '(garbage collector)') label = 'GC';
    else if (solver) label = field ? 'wind/water within simulation' : 'solver excluding field';
    else if (named(stack, /^(updateBoat|updateCatamaran|poseFoiler|animatedCrewPose|crewPoseAt|interpolate)$/)
        || onFile(stack, '/crew-rig.js') || onFile(stack, '/crew-motion.js')) label = 'pose/animation';
    else if (field) label = 'wind/water outside simulation';
    else if (onFile(stack, '/fleet.js') || onFile(stack, '/lobby.js') || named(stack, /^(broadcast|resolveContacts)$/)) label = 'network/fleet outside solver';
    else if (named(stack, /^(render|probeRenderer|probeScene|updateSceneRange|reflect|updateEffects|updateContactFoam)$/)
        || onFile(stack, '/hull-water.js') || onFile(stack, '/scene-resources.js')) label = 'scene/render submission';
    else if (named(stack, /^(input|updateLiveControls)$/)) label = 'input/HUD';
    else label = 'other browser JavaScript';
    categories.set(node.id, label);
  }
  const sums = {};
  for (let i = 0; i < profile.samples.length; i++) {
    const label = categories.get(profile.samples[i]);
    sums[label] = (sums[label] || 0) + profile.timeDeltas[i] / 1000;
  }
  return Object.fromEntries(Object.entries(sums).map(([label, ms]) =>
    [label, { ms: +ms.toFixed(1), msPerFrame: +(ms / frames).toFixed(3), wallPercent: +(100 * ms / elapsed).toFixed(2) }]));
}

async function openPeer(code, boat, index) {
  const socket = new WebSocket(live);
  const ack = [];
  const inflight = new Map();
  let identity, seq = 0;
  const joined = new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(Error('Peer join timed out')), 5000);
    socket.once('error', reject);
    socket.on('message', packet => {
      const msg = JSON.parse(packet);
      if (msg.type === 'joined') {
        clearTimeout(deadline);
        identity = msg;
        resolve();
      }
      if (!identity && msg.type === 'error') {
        clearTimeout(deadline);
        reject(Error(msg.message));
      }
      if (msg.type !== 'snapshot' || !identity) return;
      const confirmed = msg.state.acks?.[identity.id];
      if (inflight.has(confirmed)) {
        ack.push(performance.now() - inflight.get(confirmed));
        for (const sent of inflight.keys()) if (sent <= confirmed) inflight.delete(sent);
      }
    });
  });
  await once(socket, 'open');
  socket.send(JSON.stringify({ type: 'join', code, name: 'Profiler ' + index, boat }));
  await joined;
  return {
    ack, socket,
    steer(steer) {
      inflight.set(++seq, performance.now());
      socket.send(JSON.stringify({ type: 'input', session: identity.session, seq,
        steer, trim: 0, crewPose: 2, difficulty: 'hard' }));
    }
  };
}

async function installProbes(page) {
  return page.evaluate(() => {
    const g = SAILING_GAME;
    const report = window.tackProfile = { frames: [], stepBoat: [], stepFleetBoat: [], render: [],
      pose: [], scene: [], inputToState: [], inputToScene: [], fleet: [], snapshotBytes: [], lastFrame: 0 };
    const gl = g.scene.renderer.getContext();
    const rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const adapter = rendererInfo?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER;
    let pending = null;
    function track(event) {
      if (event.repeat || event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return;
      pending = { direction: event.code === 'ArrowRight' ? 1 : -1, time: event.timeStamp,
        physical: false, shown: false };
    }
    window.addEventListener('keydown', track, true);
    function measure(list, action, ...args) {
      const start = performance.now();
      const result = action(...args);
      list.push(performance.now() - start);
      return result;
    }
    const sim = TackSimulation;
    const stepBoat = sim.stepBoat, stepFleetBoat = sim.stepFleetBoat;
    sim.stepBoat = function probeStepBoat(...args) {
      const result = measure(report.stepBoat, stepBoat, ...args);
      const [state] = args;
      if (pending && !pending.physical && Math.sign(state.steerIntent) === pending.direction) {
        pending.physical = true;
        report.inputToState.push(performance.now() - pending.time);
      }
      return result;
    };
    sim.stepFleetBoat = function probeStepFleetBoat(...args) {
      return measure(report.stepFleetBoat, stepFleetBoat, ...args);
    };
    const scene = g.scene, updateBoat = scene.updateBoat, update = scene.update;
    scene.updateBoat = function probePose(...args) { return measure(report.pose, updateBoat.bind(this), ...args); };
    scene.update = function probeScene(...args) {
      const result = measure(report.scene, update.bind(this), ...args);
      if (pending?.physical && !pending.shown && Math.sign(args[0].rudder) === pending.direction) {
        pending.shown = true;
        report.inputToScene.push(performance.now() - pending.time);
      }
      return result;
    };
    const renderer = scene.renderer, render = renderer.render;
    renderer.render = function probeRenderer(...args) { return measure(report.render, render.bind(this), ...args); };
    const fleet = FriVindLobby.fleet, step = fleet.step;
    fleet.step = function probeFleet(...args) { return measure(report.fleet, step.bind(this), ...args); };
    function frame(now) {
      if (report.lastFrame) report.frames.push(now - report.lastFrame);
      report.lastFrame = now;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { device: gl.getParameter(adapter), buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      quality: scene.quality, viewport: [window.innerWidth, window.innerHeight], hard: g.env.difficulty };
  });
}

async function runCase(browser, count, quality) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const peers = [];
  const bytes = [];
  const errors = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ live, quality }) => {
      Object.defineProperty(window, 'FRI_VIND_REALTIME_URL', { get: () => live, set() {} });
      localStorage.setItem('fri-vind.settings.v3', JSON.stringify({
        weather: { speed: 8, direction: 0, waveHeight: .45, gusts: .22, chop: .25 },
        personal: { difficulty: 'hard', quality, camera: 0, volume: 0 }
      }));
    }, { live, quality });
    const response = await page.goto(target);
    await page.locator('#startButton:enabled').waitFor();
    await (await introOption(page, '#introLobby')).click();
    await page.locator('#lobbyName').fill('Performance host');
    await page.locator('#lobbyCreate').click();
    await page.waitForFunction(() => /^\d{6}$/.test(document.getElementById('lobbyCode').textContent.trim()));
    const code = await page.locator('#lobbyCode').innerText();
    for (const boat of guestBoats.slice(0, count - 1)) peers.push(await openPeer(code, boat, peers.length + 1));
    if (peers.length) peers[0].socket.on('message', wire => {
      if (wire.includes(Buffer.from('"type":"snapshot"'))) bytes.push(wire.length);
    });
    await page.locator('#lobbySail').click();
    await page.waitForFunction(n => FriVindLobby.fleet.actors.size === n && SAILING_GAME.state.time > 2, count - 1);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    const device = await installProbes(page);
    const initial = await page.evaluate(() => ({
      time: SAILING_GAME.state.time, frame: performance.now(),
      shapes: [SAILING_GAME.state.boatId, ...Array.from(FriVindLobby.fleet.boats.values(), s => s.boatId)]
    }));
    for (const peer of peers) peer.ack.length = 0;
    bytes.length = 0;
    await cdp.send('Profiler.start');
    for (const [key, sign] of [['ArrowRight', 1], ['ArrowLeft', -1], ['ArrowRight', 1], ['ArrowLeft', -1],
      ['ArrowRight', 1], ['ArrowLeft', -1], ['ArrowRight', 1], ['ArrowLeft', -1]]) {
      await page.keyboard.down(key);
      for (const peer of peers) peer.steer(sign * .35);
      await page.waitForTimeout(320);
      await page.keyboard.up(key);
      for (const peer of peers) peer.steer(0);
      await page.waitForTimeout(520);
    }
    const { profile } = await cdp.send('Profiler.stop');
    const output = await page.evaluate(() => ({
      time: SAILING_GAME.state.time, frame: performance.now(), report: window.tackProfile,
      triangles: SAILING_GAME.scene.renderer.info.render.triangles,
      renderers: FriVindLobby.fleet.actors.size + 1,
      finite: [SAILING_GAME.state,...FriVindLobby.fleet.boats.values()].every(s=>[s.x,s.y,s.theta,s.time].every(Number.isFinite))
    }));
    const duration = output.frame - initial.frame;
    return { count, device, shapes: initial.shapes, revision: await response.headerValue('x-fri-vind-revision'),
      elapsedMs: +duration.toFixed(1), simulatedSeconds: +(output.time - initial.time).toFixed(3), errors,
      finite: output.finite, triangles: output.triangles, visibleBoatActors: output.renderers,
      timings: Object.fromEntries(Object.entries(output.report).filter(([, v]) => Array.isArray(v) && v.length)
        .map(([key, times]) => [key, summarize(times)])),
      cpu: classifyProfile(profile, duration, output.report.frames.length),
      snapshotBytes: summarize(bytes), guestInputAcknowledgementMs: summarize(peers[0]?.ack ?? []) };
  } finally {
    for (const peer of peers) peer.socket.terminate();
    await context.close();
  }
}

async function main() {
  const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port) } });
  const closed = once(server, 'exit');
  let browser;
  try {
    await Promise.race([once(server.stdout, 'data'), closed.then(() => { throw Error('Live server exited'); })]);
    browser = await chromium.launch({ executablePath: chromePath,
      headless: !process.argv.includes('--headed'), args: ['--enable-unsafe-swiftshader'] });
    const quality = process.env.TACK_PROFILE_QUALITY || 'high';
    console.log(JSON.stringify({ hardware: os.cpus()[0].model, memoryGiB: os.totalmem() / 2**30, os: os.release(),
      browser: browser.version(), node: process.version, target, quality,
      notes: 'One real Chrome host; other players use the live server through lightweight WebSocket clients.' }));
    const rounds = Number(process.env.TACK_PROFILE_ROUNDS || 1);
    for (let round = 1; round <= rounds; round++) {
      for (const boats of [1, 6]) console.log(JSON.stringify({ round, ...await runCase(browser, boats, quality) }));
    }
  } finally {
    await browser?.close();
    server.kill();
    await closed;
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
