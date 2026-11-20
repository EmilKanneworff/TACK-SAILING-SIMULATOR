const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('the chart, land mesh and collision use the same archipelago',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 await page.click('#startButton');await page.click('#mapExpand');await page.selectOption('#mapView','area');
 const r=await page.evaluate(()=>{const W=SailingWorld,map=SAILING_GAME.map,scene=SAILING_GAME.scene;map._worldData();
 const comparisons=W.ISLANDS.map(island=>{const coast=map._shoreCache.find(c=>c.island.id===island.id),mesh=scene.coastTerrain.find(m=>m.userData.islandId===island.id),positions=mesh.geometry.attributes.position.array;
  let matched=0;for(const p of island.points){for(let i=0;i<positions.length;i+=3)if(Math.abs(positions[i]-p.x)<.01&&Math.abs(positions[i+2]+p.y)<.01){matched++;break;}}
  return{id:island.id,identical:coast.points===island.points,vertices:matched,total:island.points.length};});
 const marks=id=>W.LANDMARKS.find(mark=>mark.id===id),ferry=marks('faaborg-havn');
 const distance=id=>{const p=marks(id);return Math.hypot(p.x-ferry.x,p.y-ferry.y);};
 const fyn=map._shoreCache[0].shore;
 return{comparisons,water:W.sample(0,0),waterSouth:W.heightAt(0,-2000),mode:map.mode,version:W.version,
  harborDistances:['bjorno-havn','lyo-havn','avernako-havn'].map(distance),ends:[fyn[0].x,fyn.at(-1).x]};});
 expect(r.comparisons.map(x=>x.id)).toEqual(expect.arrayContaining(['fyn','bjorno','lyo','avernako','svelmo']));
 for(const c of r.comparisons){expect(c.identical).toBe(true);expect(c.vertices,c.id).toBe(c.total)}
 expect(r.version).toBe('faaborg-metric-1');
 for(const [measured,reference] of r.harborDistances.map((d,i)=>[d,[3080,6960,6110][i]]))expect(Math.abs(measured-reference)).toBeLessThan(20);
 expect(r.ends[0]).toBeGreaterThan(9800);expect(r.ends[1]).toBeLessThan(-8500);
 expect(r.water.height).toBeLessThan(-2);expect(r.waterSouth).toBeLessThan(-10);expect(r.mode).toBe('area');
});
test('courses and their tactical envelopes stay in deep water in changing wind',async({page})=>{
 test.setTimeout(90000);await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const cases=await page.evaluate(()=>{let result=[];for(const boatId of ['laser','ac72'])for(const type of ['gates','triangle'])for(const direction of [0,90,180,270]){const c=new SailingCourse({...SAILING_GAME.env,boatId,direction},'course',type),m=c.model;result.push({boatId,type,direction,length:m.meta.length,depth:m.meta.minimumDepth,markDepth:Math.min(...m.buoys.map(b=>-SailingWorld.heightAt(b.x,b.y)))});}return result;});
 expect(cases.find(c=>c.boatId==='ac72').length).toBeGreaterThan(cases.find(c=>c.boatId==='laser').length);
 for(const c of cases){expect(c.depth,JSON.stringify(c)).toBeGreaterThanOrEqual(10);expect(c.markDepth,JSON.stringify(c)).toBeGreaterThanOrEqual(10);}
});
test('shore contact remains bounded and recovery returns the boat to navigable water',async({page})=>{
 test.setTimeout(60000);await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{
  const P=SailPhysics,R=SailingRecovery,e={...SAILING_GAME.env,speed:0,gusts:0,waves:0,boatId:'laser'};
  const s=P.createState({x:230,y:26,theta:Math.PI/2,vx:0,vy:2},e);
  let t=0,contacts=0,max=0;
  function step(){
   t+=1000/60;P.step(s,{steer:0,trim:-1,trimFast:true,crewPose:2},e,1/60);
   if(s.ground.contact)contacts++;
   max=Math.max(max,s.speed);
   if(s.capsized||s.recovering)R.update(s,e,t);
  }
  for(let i=0;i<900;i++)step();
  R.start(s,e,t);
  for(let i=0;i<330;i++)step();
  return {contacts,max,depth:-SailingWorld.heightAt(s.x,s.y),recovering:s.recovering,capsized:s.capsized};
 });
 expect(r.contacts).toBeGreaterThan(0);expect(r.max).toBeLessThan(8);expect(r.depth).toBeGreaterThan(2);expect(r.capsized).toBe(false);expect(r.recovering).toBe(false);
});
test('the deeper coastal shelf lets the catamaran pass while very shallow water still grounds it',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const checkpoints=await page.evaluate(()=>{
  const P=SailPhysics,W=SailingWorld,c=SailingBoats.get('ac72'),e={...P.DEFAULT_ENV,boatId:c.id,speed:0,waves:0,gusts:0};
  const x=230,coast=W.ISLANDS.find(i=>i.id==='fyn').chartCoast;
  const crossings=coast.slice(1).flatMap((b,i)=>{const a=coast[i];return (a.x>x)!==(b.x>x)?[a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x)]:[];});
  const shore=Math.min(...crossings);
  return [0,10,38,60].map(offset=>{
   const y=shore-offset;
   const s=P.createState({boatId:c.id,x,y,theta:0,vx:0,vy:0},e);
   const ground=W.contact(s,c,e);
   return {offset,depth:ground.depth,contact:ground.contact,waveDepth:SailingWaterDepth.sample(x,y).depth};
  });
 });
 const [shore,shallow,channel,outside]=checkpoints;
 expect(shore.depth).toBeCloseTo(0,6);
 expect(shallow.contact).toBe(true);
 expect(channel.depth).toBeGreaterThan(4);
 expect(Math.abs(channel.waveDepth-channel.depth)).toBeLessThan(.65);
 expect(channel.contact).toBe(false);
 expect(outside.depth).toBeGreaterThan(channel.depth);
});
test('named settlements and island roads appear on the shared chart and in the scene',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);await page.click('#startButton');await page.click('#mapExpand');await page.click('#mapExpand');await page.selectOption('#mapView','area');
 const shoreNames=['Drejet','Faaborg Havn','Dyreborg Havn','Bjørnø Bro','Lyø Havn','Avernakø Havn'];
 const r=await page.evaluate((shoreNames)=>{
  const w=SailingWorld,map=SAILING_GAME.map,scene=SAILING_GAME.scene;
  const visibleLabels=()=>{map.draw();return map.lastFrame.labels.map(({text})=>text);};
  const overview=visibleLabels(),original=map.view,detail=[],towns=[];
  try{
   for(const name of shoreNames){
    const mark=w.LANDMARKS.find(m=>m.name===name);
    if(!mark)continue;
    map.view={x:mark.x,y:mark.y,scale:.9};
    if(visibleLabels().includes(name))detail.push(name);
   }
   for(const mark of w.LANDMARKS.filter(m=>m.kind==='town')){
    map.view={x:mark.x,y:mark.y,scale:.9};
    if(visibleLabels().includes(mark.name))towns.push(mark.name);
   }
  }finally{map.view=original;map.draw();}
  const places=(...kinds)=>w.LANDMARKS.filter(m=>kinds.includes(m.kind)).map(m=>({name:m.name,height:w.heightAt(m.x,m.y)}));
  return {overview,detail,towns,settlements:places('town','feature'),houses:places('house'),
   roads:w.ROADS.map(x=>x.id),roadVertices:scene.coast.getObjectByName('Veje og Drejet').geometry.attributes.position.count,
   fieldVertices:scene.coast.getObjectByName('Øernes marker').geometry.attributes.position.count,
   stones:scene.coast.getObjectByName('Drejets stensætning').count};
 },shoreNames);
 for(const name of ['Bjørnø','Lyø','Avernakø','Svelmø'])expect(r.overview).toContain(name);
 for(const name of ['Faaborg','Dyreborg','Ny Dyreborg','Bjørnø By','Lyø By','Skovhuse','Avernak By','Munke','Korshavn','Nakkenshuse'])expect(r.towns).toContain(name);
 expect(r.detail).toEqual(shoreNames);
 for(const place of r.settlements)expect(place.height,place.name).toBeGreaterThanOrEqual(0);
 expect(r.roads).toEqual(expect.arrayContaining(['avernako-route','lyo-route','bjorno-route']));expect(r.roadVertices).toBeGreaterThan(0);expect(r.fieldVertices).toBeGreaterThan(0);expect(r.stones).toBeGreaterThan(0);for(const house of r.houses)expect(house.height,house.name).toBeGreaterThanOrEqual(0);
});
