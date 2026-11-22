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
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
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
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.locator('#startButton:enabled').waitFor();
  await (await introOption(page,'#introWeatherEdit')).click();
  await page.locator('#windSpeed').fill('0');
  await page.keyboard.press('Escape');
  await page.click('#startButton');
  await page.keyboard.press('Digit2');
  await page.keyboard.press('KeyE');
  await page.clock.runFor(900);
  await page.evaluate(() => {
    SAILING_GAME.state.heel = 2;
    SAILING_GAME.state.heelRate = 0;
  });
  await page.clock.runFor(750);
  const during = await page.evaluate(() => ({
    recovering: SAILING_GAME.state.recovering,
    actual: SAILING_GAME.state.crewPose,
    command: SAILING_GAME.env.crewPose
  }));
  expect(during).toEqual({ recovering: true, actual: 1, command: 2 });
  await expect(page.locator('#pose2')).toHaveAttribute('aria-pressed', 'true');
  await page.clock.runFor(4350);
  const after = await page.evaluate(() => ({
    command: SAILING_GAME.env.crewPose,
    pose: SAILING_GAME.state.crewPose,
    side: SAILING_GAME.state.crewSide,
    recovering: SAILING_GAME.state.recovering
  }));
  expect(after).toEqual({ command: 2, pose: 2, side: 1, recovering: false });
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
