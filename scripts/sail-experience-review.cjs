'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {gzipSync} = require('node:zlib');
const {chromium} = require('@playwright/test');
const {introOption,chooseSail,operateExtraSail} = require('./browser-setup.cjs');

const viewport = {width:1120,height:720}, framesPerSecond = 12;
const sampleMs = 1000/framesPerSecond;
const currentControls = process.env.TACK_REVIEW_CONTROLS === 'current';
const wind = {
  laser:{speed:7.5,direction:0,waveHeight:.35,chop:.16,theta:41,trim:.73,way:3,x:0,y:-1475,side:-1},
  yacht:{speed:8,direction:0,waveHeight:.18,chop:.10,theta:-54,trim:.48,way:2.8,x:0,y:-5000,side:-1}
};
const buoy = {id:'r-1',label:'Rundingsmærke',color:'#ffc948',role:'rounding',x:5.1,y:-1467.6};

async function launch(page,url,boat,label,recorded,freeze=false) {
  await page.addInitScript(manualFrames => {
    localStorage.setItem('fri-vind.settings.v3', JSON.stringify({personal:{quality:'high',difficulty:'hard',camera:0}}));
    if(!manualFrames)return;
    let time=1000;
    const nativeFrame=requestAnimationFrame.bind(window);
    performance.now=()=>time;
    window.requestAnimationFrame=callback=>{
      if(callback.name!=='frame')return nativeFrame(callback);
      window.advanceReviewFrame=elapsed=>callback(time+=elapsed);
      return 0;
    };
  },freeze&&currentControls);
  page.on('pageerror',error=>recorded.errors.push(error.message));
  page.on('console',item=>{
    if(item.type()==='error'&&/Shader|WebGL|THREE/.test(item.text()))recorded.errors.push(item.text());
  });
  const response = await page.goto(url);
  if(boat==='yacht')await (await introOption(page,'#introBoat')).selectOption(boat);
  await page.selectOption('#introDifficulty','hard');
  await page.click('#startButton');
  await page.waitForFunction(()=>SAILING_GAME.scene.skyPhotoLoaded);
  if(freeze&&!currentControls)await page.clock.pauseAt(await page.evaluate(()=>Date.now()+250));
  const build=await response.headerValue('x-fri-vind-revision');
  if(build!==await page.locator('#buildRevision').textContent())throw Error('Spillets versionsmærke afviger fra serverens build');
  if(currentControls)label+=' · '+build;
  const sceneInfo = await page.evaluate(({boat,c,buoy,label})=>{
    const {env,state,scene}=SAILING_GAME,P=SailPhysics,theta=c.theta*P.DEG;
    Object.assign(env,{speed:c.speed,direction:c.direction,waveHeight:c.waveHeight,chop:c.chop,gusts:0,
      windSeed:55,shelter:false,forceDiagnostics:true});
    Object.assign(state,P.createState({
      boatId:boat,time:0,x:c.x,y:c.y,theta,vx:c.way*Math.cos(theta),vy:c.way*Math.sin(theta),
      sheet:P.sheetFromTrim(c.trim,boat),crewPose:boat==='laser'?3:2,crewSide:c.side,crewSideBlend:c.side
    },env));
    state.windClimate={speed:c.speed,direction:c.direction,gusts:0};
    SailingWeather.initialize(state,env);
    scene.lastTime=-1;
    window.reviewTrim=percentage=>{
      const slider=document.getElementById('sheetControl');
      slider.value=String(percentage);
      slider.dispatchEvent(new Event('input',{bubbles:true}));
    };
    reviewTrim(c.trim*100);
    if(boat==='laser'){
      const updateMarks=scene.updateMarks;
      const course={mode:'course',model:{type:'review',buoys:[buoy],route:[]}};
      scene.updateMarks=function(s,e,ignored,o){return updateMarks.call(this,s,e,course,o);};
    }
    const banner=document.createElement('div');
    banner.id='reviewLabel';banner.textContent=label;
    banner.style.cssText='position:fixed;top:60px;left:16px;z-index:30;padding:5px 9px;border-radius:5px;background:#102c38e8;color:white;font:600 13px system-ui;pointer-events:none';
    document.body.append(banner);
    return {quality:scene.graphicsProfile.id,camera:scene.cameraMode,resolution:[scene.canvas.width,scene.canvas.height]};
  },{boat,c:wind[boat],buoy,label});
  if(boat==='laser')await page.keyboard.press('3');
  return {build,...sceneInfo};
}

async function setTrim(page,percent){
  await page.evaluate(percent=>reviewTrim(percent),percent);
}
async function selectLine(page,line,modern){
  if(modern){await chooseSail(page,line);return;}
  if(!await page.locator('#telemetryPanel').isVisible())await page.click('#telemetryToggle');
  const closed=page.locator('#rigControls:not([open]) > summary');
  if(await closed.count())await closed.click();
  await page.selectOption('#trimSail',line);
  await page.keyboard.press('Escape');
}

async function yachtAction(page,frame,modern) {
  if(frame===6)await setTrim(page,35);
  if(modern&&frame===17)await page.click('#sailPlanToggle');
  if(frame===25){await selectLine(page,'jib',modern);await setTrim(page,22);}
  if(frame===48)await page.selectOption('#reefSetting','2');
  if(modern&&frame===69)await chooseSail(page,'gennaker');
  if(frame===77){
    if(modern)await operateExtraSail(page,'#gennakerButton');
    else await page.click('#gennakerButton');
  }
  if(frame===125){
    if(!modern)await selectLine(page,'extra',false);
    await setTrim(page,46);
  }
  if(currentControls&&frame===144)await page.keyboard.down('ArrowRight');
  if(currentControls&&frame===153)await page.keyboard.up('ArrowRight');
  if(!currentControls&&modern&&frame===141)await page.locator('#sailPlan:not([open]) > summary').click();
}

async function readState(page){
  return page.evaluate(()=>{
    const P=SailPhysics,{state:s,env,scene}=SAILING_GAME,read=P.instruments(s,null,env);
    const {rx,ry}=P.axes(s.theta),water=P.waterVelocity(s,P.waveAt(s.x,s.y,s.time,
      {...env,waveCurrent:s.seaState,waveProfile:s.waveProfile},Math.max(0,-s.heave)));
    const f=s.forces,contact=scene.hullWater.actors.get('local');
    const sails=Object.fromEntries(['main','jib','spinnaker'].map(name=>{
      const a=s.sail?.[name];
      return [name,a?{area:a.area,drive:a.drive,side:a.sideForce,roll:a.rollMoment,
        angle:a.angle/P.DEG,trim:a.trim,luff:a.luff,luffScale:a.luffScale,
        chordScale:a.chordScale,point:a.point}:null];
    }));
    const loaded=[scene.sailMesh,scene.jibMesh,scene.gennakerMesh].map(mesh=>mesh?.visible??false);
    return {time:s.time,x:s.x,y:s.y,throughWaterKnots:read.waterKnots,
      sideSpeed:(s.vx-water.x)*rx+(s.vy-water.y)*ry,heel:s.heel/P.DEG,theta:s.theta,
      heading:read.heading,omega:s.omega,twa:s.wind.twa/P.DEG,wind:s.wind.tws,
      rudder:s.rudder/P.DEG,helmTarget:s.helmTarget/P.DEG,steer:s.steerIntent,
      rudderWet:f.rudder?.wet,rudderAlong:f.rudder?.axialFlow,rudderAcross:f.rudder?.crossFlow,
      rudderSide:f.rudder?.side,yawRudder:f.yawRudder,yawSail:f.yawSail,
      yawDamping:f.yawDamping,yawBoard:f.yawBoard,yawHull:f.hullYaw,rotation:s.omega/P.DEG,
      yawLedger:f.steering?.yawMoments,bladeLoads:f.steering?.blades,yawWater:f.steering?.yawWater,
      sheet:s.sheet,boom:s.boom/P.DEG,pose:s.crewPose,poseBlend:s.crewPoseBlend,side:s.crewSide,
      sideBlend:s.crewSideBlend,crewCG:s.crewCG,physicalPose:s.crewJoints?.degree,
      visualPose:scene.visibleCrewPose?.degree,head:s.crewJoints?.head,duck:s.crewDuck??0,
      capsize:s.capsized,ground:!!s.ground?.contact,sails,loaded,
      hoist:s.spinnaker?.hoist,type:s.spinnaker?.type,phase:s.spinnaker?.phase,
      wake:contact?Object.fromEntries(Object.entries(contact.tracks).map(([key,track])=>[key,track.length])):{},
      spray:scene.spray.length};
  });
}

function laserCommands(frame,sample,previous) {
  if(frame<27)return [];
  const actions=[];
  if(frame===27)actions.push('pose1','trim63');
  if(previous.crossed===null&&sample.twa>=-4){
    actions.push('starboard','pose2');
    previous.crossed=frame;
  }
  if(previous.exit===null&&sample.heading>200&&sample.heading<=317){
    previous.exit=frame;
    actions.push('trim65');
  }
  const error=Math.atan2(Math.sin(sample.theta-133*Math.PI/180),Math.cos(sample.theta-133*Math.PI/180));
  const correction=1.8*error+1.2*sample.omega;
  const next=previous.exit===null?'ArrowLeft':correction>.21?'ArrowRight':correction<-.21?'ArrowLeft':null;
  if(previous.helm!==next){
    if(previous.helm)actions.push('release'+previous.helm);
    if(next)actions.push('hold'+next);
    previous.helm=next;
  }
  return actions;
}

async function applyLaser(page,actions) {
  for(const action of actions){
    if(action.startsWith('hold'))await page.keyboard.down(action.slice(4));
    else if(action.startsWith('release'))await page.keyboard.up(action.slice(7));
    else if(action.startsWith('pose'))await page.keyboard.press(action.slice(4));
    else if(action.startsWith('trim'))await setTrim(page,Number(action.slice(4)));
    else if(action==='starboard')await page.keyboard.press('KeyE');
  }
}

async function record(browser,url,boat,phase,folder,replay) {
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  if(!currentControls)await page.clock.install({time:new Date('2026-11-26T11:00:00Z')});
  const result={errors:[],frames:[],commands:[]},modern=phase==='efter';
  result.info=await launch(page,url,boat,(modern?'EFTER':'FØR')+' · '+(boat==='laser'?'Laserjolle':'Turbåd 43'),result,true);
  await fs.mkdir(folder,{recursive:true});
  const previous={crossed:null,exit:null,helm:null};
  const captureFrames=boat==='laser'?132:168;
  for(let frame=0;frame<captureFrames;frame++){
    if(boat==='yacht')await yachtAction(page,frame,modern||currentControls);
    else{
      const actions=replay?replay[frame]:laserCommands(frame,await readState(page),previous);
      result.commands.push(actions);
      await applyLaser(page,actions);
      if(frame===74)await page.evaluate(()=>document.body.classList.add('clear-view'));
    }
    if(currentControls)await page.evaluate(ms=>advanceReviewFrame(ms),sampleMs);
    else await page.clock.runFor(Math.round(sampleMs));
    const row=await readState(page);
    result.frames.push(row);
    const image=String(frame).padStart(4,'0')+'.jpg';
    await page.screenshot({path:path.join(folder,image),type:'jpeg',quality:80,timeout:20000});
  }
  await page.close();
  return result;
}

function join(before,after,filename){
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',String(framesPerSecond),
    '-i',path.join(before,'%04d.jpg'),'-framerate',String(framesPerSecond),'-i',path.join(after,'%04d.jpg'),
    '-filter_complex','[0:v][1:v]hstack=inputs=2','-c:v','libx264','-pix_fmt','yuv420p','-crf','24',
    '-movflags','+faststart',filename],{stdio:'inherit'});
}

async function timing(browser,url,boat,phase){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  const recorded={errors:[]};
  const info=await launch(page,url,boat,phase,recorded);
  await page.waitForTimeout(1400);
  const intervals=await page.evaluate(()=>{
    const {scene}=SAILING_GAME,original=scene.render;
    const gaps=[],cpu=[];
    let previous=performance.now();
    scene.render=function(...args){
      const now=performance.now();gaps.push(now-previous);previous=now;
      const result=original.apply(this,args);
      cpu.push(performance.now()-now);
      return result;
    };
    return new Promise(resolve=>setTimeout(()=>{
      scene.render=original;
      const stats=values=>{
        const sorted=values.slice(1).sort((a,b)=>a-b);
        const percentile=p=>sorted[Math.floor((sorted.length-1)*p)];
        return {samples:sorted.length,median:percentile(.5),p95:percentile(.95)};
      };
      resolve({gapMs:stats(gaps),renderSubmitMs:stats(cpu),size:[scene.canvas.width,scene.canvas.height],
        renderer:scene.renderer.getContext().getParameter(scene.renderer.getContext().RENDERER)});
    },5000));
  });
  await page.close();
  return {...info,...intervals,errors:recorded.errors};
}

async function main(){
  const [before,after,output='gennemgang/sejlbetjening']=process.argv.slice(2).filter(a=>!a.startsWith('--'));
  if(!before||!after)throw Error('node scripts/sail-experience-review.cjs FØR_URL EFTER_URL [MAPPE] [--timing]');
  const root=path.resolve(output);
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'tack-frames-'));
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
  try{
    await fs.mkdir(root,{recursive:true});
    if(process.argv.includes('--timing')){
      const results={viewport,browser:browser.version(),machine:os.cpus()[0]?.model,runs:[]};
      for(const boat of ['laser','yacht'])for(const [phase,url] of [['foer',before],['efter',after],['efter',after],['foer',before]]){
        results.runs.push({boat,phase,...await timing(browser,url,boat,phase)});
      }
      await fs.writeFile(path.join(root,'billedtid.json'),JSON.stringify(results,null,2)+'\n');
      console.log(JSON.stringify(results,null,2));
    }else{
      const requested=process.env.TACK_REVIEW_BOAT;
      for(const boat of requested?[requested]:['laser','yacht']){
        const folders=['foer','efter'].map(phase=>path.join(temporary,boat,phase));
        const a=await record(browser,before,boat,'foer',folders[0]);
        const b=await record(browser,after,boat,'efter',folders[1],boat==='laser'?a.commands:null);
        join(...folders,path.join(root,boat+'-foer-efter.mp4'));
        const logs=JSON.stringify({viewport,wind:wind[boat],buoy:boat==='laser'?buoy:null,before:a,after:b});
        await fs.writeFile(path.join(root,boat+'.json.gz'),gzipSync(logs));
        console.log(boat,a.info,b.info,'frames',a.frames.length,'first/last speed',b.frames[0].throughWaterKnots,b.frames.at(-1).throughWaterKnots,'errors',[...a.errors,...b.errors]);
      }
    }
  }finally{
    await browser.close();
    await fs.rm(temporary,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
