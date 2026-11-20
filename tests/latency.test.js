const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');const {spawn}=require('node:child_process');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('150 ms round trip preserves local response and bounded reconciliation',async({browser})=>{
 test.setTimeout(90000);const services=[spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33124'},stdio:['ignore','pipe','inherit']}),spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34124'},stdio:['ignore','pipe','inherit']})];await Promise.all(services.map(p=>new Promise((r,j)=>{p.stdout.once('data',r);p.once('error',j)})));const contexts=[];
 try{for(let i=0;i<2;i++){const c=await browser.newContext();contexts.push(c);const p=await c.newPage();await p.addInitScript(({delay})=>{window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33124';const Native=WebSocket;window.WebSocket=class extends Native{send(data){setTimeout(()=>{if(this.readyState===1)super.send(data)},delay)}addEventListener(type,handler,options){return super.addEventListener(type,type==='message'?e=>setTimeout(()=>handler(e),delay):handler,options)}}},{delay:i?75:0});await p.goto('http://127.0.0.1:34124');await p.waitForFunction(()=>window.SAILING_GAME);await (await introOption(p, '#introLobby')).click();await p.fill('#lobbyName',i?'Gæst':'Vært');if(i){await p.fill('#lobbyCodeInput',await contexts[0].pages()[0].locator('#lobbyCode').innerText());await p.click('#lobbyJoin')}else await p.click('#lobbyCreate');await expect(p.locator('#lobbyRoom')).toBeVisible();}
 const host=contexts[0].pages()[0],guest=contexts[1].pages()[0];await host.click('#lobbySail');await guest.click('#lobbySail');await guest.waitForFunction(()=>FriVindLobby.fleet.synced);await guest.waitForTimeout(500);await guest.keyboard.down('ArrowRight');await guest.waitForTimeout(100);expect(await guest.evaluate(()=>SAILING_GAME.state.steerIntent)).toBe(1);
 const samples=[];for(let i=0;i<45;i++){if(i===16)await guest.keyboard.up('ArrowRight');await guest.waitForTimeout(100);samples.push(await guest.evaluate(()=>({time:SAILING_GAME.state.time,x:SAILING_GAME.state.x,y:SAILING_GAME.state.y,vx:SAILING_GAME.state.vx,vy:SAILING_GAME.state.vy,renderX:SAILING_GAME.scene.boatRoot.position.x,renderY:-SAILING_GAME.scene.boatRoot.position.z,offset:SAILING_GAME.networkView,pending:FriVindLobby.fleet.pending.length})));}
 const speedJump=Math.max(...samples.slice(1).map((sample,i)=>{
   const previous=samples[i];
   return Math.hypot(sample.vx-previous.vx,sample.vy-previous.vy);
 }));
 const displayJump=Math.max(...samples.slice(1).map((sample,i)=>{
   const previous=samples[i];
   const dt=sample.time-previous.time;
   const expectedX=(sample.vx+previous.vx)*.5*dt;
   const expectedY=(sample.vy+previous.vy)*.5*dt;
   return Math.hypot(sample.renderX-previous.renderX-expectedX,sample.renderY-previous.renderY-expectedY);
 }));
 const offset=Math.max(...samples.map(s=>Math.hypot(s.offset.x,s.offset.y)));
 const last=samples.at(-1);
 const authority=await host.evaluate(()=>[...FriVindLobby.fleet.boats.values()][0].time);
 console.log('LATENCY',JSON.stringify({speedJump,displayJump,offset,timeGap:last.time-authority,pending:last.pending}));
 expect(speedJump).toBeLessThan(3);
 expect(displayJump).toBeLessThan(2.5);
 expect(offset).toBeLessThan(6);
 expect(last.pending).toBeLessThan(60);
 expect(Math.abs(last.time-authority)).toBeLessThan(1);
 }finally{await Promise.all(contexts.map(c=>c.close()));services.forEach(p=>p.kill())}
});
