'use strict';

const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(process.argv[2] || '.');
const { createSimulation } = require(path.join(root, 'assets/simulation/node'));
const { stampHtml } = require(path.join(root, 'server/revision'));
const runtime = createSimulation();
const { physics: P, profiles } = runtime;
const requestedStep = Number(process.argv[3] || 60);
const dt = 1 / requestedStep;
const base = { speed: 0, direction: 0, gusts: 0, waveHeight: 0, chop: 0, waterX: 0, waterY: 0,
  difficulty: 'hard', autoBalance: false, autoRecovery: false, ironsHelp: false, shelter: false, windSeed: 2647 };
const runs = [];

function sample(s, field) {
  const i = P.instruments(s, null, field);
  const f = s.forces, a = P.axes(s.theta), c = profiles.get(s);
  const sea = { ...field, waveCurrent: s.seaState, waveProfile: s.waveProfile };
  const contact = x => P.waterContact(s, { x, y: profiles.hullBottom(c, x, 0), z: 0 }, sea).depth;
  const blades = f.rudder?.parts || Object.values(s.foils || {}).filter(foil => foil.rudderBlade).map(foil => foil.rudderBlade);
  return {
    t: s.time, x: s.x, y: s.y, heave: s.heave, heading: i.heading, speed: i.speed, waterKnots: i.logKnots,
    sideSpeed: (s.vx - (s.waterX || 0)) * a.rx + (s.vy - (s.waterY || 0)) * a.ry,
    heel: s.heel, pitch: s.pitch, yawRate: s.omega, rollRate: s.heelRate, pitchRate: s.pitchRate,
    input: s.steerIntent, helmTarget: s.helmTarget, rudder: s.rudder, rudderYaw: f.yawRudder,
    blades, sheet: s.sheet, boom: s.boom, wind: s.wind,
    sails: Object.fromEntries(['main', 'jib', 'spinnaker'].flatMap(key => {
      const sail = s.sail[key];
      return sail ? [[key, { area: sail.area, luffScale: sail.luffScale, chordScale: sail.chordScale, angle: sail.angle,
        centre: sail.centre || sail.point, drive: sail.drive, side: sail.sideForce,
        vertical: sail.vertical ?? sail.force?.z, moment: sail.rollMoment, luff: sail.luff, fill: sail.fill }]] : [];
    })),
    crewPose: s.crewPose, crewSide: s.crewSide, crew: s.crewCG, foreAft: s.crewForeAft, mass: f.mass ?? c.mass,
    cg: s.hydro.cg, inertia: s.massMotion?.inertia, volume: s.hydro.submergedVolume, buoyancy: s.hydro.buoyancy,
    bowDepth: contact(.38 * c.length), sternDepth: contact(-.42 * c.length),
    wettedRudder: f.rudder?.strutWet ?? f.rudder?.wet, boardWet: f.board?.wet,
    hullDrag: f.hullF, hullCrossflow: f.hullR, skin: f.skinF, displacementDrag: f.ownWaveF,
    planingLift: f.planingLift, foilLift: f.foilVertical, fly: s.foiling?.support?.phase,
    waveHeight: P.waveAt(s.x, s.y, s.time, sea).height, waveDrive: f.waveForward,
    force: f.world, yawAssist: f.yawAssist, ledger: f.ledger, capsized: s.capsized, ground: s.ground?.contact
  };
}

function run(name, boat, field, initial, stages, sampleInterval = 1, pilotBearing = null) {
  const settings = { ...base, boatId: boat, ...field };
  const activeField = { ...settings };
  const start = { x: 0, y: -12000, theta: 0, vx: 0, vy: 0, sheet: .45, crewPose: 1, crewSide: 0, ...initial };
  const s = runtime.createBoat(boat, start, settings);
  const rows = [], commands = [];
  let peakKnots = 0;
  for (const stage of stages) {
    const { seconds, wind, ...intent } = stage;
    if (wind != null) activeField.speed = wind;
    commands.push({ at: s.time, ...stage });
    for (let n = 1; n <= Math.round(seconds / dt); n++) {
      const control = { crewPose: start.crewPose, ...intent };
      if (pilotBearing != null) {
        // Repeatable proportional helm input for the resistance trials.
        control.steer = P.clamp(-1.6 * P.wrap(pilotBearing - s.theta) + 1.1 * s.omega, -1, 1);
        control.steerDigital = false;
      }
      if (Number.isFinite(control.sheetTarget)) {
        // This also permits replay in revisions that only accepted trim rate.
        const travel = control.sheetTarget - s.sheet;
        const budget = P.sheetRateFor(profiles.get(s), travel, true, settings.difficulty) * dt;
        control.trim = P.limitSheetTravel(s.sheet, s, P.clamp(travel, -budget, budget), dt) / budget;
        control.trimFast = true;
      }
      runtime.stepBoat(s, control, activeField, dt, { diagnostics: true });
      for (const { force, moment } of Object.values(s.forces.ledger ?? {})) {
        if (![...Object.values(force), ...Object.values(moment)].every(Number.isFinite)) {
          throw Error(name + ' produced a non-finite force at ' + s.time);
        }
      }
      peakKnots = Math.max(peakKnots, Math.hypot(s.vx - (s.waterX || 0), s.vy - (s.waterY || 0)) * 1.9438444924);
      if (n % Math.max(1, Math.round(sampleInterval / dt)) === 0 || n === Math.round(seconds / dt)) rows.push(sample(s, activeField));
      if (![s.x, s.y, s.heave, s.heel, s.pitch, s.theta, s.vx, s.vy, s.rudder, s.boom].every(Number.isFinite)) throw Error(name + ' diverged at ' + s.time);
    }
  }
  runs.push({ name, boat, settings, start, commands, pilotBearing, peakKnots, rows });
}

function heaveEnergy() {
  const profile = profiles.get('laser'), field = { ...base, boatId: profile.id };
  const s = runtime.createBoat(profile.id, { x: 0, y: -12000, theta: 0, sheet: 0, crewPose: 1, crewSide: 0 }, field);
  const cells = P.hullSamples(profile).points;
  s.heave += .06;
  s.pitch = .025;
  const readings = [];
  for (let n = 0; n < Math.round(5 / dt); n++) {
    runtime.stepBoat(s, { crewPose: 1 }, field, dt, { diagnostics: true });
    const { cg, inertia } = s.massMotion;
    const point = P.bodyPoint(s, cg), motion = P.pointMotion(s, P.bodyOffset(s, cg));
    const cosPitch = Math.cos(s.pitch), sinPitch = Math.sin(s.pitch);
    const cosHeel = Math.cos(s.heel), sinHeel = Math.sin(s.heel);
    const x = s.heelRate + s.omega * sinPitch;
    const y = s.pitchRate * sinHeel + s.omega * cosPitch * cosHeel;
    const z = s.pitchRate * cosHeel - s.omega * cosPitch * sinHeel;
    const spin = .5 * (inertia.roll * x * x + inertia.yaw * y * y + inertia.pitch * z * z
      + 2 * (inertia.xy * x * y + inertia.xz * x * z + inertia.yz * y * z));
    const kinetic = .5 * profile.mass * (motion.x ** 2 + motion.y ** 2 + motion.z ** 2) + spin;
    // Small-motion estimate of hydrostatic potential using the solver's
    // linearly immersed cells. The sealed rig and crew stay out of water.
    const hydrostatic = cells.reduce((total, p) => {
      const span = Math.max(.025, Math.abs(sinPitch) * p.dx + Math.abs(cosPitch * cosHeel) * p.dy
        + Math.abs(cosPitch * sinHeel) * p.dz);
      const depth = -s.heave - P.bodyOffset(s, p).up, wet = P.clamp(.5 + depth / span, 0, 1);
      const volume = p.volume * (p.dryAir ? 1 - s.cockpitWet : 1);
      return total + profile.waterDensity * profile.gravity * volume * (.5 * span * wet * wet + Math.max(0, depth - .5 * span));
    }, 0);
    readings.push({ time: s.time, kinetic, potential: hydrostatic + profile.mass * profile.gravity * point.z });
  }
  return { initialHeaveOffset: .06, initialPitch: .025, settings: field, readings };
}

for (const waveHeight of [0, 1.5]) for (const side of [-1, 1]) {
  const theta = (90 - side * 110) * P.DEG;
  run('Laser helm ' + side + ' / wave ' + waveHeight, 'laser', { speed: 7, waveHeight },
    { theta, vx: 2.572 * Math.cos(theta), vy: 2.572 * Math.sin(theta), crewPose: 2, crewSide: side },
    [{ seconds: .65, steer: side }, { seconds: .4 }, { seconds: .65, steer: -side }, { seconds: 2 }], .1);
}
for (const boat of ['laser', 'dinghy', 'yacht', 'ac75', 'ac72']) {
  for (const course of [55, 90, 163]) {
    const theta = (90 - course) * P.DEG;
    const laser = boat === 'laser';
    run('Skøde ' + boat + ' / ' + course, boat, { speed: laser ? 4 : 7 },
      { theta, sheet: 1, vx: .8 * Math.cos(theta), vy: .8 * Math.sin(theta), crewPose: laser ? 1 : 2, crewSide: laser ? 0 : 1 },
      [{ seconds: 1, sheetTarget: 1 }, { seconds: 5, sheetTarget: 0 }, { seconds: 5, sheetTarget: 1 }], 1, theta);
  }
  run('Reb ' + boat, boat, { speed: 6 }, { sheet: .62, crewPose: 2 },
    [0, 1, 2, 0].map(reef => ({ seconds: 4, rig: { reef } })), 4);
  run('Vægt ' + boat, boat, {}, {}, [0, -1, 1].map(foreAft => ({ seconds: 5, foreAft })), 5);
  run('Sidefart ' + boat, boat, {}, { vx: 0, vy: 1.2, omega: .12 }, [{ seconds: 8 }], 1);
}

for (const waveHeight of [0, 1.5]) for (const twa of [60, 76, 90, 115, 140, 160]) for (const sheet of [.50, .96]) {
  const theta = -twa * P.DEG;
  run('Racer 17 m/s / ' + waveHeight + ' m / ' + twa + '° / ' + sheet, 'dinghy',
    { speed: 17, direction: 90, waveHeight }, { theta, sheet, crewPose: 3, crewSide: -1 }, [{ seconds: 20 }], 1, theta);
}
for (const boat of ['ac75', 'ac72']) {
  const theta = -22 * P.DEG;
  run('Foil løft og landing ' + boat, boat, { speed: 12 },
    { theta, sheet: .52, vx: 11 * Math.cos(theta), vy: 11 * Math.sin(theta), crewPose: 2 },
    [{ seconds: 14, sheetTarget: .52 }, { seconds: 24, wind: 0, sheetTarget: 0 }], .5);
}
{
  const theta = -110 * P.DEG;
  run('Racer sammenligningspunkt 20 knob / 110°', 'dinghy',
    { speed: 20 / 1.9438444924, direction: 90 }, { theta, sheet: .5, crewPose: 3, crewSide: -1 },
    [{ seconds: 40 }], 1, theta);
}
const build = stampHtml(fs.readFileSync(path.join(root, 'index.html')), root).revision;
console.log(JSON.stringify({ build, revisionStepHz: requestedStep, units: 'SI, heading in degrees, waterKnots in knots', runs, heaveEnergy: heaveEnergy() }));
