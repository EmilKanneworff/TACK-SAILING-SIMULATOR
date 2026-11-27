'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { gzipSync } = require('node:zlib');
const { load, environment, makeState, execute } = require('./steering-trials.cjs');

const [before, after, output] = process.argv.slice(2);
if (!before || !after || !output) throw Error('node scripts/fleet-review.cjs FØR_MAPPE EFTER_MAPPE RESULTAT.json.gz');
const rad = Math.PI / 180, knots = 1.9438444924;
const boatIds = ['laser', 'dinghy', 'yacht', 'ac75', 'ac72'];

function run(root) {
  const runtime = load(root), { SailPhysics: P, SailingBoats: B, fixedDt } = runtime;
  const settings = { ...environment, forceDiagnostics: true };
  const profiles = boatIds.map(id => {
    const boat = B.get(id);
    return { id, name: boat.name, mass: boat.mass, crewMass: boat.crewMass,
      crew: boat.crewOffsets?.length ?? boat.crewStations?.length ?? 1,
      main: boat.mainArea ?? boat.sailArea, jib: boat.jibArea ?? 0,
      length: boat.length, beam: boat.beam, ballast: boat.ballastMass ?? 0, reef: 0 };
  });
  const trials = [];
  function measure(name, id, env, initial, frames, programme) {
    const result = execute(runtime, { id, kind: 'steer', env, initial, frames }, programme);
    trials.push({ name, id, env, initial, dt: fixedDt, inputs: result.inputs, end: result.end,
      rows: result.rows, completed: result.runCompleted, failureReason: result.failureReason });
  }

  for (const wind of [10, 17]) {
    for (const trim of wind === 10 ? [.72] : [.72, .958]) {
      const env = { ...settings, speed: wind, direction: 90 };
      const course = 152, theta = (90 - course) * rad;
      const initial = makeState(runtime, 'dinghy', env, course, 3, trim, { crewPose: 3, crewSide: -1 });
      measure(`Racer 32 · ${wind} m/s · skøde ${trim}`, 'dinghy', env, initial, 18 * 60, s => ({
        steer: P.clamp(-1.6 * P.wrap(theta - s.theta) + 1.1 * s.omega, -1, 1),
        steerDigital: false, crewPose: 3, crew: -1
      }));
    }
  }
  for (const steer of [-1, 0, 1]) {
    const env = { ...settings, speed: 9.7, direction: 270, shelter: true };
    const initial = makeState(runtime, 'ac72', env, 91, 5.8 / knots, .674, {
      x: 575, y: -1190, crewPose: 3, crewPoseBlend: 3
    });
    measure(`AC72 · ror ${steer}`, 'ac72', env, initial, 6 * 60, () => ({
      steer, crewPose: 3, ...(steer === 0 ? { sheetTarget: 0 } : {})
    }));
  }
  for (const id of boatIds) {
    const env = { ...settings, speed: 0 };
    const initial = makeState(runtime, id, env, 0, 0, 0, { crewPose: 2, crewSide: 1 });
    measure(`${id} · længdetrim`, id, env, initial, 18 * 60,
      (_state, time) => ({ crewPose: 2, crew: 1, foreAft: time < 6 ? 0 : time < 12 ? -1 : 1 }));
  }
  const seas = [[0, 0], [2.5, 0], [0, 1], [2.5, 1]].map(([waveHeight, chop]) => {
    const env = { ...settings, speed: 12, waveHeight, chop, swellDirection: 0 };
    const profile = P.waveProfileFor(env);
    const sea = { ...env, waveProfile: { from: profile, to: profile, start: -10 } };
    const origin = { x: 0, y: -13000 };
    const heights = Array.from({ length: 1440 }, (_, n) => P.waveAt(origin.x, origin.y, n / 12, sea).height);
    const mean = heights.reduce((sum, v) => sum + v, 0) / heights.length;
    const significantHeight = 4 * Math.sqrt(heights.reduce((sum, v) => sum + (v - mean)**2, 0) / heights.length);
    for (const id of ['laser', 'yacht', 'ac75']) {
      const initial = makeState(runtime, id, env, 115, id === 'ac75' ? 9 : 3, .47, {
        ...origin, crewPose: 2, crewSide: -1
      });
      measure(`${id} · bølger ${waveHeight} m · chop ${chop}`, id, env, initial, 12 * 60,
        () => ({ crewPose: 2, crew: -1 }));
    }
    return { env, profile, origin, significantHeight, minimum: Math.min(...heights), maximum: Math.max(...heights), heights };
  });
  return { profiles, trials, seas };
}

const old = run(before), current = run(after);
const physical = data => JSON.parse(JSON.stringify(data, (key, value) =>
  ['crewTarget', 'crewAuto'].includes(key) ? undefined : value));
assert.deepEqual(physical(current), physical(old), 'Bådenes numeriske referenceforløb ændrede sig uden ændrede input');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, gzipSync(JSON.stringify({ before: old, after: current })));
for (const trial of current.trials) {
  const { end } = trial;
  const wetArea = end.steering?.blades?.map(blade => Number(blade.wetArea).toFixed(3));
  const sample = trial.rows.filter(row => row.t > end.t - 3);
  const mean = key => sample.reduce((sum, row) => sum + row[key], 0) / sample.length;
  console.log(trial.name, { meanKn: (mean('speed') * knots).toFixed(2), heel: mean('heel').toFixed(1),
    leeway: mean('leeway').toFixed(1), heading: end.heading.toFixed(1),
    target: end.targetRudder.toFixed(1), rudder: end.rudder.toFixed(1), wetArea, status: trial.failureReason ?? 'complete' });
}
for (const sea of current.seas) console.log('Sø', sea.env.waveHeight, sea.env.chop, sea.significantHeight.toFixed(2));
