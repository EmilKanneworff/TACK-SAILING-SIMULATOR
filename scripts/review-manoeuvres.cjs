'use strict';
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {chromium}=require('@playwright/test');

const output=path.resolve(process.env.FRI_VIND_REVIEW_DIR||'gennemgang/aflevering');
const url=process.env.FRI_VIND_URL||'http://localhost:5173/';
const viewport={width:1008,height:630},fps=15;
const cases=[
 {id:'vaegt',title:'Laserjolle · Kant til hæng',boat:'laser',seconds:4,camera:3,heading:32,speed:2.6,wind:5.5,from:0,sheet:.70},
 {id:'stagvending',title:'Laserjolle · Stagvending',boat:'laser',seconds:9,camera:1,heading:32,speed:2.9,wind:5.5,from:0,sheet:.73},
 {id:'bomning',title:'Laserjolle · Bomning',boat:'laser',seconds:8,camera:1,heading:-49,speed:3.2,wind:5.5,from:0,sheet:.24},
 {id:'boelger',title:'Laserjolle · Modsø',boat:'laser',seconds:6,camera:3,heading:142,speed:2.5,wind:8,from:270,sheet:.51,waves:.67},
 {id:'foil',title:'Foilmonohull · Løft og landing',boat:'ac75',seconds:10,camera:3,heading:54.43,speed:12,wind:12,from:225,sheet:.56,waves:.12},
 {id:'opretning',title:'Laserjolle · Automatisk opretning',boat:'laser',seconds:6,camera:3,heading:46,speed:0,wind:5,from:0,sheet:.36}
];

async function run(){
 await fs.mkdir(output,{recursive:true});
 const work=await fs.mkdtemp(path.join(os.tmpdir(),'fri-vind-manoeuvres-'));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',entry=>{if(entry.type()==='error'&&/WebGL|shader/i.test(entry.text()))errors.push(entry.text());});
  const response=await page.goto(url);
  await page.click('#startButton');
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
  const clips=[],results={revision:await response.headerValue('x-fri-vind-revision'),viewport,fps,scenes:{},errors};
  for(const setup of cases){
   await page.evaluate(setup=>{
    const game=SAILING_GAME,{scene}=game,P=SailPhysics,R=SailingRecovery,D=P.DEG;
    const env={...game.env,boatId:setup.boat,speed:setup.wind,direction:setup.from,swellDirection:setup.from,
     sea:setup.waves?'small':'calm',waves:setup.waves??0,gusts:0,shelter:false};
    const theta=setup.heading*D,s=P.createState({boatId:setup.boat,x:0,y:-1400,theta,
     vx:setup.speed*Math.cos(theta),vy:setup.speed*Math.sin(theta),sheet:setup.sheet},env);
    SailingWeather.initialize(s,env);
    if(setup.id==='opretning')Object.assign(s,{heel:1.49,heelRate:.30,capsized:true});
    document.body.classList.add('clear-view');
    let title=document.getElementById('reviewTitle');
    if(!title){
     document.head.insertAdjacentHTML('beforeend','<style>#hud{display:none!important}#reviewTitle{position:fixed;top:12px;left:12px;z-index:99;background:#0b2939e8;color:#eff9f0;padding:8px 12px;border-radius:8px;font:600 15px system-ui}</style>');
     title=document.createElement('output');title.id='reviewTitle';document.body.append(title);
    }
    scene.lastTime=-1;
    let tick=0;
    window.manoeuvreFrame=frame=>{
     while(tick<frame*4){
      const time=tick/60,ms=time*1000;
      const heading=setup.id==='stagvending'&&time>.9?147*D:setup.id==='bomning'&&time>.9?-131*D:theta;
      const steer=P.clamp(-1.8*P.wrap(heading-s.theta)+.97*s.omega,-.70,.70);
      const landing=setup.id==='foil'&&time>=4.8;
      if(landing)env.speed=0;
      const trim=landing?-1:P.clamp((setup.sheet-s.sheet)*5,-1,1);
      const control={steer:landing?.38:setup.id==='foil'?0:steer,trim,trimFast:true,steerDigital:false,crewPose:setup.id==='vaegt'&&time>.7?3:2};
      if(s.capsized||s.recovering)R.update(s,env,ms);
      P.step(s,control,env,1/60);
      SailingWeather.step(s,env,1/60);
      if(s.capsized||s.recovering)R.update(s,env,ms+1000/60);
      tick++;
     }
     scene.update(s,env,null,1/15,{cameraMode:setup.camera,quality:'high'});
     title.textContent=setup.title+' · '+(s.speed*1.94384).toFixed(1).replace('.',',')+' kn · '+s.time.toFixed(1).replace('.',',')+' s';
     return {time:s.time,speed:s.speed,theta:s.theta,heel:s.heel,pitch:s.pitch,boom:s.boom,heave:s.heave,crew:s.crewCG,
      wet:s.foiling?.hullWetFraction,phase:s.foiling?.support?.phase,rescue:s.lastRecovery?.elapsedSeconds};
    };
   },setup);
   const frames=path.join(work,setup.id);
   await fs.mkdir(frames);
   const trace=[];
   for(let i=0;i<setup.seconds*fps;i++){
    const reading=await page.evaluate(i=>manoeuvreFrame(i),i);
    if(i%5===0)trace.push(reading);
    const shot=await page.screenshot({type:'jpeg',quality:84});
    await fs.writeFile(path.join(frames,String(i).padStart(4,'0')+'.jpg'),shot);
    if(i===0||i===setup.seconds*fps-1)await fs.writeFile(path.join(output,setup.id+(i===0?'-start.jpg':'-slut.jpg')),shot);
   }
   const mp4=path.join(work,setup.id+'.mp4');
   ffmpeg(['-framerate',String(fps),'-i',path.join(frames,'%04d.jpg'),'-c:v','libx264','-crf','20','-pix_fmt','yuv420p',mp4]);
   clips.push(mp4);
   results.scenes[setup.id]={setup,trace};
   console.log(setup.id,JSON.stringify(trace.at(-1)));
  }
  const manifest=path.join(work,'clips.txt');
  await fs.writeFile(manifest,clips.map(file=>"file '"+file+"'").join('\n')+'\n');
  ffmpeg(['-f','concat','-safe','0','-i',manifest,'-c','copy','-movflags','faststart',path.join(output,'manoeuvrer.mp4')]);
  await fs.writeFile(path.join(output,'manoeuvrer.json'),JSON.stringify(results,null,2)+'\n');
  if(errors.length)throw Error(errors.join('\n'));
 }finally{await browser.close();await fs.rm(work,{recursive:true,force:true});}
}
function ffmpeg(args){
 const result=spawnSync('ffmpeg',['-v','error','-y',...args],{encoding:'utf8'});
 if(result.status!==0)throw result.error||Error(result.stderr);
}
run().catch(error=>{console.error(error);process.exitCode=1;});
