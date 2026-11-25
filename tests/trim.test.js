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

test('easing the visible mainsheet from 50 to 0 releases the boom during free sailing',async({page})=>{
 await page.clock.install();
 await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
 await page.click('#startButton');
 await page.evaluate(()=>{
  const {state,env}=SAILING_GAME, P=SailPhysics;
  Object.assign(env,{speed:6,direction:0,gusts:0,waveHeight:0,chop:0,shelter:false});
  const boat=TackSimulation.createBoat('laser',{x:0,y:-9500,time:state.time,theta:22*P.DEG,
   vx:0,vy:0,sheet:P.sheetFromTrim(.5,state),boom:.6,crewPose:2,crewSide:1},env);
  Object.assign(state,boat);
 });
 const slider=page.locator('#sheetControl');
 await slider.fill('50');
 await page.waitForFunction(()=>Math.abs(SAILING_GAME.state.sheet-SailPhysics.sheetFromTrim(.5,SAILING_GAME.state))<.001);
 await expect(page.locator('#sheetValue')).toHaveText('50,0 %');
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+200));
 const before=await page.evaluate(()=>({time:SAILING_GAME.state.time,boom:SAILING_GAME.state.boom}));
 await slider.fill('0');
 let released=false;
 for(let tick=0;tick<53&&!released;tick++){
  await page.clock.runFor(1000/60);
  released=await page.evaluate(()=>SAILING_GAME.state.sheet===0);
 }
 expect(released).toBe(true);
 await expect(page.locator('#sheetValue')).toHaveText('0,0 %');
 const after=await page.evaluate(()=>({time:SAILING_GAME.state.time,boom:SAILING_GAME.state.boom}));
 expect(after.time-before.time).toBeLessThanOrEqual(.9+1e-10);
 expect(Math.abs(after.boom)).toBeGreaterThan(Math.abs(before.boom)+.2);
});

test('the held haul key crosses 0 to 50 faster than 50 to 100 and taps are fine near full trim',async({page})=>{
 await page.clock.install();
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.click('#startButton');
 await page.evaluate(()=>{
  const {state,env}=SAILING_GAME;
  Object.assign(env,{speed:0,gusts:0,waveHeight:0,chop:0,shelter:false});
  Object.assign(state,TackSimulation.createBoat('laser',{x:0,y:-9500,time:state.time,sheet:0,crewPose:1},env));
 });
 const slider=page.locator('#sheetControl');
 const reading=()=>page.evaluate(()=>{
  const {applied,time}=SAILING_GAME.sheetDiagnostics;
  return {applied,time};
 });
 await slider.fill('0');
 await page.clock.runFor(1000);
 const start=await reading();
 expect(start.applied).toBeCloseTo(0,3);
 await page.locator('#sea').focus();
 await page.keyboard.down('ArrowUp');
 let middle,end;
 for(let i=0;i<25&&!end;i++){
  await page.clock.runFor(200);
  const value=await reading();
  if(value.applied>=50)middle??=value;
  if(value.applied>=99.99)end=value;
 }
 await page.keyboard.up('ArrowUp');
 expect(middle).toBeDefined();
 expect(end).toBeDefined();
 expect(end.time-middle.time).toBeGreaterThan((middle.time-start.time)*1.3);

 await slider.fill('85');
 await page.clock.runFor(900);
 await page.locator('#sea').focus();
 const before=(await reading()).applied;
 expect(before).toBeCloseTo(85,2);
 await page.keyboard.press('ArrowUp');
 await page.clock.runFor(120);
 const change=(await reading()).applied-before;
 expect(change).toBeGreaterThan(0);
 expect(change).toBeLessThan(.5);
});

for(const control of ['keyboard','slider']){
 test('mainsheet eases slowly above 50% and faster below with '+control,async({page})=>{
  await page.clock.install();
  await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
  await page.click('#startButton');
  await page.evaluate(()=>{
   const {state,env}=SAILING_GAME,P=SailPhysics;
   Object.assign(env,{speed:4,direction:0,gusts:0,waveHeight:0,chop:0,shelter:false});
   Object.assign(state,TackSimulation.createBoat('laser',{x:0,y:-9500,time:state.time,theta:8*P.DEG,
    vx:1.7,vy:0,sheet:1,crewSide:-1,crewPose:2},env));
  });
  const slider=page.locator('#sheetControl');
  const sample=async (ms)=>{
   await page.clock.runFor(ms);
   return page.evaluate(()=>{
    const {applied,time,limitDegrees}=SAILING_GAME.sheetDiagnostics;
    const shown=parseFloat(document.getElementById('sheetValue').textContent.replace(',','.'));
    const handle=document.getElementById('sheetControl').valueAsNumber;
    return {applied,time,limitDegrees,shown,handle};
   });
  };
  await slider.fill('100');
  expect((await sample(500)).applied).toBeCloseTo(100,2);
  if(control==='keyboard'){
   await page.locator('#sea').focus();
   await page.keyboard.down('ArrowDown');
  }else await slider.fill('0');
  const upperStart=await sample(200);
  const upperEnd=await sample(800);
  const lowerStart=await sample(1720);
  const lowerEnd=await sample(220);
  expect(upperEnd.applied).toBeGreaterThan(50);
  expect(lowerStart.applied).toBeLessThan(50);
  expect(lowerEnd.applied).toBeGreaterThan(5);
  for(const row of [upperStart,upperEnd,lowerStart,lowerEnd]){
   expect(Math.abs(row.shown-row.applied)).toBeLessThan(.06);
   expect(row.handle).toBe(row.shown);
  }
  const rate=(start,end,key)=>(end[key]-start[key])/(end.time-start.time);
  const high=-rate(upperStart,upperEnd,'shown'),low=-rate(lowerStart,lowerEnd,'shown');
  expect(high).toBeCloseTo(20,0);
  expect(low).toBeGreaterThan(1.6*high);
  expect(rate(lowerStart,lowerEnd,'limitDegrees')).toBeGreaterThan(1.6*rate(upperStart,upperEnd,'limitDegrees'));
  expect((await sample(650)).applied).toBe(0);
  if(control==='keyboard')await page.keyboard.up('ArrowDown');
 });
}
