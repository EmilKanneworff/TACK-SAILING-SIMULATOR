'use strict';

const { chromium } = require('@playwright/test');
const {performance}=require('node:perf_hooks');
const assert=require('node:assert/strict');
const url=process.argv[2]||'http://localhost:5173/';
const msecs=Number(process.env.TACK_SOAK_MS||600000);
const throttle=Number(process.env.TACK_CPU||4);
const chrome=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
(async()=>{
 const browser=await chromium.launch({executablePath:chrome,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1120,height:700},deviceScaleFactor:1.5});
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
  const errors=[];
  await page.addInitScript(()=>{
   const rows=[];
   window.longTasks=rows;
   new PerformanceObserver(list=>{for(const e of list.getEntries())rows.push({start:e.startTime,ms:e.duration});}).observe({type:'longtask',buffered:true});
   localStorage.setItem('fri-vind.settings.v3',JSON.stringify({personal:{quality:'low',difficulty:'hard',camera:0}}));
  });
  page.on('pageerror',e=>{console.error(e);errors.push(e.message)});
  await page.goto(url);
  await page.locator('#startButton:enabled').click();
  await page.waitForFunction(()=>SAILING_GAME.state.time>.15);
  const details=await page.evaluate(()=>{
   const {scene}=SAILING_GAME,gl=scene.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   let last=0;
   const original=scene.render;
   window.draws=[];
   scene.render=function(...args){
    const result=original.apply(this,args),now=performance.now();
    if(last)draws.push(now-last);
    last=now;return result;
   };
   return {revision:document.querySelector('meta[name=fri-vind-revision]')?.content,gl:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),dpr:devicePixelRatio,size:[scene.renderer.domElement.width,scene.renderer.domElement.height]};
  });
  console.log(JSON.stringify({...details,browser:browser.version(),viewport:{width:1120,height:700},cpuThrottle:throttle}));
  const start=performance.now(),boats=['laser','ac75','ac72','dinghy','yacht'];
  for(let stage=0; performance.now()-start<msecs;stage++){
   const boat=boats[stage%boats.length],near=stage%2===0;
   if(stage%3===1){
    await page.locator('#preferencesButton').click();
    await page.locator('#settings [data-close=settings]').click();
   }
   await page.evaluate(({boat,near,stage})=>{
    const {state,scene,env}=SAILING_GAME;
    Object.assign(env,{boatId:boat,speed:boat==='ac75'||boat==='ac72'?15:9,direction:255,waveHeight:near?.65:.8,chop:near?.47:.76,gusts:.12,clouds:.33,rain:0});
    const x=near?4:-1610,y=near?-47:-1930,theta=near?-1.45:-.40,speed=near?2:5;
    const fresh=TackSimulation.createBoat(boat,{x,y,theta,vx:speed*Math.cos(theta),vy:speed*Math.sin(theta),sheet:.35},env);
    for(const key of Object.keys(state))if(!Object.hasOwn(fresh,key))delete state[key];
    Object.assign(state,fresh);
    scene.lastTime=-1;scene.cameraReady=false;
   },{boat,near,stage});
   await page.waitForFunction(boat=>SAILING_GAME.scene.boatId===boat,boat);
   const begin=await page.evaluate(()=>{draws.length=0;longTasks.length=0;return {real:performance.now(),sim:SAILING_GAME.state.time};});
   await page.keyboard.press('Digit3');
   const remaining=msecs-(performance.now()-start);
   await page.waitForTimeout(Math.max(100,Math.min(remaining,28000)*.45));
   await page.keyboard.down('ArrowRight');
   await page.keyboard.down('ArrowUp');
   await page.waitForTimeout(340);
   await page.keyboard.up('ArrowUp');
   await page.keyboard.up('ArrowRight');
   await page.waitForTimeout(Math.max(100,Math.min(remaining,28000)*.55));
   const stats=await page.evaluate(begin=>{
    const {scene,state,env,simulationDebt}=SAILING_GAME,values=draws.slice().sort((a,b)=>a-b);
    const q=f=>values[Math.max(0,Math.ceil(f*values.length)-1)];
    return {wall:(performance.now()-begin.real)/1000,simulation:state.time-begin.sim,simulationDebt,
      samples:values.length,p50:q(.5),p95:q(.95),max:values.at(-1),stalls100:values.filter(x=>x>100).length,
      longTasks:longTasks.map(x=>x.ms),geometries:scene.renderer.info.memory.geometries,textures:scene.renderer.info.memory.textures,
      trees:scene.coastTreeCount,pending:scene.treeSectors?.filter(s=>s.pending).length,profile:scene.graphicsProfile.id,
      x:state.x,y:state.y,time:state.time,state:state.recovering?'recovering':state.capsized?'capsized':'sailing',wind:env.speed,waves:env.waveHeight,chop:env.chop};
   },begin);
   console.log(JSON.stringify({stage,boat,near,elapsed:Math.round((performance.now()-start)/1000),...stats}));
  }
  const revisionAtEnd=await page.locator('meta[name=fri-vind-revision]').getAttribute('content');
  assert.equal(revisionAtEnd,details.revision);
  console.log(JSON.stringify({complete:true,durationMs:Math.round(performance.now()-start),revisionAtEnd,errors}));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1});
