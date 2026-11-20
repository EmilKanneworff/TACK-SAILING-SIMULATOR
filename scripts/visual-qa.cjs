'use strict';
const { introOption } = require('./browser-setup.cjs');
// Reproducible normal-camera sailing run; rates include browser and simulation.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
(async()=>{
  const out='gennemgang/visuel-2026-11-19',phase=process.env.QA_PHASE||'efter',boat=process.env.QA_BOAT||'laser';
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,recordVideo:process.env.QA_VIDEO?{dir:out,size:{width:1280,height:720}}:undefined});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.FRI_VIND_URL||'http://localhost:5173');await page.waitForFunction(()=>window.SAILING_GAME);
  await (await introOption(page, '#introBoat')).selectOption(boat);await page.click('#startButton');await page.waitForTimeout(2500);
  await page.screenshot({path:path.join(out,`${boat}-${phase}.png`)});
  const diagnostics=await page.evaluate(async()=>{
    const g=SAILING_GAME,r=g.scene.renderer,gl=r.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),frames=[];
    await new Promise(resolve=>{let start,previous;function frame(t){if(start===undefined)start=t;if(previous!==undefined)frames.push(t-previous);previous=t;if(t-start<8000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame)});
    const sorted=[...frames].sort((a,b)=>a-b),duration=frames.reduce((a,b)=>a+b,0);
    return {threeRevision:THREE.REVISION,quality:g.scene.quality,viewport:[innerWidth,innerHeight],pixelRatio:r.getPixelRatio(),webglRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),webglVersion:gl.getParameter(gl.VERSION),frames:frames.length,durationMs:duration,averageFps:frames.length*1000/duration,frameTimeMedianMs:sorted[Math.floor(sorted.length*.5)],frameTimeP95Ms:sorted[Math.floor(sorted.length*.95)],drawCalls:r.info.render.calls,triangles:r.info.render.triangles};
  });
  const maneuvers=[];
  if(process.env.QA_VIDEO){
    for(const key of ['1','3','2']){await page.keyboard.press(key);await page.waitForTimeout(1400);}
    for(const key of ['ArrowLeft','ArrowRight']){
      const before=await page.evaluate(()=>({theta:SAILING_GAME.state.theta,side:SAILING_GAME.state.crewSide}));
      await page.keyboard.down(key);let after=before;
      for(let i=0;i<15;i++){await page.waitForTimeout(1000);after=await page.evaluate(()=>({theta:SAILING_GAME.state.theta,side:SAILING_GAME.state.crewSide}));if(after.side!==before.side&&i>=4)break;}
      await page.keyboard.up(key);maneuvers.push({key,before,after,sideChanged:after.side!==before.side});await page.waitForTimeout(1000);
    }
  }
  const video=page.video();await page.close();await context.close();
  if(video){const from=await video.path();fs.renameSync(from,path.join(out,`${boat}-${phase}.webm`));}
  const result={phase,boat,browser:browser.version(),platform:process.platform,diagnostics,maneuvers,errors};fs.writeFileSync(path.join(out,`${boat}-${phase}-maaling.json`),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
