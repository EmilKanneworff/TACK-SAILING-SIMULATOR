'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {measure}=require('../scripts/handling-review.cjs');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});

test('all five boats can tack and gybe with assisted low-speed steering',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const results=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG;
  return ['laser','dinghy','yacht','ac75','ac72'].flatMap(boatId=>[
   {manoeuvre:'stagvending',initial:32,target:147,trim:.73},
   {manoeuvre:'bomning',initial:-49,target:-131,trim:.24}
  ].map(({manoeuvre,initial,target,trim})=>{
   const env={...SAILING_GAME.env,boatId,difficulty:'easy',speed:5.5,direction:0,sea:'calm',waves:0,gusts:0,shelter:false};
   const theta=initial*D,velocity=boatId==='laser'?2.7:3.4;
   const intendedHeading=boatId==='ac72'&&manoeuvre==='bomning'?-143:target;
   const state=P.createState({boatId,x:0,y:-5000,theta,sheet:trim,
    vx:velocity*Math.cos(theta),vy:velocity*Math.sin(theta)},env);
   const trace=[],step=(wanted,frames)=>{
    for(let i=0;i<frames;i++){
     const err=P.wrap(wanted-state.theta);
     const steer=P.clamp(-1.8*err+.97*state.omega,-.70,.70);
     const adjust=P.clamp((trim-state.sheet)*5,-1,1);
     P.step(state,{steer,trim:adjust,trimFast:true,steerDigital:false,crewPose:2},env,1/60);
     trace.push({heel:state.heel,boom:state.boom,capsized:state.capsized});
    }
   };
   step(theta,720);
   const before={theta:state.theta,boom:state.boom,speed:state.speed};
   step(intendedHeading*D,2520);
   const finish={theta:state.theta,boom:state.boom,speed:state.speed};
   return {boatId,manoeuvre,before,finish,headingError:Math.abs(P.wrap(state.theta-intendedHeading*D))/D,
    crossed:Math.sign(Math.cos(before.theta))!==Math.sign(Math.cos(finish.theta)),
    capped:trace.some(x=>x.capsized),maxHeel:Math.max(...trace.map(x=>Math.abs(x.heel)))/D};
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

test('a Laser tacks at 8–9 m/s with queued hiking and clearance on both sides',async({page})=>{
 test.setTimeout(90000);
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 for(const row of await measure(page,'tacks',false)){
  const context=JSON.stringify({wind:row.wind,tack:row.tack,waves:row.waves,kind:row.kind});
  expect(row.capsized,context).toBe(false);
  expect(row.minClearance,context).toBeGreaterThan(.17);
  expect(row.enter,context).toBeGreaterThanOrEqual(.23);
  expect(row.enter,context).toBeLessThan(.36);
  const tacked=['in','out','slow'].includes(row.kind);
  expect(row.after.side,context).toBe((tacked?-1:1)*row.before.side);
  if(tacked){
   expect(row.switched,context).toBeGreaterThan(row.turned);
   expect(row.pass-row.switched,context).toBeLessThan(.9);
  }else expect(row.switched,context).toBeNull();
  if(row.kind==='out'){
   expect(row.fastExitOld,context).toBe(false);
   expect(row.after.pose,context).toBe(3);
   expect(row.after.actualPose,context).toBeGreaterThan(2);
  }
  if(row.kind==='in')expect(row.after.pose,context).toBe(1);
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
   let peakHeel=0;
   for(let i=0;i<600&&!s.capsized;i++){
    const t=i/60,target=gybe&&t>=2?(90+side*145)*D:theta;
    const steer=P.clamp(-2.1*P.wrap(target-s.theta)+1.12*s.omega,-.80,.80);
    const crewPose=!gybe&&t>=.32&&t<1.75?3:2,trim=!gybe&&t>.52&&t<.87?-1:0;
    P.step(s,{steer,steerDigital:false,crewPose,trim,trimFast:true},env,1/60);
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
