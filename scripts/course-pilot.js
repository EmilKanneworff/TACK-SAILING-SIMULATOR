/* A repeatable helm-and-sheet driver for the browser integration tests. */
(() => {
'use strict';

const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
const scale=(v,n)=>({x:v.x*n,y:v.y*n});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function waypoints(course,gateChoice){
  const model=course.model,axis=model.axis,start=model.startLine.centre;
  const points=[{...add(start,scale(axis,-20)),tag:'Startsiden'},{...add(start,scale(axis,30)),tag:'Start'}];
  const ranges=[];
  for(const visit of course.route){
    const first=points.length;
    if(visit.kind==='finish'){
      const {centre,normal}=model.finishLine;
      points.push({...add(centre,scale(normal,-30)),tag:'Før mål'},{...add(centre,scale(normal,30)),tag:'Mål'});
      continue;
    }
    const gate=visit.kind==='gate';
    const arc=visit.roundings[gate?gateChoice:0];
    const mark=model.buoys.find(buoy=>buoy.id===arc.buoyId);
    const radius=gate?model.gateWidth*.36:model.roundingRadius*4;
    if(gate){
      points.push({...add(visit,scale(visit.incoming,-radius*2)),tag:'Før gate'},{...add(visit,scale(visit.incoming,2)),tag:'Gate'});
    }else{
      const entry=add(mark,scale({x:Math.cos(arc.startAngle),y:Math.sin(arc.startAngle)},radius));
      points.push({...add(entry,scale(visit.incoming,-radius)),tag:'Før '+visit.label},
        {...add(entry,visit.incoming),tag:'Indgang '+visit.label});
    }
    for(let i=0;i<=8;i++){
      const angle=arc.startAngle+arc.rotation*(arc.sweep+.30)*i/8;
      points.push({x:mark.x+Math.cos(angle)*radius,y:mark.y+Math.sin(angle)*radius,tag:visit.label});
    }
    ranges.push({first,last:points.length-1});
  }
  return {points,ranges};
}

function coursePilot(course,windBearing,{gateChoice=0,wait=0,retry=false}={}){
  const {axis,startLine}=course.model,{points:route,ranges}=waypoints(course,gateChoice);
  const back=add(startLine.centre,scale(axis,-40)),front=add(startLine.centre,scale(axis,30));
  const wind=(90-windBearing)*SailPhysics.DEG;
  let target=0,tacking=1,destination=back;
  return {
    control(state,now){
      if(course.finished||now<course.countdownAtMs+wait)return {steer:0,trim:-1,crewPose:2,steerDigital:false,trimFast:true};
      if(course.started&&target<2)target=2;
      const range=ranges[course.index];
      if(retry&&course.started&&range&&target>Math.min(range.last+2,route.length-2))target=range.first;
      const point=route[target],distance=Math.hypot(point.x-state.x,point.y-state.y);
      if(course.started&&distance<(point.tag==='Start'?9:point.tag==='Mål'?7:3)&&target<route.length-1)target++;
      const along=(state.x-startLine.centre.x)*axis.x+(state.y-startLine.centre.y)*axis.y;
      destination=course.started?route[target]:now<course.gunAtMs||!course.startArmed||along>10?back:front;
      let want=Math.atan2(destination.y-state.y,destination.x-state.x);
      if(Math.abs(SailPhysics.wrap(want-wind))<50*SailPhysics.DEG){
        const across=(state.x-destination.x)*Math.sin(wind)-(state.y-destination.y)*Math.cos(wind);
        if(across>12)tacking=1;
        else if(across< -12)tacking=-1;
        want=wind+tacking*55*SailPhysics.DEG;
      }
      const error=SailPhysics.wrap(want-state.theta),steer=clamp(-error*2.2+state.omega*.9,-1,1);
      const twa=Math.abs(SailPhysics.wrap(state.theta-wind)),sheet=twa<1.3?.72:twa<2.3?.43:.18;
      return {steer,steerDigital:false,trim:clamp((sheet-state.sheet)*5,-1,1),trimFast:true,crewPose:2};
    },
    status(){return {target,tag:destination.tag,count:route.length};}
  };
}

globalThis.FriVindCoursePilot=coursePilot;
})();
