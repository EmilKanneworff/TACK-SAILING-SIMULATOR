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
const game = process.env.TACK_URL || pathToFileURL(resolve('index.html')).href;

test('a failed sky image leaves free sailing and controls available', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'FRI_VIND_SKY_PHOTO', {
    get: () => 'data:image/jpeg;base64,eA==', set: () => {}
  }));
  await page.goto(game);
  await page.waitForFunction(() => window.SAILING_GAME);
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
  await page.waitForFunction(() => window.SAILING_GAME);
  await page.locator('#quality').evaluate(select => {
    select.value = '1';
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
    activeScenery: SAILING_GAME.scene.decorationSectors.filter(t => t.mesh.visible).length,
    availableScenery: SAILING_GAME.scene.decorationSectors.length,
    coastPreserved: SAILING_GAME.scene.terrainRegions.every(({merged,tiles})=>!merged||
      (merged.geometry.index.count===tiles.reduce((sum,t)=>sum+t.mesh.geometry.index.count,0)&&
        tiles.every(t=>t.mesh.geometry.attributes.position===merged.geometry.attributes.position)&&
        !(merged.visible&&tiles.some(t=>t.mesh.visible)))),
    visibleShores: SAILING_GAME.scene.coastTerrain.filter(tile => tile.visible).length,
    fog: SAILING_GAME.scene.scene.fog.density,
    weatherFog: SAILING_GAME.scene.atmosphere.fogDensity,
    pendingTrees: SAILING_GAME.scene.treeSectors.filter(sector => sector.pending).length,
    opponentRange: SAILING_GAME.scene.graphicsProfile.remoteDistance,
    windArrows: SAILING_GAME.scene.windStrokeMesh.visible,
    waterRadius: SAILING_GAME.scene.water.geometry.attributes.position.array.at(-3),
    displayedQuality: document.querySelector('#qualityValue').textContent
  }));
  expect(result.draws).toBeGreaterThanOrEqual(26);
  expect(result.ratio).toBeLessThanOrEqual(result.device * .74);
  expect(result.waterTriangles).toBeLessThan(22_000);
  expect(result).toMatchObject({ far: 8000, opponentRange: 1850, reflection: 0, displayedQuality: 'Lav', coastPreserved:true, windArrows:true });
  expect(result.pendingTrees).toBeGreaterThan(0);
  expect(result.fog).toBeCloseTo(result.weatherFog,7);
  expect(result.visibleShores).toBeGreaterThan(0);
  expect(result.activeScenery).toBeLessThan(result.availableScenery * .6);
  expect(result.waterRadius).toBeGreaterThan(10000);
});

test('foil sail geometry follows graphics quality and restores full detail', async ({ page }) => {
  await page.goto(game);
  await page.waitForFunction(() => window.SAILING_GAME);
  const render = await page.evaluate(() => {
    const {scene,env}=SAILING_GAME;
    return ['ac75','ac72'].map(boat=>{
      const state=SailPhysics.createState({boatId:boat},env);
      const counts=quality=>{
        scene.update(state,env,SAILING_GAME.course,1/60,{quality});
        return [scene.sailMesh,scene.jibMesh].map(mesh=>mesh.geometry.attributes.position.count);
      };
      const full=counts('high'),reduced=counts('low'),restored=counts('high');
      return {full,reduced,restored};
    });
  });
  for(const {full,reduced,restored} of render){
    expect(reduced[1]).toBeLessThan(full[1]*.5);
    expect(restored).toEqual(full);
  }
  expect(render[0].reduced[0]).toBeLessThan(render[0].full[0]*.5);
  await expect(page.locator('#fatal')).toBeHidden();
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
      receive(500, 0);
      fleet.render(1 / 60);
      const middleBoat = { detailed: fleet.actors.has('remote'), shown: fleet.silhouettes.get('remote')?.root.visible };
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
      return { farBoat, middleBoat, before, after, next, rescued, removed: !root.parent, disposed, views: fleet.views.size, actors: fleet.actors.size };
    } finally {
      performance.now = originalNow;
      fleet.clear();
    }
  });
  expect(result.farBoat).toEqual({ built: false, onMap: true });
  expect(result.middleBoat).toEqual({ detailed:false,shown:true });
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
      select.value = '3';
      select.dispatchEvent(new Event('change'));
      const manualHigh = step(3500, 50);
      const highFar = scene.camera.far, highTriangles = scene.water.geometry.index.count / 3;
      select.value = '0';
      select.dispatchEvent(new Event('change'));
      const severe = step(1600, 100);
      return { start, singleSlowWindow, sustainedSlow, lowFar, lowTriangles, shortRecovery, stableRecovery,
        manualHigh, highFar, highTriangles, severe };
    } finally { scene.update = update; }
  });
  expect(result).toMatchObject({
    start: 'balanced', singleSlowWindow: 'balanced', sustainedSlow: 'minimum', lowFar: 8000,
    shortRecovery: 'minimum', stableRecovery: 'low', manualHigh: 'high', highFar: 8000, severe: 'minimum'
  });
  expect(result.lowTriangles).toBeLessThan(result.highTriangles * .65);
});


test('slow frames retain the fixed-step time and give the same physical result across graphics tiers', async ({ browser }) => {
  async function sail(quality, cadence) {
    const page = await browser.newPage();
    try {
      await page.addInitScript(quality => {
        localStorage.setItem('fri-vind.settings.v3', JSON.stringify({ personal: { quality } }));
        let time = 0;
        performance.now = () => time;
        const raf = window.requestAnimationFrame;
        window.requestAnimationFrame = callback => {
          if (callback.name !== 'frame') return raf(callback);
          window.tickGame = elapsed => callback(time += elapsed);
          return 0;
        };
      }, quality);
      await page.goto(game);
      await page.click('#startButton');
      return await page.evaluate(cadence => {
        const {scene, state} = SAILING_GAME;
        scene.update = () => {};
        document.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight',code:'ArrowRight',bubbles:true}));
        tickGame(1);
        for (const dt of cadence) tickGame(dt);
        return { time: state.time, x: state.x, y: state.y, theta: state.theta,
          heel: state.heel, rudder: state.rudder, tier:scene.graphicsProfile.id };
      }, cadence);
    } finally { await page.close(); }
  }
  const fast = await sail('high', Array(60).fill(1000/60));
  const slow = await sail('low', [380, 160, 160, 100, 100, 100]);
  expect(fast.tier).toBe('high');
  expect(slow.tier).toBe('low');
  expect(slow.time).toBeCloseTo(1,1);
  expect(Math.abs(slow.rudder)).toBeGreaterThan(.05);
  for (const key of ['time','x','y','theta','heel','rudder']) expect(slow[key],key).toBeCloseTo(fast[key],7);
});
