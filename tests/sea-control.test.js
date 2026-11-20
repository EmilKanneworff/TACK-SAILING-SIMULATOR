const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('oblique seas change the motion while keyboard helm remains responsive',async({browser})=>{
 test.setTimeout(90000);
 async function run(waves){
  const context=await browser.newContext({viewport:{width:900,height:600}}),page=await context.newPage();
  try{
   await page.clock.install();
   await page.goto(pathToFileURL(path.resolve('index.html')).href);
   await page.waitForFunction(()=>window.SAILING_GAME);
   await (await introOption(page,'#introWeatherEdit')).click();
   await page.locator('#windSpeed').fill('6');
   await page.locator('#windDirection').fill('225');
   await page.locator('#waveHeight').fill(waves?'0.85':'0');
   await page.click('[data-close="settings"]');
   await page.click('#startButton');
   await page.evaluate(()=>{
    const {env,state}=SAILING_GAME,P=SailPhysics;
    const source=env.direction*P.DEG;
    const downwave=Math.atan2(-Math.cos(source),-Math.sin(source));
    Object.assign(state,P.createState({x:0,y:-5000,theta:downwave+Math.PI/4},env));
   });
   const heels=[],pitches=[];
   for(let i=0;i<10;i++){
    await page.clock.runFor(500);
    const {heel,pitch}=await page.evaluate(()=>SAILING_GAME.state);
    heels.push(heel);
    pitches.push(pitch);
   }
   const before=await page.evaluate(()=>SAILING_GAME.state.theta);
   await page.keyboard.down('ArrowRight');
   await page.clock.runFor(1500);
   const after=await page.evaluate(()=>({theta:SAILING_GAME.state.theta,steer:SAILING_GAME.state.steerIntent}));
   await page.keyboard.up('ArrowRight');
   return {before,after,heels,pitches};
  }finally{await context.close();}
 }
 const flat=await run(0),sea=await run(.85),wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
 expect(Math.abs(wrap(sea.after.theta-sea.before))).toBeGreaterThan(.1);
 expect(sea.after.steer).toBe(1);
 expect(Math.max(...sea.heels)-Math.min(...sea.heels)).toBeGreaterThan(.015);
 expect(Math.max(...sea.pitches)-Math.min(...sea.pitches)).toBeGreaterThan(.015);
 expect(Math.max(...sea.pitches.map((x,i)=>Math.abs(x-flat.pitches[i])))).toBeGreaterThan(.01);
});
