'use strict';
const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
const game=process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href;
test('three sailors move the centre of gravity, reduce heel and increase reaching speed in trapezes',async({page})=>{
 await page.goto(game);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,B=SailingBoats,c=B.get('dinghy'),dt=1/60;
  const env={...P.DEFAULT_ENV,boatId:c.id,difficulty:'hard',speed:8,direction:0,waves:0,gusts:0,shelter:false,autoBalance:false,ironsHelp:false};
  const samples=[1,2,3].flatMap(pose=>[-1,1].map(side=>{
   const s=P.createState({boatId:c.id,x:0,y:-5000,theta:0,vx:0,vy:0,
    crewSide:side,crewSideBlend:side,crewPose:pose,crewPoseBlend:pose},{...env,speed:0});
   const body=s.crewJoints,masses=[...c.massPoints,...body.members.flatMap(member=>member.segments.map(({mass,p})=>({mass,...p})))];
   const expectedCG=Object.fromEntries(['x','y','z'].map(key=>[key,masses.reduce((sum,m)=>sum+m.mass*m[key],0)/c.mass]));
   return {pose,side,weight:s.hydro.weight,displaced:s.hydro.totalDisplacedVolume,righting:s.hydro.rollCrew*side,
    cg:s.hydro.cg,expectedCG,members:body.members.map(member=>({
    mass:member.segments.reduce((sum,v)=>sum+v.mass,0),
    x:member.pelvis.x,seat:member.pelvis.z*side,head:member.head.z*side,edge:B.halfBeamAt(c,member.pelvis.x)
   }))};
  }));
  const sheet=.65;
  const run=(pose)=>{
   const s=P.createState({boatId:c.id,x:0,y:-5000,theta:0,vx:0,vy:0,sheet,boom:P.boomLimit(sheet,c),
    crewSide:-1,crewSideBlend:-1,crewPose:pose,crewPoseBlend:pose},env);
   let heel=0,speed=0,atFive=0,n=0;
   for(let i=0;i<29*60;i++){
    const steer=P.clamp(2.1*P.wrap(s.theta)+1.15*s.omega,-.9,.9);
    P.step(s,{steer,steerDigital:false,crewPose:pose},env,dt);
    const knots=P.instruments(s,null,env).waterKnots;
    if(i===299)atFive=knots;
    if(i>=21*60){heel+=Math.abs(s.heel);speed+=knots;n++;}
   }
   return {heel:heel/n,speed:speed/n,atFive,capsized:s.capsized};
  };
  const turn=P.createState({boatId:c.id,x:0,y:-5000,theta:0,vx:3.5,vy:0,
   sheet:.58,boom:P.boomLimit(.58,c),crewSide:-1,crewSideBlend:-1,crewPose:2,crewPoseBlend:2},env);
  const neutral=structuredClone(turn);
  for(let i=0;i<120;i++){
   P.step(turn,{steer:1,crewPose:2},env,dt);
   P.step(neutral,{steer:0,crewPose:2},env,dt);
  }
  return {length:c.length,mass:c.mass,crewMass:c.crewMass,samples,inner:run(2),outboard:run(3),turn:P.wrap(turn.theta-neutral.theta)/P.DEG};
 });
 expect(result.length).toBeCloseTo(9.75,4);
 expect(result.mass).toBe(2200);
 expect(result.crewMass).toBe(240);
 for(const {members,weight,displaced,cg,expectedCG} of result.samples){
  expect(members).toHaveLength(3);
  for(const member of members)expect(member.mass).toBeCloseTo(80,6);
  for(const key of ['x','y','z'])expect(cg[key]).toBeCloseTo(expectedCG[key],10);
  expect(weight).toBeCloseTo(2200*9.81,6);
  expect(displaced).toBeCloseTo(2200/1025,6);
 }
 for(const side of [-1,1]){
  const [,inner,outboard]=result.samples.filter(sample=>sample.side===side);
  expect(outboard.righting).toBeGreaterThan(inner.righting*2);
  expect(outboard.cg.z*side).toBeGreaterThan(inner.cg.z*side+.13);
  for(const [i,{x,seat,head,edge}] of outboard.members.entries()){
   expect(seat).toBeGreaterThan(edge+.65);
   expect(head).toBeGreaterThan(edge+1.15);
   if(i)expect(x-outboard.members[i-1].x).toBeGreaterThan(.8);
  }
 }
 expect(result.inner.capsized||result.outboard.capsized).toBe(false);
 expect(result.outboard.heel).toBeLessThan(result.inner.heel-.035);
 expect(result.outboard.speed).toBeGreaterThan(result.inner.speed+.35);
 expect(result.outboard.atFive).toBeGreaterThan(result.inner.atFive);
 expect(result.turn).toBeLessThan(-20);
});

test('going from the rail to trapeze under load flattens the boat and builds speed on the same sheet',async({page})=>{
 await page.goto(game);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG,heading=-48*D,sheet=.88;
  const env={...P.DEFAULT_ENV,boatId:'dinghy',difficulty:'hard',speed:12.1,direction:180,waves:0,gusts:0,shelter:false,autoRecovery:false};
  const start=P.createState({x:0,y:-5000,theta:heading,sheet,vx:4.94*Math.cos(heading),vy:4.94*Math.sin(heading),
   crewPose:2,crewPoseBlend:2,heel:-.55},env);
  function step(s,crewPose){
   const steer=P.clamp(2.1*P.wrap(s.theta-heading)+1.3*s.omega,-.95,.95);
   P.step(s,{steer,steerDigital:false,crewPose},env,1/60);
  }
  const log=s=>({heel:Math.abs(s.heel)/D,speed:P.instruments(s,null,env).waterKnots,
   pose:s.crewPoseBlend,sheet:s.sheet,capsized:s.capsized,heading:s.theta/D});
  for(let i=0;i<480;i++)step(start,2);
  const rail=structuredClone(start),trapeze=structuredClone(start);
  let firstSecond;
  for(let i=0;i<300;i++){
   step(rail,2);
   step(trapeze,3);
   if(i===59)firstSecond=[log(rail),log(trapeze)];
  }
  const plants=trapeze.crewJoints.members.flatMap(member=>member.feet.map((foot,i)=>{
   const edge=SailingBoats.halfBeamAt('dinghy',foot.x),hip=member.hips[i];
   return {inset:edge-Math.abs(foot.z),reach:Math.hypot(hip.x-foot.x,hip.y-foot.y,hip.z-foot.z)};
  }));
  return {firstSecond,rail:log(rail),trapeze:log(trapeze),plants};
 });
 const {firstSecond:[railAtOne,trapezeAtOne],rail,trapeze,plants}=result;
 expect(trapezeAtOne.pose).toBeGreaterThan(2.99);
 // A full rig at this wind now balances at greater heel. Verify the
 // transient improves immediately and retain the settled speed/heel checks.
 expect(trapezeAtOne.heel).toBeLessThan(railAtOne.heel-.75);
 expect(trapeze.heel).toBeLessThan(rail.heel-4);
 expect(trapeze.speed).toBeGreaterThan(rail.speed+.30);
 expect(Math.abs(trapeze.heading-rail.heading)).toBeLessThan(2);
 for(const state of [rail,trapeze])expect(state).toMatchObject({sheet:.88,capsized:false});
 for(const plant of plants){
  expect(plant.inset).toBeCloseTo(.04,3);
  expect(plant.reach).toBeGreaterThan(.84);
  expect(plant.reach).toBeLessThan(.94);
 }
});

test('Racer 32 holds a reach and tacks at 10 m/s with manual crew transfer and physical rudder forces',async({page})=>{
 await page.goto(game);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const runs=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG;
  return [-1,1].flatMap(side=>[false,true].map(tack=>{
   const course=tack?55:90,heading=(90-side*course)*D;
   const env={...P.DEFAULT_ENV,boatId:'dinghy',difficulty:'hard',speed:10,direction:0,shelter:false,
    waveHeight:.50,chop:.24,gusts:.28,windSeed:318031,ironsHelp:false,autoRecovery:false};
   delete env.waves;
   const s=P.createState({x:0,y:-13000,theta:heading,sheet:tack?.74:.54,crewPose:3,
    vx:3.5*Math.cos(heading),vy:3.5*Math.sin(heading)},env);
   const startingBoom=Math.sign(s.boom),duration=tack?34:20;
   let crew=-side,peakHeel=0,minWet=1,heel=0,wet=0,knots=0,error=0,yawAssist=0,samples=0;
   for(let i=0;i<duration*60&&!s.capsized;i++){
    const t=i/60,target=tack&&t>=9?(90+side*course)*D:heading;
    const steer=P.clamp(2.1*P.wrap(s.theta-target)+1.3*s.omega,-.95,.95);
    if(tack&&t>=9&&s.wind.twa*side>0)crew=side;
    P.step(s,{steer,steerDigital:false,crew,crewPose:tack&&t>=8&&t<=14?1:3},env,1/60);
    peakHeel=Math.max(peakHeel,Math.abs(s.heel)/D);
    minWet=Math.min(minWet,s.forces.rudder.wet);
    yawAssist=Math.max(yawAssist,Math.abs(s.forces.yawAssist));
    if(t>duration-6){
     heel+=Math.abs(s.heel)/D;
     wet+=s.forces.rudder.wet;
     knots+=P.instruments(s,null,env).waterKnots;
     error+=Math.abs(P.wrap(s.theta-target))/D;
     samples++;
    }
   }
   return {side,tack,capsized:s.capsized,startingBoom,finalBoom:Math.sign(s.boom),crewSide:s.crewSide,
    peakHeel,minWet,yawAssist,heel:heel/samples,wet:wet/samples,knots:knots/samples,error:error/samples};
  }));
 });
 for(const run of runs){
  const evidence=JSON.stringify(run);
  expect(run.capsized,evidence).toBe(false);
  expect(run.startingBoom,evidence).toBe(run.side);
  expect(run.finalBoom,evidence).toBe(run.tack?-run.side:run.side);
  expect(run.crewSide,evidence).toBe(-run.finalBoom);
  expect(run.yawAssist,evidence).toBe(0);
  expect(run.peakHeel,evidence).toBeLessThan(41);
  expect(run.minWet,evidence).toBeGreaterThan(.22);
  expect(run.heel,evidence).toBeLessThan(run.tack?38:28);
  expect(run.wet,evidence).toBeGreaterThan(run.tack?.30:.38);
  expect(run.knots,evidence).toBeGreaterThan(run.tack?8:9.5);
  expect(run.error,evidence).toBeLessThan(7);
 }
});
test('guest racing crew pose reaches the host through the real live service',async({browser})=>{
 test.setTimeout(60000);const services=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33120'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34120'},stdio:['ignore','pipe','inherit']})];await Promise.all(services.map(p=>new Promise((resolve,reject)=>{p.stdout.once('data',resolve);p.once('error',reject)})));const contexts=[],errors=[];
 try{for(let i=0;i<2;i++){const c=await browser.newContext({viewport:{width:900,height:600}});contexts.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33120');await p.goto('http://127.0.0.1:34120');await p.waitForFunction(()=>window.SAILING_GAME);if(i)await (await introOption(p, '#introBoat')).selectOption('dinghy');await (await introOption(p, '#introLobby')).click();await p.fill('#lobbyName',i?'Gæst':'Vært');if(i){await p.fill('#lobbyCodeInput',await contexts[0].pages()[0].locator('#lobbyCode').innerText());await p.click('#lobbyJoin')}else await p.click('#lobbyCreate');await expect(p.locator('#lobbyRoom')).toBeVisible();}
 const host=contexts[0].pages()[0],guest=contexts[1].pages()[0];await host.click('#lobbySail');await host.waitForFunction(()=>FriVindLobby.fleet.actors.size===1);await guest.waitForFunction(()=>FriVindLobby.fleet.synced);await guest.keyboard.press('3');
 await host.waitForFunction(()=>{const f=FriVindLobby.fleet,s=[...f.boats.values()][0],a=[...f.actors.values()][0];return s?.boatId==='dinghy'&&s.crewPose===3&&s.crewPoseBlend>2.9&&a?.visibleCrewPose?.members?.length===3&&a?.racingCrew?.length===2&&a.trapezeLines?.filter(x=>x.visible).length===3},null,{timeout:20000});
 const state=await host.evaluate(()=>{const f=FriVindLobby.fleet,s=[...f.boats.values()][0],a=[...f.actors.values()][0];const people=[a.person,...a.racingCrew.map(c=>c.person)];const joints=SailingBoats.crewPoseAt(s);return {crew:joints.members.length,visualCrew:people.length,mass:joints.segments.reduce((n,v)=>n+v.mass,0),head:joints.members.map(m=>Math.abs(m.head.z)),visualError:people.map((p,i)=>p.belt.position.distanceTo(a.V(a.visibleCrewPose.members[i].pelvis.x,a.visibleCrewPose.members[i].pelvis.y,a.visibleCrewPose.members[i].pelvis.z))),renderedMass:a.visibleCrewPose.segments.reduce((sum,v)=>sum+v.mass,0),side:Math.abs(s.crewSideBlend)}});expect(state.crew).toBe(3);expect(state.visualCrew).toBe(3);expect(state.mass).toBeCloseTo(240,5);expect(state.head.every(z=>z>1.35)).toBe(true);expect(state.visualError.every(e=>e<.001)).toBe(true);expect(state.renderedMass).toBeCloseTo(240,5);expect(state.side).toBeGreaterThan(.9);expect(errors).toEqual([]);
 await guest.click('#preferencesButton');
 await expect(guest.locator('#personalControls')).toBeVisible();
 const before=await host.evaluate(()=>SAILING_GAME.state.time);
 await host.waitForFunction(before=>!SAILING_GAME.paused&&SAILING_GAME.state.time>before+.25,before);
 await guest.keyboard.press('Escape');
 await guest.keyboard.down('ArrowRight');
 await guest.waitForFunction(()=>SAILING_GAME.state.steerIntent===1);
 await guest.keyboard.up('ArrowRight');
 }finally{await Promise.all(contexts.map(c=>c.close()));services.forEach(p=>p.kill())}
});
