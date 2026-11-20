const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');const {spawn}=require('node:child_process');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('the host resolves boat contact and both clients receive the result',async({browser})=>{
 test.setTimeout(90000);const sv=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33123'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34123'},stdio:['ignore','pipe','inherit']})];await Promise.all(sv.map(p=>new Promise((r,j)=>{p.stdout.once('data',r);p.once('error',j)})));const cs=[];
 try{for(let i=0;i<2;i++){const c=await browser.newContext();cs.push(c);const p=await c.newPage();await p.addInitScript(()=>window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33123');await p.goto('http://127.0.0.1:34123');await p.waitForFunction(()=>window.SAILING_GAME);await (await introOption(p, '#introLobby')).click();await p.fill('#lobbyName',i?'Gæst':'Vært');if(i){await p.fill('#lobbyCodeInput',await cs[0].pages()[0].locator('#lobbyCode').innerText());await p.click('#lobbyJoin')}else await p.click('#lobbyCreate');await expect(p.locator('#lobbyRoom')).toBeVisible()}
 const h=cs[0].pages()[0],g=cs[1].pages()[0];await h.click('#lobbySail');await g.click('#lobbySail');await h.waitForFunction(()=>FriVindLobby.fleet.boats.size===1);await g.waitForFunction(()=>FriVindLobby.fleet.synced);
 // Arrange initial contact once; subsequent movement uses the actual world loop.
 const id=await g.evaluate(()=>FriVindLobby.fleet.id);await h.evaluate(id=>{const a=SAILING_GAME.state,b=FriVindLobby.fleet.boats.get(id);Object.assign(a,{x:0,y:0,theta:0,vx:1.2,vy:0});Object.assign(b,{x:2.0,y:0,theta:0,vx:-1.2,vy:0});},id);
 await h.waitForFunction(()=>FriVindLobby.fleet.lastContacts?.length>0,null,{timeout:10000});const collision=await h.evaluate(()=>({pairs:FriVindLobby.fleet.lastContacts,own:SAILING_GAME.state.vx,remote:[...FriVindLobby.fleet.boats.values()][0].vx}));expect(collision.pairs).toHaveLength(1);expect(collision.own).toBeLessThan(1.2);expect(collision.remote).toBeGreaterThan(-1.2);
 await g.waitForFunction(()=>Math.abs(SAILING_GAME.state.x)<10&&FriVindLobby.fleet.synced,null,{timeout:10000});expect(await g.evaluate(()=>FriVindLobby.fleet.boats.size)).toBe(1);
 }finally{await Promise.all(cs.map(c=>c.close()));sv.forEach(p=>p.kill())}
});
