'use strict';
// Export hydrostatic load profiles from the active simulator.
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');const {chromium}=require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage();
 try{
 const response=await page.goto(process.env.FRI_VIND_URL||pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const revision=await response.headerValue('x-fri-vind-revision');
 const profiles=await page.evaluate(()=>Object.keys(SailingBoats.CONFIGS).map(id=>{
  const P=SailPhysics,B=SailingBoats,c=P.configFor(id);
  const env={...P.DEFAULT_ENV,boatId:id,sea:'calm',waves:0,speed:0,gusts:0,shelter:false,autoBalance:false};
  const state=P.createState({boatId:id,x:0,y:-13000,vx:0,vy:0,theta:0,crewPose:1,crewPoseBlend:1,crewSide:0,crewSideBlend:0},env);
  const {hydro:h}=state,foiler=c.kind==='foiler',mass=foiler?FoilingPhysics.massProperties(state):null;
  const columns=Array.from({length:401},(_,i)=>{
   const x=c.hullSections[0][0]+(c.hullSections.at(-1)[0]-c.hullSections[0][0])*i/400;
   const draft=-state.heave-B.hullBottom(c,x,0);
   let low=0,high=draft>0?B.halfBeamAt(c,x):0;
   for(let j=0;j<16;j++){
    const mid=(low+high)*.5;
    if(state.heave+B.hullBottom(c,x,mid)<0)low=mid;else high=mid;
   }
   return {x,draft,wetHalfBeam:low};
  });
  const wetted=columns.filter(sample=>sample.draft>0),perSide=18;
  function sectionPoint(column,i){
   const z=column.wetHalfBeam*i/perSide;
   return {x:column.x,y:Math.min(0,state.heave+B.hullBottom(c,column.x,z)),z};
  }
  function triangleArea(a,b,d){
   const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z,u=d.x-a.x,v=d.y-a.y,w=d.z-a.z;
   return .5*Math.hypot(y*w-z*v,z*u-x*w,x*v-y*u);
  }
  let wettedHullArea=0;
  for(let i=1;i<columns.length;i++)for(let j=1;j<=perSide;j++){
   const a=sectionPoint(columns[i-1],j-1),b=sectionPoint(columns[i-1],j),
    d=sectionPoint(columns[i],j-1),e=sectionPoint(columns[i],j);
   wettedHullArea+=triangleArea(a,b,d)+triangleArea(b,d,e);
  }
  wettedHullArea*=2*(c.hullOffsets?.length||1);
  const appendages=foiler?FoilingPhysics.foilKeys(state).map(key=>{
   const p=FoilingPhysics.foilPose(state,key);
   return {id:key,area:p.area,span:p.span,chord:p.chord,centre:p.wingCentre,hinge:p.hinge,immersion:Math.max(0,-P.bodyPoint(state,p.wingCentre).z)};
  }):[
   {id:c.kind==='keelboat'?'keel':'board',...c.waterBlades.board,z:0,tipDepth:Math.max(0,-state.heave-c.waterBlades.board.tip)},
   ...(c.rudderOffsets||[0]).map(z=>({id:'rudder',...c.waterBlades.rudder,area:c.waterBlades.rudder.area/(c.rudderOffsets?.length||1),
    z,tipDepth:Math.max(0,-state.heave-c.waterBlades.rudder.tip)}))
  ];
  const crew=state.crewJoints?.segments||state.crewStations;
  P.step(state,{crewPose:state.crewPose},env,1/60);
  const inertia=state.massMotion.inertia;
  const components=foiler?mass.points:c.massPoints;
  return {id,name:c.name,loadCondition:{crewPose:state.crewPose,crewSide:state.crewSide,heave:state.heave,weight:h.weight,buoyancy:h.buoyancy,
   submergedHullVolume:h.submergedVolume,totalDisplacedVolume:h.totalDisplacedVolume,waterlineLength:wetted.length?wetted.at(-1).x-wetted[0].x:0,
   hullDraft:Math.max(0,...columns.map(column=>column.draft)),wettedHullArea,
   cg:h.cg,inertiaAtCG:inertia,appendages,crew,components},calibration:c};
 }));
 const folder='gennemgang/fysik';
 fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(path.join(folder,'baadprofiler.json'),JSON.stringify({revision,units:'SI, vinkler i radianer',profiles},null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
