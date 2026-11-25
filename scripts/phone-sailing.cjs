'use strict';

const { chromium, webkit, devices } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const [url, output] = process.argv.slice(2);
if (!url || !output) throw Error('node scripts/phone-sailing.cjs URL MAPPE');
const portrait = { width: 390, height: 664 }, landscape = { width: 844, height: 390 };

async function play(browser, device, video = false) {
  const context = await browser.newContext({
    ...device, viewport: portrait,
    ...(video && { recordVideo: { dir: output, size: { width: 390, height: 664 } } })
  });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('fri-vind.settings.v3',
    JSON.stringify({ personal: { quality: 'low', difficulty: 'hard', camera: 0 } })));
  await page.goto(url);
  await page.locator('#startButton').tap();
  await page.waitForFunction(() => SAILING_GAME.state.time > .15);
  return { page, context };
}

async function point(page,id,finger) {
  const box = await page.locator('#'+id).boundingBox();
  return { x:box.x+box.width*.5,y:box.y+box.height*.5,id:finger };
}

async function capture(browser) {
  const { page, context } = await play(browser, devices['iPhone 13'], true);
  const cdp = await context.newCDPSession(page);
  try {
    await page.locator('#toast').waitFor({ state: 'hidden' });
    await page.screenshot({ path: path.join(output,'portraet.jpg'), type:'jpeg', quality:88, scale:'css' });
    const start = await page.evaluate(()=>performance.now());
    const helm=await point(page,'steerLeftKey',1),sheet=await point(page,'touchHaul',2);
    const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
    const initialSheet=await page.evaluate(()=>SAILING_GAME.state.sheet);
    await touch('touchStart',[helm,sheet]);
    await page.waitForFunction(before=>SAILING_GAME.state.steerIntent===-1&&SAILING_GAME.state.sheet>before+.025,initialSheet);
    await page.waitForTimeout(460);
    await touch('touchEnd',[sheet]);
    await page.waitForTimeout(310);
    await touch('touchEnd',[]);
    await page.locator('#pose3').tap();
    await page.locator('#mobileCrewToggle').tap();
    await page.waitForTimeout(450);
    await page.locator('#crewControl button:enabled').first().tap();
    await page.locator('#mobileForeAft').tap({position:{x:17,y:22}});
    await page.waitForFunction(()=>SAILING_GAME.state.crewForeAft<-.14);
    await page.waitForTimeout(1400);
    const clip = await page.evaluate(start=>({start,end:performance.now(),crew:SAILING_GAME.state.crewPose,
      side:SAILING_GAME.state.crewSide,foreAft:SAILING_GAME.state.crewForeAft,time:SAILING_GAME.state.time}),start);
    console.log('demo',clip);
    await page.locator('#mobileCrewToggle').tap();
    await page.setViewportSize(landscape);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(output,'liggende.jpg'), type:'jpeg', quality:88, scale:'css' });
  } finally {
    const video = page.video();
    await context.close();
    const original = await video.path();
    await fs.rename(original,path.join(output,'demo-kilde.webm'));
  }
}

async function response(browser) {
  const { page, context } = await play(browser, devices['Pixel 7']);
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await page.evaluate(()=>{
      window.touchResponse=[];
      for (const id of ['steerLeftKey','steerRightKey','touchHaul','touchEase']) {
        const button=document.getElementById(id);
        let start=null;
        button.addEventListener('pointerdown',event=>{start=event.timeStamp;});
        new MutationObserver(()=>{
          if(start===null||!button.classList.contains('input-active'))return;
          const timestamp=start;
          start=null;
          // Sample once more after the class update has had a chance to paint.
          requestAnimationFrame(()=>touchResponse.push(performance.now()-timestamp));
        }).observe(button,{attributes:true,attributeFilter:['class']});
      }
    });
    for(let i=0;i<24;i++){
      const a=i%2?'steerRightKey':'steerLeftKey',b=i%2?'touchEase':'touchHaul';
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await point(page,a,1),await point(page,b,2)]});
      await page.waitForFunction(count=>touchResponse.length===count,(i+1)*2);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForFunction(ids=>ids.every(id=>!document.getElementById(id).classList.contains('input-active')),[a,b]);
    }
    const input = await page.evaluate(()=>{
      const data=touchResponse.slice().sort((a,b)=>a-b);
      const scene=SAILING_GAME.scene, gl=scene.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
      return {revision:document.querySelector('meta[name=fri-vind-revision]').content,
        renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
        samples: data.map(n=>+n.toFixed(2)),p50:data[Math.ceil(data.length*.5)-1],p95:data[Math.ceil(data.length*.95)-1]};
    });
    await fs.writeFile(path.join(output,'touchrespons.json'),JSON.stringify({
      browser:browser.version(),device:'Pixel 7 emuleret',viewport:portrait,cpuThrottle:4,...input},null,2)+'\n');
    console.log('input',input.revision,input.p50,input.p95);
  }finally{await context.close();}
}

async function safari() {
  const browser=await webkit.launch();
  try{
    const {page,context}=await play(browser,devices['iPhone 13']);
    for(const viewport of [{width:320,height:568},{width:667,height:320},landscape]){
      await page.setViewportSize(viewport);
      for(const id of ['steerLeftKey','steerRightKey','touchHaul','touchEase','pose3','expandChart']){
        const box=await page.locator('#'+id).boundingBox();
        assert.ok(box.width>=44&&box.height>=44&&box.x>=0&&box.y>=0&&
          box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height,id+' '+JSON.stringify(box));
      }
      const trim=await page.evaluate(()=>SAILING_GAME.state.sheet);
      for(let i=0;i<8;i++)await page.locator('#touchHaul').tap();
      assert.ok(await page.evaluate(()=>SAILING_GAME.state.sheet)>trim);
      await page.locator('#mobileCrewToggle').tap();
      await page.locator('#crewControl button:enabled').first().tap();
      await page.locator('#mobileCrewToggle').tap();
      await page.locator('#expandChart').tap();
      assert.equal(await page.locator('#expandChart').getAttribute('aria-expanded'),'true');
      await page.locator('#expandChart').tap();
    }
    await page.locator('#pose3').tap();
    assert.equal(await page.locator('#pose3').getAttribute('aria-pressed'),'true');
    console.log('WebKit',browser.version(),'passed phone controls at 320×568, 667×320, 844×390');
    await context.close();
  }finally{await browser.close();}
}

(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
  try{await capture(browser);await response(browser);}
  finally{await browser.close();}
  await safari();
})().catch(error=>{console.error(error);process.exitCode=1;});
