const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const path=require('node:path');
const game=process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href;
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('loaded waterline foam fades on the immersed rail on either tack',async({page})=>{
 await page.goto(game);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
   const {scene,env}=SAILING_GAME;
   const s=SailPhysics.createState({boatId:'laser',x:0,y:0,theta:0},env);
   const contacts=[-1,1].flatMap(side=>[-1,1].map(x=>({
     kind:'side',side,hullIndex:0,point:{x},strength:.65,impact:.22
   })));
   scene.hullWater.surfaceHeight=()=>0;
   const sample=(heel,clearance)=>{
     s.heel=heel;s.pitch=0;s.heave=0;
     scene.updateBoat(s,env,0);scene.scene.updateMatrixWorld(true);
     const m=scene.model,x=(m.hullSections[0][0]+m.hullSections.at(-1)[0])/2;
     const z=Math.sign(heel)*scene.halfBeamAt(x);
     const rail=scene.hull.localToWorld(new THREE.Vector3(x,scene.bottomAt(x,z),z));
     s.heave=clearance-rail.y;
     scene.updateBoat(s,env,0);scene.scene.updateMatrixWorld(true);
     scene.updateContactFoam(s,env,{contacts});
     const g=scene.contactFoam.geometry,{position,alpha,fresh,across}=g.attributes;
     for(let i=0;i<g.drawRange.count;i++){
       if(across.getX(i)===0&&Math.abs(position.getX(i)-rail.x)<.001&&Math.abs(position.getZ(i)-rail.z)<.001){
         return {opacity:alpha.getX(i),fresh:fresh.getX(i)};
       }
     }
     return null;
   };
   return [-.49,.49].map(heel=>[sample(heel,-.012),sample(heel,-.054),sample(heel,-.22)]);
 });
 for(const [justWet,immersed,deep] of result){
   expect(justWet.fresh).toBeGreaterThan(.3);
   expect(immersed.opacity).toBeGreaterThan(0);
   expect(immersed.opacity).toBeLessThan(justWet.opacity);
   expect(deep).toBeNull();
 }
});
test('a still hull makes no wake and a real bow impact produces spray',async({page})=>{
 await page.clock.install();await page.goto(game);await page.waitForFunction(()=>window.SAILING_GAME);await page.click('#startButton');
 const r=await page.evaluate(()=>{const g=SAILING_GAME,scene=g.scene,s=g.state,env={...g.env,speed:0,waves:0,gusts:0,waveCurrent:0,waveProfile:s.waveProfile};Object.assign(s,{vx:0,vy:0,theta:0,heel:0,pitch:0,heelRate:0,pitchRate:0,heaveVelocity:0,seaState:0,capsized:false});const x=scene.model.length*.38;s.heave=-scene.bottomAt(x,0);scene.updateBoat(s,env,0);scene.scene.updateMatrixWorld(true);scene.updateEffects(s,env,1/60,true);const quiet={spray:scene.spray.length,wake:scene.wakes.length};s.time+=.3;s.heaveVelocity=-1;scene.updateBoat(s,env,0);scene.scene.updateMatrixWorld(true);scene.updateEffects(s,env,1/60,false);return {quiet,after:scene.spray.length,impact:scene.spray.map(p=>p.vh),slam:SailPhysics.hydrostatics(s,env).slamForce};});expect(r.quiet).toEqual({spray:0,wake:0});expect(r.after).toBeGreaterThan(0);expect(r.impact.every(x=>x>0)).toBe(true);expect(r.slam).toBeGreaterThan(0);
});
test('laser cockpit mask follows its tapered opening when awash and seals when dry',async({page})=>{
 await page.clock.install();await page.goto(game);await page.waitForFunction(()=>window.SAILING_GAME);await page.click('#startButton');
 const result=await page.evaluate(()=>{const g=SAILING_GAME,w=g.scene,c=w.cockpitFor(),s=g.state;w.updateBoat(s,g.env,0);w.hull.updateMatrixWorld(true);const sample=(x,z)=>w.hull.localToWorld(new THREE.Vector3(x,(c.floorY+w.model.deckY)/2,z));const x=c.x1-.12,inside=sample(x,.20),outside=sample(x,.31);w.cockpitWet=true;const wet=[w.waterMaskedAt(inside),w.waterMaskedAt(outside)];w.cockpitWet=false;const dry=w.waterMaskedAt(inside);return {wet,dry,taper:w.waterUniforms.cockpitTaper.value};});
 expect(result.wet).toEqual([false,true]);expect(result.dry).toBe(true);expect(result.taper).toBeCloseTo(.82);
});
test('only occupied wake sections are drawn and each vertex follows the wave surface',async({page})=>{
 await page.goto(game);
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

test('wake foam oscillates with a passing wave while current transports it over several periods',async({page})=>{
 await page.goto(game);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const positions=await page.evaluate(()=>{
  const {scene,env}=SAILING_GAME;
  const geometry=scene.foamRibbonGeometry(3,1,3);
  const point={x:0,y:0,t:0,period:4,segment:1,orbitalX:1,orbitalY:-.6,
   driftX:.28,driftY:.12,dirX:1,dirY:0,speed:3,width:.1,strength:.8,life:19};
  const track=[point,{...point,x:-1}];
  const samples=[0,1,3,8].map(time=>{
   scene.writeFoamRibbon(geometry,[track],{time},env);
   const position=geometry.attributes.position;
   return [position.getX(1),-position.getZ(1)];
  });
  geometry.dispose();
  return samples;
 });
 const quarterPeriodDisplacement=2/Math.PI;
 const expected=[[0,0],[.28+quarterPeriodDisplacement,.12-.6*quarterPeriodDisplacement],
  [.84-quarterPeriodDisplacement,.36+.6*quarterPeriodDisplacement],[2.24,.96]];
 for(let i=0;i<expected.length;i++){
  expect(positions[i][0]).toBeCloseTo(expected[i][0],5);
  expect(positions[i][1]).toBeCloseTo(expected[i][1],5);
 }
});

test('breaking foam leaves a fading patch and calm water supplies no new patches',async({page})=>{
 await page.goto(game);
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
  const cleared=fx.patches.length;
  const chop={speed:20,direction:270,waveHeight:0,chop:1,shelter:false};
  const forChop=P.createState({boatId:'yacht',x:0,y:-5000,time:0},chop);
  for(let i=0;i<=12;i++)fx.update({...forChop,time:i*.17},{...chop,waveProfile:forChop.waveProfile},i===0);
  return {count,retained,before,faded,cleared,chopPatches:fx.patches.length};
 });
 expect(result.count).toBeGreaterThan(0);
 expect(result.retained).toBe(true);
 expect(result.before).toBeGreaterThan(result.faded);
 expect(result.cleared).toBe(0);
 expect(result.chopPatches).toBeGreaterThan(0);
});

test('hull contact includes angular motion and chooses the wet side',async({page})=>{
 await page.goto(game);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,w=SAILING_GAME.scene;
  const env={...SAILING_GAME.env,speed:0,waveHeight:0,chop:0,waveCurrent:0,shelter:false};
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

test('the Laser leaves a separate wake at each wet stern corner',async({page})=>{
 await page.goto(game);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const results=await page.evaluate(()=>{
  const P=SailPhysics,scene=SAILING_GAME.scene,water=scene.hullWater;
  const env={...SAILING_GAME.env,speed:0,waveHeight:0,chop:0,waveCurrent:0,shelter:false};
  return [0,.52,-.52].map(heel=>{
   const s=P.createState({boatId:'laser',x:0,y:-5000,theta:0,heel,vx:4,heave:0,time:1},env);
   const fx=water.sample('local',scene,s,env,{reset:true,local:true});
   const advance=(frames,stop=false)=>{
    for(let i=0;i<frames;i++){
     s.time+=1/60;
     if(stop)s.vx=0;
     s.x+=s.vx/60;
     water.sample('local',scene,s,env,{local:true});
    }
   };
   advance(45);
   const before=water.foamPaths(fx).map(({track,head})=>({count:track.length,first:track[0],head}));
   advance(30,true);
   return {before,after:water.foamPaths(fx).map(({track,head},i)=>({head,retained:track.includes(before[i].first)}))};
  });
 });
 const [flat,starboard,port]=results;
 expect(flat.before[0].count).toBeGreaterThan(3);
 expect(flat.before[1].count).toBe(flat.before[0].count);
 expect(flat.before[0].head.y-flat.before[1].head.y).toBeGreaterThan(.40);
 expect(flat.after.every(side=>side.retained&&side.head===null)).toBe(true);
 expect(starboard.before[1].head.strength).toBeGreaterThan(starboard.before[0].head?.strength??0);
 expect(port.before[0].head.strength).toBeGreaterThan(port.before[1].head?.strength??0);
});

test('wake samples are spaced by distance, advect and never join across dry gaps or teleports',async({page})=>{
 await page.goto(game);
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
 await page.goto(game);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,{scene,env:base}=SAILING_GAME,water=scene.hullWater,T=THREE;
  const env={...base,waveHeight:0,chop:0,waveCurrent:0,speed:0,gusts:0,shelter:false};
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

for(const boat of ['ac75','ac72'])test(`${boat} hull wake stops in flight and resumes on touchdown`,async({page})=>{
 await page.goto(game);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(boatId=>{
  const P=SailPhysics,game=SAILING_GAME,scene=game.scene;
  const env={...game.env,boatId,speed:12,direction:225,swellDirection:225,waves:.12,gusts:0,shelter:false};
  const theta=.95,s=P.createState({boatId,x:0,y:-1400,theta,vx:12*Math.cos(theta),vy:12*Math.sin(theta),sheet:.56},env);
  SailingWeather.initialize(s,env);scene.buildBoat(boatId);
  const stages={onWater:false,flying:false,landing:false,appendageTrail:false};
  let leftHullWake=false;
  for(let i=0;i<(boatId==='ac72'?1200:720);i++){
   if(i===300)env.speed=0;
   P.step(s,{steer:i>=300&&i<480?.38:0,steerDigital:true,trim:i>=300?-1:0,crewPose:2},env,1/60);
   if(i%4)continue;
   const data=scene.hullWater.sample('local',scene,s,{...env,waveCurrent:s.seaState,waveProfile:s.waveProfile},{local:true});
   const hullTracks=Object.keys(data.tracks).filter(key=>key.startsWith('h'));
   if(i<85&&s.foiling.hullWetFraction>.10&&hullTracks.some(key=>data.tracks[key].length>2))stages.onWater=true;
   if(i>120&&i<270&&s.foiling.hullWetFraction<.006&&hullTracks.every(key=>!data.previous[key])){
    stages.flying=true;
    if(hullTracks.some(key=>data.tracks[key].length))leftHullWake=true;
    if(Object.keys(data.previous).some(key=>key.startsWith('f')&&data.previous[key]))stages.appendageTrail=true;
   }
   if(i>390&&s.foiling.hullWetFraction>.11&&hullTracks.some(key=>data.previous[key]&&data.tracks[key][0].t>s.time-.30))stages.landing=true;
   if(stages.landing)break;
  }
  return {...stages,leftHullWake};
 },boat);
 expect(result).toEqual({onWater:true,flying:true,landing:true,appendageTrail:true,leftHullWake:true});
});

test('both ripple layers advance continuously across their repeat boundary',async({page})=>{
 await page.goto(game);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const phases=await page.evaluate(()=>{
  const {env:base,scene}=SAILING_GAME,env={...base,direction:270,speed:10,shelter:false};
  const s=SailPhysics.createState({boatId:'laser',x:0,y:-1400,time:0},env);
  const options={quality:'high',helpers:false,windArrows:false};
  scene.lastTime=-1;
  scene.update(s,env,{marks:[]},.05,options);
  const offset=scene.waterUniforms.windChopDrift.value;
  offset.set(.997,0,0,-.997);
  s.time+=.05;
  scene.update(s,env,{marks:[]},.05,options);
  return offset.toArray();
 });
 const travel=.05*(.12+.016*10);
 expect(phases[0]).toBeCloseTo(.997+travel*1.88-1,8);
 expect(phases[1]).toBeCloseTo(0,8);
 expect(phases[2]).toBeCloseTo(0,8);
 expect(phases[3]).toBeCloseTo(-.997-travel*.87+1,8);
});

test('hull film follows the curved surface and returned spray meets the same waterline',async({page})=>{
 await page.goto(game);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,w=SAILING_GAME.scene,sea=w.hullWater;
  const env={speed:8,direction:270,waves:.85,waveComponent:4,shelter:false};
  const wave=P.WAVE_COMPONENTS[4],angle=P.waveProfileFor(env).windAngle,y=-5000,time=1;
  const kx=wave.kx*Math.cos(angle)-wave.ky*Math.sin(angle),ky=wave.kx*Math.sin(angle)+wave.ky*Math.cos(angle);
  const x=P.wrap(Math.PI/2-(ky*y-wave.omega*time+wave.phase))/kx;
  const s=P.createState({boatId:'laser',x,y,theta:0,vx:4,heel:.12,time},env);
  const live={...env,waveCurrent:s.seaState,waveProfile:s.waveProfile};
  const fx=sea.sample('local',w,s,live,{local:true,reset:true});
  const camera=new THREE.PerspectiveCamera();camera.position.set(s.x,5,-s.y);
  sea.publish(s,camera);
  const uniforms=w.hullWetUniforms,bounds=uniforms.bounds.value,values=[];
  for(const off of [-.41,0,.41]){
   const x=s.x+off/bounds.z,y=s.y;
   const packed=sea.surfaceHeight(w,x,y),height=P.waveAt(x,y,s.time,live).height+sea.contactHeight(x,y);
   const plane=-(uniforms.plane.value.x*x-uniforms.plane.value.z*y+uniforms.plane.value.w);
   values.push({packed,height,plane});
  }
  const far=sea.surfaceHeight(w,s.x+20,s.y);
  const still={...s,time:2,seaState:0},flat={...env,waves:0,waveCurrent:0};
  sea.sample('local',w,still,flat,{local:true,reset:true});
  sea.publish(still,camera);
  w.spray.length=0;
  const drop={x:still.x,y:still.y,h:.12,vx:0,vy:0,ax:0,ay:0,vh:.42,t:still.time,size:.024,alpha:.6};
  w.spray.push(drop);
  w.updateSprayGeometry({...still,time:still.time+.08},flat);
  const airborne=w.spray.length;
  w.updateSprayGeometry({...still,time:still.time+.29},flat);
  const landed=w.spray.length;
  return {values,far,airborne,landed,recycled:w.sprayPool.includes(drop),filmCount:fx.films.length};
 });
 expect(result.far).toBeNull();
 expect(result.filmCount).toBe(4);
 for(const p of result.values)expect(Math.abs(p.packed-p.height)).toBeLessThan(.012);
 expect(result.values.some(p=>Math.abs(p.plane-p.height)>.009)).toBe(true);
 expect(result.airborne).toBe(1);
 expect(result.landed).toBe(0);
 expect(result.recycled).toBe(true);
});

test('the Laser sailor braces at the bow impact and keeps the physical stance',async({page})=>{
 await page.goto(game);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,w=SAILING_GAME.scene,C=SailingCrewMotion,env={speed:0,waves:0,waveCurrent:0};
  const c=SailingBoats.get('laser'),x=c.length*.38;
  const s=P.createState({boatId:'laser',time:1,x:0,y:-5000,theta:0,vx:3,vy:0,heel:0,pitch:0,
   heave:-SailingBoats.hullBottom(c,x,0),heaveVelocity:0,crewPose:2,crewPoseBlend:2},env);
  let previous=C.balance(null,s,1/60,P.bowWaterContact(s,c,env));
  s.heaveVelocity=-1.75;s.time+=.11;
  const bow=P.bowWaterContact(s,c,env);
  w.crewBalance=C.balance(previous,s,.11,bow);
  const body=SailingBoats.crewPoseAt(s),visual=C.pose(w,body,s,0);
  const delta=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  return {brace:w.crewBalance.brace,headDrop:body.head.y-visual.head.y,
   seat:delta(body.pelvis,visual.pelvis),hands:visual.hands.map((p,i)=>delta(p,body.hands[i])),
   feet:visual.feet.map((p,i)=>delta(p,body.feet[i]))};
 });
 expect(result.brace).toBeGreaterThan(.45);
 expect(result.headDrop).toBeGreaterThan(.035);
 expect(result.seat).toBe(0);
 expect(result.hands).toEqual([0,0]);
 expect(result.feet).toEqual([0,0]);
});
