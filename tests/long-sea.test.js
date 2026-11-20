const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('ten minutes of constant swell remain bounded without wind',async({page})=>{
 test.setTimeout(180000);await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{const e={...SAILING_GAME.env,boatId:'laser',speed:0,gusts:0,waves:1},s=SailPhysics.createState({vx:0,vy:0},e),windows=[];let peak=0;for(let i=0;i<36000;i++){SailPhysics.step(s,{steer:0,trim:0,crewPose:2},e,1/60);peak=Math.max(peak,Math.hypot(s.vx,s.vy));if((i+1)%3600===0){windows.push({t:s.time,peak,final:Math.hypot(s.vx,s.vy),x:s.x,y:s.y,finite:[s.x,s.y,s.vx,s.vy,s.heel,s.heave].every(Number.isFinite)});peak=0}}return windows;});console.log('LONG SEA',JSON.stringify(result));expect(result).toHaveLength(10);expect(result.every(x=>x.finite&&x.peak<10)).toBe(true);
});
