'use strict';
const { introOption, dragMap } = require('../scripts/browser-setup.cjs');

const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

test.use({ launchOptions: { executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] } });
const game = pathToFileURL(path.resolve('index.html')).href;

async function sail(page, boat='laser'){
  await page.goto(game);
  await (await introOption(page, '#introBoat')).selectOption(boat);
  await page.click('#startButton');
  await page.waitForFunction(() => SAILING_GAME.state.time>.15);
}

test('the two front-page buttons each enter live sailing with one click',async({page})=>{
  for(const [width,height,button,phase] of [[1440,900,'Fri sejlads','free'],[390,844,'Kapsejlads','countdown']]){
    await page.setViewportSize({width,height});
    await page.goto(game);
    const intro=page.locator('#intro');
    await expect(intro.locator('.intro-actions button')).toHaveText(['Fri sejlads','Kapsejlads']);
    await intro.getByRole('button',{name:button,exact:true}).click();
    await page.waitForFunction(target=>SAILING_GAME.course.phase===target&&SAILING_GAME.state.time>.1,phase);
    await expect(intro).toBeHidden();
    await expect(page.locator('#racePreview')).toBeHidden();
    expect(await page.evaluate(()=>SAILING_GAME.paused)).toBe(false);
    const switchMode=page.locator('#raceButton');
    await expect(switchMode).toHaveText('Kapsejlads');
    await expect(switchMode).toHaveAttribute('aria-pressed',String(phase!=='free'));
    await switchMode.click();
    await page.waitForFunction(target=>SAILING_GAME.course.phase===target,phase==='free'?'countdown':'free');
    await expect(page.locator('#racePreview')).toBeHidden();
  }
});

test('the start picker rejects land, starts at a map point and remembers it',async({page})=>{
  await page.goto(process.env.TACK_URL||game);
  await page.click('#introStartLocation');
  const picker=page.locator('#startLocationPicker'),launch=picker.locator('#startAtLocation');
  const selectOnMap=async point=>{
    const pixel=await page.evaluate(point=>SAILING_GAME.startLocationMap.worldToScreen(point),point);
    await picker.locator('canvas').click({position:pixel});
  };
  const land=await page.evaluate(()=>SailingWorld.LANDMARKS.find(mark=>mark.id==='faaborg'));
  await selectOnMap(land);
  await expect(launch).toBeDisabled();
  await expect(picker.getByRole('status')).toContainText('Det er land');
  await selectOnMap({x:-1130,y:-1700});
  await expect(launch).toBeEnabled();
  const place=await page.evaluate(()=>SAILING_GAME.startLocationMap.marker);
  const distance=()=>page.evaluate(({x,y})=>Math.hypot(SAILING_GAME.state.x-x,SAILING_GAME.state.y-y),place);
  await launch.click();
  await expect(picker).toBeHidden();
  expect(await distance()).toBeLessThan(5);
  await page.reload();
  await expect(page.locator('#introStartLocation')).toHaveText('Startsted · Valgt på kortet');
  await page.click('#startButton');
  expect(await distance()).toBeLessThan(5);
  await page.click('#preferencesButton');
  await page.click('#startLocationButton');
  await page.keyboard.press('Escape');
  await expect(page.locator('#startLocationButton')).toBeFocused();
  await page.click('#startLocationButton');
  await picker.locator('select').selectOption('svelmo');
  await launch.click();
  expect(await page.evaluate(()=>{
    const s=SAILING_GAME.state;
    return Math.hypot(s.x-1600,s.y+1480);
  })).toBeLessThan(5);
  await page.click('#raceButton');
  await page.waitForFunction(()=>SAILING_GAME.course.phase==='countdown');
  expect(await page.evaluate(()=>Math.hypot(SAILING_GAME.state.x-1600,SAILING_GAME.state.y+1480))).toBeGreaterThan(200);
});

test('all start areas offer a safe launch for the foil catamaran on a touch screen',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:700},isMobile:true,hasTouch:true});
  try{
    const page=await context.newPage();
    await page.goto(process.env.TACK_URL||game);
    await (await introOption(page,'#introBoat')).selectOption('ac72');
    await page.locator('#introStartLocation').tap();
    const picker=page.locator('#startLocationPicker'),launch=picker.locator('#startAtLocation');
    for(const area of ['bjorno','lyo','svelmo','avernako','default','open']){
      await picker.locator('select').selectOption(area);
      await expect(launch,area).toBeEnabled();
      await expect(picker.getByRole('status')).toContainText('Dybde');
    }
    await launch.tap();
    await page.waitForFunction(()=>SAILING_GAME.state.time>.3);
    const {state,contact}=await page.evaluate(()=>{
      const s=SAILING_GAME.state;
      return {state:{boatId:s.boatId,x:s.x,y:s.y},contact:s.ground.contact};
    });
    expect(state.boatId).toBe('ac72');
    expect(Math.hypot(state.x+1500,state.y+1800)).toBeLessThan(8);
    expect(contact).toBe(false);
  }finally{await context.close();}
});

test('the speed log damps short spikes, follows sustained changes and resets with the boat',async({page})=>{
  await page.clock.install();
  await page.goto(game);
  await page.locator('#startButton:enabled').waitFor();
  await page.evaluate(()=>{
    const instruments=SailPhysics.instruments;
    window.waterSpeedSample=5;
    SailPhysics.instruments=(...args)=>({...instruments(...args),logKnots:window.waterSpeedSample});
  });
  const speed=page.locator('#speed');
  await page.click('#startButton');
  await expect(speed).toHaveText('5.0');

  await page.clock.runFor(180);
  await page.evaluate(()=>window.waterSpeedSample=7);
  await page.clock.runFor(180);
  expect(Number(await speed.textContent())).toBeLessThan(5.5);
  await page.evaluate(()=>window.waterSpeedSample=5);
  await page.clock.runFor(1400);

  await page.evaluate(()=>{
    const speed=document.getElementById('speed');
    window.speedEdits=0;
    new MutationObserver(records=>window.speedEdits+=records.length).observe(speed,{childList:true});
    window.waterSpeedSample=9;
  });
  await page.clock.runFor(1000);
  const settled=Number(await speed.textContent());
  expect(settled).toBeGreaterThan(7);
  expect(settled).toBeLessThan(8.2);
  expect(await page.evaluate(()=>window.speedEdits)).toBeLessThanOrEqual(4);
  await page.clock.runFor(3200);
  expect(Number(await speed.textContent())).toBeGreaterThanOrEqual(8.9);

  await page.evaluate(()=>window.waterSpeedSample=0);
  await page.keyboard.press('KeyR');
  await expect(speed).toHaveText('0.0');
});

test('the live chart shows wind direction without covering the race clock',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await sail(page);
  await page.mouse.move(10,450);
  const chart=page.locator('#courseCard'),wind=chart.locator('#mapWind');
  await expect(chart.locator('.map-controls')).toBeHidden();
  await expect(wind).toBeVisible();

  const directions=await page.evaluate(()=>{
    const {map,course}=SAILING_GAME,original=map.state;
    const indicator=document.getElementById('mapWind');
    const arrow=indicator.querySelector('.map-wind-arrow');
    const rows=[[0,-8],[8,0],[0,8],[-8,0],[0,0]].map(([vx,vy])=>{
      map.update({...original,wind:{vx,vy}},map.env,course);
      const transform=getComputedStyle(arrow).transform;
      const matrix=transform==='none'?null:new DOMMatrix(transform);
      return {label:indicator.getAttribute('aria-label'),direction:matrix?[0-matrix.c,0-matrix.d]:null};
    });
    map.update(original,map.env,course);
    return rows;
  });
  expect(directions).toEqual([
    {label:'Vind fra N',direction:[0,1]},
    {label:'Vind fra V',direction:[1,0]},
    {label:'Vind fra S',direction:[0,-1]},
    {label:'Vind fra Ø',direction:[-1,0]},
    {label:'Vindstille',direction:null}
  ]);

  await page.click('#raceButton');
  await page.evaluate(()=>{
    document.documentElement.style.fontSize='150%';
    document.getElementById('courseCard').style.setProperty('--map-width','168px');
  });
  const clock=chart.locator('#raceTime');
  await expect(clock).toBeVisible();
  await expect(wind).toBeVisible();
  const [clockBox,windBox]=await Promise.all([clock.boundingBox(),wind.boundingBox()]);
  expect(clockBox.x+clockBox.width).toBeLessThan(windBox.x);
});

test('course setup updates the next race without changing the current mode',async({page})=>{
  await sail(page);
  await page.click('#preferencesButton');
  await page.click('#raceSetup');
  await page.click('[data-racetype="triangle"]');
  await page.selectOption('#courseVariant','long');
  expect(await page.evaluate(()=>SAILING_GAME.course.mode)).toBe('free');
  expect(await page.evaluate(()=>SAILING_GAME.previewMap.course.model.variant)).toBe('long');
  await page.keyboard.press('Escape');
  await expect(page.locator('#raceSetup')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.click('#raceButton');
  const first=await page.evaluate(()=>({serial:SAILING_GAME.course.gunAtMs,type:SAILING_GAME.course.model.type,size:SAILING_GAME.course.model.variant}));
  expect(first).toMatchObject({type:'triangle',size:'long'});
  await page.click('#preferencesButton');
  await page.getByRole('button',{name:'Nyt løb',exact:true}).click();
  await page.waitForFunction(serial=>SAILING_GAME.course.phase==='countdown'&&SAILING_GAME.course.gunAtMs>serial,first.serial);
  await expect(page.locator('#racePreview')).toBeHidden();
});

test('right rail and map remain usable through live resizing and enlarged text',async({page})=>{
  await sail(page,'yacht');
  for(const [width,height,font] of [[1440,900,100],[1280,720,150],[390,844,100],[320,600,162]]){
    await page.setViewportSize({width,height});
    await page.evaluate(percent=>document.documentElement.style.fontSize=percent+'%',font);
    await expect.poll(()=>page.evaluate(()=>{
      const rail=document.querySelector('.tools').getBoundingClientRect();
      return rail.top-document.getElementById('courseCard').getBoundingClientRect().bottom;
    })).toBeGreaterThanOrEqual(0);
    const check=await page.evaluate(()=>{
      const chart=document.getElementById('courseCard').getBoundingClientRect();
      const dock=document.getElementById('sailingDock').getBoundingClientRect();
      const rail=document.querySelector('.tools').getBoundingClientRect();
      return {chartRight:chart.right,chartBottom:chart.bottom,dockTop:dock.top,railTop:rail.top,
        pageWidth:document.documentElement.scrollWidth, height:rail.height};
    });
    expect(check.chartRight).toBeLessThanOrEqual(width);
    expect(check.railTop).toBeGreaterThanOrEqual(check.chartBottom);
    expect(check.pageWidth).toBeLessThanOrEqual(width);
    expect(check.height).toBeGreaterThan(120);
    await page.click('#settingsButton');
    await expect(page.locator('#windSpeed')).toBeVisible();
    await page.locator('#windSpeed').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#settingsButton')).toBeFocused();
    await dragMap(page,110,95);
    const bounds=await page.evaluate(()=>({map:document.getElementById('courseCard').getBoundingClientRect().bottom,
      sails:document.getElementById('downwindControls').getBoundingClientRect().top}));
    expect(bounds.map).toBeLessThan(bounds.sails);
    const railTop=await page.locator('.tools').evaluate(element=>element.getBoundingClientRect().top);
    expect(bounds.map).toBeLessThanOrEqual(railTop);
  }
});

test('escape closes the active panel and returns focus to its entry',async({page})=>{
  await sail(page);
  await page.click('#boatMenuButton');
  await expect(page.locator('#boatPicker')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#boatMenuButton')).toBeFocused();
  await page.click('#preferencesButton');
  await page.click('#lobbyButton');
  await page.locator('#lobbyName').fill('En sejler med et langt navn');
  await page.keyboard.press('Escape');
  await expect(page.locator('#lobbyPanel')).toBeHidden();
  await expect(page.locator('#lobbyButton')).toBeFocused();
  await page.click('#settingsHelp');
  await expect(page.locator('#help')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settingsHelp')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#preferencesButton')).toBeFocused();
});

test('camera click and shortcut preserve the player’s held steering',async({page})=>{
  await sail(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(()=>SAILING_GAME.state.steerIntent===1);
  for(const [mode,change] of [[1,()=>page.click('#cameraButton')],[2,()=>page.keyboard.press('KeyC')],
    [3,()=>page.click('#cameraButton')],[4,()=>page.keyboard.press('KeyC')]]){
    const clock=await page.evaluate(()=>SAILING_GAME.state.time);
    await change();
    await page.waitForFunction(({mode,clock})=>SAILING_GAME.scene.cameraMode===mode&&SAILING_GAME.state.time>clock+.1,{mode,clock});
    expect(await page.evaluate(()=>SAILING_GAME.state.steerIntent)).toBe(1);
  }
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(()=>SAILING_GAME.state.steerIntent===0);
  await expect(page.locator('#cameraButton')).toHaveText('Kamera · Førsteperson');
  await page.reload();
  await page.click('#startButton');
  await page.waitForFunction(()=>SAILING_GAME.scene.cameraMode===4);
  await page.keyboard.press('KeyC');
  await page.waitForFunction(()=>SAILING_GAME.scene.cameraMode===0);
});

test('portrait resizing keeps the boat in frame and enlarged race text leaves the map controls clickable',async({page})=>{
  await page.setViewportSize({width:1280,height:720});
  await sail(page);
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>Math.abs(SAILING_GAME.scene.camera.aspect-390/844)<.002);
  const hullX=await page.evaluate(()=>{
    const {scene}=SAILING_GAME;
    return scene.hull.getWorldPosition(new THREE.Vector3()).project(scene.camera).x;
  });
  expect(Math.abs(hullX)).toBeLessThan(.65);

  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>document.documentElement.style.fontSize='150%');
  await page.click('#raceButton');
  await page.waitForFunction(()=>SAILING_GAME.course.phase==='countdown');
  await page.locator('#courseCard').hover();
  const handle=page.locator('#mapResize');
  const bounds=await handle.evaluate(element=>{
    const {left,right,top,bottom}=element.getBoundingClientRect();
    const chart=document.getElementById('courseCard').getBoundingClientRect();
    return {bottom,chartBottom:chart.bottom,hit:element.contains(document.elementFromPoint((left+right)/2,(top+bottom)/2))};
  });
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.chartBottom);
  expect(bounds.hit).toBe(true);
  const labels=await page.evaluate(()=>{
    const map=SAILING_GAME.map;
    const {x,y}=SAILING_GAME.state;
    const existing=map.remoteBoats;
    map.remoteBoats=Array.from({length:5},(_,i)=>({x:x+4*i,y:y+4*i,player:{name:`Kaptajn ${i} med et meget langt spillernavn`}}));
    map.draw();
    const labels=map.lastFrame.labels;
    map.remoteBoats=existing;
    return labels;
  });
  expect(labels.some(label=>label.text==='START / MÅL')).toBe(true);
  for(const [index,label] of labels.entries()){
    expect(labels.slice(index+1).some(other=>label.left<other.right&&label.right>other.left&&label.top<other.bottom&&label.bottom>other.top)).toBe(false);
  }
  const chart=page.locator('#courseCard');
  const width=(await chart.boundingBox()).width;
  await dragMap(page,110,80);
  await expect.poll(async()=>(await chart.boundingBox()).width).toBeCloseTo(width+110,0);
});

test('every boat loads the photographic environment and has skinned crew at physical stations',async({page})=>{
  test.setTimeout(60000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(const [boat,count] of [['laser',1],['dinghy',3],['yacht',4],['ac75',8],['ac72',11]]){
    await sail(page,boat);
    await page.waitForFunction(()=>SAILING_GAME.scene.skyPhotoLoaded);
    const result=await page.evaluate(()=>{
      const {scene,state}=SAILING_GAME;
      const people=scene.isFoiler?scene.foilingCrew.map(crew=>crew.person):[scene.person,...(scene.racingCrew||[]).map(crew=>crew.person)];
      const skin=people.map(person=>({mesh:person.rig.mesh.isSkinnedMesh,bones:person.rig.bones.length,pelvis:person.rig.root.position.toArray()}));
      const physical=scene.isFoiler?scene.foilingCrew.map(crew=>crew.body.pelvis):(state.crewJoints.members||[state.crewJoints]).map(body=>body.pelvis);
      return {skin,physical,sky:scene.skyPhotoLoaded,colorSpace:scene.scene.environment.colorSpace,
        photo:scene.waterUniforms.photoMix.value,images:[...document.querySelectorAll('.boat-option img')].every(img=>img.complete&&img.naturalWidth>0)};
    });
    expect(result.sky).toBe(true);
    expect(result.colorSpace).toBe('srgb');
    expect(result.photo).toBeGreaterThan(.5);
    expect(result.images).toBe(true);
    expect(result.skin).toHaveLength(count);
    for(let i=0;i<count;i++){
      const {x,y,z}=result.physical[i];
      expect(result.skin[i].mesh).toBe(true);
      expect(result.skin[i].bones).toBe(14);
      expect(Math.hypot(result.skin[i].pelvis[0]-x,result.skin[i].pelvis[1]-y,result.skin[i].pelvis[2]-z)).toBeLessThan(.05);
    }
    for(const mode of [1,2,3,4,0]){
      await page.click('#cameraButton');
      await page.waitForFunction(value=>SAILING_GAME.scene.cameraMode===value,mode);
      const eye=await page.evaluate(firstPerson=>{
        const {scene,state,env}=SAILING_GAME,p=scene.camera.position;
        const water=SailPhysics.waveAt(p.x,-p.z,state.time,{...env,waveCurrent:state.seaState,waveProfile:state.waveProfile}).height;
        if(!firstPerson)return {clearance:p.y-water,inside:scene.waterMaskedAt(p)};
        const helmsman=scene.isFoiler?scene.helmPerson:scene.person;
        const anchor=helmsman.head.getWorldPosition(new THREE.Vector3());
        const heading=scene.heading.rotation.y;
        const forward=new THREE.Vector3(Math.cos(heading),0,-Math.sin(heading));
        const view=scene.camera.getWorldDirection(new THREE.Vector3());
        const visible=part=>scene.camera.layers.test(part.layers);
        let faceHidden=false,handsVisible=false;
        const render=scene.renderer.render;
        scene.renderer.render=()=>{
          faceHidden=[helmsman.head,helmsman.cap,helmsman.brim,helmsman.glasses].every(part=>!visible(part));
          handsVisible=helmsman.hands.every(visible);
        };
        try{scene.render();}
        finally{scene.renderer.render=render;}
        return {anchorDistance:anchor.distanceTo(p),clearance:p.y-water,forward:view.dot(forward),
          faceHidden,handsVisible,faceRestored:visible(helmsman.head)};
      },mode===4);
      if(mode===4){
        expect(eye.anchorDistance).toBeLessThan(.25);
        expect(eye.clearance).toBeGreaterThan(.12);
        expect(eye.forward).toBeGreaterThan(.9);
        expect(eye).toMatchObject({faceHidden:true,handsVisible:true,faceRestored:true});
      }else{
        expect(eye.inside).toBe(false);
        expect(eye.clearance).toBeGreaterThan(.25);
      }
    }
  }
  expect(errors).toEqual([]);
});
