'use strict';

const { test,expect }=require('@playwright/test');
const { RoomSimulation,Sim,roomWeather }=require('../server/room');

test('the shared server step resolves both hulls and publishes the corrected separation',()=>{
  const room=new RoomSimulation(roomWeather({speed:0,waveHeight:0,chop:0,gusts:0},{windSeed:2647}));
  const players=new Map(['a','b'].map(id=>[id,{id,boat:'laser',name:id,ws:true,lastSeq:0,control:{steer:0,trim:0,crewPose:2},inputAt:0}]));
  room.start(players);
  const spawn={x:-1500,y:-1800,theta:0};
  room.spawn(players.get('a'),{...spawn,vx:2});
  room.spawn(players.get('b'),{...spawn,x:spawn.x+2.4,theta:Math.PI,vx:-2});
  room.step(players,Sim.fixedDt*1000);
  const {boats}=room.packet();
  expect(boats.b.x-boats.a.x).toBeGreaterThan(2.4);
  expect(boats.a.vx-boats.b.vx).toBeLessThan(3);
  expect(boats.a.time).toBe(boats.b.time);
});
