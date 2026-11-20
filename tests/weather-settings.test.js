'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Settings=require('../assets/settings');

test('weather migration preserves anchor values and existing numeric selections',()=>{
 const data=new Map([['fri-vind.settings.v2',JSON.stringify({
  weather:{speed:6.2,direction:360,sea:'large',gusts:.23,clouds:.37,rain:0,fog:0,daylight:'evening'},
  personal:{windArrows:false}
 })]]);
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
 const expected={speed:6.2,direction:0,waveHeight:.85,gusts:.23,clouds:.37,rain:0,fog:0,daylight:1};
 const saved=Settings.load(storage);
 assert.deepEqual(saved.weather,expected);
 assert.equal(saved.personal.windArrows,false);
 data.delete('fri-vind.settings.v2');
 assert.deepEqual(Settings.load(storage).weather,expected);
 assert.equal(Settings.migrate({sea:'calm'}).waveHeight,0);
 assert.equal(Settings.migrate({sea:'small'}).waveHeight,.35);
 assert.equal(Settings.migrate({sea:'small',waveHeight:.36}).waveHeight,.36);
});

test('weather edits preserve independent values and wind takes the short path around north',()=>{
 const weather=Settings.normalize({waveHeight:.45,gusts:.24,clouds:.37});
 assert.deepEqual(Settings.normalize({rain:.23,daylight:.4},weather),{...weather,rain:.23,daylight:.4});
 const state={windClimate:{speed:5,direction:359,gusts:.23}};
 const actual=Settings.advanceWind(state,{...weather,direction:1},.5);
 assert.ok(actual.direction>359&&actual.direction<360);
 assert.ok(actual.gusts>.23&&actual.gusts<.24);
});
