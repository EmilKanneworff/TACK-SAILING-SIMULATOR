'use strict';

const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { test, expect } = require('@playwright/test');
const { introOption } = require('../scripts/browser-setup.cjs');

test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});

test('the host and guest use the same developing and settled sea', async ({ browser }) => {
  test.setTimeout(90000);
  const realtime = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: '33127' }, stdio: ['ignore', 'pipe', 'inherit']
  });
  const frontend=spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34127'}});
  const contexts = [];
  try {
    await Promise.all([realtime,frontend].map(server=>once(server.stdout,'data')));
    let code;
    for (const name of ['Vært', 'Gæst']) {
      const context = await browser.newContext({ viewport: { width: 1024, height: 660 } });
      contexts.push(context);
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.FRI_VIND_REALTIME_URL = 'ws://127.0.0.1:33127';
        localStorage.setItem('fri-vind.settings.v3',JSON.stringify({personal:{difficulty:'hard',quality:'low'}}));
      });
      await page.goto(process.env.TACK_URL || 'http://localhost:34127/');
      if (code) await (await introOption(page, '#introBoat')).selectOption('yacht');
      await (await introOption(page, '#introLobby')).click();
      await page.fill('#lobbyName', name);
      if (code) {
        await page.fill('#lobbyCodeInput', code);
        await page.click('#lobbyJoin');
      } else {
        await page.click('#lobbyCreate');
        await expect(page.locator('#lobbyRoom')).toBeVisible();
        code = await page.locator('#lobbyCode').innerText();
      }
      await expect(page.locator('#lobbyRoom')).toBeVisible();
    }
    const [host, guest] = contexts.map(context => context.pages()[0]);
    await host.click('#lobbySail');

    await guest.waitForFunction(() => FriVindLobby.fleet.synced);
    const guestId = await guest.evaluate(() => FriVindLobby.fleet.id);
    for (const [key, side, pose] of [['KeyE', 1, 2], ['KeyQ', -1, 3]]) {
      await guest.locator('#sea').focus();
      await guest.keyboard.press(key);
      await guest.keyboard.press(String(pose));
      await host.waitForFunction(({id,side,pose}) => {
        const s = FriVindLobby.fleet.boats.get(id);
        return s?.crewSide === side && s.crewSideBlend * side > .9 && s.crewPose === pose;
      }, {id:guestId,side,pose}, {timeout:20000});
      expect(await guest.evaluate(() => SAILING_GAME.state.crewSide)).toBe(side);
    }
    await guest.selectOption('#reefSetting', '2');
    await host.waitForFunction(id => {
      const state = FriVindLobby.fleet.boats.get(id);
      return state?.cruiserRig?.reef === 2 && Math.abs(state.sail.main.area - 26.88) < .01;
    }, guestId, {timeout:15000});
    await host.click('#settingsButton');
    await host.locator('#waveHeight').fill('2.5');
    await host.locator('#chop').fill('1');
    await guest.waitForFunction(() => SAILING_GAME.env.waveHeight === 2.5 && SAILING_GAME.env.chop === 1);
    const transition=await host.evaluate(id=>{
      const b=FriVindLobby.fleet.boats.get(id);
      return {time:b.time,seed:b.waveProfile.to.seed};
    },guestId);
    expect(Number.isFinite(transition.time)).toBe(true);
    await guest.waitForFunction(() => SAILING_GAME.seaDiagnostics.applied.longOpen > 2.47 && SAILING_GAME.seaDiagnostics.applied.chop > .999);
    const hostSnapshot = await guest.evaluate(() => {
      const fleet = FriVindLobby.fleet, state = fleet.boats.get(fleet.players.find(player => player.host).id);
      const { env } = SAILING_GAME;
      return { time: state.time, profile: state.waveProfile, sea: state.seaState,
        climate: state.windClimate, seed: env.windSeed };
    });
    const read = (page, snapshot) => page.evaluate(({ time, profile, sea, climate, seed }) => {
      const field = { ...SAILING_GAME.env, ...climate, waveCurrent: sea, waveProfile: profile };
      return { seed: field.windSeed, expectedSeed: seed, wave: SailPhysics.waveAt(-1500, -1800, time, field) };
    }, snapshot);
    const [a, b] = await Promise.all([read(host, hostSnapshot), read(guest, hostSnapshot)]);
    expect(b).toEqual(a);
    expect(b.seed).toBe(b.expectedSeed);
    console.log('Fælles sø', JSON.stringify({ transition, height: b.wave.height, time: hostSnapshot.time, seed: b.seed }));
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    realtime.kill();frontend.kill();
  }
});
