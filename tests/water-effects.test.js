const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('a still hull makes no wake and a real bow impact produces spray',async({page})=>{
 await page.clock.install();await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);await page.click('#startButton');
 const r=await page.evaluate(()=>{const g=SAILING_GAME,scene=g.scene,s=g.state,env={...g.env,speed:0,waves:0,gusts:0,waveCurrent:0,waveProfile:s.waveProfile};Object.assign(s,{vx:0,vy:0,theta:0,heel:0,pitch:0,heelRate:0,pitchRate:0,heaveVelocity:0,seaState:0,capsized:false});const x=scene.model.length*.38;s.heave=-scene.bottomAt(x,0);scene.updateBoat(s,env,0);scene.scene.updateMatrixWorld(true);scene.updateEffects(s,env,1/60,true);const quiet={spray:scene.spray.length,wake:scene.wakes.length};s.time+=.3;s.heaveVelocity=-1;scene.updateBoat(s,env,0);scene.scene.updateMatrixWorld(true);scene.updateEffects(s,env,1/60,false);return {quiet,after:scene.spray.length,impact:scene.spray.map(p=>p.vh),slam:SailPhysics.hydrostatics(s,env).slamForce};});expect(r.quiet).toEqual({spray:0,wake:0});expect(r.after).toBeGreaterThan(0);expect(r.impact.every(x=>x>0)).toBe(true);expect(r.slam).toBeGreaterThan(0);
});
test('laser cockpit mask follows its tapered opening when awash and seals when dry',async({page})=>{
 await page.clock.install();await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);await page.click('#startButton');
 const result=await page.evaluate(()=>{const g=SAILING_GAME,w=g.scene,c=w.cockpitFor(),s=g.state;w.updateBoat(s,g.env,0);w.hull.updateMatrixWorld(true);const sample=(x,z)=>w.hull.localToWorld(new THREE.Vector3(x,(c.floorY+w.model.deckY)/2,z));const x=c.x1-.12,inside=sample(x,.20),outside=sample(x,.31);w.cockpitWet=true;const wet=[w.waterMaskedAt(inside),w.waterMaskedAt(outside)];w.cockpitWet=false;const dry=w.waterMaskedAt(inside);return {wet,dry,taper:w.waterUniforms.cockpitTaper.value};});
 expect(result.wet).toEqual([false,true]);expect(result.dry).toBe(true);expect(result.taper).toBeCloseTo(.82);
});
test('only occupied wake sections are drawn and each vertex follows the wave surface',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const scene=SAILING_GAME.scene,env={waveCurrent:.55,shelter:false},state={time:10};
  const geometry=scene.foamRibbonGeometry(8,4);
  const trail=(count,offset)=>Array.from({length:count},(_,i)=>({
   x:200+i*6,y:-5000+offset,t:9-i*.5,theta:Math.PI,speed:3,width:.10,strength:.8
  }));
  scene.writeFoamRibbon(geometry,[trail(2,0),[],trail(3,7)],state,env,true);
  const indices=Array.from(geometry.index.array.subarray(0,geometry.drawRange.count));
  const positions=geometry.attributes.position;
  const error=Math.max(...indices.map(i=>Math.abs(positions.getY(i)-SailPhysics.waveAt(positions.getX(i),-positions.getZ(i),state.time,env).height-.022)));
  const alpha=geometry.attributes.alpha,ages=[alpha.getX(32),alpha.getX(36)];
  geometry.dispose();
  return {indices,error,ages};
 });
 expect(result.indices).toEqual([0,1,2,1,3,2,32,33,34,33,35,34,34,35,36,35,37,36]);
 expect(result.error).toBeLessThan(.0001);
 expect(result.ages[0]).toBeGreaterThan(result.ages[1]);
});

test('breaking foam leaves a fading patch and calm water supplies no new patches',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const {scene}=SAILING_GAME,P=SailPhysics,fx=scene.surfaceFoam;
  const env={speed:20,waves:1,shortSea:1.1,direction:270,shelter:false};
  const s=P.createState({boatId:'yacht',x:0,y:-5000,time:0},env);
  const live={...env,waveCurrent:s.seaState,waveProfile:s.waveProfile};
  const sample=()=>fx.mesh.geometry.attributes.shape.getZ(0);
  for(let i=0;i<=8;i++)fx.update({...s,time:i*.16},live,i===0);
  const count=fx.patches.length,first=fx.patches[0],before=sample();
  if(!first)return {count};
  const steady={...s,seaState:0};
  fx.update({...steady,time:Math.max(1.29,first.time+first.life*.73)},live,false);
  const retained=fx.patches.some(p=>p===first),faded=sample();
  fx.update({...steady,time:12},live,false);
  return {count,retained,before,faded,cleared:fx.patches.length};
 });
 expect(result.count).toBeGreaterThan(0);
 expect(result.retained).toBe(true);
 expect(result.before).toBeGreaterThan(result.faded);
 expect(result.cleared).toBe(0);
});

test('hull contact includes angular motion and chooses the wet side',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,w=SAILING_GAME.scene;
  const env={...SAILING_GAME.env,speed:0,waves:0,waveCurrent:0,shelter:false};
  const s=P.createState({boatId:'laser',x:0,y:-5100,theta:.1,vx:4,vy:0,heel:.35,heelRate:.9,pitchRate:-.7,heave:.04,time:1},env);
  const fx=w.hullWater.sample('local',w,s,env,{reset:true,local:true});
  const {contacts}=fx;
  const right=contacts.find(x=>x.id==='side010'),left=contacts.find(x=>x.id==='side0-10');
  const step=.00001,q={...s,x:s.x+s.vx*step,y:s.y+s.vy*step,heel:s.heel+s.heelRate*step,pitch:s.pitch+s.pitchRate*step};
  const bow=contacts.find(x=>x.kind==='bow'),advanced=P.bodyPoint(q,bow.point);
  return {wetSides:[right.depth,left.depth],error:Math.abs((advanced.z-bow.z)/step-bow.relativeZ),closing:bow.closing};
 });
 expect(result.wetSides[0]).toBeGreaterThan(result.wetSides[1]+.20);
 expect(result.error).toBeLessThan(.0001);
 expect(result.closing).toBeGreaterThan(0.9);
});

test('wake samples are spaced by distance, advect and never join across dry gaps or teleports',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,scene=SAILING_GAME.scene,water=scene.hullWater;
  const env={...SAILING_GAME.env,speed:0,waves:0,waveCurrent:0,shelter:false};
  const s=P.createState({boatId:'laser',x:0,y:-5000,theta:0,vx:4,vy:0,heave:0,time:1,waterY:.35},env);
  let fx=water.sample('local',scene,s,env,{reset:true,local:true});
  const spacing=fx.profile.spacing;
  for(let i=1;i<=45;i++){
   Object.assign(s,{time:1+i/60,x:i*4/60});
   water.sample('local',scene,s,env,{local:true});
  }
  const track=fx.tracks.h0,lastOriginal=track[0];
  const intervals=track.slice(1).map((p,i)=>Math.hypot(track[i].x-p.x,track[i].y-p.y));
  for(let i=1;i<=45;i++){
   Object.assign(s,{time:1.75+i/60,y:-5000+i*4/60,vx:0,vy:4});
   water.sample('local',scene,s,env,{local:true});
  }
  const direction=track[0].dirY,oldRetained=track.includes(lastOriginal);
  const geometry=scene.foamRibbonGeometry(120,1);
  scene.writeFoamRibbon(geometry,[track],s,env);
  const span=(track[0].t-track[
   Math.min(track.length-1,4)].t);
  const lastIndex=track.indexOf(lastOriginal)*2;
  const g=geometry.attributes.position;
  const oldFoamY=-(g.getZ(lastIndex)+g.getZ(lastIndex+1))/2;
  const drift=oldFoamY-lastOriginal.y;
  water.track(fx,'h0',null,{life:10},s);
  water.track(fx,'h0',lastOriginal,{life:10},s);
  scene.writeFoamRibbon(geometry,[track],s,env);
  const noBridge=geometry.index.array[0]!==0;
  Object.assign(s,{x:350,time:s.time+.02});
  fx=water.sample('local',scene,s,env,{local:true});
  return {spacing,intervals,direction,oldRetained,drift,span,noBridge,afterTeleport:fx.tracks.h0.length};
 });
 expect(result.intervals.length).toBeGreaterThan(3);
 expect(result.intervals.every(x=>Math.abs(x-result.spacing)<.001)).toBe(true);
 expect(result.direction).toBeGreaterThan(.95);
 expect(result.oldRetained).toBe(true);
 expect(result.drift).toBeGreaterThan(.23);
 expect(result.noBridge).toBe(true);
 expect(result.afterTeleport).toBeLessThan(2);
});

test('the stern wave displaces the visible water and responds to hull loading and speed',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,{scene,env:base}=SAILING_GAME,water=scene.hullWater,T=THREE;
  const env={...base,sea:'calm',waves:0,waveCurrent:0,speed:0,gusts:0,shelter:false};
  const u=water.uniforms;
  const view=new T.PerspectiveCamera();view.position.y=62;
  const run=(speed,extraDraft=0)=>{
   const s=P.createState({boatId:'laser',x:0,y:-5000,theta:0,vx:speed,time:1},env);
   s.heave-=extraDraft;
   s.hydro=P.hydrostatics(s,env,false);
   let fx=water.sample('local',scene,s,env,{reset:true,local:true});
   for(let i=1;i<=168;i++){
    s.x=i*speed/60;s.time=1+i/60;
    fx=water.sample('local',scene,s,env,{local:true});
   }
   water.publish(s,view);
   return {s,volume:s.hydro.submergedVolume,head:fx.previous.h0?.wakeHeight||0};
  };
  const quiet=run(0).head,slow=run(1.4).head,normal=run(2.5),heavy=run(2.5,.055);
  const {renderer}=scene,target=new T.WebGLRenderTarget(1,1),probeScene=new T.Scene(),probeCamera=new T.Camera();
  const at={value:new T.Vector2()},pixel=new Uint8Array(4);
  const material=new T.ShaderMaterial({uniforms:{...u,at},vertexShader:'void main(){gl_Position=vec4(position,1.);}',
   fragmentShader:`uniform vec2 at;${SailingHullWater.waveShader}
    void main(){vec4 w=contactWave(at);gl_FragColor=vec4(.5+w.x,.5+w.w,0.,1.);}`});
  const geometry=new T.PlaneGeometry(2,2),mesh=new T.Mesh(geometry,material);
  mesh.frustumCulled=false;probeScene.add(mesh);
  const centre=u.contactCentres.value[0],length=u.contactShapes.value[0].y,heights=[];
  try{
   for(let step=-30;step<=20;step++){
    at.value.set(centre.x+length*step/24,centre.y);
    renderer.setRenderTarget(target);renderer.render(probeScene,probeCamera);
    renderer.readRenderTargetPixels(target,0,0,1,1,pixel);
    heights.push(pixel[1]/255-.5);
   }
  }finally{renderer.setRenderTarget(null);target.dispose();material.dispose();geometry.dispose();}
  const stop=heavy.s;
  stop.vx=0;stop.time+=.2;
  water.sample('local',scene,stop,env,{local:true});water.publish(stop,view);
  const count=()=>Array.from(u.contactWake.value.subarray(0,u.contactWaveCount.value)).filter(x=>x===1).length;
  const afterStop=count();
  stop.time+=4.2;
  water.sample('local',scene,stop,env,{local:true});water.publish(stop,view);
  return {quiet,slow,normal:normal.head,heavy:heavy.head,addedVolume:heavy.volume-normal.volume,
   crest:Math.max(...heights),trough:Math.min(...heights),afterStop,settled:count(),
   ambient:P.waveAt(stop.x,stop.y,stop.time,env).height};
 });
 expect(result.quiet).toBe(0);
 const measured=JSON.stringify(result);
 expect(result.slow,measured).toBeGreaterThan(.006);
 expect(result.normal,measured).toBeGreaterThan(result.slow*2);
 expect(result.addedVolume,measured).toBeGreaterThan(.015);
 expect(result.heavy,measured).toBeGreaterThan(result.normal);
 expect(result.crest,measured).toBeGreaterThan(.04);
 expect(result.trough,measured).toBeLessThan(-.03);
 expect(result.afterStop).toBeGreaterThan(0);
 expect(result.settled).toBe(0);
 expect(result.ambient).toBe(0);
});

test('foil hull wake stops in flight and resumes at the rounded belly on touchdown',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,game=SAILING_GAME,scene=game.scene,boatId='ac75';
  const env={...game.env,boatId,speed:12,direction:225,swellDirection:225,waves:.12,gusts:0,shelter:false};
  const theta=.95,s=P.createState({boatId,x:0,y:-1400,theta,vx:12*Math.cos(theta),vy:12*Math.sin(theta),sheet:.56},env);
  SailingWeather.initialize(s,env);scene.buildBoat(boatId);
  const stages={onWater:false,flying:false,landing:false};
  let leftHullWake=false;
  for(let i=0;i<720;i++){
   if(i===300)env.speed=0;
   P.step(s,{steer:i>=300&&i<480?.38:0,steerDigital:true,trim:i>=300?-1:0,crewPose:2},env,1/60);
   if(i%4)continue;
   const data=scene.hullWater.sample('local',scene,s,{...env,waveCurrent:s.seaState,waveProfile:s.waveProfile},{local:true});
   if(i<85&&s.foiling.hullWetFraction>.10&&data.tracks.h0?.length>2)stages.onWater=true;
   if(i>120&&i<270&&s.foiling.hullWetFraction<.006&&!data.previous.h0){
    stages.flying=true;
    if(data.tracks.h0?.length)leftHullWake=true;
   }
   if(i>390&&s.foiling.hullWetFraction>.11&&data.previous.h0&&data.tracks.h0[0].t>s.time-.30)stages.landing=true;
  }
  return {...stages,leftHullWake};
 });
 expect(result).toEqual({onWater:true,flying:true,landing:true,leftHullWake:true});
});
