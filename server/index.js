'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');
const {validCode,newCode}=require('./codes');
const weather=require('../assets/settings');

const PORT = Number(process.env.PORT || 3001);
const MAX_PLAYERS = 6, GRACE_MS = 15000, MAX_MESSAGE = 262144;
const rooms = new Map(), attempts = new Map();
const boats = new Set(['laser', 'dinghy', 'yacht', 'ac75', 'ac72']);
const id = () => crypto.randomBytes(16).toString('hex');
const send = (ws, message) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };
const emit = (room, message, except) => { for (const player of room.players.values()) if (player !== except) send(player.ws, message); };
const members = room => [...room.players.values()].map(p => ({ id:p.id, name:p.name, boat:p.boat, host:p.id===room.hostId, color:p.color, ready:p.ready, connected:!!p.ws }));
const roster = room => emit(room, { type:'roster', session:room.id, players:members(room), phase:room.phase });
const error = (ws, message) => send(ws, { type:'error', message });
const validName = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 32 && !/[\u0000-\u001f]/.test(value);
function closeRoom(room, message='Værten har forladt spillet.') { if (rooms.get(room.code)!==room) return; rooms.delete(room.code); for (const p of room.players.values()) { clearTimeout(p.timer); send(p.ws,{type:'closed',session:room.id,message}); if(p.ws) { p.ws.room=null; p.ws.player=null; } } room.players.clear(); }
function remove(room, player) { if (!room.players.has(player.id)) return; clearTimeout(player.timer); room.players.delete(player.id); emit(room,{type:'left',session:room.id,id:player.id}); roster(room); }
function disconnected(ws, explicit=false) {
 const room=ws.room, p=ws.player; if (!room || !p || p.ws!==ws) return;
 ws.room=null; ws.player=null; p.ws=null;
 if(explicit) { if(p.id===room.hostId) closeRoom(room); else remove(room,p); return; }
 emit(room,{type:'disconnected',session:room.id,id:p.id,host:p.id===room.hostId}); roster(room);
 p.timer=setTimeout(()=>{if(p.ws)return;if(p.id===room.hostId)closeRoom(room);else remove(room,p)},GRACE_MS);
}
function limited(ip) { const now=Date.now(), times=(attempts.get(ip)||[]).filter(t=>now-t<60000); times.push(now); attempts.set(ip,times); return times.length>20; }
function add(ws,room,name,boat) { const palette=['#fbbf4c','#63cbd7','#ee785c','#bd9cf5','#8dcc6b','#ef89ba'];const used=new Set([...room.players.values()].map(p=>p.color));const color=palette.find(c=>!used.has(c));const p={id:id(),token:id()+id(),name:name.trim(),boat,color,ws,ready:false,timer:null,lastSeq:-1};room.players.set(p.id,p);if(!room.hostId)room.hostId=p.id;ws.room=room;ws.player=p;send(ws,{type:'joined',code:room.code,session:room.id,id:p.id,token:p.token,host:p.id===room.hostId,players:members(room),phase:room.phase});roster(room); if(p.id!==room.hostId)send(room.players.get(room.hostId)?.ws,{type:'sync-request',session:room.id,id:p.id}); }
function handle(ws,m) {
 if (!m || typeof m!=='object' || Array.isArray(m) || typeof m.type!=='string') return error(ws,'Ugyldig besked.');
 if (['create','join','resume'].includes(m.type)) {
  if(ws.room) return error(ws,'Forlad først den nuværende lobby.');
  if(m.type!=='resume'&&limited(ws.ip)) return error(ws,'For mange forsøg. Prøv igen senere.');
  if(m.type==='resume') { const room=rooms.get(m.code), p=room&&[...room.players.values()].find(x=>x.token===m.token); if(!room || room.id!==m.session || !p || p.ws) { if(limited(ws.ip)) return error(ws,'For mange forsøg. Prøv igen senere.'); return error(ws,'Lobbyen findes ikke eller forbindelsen er udløbet.'); } clearTimeout(p.timer);p.ws=ws;ws.room=room;ws.player=p;send(ws,{type:'joined',code:room.code,session:room.id,id:p.id,token:p.token,host:p.id===room.hostId,players:members(room),phase:room.phase});emit(room,{type:'reconnected',session:room.id,id:p.id});roster(room);if(p.id!==room.hostId)send(room.players.get(room.hostId)?.ws,{type:'sync-request',session:room.id,id:p.id});return; }
  if(!validName(m.name)||!boats.has(m.boat))return error(ws,'Vælg et navn og en båd.');
  if(m.type==='create') { const room={code:newCode(rooms),id:id(),hostId:null,players:new Map(),phase:'lobby'};rooms.set(room.code,room);add(ws,room,m.name,m.boat);room.hostId=ws.player.id;send(ws,{type:'host',session:room.id});roster(room);return; }
  if(!validCode(m.code))return error(ws,'Koden skal have seks cifre.'); const room=rooms.get(m.code);if(!room)return error(ws,'Lobbyen findes ikke.');if(room.players.size>=MAX_PLAYERS)return error(ws,'Lobbyen er fuld.');add(ws,room,m.name,m.boat);return;
 }
 const room=ws.room,p=ws.player;if(!room||!p||m.session!==room.id)return error(ws,'Forbindelsen er udløbet.');
 const isHost=p.id===room.hostId;
 if(m.type==='leave'){disconnected(ws,true);return;}
 if(m.type==='ready'){if(typeof m.ready!=='boolean')return error(ws,'Ugyldig klarstatus.');p.ready=m.ready;roster(room);return;}
 if(m.type==='boat'){if(!boats.has(m.boat)||room.phase==='race')return error(ws,'Bådvalg er låst under løbet.');p.boat=m.boat;roster(room);emit(room,{type:'boat',session:room.id,id:p.id,boat:p.boat});return;}
 if(m.type==='input'){
   if(!Number.isSafeInteger(m.seq)||m.seq<=p.lastSeq||!Number.isFinite(m.steer)||Math.abs(m.steer)>1||
      !Number.isFinite(m.trim)||Math.abs(m.trim)>1||![1,2,3].includes(m.crewPose))return error(ws,'Ugyldigt input.');
   const validUnit=value=>value===undefined||Number.isFinite(value)&&Math.abs(value)<=1;
   const validSwitch=value=>value===undefined||typeof value==='boolean';
   if((m.difficulty!==undefined&&!['easy','hard'].includes(m.difficulty))||!validUnit(m.crew)||!validUnit(m.foreAft)||
      !validSwitch(m.trimFast)||!validSwitch(m.steerDigital)||!validSwitch(m.spinnaker)||
      (m.downwindType!==undefined&&!['spinnaker','gennaker','code0'].includes(m.downwindType)))return error(ws,'Ugyldigt input.');
   let rig;
   if(m.rig!==undefined){
     if(!['yacht','ac75'].includes(p.boat)||!m.rig||typeof m.rig!=='object'||Array.isArray(m.rig))return error(ws,'Ugyldig rig.');
     const {reef,headsail,jibSheet,extraSheet}=m.rig;
     const sheet=value=>value===undefined||Number.isFinite(value)&&value>=0&&value<=1;
     if((reef!==undefined&&![0,1,2].includes(reef))||(headsail!==undefined&&![0,1].includes(headsail))||
        !sheet(jibSheet)||!sheet(extraSheet)||
        (p.boat==='ac75'&&[headsail,jibSheet,extraSheet].some(value=>value!==undefined)))return error(ws,'Ugyldig rig.');
     rig={reef,headsail,jibSheet,extraSheet};
   }
   p.lastSeq=m.seq;
   send(room.players.get(room.hostId)?.ws,{type:'input',session:room.id,id:p.id,seq:m.seq,steer:m.steer,trim:m.trim,crew:m.crew??0,crewPose:m.crewPose,
     ...(m.foreAft!==undefined?{foreAft:m.foreAft}:{}),...(rig?{rig}:{}),difficulty:m.difficulty??'hard',
     spinnaker:m.spinnaker??false,downwindType:m.downwindType??'spinnaker',trimFast:m.trimFast??true,steerDigital:m.steerDigital??true});
   return;
 }
 if(['snapshot','settings','phase'].includes(m.type)){if(!isHost)return error(ws,'Kun værten kan ændre det fælles spil.');if(m.type==='phase'){if(!['lobby','free','race'].includes(m.phase))return error(ws,'Ugyldig spiltilstand.');room.phase=m.phase;roster(room);}if(m.type==='snapshot'&&(!Number.isSafeInteger(m.seq)||m.seq<0||typeof m.state!=='object'||m.state===null||!Number.isFinite(m.state.time)||m.state.time<0))return error(ws,'Ugyldigt snapshot.');if(m.type==='snapshot'){if(room.lastSnapshotSeq!==undefined&&m.seq<=room.lastSnapshotSeq)return error(ws,'Forældet snapshot.');if(room.lastSimulationTime!==undefined&&m.state.time<room.lastSimulationTime-1e-6)return error(ws,'Forældet simulationstid.');const now=Date.now(),advanced=room.lastSimulationTime===undefined||m.state.time>room.lastSimulationTime+1e-6;room.lastSnapshotSeq=m.seq;room.lastSnapshotAt=now;if(advanced){room.lastSimulationTime=m.state.time;room.lastProgressAt=now;if(room.stalled){room.stalled=false;emit(room,{type:'host-restored',session:room.id},p);}}else if(room.stalled)return;}if(m.type==='settings')return error(ws,'Fælles vejr følger værtens simulation.');
  if(m.type==='snapshot'&&m.state.env&&typeof m.state.env==='object'){
    const values=m.state.env,clean=weather.migrate(values);
    if(Number.isSafeInteger(values.windSeed))clean.windSeed=values.windSeed;
    m.state.env=clean;
  }
  emit(room,{...m,session:room.id},p);return;}
 error(ws,'Ukendt besked.');
}
const server=http.createServer((req,res)=>{res.writeHead(req.url==='/health'?200:404,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.url==='/health'?'ok':'Not found');});
const wss=new WebSocketServer({server,maxPayload:MAX_MESSAGE});
wss.on('connection',(ws,req)=>{
 ws.ip=req.socket.remoteAddress;ws.alive=true;ws.windowStart=Date.now();ws.messageCount=0;
 ws.on('pong',()=>{ws.alive=true;});
 ws.on('message',data=>{const now=Date.now();if(now-ws.windowStart>=1000){ws.windowStart=now;ws.messageCount=0;}if(++ws.messageCount>120){ws.close(1008,'For mange beskeder');return;}try{handle(ws,JSON.parse(data.toString()));}catch(e){error(ws,'Ugyldig besked.');}});
 ws.on('close',()=>disconnected(ws));ws.on('error',()=>{});
});
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}const cutoff=Date.now()-60000;for(const [ip,times] of attempts)if(!times.some(t=>t>=cutoff))attempts.delete(ip);},10000);heartbeat.unref();
const simulationWatch=setInterval(()=>{const now=Date.now();for(const room of rooms.values()){if(!room.lastProgressAt)continue;const age=now-room.lastProgressAt;if(age>15000){closeRoom(room);continue;}if(age>2000&&!room.stalled){room.stalled=true;emit(room,{type:'host-stalled',session:room.id});}}},1000);simulationWatch.unref();
server.listen(PORT,()=>console.log(`TACK live listening on ${PORT}`));
