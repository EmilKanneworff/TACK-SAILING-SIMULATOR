'use strict';

const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: wait } = require('node:timers/promises');
const { chromium } = require('@playwright/test');
const { introOption } = require('./browser-setup.cjs');

const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const presets = {
  'laser-start': { wind: 5.5, settle: 6500, right: 1250, left: 1800 },
  'laser-tacks': {
    wind: 8.5, direction: 180,
    route: [
      { label: 'Launch on a reach', ms: 8000, heading: 248, sheet: .50 },
      { label: 'Enter close-hauled', ms: 6500, heading: 232, sheet: .67, pose: 2, side: 'q' },
      { label: 'Tack east through the wind', ms: 5200, heading: 135, pose: 1, cross: 180, crossSide: 1 },
      { label: 'Cross the cockpit to starboard', ms: 1600, heading: 140, pose: 1, side: 'e' },
      { label: 'Settle on the east tack', ms: 9500, heading: 130, sheet: .70, pose: 2 },
      { label: 'Tack west through the wind', ms: 5200, heading: 228, pose: 1, cross: 180, crossSide: -1 },
      { label: 'Cross the cockpit to port', ms: 1600, heading: 220, pose: 1, side: 'q' },
      { label: 'Settle on the west tack', ms: 8200, heading: 228, pose: 2 }
    ]
  },
  'laser-gybe': {
    wind: 8.5, modes: ['hard'],
    route: [
      { label: 'Build speed on a reach', ms: 10500, heading: 95, sheet: .42, pose: 2, side: 'q' },
      { label: 'Bear away', ms: 2800, heading: 130, pose: 2 },
      { label: 'Prepare to gybe', ms: 2500, heading: 155, sheet: .54, pose: 1 },
      { label: 'Gybe across downwind', ms: 3000, heading: 193, pose: 1, cross: 180, crossSide: -1 },
      { label: 'Cross the cockpit to starboard', ms: 2400, heading: 197, pose: 1, side: 'e' },
      { label: 'Sail away', ms: 3000, heading: 202, pose: 2 }
    ]
  },
  racer: { boat: 'dinghy', wind: 10, settle: 6500, right: 1250, left: 1800 },
  cruiser: { boat: 'yacht', wind: 9, modes: ['hard'], settle: 21000, right: 2000, left: 4000 },
  'mono-hull': { boat: 'ac75', wind: 5.5, modes: ['hard'], settle: 8500, right: 700, left: 1000 },
  'cat-hull': { boat: 'ac72', wind: 5.5, modes: ['hard'], settle: 8500, right: 900, left: 1000 },
  'mono-flight': { boat: 'ac75', wind: 14, modes: ['hard'], settle: 6500, right: 240, left: 480 },
  'cat-flight': { boat: 'ac72', wind: 14, modes: ['hard'], settle: 6500, right: 240, left: 480 },
  'control-chain': {
    wind: 5.5, direction: 180, wave: 1.5, modes: ['hard'], location: 'open',
    plan: [
      ['Fri sejlads', 5500, []],
      ['Ror mod styrbord', 650, ['ArrowRight']],
      ['Ror mod bagbord', 650, ['ArrowLeft']],
      ['Vægt på kanten og agter', 1200, ['2', 'z']],
      ['Vægt frem', 1800, ['x']],
      ['Fuldt indhalet', 4100, ['@sheet:100']],
      ['Fuldt slækket', 4400, ['@sheet:0']],
      ['Hal ind igen', 4400, ['@sheet:100']],
      ['Ét reb og trim', 2600, ['@reef:1', '@sheet:52']],
      ['To reb', 2200, ['@reef:2']],
      ['Styrbord ved sejladsfart', 650, ['ArrowRight']],
      ['Bagbord ved sejladsfart', 650, ['ArrowLeft']]
    ]
  },
  controls: {
    wind: 5.5, modes: ['hard'],
    plan: [
      ['Sail', 5000, []],
      ['Look at the chart, then steer', 500, ['@map', 'ArrowRight']],
      ['Move the trim slider, then countersteer', 650, ['@trim', 'ArrowLeft']],
      ['Move crew to the edge', 350, ['2']],
      ['Move crew fully out', 350, ['3', 'e', 'z']],
      ['Move crew forward', 550, ['x']],
      ['Pause with helm held', 800, ['@pause', 'ArrowRight']],
      ['Restart with helm held', 250, ['@restart', 'ArrowRight']],
      ['Change boat with helm held', 250, ['@boat', 'ArrowLeft']],
      ['Read the build in the Model panel', 250, ['@model']],
      ['Steer after changing boats', 600, ['ArrowRight']]
    ]
  }
};

async function installTrace(page) {
  await page.addInitScript(() => {
    const trace = window.tackTrace = { events: [], frames: [] };
    const push = (buffer, value, limit) => {
      buffer.push(value);
      if (buffer.length > limit) buffer.shift();
    };
    for (const event of ['keydown', 'keyup', 'blur', 'focus', 'visibilitychange', 'pointerdown', 'pointerup', 'pointercancel']) {
      window.addEventListener(event, e => push(trace.events,
        [performance.now(), e.type, e.code || '', e.target?.id || ''], 50), true);
    }
    let previous;
    const frame = now => {
      if (previous !== undefined) push(trace.frames, now - previous, 400);
      previous = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

async function sample(page) {
  return page.evaluate(() => {
    const game = SAILING_GAME;
    const s = game.state;
    const P = SailPhysics;
    const D = P.DEG;
    const axis = P.axes(s.theta);
    const forces = s.forces;
    const rudder = forces.rudder;
    const wave = P.waveAt(s.x, s.y, s.time,
      { ...game.env, waveCurrent: s.seaState, waveProfile: s.waveProfile }, Math.max(0, -s.heave));
    const water = P.waterVelocity(s, wave);
    const east = s.vx - water.x;
    const north = s.vy - water.y;
    return {
      t: s.time, x: s.x, y: s.y, boat: s.boatId, speed: s.speed,
      surge: east * axis.fx + north * axis.fy, sway: east * axis.rx + north * axis.ry,
      heading: P.wrap360(90 - s.theta / D), yaw: -s.omega / D, heel: s.heel / D,
      wind: s.wind.tws, from: s.wind.twd, twa: s.wind.twa / D, awa: s.wind.awa / D,
      depth: s.ground?.depth ?? -SailingWorld.heightAt(s.x, s.y), ground: s.ground?.contact,
      cap: s.capsized, recovering: s.recovering, foil: s.foiling?.support?.phase,
      input: s.steerIntent, target: (s.helmTarget ?? 0) / D, rudder: s.rudder / D,
      sheet: s.sheet, crew: s.crewPoseBlend, side: s.crewSideBlend, foreAft: s.crewForeAft,
      boom: s.boom / D, tacks: s.tackCount, gybes: s.gybeCount,
      trim: game.sheetDiagnostics, pitch: s.pitch / D, cg: s.hydro?.cg, waveHeight: wave.height,
      referenceWave: s.seaState, reef: s.cruiserRig?.reef ?? s.rig?.reef,
      sailArea: s.sail?.main?.area, sailLuffScale: s.sail?.main?.luffScale, sailChordScale: s.sail?.main?.chordScale,
      sailVertical: s.sail?.fz, displacement: s.hydro?.submergedVolume, support: s.hydro?.buoyancy,
      hullDrag: forces.hullF, renderedRudder: game.scene.rudder?.rotation.y,
      rudders: rudder?.parts || Object.values(s.foils || {}).flatMap(f => f.rudderBlade ? [f.rudderBlade] : []),
      wet: rudder?.strutEffectiveWet ?? rudder?.wet, axial: rudder?.axialFlow ?? s.steering?.localForward,
      stall: rudder?.stall, ventilation: rudder?.ventilation,
      yawRudder: forces.yawRudder, yawSail: forces.yawSail ?? s.sail.yawMoment,
      hullSide: forces.hullR ?? s.hydro?.hullR, damping: forces.yawDamping, assistance: forces.yawAssist,
      focus: document.activeElement?.id, paused: game.paused, hidden: document.hidden,
      wall: performance.now(), frame: game.scene.renderer.info.render.frame, quality: game.scene.quality
    };
  });
}

function angleTo(target, current) {
  return (target - current + 540) % 360 - 180;
}

async function sailRoute(page, tick, route, snapshots) {
  const inputs = [];
  let held;
  async function helm(key) {
    if (key === held) return;
    if (held) await page.keyboard.up(held);
    held = key;
    if (held) await page.keyboard.down(held);
  }
  // Read the instruments between key presses without assigning anything to the simulation.
  for (const leg of route) {
    const before = await sample(page);
    if (leg.pose) {
      await page.keyboard.press(String(leg.pose));
      inputs.push([leg.label, 0, String(leg.pose)]);
    }
    if (leg.side) {
      await page.keyboard.press(leg.side);
      inputs.push([leg.label, 0, leg.side]);
    }
    if (leg.sheet !== undefined) {
      const sign = Math.sign(leg.sheet - before.sheet);
      const rate = await page.evaluate(direction => {
        const { state, env } = SAILING_GAME;
        return SailPhysics.sheetRateFor(SailPhysics.configFor(state), direction, true, env.difficulty) * env.controlRate;
      }, sign);
      const duration = Math.round(1000 * Math.abs(leg.sheet - before.sheet) / rate);
      const key = sign > 0 ? 'ArrowUp' : 'ArrowDown';
      if (duration > 0) {
        await page.keyboard.down(key);
        await tick(duration);
        await page.keyboard.up(key);
        inputs.push([leg.label, duration, key]);
      }
    }
    for (let remaining = leg.ms; remaining > 0; remaining -= 200) {
      const s = await sample(page);
      if (s.cap || s.ground) break;
      const aim = angleTo(leg.heading, s.heading) - s.yaw * .28;
      await helm(Math.abs(aim) >= (leg.deadband ?? 4) ? aim > 0 ? 'ArrowRight' : 'ArrowLeft' : undefined);
      const ms = Math.min(200, remaining);
      await tick(ms);
      inputs.push([leg.label, ms, held || 'neutral']);
      if (leg.cross !== undefined && Math.sign(angleTo(s.heading, leg.cross)) !== leg.crossSide) break;
    }
    await helm(undefined);
    snapshots.push({ label: leg.label, ...await sample(page) });
  }
  return inputs;
}

async function runPlan(page, tick, plan, snapshots, captureDir) {
  for (const [index, [label, ms, actions]] of plan.entries()) {
    for (const action of actions) {
      if (action.startsWith('@sheet:')) await page.locator('#sheetControl').fill(action.slice(7));
      if (action.startsWith('@reef:')) await page.selectOption('#reefSetting', action.slice(6));
    }
    if (actions.includes('@trim')) {
      const rect = await page.locator('#sheetControl').boundingBox();
      await page.mouse.click(rect.x + rect.width * .45, rect.y + rect.height / 2);
    }
    if (actions.includes('@map')) {
      await page.locator('#courseCard').hover();
      await page.locator('#mapView').focus();
      await page.selectOption('#mapView', 'area');
      await page.mouse.move(10, 220);
    }
    const keys = actions.filter(key => !key.startsWith('@'));
    for (const key of keys) await page.keyboard.down(key);
    if (actions.includes('@pause')) {
      await tick(200);
      await page.keyboard.press('Space');
      const before = await sample(page);
      await tick(ms);
      snapshots.push({ label: 'Paused', ...before }, { label: 'Before resuming', ...await sample(page) });
      await page.locator('#resumeButton').click();
    }
    if (actions.includes('@restart')) {
      await tick(200);
      await page.keyboard.press('KeyR');
    }
    if (actions.includes('@boat')) {
      await tick(200);
      await page.keyboard.press('KeyB');
      await page.locator('[data-boat="dinghy"]').click();
    }
    if (actions.includes('@model')) {
      await page.click('#telemetryToggle');
      await page.click('#detailsButton');
      const model = await page.locator('#configSummary').textContent();
      snapshots.push({ label: 'Model panel', build: model.split('\n')[0] });
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    }
    await tick(ms);
    snapshots.push({ label, ...await sample(page) });
    if (captureDir) await page.screenshot({ path: path.join(captureDir, String(index + 1).padStart(2, '0') + '.jpg'), type: 'jpeg', quality: 80 });
    for (const key of keys) await page.keyboard.up(key);
  }
  return plan;
}

async function run(browser, cfg, url, name, difficulty) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    if (cfg.saved) {
      const settings = JSON.parse(fs.readFileSync(cfg.saved, 'utf8'));
      await page.addInitScript(data => {
        for (const [key, value] of Object.entries(data)) {
          if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
        }
      }, settings);
    }
    await installTrace(page);
    if (!cfg.real) await page.clock.install();
    const response = await page.goto(url);
    await page.locator('#startButton:enabled').waitFor({ timeout: 15000 });
    const persisted = await page.evaluate(() => {
      const e = SAILING_GAME.env;
      return { wind: e.speed, direction: e.direction, waves: e.waveHeight, difficulty: e.difficulty,
        quality: document.getElementById('quality').value };
    });
    if (cfg.boat) await (await introOption(page, '#introBoat')).selectOption(cfg.boat);
    await page.selectOption('#introDifficulty', difficulty);
    if (!cfg.useSaved) {
      await (await introOption(page, '#introWeatherEdit')).click();
      const weather = { windSpeed: cfg.wind ?? 5.5, windDirection: cfg.direction ?? 0,
        waveHeight: cfg.wave ?? 0, chop: 0, windGusts: 0 };
      for (const [id, value] of Object.entries(weather)) await page.locator('#' + id).fill(String(value));
      await page.keyboard.press('Escape');
    }
    await page.click(cfg.race ? '#introCourse' : '#startButton');
    if (cfg.location) {
      await page.click('#preferencesButton');
      await page.click('#startLocationButton');
      await page.selectOption('#startLocationPreset', cfg.location);
      await page.click('#startAtLocation');
    }
    const tick = ms => cfg.real ? page.waitForTimeout(ms) : page.clock.runFor(ms);
    await page.evaluate(() => { tackTrace.frames.length = 0; });
    const snapshots = [{ label: 'Menu start', ...await sample(page) }];
    const plan = cfg.plan ?? [
      ['Build speed', cfg.settle ?? 2400, []],
      ['Starboard', cfg.right ?? 770, ['ArrowRight']],
      ['Counter to port', cfg.left ?? 1050, ['ArrowLeft']],
      ['Neutral', 550, []],
      ['Sheet in', 380, ['ArrowUp']],
      ['Ease', 480, ['ArrowDown']],
      ['Sail', 1800, []]
    ];
    const captureDir = process.env.TACK_CAPTURE_DIR ? path.resolve(process.env.TACK_CAPTURE_DIR, name + '-' + difficulty) : undefined;
    if (captureDir) fs.mkdirSync(captureDir, { recursive: true });
    const inputPlan = cfg.route ? await sailRoute(page, tick, cfg.route, snapshots)
      : await runPlan(page, tick, plan, snapshots, captureDir);
    console.log(JSON.stringify({
      name, url, difficulty, browser: browser.version(), persisted, boat: cfg.boat || 'laser',
      revision: await response.headerValue('x-fri-vind-revision'), errors, snapshots, inputPlan,
      trace: await page.evaluate(() => tackTrace)
    }));
  } finally {
    await context.close();
  }
}

async function checkBrowserTabs(url, race) {
  // Connect to a clean, real Chrome window without Playwright's default focus emulation.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tack-tab-chrome-'));
  const chrome = spawn(chromePath, [
    '--user-data-dir=' + profile, '--remote-debugging-port=0', '--no-first-run',
    '--no-default-browser-check', '--enable-unsafe-swiftshader', '--window-size=1280,800', 'about:blank'
  ], { stdio: 'ignore' });
  const closed = once(chrome, 'close');
  let browser;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 80 && !fs.existsSync(portFile); i++) {
      if (chrome.exitCode !== null) throw Error('Chrome exited before opening its local debugging port');
      await wait(100);
    }
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    browser = await chromium.connectOverCDP('http://127.0.0.1:' + port, { noDefaults: true });
    const context = browser.contexts()[0];
    const sailing = context.pages()[0];
    await installTrace(sailing);
    const response = await sailing.goto(url);
    const start = sailing.locator(race ? '#introCourse' : '#startButton');
    await start.waitFor();
    await start.click();
    await wait(3500);
    await sailing.keyboard.down('ArrowRight');
    await wait(350);
    const before = await sample(sailing);
    const other = await context.newPage();
    await other.goto('data:text/html,<title>Focus check</title><p>Second tab');
    await other.bringToFront();
    await wait(1200);
    const background = await sample(sailing);
    await sailing.bringToFront();
    await wait(350);
    const returned = await sample(sailing);
    if (race) await sailing.locator('#resumeButton').click();
    await wait(350);
    const resumed = await sample(sailing);
    await sailing.keyboard.up('ArrowRight');
    console.log(JSON.stringify({
      browser: browser.version(), revision: await response.headerValue('x-fri-vind-revision'),
      race, before, background, returned, resumed, trace: await sailing.evaluate(() => tackTrace)
    }));
    if (!background.hidden || !background.paused || returned.hidden || returned.paused !== race ||
        resumed.paused || resumed.input !== 0 || resumed.t - before.t > 1) {
      throw Error('Tab change did not pause and resume cleanly');
    }
  } finally {
    await browser?.close();
    chrome.kill();
    await closed;
    fs.rmSync(profile, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
  }
}

async function main() {
  const arg = process.argv[2] || 'laser-start';
  const url = process.env.TACK_URL || 'http://localhost:4173/';
  if (arg === 'focus' || arg === 'focus-race') return checkBrowserTabs(url, arg === 'focus-race');
  const custom = arg.startsWith('{');
  const cfg = custom ? JSON.parse(arg) : presets[arg];
  if (!cfg) throw Error('Choose an input replay: ' + Object.keys(presets).join(', '));
  const browser = await chromium.launch({
    executablePath: chromePath,
    args: ['--enable-unsafe-swiftshader']
  });
  try {
    for (const [address, name] of cfg.urls ?? [[url, cfg.name || (custom ? 'custom' : arg)]]) {
      for (const difficulty of cfg.modes ?? ['easy', 'hard']) await run(browser, cfg, address, name, difficulty);
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
