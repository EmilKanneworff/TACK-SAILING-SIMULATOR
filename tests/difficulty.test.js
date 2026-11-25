'use strict';
const {test,expect}=require('@playwright/test');
const {resolve}=require('node:path');
const {pathToFileURL}=require('node:url');

test.use({launchOptions:{executablePath:process.env.CHROME_PATH||
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
const game=process.env.TACK_URL||pathToFileURL(resolve('index.html')).href;

async function setUpLaserTack(page,side,{speed=9,difficulty='hard'}={}){
 await page.clock.install();
 await page.goto(game);
 await page.selectOption('#introDifficulty',difficulty);
 await page.click('#startButton');
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+500));
 await page.evaluate(({side,speed})=>{
  const P=SailPhysics,{env,state}=SAILING_GAME;
  Object.assign(env,{speed,direction:0,waveHeight:.35,gusts:0,shelter:false});
  const theta=(90+49*side)*P.DEG;
  Object.assign(state,P.createState({boatId:'laser',x:0,y:-1475,theta,sheet:.73,
   vx:3*Math.cos(theta),vy:3*Math.sin(theta),crew:side,crewPose:3},env));
  if(speed===0)state.windClimate={speed,direction:0,gusts:0};
  SailingWeather.initialize(state,env);
  const sheet=document.getElementById('sheetControl');
  sheet.value='73';
  sheet.dispatchEvent(new Event('input',{bubbles:true}));
  document.getElementById('sea').focus({preventScroll:true});
 },{side,speed});
}

test('Z and X keep the selected fore-and-aft weight after release',async({page})=>{
 await setUpLaserTack(page,-1,{speed:0});
 const offset=()=>page.evaluate(()=>SAILING_GAME.state.crewForeAft);
 const target=page.locator('#foreAftSetting');
 await page.keyboard.press('z');
 await page.clock.runFor(1600);
 await expect(target).toHaveValue('-50');
 expect(await offset()).toBeCloseTo(-.5,2);
 await expect(page.locator('#dockForeAft')).toHaveText(/2[12] cm agter/);
 await page.keyboard.down('x');
 await page.clock.runFor(900);
 await page.keyboard.up('x');
 const selected=Number(await target.inputValue())/100;
 expect(selected).toBeGreaterThan(.65);
 expect(selected).toBeLessThan(.95);
 await page.clock.runFor(1600);
 const settled=await offset();
 // The slider rounds to whole percentages while the simulation keeps the exact target.
 expect(Math.abs(settled-selected)).toBeLessThan(.01);
 await page.clock.runFor(500);
 expect(await offset()).toBeCloseTo(settled,3);
 await expect(page.locator('#dockForeAft')).toContainText('cm frem');
 await expect(target).toHaveValue(String(Math.round(selected*100)));
});

test('difficulty is remembered and switching to hard restores the manual weight controls',async({page})=>{
 await page.setViewportSize({width:390,height:744});
 await page.goto(game);
 await expect(page.locator('#introDifficulty')).toHaveValue('hard');
 await page.selectOption('#introDifficulty','easy');
 await page.reload();
 await expect(page.locator('#introDifficulty')).toHaveValue('easy');
 await page.click('#startButton');
 await page.waitForFunction(()=>SAILING_GAME.state.crewDifficulty==='easy');
 await expect(page.locator('#pose3')).toBeHidden();
 await expect(page.locator('#crewPoseLabel')).toHaveText('Automatisk balance');
 await page.keyboard.press('3');
 expect(await page.evaluate(()=>SAILING_GAME.env.crewPose)).toBe(2);
 await page.click('#preferencesButton');
 await expect(page.locator('#difficulty')).toHaveValue('easy');
 await page.selectOption('#difficulty','hard');
 await page.keyboard.press('Escape');
 await expect(page.locator('#pose3')).toBeVisible();
 await page.keyboard.press('3');
 await page.waitForFunction(()=>SAILING_GAME.state.crewDifficulty==='hard'&&SAILING_GAME.state.crewPose===3);
});

test('Laser on hard responds to side taps, short helm inputs and controlled easing',async({page})=>{
 await setUpLaserTack(page,-1,{speed:0});
 await page.keyboard.press('KeyE');
 await page.clock.runFor(1100);
 expect(await page.evaluate(()=>SAILING_GAME.state.crewSideBlend)).toBeGreaterThan(.85);
 await page.keyboard.press('KeyQ');
 await page.clock.runFor(1100);
 expect(await page.evaluate(()=>SAILING_GAME.state.crewSideBlend)).toBeLessThan(-.85);
 await page.keyboard.press('1');
 await page.clock.runFor(500);
 expect(await page.evaluate(()=>SAILING_GAME.state.crewPoseBlend)).toBeLessThan(1.1);
 const before=await page.evaluate(()=>({theta:SAILING_GAME.state.theta,sheet:SAILING_GAME.state.sheet,time:SAILING_GAME.state.time}));
 await page.keyboard.down('ArrowRight');
 await page.keyboard.down('ArrowDown');
 await page.clock.runFor(320);
 const rudder=await page.evaluate(()=>SAILING_GAME.state.rudder/SailPhysics.DEG);
 await page.keyboard.up('ArrowDown');
 await page.keyboard.up('ArrowRight');
 const after=await page.evaluate(({theta,time})=>{const s=SAILING_GAME.state;return {
  turn:SailPhysics.wrap(theta-s.theta)/SailPhysics.DEG,sheet:s.sheet,elapsed:s.time-time,capsized:s.capsized
 };},before);
 expect(after.capsized).toBe(false);
 expect(rudder).toBeGreaterThan(3);
 expect(Number.isFinite(after.turn)).toBe(true);
 expect(before.sheet-after.sheet).toBeGreaterThan(.025);
 expect(before.sheet-after.sheet).toBeLessThan(.075);
});

test('Laser on hard keeps the manually selected side in calm water when 1–3 change the stance',async({page})=>{
 await setUpLaserTack(page,-1,{speed:0});
 await page.keyboard.press('1');
 await page.keyboard.press('KeyE');
 const sample=()=>page.evaluate(()=>({pose:SAILING_GAME.state.crewPoseBlend,side:SAILING_GAME.state.crewSideBlend}));
 await page.clock.runFor(1100);
 expect((await sample()).side).toBeGreaterThan(.98);
 await expect(page.locator('#pose1')).toHaveAttribute('aria-pressed','true');
 for(const position of [2,3,1]){
  await page.keyboard.press(String(position));
  await page.clock.runFor(1250);
  const state=await sample();
  expect(state.pose).toBeCloseTo(position,2);
  expect(state.side).toBeGreaterThan(.98);
 }
});

test('Laser in free sailing reports its live balance while manual trim and stance remain in control',async({page})=>{
 await page.clock.install();
 const response=await page.goto(game);
 const revision=await response?.headerValue('x-fri-vind-revision');
 if(revision)await expect(page.locator('meta[name="fri-vind-revision"]')).toHaveAttribute('content',revision);
 await page.selectOption('#introDifficulty','hard');
 await page.click('#startButton');
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+400));
 await page.evaluate(()=>{
  const {state,env}=SAILING_GAME;
  Object.assign(env,{speed:8.5,direction:0,gusts:0,waveHeight:0,chop:0,shelter:false});
  Object.assign(state,SailPhysics.createState({boatId:'laser',x:0,y:-5000,theta:0,vx:3.4,vy:0,
   sheet:.45,crewPose:2,crewSide:-1},env));
  state.windClimate={speed:8.5,direction:0,gusts:0};
  SailingWeather.initialize(state,env);
  const sheet=document.getElementById('sheetControl');
  sheet.value='45';sheet.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.keyboard.press('Backquote');
 await page.keyboard.press('3');
 await page.clock.runFor(1100);
 const sample=()=>page.evaluate(()=>{
  const {state,scene}=SAILING_GAME;
  return {speed:state.speed,pose:state.crewPose,actual:state.crewPoseBlend,side:state.crewSide,
   visible:scene.visibleCrewPose.degree,drive:state.sail.drive,sheet:state.sheet,capsized:state.capsized};
 });
 const before=await sample();
 expect(before).toMatchObject({pose:3,side:-1,capsized:false});
 expect(before.actual).toBeGreaterThan(2.99);
 expect(before.visible).toBeCloseTo(before.actual,2);
 expect(before.speed).toBeGreaterThan(3.4);
 await expect(page.locator('#debugValues')).toContainText('BALANCE OM TYNGDEPUNKTET');
 await page.keyboard.down('ArrowDown');
 await page.clock.runFor(280);
 await page.keyboard.up('ArrowDown');
 const eased=await sample();
 expect(eased.pose).toBe(3);
 expect(eased.side).toBe(-1);
 expect(eased.sheet).toBeLessThan(before.sheet-.2);
 expect(eased.drive).toBeLessThan(before.drive);
});

for(const from of [-1,1]){
 test(`Hard accepts both sides with all stances on the ${from<0?'port':'starboard'} tack`,async({page})=>{
  await setUpLaserTack(page,from,{speed:7.5});
  const read=()=>page.evaluate(()=>{
   const {state}=SAILING_GAME;
   return {side:state.crewSide,pose:state.crewPose,blend:state.crewSideBlend};
  });
  for(const side of [-from,from]){
   await page.keyboard.press(side<0?'KeyQ':'KeyE');
   await page.clock.runFor(60);
   expect((await read()).side).toBe(side);
   for(const pose of [1,3,2]){
    await page.keyboard.press(String(pose));
    await page.clock.runFor(70);
    expect(await read()).toMatchObject({side,pose});
   }
  }
 });
}

for(const from of [-1,1]){
 test(`Laser on hard crosses with an explicit side command at the wind eye from ${from<0?'port':'starboard'}`,async({page})=>{
  await setUpLaserTack(page,from,{speed:7.5});
  const read=()=>page.evaluate(()=>{
   const {state,scene}=SAILING_GAME;
   return {angle:state.wind.twa/SailPhysics.DEG,side:state.crewSide,pose:state.crewPose,
    blend:state.crewSideBlend,shown:scene.visibleCrewPose?.side,massSide:state.crewCG.z,
    capsized:state.capsized};
  });
  await page.keyboard.press('3');
  await page.clock.runFor(2200);
  await page.keyboard.press('1');
  const key=from<0?'ArrowLeft':'ArrowRight';
  await page.keyboard.down(key);
  let atPress=await read();
  for(let n=0;n<70&&atPress.angle*from>4;n++){
   await page.clock.runFor(55);
   atPress=await read();
  }
  expect(atPress.angle*from).toBeGreaterThanOrEqual(0);
  expect(atPress.angle*from).toBeLessThanOrEqual(4);
  expect(atPress).toMatchObject({side:from,pose:1,capsized:false});
  await page.keyboard.press('2');
  await page.clock.runFor(50);
  expect(await read()).toMatchObject({side:from,pose:2,capsized:false});
  await page.keyboard.press(from<0?'KeyE':'KeyQ');
  await page.clock.runFor(50);
  expect(await read()).toMatchObject({side:-from,pose:2,capsized:false});
  await page.keyboard.press('2');
  let end=await read();
  for(let n=0;n<55&&end.angle*-from<36;n++){
   await page.clock.runFor(90);
   end=await read();
  }
  await page.keyboard.up(key);
  expect(end.angle*-from).toBeGreaterThanOrEqual(36);
  await page.clock.runFor(850);
  end=await read();
  expect(end).toMatchObject({side:-from,pose:2,capsized:false});
  expect(end.blend*-from).toBeGreaterThan(.95);
  expect(end.shown*-from).toBeGreaterThan(.9);
  expect(end.massSide*-from).toBeGreaterThan(.2);
  if(process.env.TACK_TRACE)console.log('Stagvending',JSON.stringify({from,atPress,end}));
 });
}

for(const [difficulty,from] of [['easy',-1],['easy',1],['hard',-1],['hard',1]]){
 test(`Laser on ${difficulty} tacks from ${from<0?'port':'starboard'} with the selected balance mode`,async({page})=>{
  await setUpLaserTack(page,from,{difficulty});
  const read=()=>page.evaluate(()=>{
   const {state,scene}=SAILING_GAME;
   return {heading:state.theta/SailPhysics.DEG,side:state.crewSide,blend:state.crewSideBlend,
    visible:scene.visibleCrewPose?.side,duck:state.crewDuck,heel:state.heel,capsized:state.capsized||state.recovering,pose:state.crewPose,
    wind:state.wind.awa,boom:state.boom};
  });
  await page.keyboard.press('3');
  await page.clock.runFor(2900);
  expect((await read()).side).toBe(from);
  const key=from<0?'ArrowLeft':'ArrowRight';
  await page.keyboard.press('1');
  await page.keyboard.down(key);
  await page.clock.runFor(333);
  await page.keyboard.press('3');
  const trace=[];
  let held=true;
  for(let i=0;i<56;i++){
   await page.clock.runFor(125);
   const row=await read();
   trace.push(row);
   if(held&&(row.heading-90)*-from>40){
    await page.keyboard.up(key);
    held=false;
   }
   if(row.capsized)break;
  }
  if(held)await page.keyboard.up(key);
  const last=trace.at(-1);
  expect(trace.some(row=>row.wind*-from>.1&&row.boom*from>.1),JSON.stringify(last)).toBe(true);
  if(difficulty==='easy'){
   expect(trace.every(row=>!row.capsized),JSON.stringify(last)).toBe(true);
   expect(trace.some(row=>row.duck>.8&&Math.abs(row.blend)<.45)).toBe(true);
   expect(last.side).toBe(-from);
   expect(last.visible*-from).toBeGreaterThan(.85);
  }else{
   const beforeCapsize=trace.filter(row=>!row.capsized);
   expect(beforeCapsize.every(row=>row.side===from&&row.blend*from>.99&&row.pose===3)).toBe(true);
   expect(last.capsized,JSON.stringify(last)).toBe(true);
  }
 });
}

test.describe('touch controls',()=>{
 test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
 test('Hard touch input selects both sides and keeps the chosen stance',async({page})=>{
  await setUpLaserTack(page,-1,{speed:7.5});
  await page.locator('#mobileCrewToggle').tap();
  await expect(page.locator('#crewStarboard')).toBeEnabled();
  await expect(page.locator('#crewPort')).toBeEnabled();
  await page.locator('#crewStarboard').tap();
  await page.clock.runFor(350);
  await expect(page.locator('#crewStarboard')).toHaveAttribute('aria-pressed','true');
  await page.locator('#crewPort').tap();
  await page.clock.runFor(350);
  await expect(page.locator('#crewPort')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>SAILING_GAME.state.crewSide)).toBe(-1);
 });
});

test('the easy crew crosses to the new windward side on all five boats',async({page})=>{
 await page.goto(game);
 const results=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG;
  return SailingBoats.LIST.map(({id:boatId})=>{
   const env={...P.DEFAULT_ENV,boatId,difficulty:'easy',speed:8.5,direction:0,waves:0,gusts:0,shelter:false};
   const state=P.createState({boatId,x:0,y:-5000,theta:32*D,sheet:.73},env);
   const step=(heading,steer)=>{
    state.theta=heading*D;
    state.vx=2.7*Math.cos(state.theta);state.vy=2.7*Math.sin(state.theta);
    P.updateCrew(state,{steer},env,1/60,{wind:P.windForState(state,env)});
   };
   for(let i=0;i<120;i++)step(32,0);
   const before=state.crewSideBlend;
   let crossedAt=null,switchedAt=null;
   for(let i=0;i<180;i++){
    const heading=Math.min(148,32+116*i/90);
    step(heading,i<90?-.70:0);
    if(crossedAt===null&&heading>90)crossedAt=i/60;
    if(crossedAt!==null&&switchedAt===null&&state.crewSideBlend>.8)switchedAt=i/60;
   }
   return {boatId,before,after:state.crewSideBlend,crossedAt,switchedAt};
  });
 });
 for(const r of results){
  const evidence=JSON.stringify(r);
  expect(r.before,evidence).toBeLessThan(-.8);
  expect(r.switchedAt,evidence).not.toBeNull();
  expect(r.switchedAt-r.crossedAt,evidence).toBeLessThan(1.25);
  expect(r.after,evidence).toBeGreaterThan(.8);
 }
});

test('strong wind leaves the helm and sheet under the player’s control on both difficulties',async({page})=>{
 await page.goto(game);
 const results=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG;
  return SailingBoats.LIST.flatMap(c=>['easy','hard'].map(difficulty=>{
   const env={...P.DEFAULT_ENV,boatId:c.id,difficulty,speed:20,direction:0,waves:0,gusts:0,shelter:false,autoRecovery:false};
   const sheet=.70,state=P.createState({boatId:c.id,x:0,y:-13000,theta:22*D,sheet,vx:2.7*Math.cos(22*D),vy:2.7*Math.sin(22*D),omega:.30},env);
   state.heel=Math.sign(state.sail.rollMoment)*26*D;
   state.heelRate=Math.sign(state.sail.rollMoment)*.24;
   let autoRudder=0,extraMoment=0,extraSheet=0,boomOverrun=0,maxPose=0,wingTrimError=0;
   for(let i=0;i<36;i++){
    P.step(state,{steer:0,trim:0},env,1/60);
    autoRudder=Math.max(autoRudder,Math.abs(state.rudder));
    extraMoment=Math.max(extraMoment,Math.abs(state.forces.yawAssist));
    extraSheet=Math.max(extraSheet,Math.abs(sheet-state.sheet));
    boomOverrun=Math.max(boomOverrun,Math.abs(state.boom)-P.boomLimit(state.sheet,c));
    maxPose=Math.max(maxPose,state.crewPoseBlend);
   }
   if(c.rigidWing)wingTrimError=Math.abs(Math.abs(state.wing.flap)-c.wingFlapMax*(.25+.75*sheet));
   P.step(state,{steer:.65,trim:-1,trimFast:true},env,1/60);
   return {id:c.id,difficulty,autoRudder,extraMoment,extraSheet,boomOverrun:boomOverrun/D,maxPose,wingTrimError,
    reef:state.rig.reef??0,manualRudder:Math.abs(state.rudder),sheet:state.sheet,
    expectedSheet:sheet-P.sheetRateFor(c,-1,true,difficulty)/60,ironAssist:state.helmAssist.active};
  }));
 });
 for(const r of results){
  const evidence=JSON.stringify(r);
  expect(r,evidence).toMatchObject({autoRudder:0,extraMoment:0,extraSheet:0,reef:0,ironAssist:false});
  expect(r.boomOverrun,evidence).toBeLessThanOrEqual(5.00001);
  expect(r.wingTrimError,evidence).toBeLessThan(.001);
  expect(r.manualRudder,evidence).toBeGreaterThan(.01);
  expect(r.sheet,evidence).toBeCloseTo(r.expectedSheet,8);
 }
 expect(results.find(r=>r.id==='laser'&&r.difficulty==='easy').maxPose).toBeGreaterThan(2.5);
});

test('Laser debug shows the rendered rudder, water heights and submerged force points together',async({page})=>{
 await setUpLaserTack(page,-1,{speed:7.5});
 await page.keyboard.press('Backquote');
 await page.keyboard.down('ArrowRight');
 await page.clock.runFor(450);
 await page.keyboard.up('ArrowRight');
 const contact=await page.evaluate(()=>{
  const {scene}=SAILING_GAME,group=scene.rudderDebug,trace=group.userData.contact;
  const shape=SailingBoats.laserRudderOutline(scene.model.waterBlades.rudder);
  const meshPoint=scene.rudder.localToWorld(new THREE.Vector3(shape[0].x,shape[0].y-scene.rudder.position.y,0));
  const {x,y,z}=trace.outline[0];
  const difference=meshPoint.distanceTo(new THREE.Vector3(x,z,-y));
  const [outline,segments,all,submerged,water]=scene.rudderDebugLayers.map(layer=>layer.geometry.drawRange.count);
  const wet=trace.sections.filter(section=>section.wetArea>0);
  return {visible:group.visible,outline,segments,all,submerged,water,correctContact:submerged===wet.length,difference};
 });
 expect(contact).toMatchObject({visible:true,outline:11,segments:8,all:4,water:4,correctContact:true});
 expect(contact.submerged).toBeGreaterThan(0);
 expect(contact.difference).toBeLessThan(.0001);
 if(process.env.TACK_RUDDER_IMAGE){
  await page.evaluate(()=>{
   const {scene}=SAILING_GAME,point=scene.rudder.getWorldPosition(new THREE.Vector3());
   const side=scene.hull.localToWorld(new THREE.Vector3(-3.6,1.1,1.6));
   scene.camera.position.copy(side);scene.camera.lookAt(point.x+.3,point.y+.14,point.z);
   scene.camera.updateMatrixWorld();scene.render();
  });
  await page.locator('#sea').screenshot({path:process.env.TACK_RUDDER_IMAGE});
 }
 await page.keyboard.press('Backquote');
 await page.clock.runFor(70);
 expect(await page.evaluate(()=>SAILING_GAME.scene.rudderDebug.visible)).toBe(false);
});
