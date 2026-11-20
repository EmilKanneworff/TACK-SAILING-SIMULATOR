'use strict';
const { introOption } = require('./browser-setup.cjs');
// Render selection cards from the running game's scene and actual boat meshes.
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader']});
  for (const id of (process.env.QA_BOATS ? process.env.QA_BOATS.split(',') : ['laser', 'dinghy', 'yacht', 'ac75', 'ac72'])) {
    const page = await browser.newPage({viewport:{width:960,height:600}});
    await page.goto(process.env.FRI_VIND_URL || 'http://localhost:5173');
    await page.waitForFunction(() => window.SAILING_GAME);
    await (await introOption(page, '#introBoat')).selectOption(id);
    await page.click('#startButton');
    await page.waitForTimeout(1800);
    if(process.env.FRI_VIND_CARD_ONLY!=='1')await page.screenshot({path:`gennemgang/modelkontrol/${id}-sejlads-aktuel.png`});
    const data = await page.evaluate(() => {
      const g=window.SAILING_GAME,w=g.scene,T=window.THREE,s=g.state,m=w.model;
      w.updateBoat(s,g.env,0);
      const scale=Math.max(m.length/4.23,m.mastHeight/6.18),beta=s.boom||0,side=Math.sign(s.crewSideBlend||s.crewSide||-1)*Math.sign(Math.cos(beta)||1);
      const direction=new T.Vector3((-2.5*Math.cos(beta)+side*11*Math.sin(beta))*scale,1.9*scale,(2.5*Math.sin(beta)+side*11*Math.cos(beta))*scale).applyAxisAngle(new T.Vector3(0,1,0),s.theta);
      const target=w.boatRoot.position.clone().add(new T.Vector3(0,m.mastHeight*.46,0));
      const camera=new T.PerspectiveCamera(43,960/600,.1,8000);camera.position.copy(target).add(direction);camera.lookAt(target);camera.updateProjectionMatrix();
      w.renderer.render(w.scene,camera);
      return w.renderer.domElement.toDataURL('image/webp',.88).split(',')[1];
    });
    fs.writeFileSync(`assets/model-${id}.webp`,Buffer.from(data,'base64'));
    await page.close();
  }
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
