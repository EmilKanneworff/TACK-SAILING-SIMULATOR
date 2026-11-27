'use strict';

const { test, expect } = require('@playwright/test');
const { introOption } = require('../scripts/browser-setup.cjs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const game = process.env.TACK_URL || pathToFileURL(path.resolve('index.html')).href;

test.use({ launchOptions: {
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-unsafe-swiftshader']
} });

test('normal drawing accepts immutable physical snapshots for all five boats', async ({ page }) => {
  await page.clock.install();
  await page.goto(process.env.TACK_URL || pathToFileURL(path.resolve('index.html')).href);
  await page.locator('#startButton:enabled').waitFor();
  for (const boat of ['laser','dinghy','yacht','ac75','ac72']) {
    if (boat === 'laser') await page.click('#startButton');
    else {
      await page.keyboard.press('KeyB');
      await page.locator('[data-boat="' + boat + '"]').click();
    }
    await page.clock.runFor(250);
    const result = await page.evaluate(() => {
      const { scene, state, course, env } = SAILING_GAME;
      function freeze(object) {
        if (!object || typeof object !== 'object' || Object.isFrozen(object) || ArrayBuffer.isView(object)) return object;
        for (const value of Object.values(object)) freeze(value);
        return Object.freeze(object);
      }
      const before = [state.x, state.y, state.theta, state.heel, state.pitch, state.time, state.heave];
      const input = freeze(structuredClone(state));
      scene.update(input, env, course, 1 / 60, { quality: 'low' });
      const after = [state.x, state.y, state.theta, state.heel, state.pitch, state.time, state.heave];
      return { before, after, displayed: [scene.boatRoot.position.x, -scene.boatRoot.position.z, scene.heading.rotation.y],
        boat: scene.boatId };
    });
    expect(result.boat).toBe(boat);
    expect(result.after).toEqual(result.before);
    expect(result.displayed).toEqual(result.before.slice(0, 3));
  }
});

test('a hard crew command survives the safety posture during righting', async ({ page }) => {
  await page.clock.install();
  await page.goto(process.env.TACK_URL || pathToFileURL(path.resolve('index.html')).href);
  await page.locator('#startButton:enabled').waitFor();
  await (await introOption(page,'#introWeatherEdit')).click();
  await page.locator('#windSpeed').fill('0');
  await page.keyboard.press('Escape');
  await page.click('#startButton');
  await page.clock.pauseAt(await page.evaluate(() => Date.now()+100));
  await page.keyboard.press('Digit2');
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyX');
  await page.clock.runFor(900);
  await expect(page.locator('#foreAftSetting')).toHaveValue('50');
  await page.evaluate(() => {
    SAILING_GAME.state.heel = 2;
    SAILING_GAME.state.heelRate = 0;
  });
  await page.clock.runFor(750);
  const during = await page.evaluate(() => ({
    recovering: SAILING_GAME.state.recovering,
    actual: SAILING_GAME.state.crewPose,
    command: SAILING_GAME.state.crewTarget.pose
  }));
  expect(during).toEqual({ recovering: true, actual: 1, command: 2 });
  await expect(page.locator('#pose2')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#crewStarboard')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#foreAftSetting')).toHaveValue('50');
  await page.clock.runFor(4350);
  const after = await page.evaluate(() => ({
    command: SAILING_GAME.state.crewTarget.pose,
    pose: SAILING_GAME.state.crewPose,
    side: SAILING_GAME.state.crewSide,
    recovering: SAILING_GAME.state.recovering
  }));
  expect(after).toEqual({ command: 2, pose: 2, side: 1, recovering: false });
  await expect(page.locator('#foreAftSetting')).toHaveValue('50');
});

test('Turbåd 43 moves the rendered and physical crew onto the side deck from the normal controls', async ({ page }) => {
  await page.clock.install();
  await page.goto(game);
  await page.click('#startButton');
  await page.keyboard.press('KeyB');
  await page.locator('[data-boat="yacht"]').click();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 400));
  await page.evaluate(() => {
    const { env, state } = SAILING_GAME;
    Object.assign(env, { speed: 10, direction: 180, gusts: 0, waveHeight: 0, chop: 0, shelter: false });
    Object.assign(state, SailPhysics.createState({ boatId: 'yacht', x: 0, y: -5000, theta: 0,
      vx: 10 / 1.9438444924, vy: 0, heel: -25 * SailPhysics.DEG, sheet: .65, crewPose: 2, crewSide: 1 }, env));
    state.windClimate = { speed: 10, direction: 180, gusts: 0 };
    SailingWeather.initialize(state, env);
  });
  const read = () => page.evaluate(() => {
    const { state, scene } = SAILING_GAME;
    return { pose: state.crewPoseBlend, side: state.crewSide, physicalZ: state.crewCG.z,
      visibleZ: scene.visibleCrewPose.cg.z, people: scene.visibleCrewPose.members.length };
  });
  await page.keyboard.press('1');
  await page.clock.runFor(1500);
  const inside = await read();
  await page.locator('#pose3').click();
  await page.clock.runFor(1900);
  const onDeck = await read();
  expect(inside.pose).toBeLessThan(1.01);
  expect(inside.visibleZ).toBeLessThan(.2);
  expect(onDeck.pose).toBeGreaterThan(2.98);
  expect(onDeck.physicalZ - inside.physicalZ).toBeGreaterThan(1.55);
  expect(onDeck.visibleZ).toBeCloseTo(onDeck.physicalZ, 1);
  expect(onDeck).toMatchObject({ side: 1, people: 4 });
});

test('the Laser mounts its Blender model, waterline materials and skinned sailor', async ({page}) => {
  await page.goto(game);
  await page.click('#startButton');
  await page.waitForFunction(() => SAILING_GAME.scene.hullWetUniforms?.active.value === 1);
  const art = await page.evaluate(() => {
    const {scene} = SAILING_GAME, {person} = scene;
    const hull = scene.hull.getObjectByName('Laser · Hull'), bounds = new THREE.Box3();
    for (const mesh of hull.children) {
      mesh.geometry.computeBoundingBox();
      bounds.union(mesh.geometry.boundingBox);
    }
    const wetted = hull.children.every(mesh =>
      mesh.material.customProgramCacheKey() === 'local-hull-water-film' && mesh.layers.isEnabled(7));
    return {detailed: scene.laserDetailed, vest: person.detailedVest.visible,
      bones: person.rig.bones.length, wetted,
      length: bounds.max.x - bounds.min.x,
      beam: bounds.max.z - bounds.min.z};
  });
  expect(art.detailed).toBe(true);
  expect(art.vest).toBe(true);
  expect(art.bones).toBe(14);
  expect(art.wetted).toBe(true);
  expect(art.length).toBeCloseTo(4.23, 3);
  expect(art.beam).toBeCloseTo(1.37, 3);
});

test('the Laser sails with the local fallback when the model is missing', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'TackLaserGlb', {get: () => null, set: () => {}});
  });
  await page.goto(game);
  await page.click('#startButton');
  await page.locator('#sea').focus();
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => SAILING_GAME.state.rudder > .03);
  await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(() => {
    const {scene} = SAILING_GAME;
    return !scene.laserDetailed && scene.hullMesh.isMesh && scene.person.rig.mesh.isSkinnedMesh;
  })).toBe(true);
  expect(errors).toEqual([]);
});

test('a fully hiking Laser sailor reboards to windward, sets off and steers after righting', async ({page}) => {
  test.setTimeout(90000);
  await page.clock.install();
  await page.goto(game);
  await page.click('#startButton');
  await page.clock.pauseAt(await page.evaluate(() => Date.now()+100));
  await page.evaluate(() => {
    const {state,env} = SAILING_GAME, P = SailPhysics;
    Object.assign(env,{speed:10.7,direction:0,gusts:0,waveHeight:0,chop:0,shelter:false,difficulty:'hard'});
    Object.assign(state,TackSimulation.createBoat('laser',{
      x:0,y:-5000,theta:(90-87)*P.DEG,vx:0,vy:0,sheet:.05,crewPose:1,crewSide:-1
    },env));
    SailingWeather.initialize(state,env);
    document.getElementById('sea').focus();
  });
  await page.locator('#reefSetting').selectOption('2');
  await page.locator('#sea').focus();
  await page.keyboard.press('Digit3');
  await page.keyboard.press('KeyE');
  await page.clock.runFor(350);
  expect(await page.evaluate(() => SAILING_GAME.state.crewSide)).toBe(1);
  await page.evaluate(() => {
    Object.assign(SAILING_GAME.state,{capsized:true,heel:1.8,heelRate:0});
  });
  await page.clock.runFor(5100);
  const result = await page.evaluate(() => {
    const {state,scene} = SAILING_GAME;
    return {recovering:state.recovering,recovered:!!state.lastRecovery,side:state.crewSide,
      windward:SailPhysics.windwardCrewSide(state.wind),shown:scene.visibleCrewPose?.side,
      seated:state.reboardedInside,pose:state.crewPose,previous:state.crewTarget.pose,reef:state.cruiserRig.reefTarget};
  });
  expect(result).toMatchObject({recovering:false,recovered:true,side:1,windward:1,seated:true,pose:1,previous:3,reef:2});
  expect(result.shown).toBeGreaterThan(.95);
  await expect(page.locator('#pose1')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#reefSetting')).toHaveValue('2');
  await page.clock.runFor(4200);
  await page.locator('#sheetControl').fill('35');
  await page.locator('#sea').focus();
  await page.keyboard.press('Digit2');
  const read = () => page.evaluate(() => {
    const s=SAILING_GAME.state, axis=SailPhysics.axes(s.theta);
    return {pose:s.crewPose,side:s.crewSide,recoveries:s.lastRecovery.id,capsized:s.capsized,
      theta:s.theta,drive:s.sail.drive,angle:s.wind.twa/SailPhysics.DEG,heel:s.heel/SailPhysics.DEG,way:(s.vx-s.waterX)*axis.fx+(s.vy-s.waterY)*axis.fy};
  });
  await page.clock.runFor(1500);
  const sailing=await read();
  expect(sailing).toMatchObject({pose:2,side:1,recoveries:1,capsized:false});
  expect(sailing.way).toBeGreaterThan(1.2);
  expect(sailing.drive).toBeGreaterThan(0);
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.press('Digit3');
  await page.clock.runFor(1650);
  await page.keyboard.up('ArrowLeft');
  const steered=await read();
  const turn=steered.theta-sailing.theta;
  expect(Math.atan2(Math.sin(turn),Math.cos(turn))*180/Math.PI).toBeGreaterThan(4);
  expect(steered).toMatchObject({recoveries:1,capsized:false});
  await page.clock.runFor(2000);
  const underway=await read();
  expect(underway).toMatchObject({pose:3,side:1,recoveries:1,capsized:false});
  expect(underway.way).toBeGreaterThan(sailing.way);
});
