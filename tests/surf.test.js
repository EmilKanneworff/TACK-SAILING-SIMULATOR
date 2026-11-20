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
