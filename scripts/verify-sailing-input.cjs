'use strict';

const fs = require('node:fs/promises');
const { chromium } = require('@playwright/test');
const { changeScene } = require('./render-performance.cjs');

async function main(url, output) {
  if (!url || !output) throw Error('node scripts/verify-sailing-input.cjs URL OUTPUT');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ||
    (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),
  args: ['--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:390,height:664},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('fri-vind.settings.v3',
      JSON.stringify({ personal:{quality:'auto',difficulty:'hard'} })));
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    const response=await page.goto(url);
    await page.click('#startButton');
    await page.waitForFunction(()=>SAILING_GAME.state.time>.15);
    await page.evaluate(changeScene,{boat:'ac72',x:-1900,y:-2170,heading:-.45,speed:10,camera:0});
    await page.evaluate(()=>{
      const axes={ArrowLeft:['rudder',-1],ArrowRight:['rudder',1],ArrowDown:['sheet',-1],ArrowUp:['sheet',1]};
      const started=performance.now();
      window.inputResponse=[];
      window.addEventListener('keydown',event=>{
        const axis=axes[event.code];
        if(!axis||event.repeat)return;
        const [field,direction]=axis,at=performance.now();
        const initial=SAILING_GAME.state[field];
        const query=()=>{
          const game=SAILING_GAME, now=performance.now(), state=game.state;
          const changed=(state[field]-initial)*direction>.003;
          if(changed||now-at>600){
            window.inputResponse.push({ code:event.code, trusted:event.isTrusted, field, initial, value:state[field],
              offset:at-started, simulation:state.time, stateChangeMs:changed?now-at:null,
              debt:game.simulationDebt, ...game.performanceBudget });
          }else requestAnimationFrame(query);
        };
        requestAnimationFrame(query);
      },{capture:true});
    });
    const started=performance.now();
    for(const [at,keys] of [[5000,['ArrowRight','ArrowDown','ArrowLeft']],
      [24000,['ArrowLeft','ArrowUp','ArrowRight']],[49000,['ArrowRight','ArrowDown','ArrowLeft']]]){
      await page.waitForTimeout(Math.max(0,at-(performance.now()-started)));
      for(const key of keys){
        await page.keyboard.down(key);
        await page.waitForTimeout(280);
        await page.keyboard.up(key);
        await page.waitForTimeout(380);
      }
    }
    await page.waitForTimeout(Math.max(0,61000-(performance.now()-started)));
    await fs.writeFile(output,JSON.stringify({url,build:await response.headerValue('x-fri-vind-revision'),
      elapsed:performance.now()-started, errors, inputs:await page.evaluate(()=>window.inputResponse)},null,2)+'\n');
    if(errors.length)throw Error(errors.join('\n'));
  }finally{await browser.close();}
}
main(...process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1;});
