'use strict';

const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const scenarios = [
  { id: 'laser', name: 'kryds', twa: 49, tee: 2, wind: 3.5 },
  { id: 'laser', name: 'halvvind', twa: 88, tee: 2, wind: 3.5 },
  { id: 'laser', name: 'læns', twa: 166, tee: 1, wind: 4.5 },
  { id: 'dinghy', name: 'racer', twa: 83, tee: 3 },
  { id: 'yacht', name: 'turbåd', twa: 83, tee: 3 },
  { id: 'ac75', name: 'mono-vand', twa: 95, tee: 2 },
  { id: 'ac75', name: 'mono-foil', twa: 120, tee: 2, flight: true },
  { id: 'ac72', name: 'kat-vand', twa: 95, tee: 2 },
  { id: 'ac72', name: 'kat-foil', twa: 120, tee: 2, flight: true }
];

function installClock() {
  const raf = requestAnimationFrame.bind(window), now = performance.now.bind(performance);
  let clock, callback, current;
  performance.now = () => current ?? now();
  window.requestAnimationFrame = cb => {
    if (cb.name !== 'frame') return raf(cb);
    callback = cb;
    return 0;
  };
  window.runSheetFrames = (duration, hz, render) => {
    clock ??= now();
    const scene = SAILING_GAME.scene, update = scene.update, frames = [];
    if (!render) scene.update = () => {};
    try {
      for (let i = 0; i < Math.round(duration * hz); i++) {
        current = clock += 1000 / hz;
        callback(clock);
        frames.push(window.readSheetTrial());
      }
    } finally { current = undefined; scene.update = update; }
    return frames;
  };
}

function installReader() {
  window.readSheetTrial = () => {
    const game = SAILING_GAME, s = game.state, P = SailPhysics, cfg = P.configFor(s), main = s.sail.main;
    const reported = game.sheetDiagnostics;
    const limit = P.boomLimit(s.sheet, cfg);
    const wind = main.sections?.[1], bodyWind = s.sail.wind;
    let near = wind ? Math.atan2(-wind.airRight, -wind.airForward) : bodyWind.awa;
    if(!reported&&cfg.kind==='foiler'){
      const air=P.sailAirAt(s,game.env,main.point,undefined,s.boomRate);
      const flow=p=>{const a=FoilingPhysics.bodyVector(s,p);return a.x*air.x+a.y*air.y+a.z*air.z;};
      near=Math.atan2(-flow({x:0,y:0,z:1}),-flow({x:1,y:0,z:0}));
    }
    const guess = Math.abs(P.sheetTorque({boom:s.boom,boomRate:s.boomRate},limit,cfg));
    const mainRoll = main.sections?.reduce((sum,part)=>{
      const q=P.bodyOffset(s,part.point);
      return sum+Math.cos(s.pitch)*q.up*part.sideForce+
        Math.sin(s.pitch)*(q.r*part.drive-q.f*part.sideForce)+q.dHeel*part.vertical;
    },0)??s.sail.accumulator?.items.find(p=>p.label==='main')?.roll;
    return { wall: performance.now(), t:s.time, requested:Number(document.querySelector('#sheetControl').value),
      applied:P.trimFromSheet(s.sheet,cfg)*100, raw:s.sheet, limit:limit/P.DEG, boom:s.boom/P.DEG,
      boomRate:s.boomRate/P.DEG, stop:Math.min(cfg.boomMax,limit+5*P.DEG)/P.DEG,
      rigState:cfg.rigidWing?null:reported?.line??(guess>0?'belastet':'slapt'),
      sheetMoment:cfg.rigidWing?null:reported?.momentNm??guess,
      apparentAngle:reported?.apparentAngleDegrees??(near??0)/P.DEG,
      apparentSpeed:reported?.apparentSpeed??wind?.localAirSpeed??main.localAirSpeed??bodyWind.aws,
      trueAngle:bodyWind.twa/P.DEG, trueSpeed:bodyWind.tws, drive:main.drive, heelMoment:reported?.heelMomentNm??mainRoll,
      luff:main.luff, speed:s.speed, heel:s.heel/P.DEG, heading:90-s.theta/P.DEG, pitch:s.pitch/P.DEG,
      foil:s.foiling?.support?.phase, tack:s.tackCount, gybe:s.gybeCount,
      crew:s.crewSide, crewPosition:s.crewPose, crewActual:s.crewSideBlend,
      debt:game.simulationDebt, capsized:s.capsized,
      shown:game.scene.boomPivot?game.scene.boomPivot.rotation.y/P.DEG:null };
  };
}

function seed({ id, twa, tee, flight, startingSheet = 1, startingTrim, wind, startingSpeed }) {
  const { state, env, scene } = SAILING_GAME, P = SailPhysics;
  Object.assign(env,{boatId:id, speed:wind??(flight?10:id==='laser'?3.5:5), direction:0, gusts:0, waveHeight:0,
    chop:0,shelter:false,autoBalance:false,ironsHelp:false,difficulty:'hard',crewPose:tee});
  const theta = (90-twa)*P.DEG, speed = startingSpeed??(flight?11:1.9);
  const side=-Math.sign(twa);
  const sheet=startingTrim==null?startingSheet:P.sheetFromTrim(startingTrim,id);
  const start = { x:0,y:-9500,time:state.time,theta,sheet,boom:-side*P.boomLimit(sheet,id),
    vx:speed*Math.cos(theta), vy:speed*Math.sin(theta), crewSide:side, crewPose:tee,
    crewSideBlend:side,crewPoseBlend:tee };
  if(flight) start.heave = id==='ac72'?1.25:1.15;
  const initial=TackSimulation.createBoat(id,start,env);
  for(const key of Object.keys(state))delete state[key];
  Object.assign(state,initial);
  scene.lastTime=-1;scene.cameraReady=false;
}

function fleet(enabled) {
  const {state,env}=SAILING_GAME, fleet=FriVindLobby.fleet;
  if(!enabled){fleet.clear();return;}
  fleet.send=()=>{};
  const peers=['dinghy','yacht','ac75','ac72','laser'];
  fleet.joined({session:'trim-prøve',id:'own',host:true},[{id:'own',boat:state.boatId,host:true},...peers.map((boat,i)=>({boat,id:'p'+i,name:'Sejler '+(i+1)}))]);
  fleet.inWorld=true;
  for(const [i,boat] of peers.entries()){
    fleet.boats.set('p'+i,TackSimulation.createBoat(boat,{x:state.x+10+(i%2)*18,y:state.y-25-i*14,
      time:state.time,theta:state.theta,vx:state.vx,vy:state.vy,sheet:.45},env));
  }
}

async function sweep(page,scenario,hz=30,render=false) {
  const slider=page.locator('#sheetControl');
  await page.evaluate(seed,scenario);
  const frame=seconds=>page.evaluate(({seconds,hz,render})=>window.runSheetFrames(seconds,hz,render),{seconds,hz,render});
  await frame(.1);
  await slider.fill('100');
  await frame(.6);
  const phases=[];
  for(const target of [100,75,50,25,0,25,50,75,100]){
    if(!await slider.isEnabled())break;
    const inputTime=await page.evaluate(()=>SAILING_GAME.state.time);
    await slider.fill(String(target));
    const rows=await frame(1.6);
    phases.push({target,inputTime,rows});
  }
  return {...scenario,phases};
}

async function keyTrial(page,hz,quality) {
  const slider=page.locator('#sheetControl');
  await page.evaluate(seed,scenarios[1]);
  await slider.fill('100');
  await page.evaluate(hz=>window.runSheetFrames(.5,hz,true),hz);
  await page.locator('#sea').focus();
  await page.keyboard.down('ArrowDown');
  const rows=await page.evaluate(hz=>window.runSheetFrames(2,hz,true),hz);
  await page.keyboard.up('ArrowDown');
  return {hz,quality,rows};
}

async function turnTrial(page, type, side) {
  const gybe=type==='bomning', twa=side*(gybe?151:49), trim=gybe?30:63;
  const frame=duration=>page.evaluate(duration=>runSheetFrames(duration,60,false),duration);
  await page.evaluate(seed,{id:'laser',twa,tee:gybe?1:2,startingTrim:trim/100,startingSpeed:3.6,wind:gybe?6:4.5});
  await frame(.1);
  await page.locator('#sheetControl').fill(String(trim));
  const rows=await frame(.25);
  const direction=(gybe?side:-side)>0?'ArrowRight':'ArrowLeft';
  await page.locator('#sea').focus();
  await page.keyboard.down(direction);
  for(let i=0;i<28;i++){
    rows.push(...await frame(.1));
    const last=rows.at(-1);
    if(last.capsized||(Math.sign(last.trueAngle)===side&&
      (gybe?Math.abs(last.trueAngle)<151:Math.abs(last.trueAngle)>45)))break;
  }
  await page.keyboard.up(direction);
  rows.push(...await frame(1.0));
  const sideBeforeCommand=rows.at(-1).crew;
  await page.keyboard.press('Digit2');
  const manual=await frame(.75);
  return { type,side,rows,sideBeforeCommand,manual };
}

async function open(browser,url,{manual=true,quality='low',video}={}) {
  const viewport={width:1120,height:700};
  const context=await browser.newContext({viewport,recordVideo:video?{dir:video,size:viewport}:undefined});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(manual)await page.addInitScript(installClock);
  await page.addInitScript(quality=>localStorage.setItem('fri-vind.settings.v3',JSON.stringify({
    weather:{speed:5,direction:0,gusts:0,waveHeight:0,chop:0},personal:{quality,difficulty:'hard'}
  })),quality);
  const response=await page.goto(url);
  await page.waitForFunction(()=>window.SAILING_GAME);
  await page.evaluate(installReader);
  await page.click('#startButton');
  return {context,page,errors,revision:await response.headerValue('x-fri-vind-revision')};
}

async function live(page,six,throttle=false) {
  await page.evaluate(seed,scenarios[1]);
  if(six)await page.evaluate(fleet,true);
  const slider=page.locator('#sheetControl');
  await slider.fill('100');
  await page.waitForFunction(()=>SAILING_GAME.state.sheet>.999);
  await page.locator('#sea').focus();
  if(throttle){
    const session=await page.context().newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate',{rate:3});
  }
  await page.evaluate(()=>{
    window.sheetLive=[];
    addEventListener('keydown',e=>{
      if(e.code!=='ArrowDown'||window.sheetLive.length)return;
      const start=performance.now();
      const sample=()=>{window.sheetLive.push(window.readSheetTrial());if(performance.now()-start<2400)requestAnimationFrame(sample);};
      sample();
    });
  });
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(2500);
  await page.keyboard.up('ArrowDown');
  return {six,throttle,rows:await page.evaluate(()=>sheetLive),boats:await page.evaluate(()=>1+FriVindLobby.fleet.boats.size)};
}

async function cruiserTrial(page, name, twa, loadedTrim) {
  await page.locator('#boatMenuButton').click();
  await page.locator('[data-boat="yacht"]').click();
  const frame=duration=>page.evaluate(duration=>runSheetFrames(duration,60,false),duration);
  await page.evaluate(seed,{id:'yacht',twa,tee:2,startingTrim:.45,wind:7});
  await frame(.1);
  const slider=page.locator('#sheetControl');
  await slider.fill('45');
  const extra=name!=='jib', button=page.locator('[data-cruiser-sail="'+name+'"]');
  if(extra)await button.click();
  await page.locator('#telemetryToggle').click();
  await page.locator('#rigControls > summary').click();
  await page.locator('#trimSail').selectOption(extra?'extra':'jib');
  await page.locator('#telemetryClose').click();
  const data=()=>page.evaluate(()=>{
    const {state,sheetDiagnostics}=SAILING_GAME;
    return {diagnostics:sheetDiagnostics, mainSheet:state.sheet, mainDrive:state.sail.main.drive,
      jibDrive:state.sail.jib.drive, jibArea:state.sail.jib.area,
      hoist:state.spinnaker.hoist, type:state.spinnaker.type, fill:state.spinnaker.fill};
  });
  await slider.fill(String(loadedTrim));await frame(5.5);const loaded=await data();
  await slider.fill('0');await frame(2.6);const eased=await data();
  await slider.fill(String(loadedTrim));await frame(2.6);const hauled=await data();
  if(extra){await button.click();await frame(4.5);}
  return {name,twa,loadedTrim,loaded,eased,hauled,end:await data()};
}

async function main() {
  const [, , url, output, mode='sweep']=process.argv;
  if(!url||!output)throw Error('node scripts/sheet-trials.cjs URL MAPPE [sweep|turns|cruiser|live|video]');
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
  await fs.mkdir(output,{recursive:true});
  const result={mode,viewport:[1120,700],browser:browser.version(),cpu:os.cpus()[0].model,runs:[]};
  try{
    if(mode==='sweep'){
      const {context,page,revision,errors}=await open(browser,url);
      result.revision=revision;
      try{
        for(const scenario of scenarios){
          const trial=await sweep(page,scenario,30,scenario.name==='halvvind');
          result.runs.push(trial);
          const last=trial.phases.at(-1)?.rows.at(-1);
          console.log(scenario.name,trial.phases.length,Math.round(last?.heel),last?.capsized);
        }
        result.keys=[await keyTrial(page,30,'low'),await keyTrial(page,60,'low')];
        result.errors=errors;
      }finally{await context.close();}
      const high=await open(browser,url,{quality:'high'});
      try{result.keys.push(await keyTrial(high.page,120,'high'));result.errors.push(...high.errors);}
      finally{await high.context.close();}
    }else if(mode==='turns'){
      for(const type of ['stagvending','bomning'])for(const side of [1,-1]){
        const {context,page,revision,errors}=await open(browser,url);
        try{result.revision=revision;result.runs.push({...await turnTrial(page,type,side),errors});}
        finally{await context.close();}
      }
    }else if(mode==='cruiser'){
      for(const [name,twa,trim] of [['jib',64,55],['code0',99,52],['gennaker',119,48],['spinnaker',150,42]]){
        const {context,page,revision,errors}=await open(browser,url);
        try{result.revision=revision;result.runs.push({...await cruiserTrial(page,name,twa,trim),errors});}
        finally{await context.close();}
      }
    }else if(mode==='live'){
      for(const [six,throttle] of [[false,false],[true,false],[true,true]]){
        const {context,page,revision,errors}=await open(browser,url,{manual:false});
        try{result.revision=revision;result.runs.push({...await live(page,six,throttle),errors});}
        finally{await context.close();}
      }
    }else if(mode==='video'){
      const {context,page,revision,errors}=await open(browser,url,{manual:false,quality:'balanced',video:output});
      result.revision=revision;
      await page.evaluate(seed,{...scenarios[1],wind:4.2,startingTrim:.5});
      await page.locator('#sheetControl').fill('50');
      await page.waitForTimeout(1400);
      const video=page.video();
      await page.locator('#sheetControl').fill('0');
      await page.waitForTimeout(1600);
      await page.locator('#sheetControl').fill('88');
      await page.waitForTimeout(2500);
        result.errors=errors;
      await context.close();
      await fs.rename(await video.path(),path.join(output,'skode-ra.webm'));
    }else throw Error('Ukendt prøve '+mode);
    await fs.writeFile(path.join(output,mode+'.json'),JSON.stringify(result)+'\n');
    console.log(result.revision, mode, result.runs.length, result.errors||result.runs.flatMap(r=>r.errors||[]));
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
