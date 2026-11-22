'use strict';
const {test,expect}=require('@playwright/test');
const {spawn}=require('node:child_process');
const {introOption}=require('../scripts/browser-setup.cjs');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});

test('six connected boats physically sail a shared course and receive the same result',async({browser})=>{
 test.setTimeout(300000);
 const services=[
  spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33138'},stdio:['ignore','pipe','inherit']}),
  spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34138',FRONTEND_DIR:process.env.FRI_VIND_TEST_FRONTEND||'.'},stdio:['ignore','pipe','inherit']})
 ];
 const contexts=[],pages=[];
 try{
  await Promise.all(services.map(service=>new Promise((resolve,reject)=>{service.stdout.once('data',resolve);service.once('error',reject); })));
  let code;
  for(let i=0;i<6;i++){
   const context=await browser.newContext({viewport:{width:720,height:580}});
   contexts.push(context);
   const page=await context.newPage();pages.push(page);
   await page.addInitScript(()=>{
    Object.defineProperty(window,'FRI_VIND_REALTIME_URL',{get:()=> 'ws://127.0.0.1:33138',set:()=>{}});
    localStorage.setItem('fri-vind.settings.v2',JSON.stringify({
     weather:{speed:7,direction:0,sea:'calm',gusts:0},personal:{quality:'low'}
    }));
    const native=requestAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>native(function draw(time){
     if(window.suspendRaceRendering)native(draw);
     else callback(time);
    });
   });
   await page.goto('http://127.0.0.1:34138/');
   await (await introOption(page,'#introLobby')).click();
   await page.fill('#lobbyName','Sejler '+(i+1));
   if(i){await page.fill('#lobbyCodeInput',code);await page.click('#lobbyJoin');}
   else await page.click('#lobbyCreate');
   await expect(page.locator('#lobbyRoom')).toBeVisible({timeout:15000});
   if(i===0)code=await page.locator('#lobbyCode').innerText();
  }
  for(const page of pages)await page.click('#lobbySail');
  const [host]=pages;
  const revision=await host.locator('meta[name=fri-vind-revision]').getAttribute('content');
  await host.waitForFunction(()=>{
   const fleet=FriVindLobby.fleet;
   return [...fleet.actors.values()].filter(a=>a.boatRoot.visible).length+
    [...fleet.silhouettes?.values()||[]].filter(a=>a.root.visible).length===5;
  });
  await host.addScriptTag({path:'scripts/course-pilot.js'});
  await host.click('#preferencesButton');
  await host.click('#raceSetup');
  await host.click('[data-racetype=triangle]');
  await host.selectOption('#courseVariant','short');
  await host.click('#beginRace');
  for(const guest of pages.slice(1))await guest.waitForFunction(()=>SAILING_GAME.course.phase==='countdown');
  await Promise.all(pages.map(page=>page.evaluate(()=>window.suspendRaceRendering=true)));

  await host.evaluate(()=>{
   const {fleet}=FriVindLobby,game=SAILING_GAME,env=game.env;
   const own=game.course,entries=[[fleet.id,own],...fleet.races];
   const pilots=new Map(entries.map(([id,race],i)=>[id,FriVindCoursePilot(race,env.direction,{wait:i*42000,retry:true})]));
   const publish=fleet.broadcast.bind(fleet);
   // The live service receives one real snapshot per batch. The host still
   // integrates all hulls, collisions and race events at the ordinary 60 Hz.
   fleet.broadcast=()=>{};
   let now=performance.now(),elapsed=0;
   const report=()=>entries.map(([id,race])=>({
    id,finished:race.finished,time:race.time,index:race.index,phase:race.phase,
    ...pilots.get(id).status()
   }));
   window.sailBatch=()=>{
    const dt=1/60;
    for(let tick=0;tick<1800&&entries.some(([,race])=>!race.finished);tick++){
     now+=dt*1000;elapsed+=dt;
     const ownState=game.state,previous={...ownState};
     for(const [id,race] of entries.slice(1)){
      fleet.controls.set(id,{...pilots.get(id).control(fleet.boats.get(id),now),received:now});
     }
     const input=pilots.get(fleet.id).control(ownState,now);
     const weather=SailingSettings.advanceWind(ownState,env,dt);
     if(ownState.capsized||ownState.recovering)SailingRecovery.update(ownState,weather,now);
     SailPhysics.step(ownState,input,weather,dt);
     SailingWeather.step(ownState,weather,dt);
     const collision=fleet.step(input,now,dt);
     own.update(previous,ownState,dt,{nowMs:now,discontinuity:collision||previous.recovering||ownState.recovering});
    }
    publish();
    return {elapsed,rows:report()};
   };
  });
  let result;
  for(let batch=0;batch<52;batch++){
   result=await host.evaluate(()=>sailBatch());
   if(result.rows.every(row=>row.finished))break;
  }
  console.log('PHYSICAL FLEET',JSON.stringify({revision,...result}));
  expect(result.rows).toHaveLength(6);
  for(const row of result.rows)expect(row.finished,JSON.stringify(row)).toBe(true);
  const shared=await host.locator('#raceResults').textContent();
  for(const guest of pages.slice(1))await expect(guest.locator('#raceResults')).toHaveText(shared);
  expect(shared.match(/Sejler \d/g)).toHaveLength(6);
 }finally{
  await Promise.all(contexts.map(context=>context.close()));
  services.forEach(service=>service.kill());
 }
});
