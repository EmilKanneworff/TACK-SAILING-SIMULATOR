const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const path=require('node:path');const fs=require('node:fs');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('trim responds through its range across headings and boat speeds',async({page})=>{
 test.setTimeout(90000);await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const rows=await page.evaluate(()=>{const P=SailPhysics,rows=[];for(const boatId of ['laser','dinghy','yacht','ac75','ac72'])for(const angle of [45,90,135])for(const speed of [.3,4]){
   const env={...SAILING_GAME.env,boatId,speed:7,direction:0,waves:0,crewPose:2};const theta=(angle-90)*Math.PI/180;const s=P.createState({boatId,theta,vx:Math.cos(theta)*speed,vy:Math.sin(theta)*speed,sheet:0},env);const output=[];
   for(const target of [.25,.5,.75,1]){while(s.sheet<target-.0001)P.step(s,{trim:1,trimFast:true,crewPose:2,steer:0,steerDigital:true},env,1/60);output.push({sheet:s.sheet,limit:P.boomLimit(s.sheet,s),boom:s.boom,drive:s.sail?.drive??s.sail?.main?.drive??null,heel:s.heel});}
   const first=s.sheet;P.step(s,{trim:-1,trimFast:true,crewPose:2,steer:0,steerDigital:true},env,1/60);const immediate=s.sheet;for(let i=0;i<119;i++)P.step(s,{trim:-1,trimFast:true,crewPose:2,steer:0,steerDigital:true},env,1/60);
   rows.push({boatId,angle,speed,output,first,immediate,last:s.sheet});
  }return rows});
 fs.writeFileSync('gennemgang/trim-malinger.json',JSON.stringify(rows,null,2));
 for(const row of rows){expect(row.immediate).toBeLessThan(row.first);expect(row.last).toBeLessThan(.02);expect(row.output.every(v=>Number.isFinite(v.drive)&&Number.isFinite(v.boom)&&Number.isFinite(v.heel))).toBe(true);expect(Math.max(...row.output.map(v=>v.drive))-Math.min(...row.output.map(v=>v.drive))).toBeGreaterThan(1);expect(Math.max(...row.output.map(v=>v.boom))-Math.min(...row.output.map(v=>v.boom))).toBeGreaterThan(.02);for(let i=1;i<row.output.length;i++)expect(row.output[i].limit).toBeLessThan(row.output[i-1].limit)}
});
