const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');const {spawn}=require('node:child_process');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('a late guest receives the active wave transition and host time',async({browser})=>{
 test.setTimeout(90000);const services=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33118'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34118'},stdio:['ignore','pipe','inherit']})];await Promise.all(services.map(p=>new Promise((r,j)=>{p.stdout.once('data',r);p.once('error',j)})));const contexts=[];
 try{for(let i=0;i<2;i++){const c=await browser.newContext();contexts.push(c);const p=await c.newPage();await p.addInitScript(()=>window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33118');await p.goto('http://127.0.0.1:34118');await p.waitForFunction(()=>window.SAILING_GAME);await (await introOption(p, '#introLobby')).click();await p.fill('#lobbyName',i?'Gæst':'Vært');if(i){await p.fill('#lobbyCodeInput',await contexts[0].pages()[0].locator('#lobbyCode').innerText());await p.click('#lobbyJoin')}else await p.click('#lobbyCreate');if(!i){await expect(p.locator('#lobbyRoom')).toBeVisible();await p.click('#lobbySail');await p.click('#settingsButton');await p.locator('#windSpeed').press('End');await p.locator('#waveHeight').fill('0.85');await p.locator('#windDirection').fill('80');await p.waitForTimeout(500);}}
 const host=contexts[0].pages()[0],guest=contexts[1].pages()[0];await guest.waitForFunction(()=>FriVindLobby.fleet.synced&&FriVindLobby.fleet.boats.size===1);const received=await guest.evaluate(()=>{const own=SAILING_GAME.state,remote=[...FriVindLobby.fleet.boats.values()][0],e=SAILING_GAME.env,t=remote.time;return {wind:e.speed,choice:e.waveHeight,time:t,ownTime:own.time,sea:remote.seaState,profile:remote.waveProfile,boatCount:FriVindLobby.fleet.boats.size}});
 expect(received.boatCount).toBe(1);expect(received.wind).toBe(20);expect(received.choice).toBe(.85);expect(received.profile.to.period).toBeGreaterThan(1);expect(Math.abs(received.ownTime-received.time)).toBeLessThan(1);
 await guest.click('#settingsButton');
 await expect(guest.locator('#waveHeight')).toHaveValue('0.85');
 await expect(guest.locator('#windLockNote')).toHaveText('Værten styrer vejret');

 }finally{await Promise.all(contexts.map(c=>c.close()));services.forEach(p=>p.kill());}
});
