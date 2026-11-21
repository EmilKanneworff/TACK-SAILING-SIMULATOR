const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const path=require('node:path');test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('wave dispersion, surface derivatives and orbital velocities use one field',async({page})=>{await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);const v=await page.evaluate(()=>{let e={...SAILING_GAME.env,waveCurrent:.8},x=13,y=-8,t=9,h=.0001,w=SailPhysics.waveAt(x,y,t,e),wx=SailPhysics.waveAt(x+h,y,t,e),wy=SailPhysics.waveAt(x,y+h,t,e),wt=SailPhysics.waveAt(x,y,t+h,e),deep=SailPhysics.waveAt(x,y,t,e,100),shader=SAILING_GAME.scene.waveComponents;return {components:SailPhysics.WAVE_COMPONENTS.map(q=>({...q})),shader:shader.map(q=>({...q})),w,dx:(wx.height-w.height)/h,dy:(wy.height-w.height)/h,dt:(wt.height-w.height)/h,deep}});expect(v.components.length).toBe(7);expect(v.shader).toEqual(v.components);for(const w of v.components)expect(w.omega*w.omega).toBeCloseTo(9.82*Math.hypot(w.kx,w.ky),8);expect(v.dx).toBeCloseTo(v.w.dx,4);expect(v.dy).toBeCloseTo(v.w.dy,4);expect(v.dt).toBeCloseTo(v.w.velocity,4);expect(Math.hypot(v.deep.waterVx,v.deep.waterVy,v.deep.waterVz)).toBeLessThan(.00001)});
test('five boats remain finite in moderate and hard wind with real waves',async({page})=>{
 test.setTimeout(90000);
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const results=await page.evaluate(()=>{
  const P=SailPhysics,R=SailingRecovery;
  return [6,20].flatMap(speed=>['laser','dinghy','yacht','ac75','ac72'].map(boatId=>{
   const env={...SAILING_GAME.env,boatId,waveHeight:speed===20?1.5:.65,chop:speed===20?1:.5,speed,direction:240,gusts:.2};
   const state=P.createState({x:-150,y:-5000,theta:.21},env);
   let finite=true,maxSpeed=0;
   for(let i=1;i<=720;i++){
    const time=i*1000/60;
    P.step(state,{steer:0,trim:-.02,crewPose:2},env,1/60);
    if(state.capsized||state.recovering)R.update(state,env,time);
    finite &&= [state.x,state.y,state.vx,state.vy,state.heave,state.heel,state.pitch].every(Number.isFinite);
    maxSpeed=Math.max(maxSpeed,Math.hypot(state.vx,state.vy));
   }
   return {boatId,speed,finite,maxSpeed,wave:state.seaState};
  }));
 });
 for(const result of results){
  expect(result.finite,JSON.stringify(result)).toBe(true);
  expect(result.maxSpeed,JSON.stringify(result)).toBeLessThan(30);
 }
 expect(results.filter(r=>r.speed===20).every(r=>r.wave>1.4)).toBe(true);
});
test('weather height slider selects and phase in sea level',async({page})=>{await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);await page.click('#startButton');await page.click('#settingsButton');const before=await page.evaluate(()=>SAILING_GAME.state.seaState);await page.locator('#waveHeight').fill('0.85');expect(await page.evaluate(()=>SAILING_GAME.env.waveHeight)).toBe(.85);const now=await page.evaluate(()=>SAILING_GAME.state.seaState);expect(now).toBe(before);await page.keyboard.press('Escape');await page.waitForTimeout(450);expect(await page.evaluate(()=>SAILING_GAME.state.seaState)).toBeGreaterThan(now)});
test('flat calm water has no horizontal energy source',async({page})=>{
 test.setTimeout(120000);
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const results=await page.evaluate(()=>{
  const P=SailPhysics;
  return ['laser','dinghy','yacht','ac75','ac72'].map(boatId=>{
   const env={...SAILING_GAME.env,boatId,waves:0,speed:0,gusts:0};
   const state=P.createState({x:0,y:-5000,vx:0,vy:0},env),control={steer:0,trim:0,crewPose:2};
   // Hold the horizontal position while the launched hull settles in pitch
   // and heel. Release it before measuring any translation.
   for(let i=0;i<1800;i++){
    P.step(state,control,env,1/60);
    Object.assign(state,{x:0,y:-5000,vx:0,vy:0,omega:0});
   }
   let speed10=0;
   for(let i=0;i<4800;i++){
    P.step(state,control,env,1/60);
    if(i===599)speed10=Math.hypot(state.vx,state.vy);
   }
   return {boatId,speed10,speed:Math.hypot(state.vx,state.vy)};
  });
 });
 for(const r of results){
  expect(r.speed,JSON.stringify(r)).toBeLessThan(.002);
  expect(r.speed,JSON.stringify(r)).toBeLessThanOrEqual(r.speed10+.0001);
 }
});
test('a wind direction and sea change crossfade without jumping and share shader settings',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.click('#startButton');await page.click('#settingsButton');
 const before=await page.evaluate(()=>({angle:SAILING_GAME.state.waveProfile.to.angle,t:SAILING_GAME.state.time}));
 await page.locator('#windDirection').fill('80');
 await page.locator('#waveHeight').fill('0.85');
 expect(await page.evaluate(()=>SAILING_GAME.state.time)).toBe(before.t);
 await page.keyboard.press('Escape');
 await page.waitForFunction(time=>{const s=SAILING_GAME.state,u=SAILING_GAME.scene.waterUniforms;return s.time>time+.23&&u.waveBlend.value>0&&u.waveBlend.value<1;},before.t);
 const result=await page.evaluate(()=>{
  const {state:s,env,scene}=SAILING_GAME,P=SailPhysics,u=scene.waterUniforms;
  const e={...SailingSettings.live(env,s),waveCurrent:s.seaState,waveProfile:s.waveProfile};
  const w=P.waveAt(12,9,s.time,e),later=P.waveAt(12,9,s.time+.0001,e);
  return {profile:s.waveProfile,shaderSpread:u.waveSpread.value.toArray(),shaderBlend:u.waveBlend.value,velocity:w.velocity,difference:(later.height-w.height)/.0001};
 });
 expect(result.profile.from.angle).toBeCloseTo(before.angle,7);
 expect(result.profile.to.period).toBeGreaterThan(1);
 expect(result.shaderBlend).toBeLessThan(1);
 expect(result.shaderSpread[0]).toBeCloseTo(result.profile.from.spread,3);
 expect(result.shaderSpread[1]).toBeCloseTo(result.profile.to.spread,3);
 expect(result.difference).toBeCloseTo(result.velocity,3);
});
test('swell without wind stays bounded over a longer run',async({page})=>{test.setTimeout(30000);await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);const r=await page.evaluate(()=>{const e={...SAILING_GAME.env,boatId:'laser',speed:0,gusts:0,waves:1},s=SailPhysics.createState({vx:0,vy:0},e);let max=0;for(let i=0;i<7200;i++){SailPhysics.step(s,{steer:0,trim:0,crewPose:2},e,1/60);max=Math.max(max,Math.hypot(s.vx,s.vy));}return {max,final:Math.hypot(s.vx,s.vy),finite:Number.isFinite(s.x)&&Number.isFinite(s.heave)}});expect(r.finite).toBe(true);expect(r.max).toBeLessThan(10)});
test('automatic recovery in waves returns control for all five boats',async({page})=>{test.setTimeout(90000);await page.clock.install();await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);await page.click('#startButton');let elapsed=[];for(const boat of ['laser','dinghy','yacht','ac75','ac72']){await page.click('#boatMenuButton');await page.click(`[data-boat="${boat}"]`);if(await page.evaluate(()=>SAILING_GAME.paused))await page.click('#resumeButton');await page.evaluate(()=>{SAILING_GAME.state.heel=2;SAILING_GAME.state.heelRate=0});await page.clock.runFor(5000);const r=await page.evaluate(()=>({boat:SAILING_GAME.state.boatId,last:SAILING_GAME.state.lastRecovery,recovering:SAILING_GAME.state.recovering}));expect(r.recovering,JSON.stringify(r)).toBe(false);expect(r.last,JSON.stringify(r)).toBeTruthy();expect(r.last.elapsedSeconds).toBeLessThanOrEqual(5);elapsed.push(r.last.elapsedSeconds);await page.keyboard.down('ArrowLeft');await page.clock.runFor(300);expect(await page.evaluate(()=>SAILING_GAME.state.steerIntent),boat).toBe(-1);await page.keyboard.up('ArrowLeft')}console.log('RECOVERY SECONDS',JSON.stringify(elapsed))});
test('GPU wave shader matches the physics field at sampled coordinates',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const values=await page.evaluate(()=>{
  const P=SailPhysics,T=THREE,g=SAILING_GAME,world=g.scene,renderer=world.renderer,time=7.5;
  const env={...g.env,direction:0,speed:5,shelter:false};
  const s=P.createState({time},env);
  s.waveProfile={from:P.waveProfileFor(env),to:P.waveProfileFor({...env,direction:90,swellDirection:140,wavePeriod:8,shortSea:.7}),start:time-P.PROFILE_SECONDS/2};
  world.update(s,env,{marks:[]},1/60,{});
  const uniforms={...world.waterUniforms,coord:{value:new T.Vector2()}};
  const material=new T.ShaderMaterial({uniforms,vertexShader:'void main(){gl_Position=vec4(position,1.);}',
   fragmentShader:`uniform float time;uniform float sea;uniform vec2 coord;${world.waveShader}
     void main(){gl_FragColor=vec4(.5+.4*wave(coord).x,0.,0.,1.);}`});
  const scene=new T.Scene(),quad=new T.Mesh(new T.PlaneGeometry(2,2),material),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  const target=new T.WebGLRenderTarget(1,1),old=renderer.getRenderTarget(),pixel=new Uint8Array(4);
  scene.add(quad);
  const values=[[3,5],[38,-42],[-98,64]].map(([x,y])=>{
   uniforms.coord.value.set(x,-y);
   renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,1,1,pixel);
   return {gpu:(pixel[0]/255-.5)/.4,cpu:P.waveAt(x,y,time,{...env,waveCurrent:s.seaState,waveProfile:s.waveProfile}).height};
  });
  renderer.setRenderTarget(old);target.dispose();material.dispose();quad.geometry.dispose();
  return values;
 });
 for(const p of values)expect(Math.abs(p.gpu-p.cpu),JSON.stringify(p)).toBeLessThan(.015);
});
test('fixed-step sailing in waves agrees at 30, 60 and 120 render rates',async({page})=>{await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);const runs=await page.evaluate(()=>[30,60,120].map(fps=>{const e={...SAILING_GAME.env,waves:.85,boatId:'laser'},s=SailPhysics.createState({},e);let acc=0;for(let f=0;f<fps*12;f++){acc+=1/fps;while(acc+1e-12>=1/60){SailPhysics.step(s,{steer:s.time<3?.2:0,trim:0,crewPose:2},e,1/60);acc-=1/60}}return {x:s.x,y:s.y,heave:s.heave,heel:s.heel,time:s.time}}));for(const r of runs.slice(1))for(const k of ['x','y','heave','heel','time'])expect(r[k]).toBeCloseTo(runs[0][k],7)});
test('crew shifts alter centre of gravity without changing total mass',async({page})=>{await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);const samples=await page.evaluate(()=>['laser','dinghy','yacht','ac75','ac72'].map(boatId=>{const e={...SAILING_GAME.env,boatId},s=SailPhysics.createState({},e),out=[];for(let pose of [1,2,3]){s.crewPoseBlend=pose;s.crewSideBlend=1;SailPhysics.updateCrew(s,{crewPose:pose},{...e,autoBalance:false},0);if(boatId.startsWith('ac')){const p=FoilingPhysics.massProperties(s);out.push({mass:p.mass,cg:p.cg.z})}else{const p=SailPhysics.hydrostatics(s,e,false);out.push({mass:SailingBoats.get(boatId).mass,cg:p.cg.z})}}return {boatId,out}}));for(const s of samples){expect(s.out[1].mass).toBeCloseTo(s.out[0].mass,6);expect(s.out[2].mass).toBeCloseTo(s.out[0].mass,6);expect(Math.abs(s.out[2].cg-s.out[0].cg),JSON.stringify(s)).toBeGreaterThan(.001)}});
test('one regular component matches the GPU and produces a bow-to-stern response',async({page})=>{
 test.setTimeout(60000);await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{const P=SailPhysics,scene=SAILING_GAME.scene,T=THREE,renderer=scene.renderer,e={...SAILING_GAME.env,boatId:'laser',speed:5,waves:.85,waveComponent:0,swellDirection:P.BASE_WAVE_DIRECTION},s=P.createState({boatId:'laser',x:0,y:-5000,theta:Math.atan2(.105,.075)+Math.PI},e),profile=s.waveProfile.to,uniforms={time:{value:0},sea:{value:s.seaState},waveFrom:{value:new T.Vector3(profile.angle,profile.period,profile.short)},waveTo:{value:new T.Vector3(profile.angle,profile.period,profile.short)},waveBlend:{value:1},coord:{value:new T.Vector2()}},material=new T.ShaderMaterial({uniforms,vertexShader:'void main(){gl_Position=vec4(position,1.0);}',fragmentShader:`uniform float time;uniform float sea;uniform vec2 coord;${scene.waveShaderTemplate.replace('WAVE_TERMS',scene.waveTermStrings[0])} void main(){gl_FragColor=vec4(.5+.4*wave(coord).x,0.,0.,1.);}`}),testScene=new T.Scene(),mesh=new T.Mesh(new T.PlaneGeometry(2,2),material),camera=new T.OrthographicCamera(-1,1,1,-1,0,1),target=new T.WebGLRenderTarget(1,1),old=renderer.getRenderTarget(),pix=new Uint8Array(4),checks=[],pitch=[],difference=[];testScene.add(mesh);
 for(let i=0;i<900;i++){P.step(s,{steer:0,trim:0,crewPose:2},e,1/60);if(i%60===0){const f=P.axes(s.theta),len=SailingBoats.get(s).length,ev={...e,waveCurrent:s.seaState,waveProfile:s.waveProfile},bow=P.waveAt(s.x+f.fx*len*.4,s.y+f.fy*len*.4,s.time,ev),stern=P.waveAt(s.x-f.fx*len*.4,s.y-f.fy*len*.4,s.time,ev);pitch.push(s.pitch);difference.push(bow.height-stern.height);uniforms.time.value=s.time;uniforms.sea.value=s.seaState;uniforms.coord.value.set(s.x,-s.y);renderer.setRenderTarget(target);renderer.render(testScene,camera);renderer.readRenderTargetPixels(target,0,0,1,1,pix);checks.push({gpu:(pix[0]/255-.5)/.4,cpu:P.waveAt(s.x,s.y,s.time,ev).height});}}
 renderer.setRenderTarget(old);target.dispose();material.dispose();mesh.geometry.dispose();return {checks,pitch,difference,finite:[s.x,s.y,s.heave,s.pitch].every(Number.isFinite)};});
 expect(r.finite).toBe(true);for(const x of r.checks)expect(Math.abs(x.gpu-x.cpu)).toBeLessThan(.015);expect(Math.max(...r.pitch)-Math.min(...r.pitch)).toBeGreaterThan(.01);expect(Math.max(...r.difference)-Math.min(...r.difference)).toBeGreaterThan(.1);
});
test('foil support status avoids rapid flicker while water contact and lift vary',async({page})=>{
 test.setTimeout(90000);
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const launches=await page.evaluate(()=>{
  const P=SailPhysics,direction=225;
  const env={...SAILING_GAME.env,boatId:'ac75',difficulty:'hard',waves:.85,speed:16,direction,shelter:false};
  const heading=(90-direction-112)*P.DEG;
  // Offset the start along the wave train to exercise different initial crests.
  return [-12,0,12].map(x=>{
   const state=P.createState({x,y:-5000,theta:heading,sheet:.55,vx:0,vy:0},env);
   const transitions=[],wet=[];
   let last=null,lastTime=0,maxLift=0;
   for(let step=0;step<3000;step++){
    const rudder=P.clamp(2.1*P.wrap(state.theta-heading)+1.12*state.omega,-.8,.8);
    P.step(state,{steer:rudder,steerDigital:false,trim:0,crewPose:2},env,1/60);
    const phase=state.foiling.support?.phase;
    if(phase!==last){
     transitions.push({from:last,to:phase,dwell:state.time-lastTime});
     last=phase;
     lastTime=state.time;
    }
    maxLift=Math.max(maxLift,state.foiling.liftFraction);
    if(step%60===0)wet.push(state.foiling.hullWetFraction);
   }
   return {transitions,maxLift,wetRange:Math.max(...wet)-Math.min(...wet),
    finite:[state.x,state.y,state.heave,state.pitch].every(Number.isFinite)};
  });
 });
 const exempt=new Set(['touchdown','capsized','recovering']);
 for(const launch of launches){
  expect(launch.finite).toBe(true);
  expect(launch.wetRange).toBeGreaterThan(.2);
  for(const transition of launch.transitions.slice(1)){
   if(!exempt.has(transition.from)&&!exempt.has(transition.to)){
    expect(transition.dwell,JSON.stringify(transition)).toBeGreaterThanOrEqual(.49);
   }
  }
 }
 const flying=launches.filter(launch=>launch.maxLift>.8&&launch.transitions.some(t=>t.to==='foiling'));
 expect(flying.length).toBeGreaterThanOrEqual(2);
});
