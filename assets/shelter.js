/* Directional wave exposure from the same land polygons as the sailing world.
 * x east, y north. Bearings give the direction the waves or wind come from. */
(function(install){
 if(typeof module!=='undefined'&&module.exports)module.exports=install;
 else install(globalThis);
})(function(g){
 'use strict';
 const worldBounds=g.ArchipelagoData?.fieldBounds;
 const N=worldBounds?461:136,B=Object.freeze(worldBounds??{minX:-2100,maxX:2100,minY:-2680,maxY:620});
 const LIMIT=6500,stepX=(B.maxX-B.minX)/(N-1),stepY=(B.maxY-B.minY)/(N-1);
 const cache=new Map(),pairs=new Map();
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const quantize=d=>((Math.round(d)%360)+360)%360;
 const smooth=x=>{const n=clamp(x,0,1);return n*n*(3-2*n);};
 const mix=(a,b,t)=>a+(b-a)*t;

 function coastRays(direction){
  const rad=direction*Math.PI/180,dx=Math.sin(rad),dy=Math.cos(rad),buckets=new Map(),bucketSize=70;
  for(const island of g.SailingWorld?.ISLANDS||[]){
   const points=island.points.map(p=>[p.x*dx+p.y*dy,p.x*dy-p.y*dx]);
   for(let k=0,j=points.length-1;k<points.length;j=k++){
    const a=points[j],b=points[k],width=b[1]-a[1];
    if(Math.abs(width)<1e-8)continue;
    const edge={u:a[0],v:a[1],min:Math.min(a[1],b[1]),max:Math.max(a[1],b[1]),rate:(b[0]-a[0])/width};
    for(let i=Math.floor(edge.min/bucketSize);i<=Math.floor(edge.max/bucketSize);i++){
     if(!buckets.has(i))buckets.set(i,[]);
     buckets.get(i).push(edge);
    }
   }
  }
  return (x,y)=>{
   const u=x*dx+y*dy,v=x*dy-y*dx;
   let nearest=LIMIT,crossings=0;
   const edges=buckets.get(Math.floor(v/bucketSize));
   if(!edges)return nearest;
   for(const e of edges){
    if(v<e.min||v>=e.max)continue;
    const distance=e.u+(v-e.v)*e.rate-u;
    if(distance>=0){crossings++;nearest=Math.min(distance,nearest);}
   }
   // Land pixels share a zero-fetch waterline with the adjacent lee water.
   return crossings%2?0:nearest;
  };
 }

 function build(direction){
  const centre=coastRays(direction),left=coastRays(direction-9),right=coastRays(direction+9);
  const data=new Uint8Array(N*N*4);
  const short=f=>.012+.988*Math.pow(clamp(f/1250,0,1),.67);
  const formed=f=>Math.pow(clamp(f/1370,0,1),.86);
  const openSwell=Math.exp(-1450/355);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
   const x=B.minX+stepX*i,y=B.minY+stepY*j,fetch=centre(x,y);
   const a=left(x,y),b=right(x,y);
   const k=(j*N+i)*4;
   if(fetch===LIMIT&&a===LIMIT&&b===LIMIT){
    data[k]=data[k+1]=data[k+2]=data[k+3]=255;
    continue;
   }
   const edge=smooth(Math.min(i,j,N-1-i,N-1-j)/5);
   // Swell already at sea is partly scattered around headlands. Sea generated
   // locally grows from the last shore, with a small off-axis contribution.
   const swell=1-.82*Math.max(0,Math.exp(-fetch/355)-openSwell)/(1-openSwell);
   const shortSea=.89*short(fetch)+.055*(short(a)+short(b));
   const longSea=swell*(.20+.80*(.92*formed(fetch)+.04*(formed(a)+formed(b))));
   data[k]=Math.round(255*mix(1,swell,edge));
   data[k+1]=Math.round(255*mix(1,shortSea,edge));
   data[k+2]=Math.round(255*mix(1,longSea,edge));
   data[k+3]=Math.round(255*mix(1,fetch/LIMIT,edge));
  }
  return {direction,data,size:N,bounds:B};
 }

 function field(direction){
  const key=quantize(direction),old=cache.get(key);
  const value=old||build(key);
  if(old)cache.delete(key);
  cache.set(key,value);
  if(cache.size>12)cache.delete(cache.keys().next().value);
  return value;
 }

 function combinedField(swell,wind){
  const s=quantize(swell),w=quantize(wind),key=s+':'+w;
  const old=pairs.get(key);
  if(old)return old;
  const source=field(s);
  if(s===w)return source;
  const data=new Uint8Array(source.data),short=field(w).data;
  for(let i=0;i<data.length;i+=4){data[i+1]=short[i+1];data[i+3]=short[i+3];}
  const value={data,size:N,bounds:B};
  pairs.set(key,value);
  if(pairs.size>8)pairs.delete(pairs.keys().next().value);
  return value;
 }

 function sampleGradient(f,x,y,channel=0){
  const u=(x-B.minX)/stepX,v=(y-B.minY)/stepY;
  if(u<0||v<0||u>N-1||v>N-1)return {v:1,dx:0,dy:0};
  const i=Math.min(N-2,Math.floor(u)),j=Math.min(N-2,Math.floor(v)),a=u-i,b=v-j,d=f.data,k=(j*N+i)*4+channel;
  const p=d[k]/255,q=d[k+4]/255,r=d[k+N*4]/255,t=d[k+N*4+4]/255;
  return {v:mix(mix(p,q,a),mix(r,t,a),b),dx:mix(q-p,t-r,b)/stepX,dy:mix(r-p,t-q,a)/stepY};
 }
 const sample=(f,x,y,channel=0)=>sampleGradient(f,x,y,channel).v;
 // Each component travels along its wavevector. Incoming direction is opposite.
 function waveDirection(angle){
  const w=g.SailPhysics.WAVE_COMPONENTS[0],c=Math.cos(angle),s=Math.sin(angle),x=w.kx*c-w.ky*s,y=w.kx*s+w.ky*c;
  return ((Math.atan2(-x,-y)*180/Math.PI)%360+360)%360;
 }
 const n=value=>Number(value).toFixed(4);
 const shader=`
    uniform float waveShelterEnabled;
    uniform sampler2D waveExposureFrom,waveExposureTo;
    vec4 coastWaveFields(sampler2D tex,vec2 p){
      if(waveShelterEnabled<.5)return vec4(1.);
      vec2 uv=(vec2(p.x,-p.y)-vec2(${n(B.minX)},${n(B.minY)}))/vec2(${n(B.maxX-B.minX)},${n(B.maxY-B.minY)});
      if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return vec4(1.);
      return texture2D(tex,(uv*${n(N-1)}+.5)/${n(N)});
    }
    vec3 coastExposure(sampler2D tex,vec2 p){return coastWaveFields(tex,p).rgb;}
 `;
 g.SailingShelter={field,combinedField,sample,sampleGradient,waveDirection,shader,bounds:B,size:N,fetchLimit:LIMIT,
   contains:(x,y)=>x>=B.minX&&x<=B.maxX&&y>=B.minY&&y<=B.maxY};
});
