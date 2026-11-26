'use strict';
const {dragMap}=require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});

test('solo sliders preserve exact values and hold the simulated weather until resume',async({page})=>{
 await page.clock.install();await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.click('#startButton');await page.clock.runFor(500);await page.locator('#sea').focus();await page.keyboard.press('Space');await page.click('#settingsButton');
 const read=()=>page.evaluate(()=>{const g=SAILING_GAME;return {t:g.state.time,sea:g.state.seaState,sheet:g.state.sheet,
  steer:g.state.steerIntent,env:{...g.env},actual:SailingSettings.live(g.env,g.state),
  rain:g.state.atmosphere.rain,clouds:g.state.atmosphere.clouds,fog:g.state.atmosphere.fog,warmth:g.state.atmosphere.sunWarmth};});
 const before=await read();
 await expect(page.locator('#weatherControls input[type=range]')).toHaveCount(9);
 for(const [id,value,label] of [['waveHeight','0.45','0,45 m'],['chop','0.64','64 %'],['windGusts','0.23','23 %'],['cloudCover','0.37','37 %'],
  ['rainLevel','0.20','20 %'],['fogLevel','0.10','10 %'],['eveningLight','0.40','40 %']]){
  await page.locator('#'+id).fill(value);
  await expect(page.locator('#'+id+'Value')).toHaveText(label);
 }
 await page.locator('#windSpeed').fill('6.2');
 await page.locator('#windDirection').fill('215');
 await expect(page.locator('#windDirectionValue')).toHaveText('SV · 215°');
 await page.locator('#windSpeed').press('ArrowUp');
 await expect(page.locator('#windSpeedValue')).toHaveText('6,3 m/s');
 await page.clock.runFor(500);
 const paused=await read();
 expect(paused.t).toBe(before.t);expect(paused.sheet).toBe(before.sheet);expect(paused.steer).toBe(before.steer);
 expect(paused.env).toMatchObject({speed:6.3,direction:215,gusts:.23,waveHeight:.45,chop:.64,clouds:.37,rain:.20,fog:.10,daylight:.40});
 expect(paused.actual.speed).toBe(before.actual.speed);
 await expect(page.locator('#liveWindLabel')).toHaveText('Ved båden før ændring');
 await page.keyboard.press('Escape');
 await expect(page.locator('#settingsButton')).toBeFocused();
 await page.click('#resumeButton');
 await page.clock.runFor(2300);
 const after=await read();
 expect(after.sea).toBeGreaterThan(before.sea+.06);
 expect(after.actual.speed).toBeGreaterThan(before.actual.speed);
 for(const key of ['rain','clouds','fog','warmth'])expect(after[key]).toBeGreaterThan(before[key]);
 await page.click('#cameraButton');await dragMap(page,160,100);await page.click('#settingsButton');
 await expect(page.locator('#liveWindLabel')).toHaveText('Vind ved båden');
 await page.locator('#rainLevel').fill('0.21');
 await expect(page.locator('#waveHeight')).toHaveValue('0.45');
 await expect(page.locator('#chop')).toHaveValue('0.64');
 await page.keyboard.press('Escape');
 await page.reload();await page.click('#startButton');await page.click('#settingsButton');
 await expect(page.locator('#waveHeight')).toHaveValue('0.45');
 await expect(page.locator('#windSpeedValue')).toHaveText('6,3 m/s');
 await expect(page.locator('#cloudCover')).toHaveValue('0.37');
 await expect(page.locator('#windGusts')).toHaveValue('0.23');
 await expect(page.locator('#rainLevel')).toHaveValue('0.21');
 expect((await read()).env).not.toHaveProperty('sea');
});

test('weather release preserves a manual race pause',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.click('#introCourse');await page.keyboard.press('Space');
 await page.click('#settingsButton');
 const time=await page.evaluate(()=>[SAILING_GAME.state.time,SAILING_GAME.course.countdown]);
 await page.locator('#waveHeight').fill('0');
 await page.keyboard.press('Escape');await page.waitForTimeout(300);
 expect(await page.evaluate(()=>[SAILING_GAME.state.time,SAILING_GAME.course.countdown])).toEqual(time);
 await expect(page.locator('#resumeButton')).toBeVisible();
});

test('equivalent legacy weather retains best race time at its exact height',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const best=await page.evaluate(()=>{
  const env={...SAILING_GAME.env,waveHeight:.35,daylight:0};
  const {chop,...settings}=new SailingCourse(env,'course').settings;
  const legacy=Object.fromEntries(Object.entries(settings).map(([name,value])=>
   name==='waveHeight'?['sea','small']:[name,name==='daylight'?'day':value]));
  const key='frivind-v12:'+JSON.stringify(legacy);
  localStorage.setItem(key,'75');
  return [new SailingCourse(env,'course').best,new SailingCourse({...env,waveHeight:.45},'course').best];
 });
 expect(best).toEqual([75,null]);
});

test('native ranges update during drag and keep north at either end',async({page})=>{
 await page.setViewportSize({width:1366,height:950});
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.click('#startButton');
 await page.click('#settingsButton');
 for(const slider of await page.locator('#weatherControls input[type=range]').all()){
  const min=Number(await slider.getAttribute('min')),max=Number(await slider.getAttribute('max'));
  const id=await slider.getAttribute('id'),output=page.locator('#'+id+'Value');
  await slider.press('Home');
  expect(Number(await slider.inputValue())).toBe(min);
  const box=await slider.boundingBox(),y=box.y+box.height/2;
  await page.mouse.move(box.x+11,y);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.4,y,{steps:8});
  const intermediate=Number(await slider.inputValue());
  expect(intermediate).toBeGreaterThan(min);
  expect(intermediate).toBeLessThan(max);
  expect(await output.textContent()).not.toBe('');
  const selected=await slider.evaluate(input=>SAILING_GAME.env[input.dataset.weatherKey]);
  expect(selected).toBe(intermediate);
  await page.mouse.move(box.x+box.width-2,y);
  expect(Number(await slider.inputValue())).toBe(max);
  await page.mouse.up();
 }
 const direction=page.locator('#windDirection');
 await expect(direction).toHaveValue('360');
 await expect(page.locator('#windDirectionValue')).toHaveText('N · 360°');
 expect(await page.evaluate(()=>SAILING_GAME.env.direction)).toBe(0);
 await direction.press('ArrowLeft');
 await expect(direction).toHaveValue('359');
 await direction.press('Home');
 await expect(direction).toHaveValue('0');
 expect(await page.evaluate(()=>SAILING_GAME.env.direction)).toBe(0);
});

test('weather labels and slider tracks reflow without overlap',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.click('#startButton');
 await page.click('#settingsButton');
 for(const [width,height,textScale] of [[1366,900,1],[390,844,1],[320,570,2]]){
  await page.setViewportSize({width,height});
  await page.evaluate(scale=>{document.documentElement.style.fontSize=100*scale+'%';},textScale);
  const issues=await page.evaluate(()=>{
   const panel=document.querySelector('#settings'),close=panel.querySelector('.close');
   panel.scrollTop=panel.scrollHeight;
   const bounds=panel.getBoundingClientRect(),button=close.getBoundingClientRect();
   const rows=[...panel.querySelectorAll('.weather-range')].map(row=>{
    const read=selector=>row.querySelector(selector).getBoundingClientRect();
    return {label:read('label'),value:read('output'),track:read('input'),row:row.getBoundingClientRect()};
   });
   const compass=[...panel.querySelectorAll('.weather-compass span')].map(mark=>mark.getBoundingClientRect().x);
   return {overflow:panel.scrollWidth-panel.clientWidth,close:document.elementFromPoint(button.x+button.width/2,button.y+button.height/2)===close,
    rows:rows.every(({label,value,track,row})=>label.right+5<value.left&&track.top>=Math.max(label.bottom,value.bottom)-.25&&Math.abs(track.width-row.width)<.25&&row.right<=bounds.right),
    compass:compass.every((x,i)=>Math.abs(x-(compass[0]+(compass[4]-compass[0])*i/4))<1)};
  });
  expect(issues,JSON.stringify({width,textScale})).toEqual({overflow:0,close:true,rows:true,compass:true});
 }
});
test('rising and falling sea contribute to the wave vertical velocity',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);const r=await page.evaluate(()=>{const e={...SAILING_GAME.env,shelter:false,waveCurrent:.45,waveCurrentRate:.12},t=3.2,dt=.00001,a=SailPhysics.waveAt(20,30,t,e),b=SailPhysics.waveAt(20,30,t+dt,{...e,waveCurrent:e.waveCurrent+e.waveCurrentRate*dt}),still=SailPhysics.waveAt(20,30,t,{...e,waveCurrentRate:0});return {a,dt:(b.height-a.height)/dt,still}});expect(r.a.velocity).toBeCloseTo(r.dt,4);expect(r.a.waterVz).toBeCloseTo(r.a.velocity,6);expect(Math.abs(r.a.velocity-r.still.velocity)).toBeGreaterThan(.001);
});
test('crew plants one foot at a time during a side transfer and keeps the physical pelvis',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const scene=SAILING_GAME.scene;
  const sample=(side,sideRate)=>{
   const body=SailingBoats.crewPose('laser',2,side),source=JSON.stringify(body);
   const pose=scene.animatedCrewPose(body,{time:1.3,crewSideBlend:side,crewSideVelocity:sideRate,crewPoseVelocity:.2,heelRate:.2});
   return {lifts:pose.feet.map((foot,index)=>foot.y-body.feet[index].y),
    pelvis:JSON.stringify(body.pelvis)===JSON.stringify(pose.pelvis),
    original:JSON.stringify(body)===source,head:Math.hypot(pose.head.x-body.head.x,pose.head.y-body.head.y,pose.head.z-body.head.z),
    release:pose.helmRelease};
  };
  return {first:sample(-.43,.85),second:sample(.33,.85),idle:sample(-1,0)};
 });
 expect(result.first.lifts[0]).toBeGreaterThan(.035);
 expect(result.first.lifts[1]).toBeCloseTo(0,4);
 expect(result.second.lifts[0]).toBeCloseTo(0,4);
 expect(result.second.lifts[1]).toBeGreaterThan(.035);
 expect(result.first.release).toBeGreaterThan(.1);
 expect(result.idle.lifts).toEqual([0,0]);
 expect(result.idle.head).not.toBeCloseTo(0,4);
 expect(Object.values(result).every(sample=>sample.pelvis&&sample.original)).toBe(true);
});

test('overcast weather uses the same sky blend for the visible dome and reflected water',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.click('#startButton');
 await page.click('#settingsButton');
 await page.locator('#cloudCover').fill('0.94');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>SAILING_GAME.scene.sky.material.uniforms.overcastMix.value>.75);
 const result=await page.evaluate(()=>{
  const scene=SAILING_GAME.scene,water=scene.waterUniforms,sky=scene.sky.material.uniforms,maps=scene.surfaceAssets.maps;
  return {domeAndWater:sky.overcastMix===water.overcastMix&&sky.skyOvercast.value===water.skyOvercast.value,
   reflection:scene.scene.environment===maps.overcast,colorSpace:maps.overcast.colorSpace,normalSpace:maps.fabricNormal.colorSpace,
   coast:scene.coast.userData.photographicMaterials,gl:scene.renderer.getContext().getError()};
 });
 expect(result).toEqual({domeAndWater:true,reflection:true,colorSpace:'srgb',normalSpace:'',coast:true,gl:0});
});

test('the wave trial starts offshore with an active cockpit and movable crew', async ({page}) => {
 const url = pathToFileURL(path.resolve('index.html'));
 url.searchParams.set('proeve', 'boelger');
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.goto(url.href);
 await expect(page.locator('#introBoat')).toHaveValue('yacht');
 await page.click('#startButton');
 await page.waitForFunction(() => SAILING_GAME.state.time > .6);
 const before = await page.evaluate(() => {
  const {state,scene} = SAILING_GAME;
  return {sea:state.seaState, depth:-SailingWorld.heightAt(state.x,state.y), camera:scene.cameraMode,
   crew:[scene.person, ...scene.racingCrew.map(member => member.person)].map(person => person.head.position.z)};
 });
 expect(before.depth).toBeGreaterThan(15);
 expect(before.sea).toBeGreaterThan(.9);
 expect(before.camera).toBe(2);
 expect(before.crew).toHaveLength(4);
 await page.keyboard.press('3');
 await page.waitForFunction(() => SAILING_GAME.state.crewPoseBlend > 2.55);
 const after = await page.evaluate(() => {
  const {scene} = SAILING_GAME;
  return [scene.person, ...scene.racingCrew.map(member => member.person)].map(person => person.head.position.z);
 });
 expect(after.every((z,i) => Math.abs(z-before.crew[i]) > .1)).toBe(true);
 await page.click('#preferencesButton');
 await page.keyboard.press('Escape');
 await page.click('#settingsButton');
 await expect(page.locator('#weatherControls')).toBeVisible();
 expect(errors).toEqual([]);
});

test('wind arrows point and travel with local true wind in all four directions',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>SAILING_GAME);
 const directions=await page.evaluate(()=>{
  const P=SailPhysics,{scene,env}=SAILING_GAME;
  scene.quality='low';
  return [0,90,180,270].map((direction,i)=>{
   const e={...env,direction,speed:6,sea:'calm',gusts:0,shelter:false},s=P.createState({boatId:'laser',x:0,y:-5000,time:1,theta:i*.9,vx:9,vy:1},e);
   scene.updateCamera(s,1/60,0,true,e);
   scene.windStrokeTime=null;scene.updateWindStrokes(s,e,true);
   const {position:p,alpha}=scene.windStrokeMesh.geometry.attributes;
   const index=scene.windStrokes.findIndex((stroke,k)=>stroke.shown&&alpha.getX(k*10+6)>.10),tail=index*10,tip=tail+8;
   const dx=(p.getX(tip)+p.getX(tip+1)-p.getX(tail)-p.getX(tail+1))/2;
   const dy=-(p.getZ(tip)+p.getZ(tip+1)-p.getZ(tail)-p.getZ(tail+1))/2;
   const previous={...scene.windStrokes[index]};
   s.time+=.06;s.theta+=.5;scene.updateWindStrokes(s,e,false);
   const next=scene.windStrokes[index],w=P.windAt(previous.x,previous.y,s.time,e);
   const correct=(dx*w.vx+dy*w.vy)/(Math.hypot(dx,dy)*w.speed);
   return {correct,advection:Math.hypot(next.x-previous.x-w.vx*.06,next.y-previous.y-w.vy*.06),lowVisible:scene.windStrokeMesh.visible,count:scene.windStrokeMesh.geometry.drawRange.count};
  });
 });
 for(const a of directions){expect(a.correct).toBeGreaterThan(.999);expect(a.advection).toBeLessThan(.002);expect(a.lowVisible).toBe(true);expect(a.count).toBeLessThanOrEqual(10*24);}
});

test('legacy weather settings migrate once without reintroducing hidden wave controls',async({page})=>{
 await page.addInitScript(()=>{
  if(!localStorage.getItem('fri-vind.settings.v1'))localStorage.setItem('fri-vind.settings.v1',JSON.stringify({
   env:{speed:6.2,direction:215,gusts:.25,weather:'sunset',waveHeight:.36,wavePeriod:11,shortSea:1.8,swellDirection:170},
   personal:{showWind:false,volume:.35,quality:'low'}
  }));
 });
 const url=pathToFileURL(path.resolve('index.html')).href;
 await page.goto(url);await page.click('#startButton');await page.click('#settingsButton');
 await expect(page.locator('#waveHeightValue')).toHaveText('0,36 m');
 await expect(page.locator('#eveningLight')).toHaveValue('1');
 await expect(page.locator('#windSpeed')).toHaveValue('6.2');
 await page.keyboard.press('Escape');await page.click('#preferencesButton');
 await expect(page.locator('#showWind')).toHaveCount(0);await expect(page.locator('#soundSetting')).toHaveValue('35');
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{
  const settings=JSON.parse(localStorage.getItem(SailingSettings.key));
  settings.personal.showWind=false;
  localStorage.setItem(SailingSettings.key,JSON.stringify(settings));
 });
 await page.reload();await page.click('#startButton');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(SailingSettings.key)));
 expect(saved.weather).toMatchObject({waveHeight:.36,daylight:1,gusts:.25});
 for(const old of ['wavePeriod','shortSea','swellDirection','sea','weather'])expect(saved.weather).not.toHaveProperty(old);
 expect(saved.personal).not.toHaveProperty('showWind');
 await page.waitForFunction(()=>SAILING_GAME.scene.quality==='low'&&SAILING_GAME.scene.windStrokeMesh.visible);
 await page.click('#preferencesButton');await page.click('#viewButton');
 await expect(page.locator('#sailingDock')).toBeHidden();
 expect(await page.evaluate(()=>SAILING_GAME.scene.windStrokeMesh.visible)).toBe(true);
 await page.reload();await page.click('#startButton');await page.click('#preferencesButton');
 const arrows=page.locator('#windArrows');
 await expect(arrows).toHaveValue('on');
 await arrows.selectOption('off');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!SAILING_GAME.scene.windStrokeMesh.visible);
 await page.reload();await page.click('#startButton');await page.click('#preferencesButton');
 await expect(arrows).toHaveValue('off');
 await arrows.selectOption('on');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>SAILING_GAME.scene.windStrokeMesh.visible);
});

test('three to ten wind arrows remain on screen and renew in all camera views',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.click('#startButton');
 const results=await page.evaluate(()=>{
  const {scene,env,state}=SAILING_GAME,P=SailPhysics,point=new THREE.Vector3();
  scene.quality='low';
  return [0,1,2,3].flatMap(camera=>[.1,5,20].map(speed=>{
   const e={...env,speed,sea:'calm',gusts:0};
   const s=P.createState({boatId:'laser',x:state.x,y:state.y,theta:state.theta},e);
   scene.updateCamera(s,1/60,camera,true,e);
   scene.camera.updateMatrixWorld();
   const {position,alpha}=scene.windStrokeMesh.geometry.attributes;
   let minimum=Infinity,maximum=0,farFrames=0,renewed=false;
   for(let frame=0;frame<160;frame++){
    s.time=frame*.13;
    scene.updateWindStrokes(s,e,frame===0);
    let visible=0,farther=false;
    for(let i=0;i<scene.windStrokeCount;i++){
     const shoulder=i*10+4;
     if(alpha.getX(shoulder)<.085)continue;
     point.fromBufferAttribute(position,shoulder).project(scene.camera);
     if(Math.abs(point.x)<.94&&Math.abs(point.y)<.94&&Math.abs(point.z)<1){
      visible++;
      farther||=scene.windStrokes[i].band===2&&Math.hypot(scene.windStrokes[i].x-s.x,scene.windStrokes[i].y-s.y)>7;
     }
    }
    minimum=Math.min(visible,minimum);
    maximum=Math.max(visible,maximum);
    farFrames+=Number(farther);
    renewed||=scene.windStrokes.some(stroke=>stroke.cycle>1);
   }
   return {camera,speed,minimum,maximum,farFrames,renewed};
  }));
 });
 for(const result of results){
  expect(result.minimum,JSON.stringify(result)).toBeGreaterThanOrEqual(3);
  expect(result.maximum).toBeLessThanOrEqual(10);
  expect(result.farFrames,JSON.stringify(result)).toBeGreaterThan(120);
  expect(result.renewed,JSON.stringify(result)).toBe(true);
 }
});

test('the Laser sails into coastal shelter and out while arrows advect with local wind',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>SAILING_GAME);
 const observations=await page.evaluate(()=>{
  const {scene,env}=SAILING_GAME,P=SailPhysics,e={...env,waveHeight:0,chop:0,speed:7,direction:0,gusts:0};
  // Cross the wake of Dyreborg's headland on the georeferenced chart.
  const start=ArchipelagoData.fromMetric(-2280,-3060);
  const s=P.createState({boatId:'laser',...start,theta:0,vx:4,vy:0,sheet:.36},e);
  const points=[];
  for(let step=0;step<=2880;step++){
   P.step(s,{steer:0,trim:0,crewPose:2},e,1/60);
   if(![0,1920,2880].includes(step))continue;
   scene.updateCamera(s,1/60,0,true,e);
   scene.updateWindStrokes(s,e,true);
   const index=scene.windStrokes.findIndex(arrow=>arrow.shown),arrow=scene.windStrokes[index],x=arrow.x,y=arrow.y,dt=.06;
   scene.updateWindStrokes({...s,time:s.time+dt},e,false);
   const next=scene.windStrokes[index],local=P.windAt(s.x,s.y,s.time,e);
   const w=P.windAt((x+next.x)/2,(y+next.y)/2,s.time+dt/2,e);
   points.push({wind:local.speed,instrument:s.wind.tws,ground:s.ground.contact,
    arrowSpeed:Math.hypot(next.x-x,next.y-y)/dt,sourceSpeed:w.speed,pointsSouth:next.y<y});
  }
  return points;
 });
 const [open,lee,exit]=observations;
 expect(open.wind-lee.wind).toBeGreaterThan(.56);
 expect(exit.wind-lee.wind).toBeGreaterThan(.4);
 for(const sample of observations){
  expect(sample.arrowSpeed).toBeCloseTo(sample.sourceSpeed,2);
  expect(sample.wind).toBeCloseTo(sample.instrument,4);
  expect(sample.ground).toBe(false);
  expect(sample.pointsSouth).toBe(true);
 }
});

test('wind arrows on the sheltered coast follow the strength and direction of gusts',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>SAILING_GAME);
 const evidence=await page.evaluate(()=>{
  const {scene,env}=SAILING_GAME,P=SailPhysics;
  const weather={...env,speed:8.5,direction:0,gusts:.65,waveHeight:.24,shelter:true};
  // The camera sees both sheltered water east of Dyreborg and the open fjord.
  const start=ArchipelagoData.fromMetric(-1220,-2274.4);
  const s=P.createState({boatId:'laser',...start,theta:-20*P.DEG},weather);
  scene.updateCamera(s,1/60,0,true,weather);
  const {position,alpha}=scene.windStrokeMesh.geometry.attributes;
  let slowest=Infinity,fastest=0,angleShift=0,gustChange=0,maxDriftError=0,minAlignment=1,observations=0,minWater=Infinity;
  const dt=.1;
  for(let frame=0;frame<240;frame++){
   const previous=scene.windStrokes.map(stroke=>({...stroke}));
   s.time=frame*dt;
   scene.updateWindStrokes(s,weather,frame===0);
   for(const [i,stroke] of scene.windStrokes.entries()){
    if(alpha.getX(i*10+6)<.085)continue;
    const w=P.windAt(stroke.x,stroke.y,s.time,weather);
    const start=previous[i];
    if(frame>0&&start.cycle===stroke.cycle&&start.shown){
     const wind=P.windAt((start.x+stroke.x)/2,(start.y+stroke.y)/2,s.time-dt/2,weather);
     maxDriftError=Math.max(maxDriftError,Math.hypot((stroke.x-start.x)/dt-wind.vx,(stroke.y-start.y)/dt-wind.vy));
    }
    const tail=i*10,tip=tail+8;
    const x=(position.getX(tail)+position.getX(tail+1))*.5,y=-(position.getZ(tail)+position.getZ(tail+1))*.5;
    const dx=position.getX(tip)-x,dy=-position.getZ(tip)-y;
    minAlignment=Math.min(minAlignment,(dx*w.vx+dy*w.vy)/(Math.hypot(dx,dy)*w.speed));
    minWater=Math.min(minWater,-SailingWorld.heightAt(x,y),-SailingWorld.heightAt(stroke.x,stroke.y));
    slowest=Math.min(slowest,w.meanSpeed);fastest=Math.max(fastest,w.meanSpeed);
    angleShift=Math.max(angleShift,Math.abs(P.wrap(w.direction*P.DEG))/P.DEG);
    gustChange=Math.max(gustChange,Math.abs(w.speed-w.meanSpeed));
    observations++;
   }
  }
  return {slowest,fastest,angleShift,gustChange,maxDriftError,minAlignment,observations,minWater};
 });
 expect(evidence.observations).toBeGreaterThan(500);
 expect(evidence.slowest).toBeLessThan(3.5);
 expect(evidence.fastest).toBeGreaterThan(6);
 expect(evidence.angleShift).toBeGreaterThan(2);
 expect(evidence.gustChange).toBeGreaterThan(.6);
 expect(evidence.maxDriftError).toBeLessThan(.025);
 expect(evidence.minAlignment).toBeGreaterThan(.999);
 expect(evidence.minWater).toBeGreaterThan(0);
});

test('calm air hides water arrows and reads Vindstille on the instrument',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.click('#startButton');await page.click('#settingsButton');
 await page.locator('#windSpeed').press('Home');
 await expect(page.locator('#windSpeedValue')).toHaveText('0,0 m/s');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!SAILING_GAME.scene.windStrokeMesh.visible);
 await expect(page.locator('#compactWindSpeed')).toHaveText('Vindstille');
 await page.click('#settingsButton');
 await expect(page.locator('#liveWind')).toHaveText('Vindstille');
});
