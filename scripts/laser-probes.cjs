'use strict';

const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createSimulation } = require('../assets/simulation/node');

const dt = 1 / 60;
const calm = { boatId: 'laser', speed: 0, direction: 0, gusts: 0, waveHeight: 0, chop: 0,
  windSeed: 55, waveSeed: 127, shelter: false, difficulty: 'hard', ironsHelp: false };
const openSea = { x: 0, y: -12000, theta: 0, vx: 0, vy: 0, crewPose: 1, crewSide: 0 };

function run(runtime) {
  const P = runtime.physics, B = runtime.profiles, c = P.configFor('laser');
  const round = n => Number.isFinite(n) ? +n.toFixed(5) : null;
  const toDeg = n => round(n / P.DEG);
  const snapshot = (state, env) => {
    const q = state.forces, rudder = q.rudder, a = P.axes(state.theta);
    const water = P.instruments(state, null, env);
    const wave = { ...env, waveCurrent: state.seaState, waveProfile: state.waveProfile };
    const bow = P.bowWaterContact(state, c, wave);
    const stern = P.waterContact(state, { x: -1.7, y: B.hullBottom(c, -1.7, 0), z: 0 }, wave);
    return { t: round(state.time), heading: water.heading, waterSpeed: water.waterSpeed, mass: state.hydro.weight / c.gravity,
      heel: toDeg(state.heel), pitch: toDeg(state.pitch), yawRate: toDeg(-state.omega),
      steer: q.steering?.received, requestedRudder: toDeg(q.steering?.target), rudder: toDeg(state.rudder),
      rudderRate: toDeg(q.steering?.rudderRate), rudderWet: rudder?.wet,
      flow: [rudder?.axialFlow, rudder?.crossFlow], rudderPower: rudder?.power, boardPower: q.board?.power,
      yaw: q.steering?.yawMoments, planingPower: q.planingPower, waveDrive: q.waveForward, heave: state.heave,
      surge: state.vx * a.fx + state.vy * a.fy, side: state.vx * a.rx + state.vy * a.ry,
      sheet: P.trimFromSheet(state.sheet, state), boom: toDeg(state.boom), drive: state.sail.drive,
      sailForce: state.sail.sideForce, apparentWind: state.wind.aws, localWind: state.wind.tws,
      luff: state.sail.luff, cg: state.hydro.cg, crewCG: state.crewCG, volume: state.hydro.submergedVolume,
      bow: [bow.height, bow.depth, bow.closing], stern: [stern.height, stern.depth, stern.closing],
      capsized: state.capsized, ground: state.ground?.contact };
  };

  function voyage(start, duration, field, controls) {
    const weatherAt = typeof field === 'function' ? field : () => field;
    const s = runtime.createBoat('laser', { ...openSea, ...start }, weatherAt(0));
    const rows = [];
    for (let tick = 0; tick < duration * 60; tick++) {
      const t = tick * dt, conditions = weatherAt(t);
      runtime.stepBoat(s, controls(t), conditions, dt, { diagnostics: true });
      if (tick % 6 === 0 || tick === duration * 60 - 1) rows.push(snapshot(s, conditions));
    }
    return rows;
  }
  const bladeOnBench = [-1.5, 0, 1.5].map(rate => {
    const s = runtime.createBoat('laser', { ...openSea, rudder: 12 * P.DEG }, calm);
    s.rudderRate = rate;
    const wet = P.rudderContacts(s, calm).sections.filter(row => row.wetArea > 0);
    return { rate, yaw: wet.reduce((sum, row) => sum + row.moment.yaw, 0),
      sections: wet.map(({ u, v, wetArea }) => ({ u, v, wetArea })) };
  });
  const helm = [0, 1.2, 3.8].flatMap(velocity => [-1, 1].map(steer => ({
    velocity, steer, samples: voyage({ vx: velocity }, 3, calm, t => ({ steer: t < 1.3 ? steer : 0, crewPose: 1 }))
  })));
  const trim = [50, 90, 155].flatMap(angle => [-1, 1].map(sign => {
    const field = { ...calm, speed: 7.5 };
    const theta = (90 - angle * sign) * P.DEG;
    // Fixture holds the hull at a fixed heading and speed. Only the line and boom
    // integrate, so a change in hull speed cannot be mistaken for trim response.
    const s = runtime.createBoat('laser', { ...openSea, theta, vx: 2 * Math.cos(theta),
      vy: 2 * Math.sin(theta), sheet: P.sheetFromTrim(.72, 'laser') }, field);
    const samples = [];
    for (let tick = 0; tick < 420; tick++) {
      s.time += dt;
      P.updateSheet(s, c, {
        trimFast: true, sheetTarget: tick < 45 || tick >= 225 ? P.sheetFromTrim(.72, c) : 0
      }, field, dt);
      P.updateRig(s, c, dt, true);
      P.updateBoom(s, c, s.sail, field, dt, true);
      P.refresh(s, field);
      if (tick % 6 === 0 || tick === 419) {
        samples.push({ t: s.time, trim: P.trimFromSheet(s.sheet, c), boom: toDeg(s.boom),
          stop: toDeg(P.boomLimit(s.sheet, c)), luff: s.sail.luff, fill: s.sail.fill, drive: s.sail.drive,
          side: s.sail.sideForce, apparentWind: s.wind.aws });
      }
    }
    return { angle: sign * angle, samples };
  }));
  const crew = {
    lateral: voyage({ crewSide: 1 }, 5, calm, t => ({ crew: 1, crewPose: t < 2 || t > 3.4 ? 1 : 3 })),
    foreAft: voyage(openSea, 13, calm, t => ({ crew: 0, crewPose: 1, foreAft: t < 2 || t >= 10 ? 0 : t < 6 ? 1 : -1 }))
  };
  const gust = voyage({ theta: 34 * P.DEG, vx: 2.17, vy: 1.46, crewSide: -1, crewPose: 3,
    sheet: P.sheetFromTrim(.68, c) }, 9,
    t => ({ ...calm, speed: 6 + 3 * Math.max(0, 1 - Math.abs((t - 4) / 2)) }),
    t => ({ crew: -1, crewPose: 3, steer: t > 3.4 && t < 4.1 ? -.38 : 0,
      sheetTarget: P.sheetFromTrim(t > 3.4 && t < 5.2 ? .42 : .68, c) }));
  const waves = [90, 0, 270].map(direction => ({
    from: direction, samples: voyage({ vx: 3.1, crewPose: 2 }, 10,
      { ...calm, swellDirection: direction, waveHeight: .65 },
      () => ({ crewPose: 2 }))
  }));
  const drift = voyage({ vx: 2.7, vy: .65, omega: .18, heel: .15, pitch: .07 }, 105, calm, () => ({ crewPose: 1 }));
  assert.ok(Math.abs(drift.at(-1).side) < Math.abs(drift[0].side) * .05);
  assert.ok(drift.at(-1).waterSpeed < drift[0].waterSpeed * .15, String(drift.at(-1).waterSpeed));
  assert.ok(drift.every(row => row.rudderPower <= 0 && row.boardPower <= 0 && row.planingPower <= 0));
  for (const samples of Object.values(crew)) {
    assert.ok(samples.every(row => Math.abs(row.mass - samples[0].mass) < 1e-8 && !row.capsized));
  }
  for (const series of trim) {
    assert.ok(series.samples.some(row => row.trim === 0));
    assert.ok(Math.abs(series.samples.at(-1).trim - .72) < 1e-8);
  }
  return { dt, calm, openSea, bladeOnBench, helm, trim, crew, gust, waves, drift };
}

const [baseline, output] = process.argv.slice(2);
if (!baseline || !output) throw Error('node scripts/laser-probes.cjs FØR_PROJEKTMAPPE JSON');
const before = require(resolve(baseline, 'assets/simulation/node.js')).createSimulation();
const results = { before: run(before), after: run(createSimulation()) };
writeFileSync(output, JSON.stringify(results) + '\n');
