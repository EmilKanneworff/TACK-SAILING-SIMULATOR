'use strict';

const { chromium } = require('@playwright/test');
const { writeFile } = require('node:fs/promises');
const os = require('node:os');

const [before, after, output] = process.argv.slice(2);
if (!before || !after || !output) {
  throw Error('node scripts/sailing-startup.cjs FØR-URL EFTER-URL RESULTAT.json');
}
const viewport = { width: 390, height: 664 };
const deviceScaleFactor = 3;

async function install() {
  localStorage.setItem('fri-vind.settings.v3', JSON.stringify({ personal: { quality: 'low', camera: 0 } }));
  const stats = window.startupProbe = { longTasks: [] };
  Object.defineProperty(window,'SailingScene',{
    configurable:true,
    set(Scene){
      Object.defineProperty(window,'SailingScene',{value:Scene,writable:true,configurable:true});
      const render=Scene.prototype.render;
      Scene.prototype.render=function(...args){
        const result=render.apply(this,args);
        stats.firstScene??=performance.now();
        return result;
      };
    }
  });
  new PerformanceObserver(list => {
    for (const task of list.getEntries()) stats.longTasks.push({ start: task.startTime, duration: task.duration });
  }).observe({ type: 'longtask', buffered: true });
  const ready = new MutationObserver(() => {
    if (!document.querySelector('#startButton:enabled')) return;
    stats.ready = performance.now();
    ready.disconnect();
  });
  ready.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
}

async function trial(browser, url, repetition) {
  const context = await browser.newContext({ viewport, deviceScaleFactor, hasTouch: true, isMobile: true });
  try {
    await context.addInitScript(install);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 80, downloadThroughput: 1_250_000, uploadThroughput: 625_000
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const results = [];
    for (const cache of ['cold', 'warm']) {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('#startButton:enabled').waitFor();
      await page.evaluate(() => {
        const { scene } = SAILING_GAME, paint = scene.render;
        const intervals = [];
        let previous;
        scene.render = function (...args) {
          const result = paint.apply(this, args);
          if (!document.getElementById('hud').hidden) {
            const now = performance.now();
            startupProbe.draw ??= now;
            if (previous !== undefined) intervals.push(now-previous);
            if (intervals.length>30) intervals.shift();
            if (!startupProbe.stable && intervals.length===30 && intervals.every(ms=>ms<=50) &&
                intervals.filter(ms=>ms>33.5).length<=1 && SAILING_GAME.simulationDebt<.04) startupProbe.stable=now;
            previous=now;
          }
          return result;
        };
        document.getElementById('startButton').addEventListener('click', () => {
          startupProbe.start = performance.now();
          startupProbe.sheet = SAILING_GAME.state.sheet;
        }, { capture: true, once: true });
      });
      await page.locator('#startButton').tap();
      await page.keyboard.down('ArrowRight');
      await page.keyboard.down('ArrowUp');
      await page.waitForFunction(() => startupProbe.draw && Math.abs(SAILING_GAME.state.rudder) > .05 &&
        SAILING_GAME.state.sheet > startupProbe.sheet+.01);
      const controls = await page.evaluate(() => performance.now());
      await page.keyboard.up('ArrowUp');
      await page.keyboard.up('ArrowRight');
      await page.waitForFunction(() => startupProbe.stable);
      const stats = await page.evaluate(controls => {
        const { ready, start, firstScene, draw, stable, longTasks } = startupProbe;
        const { scene, state, env } = SAILING_GAME;
        const gl = scene.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
        const resources = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')]
          .filter(entry => entry.name.startsWith(location.origin));
        const bytes = Object.fromEntries(['transferSize','encodedBodySize','decodedBodySize'].map(key =>
          [key,resources.reduce((sum,entry)=>sum+entry[key],0)]));
        return { firstUI: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
          ready, start, firstScene, draw, controls, stable, longTasks, bytes,
          fieldMarks:Object.fromEntries(performance.getEntriesByType('mark').filter(mark=>mark.name.startsWith('tack-fields-')).map(mark=>[mark.name,mark.startTime])),
          renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
          boat:state.boatId, wind:env.speed, windDirection:env.direction, waves:env.waveHeight, chop:env.chop,
          quality:scene.graphicsProfile.id, camera:scene.cameraMode, buffer:[scene.renderer.domElement.width,scene.renderer.domElement.height] };
      }, controls);
      const revision=response.headers()['x-fri-vind-revision'];
      if (revision!==await page.locator('meta[name=fri-vind-revision]').getAttribute('content'))
        throw Error('Frontendrevisionen stemmer ikke');
      const result={ url, cache, repetition, revision, ...stats };
      results.push(result);
      console.log(JSON.stringify(result));
    }
    return results;
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] });
  try {
    const results = [];
    for (let repetition=0;repetition<3;repetition++) {
      for (const url of repetition%2?[after,before]:[before,after]) {
        results.push(...await trial(browser,url,repetition));
      }
    }
    await writeFile(output,JSON.stringify({machine:os.cpus()[0].model,os:os.release(),browser:browser.version(),
      test:{viewport,deviceScaleFactor,downloadMbit:10,latencyMs:80,cpuThrottle:4},results},null,2)+'\n');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
