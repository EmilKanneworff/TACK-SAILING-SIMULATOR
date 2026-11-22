'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/course-editor-model');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function course(){return {version:1,map:E.MAP,id:'test',name:'Test',weather:{direction:0,speed:5},template:'gates',start:{a:{x:-20,y:0},b:{x:20,y:0},normal:{x:0,y:1}},finish:{a:{x:-20,y:0},b:{x:20,y:0},normal:{x:0,y:-1}},marks:[{id:'1',label:'1',x:0,y:200},{id:'2',label:'2',x:-20,y:30},{id:'3',label:'3',x:20,y:30}],route:[{kind:'round',markIds:['1'],side:'port'},{kind:'gate',markIds:['2','3']},{kind:'round',markIds:['1'],side:'starboard'}]};}
test('wind direction and circular difference use north-up world coordinates',()=>{for(const [d,x,y] of [[0,0,1],[90,1,0],[180,0,-1],[270,-1,0]]){const a=E.windAxis(d);near(a.x,x);near(a.y,y)}near(E.angleDifference(1,359),2);});
test('start-line advice calculates the actual favored end',()=>{const l={a:{x:-10,y:-4},b:{x:10,y:4}};const a=E.lineAdvice(l,0);assert.equal(a.favored,'b');near(a.deviation,Math.atan2(8,20)*180/Math.PI);assert.equal(E.lineAdvice({a:{x:-1,y:0},b:{x:1,y:0}},0).favored,null);});
test('compile preserves repeated marks, gate alternatives and opposing finish direction',()=>{const d=course();assert.deepEqual(E.validate(d),[]);const model=E.compile(d,(b,i,o,side)=>({buoyId:b.id,side}));assert.equal(model.buoys.filter(b=>b.id==='1').length,1);assert.deepEqual(model.route.map(v=>v.kind),['round','gate','round','finish']);assert.deepEqual(model.route[1].buoyIds,['2','3']);assert.equal(model.route[2].side,'starboard');assert.equal(model.startLine.normal.y,1);assert.equal(model.finishLine.normal.y,-1);});
test('rotation keeps geometry fixed around the start midpoint and rotates normals',()=>{const d=course(),r=E.rotate(d,90);near(r.marks[0].x,-200);near(r.marks[0].y,0);near(r.start.normal.x,-1);near(r.finish.normal.x,1);near(d.marks[0].x,0);});
test('reject incompatible maps, land and missing marks',()=>{const d=course();d.map='other';d.route[0].markIds=['missing'];const messages=E.validate(d,(x,y)=>x===0&&y===200?1:-1).map(x=>x.message).join(' ');assert.match(messages,/kort/);assert.match(messages,/land/);assert.match(messages,/manglende mærke/);});
test('meter-scale saved courses keep their geographical positions on the quarter-scale map',()=>{
 const original={...course(),map:'faaborg-metric-1'};
 const migrated=E.onCurrentMap(original);
 assert.equal(migrated.map,E.MAP);
 assert.deepEqual(migrated.start.a,{x:-5,y:0});
 assert.deepEqual(migrated.start.normal,original.start.normal);
 assert.equal(migrated.marks[0].y,50);
 assert.equal(original.marks[0].y,200);
 assert.equal(E.onCurrentMap(migrated),migrated);
 assert.deepEqual(E.validate(original,(x,y)=>x===0&&y===50?1:-1),E.validate(migrated,(x,y)=>x===0&&y===50?1:-1));
});
test('start width adapts to boats and conditions',()=>{const small=[{length:4,beam:1}];assert.ok(E.startWidth([...small,...small])>E.startWidth(small));assert.ok(E.startWidth([{length:20,beam:6}])>E.startWidth(small));assert.ok(E.startWidth(small,10,1)>E.startWidth(small,5,0));});
test('a race accepts a reference wind up to 20 m/s',()=>{
 const d=course();
 d.weather.speed=20;
 assert.deepEqual(E.validate(d),[]);
 d.weather.speed=20.1;
 assert.match(E.validate(d)[0].message,/Referencevinden/);
});
