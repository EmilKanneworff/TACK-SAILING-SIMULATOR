'use strict';
const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('islands shelter the downwind side, while wind and swell can arrive from different directions',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{const i=SailingWorld.ISLANDS.find(x=>x.id==='bjorno'),x=ArchipelagoData.fromMetric(1500,0).x;let shore=i.minY;while(SailingWorld.islandSample(i,x,shore).distance>=0)shore++;const y=shore-30,north=SailingShelter.sample(SailingShelter.field(0),x,y),south=SailingShelter.sample(SailingShelter.field(180),x,y),e={...SailPhysics.DEFAULT_ENV,speed:6,gusts:0,direction:0},wind=SailPhysics.windAt(x,y,0,e),high=SailPhysics.windAt(x,y,0,e,50),open=SailPhysics.windAt(x,y,0,{...e,shelter:false}),reverse=SailPhysics.windAt(x,y,0,{...e,direction:180});return {north,south,wind:wind.speed,high:high.speed,open:open.speed,reverse:reverse.speed,far:SailingShelter.sample(SailingShelter.field(0),0,SailingShelter.bounds.minY-500)};});
 expect(r.north).toBeLessThan(r.south-.1);expect(r.wind).toBeLessThan(r.reverse);expect(r.wind).toBeLessThan(r.high);expect(r.high).toBeLessThan(r.open);expect(r.far).toBe(1);
});
test('swell shadow follows swell direction independently of local wind',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{const i=SailingWorld.ISLANDS.find(x=>x.id==='bjorno'),x=i.cx,y=i.minY-55,base={...SailPhysics.DEFAULT_ENV,direction:90,speed:6,gusts:0,waves:.8,waveCurrent:.8,waveComponent:0};return [0,180].map(d=>{const e={...base,swellDirection:d},w=SailPhysics.waveAt(x,y,3,e),open=SailPhysics.waveAt(x,y,3,{...e,shelter:false});const exposure=SailingShelter.sample(SailingShelter.field(d),x,y),scaled=SailPhysics.waveAt(x,y,3,{...e,shelter:false,waveCurrent:e.waveCurrent*exposure});return {exposure,height:w.height,open:open.height,scaled:scaled.height};});});
 for(const q of r){expect(Math.abs(q.open)).toBeGreaterThan(.001);expect(q.height).toBeCloseTo(q.scaled,8)}expect(r[0].exposure).toBeLessThan(r[1].exposure-.1);
});
test('coastal shelter reduces the actual wind and sail force seen by a boat',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{const i=SailingWorld.ISLANDS.find(x=>x.id==='bjorno'),e={...SailPhysics.DEFAULT_ENV,boatId:'laser',direction:0,speed:6,gusts:0,waves:0};let shore=i.minY;while(SailingWorld.islandSample(i,i.cx,shore).distance>=0)shore++;const s=SailPhysics.createState({x:i.cx,y:shore-14,theta:0,vx:0,vy:0,boom:.6},e),lee=SailPhysics.aero(s,e),open=SailPhysics.aero(s,{...e,shelter:false});return {wind:lee.wind.tws,openWind:open.wind.tws,force:Math.hypot(lee.fx,lee.fy),openForce:Math.hypot(open.fx,open.fy)};});
 expect(r.wind).toBeLessThan(r.openWind*.90);expect(r.force).toBeLessThan(r.openForce*.88);expect(r.force).toBeGreaterThan(0);
});
test('coastal wave height is the same in the physics and actual water shader',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);await page.click('#startButton');
 await page.evaluate(()=>Object.assign(SAILING_GAME.env,{speed:12,direction:0,swellDirection:180,gusts:0}));
 await page.waitForFunction(()=>{
  const u=SAILING_GAME.scene.waterUniforms;
  return u.waveShelterEnabled.value===1&&u.waveBlend.value===1&&u.waveCoupled.value.y===0&&u.waveWindAngles.value.y!==u.waveTo.value.x;
 });
 const values=await page.evaluate(()=>{const scene=SAILING_GAME.scene,T=THREE,u=scene.waterUniforms,s=SAILING_GAME.state,e=SAILING_GAME.env,t=u.time.value,i=SailingWorld.ISLANDS.find(x=>x.id==='bjorno'),coords=[[i.cx,i.minY-55],[i.cx,i.maxY+55],[-400,-800],[40,33],[41,37]],uniforms={...u,coord:{value:new T.Vector2()}},material=new T.ShaderMaterial({uniforms,vertexShader:'void main(){gl_Position=vec4(position,1.);}',fragmentShader:`uniform float time;uniform float sea;uniform vec2 coord;${scene.waveShader} void main(){float h=wave(coord).x;gl_FragColor=vec4(.5+.4*h,0.,0.,1.);}`}),stage=new T.Scene(),mesh=new T.Mesh(new T.PlaneGeometry(2,2),material),camera=new T.OrthographicCamera(-1,1,1,-1,0,1),target=new T.WebGLRenderTarget(1,1),renderer=scene.renderer,old=renderer.getRenderTarget(),pixel=new Uint8Array(4),out=[];stage.add(mesh);for(const [x,y] of coords){uniforms.coord.value.set(x,-y);renderer.setRenderTarget(target);renderer.render(stage,camera);renderer.readRenderTargetPixels(target,0,0,1,1,pixel);out.push({gpu:(pixel[0]/255-.5)/.4,cpu:SailPhysics.waveAt(x,y,t,{...e,waveCurrent:u.sea.value,waveProfile:s.waveProfile}).height});}renderer.setRenderTarget(old);target.dispose();material.dispose();mesh.geometry.dispose();return out;});
 for(const v of values)expect(Math.abs(v.gpu-v.cpu),JSON.stringify(v)).toBeLessThan(.018);
});
test('a boat accelerates differently when sailing in island shelter',async({page})=>{
 test.setTimeout(60000);await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{const P=SailPhysics,i=SailingWorld.ISLANDS.find(x=>x.id==='bjorno'),x=ArchipelagoData.fromMetric(1500,0).x,base={...P.DEFAULT_ENV,boatId:'laser',direction:0,speed:7,gusts:0,waves:0};let shore=i.minY;while(SailingWorld.islandSample(i,x,shore).distance>=0)shore++;function run(shelter){const e={...base,shelter},s=P.createState({x,y:shore-22,theta:0,vx:0,vy:0},e);let sum=0;for(let k=0;k<120;k++){P.step(s,{steer:0,trim:0,crewPose:2},e,1/60);sum+=s.wind.tws}return {speed:Math.hypot(s.vx,s.vy),meanWind:sum/120,finite:Number.isFinite(s.x)&&Number.isFinite(s.heel)&&!s.capsized};}return {lee:run(true),open:run(false)};});
 expect(r.lee.finite&&r.open.finite).toBe(true);expect(r.lee.meanWind).toBeLessThan(r.open.meanWind*.9);expect(r.lee.speed).toBeLessThan(r.open.speed);
});

test('the water shader, boat instruments and map sample the same local wind',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 await page.click('#startButton');
 await page.evaluate(()=>Object.assign(SAILING_GAME.env,{speed:6,direction:92.4,gusts:.31,windSeed:1771}));
 await page.waitForFunction(()=>Math.abs(SAILING_GAME.scene.waterUniforms.windDirection.value-92.4)<.001);
 const result=await page.evaluate(()=>{
   const P=SailPhysics,{scene,state,env:settings,map}=SAILING_GAME,T=THREE,env=SailingSettings.live(settings,state);
   const u=scene.waterUniforms,time=u.time.value,coords=[[350,-150],[263,-180],[-225,-325],[0,-1850]];
   const uniforms={...u,point:{value:new T.Vector2()}};
   const material=new T.ShaderMaterial({
    uniforms,vertexShader:'void main(){gl_Position=vec4(position,1.);}',
    fragmentShader:`uniform float time,windSpeed,windDirection,gustStrength;uniform vec2 point;
      ${SailingWind.shader}
      void main(){vec3 air=localWind(point);gl_FragColor=vec4(.5+air.x*air.z/24.,.5-air.y*air.z/24.,air.z/12.,1.);}
    `
   });
   const stage=new T.Scene(),quad=new T.Mesh(new T.PlaneGeometry(2,2),material),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
   const target=new T.WebGLRenderTarget(1,1),renderer=scene.renderer,old=renderer.getRenderTarget(),pixel=new Uint8Array(4);
   stage.add(quad);
   const samples=coords.map(([x,y])=>{
     uniforms.point.value.set(x,-y);
     renderer.setRenderTarget(target);renderer.render(stage,camera);renderer.readRenderTargetPixels(target,0,0,1,1,pixel);
     const wind=P.windAt(x,y,time,env),vx=(pixel[0]/255-.5)*24,vy=(pixel[1]/255-.5)*24,speed=pixel[2]/255*12;
     return [Math.abs(vx-wind.vx),Math.abs(vy-wind.vy),Math.abs(speed-wind.speed)];
   });
   renderer.setRenderTarget(old);target.dispose();material.dispose();quad.geometry.dispose();
   P.refresh(state,env);map.update(state,env,SAILING_GAME.course);map.draw();
   const air=P.windAt(state.x,state.y,state.time,env),apparent=Math.hypot(air.vx-state.vx,air.vy-state.vy);
   return {samples,air:air.speed,instrument:P.instruments(state).tws,chart:map.lastFrame.wind.speed,
    apparent,stateApparent:state.wind.aws,readout:document.querySelector('#compactWind').getAttribute('aria-label')};
 });
 for(const errors of result.samples)for(const error of errors)expect(error).toBeLessThan(.09);
 expect(result.air).toBeCloseTo(result.instrument,8);
 expect(result.air).toBeCloseTo(result.chart,8);
 expect(result.apparent).toBeCloseTo(result.stateApparent,8);
 expect(result.readout).toContain('meter i sekundet');
});

test('laser, cruising yacht and foilboat sail out of shelter with coherent gusts',async({page})=>{
 test.setTimeout(90000);
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const trials=await page.evaluate(()=>{
   const P=SailPhysics;
   return ['laser','yacht','ac72'].map(boatId=>{
     const env={...SAILING_GAME.env,boatId,speed:boatId==='ac72'?12:6,direction:0,gusts:.27,waves:.18,windSeed:2647};
     const theta=-2.05,v=boatId==='ac72'?5.5:2;
     const safe=SailingRecovery.safeLocation({boatId,x:1060,y:-645},SailingBoats.get(boatId),theta);
     const s=P.createState({boatId,x:safe.x,y:safe.y,theta,sheet:.10,vx:v*Math.cos(theta),vy:v*Math.sin(theta)},env);
     const start=s.wind.exposure,gusts=[],loads=[],phases=[];
     let ground=false;
     for(let step=0;step<4500;step++){
       P.step(s,{steer:0,trim:0,crewPose:2},env,1/60);
       ground ||= s.ground.contact;
       if(step%30===0){gusts.push(s.wind.gust);loads.push(s.sail.load);phases.push(s.foiling?.support?.phase);}
       if(step>=1800&&s.wind.exposure>.94)break;
     }
     const wind=P.windAt(s.x,s.y,s.time,env);
     return {boatId,start,finish:wind.exposure,actual:wind.speed,indicated:s.wind.tws,ground,capsized:s.capsized,
       spread:Math.max(...gusts)-Math.min(...gusts),loaded:loads.some(load=>load>.06),flying:phases.includes('foiling')};
   });
 });
 for(const t of trials){
   expect(t.finish,t.boatId).toBeGreaterThan(.9);
   expect(t.finish-t.start,t.boatId).toBeGreaterThan(.065);
   expect(t.indicated,t.boatId).toBeCloseTo(t.actual,8);
   expect(t.ground||t.capsized,t.boatId).toBe(false);
   expect(t.spread,t.boatId).toBeGreaterThan(.25);
   expect(t.loaded,t.boatId).toBe(true);
   if(t.boatId==='ac72')expect(t.flying).toBe(true);
 }
});

test('wind sea follows wind rather than swell and needs more open water than the wind needs to recover',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,i=SailingWorld.ISLANDS.find(a=>a.id==='bjorno'),x=ArchipelagoData.fromMetric(1500,0).x;
  let shore=i.minY;while(SailingWorld.islandSample(i,x,shore).distance>=0)shore++;
  const y=shore-55,base={...P.DEFAULT_ENV,speed:12,direction:0,gusts:0,waveCurrent:1};
  const estimate=env=>{
   const p=P.waveProfileFor(env),values=P.waveExposureAt(p,x,y);
   return {long:values.long.v,short:values.short.v,fetch:values.fetch};
  };
  const moving={...base,swellDirection:180};
  const windward={...moving,direction:180};
  const shortComponent=P.WAVE_COMPONENTS.findIndex(w=>w.windSea);
  const rms=env=>Math.sqrt(Array.from({length:160},(_,j)=>P.waveAt(x,y,j*.03,{...env,waveComponent:shortComponent}).height**2).reduce((a,b)=>a+b,0)/160);
  const open=env=>rms({...env,shelter:false});
  const calm=open({...moving,speed:0,waveHeight:1});
  const st={time:1};P.advanceWaveProfile(st,{...moving,speed:5});
  const start=P.windWaveAt(st.time,st.waveProfile,moving).scale;
  const harder={...moving,speed:20};
  P.advanceWaveProfile(st,harder);
  const growth=[0,2,7,35].map(t=>P.windWaveAt(st.time+t,st.waveProfile,harder).scale);
  return {coupled:estimate(base),moving:estimate(moving),windward:estimate(windward),
   wind:P.windAt(x,y,5,base).speed/base.speed,leeRatio:rms(moving)/open(moving),
   shortUnchanged:open(moving)===open({...moving,swellDirection:60}),calm,start,growth};
 });
 expect(result.coupled.fetch).toBeLessThan(110);
 expect(result.coupled.long).toBeLessThan(result.wind*.45);
 expect(result.moving.short).toBeCloseTo(result.coupled.short,8);
 expect(result.moving.long).toBeGreaterThan(result.coupled.long+.25);
 expect(result.windward.short).toBeGreaterThan(result.moving.short*2.75);
 expect(result.leeRatio).toBeLessThan(result.wind*.50);
 expect(result.shortUnchanged).toBe(true);
 expect(result.calm).toBe(0);
 expect(result.growth[0]).toBe(result.start);
 expect(result.growth[2]).toBeGreaterThan(result.growth[1]);
 expect(result.growth[3]).toBeGreaterThan(1.49);
});
