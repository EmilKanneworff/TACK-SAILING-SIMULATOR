'use strict';
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {chromium}=require('@playwright/test');

async function run(){
 const url=process.env.FRI_VIND_URL||'http://localhost:5173/';
 const output=path.resolve(process.env.FRI_VIND_REVIEW_DIR||'gennemgang/haandtering');
 const work=await fs.mkdtemp(path.join(os.tmpdir(),'frivind-laser-'));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
 try{
  const fps=15,viewport={width:1120,height:692};
  const page=await browser.newPage({viewport});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install();
  const response=await page.goto(url);
  await page.click('#startButton');
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+2000));
  await page.evaluate(()=>{
   const P=SailPhysics,{scene,env,state}=SAILING_GAME;
   Object.assign(env,{boatId:'laser',speed:9,direction:0,swellDirection:0,waves:undefined,waveHeight:.35,gusts:0,shelter:false});
   const theta=41*P.DEG;
   Object.assign(state,P.createState({boatId:'laser',x:0,y:-1475,theta,sheet:.73,
    vx:3.0*Math.cos(theta),vy:3.0*Math.sin(theta),crew:-1,crewPose:3},env));
   SailingWeather.initialize(state,env);
   const sheet=document.querySelector('#sheetControl');
   sheet.value='73';sheet.dispatchEvent(new Event('input',{bubbles:true}));
   document.querySelector('#sea').focus({preventScroll:true});
   document.head.insertAdjacentHTML('beforeend','<style>#clipCaption{position:fixed;top:63px;left:14px;z-index:12;background:#102f3de8;color:#eff9f0;padding:8px 12px;border-radius:8px;font:600 15px system-ui;line-height:1.4}</style>');
   const title=document.createElement('output');title.id='clipCaption';document.body.append(title);
   const update=scene.updateCamera.bind(scene);
   let sideCameraPosition;
   scene.updateCamera=(s,dt,mode,reset,e)=>{
    if(sideCameraPosition)scene.camera.position.copy(sideCameraPosition);
    update(s,dt,3,reset,e);
    sideCameraPosition=scene.camera.position.clone();
    const target=scene.boatRoot.position.clone().add(scene.V(0,.91,0));
    scene.camera.position.lerp(target,.47);
    scene.camera.lookAt(target);
   };
   window.readTack=label=>{
    const state=SAILING_GAME.state,head=state.crewJoints.head,c=SailingBoats.get('laser');
    const dx=-Math.cos(state.boom),dz=Math.sin(state.boom),x=head.x-c.mastX;
    const projection=P.clamp(x*dx+head.z*dz,0,c.boomLength);
    const clearance=Math.hypot(x-projection*dx,head.y-c.boomY,head.z-projection*dz);
    const speed=P.instruments(state,null,env).waterKnots;
    title.textContent='Laserjolle · 9 m/s · Bølger 0,35 m · '+label+' · '+speed.toFixed(1).replace('.',',')+' kn';
    return {time:state.time,speed,heading:state.theta/P.DEG,side:state.crewSide,blend:state.crewSideBlend,
     requested:state.crewPose,pose:state.crewPoseBlend,duck:state.crewDuck,clearance,boom:state.boom/P.DEG,capsized:state.capsized,
     sheet:state.sheet,phase:state.crewTransfer?.phase,visibleSide:scene.visibleCrewPose?.side,visibleHead:scene.visibleCrewPose?.head?.y,head:head.y};
   };
  });
  await page.keyboard.press('3');
  await page.clock.runFor(2100);
  const trace=[];
  let released=false,changedSide=false,caption='3 · Hæng';
  for(let i=0;i<fps*9;i++){
   if(i===12){await page.keyboard.press('1');await page.keyboard.down('ArrowLeft');caption='1 · Inde · Drej mod vinden';}
   if(i===17){await page.keyboard.press('3');caption='3 · Hæng valgt';}
   if(!changedSide&&trace.at(-1)?.heading>94){
    await page.keyboard.press('KeyE');changedSide=true;caption='E · Skift til styrbord';
   }
   if(!released&&trace.at(-1)?.heading>130){await page.keyboard.up('ArrowLeft');released=true;}
   await page.clock.runFor(Math.round((i+1)*1000/fps)-Math.round(i*1000/fps));
   const reading=await page.evaluate(caption=>readTack(caption),caption);
   trace.push(reading);
   if(!process.env.FRI_VIND_CHECK_ONLY)await page.screenshot({path:path.join(work,String(i).padStart(4,'0')+'.jpg'),type:'jpeg',quality:86});
  }
  if(!released)await page.keyboard.up('ArrowLeft');
  const before=trace[11],after=trace.at(-1);
  if(!(trace.some(s=>s.duck>.72)&&before.side===-after.side&&after.requested===3&&trace.every(s=>!s.capsized))||errors.length)
   throw Error(JSON.stringify({before,after,trace:trace.filter((s,i)=>i%10===0),errors}));
  const duckFrame=trace.findIndex((s,i)=>s.duck>.84&&Math.abs(s.blend)<.32&&i>17);
  console.log(JSON.stringify({before,after,duckFrame,errors}));
  if(process.env.FRI_VIND_CHECK_ONLY)return;
  if(duckFrame>=0)await fs.copyFile(path.join(work,String(duckFrame).padStart(4,'0')+'.jpg'),path.join(output,'stagvending.jpg'));
  const ffmpeg=spawnSync('ffmpeg',['-v','error','-y','-framerate',String(fps),'-i',path.join(work,'%04d.jpg'),'-c:v','libx264',
   '-crf','20','-pix_fmt','yuv420p','-movflags','faststart',path.join(output,'stagvending.mp4')],{encoding:'utf8'});
  if(ffmpeg.status!==0)throw ffmpeg.error||Error(ffmpeg.stderr);
  await fs.writeFile(path.join(output,'stagvending-tastatur.json'),JSON.stringify({
   revision:await response.headerValue('x-fri-vind-revision'),before,after,duckFrame,trace
  },null,2)+'\n');
 }finally{
  await browser.close();await fs.rm(work,{recursive:true,force:true});
 }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
