'use strict';
const {introOption}=require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('both foilers have more direct rudder travel in flight than on the water',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 const runs=await page.evaluate(()=>['ac75','ac72'].map(boatId=>{
  const P=SailPhysics,env={...P.DEFAULT_ENV,boatId,difficulty:'easy',speed:0,waves:0,shelter:false};
  return [false,true].map(inFlight=>{
   const s=P.createState({boatId,x:0,y:-13000,theta:0,vx:11,vy:0},env);
   Object.assign(s.foiling,{clearance:inFlight?.65:-.12,hullWetFraction:inFlight?0:.4});
   for(let i=0;i<15;i++)P.updateHelm(s,{steer:1},env,1/60);
   const turn=s.rudder;
   for(let i=0;i<15;i++)P.updateHelm(s,{steer:0},env,1/60);
   return {turn,released:s.rudder};
  });
 }));
 for(const [water,flight] of runs){
  expect(flight.turn).toBeGreaterThan(1.45*water.turn);
  expect(flight.released).toBe(0);
  expect(water.released).toBe(0);
 }
});

test('both foilers turn promptly and reverse the turn using keys or partial rudder',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const runs=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG;
  return ['ac75','ac72'].flatMap(boatId=>[true,false].flatMap(steerDigital=>{
   const theta=(steerDigital?-22:202)*D;
   const env={...P.DEFAULT_ENV,boatId,difficulty:'easy',speed:steerDigital?12:16,direction:0,
    waveHeight:steerDigital?.10:.55,chop:0,gusts:0,shelter:false};
   delete env.waves;
   const start=P.createState({x:0,y:-13000,theta,sheet:.52,vx:11*Math.cos(theta),vy:11*Math.sin(theta)},env);
   for(let i=0;i<840;i++)P.step(start,{steer:0,crewPose:2},env,1/60);
   return ['easy','hard'].map(difficulty=>{
    const command=steerDigital?1:.57;
    const [neutral,right,left,counter,released]=Array.from({length:5},()=>structuredClone(start));
    const states=[neutral,right,left,counter,released];
    const turn=s=>P.wrap(neutral.theta-s.theta)/D;
    let shortTurn=0,counterRate=0,counterRudder=0,coasting=0,assist=0,wet=0;
    for(let i=0;i<60;i++){
     const commands=[0,command,-command,i<16?command:-command,i<16?command:0];
     states.forEach((s,k)=>P.step(s,{steer:commands[k],steerDigital,crewPose:2,difficulty},{...env,difficulty},1/60));
     if(i===14)shortTurn=turn(right);
     if(i===28)coasting=(neutral.omega-released.omega)/D;
     if(i===35){counterRate=(counter.omega-neutral.omega)/D;counterRudder=counter.rudder/D;}
     assist=Math.max(assist,Math.abs(right.forces.yawAssist));
     wet=Math.max(wet,...states.map(s=>s.foiling.hullWetFraction));
    }
    return {boatId,difficulty,steerDigital,shortTurn,rightTurn:turn(right),leftTurn:turn(left),counterRate,counterRudder,coasting,assist,wet,
     capsized:states.some(s=>s.capsized),initialFlight:start.foiling.support.phase};
   });
  }));
 });
 for(const run of runs){
  const evidence=JSON.stringify(run);
  expect(run.initialFlight,evidence).toBe('foiling');
  expect(run.capsized,evidence).toBe(false);
  expect(run.wet,evidence).toBeLessThan(.03);
  expect(run.shortTurn,evidence).toBeGreaterThan(.55);
  expect(run.rightTurn,evidence).toBeGreaterThan(6);
  expect(run.leftTurn,evidence).toBeLessThan(-6);
  expect(run.counterRate,evidence).toBeGreaterThan(2);
  expect(run.counterRudder,evidence).toBeLessThan(-3);
  expect(run.coasting,evidence).toBeGreaterThan(.5);
  expect(run.assist,evidence).toBe(0);
 }
});

test('a manually reefed monohull accelerates and foils in strong wind on either tack',async({page})=>{
 test.setTimeout(90000);
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const runs=await page.evaluate(()=>{
  const P=SailPhysics,c=SailingBoats.get('ac75');
  return [{wind:16,twa:145,waves:.75,sheet:.15},{wind:20,twa:90,waves:.75,sheet:.35},
   {wind:20,twa:115,waves:1.15,sheet:.25},{wind:20,twa:-115,waves:1.15,sheet:.25}].map(({wind,twa,waves,sheet})=>{
   const env={...SAILING_GAME.env,boatId:'ac75',speed:wind,direction:0,gusts:.30,waveHeight:waves,shelter:false};
   const theta=(90-twa)*P.DEG;
   const s=P.createState({boatId:'ac75',x:0,y:-5000,theta,sheet,vx:0,vy:0},env);
   let launched=null,air=0,maxHeel=0;
   const boom=s.boom,initialSide=s.wind.awa,initialArea=s.sail.main.area+s.sail.jib.area;
   for(let i=0;i<32*60;i++){
    const steer=P.clamp(-1.6*P.wrap(theta-s.theta)+1.1*s.omega,-.62,.62);
    P.step(s,{steer,steerDigital:false,trim:0,crewPose:2,rig:{reef:2}},env,1/60);
    if(s.capsized||!Number.isFinite(s.speed))break;
    maxHeel=Math.max(maxHeel,Math.abs(s.heel/P.DEG));
    if(s.foiling.support?.phase==='foiling'){
     launched??=s.time;air+=1/60;
    }
   }
   return {wind,twa,launched,air,maxHeel,capsized:s.capsized,speed:s.speed,sheet:s.sheet,selectedSheet:sheet,
    leeward:boom*initialSide<0,initialArea,totalArea:c.sailArea,reef:s.rig.reef,mass:s.forces.mass,expectedMass:c.mass};
  });
 });
 for(const run of runs){
  const evidence=JSON.stringify(run);
  expect(run.capsized,evidence).toBe(false);
  expect(run.launched,evidence).not.toBeNull();
  expect(run.launched,evidence).toBeLessThan(10);
  expect(run.air,evidence).toBeGreaterThan(20);
  expect(run.speed,evidence).toBeGreaterThan(6);
  expect(run.maxHeel,evidence).toBeLessThan(43);
  expect(run.leeward,evidence).toBe(true);
  expect(run.initialArea,evidence).toBeCloseTo(run.totalArea,6);
  expect(run.reef,evidence).toBe(1);
  expect(run.sheet).toBe(run.selectedSheet);
  expect(run.mass).toBe(run.expectedMass);
 }
});

test('the catamaran lifts off in strong wind and retains controlled foil height in waves',async({page})=>{
 test.setTimeout(90000);
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const runs=await page.evaluate(()=>{
  const P=SailPhysics;
  return [{wind:16,twa:90,waves:.65,gusts:.25,sheet:.55},
   {wind:20,twa:-115,waves:1.15,gusts:.30,sheet:.55},
   {wind:20,twa:115,waves:1.50,gusts:.35,sheet:.80}].map(scenario=>{
   const {wind,twa,waves,gusts,sheet}=scenario;
   const env={...SAILING_GAME.env,boatId:'ac72',speed:wind,direction:0,gusts,waveHeight:waves,shelter:false};
   const theta=(90-twa)*P.DEG;
   const s=P.createState({boatId:'ac72',x:0,y:-5000,theta,sheet,vx:0,vy:0},env);
   const leeward=s.boom*s.wind.awa<0;
   let launched=null,air=0,maxHeight=0,maxPitch=0,maxSpeed=0,finite=true;
   for(let i=0;i<30*60;i++){
    const steer=P.clamp(-1.6*P.wrap(theta-s.theta)+1.1*s.omega,-.62,.62);
    P.step(s,{steer,steerDigital:false,trim:0,crewPose:2},env,1/60);
    const height=s.foiling.clearance,pitch=Math.abs(s.pitch/P.DEG);
    finite=[s.speed,height,pitch].every(Number.isFinite);
    if(s.capsized||!finite)break;
    maxHeight=Math.max(maxHeight,height);
    maxPitch=Math.max(maxPitch,pitch);
    maxSpeed=Math.max(maxSpeed,s.speed);
    if(s.foiling.support.phase==='foiling'){
     launched??=s.time;air+=1/60;
    }
   }
   return {scenario,launched,air,maxHeight,maxPitch,maxSpeed,leeward,finite,
    capsized:s.capsized,finalSheet:s.sheet};
  });
 });
 for(const run of runs){
  const evidence=JSON.stringify(run);
  expect(run,evidence).toMatchObject({capsized:false,finite:true,leeward:true,finalSheet:run.scenario.sheet});
  expect(run.launched,evidence).not.toBeNull();
  expect(run.launched,evidence).toBeLessThan(8);
  expect(run.air,evidence).toBeGreaterThan(18);
  expect(run.maxHeight,evidence).toBeLessThan(1.55);
  expect(run.maxPitch,evidence).toBeLessThan(15);
  expect(run.maxSpeed,evidence).toBeLessThan(32);
 }
});

test('20 m/s from Faaborg leaves trim to the player and accepts keyboard helm and manual reef',async({page})=>{
 test.setTimeout(90000);
 await page.clock.install();
 await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
 await (await introOption(page,'#introBoat')).selectOption('ac75');
 await page.selectOption('#introDifficulty','hard');
 await page.click('#introWeatherEdit');
 for(const [id,v] of Object.entries({windSpeed:'20',windDirection:'0',waveHeight:'.65',windGusts:'.25'}))await page.locator('#'+id).fill(v);
 await page.keyboard.press('Escape');
 await page.click('#startButton');
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1500));
 const read=()=>page.evaluate(()=>{
  const {state,scene,env}=SAILING_GAME;
  const sailHead=scene.mainFoilerPoint(0,1,state),reference=scene.rig.boomY;
  return {course:state.theta,flight:state.foiling.support.phase,reef:state.rig.reef,wind:env.speed,sheet:state.sheet,rudder:state.rudder,
   ground:state.ground.contact,cap:state.capsized,wet:state.foiling.hullWetFraction,
   visibleRatio:(sailHead.y-reference)/scene.rig.luff,
   physicalRatio:Math.sqrt(state.sail.main.area/SailingBoats.get('ac75').mainArea)};
 });
 let before;
 for(let i=0;i<24;i++){
  await page.clock.runFor(500);before=await read();
  if(before.flight==='foiling'&&before.wet<.02)break;
 }
 expect(before).toMatchObject({wind:20,flight:'foiling',ground:false,cap:false,reef:0,rudder:0});
 expect(before.visibleRatio).toBeCloseTo(before.physicalRatio,6);
 await page.keyboard.down('ArrowLeft');
 await page.clock.runFor(1400);
 await page.keyboard.up('ArrowLeft');
 const after=await read();
 expect(after).toMatchObject({flight:'foiling',ground:false,cap:false});
 expect(after.course-before.course).toBeGreaterThan(.08);
 expect(after.sheet).toBe(before.sheet);
 await expect(page.locator('#sailingDock #reefLabel')).toHaveText('Reb begge sejl');
 await page.selectOption('#reefSetting','2');
 await page.clock.runFor(3900);
 const reduced=await read();
 expect(reduced.reef).toBe(1);
 expect(reduced.visibleRatio).toBeCloseTo(Math.sqrt(.58),6);
 expect(reduced.visibleRatio).toBeCloseTo(reduced.physicalRatio,6);
 expect(reduced.sheet).toBe(before.sheet);
});
