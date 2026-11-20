/* Conservative 2D hull contact for the host. Metres and SI masses.
 * Each pair is resolved once per world step. Ellipses approximate the hull
 * envelope; foils, rig and crew do not trigger contact. */
(function(root){
'use strict';
function radius(boat,nx,ny,c){const fx=Math.cos(boat.theta),fy=Math.sin(boat.theta),forward=nx*fx+ny*fy,side=nx*fy-ny*fx,a=Math.max(.2,c.length*.48),b=Math.max(.2,c.beam*.47);return 1/Math.sqrt((forward/a)**2+(side/b)**2);}
function resolve(entries,models){const touched=new Set(),pairs=[];for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
 const a=entries[i].state,b=entries[j].state,ca=models.get(a.boatId),cb=models.get(b.boatId);if(!ca||!cb||!Number.isFinite(a.x)||!Number.isFinite(b.x)||a.recovering||b.recovering)continue;
 if(Math.abs((a.heave||0)-(b.heave||0))>Math.max(2,ca.hullDepth+cb.hullDepth))continue;
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),nx=d>1e-6?dx/d:1,ny=d>1e-6?dy/d:0,overlap=radius(a,nx,ny,ca)+radius(b,nx,ny,cb)-d;if(overlap<=0)continue;
 const ma=ca.mass*(a.massScale||1),mb=cb.mass*(b.massScale||1),ia=1/ma,ib=1/mb,inv=ia+ib,relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
 // Inelastic impulse can only remove normal kinetic energy; no speed bonus.
 const impulse=relative<0?-(1+.08)*relative/inv:0;a.vx-=impulse*ia*nx;a.vy-=impulse*ia*ny;b.vx+=impulse*ib*nx;b.vy+=impulse*ib*ny;
 // Limit position correction per step to prevent sudden large displacement.
 const correction=Math.min(.5,Math.max(0,overlap-.02)*.6)/inv;a.x-=correction*ia*nx;a.y-=correction*ia*ny;b.x+=correction*ib*nx;b.y+=correction*ib*ny;
 touched.add(entries[i].id);touched.add(entries[j].id);pairs.push({a:entries[i].id,b:entries[j].id,overlap,impulse});
 }return {touched,pairs};}
root.FriVindCollisions={resolve,radius};if(typeof module!=='undefined'&&module.exports)module.exports=root.FriVindCollisions;
})(typeof globalThis!=='undefined'?globalThis:window);
