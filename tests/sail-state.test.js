const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');const path=require('node:path');
const {introOption,chooseSail}=require('../scripts/browser-setup.cjs');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});

test('the dock reef setting changes the reference geometry and sail loads on all boats',async({page})=>{
 test.setTimeout(90000);
 await page.clock.install();
 const expected={
  laser:[[7.06,0],[5.9304,0],[4.8008,0]],
  dinghy:[[35,20],[27.3,20],[19.6,20]],
  yacht:[[48,32],[37.44,32],[26.88,32]],
  ac75:[[165,65],[130.35,50.7],[95.7,36.4]],
  ac72:[[205,55],[205,42.9],[205,30.8]]
 };
 for(const [boat,areas] of Object.entries(expected)){
  await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
  await (await introOption(page,'#introBoat')).selectOption(boat);
  await page.click('#startButton');
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+150));
  await page.evaluate(()=>{
   const {state,env}=SAILING_GAME;
   Object.assign(env,{speed:0,gusts:0,waveHeight:0,chop:0,shelter:false});
   state.windClimate={speed:0,direction:0,gusts:0};
  });
  let previous;
  for(const level of [0,1,2,0]){
   await page.selectOption('#reefSetting',String(level));
   await page.clock.runFor(4100);
   const row=await page.evaluate(()=>{
    const {scene,state,env}=SAILING_GAME,P=SailPhysics;
    const flat={...state,boom:0,boomRate:0,rig:{sideBlend:0},wing:{angle:0,flap:0,twist:0},
     sail:{main:{...state.sail.main,twist:0},jib:{...state.sail.jib,angle:0,twist:0}}};
    // Integrate flat chord widths over height without twist, camber or flutter.
    function planform(point){
     let area=0,lastWidth=0,lastY=0;
     for(let i=0;i<=512;i++){
      const luff=point(0,i/512),leech=point(1,i/512);
      const width=Math.hypot(leech.x-luff.x,leech.z-luff.z);
      if(i>0)area+=(width+lastWidth)*.5*(luff.y-lastY);
      lastWidth=width;lastY=luff.y;
     }
     return area;
    }
    const mainPoint=scene.isCat?scene.wingPoint:scene.isYacht||scene.isFoiler?scene.mainFoilerPoint:scene.sailPoint;
    const main=planform((u,v)=>mainPoint.call(scene,u,v,flat));
    const jib=state.sail.jib?planform((u,v)=>scene.jibFoilerPoint(u,v,flat)):0;

    // Hold motion, immersion, wind and trim fixed to isolate the reef's loads.
    const model=P.configFor(state),sample=P.createState({boatId:state.boatId,x:0,y:-1500,theta:0,vx:0,vy:0,boom:.52},env);
    Object.assign(sample,{heave:0,cruiserRig:state.cruiserRig,rig:{side:1,sideBlend:1,reef:state.rig?.reef,camber:model.camber,twist:0,fill:1}});
    if(model.rigidWing)sample.wing={flap:-.12*(1-.78*(state.rig.reef??0)),jibAngle:.32,twist:0};
    const loads=P.aero(sample,env,{vx:0,vy:9,speed:9});
    const previewScale=id=>{
     const matrix=new DOMMatrix(getComputedStyle(document.getElementById(id)).transform);
     return [matrix.a,matrix.d];
    };
    return {main,jib,physics:[state.sail.main.area,state.sail.jib?.area??0],
     moment:Math.abs(loads.rollMoment),weight:state.hydro.weight,sheet:state.sheet,
     preview:{main:previewScale('reefPreviewMain'),jib:previewScale('reefPreviewJib'),
      area:parseFloat(document.getElementById('reefArea').textContent.replace(',','.')),
      wing:document.getElementById('reefPreview').classList.contains('reef-wing')}};
   });
   expect(row.physics[0],boat).toBeCloseTo(areas[level][0],6);
   expect(row.physics[1],boat).toBeCloseTo(areas[level][1],6);
   expect(row.main,boat).toBeCloseTo(row.physics[0],3);
   expect(row.jib,boat).toBeCloseTo(row.physics[1],3);
   expect(row.preview.area,boat).toBeCloseTo(row.physics[0]+row.physics[1],boat==='laser'?1:0);
   expect(row.preview.wing,boat).toBe(boat==='ac72');
   const [[mainWidth,mainHeight],[jibWidth,jibHeight]]=[row.preview.main,row.preview.jib];
   expect(mainWidth*mainHeight,boat).toBeCloseTo(areas[level][0]/areas[0][0],2);
   if(areas[0][1])expect(jibWidth*jibHeight,boat).toBeCloseTo(areas[level][1]/areas[0][1],2);
   if(previous){
    if(level>0)expect(row.moment,boat).toBeLessThan(previous.moment);
    expect(row.sheet,boat).toBe(previous.sheet);
    expect(row.weight,boat).toBeCloseTo(previous.weight,7);
   }
   previous=row;
  }
  await page.clock.resume();
 }
});

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
 await page.clock.install();await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);await page.click('#startButton');await page.clock.runFor(1000);await page.locator('#sea').focus();await page.keyboard.press('Space');await page.clock.runFor(100);
 const before=await page.evaluate(()=>({time:SAILING_GAME.state.time,rig:SAILING_GAME.state.rig,vertices:Array.from(SAILING_GAME.scene.sailMesh.geometry.attributes.position.array.slice(0,24))}));await page.clock.runFor(2000);const after=await page.evaluate(()=>({time:SAILING_GAME.state.time,rig:SAILING_GAME.state.rig,vertices:Array.from(SAILING_GAME.scene.sailMesh.geometry.attributes.position.array.slice(0,24))}));expect(after).toEqual(before);
});
test('tack and gybe change rig side smoothly while crew remains on the old side',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const runs=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG;
  return [{name:'tack',start:49,end:-49,sheet:.70},{name:'gybe',start:155,end:-145,sheet:.38}].map(scenario=>{
   const heading=(90-scenario.start)*D,target=(90-scenario.end)*D;
   const env={...P.DEFAULT_ENV,boatId:'laser',difficulty:'hard',speed:8,shelter:false,waves:0,gusts:0,autoBalance:false};
   const s=P.createState({x:0,y:-5000,theta:heading,sheet:scenario.sheet,vx:3.6*Math.cos(heading),vy:3.6*Math.sin(heading),
    crewPose:2,crewPoseBlend:2,crewSide:-1,crewSideBlend:-1},env);
   let previous=null,delta=0,min=2,max=-2;
   for(let i=0;i<480&&!s.capsized;i++){
    const err=P.wrap((i<120?heading:target)-s.theta);
    P.step(s,{steer:P.clamp(-2.1*err+1.12*s.omega,-.80,.80),steerDigital:false,trim:0,crewPose:2,crew:-1},env,1/60);
    const v=s.rig.sideBlend;
    min=Math.min(min,v);max=Math.max(max,v);
    if(previous!==null)delta=Math.max(delta,Math.abs(v-previous));
    previous=v;
   }
   return {name:scenario.name,tacks:s.tackCount,gybes:s.gybeCount,min,max,delta,crew:s.crewSideBlend,capsized:s.capsized};
  });
 });
 for(const r of runs){
  expect(r.min,r.name).toBeLessThan(-.9);
  expect(r.max,r.name).toBeGreaterThan(.9);
  expect(r.delta,r.name).toBeLessThan(.05);
  expect(r.crew,r.name).toBe(-1);
 }
 expect(runs[0].tacks).toBe(1);
 expect(runs[1].gybes).toBe(1);
});
test('gust loading updates the same cloth shape and foil rigs count each area once',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{const P=SailPhysics,e={...SAILING_GAME.env,boatId:'laser',speed:4,gusts:0,waves:0},s=P.createState({x:0,y:-5000,boatId:'laser',theta:0,vx:0,vy:0,boom:.5,boomRate:0},e),c=SailingBoats.get('laser');for(let i=0;i<120;i++){s.sail=P.aero(s,e);P.updateRig(s,c,1/60)}const before=P.aero(s,e);e.speed=9;for(let i=0;i<120;i++){s.sail=P.aero(s,e);P.updateRig(s,c,1/60)}const after=P.aero(s,e);return{before:{force:Math.hypot(before.drive,before.sideForce),camber:before.main.camber},after:{force:Math.hypot(after.drive,after.sideForce),camber:after.main.camber},foils:['ac75','ac72'].map(id=>{const env={...e,boatId:id},boat=P.createState({boatId:id,x:0,y:-5000},env),config=SailingBoats.get(id),a=P.aero(boat,env);return{id,rigid:!!config.rigidWing,main:a.main.area,jib:a.jib.area,configured:config.sailArea,labels:a.accumulator.items.map(x=>x.label)};})};});
 expect(r.after.force).toBeGreaterThan(r.before.force*2);expect(Math.abs(r.after.camber-r.before.camber)).toBeGreaterThan(.00001);for(const f of r.foils){expect(f.main+f.jib).toBeCloseTo(f.configured,6);expect(f.labels.filter(x=>x==='main')).toHaveLength(1);expect(f.labels.filter(x=>x==='jib')).toHaveLength(1);}expect(r.foils[0].rigid).toBe(false);expect(r.foils[1].rigid).toBe(true);
});
test('cloth depth follows pressure across a fixed boom on both tacks',async({page})=>{
 await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME?.scene?.sailMesh);
 const phases=await page.evaluate(()=>{
  const {scene}=SAILING_GAME,P=SailPhysics,model=SailingBoats.get('laser');
  const env={...P.DEFAULT_ENV,boatId:'laser',speed:0,gusts:0,shelter:false,waves:0};
  const s=P.createState({boatId:'laser',x:0,y:-5000,theta:0,vx:0,vy:0,boom:0,boomRate:0,heel:0,pitch:0,omega:0,heelRate:0,pitchRate:0,heaveVelocity:0},env);
  function advance(windY,steps){
   for(let i=0;i<steps;i++){
    s.sail=P.aero(s,env,{vx:0,vy:windY});
    P.updateRig(s,model,1/60);
   }
   scene.updateSailGrid(scene.sailMesh,s,false);
   const row=scene.laserSailRow(.5,s),v=scene.sailMesh.geometry.attributes.position;
   const onLuff=(scene.sailRows/2)*(scene.sailCols+1),panel=onLuff+.4*scene.sailCols;
   return {depth:(v.getX(panel)-row.base.x)*row.sin+(v.getZ(panel)-row.base.z)*row.cos,
    pressure:s.sail.main.pressurePa,lower:s.rig.mainDraft,upper:s.rig.headDraft,
    luffError:Math.hypot(v.getX(onLuff)-row.base.x,v.getY(onLuff)-row.base.y,v.getZ(onLuff)-row.base.z),
    clew:[v.getX(scene.sailCols),v.getY(scene.sailCols),v.getZ(scene.sailCols)]};
  }
  return [advance(0,240),advance(8,1),advance(8,180),advance(-8,1),advance(-8,180),advance(0,240)];
 });
 const [calm,gust,loaded,reversing,opposite,relaxed]=phases;
 console.log('Laser cloth, signed depth in metres:',phases.map(p=>+p.depth.toFixed(4)));
 expect(Math.abs(calm.depth)).toBeLessThan(.001);
 expect(Math.abs(loaded.depth)).toBeGreaterThan(.07);
 expect(Math.abs(gust.lower)).toBeGreaterThan(Math.abs(gust.upper));
 expect(Math.abs(gust.depth)).toBeLessThan(Math.abs(loaded.depth));
 expect(reversing.pressure*loaded.pressure).toBeLessThan(0);
 expect(reversing.depth*loaded.depth).toBeGreaterThan(0);
 expect(opposite.depth*loaded.depth).toBeLessThan(0);
 for(const phase of [loaded,opposite])expect(phase.depth*phase.pressure).toBeGreaterThan(0);
 expect(Math.abs(relaxed.depth)).toBeLessThan(.001);
 for(const phase of phases){
  expect(phase.luffError).toBeLessThan(.00001);
  for(let i=0;i<3;i++)expect(phase.clew[i]).toBeCloseTo(calm.clew[i],6);
 }
});
test('rig evolution is independent of rendering frame rate',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const runs=await page.evaluate(()=>[30,60,120].map(fps=>{const e={...SAILING_GAME.env,boatId:'laser',speed:6,direction:0,gusts:.2,waves:.12},s=SailPhysics.createState({x:0,y:-5000,boatId:'laser'},e);let acc=0;for(let frame=0;frame<fps*8;frame++){acc+=1/fps;while(acc+1e-12>=1/60){SailPhysics.step(s,{steer:s.time<2?.2:0,trim:s.time<2?.3:0,crewPose:2},e,1/60);acc-=1/60}}return{x:s.x,y:s.y,boom:s.boom,camber:s.rig.camber,twist:s.rig.twist,fill:s.rig.fill,side:s.rig.sideBlend};}));for(const r of runs.slice(1))for(const key of Object.keys(r))expect(r[key]).toBeCloseTo(runs[0][key],8);
});

test('a wind shift across the stern moves the boom and loads the sheet on hard',async({page})=>{
 await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
 const results=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG;
  function run(boatId,difficulty,trim=.15,crewPose=boatId==='laser'?1:2){
   const env={...P.DEFAULT_ENV,boatId,difficulty,direction:5,speed:10,waves:0,gusts:0,shelter:false,ironsHelp:false,autoBalance:false};
   const s=P.createState({boatId,theta:-Math.PI/2,x:0,y:-5000,vx:0,vy:-1.8,boom:P.boomLimit(trim,boatId),sheet:trim,crewPose,crewSide:-1},env);
   const step=()=>P.step(s,{steer:0,trim:0,crewPose},env,1/60);
   for(let i=0;i<42;i++)step();
   const before=s.boom,was=s.gybeCount;
   env.direction=344;env.speed=12;
   let shock=0,flutter=0,jibFlutter=0,peakRoll=0,reaction=0,peakYaw=0,across=0;
   for(let i=0;i<198;i++){
    step();
    across=Math.min(across,s.boom);
    shock=Math.max(shock,s.rig.gybeImpact);
    flutter=Math.max(flutter,s.rig.flutter);
    jibFlutter=Math.max(jibFlutter,s.rig.jibFlutter??0);
    peakRoll=Math.max(peakRoll,Math.abs(s.heelRate)/D);
    peakYaw=Math.max(peakYaw,Math.abs(s.omega)/D);
    reaction=Math.max(reaction,Math.abs(s.forces.boomReaction));
   }
   return {before,across,shock,flutter,jibFlutter,peakRoll,peakYaw,reaction,gybes:s.gybeCount-was,capsized:s.capsized};
  }
  return {soft:['laser','dinghy','yacht','ac75'].map(boat=>({boat,easy:run(boat,'easy'),hard:run(boat,'hard')})),
   sheeted:run('yacht','hard',.92),wing:run('ac72','hard'),laserOnEdge:run('laser','hard',.15,2)};
 });
 for(const {boat,easy,hard} of results.soft){
  expect(easy.shock,boat).toBe(0);
  expect(hard.capsized,boat).toBe(false);
  expect(hard.gybes,boat).toBeGreaterThan(0);
  expect(hard.before,boat).toBeGreaterThan(.9);
  expect(hard.across,boat).toBeLessThan(-.9);
  expect(hard.flutter,boat).toBeGreaterThan(.05);
  expect(hard.shock,boat).toBeGreaterThan(.35);
  expect(hard.reaction,boat).toBeGreaterThan(50);
  expect(hard.peakRoll,boat).toBeGreaterThan(5);
  expect(hard.peakYaw,boat).toBeGreaterThan(1);
 }
 expect(results.laserOnEdge).toMatchObject({capsized:true});
 expect(results.laserOnEdge.gybes).toBeGreaterThan(0);
 expect(results.sheeted.shock).toBe(0);
 expect(results.wing).toMatchObject({shock:0,capsized:false,flutter:0});
 expect(results.wing.reaction).toBeGreaterThan(0); // The rotating rigid wing carries angular momentum.
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

for(const boat of ['dinghy','ac75','ac72']){
 test(boat+' has an independent working jib trim in the sail plan',async({page})=>{
  await page.clock.install();
  await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
  await (await introOption(page,'#introBoat')).selectOption(boat);
  await page.click('#startButton');
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
  await page.evaluate(()=>{
   const {state,env}=SAILING_GAME;
   Object.assign(env,{waveHeight:0,chop:0,gusts:0,shelter:false});
   state.windClimate={speed:7,direction:220,gusts:0};
   env.speed=7;env.direction=220;
  });
  await page.clock.runFor(180);
  const initial=await page.evaluate(()=>SAILING_GAME.state.sheet);
  await chooseSail(page,'jib');
  expect(await page.evaluate(()=>{
   const {state}=SAILING_GAME;
   return state.rig?.jibSheet??state.cruiserRig?.jibSheet??null;
  })).toBeNull();
  const adjust=async value=>{
   await page.locator('#sheetControl').evaluate((slider,v)=>{
    slider.value=v;slider.dispatchEvent(new Event('input',{bubbles:true}));
   },value);
   await page.clock.runFor(4500);
   return page.evaluate(()=>{
    const {state:s}=SAILING_GAME;
    return {jib:s.sail.jib.trim,main:s.sheet,angle:s.sail.jib.angle,area:s.sail.jib.area,drive:s.sail.jib.drive,
      foil:s.rig?.jibSheet,soft:s.cruiserRig?.jibSheet};
   });
  };
  const hauled=await adjust(100),eased=await adjust(0);
  expect(hauled.jib).toBeCloseTo(1,4);
  expect(eased.jib).toBeCloseTo(0,4);
  expect(eased.main).toBeCloseTo(initial,4);
  expect(eased.area).toBe(hauled.area);
  expect(Math.abs(eased.angle-hauled.angle)).toBeGreaterThan(.2);
  await expect(page.locator('#sheetValue')).toHaveText('0,0 %');
 });
}
