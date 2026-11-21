const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('cruiser spinnaker builds force smoothly and furls the jib',async({page})=>{
 test.setTimeout(90000);await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{const P=SailPhysics,env={...SAILING_GAME.env,boatId:'yacht',speed:7,direction:0,waves:0,gusts:0,crewPose:2};
 function voyage(spinnaker){const s=P.createState({boatId:'yacht',theta:-Math.PI/2,vx:0,vy:-2,sheet:.42},env),samples=[];for(let i=0;i<1200;i++){P.step(s,{steer:0,trim:0,crewPose:2,spinnaker},env,1/60);if(i%60===59)samples.push({t:s.time,speed:Math.hypot(s.vx,s.vy),hoist:s.spinnaker?.hoist,fill:s.spinnaker?.fill,drive:s.sail?.spinnaker?.drive||0,jib:s.sail?.jib?.drive,heel:s.heel})}return samples}
 return {normal:voyage(false),spin:voyage(true)};});
 const end=result.spin.at(-1),baseline=result.normal.at(-1);console.log('SPIN',JSON.stringify({baseline:baseline.speed,withSpinnaker:end.speed,fill:end.fill,drive:end.drive,jib:end.jib}));expect(end.hoist).toBeGreaterThan(.95);expect(end.fill).toBeGreaterThan(.3);expect(end.drive).toBeGreaterThan(100);expect(Math.abs(end.jib)).toBeLessThan(.01);expect(end.speed).toBeGreaterThan(baseline.speed);expect(result.spin.every(x=>Number.isFinite(x.speed)&&Number.isFinite(x.heel))).toBe(true);
});
test('spinnaker button animates the actual sail and retracts it',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);await (await introOption(page, '#introBoat')).selectOption('yacht');await page.click('#startButton');await expect(page.locator('#spinnakerButton')).toHaveText('Sæt spiler');await page.click('#spinnakerButton');await expect(page.locator('#spinnakerButton')).toHaveText('Tag spiler ned');await page.waitForFunction(()=>SAILING_GAME.state.spinnaker?.hoist>.2);expect(await page.evaluate(()=>SAILING_GAME.scene.spinnakerMesh.visible)).toBe(true);await page.click('#spinnakerButton');await page.waitForFunction(()=>SAILING_GAME.state.spinnaker?.phase==='down',{timeout:15000});await expect(page.locator('#spinnakerButton')).toHaveText('Sæt spiler');
});
test('catamaran uses one wing area and a separate jib',async({page})=>{await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);const r=await page.evaluate(()=>{const e={...SAILING_GAME.env,boatId:'ac72',speed:8},s=SailPhysics.createState({boatId:'ac72'},e),a=SailPhysics.aero(s,e);return{area:SailingBoats.get('ac72').sailArea,main:a.main?.area,jib:a.jib?.area,flap:s.wing?.flap}});expect(r.main+r.jib).toBe(r.area);expect(r.jib).toBeGreaterThan(0)});
test('both gybes move the spinnaker side gradually and assistance lowers it after sailing too high',async({page})=>{
 test.setTimeout(90000);await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const runs=await page.evaluate(()=>{const P=SailPhysics,e={...SAILING_GAME.env,boatId:'yacht',speed:7,direction:0,waves:0,gusts:0,difficulty:'easy'};return [-1,1].map(dir=>{const theta=-Math.PI/2+dir*.4,s=P.createState({boatId:'yacht',theta,vx:2*Math.cos(theta),vy:2*Math.sin(theta),sheet:.42},e),points=[];for(let i=0;i<1800;i++){P.step(s,{steer:i<480?0:dir,steerDigital:true,trim:0,crewPose:2,spinnaker:true},e,1/60);if(i%6===0)points.push({t:s.time,awa:s.wind.awa,side:s.spinnaker.sideBlend,fill:s.spinnaker.fill,phase:s.spinnaker.phase,hoist:s.spinnaker.hoist,waitingFor:s.spinnaker.waitingFor,speed:Math.hypot(s.vx,s.vy),drive:s.sail.spinnaker?.drive||0,capsized:s.capsized})}return points})});
 for(const points of runs){const before=points.find(x=>x.t>7.9),after=points.find(x=>x.t>14.9);expect(before.side*after.side).toBeLessThan(0);expect(after.phase).toBe('up');expect(after.fill).toBeGreaterThan(.5);expect(points.filter(x=>x.t<15).every(x=>!x.capsized)).toBe(true);expect(Math.max(...points.slice(1).map((x,i)=>Math.abs(x.side-points[i].side)))).toBeLessThan(.2);expect(points.at(-1)).toMatchObject({phase:'waiting',hoist:0,waitingFor:'course'});expect(points.at(-1).drive).toBeLessThan(1);}
});

test('rounding up keeps the sail flogging on hard and douses it on easy',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 const results=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG,boatId='yacht';
  return ['code0','gennaker','spinnaker'].flatMap(type=>['hard','easy'].map(difficulty=>{
   const env={...P.DEFAULT_ENV,boatId,speed:8,direction:0,waves:0,gusts:0,shelter:false,ironsHelp:false,difficulty};
   const theta=(type==='code0'?0:type==='gennaker'?-35:-65)*D,sheet=SailingBoats.cruiserSails[type].sheet;
   const s=P.createState({boatId,x:0,y:-5000,theta,vx:2*Math.cos(theta),vy:2*Math.sin(theta),sheet},env);
   function steerTo(target,seconds){
    for(let i=0;i<seconds*60;i++){
     const steer=P.clamp(-2.5*P.wrap(target-s.theta)+1.2*s.omega,-1,1);
     P.step(s,{steer,steerDigital:false,crewPose:2,spinnaker:true,downwindType:type},env,1/60);
    }
    return {...s.spinnaker,speed:s.speed,drive:s.sail.spinnaker?.drive??0,capsized:s.capsized,awa:s.wind.awa/D};
   }
   const filled=steerTo(theta,11),windward=steerTo(46*D,26),filledAgain=steerTo(theta,32);
   return {type,difficulty,filled,windward,filledAgain};
  }));
 });
 for(const {type,difficulty,filled,windward,filledAgain} of results){
  const label=type+' '+difficulty;
  expect(filled,label).toMatchObject({hoist:1,capsized:false});
  expect(filled.drive,label).toBeGreaterThan(200);
  expect(filled.flutter,label).toBeLessThan(.06);
  expect(filledAgain,label).toMatchObject({type,hoist:1,capsized:false});
  expect(filledAgain.drive,label).toBeGreaterThan(200);
  expect(Math.abs(windward.awa),label).toBeLessThan(Math.abs(filled.awa)-5);
  if(difficulty==='hard'){
   expect(windward,label).toMatchObject({type,phase:'up',hoist:1,capsized:false});
   expect(windward.luff,label).toBeGreaterThan(Math.max(.6,filled.luff+.25));
   expect(windward.flutter,label).toBeGreaterThan(filled.flutter*2);
   expect(windward.fill,label).toBeLessThan(filled.fill*.4);
   expect(windward.drive,label).toBeLessThan(0);
   expect(windward.speed,label).toBeLessThan(filled.speed*.55);
  }else{
   expect(windward,label).toMatchObject({phase:'waiting',hoist:0,waitingFor:'course',capsized:false,flutter:0});
  }
 }
});
