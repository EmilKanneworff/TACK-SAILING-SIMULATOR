'use strict';

const { test,expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});

test('an invitation opens the lobby and two browsers sail without the host tab',async({ browser })=>{
  test.setTimeout(90000);
  const live=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33109'}});
  const frontend=spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34109'}});
  const contexts=[];
  try {
    await Promise.all([live,frontend].map(p=>once(p.stdout,'data')));
    const url='http://127.0.0.1:34109/';
    async function pageFor(name,link,delay=0) {
      const context=await browser.newContext({viewport:{width:994,height:646}});
      contexts.push(context);
      const page=await context.newPage();
      await page.addInitScript(delay=>{
        window.FRI_VIND_REALTIME_URL='ws://127.0.0.1:33109';
        const Native=window.WebSocket;
        window.sockets=[];
        window.WebSocket=class extends Native{
          constructor(...args){ super(...args);window.sockets.push(this); }
          send(data){ if(!delay){ super.send(data);return; }
            setTimeout(()=>{ if(this.readyState===Native.OPEN)super.send(data); },delay);
          }
        };
      },delay);
      await page.goto(link);
      await page.locator('#startButton:enabled').waitFor();
      if(link===url)await page.click('#introLobby');
      await page.fill('#lobbyName',name);
      return page;
    }
    const host=await pageFor('Vært',url);
    await contexts[0].grantPermissions(['clipboard-read','clipboard-write']);
    await host.click('#lobbyCreate');
    await expect(host.locator('#lobbyRoom')).toBeVisible();
    const code=await host.locator('#lobbyCode').textContent();
    expect(code).toMatch(/^\d{6}$/);
    await host.click('#lobbyInvite');
    const link=await host.evaluate(()=>navigator.clipboard.readText());
    expect(link).toBe(url+'?lobby='+code);
    const guest=await pageFor('Gæst',link,75);
    await expect(guest.locator('#lobbyCodeInput')).toHaveValue(code);
    await guest.click('#lobbyJoin');
    await expect(host.locator('#lobbyCount')).toHaveText('2 / 6 spillere');
    await guest.click('#lobbyReady');
    await expect(host.locator('#lobbyPlayers')).toContainText('Gæst · Laserjolle · Klar');
    await host.click('#lobbySail');
    await guest.waitForFunction(()=>FriVindLobby.fleet.synced&&FriVindLobby.fleet.boats.size===1);
    await host.waitForFunction(()=>FriVindLobby.fleet.synced&&FriVindLobby.fleet.boats.size===1);
    const id=await guest.evaluate(()=>FriVindLobby.fleet.id);
    await guest.locator('#sea').focus();
    await guest.keyboard.down('ArrowRight');
    try{
      await host.waitForFunction(id=>FriVindLobby.fleet.boats.get(id)?.steerIntent===1,id);
    }finally{await guest.keyboard.up('ArrowRight');}
    await host.waitForFunction(id=>FriVindLobby.fleet.boats.get(id)?.steerIntent===0,id);
    await guest.evaluate(()=>window.sockets.at(-1).close());
    await guest.waitForFunction(()=>window.sockets.length===2&&FriVindLobby.fleet.synced);
    expect(await guest.evaluate(()=>FriVindLobby.fleet.id)).toBe(id);
    const time=await guest.evaluate(()=>SAILING_GAME.state.time);
    await host.close();
    await guest.waitForFunction(time=>SAILING_GAME.state.time>time+.5&&!SAILING_GAME.paused,time);
    await expect(guest.locator('#fatal')).toBeHidden();
  } finally {
    await Promise.all(contexts.map(context=>context.close()));
    live.kill();frontend.kill();
  }
});
