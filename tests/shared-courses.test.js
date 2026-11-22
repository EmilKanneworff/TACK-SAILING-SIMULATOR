'use strict';

const { test,expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});

test('both shared courses use one server model and one start across six browsers',async({ browser })=>{
  test.setTimeout(120000);
  const servers=[
    spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'33123'}}),
    spawn(process.execPath,['server/static.js'],{env:{...process.env,FRONTEND_PORT:'34123',FRONTEND_DIR:process.env.FRI_VIND_TEST_FRONTEND||'.'}})
  ];
  const contexts=[],pages=[];
  try{
    await Promise.all(servers.map(server=>once(server.stdout,'data')));
    let code;
    for(let i=0;i<6;i++){
      const context=await browser.newContext({viewport:{width:780,height:584}});
      contexts.push(context);
      const page=await context.newPage();
      pages.push(page);
      await page.addInitScript(()=>{
        Object.defineProperty(window,'FRI_VIND_REALTIME_URL',{get:()=> 'ws://127.0.0.1:33123',set:()=>{}});
        localStorage.setItem('fri-vind.settings.v3',JSON.stringify({personal:{quality:'low'}}));
      });
      await page.goto('http://127.0.0.1:34123/'+(code?'?lobby='+code:''));
      await page.locator('#startButton:enabled').waitFor();
      if(!code)await page.click('#introLobby');
      await page.fill('#lobbyName','Sejler '+(i+1));
      await page.click(code?'#lobbyJoin':'#lobbyCreate');
      await expect(page.locator('#lobbyRoom')).toBeVisible();
      if(!code)code=await page.locator('#lobbyCode').innerText();
    }
    const [host,...guests]=pages;
    await expect(host.locator('#lobbyCount')).toHaveText('6 / 6 spillere');
    for(const courseType of ['gates','triangle']){
      await host.selectOption('#lobbyMode','course');
      await host.selectOption('#lobbyCourse',courseType+':short');
      await host.click('#lobbySail');
      await Promise.all(pages.map(page=>page.waitForFunction(type=>{
        return FriVindLobby.fleet.synced&&SAILING_GAME.course.phase==='countdown'&&SAILING_GAME.course.model.type===type;
      },courseType)));
      const settings=page=>page.evaluate(()=>({model:SAILING_GAME.course.model,start:SAILING_GAME.course.startAtHostMs}));
      const expected=await settings(host);
      for(const guest of guests)expect(await settings(guest)).toEqual(expected);
      await host.click('#preferencesButton');await host.click('#lobbyButton');
      await host.click('#lobbyReturn');
      await Promise.all(pages.map(page=>expect(page.locator('#lobbyRoom')).toBeVisible()));
    }
  }finally{
    await Promise.all(contexts.map(context=>context.close()));
    servers.forEach(server=>server.kill());
  }
});
