'use strict';
const { introOption, chooseSail, operateExtraSail } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const {spawn}=require('node:child_process');const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('four crew move the actual mass and all three sails produce different downwind forces',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{const c=SailingBoats.get('yacht'),poses=[1,2,3].map(i=>{const p=SailingBoats.crewPose(c,i,1);return {cg:p.cg,mass:p.segments.reduce((n,v)=>n+v.mass,0),members:p.members.map(m=>({x:m.pelvis.x,mass:m.segments.reduce((n,v)=>n+v.mass,0)}))}}),env={...SAILING_GAME.env,boatId:'yacht',speed:7,direction:0,waves:0,gusts:0,crewPose:2};
 const P=SailPhysics;
 const runs=[['normal',-90,.42,7],['spinnaker',-90,.42,7],
  ['normalReach',-10,.52,5],['code0',-10,.52,5],['normalBroad',-35,.48,7],['gennaker',-35,.48,7]
 ].map(([type,degrees,sheet,speed])=>{
  const theta=degrees*P.DEG,field={...env,speed};
  const s=P.createState({boatId:'yacht',x:0,y:-5000,theta,vx:2*Math.cos(theta),vy:2*Math.sin(theta),sheet},field);
  const samples=[];
  for(let i=0;i<1200;i++){
   // Compare the rigs on the same point of sail. Code 0 is a light-air sail.
   const steer=P.clamp(3*P.wrap(s.theta-theta)+1.8*s.omega,-1,1);
   P.step(s,{steer,steerDigital:false,trim:0,crewPose:2,spinnaker:Object.hasOwn(SailingBoats.cruiserSails,type),downwindType:type},field,1/60);
   if(i%60===59)samples.push({speed:Math.hypot(s.vx,s.vy),heel:s.heel,drive:s.sail?.spinnaker?.drive||0,
    area:s.sail?.spinnaker?.area||0,hoist:s.spinnaker?.hoist||0,jib:s.sail?.jib?.drive});
  }
  return {type,last:samples.at(-1),finite:samples.every(p=>Number.isFinite(p.speed)&&Number.isFinite(p.heel))};
 });
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
 await operateExtraSail(page,'#spinnakerButton');
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
  await operateExtraSail(page,button);
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
 await operateExtraSail(page,'#gennakerButton');
 await page.clock.runFor(4500);
 expect(await sail()).toMatchObject({state:{phase:'down',hoist:0},shown:[false,false,false]});
});

test('the working jib has its own camber and disappears from the rig when furled',async({page})=>{
 await page.clock.install();
 await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
 await (await introOption(page,'#introBoat')).selectOption('yacht');
 await page.click('#startButton');
 const data=await page.evaluate(()=>{
  const {scene,env}=SAILING_GAME,P=SailPhysics;
  const field={...env,speed:8,direction:0,gusts:0,shelter:false,waveHeight:0,chop:0};
  const s=TackSimulation.createBoat('yacht',{x:0,y:-5000,theta:10*P.DEG,
   boom:-28*P.DEG,cruiserRig:{jibSheet:.38}},field);
  s.rig={...s.rig,sideBlend:-1};
  P.refresh(s,field);
  const standing={angle:s.sail.jib.angle,camber:scene.jibFoilerRow(.52,s).camber,mainSide:s.rig.sideBlend};
  s.spinnaker={...s.spinnaker,type:'gennaker',hoist:1,fill:.85};
  P.refresh(s,field);
  scene.updateYachtBoat(s,field);
  const lines=[scene.jibEdge,...scene.jibSheets,...scene.telltales.filter(t=>t.jib).map(t=>t.line)];
  const furled={area:s.sail.jib.area,drive:s.sail.jib.drive,mesh:scene.jibMesh.visible,
   lines:lines.map(line=>line.visible),stay:scene.forestay.visible,extra:scene.gennakerMesh.visible};
  s.spinnaker.hoist=s.spinnaker.fill=0;
  P.refresh(s,field);
  scene.updateYachtBoat(s,field);
  return {standing,furled,restored:scene.jibMesh.visible&&lines.every(line=>line.visible)};
 });
 expect(data.standing.mainSide).toBe(-1);
 expect(data.standing.angle).toBeGreaterThan(.12);
 expect(data.standing.camber).toBeGreaterThan(0);
 expect(data.furled).toMatchObject({area:0,drive:0,mesh:false,stay:true,extra:true});
 expect(data.furled.lines).not.toContain(true);
 expect(data.restored).toBe(true);
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
  await operateExtraSail(page,button);
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
  await operateExtraSail(page,button);
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
  await operateExtraSail(page,button);
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
  await operateExtraSail(page,button);
  await page.clock.runFor(4800);
  const after=await page.evaluate(()=>({phase:SAILING_GAME.state.spinnaker.phase,
   hoist:SAILING_GAME.state.spinnaker.hoist,jib:SAILING_GAME.state.sail.jib?.area}));
  expect(after).toEqual({phase:'down',hoist:0,jib:32});
 }
});
test('Gennaker and four crew are synchronised between two live browser clients',async({browser})=>{
 test.setTimeout(60000);const services=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33122'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34122'},stdio:['ignore','pipe','inherit']})];await Promise.all(services.map(p=>new Promise((resolve,reject)=>{p.stdout.once('data',resolve);p.once('error',reject)})));const cs=[],errors=[];
 try{for(let i=0;i<2;i++){const c=await browser.newContext();cs.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33122');await p.goto(process.env.TACK_URL||'http://127.0.0.1:34122');await p.waitForFunction(()=>window.SAILING_GAME);if(i)await (await introOption(p, '#introBoat')).selectOption('yacht');await (await introOption(p, '#introLobby')).click();await p.fill('#lobbyName',i?'Gæst':'Vært');if(i){await p.fill('#lobbyCodeInput',await cs[0].pages()[0].locator('#lobbyCode').innerText());await p.click('#lobbyJoin')}else await p.click('#lobbyCreate');await expect(p.locator('#lobbyRoom')).toBeVisible();}const h=cs[0].pages()[0],g=cs[1].pages()[0];await h.click('#lobbySail');await g.waitForFunction(()=>FriVindLobby.fleet.synced);const id=await g.evaluate(()=>FriVindLobby.fleet.id);
 await operateExtraSail(g,'#gennakerButton');
 await g.keyboard.press('3');
 await expect.poll(()=>h.evaluate(id=>{
  const fleet=FriVindLobby.fleet,state=fleet.boats.get(id),actor=fleet.actors.get(id);
  if(!state)return null;
  return {type:state.spinnaker?.type,hoisted:state.spinnaker?.hoist>.2,
   rig:Number.isFinite(state.rig?.camber)&&Number.isFinite(state.rig?.sideBlend)&&Number.isFinite(state.sail?.main?.camber),
   pose:state.crewPose,blend:state.crewPoseBlend>2.8,
   members:SailingBoats.crewPoseAt(state).members?.length,
   visible:actor?.gennakerMesh?.visible,extraCrew:actor?.racingCrew?.length};
 },id),{timeout:20000}).toEqual({type:'gennaker',hoisted:true,rig:true,pose:3,blend:true,members:4,visible:true,extraCrew:3});
 const sync=await h.evaluate(id=>{
  const fleet=FriVindLobby.fleet,actor=fleet.actors.get(id);
  const {members}=SailingBoats.crewPoseAt(fleet.boats.get(id));
  return [actor.person,...actor.racingCrew.map(c=>c.person)].map((person,i)=>
   Math.hypot(person.head.position.x-members[i].head.x,person.head.position.z-members[i].head.z));
 },id);
 expect(sync.every(v=>v<.08)).toBe(true);
 await operateExtraSail(g,'#gennakerButton');
 await g.click('#telemetryToggle');
 await g.locator('#rigControls summary').click();
 await g.selectOption('#reefSetting','2');
 await g.selectOption('#headsailSetting','1');
 await g.waitForFunction(()=>SAILING_GAME.state.spinnaker?.hoist===0);
 await g.keyboard.press('Escape');
 await chooseSail(g,'jib');
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
