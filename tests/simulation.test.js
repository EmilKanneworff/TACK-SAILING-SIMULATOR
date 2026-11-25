'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const { verify, verifyReference } = require('../scripts/simulation-replay.cjs');
const { run } = require('../scripts/laser-rotation.cjs');
const { createSimulation } = require('../assets/simulation/node');
const { bakeFields } = require('../server/bake-fields');

test('recorded inputs replay headlessly across all five boats', () => {
  assert.equal(verifyReference(), 6);
  assert.equal(globalThis.SailPhysics, undefined);
  assert.equal(globalThis.SailingWorld, undefined);
});

test('the cached heave search returns the same equilibrium as full water sampling', () => {
  const { createBoat, physics: P, profiles } = createSimulation();
  const env = { ...P.DEFAULT_ENV, speed: 13, direction: 56, waveHeight: 1.4, chop: .6 };
  const sea = { time: 0 };
  P.advanceWaveProfile(sea, { ...env, speed: 8, direction: 255, waveHeight: .8 });
  sea.time = 11.7;
  P.advanceWaveProfile(sea, env);
  const rows = [];
  for (const boat of profiles.LIST) {
    const trials = [{ y: -1400, heel: 0, pitch: 0 }, { y: -40, heel: -.41, pitch: .21 }];
    if (boat.id === 'laser') trials.push({ y: -47, heel: -1.6, pitch: .12 });
    for (const { y, heel, pitch } of trials) {
      const s = createBoat(boat.id, { x: -80, y, theta: .9, heel, pitch,
        heave: .6, time: 12, crewPose: 3, crewSide: -1 }, env);
      s.waveProfile = sea.waveProfile;
      s.heaveVelocity = .35;
      const probe = structuredClone(s);
      const foiling = boat.kind === 'foiler';
      let lower = foiling ? -4 : -Math.max(1.2, boat.hullDepth * 1.3);
      let upper = foiling ? 5 : Math.max(1.4, boat.hullDepth);
      const counts = { queries: 0 }, cache = P.waterForHeaveSearch(counts);
      let baselineQueries = 0, candidateQueries = 0, baselineMs = 0, cachedMs = 0;
      const uncached = {
        sample: (...args) => { baselineQueries++; return P.waveAt(...args); },
        height: (...args) => { baselineQueries++; return P.waveHeightAt(...args); }
      };
      const cached = {
        sample: (...args) => { candidateQueries++; return cache.sample(...args); },
        height: (...args) => { candidateQueries++; return cache.height(...args); }
      };
      for (let i = 0; i < (foiling ? 40 : 38); i++) {
        probe.heave = (lower + upper) / 2;
        let start = performance.now();
        const direct = P.hydrostatics(probe, env, false, uncached);
        baselineMs += performance.now()-start;
        start = performance.now();
        const reused = P.hydrostatics(probe, env, false, cached);
        cachedMs += performance.now()-start;
        assert.deepEqual(reused,direct,`${boat.id} at ${y} candidate ${i}`);
        const { buoyancy, weight } = direct;
        if (buoyancy > weight) lower = probe.heave;
        else upper = probe.heave;
      }
      assert.equal(candidateQueries, baselineQueries);
      assert.ok(counts.queries < baselineQueries / 10);
      assert.equal(P.equilibriumHeave(s, env), (lower + upper) / 2, `${boat.id} at ${y}`);
      assert.equal(s.heave, .6);
      for (const atHeight of [lower, upper]) {
        probe.heave = atHeight;
        assert.deepEqual(P.hydrostatics(probe, env, true, cache), P.hydrostatics(probe, env));
      }
      rows.push({ boat: boat.id, y, heel, baselineQueries, cachedQueries: counts.queries, baselineMs, cachedMs });
    }
  }
  if(process.env.TACK_MEASURE_HEAVE)console.log(JSON.stringify(rows));
});

test('the release depth and terrain grids preserve every computed sample', async () => {
  const { packed, loader } = bakeFields();
  const modules = [require('../assets/archipelago'), require('../assets/archipelago-relief'),
    require('../assets/simulation/terrain'), require('../assets/water-depth'), require('../assets/wind-field')];
  const world = { URL, DecompressionStream, Response, performance, self: { location: { href: 'http://localhost/assets/live-worker.js' } },
    fetch: url => {
      assert.equal(url.pathname, '/assets/archipelago-fields.bin');
      return new Response(packed);
    } };
  const source = {};
  for (const install of modules) {
    install(world);
    install(source);
  }
  const depth = source.SailingWaterDepth.data();
  const wind = source.SailingWind.groundRaster();
  runInNewContext(loader, world);
  await world.TackArchipelagoFieldsReady;
  const baked = world.TackArchipelagoFields;
  assert.ok(baked);
  const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  assert.equal(bytes(baked.depth).compare(bytes(depth)), 0);
  for (const key of ['land', 'relief', 'cover']) assert.equal(bytes(baked.wind[key]).compare(bytes(wind[key])), 0, key);
  const bounds = source.ArchipelagoData.fieldBounds;
  const { width, height } = source.SailingWaterDepth;
  const points = [[4, -47], [0, -6], [-180, -340], [575.3, -1190.7],
    [bounds.minX, bounds.minY], [bounds.maxX, bounds.maxY], [bounds.maxX+.1, bounds.minY],
    [bounds.minX+(bounds.maxX-bounds.minX)/(width-1)*5.4,bounds.minY+(bounds.maxY-bounds.minY)/(height-1)*14.7]];
  assert.equal(world.SailingWaterDepth.data(), baked.depth);
  assert.equal(world.SailingWind.groundRaster().relief, baked.wind.relief);
  for (const [x, y] of points) {
    assert.deepEqual(world.SailingWaterDepth.sample(x, y), source.SailingWaterDepth.sample(x, y));
    assert.equal(world.SailingWorld.heightAt(x,y), source.SailingWorld.heightAt(x,y));
  }
  world.fetch = () => new Response(null, { status: 404 });
  delete world.TackArchipelagoFields;
  runInNewContext(loader, world);
  await world.TackArchipelagoFieldsReady;
  assert.match(world.TackArchipelagoFieldsError.message, /Kunne ikke hente øhavets/);
  assert.equal(world.TackArchipelagoFields, undefined);
});

test('an absolute sheet demand holds its endpoint despite a stale rate command', () => {
  const { physics: P, profiles } = createSimulation();
  for (const boat of profiles.LIST) {
    const state = { sheet: .2 };
    for (let n = 0; n < 360; n++) P.updateSheet(state, boat, { sheetTarget: .47, trim: -1, trimFast: true }, {}, 1 / 60);
    assert.equal(state.sheet, .47, boat.id);
    for (let n = 0; n < 360; n++) P.updateSheet(state, boat, { sheetTarget: 0, trim: 1, trimFast: true }, {}, 1 / 60);
    assert.equal(state.sheet, 0, boat.id);
  }
});

test('the reefed cruiser can bear away on both tacks in a strong breeze', () => {
  const { createBoat, stepBoat, physics: P, profiles: B } = createSimulation();
  const cruiser = B.get('yacht');
  const blade = cruiser.waterBlades.rudder;
  assert.equal(blade.root, B.hullBottom(cruiser, blade.x, 0));
  assert.ok(Math.abs((blade.root - blade.tip) * blade.chord * (1 + blade.taper) / 2 - blade.area) < 1e-9);
  const field = { boatId: 'yacht', speed: 17, direction: 0, windSeed: 2647, gusts: 0, chop: 0, waveHeight: 0,
    shelter: false, difficulty: 'hard', autoBalance: false, autoRecovery: false };

  for (const tack of [-1, 1]) {
    const theta = (90 - tack * 72) * P.DEG;
    const a = P.axes(theta);
    const start = createBoat('yacht', { x: 0, y: -12000, theta, heel: tack * 36 * P.DEG,
      vx: 3.7 * a.fx - tack * .35 * a.rx, vy: 3.7 * a.fy - tack * .35 * a.ry,
      sheet: P.sheetFromTrim(.60, cruiser), crewPose: 3, crewSide: tack,
      cruiserRig: { reef: 2, reefTarget: 2 } }, field);
    const neutral = structuredClone(start);
    const bearingAway = s => -tack * P.wrap(s.theta - theta) / P.DEG;
    for (let tick = 0; tick < 240; tick++) {
      stepBoat(neutral, { steer: 0, crewPose: 3, rig: { reef: 2 } }, field, 1 / 60);
      stepBoat(start, { steer: tack, crewPose: 3, rig: { reef: 2 } }, field, 1 / 60);
    }
    assert.ok(bearingAway(neutral) < 0, 'neutral helm still allows weather helm');
    assert.ok(bearingAway(start) > 15, 'countersteering turns the hull away from the wind');
    assert.ok(start.forces.yawRudder * tack < 0);
    assert.equal(start.forces.yawAssist, 0);
    assert.equal(start.capsized, false);
  }
});

test('reefing follows geometric area and changes only the selected sails', () => {
  const { createBoat, profiles, physics: P } = createSimulation();
  const field = { ...P.DEFAULT_ENV, speed: 7, gusts: 0, waves: 0, shelter: false };
  const uniform = { vx: -4, vy: -6, speed: Math.hypot(4, 6) };
  for (const boat of profiles.LIST) {
    const s = createBoat(boat.id, { x: 0, y: -12000, theta: 0, pitch: 0, heel: 0, heave: 2, boom: .42, vx: 0, vy: 0 }, field);
    s.rig ??= {};
    for (const reef of [1, 2]) {
      s.cruiserRig = { reef: 0, headsail: 0 };
      s.rig.reef = 0;
      const full = P.aero(s, field, uniform);
      s.cruiserRig.reef = reef;
      s.rig.reef = reef / 2;
      const reduced = P.aero(s, field, uniform);
      const areaRatio = reduced.main.area / full.main.area;
      assert.ok(Math.abs(areaRatio - reduced.main.luffScale * reduced.main.chordScale) < 1e-10, boat.id);
      if (boat.rigidWing) {
        assert.equal(areaRatio, 1);
        assert.ok(Math.abs(reduced.main.cl) < Math.abs(full.main.cl));
      } else {
        assert.ok(areaRatio < 1, boat.id);
        assert.ok(Math.abs(reduced.main.drive / full.main.drive - areaRatio) < 1e-9, boat.id);
      }
      if (boat.kind !== 'foiler' && full.jib) assert.equal(reduced.jib.area, full.jib.area, boat.id);
      if (boat.kind === 'foiler') assert.ok(reduced.jib.area < full.jib.area, boat.id);
    }
  }
});

test('gravity through the centre of mass accelerates vertically without rotating a tilted hull', () => {
  const { physics: P } = createSimulation();
  const mass = 150, dt = 1 / 60, weight = mass * 9.81;
  const cg = { x: .35, y: .4, z: -.6 };
  const inertia = { roll: 140, pitch: 200, yaw: 220, xy: -35, xz: 50, yz: 33 };
  for (const side of [-1, 1]) {
    const s = { x: 0, y: 0, heave: 1, theta: 1.2, heel: side * .62, pitch: -.37,
      vx: 0, vy: 0, heaveVelocity: 0, heelRate: 0, pitchRate: 0, omega: 0 };
    const before = P.bodyPoint(s, cg);
    // A vertical force gives the world-space torque r × (0, 0, -weight).
    const torque = { x: -weight * before.y, y: weight * before.x };
    const along = torque.x * Math.cos(s.theta) + torque.y * Math.sin(s.theta);
    const starboard = torque.x * Math.sin(s.theta) - torque.y * Math.cos(s.theta);
    P.integrateMass(s, dt, mass, cg, inertia, { x: 0, y: 0, z: -weight },
      { roll: along * Math.cos(s.pitch), pitch: starboard, yaw: 0 });
    const after = P.bodyPoint(s, cg);
    assert.ok(Math.hypot(s.heelRate, s.pitchRate, s.omega) < 1e-12);
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 1e-12);
    assert.ok(Math.abs(after.z - before.z + 9.81 * dt * dt) < 1e-12);
  }
});

test('an off-axis mass couples roll and pitch with the analytically expected sign and strength', () => {
  const { physics: P } = createSimulation();
  const dt = 1 / 60, pitchMoment = 20;
  for (const side of [-1, 1]) {
    const s = { x: 0, y: 0, heave: 0, theta: 0, heel: 0, pitch: 0,
      vx: 0, vy: 0, heaveVelocity: 0, heelRate: 0, pitchRate: 0, omega: 0 };
    const inertia = { roll: 100, pitch: 60, yaw: 110, xz: side * 20 };
    P.integrateMass(s, dt, 150, { x: 0, y: 0, z: 0 }, inertia, { x: 0, y: 0, z: 0 },
      { roll: 0, pitch: pitchMoment, yaw: 0 });
    const determinant = inertia.roll * inertia.pitch - inertia.xz ** 2;
    assert.ok(Math.abs(s.heelRate / dt + inertia.xz * pitchMoment / determinant) < 1e-6);
    assert.ok(Math.abs(s.pitchRate / dt - inertia.roll * pitchMoment / determinant) < 1e-6);
  }
});

test('rotation about a moving centre of mass preserves spatial angular momentum without external torque', () => {
  const { physics: P } = createSimulation();
  const dt = 1 / 60, mass = 150, stationary = { x: 0, y: 0, z: 0 };
  const s = { x: 0, y: 0, heave: 0, theta: .5, heel: -.6, pitch: .35,
    vx: 0, vy: 0, heaveVelocity: 0, heelRate: .5, pitchRate: -.3, omega: .42 };
  const tensor = { roll: 100, pitch: 130, yaw: 110, xy: 14, xz: -8, yz: 12 };
  const momentum = inertia => {
    const fx = Math.cos(s.theta), fy = Math.sin(s.theta);
    const spin = { x: fx * Math.cos(s.pitch) * s.heelRate + fy * s.pitchRate,
      y: fy * Math.cos(s.pitch) * s.heelRate - fx * s.pitchRate, z: s.omega + Math.sin(s.pitch) * s.heelRate };
    const local = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }].map(p => {
      const q = P.bodyOffset(s, p);
      return q.f * (fx * spin.x + fy * spin.y) + q.r * (fy * spin.x - fx * spin.y) + q.up * spin.z;
    });
    const [x, y, z] = local, { roll, pitch, yaw, xy, xz, yz } = inertia;
    return P.bodyPoint({ ...s, x: 0, y: 0, heave: 0 },
      { x: roll * x + xy * y + xz * z, y: xy * x + yaw * y + yz * z, z: xz * x + yz * y + pitch * z });
  };
  const before = momentum(tensor);
  for (let i = 0; i < 120; i++) {
    const cg = { x: .4 * Math.sin(i * dt), y: .3 * Math.sin(2 * i * dt), z: .15 * Math.sin(i * dt) };
    P.integrateMass(s, dt, mass, cg, tensor, stationary, { roll: 0, pitch: 0, yaw: 0 });
  }
  const after = momentum(s.massMotion.inertia);
  assert.ok(Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z) < 1e-8);
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

test('an opposing wave at the blade does not reverse helm input until the hull backs', () => {
  const { physics: P, createBoat, fixedDt } = createSimulation();
  const field = { boatId: 'laser', speed: 0, direction: 0, gusts: 0, shelter: false, difficulty: 'hard' };
  const state = createBoat('laser', { theta: 0, vx: .6, vy: 0, waterX: .1 }, field);
  const right = { steer: 1 };
  // The hull travels forward while a passing wave runs backwards over the blade.
  state.forces.rudder = { wet: .7, axialFlow: -.45 };
  for (let i = 0; i < 30; i++) P.updateHelm(state, right, field, fixedDt);
  assert.equal(state.steering.localForward, -.45);
  assert.ok(state.steering.meanForward > .4);
  assert.ok(state.rudder > .2);
  assert.equal(state.helmFlowSign, 1);

  state.vx = -.35;
  for (let i = 0; i < 6; i++) P.updateHelm(state, right, field, fixedDt);
  assert.equal(state.helmFlowSign, 1);
  for (let i = 0; i < 45; i++) P.updateHelm(state, right, field, fixedDt);
  assert.equal(state.helmFlowSign, -1);
  assert.ok(state.rudder < -.2);
});

test('a reefed Laser can bear away in strong wind with independent rudder and sheet input', () => {
  const { physics: P, createBoat, stepBoat, fixedDt } = createSimulation();
  const field = { boatId: 'laser', speed: 16.8, direction: 90, gusts: 0, waveHeight: 0,
    chop: 0, shelter: false, difficulty: 'hard', autoRecovery: false };
  for (const side of [-1, 1]) {
    const theta = -side * 50 * P.DEG;
    const course = P.axes(theta - side * .09);
    const boat = createBoat('laser', { x: 0, y: -3500, theta, vx: 3.91 * course.fx, vy: 3.91 * course.fy,
      heel: side * 28 * P.DEG, sheet: P.sheetFromTrim(.519, 'laser'), crewPose: 3, crewSide: -side,
      cruiserRig: { reef: 2, reefTarget: 2 } }, field);
    const step = trim => stepBoat(boat, { steer: side, trim, trimFast: true, crewPose: 3, rig: { reef: 2 } }, field, fixedDt);
    const turn = () => side * P.wrap(theta - boat.theta) / P.DEG;
    const sheet = boat.sheet;
    for (let i = 0; i < 69; i++) step(0);
    assert.ok(turn() > 3); // Still turns under load before the sheet is eased.
    assert.ok(boat.rudder * side > 15 * P.DEG && boat.forces.rudder.wet > 0);
    assert.ok(Number.isFinite(boat.sail.luff) && Number.isFinite(boat.rig.flutter));
    assert.equal(boat.sheet, sheet);
    for (let i = 0; i < 100; i++) step(-1);
    assert.equal(boat.sheet, 0);
    assert.ok(turn() > 27);
    assert.equal(boat.forces.yawAssist, 0);
    assert.equal(boat.crewPose, 3);
    for (let i = 0; i < 90 && !boat.capsized; i++) step(0);
    assert.equal(boat.capsized, true);
  }
});

test('slack wing trim unloads the catamaran without moving the helm, and hauling in restores drive', () => {
  const { physics: P, createBoat, stepBoat, fixedDt } = createSimulation();
  const field = { boatId: 'ac72', speed: 16.8, direction: 90, gusts: 0,
    waveHeight: 0, chop: 0, shelter: false, difficulty: 'hard' };
  for (const side of [-1, 1]) {
    const theta = side * 79 * P.DEG;
    const boat = createBoat('ac72', { x: 0, y: -3500, theta, vx: 14.1 * Math.cos(theta),
      vy: 14.1 * Math.sin(theta), heave: .70, pitch: .8 * P.DEG, sheet: .55 }, field);
    const run = (trim, steps) => {
      for (let i = 0; i < steps; i++) stepBoat(boat, { trim, trimFast: true, steer: 0 }, field, fixedDt);
    };
    run(0, 150);
    const powered = boat.sail.drive;
    const speed = boat.speed;
    assert.ok(powered > 5000);
    run(-1, 150);
    assert.equal(boat.sheet, 0);
    assert.equal(Math.abs(boat.wing.flap), 0);
    assert.equal(boat.wing.twist, 0);
    assert.ok(Math.abs(boat.sail.jib.alpha) < 2 * P.DEG);
    assert.ok(Math.abs(boat.sail.drive) < .15 * powered);
    assert.ok(boat.speed < speed - 1 && boat.speed > 5);
    assert.equal(boat.rudder, 0);
    assert.equal(boat.forces.yawAssist, 0);
    run(1, 66);
    run(0, 60);
    assert.ok(boat.sail.drive > .45 * powered);
    assert.equal(boat.rudder, 0);
  }
});

test('wind bearing alone does not alter slow foilboat helm travel', () => {
  const { physics: P, createBoat, fixedDt } = createSimulation();
  for (const id of ['ac75', 'ac72']) {
    const slowRudder = [60, 170].map(direction => {
      const field = { boatId: id, speed: 16.8, direction, gusts: 0, shelter: false, difficulty: 'hard' };
      const boat = createBoat(id, { x: 0, y: -3500, theta: Math.PI / 2, vx: 0, vy: 3 }, field);
      for (let i = 0; i < 50; i++) P.updateHelm(boat, { steer: 1 }, field, fixedDt);
      assert.ok(boat.rudder > P.configFor(id).waterborneRudderMax);
      return boat.rudder;
    });
    assert.equal(slowRudder[0], slowRudder[1], id);
  }
});

test('the foil catamaran can steer out of a slow run at 67.4 percent trim', () => {
  const { physics: P, createBoat, stepBoat, fixedDt } = createSimulation();
  const field = { boatId: 'ac72', speed: 9.7, direction: 270, gusts: 0,
    waveHeight: 0, chop: 0, shelter: true, difficulty: 'hard', autoRecovery: false };
  const sheet = .674;
  const speed = 5.8 / 1.9438444924;
  for (const side of [-1, 1]) {
    const theta = -side * P.DEG;
    const start = createBoat('ac72', { x: 575, y: -1190, theta, sheet,
      vx: speed * Math.cos(theta), vy: speed * Math.sin(theta), crewPose: 3,
      boom: side * P.boomLimit(sheet, 'ac72') }, field);
    const run = (steer, sheetTarget) => {
      const boat = structuredClone(start);
      for (let tick = 0; tick < 360; tick++) {
        stepBoat(boat, { steer, steerDigital: true, crewPose: 3, sheetTarget, trimFast: true }, field, fixedDt);
      }
      assert.equal(boat.ground.contact, false);
      assert.equal(boat.capsized, false);
      assert.equal(boat.forces.yawAssist, 0);
      return boat;
    };
    const crossing = run(side);
    const holdingSide = run(-side);
    const eased = run(0, 0);
    assert.ok(side * P.wrap(theta - crossing.theta) > 20 * P.DEG);
    assert.ok(side * P.wrap(holdingSide.theta - theta) > 5 * P.DEG); // The leeward turn works against the rig and main foils.
    assert.ok(crossing.boom * side < 0 && crossing.sail.drive > 2000);
    assert.equal(crossing.sheet, sheet);
    assert.equal(holdingSide.sheet, sheet);
    assert.equal(eased.sheet, 0);
    assert.equal(eased.rudder, 0);
    assert.ok(eased.speed > speed + .7 && Math.abs(eased.boom) > 75 * P.DEG);
  }
});

test('manual rudder can hold a run and deep broad reaches while each rig builds way', () => {
  const { physics: P, createBoat, stepBoat, fixedDt } = createSimulation();
  const field = { speed: 8, direction: 270, gusts: 0, waveHeight: 0, chop: 0,
    shelter: false, difficulty: 'hard', autoRecovery: false };
  for (const boat of ['laser', 'dinghy', 'yacht', 'ac75', 'ac72']) {
    const traces = [0, 16, -16].map(heading => {
      const theta = heading * P.DEG;
      const s = createBoat(boat, { x: -1500, y: -1800, theta, sheet: .04, crewPose: 1,
        vx: .55 * Math.cos(theta), vy: .55 * Math.sin(theta) }, field);
      let distance = 0, error = 0, count = 0;
      for (let tick = 0; tick < 16 / fixedDt; tick++) {
        const steer = P.clamp(2.25 * P.wrap(s.theta - theta) + 1.2 * s.omega, -.85, .85);
        stepBoat(s, { steer, steerDigital: false, trim: 0, crewPose: 1 }, field, fixedDt);
        assert.equal(s.capsized, false, boat + ' at ' + heading);
        if (s.time >= 12) {
          distance += s.vx;
          error += Math.abs(P.wrap(s.theta - theta)) / P.DEG;
          count++;
        }
      }
      assert.equal(s.sheet, .04);
      assert.equal(s.crewPose, 1);
      const vmg = distance / count;
      assert.ok(vmg > 2.3 && error / count < 16, JSON.stringify({ boat, heading, vmg, error: error / count }));
      return vmg;
    });
    assert.ok(Math.abs(traces[1] - traces[2]) < .025, boat + ' should mirror a broad reach on either tack');
  }
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
    assert.equal(boat.crewSide, 1, id);
    assert.ok(boat.crewSideBlend < 0, id);
    for (const pose of [3, 2, 1]) holdSide(1, pose);
    assert.ok(boat.crewSideBlend > .98, id);
  }
});

test('Easy balances according to true wind independent of apparent wind and heel', () => {
  const { physics: P, createBoat, profiles } = createSimulation();
  const env = { speed: 8, direction: 180, gusts: 0, waveHeight: 0, shelter: false, difficulty: 'easy' };
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

test('Hard keeps the old side through the wind eye until an explicit side command', () => {
  const sim = createSimulation();
  const P = sim.physics;
  const env = { speed: 7.5, direction: 180, gusts: 0, waveHeight: 0, shelter: false, difficulty: 'hard' };
  for (const { id } of sim.profiles.LIST) for (const from of [-1, 1]) {
    const boat = sim.createBoat(id, { x: 0, y: -12000, theta: -90 * P.DEG, crewSide: from }, env);
    boat.vx = -2 * from;
    boat.wind = P.windForState(boat, env);
    assert.ok(Math.abs(boat.wind.twa) < 1e-12, id);
    assert.equal(Math.sign(boat.wind.awa), from, id);
    P.updateCrew(boat, { crewPose: 2 }, env, sim.fixedDt);
    assert.equal(boat.crewSide, from, id);
    P.updateCrew(boat, { crew: -from }, env, sim.fixedDt);
    assert.equal(boat.crewSide, -from, id);
    assert.equal(Math.sign(boat.crewSideBlend), from, id);
    for (let n = 0; n < 250; n++) P.updateCrew(boat, {}, env, sim.fixedDt);
    assert.ok(-from * boat.crewSideBlend > .95, id);
  }
});

test('the foil inverse uses the same vertical force in reverse and under spanwise flow', () => {
  const { foilCases } = require('../scripts/model-corrections.cjs');
  const [forward, reverse, above, below, span, oblique, pureSpan, almost, opposite] = foilCases();
  for (const row of [forward, reverse, above, below, span, oblique]) {
    assert.ok(Math.abs(row.verticalAtTarget - 1000) < .06, JSON.stringify(row));
    assert.equal(row.saturated, false);
    assert.ok(row.powerAtTarget <= 0);
  }
  assert.ok(Math.abs(forward.targetFlapDeg + reverse.targetFlapDeg) < 1e-4);
  assert.ok(Math.abs(above.targetFlapDeg - below.targetFlapDeg) < 1e-3);
  assert.deepEqual(span.forceAtTarget, forward.forceAtTarget);
  for (const row of [pureSpan, almost, opposite]) {
    assert.ok(Math.abs(row.verticalAtTarget) < 1e-5);
    assert.equal(row.saturated, true);
  }
  assert.equal(foilCases().at(-1).saturated, true);
});

test('added water and moving masses preserve isolated momentum', () => {
  const { internalTrial, waterInertiaTrial } = require('../scripts/model-corrections.cjs');
  const a = waterInertiaTrial(60), b = waterInertiaTrial(120);
  for (const result of [a, b]) {
    assert.ok(result.linearPeak < 1e-8);
    assert.ok(result.angularPeak < 1e-8);
    assert.ok(result.energyPeak < .03);
  }
  assert.ok(b.energyPeak < a.energyPeak * .4);
  for (const result of [internalTrial('laser','crew'),internalTrial('ac75','arm'),internalTrial('laser','boom')]) {
    assert.ok(result.peakUnbalancedMomentum < 1e-8);
    assert.ok(result.samples.some(row => Math.hypot(row.omega.x,row.omega.y,row.omega.z) > .005));
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
  const reference = require('./fixtures/laser-rotation-rudder-geometry.json');
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

test('heeled keelboats resist forward and lateral motion with only the leeward side immersed', () => {
  const { physics: P, createBoat, stepBoat, fixedDt } = createSimulation();
  const field = { speed: 0, gusts: 0, waveHeight: 0, chop: 0, shelter: false, difficulty: 'hard' };
  for (const boatId of ['dinghy', 'yacht']) {
    const sample = (side, heave) => {
      const boat = createBoat(boatId, { x: 0, y: -10000, theta: 0, vx: 3, vy: -2 * side,
        heel: side * 65 * P.DEG, heave, crewPose: 1, crewSide: 0 }, field);
      stepBoat(boat, { crewPose: 1 }, field, fixedDt);
      return boat.forces;
    };
    const port = sample(-1), starboard = sample(1);
    assert.ok(starboard.hullF < -100 && starboard.hullR < -1000, boatId);
    assert.ok(Math.abs(port.hullF - starboard.hullF) < 1e-6, boatId);
    assert.ok(Math.abs(port.hullR + starboard.hullR) < 1e-6, boatId);
    const clear = sample(1, 4);
    assert.equal(clear.hullF, 0, boatId);
    assert.equal(clear.hullR, 0, boatId);
  }
});

test('VMG upwind uses the velocity through the water including leeway', () => {
  const { physics: P, createBoat } = createSimulation();
  const field = { speed: 6, direction: 0, waveHeight: 0, gusts: 0, shelter: false };
  const boat = createBoat('laser', { theta: 0, vx: 3, vy: 2, waterX: 1, waterY: -1 }, field);
  const instruments = P.instruments(boat, null, field);
  assert.ok(Math.abs(instruments.vmgWind - 3) < 1e-12);
  assert.ok(Math.abs(instruments.leeway - Math.atan2(-3, 2)) < 1e-12);
});


test('Laser only applies blade loads at submerged points on the rendered profile', () => {
  const sim = createSimulation();
  const { physics: P } = sim;
  const field = { speed: 0, waveHeight: 0, chop: 0, shelter: false };
  const initial = { x: 0, y: -13000, theta: 0, vx: 3, heave: .17, pitch: 4 * P.DEG };
  const areas = [-35, 35].map(side => {
    const state = sim.createBoat('laser', { ...initial, heel: side * P.DEG, rudder: Math.sign(side) * 18 * P.DEG }, field);
    const contact = P.rudderContacts(state, field);
    assert.equal(contact.nominalArea, .105);
    assert.ok(contact.geometryArea > .10 && contact.geometryArea < .12);
    const wet = contact.sections.filter(section => section.wetArea > 0);
    assert.ok(wet.length < contact.sections.length);
    for (const section of wet) {
      assert.ok(section.contact.depth >= 0);
      assert.ok(Number.isFinite(section.moment.yaw));
    }
    return wet.reduce((total, section) => total + section.wetArea, 0);
  });
  assert.ok(Math.abs(areas[0] - areas[1]) < 1e-10);
});

test('both foil rudder wings rotate with the blade using the same steering axis', () => {
  const trial = require('../scripts/steering-trials.cjs').load('.');
  for (const id of ['ac75', 'ac72']) {
    const s = trial.createBoat(id, {}, {speed:0, waveHeight:0, shelter:false});
    for (const key of trial.FoilingPhysics.foilKeys(s).filter(key => key.startsWith('rudder'))) {
      const neutral = trial.FoilingPhysics.foilPose(s, key);
      for (const angle of [-.2, .2]) {
        s.rudder = angle;
        const turned = trial.FoilingPhysics.foilPose(s, key);
        assert.deepEqual(turned.wingCentre, neutral.wingCentre);
        assert.deepEqual(turned.chordDirection, {x:Math.cos(angle),y:0,z:-Math.sin(angle)});
        assert.deepEqual(turned.spanDirection, {x:Math.sin(angle),y:0,z:Math.cos(angle)});
      }
      s.rudder = 0;
    }
  }
});

test('Laser crew joints do not kick the hull as the boom passes a stationary crew setting', () => {
  const runtime = createSimulation();
  const field = { speed: 0, direction: 0, gusts: 0, waveHeight: .72, chop: .23, shelter: false,
    waveSeed: 318031, windSeed: 318031, difficulty: 'hard' };
  const theta = Math.PI / 9;
  for (const frequency of [60, 120]) {
    const state = runtime.createBoat('laser', { x: -775, y: -2400, theta,
      vx: 3 * Math.cos(theta), vy: 3 * Math.sin(theta), heel: 24 * Math.PI / 180,
      pitch: 2 * Math.PI / 180, crewPose: 1, crewSide: 0, sheet: runtime.physics.sheetFromTrim(.35, 'laser') }, field);
    for (let i = 0; i < 3 * frequency; i++) {
      const { vx, vy, heaveVelocity } = state;
      runtime.stepBoat(state, { crewPose: 1, crew: 0, foreAft: 0 }, field, 1 / frequency);
      const delta = Math.hypot(state.vx - vx, state.vy - vy, state.heaveVelocity - heaveVelocity);
      assert.ok(delta < 7 / frequency, `Velocity jump ${delta} m/s at ${state.time}s, ${frequency}Hz`);
    }
  }
});
