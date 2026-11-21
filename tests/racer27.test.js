'use strict';
const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('two sailors in trapezes reduce heel and increase reaching speed',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,B=SailingBoats,c=B.get('dinghy'),dt=1/60;
  const env={...P.DEFAULT_ENV,boatId:c.id,speed:8,direction:0,waves:0,gusts:0,shelter:false,autoBalance:false,ironsHelp:false};
  const samples=[1,2,3].map(pose=>{
   const body=B.crewPose(c,pose,1);
   return {righting:c.gravity*c.crewMass*body.cg.z,members:body.members.map(member=>({
    mass:member.segments.reduce((sum,v)=>sum+v.mass,0),
    seat:member.pelvis.z,head:member.head.z,edge:B.halfBeamAt(c,member.pelvis.x)
   }))};
  });
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
  for(let i=0;i<120;i++)P.step(turn,{steer:1,crewPose:2},env,dt);
  return {length:c.length,mass:c.mass,crewMass:c.crewMass,samples,inner:run(2),outboard:run(3),turn:P.wrap(turn.theta)/P.DEG};
 });
 expect(result.length).toBeCloseTo(9.75,4);
 expect(result.mass).toBe(2120);
 expect(result.crewMass).toBe(160);
 for(const {members} of result.samples){
  expect(members).toHaveLength(2);
  for(const member of members)expect(member.mass).toBeCloseTo(80,6);
 }
 expect(result.samples[2].righting).toBeGreaterThan(result.samples[1].righting*2);
 for(const {seat,head,edge} of result.samples[2].members){
  expect(seat).toBeGreaterThan(edge+.65);
  expect(head).toBeGreaterThan(edge+1.15);
 }
 expect(result.inner.capsized||result.outboard.capsized).toBe(false);
 expect(result.outboard.heel).toBeLessThan(result.inner.heel-.035);
 expect(result.outboard.speed).toBeGreaterThan(result.inner.speed+.35);
 expect(result.outboard.atFive).toBeGreaterThan(5);
 expect(result.turn).toBeLessThan(-31);
});
test('guest racing crew pose reaches the host through the real live service',async({browser})=>{
 test.setTimeout(60000);const services=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33120'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34120'},stdio:['ignore','pipe','inherit']})];await Promise.all(services.map(p=>new Promise((resolve,reject)=>{p.stdout.once('data',resolve);p.once('error',reject)})));const contexts=[],errors=[];
 try{for(let i=0;i<2;i++){const c=await browser.newContext({viewport:{width:900,height:600}});contexts.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33120');await p.goto('http://127.0.0.1:34120');await p.waitForFunction(()=>window.SAILING_GAME);if(i)await (await introOption(p, '#introBoat')).selectOption('dinghy');await (await introOption(p, '#introLobby')).click();await p.fill('#lobbyName',i?'Gæst':'Vært');if(i){await p.fill('#lobbyCodeInput',await contexts[0].pages()[0].locator('#lobbyCode').innerText());await p.click('#lobbyJoin')}else await p.click('#lobbyCreate');await expect(p.locator('#lobbyRoom')).toBeVisible();}
 const host=contexts[0].pages()[0],guest=contexts[1].pages()[0];await host.click('#lobbySail');await guest.click('#lobbySail');await host.waitForFunction(()=>FriVindLobby.fleet.actors.size===1);await guest.waitForFunction(()=>FriVindLobby.fleet.synced);await guest.keyboard.press('3');
 await host.waitForFunction(()=>{const f=FriVindLobby.fleet,s=[...f.boats.values()][0],a=[...f.actors.values()][0];return s?.boatId==='dinghy'&&s.crewPose===3&&s.crewPoseBlend>2.9&&s.crewJoints?.members?.length===2&&a?.racingCrew?.length===1&&a.trapezeLines?.filter(x=>x.visible).length===2},null,{timeout:20000});
 const state=await host.evaluate(()=>{const f=FriVindLobby.fleet,s=[...f.boats.values()][0],a=[...f.actors.values()][0];const people=[a.person,...a.racingCrew.map(c=>c.person)];return {crew:s.crewJoints.members.length,visualCrew:people.length,mass:s.crewJoints.segments.reduce((n,v)=>n+v.mass,0),head:s.crewJoints.members.map(m=>Math.abs(m.head.z)),visualError:people.map((p,i)=>p.belt.position.distanceTo(a.V(a.visibleCrewPose.members[i].pelvis.x,a.visibleCrewPose.members[i].pelvis.y,a.visibleCrewPose.members[i].pelvis.z))),renderedMass:a.visibleCrewPose.segments.reduce((sum,v)=>sum+v.mass,0),side:Math.abs(s.crewSideBlend)}});expect(state.crew).toBe(2);expect(state.visualCrew).toBe(2);expect(state.mass).toBeCloseTo(160,5);expect(state.head.every(z=>z>1.35)).toBe(true);expect(state.visualError.every(e=>e<.001)).toBe(true);expect(state.renderedMass).toBeCloseTo(160,5);expect(state.side).toBeGreaterThan(.9);expect(errors).toEqual([]);
 }finally{await Promise.all(contexts.map(c=>c.close()));services.forEach(p=>p.kill())}
});
