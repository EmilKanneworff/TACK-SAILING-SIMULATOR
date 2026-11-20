'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');
const { introOption } = require('./browser-setup.cjs');

const phase = process.argv[2];
if (!['foer','efter'].includes(phase)) throw Error('Vælg foer eller efter.');
const root = path.resolve(process.env.FRI_VIND_CAPTURE_ROOT||'gennemgang/grafik');
const output = path.join(root, phase);
const url = process.env.FRI_VIND_URL || 'http://localhost:5173/';
const viewport = { width: 1440, height: 900 };
const compareLoad=process.argv.includes('--compare-load');
const boats = ['laser','dinghy','yacht','ac75','ac72','laser'];
const scenarios = {
  laser: { wind: 5, direction: 0, waves: .16, heading: .63, speed: 4, sheet: .71, camera: 2, x: 0, y: -5000 },
  dinghy: { wind: 7, direction: 0, waves: .19, heading: .1, speed: 3.6, sheet: .52, camera: 2, x: 0, y: -5000 },
  yacht: { wind: 9, direction: 270, waves: .85, heading: .43, speed: 3.6, sheet: .48, camera: 2, x: -300, y: -860 },
  ac72: { wind: 12, direction: 225, waves: .12, heading: .95, speed: 7.2, sheet: .47, camera: 3, x: 0, y: -5000 }
};
const waitTo = (page, time) => page.waitForFunction(value=>SAILING_GAME.state.time>=value,time,{timeout:60000});

async function select(page, boat, quality) {
  await (await introOption(page, '#introBoat')).selectOption(boat);
  await page.locator('#quality').evaluate((select,value)=>{
    select.value=value;
    select.dispatchEvent(new Event('change',{bubbles:true}));
  },quality);
}

async function seed(page, setup) {
  for(let n=0;n<setup.camera;n++)await page.click('#cameraButton');
  await page.evaluate(options=>{
    const game=SAILING_GAME,P=SailPhysics;
    if(options.overcast)SailingWeather.applyPreset(game.env,'overcast');
    Object.assign(game.env,{speed:options.wind,direction:options.direction,gusts:0,waves:options.waves});
    const s=P.createState({boatId:game.state.boatId,x:options.x,y:options.y,theta:options.heading,
      vx:options.speed*Math.cos(options.heading),vy:options.speed*Math.sin(options.heading),sheet:options.sheet},game.env);
    SailingWeather.initialize(s,game.env);
    Object.assign(game.state,s);
  }, setup);
}

const snapshot = page => page.evaluate(()=>{
  const {state:s,scene,env}=SAILING_GAME;
  return {boat:s.boatId,camera:scene.cameraMode,position:[s.x,s.y],heading:s.theta,time:s.time,wind:env.speed,direction:env.direction,
    waves:env.waves,weather:env.weather,pose:s.crewPoseBlend,side:s.crewSideBlend,tacks:s.tackCount??null,heel:s.heel,
    speed:Math.hypot(s.vx,s.vy),foil:s.foiling?.support?.phase??null,wet:s.foiling?.hullWetFraction??null};
});

async function closeCrew(page,boat){
  await page.evaluate(()=>{
    const {scene}=SAILING_GAME;
    scene.captureOriginalCamera=scene.updateCamera;
    scene.updateCamera=function(s,...args){
      this.captureOriginalCamera(s,...args);
      const centre=this.person.rig.root.getWorldPosition(new THREE.Vector3());
      if(this.racingCrew?.[0])centre.lerp(this.racingCrew[0].person.rig.root.getWorldPosition(new THREE.Vector3()),.5);
      const side=Math.sign(s.crewSideBlend)||1,distance=this.model.racingYacht?5.9:3.45;
      const across=new THREE.Vector3(Math.sin(s.theta),0,Math.cos(s.theta));
      const forward=new THREE.Vector3(Math.cos(s.theta),0,-Math.sin(s.theta));
      this.camera.position.copy(centre).addScaledVector(across,side*distance).addScaledVector(forward,-distance*.38);
      this.camera.position.y+=distance*.27;
      this.camera.lookAt(centre.add(new THREE.Vector3(0,.12,0)));
      this.camera.fov=44;
      this.camera.updateProjectionMatrix();
    };
  });
  try{await page.screenshot({path:path.join(output,`${boat}-naer.png`)});}
  finally{await page.evaluate(()=>{const {scene}=SAILING_GAME;scene.updateCamera=scene.captureOriginalCamera;delete scene.captureOriginalCamera;});}
}

const performanceSample=page=>page.evaluate(async()=>{
  const renderer=SAILING_GAME.scene.renderer,frames=[],submit=[],calls=[];
  const render=renderer.render;
  let submitMs=0,draws=0;
  renderer.render=function(...args){
    const entered=performance.now();
    try{return render.apply(this,args);}
    finally{submitMs+=performance.now()-entered;draws+=this.info.render.calls;}
  };
  try{
    const start=performance.now();
    await new Promise(resolve=>{
      let previous;
      const sample=t=>{
        if(previous!==undefined){frames.push(t-previous);submit.push(submitMs);calls.push(draws);}
        previous=t;submitMs=0;draws=0;
        if(t-start<4500)requestAnimationFrame(sample);else resolve();
      };
      requestAnimationFrame(sample);
    });
  }finally{renderer.render=render;}
  const sum=frames.reduce((a,b)=>a+b,0);
  const percentile=(values,q)=>values.sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*q))];
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  return {fps:1000*frames.length/sum,p95Ms:percentile(frames,.95),p95SubmitMs:percentile(submit,.95),
    draws:renderer.info.render.calls,drawsAllPassesP95:percentile(calls,.95),
    triangles:renderer.info.render.triangles,gpu:gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};
});

async function clip(browser,report,boat,setup){
  const context=await browser.newContext({viewport,recordVideo:{dir:output,size:{width:960,height:600}}});
  const page=await context.newPage();
  try{
    page.on('pageerror',error=>report.errors.push(`${boat}: ${error.message}`));
    const start=Date.now(),response=await page.goto(url);
    await page.locator('#startButton:enabled').waitFor();
    report.revision=response.headers()['x-fri-vind-revision'];
    report.loadMs[boat]=Date.now()-start;
    await select(page,boat,'high');
    await page.click('#startButton');
    await seed(page,setup);
    await waitTo(page,.85);
    await page.screenshot({path:path.join(output,`${boat}.png`)});
    const samples=[await snapshot(page)];
    if(boat==='laser'){
      await page.keyboard.down('ArrowLeft');
      try{await page.waitForFunction(()=>SAILING_GAME.state.theta>2.12||SAILING_GAME.state.time>5,null,{timeout:25000});}
      finally{await page.keyboard.up('ArrowLeft');}
      samples.push(await snapshot(page));
    }
    if(boat==='laser'||boat==='dinghy'){
      const sequence=boat==='laser'?[[1,6.5],[2,8.4],[3,10.4],[2,12.4]]:[[1,3],[2,5],[3,7],[2,9]];
      for(const [pose,time] of sequence){
        await page.keyboard.press(String(pose));
        await waitTo(page,time);
        samples.push(await snapshot(page));
        if(pose===3){
          await page.screenshot({path:path.join(output,`${boat}-vaegt.png`)});
          await closeCrew(page,boat);
        }
      }
    }else{
      if(boat==='yacht')await page.keyboard.press('3');
      for(const time of [2,4,6,8]){await waitTo(page,time);samples.push(await snapshot(page));}
    }
    report.scenes[boat]={setup,samples};
    if(boat==='yacht')report.performance.one=await performanceSample(page);
  }finally{
    const video=page.video();
    await context.close();
    await fs.rename(await video.path(),path.join(output,`${boat}.webm`));
  }
}

async function coast(browser,report){
  const page=await browser.newPage({viewport});
  try{
    page.on('pageerror',error=>report.errors.push(`Kyst: ${error.message}`));
    const clock=new Date('2026-11-20T11:00:00Z');
    await page.clock.install({time:clock});
    await page.clock.pauseAt(new Date(+clock+200));
    report.scenes.coast={};
    for(const [name,overcast] of [['kyst-lys',false],['kyst-overskyet',true]]){
      await page.goto(url);
      await page.click('#startButton');
      await seed(page,{wind:5,direction:170,waves:.24,heading:1.53,speed:1.8,sheet:.62,camera:0,x:4,y:7,overcast});
      await page.clock.runFor(1950);
      report.scenes.coast[name]=await snapshot(page);
      await page.screenshot({path:path.join(output,`${name}.png`)});
    }
  }finally{await page.close();}
}

async function multiplayer(browser,report){
  const service=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33148'},stdio:['ignore','pipe','inherit']});
  const contexts=[],pages=[];
  try{
    await new Promise((resolve,reject)=>{
      service.stdout.once('data',resolve);
      service.once('exit',()=>reject(Error('Den isolerede live-tjeneste stoppede.')));
      service.once('error',reject);
    });
    let code;
    const connectStarted=Date.now();
    for(const [i,boat] of boats.entries()){
      const context=await browser.newContext(i?{viewport:{width:600,height:500}}:
        {viewport,recordVideo:compareLoad?undefined:{dir:output,size:{width:960,height:600}}});
      contexts.push(context);
      const page=await context.newPage();pages.push(page);
      page.on('pageerror',error=>report.errors.push(`lobby ${i}: ${error.message}`));
      await page.addInitScript(()=>window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33148');
      if(i&&compareLoad)await page.addInitScript(()=>{
        const requestFrame=requestAnimationFrame.bind(window);
        window.requestAnimationFrame=callback=>requestFrame(function draw(time){
          if(window.holdGuestRendering)requestFrame(draw);
          else callback(time);
        });
      });
      await page.goto(url);
      await select(page,boat,'low');
      await (await introOption(page,'#introLobby')).click();
      await page.fill('#lobbyName',`Sejler ${i+1}`);
      if(i){await page.fill('#lobbyCodeInput',code);await page.click('#lobbyJoin');}
      else await page.click('#lobbyCreate');
      await page.locator('#lobbyRoom').waitFor();
      if(!i)code=await page.locator('#lobbyCode').innerText();
    }
    for(const page of pages){
      await page.locator('#lobbySail').waitFor();
      await page.locator('#lobbySail').evaluate(button=>button.click());
    }
    const [host]=pages;
    await host.waitForFunction(()=>FriVindLobby.fleet.actors.size===5,null,{timeout:60000});
    report.loadMs.six=Date.now()-connectStarted;
    await host.evaluate(()=>{
      const game=SAILING_GAME,P=SailPhysics,{fleet}=FriVindLobby;
      const offsets=[[0,0],[-30,24],[12,45],[26,10],[-40,-13],[17,-27]];
      Object.assign(game.env,{speed:8,direction:205,waves:.16,gusts:0});
      const now=game.state.time,theta=.42;
      for(const [index,state] of [game.state,...fleet.boats.values()].entries()){
        const [x,y]=offsets[index],v=state.boatId.startsWith('ac')?4.4:2.8;
        const reset=P.createState({boatId:state.boatId,x,y:y-5000,theta,vx:Math.cos(theta)*v,vy:Math.sin(theta)*v,
          time:now,sheet:.46},game.env);
        SailingWeather.initialize(reset,game.env);
        Object.assign(state,reset);
      }
      const scene=game.scene,normalCamera=scene.updateCamera;
      scene.updateCamera=function(state,...args){
        normalCamera.call(this,state,...args);
        this.camera.position.set(state.x-14,88,-state.y+83);
        this.camera.lookAt(state.x-5,4,-state.y-10);
        this.camera.updateMatrixWorld();
      };
    });
    const after=await host.evaluate(()=>SAILING_GAME.state.time+2);
    await waitTo(host,after);
    if(compareLoad){
      await Promise.all(pages.slice(1).map(page=>page.evaluate(()=>window.holdGuestRendering=true)));
      const revisions=await fetch(url,{cache:'no-store'});
      report.revision=revisions.headers.get('x-fri-vind-revision');
      report.measurement='Værtens visning, 1440 × 900, Lav, seks aktive simulationsbåde, samme kamera og miljø. Gæsterne er forbundet, og deres rendering er sat i bero. Én, seks, seks og én synlig båd, 4,5 sekunder pr. interval.';
      const showPeers=visible=>host.evaluate(value=>{
        for(const actor of FriVindLobby.fleet.actors.values())actor.boatRoot.visible=value;
      },visible);
      const measure=async visible=>{
        await showPeers(visible);
        await host.waitForTimeout(750);
        return performanceSample(host);
      };
      try{
        const firstSingle=await measure(false);
        await host.screenshot({path:path.join(output,'en-synlig.png')});
        const firstFleet=await measure(true);
        const secondFleet=await measure(true);
        const secondSingle=await measure(false);
        report.performance.oneVisible=[firstSingle,secondSingle];
        report.performance.six=[firstFleet,secondFleet];
      }finally{
        await showPeers(true);
      }
    }else{
      report.performance.six=await performanceSample(host);
    }
    report.scenes.six=await host.evaluate(()=>{
      const boats=[SAILING_GAME.state,...FriVindLobby.fleet.boats.values()].map(s=>{
        const p=new THREE.Vector3(s.x,s.heave+1,-s.y).project(SAILING_GAME.scene.camera);
        return {boat:s.boatId,position:[s.x,s.y],screen:[p.x,p.y],visible:Math.abs(p.x)<1&&Math.abs(p.y)<1};
      });
      return {boats,camera:'Samme høje måleperspektiv med seks aktive både i billedet'};
    });
    await host.screenshot({path:path.join(output,'seks.png')});
    if(process.argv.includes('--near-fleet')){
      await host.evaluate(()=>{
        const game=SAILING_GAME,{fleet}=FriVindLobby,host=game.state;
        const offsets=[[-13,18],[6,30],[16,9],[-21,-9],[10,-18]];
        [...fleet.boats.values()].forEach((s,i)=>Object.assign(s,{x:host.x+offsets[i][0],y:host.y+offsets[i][1]}));
        const scene=game.scene,previous=scene.updateCamera;
        scene.updateCamera=function(state,...args){
          previous.call(this,state,...args);
          this.camera.position.set(state.x-11,31,-state.y+38);
          this.camera.fov=61;this.camera.updateProjectionMatrix();
          this.camera.lookAt(state.x-1,4,-state.y-6);
          this.camera.updateMatrixWorld();
        };
      });
      const after=await host.evaluate(()=>SAILING_GAME.state.time+2);
      await waitTo(host,after);
      report.performance.sixNear=await performanceSample(host);
      report.scenes.sixNear=await host.evaluate(()=>{
        const {camera,hullWater}=SAILING_GAME.scene;
        const actors=[SAILING_GAME.state,...FriVindLobby.fleet.boats.values()].map(s=>{
          const p=new THREE.Vector3(s.x,s.heave+1,-s.y).project(camera);
          return {boat:s.boatId,visible:Math.abs(p.x)<1&&Math.abs(p.y)<1};
        });
        return {boats:actors,reflection:!!hullWater?.uniforms.boatReflectionEnabled.value,
          tracks:hullWater?.actors.size??0};
      });
      await host.screenshot({path:path.join(output,'seks-naer.png')});
    }
  }finally{
    const video=pages[0]?.video();
    await Promise.allSettled(contexts.map(context=>context.close()));
    service.kill();
    if(video)await fs.rename(await video.path(),path.join(output,'seks.webm'));
  }
}

(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const fleetOnly=process.argv.includes('--fleet-only'),coastOnly=process.argv.includes('--coast-only'),measure=process.argv.includes('--measure');
  const boatOnly=process.argv.find(value=>value.startsWith('--boat='))?.slice(7);
  const report=fleetOnly||boatOnly||coastOnly?JSON.parse(await fs.readFile(path.join(output,'maaling.json'),'utf8')):
    {browser:browser.version(),viewport,scenes:{},performance:{},loadMs:{},errors:[]};
  try{
    if(!fleetOnly&&!coastOnly&&!compareLoad)for(const [boat,setup] of Object.entries(scenarios)){
      if((boatOnly&&boat!==boatOnly)||(measure&&boat!=='yacht'))continue;
      await clip(browser,report,boat,setup);
      console.log(phase,boat,report.scenes[boat].samples.at(-1));
    }
    if(!fleetOnly&&!boatOnly&&!measure&&!compareLoad)await coast(browser,report);
    if(!boatOnly&&!coastOnly)await multiplayer(browser,report);
  }finally{
    await browser.close();
    await fs.writeFile(path.join(output,'maaling.json'),JSON.stringify(report,null,2)+'\n');
  }
  console.log(phase,report.performance,report.errors);
  if(report.errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
