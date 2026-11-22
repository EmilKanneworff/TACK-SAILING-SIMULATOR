'use strict';

const { writeFile } = require('node:fs/promises');
const { execFileSync } = require('node:child_process');
const { chromium } = require('@playwright/test');

function measure() {
  const P = SailPhysics, B = SailingBoats, D = P.DEG, knots = 3600 / 1852;
  const base = { ...P.DEFAULT_ENV, boatId: 'laser', direction: 0, gusts: 0, waves: 0,
    shelter: false, autoRecovery: false, ironsHelp: false, difficulty: 'hard', forceDiagnostics: true };
  const profile = B.get('laser');
  const log = (s, field) => {
    const f = s.forces, h = s.hydro, i = P.instruments(s, null, field);
    const section = s.sail.main.sections[1];
    const water = P.waterVelocity(s, P.waveAt(s.x, s.y, s.time, { ...field, waveCurrent: s.seaState,
      waveProfile: s.waveProfile }, Math.max(0, -s.heave)));
    const vmg = -((s.vx - water.x) * s.wind.vx + (s.vy - water.y) * s.wind.vy) / s.wind.tws;
    return { time: s.time, speed: i.waterKnots, vmg: vmg * knots,
      wind: i.tws, mastAir: section?.localAirSpeed, attack: section?.alpha / D, heel: s.heel / D, heelRate: s.heelRate / D,
      drive: s.sail.drive, sideForce: s.sail.sideForce, up: s.sail.fz ?? 0, sailRoll: f.balance?.sailRoll ?? s.sail.rollMoment,
      staticRoll: f.balance?.staticRoll ?? h.rollBuoyancy + h.rollGravity, crewRoll: h.rollCrew, netRoll: f.balance?.netRoll ?? f.roll,
      hullDrag: -f.hullF, boardDrag: -f.board?.forward, rudderDrag: -f.rudder?.forward,
      rudder: s.rudder / D, leeway: i.leeway / D, sheet: s.sheet, targetPose: s.crewPose, pose: s.crewPoseBlend,
      side: s.crewSide, actualSide: s.crewSideBlend, crewY: s.crewCG.y, crewZ: s.crewCG.z, cgZ: h.cg.z,
      mass: h.weight / profile.gravity };
  };
  const mean = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
  const sd = (rows, key) => {
    const avg = mean(rows, key);
    return Math.sqrt(rows.reduce((sum, row) => sum + (row[key] - avg) ** 2, 0) / rows.length);
  };
  const voyage = ({ wind, angle, pose, sheet, kind = 'steady', side = -1 }) => {
    const theta = (90 + side * angle) * D;
    const field = { ...base, speed: wind };
    if (kind === 'waves') {
      delete field.waves;
      Object.assign(field, { waveHeight: .38, chop: .14 });
    }
    const start = wind < 4 ? 1.05 : angle > 140 ? 3.1 : 2.8;
    const s = P.createState({ boatId: 'laser', x: 0, y: -10000, theta, vx: start * Math.cos(theta),
      vy: start * Math.sin(theta), sheet, crewSide: side, crewSideBlend: side, crewPose: pose, crewPoseBlend: pose }, field);
    const rows = [];
    const duration = kind === 'steady' ? 44 : 28;
    let maxYaw = 0, maxHeelRate = 0, maxForceJump = 0, maxSpeedJump = 0, previousDrive, previousSpeed;
    for (let tick = 0; tick < duration * 60; tick++) {
      const time = tick / 60;
      const puff = kind.startsWith('puff');
      if (puff) field.speed = wind + 4 * Math.max(0, Math.min(1, 2 * (time - 8), 2 * (12 - time)));
      const managed = kind === 'puff-managed', change = kind === 'switch';
      const targetSheet = managed && time >= 9 && time < 13.2 ? .43 : sheet;
      const crewPose = change ? (time < 8 ? 1 : time < 12 ? 2 : time < 18 ? 3 : 1)
        : managed ? (time < 8.5 ? pose : time < 11.15 ? 3 : 2) : pose;
      const steer = P.clamp(2.9 * P.wrap(s.theta - theta) + 1.55 * s.omega, -.9, .9);
      P.step(s, { steer, steerDigital: false, crewPose, trimFast: true,
        trim: P.clamp((targetSheet - s.sheet) * 8, -1, 1) }, field, 1 / 60);
      if (tick > 60) {
        maxYaw = Math.max(maxYaw, Math.abs(s.omega / D));
        maxHeelRate = Math.max(maxHeelRate, Math.abs(s.heelRate / D));
        maxForceJump = Math.max(maxForceJump, Math.abs(s.sail.drive - previousDrive));
        maxSpeedJump = Math.max(maxSpeedJump, Math.abs(s.speed - previousSpeed));
      }
      previousDrive = s.sail.drive;
      previousSpeed = s.speed;
      if ((tick + 1) % 15 === 0) rows.push({ ...log(s, field), headingError: P.wrap(s.theta - theta) / D });
      if (s.capsized) break;
    }
    const tail = rows.slice(-32), earlier = rows.slice(-64, -32);
    const summary = Object.fromEntries(Object.keys(tail[0] ?? {}).map(key => [key, mean(tail, key)]));
    const stable = !s.capsized && earlier.length === 32 && Math.abs(mean(earlier, 'speed') - summary.speed) < .15 &&
      sd(tail, 'speed') < .25 && Math.abs(mean(earlier, 'heel') - summary.heel) < 2 && sd(tail, 'heel') < 3 &&
      Math.abs(summary.headingError) < 9 && sd(tail, 'headingError') < 3;
    return { wind, angle, side, pose, sheet, kind, status: s.capsized ? 'capsized' : stable ? 'steady' : 'varying',
      elapsed: s.time, summary, spread: { speed: sd(tail, 'speed'), heel: sd(tail, 'heel'), heading: sd(tail, 'headingError') },
      peak: { yawRate: maxYaw, heelRate: maxHeelRate, driveStep: maxForceJump, speedStep: maxSpeedJump },
      ...(kind === 'steady' ? {} : { trace: rows.filter((_, i) => i % 4 === 3) }) };
  };
  const heelGrid = [];
  for (const reference of ['reach', 'close']) for (const side of [-1, 1]) for (const heel of [0, 10, 20, 30, 45]) {
    const theta = (90 + side * (reference === 'reach' ? 90 : 52)) * D;
    const field = { ...base, speed: 8.5 };
    const s = P.createState({ x: 0, y: -10000, theta, vx: 2.4 * Math.cos(theta), vy: 2.4 * Math.sin(theta),
      heel: side * -heel * D, boom: -side * (reference === 'reach' ? 48 : 20) * D, sheet: .63,
      crewPose: 2, crewSide: side, heave: .08 }, field);
    const sail = P.aero(s, field, { vx: 0, vy: -8.5 });
    heelGrid.push({ reference, side, heel: s.heel / D, area: sail.main.area, sectionPressure: sail.qArea,
      drive: sail.drive, sideForce: sail.sideForce, up: sail.fz ?? 0, roll: sail.rollMoment, pitch: sail.pitchMoment,
      yaw: sail.yawMoment, alpha: sail.alpha / D, localAirSpeed: sail.main.sections[1]?.localAirSpeed });
  }
  const cases = [];
  for (const scenario of [
    { wind: 2.5, angle: 52, sheets: [.56, .72, .84], common: .72 },
    { wind: 2.5, angle: 90, sheets: [.42, .57, .72], common: .57 },
    { wind: 8.5, angle: 52, sheets: [.55, .68, .78, .86, .93], common: .78 },
    { wind: 8.5, angle: 90, sheets: [.33, .45, .55, .64, .73], common: .55 },
    { wind: 8.5, angle: 165, sheets: [.04, .18, .32], common: .18 }
  ]) for (const pose of [1, 2, 3]) {
    for (const sheet of scenario.sheets) cases.push({ wind: scenario.wind, angle: scenario.angle, pose, sheet });
    cases.push({ wind: scenario.wind, angle: scenario.angle, pose, sheet: scenario.common, side: 1 });
  }
  cases.push({ wind: 7.5, angle: 90, pose: 2, sheet: .55, kind: 'puff-fixed' },
    { wind: 7.5, angle: 90, pose: 2, sheet: .55, kind: 'puff-managed' },
    { wind: 8.5, angle: 90, pose: 1, sheet: .45, kind: 'switch' },
    { wind: 8.5, angle: 90, pose: 3, sheet: .55, kind: 'waves' });
  const balanceGrid = [-45, -30, -20, -10, -3, 0, 3, 10, 20, 30, 45].map(heel => {
    const field = { ...base, speed: 0 };
    const s = P.createState({ x: 0, y: -10000, theta: 0, vx: 2.4, vy: 0, heel: heel * D,
      crewPose: 1, crewPoseBlend: 1, crewSide: 0, crewSideBlend: 0 }, field);
    const { rollBuoyancy, rollGravity, cg } = s.hydro;
    P.step(s, { crewPose: 1 }, field, 1 / 60);
    return { heel, hullDrag: -s.forces.hullF, rollBuoyancy, rollGravity, cg };
  });
  const field = { ...base, speed: 8.5 };
  const theta = 38 * D, step = s => P.step(s, { crewPose: 3, steerDigital: false,
    steer: P.clamp(2.9 * P.wrap(s.theta - theta) + 1.55 * s.omega, -.9, .9) }, field, 1 / 60);
  const steady = P.createState({ x: 0, y: -10000, theta, vx: 2.8 * Math.cos(theta), vy: 2.8 * Math.sin(theta),
    sheet: .78, crewPose: 3, crewPoseBlend: 3, crewSide: -1, crewSideBlend: -1 }, field);
  for (let tick = 0; tick < 36 * 60; tick++) step(steady);
  const disturbance = [-3, 3].map(delta => {
    // Each branch has a single initial perturbation. The hull then moves through forces alone.
    const s = structuredClone(steady);
    s.heel += delta * D;
    const readings = [{ second: 0, heel: s.heel / D }];
    for (let tick = 1; tick <= 8 * 60; tick++) {
      step(s);
      if (tick % 60 === 0) readings.push({ second: tick / 60, heel: s.heel / D, speed: P.instruments(s).waterKnots });
    }
    return { delta, readings, capsized: s.capsized };
  });
  return { profile: { mass: profile.mass, crew: profile.crewMass, ballast: profile.ballastMass ?? 0, sailArea: profile.sailArea },
    crewLocations: [1, 2, 3].flatMap(pose => [-1, 1].map(side => ({ pose, side, ...B.crewPose(profile, pose, side).cg }))),
    heelGrid, balanceGrid, stability: { equilibriumHeel: steady.heel / D, disturbance }, runs: cases.map(voyage) };
}

async function main() {
  const [, , output, url = 'http://localhost:4173/'] = process.argv;
  if (!output) throw Error('node scripts/laser-balance.cjs OUTPUT.json [URL]');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    const response = await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.SAILING_GAME));
    const revision = await response.headerValue('x-fri-vind-revision');
    const stamp = await page.locator('meta[name="fri-vind-revision"]').getAttribute('content');
    if (!revision || stamp !== revision) throw Error('Use a served build with a matching revision header and HTML stamp');
    const result = await page.evaluate(measure);
    const metadata = { revision, git: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      browser: browser.version(), dt: 1 / 60, steadyWindowSeconds: 8, speedUnit: 'knots', angleUnit: 'degrees',
      conditions: 'Open water, Hard, no shelter or auto-recovery, same bounded PD rudder input; trim grid records actual sheet' };
    const { runs, ...readings } = result;
    const round = (_, v) => typeof v === 'number' ? Number(v.toFixed(6)) : v;
    await writeFile(output, JSON.stringify({ ...metadata, ...readings }, round, 2).slice(0, -2) +
      ',\n  "runs": [\n    ' + runs.map(run => JSON.stringify(run, round)).join(',\n    ') + '\n  ]\n}\n');
    console.log(revision, runs.length, output);
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
