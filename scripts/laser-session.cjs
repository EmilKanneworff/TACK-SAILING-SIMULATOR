'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { gzipSync } = require('node:zlib');
const { chromium } = require('@playwright/test');

const viewport = { width: 1280, height: 800 };
const compareSideFix = process.env.TACK_LASER_TRIAL === 'manual-side';
const manualSideTrial = compareSideFix || process.env.TACK_LASER_TRIAL === 'water';
const passiveReach = process.env.TACK_LASER_TRIAL === 'broach';
const reachTrial = passiveReach || process.env.TACK_LASER_TRIAL === 'reach';
const artTrial = process.env.TACK_LASER_TRIAL === 'art';
const fps = 12, frames = (manualSideTrial ? 17 : 12) * fps;
const weather = { speed: manualSideTrial ? 8.5 : 7.5, direction: 0, swellDirection: 0, waveHeight: .35,
  chop: .16, gusts: 0, windSeed: 55, waveSeed: 127, shelter: false,
  difficulty: 'hard', ironsHelp: false, forceDiagnostics: true };
const start = { x: 0, y: -1475, heading: 49, velocity: 3, trim: 73 };

if (reachTrial) {
  Object.assign(weather, { speed: 9.5, swellDirection: 300, waveHeight: .85, chop: .25 });
  Object.assign(start, { heading: 110, velocity: 5.6, trim: 52, heel: 12 });
}

async function open(browser, url, sign, quality, version, virtual) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /Shader|WebGL|THREE/.test(message.text())) errors.push(message.text());
  });
  await page.addInitScript(({ quality, virtual }) => {
    localStorage.setItem('fri-vind.settings.v3',
      JSON.stringify({ personal: { quality, difficulty: 'hard', camera: 0, volume: 0 } }));
    if (!virtual) return;
    let time = 1000;
    const nativeFrame = requestAnimationFrame.bind(window);
    performance.now = () => time;
    window.requestAnimationFrame = callback => {
      if (callback.name !== 'frame') return nativeFrame(callback);
      window.advanceLaserFrame = elapsed => callback(time += elapsed);
      return 0;
    };
  }, { quality, virtual });
  const response = await page.goto(url);
  await page.click('#startButton');
  await page.waitForFunction(() => SAILING_GAME.scene.skyPhotoLoaded);
  const build = await response.headerValue('x-fri-vind-revision');
  assert.equal(await page.locator('#buildRevision').textContent(), build);
  version = version + ' · ' + build;
  await page.evaluate(({ start, weather, sign, version }) => {
    const { state, env, scene } = SAILING_GAME, P = SailPhysics;
    const theta = (90 - start.heading * sign) * P.DEG;
    Object.assign(env, weather);
    Object.assign(state, TackSimulation.createBoat('laser', {
      x: start.x, y: start.y, time: 0, theta,
      vx: start.velocity * Math.cos(theta), vy: start.velocity * Math.sin(theta),
      heel: (start.heel || 0) * sign * P.DEG, sheet: P.sheetFromTrim(start.trim / 100, 'laser'), crewSide: -sign, crewPose: 3
    }, env));
    scene.lastTime = -1;
    const updateBoat = scene.updateBoat;
    scene.updateBoat = function (snapshot, ...args) {
      window.laserRenderSnapshot = snapshot;
      return updateBoat.call(this, snapshot, ...args);
    };
    const label = document.createElement('output');
    label.id = 'laserTrialPhase';
    label.style.cssText = 'position:fixed;left:14px;top:60px;z-index:11;padding:7px 10px;border-radius:7px;background:#102c39ec;color:#f1f7f0;font:600 13px system-ui;pointer-events:none';
    label.textContent = version;
    document.body.append(label);
    document.querySelector('#sea').focus({ preventScroll: true });
  }, { start, weather, sign, version });
  await page.keyboard.press('3');
  await trim(page, start.trim);
  return { page, errors, build };
}

async function trim(page, value) {
  // Playwright changes the real slider, which uses the same input event as a drag.
  await page.locator('#sheetControl').fill(String(value));
  await page.locator('#sea').focus();
}

async function sample(page, caption) {
  return page.evaluate(caption => {
    const { state: s, env, scene } = SAILING_GAME, P = SailPhysics;
    const { heading, waterKnots, leeway } = P.instruments(s, null, env);
    const live = { ...env, waveCurrent: s.seaState, waveProfile: s.waveProfile };
    const stern = P.waterContact(s, { x: -1.7, y: -.12, z: 0 }, live);
    const bow = P.bowWaterContact(s, P.configFor(s), live);
    const wet = scene.hullWater.actors.get('local');
    const { steering, planingPower, board, rudder } = s.forces;
    const rudderSections = steering?.blades[0]?.geometry?.sections;
    const angles = [s.heel, s.pitch, s.omega, s.rudder, s.helmTarget, s.boom].map(a => a / P.DEG);
    const person = scene.person, visible = scene.visibleCrewPose, rendered = window.laserRenderSnapshot;
    const boomY = scene.rig.boomY, mast = scene.mastX, boom = scene.boomPivot.rotation.y;
    const cap = person.cap.position, dx = cap.x - mast;
    const distanceAlong = Math.min(scene.rig.boomLength, Math.max(0, -dx * Math.cos(boom) + cap.z * Math.sin(boom)));
    const capClearance = Math.hypot(dx + distanceAlong * Math.cos(boom), cap.y - boomY,
      cap.z - distanceAlong * Math.sin(boom)) - .10;
    const sheet = scene.sheetLine.geometry.attributes.position.array;
    const last = sheet.length - 3;
    const grip = scene.extension.position.clone().add(
      new THREE.Vector3(0, scene.extension.scale.y * .5, 0).applyQuaternion(scene.extension.quaternion));
    const stance = visible && rendered && ({
      artwork: scene.laserDetailed === true,
      posture: visible.degree,
      capClearance,
      sheetGap: Math.hypot(sheet[last] - person.hands[1].position.x,
        sheet[last+1] - person.hands[1].position.y, sheet[last+2] - person.hands[1].position.z),
      tillerGap: grip.distanceTo(person.hands[0].position),
      feetGap: Math.max(...visible.feet.map((p, i) => {
        const foot = (rendered.crewJoints || SailingBoats.crewPoseAt(rendered)).feet[i];
        return Math.hypot(p.x - foot.x, p.y - foot.y, p.z - foot.z);
      })),
    });
    if (caption) document.getElementById('laserTrialPhase').textContent = caption + ' · ' + waterKnots.toFixed(1).replace('.', ',') + ' kn';
    return { time: s.time, position: [s.x, s.y, s.heave], velocity: [s.vx, s.vy, s.heaveVelocity],
      heading, signedHeading: P.wrap(heading * P.DEG) / P.DEG, waterKnots, leeway: leeway / P.DEG,
      angles, rudderRate: steering?.rudderRate, received: steering?.received, heelRate: s.heelRate,
      yawRate: -(s.omega + s.heelRate * Math.sin(s.pitch)) / P.DEG,
      twa: s.wind.twa / P.DEG, aws: s.wind.aws, sheet: P.trimFromSheet(s.sheet, s), sheetTarget: SAILING_GAME.sheetDiagnostics.requested,
      sail: { drive: s.sail.drive, force: s.sail.sideForce, fill: s.sail.fill, luff: s.sail.luff, boom: angles[5] },
      crew: { selected: s.crewTarget ?? null, pose: s.crewPose, side: s.crewSide, blend: s.crewSideBlend, jointPose: s.crewJoints?.degree,
        cg: s.crewCG, foreAft: s.crewForeAft, duck: s.crewDuck, rendered: scene.visibleCrewCG },
      water: { bow: { depth: bow.depth, height: bow.height, closing: bow.closing },
        stern: { depth: stern.depth, height: stern.height, closing: stern.closing },
        weight: s.hydro.weight, lift: s.hydro.buoyancy, volume: s.hydro.submergedVolume, rudder: rudder?.wet,
        u: rudder?.axialFlow, v: rudder?.crossFlow, board: board?.wet, boardPower: board?.power,
        planingPower, planingLift: s.forces.planingLift, planingSide: s.forces.planingSide ?? 0,
        planingRoll: s.forces.ledger?.planing?.moment.roll, yaw: steering?.yawMoments, yawTotal: steering?.yawTotal, yawWater: steering?.yawWater,
        blade: rudderSections?.map(({ wetArea, u, v, moment, contact }) =>
          ({ wetArea, u, v, moment, height: contact.height, depth: contact.depth })) },
      wake: wet ? Object.fromEntries(Object.entries(wet.tracks).map(([name, points]) => [name, points.length])) : {},
      stance, spray: scene.spray.length, tacks: s.tackCount, capsized: s.capsized, ground: s.ground?.contact,
      quality: scene.graphicsProfile.id, debt: SAILING_GAME.simulationDebt };
  }, caption);
}

function decide(frame, s, pilot, sign) {
  if (reachTrial && !passiveReach) {
    const actions = [];
    if (frame === 0) actions.push(['trim', 28]);
    if (frame === 36) actions.push(['trim', 42]);
    const error = ((start.heading - s.heading + 540) % 360) - 180;
    const correction = error * .10 - s.yawRate * .10;
    const key = correction > .35 ? 'ArrowRight' : correction < -.35 ? 'ArrowLeft' : null;
    if (key !== pilot.key) {
      if (pilot.key) actions.push(['up', pilot.key]);
      if (key) actions.push(['down', key]);
      pilot.key = key;
    }
    return actions;
  }
  if (passiveReach) {
    const inputs = { 24: ['down', 'ArrowRight'], 32: ['up', 'ArrowRight'], 54: ['trim', 40],
      85: ['trim', 55], 110: ['down', 'ArrowLeft'], 118: ['up', 'ArrowLeft'] };
    return inputs[frame] ? [inputs[frame]] : [];
  }
  const plan = [];
  if (frame === 18) plan.push(['trim', 56], ['press', '1']);
  if (frame === 28) pilot.turning = true;
  if (!pilot.turning) return plan;
  const heading = sign * s.signedHeading, target = -43, error = target - heading;
  if (manualSideTrial && !pilot.changedStance && heading <= 4) {
    pilot.changedStance = true;
    plan.push(['press', '2']);
  }
  if (!pilot.crossed && heading <= (manualSideTrial ? -15 : -3)) {
    pilot.crossed = true;
    plan.push(['press', sign > 0 ? 'KeyE' : 'KeyQ']);
    if (!manualSideTrial) plan.push(['press', '2']);
  }
  if (!pilot.trimmed && heading < -29) {
    pilot.trimmed = true;
    pilot.trimmedAt = frame;
    plan.push(['trim', 68]);
  }
  if (artTrial && frame === pilot.trimmedAt + 24) plan.push(['press', '3']);
  if (manualSideTrial && frame === 128) plan.push(['trim', 46]);
  if (manualSideTrial && frame === 148) plan.push(['trim', 68]);
  const correction = sign * error * .064 - .040 * s.yawRate;
  const key = !pilot.trimmed ? sign > 0 ? 'ArrowLeft' : 'ArrowRight'
    : correction > .47 ? 'ArrowRight' : correction < -.47 ? 'ArrowLeft' : null;
  if (key !== pilot.key) {
    if (pilot.key) plan.push(['up', pilot.key]);
    if (key) plan.push(['down', key]);
    pilot.key = key;
  }
  return plan;
}

async function apply(page, actions) {
  for (const [type, value] of actions) {
    if (type === 'trim') await trim(page, value);
    else await page.keyboard[type](value);
  }
}

async function record(browser, url, version, sign, quality, root, replay) {
  const { page, build, errors } = await open(browser, url, sign, quality, version, true);
  if (root) await fs.mkdir(root, { recursive: true });
  const pilot = { key: null }, readings = [], commands = [];
  let previous = await sample(page);
  let stage = reachTrial ? 'Slør i medsø' : 'Kryds', currentInput = '', lastInputFrame = -fps;
  const held = new Set();
  for (let frame = 0; frame < frames; frame++) {
    const actions = replay?.[frame] ?? decide(frame, previous, pilot, sign);
    for (const [type, value] of actions) {
      if (type === 'trim' && value === 56) stage = 'Slæk og ind med vægten';
      if (type === 'down' && stage === 'Slæk og ind med vægten') stage = 'Ror mod vinden';
      if (type === 'press' && value === '2' && manualSideTrial) stage = '2 · skift stilling ved vindøjet';
      if (type === 'press' && /^Key[EQ]$/.test(value)) stage = 'Gennem vindøjet · skift side';
      if (type === 'trim' && value === 68) stage = 'Hal ind · byg fart';
      if (type === 'trim' && value === 46) stage = 'Slæk på den nye hals';
      if (artTrial && type === 'press' && value === '3') stage = 'Ud i fuldt hæng';
    }
    if (actions.length) {
      currentInput = actions.map(([type, value]) => type === 'trim' ? value + ' %' :
        type === 'up' ? 'Slip ' + value.replace('Arrow', '').replace('Key', '') :
        value.replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('Key', '')).join(' · ');
      lastInputFrame = frame;
      for (const [type, value] of actions) {
        if (type === 'down') held.add(value === 'ArrowLeft' ? '←' : '→');
        if (type === 'up') held.delete(value === 'ArrowLeft' ? '←' : '→');
      }
    }
    commands.push(actions);
    await apply(page, actions);
    if (!reachTrial && !manualSideTrial && !artTrial && frame === 90) await page.evaluate(() => document.body.classList.add('clear-view'));
    await page.evaluate(ms => advanceLaserFrame(ms), 1000 / fps);
    const input = (frame - lastInputFrame < fps ? ' · Input ' + currentInput : '') +
      (held.size ? ' · Holder ' + [...held].join(' ') : '');
    previous = await sample(page, root ? version + ' · ' + build + ' · ' + stage + input : null);
    readings.push(previous);
    if (root) await page.screenshot({ path: path.join(root, String(frame).padStart(4, '0') + '.jpg'),
      type: 'jpeg', quality: 83 });
  }
  await page.close();
  const min = readings.slice(28).reduce((a, b) => a.waterKnots < b.waterKnots ? a : b);
  const result = { start: readings[0].waterKnots, min: min.waterKnots, end: readings.at(-1).waterKnots,
    elapsed: readings.at(-1).time, heading: readings.at(-1).signedHeading, tacks: readings.at(-1).tacks,
    side: readings.at(-1).crew.side, capsized: readings.some(s => s.capsized), ground: readings.some(s => s.ground),
    maxDuck: Math.max(...readings.map(s => s.crew.duck)), maxDebt: Math.max(...readings.map(s => s.debt)) };
  return { build, result, commands, readings, errors };
}

async function timing(browser, url, tier, cpuRate) {
  const { page, build, errors } = await open(browser, url, 1, tier, tier, false);
  if (cpuRate > 1) {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  }
  await page.waitForTimeout(1000);
  const tick = await page.evaluate(() => {
    const readings = [], responses = [], renderIntervals = [];
    let last = performance.now();
    const start = last, time = SAILING_GAME.state.time;
    const scene = SAILING_GAME.scene, render = scene.render;
    let lastRender = start;
    scene.render = function (...args) {
      const now = performance.now();
      renderIntervals.push(now - lastRender);
      lastRender = now;
      return render.apply(this, args);
    };
    function frame(now) {
      const game = SAILING_GAME;
      readings.push([now - last, game.simulationDebt]);
      last = now;
      if (now - start < 4000) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    window.addEventListener('keydown', event => {
      if (event.repeat || !['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(event.code)) return;
      const game = SAILING_GAME, field = ['ArrowLeft', 'ArrowRight'].includes(event.code) ? 'rudder' : 'sheet';
      const value = game.state[field], when = performance.now();
      function wait() {
        const now = performance.now();
        if (Math.abs(game.state[field] - value) > .001 || now - when > 250) {
          responses.push({ key: event.code, milliseconds: now - when, registered: Math.abs(game.state[field] - value) > .001 });
        } else requestAnimationFrame(wait);
      }
      requestAnimationFrame(wait);
    });
    window.laserTiming = { readings, responses, renderIntervals, time, start };
    return start;
  });
  for (const key of ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(170);
    await page.keyboard.up(key);
    await page.waitForTimeout(180);
  }
  await page.waitForFunction(tick => performance.now() >= tick + 4010, tick);
  const stats = await page.evaluate(() => {
    const { readings, responses, renderIntervals, time, start } = laserTiming;
    const percentiles = values => {
      const sorted = values.slice(1).sort((a,b) => a-b);
      const at = p => sorted[Math.floor((sorted.length - 1) * p)];
      return { frames: sorted.length, p50: at(.5), p95: at(.95) };
    };
    const scene = SAILING_GAME.scene, gl = scene.renderer.getContext();
    const rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const { calls, triangles } = scene.renderer.info.render;
    const asset = performance.getEntriesByType('resource').find(entry => entry.name.endsWith('/laser-detail.glb.js'));
    return { raf: percentiles(readings.map(item => item[0])), render: percentiles(renderIntervals),
      responses, maxDebtSeconds: Math.max(...readings.map(item => item[1])),
      calls, triangles, assetTransfer: asset?.transferSize,
      resolution: [scene.canvas.width, scene.canvas.height],
      renderer: gl.getParameter(rendererInfo?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
      elapsedSeconds: (performance.now() - start) / 1000, simulatedSeconds: SAILING_GAME.state.time - time };
  });
  await page.close();
  return { tier, build, stats, errors };
}

function join(before, after, output) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(fps), '-i', path.join(before, '%04d.jpg'),
    '-framerate', String(fps), '-i', path.join(after, '%04d.jpg'), '-filter_complex', 'hstack=inputs=2',
    '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]);
}

async function main(before, after, output) {
  if (!before || !after || !output) throw Error('node scripts/laser-session.cjs FØR_URL EFTER_URL MAPPE [--timing]');
  await fs.mkdir(output, { recursive: true });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'laser-session-'));
  const software = process.argv.includes('--software');
  const cpuRate = process.argv.includes('--cpu4x') ? 4 : 1;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--enable-unsafe-swiftshader', ...(software ? ['--use-angle=swiftshader'] : [])] });
  try {
    if (process.argv.includes('--timing')) {
      const timings = [];
      for (const quality of software || cpuRate > 1 ? ['low'] : ['high', 'low']) {
        for (const url of [before, after, after, before]) timings.push(await timing(browser, url, quality, cpuRate));
      }
      const file = software ? 'billedtid-software.json' : cpuRate > 1 ? 'billedtid-cpu4x.json' : 'billedtid.json';
      await fs.writeFile(path.join(output, file), JSON.stringify({ viewport, chrome: browser.version(), cpuRate, timings }, null, 2) + '\n');
      return;
    }
    for (const sign of reachTrial ? [1] : [1, -1]) {
      const name = passiveReach ? 'opskaering' : reachTrial ? 'boelgepassage' : sign > 0 ? 'til-styrbord' : 'til-bagbord';
      if (process.env.TACK_LASER_TACK && process.env.TACK_LASER_TACK !== name) continue;
      const folders = ['before', 'after'].map(version => path.join(directory, name, version));
      const capture = !process.env.TACK_CHECK_ONLY;
      const plan = (manualSideTrial || (reachTrial && !passiveReach)) ? await record(browser, after, 'Plan', sign, 'high', null) : null;
      const a = await record(browser, before, 'Før', sign, 'high', capture && folders[0], plan?.commands);
      const b = await record(browser, after, 'Efter', sign, 'high', capture && folders[1], a.commands);
      const low = await record(browser, after, 'Lav', sign, 'low', null, a.commands);
      const matchedInputs = a.commands.some(row => row.some(command => command[1] === 68));
      const evidence = { a: a.result, b: b.result, low: low.result };
      console.log(name, JSON.stringify(evidence));
      if (!reachTrial) assert.ok(matchedInputs, 'Haler aldrig ind på ny halse');
      await fs.writeFile(path.join(output, name + '.json.gz'), gzipSync(JSON.stringify({ viewport, weather, start, sign, a, b, low })));
      for (const x of [a, b, low]) {
        assert.deepEqual(x.errors, []);
        if (reachTrial) {
          assert.ok(!x.result.ground);
          if (!passiveReach) assert.ok(!x.result.capsized && x.result.min > 2);
          const heights = x.readings.map(r => r.water.bow.height);
          assert.ok(Math.max(...heights) - Math.min(...heights) > .12);
          assert.ok(x.readings.some(r => r.water.planingLift > 25));
          continue;
        }
        assert.ok(x.result.tacks === 1 && x.result.side === sign && !x.result.capsized && !x.result.ground, JSON.stringify(evidence));
        if (!manualSideTrial || x !== a) assert.ok(x.result.end > x.result.min + .25, JSON.stringify(evidence));
      }
      if (manualSideTrial) {
        const stanceFrame = a.commands.findIndex(row => row.some(([type, value]) => type === 'press' && value === '2'));
        const sideFrame = a.commands.findIndex(row => row.some(([type, value]) => type === 'press' && /^Key[EQ]$/.test(value)));
        assert.ok(stanceFrame >= 0 && sideFrame > stanceFrame, 'Mangler separat stillings- og sidekommando');
        if (compareSideFix) assert.ok(a.readings.slice(stanceFrame, sideFrame).some(row => row.crew.side === sign),
          'Før-målingen genskaber ikke sideskiftet');
        assert.ok(b.readings.slice(stanceFrame, sideFrame).every(row => row.crew.side === -sign),
          'Stillingskommandoen flytter siden');
      }
      const physical = ({ position, velocity, angles, crew, ...row }) => ({
        position, velocity, angles, time: row.time, sheet: row.sheet, sail: row.sail,
        crew: { pose: crew.pose, side: crew.side, blend: crew.blend, cg: crew.cg },
        bow: row.water.bow, stern: row.water.stern
      });
      assert.deepEqual(low.readings.map(physical), b.readings.map(physical), 'Lav og Høj har forskellig fysik');
      if (artTrial) {
        assert.deepEqual(a.readings.map(physical), b.readings.map(physical), 'Grafikændringen har påvirket fysikken');
        assert.ok(b.readings.every(row => row.stance?.artwork));
        assert.ok([1, 2, 3].every(pose => b.readings.some(row => Math.abs(row.stance.posture - pose) < .08)));
        assert.ok(b.readings.every(row => row.stance.sheetGap < 1e-6 && row.stance.tillerGap < 1e-6 &&
          row.stance.feetGap < 1e-6));
        assert.ok(b.readings.every(row => row.stance.capClearance > 0), 'Kasketten rammer bommens prøvevolumen');
      }
      if (capture) join(...folders, path.join(output, name + '.mp4'));
    }
  } finally {
    await browser.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
