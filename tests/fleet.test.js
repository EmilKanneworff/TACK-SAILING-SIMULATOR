const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');const {spawn}=require('node:child_process');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('two browser clients enter the same world and exchange independent steering',async({browser})=>{test.setTimeout(60000);const services=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33110'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34110'},stdio:['ignore','pipe','inherit']})];await Promise.all(services.map(p=>new Promise((r,j)=>{p.stdout.once('data',r);p.once('error',j)})));const contexts=[];try{for(let i=0;i<2;i++){let ctx=await browser.newContext();contexts.push(ctx);let p=await ctx.newPage();await p.addInitScript(()=>window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33110');p.on('pageerror',e=>console.log('PAGEERROR',i,e.message));await p.goto('http://127.0.0.1:34110');await p.waitForFunction(()=>!!window.SAILING_GAME);if(i)await p.selectOption('#introDifficulty','easy');await (await introOption(p, '#introLobby')).click();await p.fill('#lobbyName',i?'Gæst':'Vært');if(!i)await p.click('#lobbyCreate');else{await p.fill('#lobbyCodeInput',await contexts[0].pages()[0].locator('#lobbyCode').innerText());await p.click('#lobbyJoin')}await expect(p.locator('#lobbyRoom')).toBeVisible();}
 let host=contexts[0].pages()[0],guest=contexts[1].pages()[0];await host.click('#lobbySail');await guest.click('#lobbySail');await host.waitForFunction(()=>FriVindLobby.fleet.actors.size===1,{timeout:15000});await guest.waitForFunction(()=>FriVindLobby.fleet.actors.size===1,{timeout:15000});await host.waitForFunction(()=>[...FriVindLobby.fleet.boats.values()][0]?.crewDifficulty==='easy');expect(await host.evaluate(()=>SAILING_GAME.state.crewDifficulty)).toBe('hard');await host.screenshot({path:'gennemgang/multiplayer-to-baade.png'});const field=()=>{const s=SAILING_GAME.state,e=SAILING_GAME.env;return SailPhysics.waveAt(42,83,12,{...e,waveCurrent:s.seaState,waveProfile:s.waveProfile}).height};const hostWave=await host.evaluate(field),guestWave=await guest.evaluate(field);expect(guestWave).toBeCloseTo(hostWave,3);
 await host.evaluate(()=>Object.assign(SAILING_GAME.env,{windSeed:1033,direction:92, gusts:.48}));
 await guest.waitForFunction(()=>SAILING_GAME.env.windSeed===1033&&SAILING_GAME.env.direction===92);
 const sharedWind=()=>SailPhysics.windAt(345,-155,12,SAILING_GAME.env,2);
 expect(await guest.evaluate(sharedWind)).toEqual(await host.evaluate(sharedWind));
 const before=await host.evaluate(()=>{const f=FriVindLobby.fleet;return {id:f.id,remote:[...f.boats.values()][0].theta,own:SAILING_GAME.state.theta}});await guest.keyboard.down('ArrowRight');await guest.waitForTimeout(1500);await guest.keyboard.up('ArrowRight');const after=await host.evaluate(()=>({remote:[...FriVindLobby.fleet.boats.values()][0].theta,own:SAILING_GAME.state.theta}));expect(Math.abs(after.remote-before.remote)).toBeGreaterThan(.1);expect(Math.abs(after.own-before.own)).toBeLessThan(.2);const guestBefore=await guest.evaluate(()=>[...FriVindLobby.fleet.boats.values()][0].theta);await host.keyboard.down('ArrowLeft');await host.waitForTimeout(1200);await host.keyboard.up('ArrowLeft');await guest.waitForFunction(before=>Math.abs(SailPhysics.wrap([...FriVindLobby.fleet.boats.values()][0].theta-before))>.1,guestBefore,{timeout:10000});
 }finally{await Promise.all(contexts.map(c=>c.close()));for(const s of services)s.kill()}});
test('six isolated clients each see six independently configured boats',async({browser})=>{
 test.setTimeout(120000);
 const services=[
  spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33111'},stdio:['ignore','pipe','inherit']}),
  spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34111'},stdio:['ignore','pipe','inherit']})
 ];
 const contexts=[],pages=[],types=['laser','yacht','ac72','dinghy','ac75','laser'];
 try{
  await Promise.all(services.map(process=>new Promise((resolve,reject)=>{process.stdout.once('data',resolve);process.once('error',reject);})));
  await test.step('join six boats in the lobby on low graphics',async()=>{
   let code;
   for(const [index,boat] of types.entries()){
    const context=await browser.newContext({viewport:{width:600,height:500}});
    contexts.push(context);
    const page=await context.newPage();
    pages.push(page);
    await page.addInitScript(()=>window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33111');
    page.on('pageerror',error=>console.log('PAGEERROR',index,error.message));
    await page.goto('http://127.0.0.1:34111');
    await page.waitForFunction(()=>window.SAILING_GAME);
    // Exercise network steering with eight to eleven moving crew per foil boat
    // without trying to benchmark six WebGL renderers in the same browser.
    await page.locator('#quality').evaluate(select=>{
     select.value='1';
     select.dispatchEvent(new Event('change',{bubbles:true}));
    });
    await (await introOption(page,'#introBoat')).selectOption(boat);
    await page.click('#introLobby');
    await page.fill('#lobbyName','Spiller '+(index+1));
    if(index){await page.fill('#lobbyCodeInput',code);await page.click('#lobbyJoin');}
    else await page.click('#lobbyCreate');
    await expect(page.locator('#lobbyRoom')).toBeVisible();
    if(!index)code=await page.locator('#lobbyCode').innerText();
   }
  });
  const [host]=pages;
  await test.step('display all boats and share the host wave clock',async()=>{
   for(const page of pages)await page.click('#lobbySail');
   await Promise.all(pages.map(page=>page.waitForFunction(()=>{
     const fleet=FriVindLobby.fleet,visible=new Set([
      ...[...fleet.actors].filter(([,a])=>a.boatRoot.visible).map(([id])=>id),
      ...[...fleet.silhouettes].filter(([,a])=>a.root.visible).map(([id])=>id)
     ]);
     return visible.size===5;
   },null,{timeout:40000})));
   const boats=await host.evaluate(()=>[SAILING_GAME.state,...FriVindLobby.fleet.boats.values()].map(s=>({type:s.boatId,time:s.time,sea:s.seaState})));
   expect(boats.map(boat=>boat.type).sort()).toEqual(types.slice().sort());
   for(const boat of boats){expect(boat.time).toBeCloseTo(boats[0].time,6);expect(boat.sea).toBeCloseTo(boats[0].sea,6);}
  });
  await test.step('apply simultaneous helm input and turn all five guest boats',async()=>{
   const headings=await host.evaluate(()=>Object.fromEntries([...FriVindLobby.fleet.boats].map(([id,state])=>[id,state.theta])));
   const key=type=>Promise.all(pages.map(page=>page.evaluate(eventType=>window.dispatchEvent(new KeyboardEvent(eventType,{code:'ArrowRight',key:'ArrowRight',bubbles:true})),type)));
   await key('keydown');
   try{
    await host.waitForFunction(()=>[...FriVindLobby.fleet.controls.values()].filter(control=>control.steer===1).length===5,null,{timeout:20000});
    await host.waitForFunction(before=>[...FriVindLobby.fleet.boats].every(([id,state])=>Math.abs(SailPhysics.wrap(state.theta-before[id]))>.05),headings,{timeout:20000});
   }finally{await key('keyup');}
  });
 }finally{
  try{await Promise.all(contexts.map(context=>context.close()));}
  finally{services.forEach(process=>process.kill());}
 }
});
test('host shares one course and countdown with guest',async({browser})=>{test.setTimeout(60000);const sv=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33112'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34112'},stdio:['ignore','pipe','inherit']})];await Promise.all(sv.map(p=>new Promise((r,j)=>{p.stdout.once('data',r);p.once('error',j)})));const cs=[];try{for(let i=0;i<2;i++){const c=await browser.newContext();cs.push(c);const p=await c.newPage();await p.addInitScript(()=>window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33112');p.on('pageerror',e=>console.log('ERR',i,e.message));await p.goto('http://127.0.0.1:34112');await p.waitForFunction(()=>window.SAILING_GAME);await (await introOption(p, '#introLobby')).click();await p.fill('#lobbyName',i?'Guest':'Host');if(i){await p.fill('#lobbyCodeInput',await cs[0].pages()[0].locator('#lobbyCode').innerText());await p.click('#lobbyJoin')}else await p.click('#lobbyCreate');await expect(p.locator('#lobbyRoom')).toBeVisible()}const h=cs[0].pages()[0],g=cs[1].pages()[0];await h.click('#lobbySail');await g.click('#lobbySail');await h.waitForFunction(()=>FriVindLobby.fleet.boats.size===1);await h.click('#preferencesButton');await h.click('#raceSetup');await h.click('[data-racetype=triangle]');await h.selectOption('#courseVariant','long');await h.click('#beginRace');await g.waitForFunction(()=>SAILING_GAME.course.model.type==='triangle'&&SAILING_GAME.course.phase==='countdown',{timeout:15000});const a=await h.evaluate(()=>({m:SAILING_GAME.course.model,phase:SAILING_GAME.course.phase})),b=await g.evaluate(()=>({m:SAILING_GAME.course.model,phase:SAILING_GAME.course.phase}));expect(JSON.stringify(b.m)).toEqual(JSON.stringify(a.m));expect(b.m.variant).toBe('long');expect(b.phase).toBe('countdown');await h.click('#settingsButton');
await h.locator('#waveHeight').fill('0.85');
await g.click('#settingsButton');
await expect(g.locator('#windLockNote')).toHaveText('Værten styrer vejret');
await expect(g.locator('#waveHeight')).toHaveValue('0.85');
await expect(g.locator('#windSpeed')).toBeDisabled();
const t=await h.evaluate(()=>SAILING_GAME.state.time);
await h.waitForFunction(before=>SAILING_GAME.state.time>before+.3,t);
expect(await h.evaluate(()=>SAILING_GAME.course.valid)).toBe(false);
}finally{await Promise.all(cs.map(c=>c.close()));sv.forEach(p=>p.kill())}});
test('guest helm responds before a delayed round trip',async({browser})=>{test.setTimeout(60000);const sv=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33113'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34113'},stdio:['ignore','pipe','inherit']})];await Promise.all(sv.map(p=>new Promise((r,j)=>{p.stdout.once('data',r);p.once('error',j)})));const cs=[];try{for(let i=0;i<2;i++){let c=await browser.newContext();cs.push(c);let p=await c.newPage();await p.addInitScript(({delay})=>{window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33113';const Original=WebSocket;window.WebSocket=class extends Original{send(data){setTimeout(()=>{if(this.readyState===1)super.send(data)},delay)}addEventListener(type,handler,opts){return super.addEventListener(type,type==='message'?(event)=>setTimeout(()=>handler(event),delay):handler,opts)}}},{delay:i?75:0});await p.goto('http://127.0.0.1:34113');await p.waitForFunction(()=>window.SAILING_GAME);await (await introOption(p, '#introLobby')).click();await p.fill('#lobbyName',i?'Gæst':'Vært');if(i){await p.fill('#lobbyCodeInput',await cs[0].pages()[0].locator('#lobbyCode').innerText());await p.click('#lobbyJoin')}else await p.click('#lobbyCreate');await expect(p.locator('#lobbyRoom')).toBeVisible()}const h=cs[0].pages()[0],g=cs[1].pages()[0];await h.click('#lobbySail');await g.click('#lobbySail');await g.waitForFunction(()=>FriVindLobby.fleet.actors.size===1);const a=await g.evaluate(()=>SAILING_GAME.state.steerIntent);await g.keyboard.down('ArrowLeft');await g.waitForTimeout(120);const b=await g.evaluate(()=>SAILING_GAME.state.steerIntent);await g.keyboard.up('ArrowLeft');expect(a).toBe(0);expect(b).toBe(-1)}finally{await Promise.all(cs.map(c=>c.close()));sv.forEach(p=>p.kill())}});
