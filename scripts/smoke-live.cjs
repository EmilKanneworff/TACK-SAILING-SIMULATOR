'use strict';

const { WebSocket }=require('ws');
const { once }=require('node:events');
const protocol=require('../assets/live-protocol');
const { createSimulation }=require('../assets/simulation/node');
const { version:world }=createSimulation().map;

async function main(){
  const endpoint=process.argv[2];
  if(!endpoint)throw Error('Angiv live-serverens ws:// eller wss:// adresse.');
  const health=new URL('/health',endpoint.replace(/^ws/,'http'));
  const response=await fetch(health,{signal:AbortSignal.timeout(80000)});
  if(!response.ok)throw Error('Health gav HTTP '+response.status);
  const version=await response.json();
  const origin=process.argv[3];
  const client=new WebSocket(endpoint,{origin,handshakeTimeout:80000});
  try{
    await once(client,'open');
    const message=once(client,'message',{signal:AbortSignal.timeout(8000)});
    client.send(JSON.stringify({type:'create',name:'TACK forbindelse',boat:'laser',protocol,world}));
    const [raw]=await message,joined=JSON.parse(raw);
    if(joined.type!=='joined'||joined.protocol!==version.protocol||joined.build!==version.build||
      joined.world!==world||!/^\d{6}$/.test(joined.code))throw Error(joined.message||'Uventet svar fra live-serveren.');
    client.send(JSON.stringify({type:'leave',session:joined.session}));
    console.log(JSON.stringify({health:version.status,build:version.build,protocol,world,lobby:'oprettet og lukket'}));
  }finally{client.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
