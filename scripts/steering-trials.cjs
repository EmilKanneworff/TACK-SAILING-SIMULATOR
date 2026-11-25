'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {gzipSync,gunzipSync} = require('node:zlib');

function load(root) {
 const install = name => require(path.resolve(root, 'assets', name));
 const scope = {performance, SailingSettings: install('settings'), FriVindCollisions: install('collisions')};
 for (const name of ['simulation/boats','archipelago','archipelago-relief','simulation/terrain','shelter',
  'water-depth','wind-field','simulation/physics','simulation/foils','simulation/recovery','simulation/weather',
  'simulation/course']) install(name)(scope);
 return {...scope, ...install('simulation/runtime')(scope)};
}

const environment = {speed: 7, direction: 0, gusts: 0, waveHeight: 0, chop: 0, waveSeed: 318031,
 windSeed: 318031, shelter: false, difficulty: 'hard', autoRecovery: false, ironsHelp: false};
const deg = 180 / Math.PI;
const rad = 1 / deg;
const knots = 1.9438444924;
const profiles = {
 laser: {speed: 3.35, wind: 7.5, trim: .66, angle: 51, pose: 3},
 dinghy: {speed: 4.2, wind: 7, trim: .67, angle: 53, pose: 3},
 yacht: {speed: 3.8, wind: 7, trim: .71, angle: 54, pose: 2},
 ac75: {speed: 6, wind: 12, trim: .58, angle: 57, pose: 2},
 ac72: {speed: 6, wind: 12, trim: .57, angle: 57, pose: 2}
};
const criteria = {
 tack: {eyeDeg: 10, headingToleranceDeg: 10, recoveryFraction: .80, holdSeconds: 2, maxSeconds: 30},
 steady: {windowSeconds: 8, minSpeed: .32, speedSD: .18, speedChange: .12, heelSD: 2.5, heelChange: 2,
  leewaySD: 3, leewayChange: 2, yawSD: 2, meanYaw: .8, meanHeadingError: 7, headingErrorSD: 3}
};

function makeState(runtime, id, env, heading, speed, trim, overrides) {
 const theta = (90 - heading) * rad;
 return runtime.createBoat(id, {x: 0, y: -13000, theta, vx: speed * Math.cos(theta), vy: speed * Math.sin(theta),
  sheet: runtime.SailPhysics.sheetFromTrim(trim, id), ...overrides}, env);
}

function sample(runtime, s, env) {
 const {SailPhysics: P} = runtime;
 const i = P.instruments(s, null, env), a = P.axes(s.theta), f = s.forces;
 const forward = a.fx * (s.vx - s.waterX) + a.fy * (s.vy - s.waterY);
 const cross = a.rx * (s.vx - s.waterX) + a.ry * (s.vy - s.waterY);
 return {t: s.time, x: s.x, y: s.y, heading: i.heading, twa: i.twa * deg, awa: i.awa * deg,
  speed: i.waterSpeed, forward, cross, upwindVMG: i.vmgWind, leeway: i.leeway * deg,
  heel: s.heel * deg, pitch: s.pitch * deg, heave: s.heave, yawRate: s.omega * deg,
  velocity: [s.vx, s.vy, s.heaveVelocity], rates: [s.heelRate, s.pitchRate, s.omega],
  rudder: s.rudder * deg, targetRudder: s.helmTarget * deg, boom: s.boom * deg, sheet: s.sheet,
  drive: s.sail.drive, crew: [s.crewPose, s.crewPoseBlend, s.crewSide, s.crewSideBlend, s.crewForeAft],
  crewCG: s.crewCG, cg: s.hydro?.cg ?? s.massMotion?.cg, buoyancy: s.hydro?.buoyancy,
  foil: s.foiling?.support?.phase, clearance: s.foiling?.clearance, steering: f.steering,
  addedWater: f.waterInertia, foilControl: s.foils&&Object.fromEntries(Object.entries(s.foils).map(([k,v])=>[k,{
   target: v.targetFlap * deg, actual: v.flap * deg, saturation: v.saturated, immersion: v.wet, ventilation: v.ventilation
  }])), grounded: s.ground?.contact, capsized: s.capsized, recovery: s.recovering};
}

function execute(runtime, trial, programme) {
 const {SailPhysics: P, fixedDt} = runtime, dt = trial.dt ?? fixedDt;
 const s = structuredClone(trial.initial), rows = [], snapshots = [], inputs = [];
 let previous, cursor = 0, approachSpeed = 0, count = 0, eyeIn = null, eyeOut = null, recoveredAt = null;
 let minimumSpeed = Infinity, maxHeel = 0, hold = 0, reason = null;
 const tack = trial.kind === 'tack', tackStart = trial.tackStart ?? 0, goal = trial.goal;
 const {eyeDeg, headingToleranceDeg, recoveryFraction, holdSeconds} = criteria.tack;
 for (let frame = 0; frame < trial.frames; frame++) {
  const t = frame * dt;
  if (trial.inputs?.[cursor + 1]?.frame === frame) cursor++;
  const control = programme ? programme(s, t, frame) : trial.inputs[cursor].control;
  const serialized = JSON.stringify(control);
  if (serialized !== previous) {
   inputs.push({frame, control});
   previous = serialized;
  }
  runtime.stepBoat(s, control, trial.env, dt, {diagnostics: true, waitForWind: false});
  const after = (frame + 1) * dt, wind = s.wind, speed = Math.hypot(s.vx - s.waterX, s.vy - s.waterY);
  if (tack && after > tackStart - 2 && after <= tackStart) { approachSpeed += speed; count++; }
  if (tack && after > tackStart) {
   const relative = wind.twa * deg;
   if (eyeIn === null && Math.abs(relative) <= eyeDeg) eyeIn = after;
   if (eyeIn !== null && eyeOut === null && relative * trial.side > eyeDeg) eyeOut = after;
   if (recoveredAt === null) minimumSpeed = Math.min(minimumSpeed, speed);
   maxHeel = Math.max(maxHeel, Math.abs(s.heel * deg));
   const i = P.instruments(s, null, trial.env);
   const onTarget = Math.abs(P.wrap((i.heading - goal) * rad)) * deg <= headingToleranceDeg;
   const stableTack = eyeOut !== null && onTarget && wind.twa * trial.side > 0 &&
    i.vmgWind > 0 && speed >= recoveryFraction * (count ? approachSpeed / count : trial.entrySpeed);
   hold = stableTack ? hold + dt : 0;
   if (recoveredAt === null && hold + 1e-10 >= holdSeconds) recoveredAt = after;
  }
  if (![s.x,s.y,s.heave,s.theta,s.heel,s.pitch,s.vx,s.vy,s.heaveVelocity].every(Number.isFinite)) reason = 'invalid-state';
  else if (s.capsized) reason = 'capsize';
  else if (s.ground?.contact) reason = 'grounded';
  else if (s.recovering) reason = 'recovery';
  if (frame % Math.round(.25 / dt) === Math.round(.25 / dt) - 1 || reason || frame === trial.frames - 1) rows.push(sample(runtime, s, trial.env));
  if (trial.snapshots?.includes(frame + 1)) snapshots.push({time: after, state: structuredClone(s)});
  if (reason) break;
 }
 const tackSucceeded = recoveredAt !== null && !reason;
 const runCompleted = !reason;
 if (tack && !tackSucceeded && !reason) reason = eyeIn === null ? 'never-entered-wind-eye' :
  eyeOut === null ? 'never-exited-on-new-tack' : 'did-not-hold-course-and-recovery-speed';
 const end = rows.at(-1);
 return {runCompleted, maneuverSucceeded: tack ? tackSucceeded : null, steadyReached: null, failureReason: reason,
  tack: tack ? {approachSpeed: count ? approachSpeed / count : trial.entrySpeed, eyeIn, eyeOut,
   eyeSeconds: eyeOut === null ? null : eyeOut - eyeIn, minimumSpeed, recoveredAt,
   recoverySeconds: recoveredAt === null ? null : recoveredAt - tackStart, maxHeel} : undefined,
  inputs, rows, end, snapshots, final: s};
}

function screenshotTrials(runtime) {
 return [-1,1].flatMap(side => [-1,0,1].map(steer => {
  const id = 'ac72', trim = .674;
  const env = {...environment, speed: 9.7, direction: 270, shelter: true};
  const initial = makeState(runtime,id,env,90+side,5.8/knots,trim,{x:575,y:-1190,crewPose:3,
   crewPoseBlend:3,boom:side*runtime.SailPhysics.boomLimit(trim,id)});
  const inputs = [{frame:0,control:{steer,crewPose:3,trimFast:true, ...(steer ? {} : {sheetTarget:0})}}];
  return {name:`AC72-reproduction-${side}-${steer}`,id,kind:'steer',env,initial,inputs,frames:360,snapshots:[1,180,360]};
 }));
}

function laserStress(runtime, side, waves) {
 const id = 'laser', P = runtime.SailPhysics;
 const env = {...environment, speed:16.8, direction:90, ...(waves ? {waveHeight:.55,chop:.20} : {})};
 const initial = makeState(runtime,id,env,90+50*side,3.91,.519,{y:-3500,
  vx:3.91*Math.cos(-side*.09-50*side*rad),vy:3.91*Math.sin(-side*.09-50*side*rad),
  heel:side*28*rad,crewPose:3,crewPoseBlend:3,crewSide:-side,cruiserRig:{reef:2,reefTarget:2}});
 const inputs = [{frame:0,control:{steer:side,trimFast:true,crewPose:3,rig:{reef:2}}},
  {frame:69,control:{steer:side,trim:-1,trimFast:true,crewPose:3,rig:{reef:2}}}];
 return {name:`Laser-stress-${side}-${waves?'waves':'flat'}`,id,kind:'steer',env,initial,inputs,frames:260,snapshots:[1,75]};
}

function tackTrial(runtime, id, side, legacy = false, options = {}) {
 const {SailPhysics:P} = runtime, p = profiles[id];
 const env = {...environment, speed:legacy ? 7 : p.wind, ...options.env};
 const angle = legacy ? 49 : options.angle ?? p.angle;
 const heading = side * angle, goal = -heading;
 const trim = legacy ? {laser:.75,dinghy:.78,yacht:.82,ac75:.67,ac72:.71}[id] : P.sheetFromTrim(options.trim ?? p.trim,id);
 const pose = legacy && id !== 'dinghy' ? (id==='laser'?3:2) : p.pose;
 const entrySpeed = legacy ? 3.1 : options.speed ?? p.speed;
 const initial = makeState(runtime,id,env,heading,entrySpeed,0,{
  sheet:trim,crewPose:pose,crewPoseBlend:pose,crewSide:-side,crewSideBlend:-side
 });
 const tackStart = 8;
 const trial = {name:`${id}-tack-${side}-${legacy?'previous':'sailor'}`,id,kind:'tack',side,env,initial,goal,
  tackStart,entrySpeed,frames:(legacy?36:tackStart+criteria.tack.maxSeconds)*60};
 let moved = false, boreAway = false, builtSpeed = false;
 const programme = (s,t) => {
  const tack = t>=tackStart, remaining = P.wrap((90-goal)*rad-s.theta), windward = -side;
  if (tack && (legacy ? (s.wind.twa*windward < -3*rad) : (P.wrap(s.theta-(90*rad))*side >= -4*rad))) moved = true;
  if(tack&&options.recoveryHeading&&moved&&s.wind.twa*side>12*rad)boreAway=true;
  if(boreAway&&s.speed>=options.recoverySpeed)builtSpeed=true;
  const target = tack ? (boreAway&&!builtSpeed?-side*options.recoveryHeading:goal) : heading;
  const error = P.wrap((90-target)*rad-s.theta);
  const limit = legacy ? .80 : 1;
  const steer = P.clamp(-(options.gain??2.1)*error + 1.12*s.omega,-limit,limit);
  const nearEye = tack && Math.abs(P.wrap(s.theta-90*rad)) < 29*rad;
  const crewPose = !tack ? pose : legacy ? (moved && s.crewSideBlend*side>=.95 ? 2 : 1) :
   (id==='laser' ? (nearEye ? 1 : (moved ? pose : 1)) : (nearEye ? 1 : pose));
  const sheetTarget = legacy ? trim : nearEye ? P.sheetFromTrim(options.eyeTrim ?? (id==='laser'?.49:.43),id) :
   boreAway&&!builtSpeed ? P.sheetFromTrim(options.recoveryTrim ?? options.trim,id) : trim;
  return {steer,steerDigital:false,crew:moved?side:windward,crewPose,trimFast:true,
   ...(legacy ? {trim:P.clamp((sheetTarget-s.sheet)*6,-1,1)} : {sheetTarget})};
 };
 return {trial,programme};
}

function fixedAngle(runtime, trial, source) {
 const {FoilingPhysics:F,SailPhysics:P}=runtime, env={...trial.env,forceDiagnostics:true};
 const side=Math.sign(source.state.boom), rows=[];
 for(const flow of ['actual','without-sway','without-yaw-rate'])for(const angle of [-12,-5,0,5,12,source.state.rudder*deg]){
  const s=structuredClone(source.state),a=P.axes(s.theta);
  if(flow==='without-sway'){
   const lateral=(s.vx-s.waterX)*a.rx+(s.vy-s.waterY)*a.ry;
   s.vx-=lateral*a.rx;s.vy-=lateral*a.ry;
  }
  if(flow==='without-yaw-rate')s.omega=0;
  s.rudder=angle*rad;
  const load=F.loads(s,env), cg=P.bodyPoint(s,load.mass.cg);
  const part=(name,point,force,yawAtOrigin)=>{
   const w=point&&P.bodyPoint(s,point);
   const yaw=w?(w.x-cg.x)*force.y-(w.y-cg.y)*force.x:
    yawAtOrigin+(s.x-cg.x)*force.y-(s.y-cg.y)*force.x;
   return {name,point,force,sideForce:force.x*a.rx+force.y*a.ry,yaw};
  };
  const rudders=F.foilKeys(s).filter(k=>k.startsWith('rudder'));
  const wingParts=Object.entries(s.foils).flatMap(([key,v])=>v.parts.map(p=>part(key+' '+p.name,p.localPoint,p.force)));
  const blades=load.foils.items.map(p=>part(p.label,p.point,p.force));
  const sail=load.sail.accumulator.items.map(p=>part(p.label,p.point,p.force));
  const hull=part('hull',null,load.hull.force,load.hull.yaw);
  const hullContributions=load.hull.items.map(p=>part(p.label,p.point,p.force));
  const yawRudder=[...wingParts,...blades].filter(p=>p.name.startsWith('rudder')).reduce((n,p)=>n+p.yaw,0);
  rows.push({angle,flow,side,cg,yawRudder,wingParts,blades,sail,hull,hullContributions,
   rudders:rudders.map(k=>({key:k,...s.foils[k].rudderBlade})),
   flap:Object.fromEntries(Object.entries(s.foils).map(([key,v])=>[key,{
    target:v.targetFlap*deg,actual:v.flap*deg,saturated:v.saturated,request:v.requestedVertical}]))});
 }
 return {time:source.time,rows};
}

function geometrySweep(runtime) {
 const {SailPhysics:P}=runtime;
 if(!P.rudderContacts)return null;
 const env={...environment,speed:0};
 const s=makeState(runtime,'laser',env,90,3,.5,{heave:.17,pitch:4*rad,rudder:18*rad});
 return [-60,-45,-35,-20,0,20,35,45,60].map(heel=>{
  s.heel=heel*rad;
  const contact=P.rudderContacts(s,env);
  return {heel,heave:s.heave,pitch:s.pitch*deg,contact,
   wetArea:contact.sections.reduce((n,p)=>n+p.wetArea,0)};
 });
}

function waveSites(runtime) {
 const {SailPhysics:P,SailingWorld:W,SailingWaterDepth:D}=runtime;
 const sites=[{name:'Åbent syd for Lyø',x:-775,y:-2400},{name:'Læ ved Faaborg',x:0,y:0},
  {name:'Øst for Svelmø',x:1400,y:-1580}];
 return sites.map(site=>{
  const {x,y}=site,bed=W.sample(x,y);
  return {...site,depth:-bed.height,distance:bed.distance,waveDepth:D.sample(x,y).depth,
   cases:[{waveHeight:0,chop:0},{waveHeight:2.5,chop:0},{waveHeight:0,chop:1},{waveHeight:2.5,chop:1}].map(setting=>{
    const env={...environment,direction:270,speed:5,shelter:true,...setting};
    const exposure=P.waveExposureAt(P.waveProfileFor(env),x,y);
    const height=(shelter,legacy)=> {
     const field={...env,shelter,...(legacy?{waves:.85}:{})};
     const samples=Array.from({length:1800},(_,n)=>P.waveHeightAt(x,y,n*.1,field));
     const average=samples.reduce((sum,z)=>sum+z,0)/samples.length;
     return 4*Math.sqrt(samples.reduce((sum,z)=>sum+(z-average)**2,0)/samples.length);
    };
    return {...setting,exposure,localHeight:height(true,false),samePointExposed:height(false,false),
     legacyCollision:height(true,true),wind:P.windAt(x,y,0,env).speed};
   })};
 });
}

function stableWindows(rows, target) {
 const k=criteria.steady, recent=rows.slice(-32), earlier=rows.slice(-64,-32);
 if(earlier.length<32)return {passed:false};
 const summary=(group,key)=>{
  const values=group.map(r=>key==='error'?((r.heading-target+540)%360)-180:r[key]);
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  return {mean,sd:Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0)/values.length)};
 };
 const values=['speed','heel','leeway','yawRate','error'];
 const stats=Object.fromEntries(values.map(key=>[key,summary(recent,key)]));
 const change=key=>Math.abs(stats[key].mean-summary(earlier,key).mean);
 const passed=stats.speed.mean>k.minSpeed&&stats.speed.sd<k.speedSD&&change('speed')<k.speedChange&&
  stats.heel.sd<k.heelSD&&change('heel')<k.heelChange&&stats.leeway.sd<k.leewaySD&&change('leeway')<k.leewayChange&&
  stats.yawRate.sd<k.yawSD&&Math.abs(stats.yawRate.mean)<k.meanYaw&&
  Math.abs(stats.error.mean)<k.meanHeadingError&&stats.error.sd<k.headingErrorSD;
 return {passed,stats};
}

function moderateTrials(runtime) {
 const {SailPhysics:P,fixedDt:dt}=runtime,trials=[];
 for(const id of Object.keys(profiles))for(const side of [-1,1]){
  const p=profiles[id],heading=side*82,pose=id==='laser'?2:p.pose;
  const env={...environment,speed:id==='laser'?4.5:id==='ac75'||id==='ac72'?8:6};
  const sheet=P.sheetFromTrim(id==='laser'?.45:id.startsWith('ac')?.44:.50,id);
  const base={id,env,dt,goal:heading,kind:'neutral',frames:32*60};
  const start=makeState(runtime,id,env,heading,p.speed,0,{sheet,crewPose:pose,crewPoseBlend:pose,crewSide:-side,crewSideBlend:-side});
  const keep=(s)=>({steer:P.clamp(-2.7*P.wrap((90-heading)*rad-s.theta)+1.35*s.omega,-1,1),
   steerDigital:false,crewPose:pose,crew:-side,sheetTarget:sheet,trimFast:true});
  const settled=execute(runtime,{...base,initial:start},keep);
  trials.push({...base,name:`${id}-approach-${side}`,initial:start,inputs:settled.inputs});
  if(!settled.runCompleted)continue;
  const hold={crewPose:pose,crew:-side,sheetTarget:sheet,trimFast:true};
  const short={...base,initial:settled.final,frames:8*60};
  for(const rudder of [-.60,-.24,0,.24,.60]){
   trials.push({...short,name:`${id}-rudder-step-${side}-${rudder}`,kind:'steer',
    inputs:[{frame:0,control:{...hold,steer:rudder,steerDigital:false}},{frame:120,control:{...hold,steer:0}}]});
  }
  trials.push({...short,name:`${id}-ease-${side}`,kind:'ease',inputs:[{frame:0,control:{...hold,sheetTarget:0}}]});
  if(side===1)for(const waves of [false,true]){
   const waveEnv=waves?{...env,waveHeight:.35,chop:.18}:env;
   trials.push({...short,env:waveEnv,frames:12*60,name:`${id}-fore-aft-${waves?'waves':'flat'}`,kind:'weight',
    inputs:[{frame:0,control:{...hold,foreAft:0}},{frame:120,control:{...hold,foreAft:1}},
    {frame:390,control:{...hold,foreAft:-1}}]});
  }
  if(side===1)trials.push({...short,env:{...env,waveHeight:.35,chop:.18},kind:'steer',
   name:`${id}-wave-steer`,inputs:[{frame:0,control:{...hold,steer:.60,steerDigital:false}},
   {frame:120,control:{...hold,steer:0}}]});
 }
 return trials;
}

function immersionTrials(runtime){
 const env={...environment,speed:0,waveHeight:.72,chop:.23};
 return [60,120].map(frequency=>{
  const dt=1/frequency,id='laser';
  const initial=makeState(runtime,id,env,70,3,.35,
   {x:-775,y:-2400,heel:24*rad,pitch:2*rad,crewPose:1,crewPoseBlend:1,crewSide:0,crewSideBlend:0});
  const s=structuredClone(initial),out=[];
  let last,peakDV=0,peakYaw=0,peakAddedMassChange=0;
  const control={crewPose:1,crew:0,foreAft:0};
  for(let n=0;n<6*frequency;n++){
   runtime.stepBoat(s,control,env,dt,{diagnostics:true,waitForWind:false});
   const data=sample(runtime,s,env);
   if(last){
    peakDV=Math.max(peakDV,Math.hypot(...data.velocity.map((v,i)=>v-last.velocity[i])));
    peakYaw=Math.max(peakYaw,Math.abs(data.yawRate-last.yawRate));
    peakAddedMassChange=Math.max(peakAddedMassChange,Math.abs(data.addedWater.sway-last.addedWater.sway));
   }
   if(n%(frequency/4)===0||s.capsized)out.push(data);
   if(s.capsized)break;
   last=data;
  }
  return {frequency,dt,env,initial,control,peakDV,peakYaw,peakAddedMassChange,rows:out};
 });
}

function run(root, beforeFile) {
 const runtime = load(root), recorded = beforeFile && readRun(beforeFile);
 const replays=recorded?.baseline??recorded;
 const trials = [...screenshotTrials(runtime), ...[-1,1].flatMap(side=>[false,true].map(waves=>laserStress(runtime,side,waves)))];
 if (!replays) for (const id of Object.keys(profiles)) for (const side of [-1,1]) for (const legacy of [true,false]) {
  const {trial,programme} = tackTrial(runtime,id,side,legacy);
  trials.push({...trial,programme});
 }
 if(!replays)trials.push(...moderateTrials(runtime));
 const selected = replays?.trials.map(r=>r.definition) ?? trials;
 const sections={geometry:geometrySweep(runtime),waveSites:waveSites(runtime),immersion:immersionTrials(runtime)};
 const sourceHash = crypto.createHash('sha256');
 for (const name of ['boats','physics','foils','runtime']) sourceHash.update(fs.readFileSync(path.resolve(root,`assets/simulation/${name}.js`)));
 return {criteria, root, ...sections, runtimeHash:sourceHash.digest('hex'), profiles:runtime.SailingBoats.LIST,
  trials:selected.map(item=>{
   const {programme,...definition}=item;
   const result=execute(runtime,definition,programme);
   if(definition.kind==='neutral'){
    const stable=stableWindows(result.rows,definition.goal);
    result.steadyReached=stable.passed&&result.runCompleted;
    result.steady=stable;
    if(!result.steadyReached&&!result.failureReason)result.failureReason='steady-criteria-not-reached';
   }
   if(definition.id==='ac72'&&definition.snapshots){
    const frozen=replays?.trials.find(r=>r.definition.name===definition.name)?.result.snapshots??result.snapshots;
    result.fixedAngles=frozen.filter(s=>s.time===6).map(s=>fixedAngle(runtime,definition,s));
   }
   definition.inputs=result.inputs;
   delete result.inputs;
   delete result.final;
   console.log(definition.name,result.failureReason??'ok',result.end.heading.toFixed(1),
    result.end.speed.toFixed(2),result.tack?.recoverySeconds??'');
   return {definition,result};
  })};
}

const readRun = filename => JSON.parse(filename.endsWith('.gz')
 ? gunzipSync(fs.readFileSync(filename)) : fs.readFileSync(filename,'utf8'));
function supplementary(root, baselinePath, recordedPath) {
 const runtime=load(root),bundle=readRun(baselinePath),base=bundle.baseline??bundle;
 const recorded=recordedPath?readRun(recordedPath):null,prior=recorded?.manoeuvres?.before??recorded;
 const trials=prior?prior.map(r=>r.definition):base.trials.filter(r=>r.definition.name.includes('-approach-')).map(r=>{
  const d=r.definition, {final}=execute(runtime,d);
  return {...d,name:d.name.replace('approach','neutral'),initial:final,
   inputs:[{frame:0,control:{...d.inputs.at(-1).control,steer:0}}]};
 });
 const tactics=[
  ['ac75',{env:{speed:12},angle:46,trim:.64,eyeTrim:.68,gain:3.6,recoveryHeading:75,recoverySpeed:8,recoveryTrim:.56}],
  ['ac72',{env:{speed:13},angle:60,trim:.70,eyeTrim:.55,gain:3.6}]
 ];
 if(!prior)for(const [id,options] of tactics)for(const side of [-1,1]){
  const {trial,programme}=tackTrial(runtime,id,side,false,options);
  trials.push({...trial,programme,name:`${id}-tack-${side}-trim-profile`,tactics:options});
 }
 return trials.map(d=>{
  let {programme,...definition}=d;
  if(prior&&d.tactics)({programme}=tackTrial(runtime,d.id,d.side,false,d.tactics));
  const result=execute(runtime,definition,programme);
  const frozen=prior&&d.tactics?execute(runtime,d):undefined;
  definition.inputs=result.inputs;
  if(definition.kind==='neutral'){
   const stable=stableWindows(result.rows,definition.goal);
   result.steadyReached=result.runCompleted&&stable.passed;
   result.steady=stable;
   if(!result.steadyReached&&!result.failureReason)result.failureReason='steady-criteria-not-reached';
  }
  for(const trace of [result,frozen].filter(Boolean)){
   delete trace.inputs;
   delete trace.final;
  }
  console.log(definition.name,result.failureReason??'ok',result.end.heading.toFixed(1),
   result.end.speed.toFixed(2),result.tack?.recoverySeconds??'',frozen?.failureReason??'');
  return {definition,result,frozen};
 });
}
if(require.main===module) {
 const [root='.',output='/tmp/tack-steering-trials.json',mode,baseline,recorded]=process.argv.slice(2);
 const report=JSON.stringify(mode==='--maneuvers'?supplementary(root,baseline,recorded):run(root,mode));
 fs.writeFileSync(output,output.endsWith('.gz')?gzipSync(report):report);
}
module.exports = {load,execute,environment,criteria,makeState,sample,tackTrial,stableWindows,run};
