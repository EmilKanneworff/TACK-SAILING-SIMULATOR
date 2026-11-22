const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});

test('a dinghy accelerates on a swell face and slows after leaving it',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,component=0;
  const env={...SAILING_GAME.env,speed:5.5,direction:225,boatId:'laser',waves:.85,shortSea:1,gusts:0,waveComponent:component,shelter:false};
  const w=P.WAVE_COMPONENTS[component],angle=P.waveProfileFor(env).angle;
  const kx=w.kx*Math.cos(angle)-w.ky*Math.sin(angle),ky=w.kx*Math.sin(angle)+w.ky*Math.cos(angle);
  const k=Math.hypot(kx,ky),phase=ky*-5000+w.phase,target=3.95;
  const distance=(target+Math.round((phase-target)/(2*Math.PI))*2*Math.PI-phase)/k;
  // Start on the face of one regular wave. After this point the usual force
  // integration moves the hull, with no correction to its speed or position.
  const theta=Math.atan2(ky,kx)+.24,v=3;
  const state=P.createState({x:distance*kx/k,y:-5000+distance*ky/k,theta,vx:v*Math.cos(theta),vy:v*Math.sin(theta),sheet:.10},env);
  const samples=[];
  for(let step=1;step<=300;step++){
   P.step(state,{steer:0,trim:0,crewPose:2},env,1/60);
   if(step%6)continue;
   const phase=kx*state.x+ky*state.y-w.omega*state.time+w.phase;
   const force=(state.hydro.waveFx*kx+state.hydro.waveFy*ky)/k;
   samples.push({time:state.time,speed:state.speed,face:Math.cos(phase)<0,force,capsized:state.capsized});
  }
  const leave=samples.findIndex(s=>!s.face||s.force<=0);
  const first=samples[0],last=samples[leave-1],after=samples.slice(leave,leave+14);
  return {first,last,leave,slowest:Math.min(...after.map(s=>s.speed)),opposing:after.some(s=>s.force<0),
   capsized:samples.some(s=>s.capsized)};
 });
 expect(result.leave).toBeGreaterThan(5);
 expect(result.last.speed-result.first.speed).toBeGreaterThan(.15);
 expect(result.last.speed-result.slowest).toBeGreaterThan(.04);
 expect(result.opposing).toBe(true);
 expect(result.capsized).toBe(false);
});

test('a following wave accelerates the dinghy on its face and brakes it on its back',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,theta=15*P.DEG;
  const initialSpeed=4.25,waveComponent=0,w=P.WAVE_COMPONENTS[waveComponent];
  const env={...SAILING_GAME.env,boatId:'laser',speed:14,direction:270,waveHeight:1.35,chop:0,wavePeriod:3.85,
   gusts:0,waveComponent,shelter:false,autoBalance:false,ironsHelp:false,difficulty:'hard'};
  const period=P.waveProfileFor(env).period,k=w.k/period**2;
  function run(phase,waveHeight,ticks=120){
   const sea={...env,waveHeight};
   const s=P.createState({boatId:'laser',x:(phase-w.phase)/k,y:-13000,theta,
    vx:initialSpeed*Math.cos(theta),vy:initialSpeed*Math.sin(theta),sheet:.13,crewPose:2,crewPoseBlend:2},sea);
   const moments=[];
   for(let i=0;i<ticks;i++){
    const steer=P.clamp(P.wrap(s.theta-theta)*2+s.omega*.9,-1,1);
    P.step(s,{steer,steerDigital:false,crewPose:2},sea,1/60);
    if(i>=ticks/2)moments.push(s.hydro.waveFx);
   }
   const instruments=P.instruments(s,null,sea);
   return {along:s.vx,log:instruments.logKnots,ground:instruments.knots,
    pressure:moments.reduce((sum,v)=>sum+v,0)/moments.length,capsized:s.capsized};
  }
  // Sample the steeper face during its actual push. At two seconds the
  // accumulated sail and resistance changes can already offset that gain.
  return {face:run(3.4,1.35,45),shortFlat:run(3.4,0,45),
   lateFace:run(4.4,1.35),back:run(.7,1.35),flat:run(4.4,0)};
 });
 expect(result.face.along).toBeGreaterThan(result.shortFlat.along+.15);
 expect(result.back.along).toBeLessThan(result.flat.along-.65);
 expect(result.face.pressure).toBeGreaterThan(30);
 expect(result.lateFace.pressure).toBeGreaterThan(30);
 expect(result.back.pressure).toBeLessThan(-30);
 expect(result.flat.pressure).toBe(0);
 expect(result.face.log).toBeCloseTo(result.face.ground,8);
 expect(result.face.capsized).toBe(false);
 console.log('Følgende bølge',JSON.stringify(result));
});
