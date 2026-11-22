const { introOption, dragMap } = require('../scripts/browser-setup.cjs');
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
   await page.locator('#quality').evaluate(select=>{select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));});
   await (await introOption(page, '#introLobby')).click();await page.fill('#lobbyName',i?'Gæst':'Vært');
   if(i){await page.fill('#lobbyCodeInput',await contexts[0].pages()[0].locator('#lobbyCode').innerText());await page.click('#lobbyJoin');}else await page.click('#lobbyCreate');
   await expect(page.locator('#lobbyRoom')).toBeVisible();
  }
  const host=contexts[0].pages()[0],guest=contexts[1].pages()[0];await host.click('#lobbySail');
  await guest.waitForFunction(()=>FriVindLobby.fleet.synced);await host.waitForFunction(()=>FriVindLobby.fleet.boats.size===1);
  const id=await guest.evaluate(()=>FriVindLobby.fleet.id);
  await guest.keyboard.press('3');await guest.keyboard.down('ArrowUp');
  try{await host.waitForFunction(id=>{const s=FriVindLobby.fleet.boats.get(id);return s&&s.crewPose===3&&s.sheet>.4},id,{timeout:12000});}
  finally{await guest.keyboard.up('ArrowUp');}
  const before=await host.evaluate(()=>SAILING_GAME.state.time);await dragMap(host,300,125);
  await host.waitForFunction(time=>SAILING_GAME.state.time>time+.2,before,{timeout:12000});
  await guest.evaluate(()=>window.testSockets.at(-1).close());
  await guest.waitForFunction(()=>window.testSockets.length>=2&&FriVindLobby.fleet.synced,null,{timeout:12000});
  expect(await guest.evaluate(()=>FriVindLobby.fleet.id)).toBe(id);
  expect(await host.evaluate(()=>({players:FriVindLobby.fleet.players.length,boats:FriVindLobby.fleet.boats.size,has:FriVindLobby.fleet.boats.has(FriVindLobby.fleet.players.find(p=>!p.host).id)}))).toEqual({players:2,boats:1,has:true});
  await host.waitForFunction(id=>FriVindLobby.fleet.boats.get(id)?.steerIntent===0,id);
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
  await dragMap(host,-200,-85);await host.click('#preferencesButton');await host.click('#lobbyButton');await host.click('#lobbyLeave');
  await guest.waitForFunction(()=>FriVindLobby.fleet.host&&FriVindLobby.fleet.players.length===1);
  await guest.waitForFunction(time=>SAILING_GAME.state.time>time+.3,beforeHostDisconnect);
 }finally{await Promise.all(contexts.map(c=>c.close()));services.forEach(p=>p.kill());}
});
