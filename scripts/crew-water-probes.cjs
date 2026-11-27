'use strict';

const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const { load } = require('./steering-trials.cjs');

const [baseline, candidate, output] = process.argv.slice(2);
if (!output) throw Error('node scripts/crew-water-probes.cjs før-mappe efter-mappe resultat.json');

function measure(root) {
  const sim = load(root), P = sim.SailPhysics;
  const flat = { speed: 0, direction: 0, gusts: 0, waveHeight: 0, chop: 0, shelter: false,
    waveSeed: 127, windSeed: 55, difficulty: 'hard', autoRecovery: false, ironsHelp: false };
  const position = { x: 0, y: -13000, vx: 0, vy: 0, theta: 0 };
  const place = (profile, initial, field) => sim.createBoat(profile.id, { ...position, ...initial }, field);
  const profiles = sim.profiles.LIST.map(profile => {
    const neutral = place(profile, { crewSide: 0, crewPose: 1, crewPoseBlend: 1 }, flat);
    sim.stepBoat(neutral, { crewPose: 1 }, flat, sim.fixedDt, { diagnostics: true });
    const hydro = [];
    for (const roll of [0, 15, 30]) {
      for (const pitch of [0, 5]) {
        const s = place(profile, { heel: roll * P.DEG, pitch: pitch * P.DEG, crewSide: 1, crewPose: 2 }, flat);
        const contact = P.hydrostatics(s, flat, false), gravity = P.bodyOffset(s, contact.cg);
        assert.ok(Math.abs(contact.rollGravity + contact.weight * gravity.dHeel) < 1e-6, profile.id);
        assert.ok(Math.abs(contact.pitchGravity + contact.weight * gravity.dPitch) < 1e-6, profile.id);
        hydro.push({ roll, pitch, heave: s.heave, volume: contact.submergedVolume,
          buoyancy: contact.buoyancy, gravityN: contact.weight, rollGravity: contact.rollGravity,
          pitchGravity: contact.pitchGravity, rollBuoyancy: contact.rollBuoyancy, pitchBuoyancy: contact.pitchBuoyancy,
          cg: contact.cg });
      }
    }
    const motion = place(profile, { crewSide: 1, crewPose: 1, crewPoseBlend: 1 }, flat);
    const crew = [];
    for (let tick = 0; tick <= 600; tick++) {
      const pose = tick < 180 ? 1 : 3, foreAft = tick < 360 ? 0 : tick < 480 ? 1 : -1;
      sim.stepBoat(motion, { crew: 1, crewPose: pose, foreAft }, flat, sim.fixedDt, { diagnostics: true });
      assert.equal(motion.hydro.weight, neutral.hydro.weight, profile.id);
      if (tick % 30 === 0) crew.push({ time: motion.time, pose, foreAft, physical: motion.crewPoseBlend,
        massCG: motion.hydro.cg, crewCG: motion.crewCG, inertia: motion.massMotion.inertia, capsized: motion.capsized,
        roll: motion.heel / P.DEG, pitch: motion.pitch / P.DEG, forces: motion.forces.ledger });
    }
    return { id: profile.id, name: profile.name, length: profile.length, beam: profile.beam,
      mass: profile.mass, massPoints: profile.massPoints, crewMass: profile.crewMass,
      persons: profile.crewOffsets?.length ?? profile.crewStations?.length ?? 1,
      inertiaAtCG: neutral.massMotion.inertia, foreAftRange: profile.crewForeAftRange,
      sail: { main: profile.mainArea ?? profile.sailArea, jib: profile.jibArea ?? 0, spinnaker: profile.spinnakerArea,
        gennaker: profile.gennakerArea, code0: profile.code0Area, mainCPHeight: profile.mainCPHeight ?? profile.sailCPHeight,
        jibCPHeight: profile.jibCPHeight, boomLimit: P.boomLimit(0, profile) / P.DEG },
      board: profile.waterBlades?.dagger ?? { area: profile.daggerArea, depth: profile.daggerDepth, keelArea: profile.keelArea },
      rudder: profile.waterBlades?.rudder ?? { x: profile.rudderX, area: profile.rudderArea, depth: profile.rudderDepth,
        offsets: profile.rudderOffsets },
      foil: profile.kind === 'foiler' ? { assemblyMass: profile.armMass, span: profile.foilSpan,
        area: profile.foilArea, sternWing: profile.rudderWingArea } : undefined,
      damping: { roll: profile.rollDamping, pitch: profile.pitchDamping, yawLinear: profile.yawLinearDamping,
        yawQuadratic: profile.yawQuadraticDamping, heave: profile.heaveDamping }, hydro, crew };
  });

  const profile = sim.profiles.get('laser');
  const wave = { ...flat, speed: 14, direction: 270, swellDirection: 270, waveHeight: 1.35,
    wavePeriod: 3.85, waveComponent: 0 };
  const component = P.WAVE_COMPONENTS[0];
  const p = P.waveProfileFor(wave), stretch = p.period * component.managedPeriod;
  const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
  const kx = (component.kx*cos - component.ky*sin) / stretch**2;
  const ky = (component.kx*sin + component.ky*cos) / stretch**2;
  const k = Math.hypot(kx, ky), theta = Math.atan2(ky, kx) + 15 * P.DEG;
  function surf(phase, frequency, height, seconds) {
    const env = { ...wave, waveHeight: height }, dt = 1 / frequency;
    const offset = (phase - position.y * ky - component.phase - p.seed) / k;
    const s = place(profile, { x: position.x + offset * kx/k, y: position.y + offset * ky/k,
      theta, vx: 4.25*Math.cos(theta), vy: 4.25*Math.sin(theta), sheet: .13,
      crewPose: 2, crewPoseBlend: 2 }, env);
    let work = 0;
    const samples = [];
    for (let tick = 1; tick <= seconds * frequency; tick++) {
      const steer = P.clamp(P.wrap(s.theta-theta)*2+s.omega*.9,-1,1);
      const before = [s.x, s.y];
      sim.stepBoat(s, { steer, steerDigital: false, crewPose: 2 }, env, dt, { diagnostics: true });
      work += s.hydro.waveFx*(s.x-before[0]) + s.hydro.waveFy*(s.y-before[1]);
      if (tick % (frequency / 12) === 0) {
        const field = { ...env, waveCurrent: s.seaState, waveProfile: s.waveProfile };
        const axis = P.axes(s.theta), water = [-1.7, 0, 1.7].map(x =>
          P.waveAt(s.x + x*axis.fx, s.y + x*axis.fy, s.time, field).height);
        samples.push({ t: s.time, alongSpeed: (kx*s.vx + ky*s.vy)/k, waveFx: s.hydro.waveFx, waveFy: s.hydro.waveFy,
          work, water, heave: s.heave, pitch: s.pitch, heel: s.heel, heading: s.theta,
          capsized: s.capsized, shore: s.ground?.contact });
      }
    }
    return { phase, frequency, height, seconds, samples };
  }
  const surfResults = [60, 120, 240].flatMap(frequency => [
    surf(3.4, frequency, wave.waveHeight, .75), surf(3.4, frequency, 0, .75),
    surf(.7, frequency, wave.waveHeight, 2), surf(.7, frequency, 0, 2)
  ]);
  return { profiles, surf: { wave, kx, ky, theta, startSpeed: 4.25, trials: surfResults } };
}

const before = measure(baseline), after = measure(candidate);
assert.deepEqual(after, before);
const end = trial => trial.samples.at(-1);
for (const rows of [after.surf.trials.slice(0, 4), after.surf.trials.slice(4, 8), after.surf.trials.slice(8, 12)]) {
  const [face, flatFace, back, flatBack] = rows.map(end);
  assert.ok(face.work > 0 && back.work < 0 && flatFace.work === 0 && flatBack.work === 0,
    JSON.stringify(rows.map(end)));
  assert.ok(face.alongSpeed > flatFace.alongSpeed && back.alongSpeed < flatBack.alongSpeed);
}
writeFileSync(output, JSON.stringify({ basis: 'SI; origin of surge, pitch and roll is defined in assets/simulation/physics.js', before, after }) + '\n');
