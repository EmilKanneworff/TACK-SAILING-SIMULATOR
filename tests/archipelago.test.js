const {dragMap}=require('../scripts/browser-setup.cjs');
const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});
test('the chart, land mesh and collision use the same archipelago',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 await page.click('#startButton');await dragMap(page,260,130);
 await page.locator('#courseCard').hover();await page.selectOption('#mapView','area');
 const r=await page.evaluate(()=>{const W=SailingWorld,map=SAILING_GAME.map,scene=SAILING_GAME.scene;map._worldData();
 const comparisons=W.ISLANDS.map(island=>{
  const coast=map._shoreCache.find(c=>c.island.id===island.id);
  const tiles=scene.coastTerrain.filter(m=>m.userData.islandId===island.id);
  const boundary=new Set(island.points.map(p=>Math.fround(p.x)+':'+Math.fround(-p.y)));
  for(const {geometry} of tiles){
   const p=geometry.attributes.position;
   for(const index of geometry.index.array)if(p.getY(index)<.001)boundary.delete(p.getX(index)+':'+p.getZ(index));
  }
  return{id:island.id,identical:coast.points===island.points,missing:boundary.size};
 });
 const marks=id=>W.LANDMARKS.find(mark=>mark.id===id),ferry=marks('faaborg-havn');
 const distance=id=>{const p=marks(id);return Math.hypot(p.x-ferry.x,p.y-ferry.y);};
 const fyn=map._shoreCache[0].shore;
 return{comparisons,water:W.sample(0,0),waterSouth:W.heightAt(0,-500),mode:map.mode,version:W.version,
  harborDistances:['bjorno-havn','lyo-havn','avernako-havn'].map(distance),ends:[fyn[0].x,fyn.at(-1).x]};});
 expect(r.comparisons.map(x=>x.id)).toEqual(expect.arrayContaining(['fyn','bjorno','lyo','avernako','svelmo']));
 for(const c of r.comparisons){expect(c.identical).toBe(true);expect(c.missing,c.id).toBe(0)}
 expect(r.version).toBe('faaborg-quarter-1');
 for(const [measured,reference] of r.harborDistances.map((d,i)=>[d,[3080,6960,6110][i]/4]))expect(Math.abs(measured-reference)).toBeLessThan(5);
 expect(r.ends[0]).toBeGreaterThan(2450);expect(r.ends[1]).toBeLessThan(-2125);
 expect(r.water.height).toBeLessThan(-2);expect(r.waterSouth).toBeLessThan(-10);expect(r.mode).toBe('area');
});
test('dry shore triangles rise above calm water and offscreen terrain tiles are culled',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{
  const {scene}=SAILING_GAME,W=SailingWorld;
  const islands=new Map(W.ISLANDS.map(island=>[island.id,island]));
  let flatLandArea=0,total=0,submitted=0;
  scene.camera.position.set(0,5,0);
  scene.camera.lookAt(50,5,225);
  scene.camera.far*=ArchipelagoData.horizontalScale;
  scene.camera.updateProjectionMatrix();
  scene.camera.updateMatrixWorld();
  const frustum=new THREE.Frustum().setFromProjectionMatrix(
   new THREE.Matrix4().multiplyMatrices(scene.camera.projectionMatrix,scene.camera.matrixWorldInverse));
  for(const tile of scene.coastTerrain){
   const island=islands.get(tile.userData.islandId);
   const p=tile.geometry.attributes.position,index=tile.geometry.index?.array,count=index?.length??p.count;
   total+=count/3;
   if(frustum.intersectsObject(tile))submitted+=count/3;
   for(let i=0;i<count;i+=3){
    const a=index?.[i]??i,b=index?.[i+1]??i+1,c=index?.[i+2]??i+2;
    if(Math.max(p.getY(a),p.getY(b),p.getY(c))>.0005)continue;
    const x=(p.getX(a)+p.getX(b)+p.getX(c))/3,y=-(p.getZ(a)+p.getZ(b)+p.getZ(c))/3;
    if(W.islandSample(island,x,y).height<=.003)continue;
    flatLandArea+=Math.abs((p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))-
      (p.getX(c)-p.getX(a))*(p.getZ(b)-p.getZ(a)))/2;
   }
  }
  return {flatLandArea,submitted,total};
 });
 expect(r.flatLandArea).toBe(0);
 expect(r.submitted).toBeGreaterThan(0);
 expect(r.submitted).toBeLessThan(r.total*.55);
});
test('courses and their tactical envelopes stay in deep water in changing wind',async({page})=>{
 test.setTimeout(90000);await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const cases=await page.evaluate(()=>SailingBoats.LIST.flatMap(boat=>['gates','triangle'].flatMap(type=>[0,90,180,270].map(direction=>{
  const {model:m}=new SailingCourse({...SAILING_GAME.env,boatId:boat.id,direction},'course',type);
  return {boatId:boat.id,type,direction,length:m.meta.length,depth:m.meta.minimumDepth,
   startWidth:m.meta.startLineWidth,boatLength:boat.length,spawnDepth:-SailingWorld.heightAt(m.spawn.x,m.spawn.y),
   markDepth:Math.min(...m.buoys.map(b=>-SailingWorld.heightAt(b.x,b.y)))};
 }))));
 const originalLegs={laser:210,dinghy:280,yacht:480,ac75:960,ac72:1120};
 for(const c of cases){
  expect(c.length).toBe(originalLegs[c.boatId]/4);
  expect(c.startWidth).toBeGreaterThanOrEqual(7*c.boatLength);
  expect(c.depth,JSON.stringify(c)).toBeGreaterThanOrEqual(10);
  expect(c.markDepth,JSON.stringify(c)).toBeGreaterThanOrEqual(10);
  expect(c.spawnDepth,JSON.stringify(c)).toBeGreaterThan(5);
 }
});
test('shore contact remains bounded and recovery returns the boat to navigable water',async({page})=>{
 test.setTimeout(60000);await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const r=await page.evaluate(()=>{
  const P=SailPhysics,R=SailingRecovery,e={...SAILING_GAME.env,speed:0,gusts:0,waves:0,boatId:'laser'};
  const s=P.createState({...ArchipelagoData.fromMetric(230,26),theta:Math.PI/2,vx:0,vy:2},e);
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
test('the beach stays shallow and all five boats clear the coastal shelf',async({page})=>{
 await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const checkpoints=await page.evaluate(()=>{
  const P=SailPhysics,W=SailingWorld,weather={...P.DEFAULT_ENV,speed:0,waves:0,gusts:0};
  const x=ArchipelagoData.fromMetric(230,0).x,coast=W.ISLANDS.find(i=>i.id==='fyn').chartCoast;
  const crossings=coast.slice(1).flatMap((b,i)=>{const a=coast[i];return (a.x>x)!==(b.x>x)?[a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x)]:[];});
  const shore=Math.min(...crossings);
  return [0,1,2.5,5,10,15,40].map(offset=>{
   const y=shore-offset,contacts=SailingBoats.LIST.flatMap(boat=>{
    const env={...weather,boatId:boat.id};
    const state=P.createState({boatId:boat.id,x,y,theta:0,vx:0,vy:0},env);
    const hit=W.contact(state,boat,env);
    return hit.contact?[{boatId:boat.id,part:hit.part,point:hit.point}]:[];
   });
   const raisedFoils=offset===10?['ac75','ac72'].map(boatId=>{
    const boat=SailingBoats.get(boatId),env={...weather,boatId};
    const state=P.createState({boatId,x,y,theta:0,vx:0,vy:0},env);
    for(const side of ['port','starboard'])state.foils[side].arm=boat.foilUpAngle;
    return W.contact(state,boat,env).contact;
   }):[];
   return {depth:-W.heightAt(x,y),contacts,waveDepth:SailingWaterDepth.sample(x,y).depth,raisedFoils};
  });
 });
 const [shore,beach,near,drop,shelf,channel,outer]=checkpoints;
 expect(shore.depth).toBeCloseTo(0,6);
 expect(beach.depth).toBeLessThan(1.2);
 expect(beach.contacts.map(hit=>hit.boatId)).toEqual(['laser','dinghy','yacht','ac75','ac72']);
 expect(near.contacts.map(hit=>hit.boatId)).toEqual(['ac75','ac72']);
 expect(drop.depth).toBeGreaterThan(7);
 expect(shelf.depth).toBeGreaterThan(9);
 expect(shelf.contacts).toMatchObject([{boatId:'ac72',part:'port foil'}]);
 expect(shelf.raisedFoils).toEqual([false,false]);
 const tip=shelf.contacts[0].point;
 expect(tip.bedHeight).toBeGreaterThan(tip.z);
 expect(tip.penetration).toBeCloseTo(tip.bedHeight-tip.z,8);
 expect(Math.abs(channel.waveDepth-channel.depth)).toBeLessThan(.65);
 expect(channel.contacts).toEqual([]);
 expect(outer.contacts).toEqual([]);
 for(let i=1;i<checkpoints.length;i++)expect(checkpoints[i].depth).toBeGreaterThan(checkpoints[i-1].depth);
});
test('named settlements and island roads appear on the shared chart and in the scene',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.click('#startButton');
 await dragMap(page,580,400);
 await page.waitForFunction(()=>SAILING_GAME.map.height>490);
 await page.locator('#courseCard').hover();
 await page.selectOption('#mapView','area');
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
