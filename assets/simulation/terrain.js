/* FRI VIND — fixed archipelago and compliant seabed contact. Metres, SI units.
 * World x=east, y=north, z=up. Terrain never follows the boat or camera.
 * Calibrated game bathymetry; no survey data, structural damage or tidal model.
 */
(function(install){
 if(typeof module!=='undefined'&&module.exports)module.exports=install;
 else install(globalThis);
})(function(g){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=t=>{const q=clamp(t,0,1);return q*q*(3-2*q);};
// A single set of hand-drawn polygons drives rendering, map and collision.
const DATA=g.ArchipelagoData;
if(!DATA)throw Error('Øhavets lokale geodata mangler.');
const ISLANDS=DATA.lands.map(i=>{const xs=i.points.map(p=>p.x),ys=i.points.map(p=>p.y);return {...i,minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),cx:(Math.min(...xs)+Math.max(...xs))/2,cy:(Math.min(...ys)+Math.max(...ys))/2,rx:(Math.max(...xs)-Math.min(...xs))/2,ry:(Math.max(...ys)-Math.min(...ys))/2,phase:0};});
function radius(){return 1;}
function seabedDepth(worldDistance){
 // Preserve the wider depth profile of the compressed archipelago.
 const distance=worldDistance/DATA.horizontalScale;
 const near=100,shoulder=near*.115,deep=30;
 const base=distance<near?distance*.115:deep-(deep-shoulder)*Math.exp(-(distance-near)*.115/(deep-shoulder));
 if(worldDistance>=36)return base;
 // The first metres form the beach. Then the bed drops below the working
 // depth of keels and foils, with a smooth join to the offshore floor.
 const extra=6*smooth(worldDistance/6)*(1-smooth((worldDistance-9)/27));
 return base+extra;
}
function islandSample(i,x,y){
 let inside=false,best=Infinity;const pts=i.points;
 for(let k=0,j=pts.length-1;k<pts.length;j=k++){
  const a=pts[j],b=pts[k],dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1),0,1),d=(x-a.x-t*dx)**2+(y-a.y-t*dy)**2;
  if(d<best)best=d;
  if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 const distance=Math.sqrt(best)*(inside?-1:1);
 const relief=g.ArchipelagoRelief;
 const height=inside?Math.min(-distance*.63,Math.max(.14,relief?.sample(x,y)??i.hill)):-seabedDepth(distance);
 return {distance,height,island:i.id};
}
function sample(x,y){
 let best={distance:900,height:-90,island:null};
 for(const i of ISLANDS){
  const bx=Math.max(i.minX-x,0,x-i.maxX),by=Math.max(i.minY-y,0,y-i.maxY);
  if(Math.hypot(bx,by)>Math.max(800,Math.abs(best.distance)))continue;
  const p=islandSample(i,x,y);if(p.height>best.height)best.height=p.height;if(p.distance<best.distance){best.distance=p.distance;best.island=p.island;}
 }
 return best;
}
function heightAt(x,y){return sample(x,y).height;}
// Perimeter interpolation for existing shore effects, without changing shape.
function shorePoint(i,a,offset=0){
 if(typeof i==='string')i=ISLANDS.find(p=>p.id===i);
 const pts=i.points,n=pts.length,u=((a/(2*Math.PI)%1)+1)%1*n,j=Math.floor(u),f=u-j,p=pts[j],q=pts[(j+1)%n],x=p.x+(q.x-p.x)*f,y=p.y+(q.y-p.y)*f,dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1;
 return {x:x+offset*dy/len,y:y-offset*dx/len};
}
const LANDMARKS=DATA.landmarks;
const areaBounds={...DATA.bounds},mapMargin=50*DATA.horizontalScale;
for(const i of ISLANDS.filter(q=>q.id!=='fyn')){areaBounds.minX=Math.min(areaBounds.minX,i.minX-mapMargin);areaBounds.maxX=Math.max(areaBounds.maxX,i.maxX+mapMargin);areaBounds.minY=Math.min(areaBounds.minY,i.minY-mapMargin);areaBounds.maxY=Math.max(areaBounds.maxY,i.maxY+mapMargin);}
const contactCache=new Map();
function contactPoints(c){
 if(contactCache.has(c.id))return contactCache.get(c.id);
 const B=g.SailingBoats,points=[];
 // A catamaran contacts the bed at the two actual hulls, never at an
 // imaginary wide hull under its open trampoline.
 for(const offset of c.hullOffsets||[0])for(const x of [-.40*c.length,0,.40*c.length])for(const side of [-.62,0,.62]){
  const localZ=side*B.halfBeamAt(c,x);
  points.push({x,y:B.hullBottom(c,x,localZ),z:localZ+offset,kind:offset<0?'port hull':offset>0?'starboard hull':'hull'});
 }
 if(c.kind!=='foiler'){
  points.push({x:c.daggerX,y:c.waterBlades?.board.tip??c.deckY-c.daggerDepth,z:0,kind:c.kind==='keelboat'?'keel':'daggerboard'});
  for(const z of c.rudderOffsets||[0])points.push({x:c.rudderX,y:c.waterBlades?.rudder.tip??c.deckY-c.rudderDepth,z,kind:'rudder'});
 }
 contactCache.set(c.id,points);return points;
}
function contact(s,c,env={}){
 const mid=sample(s.x,s.y),out={fx:0,fy:0,fz:0,yaw:0,roll:0,pitch:0,contact:false,depth:-mid.height,distance:mid.distance,peak:0,part:null,point:null};
 // Entire hull/appendages are far above the deep seabed in ordinary sailing.
 if(mid.distance>Math.max(95,c.length*3))return out;
 // Near the coast the midpoint can still be safely over deep water. Account
 // for appendage depth, heave and the maximum bed rise across the hull before
 // skipping its expensive individual contact samples.
 const reach=c.length*.6+c.beam*.5,clearance=Math.max(c.hullDepth||0,c.daggerDepth||0,c.rudderDepth||0,c.foilDrop||0)+c.length*.12+2+Math.abs(s.heave||0);
 if(mid.distance>reach&&seabedDepth(mid.distance-reach)>clearance)return out;
 const P=g.SailPhysics;if(!P)return out;
 const a=P.axes(s.theta),cp=Math.cos(s.pitch||0),sp=Math.sin(s.pitch||0);
 const mass=c.mass*(s.massScale||1),points=contactPoints(c),F=g.FoilingPhysics;
 const foilKeys=c.kind==='foiler'&&s.foils&&F?F.foilKeys(s):[];
 const m=mass/(points.length+foilKeys.length),k=m*9.81/.045,damping=2*Math.sqrt(k*m)*.82;
 function inspect(p){
  if(c.rudderRake&&p.kind==='rudder')p={...p,...g.SailingBoats.rudderPoint({...c.waterBlades.rudder,z:p.z},1,s.rudder)};
  const w=P.bodyPoint(s,p),bed=heightAt(w.x,w.y),penetration=bed-w.z;
  return penetration>0?{p,w,bed,penetration}:null;
 }
 function apply({p,w,bed,penetration}){
  const q=P.bodyOffset(s,p);
  const dx=(heightAt(w.x+.5,w.y)-heightAt(w.x-.5,w.y)),dy=(heightAt(w.x,w.y+.5)-heightAt(w.x,w.y-.5));
  const norm=Math.hypot(dx,dy,1),nx=-dx/norm,ny=-dy/norm,nz=1/norm;
  const {x:vx,y:vy,z:vz}=p.jointVelocity?F.pointVelocity(s,p,p.jointVelocity):P.pointMotion(s,q,a);
  const vn=vx*nx+vy*ny+vz*nz;
  // Elastic normal support + one-way damping. Friction only removes energy.
  const force=clamp(k*penetration-damping*vn,0,m*9.81*18);
  const tx=vx-vn*nx,ty=vy-vn*ny,tz=vz-vn*nz,vt=Math.hypot(tx,ty,tz);
  const friction=vt>1e-6?Math.min(.62*force/vt,m*20):0;
  const fx=nx*force-friction*tx,fy=ny*force-friction*ty,fz=nz*force-friction*tz;
  const ff=fx*a.fx+fy*a.fy,fr=fx*a.rx+fy*a.ry;
  out.fx+=fx;out.fy+=fy;out.fz+=fz;
  out.yaw+=q.r*ff-q.f*fr;
  out.roll+=cp*q.up*fr+sp*(q.r*ff-q.f*fr)+q.dHeel*fz;
  out.pitch+=-q.up*ff+q.f*fz;
  out.contact=true;
  if(!out.point||force>out.peak||force===out.peak&&penetration>out.point.penetration){
   out.peak=force;out.part=p.kind;out.point={...w,bedHeight:bed,penetration};
  }
 }
 for(const p of points){const hit=inspect(p);if(hit)apply(hit);}
 // A foil can touch at a tip with its centre still clear. Resolve one
 // support per foil so extra samples do not multiply the spring force.
 for(const key of foilKeys){
  let deepest=null;
  for(const p of F.groundingPoints(s,key)){
   const hit=inspect(p);
   if(hit&&(!deepest||hit.penetration>deepest.penetration))deepest=hit;
  }
  if(deepest)apply(deepest);
 }
 return out;
}
g.SailingWorld={ISLANDS,LANDMARKS,ROADS:DATA.roads||[],bounds:areaBounds,version:DATA.version,radius,islandSample,shorePoint,sample,heightAt,contact};

});
