'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSimulation } = require('../assets/simulation/node.js');

const [baselineAssets, output] = process.argv.slice(2);
if (!baselineAssets || !output) throw Error('node scripts/verify-render-physics.cjs BASELINE_ASSETS JSON');
const before = require(path.resolve(baselineAssets, 'simulation/node.js')).createSimulation();
const after = createSimulation();
const dt = 1 / 60;
const weather = { speed: 12, direction: 252, windSeed: 61, waveSeed: 127,
  waveHeight: .9, chop: .65, gusts: .28, difficulty: 'hard', forceDiagnostics: true };
const boats = ['laser', 'dinghy', 'yacht', 'ac75', 'ac72'];
const verify = (id, sample, time, reference, actual) => {
  try { assert.deepStrictEqual(actual, reference); }
  catch (error) { error.message = `${id} ${sample}, t=${time}: ${error.message}`; throw error; }
};
const scenarios = [];
for (const boat of boats) {
  for (const [name, x, y, speed, heave, eta] of [
    ['hav', -1775, -1980, 4, undefined, weather],
    ['foelfase', -1480, -1825, 12, 1.15, { ...weather, direction: 275, speed: 16, waveHeight: 1.6 }],
    ['kyst', -180, -340, 3, undefined, { ...weather, direction: 25, waveHeight: .34, chop: 0 }]
  ]) {
    const theta = -.54;
    const initial = { x, y, theta, time: 0, sheet: .52, heave: boat.startsWith('ac') ? heave : undefined,
      vx: speed * Math.cos(theta), vy: speed * Math.sin(theta) };
    const env = { ...eta, boatId: boat };
    const a = before.createBoat(boat, initial, env);
    const b = after.createBoat(boat, initial, env);
    verify(boat, name, 0, a, b);
    const start = structuredClone(a);
    const controls = [{ from: 0, sheetTarget: .68, crewPose: 2 },
      { from: 120, steer: .7, sheetTarget: .76, crewPose: 1 },
      { from: 180, steer: -.6, sheetTarget: .20, crewPose: 3, crew: -1, foreAft: -.65 },
      { from: 270, steer: 0, sheetTarget: .54, crewPose: 2, crew: 1, foreAft: .40 }];
    let control = controls[0], status;
    const events = [];
    const ms = [[], []];
    for (let i = 0; i < 480; i++) {
      control = controls.find(c => c.from === i) || control;
      const input = { ...control, difficulty: 'hard' };
      const field = i >= 240 ? { ...env, direction: (env.direction + 17) % 360, waveHeight: env.waveHeight * .7 } : env;
      const calls = [[before, a, 0], [after, b, 1]];
      if (i % 2) calls.reverse();
      for (const [simulation, state, version] of calls) {
        const now = performance.now();
        simulation.stepBoat(state, input, field, dt, { diagnostics: true });
        ms[version].push(performance.now() - now);
      }
      verify(boat, name, i + 1, a, b);
      const event = { capsized: a.capsized, ground: a.ground?.contact,
        foil: a.foiling?.status, tacks: a.tackCount, gybes: a.gybeCount };
      const key = JSON.stringify(event);
      if (key !== status) { events.push({ t: a.time, ...event }); status = key; }
    }
    const average = times => times.slice(90).reduce((sum, ms) => sum + ms, 0) / (times.length - 90);
    const mean = ms.map(average);
    console.log(boat, name, 'ms/trin', mean.map(ms => +ms.toFixed(3)));
    scenarios.push({ boat, name, dt, frames: 480, env, start, controls,
      weatherChange: { step: 240, direction: (env.direction + 17) % 360, waveHeight: env.waveHeight * .7 },
      events, end: { x: a.x, y: a.y, heave: a.heave, theta: a.theta, vx: a.vx, vy: a.vy }, meanStepMs: mean });
  }
}
fs.writeFileSync(output, JSON.stringify({ match: 'deepStrictEqual per step', scenarios }, (key, value) =>
  typeof value === 'number' && !Number.isFinite(value) ? { $number: String(value) } : value, 2) + '\n');
