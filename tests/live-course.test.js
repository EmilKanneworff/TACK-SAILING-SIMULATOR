'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { RoomSimulation,Sim,roomWeather } = require('../server/room');
const driver = vm.createContext({ SailPhysics:Sim.physics,SailingBoats:Sim.profiles });
vm.runInContext(readFileSync(require.resolve('../scripts/course-pilot'),'utf8'),driver);

for(const courseType of ['gates','triangle']){
  test('authoritative boats sail the '+courseType+' course through start, marks and finish',()=>{
    const env=roomWeather({speed:7,direction:0,waveHeight:0,chop:0,gusts:0},{windSeed:Sim.wind.CONFIG.seed});
    const room=new RoomSimulation(env);
    const players=new Map(['one'].map(id=>[id,{id,name:id,boat:'laser',ws:true,lastSeq:0,control:{difficulty:'easy'}}]));
    room.configure({mode:'course',courseType,courseVariant:'short'});
    room.start(players);
    if(courseType==='gates'){
      // A controlled initial position for the pilot's first approach.
      room.spawn(players.get('one'),room.model.spawn);
    }
    const drivers=[...room.races].map(([id,race],i)=>[id,driver.FriVindCoursePilot(race,env.direction,{wait:i*42000,retry:true})]);
    const gunTimes=new Set([...room.races.values()].map(r=>r.gunAtMs));
    assert.deepEqual([...gunTimes],[30000]);
    for(let tick=0;tick<84000&&room.phase!=='results';tick++){
      const now=room.clockMs+Sim.fixedDt*1000;
      for(const [id,pilot] of drivers){
        const player=players.get(id);
        player.control={...pilot.control(room.boats.get(id),now),difficulty:'easy',ironsHelp:courseType==='triangle'};
        player.inputAt=now;
      }
      room.step(players,now);
    }
    const packet=room.packet();
    console.log('Shared physical race',JSON.stringify({courseType,phase:room.phase,results:packet.results,
      progress:Object.values(packet.races).map(r=>[r.phase,r.index,r.time])}));
    assert.equal(room.phase,'results');
    assert.equal(packet.results.length,1);
    assert.ok(packet.results[0].time>0);
    for(const race of Object.values(packet.races)){
      assert.equal(race.started,true);
      assert.equal(race.index,packet.model.route.length);
      assert.equal(race.finished,true);
    }
  });
}
