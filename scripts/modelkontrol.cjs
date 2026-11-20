'use strict';
const { introOption } = require('./browser-setup.cjs');
// Capture the actual game meshes with neutral material from repeatable angles.
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:1200,height:750}});
  await page.goto(process.env.FRI_VIND_URL || 'http://localhost:5173');
  await page.waitForFunction(() => window.SAILING_GAME);
  const id=process.argv[2] || 'laser';
  if(!['laser','dinghy'].includes(id)) throw Error('Brug laser eller dinghy');
  await (await introOption(page, '#introBoat')).selectOption(id);
  await page.click('#startButton');
  await page.waitForTimeout(300);
  for (const [name, camera] of Object.entries({side:[0,4,16],stern:[-13,7,13],bow:[13,7,-13],deck:[-4,14,4]})) {
    const base64 = await page.evaluate(({camera}) => {
      const game=SAILING_GAME, world=game.scene, state=game.state, T=THREE;
      world.updateBoat(state,game.env,0);
      const scene=new T.Scene();scene.background=new T.Color('#d7e0e3');
      const clone=world.boatRoot.clone(true);clone.position.set(0,0,0);clone.children[0].rotation.y=0;clone.children[0].children[0].rotation.set(0,0,0);scene.add(clone);
      scene.add(new T.HemisphereLight(0xffffff,0x74828a,2));const light=new T.DirectionalLight(0xffffff,2.1);light.position.set(6,12,10);scene.add(light);
      scene.overrideMaterial=new T.MeshStandardMaterial({color:'#dadbd6',roughness:.72,side:T.DoubleSide});
      const scale=state.boatId==='dinghy'?8.23/4.23:1;const cam=new T.OrthographicCamera(-6.5*scale,6.5*scale,4.0625*scale,-4.0625*scale,.1,200);cam.position.set(...camera.map(x=>x*scale));cam.lookAt(0,2.8*scale,0);cam.updateProjectionMatrix();
      world.renderer.render(scene,cam);return world.renderer.domElement.toDataURL('image/png').split(',')[1];
    }, {camera});
    fs.writeFileSync(path.join('gennemgang/modelkontrol',`${id}-neutral-${name}.png`),Buffer.from(base64,'base64'));
  }
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
