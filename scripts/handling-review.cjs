'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('@playwright/test');

const dt=1/60;
async function measure(page,task,quick){
 return page.evaluate(({task,dt,quick})=>{
  const P=SailPhysics,D=P.DEG;
  const control=(s,target,trim,pose)=>({
   steer:P.clamp(-1.8*P.wrap(target-s.theta)+1.05*s.omega,-.80,.80),
   steerDigital:false,trim:P.clamp((trim-s.sheet)*6,-1,1),trimFast:true,crewPose:pose
  });
  const setup=(boatId,wind,angle,trim,pose,waves=0,velocity=1.5)=>({
   env:{...P.DEFAULT_ENV,boatId,speed:wind,direction:0,waves:undefined,waveHeight:waves,gusts:0,shelter:false,crewPose:pose},
   initial:{boatId,x:0,y:-5000,theta:(90-angle)*D,sheet:trim,
    vx:velocity*Math.cos((90-angle)*D),vy:velocity*Math.sin((90-angle)*D),crew:Math.sign(-angle)}
  });
  function sail(boatId,wind,angle,trim,pose,seconds,waves=0){
   const {env,initial}=setup(boatId,wind,angle,trim,pose,waves);
   const s=P.createState(initial,env),target=initial.theta;
   let speed=0,heel=0,leeway=0,vmg=0,error=0,n=0,first=0,peak=0;
   for(let i=0;i<seconds/dt;i++){
    P.step(s,control(s,target,trim,pose),env,dt);
    if(s.capsized||!Number.isFinite(s.x))return {trim,pose,capsized:s.capsized,invalid:true};
    const instruments=P.instruments(s,null,env);
    peak=Math.max(peak,instruments.waterSpeed);
    if(i===599)first=instruments.waterSpeed;
    if(i>=(seconds-10)/dt){
     const a=P.axes(s.theta),forward=s.vx*a.fx+s.vy*a.fy,side=s.vx*a.rx+s.vy*a.ry;
     speed+=instruments.waterSpeed;heel+=Math.abs(s.heel)/D;leeway+=Math.abs(Math.atan2(side,forward))/D;
     vmg+=s.vy;error+=Math.abs(P.wrap(s.theta-target))/D;n++;
    }
   }
   return {trim,pose,speed:speed/n,heel:heel/n,leeway:leeway/n,vmg:vmg/n,error:error/n,
    firstTenSeconds:first,accelerationTenSeconds:(first-1.5)/10,peak};
  }
  function polar(){
   const results=[];
   for(const wind of quick?[8,9]:[6,8,9])for(const angle of quick?[90,130]:[45,90,130,170]){
    for(const boatId of ['laser','dinghy']){
     const pose=angle<145?3:2;
     const trims=angle<=45?[.68,.78,.87,.96]:angle<=95?[.45,.56,.68,.79,.89]:angle<=145?[.26,.39,.52,.65,.77]:[.08,.22,.36,.50];
     const attempts=trims.map(trim=>sail(boatId,wind,angle,trim,pose,28));
     const good=attempts.filter(a=>!a.invalid&&a.error<12).sort((a,b)=>b.speed-a.speed);
     const settled=good.slice(0,2).map(a=>sail(boatId,wind,angle,a.trim,a.pose,65)).filter(a=>!a.invalid&&a.error<12).sort((a,b)=>b.speed-a.speed);
     const best=settled[0]||good[0]||null;
     results.push({boatId,wind,angle,best,attempts,settled,
      waves:!quick&&best&&angle>=90&&angle<=145?sail(boatId,wind,angle,best.trim,best.pose,45,.35):null});
    }
   }
   return results;
  }
  function tacks(){
   const results=[];
   const model=SailingBoats.get('laser'),clearance=SailingBoats.boomDistance||boomDistance;
   for(const wind of [8,9])for(const tack of [-1,1])for(const waves of quick?[0]:[0,.35]){
    for(const kind of ['in','out','abort','slow','straight']){
     const {env,initial}=setup('laser',wind,49*tack,.73,3,waves,3.1);
     const s=P.createState(initial,env);
     const target=(90+49*tack)*D,trace=[];
     for(let i=0;i<480;i++)P.step(s,control(s,initial.theta,.73,3),env,dt);
     const before={speed:P.instruments(s,null,env).waterSpeed,theta:s.theta,side:s.crewSide,boom:s.boom};
     const duration=kind==='straight'?3:12;
     let minimum=s.speed,maxHeel=0,turned=null,switched=null,enter=null,pass=null,minClearance=Infinity,minTorsoClearance=Infinity;
     let capsized=false,fastExitOld=false;
     for(let i=0;i<duration/dt;i++){
      const t=i*dt;
      const pose=kind==='out'&&t>.32?3:kind==='slow'&&t>7?2:1;
      const wanted=kind==='straight'||(kind==='abort'&&t>1.0)?initial.theta:target;
      const u=control(s,wanted,.73,pose);
      if(kind==='slow'&&t<4.7)u.steer*=.45;
      P.step(s,u,env,dt);
      const head=s.crewJoints.head;
      const gap=clearance(model,s.boom,head);
      const torsoGap=clearance(model,s.boom,s.crewJoints.chest);
      minClearance=Math.min(gap,minClearance);
      minTorsoClearance=Math.min(torsoGap,minTorsoClearance);
      if(enter===null&&s.crewPoseBlend<=1.20)enter=t;
      if(turned===null&&Math.sign(Math.cos(s.theta))!==Math.sign(Math.cos(before.theta)))turned=t;
      if(switched===null&&s.crewSide===-before.side)switched=t;
      if(pass===null&&s.crewSideBlend*(-before.side)>.80)pass=t;
      if(kind==='out'&&t>.48&&turned===null&&s.crewPoseBlend>2.25)fastExitOld=true;
      if(s.capsized)capsized=true;
      const speed=P.instruments(s,null,env).waterSpeed;
      if(t<7)minimum=Math.min(minimum,speed);
      maxHeel=Math.max(maxHeel,Math.abs(s.heel)/D);
      if(i%8===0)trace.push({t,speed,heel:s.heel/D,heading:s.theta/D,boom:s.boom/D,pose:s.crewPoseBlend,
       side:s.crewSideBlend,head:s.crewJoints.head.y,duck:s.crewDuck,gap,phase:s.crewTransfer?.phase,drive:s.sail.drive});
     }
     results.push({wind,tack,waves,kind,before,minimum,maxHeel,turned,switched,enter,pass,minClearance,minTorsoClearance,capsized,fastExitOld,
      after:{speed:s.speed,side:s.crewSide,heading:s.theta/D,pose:s.crewPose,actualPose:s.crewPoseBlend,boom:s.boom/D},trace});
    }
   }
   return results;
  }
  function boomDistance(model,angle,point){
   const dx=-Math.cos(angle),dz=Math.sin(angle),x=point.x-model.mastX;
   const length=P.clamp(x*dx+point.z*dz,0,model.boomLength);
   return Math.hypot(x-dx*length,point.y-model.boomY,point.z-dz*length);
  }
  function lee(){
   const wind=8.5,env={...P.DEFAULT_ENV,boatId:'laser',direction:0,speed:wind,waves:0,gusts:0,shelter:true};
   const shore={x:230,y:-35.67272727272727};
   const water=(x,y)=>-SailingWorld.heightAt(x,y);
   const windReading=(x,y,direction=0,z=2)=>P.windAt(x,y,0,{...env,direction},z).speed;
   const profile=[2,5,25,50,75,100,150].map(distance=>{
    const {x,y:coast}=shore,y=coast-distance;
    return {distance,depth:water(x,y),wind:windReading(x,y),reversed:windReading(x,y,180),windAt10m:windReading(x,y,0,10)};
   });
   const sound=[[-60,-240],[0,-250],[40,-260]].map(([x,y])=>({x,y,depth:water(x,y),wind:windReading(x,y),reversed:windReading(x,y,180)}));
   function voyage(outward){
    const start=outward?16:102,angle=(outward?-105:89)*D,velocity=outward?2.6:4.0,trim=outward?.32:.78;
    const s=P.createState({boatId:'laser',x:shore.x,y:shore.y-start,theta:angle,sheet:trim,
     vx:velocity*Math.cos(angle),vy:velocity*Math.sin(angle)},env);
    const points=outward?[16,25,50,75,100,150]:[102,100,95,90,85,80,75,65,50];
    const rows=[];
    let speedJump=0,before=s.speed;
    function capture(distance){return {distance,t:s.time,x:s.x,y:s.y,depth:water(s.x,s.y),speed:s.speed,
     wind:P.instruments(s,null,env).tws,field:P.windAt(s.x,s.y,s.time,env).speed,drive:s.sail.drive,capsized:s.capsized};}
    for(let i=0;i<14400&&rows.length<points.length;i++){
     const distance=shore.y-s.y;
     if(outward?distance>=points[rows.length]-1e-7:distance<=points[rows.length]+1e-7)rows.push(capture(distance));
     P.step(s,control(s,angle,trim,1),env,dt);
     speedJump=Math.max(speedJump,Math.abs(s.speed-before));
     before=s.speed;
     if(!outward&&i>180&&s.speed<.22)break;
    }
    return {rows,maxStepSpeedChange:speedJump,finish:capture(shore.y-s.y)};
   }
   const still=Object.keys(SailingBoats.CONFIGS).map(boatId=>{
    const calm={...env,boatId,speed:0};
    const s=P.createState({boatId,x:0,y:-5000,theta:0,vx:0,vy:0},calm);
    let peak=0,massError=0;
    for(let i=0;i<2400;i++){
     P.step(s,{steer:0,trim:0,crewPose:i<1200?1+Math.floor(i/12)%3:1},calm,dt);
     peak=Math.max(peak,s.speed);
     massError=Math.max(massError,Math.abs(s.hydro.weight/P.configFor(s).gravity-P.configFor(s).mass));
    }
    return {boatId,peak,final:s.speed,distance:Math.hypot(s.x,s.y+5000),massError,capsized:s.capsized};
   });
   return {shore,profile,open:windReading(0,-5000),sound,outward:voyage(true),inward:voyage(false),still};
  }
  return task==='tacks'?tacks():task==='lee'?lee():polar();
 },{task,dt,quick});
}
async function main(){
 const [url,file,task='polar',quickMode]=process.argv.slice(2);
 if(!url||!file)throw Error('Angiv URL eller fil og outputsti.');
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();
  const target=url.startsWith('http')?url:pathToFileURL(path.resolve(url)).href;
  const response=await page.goto(target);
  await page.waitForFunction(()=>window.SAILING_GAME);
  const rows=await measure(page,task,quickMode==='quick');
  const revision=await response.headerValue('x-fri-vind-revision')||await page.locator('meta[name="fri-vind-revision"]').getAttribute('content',{timeout:2000}).catch(()=>null);
  await fs.writeFile(file,JSON.stringify({revision,task,rows},null,2)+'\n');
  console.log(task,task==='lee'?rows:rows.map(r=>task==='polar'?[r.boatId,r.wind,r.angle,r.best?.speed,r.best?.heel]:[r.wind,r.tack,r.waves,r.kind,r.turned,r.switched,r.enter,r.pass,r.capsized]));
 }finally{await browser.close();}
}
module.exports={measure};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
