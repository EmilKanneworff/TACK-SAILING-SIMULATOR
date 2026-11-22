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

test('slackening the sheet and steering from the cockpit builds way in following swell',async({page})=>{
 test.setTimeout(60000);
 await page.clock.install();
 await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
 await (await introOption(page,'#introWeatherEdit')).click();
 await page.locator('#windSpeed').fill('8');
 await page.locator('#windDirection').fill('270');
 await page.locator('#windGusts').fill('0');
 await page.locator('#waveHeight').fill('0.8');
 await page.locator('#chop').fill('0');
 await page.click('[data-close="settings"]');
 await page.click('#startButton');
 await page.evaluate(()=>{
  const {env,state}=SAILING_GAME;
  Object.assign(state,TackSimulation.createBoat('laser',{
   x:-1500,y:-1930,theta:0,time:1,vx:1.8,vy:0,sheet:.35,crewPose:1
  },env));
 });
 await page.locator('#sea').focus();
 await page.keyboard.press('Digit1');
 await page.keyboard.down('ArrowDown');
 await page.clock.runFor(1250);
 await page.keyboard.up('ArrowDown');
 await page.keyboard.down('ArrowRight');
 await page.clock.runFor(125);
 expect(await page.evaluate(()=>SAILING_GAME.state.steerIntent)).toBe(1);
 await page.keyboard.up('ArrowRight');
 await page.clock.runFor(2300);
 const result=await page.evaluate(()=>{
  const s=SAILING_GAME.state,P=SailPhysics;
  return {sheet:s.sheet,boom:Math.abs(s.boom)/P.DEG,vmg:s.vx,x:s.x,awa:Math.abs(s.wind.awa)/P.DEG,cap:s.capsized};
 });
 expect(result.sheet).toBeLessThan(.08);
 expect(result.boom).toBeGreaterThan(65);
 expect(result.vmg).toBeGreaterThan(2.1);
 expect(result.x).toBeGreaterThan(-1494);
 expect(result.awa).toBeGreaterThan(125);
 expect(result.cap).toBe(false);
 console.log('Læns med tastatur',JSON.stringify(result));
});
