'use strict';

const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const {resolve}=require('node:path');
const {voyage}=require('../scripts/sea-trials.cjs');

test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
const game=pathToFileURL(resolve('index.html')).href;

test('hard steering uses a bounded actual rudder and the force ledger closes for five boats',async({page})=>{
 await page.goto(game);
 const results=await page.evaluate(()=>{
  const P=SailPhysics;
  return SailingBoats.LIST.map(c=>{
   const env={...P.DEFAULT_ENV,boatId:c.id,difficulty:'hard',waves:0,speed:0,gusts:0,shelter:false,forceDiagnostics:true};
   const s=P.createState({boatId:c.id,x:0,y:-13000,vx:3,vy:0,theta:0,crewPose:1,crewPoseBlend:1,crewSide:0,crewSideBlend:0},env);
   let maximum=0,rate=0,forceError=0,momentError=0,assist=0;
   for(let i=0;i<120;i++){
    const before=s.rudder;
    P.step(s,{steer:1,crewPose:1},env,1/60);
    maximum=Math.max(maximum,Math.abs(s.rudder));rate=Math.max(rate,Math.abs(s.rudder-before)*60);
    assist=Math.max(assist,Math.abs(s.forces.yawAssist));
    const rows=Object.values(s.forces.ledger);
    for(const axis of ['x','y','z'])forceError=Math.max(forceError,Math.abs(s.forces.world[axis]-rows.reduce((sum,row)=>sum+row.force[axis],0)));
    for(const axis of ['roll','pitch','yaw'])momentError=Math.max(momentError,Math.abs(s.forces[axis]-rows.reduce((sum,row)=>sum+row.moment[axis],0)));
   }
   return {id:c.id,maximum,rate,forceError,momentError,assist,turn:s.theta,limit:c.rudderMax,mechanicalRate:c.rudderRate};
  });
 });
 for(const row of results){
  expect(row.assist,row.id).toBe(0);
  expect(row.maximum,row.id).toBeGreaterThan(row.limit*.65);
  expect(row.maximum,row.id).toBeLessThanOrEqual(row.limit);
  expect(row.rate,row.id).toBeLessThanOrEqual(row.mechanicalRate+1e-8);
  expect(row.turn,row.id).toBeLessThan(-.012);
  expect(row.forceError,row.id).toBeLessThan(1e-6);
  expect(row.momentError,row.id).toBeLessThan(1e-6);
 }
});

test('an internal fore-aft shift moves the rendered sailor while keeping the total mass fixed',async({page})=>{
 await page.goto(game);
 const r=await page.evaluate(()=>{
  const P=SailPhysics,env={...P.DEFAULT_ENV,boatId:'laser',difficulty:'hard',speed:0,waves:0,gusts:0,shelter:false,autoBalance:false};
  const s=P.createState({x:0,y:-13000,theta:0,vx:0,vy:0,crewPose:1,crewPoseBlend:1,crewSide:0,crewSideBlend:0},env);
  const before={cg:s.hydro.cg.x,pitch:s.pitch},scene=SAILING_GAME.scene;
  for(let i=0;i<140;i++)P.step(s,{foreAft:1,crewPose:1},env,1/60);
  scene.updateBoat(s,env,1/60);
  return {cg:s.hydro.cg.x-before.cg,pitch:s.pitch-before.pitch,rendered:scene.visibleCrewPose.pelvis.x,physical:s.crewJoints.pelvis.x,
   mass:s.crewJoints.segments.reduce((sum,v)=>sum+v.mass,0),weight:s.hydro.weight/P.configFor(s).gravity};
 });
 expect(r.cg).toBeGreaterThan(.12);
 expect(r.pitch).toBeLessThan(-.003);
 expect(r.rendered).toBeCloseTo(r.physical,4);
 expect(r.mass).toBeCloseTo(75,7);
 expect(r.weight).toBeCloseTo(143,7);
});

test('centre-of-mass integration conserves translation when weight shifts without an external force',async({page})=>{
 await page.goto(game);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,dt=1/60;
  const s={x:3,y:5,heave:0,theta:0,heel:0,pitch:0,omega:0,heelRate:0,pitchRate:0,vx:1,vy:0,heaveVelocity:0};
  let cg={x:0,y:0,z:0};s.hydro={cg};
  for(let i=0;i<60;i++){
   cg={x:.002*(i+1),y:0,z:0};
   P.integrateMass(s,dt,143,cg,{roll:110,pitch:290,yaw:260},{x:0,y:0,z:0},{roll:0,pitch:0,yaw:0});
  }
  return {worldCG:P.bodyPoint(s,cg),velocity:s.vx+s.massMotion.rate.x,hull:s.x};
 });
 expect(result.worldCG.x).toBeCloseTo(4,9);
 expect(result.velocity).toBeCloseTo(1,9);
 expect(result.hull).toBeCloseTo(3.88,9);
});

test('Laser stagvending works on both halser with direct helm and a smaller fixed step',async({page})=>{
 await page.goto(game);
 const runs=[];
 for(const wind of [8,9])for(const angle of [-49,49])runs.push(await page.evaluate(voyage,{boatId:'laser',kind:'tack',wind,angle}));
 const small=await page.evaluate(voyage,{boatId:'laser',kind:'tack',wind:8,angle:-49,dt:1/120});
 for(const r of [...runs,small]){
  const before=r.samples.find(s=>s.t>=7.95),signed=Math.sign(before.twa);
  expect(r.status).toBe('completed');
  expect(r.end.twa*signed).toBeLessThan(-40);
  expect(r.end.crewSide*before.crewSide).toBeLessThan(-.8);
  expect(r.samples.every(s=>s.helmAssist===0)).toBe(true);
  expect(r.samples.filter(s=>s.t>8&&s.t<11).some(s=>s.crewPose<1.25)).toBe(true);
  expect(Math.min(...r.samples.map(s=>s.boomClearance))).toBeGreaterThan(.15);
  expect(r.end.speed).toBeGreaterThan(2.4);
 }
 expect(Math.abs(small.end.speed-runs[0].end.speed)).toBeLessThan(.14);
 expect(Math.abs(small.end.heading-runs[0].end.heading)).toBeLessThan(2);
});

test('foil crew can move fore and aft at their stations and change the physical trim',async({page})=>{
 await page.goto(game);
 const samples=await page.evaluate(()=>['ac75','ac72'].map(boatId=>{
  const P=SailPhysics,c=SailingBoats.get(boatId);
  const env={...P.DEFAULT_ENV,boatId,difficulty:'hard',speed:0,waves:0,gusts:0,shelter:false,autoBalance:false};
  const state=P.createState({boatId,x:0,y:-13000,theta:0,vx:0,vy:0,crewPose:1,crewSide:0,crewSideBlend:0},env);
  function run(foreAft){
   for(let i=0;i<180;i++)P.step(state,{foreAft,crewPose:1},env,1/60);
   const scene=SAILING_GAME.scene;
   if(scene.boatId!==boatId)scene.buildBoat(boatId);
   scene.updateBoat(state,env,1/60);
   return {cg:state.hydro.cg.x,pitch:state.pitch,mass:state.hydro.weight/c.gravity,station:state.crewStations[0].x,
    rendered:scene.foilingCrew[0].centre.x,pelvis:scene.foilingCrew[0].body.pelvis.x};
  }
  return {boatId,neutral:run(0),forward:run(1)};
 }));
 for(const {boatId,neutral,forward} of samples){
  expect(forward.mass,boatId).toBeCloseTo(neutral.mass,7);
  expect(forward.station-neutral.station,boatId).toBeCloseTo(.15,3);
  expect(forward.rendered,boatId).toBeCloseTo(forward.station,5);
  expect(forward.pelvis-neutral.pelvis,boatId).toBeGreaterThan(.10);
  expect(forward.cg-neutral.cg,boatId).toBeGreaterThan(.01);
  expect(forward.pitch,boatId).toBeLessThan(neutral.pitch-.0001);
 }
});

test('hard steering follows the water at the rudder when drifting or backing',async({page})=>{
 await page.goto(game);
 const result=await page.evaluate(()=>{
  const P=SailPhysics;
  const env={...P.DEFAULT_ENV,boatId:'laser',difficulty:'hard',speed:0,waves:0,gusts:0,shelter:false};
  function sample(vx,waterX){
   const state=P.createState({x:0,y:-13000,theta:0,vx,vy:0,waterX,waterY:0,crewPose:1,crewSide:0,crewSideBlend:0},env);
   let impulse=0;
   for(let i=0;i<40;i++){
    P.step(state,{steer:.65,steerDigital:false,crewPose:1},env,1/60);
    impulse+=state.forces.yawRudder/60;
   }
   return {rudder:state.rudder,flow:state.steering.localForward,impulse,heading:state.theta,assist:state.forces.yawAssist};
  }
  return {still:sample(0,0),forward:sample(3,0),reverse:sample(-3,0),stationaryInCurrent:sample(0,3)};
 });
 expect(Math.abs(result.still.impulse)).toBeLessThan(.2);
 expect(result.forward.rudder).toBeGreaterThan(.08);
 expect(result.reverse.rudder).toBeLessThan(-.08);
 expect(result.stationaryInCurrent.rudder).toBeLessThan(-.08);
 for(const moving of [result.forward,result.reverse,result.stationaryInCurrent]){
  expect(moving.impulse,JSON.stringify(result)).toBeLessThan(-1);
  expect(moving.heading,JSON.stringify(result)).toBeLessThan(-.02);
  expect(moving.assist).toBe(0);
 }
});
