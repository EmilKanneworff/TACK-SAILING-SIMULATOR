'use strict';
const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('two racing sailors hike outside the hull and shift actual mass smoothly',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{const c=SailingBoats.get('dinghy'),samples=[1,2,3].map(position=>{const p=SailingBoats.crewPose(c,position,1);return {mass:p.segments.reduce((a,b)=>a+b.mass,0),cg:p.cg,members:p.members.map(m=>({x:m.pelvis.x,seat:m.pelvis.z,head:m.head.z,mass:m.segments.reduce((sum,v)=>sum+v.mass,0),edge:SailingBoats.halfBeamAt(c,m.pelvis.x)}))}}),env={...SAILING_GAME.env,boatId:'dinghy',speed:5,gusts:0,waves:0,autoBalance:false},runs=[];
 for(const pose of [1,2,3]){const s=SailPhysics.createState({boatId:'dinghy'},env);let maxStep=0,previous=s.crewCG.z;for(let i=0;i<1800;i++){SailPhysics.step(s,{steer:0,trim:0,crewPose:pose},env,1/60);maxStep=Math.max(maxStep,Math.abs(s.crewCG.z-previous));previous=s.crewCG.z;}runs.push({heel:s.heel,speed:Math.hypot(s.vx,s.vy),capsized:s.capsized,maxStep})}
 return {length:c.length,mass:c.mass,crewMass:c.crewMass,samples,runs};});
 expect(result.length).toBeCloseTo(9.75,4);expect(result.mass).toBe(2600);expect(result.crewMass).toBe(160);
 for(const p of result.samples){expect(p.mass).toBeCloseTo(160,6);expect(p.members).toHaveLength(2);for(const m of p.members)expect(m.mass).toBeCloseTo(80,6)}
 expect(result.samples[0].cg.z).toBeLessThan(result.samples[1].cg.z);expect(result.samples[1].cg.z).toBeLessThan(result.samples[2].cg.z);
 for(const member of result.samples[2].members){expect(member.seat).toBeGreaterThan(member.edge+.5);expect(member.head).toBeGreaterThan(member.edge+.9)}
 for(const run of result.runs){expect(run.capsized).toBe(false);expect(run.speed).toBeGreaterThan(1);expect(run.maxStep).toBeLessThan(.06)}
 expect(result.runs[0].heel-result.runs[2].heel).toBeGreaterThan(.04);
});
test('guest racing crew pose reaches the host through the real live service',async({browser})=>{
 test.setTimeout(60000);const services=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33120'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34120'},stdio:['ignore','pipe','inherit']})];await Promise.all(services.map(p=>new Promise((resolve,reject)=>{p.stdout.once('data',resolve);p.once('error',reject)})));const contexts=[],errors=[];
 try{for(let i=0;i<2;i++){const c=await browser.newContext({viewport:{width:900,height:600}});contexts.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33120');await p.goto('http://127.0.0.1:34120');await p.waitForFunction(()=>window.SAILING_GAME);if(i)await (await introOption(p, '#introBoat')).selectOption('dinghy');await (await introOption(p, '#introLobby')).click();await p.fill('#lobbyName',i?'Gæst':'Vært');if(i){await p.fill('#lobbyCodeInput',await contexts[0].pages()[0].locator('#lobbyCode').innerText());await p.click('#lobbyJoin')}else await p.click('#lobbyCreate');await expect(p.locator('#lobbyRoom')).toBeVisible();}
 const host=contexts[0].pages()[0],guest=contexts[1].pages()[0];await host.click('#lobbySail');await guest.click('#lobbySail');await host.waitForFunction(()=>FriVindLobby.fleet.actors.size===1);await guest.waitForFunction(()=>FriVindLobby.fleet.synced);await guest.keyboard.press('3');
 await host.waitForFunction(()=>{const f=FriVindLobby.fleet,s=[...f.boats.values()][0],a=[...f.actors.values()][0];return s?.boatId==='dinghy'&&s.crewPose===3&&s.crewPoseBlend>2.9&&s.crewJoints?.members?.length===2&&a?.racingCrew?.length===1&&a.trapezeLines?.filter(x=>x.visible).length===2},null,{timeout:20000});
 const state=await host.evaluate(()=>{const f=FriVindLobby.fleet,s=[...f.boats.values()][0],a=[...f.actors.values()][0];const people=[a.person,...a.racingCrew.map(c=>c.person)];return {crew:s.crewJoints.members.length,visualCrew:people.length,mass:s.crewJoints.segments.reduce((n,v)=>n+v.mass,0),head:s.crewJoints.members.map(m=>Math.abs(m.head.z)),visualError:people.map((p,i)=>p.belt.position.distanceTo(a.V(a.visibleCrewPose.members[i].pelvis.x,a.visibleCrewPose.members[i].pelvis.y,a.visibleCrewPose.members[i].pelvis.z))),renderedMass:a.visibleCrewPose.segments.reduce((sum,v)=>sum+v.mass,0),side:Math.abs(s.crewSideBlend)}});expect(state.crew).toBe(2);expect(state.visualCrew).toBe(2);expect(state.mass).toBeCloseTo(160,5);expect(state.head.every(z=>z>1.35)).toBe(true);expect(state.visualError.every(e=>e<.001)).toBe(true);expect(state.renderedMass).toBeCloseTo(160,5);expect(state.side).toBeGreaterThan(.9);expect(errors).toEqual([]);
 }finally{await Promise.all(contexts.map(c=>c.close()));services.forEach(p=>p.kill())}
});
