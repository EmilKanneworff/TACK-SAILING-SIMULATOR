'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { verify, verifyReference } = require('../scripts/simulation-replay.cjs');
const { run } = require('../scripts/laser-rotation.cjs');
const { createSimulation } = require('../assets/simulation/node');

test('recorded inputs replay headlessly across all five boats', () => {
  assert.equal(verifyReference(), 6);
  assert.equal(globalThis.SailPhysics, undefined);
  assert.equal(globalThis.SailingWorld, undefined);
});

test('the eased half of the mainsheet opens more travel and lets soft sails feather on either tack', () => {
  const { physics: P, fixedDt } = createSimulation();
  for (const boatId of ['laser', 'dinghy', 'yacht', 'ac75']) {
    const boat = P.configFor(boatId);
    let last = -1;
    for (let i = 0; i <= 100; i++) {
      const sheet = P.sheetFromTrim(i / 100, boat);
      assert.ok(sheet > last, boatId);
      last = sheet;
    }
    const looseTravel = P.boomLimit(0, boat) - P.boomLimit(P.sheetFromTrim(.5, boat), boat);
    const tightTravel = P.boomLimit(P.sheetFromTrim(.5, boat), boat) - P.boomLimit(1, boat);
    assert.ok(looseTravel > 2 * tightTravel, boatId);
    for (const tack of [-1, 1]) {
      const env = { boatId, speed: 8, direction: 0, gusts: 0, waves: 0, shelter: false };
      const theta = (90 - tack * 68) * P.DEG;
      const load = trim => {
        const sheet = P.sheetFromTrim(trim, boat);
        assert.ok(Math.abs(P.trimFromSheet(sheet, boat) - trim) < 1e-12);
        const state = P.createState({ boatId, theta, x: 0, y: -9500, vx: 0, vy: 0, sheet, boom: tack * .2 }, env);
        // Hold the hull attitude so this measures the rig rather than a course change.
        for (let i = 0; i < 360; i++) {
          state.time += fixedDt;
          P.updateRig(state, boat, fixedDt, true);
          state.sail = P.aero(state, env);
          P.updateBoom(state, boat, state.sail, env, fixedDt, true);
        }
        return { boom: state.boom, limit: P.boomLimit(sheet, boat), sail: P.aero(state, env) };
      };
      const half = load(.5), loose = load(0);
      const force = ({ sail }) => Math.hypot(sail.main.drive, sail.main.sideForce);
      assert.ok(Math.abs(loose.boom) > Math.abs(half.boom) + 23 * P.DEG, boatId);
      assert.ok(Math.abs(loose.boom + loose.sail.wind.awa) < 3 * P.DEG, boatId);
      assert.equal(P.sheetTorque({ boom: loose.boom, boomRate: 0 }, loose.limit, boat), 0);
      assert.ok(loose.sail.main.luff > .85 && force(loose) < force(half) * .15, boatId);
    }
  }
  const wing = P.configFor('ac72');
  assert.equal(P.boomLimit(.5, wing), wing.boomMax + (wing.boomMin - wing.boomMax) * .5);
  assert.equal(P.sheetFromTrim(.5, wing), .5);
});

test('the sheet takes up slack before pulling and cannot push the boom out', () => {
  const { physics: P, fixedDt } = createSimulation();
  const c = P.configFor('laser');
  const calm = { wind: { awa: 0, aws: 0 }, main: { boomTorque: 0 }, qArea: 0 };
  const env = { speed: 0, shelter: false };
  for (const side of [-1, 1]) {
    const state = { sheet: 0, boom: side * 40 * P.DEG, boomRate: 0, rig: {} };
    const start = state.boom;
    for (let i = 0; i < 20; i++) {
      P.updateSheet(state, c, { trim: 1, trimFast: true }, env, fixedDt);
      P.updateBoom(state, c, calm, env, fixedDt, false);
      assert.equal(state.boom, start);
      assert.equal(state.sheetLoad.taut, false);
    }
    let peakMoment = 0;
    for (let i = 0; i < 73; i++) {
      P.updateSheet(state, c, { trim: 1, trimFast: true }, env, fixedDt);
      const before = state.boom;
      P.updateBoom(state, c, calm, env, fixedDt, false);
      peakMoment = Math.max(peakMoment, state.sheetLoad.momentNm);
      assert.ok(Math.abs(state.boom - before - state.boomRate * fixedDt) < 1e-12);
      assert.ok(side * state.boom <= side * before + 1e-12);
    }
    assert.ok(Math.abs(state.boom) < Math.abs(start));
    assert.ok(peakMoment > 0);
    const hauled = state.boom;
    state.boomRate = 0;
    for (let i = 0; i < 90; i++) {
      P.updateSheet(state, c, { trim: -1, trimFast: true }, env, fixedDt);
      P.updateBoom(state, c, calm, env, fixedDt, false);
      assert.ok(side * state.boom <= side * hauled + 1e-12);
    }
    assert.equal(state.sheet, 0);
    assert.equal(state.sheetLoad.momentNm, 0);

    state.sheet = 1;
    state.boom = start;
    state.boomRate = 0;
    P.updateBoom(state, c, calm, env, fixedDt, false);
    assert.ok(Math.abs(state.boomRate) <= 5.5);
    assert.ok(Math.abs(start - state.boom) <= 5.5 * fixedDt + 1e-12);
  }
});

test('releasing the manual gennaker sheet spills its load while the sail stays hoisted', () => {
  const sim = createSimulation(), P = sim.physics;
  const field = { boatId: 'yacht', speed: 8, direction: 0, gusts: 0, waves: 0, shelter: false, difficulty: 'hard' };
  const boat = sim.createBoat('yacht', { x: 0, y: -9500, theta: -42 * P.DEG, vx: 1.5, vy: -1, sheet: .48 }, field);
  const sail = (state, extraSheet, ticks) => {
    const control = { spinnaker: true, downwindType: 'gennaker', rig: { extraSheet } };
    for (let i = 0; i < ticks; i++) sim.stepBoat(state, control, field, sim.fixedDt);
    return state;
  };
  sail(boat, .48, 350);
  const held = sail(structuredClone(boat), .48, 160);
  const eased = sail(structuredClone(boat), 0, 160);
  assert.equal(eased.spinnaker.hoist, 1);
  assert.ok(eased.spinnaker.luff > .9);
  assert.ok(eased.sail.spinnaker.drive < held.sail.spinnaker.drive * .15);
});

test('the Laser pitches more often in pure chop than in long swell', () => {
  const sim = createSimulation(), P = sim.physics;
  const countPitchReversals = chop => {
    const field = { boatId: 'laser', shelter: false, speed: 10, direction: 270,
      waveHeight: 1, chop, gusts: 0, autoBalance: false };
    const boat = sim.createBoat('laser', { x: 0, y: -9500, vx: -2.5, vy: 0,
      theta: Math.PI, boom: 0, sheet: 0, crewPose: 1 }, field);
    let turns = 0, previousSign = 0;
    for (let tick = 0; tick < 1800; tick++) {
      const steer = P.clamp(P.wrap(boat.theta - Math.PI) * 2 + boat.omega * .9, -1, 1);
      sim.stepBoat(boat, { steer, steerDigital: false, crewPose: 1 }, field, sim.fixedDt);
      if (Math.abs(boat.pitchRate) < .015) continue;
      const sign = Math.sign(boat.pitchRate);
      if (previousSign && sign !== previousSign) turns++;
      previousSign = sign;
    }
    assert.ok(!boat.capsized);
    return turns;
  };
  const swell = countPitchReversals(0);
  assert.ok(swell >= 10);
  assert.ok(countPitchReversals(1) >= 1.5 * swell);
});

test('independent simulations can sample separate fluids', () => {
  const water = height => () => ({
    height, dx: 0, dy: 0, velocity: 0, waterVx: 0, waterVy: 0, waterVz: 0, waterAx: 0, waterAy: 0, curvature: 0
  });
  const first = createSimulation({ water: water(.1) });
  const second = createSimulation({ water: water(.6) });
  const field = { speed: 0, direction: 0, gusts: 0, waveHeight: 0, chop: 0, shelter: false };
  const init = { x: 0, y: -12000, vx: 0, vy: 0 };
  const a = first.createBoat('laser', init, field);
  const b = second.createBoat('laser', init, field);
  assert.ok(Math.abs(b.heave - a.heave - .5) < 1e-7);
  first.stepBoat(a, {}, field, .02);
  assert.equal(a.time, .02);
  assert.equal(b.time, 0);
});

test('manual sheet release can prevent a heavy-air monohull capsize', () => {
  const sim = createSimulation();
  const field = { boatId: 'ac75', speed: 20, direction: 0, windSeed: 2647, waveHeight: 1.15,
    chop: 0, gusts: .30, shelter: false, autoRecovery: false, difficulty: 'hard' };
  const initial = sim.createBoat('ac75', { x: 0, y: -5000, theta: -25 * sim.physics.DEG, sheet: .8 }, field);
  const held = structuredClone(initial);
  const eased = structuredClone(initial);
  for (let tick = 0; tick < 300; tick++) {
    if (!held.capsized) sim.stepBoat(held, { steer: 0, trim: 0 }, field, sim.fixedDt);
    sim.stepBoat(eased, { steer: 0, trim: tick < 90 ? -1 : 0, trimFast: true }, field, sim.fixedDt);
  }
  assert.equal(held.capsized, true);
  assert.equal(held.sheet, .8);
  assert.equal(eased.capsized, false);
  assert.ok(eased.sheet < .06);
});

test('Hard keeps each chosen stance and side through wind and boom changes on all five boats', () => {
  const sim = createSimulation();
  const field = { speed: 6, direction: 0, gusts: 0, waveHeight: 0, shelter: false, difficulty: 'hard', autoBalance: true };
  const { physics: P, fixedDt } = sim;
  for (const { id } of sim.profiles.LIST) {
    const boat = sim.createBoat(id, { x: 0, y: -12000, crewSide: -1, crewSideBlend: -1 }, field);
    function holdSide(side, crewPose) {
      for (const angle of [40, 0, -40, 178, -178]) {
        const awa = angle * P.DEG;
        boat.boom = -Math.sign(angle) * 55 * P.DEG;
        const wind = { aws: 8, awa, tws: 6, twa: awa };
        for (let i = 0; i < 18; i++) P.updateCrew(boat, { crewPose, crew: 0 }, field, fixedDt, { wind });
        assert.equal(boat.crewSide, side, id);
        assert.equal(boat.crewPose, crewPose, id);
      }
    }
    for (const pose of [1, 2, 3]) holdSide(-1, pose);
    P.updateCrew(boat, { crew: 1, crewPose: 3 }, field, fixedDt, { wind: { awa: -40 * P.DEG, twa: -40 * P.DEG, tws: 6 } });
    assert.equal(boat.crewSide, -1, id);
    P.updateCrew(boat, { crew: 1, crewPose: 3 }, field, fixedDt, { wind: { awa: -40 * P.DEG, twa: 40 * P.DEG, tws: 6 } });
    assert.ok(boat.crewSideBlend < 0, id);
    for (const pose of [3, 2, 1]) holdSide(1, pose);
    assert.ok(boat.crewSideBlend > .98, id);
  }
});

test('true wind relative to the bow sets the allowed side independent of apparent wind and heel', () => {
  const { physics: P, createBoat, profiles } = createSimulation();
  const env = { speed: 8, direction: 180, gusts: 0, waveHeight: 0, shelter: false };
  for (const { id } of profiles.LIST) for (const side of [-1, 1]) {
    const state = createBoat(id, { theta: (-90 + 35 * side) * P.DEG, x: 0, y: -12000 }, env);
    assert.equal(state.crewSide, side, id);
    const wind = { twa: side * 35 * P.DEG, awa: -side * 40 * P.DEG, tws: 8, aws: 10 };
    P.updateCrew(state, { difficulty: 'easy' }, env, 1 / 60, { wind, rollMoment: side * 1000 });
    assert.equal(state.crewSide, side, id);
    assert.ok(state.crewPose <= 2, id);
    for (const twa of [0, 3, 178, -178]) assert.equal(P.windwardCrewSide({ ...wind, twa: twa * P.DEG }), 0);
    assert.equal(P.windwardCrewSide({ ...wind, tws: 0 }), 0);
  }
});

test('Turbåd crew gains righting leverage on the side deck and reduces heel with the same sheet', () => {
  const { physics: P, profiles: B, createBoat, stepBoat, fixedDt } = createSimulation();
  const field = { speed: 10, direction: 180, gusts: 0, waveHeight: 0, shelter: false, difficulty: 'hard' };
  const start = createBoat('yacht', { x: 0, y: -5000, theta: 0, vx: 10 / 1.9438444924, vy: 0,
    heel: -25 * P.DEG, sheet: .65, crewPose: 2, crewSide: 1 }, field);
  const [inside, onDeck] = [1, 3].map(crewPose => {
    const boat = structuredClone(start);
    for (let tick = 0; tick < 360; tick++) {
      const steer = P.clamp(2.1 * P.wrap(boat.theta) + 1.3 * boat.omega, -.95, .95);
      stepBoat(boat, { steer, steerDigital: false, crewPose, crew: 1 }, field, fixedDt);
      if (tick === 59) assert.ok(Math.abs(boat.crewPoseBlend - crewPose) < .07);
    }
    return boat;
  });
  assert.equal(onDeck.hydro.weight, inside.hydro.weight);
  assert.equal(onDeck.sheet, inside.sheet);
  assert.ok(onDeck.forces.rollCrew - inside.forces.rollCrew > 4000);
  assert.ok(Math.abs(inside.heel) - Math.abs(onDeck.heel) > 2.6 * P.DEG);
  for (const member of onDeck.crewJoints.members) {
    assert.ok(member.pelvis.z > 1.55);
    for (const foot of member.feet) {
      assert.ok(foot.z > B.get('yacht').cockpit.halfWidth);
      assert.ok(foot.z < B.halfBeamAt('yacht', foot.x));
      assert.ok(foot.y > B.get('yacht').deckY);
    }
  }
});

test('Racer planing support shifts toward the immersed side and remains dissipative', () => {
  const { physics: P, createBoat, stepBoat, fixedDt } = createSimulation();
  const field = { speed: 0, gusts: 0, waveHeight: 0, shelter: false };
  function sample(heel, heave = .65) {
    const boat = createBoat('dinghy', { x: 0, y: -5000, theta: 0, vx: 10, vy: 0, heel: heel * P.DEG,
      heave, pitch: 2 * P.DEG }, field);
    stepBoat(boat, {}, field, fixedDt, { diagnostics: true });
    return boat.forces;
  }
  for (const side of [-1, 1]) {
    const load = sample(side * 57);
    assert.ok(load.planingLift > 3000);
    assert.ok(load.planingLift <= .52 * load.weight);
    assert.ok(load.ledger.planing.moment.roll * side < -1500);
    assert.ok(load.planingPower < 0);
  }
  assert.equal(sample(57, 3).planingLift, 0);
  assert.ok(Math.abs(sample(0, .15).ledger.planing.moment.roll) < 1e-8);
});

test('a manual tack command at zero true wind angle remembers the same destination on either tack', () => {
  const sim = createSimulation();
  const P = sim.physics;
  const field = { speed: 7.5, direction: 180, gusts: 0, waveHeight: 0, shelter: false, difficulty: 'hard' };
  for (const { id } of sim.profiles.LIST) for (const from of [-1, 1]) {
    const boat = sim.createBoat(id, { x: 0, y: -12000, theta: (-90 + 45 * from) * P.DEG, crewSide: from }, field);
    assert.equal(P.tackCrewSide(boat, 0), 0, id);
    boat.theta = -90 * P.DEG;
    boat.vx = -2 * from; // Crosswind drift can point the apparent wind to the old side.
    boat.wind = P.windForState(boat, field);
    assert.ok(Math.abs(boat.wind.twa) < 1e-12, id);
    assert.equal(Math.sign(boat.wind.awa), from, id);
    const destination = P.tackCrewSide(boat, 0);
    assert.equal(destination, -from, id);
    P.updateCrew(boat, { crewPose: 2, crew: destination }, field, sim.fixedDt);
    assert.equal(P.tackCrewSide(boat, 0), destination, id);
    // A quick return through the eye still uses the new windward side.
    boat.theta = (-90 + 12 * destination) * P.DEG;
    boat.wind = P.windForState(boat, field);
    P.updateCrew(boat, { crewPose: 2, crew: 0 }, field, sim.fixedDt);
    boat.theta = -90 * P.DEG;
    boat.wind = P.windForState(boat, field);
    assert.equal(P.tackCrewSide(boat, 0), from, id);
  }
});

test('Laser passive damping and known moment separate dry and entrained-water inertia', () => {
  const data = run();
  const rates = data.passive.map(s => Math.abs(s.yawRate));
  assert.ok(rates.at(-1) < rates[0] * .45);
  assert.ok(rates.slice(1).every((rate, i) => rate <= rates[i]));
  assert.ok(Math.abs(data.knownMoment.wet - data.knownMoment.expectedWet) < 1e-9);
  assert.ok(data.knownMoment.wet < data.knownMoment.dry);
  assert.equal(data.knownMoment.dryMass, 143);
  assert.ok(Math.abs(data.acceleratingWater.weight - 143 * 9.81) < 1e-6);
  assert.ok(Math.abs(data.acceleratingWater.buoyancy - data.acceleratingWater.weight) < 1e-5);
  assert.ok(Math.abs(data.acceleratingWater.boatAccelerationAtCG - data.acceleratingWater.waterAcceleration) < .01);
  assert.ok(Math.abs(data.broadReach.at(-1).heading - data.halfStep.at(-1).heading) < .6);
});

test('the flat-water launch and relative water correction match separate recorded trials', () => {
  const { before, after } = require('../gennemgang/fysik/laser-rotation.json');
  const reference = require('./fixtures/laser-rotation-sheet.json');
  const current = JSON.parse(JSON.stringify(run()));
  for (const [stage, shots] of Object.entries(current)) verify(shots, reference[stage], stage);
  for (const [i, row] of after.broadReach.entries()) verify(row.heading, before.broadReach[i].heading, 'heading ' + row.t);
  assert.ok(before.acceleratingWater.boatAccelerationAtCG < .65);
});

test('Laser sail resolves the projected flow and mirrors force and moment at fixed heel', () => {
  const { physics: P, createBoat } = createSimulation();
  const field = { speed: 0, waveHeight: 0, shelter: false };
  for (const degrees of [0, 10, 20, 30, 45]) {
    const heel = degrees * P.DEG;
    const expectedSpeed = Math.hypot(2.4, 8.5 * Math.cos(heel));
    const sails = [-1, 1].map(side => {
      const boat = createBoat('laser', { x: 0, y: -10000, theta: 0, vx: 2.4, vy: 0,
        heel: side * heel, heave: .08, boom: side * 48 * P.DEG, sheet: .63 }, field);
      const sail = P.aero(boat, field, { vx: 0, vy: -side * 8.5 });
      assert.equal(sail.main.area, 7.06);
      for (const strip of sail.main.sections) assert.ok(Math.abs(strip.localAirSpeed - expectedSpeed) < 1e-10);
      assert.ok(Math.abs(sail.fz + Math.tan(side * heel) * sail.sideForce) < 1e-10);
      assert.ok(Math.abs(sail.qArea - .5 * 1.225 * expectedSpeed ** 2 * 7.06) < 1e-9);
      return sail;
    });
    const [port, starboard] = sails;
    for (const key of ['drive', 'fz', 'pitchMoment']) assert.ok(Math.abs(port[key] - starboard[key]) < 1e-8);
    for (const key of ['sideForce', 'rollMoment', 'yawMoment']) assert.ok(Math.abs(port[key] + starboard[key]) < 1e-8);
  }
});

test('Laser wetted hull keeps forward resistance on its immersed side', () => {
  const { physics: P, createBoat, stepBoat, fixedDt } = createSimulation();
  const field = { speed: 0, waveHeight: 0, shelter: false };
  function resistance(heel, heave) {
    const boat = createBoat('laser', { x: 0, y: -10000, theta: 0, vx: 2.4, vy: 0,
      heel: heel * P.DEG, heave, crewPose: 1, crewSide: 0 }, field);
    stepBoat(boat, { crewPose: 1 }, field, fixedDt);
    return -boat.forces.hullF;
  }
  assert.ok(resistance(45) > .5 * resistance(0));
  assert.ok(Math.abs(resistance(45) - resistance(-45)) < 1e-9);
  assert.equal(Math.abs(resistance(45, 2)), 0);
});

test('VMG upwind uses the velocity through the water including leeway', () => {
  const { physics: P, createBoat } = createSimulation();
  const field = { speed: 6, direction: 0, waveHeight: 0, gusts: 0, shelter: false };
  const boat = createBoat('laser', { theta: 0, vx: 3, vy: 2, waterX: 1, waterY: -1 }, field);
  const instruments = P.instruments(boat, null, field);
  assert.ok(Math.abs(instruments.vmgWind - 3) < 1e-12);
  assert.ok(Math.abs(instruments.leeway - Math.atan2(-3, 2)) < 1e-12);
});
