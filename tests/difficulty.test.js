'use strict';
const {test,expect}=require('@playwright/test');
const {resolve}=require('node:path');
const {pathToFileURL}=require('node:url');

test.use({launchOptions:{executablePath:process.env.CHROME_PATH||
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
const game=pathToFileURL(resolve('index.html')).href;

test('difficulty is remembered and switching to hard restores the manual weight controls',async({page})=>{
 await page.setViewportSize({width:390,height:744});
 await page.goto(game);
 await expect(page.locator('#introDifficulty')).toHaveValue('hard');
 await page.selectOption('#introDifficulty','easy');
 await page.reload();
 await expect(page.locator('#introDifficulty')).toHaveValue('easy');
 await page.click('#startButton');
 await page.waitForFunction(()=>SAILING_GAME.state.crewDifficulty==='easy');
 await expect(page.locator('#pose3')).toBeHidden();
 await expect(page.locator('#crewPoseLabel')).toHaveText('Automatisk balance');
 await page.keyboard.press('3');
 expect(await page.evaluate(()=>SAILING_GAME.env.crewPose)).toBe(2);
 await page.click('#preferencesButton');
 await expect(page.locator('#difficulty')).toHaveValue('easy');
 await page.selectOption('#difficulty','hard');
 await page.keyboard.press('Escape');
 await expect(page.locator('#pose3')).toBeVisible();
 await page.keyboard.press('3');
 await page.waitForFunction(()=>SAILING_GAME.state.crewDifficulty==='hard'&&SAILING_GAME.state.crewPose===3);
});

test('Laser on hard responds to side taps, short helm inputs and a fast sheet release',async({page})=>{
 await page.goto(game);
 await page.selectOption('#introDifficulty','hard');
 await page.click('#startButton');
 await page.keyboard.press('KeyE');
 await page.waitForFunction(()=>SAILING_GAME.state.crewSideBlend>.85&&SAILING_GAME.state.crewCG.z>.20);
 await page.keyboard.press('KeyQ');
 await page.waitForFunction(()=>SAILING_GAME.state.crewSideBlend<-.85&&SAILING_GAME.state.crewCG.z<-.20);
 await page.keyboard.press('1');
 await page.waitForFunction(()=>SAILING_GAME.state.crewPoseBlend<1.1);
 const before=await page.evaluate(()=>({theta:SAILING_GAME.state.theta,sheet:SAILING_GAME.state.sheet,time:SAILING_GAME.state.time}));
 await page.keyboard.down('ArrowRight');
 await page.keyboard.down('ArrowDown');
 await page.waitForFunction(time=>SAILING_GAME.state.time>=time+.30,before.time);
 await page.keyboard.up('ArrowDown');
 await page.keyboard.up('ArrowRight');
 const after=await page.evaluate(({theta,time})=>{const s=SAILING_GAME.state;return {
  turn:SailPhysics.wrap(theta-s.theta)/SailPhysics.DEG,sheet:s.sheet,elapsed:s.time-time,capsized:s.capsized
 };},before);
 expect(after.capsized).toBe(false);
 expect(after.turn).toBeGreaterThan(2);
 expect(before.sheet-after.sheet).toBeGreaterThan(.23);
});

test.describe('touch controls',()=>{
 test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
 test('Laser on hard can select the side using the balance controls',async({page})=>{
  await page.goto(game);
  await page.click('#startButton');
  await page.getByRole('button',{name:'Vælg styrbord side'}).tap();
  await expect(page.locator('#crewStarboard')).toHaveAttribute('aria-pressed','true');
  await page.waitForFunction(()=>SAILING_GAME.state.crewSideBlend>.85);
 });
});

test('the easy crew crosses to the new windward side on all five boats',async({page})=>{
 test.setTimeout(60000);
 await page.goto(game);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const results=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG;
  return SailingBoats.LIST.map(({id:boatId})=>{
   const env={...SAILING_GAME.env,boatId,difficulty:'easy',speed:8.5,direction:0,waves:.20,gusts:.18,shelter:false};
   const heading=32*D,sheet=.73,speed=boatId==='laser'?2.7:3.4;
   const s=P.createState({boatId,x:0,y:-5000,theta:heading,sheet,
    vx:speed*Math.cos(heading),vy:speed*Math.sin(heading)},env);
   let capped=false;
   const step=target=>{
    const steer=P.clamp(-1.8*P.wrap(target-s.theta)+.97*s.omega,-.70,.70);
    const trim=P.clamp((sheet-s.sheet)*5,-1,1);
    P.step(s,{steer,trim,crewPose:1,trimFast:true,steerDigital:false},env,1/60);
    capped ||= s.capsized;
   };
   for(let i=0;i<600;i++)step(heading);
   const before=s.crewSideBlend;
   let crossedAt=null,switchedAt=null;
   for(let i=0;i<840;i++){
    step(148*D);
    if(crossedAt===null&&s.theta>Math.PI/2)crossedAt=s.time;
    if(crossedAt!==null&&switchedAt===null&&s.crewSideBlend>.8)switchedAt=s.time;
   }
   return {boatId,before,after:s.crewSideBlend,capped,crossedAt,switchedAt};
  });
 });
 for(const r of results){
  const context=JSON.stringify(r);
  expect(r.capped,context).toBe(false);
  expect(r.before,context).toBeLessThan(-.8);
  expect(r.crossedAt,context).not.toBeNull();
  expect(r.switchedAt,context).not.toBeNull();
  expect(r.switchedAt-r.crossedAt,context).toBeLessThan(1.25);
  expect(r.after,context).toBeGreaterThan(.8);
 }
});

test('the same loaded Laser stays upright on easy and can capsize on hard',async({page})=>{
 await page.goto(game);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,D=P.DEG,theta=22*D,sheet=.70;
  return ['easy','hard'].map(difficulty=>{
   const env={...SAILING_GAME.env,difficulty,boatId:'laser',speed:20,direction:0,waves:.25,gusts:.18,shelter:false};
   const state=P.createState({x:0,y:-5000,theta,sheet,vx:2.7*Math.cos(theta),vy:2.7*Math.sin(theta)},env);
   let eased=false,peakPose=2,peakHeel=0;
   for(let i=0;i<600&&!state.capsized;i++){
    const steer=P.clamp(-1.8*P.wrap(theta-state.theta)+.97*state.omega,-.70,.70);
    const trim=P.clamp((sheet-state.sheet)*5,-1,1);
    P.step(state,{steer,trim,crewPose:2,trimFast:true,steerDigital:false},env,1/60);
    eased ||= state.crewEasing||state.crewSpill>.25;
    peakPose=Math.max(peakPose,state.crewPoseBlend);
    peakHeel=Math.max(peakHeel,Math.abs(state.heel)/D);
   }
   return {capsized:state.capsized,peakPose,peakHeel,eased};
  });
 });
 const [easy,hard]=result;
 expect(easy,JSON.stringify(result)).toMatchObject({capsized:false,eased:true});
 expect(easy.peakPose).toBeGreaterThan(2.5);
 expect(hard).toMatchObject({capsized:true,peakPose:2,eased:false});
});
