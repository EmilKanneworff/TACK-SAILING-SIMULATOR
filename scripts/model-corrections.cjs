'use strict';

const path = require('node:path');
const rootPath = require.main === module ? path.resolve(process.argv[2] || '.') : path.resolve(__dirname, '..');
const install = name => require(path.join(rootPath, 'assets', name));
const scope = { performance, SailingSettings: install('settings'), FriVindCollisions: install('collisions') };
for (const name of ['simulation/boats', 'archipelago', 'archipelago-relief', 'simulation/terrain',
 'shelter', 'water-depth', 'wind-field', 'simulation/physics', 'simulation/foils', 'simulation/recovery',
 'simulation/weather', 'simulation/course']) install(name)(scope);
const { SailPhysics: P, FoilingPhysics: F, SailingBoats: B, SailingWorld: W } = scope;
const { createBoat, stepBoat, fixedDt: dt } = install('simulation/runtime')(scope);
const flat = { speed: 0, direction: 0, gusts: 0, waveHeight: 0, chop: 0, shelter: false,
 difficulty: 'hard', autoRecovery: false };
const zero = { x: 0, y: 0, z: 0 };
const zeroMoment = { roll: 0, pitch: 0, yaw: 0 };
const deg = r => r / P.DEG;
const rad = d => d * P.DEG;

function foilCases() {
 const profile = B.get('ac72');
 const ambient = { normal: { x: 0, y: 0, z: 1 }, chord: { x: 1, y: 0, z: 0 },
  wet: 1, ventilation: 0, area: 1, config: profile };
 const streams = [[3, 0, 0], [-3, 0, 0], [-3, 0, 1e-6], [-3, 0, -1e-6],
  [3, 6, 0], [-3, 6, .3], [0, 6, 0], [1e-6, 6, 0], [-1e-6, 6, 0],
  [3, 0, 1], [-3, 0, -1], [0, 0, 1], [3, 0, 0]];
 return streams.map(([x,y,z], index) => {
  const input = { ...ambient, velocity: { x, y, z } }, requested = index === streams.length-1 ? 30000 : 1000;
  const low = profile.foilFlapMin, high = profile.foilFlapMax;
  const load = F.foilElement(input);
  let target;
  if (F.foilFlapTarget) target = F.foilFlapTarget(input, requested, low, high, 0);
  else {
   const nz = Math.abs(load.liftDirection.z) > .12 ? load.liftDirection.z : Math.sign(load.liftDirection.z || 1) * .12;
   const cl = P.clamp(requested / (Math.max(50, load.q || 0) * nz), -profile.foilAttachedLimit, profile.foilAttachedLimit);
   const raw = profile.foilCLMax / profile.foilLiftSlope * Math.atanh(cl / profile.foilCLMax) + (load.flowAngle || 0);
   target = { flap: P.clamp(raw, low, high), saturated: raw < low || raw > high };
  }
  const realised = F.foilElement({ ...input, flap: target.flap });
  return { velocity: input.velocity, requested, actualFlapDeg: 0, targetFlapDeg: deg(target.flap),
   actualInitialForce: load.force.z, verticalAtTarget: realised.force.z, saturated: target.saturated,
   minimumForce: target.minimumForce, maximumForce: target.maximumForce, sectionSpeed: realised.speed,
   powerAtTarget: realised.power, forceAtTarget: realised.force };
 });
}

function waterInertiaTrial(frequency) {
 const step = 1 / frequency, mass = 143, cg = zero, inertia = { roll: 80, pitch: 210, yaw: 200 };
 const water = { sway: 110, firstMoment: 38, secondMoment: 95 };
 const s = { x: 0, y: 0, heave: 0, theta: .3, heel: 0, pitch: 0,
  vx: 3, vy: .45, heaveVelocity: 0, heelRate: 0, pitchRate: 0, omega: .3 };
 function invariants() {
  const a = P.axes(s.theta), v = a.rx * s.vx + a.ry * s.vy;
  const energy = .5 * (mass * (s.vx**2 + s.vy**2) + inertia.yaw * s.omega**2 +
   water.sway * v**2 - 2 * water.firstMoment * v * s.omega + water.secondMoment * s.omega**2);
  const addition = water.sway * v - water.firstMoment * s.omega;
  const px = mass * s.vx + addition * a.rx, py = mass * s.vy + addition * a.ry;
  return { energy, px, py, worldAngularMomentum: (inertia.yaw + water.secondMoment) * s.omega -
   water.firstMoment * v + s.x * py - s.y * px, omega: s.omega };
 }
 const initial = { ...s }, first = invariants();
 let energyPeak = 0, angularPeak = 0, linearPeak = 0;
 for(let n = 0; n < 8 * frequency; n++) {
  P.integrateMass(s, step, mass, cg, inertia, zero, zeroMoment, water);
  const current = invariants();
  energyPeak = Math.max(energyPeak, Math.abs(current.energy-first.energy));
  angularPeak = Math.max(angularPeak, Math.abs(current.worldAngularMomentum-first.worldAngularMomentum));
  linearPeak = Math.max(linearPeak, Math.hypot(current.px-first.px,current.py-first.py));
 }
 return { frequency, mass, inertia, water, initial, first, last: invariants(), energyPeak, angularPeak, linearPeak };
}

function internalTrial(id, mode) {
 const boat = createBoat(id, { x: 0, y: -12000, heave: .1, theta: .1, crewPose: 1, crewSide: -1 }, flat);
 const c = B.get(id), foil = c.kind === 'foiler';
 function moving() {
  if(!foil) return B.crewPoseAt(boat).segments;
  const m = F.massProperties(boat);
  return m.points.filter(p => p.kind !== 'fixed').map(p => ({ p, mass: p.mass }));
 }
 const before = moving();
 const mover = mode === 'arm' ? boat.foils.port : null;
 const trace = [];
 for(let tick=1; tick<=120; tick++){
  const pointsBefore = tick===1 ? before : moving();
  const oldBoomRate = boat.boomRate;
  if(mode==='crew') P.updateCrew(boat, { crew:1,crewPose:2,foreAft:.35 }, flat, dt);
  if(mover) mover.arm = .36 * Math.sin(Math.PI*tick/120)**2;
  if(mode==='boom') boat.boomRate = Math.sin(Math.PI*tick/120);
  const points = moving();
  const properties = foil ? F.massProperties(boat) : P.hydrostatics(boat,flat,false);
  const inertia = properties.inertia || { ...c.originInertia };
  if(!foil) for(const point of points) B.addPointInertia(inertia,point.p,point.mass);
  const balance = {};
  P.integrateMass(boat,dt,c.mass,properties.cg,inertia,zero,zeroMoment,null,balance,
   {points,before:pointsBefore,boomInertia:c.boomInertia,oldBoomRate});
  const a=P.axes(boat.theta),longitudinal=Math.cos(boat.pitch)*boat.heelRate;
  const omega={x:a.fx*longitudinal+a.rx*boat.pitchRate,y:a.fy*longitudinal+a.ry*boat.pitchRate,
   z:boat.omega+Math.sin(boat.pitch)*boat.heelRate};
  const components=[{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1}].map(p=>{
   const offset=P.bodyOffset(boat,p);
   return (offset.f*a.fx+offset.r*a.rx)*omega.x+(offset.f*a.fy+offset.r*a.ry)*omega.y+offset.up*omega.z;
  });
  const [roll,yaw,pitch]=components,i=boat.massMotion.inertia;
  const rotor={x:0,y:mode==='boom'?c.boomInertia*boat.boomRate:0,z:0};
  points.forEach(({p,mass},index)=>{
   const old=pointsBefore[index].p, x=p.x-properties.cg.x,y=p.y-properties.cg.y,z=p.z-properties.cg.z;
   rotor.x+=mass*(y*(p.z-old.z)-z*(p.y-old.y))/dt;
   rotor.y+=mass*(z*(p.x-old.x)-x*(p.z-old.z))/dt;
   rotor.z+=mass*(x*(p.y-old.y)-y*(p.x-old.x))/dt;
  });
  const norm = Math.hypot(i.roll*roll+i.xy*yaw+i.xz*pitch+rotor.x,
   i.xy*roll+i.yaw*yaw+i.yz*pitch+rotor.y,i.xz*roll+i.yz*yaw+i.pitch*pitch+rotor.z);
  trace.push({ t:tick*dt, norm, rotor, omega, heel:boat.heel, pitch:boat.pitch, yaw:boat.theta });
 }
 return { id, mode, peakUnbalancedMomentum:Math.max(...trace.map(v=>v.norm)), samples:trace.filter((_,i)=>i%12===0||i===119) };
}

function recorded(name,id,field,start,frames,windOffAt=Infinity) {
 const c=B.get(id),env={...flat,...field},s=createBoat(id,start,env),rows=[],inputs=[];
 let last;
 for(let frame=0; frame<frames; frame++){
  const control=name(s,frame);
  if(JSON.stringify(control)!==last){inputs.push({frame,control});last=JSON.stringify(control);}
  const weather=frame<windOffAt?env:{...env,speed:0};
  stepBoat(s,control,weather,dt,{diagnostics:true,waitForWind:false});
  if(frame%15===14||frame===0||frame===frames-1){
   const i=P.instruments(s,null,env);
   rows.push({time:s.time,heading:i.heading,knots:i.logKnots,leeway:deg(i.leeway??0),heel:deg(s.heel),pitch:deg(s.pitch),
    rudderDeg:deg(s.rudder),boomDeg:deg(s.boom),sheet:s.sheet,uiTrim:P.trimFromSheet(s.sheet,c),
    limitDeg:deg(P.boomLimit(s.sheet,c)),awaDeg:deg(s.wind.awa??0),
    aero:s.sail.drive,crewSide:s.crewSide,crewSideBlend:s.crewSideBlend,crewPose:s.crewPose,actualPose:s.crewPoseBlend,
    crewCG:s.crewCG,foreAft:s.crewForeAft,crewDuck:s.crewDuck,twaDeg:deg(s.wind.twa??0),
    wind:s.wind.tws,vmgKnots:i.vmgWind*1.9438444924,yaw:s.forces.yaw,foilStatus:s.foiling?.status,
    depth:s.ground.depth,ground:s.ground.contact,capsized:s.capsized,clearance:s.foiling?.clearance,
    yawRudder:s.forces.yawRudder,detail:s.forces.steering&&{...s.forces.steering,blades:undefined},
    blades:s.forces.steering?.blades||s.forces.rudder?.parts||Object.values(s.foils||{}).filter(a=>a.rudderBlade).map(a=>a.rudderBlade),
    sailLoads:Object.fromEntries(['main','jib','spinnaker'].flatMap(key=>s.sail[key]?[[key,{
     area:s.sail[key].area,centre:s.sail[key].centre??s.sail[key].point,force:s.sail[key].drive,side:s.sail[key].sideForce,
     angle:s.sail[key].angle,roll:s.sail[key].rollMoment,cL:s.sail[key].cl,cD:s.sail[key].cd
    }]]:[])),
    foils:s.foils&&Object.fromEntries(Object.entries(s.foils).map(([key,a])=>[key,{force:a.force.z,request:a.requestedVertical,
     target:deg(a.targetFlap),actual:deg(a.flap),arm:a.arm,wet:a.wet,vent:a.ventilation,saturated:a.saturated
    }]))
   });
  }
 }
 return { name:name.name,id,env,start,dt,inputs,windOffAt:windOffAt*dt,rows };
}

function initialise(id,heading,speed,trim,pos) {
 const theta=rad(90-heading),sheet=P.sheetFromTrim(trim,id);
 return { x:0,y:-12000,theta,vx:speed*Math.cos(theta),vy:speed*Math.sin(theta),sheet,
  crewPose:2,crewPoseBlend:2,...pos };
}

function sailingTrials() {
 const trials=[];
 for(const side of [-1,1]){
  const sheet=.674;
  const start=initialise('ac72',90+side,5.8/1.9438444924,sheet,
   { x:575,y:-1190,crewPose:3,crewPoseBlend:3,boom:side*P.boomLimit(sheet,'ac72') });
  for(const steer of [-1,0,1]){
   const run=recorded(function ac72Lans(){return {steer,crewPose:3,sheetTarget:steer?undefined:0,trimFast:true};},
    'ac72',{ speed:9.7,direction:270,shelter:true },start,360);
   trials.push(run);
  }
  const t=-side*rad(50), a=P.axes(t-side*.09);
  trials.push(recorded(function laserAfFald(_,n){return {steer:side,trim:n>=69?-1:0,trimFast:true,crewPose:3,rig:{reef:2}};},
   'laser',{speed:16.8,direction:90},initialise('laser',90-deg(t),3.91,.519,
    {y:-3500,vx:3.91*a.fx,vy:3.91*a.fy,heel:side*rad(28),crewPose:3,crewPoseBlend:3,crewSide:-side,cruiserRig:{reef:2,reefTarget:2}}),260));
 }
 for(const heading of [46,90,176]){
  trials.push(recorded(function laserSlaek(_,n){return {crewPose:1,sheetTarget:n<30?P.sheetFromTrim(.88,'laser'):0,trimFast:true};},
   'laser',{speed:4},initialise('laser',heading,1.5,.88,{crewPose:1,crewPoseBlend:1,crewSide:0}),300));
 }
 for(const extra of [null,'code0','gennaker','spinnaker']){
  trials.push(recorded(function turbaadReb(_,frame){
   return {crewPose:1,rig:{reef:frame>=360?2:0,headsail:frame>=480?2:0},
    spinnaker:extra!=null,downwindType:extra,sheetTarget:P.sheetFromTrim(.55,'yacht'),trimFast:true};
  },'yacht',{speed:7},initialise('yacht',extra==='spinnaker'?155:extra==='gennaker'?125:80,4,.55,
   {crewPose:1,crewPoseBlend:1,crewSide:-1}),780));
 }
 for(const id of ['ac75','ac72']){
  trials.push(recorded(function foilLoeftDrejLanding(_,n){
   return {crewPose:1,steer:n>=240&&n<294?.45:0,sheetTarget:n>=330?0:P.sheetFromTrim(.74,id),trimFast:true};
  },id,{speed:12},initialise(id,110,9,.74,{crewPose:1,crewPoseBlend:1}),1800,660));
 }
 return trials;
}

function calibration() {
 const {voyage}=require('./sea-trials.cjs');
 // The existing voyage suite is also evaluated through Playwright. Install the
 // same facade in this independent Node process without loading the game UI.
 Object.assign(globalThis,scope);
 const suite=[];
 for(const {id} of B.LIST){
  for(const angle of [50,90,165]) suite.push({boatId:id,kind:'steady',wind:7,angle});
  suite.push({boatId:id,kind:'tack',wind:7,angle:49});
  if(id==='ac75'||id==='ac72')suite.push({boatId:id,kind:'foil',wind:16,angle:112});
 }
 for(const angle of [52,90,160])suite.push({boatId:'laser',kind:'swell',wind:7,angle});
 for(const [knots, sheetSetting] of [[9,.825],[12,.78]]){
  suite.push({boatId:'laser',kind:'reference',wind:knots*1852/3600,angle:50,sheetSetting});
 }
 const runs=suite.map(condition=>{
  const {boatId,kind,status,elapsed,statistics,end,runCompleted,maneuverSucceeded,steadyReached,failureReason,maneuver}=voyage(condition);
  return {boatId,kind,condition,status,runCompleted,maneuverSucceeded,steadyReached,failureReason,maneuver,elapsed,statistics,end};
 });
 const profiles=B.LIST.map(({id,length,beam,mass,crewMass,sailArea,mainArea,jibArea,waterDensity})=>({
  id,length,beam,mass,crewMass,sailArea,mainArea:mainArea??sailArea,jibArea:jibArea??0,waterDensity
 }));
 return {profiles,runs};
}

function helmRelease() {
 const trims={laser:.59,dinghy:.64,yacht:.65,ac75:.55,ac72:.57};
 return B.LIST.flatMap(({id})=>[-1,1].flatMap(side=>[false,true].map(withRudder=>{
  const heading=side<0?90:270,trim=trims[id];
  return {...recorded(function accelerateAndTurn(_,frame){
   return {crewPose:1,steer:withRudder&&frame>=240&&frame<300?side*.45:0,steerDigital:false,trimFast:true};
  },id,{speed:7},initialise(id,heading,.8,trim,{crewPose:1,crewPoseBlend:1,crewSide:side}),480),withRudder};
 })));
}

function manualSide() {
 return [-1,1].map(windSide=>{
  const boat=createBoat('laser',{x:0,y:-12000,theta:rad(90+windSide*45),crewPose:2,crewSide:windSide},flat);
  const wind={aws:7,tws:7,awa:rad(windSide*40),twa:rad(windSide*45)};
  const controls={crew:-windSide,crewPose:2};
  P.updateCrew(boat,controls,flat,dt,{wind});
  const first={chosen:boat.crewSide,actual:boat.crewSideBlend};
  for(let n=0;n<120;n++)P.updateCrew(boat,{},flat,dt,{wind});
  return {wind,controls,first,last:{chosen:boat.crewSide,actual:boat.crewSideBlend,pose:boat.crewPoseBlend}};
 });
}

function weightShifts() {
 return B.LIST.map(({id,mass})=>{
  const trial=recorded(function crewShift(_,frame){
   if(frame<90)return {crewPose:1,crew:-1,foreAft:0};
   if(frame<250)return {crewPose:3,crew:1,foreAft:1};
   return {crewPose:3,crew:0,foreAft:-1};
  },id,flat,initialise(id,90,0,0,{crewPose:1,crewPoseBlend:1,crewSide:-1}),420);
  const structural=trial.rows.filter((row,i)=>i===0||i===6||i===14||i===16||i===27||i===28);
  return {id,mass,start:trial.start,dt,inputs:trial.inputs,rows:structural.map(({time,crewSide,crewSideBlend,crewPose,actualPose,crewCG,foreAft,crewDuck,heel,pitch,knots})=>({
   time,crewSide,crewSideBlend,crewPose,actualPose,crewCG,foreAft,crewDuck,heel,pitch,knots
  }))};
 });
}

function waves() {
 const sites=[{x:1400,y:-1580,name:'bredt farvand'},{x:0,y:0,name:'kyst'},{x:0,y:-14000,name:'åben reference',shelter:false}];
 return sites.map(({x,y,name,shelter=true})=>{
  const cases=[];
  for(const waveHeight of [0,2.5]) for(const chop of [0,1]){
   const env={...flat,direction:270,speed:5,shelter,waveHeight,chop};
   const mean=field=>{
    let sum=0,sumSquare=0,lo=Infinity,hi=-Infinity,up=0,last;
    const count=1800;
    for(let n=0;n<count;n++){
     const z=P.waveAt(x,y,n*.1,field).height;
     sum+=z;sumSquare+=z*z;lo=Math.min(lo,z);hi=Math.max(hi,z);
     if(last<=0&&z>0)up++;
     last=z;
    }
    return { Hs:4*Math.sqrt(Math.max(0,sumSquare/count-(sum/count)**2)),lo,hi,up };
   };
   cases.push({waveHeight,chop,normal:mean(env),legacyCollision:mean({...env,waves:.85})});
  }
  return {x,y,name,shelter,depth:-W.heightAt(x,y),cases};
 });
}

module.exports={foilCases,waterInertiaTrial,internalTrial,sailingTrials,waves};
if(require.main===module){
 const group=process.argv[3];
 const result=group==='forces'?{foil:foilCases(),added:[waterInertiaTrial(60),waterInertiaTrial(120)],
  internal:[internalTrial('laser','crew'),internalTrial('ac75','arm'),internalTrial('laser','boom')]}:
  group==='waves'?{waves:waves()}:group==='calibration'?calibration():group==='weights'?{trials:weightShifts(),manualSide:manualSide()}:
  group==='helm'?{trials:helmRelease()}:{trials:sailingTrials()};
 console.log(JSON.stringify(result,null,2));
}
