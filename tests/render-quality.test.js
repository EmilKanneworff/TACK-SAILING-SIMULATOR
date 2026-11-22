'use strict';
const { test, expect } = require('@playwright/test');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

test.use({
  launchOptions: {
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--enable-unsafe-swiftshader']
  }
});
const game = pathToFileURL(resolve('index.html')).href;

test('a failed sky image leaves free sailing and controls available', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'FRI_VIND_SKY_PHOTO', {
    get: () => 'data:image/jpeg;base64,eA==', set: () => {}
  }));
  await page.goto(game);
  await page.evaluate(()=>SAILING_GAME.scene.skyPhotoReady);
  await expect(page.locator('#startButton')).toBeEnabled();
  await page.click('#startButton');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(()=>SAILING_GAME.state.time>.15&&SAILING_GAME.state.rudder>.05);
  await page.keyboard.up('ArrowRight');
  await expect(page.locator('#fatal')).toBeHidden();
  expect(await page.evaluate(()=>SAILING_GAME.scene.skyPhotoLoaded)).toBe(false);
});

test('low graphics lowers the drawing resolution and keeps the active frame cadence', async ({ page }) => {
  await page.clock.install();
  await page.goto(game);
  await page.locator('#quality').evaluate(select => {
    select.value = 'low';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.click('#startButton');
  await page.waitForFunction(() => SAILING_GAME.state.time > .1);
  await page.evaluate(() => {
    const scene = SAILING_GAME.scene, update = scene.update;
    window.draws = 0;
    scene.update = function (...args) {
      window.draws++;
      return update.apply(this, args);
    };
  });
  await page.clock.runFor(480);
  const result = await page.evaluate(() => ({
    draws: window.draws,
    ratio: SAILING_GAME.scene.renderer.getPixelRatio(),
    device: Math.min(devicePixelRatio, 1),
    far: SAILING_GAME.scene.camera.far,
    waterTriangles: SAILING_GAME.scene.water.geometry.index.count / 3,
    reflection: SAILING_GAME.scene.hullWater.uniforms.boatReflectionEnabled.value,
    decorations: SAILING_GAME.scene.coastDecorations.visible,
    shoreInRange: SAILING_GAME.scene.coastTerrain.some(tile => tile.visible),
    shoreCulled: SAILING_GAME.scene.coastTerrain.some(tile => !tile.visible)
  }));
  expect(result.draws).toBeGreaterThanOrEqual(26);
  expect(result.ratio).toBeCloseTo(result.device * .78, 5);
  expect(result.waterTriangles).toBeLessThan(31_000);
  expect(result).toMatchObject({ far: 1500, reflection: 0, decorations: false, shoreInRange: true, shoreCulled: true });
});

test('the simulator resumes sailing after the browser restores WebGL', async ({ page }) => {
  await page.goto(game);
  await page.click('#startButton');
  await page.waitForFunction(() => SAILING_GAME.state.time > .1);
  await page.evaluate(() => {
    window.loss = SAILING_GAME.scene.renderer.getContext().getExtension('WEBGL_lose_context');
    window.loss.loseContext();
  });
  await expect(page.getByRole('status').filter({ hasText: 'Gendanner grafikken' })).toBeVisible();
  const stoppedTime = await page.evaluate(() => SAILING_GAME.state.time);
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => SAILING_GAME.state.time)).toBe(stoppedTime);
  await page.evaluate(() => window.loss.restoreContext());
  await expect(page.locator('#graphicsStatus')).toBeHidden();
  await expect(page.locator('#fatal')).toBeHidden();
  await page.waitForFunction(time => SAILING_GAME.state.time > time + .15, stoppedTime);
  expect(await page.evaluate(() => SAILING_GAME.scene.renderer.info.render.triangles)).toBeGreaterThan(0);
});

test('live steering continues while a fresh wind direction is prepared', async ({ page }) => {
  await page.goto(game);
  await page.click('#startButton');
  await page.waitForFunction(() => SAILING_GAME.state.time > .1);
  await page.keyboard.down('ArrowRight');
  try {
    const before = await page.evaluate(() => {
      const { state, env } = SAILING_GAME;
      const prepare = SailingWind.prepare;
      window.waitedForWind = false;
      SailingWind.prepare = direction => {
        const ready = prepare(direction);
        if (!ready) window.waitedForWind = true;
        return ready;
      };
      env.direction = 245;
      return state.time;
    });
    await page.waitForFunction(time => window.waitedForWind &&
      SAILING_GAME.state.time > time + .1 && SAILING_GAME.state.steerIntent === 1, before);
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await page.waitForFunction(() => Math.abs(SAILING_GAME.state.windClimate.direction - 245) < 3);
  expect(await page.evaluate(() => SAILING_GAME.scene.waterUniforms.windDirection.value)).toBeCloseTo(
    await page.evaluate(() => SAILING_GAME.state.windClimate.direction), 0);
});

test('remote hulls blend uneven snapshots, snap after rescue and release unused geometry', async ({ page }) => {
  await page.goto(game);
  await page.waitForFunction(() => window.SAILING_GAME);
  const result = await page.evaluate(() => {
    const { scene, state, env } = SAILING_GAME;
    const noChange = () => {};
    const fleet = new FriVindFleet({
      state: () => state, scene: () => scene, env: () => env,
      wait: noChange, weather: noChange, results: noChange, free: noChange
    }, noChange);
    fleet.session = 'test';
    fleet.id = 'own';
    fleet.inWorld = true;
    fleet.roster([{ id: 'remote', boat: 'laser', name: 'Spiller' }]);
    const base = SailPhysics.createState({ x: state.x + 12, y: state.y, boatId: 'laser' }, env);
    const originalNow = performance.now;
    let now = 1000;
    performance.now = () => now;
    const receive = (offset, theta) => fleet.receive({
      mode: 'free', boats: { remote: { ...base, x: base.x + offset, theta } }
    });
    const show = () => {
      fleet.render(1 / 60);
      const actor = fleet.actors.get('remote');
      return { x: actor.boatRoot.position.x - base.x, heading: actor.heading.rotation.y };
    };
    try {
      receive(10_000, 0);
      fleet.render(1 / 60);
      const farBoat = { built: fleet.actors.has('remote'), onMap: fleet.mapBoats().length === 1 };
      receive(0, Math.PI - .08);
      show();
      now += 43;
      receive(2, -Math.PI + .08);
      now += 24;
      const before = show();
      receive(4, -Math.PI + .12);
      const after = show();
      now += 25;
      const next = show();
      now += 45;
      receive(32, 0);
      const rescued = show();
      const actor = fleet.actors.get('remote'), root = actor.boatRoot;
      let disposed = false;
      actor.hullMesh.geometry.addEventListener('dispose', () => { disposed = true; });
      fleet.roster([]);
      receive(32, 0);
      fleet.render(1 / 60);
      return { farBoat, before, after, next, rescued, removed: !root.parent, disposed, views: fleet.views.size, actors: fleet.actors.size };
    } finally {
      performance.now = originalNow;
      fleet.clear();
    }
  });
  expect(result.farBoat).toEqual({ built: false, onMap: true });
  expect(result.before.x).toBeGreaterThan(0);
  expect(result.before.x).toBeLessThan(2);
  expect(Math.abs(result.before.heading)).toBeGreaterThan(3);
  expect(result.after).toEqual(result.before);
  expect(result.next.x).toBeGreaterThan(result.after.x);
  expect(result.rescued).toEqual({ x: 32, heading: 0 });
  expect(result).toMatchObject({ removed: true, disposed: true, views: 0, actors: 0 });
});

test('auto scales the 3D scene down and recovers gradually after steady rendering', async ({ page }) => {
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame;
    window.requestAnimationFrame = callback => {
      if (callback.name === 'frame') {
        window.gameFrame = callback;
        return 0;
      }
      return request.call(window, callback);
    };
  });
  await page.goto(game);
  await page.click('#startButton');
  const result = await page.evaluate(() => {
    const { scene } = SAILING_GAME, update = scene.update;
    let now = performance.now();
    // Supply frame timestamps without drawing hundreds of WebGL frames.
    scene.update = () => {};
    const step = (duration, frameMs) => {
      for (let t = 0; t < duration; t += frameMs) window.gameFrame(now += frameMs);
      return scene.graphicsProfile.id;
    };
    try {
      const start = step(800, 20);
      const singleSlowWindow = step(1100, 30);
      const sustainedSlow = step(3400, 50);
      const lowFar = scene.camera.far;
      const lowTriangles = scene.water.geometry.index.count / 3;
      const shortRecovery = step(6000, 16);
      const stableRecovery = step(6600, 16);
      const select = document.querySelector('#quality');
      select.value = 'high';
      select.dispatchEvent(new Event('change'));
      const manualHigh = step(3500, 50);
      const highFar = scene.camera.far, highTriangles = scene.water.geometry.index.count / 3;
      select.value = 'auto';
      select.dispatchEvent(new Event('change'));
      const severe = step(1600, 100);
      return { start, singleSlowWindow, sustainedSlow, lowFar, lowTriangles, shortRecovery, stableRecovery,
        manualHigh, highFar, highTriangles, severe };
    } finally { scene.update = update; }
  });
  expect(result).toMatchObject({
    start: 'high', singleSlowWindow: 'high', sustainedSlow: 'minimum', lowFar: 850,
    shortRecovery: 'minimum', stableRecovery: 'low', manualHigh: 'high', highFar: 8000, severe: 'minimum'
  });
  expect(result.lowTriangles).toBeLessThan(result.highTriangles * .45);
});
