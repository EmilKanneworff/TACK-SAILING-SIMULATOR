'use strict';

const fs=require('node:fs/promises');
const {chromium}=require('@playwright/test');
const {introOption}=require('./browser-setup.cjs');

async function main(){
 const [url='http://localhost:4200/',out='/tmp/tack-steering-browser.json']=process.argv.slice(2);
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
 try{
  const result={browser:browser.version(),url,boats:[],sea:[]};
  for(const id of ['laser','dinghy','yacht','ac75','ac72']){
   const page=await browser.newPage({viewport:{width:1280,height:720}});
   await page.clock.install();
   const response=await page.goto(url);
   result.revision=await response.headerValue('x-fri-vind-revision');
   await page.waitForFunction(()=>window.SAILING_GAME);
   await (await introOption(page,'#introBoat')).selectOption(id);
   await page.selectOption('#introDifficulty','hard');
   await page.click('#startButton');
   await page.clock.pauseAt(await page.evaluate(()=>Date.now()+650));
   await page.keyboard.press('Backquote');
   const setup=async side=>page.evaluate(({id,side})=>{
    const {env,state}=SAILING_GAME,P=SailPhysics;
    Object.assign(env,{speed:6,direction:0,gusts:0,waveHeight:.25,chop:.12,
     windSeed:318031,waveSeed:318031,shelter:false,autoRecovery:false});
    const theta=(90-side*83)*P.DEG,trim=.61,v=id.startsWith('ac')?5:3;
    Object.assign(state,TackSimulation.createBoat(id,{x:-775,y:-2350,theta,vx:v*Math.cos(theta),
     vy:v*Math.sin(theta),sheet:P.sheetFromTrim(trim,id),crewPose:2,crewSide:-side},env));
    const input=document.getElementById('sheetControl');
    input.value=String(100*trim);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('sea').focus({preventScroll:true});
   },{id,side});
   const read=async()=>page.evaluate(()=>{
    const {state,env}=SAILING_GAME,i=SailPhysics.instruments(state,null,env),trace=SAILING_GAME.steeringDiagnostics.step;
    return {id:state.boatId,heading:i.heading,speed:i.waterSpeed,sheet:state.sheet,rudder:state.rudder,
     crewPose:state.crewPose,crewSide:state.crewSide,foreAft:state.crewForeAft,heel:state.heel,trace:trace&&{
      received:trace.received,target:trace.target,actual:trace.actual,yaw:trace.yawExternal},
     capsized:state.capsized,ground:state.ground.contact};
   });
   const runs=[];
   for(const side of [-1,1]){
    await setup(side);
    await page.keyboard.press(side>0?'KeyQ':'KeyE');
    await page.keyboard.press('2');
    await page.clock.runFor(150);
    const before=await read(),helm=side>0?'ArrowRight':'ArrowLeft';
    await page.keyboard.down(helm);
    await page.clock.runFor(1000);
    const turn=await read();
    await page.keyboard.up(helm);
    await page.keyboard.down('ArrowDown');
    await page.clock.runFor(450);
    const ease=await read();
    await page.keyboard.up('ArrowDown');
    const headingDelta=(turn.heading-before.heading+540)%360-180;
    const verified=turn.trace?.received===side&&turn.rudder*side>0&&headingDelta*side>0&&
     ease.sheet<turn.sheet&&ease.crewPose===2&&ease.crewSide===-side&&!ease.capsized&&!ease.ground;
    runs.push({side,verified,headingDelta,before,turn,ease});
   }
   result.boats.push({id,runs});
   console.log(id,runs.map(x=>[x.verified,x.headingDelta.toFixed(2)]));
   if(id==='laser')for(const [x,y] of [[-775,-2400],[0,0]])for(const [waveHeight,chop] of [[2.5,0],[0,1]]){
    const measurement=await page.evaluate(({x,y,waveHeight,chop})=>{
     const {env,state}=SAILING_GAME;
     Object.assign(env,{speed:5,direction:270,gusts:0,waveHeight,chop,shelter:true});
     Object.assign(state,TackSimulation.createBoat('laser',{x,y,time:0},env));
     return SAILING_GAME.measureSeaAtBoat?.() ?? SAILING_GAME.seaDiagnostics;
    },{x,y,waveHeight,chop});
    result.sea.push(measurement);
   }
   await page.close();
  }
  await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
  if(result.boats.some(boat=>boat.runs.some(run=>!run.verified)))process.exitCode=1;
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
