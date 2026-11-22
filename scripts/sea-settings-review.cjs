'use strict';

const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { introOption } = require('./browser-setup.cjs');

const anchor = { x: -1500, y: -1800 };
const settings = [[0, 0], [2.5, 0], [0, 1], [2.5, 1]];
const viewport = { width: 960, height: 600 };
const [, , url, output, mode = 'clips'] = process.argv;

async function setup(page, { height, chop, boat, quality }) {
  await page.addInitScript(quality => localStorage.setItem('fri-vind.settings.v3', JSON.stringify({
    weather: { speed: 8, direction: 270, gusts: 0, waveHeight: 0, chop: 0 },
    personal: { quality, difficulty: 'hard', windArrows: false, volume: 0 }
  })), quality);
  const response = await page.goto(url);
  if (boat !== 'laser') await (await introOption(page, '#introBoat')).selectOption(boat);
  await (await introOption(page, '#introWeatherEdit')).click();
  await page.locator('#waveHeight').fill(String(height));
  await page.locator('#chop').fill(String(chop));
  await page.evaluate(() => SAILING_GAME.env.windSeed = 2647);
  await page.click('[data-close="settings"]');
  await page.click('#startButton');
  await page.evaluate(({ anchor, boat, quality, height, chop, fixedCamera }) => {
    const { state, scene, env } = SAILING_GAME, P = SailPhysics;
    const theta = .85, initial = TackSimulation.createBoat(boat, {
      ...anchor, theta, time: 6, sheet: .37, vx: 2 * Math.cos(theta), vy: 2 * Math.sin(theta)
    }, env);
    Object.assign(state, initial);
    scene.lastTime = -1;
    scene.waterSampleMode = true;
    const camera = scene.camera;
    if (fixedCamera) {
      scene.updateCamera = (state) => {
        const low = state.time < 9;
        camera.position.set(anchor.x + (low ? 27 : -8), low ? 3.2 : 6.5, -anchor.y + (low ? 16 : 33));
        camera.fov = 51;
        camera.lookAt(anchor.x + 4, .2, -anchor.y - 3);
        camera.updateProjectionMatrix();
      };
    }
    const label = document.createElement('div');
    label.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:110;padding:9px 15px;border-radius:9px;background:#102d38;color:#fff;font:600 15px system-ui;text-align:center';
    const fmt = n => String(n).replace('.', ',');
    label.textContent = 'Valgt ' + fmt(height) + ' m / ' + chop * 100 + ' % · Skyder ' + fmt(env.waveHeight) + ' m';
    document.body.append(label);
    window.seaTrial = { points: [], origin: { ...anchor }, quality };
    const tick = () => {
      const field = { ...env, waveCurrent: state.seaState, waveCurrentRate: state.seaStateRate, waveProfile: state.waveProfile };
      const water = P.waveAt(state.x, state.y, state.time, field);
      window.seaTrial.points.push({
        time: state.time, x: state.x, y: state.y, heave: state.heave, pitch: state.pitch, heel: state.heel,
        speed: state.speed, rudder: state.rudder, height: water.height, slope: Math.hypot(water.dx, water.dy),
        support: state.hydro?.buoyancy, capsized: state.capsized, ground: state.ground?.contact
      });
      if(window.seaTrial.points.length < 720) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { anchor, boat, quality, height, chop, fixedCamera: mode === 'clips' });
  const slider = page.locator('#sheetControl');
  await slider.fill(String(await page.evaluate(() => SailPhysics.trimFromSheet(SAILING_GAME.state.sheet, SAILING_GAME.state) * 100)));
  return response.headerValue('x-fri-vind-revision');
}

async function measure(page) {
  return page.evaluate(() => {
    const { state, scene, env } = SAILING_GAME, P = SailPhysics, D = SailingWaterDepth;
    const { x, y } = window.seaTrial.origin;
    const field = { ...env, waveCurrent: state.seaState, waveProfile: state.waveProfile };
    const sample = e => Array.from({ length: 1800 }, (_, i) => P.waveAt(x,y,state.time+i*.08,e).height);
    const total = sample(field), short = sample({ ...field, waveCurrent: 0 });
    // The deep reference point is outside the combined shallow-water cap.
    const bands = { total, long: total.map((h, i) => h-short[i]), short };
    const moments = new Map();
    for (const [name, series] of Object.entries(bands)) {
      const mean = series.reduce((sum, h) => sum + h, 0) / series.length;
      const hs = 4 * Math.sqrt(series.reduce((sum, h) => sum + (h - mean) ** 2, 0) / series.length);
      moments.set(name, { hs, min: Math.min(...series), max: Math.max(...series),
        crossings: series.filter((h, i) => i && h > 0 && series[i - 1] <= 0).length });
    }
    const uniform = scene.waterUniforms;
    return { selected: { height: env.waveHeight, chop: env.chop }, instrument: SAILING_GAME.seaDiagnostics ?? null,
      depth: D.sample(x,y).depth, exposure: P.waveExposureAt(state.waveProfile.to,x,y),
      clock: state.time, shaderTime: uniform.time.value, shaderSea: uniform.sea.value, profile: state.waveProfile.to,
      quality: window.seaTrial.quality, moments: Object.fromEntries(moments), motion: window.seaTrial.points };
  });
}

async function run(browser, options, name, record) {
  const context = await browser.newContext({ viewport, recordVideo: record ? { dir: output, size: viewport } : undefined });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', err => errors.push(err.message));
  try {
    const revision = await setup(page, options);
    await page.locator('#sea').focus();
    await page.waitForTimeout(950);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(420);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(1300);
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(125);
    await page.keyboard.up('ArrowDown');
    await page.waitForTimeout(2850);
    if (record) await page.screenshot({ path: path.join(output, name+'.png') });
    const data = await measure(page);
    const video = record ? page.video() : null;
    await context.close();
    if (video) await fs.rename(await video.path(), path.join(output,name+'.webm'));
    console.log(name, revision, data.selected, data.moments.total.hs.toFixed(3));
    if (errors.length) throw Error(errors.join('\n'));
    return { name, revision, requested: options, ...data };
  } finally { await context.close(); }
}

async function main() {
  if (!url || !output) throw Error('node scripts/sea-settings-review.cjs URL MAPPE [clips|sail]');
  await fs.mkdir(output,{recursive:true});
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] });
  const runs = [];
  try {
    if(mode==='clips'){
      for(const [height,chop] of settings){
        const name = 'h'+height+'-c'+chop;
        runs.push(await run(browser,{height,chop,boat:'laser',quality:'high'},name,true));
      }
    } else if(mode==='sail'){
      for(const boat of ['laser','yacht','dinghy','ac75','ac72'])for(const chop of [0,1]){
        runs.push(await run(browser,{height:chop?0:.7,chop,boat,quality:'low'},boat+'-c'+chop,boat==='laser'||boat==='yacht'));
      }
      runs.push(await run(browser,{height:2.5,chop:1,boat:'laser',quality:'low'},'low-combined',true));
    } else throw Error('Ukendt tilstand '+mode);
    await fs.writeFile(path.join(output,mode+'.json'), JSON.stringify({ anchor, viewport, runs })+'\n');
  } finally { await browser.close(); }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
