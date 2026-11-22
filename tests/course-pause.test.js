const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');const {spawn}=require('node:child_process');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('host reconnect keeps all race clocks on the same start time',async({browser})=>{
 test.setTimeout(90000);const services=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33120'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34120'},stdio:['ignore','pipe','inherit']})];await Promise.all(services.map(p=>new Promise((r,j)=>{p.stdout.once('data',r);p.once('error',j)})));const contexts=[];
 try{for(let i=0;i<2;i++){const c=await browser.newContext();contexts.push(c);const p=await c.newPage();await p.addInitScript(()=>{window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33120';const Native=window.WebSocket;window.testSockets=[];window.WebSocket=class extends Native{constructor(...args){super(...args);window.testSockets.push(this)}}});await p.goto('http://127.0.0.1:34120');await p.waitForFunction(()=>window.SAILING_GAME);await (await introOption(p, '#introLobby')).click();await p.fill('#lobbyName',i?'Gæst':'Vært');if(i){await p.fill('#lobbyCodeInput',await contexts[0].pages()[0].locator('#lobbyCode').innerText());await p.click('#lobbyJoin')}else await p.click('#lobbyCreate');await expect(p.locator('#lobbyRoom')).toBeVisible();}
 const host=contexts[0].pages()[0],guest=contexts[1].pages()[0];await host.click('#lobbySail');await host.waitForFunction(()=>FriVindLobby.fleet.boats.size===1);await host.click('#raceButton');await guest.waitForFunction(()=>SAILING_GAME.course.phase==='countdown');const start=await host.evaluate(()=>SAILING_GAME.course.startAtHostMs);expect(await guest.evaluate(()=>SAILING_GAME.course.startAtHostMs)).toBe(start);
 await host.evaluate(()=>window.testSockets.at(-1).close());await host.waitForFunction(()=>SAILING_GAME.paused);await host.waitForFunction(()=>window.testSockets.length>=2&&!SAILING_GAME.paused,null,{timeout:15000});await guest.waitForFunction(()=>!SAILING_GAME.paused,null,{timeout:15000});await host.waitForTimeout(300);
 const clocks=await Promise.all([host,guest].map(p=>p.evaluate(()=>({gun:SAILING_GAME.course.startAtHostMs,remaining:SAILING_GAME.course.countdown}))));
 expect(clocks[0].gun).toBe(clocks[1].gun);
 const remaining=clocks[1].remaining;
 await host.evaluate(()=>window.testSockets.at(-1).close());
 await guest.waitForFunction(remaining=>SAILING_GAME.course.countdown<remaining-.8,remaining);
 expect(await guest.evaluate(()=>SAILING_GAME.course.startAtHostMs)).toBe(clocks[1].gun);
 expect(await guest.evaluate(()=>SAILING_GAME.paused)).toBe(false);
 }finally{await Promise.all(contexts.map(c=>c.close()));services.forEach(p=>p.kill())}
});
