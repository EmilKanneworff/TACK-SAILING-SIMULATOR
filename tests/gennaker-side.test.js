'use strict';
const { introOption } = require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');const {pathToFileURL}=require('node:url');const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('Gennaker fills to leeward on both tacks and moves gradually after a wind shift',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{const P=SailPhysics,e={...P.DEFAULT_ENV,boatId:'yacht',speed:7,direction:0,gusts:0,waves:0,shelter:false};const make=dir=>{const env={...e,direction:dir},s=P.createState({boatId:'yacht',x:0,y:-5000,theta:0,vx:0,vy:0,sheet:.52},env);P.step(s,{steer:0,trim:0,crewPose:2,spinnaker:true,downwindType:'gennaker'},env,1/60);return {s,env}};const a=make(0),b=make(180),out=[a,b,...[30,330,150,210].map(make)].map(({s})=>({side:s.spinnaker.sideBlend,awa:s.wind.awa}));for(let i=0;i<300;i++)P.step(a.s,{steer:0,trim:0,crewPose:2,spinnaker:true,downwindType:'gennaker'},a.env,1/60);const before=a.s.spinnaker.sideBlend;a.env.direction=180;P.step(a.s,{steer:0,trim:0,crewPose:2,spinnaker:true,downwindType:'gennaker'},a.env,1/60);const first=a.s.spinnaker.sideBlend;for(let i=0;i<480;i++)P.step(a.s,{steer:0,trim:0,crewPose:2,spinnaker:true,downwindType:'gennaker'},a.env,1/60);return {out,before,first,after:a.s.spinnaker.sideBlend,awa:a.s.wind.awa,requested:a.s.spinnaker.requested};});
 for(const q of result.out){expect(q.side*q.awa).toBeLessThan(0);expect(Math.abs(q.side)).toBeGreaterThan(.99)}expect(Math.abs(result.first-result.before)).toBeLessThan(.05);expect(result.after*result.awa).toBeLessThan(0);expect(result.requested).toBe(true);
});
test('Gennaker is white and the visible cloth follows the simulated lee side',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);await (await introOption(page, '#introBoat')).selectOption('yacht');await page.click('#startButton');
 const r=await page.evaluate(()=>{
  const {state,scene,env}=SAILING_GAME,mesh=scene.gennakerMesh;
  state.spinnaker={type:'gennaker',hoist:1,luff:0,fill:1,sideBlend:-1,side:-1};
  const p=mesh.geometry.attributes.position,sumZ=()=>{
   let sum=0;
   for(let i=0;i<p.count;i++)sum+=p.getZ(i);
   return sum;
  };
  scene.updateBoat(state,env,0);
  const neg=sumZ();
  state.spinnaker.sideBlend=1;
  scene.updateBoat(state,env,0);
  const {rows,cols}=mesh.userData.grid;
  const chord=i=>Math.hypot(p.getX(i+cols)-p.getX(i),p.getZ(i+cols)-p.getZ(i));
  let area=0;
  for(let i=0;i<rows;i++){
   const a=i*(cols+1),b=a+cols+1;
   area+=(p.getY(b)-p.getY(a))*(chord(a)+chord(b))/2;
  }
  return {visible:mesh.visible,color:mesh.material.color.getHexString(),vertexColors:mesh.material.vertexColors,
   neg,pos:sumZ(),area,expectedArea:SailingBoats.get('yacht').gennakerArea};
 });
 expect(r.visible).toBe(true);expect(r.color).toBe('f6f6f2');expect(r.vertexColors).toBe(false);expect(r.neg).toBeLessThan(0);expect(r.pos).toBeGreaterThan(0);
 expect(Math.abs(r.area-r.expectedArea)).toBeLessThan(1);
});
