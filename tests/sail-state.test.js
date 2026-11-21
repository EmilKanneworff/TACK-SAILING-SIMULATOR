const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('local air, quadratic force, calm water and mirrored tacks',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{const P=SailPhysics,e={...SAILING_GAME.env,boatId:'laser',speed:0,gusts:0,waves:0,direction:0},s=P.createState({boatId:'laser',x:0,y:-5000,theta:0,vx:0,vy:0,boom:.5,boomRate:0,heel:0,pitch:0,omega:0,heelRate:0,pitchRate:0,heaveVelocity:0},e);
 const calm=P.aero(s,e);s.vx=3;const moving=P.aero(s,e);s.vx=0;const q=[3,6].map(v=>P.aero(s,e,{vx:0,vy:-v}));
 s.boom=.5;const one=P.aero(s,e,{vx:0,vy:-5});s.boom=-.5;const two=P.aero(s,e,{vx:0,vy:5});
 s.boom=0;s.omega=.5;const rotation=P.sailAirAt(s,e,{x:2,y:2,z:0},{vx:0,vy:0});s.omega=0;s.vy=-2;const following=P.windForState(s,{...e,speed:5});s.vy=0;const stopped=P.windForState(s,{...e,speed:5});
 return {calm:{drive:calm.drive,side:calm.sideForce},moving:{fx:moving.fx,fy:moving.fy,power:moving.fx*3},q:q.map(v=>({drive:v.drive,side:v.sideForce})),one:{drive:one.drive,side:one.sideForce},two:{drive:two.drive,side:two.sideForce},rotation,following:following.aws,stopped:stopped.aws};});
 expect(Math.hypot(r.calm.drive,r.calm.side)).toBeLessThan(1e-8);expect(r.moving.power).toBeLessThan(0);expect(r.q[1].drive/r.q[0].drive).toBeCloseTo(4,6);expect(r.q[1].side/r.q[0].side).toBeCloseTo(4,6);
 expect(r.one.drive).toBeCloseTo(r.two.drive,6);expect(r.one.side).toBeCloseTo(-r.two.side,6);expect(r.rotation.y).toBeCloseTo(-1,6);expect(r.following).toBeCloseTo(3,6);expect(r.stopped).toBeCloseTo(5,6);
});
test('rig shape feeds the calculated section forces and crew side is independent',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{const P=SailPhysics,e={...SAILING_GAME.env,boatId:'laser',speed:5,gusts:0,waves:0},s=P.createState({boatId:'laser',x:0,y:-5000,theta:0,vx:0,vy:0,boom:.5,boomRate:0,crewPose:3,crewSideBlend:-1},e),c=SailingBoats.get('laser');s.rig={side:1,camber:c.camber*.8,twist:.04,fill:1};const a=P.aero(s,e);s.rig.camber=c.camber*1.1;const b=P.aero(s,e);P.updateRig(s,c,1/60);return {a:a.main,b:b.main,crew:s.crewSideBlend,rigSide:s.rig.side,torques:[P.sheetTorque({boom:.1,boomRate:0},.5,c),P.sheetTorque({boom:.6,boomRate:.2},.5,c),P.sheetTorque({boom:-.6,boomRate:-.2},.5,c)]};});
 expect(r.a.sections).toHaveLength(3);expect(r.b.camber).toBeGreaterThan(r.a.camber);expect(Math.abs(r.b.drive-r.a.drive)+Math.abs(r.b.sideForce-r.a.sideForce)).toBeGreaterThan(.1);expect(r.crew).toBe(-1);expect(r.rigSide).toBe(1);expect(r.torques[0]).toBe(0);expect(r.torques[1]).toBeLessThan(0);expect(r.torques[2]).toBeGreaterThan(0);
});
test('pause freezes both the rig state and the sail mesh',async({page})=>{
 await page.clock.install();await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);await page.click('#startButton');await page.clock.runFor(1000);await page.keyboard.press('Space');await page.clock.runFor(100);
 const before=await page.evaluate(()=>({time:SAILING_GAME.state.time,rig:SAILING_GAME.state.rig,vertices:Array.from(SAILING_GAME.scene.sailMesh.geometry.attributes.position.array.slice(0,24))}));await page.clock.runFor(2000);const after=await page.evaluate(()=>({time:SAILING_GAME.state.time,rig:SAILING_GAME.state.rig,vertices:Array.from(SAILING_GAME.scene.sailMesh.geometry.attributes.position.array.slice(0,24))}));expect(after).toEqual(before);
});
test('tack and gybe change rig side smoothly while crew remains on the old side',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const runs=await page.evaluate(()=>[{name:'tack',theta:.7,steer:-1},{name:'gybe',theta:-1.05,steer:1}].map(({name,theta,steer})=>{const e={...SAILING_GAME.env,boatId:'laser',speed:6,direction:0,gusts:0,waves:.12},s=SailPhysics.createState({x:0,y:-5000,theta,vx:2*Math.cos(theta),vy:2*Math.sin(theta),crewPose:3,crewSideBlend:-1},e);let previous=null,delta=0,min=2,max=-2;for(let i=0;i<420;i++){SailPhysics.step(s,{steer:i<250?steer:0,trim:0,crewPose:3},e,1/60);const v=s.rig.sideBlend;min=Math.min(min,v);max=Math.max(max,v);if(previous!==null)delta=Math.max(delta,Math.abs(v-previous));previous=v;}return {name,tacks:s.tackCount,gybes:s.gybeCount,min,max,delta,crew:s.crewSideBlend};}));
 for(const r of runs){expect(r.min).toBeLessThan(-.9);expect(r.max).toBeGreaterThan(.9);expect(r.delta).toBeLessThan(.05);expect(r.crew).toBe(-1);}expect(runs[0].tacks).toBeGreaterThan(0);expect(runs[1].gybes).toBeGreaterThan(0);
});
test('gust loading updates the same cloth shape and foil rigs count each area once',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{const P=SailPhysics,e={...SAILING_GAME.env,boatId:'laser',speed:4,gusts:0,waves:0},s=P.createState({x:0,y:-5000,boatId:'laser',theta:0,vx:0,vy:0,boom:.5,boomRate:0},e),c=SailingBoats.get('laser');for(let i=0;i<120;i++){s.sail=P.aero(s,e);P.updateRig(s,c,1/60)}const before=P.aero(s,e);e.speed=9;for(let i=0;i<120;i++){s.sail=P.aero(s,e);P.updateRig(s,c,1/60)}const after=P.aero(s,e);return{before:{force:Math.hypot(before.drive,before.sideForce),camber:before.main.camber},after:{force:Math.hypot(after.drive,after.sideForce),camber:after.main.camber},foils:['ac75','ac72'].map(id=>{const env={...e,boatId:id},boat=P.createState({boatId:id,x:0,y:-5000},env),config=SailingBoats.get(id),a=P.aero(boat,env);return{id,rigid:!!config.rigidWing,main:a.main.area,jib:a.jib.area,configured:config.sailArea,labels:a.accumulator.items.map(x=>x.label)};})};});
 expect(r.after.force).toBeGreaterThan(r.before.force*2);expect(Math.abs(r.after.camber-r.before.camber)).toBeGreaterThan(.00001);for(const f of r.foils){expect(f.main+f.jib).toBeCloseTo(f.configured,6);expect(f.labels.filter(x=>x==='main')).toHaveLength(1);expect(f.labels.filter(x=>x==='jib')).toHaveLength(1);}expect(r.foils[0].rigid).toBe(false);expect(r.foils[1].rigid).toBe(true);
});
test('rig evolution is independent of rendering frame rate',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const runs=await page.evaluate(()=>[30,60,120].map(fps=>{const e={...SAILING_GAME.env,boatId:'laser',speed:6,direction:0,gusts:.2,waves:.12},s=SailPhysics.createState({x:0,y:-5000,boatId:'laser'},e);let acc=0;for(let frame=0;frame<fps*8;frame++){acc+=1/fps;while(acc+1e-12>=1/60){SailPhysics.step(s,{steer:s.time<2?.2:0,trim:s.time<2?.3:0,crewPose:2},e,1/60);acc-=1/60}}return{x:s.x,y:s.y,boom:s.boom,camber:s.rig.camber,twist:s.rig.twist,fill:s.rig.fill,side:s.rig.sideBlend};}));for(const r of runs.slice(1))for(const key of Object.keys(r))expect(r[key]).toBeCloseTo(runs[0][key],8);
});

test('a wind shift across the stern moves the boom and loads the sheet on hard',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 const results=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG;
  function run(boatId,difficulty,trim=.15){
   const env={...P.DEFAULT_ENV,boatId,difficulty,direction:5,speed:10,waves:0,gusts:0,shelter:false,ironsHelp:false,autoBalance:false};
   const s=P.createState({boatId,theta:-Math.PI/2,x:0,y:-5000,vx:0,vy:-1.8,boom:P.boomLimit(trim,boatId),sheet:trim},env);
   const step=()=>P.step(s,{steer:0,trim:0,crewPose:2},env,1/60);
   for(let i=0;i<42;i++)step();
   const before=s.boom,was=s.gybeCount;
   env.direction=354;env.speed=12;
   let shock=0,flutter=0,jibFlutter=0,peakRoll=0,reaction=0,peakYaw=0;
   for(let i=0;i<198;i++){
    step();
    shock=Math.max(shock,s.rig.gybeImpact);
    flutter=Math.max(flutter,s.rig.flutter);
    jibFlutter=Math.max(jibFlutter,s.rig.jibFlutter??0);
    peakRoll=Math.max(peakRoll,Math.abs(s.heelRate)/D);
    peakYaw=Math.max(peakYaw,Math.abs(s.omega)/D);
    reaction=Math.max(reaction,Math.abs(s.forces.boomReaction));
   }
   return {before,after:s.boom,shock,flutter,jibFlutter,peakRoll,peakYaw,reaction,gybes:s.gybeCount-was,capsized:s.capsized};
  }
  return {soft:['laser','dinghy','yacht','ac75'].map(boat=>({boat,easy:run(boat,'easy'),hard:run(boat,'hard')})),
   sheeted:run('yacht','hard',.92),wing:run('ac72','hard')};
 });
 for(const {boat,easy,hard} of results.soft){
  expect(easy.gybes,boat).toBe(0);
  expect(easy.shock,boat).toBe(0);
  expect(hard,boat).toMatchObject({gybes:1,capsized:false});
  expect(hard.before,boat).toBeGreaterThan(.9);
  expect(hard.after,boat).toBeLessThan(-.9);
  expect(hard.flutter,boat).toBeGreaterThan(.05);
  expect(hard.shock,boat).toBeGreaterThan(.35);
  expect(hard.reaction,boat).toBeGreaterThan(50);
  expect(hard.peakRoll,boat).toBeGreaterThan(easy.peakRoll+5);
  expect(hard.peakYaw,boat).toBeGreaterThan(easy.peakYaw+.2);
 }
 expect(results.sheeted.shock).toBe(0);
 expect(results.wing).toMatchObject({shock:0,reaction:0,capsized:false,flutter:0});
 expect(results.wing.jibFlutter).toBeGreaterThan(0);
});

test('loaded sail cloth stays quiet and only the luffing sail develops larger edge movement',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 const rows=await page.evaluate(()=>{
  const {scene}=SAILING_GAME,P=SailPhysics;
  return SailingBoats.LIST.map(model=>{
   scene.buildBoat(model.id);
   const main={load:.70,luff:.22,stall:.32},jib={load:.65,luff:.16,stall:.24};
   const s={boatId:model.id,boom:.52,sheet:.58,sail:{wind:{aws:8},main,...(model.jibArea?{jib}:{})}};
   const settle=()=>{for(let i=0;i<120;i++)P.updateRig(s,model,1/60,true);};
   const movement=(isJib,u)=>{
    const point=()=>model.id==='laser'?scene.sailPoint(u,.53,s):isJib?scene.jibFoilerPoint(u,.53,s):scene.mainFoilerPoint(u,.53,s);
    s.rig.flutterPhase=.53*9-(isJib?1.9:0)+Math.PI/2;
    const from=point();
    s.rig.flutterPhase+=Math.PI;
    return from.distanceTo(point());
   };
   settle();
   const steady={main:s.rig.flutter,jib:s.rig.jibFlutter,edge:movement(model.rigidWing,.92)};
   main.luff=.99;
   settle();
   const mainLoose={main:s.rig.flutter,jib:s.rig.jibFlutter,edge:movement(false,.92),mid:movement(false,.45)};
   jib.luff=.99;
   settle();
   return {id:model.id,wing:!!model.rigidWing,steady,mainLoose,jibLoose:s.rig.jibFlutter};
  });
 });
 for(const row of rows){
  const label=JSON.stringify(row);
  expect(row.steady.edge,label).toBeLessThan(.025);
  if(row.wing)expect(row.mainLoose.main,label).toBe(0);
  else {
   expect(row.mainLoose.edge,label).toBeGreaterThan(.04);
   expect(row.mainLoose.edge,label).toBeLessThan(.23);
   expect(row.mainLoose.mid,label).toBeLessThan(row.mainLoose.edge*.35);
  }
  if(row.steady.jib!==undefined){
   expect(row.mainLoose.jib,label).toBeCloseTo(row.steady.jib,5);
   expect(row.jibLoose,label).toBeGreaterThan(row.steady.jib*8);
  }
 }
});
