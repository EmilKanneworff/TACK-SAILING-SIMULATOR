/* Visual movement around the shared physics stance. Positions are boat-local. */
(function (global) {
  'use strict';

  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
  const advance=(p,x,y,z)=>{p.x+=x;p.y+=y;p.z+=z;};
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  const blendPoint=(p,target,weight)=>advance(p,(target.x-p.x)*weight,(target.y-p.y)*weight,(target.z-p.z)*weight);
  // Chest offset and line of sight from cockpit, coaming and full hiking.
  // The physical pelvis, feet and the two control grips anchor every pose.
  const laserStances=[
    {reach:.048,rise:-.032,out:.012,look:.12},
    {reach:.013,rise:.006,out:.010,look:.025},
    {reach:-.035,rise:-.028,out:.034,look:.085}
  ];
  const laserTransfer=[
    {at:0,reach:0,rise:0,look:0},
    {at:.23,reach:.048,rise:-.037,look:.13},
    {at:.50,reach:.084,rise:-.074,look:.27},
    {at:.76,reach:.048,rise:-.041,look:.17},
    {at:1,reach:0,rise:0,look:0}
  ];

  function interpolatePose(a,b,t){
    const mix=(x,y)=>x+(y-x)*smooth(t);
    return {reach:mix(a.reach,b.reach),rise:mix(a.rise,b.rise),
      out:mix(a.out??0,b.out??0),look:mix(a.look,b.look)};
  }
  function laserPose(scene,out,body,s,balance,transfer,crossing,side,direction,poseBlend){
    const index=clamp(Math.floor(poseBlend)-1,0,1);
    const stance=interpolatePose(laserStances[index],laserStances[index+1],poseBlend-index-1);
    const upper=laserTransfer.findIndex(frame=>frame.at>=transfer&&frame.at>0);
    const from=laserTransfer[upper-1],to=laserTransfer[upper];
    const move=interpolatePose(from,to,(transfer-from.at)/(to.at-from.at));
    const duck=body.duck||0,free=1-.80*duck;
    const breathing=Math.sin(s.time*1.63)*.009;
    const rise=(stance.rise+balance.compression+breathing-balance.brace*.111)*free+move.rise*crossing;
    const fore=(stance.reach+balance.fore+.049*balance.brace)*free+move.reach*crossing;
    const lean=(stance.out*side+balance.side)*free;
    advance(out.chest,fore,rise,lean);
    advance(out.head,fore*1.17,rise+clamp((s.pitchRate||0)*.018,-.022,.022),lean*.80);

    // Leave space for the cap while the actual boom sweeps by. The cap
    // centre is about 7 cm above the physical head reference after rigging.
    const angle=s.boom||0;
    const x=out.head.x-scene.mastX,z=out.head.z;
    const along=clamp(-x*Math.cos(angle)+z*Math.sin(angle),0,scene.rig.boomLength);
    const offset=Math.hypot(x+along*Math.cos(angle),z-along*Math.sin(angle));
    const clearance=(1-smooth((offset-.115)/.16))*smooth((out.head.y-scene.rig.boomY+.27)/.18);
    const sink=Math.max(0,out.head.y-scene.rig.boomY+.135)*clearance;
    advance(out.head,0,-sink,0);
    advance(out.chest,0,-.69*sink,0);
    for(let i=0;i<2;i++){
      advance(out.shoulders[i],fore,rise-.69*sink,lean);
      out.elbows[i]=solve(out.shoulders[i],out.hands[i],body.shoulders[i],body.elbows[i],body.hands[i],true);
    }
    const turn=clamp((s.omega||0)*.34-(s.rudder||0)*.56,-.35,.35);
    out.lookYaw=Math.PI/2+turn*free+direction*move.look*crossing+.20*balance.trim*side;
    out.lookDown=(body.lookDown??.05)+stance.look*free+move.look*.4*crossing+
      .13*balance.brace+.17*balance.trim*free-clamp((s.pitchRate||0)*.21,-.13,.13);
    out.bootYaw=out.feet.map((_,i)=>side*(.26+.66*smooth((poseBlend-1)/2))+(i===0?.07:-.07));
    out.bootPitch=out.feet.map((_,i)=>{
      const swing=clamp((transfer-(i===0?.08:.51))/.40,0,1);
      return .22*Math.sin(Math.PI*2*swing)*crossing;
    });
    return out;
  }

  function balance(previous,s,_dt,bow){
    const speed=s.vx*Math.cos(s.theta)+s.vy*Math.sin(s.theta),rise=s.heaveVelocity||0;
    if(!previous||s.time<previous.time||s.time-previous.time>.5||distance(previous,{x:s.x,y:s.y,z:0})>30){
      return {x:s.x,y:s.y,z:0,time:s.time,speed,rise,sheet:s.sheet??0,fore:0,side:0,horizonRoll:0,compression:0,brace:0,trim:0};
    }
    if(s.time===previous.time)return previous;
    const step=s.time-previous.time,mix=1-Math.exp(-step*7);
    const forward=clamp((speed-previous.speed)/step,-5,5),vertical=clamp((rise-previous.rise)/step,-7,7);
    const fore=clamp(-.018*forward+.10*(s.pitchRate||0)+.05*Math.sin(s.pitch||0),-.095,.095);
    const side=clamp(-.11*(s.heelRate||0)-.049*Math.sin(s.heel||0)-.010*speed*(s.omega||0),-.10,.10);
    const horizonRoll=clamp(-.56*(s.heel||0),-.36,.36);
    const compression=clamp(-.009*vertical,-.070,.025);
    const bowImpact=bow?smooth((bow.closing-.34)/1.35)*(1-smooth((Math.abs(bow.depth)-.08)/.29)):0;
    // The crew also feel the load through the deck when the stern or a foil
    // takes the initial impact before the bow touches.
    const brace=Math.max(bowImpact,smooth((vertical-1.8)/4.7)*smooth((-previous.rise-.12)/.75));
    const sheet=s.sheet??0,trim=smooth(Math.abs(sheet-previous.sheet)/(step*.44));
    return {x:s.x,y:s.y,z:0,time:s.time,speed,rise,sheet,
      fore:previous.fore+(fore-previous.fore)*mix,side:previous.side+(side-previous.side)*mix,
      horizonRoll:previous.horizonRoll+(horizonRoll-previous.horizonRoll)*mix,
      compression:previous.compression+(compression-previous.compression)*mix,
      brace:previous.brace+(brace-previous.brace)*(1-Math.exp(-step*(brace>previous.brace?13:5))),
      trim:previous.trim+(trim-previous.trim)*(1-Math.exp(-step*(trim>previous.trim?8:2.4)))};
  }

  const solve=(root,end,restRoot,restJoint,restEnd,keepEnd=false)=>{
    const upper=distance(restRoot,restJoint),lower=distance(restJoint,restEnd);
    const length=distance(root,end);
    const desired=clamp(length,Math.abs(upper-lower)+.003,upper+lower-.003);
    if(length>1e-6&&desired!==length){
      if(keepEnd)blendPoint(root,end,1-desired/length);
      else blendPoint(end,root,1-desired/length);
    }
    const bend={x:restJoint.x-restRoot.x,y:restJoint.y-restRoot.y,z:restJoint.z-restRoot.z};
    return global.SailingBoats.jointBetween(root,end,upper,lower,bend);
  };

  function pose(scene,body,s,index){
    if(!body||!s||s.capsized||s.recovering)return body;
    const out={...body};
    for(const key of ['pelvis','chest','head'])out[key]={...body[key]};
    for(const key of ['hips','knees','feet','shoulders','elbows','hands'])out[key]=body[key].map(point=>({...point}));

    const side=s.crewSideBlend??body.side??-1,sideRate=s.crewSideVelocity||0;
    const poseBlend=s.crewPoseBlend??body.degree??2,poseRate=s.crewPoseVelocity||0;
    const moving=clamp(Math.abs(sideRate)*1.6+Math.abs(poseRate)*.7,0,1);
    const crossing=clamp(Math.abs(sideRate)*2.2,0,1);
    const duck=crossing*Math.pow(clamp(1-Math.abs(side),0,1),1.25);
    const direction=Math.sign(sideRate)||1,transfer=clamp((side*direction+1)*.5,0,1);
    const balance=scene.crewBalance||{fore:0,side:clamp(-.11*(s.heelRate||0),-.08,.08),compression:0,brace:0,trim:0};
    out.horizonRoll=(balance.horizonRoll||0)*(1-.72*(body.duck||duck));
    if(body.sharedMotion&&scene.laserDetailed)return laserPose(scene,out,body,s,balance,transfer,crossing,side,direction,poseBlend);
    const professional=scene.isFoiler?.50:scene.isYacht?.68:1;
    const breath=Math.sin((s.time||0)*(1.77+index*.023)+index*1.37)*.007;
    const toward=clamp((s.crewPose??poseBlend)-poseBlend,-1,1);
    const anticipation=(crossing*.045*direction+toward*side*.035)*(1-duck*.7);
    const lean=balance.side*professional+anticipation;
    const reach=balance.fore*professional+.13*duck+balance.brace*.036;
    const settle=balance.compression*professional+breath+.034*moving*(1-duck)-.17*duck-balance.brace*.042*professional;
    if(body.sharedMotion){
      // Feet, seat and control hands stay with the physical stance. Shoulders
      // and elbows absorb the movement as the sailor watches the bow.
      const free=1-.76*(body.duck||0),rise=(balance.compression+breath-balance.brace*.084)*free;
      const lean=balance.side*free,fore=(balance.fore+.042*balance.brace)*free;
      advance(out.chest,fore,rise,lean);
      advance(out.head,fore*.93,rise+clamp((s.pitchRate||0)*.016,-.02,.02),lean*.65);
      for(let i=0;i<2;i++){
        advance(out.shoulders[i],fore,rise,lean);
        out.elbows[i]=solve(out.shoulders[i],out.hands[i],body.shoulders[i],body.elbows[i],body.hands[i],true);
      }
      const duck=body.duck||0;
      // The helm looks into the ongoing turn and checks the sheet when
      // hauling. During a transfer the head stays aligned with the crouch.
      const turn=clamp((s.omega||0)*.34-(s.rudder||0)*.56,-.35,.35);
      const transferLook=(body.lookYaw??Math.PI/2)-Math.PI/2;
      out.lookYaw=Math.PI/2+turn*free+transferLook*duck+.16*balance.trim*side;
      out.lookDown=(body.lookDown??.05)+.13*balance.brace+.17*balance.trim*free-clamp((s.pitchRate||0)*.21,-.13,.13);
      return out;
    }
    advance(out.chest,reach,settle,lean);
    advance(out.head,reach*1.3,settle-.07*duck,lean*1.22);

    const cockpit=scene.cockpitFor?.();
    for(let i=0;i<2;i++){
      advance(out.shoulders[i],reach,settle,lean);
      // Alternate plants during a cross-deck transfer. A hiked jolle keeps
      // both feet under the strap on the way out and back on the same side.
      const footProgress=clamp((transfer-(i===0?.08:.48)-.020*(index%3))/.40,0,1);
      const swing=Math.sin(Math.PI*footProgress)**2*crossing;
      const step=scene.isFoiler?.025:scene.isYacht?.095:.12;
      advance(out.feet[i],.036*swing,step*swing,direction*.12*swing);
      advance(out.hands[i],.10*duck,-.06*duck+balance.compression*.40,lean*.34);
    }

    const hold=(i,point,weight)=>{
      const shoulder=out.shoulders[i];
      const armLength=distance(body.shoulders[i],body.elbows[i])+distance(body.elbows[i],body.hands[i]);
      const reachable=1-smooth((distance(shoulder,point)-armLength+.025)/.12);
      blendPoint(out.hands[i],point,weight*reachable);
    };

    if(!scene.isYacht&&!scene.isFoiler){
      out.helmRelease=smooth(duck*1.28);
      const trim=clamp(s.sheet??.45,0,1);
      advance(out.hands[1],.085-.145*trim,trim*.033,-side*.035);
      if(cockpit&&out.helmRelease>0){
        hold(0,{x:out.pelvis.x-.27,y:scene.model.deckY+.075,z:side*(cockpit.halfWidth+.04)},out.helmRelease);
      }
      if(Math.abs(side)<.82&&scene.rig.boomY){
        const boom=s.boom||0,fore=-Math.cos(boom),cross=Math.sin(boom);
        const x=out.head.x-scene.mastX,z=out.head.z,along=clamp(x*fore+z*cross,0,scene.rig.boomLength);
        const clearance=Math.max(0,out.head.y-scene.rig.boomY+.17)*(1-smooth((Math.hypot(x-fore*along,z-cross*along)-.09)/.27));
        advance(out.head,0,-clearance,0);
        advance(out.chest,0,-clearance*.73,0);
        for(const shoulder of out.shoulders)advance(shoulder,0,-clearance*.73,0);
      }
    }else if(scene.isYacht&&index===0&&scene.helmWheel){
      const wheel=scene.helmWheel.position;
      const angle=-.90+scene.helmWheel.rotation.x,radius=.43;
      hold(1,{x:wheel.x,y:wheel.y+Math.cos(angle)*radius,z:wheel.z+Math.sin(angle)*radius},1-duck);
    }else if(scene.isYacht){
      const hoist=s.spinnaker?.hoist||0;
      const sail=index===1?s.sail?.jib:index===2&&hoist>0?s.sail?.spinnaker:s.sail?.main;
      const trim=clamp(sail?.trim??s.sheet??.45,0,1);
      const loading=4*hoist*(1-hoist),work=index===1?.16:index===2?.095:.034;
      advance(out.hands[1],work*(1-trim*1.7)+loading*.14,loading*(index===1?.12:.045)-.045,-side*.07);
      if(cockpit)hold(0,{x:out.pelvis.x-.22,y:scene.model.deckY+.16,z:side*(cockpit.halfWidth+.04)},.6+loading*.28);
    }else if(scene.isFoiler){
      const wheel=scene.foilingCrew?.[index]?.wheel;
      if(wheel){
        const radius=scene.isCat?.27:.20;
        for(let i=0;i<2;i++){
          const angle=(i===0?-1:1)*1.18-(s.rudder||0)*4;
          hold(i,{x:wheel.position.x,y:wheel.position.y+radius*Math.cos(angle),z:wheel.position.z+radius*Math.sin(angle)},1);
        }
      }else{
        // One hand braces at the thigh, the other works inboard as the rig
        // loads. The feet remain supported during steady flight.
        const knee=out.knees[0];
        hold(0,{x:knee.x-.04,y:knee.y+.07,z:knee.z},.52+.44*balance.brace);
        advance(out.hands[1],-.11*balance.trim,.04*balance.trim,-side*.045*balance.brace);
      }
    }

    for(let i=0;i<2;i++){
      out.knees[i]=solve(out.hips[i],out.feet[i],body.hips[i],body.knees[i],body.feet[i]);
      out.elbows[i]=solve(out.shoulders[i],out.hands[i],body.shoulders[i],body.elbows[i],body.hands[i]);
    }
    const helm=scene.foilingCrew?.[index]?.wheel||(scene.isYacht&&index===0);
    const sight=helm?clamp((s.omega||0)*.34-(s.rudder||0)*.66,-.45,.45):
      (index%3-1)*.14+balance.trim*.24*side;
    out.lookYaw=Math.PI/2+clamp(sight+sideRate*.30,-.65,.65);
    out.lookDown=.05+.32*duck+(index%3)*.10+.15*balance.brace+.12*balance.trim*Number(index%3===1)
      -clamp((s.pitchRate||0)*.25,-.13,.13);
    return out;
  }

  global.SailingCrewMotion={pose,balance};
})(globalThis);
