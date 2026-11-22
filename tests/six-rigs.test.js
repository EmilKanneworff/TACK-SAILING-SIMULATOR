const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');const {spawn}=require('node:child_process');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('six independent clients receive rig states over the real live service',async({browser})=>{
 test.setTimeout(240000);const services=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33135'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34135'},stdio:['ignore','pipe','inherit']})];await Promise.all(services.map(p=>new Promise((ok,fail)=>{p.stdout.once('data',ok);p.once('error',fail)})));
 const contexts=[],pages=[],errors=[];
 try{
  for(let i=0;i<6;i++){const ctx=await browser.newContext({viewport:{width:600,height:500}}),page=await ctx.newPage();contexts.push(ctx);pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33135');await page.goto('http://127.0.0.1:34135');await page.waitForFunction(()=>window.SAILING_GAME);await (await introOption(page, '#introBoat')).selectOption(['laser','yacht','ac72','dinghy','ac75','laser'][i]);await page.evaluate(()=>{const q=document.querySelector('#quality');q.value='1';q.dispatchEvent(new Event('change',{bubbles:true}));});await (await introOption(page, '#introLobby')).click();await page.fill('#lobbyName','Sejler '+(i+1));if(i){await page.fill('#lobbyCodeInput',await pages[0].locator('#lobbyCode').innerText());await page.click('#lobbyJoin');}else await page.click('#lobbyCreate');await expect(page.locator('#lobbyRoom')).toBeVisible();}
  await Promise.all(pages.map(page=>page.click('#lobbySail',{timeout:60000})));
  await pages[0].waitForFunction(()=>FriVindLobby.fleet.boats.size===5&&[...FriVindLobby.fleet.boats.values()].every(s=>Number.isFinite(s.rig?.camber)),null,{timeout:90000});
  await Promise.all(pages.slice(1).map(page=>page.waitForFunction(()=>FriVindLobby.fleet.synced&&FriVindLobby.fleet.boats.size===5,null,{timeout:90000})));
  const states=await Promise.all(pages.map(page=>page.evaluate(()=>({boat:SAILING_GAME.state.boatId,remote:[...FriVindLobby.fleet.boats.values()].map(s=>({boat:s.boatId,rig:!!s.rig,main:!!s.sail?.main})),synced:FriVindLobby.fleet.synced}))));
  for(const s of states){expect(s.remote).toHaveLength(5);expect(s.remote.every(p=>p.rig&&p.main)).toBe(true);expect(s.synced).toBe(true)}expect(errors).toEqual([]);
 }finally{await Promise.all(contexts.map(c=>c.close()));services.forEach(p=>p.kill());}
});
