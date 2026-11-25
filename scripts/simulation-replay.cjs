'use strict';

const path = require('node:path');
const fs = require('node:fs');
const fixture = require('../tests/fixtures/simulation-inputs.json');
const { isDeepStrictEqual } = require('node:util');

function replay(runtime, input = fixture) {
  return input.cases.map(test => {
    const field = { speed: 0, direction: 0, gusts: 0, waveHeight: 0, chop: 0,
      shelter: false, autoBalance: false, autoRecovery: false, difficulty: 'hard',
      windSeed: 2647, ...test.field };
    const state = runtime.createBoat(test.boat, { x: 0, y: -12000, vx: 0, vy: 0, ...test.initial }, field);
    const samples = [];
    for (const segment of test.segments) {
      const control = { steer: 0, trim: 0, ...segment.control };
      for (let tick = 0; tick < segment.ticks; tick++) {
        runtime.stepBoat(state, control, field, input.dt, { diagnostics: true });
        if ((tick + 1) % 60 === 0 || tick + 1 === segment.ticks) {
          const f = state.forces;
          const meters = [state.x, state.y, state.heave, state.vx, state.vy, state.heaveVelocity];
          const attitude = [state.theta, state.heel, state.pitch, state.omega, state.heelRate, state.pitchRate];
          const controls = [state.sheet, state.rudder, state.boom, state.crewPose, state.crewPoseBlend, state.crewSide, state.crewSideBlend];
          const wind = [state.wind.tws, state.wind.aws, state.wind.twa, state.wind.awa];
          const moment = [state.forces.yawSail, f.yawBoard, f.yawRudder, f.yawDamping, f.yaw, f.roll, f.pitch];
          const water = [f.buoyancy, f.weight, f.hullF, f.hullR, f.rudder?.wet, f.board?.wet, state.foiling?.liftFraction];
          if ([state.time, ...meters, ...attitude, ...controls].some(n => !Number.isFinite(n))) {
            throw Error('Invalid state in ' + test.name);
          }
          samples.push({ t: state.time, meters, attitude, controls, wind, moment, water,
            flags: [!!state.capsized, !!state.ground?.contact, state.tackCount, state.gybeCount, state.foiling?.support?.phase] });
        }
      }
    }
    return { name: test.name, samples };
  });
}

function verify(actual, expected, location = 'simulation') {
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-9 * Math.max(1, Math.abs(expected))) {
      throw Error(location + ' is ' + actual + ', expected ' + expected);
    }
  } else if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    if (!isDeepStrictEqual(Object.keys(actual), Object.keys(expected))) throw Error('Missing field in ' + location);
    for (const key of Object.keys(expected)) verify(actual[key], expected[key], location + '.' + key);
  } else if (!Object.is(actual, expected)) {
    throw Error(location + ' is ' + actual + ', expected ' + expected);
  }
}

function verifyReference() {
  const { createSimulation } = require('../assets/simulation/node');
  const actual = JSON.parse(JSON.stringify(replay(createSimulation())));
  const reference = require('../tests/fixtures/simulation-reference.json');
  const corrections = new Map([
    ...require('../tests/fixtures/simulation-relative-water.json'),
    ...require('../tests/fixtures/simulation-manual-trim.json'),
    ...require('../tests/fixtures/simulation-racer-crew.json'),
    ...require('../tests/fixtures/simulation-laser-crossing.json'),
    ...require('../tests/fixtures/simulation-windward-crew.json'),
    ...require('../tests/fixtures/simulation-yacht-balance.json'),
    ...require('../tests/fixtures/simulation-laser-balance.json'),
    ...require('../tests/fixtures/simulation-waves.json'),
    ...require('../tests/fixtures/simulation-chop.json'),
    ...require('../tests/fixtures/simulation-sheet.json'),
    ...require('../tests/fixtures/simulation-independent-sea.json'),
    ...require('../tests/fixtures/simulation-swell-and-downwind.json'),
    ...require('../tests/fixtures/simulation-model-corrections.json'),
    ...require('../tests/fixtures/simulation-rudder-geometry.json')
  ].map(run => [run.name, run]));
  const expected = reference.map(run => corrections.get(run.name) ?? run);
  verify(actual, expected);
  return actual.length;
}

function legacyRuntime(directory) {
  const vm = require('node:vm');
  const scope = vm.createContext({ performance, setTimeout, clearTimeout, atob, console });
  const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
  for (const match of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
    const [, src, code] = match;
    if (code.includes('v11 — one world-fixed race model')) break;
    if (code.includes('FRI VIND / shared hulls') || scope.SailingBoats || src) {
      vm.runInContext(src ? fs.readFileSync(path.join(directory, src), 'utf8') : code, scope, { filename: src || 'reference-inline.js' });
    }
  }
  const { SailPhysics, SailingWeather, SailingSettings, SailingWind } = scope;
  return {
    createBoat(boatId, initial, field) {
      const env = { ...field, boatId };
      const state = SailPhysics.createState({ ...initial, boatId }, env);
      SailingWeather.initialize(state, env);
      return state;
    },
    stepBoat(state, control, field, dt, { diagnostics }) {
      const bearing = state.windClimate?.direction ?? field.direction;
      const env = SailingSettings.advanceWind(state, { ...field, boatId: state.boatId }, dt);
      if (env.direction !== bearing && env.shelter !== false && !SailingWind.prepare(env.direction)) {
        state.windClimate.direction = env.direction = bearing;
      }
      if (diagnostics) env.forceDiagnostics = true;
      SailPhysics.step(state, control, env, dt);
      SailingWeather.step(state, env, dt);
    }
  };
}

if (require.main === module) {
  const mode = process.argv[2];
  if (mode === '--legacy') {
    console.log(JSON.stringify(replay(legacyRuntime(process.argv[3])), null, 2));
  } else {
    console.log(verifyReference() + ' input replays matched');
  }
}
module.exports = { replay, verify, verifyReference, legacyRuntime };
