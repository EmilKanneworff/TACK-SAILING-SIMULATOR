/* Visual movement around the shared physics stance. Positions are boat-local. */
(function (global) {
  'use strict';

  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
  const advance=(p,x,y,z)=>{p.x+=x;p.y+=y;p.z+=z;};
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  const blendPoint=(p,target,weight)=>advance(p,(target.x-p.x)*weight,(target.y-p.y)*weight,(target.z-p.z)*weight);

  function balance(previous,s,dt){
    const speed=s.vx*Math.cos(s.theta)+s.vy*Math.sin(s.theta),rise=s.heaveVelocity||0;
    if(!previous||s.time<previous.time||s.time-previous.time>.5||distance(previous,{x:s.x,y:s.y,z:0})>30){
      return {x:s.x,y:s.y,z:0,time:s.time,speed,rise,fore:0,side:0,compression:0};
    }
    if(s.time===previous.time)return previous;
    const step=Math.max(.012,s.time-previous.time),mix=1-Math.exp(-clamp(dt||step,.01,.2)*7);
    const forward=clamp((speed-previous.speed)/step,-5,5),vertical=clamp((rise-previous.rise)/step,-7,7);
    const fore=clamp(-.009*forward+.10*(s.pitchRate||0),-.078,.078);
    const side=clamp(-.11*(s.heelRate||0)-.009*speed*(s.omega||0),-.085,.085);
    const compression=clamp(-.0055*vertical,-.047,.021);
    return {x:s.x,y:s.y,z:0,time:s.time,speed,rise,
      fore:previous.fore+(fore-previous.fore)*mix,side:previous.side+(side-previous.side)*mix,
      compression:previous.compression+(compression-previous.compression)*mix};
  }

  function pose(scene,body,s,index){
    if(!body||!s||body.sharedMotion||s.capsized||s.recovering)return body;
    const out={...body};
    for(const key of ['pelvis','chest','head'])out[key]={...body[key]};
    for(const key of ['hips','knees','feet','shoulders','elbows','hands'])out[key]=body[key].map(point=>({...point}));

    const side=s.crewSideBlend??body.side??-1,sideRate=s.crewSideVelocity||0;
    const poseBlend=s.crewPoseBlend??body.degree??2,poseRate=s.crewPoseVelocity||0;
    const moving=clamp(Math.abs(sideRate)*1.6+Math.abs(poseRate)*.7,0,1);
    const crossing=clamp(Math.abs(sideRate)*2.2,0,1);
    const duck=crossing*Math.pow(clamp(1-Math.abs(side),0,1),1.25);
    const direction=Math.sign(sideRate)||1,transfer=clamp((side*direction+1)*.5,0,1);
    const balance=scene.crewBalance||{fore:0,side:clamp(-.11*(s.heelRate||0),-.08,.08),compression:0};
    const professional=scene.isFoiler?.50:scene.isYacht?.68:1;
    const breath=Math.sin((s.time||0)*(1.77+index*.023)+index*1.37)*.007;
    const toward=clamp((s.crewPose??poseBlend)-poseBlend,-1,1);
    const anticipation=(crossing*.045*direction+toward*side*.035)*(1-duck*.7);
    const lean=balance.side*professional+anticipation;
    const reach=balance.fore*professional+.13*duck;
    const settle=balance.compression*professional+breath+.034*moving*(1-duck)-.17*duck;
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
      const wheel=scene.helmWheel.position,racing=scene.model.racingYacht;
      const angle=(racing?Math.PI*.5*side:-.90)+scene.helmWheel.rotation.x,radius=racing?.34:.43;
      hold(1,{x:wheel.x,y:wheel.y+Math.cos(angle)*radius,z:wheel.z+Math.sin(angle)*radius},1-duck);
    }else if(scene.isYacht){
      const trim=clamp(s.sheet??.45,0,1),hoist=s.spinnaker?.hoist||0;
      const loading=4*hoist*(1-hoist),work=index===1?.16:index===2?.095:.034;
      advance(out.hands[1],work*(1-trim*1.7)+loading*.14,loading*(index===1?.12:.045)-.045,-side*.07);
      if(cockpit)hold(0,{x:out.pelvis.x-.22,y:scene.model.deckY+.16,z:side*(cockpit.halfWidth+.04)},.6+loading*.28);
    }else if(scene.isFoiler){
      const wheel=scene.acHelmWheels?.find(w=>Math.abs(w.position.x-body.pelvis.x)<.66&&Math.abs(w.position.z-body.pelvis.z)<.52);
      const y=wheel?.position.y??(body.pelvis.y+.27),x=wheel?.position.x??(body.pelvis.x+.39),z=wheel?.position.z??(body.pelvis.z+.20*side);
      hold(1,{x,y:y+.06,z:z+Math.sin((s.rudder||0)*2)*.10},.68);
      advance(out.hands[0],(index%3===0?.040:-.023)*Math.sin((s.time||0)*.62+index),balance.compression*.28,0);
    }

    const solve=(root,end,restRoot,restJoint,restEnd)=>{
      const upper=distance(restRoot,restJoint),lower=distance(restJoint,restEnd);
      const length=distance(root,end);
      const desired=clamp(length,Math.abs(upper-lower)+.003,upper+lower-.003);
      if(length>1e-6&&desired!==length)blendPoint(end,root,1-desired/length);
      const bend={x:restJoint.x-restRoot.x,y:restJoint.y-restRoot.y,z:restJoint.z-restRoot.z};
      return global.SailingBoats.jointBetween(root,end,upper,lower,bend);
    };
    for(let i=0;i<2;i++){
      out.knees[i]=solve(out.hips[i],out.feet[i],body.hips[i],body.knees[i],body.feet[i]);
      out.elbows[i]=solve(out.shoulders[i],out.hands[i],body.shoulders[i],body.elbows[i],body.hands[i]);
    }
    out.lookYaw=Math.PI/2+clamp((s.rudder||0)*.95+sideRate*.30+Math.sin((s.time||0)*.81+index)*.145+(index%3-1)*.11,-.65,.65);
    out.lookDown=.05+.32*duck+(index%3)*.10-clamp((s.pitchRate||0)*.25,-.13,.13);
    return out;
  }

  global.SailingCrewMotion={pose,balance};
})(globalThis);
