const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');
const {spawn}=require('node:child_process');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('guest rejoins the same boat and menus keep the shared world running',async({browser})=>{
 test.setTimeout(90000);
 const services=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33114'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34114'},stdio:['ignore','pipe','inherit']})];
 await Promise.all(services.map(p=>new Promise((resolve,reject)=>{p.stdout.once('data',resolve);p.once('error',reject)})));
 const contexts=[];
 try{
  for(let i=0;i<2;i++){
   const context=await browser.newContext();contexts.push(context);const page=await context.newPage();
   await page.addInitScript(()=>{window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33114';const Native=window.WebSocket;window.testSockets=[];window.WebSocket=class extends Native{constructor(...args){super(...args);window.testSockets.push(this)}};});
   await page.goto('http://127.0.0.1:34114');await page.waitForFunction(()=>window.SAILING_GAME);
   await page.locator('#quality').evaluate(select=>{select.value='low';select.dispatchEvent(new Event('change',{bubbles:true}));});
   await (await introOption(page, '#introLobby')).click();await page.fill('#lobbyName',i?'Gæst':'Vært');
   if(i){await page.fill('#lobbyCodeInput',await contexts[0].pages()[0].locator('#lobbyCode').innerText());await page.click('#lobbyJoin');}else await page.click('#lobbyCreate');
   await expect(page.locator('#lobbyRoom')).toBeVisible();
  }
  const host=contexts[0].pages()[0],guest=contexts[1].pages()[0];await host.click('#lobbySail');await guest.click('#lobbySail');
  await guest.waitForFunction(()=>FriVindLobby.fleet.synced);await host.waitForFunction(()=>FriVindLobby.fleet.boats.size===1);
  const id=await guest.evaluate(()=>FriVindLobby.fleet.id);
  await guest.keyboard.press('3');await guest.keyboard.down('ArrowUp');
  try{await host.waitForFunction(id=>{const s=FriVindLobby.fleet.boats.get(id);return s&&s.crewPose===3&&s.sheet>.4},id,{timeout:12000});}
  finally{await guest.keyboard.up('ArrowUp');}
  const before=await host.evaluate(()=>SAILING_GAME.state.time);await host.click('#mapExpand');await host.click('#mapExpand');
  await host.waitForFunction(time=>SAILING_GAME.state.time>time+.2,before,{timeout:12000});
  await guest.evaluate(()=>window.testSockets.at(-1).close());
  await guest.waitForFunction(()=>window.testSockets.length>=2&&FriVindLobby.fleet.synced,null,{timeout:12000});
  expect(await guest.evaluate(()=>FriVindLobby.fleet.id)).toBe(id);
  expect(await host.evaluate(()=>({players:FriVindLobby.fleet.players.length,boats:FriVindLobby.fleet.boats.size,has:FriVindLobby.fleet.boats.has(FriVindLobby.fleet.players.find(p=>!p.host).id)}))).toEqual({players:2,boats:1,has:true});
  await host.waitForFunction(id=>{const c=FriVindLobby.fleet.controls.get(id);return !c||c.steer===0},id);
  const beforeHostDisconnect=await host.evaluate(()=>SAILING_GAME.state.time);
  await host.evaluate(()=>window.testSockets.at(-1).close());
  await host.waitForFunction(()=>SAILING_GAME.paused);
  await host.waitForFunction(()=>window.testSockets.length>=2&&!SAILING_GAME.paused,null,{timeout:12000});
  try{
   for(const page of [host,guest]){
    await page.waitForFunction(time=>!SAILING_GAME.paused&&SAILING_GAME.state.time>time+.2,beforeHostDisconnect,{timeout:12000});
    await expect(page.locator('#fatal')).toBeHidden();
   }
  }
  catch(error){
   const status=await Promise.all([host,guest].map(page=>page.evaluate(()=>({time:SAILING_GAME.state.time,paused:SAILING_GAME.paused,
    reason:document.getElementById('pauseReason').textContent,inWorld:FriVindLobby.fleet.inWorld,
    fatal:document.getElementById('fatal').hidden?null:document.getElementById('fatalMessage').textContent,
    synced:FriVindLobby.fleet.synced,sequence:FriVindLobby.fleet.lastSnapshot,sockets:window.testSockets.map(socket=>socket.readyState)}))));
   console.log('Reconnect status',status);
   throw error;
  }
  expect(await host.evaluate(()=>FriVindLobby.fleet.players.length)).toBe(2);
  await host.click('#mapExpand');await host.click('#preferencesButton');await host.click('#lobbyButton');await host.click('#lobbyLeave');
  await expect(guest.locator('#lobbyPanel')).toBeVisible();
  await expect(guest.locator('#lobbyMessage')).toHaveText('Værten har forladt spillet.');
  expect(await guest.evaluate(()=>({active:FriVindLobby.fleet.inWorld,paused:SAILING_GAME.paused}))).toEqual({active:false,paused:true});
  await guest.click('#lobbyClose');
  await guest.waitForFunction(()=>!SAILING_GAME.paused);
 }finally{await Promise.all(contexts.map(c=>c.close()));services.forEach(p=>p.kill());}
});

test('authoritative race tracks distribute the same results for both courses',async({browser})=>{
 test.setTimeout(90000);
 const services=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33115'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34115'},stdio:['ignore','pipe','inherit']})];
 await Promise.all(services.map(p=>new Promise((resolve,reject)=>{p.stdout.once('data',resolve);p.once('error',reject)})));const contexts=[];
 try{
  for(let i=0;i<2;i++){const c=await browser.newContext();contexts.push(c);const p=await c.newPage();await p.addInitScript(()=>window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33115');await p.goto('http://127.0.0.1:34115');await p.waitForFunction(()=>window.SAILING_GAME);await (await introOption(p, '#introLobby')).click();await p.fill('#lobbyName',i?'Gæst':'Vært');if(i){await p.fill('#lobbyCodeInput',await contexts[0].pages()[0].locator('#lobbyCode').innerText());await p.click('#lobbyJoin')}else await p.click('#lobbyCreate');await expect(p.locator('#lobbyRoom')).toBeVisible();}
  const h=contexts[0].pages()[0],g=contexts[1].pages()[0];await h.click('#lobbySail');await g.click('#lobbySail');await h.waitForFunction(()=>FriVindLobby.fleet.boats.size===1);
  for(const type of ['gates','triangle']){
   await h.click('#preferencesButton');await h.click('#raceSetup');await h.click(`[data-racetype="${type}"]`);await h.selectOption('#courseVariant','short');await h.click('#beginRace');
   await g.waitForFunction(type=>SAILING_GAME.course.model.type===type&&SAILING_GAME.course.phase==='countdown',type);
   // Synthetic geometric tracks exercise the real authoritative race objects and transport;
   // they deliberately do not claim to be voyages driven by sailing physics.
   const completed=await h.evaluate(()=>{
    const fleet=FriVindLobby.fleet,add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}),mul=(a,k)=>({x:a.x*k,y:a.y*k});
    const tracks=[SAILING_GAME.course,...fleet.races.values()];
    for(const [choice,c] of tracks.entries()){
     const axis=c.model.axis,line=c.model.startLine.centre;let pos={...add(line,mul(axis,-20)),theta:Math.atan2(axis.y,axis.x),heel:0,pitch:0},ms=c.gunAtMs+1000;c.advanceClock(c.gunAtMs,pos);
     function go(p){const next={...p,theta:pos.theta,heel:0,pitch:0};ms+=100;c.update(pos,next,.1,{nowMs:ms});pos=next;}
     go(add(line,mul(axis,20)));
     for(let i=0;i<c.route.length-1;i++){
      const v=c.route[i],arc=v.roundings[v.kind==='gate'?choice%2:0],mark=c.model.buoys.find(b=>b.id===arc.buoyId),r=v.kind==='gate'?c.model.gateWidth*.2:c.model.roundingRadius,rad={x:Math.cos(arc.startAngle),y:Math.sin(arc.startAngle)};
      if(v.kind==='gate'){go(add(v,mul(v.incoming,-r*2)));go(add(v,mul(v.incoming,1)));}else{go(add(add(mark,mul(rad,r)),mul(v.incoming,-r)));go(add(add(mark,mul(rad,r)),mul(v.incoming,.01)));}
      for(let j=0;j<=64;j++){const angle=arc.startAngle+arc.rotation*(arc.sweep+.08)*j/64;go({x:mark.x+Math.cos(angle)*r,y:mark.y+Math.sin(angle)*r});}
      if(c.index!==i+1)break;
     }
     const f=c.model.finishLine;go(add(f.centre,mul(f.normal,-20)));go(add(f.centre,mul(f.normal,20)));
    }
    fleet.broadcast();return tracks.map(c=>({finished:c.finished,index:c.index,length:c.route.length}));
   });
   for(const c of completed)expect(c).toEqual({finished:true,index:c.length,length:c.length});
   await expect.poll(()=>g.locator('#raceResults').textContent(),{timeout:10000}).toContain('Vært');await expect.poll(()=>g.locator('#raceResults').textContent(),{timeout:10000}).toContain('Gæst');
   expect(await g.locator('#raceResults').textContent()).toBe(await h.locator('#raceResults').textContent());
   await h.waitForFunction(()=>!FriVindLobby.fleet.raceActive);
  }
 }finally{await Promise.all(contexts.map(c=>c.close()));services.forEach(p=>p.kill());}
});
