'use strict';
const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const {spawn}=require('node:child_process');const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('four crew move the actual mass and all three sails produce different downwind forces',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{const c=SailingBoats.get('yacht'),poses=[1,2,3].map(i=>{const p=SailingBoats.crewPose(c,i,1);return {cg:p.cg,mass:p.segments.reduce((n,v)=>n+v.mass,0),members:p.members.map(m=>({x:m.pelvis.x,mass:m.segments.reduce((n,v)=>n+v.mass,0)}))}}),env={...SAILING_GAME.env,boatId:'yacht',speed:7,direction:0,waves:0,gusts:0,crewPose:2};
 const runs=[['normal',-90,.42],['spinnaker',-90,.42],['normalReach',0,.52],['code0',0,.52],['normalBroad',-35,.48],['gennaker',-35,.48]].map(([type,degrees,sheet])=>{const theta=degrees*SailPhysics.DEG,s=SailPhysics.createState({boatId:'yacht',x:0,y:-5000,theta,vx:2*Math.cos(theta),vy:2*Math.sin(theta),sheet},env);let samples=[];for(let i=0;i<1200;i++){SailPhysics.step(s,{steer:0,trim:0,crewPose:2,spinnaker:Object.hasOwn(SailingBoats.cruiserSails,type),downwindType:type},env,1/60);if(i%60===59)samples.push({speed:Math.hypot(s.vx,s.vy),heel:s.heel,drive:s.sail?.spinnaker?.drive||0,area:s.sail?.spinnaker?.area||0,hoist:s.spinnaker?.hoist||0,jib:s.sail?.jib?.drive})}return {type,last:samples.at(-1),finite:samples.every(p=>Number.isFinite(p.speed)&&Number.isFinite(p.heel))}});
 return {boatMass:c.mass,crewMass:c.crewMass,poses,runs};});
 expect(r.boatMass).toBe(9600);expect(r.crewMass).toBe(300);for(const p of r.poses){expect(p.mass).toBeCloseTo(300,6);expect(p.members).toHaveLength(4);for(const m of p.members)expect(m.mass).toBeCloseTo(75,6)}expect(r.poses[2].cg.z).toBeGreaterThan(r.poses[0].cg.z);for(const v of r.runs)expect(v.finite).toBe(true);for(const run of [r.runs[1],r.runs[3],r.runs[5]]){expect(run.last.hoist).toBeGreaterThan(.99);expect(run.last.drive).toBeGreaterThan(100);expect(Math.abs(run.last.jib)).toBeLessThan(.01)}expect(r.runs[1].last.speed).toBeGreaterThan(r.runs[0].last.speed);expect(r.runs[3].last.speed).toBeGreaterThan(r.runs[2].last.speed);expect(r.runs[1].last.area).toBe(115);expect(r.runs[3].last.area).toBe(90);expect(r.runs[5].last.area).toBe(105);expect(r.runs[5].last.speed).toBeGreaterThan(r.runs[4].last.speed);
});
test('switching sails lowers the old sail before showing the new one',async({page})=>{
 await page.clock.install();
 await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
 await (await introOption(page,'#introBoat')).selectOption('yacht');
 await page.click('#startButton');
 const sail=()=>page.evaluate(()=>{
  const {state,scene}=SAILING_GAME;
  return {state:state.spinnaker,shown:[scene.spinnakerMesh,scene.code0Mesh,scene.gennakerMesh].map(mesh=>mesh.visible),
   crew:1+scene.racingCrew.length};
 });
 await page.click('#spinnakerButton');
 await page.clock.runFor(4500);
 const first=await sail();
 expect(first.state.type).toBe('spinnaker');
 expect(first.state.hoist).toBeGreaterThan(.9);
 expect(first.shown).toEqual([true,false,false]);
 expect(first.crew).toBe(4);
 for(const [from,type,button,shown] of [
  ['spinnaker','code0','#code0Button',[false,true,false]],
  ['code0','gennaker','#gennakerButton',[false,false,true]]
 ]){
  await page.click(button);
  await page.clock.runFor(1000);
  const lowering=await sail();
  expect(lowering.state.type).toBe(from);
  expect(lowering.state.phase).toBe('lowering');
  expect(lowering.state.hoist).toBeLessThan(.9);
  await expect(page.locator('#coachSub')).toHaveText('Tager '+(from==='spinnaker'?'spiler':'Code 0')+' ned først');
  await page.clock.runFor(8300);
  expect(await sail()).toMatchObject({state:{type,phase:'up',hoist:1},shown});
 }
 await expect(page.locator('#gennakerButton')).toHaveText('Tag gennaker ned');
 await page.click('#gennakerButton');
 await page.clock.runFor(4500);
 expect(await sail()).toMatchObject({state:{phase:'down',hoist:0},shown:[false,false,false]});
});
for(const {type,button,waiting,bearing} of [
 {type:'code0',button:'#code0Button',waiting:'Code 0 afventer en åbnere kurs',bearing:'270'},
 {type:'gennaker',button:'#gennakerButton',waiting:'Gennaker afventer en åbnere kurs',bearing:'250'},
 {type:'spinnaker',button:'#spinnakerButton',waiting:'Spiler afventer en åbnere kurs',bearing:'200'}
]){
 test(type+' waits with the jib up and fills when the wind opens after a single click',async({page})=>{
  await page.clock.install();
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await (await introOption(page,'#introBoat')).selectOption('yacht');
  await page.selectOption('#introDifficulty','easy');
  await page.click('#startButton');
  await page.evaluate(()=>{
   const {state,env}=SAILING_GAME,P=SailPhysics,theta=63*P.DEG;
   Object.assign(env,{speed:7,direction:0,gusts:0,waveHeight:0,shelter:false});
   Object.assign(state,P.createState({boatId:'yacht',x:0,y:-5000,time:state.time,theta,
    vx:1.7*Math.cos(theta),vy:1.7*Math.sin(theta),sheet:.52},env));
   SailingWeather.initialize(state,env);
   const sheet=document.querySelector('#sheetControl');
   sheet.value=String(P.trimFromSheet(.52,state)*100);sheet.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.clock.runFor(6500);
  const sail=()=>page.evaluate(()=>{
   const {state,scene,env}=SAILING_GAME;
   const work=SailPhysics.aero(state,env).jib?.drive;
   return {sp:state.spinnaker,drive:state.sail.spinnaker?.drive??0,jib:work,jibArea:state.sail.jib?.area,
    visible:[scene.spinnakerMesh.visible,scene.code0Mesh.visible,scene.gennakerMesh.visible]};
  });
  const before=await sail();
  expect(before.sp).toMatchObject({phase:'down',unsafe:0,hoist:0});
  await page.click(button);
  await page.clock.runFor(170);
  const queued=await sail();
  expect(queued.sp).toMatchObject({phase:'waiting',selected:type,waitingFor:'course',unsafe:0,hoist:0});
  expect(queued.visible).toEqual([false,false,false]);
  expect(queued.jibArea).toBe(before.jibArea);
  expect(queued.jib).toBeGreaterThan(0);
  await expect(page.locator(button)).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#coachText')).toHaveText(waiting);
  await page.click('#settingsButton');
  await page.locator('#windDirection').fill(bearing);
  await page.keyboard.press('Escape');
  await page.clock.runFor(7800);
  const filled=await sail();
  expect(filled.sp).toMatchObject({type,phase:'up',hoist:1,waitingFor:null});
  expect(filled.sp.fill).toBeGreaterThan(.45);
  expect(filled.drive).toBeGreaterThan(250);
  expect(Math.abs(filled.jib)).toBeLessThan(.01);
  expect(filled.visible).toEqual(['spinnaker','code0','gennaker'].map(name=>name===type));
  await page.click(button);
  await page.clock.runFor(4400);
  const lowered=await sail();
  expect(lowered.sp).toMatchObject({phase:'down',hoist:0,fill:0,selected:null});
  expect(lowered.visible).toEqual([false,false,false]);
 });
}
test('hard-mode luff advice names the deployed sail and its actual lowering button',async({page})=>{
 test.setTimeout(60000);
 await page.clock.install();
 await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
 await (await introOption(page,'#introBoat')).selectOption('yacht');
 await page.selectOption('#introDifficulty','hard');
 await page.click('#startButton');
 for(const [type,label,button,heading] of [
  ['spinnaker','Spiler','#spinnakerButton',156],['code0','Code 0','#code0Button',101],['gennaker','Gennaker','#gennakerButton',128]
 ]){
  await page.evaluate(heading=>{
   const {state,env}=SAILING_GAME,P=SailPhysics,theta=(90-heading)*P.DEG;
   Object.assign(env,{speed:7,direction:0,gusts:0,waveHeight:0,chop:0,shelter:false});
   Object.assign(state,P.createState({boatId:'yacht',x:0,y:-5000,time:state.time,theta,
    vx:2*Math.cos(theta),vy:2*Math.sin(theta),sheet:.5},env));
   state.windClimate={speed:7,direction:0,gusts:0};
   SailingWeather.initialize(state,env);
  },heading);
  await page.clock.runFor(400);
  await page.click(button);
  await page.clock.runFor(7200);
  expect(await page.evaluate(()=>SAILING_GAME.state.spinnaker)).toMatchObject({type,phase:'up',hoist:1});
  await page.evaluate(()=>{
   const {state,env}=SAILING_GAME;
   env.direction=SailPhysics.wrap360(90-state.theta/SailPhysics.DEG+14);
   state.windClimate={speed:7,direction:env.direction,gusts:0};
  });
  await page.clock.runFor(2050);
  const action='Tag '+(type==='code0'?label:label.toLowerCase())+' ned';
  await expect(page.locator(button)).toHaveText(action);
  await expect(page.locator('#coachText')).toHaveText(label+' blafrer');
  await expect(page.locator('#coachSub')).toHaveText('Fald af, eller tryk ”'+action+'”. Fokken kommer automatisk tilbage.');
  await page.click(button);
  await page.clock.runFor(4800);
  const after=await page.evaluate(()=>({phase:SAILING_GAME.state.spinnaker.phase,
   hoist:SAILING_GAME.state.spinnaker.hoist,jib:SAILING_GAME.state.sail.jib?.area}));
  expect(after).toEqual({phase:'down',hoist:0,jib:32});
 }
});
test('Gennaker and four crew are synchronised between two live browser clients',async({browser})=>{
 test.setTimeout(60000);const services=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33121'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34121'},stdio:['ignore','pipe','inherit']})];await Promise.all(services.map(p=>new Promise((resolve,reject)=>{p.stdout.once('data',resolve);p.once('error',reject)})));const cs=[],errors=[];
 try{for(let i=0;i<2;i++){const c=await browser.newContext();cs.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33121');await p.goto('http://127.0.0.1:34121');await p.waitForFunction(()=>window.SAILING_GAME);if(i)await (await introOption(p, '#introBoat')).selectOption('yacht');await (await introOption(p, '#introLobby')).click();await p.fill('#lobbyName',i?'Gæst':'Vært');if(i){await p.fill('#lobbyCodeInput',await cs[0].pages()[0].locator('#lobbyCode').innerText());await p.click('#lobbyJoin')}else await p.click('#lobbyCreate');await expect(p.locator('#lobbyRoom')).toBeVisible();}const h=cs[0].pages()[0],g=cs[1].pages()[0];await h.click('#lobbySail');await g.waitForFunction(()=>FriVindLobby.fleet.synced);const id=await g.evaluate(()=>FriVindLobby.fleet.id);await g.click('#gennakerButton');await g.keyboard.press('3');await h.waitForFunction(id=>{const f=FriVindLobby.fleet,s=f.boats.get(id),a=f.actors.get(id);return s?.spinnaker?.type==='gennaker'&&s.spinnaker.hoist>.2&&Number.isFinite(s.rig?.camber)&&Number.isFinite(s.rig?.sideBlend)&&Number.isFinite(s.sail?.main?.camber)&&s.crewPose===3&&s.crewPoseBlend>2.8&&s.crewJoints?.members?.length===4&&a?.gennakerMesh?.visible&&a.racingCrew.length===3},id,{timeout:20000});const sync=await h.evaluate(id=>{const f=FriVindLobby.fleet,s=f.boats.get(id),a=f.actors.get(id);return [a.person,...a.racingCrew.map(c=>c.person)].map((p,i)=>Math.hypot(p.head.position.x-s.crewJoints.members[i].head.x,p.head.position.z-s.crewJoints.members[i].head.z))},id);expect(sync.every(v=>v<.08)).toBe(true);
 await g.click('#gennakerButton');
 await g.click('#telemetryToggle');
 await g.locator('#rigControls summary').click();
 await g.selectOption('#reefSetting','2');
 await g.selectOption('#headsailSetting','1');
 await g.selectOption('#trimSail','jib');
 await g.evaluate(()=>{
  const sheet=document.getElementById('sheetControl');
  sheet.value='22';sheet.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await h.waitForFunction(id=>{
  const f=FriVindLobby.fleet,s=f.boats.get(id),a=f.actors.get(id),r=s?.cruiserRig;
  if(!r||r.reef!==2||r.headsail!==1||Math.abs(r.jibSheet-SailPhysics.sheetFromTrim(.22,s))>.002||s.spinnaker.hoist>0)return false;
  const shape=a.sailMesh.geometry.attributes.position,head=shape.getY(shape.count-1);
  const reduced=18.0-(18.0-2.0)*.44;
  return Math.abs(head-reduced)<.16&&Math.abs(s.sail.main.area-26.88)<.01&&Math.abs(s.sail.jib.area-18.56)<.01;
 },id,{timeout:20000});
 expect(errors).toEqual([]);
 }finally{await Promise.all(cs.map(c=>c.close()));services.forEach(p=>p.kill())}
});
