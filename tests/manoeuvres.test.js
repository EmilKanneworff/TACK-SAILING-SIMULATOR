'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {measure}=require('../scripts/handling-review.cjs');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});

test('all five boats can tack and gybe on easy with player-controlled helm and sheet',async({page})=>{
 test.setTimeout(90000);
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const results=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG;
  return SailingBoats.LIST.flatMap(c=>[true,false].map(tack=>{
   const foil=c.kind==='foiler',mono=c.id==='ac75';
   const initial=tack?(mono?5:32):foil?-53:-49;
   const target=tack?148:foil?-145:-131,trim=tack?.73:.24;
   const aimed=target*D,theta=initial*D;
   const speed=foil?10:5.5,waves=tack&&foil&&!mono?.20:0;
   const env={...SAILING_GAME.env,boatId:c.id,difficulty:'easy',speed,direction:0,waves,gusts:0,shelter:false,ironsHelp:false};
   delete env.waveHeight;
   const velocity=foil?(mono||!tack?13:9.5):c.id==='laser'?2.7:3.4;
   const headingGain=foil?(mono?2.4:3.6):1.8;
   const state=P.createState({boatId:c.id,x:0,y:-5000,theta,sheet:trim,
    vx:velocity*Math.cos(theta),vy:velocity*Math.sin(theta)},env);
   let maxHeel=0;
   const step=(wanted,frames,turning)=>{
    for(let i=0;i<frames&&!state.capsized;i++){
     const input=headingGain*P.wrap(state.theta-wanted)+(foil?.90:.97)*state.omega;
     const steer=P.clamp(input,foil?-1:-.70,foil?1:.70);
     const trueAngle=Math.abs(state.wind.twa??Math.PI)/D;
     const wantedSheet=turning&&tack&&foil&&trueAngle<(mono?70:37)?(mono?.16:.45):trim;
     P.step(state,{steer,trim:P.clamp((wantedSheet-state.sheet)*5,-1,1),trimFast:true,steerDigital:false},env,1/60);
     maxHeel=Math.max(maxHeel,Math.abs(state.heel)/D);
    }
   };
   step(theta,foil?240:720,false);
   const before={theta:state.theta,boom:state.boom,speed:state.speed};
   step(aimed,foil?1680:2520,true);
   const finish={theta:state.theta,boom:state.boom,speed:state.speed};
   return {boatId:c.id,manoeuvre:tack?'stagvending':'bomning',before,finish,
    headingError:Math.abs(P.wrap(state.theta-aimed))/D,
    crossed:Math.sign(Math.cos(before.theta))!==Math.sign(Math.cos(finish.theta)),capped:state.capsized,maxHeel};
  }));
 });
 console.log('MANOEUVRES',JSON.stringify(results));
 for(const row of results){
  const evidence=JSON.stringify(row);
  expect(row.crossed,evidence).toBe(true);
  expect(row.capped,evidence).toBe(false);
  expect(row.headingError,evidence).toBeLessThan(8);
  expect(row.finish.speed,evidence).toBeGreaterThan(.35);
  expect(Math.sign(row.finish.boom),evidence).toBe(-Math.sign(row.before.boom));
 }
});

test('a Laser tacks at 8–9 m/s with manual weight shifts and clearance on both sides',async({page})=>{
 test.setTimeout(90000);
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 for(const row of await measure(page,'tacks',false,.76)){
  const context=JSON.stringify({wind:row.wind,tack:row.tack,waves:row.waves,kind:row.kind});
  expect(Math.abs(row.before.heel),context).toBeLessThan(22);
  expect(row.capsized,context).toBe(false);
  expect(row.minClearance,context).toBeGreaterThan(.17);
  expect(row.enter,context).toBeGreaterThanOrEqual(.45);
  expect(row.enter,context).toBeLessThan(.61);
  const tacked=['in','out','slow'].includes(row.kind);
  expect(row.after.side,context).toBe((tacked?-1:1)*row.before.side);
  if(tacked){
   expect(row.switched,context).toBeGreaterThan(row.turned);
   expect(row.pass-row.switched,context).toBeLessThan(.9);
  }else expect(row.switched,context).toBeNull();
  if(row.kind==='out'){
   expect(row.after.pose,context).toBe(2);
   expect(row.after.actualPose,context).toBeCloseTo(2,3);
  }
  if(row.kind==='in')expect(row.after.pose,context).toBe(1);
 }
});

test('the Laser builds drive smoothly when the player sheets in after a tack',async({page})=>{
 await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
 const trials=await page.evaluate(()=>[-1,1].flatMap(from=>[12,46].map(exit=>{
  const P=SailPhysics,D=P.DEG,dt=1/60,initial=(270+49*from)*D,target=P.wrap((270-exit*from)*D);
  const env={...P.DEFAULT_ENV,boatId:'laser',difficulty:'hard',speed:7.9,direction:180,waves:0,gusts:0,shelter:false,autoRecovery:false};
  const entrySheet=.75;
  const boat=P.createState({x:0,y:-5000,theta:initial,sheet:entrySheet,crewPose:3,crewPoseBlend:3,
   crewSide:from,crewSideBlend:from,vx:3.1*Math.cos(initial),vy:3.1*Math.sin(initial)},env);
  const step=(heading,trim,pose,crew)=>{
   const change=trim-boat.sheet,rate=P.sheetRateFor(P.configFor(boat),change,true,'hard');
   const steer=P.clamp(1.8*P.wrap(boat.theta-heading)+1.05*boat.omega,-.80,.80);
   P.step(boat,{steer,steerDigital:false,trim:P.clamp(change/(rate*dt),-1,1),trimFast:true,crewPose:pose,crew},env,dt);
  };
  const speed=()=>P.instruments(boat,null,env).waterKnots;
  for(let i=0;i<360;i++)step(initial,entrySheet,3,from);
  const entryHeel=Math.abs(boat.heel)/D;
  let crossed=null,sheetIn=null,speedAtSheetIn=0,peakHeel=0,momentJump=0,kneeJump=0,speedJump=0;
  for(let i=0;i<720&&!boat.capsized;i++){
   const time=i*dt;
   if(crossed===null&&boat.wind.twa*from<=3.8*D)crossed=time;
   const pulling=crossed!==null&&time-crossed>=.16;
   if(pulling&&sheetIn===null){sheetIn=time;speedAtSheetIn=speed();}
   const previousMoment=boat.forces.rollSail,previousKnees=boat.crewJoints.knees,previousSpeed=speed();
   step(target,pulling?.88:.36,crossed===null?1:2,crossed===null?from:-from);
   if(pulling&&time-sheetIn<1.6){
    momentJump=Math.max(momentJump,Math.abs(boat.forces.rollSail-previousMoment));
    speedJump=Math.max(speedJump,Math.abs(speed()-previousSpeed));
    for(const [j,knee] of boat.crewJoints.knees.entries()){
     const old=previousKnees[j];
     kneeJump=Math.max(kneeJump,Math.hypot(knee.x-old.x,knee.y-old.y,knee.z-old.z));
    }
   }
   if(pulling)peakHeel=Math.max(peakHeel,Math.abs(boat.heel)/D);
  }
  return {exit,from,sheetIn,speedAtSheetIn,speed:speed(),peakHeel,momentJump,kneeJump,speedJump,
   sheet:boat.sheet,capsized:boat.capsized,side:boat.crewSide,pose:boat.crewPose,entryHeel};
 })));
 for(const run of trials){
  const evidence=JSON.stringify(run);
  expect(run.entryHeel,evidence).toBeLessThan(18);
  expect(run.sheetIn,evidence).not.toBeNull();
  expect(run,evidence).toMatchObject({capsized:false,side:-run.from,pose:2,sheet:.88});
  expect(run.momentJump,evidence).toBeLessThan(60);
  expect(run.kneeJump,evidence).toBeLessThan(.20);
  expect(run.speedJump,evidence).toBeLessThan(.4);
  if(run.exit===46){
   expect(run.peakHeel,evidence).toBeLessThan(35);
   expect(run.speed,evidence).toBeGreaterThan(run.speedAtSheetIn+1.2);
  }else{
   expect(run.peakHeel,evidence).toBeLessThan(20);
   expect(run.speed,evidence).toBeLessThan(run.speedAtSheetIn);
  }
 }
});

test('Laser on hard can gybe in chop and recover from a loaded reach on either tack',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const runs=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG;
  return [-1,1].flatMap(side=>['gybe','release'].map(manoeuvre=>{
   const gybe=manoeuvre==='gybe',course=side*(gybe?155:95),theta=(90-course)*D;
   const env={...SAILING_GAME.env,boatId:'laser',difficulty:'hard',shelter:false,speed:gybe?8.5:12,
     waveHeight:gybe?.30:.50,chop:gybe?.23:.35,gusts:gybe?0:.34};
   const s=P.createState({x:0,y:-5000,theta,sheet:gybe?.38:.61,vx:3.6*Math.cos(theta),vy:3.6*Math.sin(theta),crewSide:-side,crewSideBlend:-side},env);
   let peakHeel=0,crossed=false;
   for(let i=0;i<600&&!s.capsized;i++){
    const t=i/60,target=gybe&&t>=2?(90+side*145)*D:theta;
    const steer=P.clamp(-2.1*P.wrap(target-s.theta)+1.12*s.omega,-.80,.80);
    if(gybe&&s.gybeCount>0)crossed=true;
    const crew=gybe?(crossed?side:-side):0;
    const crewPose=gybe?(t>2&&(!crossed||s.crewSideBlend*side<.93)?1:2):t>=.32&&t<1.75?3:2;
    const trim=!gybe&&t>.52&&t<.87?-1:0;
    P.step(s,{steer,steerDigital:false,crewPose,crew,trim,trimFast:true},env,1/60);
    peakHeel=Math.max(peakHeel,Math.abs(s.heel)/D);
   }
   return {side,manoeuvre,peakHeel,capsized:s.capsized,gybes:s.gybeCount,crewSide:s.crewSide,courseChange:P.wrap(theta-s.theta)/D,sheet:s.sheet,speed:s.speed};
  }));
 });
 for(const run of runs){
  const context=JSON.stringify(run);
  expect(run.capsized,context).toBe(false);
  expect(run.peakHeel,context).toBeLessThan(32);
  expect(run.speed,context).toBeGreaterThan(2.5);
  if(run.manoeuvre==='gybe'){
   expect(run.gybes,context).toBe(1);
   expect(run.crewSide,context).toBe(run.side);
   expect(run.courseChange*run.side,context).toBeGreaterThan(52);
  }else{
   expect(run.sheet,context).toBeLessThan(.25);
   expect(Math.abs(run.courseChange),context).toBeLessThan(12);
  }
 }
});

test('the Laser regains rudder force after a heeled turn unloads the blade on both tacks',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 const runs=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG;
  const env={...P.DEFAULT_ENV,boatId:'laser',difficulty:'hard',speed:8.5,direction:0,
   waves:0,gusts:0,shelter:false,ironsHelp:false,autoBalance:false,autoRecovery:false};
  return [-1,1].map(side=>{
   const heading=(90-side*135)*D;
   const s=P.createState({boatId:'laser',x:0,y:-13000,theta:heading,sheet:.30,crewPose:2,crewPoseBlend:2,
    heel:side*34*D,pitch:8*D,
    vx:3.2*Math.cos(heading),vy:3.2*Math.sin(heading),crewSide:-side,crewSideBlend:-side},env);
   let minWet=1,rewet=null,rudderImpulse=0,maxSlide=0,maxAssist=0;
   for(let i=0;i<8*60&&!s.capsized;i++){
    const t=i/60,returning=rewet!==null&&t<rewet+.50;
    const steer=t<1.2?side:returning?-.55*side:0;
    const trim=t>.85&&t<1.10?-1:0;
    P.step(s,{steer,crewPose:2,crew:-side,trim,trimFast:true},env,1/60);
    maxAssist=Math.max(maxAssist,Math.abs(s.forces.yawAssist));
    const a=P.axes(s.theta),forward=s.vx*a.fx+s.vy*a.fy;
    minWet=Math.min(minWet,s.forces.rudder.wet);
    if(t>1.2&&minWet<.1&&s.forces.rudder.wet>.33&&forward>1)rewet??=s.time;
    if(returning)rudderImpulse+=s.forces.yawRudder/60;
    maxSlide=Math.max(maxSlide,Math.abs(s.vx*a.rx+s.vy*a.ry));
   }
   return {side,capsized:s.capsized,minWet,rewet,maxSlide,maxAssist,rudderImpulse,heel:s.heel/D};
  });
 });
 for(const run of runs){
  const evidence=JSON.stringify(run);
  expect(run.capsized,evidence).toBe(false);
  expect(run.minWet,evidence).toBeLessThan(.1);
  expect(run.maxSlide,evidence).toBeLessThan(1.7);
  expect(run.rewet,evidence).toBeGreaterThan(1.2);
  expect(run.rewet,evidence).toBeLessThan(5);
  expect(run.rudderImpulse*run.side,evidence).toBeGreaterThan(20);
  expect(Math.abs(run.heel),evidence).toBeLessThan(15);
  expect(run.maxAssist,evidence).toBe(0);
 }
});
