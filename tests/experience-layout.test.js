'use strict';
const { introOption, dragMap } = require('../scripts/browser-setup.cjs');

const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

test.use({ launchOptions: { executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] } });
const game = pathToFileURL(path.resolve('index.html')).href;

test.describe('phone sailing',()=>{
  test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:664},deviceScaleFactor:3});

  test('large touch buttons operate helm and sheet at once in both orientations',async({page})=>{
    await page.goto(process.env.TACK_URL||game);
    await page.locator('#startButton').tap();
    await page.waitForFunction(()=>SAILING_GAME.state.time>.15);
    expect(await page.evaluate(()=>SAILING_GAME.scene.graphicsProfile.id)).toBe('low');
    const cdp=await page.context().newCDPSession(page);
    const buttons=['steerLeftKey','touchEase','touchHaul','steerRightKey'];
    const point=async(id,finger)=>{
      const box=await page.locator('#'+id).boundingBox();
      return {x:box.x+box.width/2,y:box.y+box.height/2,id:finger};
    };
    for(const [width,height] of [[390,664],[844,390]]){
      await page.setViewportSize({width,height});
      await expect.poll(()=>page.evaluate(()=>document.getElementById('sea').clientWidth)).toBe(width);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      for(const id of [...buttons,'pose3','reefSetting','preferencesButton']){
        const box=await page.locator('#'+id).boundingBox();
        expect(box.width,id).toBeGreaterThanOrEqual(44);
        expect(box.height,id).toBeGreaterThanOrEqual(buttons.includes(id)?64:44);
        expect(box.x+box.width,id).toBeLessThanOrEqual(width);
        expect(box.y+box.height,id).toBeLessThanOrEqual(height);
      }
      const [left,right,haul,ease]=await Promise.all(['steerLeftKey','steerRightKey','touchHaul','touchEase'].map((id,i)=>point(id,i+1)));
      expect(left.x).toBeLessThan(right.x);
      expect(right.x).toBeLessThan(haul.x);
      expect(haul.x).toBeLessThan(ease.x);
      await expect(page.locator('#boatMenuButton')).toBeHidden();
      const startingSheet=await page.evaluate(()=>SAILING_GAME.state.sheet);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left,haul]});
      // Leave enough line to ease after releasing the other contact.
      await page.waitForFunction(sheet=>SAILING_GAME.state.steerIntent===-1&&
        SAILING_GAME.state.sheet>Math.max(.25,sheet+.025),startingSheet);
      // Chromium's WebTouch backend can release one identified contact.
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[haul]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...left,x:right.x,y:right.y}]});
      await expect(page.locator('#touchHaul')).not.toHaveClass(/input-active/);
      await expect(page.locator('#steerLeftKey')).toHaveClass(/input-active/);
      await expect(page.locator('#steerRightKey')).not.toHaveClass(/input-active/);
      await page.waitForFunction(()=>SAILING_GAME.state.steerIntent===-1);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForFunction(()=>SAILING_GAME.state.steerIntent===0);
      const hauled=await page.evaluate(()=>SAILING_GAME.state.sheet);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[right,ease]});
      await page.waitForFunction(sheet=>SAILING_GAME.state.steerIntent===1&&SAILING_GAME.state.sheet<sheet-.025,hauled);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[right]});
      await page.waitForFunction(()=>SAILING_GAME.state.steerIntent===0);
      await expect(page.locator('#touchEase')).toHaveClass(/input-active/);
      const afterRelease=await page.evaluate(()=>SAILING_GAME.state.sheet);
      await page.waitForFunction(sheet=>SAILING_GAME.state.sheet<sheet-.012,afterRelease);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      await expect(page.locator('#touchEase')).not.toHaveClass(/input-active/);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left,right,haul,ease]});
      await page.waitForFunction(()=>SAILING_GAME.state.steerIntent===0);
      const neutral=await page.evaluate(()=>SAILING_GAME.state.sheet);
      await page.waitForTimeout(95);
      expect(await page.evaluate(()=>SAILING_GAME.state.sheet)).toBeCloseTo(neutral,6);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    const left=await point('steerLeftKey',1);
    const ease=await point('touchEase',2);
    const steer=page.locator('#steerLeftKey');
    await steer.evaluate(button=>button.addEventListener('gotpointercapture',event=>{
      button.dataset.testPointer=String(event.pointerId);
    },{once:true}));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left,ease]});
    await expect(steer).toHaveClass(/input-active/);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...left,y:left.y-25},ease]});
    await expect(steer).toHaveAttribute('data-test-pointer', /^\d+$/);
    await steer.evaluate(button=>button.releasePointerCapture(Number(button.dataset.testPointer)));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...left,y:left.y-44},ease]});
    await expect(steer).not.toHaveClass(/input-active/);
    await expect(page.locator('#touchEase')).toHaveClass(/input-active/);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await expect(page.locator('#touchEase')).not.toHaveClass(/input-active/);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(()=>!SAILING_GAME.paused);

    await page.locator('#pose3').tap();
    await expect(page.locator('#pose3')).toHaveAttribute('aria-pressed','true');
    const beforeCrew=await page.evaluate(()=>SAILING_GAME.state.time);
    await page.locator('#mobileCrewToggle').tap();
    await expect(page.locator('#mobileCrewPanel')).toBeVisible();
    await expect(page.locator('#crewPort').or(page.locator('#crewStarboard')).and(page.locator(':enabled')).first()).toBeVisible();
    await page.locator('#mobileForeAft').tap({position:{x:15,y:22}});
    await page.waitForFunction(t=>SAILING_GAME.state.time>t+.3&&SAILING_GAME.state.crewForeAft<-.1,beforeCrew);
    await page.locator('#mobileCrewToggle').tap();
    await expect(page.locator('#mobileCrewPanel')).toBeHidden();
    expect(await page.evaluate(()=>SAILING_GAME.state.crewForeAft)).toBeLessThan(-.1);
    await page.locator('#expandChart').tap();
    await expect(page.locator('#expandChart')).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('#mapView')).toBeVisible();
    await page.locator('#expandChart').tap();
    await expect(page.locator('#expandChart')).toHaveAttribute('aria-expanded','false');
    await page.locator('#preferencesButton').tap();
    await expect(page.locator('#touchBoatMenu')).toBeVisible();
    await page.locator('#touchRaceMenu').tap();
    await page.waitForFunction(()=>SAILING_GAME.course.phase==='countdown');
    await expect(page.locator('#settings')).toBeHidden();
  });

  test('a long press on a sailing button keeps steering without opening text actions',async({page})=>{
    await page.goto(process.env.TACK_URL||game);
    await page.locator('#startButton').tap();
    await page.waitForFunction(()=>SAILING_GAME.state.time>.15);
    const helm=page.locator('#steerRightKey');
    const label=helm.locator('span');
    await helm.evaluate(button=>button.addEventListener('touchstart',event=>{
      button.dataset.touchDefaultPrevented=String(event.defaultPrevented);
    },{passive:true,once:true}));
    const {x,y,width,height}=await label.boundingBox();
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x+width/2,y:y+height/2}]});
    try {
      await page.waitForFunction(()=>SAILING_GAME.state.steerIntent===1);
      const start=await page.evaluate(()=>SAILING_GAME.state.time);
      await page.waitForFunction(t=>SAILING_GAME.state.time>=t+1,start);
      await expect(helm).toHaveClass(/input-active/);
      await expect(helm).toHaveAttribute('data-touch-default-prevented','true');
      const browserActions=await label.evaluate(text=>{
        const menu=target=>target.dispatchEvent(new PointerEvent('contextmenu',{pointerType:'touch',bubbles:true,cancelable:true}));
        return { selection:window.getSelection().toString(),
          selectable:getComputedStyle(text).userSelect,
          selectAllowed:text.dispatchEvent(new Event('selectstart',{bubbles:true,cancelable:true})),
          menuAllowed:menu(text),outsideMenuAllowed:menu(document.getElementById('lobbyName')) };
      });
      expect(browserActions).toEqual({selection:'',selectable:'none',selectAllowed:false,menuAllowed:false,outsideMenuAllowed:true});
      expect(await page.evaluate(()=>SAILING_GAME.state.steerIntent)).toBe(1);
    }finally{
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    await page.waitForFunction(()=>SAILING_GAME.state.steerIntent===0);
    await expect(helm).not.toHaveClass(/input-active/);
  });

  test('the expanded chart leaves room for pinch and pan on a short screen',async({page})=>{
    await page.setViewportSize({width:667,height:320});
    await page.goto(process.env.TACK_URL||game);
    await page.locator('#startButton').tap();
    await page.locator('#expandChart').tap();
    const {x,y,width,height}=await page.locator('#map').boundingBox();
    const center={x:x+width/2,y:y+height/2};
    const cdp=await page.context().newCDPSession(page);
    const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
    const pair=distance=>[{...center,x:center.x-distance,id:1},{...center,x:center.x+distance,id:2}];
    const before=await page.evaluate(()=>SAILING_GAME.map.getView());
    await touch('touchStart',pair(24));
    await touch('touchMove',pair(54));
    await touch('touchEnd',[]);
    await page.waitForFunction(scale=>SAILING_GAME.map.getView().scale>scale*1.2,before.scale);
    const after=await page.evaluate(()=>SAILING_GAME.map.getView());
    await touch('touchStart',[{...center,id:3}]);
    await touch('touchMove',[{...center,x:center.x+60,id:3}]);
    await touch('touchEnd',[]);
    await page.waitForFunction(x=>Math.abs(SAILING_GAME.map.getView().x-x)>20,after.x);
  });
});

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
    const actions=intro.locator('.intro-actions button');
    await expect(actions).toHaveText(['Fri sejlads','Kapsejlads','Sejl sammen']);
    await expect(intro.getByRole('button',{name:/Startsted/})).toHaveCount(0);
    const sizes=await actions.evaluateAll(buttons=>buttons.map(button=>{
      const {width,height}=button.getBoundingClientRect();
      return {width,height};
    }));
    expect(sizes).toEqual([sizes[0],sizes[0],sizes[0]]);
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
  await page.click('#startButton');
  await page.click('#preferencesButton');
  await page.click('#startLocationButton');
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
    await page.waitForFunction(()=>window.SAILING_GAME);
    await (await introOption(page,'#introBoat')).selectOption('ac72');
    await page.locator('#startButton').tap();
    await page.locator('#preferencesButton').tap();
    await page.locator('#startLocationButton').tap();
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
  const displayedKnots=async()=>Number((await speed.textContent()).replace(',','.'));
  await page.click('#startButton');
  await expect(speed).toHaveText('5,0');

  await page.clock.runFor(180);
  await page.evaluate(()=>window.waterSpeedSample=7);
  await page.clock.runFor(180);
  expect(await displayedKnots()).toBeLessThan(5.5);
  await page.evaluate(()=>window.waterSpeedSample=5);
  await page.clock.runFor(1400);

  await page.evaluate(()=>{
    const speed=document.getElementById('speed');
    window.speedEdits=0;
    new MutationObserver(records=>window.speedEdits+=records.length).observe(speed,{childList:true});
    window.waterSpeedSample=9;
  });
  await page.clock.runFor(1000);
  const settled=await displayedKnots();
  expect(settled).toBeGreaterThan(7);
  expect(settled).toBeLessThan(8.2);
  expect(await page.evaluate(()=>window.speedEdits)).toBeLessThanOrEqual(4);
  await page.clock.runFor(3200);
  expect(await displayedKnots()).toBeGreaterThanOrEqual(8.9);

  await page.evaluate(()=>window.waterSpeedSample=0);
  await page.keyboard.press('KeyR');
  await expect(speed).toHaveText('0,0');
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
