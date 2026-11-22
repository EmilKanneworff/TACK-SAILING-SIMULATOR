'use strict';

const { createSimulation } = require('../assets/simulation/node');

const dt = 1 / 60;
const field = { speed: 0, direction: 0, waveHeight: 0, chop: 0, gusts: 0,
  shelter: false, autoBalance: false, autoRecovery: false, difficulty: 'hard', boatId: 'laser' };
const control = { steer: 0, trim: 0, crewPose: 2 };
const atRest = { x: 0, y: -12000, theta: 0, vx: 0, vy: 0, crewPose: 2, crewSide: 0, sheet: .35 };
const model = createSimulation();
const P = model.physics;
const D = P.DEG;

function snapshot(s) {
  const f = s.forces;
  return {
    t: s.time, heading: P.wrap360(90 - s.theta / D), yawRate: -s.omega / D,
    heel: s.heel / D, pitch: s.pitch / D, waterline: -s.heave,
    sheet: s.sheet, boom: s.boom / D, crew: [s.crewPose, s.crewPoseBlend, s.crewSide, s.crewSideBlend],
    rudder: s.rudder / D, wet: { rudder: f.rudder?.wet, board: f.board?.wet, volume: s.hydro.submergedVolume },
    weight: Math.abs(s.hydro.weight), buoyancy: s.hydro.buoyancy, addedInertia: f.waterInertia,
    yawMoments: f.ledger && Object.fromEntries(Object.entries(f.ledger).map(([name, values]) => [name, values.moment.yaw])),
    totalYaw: f.yaw, centerOfMass: s.hydro.cg, boatYawInertiaAtCG: s.massMotion?.inertia.yaw
  };
}

function trajectory(initial, weather, step) {
  const s = model.createBoat('laser', { ...atRest, ...initial }, weather);
  const readings = [snapshot(s)];
  const ticks = Math.round(2 / step);
  for (let i = 1; i <= ticks; i++) {
    model.stepBoat(s, control, weather, step, { diagnostics: true });
    if (i === 1 || i % Math.round(.25 / step) === 0) readings.push(snapshot(s));
  }
  return readings;
}

function knownMoment() {
  const wet = model.createBoat('laser', atRest, field);
  model.stepBoat(wet, control, field, dt, { diagnostics: true });
  const inertia = { yaw: wet.forces.inertiaYaw, roll: wet.forces.inertiaRoll, pitch: wet.forces.inertiaPitch };
  const fluid = wet.forces.waterInertia;
  const moment = { yaw: 20, pitch: 0, roll: 0 };
  const force = { x: 0, y: 0, z: 0 };
  const mass = model.profiles.get('laser').mass;
  const compute = added => {
    const s = model.createBoat('laser', atRest, field);
    P.integrateMass(s, dt, mass, s.hydro.cg, inertia, force, moment, added);
    return s.omega / dt;
  };
  const x = wet.hydro.cg.x;
  const cross = x * fluid.sway - fluid.firstMoment;
  const inertiaAtCG = inertia.yaw - mass * (x ** 2 + wet.hydro.cg.z ** 2);
  const matrixYaw = inertiaAtCG + fluid.secondMoment - 2 * x * fluid.firstMoment + x * x * fluid.sway;
  const effectiveYaw = matrixYaw - cross ** 2 / (mass + fluid.sway);
  return { moment: moment.yaw, dry: compute(null), wet: compute(fluid), expectedWet: moment.yaw / effectiveYaw,
    effectiveYaw, dryYawInertia: inertiaAtCG, dryMass: mass, addedSway: fluid.sway };
}

function acceleratingWater() {
  const waterAcceleration = .8;
  const sim = createSimulation({ water() {
    return { height: 0, dx: 0, dy: 0, velocity: 0, waterVx: 0, waterVy: 0, waterVz: 0,
      waterAx: 0, waterAy: waterAcceleration, curvature: 0 };
  } });
  const s = sim.createBoat('laser', atRest, field);
  sim.stepBoat(s, control, field, dt, { diagnostics: true });
  const cg = s.hydro.cg;
  const motion = P.pointMotion(s, P.bodyOffset(s, cg));
  return { waterAcceleration, boatAccelerationAtCG: motion.y / dt, rotationAcceleration: s.omega / dt, ...snapshot(s) };
}

function run() {
  return {
    passive: trajectory({ omega: .55 }, field, dt),
    knownMoment: knownMoment(),
    broadReach: trajectory({ theta: -153 * D + 90 * D, crewSide: -1 }, { ...field, speed: 8.5 }, dt),
    halfStep: trajectory({ theta: -153 * D + 90 * D, crewSide: -1 }, { ...field, speed: 8.5 }, dt / 2),
    acceleratingWater: acceleratingWater()
  };
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
