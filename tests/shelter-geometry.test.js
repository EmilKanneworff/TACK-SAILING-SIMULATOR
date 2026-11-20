'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const context={SailingWorld:{ISLANDS:[{minX:-100,maxX:100,minY:-100,maxY:100,points:[{x:-100,y:-100},{x:100,y:-100},{x:100,y:100},{x:-100,y:100}]}]}};
context.globalThis=context;vm.runInNewContext(fs.readFileSync(path.resolve('assets/shelter.js'),'utf8'),context);const S=context.SailingShelter;
test('all four wind directions shelter only the downwind side of an island',()=>{for(const [angle,lee,windward] of [[0,[0,-160],[0,160]],[90,[-160,0],[160,0]],[180,[0,160],[0,-160]],[270,[160,0],[-160,0]]]){const field=S.field(angle),l=S.sample(field,...lee),w=S.sample(field,...windward);assert.ok(l<.7,`${angle}: lee ${l}`);assert.ok(w>.95,`${angle}: windward ${w}`);}});
test('shelter recovers gradually and is absent well outside its field',()=>{const f=S.field(0),near=S.sample(f,0,-160),far=S.sample(f,0,-600);assert.ok(near<far);assert.ok(far<1);assert.equal(S.sample(f,0,-5000),1);const at=S.sampleGradient(f,0,-200),eps=.001;assert.ok(Math.abs(at.dy-(S.sample(f,0,-200+eps)-S.sample(f,0,-200-eps))/(2*eps))<1e-7);});

const windSource=fs.readFileSync(path.resolve('assets/wind-field.js'),'utf8');
const island=(y,hill,forest=0,width=200,length=200)=>({
  minX:-width/2,maxX:width/2,minY:y-length/2,maxY:y+length/2,hill,forest
});
function windWorld(islands,houses=[]){
  const c={SailingWorld:{ISLANDS:islands,LANDMARKS:houses,islandSample(i,x,y){
    const d=Math.min(x-i.minX,i.maxX-x,y-i.minY,i.maxY-y);
    const t=i.terrain||i,heightDistance=Math.min(x-t.minX,t.maxX-x,y-t.minY,t.maxY-y);
    return {distance:-d,height:Math.max(0,Math.min(heightDistance/36,1)*i.hill)};
  }}};
  c.globalThis=c;vm.runInNewContext(windSource,c);
  return c.SailingWind;
}
const breeze={speed:6,gusts:0};

test('mean wind shelters only the leeward side and tends back to the open-water reference',()=>{
  const wind=windWorld([island(0,16,.3)]);
  for(const [direction,dx,dy] of [[0,0,-1],[90,-1,0],[180,0,1],[270,1,0]]){
    const e={...breeze,direction};
    const along=d=>wind.at(dx*d,dy*d,0,e).speed;
    assert.ok(along(130)<4.95);
    assert.equal(along(-125),6);
    assert.equal(wind.at(135*dy,135*dx,0,e).speed,6);
    const samples=[130,170,200,260,320,420].map(along);
    assert.ok(samples.every((v,i)=>i===0||v>=samples[i-1]));
    assert.ok(along(260)>=5.4);
    assert.ok(along(420)>5.9);
    assert.ok(samples.every(v=>v<=6));
  }
  assert.equal(wind.at(0,-5000,0,breeze).speed,6);
});

test('relief, vegetation, width and instrument height matter independently of waves',()=>{
  const open=windWorld([island(0,3)]),high=windWorld([island(0,9)]),covered=windWorld([island(0,9,.45)]);
  const tiny=windWorld([island(0,3,0,42,66)]);
  const settlement=windWorld([island(0,3)],[{x:0,y:-82,kind:'house'},{x:12,y:-82,kind:'house'}]);
  const at=(field,y,z)=>field.at(0,y,0,breeze,z).speed;
  assert.ok(at(open,-125)>at(high,-125)+.45);
  assert.ok(at(high,-125)>at(covered,-125));
  assert.ok(at(open,-125)>at(settlement,-125)+.035);
  assert.ok(at(covered,-125,25)>at(covered,-125,2)+.65);
  assert.ok(at(tiny,-55)>at(open,-125));
  assert.ok(at(tiny,-130)>5.91);
  assert.ok(at(open,-205)>at(open,-125));
});

test('at the same distance a low shore mixes out sooner than a high wooded shore',()=>{
  const low=windWorld([island(0,3,.06,310)]);
  const tall=windWorld([island(0,25,.60,310)]);
  const env={...breeze,speed:8.5};
  const sample=(wind,direction=0,z=2)=>[5,50,150,350,700].map(d=>wind.at(0,-100-d,0,{...env,direction},z).speed);
  const short=sample(low),long=sample(tall);
  assert.ok(short[0]>long[0]+2);
  assert.ok(long[0]>env.speed*.22);
  assert.ok(long.every((v,i)=>i===0||v>=long[i-1]));
  assert.ok(short[2]>8.45&&long[2]<8);
  assert.ok(long.at(-1)>8.45);
  assert.deepEqual(sample(tall,180),Array(5).fill(env.speed));
  assert.ok(sample(tall,0,14)[1]>long[1]);
});

test('overlapping shelter uses the stronger coast and counts partitioned land once',()=>{
  const high=island(55,21,.2,210,150),low=island(-110,5,.1,90,54);
  const single=windWorld([high]),pair=windWorld([high,low]),small=windWorld([low]);
  const at=(w,y)=>w.at(0,y,0,breeze).speed;
  assert.ok(at(pair,-61)>at(pair,-32), 'wind recovers in the first gap');
  assert.equal(at(pair,-150),Math.min(at(single,-150),at(small,-150)));
  assert.ok(at(pair,-330)>5.6);
  assert.ok(at(pair,-150)>=6*(1-pair.CONFIG.maxDeficit));
  const duplicate=windWorld([high,{...high,mesh:'secondary deck mesh'},low]);
  const partitioned=windWorld([{...high,maxX:0,terrain:high},{...high,minX:0,terrain:high},low]);
  for(const d of [0,90,187])for(const xy of [[0,-150],[-40,-70],[150,35],[-35,-278]]){
    const e={...breeze,direction:d};
    assert.equal(pair.at(...xy,3,e).speed,duplicate.at(...xy,3,e).speed);
    assert.equal(pair.at(...xy,3,e).speed,partitioned.at(...xy,3,e).speed);
  }
});

test('wind is continuous at the direction wrap and gusts advect with a common seed',()=>{
  const field=windWorld([island(0,19,.35)]),wind={speed:6,gusts:.35,direction:0,windSeed:833};
  const sample=(x,y,t,e=wind)=>field.at(x,y,t,e);
  const sides=[359.999,0,.001].map(direction=>sample(28,-128,4,{...wind,direction}).speed);
  assert.ok(Math.max(...sides)-Math.min(...sides)<.002);
  const loose={...wind,shelter:false},a=sample(1000,-600,7,loose),b=sample(1000,-600-6*.84*3,10,loose);
  assert.ok(Math.abs(a.speed-b.speed)<1e-10);
  assert.ok(Math.abs(a.direction-b.direction)<1e-10);
  assert.notEqual(a.speed,sample(1000,-600,7,{...loose,windSeed:1883}).speed);
  assert.equal(sample(28,-128,0,breeze).speed,sample(28,-128,120,breeze).speed);
  const variations=(x,y)=>Array.from({length:64},(_,i)=>sample(x,y,i*.3).direction).map(d=>d>180?d-360:d);
  const spread=list=>Math.max(...list)-Math.min(...list);
  assert.ok(spread(variations(0,-128))>spread(variations(0,150)));
});

test('a short fetch restores wind waves and locally generated long sea on different scales',()=>{
  const f=S.field(0);
  const distance=[45,120,350,700,1220,1420].map(d=>[0,-100-d]);
  const a=distance.map(p=>[S.sample(f,...p,0),S.sample(f,...p,1),S.sample(f,...p,2)]);
  for(let i=1;i<a.length;i++)for(let band=0;band<3;band++)assert.ok(a[i][band]>=a[i-1][band]);
  assert.ok(a[0][1]<.15&&a[0][2]<.13);
  assert.ok(a[2][1]<.55&&a[2][2]<.65);
  assert.ok(a.at(-1).every(x=>x>.98));
  assert.equal(S.sample(f,0,220,1),1);
  const separate=S.combinedField(180,0);
  assert.equal(S.sample(separate,0,-160,0),1);
  assert.equal(S.sample(separate,0,-160,1),S.sample(f,0,-160,1));
});
