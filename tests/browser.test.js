'use strict';
const {test,expect}=require('@playwright/test');
const {dragMap,introOption}=require('../scripts/browser-setup.cjs');
const {pathToFileURL}=require('node:url');const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});

test('free sailing starts with clear water ahead when the wind is straight into the normal route',async({page})=>{
  await page.clock.install();
  await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
  await (await introOption(page,'#introWeatherEdit')).click();
  await page.locator('#windSpeed').fill('10');
  await page.locator('#windDirection').fill('153');
  await page.keyboard.press('Escape');
  await page.click('#startButton');
  const windAngle=await page.evaluate(()=>Math.abs(SAILING_GAME.state.wind.twa)/SailPhysics.DEG);
  expect(windAngle).toBeGreaterThan(55);
  await page.keyboard.down('ArrowUp');
  await page.clock.runFor(540);
  await page.keyboard.up('ArrowUp');
  await page.clock.runFor(7500);
  const sailing=await page.evaluate(()=>{
    const s=SAILING_GAME.state;
    const axes=SailPhysics.axes(s.theta);
    return {forward:s.vx*axes.fx+s.vy*axes.fy,ground:s.ground.contact,capsized:s.capsized,time:s.time};
  });
  expect(sailing).toMatchObject({ground:false,capsized:false});
  expect(sailing.time).toBeGreaterThan(7.5);
  // This departure reaches about 0.54 m/s with the short trim input.
  expect(sailing.forward).toBeGreaterThan(.5);
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(370);
  const rudder=await page.evaluate(()=>SAILING_GAME.state.rudder);
  await page.keyboard.up('ArrowRight');
  expect(rudder).toBeGreaterThan(.1);
});

test('a tap between physics frames gives one input step without sticking',async({page})=>{
  await page.clock.install();
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.click('#startButton');
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+85));
  const read=()=>page.evaluate(()=>{const s=SAILING_GAME.state;return {sheet:s.sheet,time:s.time,helm:s.rudder};});
  const before=await read();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  expect(await read()).toEqual(before);
  const samples=[];
  for(let i=0;i<5;i++){
    await page.clock.runFor(16);
    samples.push(await read());
  }
  expect(Math.max(...samples.map(s=>s.helm))).toBeGreaterThan(.01);
  expect(samples.at(-1).helm).toBe(0);
  expect(samples.at(-1).sheet-before.sheet).toBeCloseTo(.5/60,6);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await page.clock.runFor(120);
  await page.keyboard.press('Space');
  await page.clock.runFor(100);
  expect((await read()).helm).toBe(0);
});

test('focus loss clears held controls and discards accumulated time',async({page})=>{
  await page.clock.install();
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.click('#startButton');
  await page.clock.runFor(2500);
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(350);
  const read=()=>page.evaluate(()=>({pause:SAILING_GAME.paused,time:SAILING_GAME.state.time,input:SAILING_GAME.state.steerIntent}));
  const sailing=await read();
  expect(sailing.input).toBe(1);
  // Chromium in Playwright keeps its automation tabs focused.
  await page.evaluate(()=>window.dispatchEvent(new FocusEvent('blur')));
  await page.clock.runFor(1200);
  expect(await read()).toMatchObject({pause:true,time:sailing.time});
  await page.evaluate(()=>window.dispatchEvent(new FocusEvent('focus')));
  await page.clock.runFor(300);
  const resumed=await read();
  expect(resumed).toMatchObject({pause:false,input:0});
  expect(resumed.time-sailing.time).toBeGreaterThan(.20);
  expect(resumed.time-sailing.time).toBeLessThan(.4);
  await page.keyboard.up('ArrowRight');
});

test('steering keys resume after using the chart selector and trim slider',async({page})=>{
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.click('#startButton');
  await page.locator('#courseCard').hover();
  const view=page.locator('#mapView');
  await view.focus();
  await view.selectOption('area');
  await page.mouse.move(10,220);
  await expect(page.locator('#sea')).toBeFocused();
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(()=>SAILING_GAME.state.steerIntent===1&&SAILING_GAME.state.rudder>.05);
  await page.keyboard.up('ArrowRight');
  const slider=await page.locator('#sheetControl').boundingBox();
  await page.mouse.click(slider.x+slider.width*.55,slider.y+slider.height/2);
  await expect(page.locator('#sea')).toBeFocused();
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(()=>SAILING_GAME.state.steerIntent===-1&&SAILING_GAME.state.rudder<-.05);
  await page.keyboard.up('ArrowLeft');
});
test('dragging the map during a race keeps its anchor and view',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.click('#introCourse');
  await page.waitForFunction(()=>SAILING_GAME.state.time>.1);
  const chart=page.locator('#courseCard');
  const before=await chart.boundingBox();
  const controls=chart.locator('.map-controls');
  await expect(controls).toBeHidden();
  await expect(chart.locator('#raceTime')).toBeVisible();
  expect(await chart.locator('#map').boundingBox()).toEqual(before);
  const plot=await page.evaluate(()=>SAILING_GAME.map._plot());
  expect(plot).toEqual({left:0,top:0,right:before.width,bottom:before.height});
  await chart.hover();
  await expect(controls).toBeVisible();
  expect(await chart.locator('#map').boundingBox()).toEqual(before);
  await page.mouse.move(20,250);
  await expect(controls).toBeHidden();
  await chart.locator('#map').focus();
  await page.keyboard.press('Tab');
  await expect(controls).toBeVisible();
  await page.locator('#sea').focus();
  await expect(controls).toBeHidden();
  const view=await page.evaluate(()=>({time:SAILING_GAME.state.time,scale:SAILING_GAME.map.view.scale,width:SAILING_GAME.map.width}));
  await dragMap(page,290,135);
  await expect.poll(async()=>(await chart.boundingBox()).width).toBeCloseTo(before.width+290,0);
  const expanded=await chart.boundingBox();
  expect(expanded.height).toBeGreaterThan(before.height);
  expect(expanded.x+expanded.width).toBeCloseTo(before.x+before.width,0);
  expect(expanded.y).toBeCloseTo(before.y,0);
  await expect.poll(()=>page.evaluate(()=>SAILING_GAME.map.width)).toBeGreaterThan(view.width+250);
  await dragMap(page,-83,-39);
  await expect.poll(async()=>(await chart.boundingBox()).width).toBeCloseTo(expanded.width-83,0);
  await expect.poll(async()=>(await chart.boundingBox()).height).toBeCloseTo(expanded.height-39,0);
  const during=await page.evaluate(()=>({time:SAILING_GAME.state.time,scale:SAILING_GAME.map.view.scale,paused:SAILING_GAME.paused}));
  expect(during.time).toBeGreaterThan(view.time);
  expect(during.paused).toBe(false);
  expect(during.scale).toBeCloseTo(view.scale,4);
  const map=await page.locator('#map').boundingBox();
  const x=map.x+map.width/2,y=map.y+map.height/2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+35,y+10,{steps:4});
  await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>SAILING_GAME.map.mode)).toBe('manual');
  expect(errors).toEqual([]);
});
test('typing clears a held helm command and leaves digits in the input',async({page})=>{await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>!!window.SAILING_GAME);await page.click('#startButton');await page.keyboard.down('ArrowLeft');await page.waitForTimeout(300);expect(await page.evaluate(()=>SAILING_GAME.state.steerIntent)).toBe(-1);await page.evaluate(()=>{let i=document.createElement('input');i.id='testName';i.type='text';document.body.appendChild(i);i.focus()});await page.keyboard.type('123');await page.waitForTimeout(300);expect(await page.locator('#testName').inputValue()).toBe('123');expect(await page.evaluate(()=>SAILING_GAME.state.steerIntent)).toBe(0);await page.keyboard.up('ArrowLeft')});
test('slack sheet is taken in faster on all models without invalidating physics self tests',async({page})=>{await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>!!window.SAILING_GAME);const result=await page.evaluate(()=>{const out=[];for(const boatId of ['laser','dinghy','yacht','ac75','ac72']){const env={...SAILING_GAME.env,boatId},slow=SailPhysics.createState({},env),fast=SailPhysics.createState({},env);for(const s of [slow,fast]){s.sheet=0;s.boom=.15;s.boomRate=0}for(let i=0;i<15;i++){SailPhysics.step(slow,{trim:1,crewPose:2},env,1/60);SailPhysics.step(fast,{trim:1,trimFast:true,crewPose:2},env,1/60)}out.push({boatId,slow:slow.sheet,fast:fast.sheet,finite:Number.isFinite(fast.heel)&&Number.isFinite(fast.boom)});}return {out,failed:SAILING_GAME.selfTests().filter(x=>!x.pass)};});expect(result.failed).toEqual([]);for(const r of result.out){expect(r.fast).toBeGreaterThan(r.slow);expect(r.finite).toBe(true)}});
test('up arrow takes in a loose sheet in the running browser',async({page})=>{await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>!!window.SAILING_GAME);await page.click('#startButton');await page.evaluate(()=>{SAILING_GAME.state.sheet=0;SAILING_GAME.state.boom=.15;SAILING_GAME.state.boomRate=0});await page.keyboard.down('ArrowUp');await page.waitForTimeout(500);await page.keyboard.up('ArrowUp');const s=await page.evaluate(()=>({sheet:SAILING_GAME.state.sheet,time:SAILING_GAME.state.time}));expect(s.sheet).toBeGreaterThan(.2)});
test('five pictured cards select their actual boat',async({page})=>{await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>!!window.SAILING_GAME);await page.click('#startButton');for(const boat of ['laser','dinghy','yacht','ac75','ac72']){await page.click('#boatMenuButton');const card=page.locator(`[data-boat="${boat}"]`);expect(await card.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);await card.click();await expect(page.locator('#boatPicker')).toBeHidden();expect(await page.evaluate(()=>SAILING_GAME.state.boatId)).toBe(boat);await page.click('#boatMenuButton');await expect(card).toHaveAttribute('aria-pressed','true');await page.keyboard.press('Escape')} });
test('boat and crew visuals follow the current simulated pose on every boat',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.click('#startButton');
  for(const boat of ['laser','dinghy','yacht','ac75','ac72']){
    await page.click('#boatMenuButton');
    await page.click(`[data-boat="${boat}"]`);
    await expect(page.locator('#boatPicker')).toBeHidden();
    expect(await page.evaluate(()=>SAILING_GAME.paused)).toBe(false);
    await page.keyboard.press('3');
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(id=>SAILING_GAME.scene.boatId===id&&SAILING_GAME.state.crewPoseBlend>2.25,boat);
    await page.keyboard.up('ArrowLeft');
    const result=await page.evaluate(()=>{
      const {scene,state}=SAILING_GAME;
      const person=scene.foilingCrew?.[0]?.person||scene.person;
      const leg=person.rig.chain[0];
      const ankle=leg.end.getWorldPosition(new THREE.Vector3());
      const boot=person.feet[0].getWorldPosition(new THREE.Vector3());
      return {pose:state.crewPose,knee:leg.middle.position.length(),ankleGap:ankle.distanceTo(boot),
        sail:!!scene.sailMesh,heel:Number.isFinite(scene.hull.rotation.x)};
    });
    expect(result.pose).toBe(3);
    expect(result.knee).toBeGreaterThan(.2);
    expect(result.ankleGap).toBeLessThan(.06);
    expect(result.sail&&result.heel).toBe(true);
  }
  expect(errors).toEqual([]);
});
test('solo race countdown stops during pause and resumes',async({page})=>{
 await page.clock.install();
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>!!window.SAILING_GAME);
 await page.click('#introCourse');
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
 await page.keyboard.press('Space');
 const read=()=>page.evaluate(()=>({t:SAILING_GAME.course.countdown,sim:SAILING_GAME.state.time}));
 const before=await read();
 await page.clock.runFor(1000);
 expect(await read()).toEqual(before);
 await page.keyboard.press('Space');
 await page.clock.runFor(400);
 const after=await read();
 expect(after.t).toBeLessThan(before.t-.2);
 expect(after.t).toBeGreaterThan(before.t-.8);
});
test('held keyboard trim spans the full interval in about two seconds for all boats',async({page})=>{await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>!!window.SAILING_GAME);const results=await page.evaluate(()=>['laser','dinghy','yacht','ac75','ac72'].map(boatId=>{let env={...SAILING_GAME.env,boatId};let s=SailPhysics.createState({},env),out=[];for(const start of [0,1]){s.sheet=start;for(let i=0;i<120;i++)SailPhysics.step(s,{trim:start?-1:1,trimFast:true,crewPose:2},env,1/60);out.push(s.sheet)}return {boatId,out}}));for(const r of results){expect(r.out[0]).toBeGreaterThan(.98);expect(r.out[1]).toBeLessThan(.02)}});
test('all five boats accept the manual side commands on hard in calm air',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await (await introOption(page,'#introWeatherEdit')).click();
 await page.locator('#windSpeed').fill('0');
 await page.keyboard.press('Escape');
 await page.click('#startButton');
 for(const id of ['laser','dinghy','yacht','ac75','ac72']){
  if(id!=='laser'){
   await page.keyboard.press('KeyB');
   await page.locator('[data-boat="'+id+'"]').click();
  }
  await page.keyboard.press('3');
  for(const [key,side] of [['KeyE',1],['KeyQ',-1]]){
   await page.keyboard.press(key);
   await page.waitForFunction(({id,side})=>{
    const s=SAILING_GAME.state;
    return s.boatId===id&&s.crewDifficulty==='hard'&&s.crewSide===side&&s.crewPose===3;
   },{id,side});
  }
 }
});
test('the mobile chart resizes by touch and keeps zoom and navigation',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  try{
    const page=await context.newPage();
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    await page.tap('#startButton');
    const chart=page.locator('#courseCard');
    const before=await chart.boundingBox();
    const controls=chart.locator('.map-controls');
    await expect(controls).toBeHidden();
    await chart.locator('#map').tap();
    await expect(controls).toBeVisible();
    expect(await chart.locator('#map').boundingBox()).toEqual(before);
    const handle=await page.locator('#mapResize').boundingBox();
    const x=Math.round(handle.x+handle.width/2),y=Math.round(handle.y+handle.height/2);
    const input=await context.newCDPSession(page);
    await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-36,y:y+36}]});
    await expect.poll(async()=>(await chart.boundingBox()).width).toBeCloseTo(before.width+36,0);
    await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-74,y:y+68}]});
    await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(async()=>(await chart.boundingBox()).width).toBeCloseTo(before.width+74,0);
    const resized=await chart.boundingBox();
    expect(resized.x+resized.width).toBeCloseTo(before.x+before.width,0);
    expect(resized.height).toBeCloseTo(before.height+68,0);
    const scale=await page.evaluate(()=>SAILING_GAME.map.goal.scale);
    await page.tap('#mapZoomIn');
    expect(await page.evaluate(()=>SAILING_GAME.map.goal.scale)).toBeGreaterThan(scale);
    await page.touchscreen.tap(122,380);
    await expect(controls).toBeHidden();
    for(const id of ['cameraButton','boatMenuButton','settingsButton','raceButton','preferencesButton']){
      await expect(page.locator('#'+id)).toBeVisible();
    }
    await page.reload();
    await page.tap('#startButton');
    await expect.poll(async()=>(await chart.boundingBox()).width).toBeCloseTo(resized.width,0);
  }finally{await context.close();}
});
