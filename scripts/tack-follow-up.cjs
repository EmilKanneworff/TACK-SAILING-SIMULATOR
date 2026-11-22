'use strict';

const { chromium } = require('@playwright/test');
const { writeFile } = require('node:fs/promises');

const dt = 1 / 60;
const average = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
const sd = (rows, key) => {
  const mean = average(rows, key);
  return Math.sqrt(rows.reduce((sum, row) => sum + (row[key] - mean) ** 2, 0) / rows.length);
};

function installProbe() {
  const P = SailPhysics, D = P.DEG;
  window.readBoat = (s, field, control = {}) => {
    const i = P.instruments(s, null, field), f = s.forces, ledger = f.ledger, motion = s.massMotion;
    const cg = motion?.cg ?? s.hydro.cg, v = P.pointMotion(s, P.bodyOffset(s, cg));
    const drift = P.bodyOffset(s, motion?.rate ?? { x: 0, y: 0, z: 0 }), a = P.axes(s.theta);
    const cgX = v.x + a.fx * drift.f + a.rx * drift.r, cgY = v.y + a.fy * drift.f + a.ry * drift.r;
    const flow = P.waterVelocity(s, P.waveAt(s.x, s.y, s.time, { ...field, waveCurrent: s.seaState,
      waveProfile: s.waveProfile }, Math.max(0, -s.heave)));
    const waterX = s.vx - flow.x, waterY = s.vy - flow.y;
    const waterBearing = P.wrap360(Math.atan2(waterX, waterY) / D);
    return { time: s.time, x: s.x, y: s.y, wind: i.tws, windFrom: i.twd, heading: i.heading, course: i.course,
      waterBearing, trackAngle: Math.abs(P.wrap((waterBearing - i.twd) * D) / D), leeway: i.leeway / D,
      knots: i.waterKnots, vmg: i.vmgWind * 3600 / 1852, heel: s.heel / D, yawRate: s.omega / D,
      rudder: s.rudder / D, sheet: s.sheet, boom: s.boom / D, pose: s.crewPose, actualPose: s.crewPoseBlend,
      side: s.crewSide, actualSide: s.crewSideBlend, foreAft: s.crewForeAft ?? 0, crewCG: s.crewCG,
      placeAhead: control.foreAft ?? 0, difficulty: s.crewDifficulty, assist: Boolean(s.helmAssist?.active),
      steer: control.steer ?? 0, drive: s.sail.drive, originSpeed: i.speed, vx: s.vx, vy: s.vy,
      cgSpeed: Math.hypot(cgX, cgY), cgX, cgY, yawOrigin: f.yaw, yawCG: f.balance?.yawAboutCG,
      yawWater: f.balance?.yawWater, yawApplied: f.balance?.yawApplied, yawInertia: f.balance?.yawInertia,
      yawTerms: ledger && Object.fromEntries(Object.entries(ledger).map(([name, row]) => [name, row.moment.yaw])),
      capsized: s.capsized, ground: s.ground?.contact ?? false, shown: Number(document.querySelector('#speed').textContent) };
  };
  const step = P.step;
  P.step = function (state, control, field, stepSize) {
    const result = step(state, control, field, stepSize);
    if (window.followUpTrace && state === SAILING_GAME.state) window.followUpTrace.push(readBoat(state, field, control));
    return result;
  };
}

async function seed(page, options) {
  await page.evaluate(({ wind, angle, pose, sheet }) => {
    const P = SailPhysics, { env, state } = SAILING_GAME;
    Object.assign(env, { speed: wind, direction: 0, gusts: 0, waveHeight: 0, chop: 0,
      shelter: false, difficulty: 'hard', autoRecovery: false, ironsHelp: false });
    const theta = (90 - angle) * P.DEG, speed = wind < 4 ? 1.0 : 2.8;
    const fresh = P.createState({ boatId: 'laser', x: 0, y: -10000, time: state.time, theta,
      vx: speed * Math.cos(theta), vy: speed * Math.sin(theta), sheet, crewPose: pose, crewPoseBlend: pose,
      crewSide: -1, crewSideBlend: -1, crewForeAft: 0 }, env);
    for (const key of Object.keys(state)) if (!Object.hasOwn(fresh, key)) delete state[key];
    Object.assign(state, fresh);
    state.windClimate = { speed: wind, direction: 0, gusts: 0 };
    SailingWeather.initialize(state, env);
    window.followUpTrace = [];
    const slider = document.querySelector('#sheetControl');
    slider.value = String(sheet * 100);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#sea').focus({ preventScroll: true });
  }, options);
  await page.keyboard.press(String(options.pose));
}

async function sailOnHeading(page, heading, milliseconds) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 500) {
    const response = await page.evaluate(heading => {
      const P = SailPhysics, s = SAILING_GAME.state;
      return { stopped: s.capsized, steer: P.wrap(s.theta - heading) / P.DEG + .55 * s.omega / P.DEG };
    }, heading);
    if (response.stopped) break;
    const duration = Math.min(250, Math.max(0, Math.round((Math.abs(response.steer) - .7) * 22)));
    if (duration) {
      const key = response.steer > 0 ? 'ArrowRight' : 'ArrowLeft';
      await page.keyboard.down(key);
      await page.clock.runFor(duration);
      await page.keyboard.up(key);
    }
    await page.clock.runFor(500 - duration);
  }
}

async function fromPlayer(page) {
  const plans = [];
  const add = (wind, angle, sheets, group, seconds = 24) => sheets.forEach((sheet, i) =>
    plans.push({ wind, angle, sheet, pose: i + 1, group, seconds }));
  add(8.5, 52, [.78, .78, .78], 'same');
  plans.push({ wind: 8.5, angle: 52, sheet: .86, pose: 3, group: 'individual', seconds: 32 });
  add(8.5, 90, [.33, .33, .33], 'undertrim');
  add(2.5, 52, [.56, .56, .56], 'light', 28);
  plans.push({ wind: 9 * 1852 / 3600, angle: 50, sheet: .825, pose: 2, group: 'reference', seconds: 28 },
    { wind: 12 * 1852 / 3600, angle: 50, sheet: .78, pose: 2, group: 'reference', seconds: 28 });
  const readings = [];
  for (const plan of plans) {
    await seed(page, plan);
    await sailOnHeading(page, (90 - plan.angle) * Math.PI / 180, plan.seconds * 1000);
    const rows = await page.evaluate(() => followUpTrace);
    const tail = rows.slice(-480), earlier = rows.slice(-960, -480);
    const keys = ['wind', 'windFrom', 'heading', 'course', 'waterBearing', 'trackAngle', 'leeway', 'knots', 'vmg',
      'heel', 'rudder', 'sheet', 'boom', 'pose', 'actualPose', 'side', 'actualSide', 'foreAft', 'shown', 'placeAhead'];
    const mean = Object.fromEntries(keys.map(key => [key, average(tail, key)]));
    const drift = mean.heading - plan.angle;
    const steady = !rows.at(-1)?.capsized && earlier.length === 480 && Math.abs(average(earlier, 'knots') - mean.knots) < .22 &&
      Math.abs(average(earlier, 'heel') - mean.heel) < 3 && sd(tail, 'knots') < .35 && Math.abs(drift) < 8 && sd(tail, 'heading') < 3;
    readings.push({ ...plan, status: rows.at(-1)?.capsized ? 'capsized' : steady ? 'steady' : 'varying',
      measuredSeconds: tail.length * dt, means: mean, headingBias: drift, speedSD: sd(tail, 'knots'),
      difficulty: tail.at(-1)?.difficulty, help: tail.some(row => row.assist), ground: rows.some(row => row.ground),
      samples: rows.filter((_, i) => i % 60 === 59) });
    console.log(plan.group, plan.wind, plan.pose, plan.sheet, readings.at(-1).status, mean.knots.toFixed(2));
  }
  return readings;
}

async function shiftFromPlayer(page) {
  const plan = { wind: 8.5, angle: 90, sheet: .45, pose: 3 };
  await seed(page, plan);
  await sailOnHeading(page, 0, 12000);
  const transitions = [];
  for (const to of [1, 3]) {
    await page.evaluate(() => { window.followUpTrace = [readBoat(SAILING_GAME.state, SAILING_GAME.env)]; });
    await page.keyboard.press(String(to));
    await page.clock.runFor(2100);
    const rows = await page.evaluate(() => followUpTrace);
    const actualDt = rows[1].time - rows[0].time;
    const end = rows.find(row => Math.abs(row.actualPose - to) < .05);
    const summarize = (speed, x, y) => ({
      step: Math.max(...rows.slice(1).map((r, i) => Math.abs(r[speed] - rows[i][speed]))),
      acceleration: Math.max(...rows.slice(1).map((r, i) => Math.hypot(r[x] - rows[i][x], r[y] - rows[i][y]) / actualDt))
    });
    transitions.push({ to, dt: actualDt, duration: end ? end.time - rows[0].time : null,
      origin: summarize('originSpeed', 'vx', 'vy'), cg: summarize('cgSpeed', 'cgX', 'cgY'),
      capsized: rows.some(row => row.capsized), rows });
  }
  return transitions;
}

function yawTrials() {
  const P = SailPhysics, D = P.DEG;
  return [-1, 1].flatMap(side => {
    const theta = (90 + side * 52) * D;
    const env = { ...P.DEFAULT_ENV, boatId: 'laser', direction: 0, speed: 8.5, gusts: 0, waves: 0,
      forceDiagnostics: true, shelter: false, autoRecovery: false, ironsHelp: false, difficulty: 'hard' };
    const initial = P.createState({ x: 0, y: -10000, theta, vx: 2.8 * Math.cos(theta), vy: 2.8 * Math.sin(theta),
      crewPose: 3, crewPoseBlend: 3, crewSide: side, crewSideBlend: side, sheet: .78 }, env);
    for (let i = 0; i < 1800; i++) P.step(initial, { crewPose: 3, steerDigital: false,
      steer: P.clamp(2.9 * P.wrap(initial.theta - theta) + 1.55 * initial.omega, -.9, .9) }, env, 1 / 60);
    return ['neutral', 'rudder-pulse', 'gust', 'ease', 'ease-loaded', 'stationary-broad-reach'].map(name => {
      const field = { ...env };
      const s = name === 'stationary-broad-reach'
        ? P.createState({ x: 0, y: -10000, theta: (90 + side * 153) * D, vx: 0, vy: 0, sheet: .35,
          crewPose: 2, crewSide: side }, field) : structuredClone(initial);
      if (name === 'ease-loaded') {
        for (let i = 0; i < 720; i++) P.step(s, { crewPose: 3, steerDigital: false,
          steer: P.clamp(2.9 * P.wrap(s.theta - theta) + 1.55 * s.omega, -.9, .9),
          trim: s.sheet < .86 ? .35 : 0, trimFast: true }, field, 1 / 60);
      }
      const start = readBoat(s, field);
      const rows = [];
      for (let tick = 0; tick < (name === 'stationary-broad-reach' ? 120 : 360); tick++) {
        const t = tick / 60;
        if (name === 'gust') field.speed = 8.5 + 2 * Math.max(0, Math.min(1, 2 * (t - 1), 2 * (3 - t)));
        const control = { crewPose: s.crewPose, steerDigital: false,
          steer: name === 'rudder-pulse' && t < .5 ? -.26 * side : 0,
          trimFast: true, trim: t >= 1 && (
            (name === 'ease' && s.sheet > .52) || (name === 'ease-loaded' && s.sheet > .78)
          ) ? -.55 : 0 };
        P.step(s, control, field, 1 / 60);
        if (tick === 0 || (tick + 1) % 15 === 0) rows.push(readBoat(s, field, control));
        if (s.capsized) break;
      }
      return { side, name, start, rows };
    });
  });
}

function coastalTrials() {
  const P = SailPhysics, W = SailingWorld, B = SailingBoats, D = SailingWaterDepth;
  const { x } = ArchipelagoData.fromMetric(230, 0);
  const coast = W.ISLANDS.find(i => i.id === 'fyn').chartCoast;
  const crossings = coast.slice(1).flatMap((b, i) => {
    const a = coast[i];
    return (a.x > x) !== (b.x > x) ? [{ a, b, y: a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x) }] : [];
  });
  const { a, b, y } = crossings.sort((a, b) => a.y - b.y)[0];
  const bj = W.ISLANDS.find(i => i.id === 'bjoernoe' || i.id === 'bjorno' || i.name === 'Bjørnø').points;
  const edges = bj.map((a, i) => {
    const b = bj[(i + 1) % bj.length];
    return { a, b, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, length: Math.hypot(b.x - a.x, b.y - a.y) };
  }).sort((a, b) => a.y - b.y);
  const beach = edges.slice(0, 12).sort((a, b) => b.length - a.length)[0];
  function establish(name, x, y, a, b) {
    const theta = Math.atan2(b.y - a.y, b.x - a.x);
    const dx = -Math.sin(theta), dy = Math.cos(theta);
    const sign = W.sample(x + dx * 4, y + dy * 4).distance > W.sample(x - dx * 4, y - dy * 4).distance ? 1 : -1;
    return { name, x, y, theta, dx: sign * dx, dy: sign * dy, sign };
  }
  const fyn = establish('Faaborg', x, y, a, b);
  const island = establish('Bjørnø', beach.x, beach.y, beach.a, beach.b);
  const field = { ...P.DEFAULT_ENV, speed: 0, direction: 180, gusts: 0, waveHeight: 0, chop: 0,
    swellDirection: 165, wavePeriod: 3.8,
    autoRecovery: false, ironsHelp: false, difficulty: 'hard', shelter: true };
  function run(area, name, boatId, offset, degrees, turn, waves = 0) {
    const env = { ...field, boatId, waveHeight: waves, waves, chop: waves > 0 ? .12 : 0 };
    const theta = area.theta + area.sign * degrees * P.DEG, speed = 3;
    const s = P.createState({ boatId, x: area.x + area.dx * offset, y: area.y + area.dy * offset,
      theta, vx: speed * Math.cos(theta), vy: speed * Math.sin(theta), sheet: .05,
      heel: waves > 0 ? 12 * P.DEG : 0, crewPose: 1, crewPoseBlend: 1 }, env);
    const frames = [];
    const shot = () => ({ time: s.time, x: s.x, y: s.y, heading: P.wrap360(90 - s.theta / P.DEG), heel: s.heel / P.DEG,
      speed: Math.hypot(s.vx, s.vy), distance: W.sample(s.x, s.y).distance, heave: s.heave,
      wave: P.waveAt(s.x,s.y,s.time,env).height, contact: s.ground?.contact ?? false,
      part: s.ground?.part, point: s.ground?.point, force: s.ground?.peak });
    frames.push(shot());
    for (let i = 0; i < 420; i++) {
      const target = turn !== null && i >= 60 * turn ? area.theta + area.sign * 72 * P.DEG : theta;
      P.step(s, { crewPose: 1, steerDigital: false,
        steer: P.clamp(2.7 * P.wrap(s.theta - target) + 1.05 * s.omega, -.7, .7) }, env, 1 / 60);
      frames.push(shot());
    }
    const contacts = frames.filter(row => row.contact), peak = contacts.reduce((max, row) => !max || row.force > max.force ? row : max, null);
    return { area: area.name, name, boatId, offset, waves, start: frames[0], end: frames.at(-1),
      closest: Math.min(...frames.map(row => row.distance)), framesInContact: contacts.length, peak,
      maxStep: Math.max(...frames.slice(1).map((r, i) => Math.abs(r.speed - frames[i].speed))),
      maxWaveStep: Math.max(...frames.slice(1).map((r, i) => Math.abs(r.wave - frames[i].wave))),
      samples: frames.filter((_, i) => i % 30 === 0) };
  }
  const tips = [['ac75', 7, 58.05, 7.4846, -1.5254], ['ac72', 8.8, 58.3, 6.679, -3.28965]].map(([boatId, offset, tx, ty, tz]) => {
    const env = { ...field, boatId };
    const s = P.createState({ boatId, x, y: y - offset, theta: 0, vx: 0, vy: 0 }, env);
    const loads = W.contact(s, B.get(boatId), env);
    const tip = { x: tx, y: ty, z: tz };
    return { boatId, offset, contact: loads.contact, part: loads.part, point: loads.point, tip,
      bedAtTip: W.heightAt(tip.x, tip.y) };
  });
  const depth = [fyn, island].map(site => {
    const env = { ...field, speed: 8, direction: site.name === 'Faaborg' ? 180 : 135, waveHeight: .45, chop: .12 };
    const line = Array.from({ length: 81 }, (_, i) => {
      const offset = i / 4, x = site.x + site.dx * offset, y = site.y + site.dy * offset;
      return { offset, bottom: -W.heightAt(x, y), cached: D.sample(x, y).depth, wave: P.waveAt(x, y, 9, env).height };
    });
    return { site: site.name, line,
      maxWaveDifference: Math.max(...line.slice(1).map((p, i) => Math.abs(p.wave - line[i].wave))) };
  });
  return { fyn, island, tips, depth, routes: [
    run(fyn, 'parallel clear of projection', 'ac72', 23, 0, null),
    run(fyn, 'parallel toward projection', 'ac72', 15, 0, null),
    run(fyn, 'approach and depart', 'laser', 10, -37, .75),
    run(fyn, 'turn near shore', 'dinghy', 10, -35, 1.3, .32),
    run(island, 'parallel and heeled', 'ac75', 14, 0, null, .38),
    run(island, 'approach and depart', 'laser', 8, -45, .95, .42),
    run(island, 'heading to the beach', 'yacht', 11, -75, null, .32)
  ] };
}

async function main() {
  const [, , output, url = 'http://localhost:4173/', mode = 'all'] = process.argv;
  if (!output) throw Error('node scripts/tack-follow-up.cjs OUTPUT.json [URL] [all|shift|coast|yaw|player]');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
    await page.clock.install();
    const response = await page.goto(url);
    const revision = await response.headerValue('x-fri-vind-revision');
    const stamp = await page.locator('meta[name="fri-vind-revision"]').getAttribute('content');
    if (!revision || stamp !== revision) throw Error('Revision stamp mismatch');
    await page.selectOption('#introDifficulty', 'hard');
    await page.click('#startButton');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500));
    await page.evaluate(installProbe);
    await page.keyboard.press('Backquote');
    const player = ['all', 'player'].includes(mode) ? await fromPlayer(page) : [];
    const shifts = ['all', 'shift'].includes(mode) ? await shiftFromPlayer(page) : [];
    const yaw = ['all', 'yaw'].includes(mode) ? await page.evaluate(yawTrials) : [];
    const coastal = ['all', 'coast'].includes(mode) ? await page.evaluate(coastalTrials) : undefined;
    const round = (_, v) => typeof v === 'number' ? Number(v.toFixed(7)) : v;
    await writeFile(output, JSON.stringify({ revision, browser: browser.version(), dt, player, shifts, yaw, coastal }, round, 2) + '\n');
    console.log(revision, output, shifts.map(({ to, dt, duration, origin, cg }) => ({ to, dt, duration, origin, cg })));
  } finally { await browser.close(); }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
