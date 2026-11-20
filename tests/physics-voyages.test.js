'use strict';
const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const path=require('node:path');const fs=require('node:fs');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('five boats accelerate and respond to rudder, crew and waves in the force simulation',async({page})=>{
 test.setTimeout(180000);await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const rows=await page.evaluate(()=>['laser','dinghy','yacht','ac75','ac72'].map(id=>{const P=SailPhysics,c=SailingBoats.get(id),e={...P.DEFAULT_ENV,boatId:id,speed:8,direction:0,waves:.35,gusts:.2,autoBalance:true},s=P.createState({boatId:id,x:0,y:-5000,theta:0,vx:0,vy:0},e),samples=[];
  for(let k=0;k<3000;k++){const phase=Math.floor(k/600),control={steer:phase===1?-.55:phase===2?.55:0,trim:phase===0?.3:0,crewPose:phase>=3?3:2};P.step(s,control,e,1/60);if(k%600===599)samples.push({time:s.time,speed:Math.hypot(s.vx,s.vy),heading:s.theta,heel:s.heel,pitch:s.pitch,crewPose:s.crewPoseBlend,lift:s.foiling?.liftFraction??0,capsized:s.capsized,finite:[s.x,s.y,s.theta,s.heel,s.pitch,s.vx,s.vy].every(Number.isFinite)});}
  return {id,name:c.name,samples};}));
 fs.mkdirSync('gennemgang/fysik',{recursive:true});fs.writeFileSync('gennemgang/fysik/sejlforlob.json',JSON.stringify(rows,null,2)+'\n');
 for(const row of rows){expect(row.samples.every(s=>s.finite)).toBe(true);expect(row.samples[0].speed).toBeGreaterThan(.05);expect(Math.abs(row.samples[2].heading-row.samples[1].heading)).toBeGreaterThan(.01);expect(row.samples[4].crewPose).toBeGreaterThan(2.5);}
});
