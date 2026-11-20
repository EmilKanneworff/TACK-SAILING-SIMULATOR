'use strict';
const {introOption}=require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('both foilers react faster in flight to a real helm input',async({page})=>{
 test.setTimeout(90000);await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const results=await page.evaluate(()=>['ac75','ac72'].map(boatId=>{const e={...SAILING_GAME.env,boatId,speed:12,direction:225,waves:.12,gusts:0},c=SailingBoats.get(boatId),s=SailPhysics.createState({boatId,x:0,y:-5000,theta:.95,vx:12*Math.cos(.95),vy:12*Math.sin(.95)},e);for(let i=0;i<900;i++)SailPhysics.step(s,{steer:0,trim:0,crewPose:2},e,1/60);const saved=JSON.parse(JSON.stringify(s)),keys=['helmFlightResponseScale','helmFlightRateMultiplier','helmFlightInitialFraction','helmFlightAccelerationMultiplier'],current=Object.fromEntries(keys.map(k=>[k,c[k]])),runs=[];try{for(const mode of ['before','after']){Object.assign(c,mode==='before'?{helmFlightResponseScale:.78,helmFlightRateMultiplier:1,helmFlightInitialFraction:c.helmInitialFraction,helmFlightAccelerationMultiplier:1}:current);const q=JSON.parse(JSON.stringify(saved)),samples=[];for(let i=0;i<60;i++){SailPhysics.step(q,{steer:1,steerDigital:true,trim:0,crewPose:2},e,1/60);if(i===14||i===59)samples.push({delta:SailPhysics.wrap(q.theta-saved.theta),rate:q.omega,wet:q.foiling.hullWetFraction,capsized:q.capsized,finite:Number.isFinite(q.theta)&&Number.isFinite(q.heave)})}runs.push(samples)}}finally{Object.assign(c,current)}return {boatId,initialWet:saved.foiling.hullWetFraction,clearance:saved.foiling.clearance,before:runs[0],after:runs[1]}}));
 for(const r of results){expect(r.initialWet).toBeLessThan(.03);expect(r.clearance).toBeGreaterThan(.1);expect(Math.abs(r.after[0].delta)).toBeGreaterThan(Math.abs(r.before[0].delta)*1.2);for(const s of r.after){expect(s.finite).toBe(true);expect(s.capsized).toBe(false)}expect(r.after[1].delta).toBeLessThan(0)}
});

test('the monohull accelerates from rest and flies in strong wind and waves on either tack',async({page})=>{
 test.setTimeout(90000);
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const runs=await page.evaluate(()=>{
  const P=SailPhysics,c=SailingBoats.get('ac75');
  return [{wind:16,twa:145,waves:.75},{wind:20,twa:90,waves:.75},
   {wind:20,twa:115,waves:1.15},{wind:20,twa:-115,waves:1.15}].map(({wind,twa,waves})=>{
   const env={...SAILING_GAME.env,boatId:'ac75',speed:wind,direction:0,gusts:.30,waveHeight:waves,shelter:false};
   const theta=(90-twa)*P.DEG,sheet=.55;
   const s=P.createState({boatId:'ac75',x:0,y:-5000,theta,sheet,vx:0,vy:0},env);
   let launched=null,air=0,maxHeel=0;
   const boom=s.boom,initialSide=s.wind.awa,initialArea=s.sail.main.area+s.sail.jib.area;
   for(let i=0;i<32*60;i++){
    const steer=P.clamp(-1.6*P.wrap(theta-s.theta)+1.1*s.omega,-.62,.62);
    P.step(s,{steer,steerDigital:false,trim:0,crewPose:2},env,1/60);
    if(s.capsized||!Number.isFinite(s.speed))break;
    maxHeel=Math.max(maxHeel,Math.abs(s.heel/P.DEG));
    if(s.foiling.support?.phase==='foiling'){
     launched??=s.time;air+=1/60;
    }
   }
   return {wind,twa,launched,air,maxHeel,capsized:s.capsized,speed:s.speed,sheet:s.sheet,
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
  expect(run.initialArea,evidence).toBeLessThan(run.totalArea);
  expect(run.reef,evidence).toBeGreaterThan(.5);
  expect(run.sheet).toBe(.55);
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

test('20 m/s selected in Weather can lift off from Faaborg and turn using the keyboard',async({page})=>{
 test.setTimeout(90000);
 await page.clock.install();
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await (await introOption(page,'#introBoat')).selectOption('ac75');
 await page.click('#introWeatherEdit');
 for(const [id,v] of Object.entries({windSpeed:'20',windDirection:'0',waveHeight:'.65',windGusts:'.25'}))await page.locator('#'+id).fill(v);
 await page.keyboard.press('Escape');
 await page.click('#startButton');
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1500));
 const read=()=>page.evaluate(()=>{
  const {state,scene,env}=SAILING_GAME;
  const sailHead=scene.mainFoilerPoint(0,1,state),reference=scene.rig.boomY;
  return {course:state.theta,flight:state.foiling.support.phase,reef:state.rig.reef,wind:env.speed,
   ground:state.ground.contact,cap:state.capsized,wet:state.foiling.hullWetFraction,
   visibleRatio:(sailHead.y-reference)/scene.rig.luff,
   physicalRatio:Math.sqrt(state.sail.main.area/SailingBoats.get('ac75').mainArea)};
 });
 let before;
 for(let i=0;i<24;i++){
  await page.clock.runFor(500);before=await read();
  if(before.flight==='foiling'&&before.wet<.02)break;
 }
 expect(before).toMatchObject({wind:20,flight:'foiling',ground:false,cap:false});
 expect(before.reef).toBeGreaterThan(.10);
 expect(before.visibleRatio).toBeCloseTo(before.physicalRatio,6);
 await page.keyboard.down('ArrowLeft');
 await page.clock.runFor(950);
 await page.keyboard.up('ArrowLeft');
 const after=await read();
 expect(after).toMatchObject({flight:'foiling',ground:false,cap:false});
 expect(after.course-before.course).toBeGreaterThan(.08);
});
