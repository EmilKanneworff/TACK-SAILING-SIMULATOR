'use strict';
const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('crew segments contribute to inertia once and all boats retain their mass when crew moves',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const results=await page.evaluate(()=>['laser','dinghy','yacht','ac75','ac72'].map(id=>{const c=SailingBoats.get(id),e={...SailPhysics.DEFAULT_ENV,boatId:id,speed:0,waves:0,gusts:0,autoBalance:false},states=[];
  for(const pose of [1,2,3]){const s=SailPhysics.createState({boatId:id,x:0,y:-5000,vx:0,vy:0,crewPose:pose,crewPoseBlend:pose,crewSide:1,crewSideBlend:1},e);SailPhysics.updateCrew(s,{crewPose:pose},e,0);SailPhysics.step(s,{crewPose:pose},e,1/60);if(c.kind==='foiler'){const m=FoilingPhysics.massProperties(s);states.push({mass:m.mass,cg:m.cg,crew:m.crewMass});}else{const seg=s.crewJoints.segments;states.push({mass:c.mass,crew:seg.reduce((a,v)=>a+v.mass,0),cg:s.hydro.cg,roll:s.forces.inertiaRoll,expectedRoll:c.rollInertia+seg.reduce((a,v)=>a+v.mass*(v.p.y**2+v.p.z**2),0),pitch:s.forces.inertiaPitch,expectedPitch:c.pitchInertia+seg.reduce((a,v)=>a+v.mass*(v.p.x**2+v.p.y**2),0),yaw:s.forces.inertiaYaw,expectedYaw:c.yawInertia+seg.reduce((a,v)=>a+v.mass*(v.p.x**2+v.p.z**2),0)});}}
  return {id,mass:c.mass,crew:c.crewMass,componentMass:c.massPoints.reduce((sum,p)=>sum+p.mass,0)+c.crewMass+2*(c.armMass||0),density:c.waterDensity,states};}));
 for(const r of results){expect(r.componentMass).toBeCloseTo(r.mass,5);expect(r.density).toBe(1025)}
 for(const r of results)for(const s of r.states){expect(s.mass).toBeCloseTo(r.mass,4);expect(s.crew).toBeCloseTo(r.crew,4);if(s.roll){expect(s.roll).toBeCloseTo(s.expectedRoll,5);expect(s.pitch).toBeCloseTo(s.expectedPitch,5);expect(s.yaw).toBeCloseTo(s.expectedYaw,5)}}
 for(const r of results)expect(Math.abs(r.states[0].cg.z-r.states[2].cg.z)).toBeGreaterThan(.001);
});
test('Racer 32 rudders use separate local flow and immersion without duplicating area',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{const P=SailPhysics,c=SailingBoats.get('dinghy'),e={...P.DEFAULT_ENV,boatId:'dinghy',speed:0,waves:0,gusts:0,shelter:false};function run(heel,omega,heave){const s=P.createState({boatId:'dinghy',x:0,y:-5000,theta:0,vx:4,vy:0,heel,omega,rudder:.18,...(heave===null?{}:{heave})},e);P.step(s,{steer:0,crewPose:2},e,1/60);return s.forces.rudder}return {offsets:c.rudderOffsets,level:run(0,0,null),turn:run(0,.3,null),heeled:run(1.0,0,0),dry:run(0,0,10)};});
 expect(result.offsets).toHaveLength(2);expect(result.level.parts).toHaveLength(2);expect(result.level.parts[0].side).toBeCloseTo(result.level.parts[1].side,5);expect(result.level.side).toBeCloseTo(result.level.parts[0].side+result.level.parts[1].side,5);expect(Math.abs(result.turn.parts[0].speed-result.turn.parts[1].speed)).toBeGreaterThan(.1);expect(Math.abs(result.heeled.parts[0].side-result.heeled.parts[1].side)).toBeGreaterThan(1);expect(Math.abs(result.dry.side)).toBeLessThan(.001);
});
test('dynamic hull support grows with forward speed and disappears without water contact',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{const P=SailPhysics,e={...P.DEFAULT_ENV,boatId:'laser',speed:0,waves:0,gusts:0,shelter:false};function run(speed,heave){const s=P.createState({x:0,y:-5000,theta:0,vx:speed,vy:0,...(heave===null?{}:{heave})},e);P.step(s,{steer:0,trim:0,crewPose:2},e,1/60);return {lift:s.forces.planingLift,drag:s.forces.planingDrag,rise:s.forces.planingRelativeRise,weight:s.hydro.weight};}return {slow:run(0,null),mid:run(4,null),fast:run(7,null),reverse:run(-7,null),dry:run(7,10)};});
 expect(r.slow.lift).toBe(0);expect(r.reverse.lift).toBe(0);expect(r.dry.lift).toBe(0);expect(r.fast.lift).toBeGreaterThan(r.mid.lift);expect(r.fast.lift).toBeLessThanOrEqual(r.fast.weight*.7);expect(r.fast.drag).toBeGreaterThan(0);expect(r.fast.lift*r.fast.rise-r.fast.drag*7).toBeLessThanOrEqual(0);
});

test('hulls, underwater surfaces and instruments distinguish current from movement over ground',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const sample=await page.evaluate(()=>['laser','ac75'].map(boatId=>{
  const P=SailPhysics,env={...P.DEFAULT_ENV,boatId,speed:0,sea:'calm',waves:0,gusts:0,shelter:false};
  function run(current){
   const s=P.createState({boatId,x:0,y:-5000,theta:0,vx:3,vy:0,waterX:current,waterY:0},env);
   const reading=P.instruments(s,null,env);
   P.step(s,{steer:0,trim:0,crewPose:2},env,1/60);
   return {reading,drag:Math.abs(s.forces.hullF),foilSpeed:s.foils?.port.speed??s.forces.board.speed};
  }
  return {without:run(0),withCurrent:run(3)};
 }));
 for(const {without,withCurrent} of sample){
  expect(withCurrent.reading.speed).toBeCloseTo(3);
  expect(withCurrent.reading.waterSpeed).toBeCloseTo(0);
  expect(without.drag).toBeGreaterThan(1);
  expect(withCurrent.drag).toBeLessThan(without.drag*.03);
  expect(withCurrent.foilSpeed).toBeLessThan(without.foilSpeed*.05);
 }
});
