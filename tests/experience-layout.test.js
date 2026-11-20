'use strict';
const { introOption } = require('../scripts/browser-setup.cjs');

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
    await expect(intro.locator('button:visible')).toHaveText(['Fri sejlads','Kapsejlads']);
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
    await page.click('#mapExpand');
    await page.click('#mapExpand');
    const bounds=await page.evaluate(()=>({map:document.getElementById('courseCard').getBoundingClientRect().bottom,
      sails:document.getElementById('downwindControls').getBoundingClientRect().top}));
    expect(bounds.map).toBeLessThan(bounds.sails);
    await page.keyboard.press('Escape');
    await expect(page.locator('#courseCard')).not.toHaveClass(/map-expanded|map-medium/);
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
  for(const [mode,change] of [[1,()=>page.click('#cameraButton')],[2,()=>page.keyboard.press('KeyC')]]){
    const clock=await page.evaluate(()=>SAILING_GAME.state.time);
    await change();
    await page.waitForFunction(({mode,clock})=>SAILING_GAME.scene.cameraMode===mode&&SAILING_GAME.state.time>clock+.1,{mode,clock});
    expect(await page.evaluate(()=>SAILING_GAME.state.steerIntent)).toBe(1);
  }
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(()=>SAILING_GAME.state.steerIntent===0);
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
  const button=page.locator('#mapExpand');
  const bounds=await button.evaluate(element=>{
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
  await button.click();
  await expect(page.locator('#courseCard')).toHaveClass(/map-medium/);
});

test('every boat loads the photographic environment and has skinned crew at physical stations',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(const [boat,count] of [['laser',1],['dinghy',2],['yacht',4],['ac75',8],['ac72',11]]){
    await sail(page,boat);
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
    for(const mode of [1,2,3,0]){
      await page.click('#cameraButton');
      await page.waitForFunction(value=>SAILING_GAME.scene.cameraMode===value,mode);
      const eye=await page.evaluate(()=>{
        const {scene,state,env}=SAILING_GAME,p=scene.camera.position;
        const water=SailPhysics.waveAt(p.x,-p.z,state.time,{...env,waveCurrent:state.seaState,waveProfile:state.waveProfile}).height;
        return {clearance:p.y-water,inside:scene.waterMaskedAt(p)};
      });
      expect(eye.inside).toBe(false);
      expect(eye.clearance).toBeGreaterThan(.25);
    }
  }
  expect(errors).toEqual([]);
});
