'use strict';
const test=require('node:test'), assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{WebSocket}=require('ws');
const port=32000+Math.floor(Math.random()*10000),url=`ws://127.0.0.1:${port}`;
function connect(){return new Promise((resolve,reject)=>{let ws=new WebSocket(url);ws.queue=[];ws.on('message',d=>ws.queue.push(JSON.parse(d)));ws.on('open',()=>resolve(ws));ws.on('error',reject);});}
function next(ws,type,timeout=3000){return new Promise((resolve,reject)=>{let end=Date.now()+timeout;function poll(){let i=ws.queue.findIndex(m=>m.type===type);if(i>=0)return resolve(ws.queue.splice(i,1)[0]);if(Date.now()>end)return reject(Error('Timed out: '+type));setTimeout(poll,10);}poll()})}
const send=(ws,m)=>ws.send(JSON.stringify(m));
test('six real connections, capacity, identity and host permissions',async t=>{
 const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port)}});t.after(()=>server.kill());await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject)});
 const clients=[];const credentials=[];t.after(()=>clients.forEach(c=>c.terminate()));let host=await connect();clients.push(host);send(host,{type:'create',name:'Vært',boat:'laser'});const h=await next(host,'joined');assert.equal(h.host,true);assert.match(h.code,/^\d{6}$/);assert.equal(h.code.length,6);
 for(let i=0;i<5;i++){let c=await connect();clients.push(c);send(c,{type:'join',code:h.code,name:'Gæst '+i,boat:'ac72'});let joined=await next(c,'joined');assert.equal(joined.session,h.session);assert.equal(joined.host,false);credentials.push(joined)}
 let extra=await connect();clients.push(extra);send(extra,{type:'join',code:h.code,name:'Syv',boat:'laser'});assert.equal((await next(extra,'error')).message,'Lobbyen er fuld.');
 let guest=clients[1];send(guest,{type:'settings',session:h.session,settings:{speed:12},host:true});assert.match((await next(guest,'error')).message,/Kun værten/);
 send(guest,{type:'phase',session:h.session,phase:'race',host:true});assert.match((await next(guest,'error')).message,/Kun værten/);
 send(host,{type:'snapshot',session:h.session,seq:1,state:{time:1,env:{speed:14,waveHeight:.64,chop:.76}}});
 const shared=(await next(guest,'snapshot')).state.env;
 assert.equal(shared.waveHeight,.64);assert.equal(shared.chop,.76);
 const guestId=(await next(host,'sync-request')).id;send(guest,{type:'input',session:h.session,id:h.id,seq:1,steer:1,trim:0,crewPose:2});const input=await next(host,'input');assert.equal(input.id,guestId);assert.notEqual(input.id,h.id);assert.equal(input.difficulty,'hard');
 send(guest,{type:'input',session:h.session,seq:1,steer:1,trim:0,crewPose:2});assert.match((await next(guest,'error')).message,/Ugyldigt input/);
 send(guest,{type:'input',session:h.session,seq:2,steer:0,trim:0,crewPose:2,spinnaker:true,downwindType:'ukendt'});assert.match((await next(guest,'error')).message,/Ugyldigt input/);
 send(guest,{type:'input',session:h.session,seq:2,steer:0,trim:0,crewPose:2,difficulty:'ukendt'});assert.match((await next(guest,'error')).message,/Ugyldigt input/);
 send(guest,{type:'input',session:h.session,seq:2,steer:0,trim:0,crewPose:2,spinnaker:true,downwindType:'gennaker',difficulty:'easy'});const sailInput=await next(host,'input');assert.equal(sailInput.id,guestId);assert.equal(sailInput.downwindType,'gennaker');assert.equal(sailInput.difficulty,'easy');
 send(guest,{type:'input',session:h.session,seq:3,steer:0,trim:0,crewPose:2,spinnaker:true,downwindType:'code0'});assert.equal((await next(host,'input')).downwindType,'code0');
 send(guest,{type:'input',session:'stale',seq:2,steer:0,trim:0,crewPose:2});assert.match((await next(guest,'error')).message,/udløbet/);
 // A valid reconnection token must still work when this shared IP has hit the join limit.
 for(let i=0;i<22;i++){send(extra,{type:'join',code:'999999',name:'Forsøg',boat:'laser'});await next(extra,'error');}
 guest.terminate();await next(host,'disconnected');const resumed=await connect();clients.push(resumed);send(resumed,{type:'resume',code:h.code,session:h.session,token:credentials[0].token});const rejoined=await next(resumed,'joined');assert.equal(rejoined.id,guestId);assert.equal(rejoined.players.length,6);guest=resumed;
 send(host,{type:'phase',session:h.session,phase:'race'});await next(guest,'phase');send(guest,{type:'boat',session:h.session,boat:'laser'});assert.match((await next(guest,'error')).message,/låst/);
 send(host,{type:'leave',session:h.session});assert.equal((await next(guest,'closed')).message,'Værten har forladt spillet.');
});

test('leading zero codes are strings and collisions are retried',()=>{const {validCode,newCode}=require('../server/codes');let values=[41827,41827,7];assert.equal(newCode(new Map([['041827',true]]),()=>values.shift()),'000007');assert.equal(validCode('041827'),true);assert.equal(validCode(41827),false);assert.equal(validCode('41827'),false)});

test('repeated snapshots cannot mask a stopped host simulation',async t=>{
 const p=port+1,server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(p)}});t.after(()=>server.kill());await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject)});
 const url2=`ws://127.0.0.1:${p}`,open=()=>new Promise((resolve,reject)=>{const ws=new WebSocket(url2);ws.queue=[];ws.on('message',d=>ws.queue.push(JSON.parse(d)));ws.on('open',()=>resolve(ws));ws.on('error',reject)}),host=await open(),guest=await open();t.after(()=>{host.terminate();guest.terminate()});send(host,{type:'create',name:'Vært',boat:'laser'});const room=await next(host,'joined');send(guest,{type:'join',code:room.code,name:'Gæst',boat:'laser'});await next(guest,'joined');let seq=0;const snapshot=time=>send(host,{type:'snapshot',session:room.session,seq:++seq,state:{time,boats:{}}});snapshot(1);const timer=setInterval(()=>snapshot(1),200);t.after(()=>clearInterval(timer));assert.equal((await next(guest,'host-stalled',5000)).session,room.session);clearInterval(timer);snapshot(1.1);assert.equal((await next(guest,'host-restored',3000)).session,room.session);send(host,{type:'snapshot',session:room.session,seq:seq,state:{time:1.2,boats:{}}});assert.match((await next(host,'error')).message,/Forældet snapshot/);
});
