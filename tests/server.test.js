'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { WebSocket } = require('ws');
const protocol = require('../assets/live-protocol');
const world = require('../assets/simulation/node').createSimulation().map.version;

async function service(t) {
  const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'0'}});
  t.after(()=>server.kill());
  const [data]=await once(server.stdout,'data');
  const {port}=JSON.parse(data.toString().split('\n')[0]);
  async function open() {
    const ws=new WebSocket('ws://127.0.0.1:'+port);
    ws.queue=[];
    ws.on('message',m=>ws.queue.push(JSON.parse(m)));
    t.after(()=>ws.terminate());
    await once(ws,'open');
    return ws;
  }
  return {open,server,port};
}

function post(ws,message) {
  ws.send(JSON.stringify({protocol,world,...message}));
}
async function next(ws,type,filter=()=>true,timeout=6000) {
  const end=Date.now()+timeout;
  do {
    const index=ws.queue.findIndex(message=>(Array.isArray(type)?type.includes(message.type):message.type===type)&&filter(message));
    if(index>=0)return ws.queue.splice(index,1)[0];
    if(ws.queue.length>100)ws.queue.splice(0,ws.queue.length-40);
    await new Promise(resolve=>setTimeout(resolve,10));
  } while(Date.now()<end);
  throw Error('Timed out waiting for '+type);
}
async function create(ws,name='Vært',env) {
  post(ws,{type:'create',name,boat:'laser',env});
  return next(ws,'joined');
}
async function join(ws,code,name='Gæst') {
  post(ws,{type:'join',code,name,boat:'laser'});
  return next(ws,'joined');
}
const input=(session,seq,extra={})=>({type:'input',session,seq,steer:0,trim:0,crewPose:2,...extra});

test('a real WebSocket lobby reserves six places atomically and has its own weather',async t=>{
  const {open,port}=await service(t);
  const health=await fetch('http://127.0.0.1:'+port+'/health').then(r=>r.json());
  assert.deepEqual([health.status,health.protocol,health.world],['ok',protocol,world]);
  assert.ok(health.build);
  const host=await open(),h=await create(host,'Vært',{speed:8,chop:.63});
  assert.equal(h.host,true);
  assert.match(h.code,/^\d{6}$/);
  const clients=await Promise.all(Array.from({length:6},()=>open()));
  const joined=await Promise.all(clients.map(async (client,i)=>{
    post(client,{type:'join',code:h.code,name:'Sejler '+i,boat:'laser'});
    return next(client,['joined','error']);
  }));
  const regular=joined.filter(x=>x?.type==='joined');
  assert.equal(regular.length,5);
  assert.equal(new Set(regular.map(p=>p.id)).size,5);
  assert.equal(joined.find(x=>x?.type==='error').message,'Lobbyen er fuld.');
  assert.ok(regular.every(p=>p.session===h.session&&p.env.chop===.63));
  const another=await open(),a=await create(another,'Anden vært',{speed:3});
  assert.notEqual(a.session,h.session);
  post(host,{type:'settings',session:h.session,env:{speed:11}});
  assert.equal((await next(host,'roster',m=>m.env.speed===11)).env.speed,11);
  const third=await open(),other=await join(third,a.code);
  assert.equal(other.env.speed,3);
  assert.equal(other.players.length,2);

  const client=clients[joined.findIndex(x=>x?.type==='joined')];
  post(client,{type:'settings',session:h.session,env:{speed:20},host:true});
  assert.equal((await next(client,'error')).code,'host');
  post(client,{type:'start',session:h.session,host:true});
  assert.equal((await next(client,'error')).code,'host');
});

test('the server sails boats, filters inputs and hands over while preserving identity',async t=>{
  const {open}=await service(t);
  const host=await open(),h=await create(host,'Vært',{speed:8,direction:270,waveHeight:0,chop:0,gusts:0});
  const guest=await open(),g=await join(guest,h.code);
  const {session}=h;
  post(host,{type:'start',session});
  const start=(await next(guest,'snapshot',m=>m.state.boats[g.id].time>.05)).state;
  assert.equal(start.mode,'free');
  assert.ok(start.boats[h.id]);

  post(guest,input(session,1,{steer:.75,crewPose:3}));
  const moving=(await next(guest,'snapshot',m=>m.state.acks[g.id]===1&&m.state.boats[g.id].steerIntent>.5)).state;
  assert.equal(moving.boats[g.id].crewPose,3);
  assert.ok(Math.hypot(moving.boats[g.id].x-start.boats[g.id].x,moving.boats[g.id].y-start.boats[g.id].y)>0);
  post(guest,input(session,1,{steer:1}));
  assert.match((await next(guest,'error')).message,/forældet/);
  post(guest,input(session,2,{rig:{reef:2},foreAft:.6}));
  const reefed=(await next(guest,'snapshot',m=>m.state.acks[g.id]===2&&m.state.boats[g.id]?.cruiserRig?.reef>0)).state;
  assert.ok(reefed.boats[g.id].sail.main.area<moving.boats[g.id].sail.main.area);
  const held=(await next(guest,'snapshot',m=>m.state.time>reefed.time+1.4)).state;
  assert.ok(held.boats[g.id].crewForeAft>.55);
  assert.equal(held.boats[g.id].steerIntent,0);
  post(guest,input(session,3,{rig:{reef:20}}));
  assert.match((await next(guest,'error')).message,/Ugyldigt/);
  post(guest,input(session,3,{controlRate:100}));
  assert.match((await next(guest,'error')).message,/Ugyldigt/);
  post(guest,input(session,3,{sheetTarget:1.1}));
  assert.match((await next(guest,'error')).message,/Ugyldigt/);
  const target=held.boats[g.id].sheet-.008;
  post(guest,input(session,3,{sheetTarget:target,trim:1}));
  const trimmed=(await next(host,'snapshot',m=>m.state.acks[g.id]===3&&Math.abs(m.state.boats[g.id].sheet-target)<1e-6)).state;
  assert.ok(trimmed.boats[g.id].sheet<held.boats[g.id].sheet);
  post(guest,input(session,2,{sheetTarget:1}));
  assert.match((await next(guest,'error')).message,/forældet/);
  post(guest,{type:'snapshot',session,seq:9,state:{time:9999}});
  assert.equal((await next(guest,'error')).message,'Ukendt besked.');

  host.terminate();
  await next(guest,'roster',m=>m.players.some(p=>p.host&&!p.connected));
  const stillSailing=(await next(guest,'snapshot',m=>m.state.time>moving.time+.4)).state;
  assert.ok(stillSailing.boats[h.id]);

  const resumed=await open();
  post(resumed,{type:'resume',code:h.code,session,token:h.token});
  const identity=await next(resumed,'joined');
  assert.equal(identity.id,h.id);
  assert.equal(identity.host,true);
  post(resumed,{type:'leave',session});
  assert.equal((await next(guest,'roster',m=>m.hostId===g.id)).players.length,1);
  assert.ok((await next(guest,'snapshot',m=>m.state.time>stillSailing.time+.2)).state.boats[g.id]);

  post(guest,{type:'start',session,settings:{mode:'course',courseType:'triangle',courseVariant:'short'}});
  const race=await next(guest,'snapshot',m=>m.state.mode==='course');
  assert.equal(race.state.model.type,'triangle');
  assert.equal(race.state.races[g.id].phase,'countdown');
  const late=await open();
  post(late,{type:'join',code:h.code,name:'Sen',boat:'laser'});
  assert.equal((await next(late,'error')).code,'race');
  post(guest,{type:'lobby',session});
  await next(guest,'roster',m=>m.phase==='lobby'&&m.hostId===g.id);
  assert.equal((await join(late,h.code,'Sen')).session,session);
});

test('replacement sessions, expired rooms and outdated builds receive useful outcomes',async t=>{
  const {open}=await service(t);
  const host=await open(),h=await create(host);
  const replacement=await open();
  post(replacement,{type:'resume',code:h.code,session:h.session,token:h.token});
  assert.equal((await next(replacement,'joined')).id,h.id);
  assert.match((await next(host,'closed')).message,/andet vindue/);
  const outdated=await open();
  post(outdated,{type:'join',code:h.code,name:'Gammel',boat:'laser',protocol:protocol-1});
  assert.equal((await next(outdated,'error')).code,'version');
  post(replacement,{type:'leave',session:h.session});
  await new Promise(resolve=>setTimeout(resolve,40));
  const resume=await open();
  post(resume,{type:'resume',code:h.code,session:h.session,token:h.token});
  assert.match((await next(resume,'error')).message,/Sessionen er afsluttet/);
});

test('leading zero codes are strings and collisions are retried',()=>{
  const {validCode,newCode}=require('../server/codes');
  const values=[41827,41827,7];
  assert.equal(newCode(new Map([['041827',true]]),()=>values.shift()),'000007');
  assert.equal(validCode('041827'),true);
  assert.equal(validCode(41827),false);
  assert.equal(validCode('41827'),false);
});

test('after a service restart the old identity is no longer accepted',async t=>{
  const first=await service(t),original=await first.open(),h=await create(original);
  const closed=once(original,'close');
  first.server.kill();
  assert.equal((await closed)[0],1012);
  const second=await service(t),client=await second.open();
  post(client,{type:'resume',session:h.session,code:h.code,token:h.token});
  assert.equal((await next(client,'error')).code,'expired');
  assert.ok((await create(client)).session!==h.session);
});

test('foil snapshots omit duplicate rudder loads and preserve the next physics step', () => {
  const { RoomSimulation, Sim, roomWeather } = require('../server/room');
  const weather = roomWeather({ speed: 14, direction: 260, waveHeight: .6, chop: .4 });
  const room = new RoomSimulation(weather);
  for (const boat of ['ac75', 'ac72']) {
    const env = { ...weather, boatId: boat };
    const state = Sim.createBoat(boat, { x: -1775, y: -1980, vx: 11, vy: 0, theta: 0 }, env);
    const controls = { steer: .23, sheetTarget: .62, crewPose: 2, difficulty: 'hard' };
    Sim.stepBoat(state, controls, env, Sim.fixedDt);
    room.boats.set(boat, state);
    const packed = JSON.parse(JSON.stringify(room.packet().boats[boat]));
    const liveRudder = state.forces.rudder;
    assert.ok(liveRudder.parts.length > 0);
    assert.equal(Object.hasOwn(packed.forces.rudder, 'parts'), false);
    const previous = structuredClone(packed);
    previous.forces.rudder = JSON.parse(JSON.stringify(liveRudder));
    assert.ok(JSON.stringify(previous).length - JSON.stringify(packed).length > 1000);
    for (const snapshot of [previous, packed]) Sim.stepBoat(snapshot, controls, env, Sim.fixedDt);
    assert.deepEqual(packed, previous);
  }
});
