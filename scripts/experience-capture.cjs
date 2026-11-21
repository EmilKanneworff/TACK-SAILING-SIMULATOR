'use strict';
const { introOption, dragMap } = require('./browser-setup.cjs');

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require('@playwright/test');

const url = process.env.FRI_VIND_URL || 'http://localhost:5173/';
const phase = process.argv[2];
if (!['foer', 'efter'].includes(phase)) throw Error('Vælg foer eller efter.');
const output = path.resolve('gennemgang/oplevelse', phase);
const viewport = { width: 1440, height: 900 };
const sha = data => createHash('sha256').update(data).digest('hex');

async function run(browser) {
  const report = { url, viewport, chrome: browser.version(), platform: process.platform, quality: 'high', load: [], captures: {}, errors: [] };
  const newContext = recordVideo => browser.newContext({ viewport, deviceScaleFactor: 1, ...(recordVideo ? { recordVideo: { dir: output, size: viewport } } : {}) });
  const configurePage = async (context, name) => {
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${name}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(`${name}: ${message.text()}`); });
    page.on('requestfailed', request => report.errors.push(`${name}: ${request.url()} ${request.failure()?.errorText}`));
    return page;
  };
  const start = async (page, address, boat) => {
    const response = await page.goto(address);
    await page.waitForFunction(() => window.SAILING_GAME);
    await (await introOption(page, '#introBoat')).selectOption(boat);
    await page.locator('#quality').evaluate(element => {
      element.value = 'high';
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.click('#startButton');
    return response;
  };
  const sample = page => page.evaluate(() => {
    const { state: s, scene, env } = SAILING_GAME;
    return { boat: s.boatId, camera: scene.cameraMode, x: s.x, y: s.y, heading: s.theta, time: s.time, wind: env.speed,
      direction: env.direction, waves: env.waves, sea: s.seaState, heave: s.heave, pitch: s.pitch, crewPose: s.crewPoseBlend,
      waterTime: scene.waterUniforms.time.value, quality: scene.quality, revision: window.THREE.REVISION,
      triangles: scene.renderer.info.render.triangles, draws: scene.renderer.info.render.calls,
      skyPhoto: scene.skyPhotoLoaded ?? false, crewBones: scene.person?.rig?.bones.length ?? 0 };
  });
  const still = async (page, name) => {
    report.captures[name] = await sample(page);
    await page.screenshot({ path: path.join(output, `${name}.png`) });
  };
  const fixed = await newContext(false);
  try {
    const page = await configurePage(fixed, 'billeder');
    const time = new Date('2026-11-20T10:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(+time + 200));
    const loaded = [];
    page.on('response', response => loaded.push({ url: response.url(), status: response.status(), serviceWorker: response.fromServiceWorker() }));
    const response = await start(page, url, 'laser');
    await page.clock.runFor(2200);
    const manifest = await page.evaluate(async () => ({ version: document.querySelector('meta[name="fri-vind-revision"]')?.content || null,
      versionInMenu: document.getElementById('buildRevision')?.textContent || null,
      activeWorker: navigator.serviceWorker?.controller?.scriptURL || null,
      registrations: (await navigator.serviceWorker?.getRegistrations() || []).map(r => ({ scope: r.scope, script: r.active?.scriptURL })),
      storageKeys: Object.keys(localStorage), onPage: location.href,
      images: [...document.querySelectorAll('img')].map(img => ({ src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0 })) }));
    report.load = { sha256: sha(await response.body()), headers: response.headers(), served: loaded, ...manifest };
    if(phase==='efter'&&(!manifest.version||manifest.version!==manifest.versionInMenu||manifest.version!==response.headers()['x-fri-vind-revision'])){
      throw Error('Serveren og Om spillet viser forskellige revisioner.');
    }
    await still(page, 'sejlads');
    await page.click('#settingsButton');
    await page.clock.runFor(100);
    await still(page, 'vejr');
    await page.click('[data-close="settings"]');
    if(await page.locator('#mapResize').count()) await dragMap(page,350,220);
    else{
      await page.click('#mapExpand');
      await page.click('#mapExpand');
    }
    await page.clock.runFor(100);
    await still(page, 'stort-kort');
  } finally { await fixed.close(); }

  const record = async (name, address, boat, action) => {
    const context = await newContext(true);
    const page = await configurePage(context, name);
    try {
      await start(page, address, boat);
      await page.waitForFunction(() => SAILING_GAME.state.time > .4);
      report.captures[name] = await action(page);
    } finally {
      const video = page.video();
      await context.close();
      await fs.rename(await video.path(), path.join(output, `${name}.webm`));
    }
  };
  const offshore = new URL('?proeve=boelger', url).href;
  await record('boelger', offshore, 'yacht', async page => {
    const waitSeconds = async duration => {
      const t = await page.evaluate(() => SAILING_GAME.state.time);
      await page.waitForFunction(limit => SAILING_GAME.state.time > limit,t+duration);
    };
    await page.click('#settingsButton');
    await page.locator('#waveHeight').fill('0');
    await page.click('[data-close="settings"]');
    await waitSeconds(8);
    const calm = await sample(page);
    await page.click('#settingsButton');
    await page.locator('#waveHeight').fill('0.85');
    await page.click('[data-close="settings"]');
    await waitSeconds(8);
    return { calm, fresh: await sample(page) };
  });
  await record('besaetning', url, 'dinghy', async page => {
    const result = [];
    for (const pose of ['1','2','3','2']) {
      await page.keyboard.press(pose);
      await page.waitForFunction(value => Math.abs(SAILING_GAME.state.crewPoseBlend-value)<.07, Number(pose));
      result.push(await sample(page));
    }
    return result;
  });
  if(phase==='efter') await record('kamera-kort',url,'laser',async page=>{
    for(let i=0;i<5;i++){await page.click('#cameraButton');await page.waitForTimeout(600);}
    for(const [width,height] of [[150,100],[200,130],[-350,-230]]){
      await dragMap(page,width,height);
      await page.waitForTimeout(650);
    }
    return sample(page);
  });
  if(phase==='efter'){
    const additional = await newContext(false);
    try {
      const page = await configurePage(additional, 'responsive');
      await start(page,url,'yacht');
      report.waveForces=[];
      for(const [name,address] of [['Faaborg',url],['Åbent vand',offshore]]){
        await start(page,address,'yacht');
        const series=await page.evaluate(()=>{
          const P=SailPhysics,g=SAILING_GAME;
          const seed={x:g.state.x,y:g.state.y,theta:g.state.theta,vx:g.state.vx,vy:g.state.vy,sheet:g.state.sheet};
          const range=values=>Math.max(...values)-Math.min(...values);
          return [0,.85].map(waves=>{
            const env={...g.env,waves};
            const s=P.createState(seed,env);
            const heave=[],pitch=[],bowStern=[],waveForce=[],velocity=[];
            for(let i=0;i<480;i++){
              P.step(s,{crewPose:2,steer:0,trim:0},env);
              const field={...env,waveCurrent:s.seaState,waveProfile:s.waveProfile};
              const axis=P.axes(s.theta),half=SailingBoats.get(s).length*.4;
              const bow=P.waveAt(s.x+axis.fx*half,s.y+axis.fy*half,s.time,field);
              const stern=P.waveAt(s.x-axis.fx*half,s.y-axis.fy*half,s.time,field);
              heave.push(s.heave);pitch.push(s.pitch/P.DEG);bowStern.push(bow.height-stern.height);
              waveForce.push(Math.hypot(s.hydro.waveFx,s.hydro.waveFy));
              velocity.push(Math.hypot(s.vx,s.vy));
            }
            return {waves,heaveRange:range(heave),pitchRangeDegrees:range(pitch),bowSternRange:range(bowStern),
              peakWaveForceN:Math.max(...waveForce),endSpeedMps:velocity.at(-1)};
          });
        });
        report.waveForces.push({name,series});
      }
      await page.setViewportSize({width:1280,height:720});
      await start(page,url,'laser');
      await page.waitForFunction(()=>SAILING_GAME.state.time>1);
      await still(page,'sejlads-1280');
      await page.setViewportSize({width:390,height:844});
      await page.waitForFunction(()=>Math.abs(SAILING_GAME.scene.camera.aspect-390/844)<.002&&SAILING_GAME.scene.cameraMode===0);
      await still(page,'sejlads-390');
      await page.click('#settingsButton');
      await still(page,'vejr-390');
      await page.keyboard.press('Escape');
      await page.setViewportSize({width:1280,height:720});
      await page.evaluate(()=>document.documentElement.style.fontSize='150%');
      await page.click('#raceButton');
      await page.waitForFunction(()=>SAILING_GAME.course.phase==='countdown');
      await still(page,'nedtaelling-150');
    } finally { await additional.close(); }
  }
  const performanceContext = await newContext(false);
  try {
    const page = await configurePage(performanceContext, 'ydelse');
    await start(page, url, 'yacht');
    await page.waitForFunction(() => SAILING_GAME.state.time > 2);
    report.performance = await page.evaluate(async () => {
      const engine=SAILING_GAME.scene.renderer;
      const gl=engine.getContext(), ext=gl.getExtension('WEBGL_debug_renderer_info');
      const frames=[];
      await new Promise(resolve => {
        let begin,previous;
        const tick=t=>{
          if(begin===undefined)begin=t;
          if(previous!==undefined)frames.push(t-previous);
          previous=t;
          if(t-begin<6000)requestAnimationFrame(tick);else resolve();
        };
        requestAnimationFrame(tick);
      });
      const total=frames.reduce((sum,t)=>sum+t,0);
      const p95=frames.slice().sort((a,b)=>a-b)[Math.floor(frames.length*.95)];
      return {fps:frames.length*1000/total,p95Ms:p95,sampleMs:total,draws:engine.info.render.calls,triangles:engine.info.render.triangles,
        gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
    });
  } finally { await performanceContext.close(); }
  return report;
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const report = await run(browser);
    await fs.writeFile(path.join(output, 'maaling.json'), JSON.stringify(report, null, 2)+'\n');
    console.log(JSON.stringify({ phase, revision: report.load.version, sha256: report.load.sha256, performance: report.performance, errors: report.errors }));
    if (report.errors.length) process.exitCode=1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
