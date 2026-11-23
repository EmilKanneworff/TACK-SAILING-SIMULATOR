(function(root){
'use strict';

const limit=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=limit((x-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const MAX_WAVES=12,MAX_WINDOWS=12;
const SURFACE_COLUMNS=19,SURFACE_ROWS=11,SURFACE_RANGE=12;
const profiles={
  laser:{wake:.46,wave:.103,spacing:.32,life:10,response:.12},
  dinghy:{wake:.46,wave:.11,spacing:.42,life:11,response:.15},
  yacht:{wake:.62,wave:.155,spacing:.61,life:16,response:.27},
  ac75:{wake:.46,wave:.15,spacing:.67,life:15,response:.23},
  ac72:{wake:.42,wave:.12,spacing:.67,life:13,response:.20}
};
const reflectLayer=7;

function foamTexture(T){
  const size=128,data=new Uint8Array(size*size*4);
  const hash=(x,y,seed)=>{const n=Math.sin(x*127.1+y*311.7+seed*53.9)*43758.5453;return n-Math.floor(n);};
  const noise=(u,v,n,seed)=>{
    const x=Math.floor(u*n),y=Math.floor(v*n),fx=smooth(0,1,u*n-x),fy=smooth(0,1,v*n-y);
    const h=(a,b)=>hash((x+a+n)%n,(y+b+n)%n,seed);
    return mix(mix(h(0,0),h(1,0),fx),mix(h(0,1),h(1,1),fx),fy);
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,k=(y*size+x)*4;
    const warp=noise(u,v,8,1)-.5;
    data[k]=255*(.62*noise(u+warp*.044,v,5,2)+.25*noise(u,v,12,3)+.13*noise(u,v,28,1));
    data[k+1]=255*(.53*noise(u,v+warp*.041,16,4)+.47*noise(u,v,31,2));
    data[k+2]=255*noise(u,v,9,5);
    data[k+3]=255;
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;
  texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

const waveShader=`
uniform int contactWaveCount;
uniform vec4 contactWaveBounds;
uniform vec4 contactCentres[${MAX_WAVES}], contactShapes[${MAX_WAVES}];
uniform float contactWake[${MAX_WAVES}];
vec4 contactWave(vec2 p) {
  if(contactWaveCount==0||any(lessThan(p,contactWaveBounds.xy))||any(greaterThan(p,contactWaveBounds.zw)))return vec4(0.);
  vec4 sum=vec4(0.);
  for(int i=0;i<${MAX_WAVES};i++){
    if(i>=contactWaveCount)break;
    vec4 c=contactCentres[i],s=contactShapes[i];
    vec2 d=p-c.xy;
    if(dot(d,d)>max(s.y*s.y,s.z*s.z))continue;
    vec2 right=vec2(-c.w,c.z);
    vec2 uv=vec2(dot(d,c.zw)/s.y,dot(d,right)/s.z);
    float u=uv.x,v=uv.y,r=dot(uv,uv);
    if(r>=1.)continue;
    float edge=1.-r,env=edge*edge,lateral=sqrt(v*v+.024);
    float wake=contactWake[i];
    vec2 frequency=mix(vec2(4.4,5.5),vec2(4.45,3.1),wake);
    float phase=mix(1.63,.35,wake)+dot(frequency,vec2(u,lateral-.155))-s.w;
    float sn=sin(phase),cs=cos(phase),height=s.x*env*sn;
    vec2 derivative=s.x*(env*cs*frequency*vec2(1.,v/lateral)-4.*edge*sn*uv);
    sum+=vec4(height,c.zw*(derivative.x/s.y)+right*(derivative.y/s.z),height*wake);
  }
  float limitHeight=1.+2.5*abs(sum.x);
  return vec4(sum.x/limitHeight,sum.yz/(limitHeight*limitHeight),sum.w/(1.+2.5*abs(sum.w)));
}
`;

class HullWater {
  constructor(scene){
    this.scene=scene;const T=this.T=scene.T;
    const vectors=n=>Array.from({length:n},()=>new T.Vector4());
    this.target=new T.WebGLRenderTarget(640,360,{depthBuffer:true,magFilter:T.LinearFilter,minFilter:T.LinearMipmapLinearFilter});
    this.target.texture.generateMipmaps=true;
    this.mirror=new T.PerspectiveCamera();this.mirror.layers.set(reflectLayer);
    this.mirrorClip=[new T.Plane(new T.Vector3(0,1,0),.025)];
    this.clear=new T.Color();this.look=new T.Vector3();
    this.actors=new Map();this.lastReflection=-Infinity;
    const layers=new URLSearchParams(root.location.search).get('vandlag');
    this.layers=new Set(layers?.split(',')||[]);
    this.uniforms={
      contactWaveCount:{value:0},contactWaveBounds:{value:new T.Vector4()},contactCentres:{value:vectors(MAX_WAVES)},contactShapes:{value:vectors(MAX_WAVES)},contactWake:{value:new Float32Array(MAX_WAVES)},
      contactWindowCount:{value:0},contactWindowBounds:{value:new T.Vector4()},contactWindows:{value:vectors(MAX_WINDOWS)},
      boatReflection:{value:this.target.texture},boatReflectionMatrix:{value:new T.Matrix4()},boatReflectionEnabled:{value:0},boatReflectionHeight:{value:0}
    };
    this.texture=foamTexture(T);
    scene.hemi.layers.enable(reflectLayer);scene.sun.layers.enable(reflectLayer);
  }

  bind(actor){
    if(actor.boatRoot===actor.hullWaterBound)return;
    actor.hullWaterBound=actor.boatRoot;
    const T=this.T,wet={plane:{value:new T.Vector4()},film:{value:new T.Vector4()},active:{value:0},
      bounds:{value:new T.Vector4()},basis:{value:new T.Vector2(1,0)},datum:{value:0},sampled:{value:0},surface:{value:null}};
    actor.hullWetUniforms=wet;
    const surface=[actor.hullMesh,actor.laserStripe,...(actor.catHulls||[]).map(h=>h.shell)];
    const optical=[...surface,actor.daggerboard,actor.keel];
    for(const part of [actor.rudder,...Object.values(actor.catRudders||{}),actor.rudderElevator,...Object.values(actor.foilVisuals||{}).flatMap(v=>[v.arm,v.group,v.root,v.wing,v.strut])]){
      part?.traverse?.(node=>{if(node.isMesh)optical.push(node);});
    }
    for(const node of [actor.hullMesh,...surface,actor.sailMesh,actor.sailSkinMesh,actor.jibMesh,actor.wingMain,actor.wingFlap]){
      if(node?.isMesh)node.layers.enable(reflectLayer);
    }
    const materials=new Set(optical.filter(Boolean).map(node=>node.material));
    for(const material of materials){
      if(!material?.isMeshStandardMaterial)continue;
      material.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,{hullWaterPlane:wet.plane,hullWetFilm:wet.film,hullWaterActive:wet.active,
          hullSurface:wet.surface,hullSurfaceBounds:wet.bounds,hullSurfaceBasis:wet.basis,hullSeaDatum:wet.datum,hullSurfaceSampled:wet.sampled});
        shader.vertexShader='varying vec3 contactWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',
          '#include <project_vertex>\ncontactWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
        shader.fragmentShader=`
          uniform vec4 hullWaterPlane,hullWetFilm,hullSurfaceBounds;
          uniform vec2 hullSurfaceBasis;
          uniform float hullWaterActive,hullSeaDatum,hullSurfaceSampled;
          uniform sampler2D hullSurface;
          varying vec3 contactWorld;
        `+shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          float waterHeight=dot(hullWaterPlane.xyz,contactWorld)+hullWaterPlane.w;
          vec2 delta=contactWorld.xz-hullSurfaceBounds.xy;
          vec2 starboard=vec2(-hullSurfaceBasis.y,hullSurfaceBasis.x);
          vec2 uv=.5+vec2(dot(delta,hullSurfaceBasis),dot(delta,starboard))*hullSurfaceBounds.zw;
          if(hullSurfaceSampled>.5&&all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){
            vec2 encoded=texture2D(hullSurface,(uv*vec2(${SURFACE_COLUMNS-1}.,${SURFACE_ROWS-1}.)+.5)/vec2(${SURFACE_COLUMNS}.,${SURFACE_ROWS}.)).rg;
            waterHeight=contactWorld.y-hullSeaDatum-${SURFACE_RANGE}.*(dot(encoded,vec2(256./257.,1./257.))-.5);
          }
          float side=smoothstep(.43,.57,uv.y),along=smoothstep(.27,.73,uv.x);
          float filmHeight=mix(mix(hullWetFilm.x,hullWetFilm.y,side),mix(hullWetFilm.z,hullWetFilm.w,side),along);
          float wetFilm=hullWaterActive*(1.-smoothstep(.012,filmHeight+.037,waterHeight))*smoothstep(-.10,-.012,waterHeight);
          roughnessFactor=mix(roughnessFactor,max(.11,roughnessFactor*.53),wetFilm*.78);
        `).replace('#include <opaque_fragment>',`
          float submerged=hullWaterActive*smoothstep(.009,.77,-waterHeight);
          outgoingLight=mix(outgoingLight,outgoingLight*vec3(.33,.57,.63)+vec3(.005,.012,.015),submerged*.72);
          outgoingLight*=1.-.095*wetFilm;
          #include <opaque_fragment>
        `);
      };
      material.customProgramCacheKey=()=>'local-hull-water-film';
      material.needsUpdate=true;
    }
  }

  contactHeight(x,y){
    const u=this.uniforms,b=u.contactWaveBounds.value,z=-y;
    if(x<b.x||x>b.z||z<b.y||z>b.w)return 0;
    let height=0;
    for(let i=0;i<u.contactWaveCount.value;i++){
      const c=u.contactCentres.value[i],s=u.contactShapes.value[i],wake=u.contactWake.value[i];
      const dx=x-c.x,dz=z-c.y,along=(dx*c.z+dz*c.w)/s.y,across=(-dx*c.w+dz*c.z)/s.z;
      const r=along*along+across*across;
      if(r>=1)continue;
      const phase=(wake?.35:1.63)+(wake?4.45:4.4)*along+(wake?3.1:5.5)*(Math.sqrt(across*across+.024)-.155)-s.w;
      height+=s.x*(1-r)**2*Math.sin(phase);
    }
    return height/(1+2.5*Math.abs(height));
  }

  updateSurface(fx){
    const {actor,state:s,env}=fx,wet=actor.hullWetUniforms,m=actor.model;
    const {fx:fxAxis,fy:fyAxis,rx,ry}=this.scene.P.axes(s.theta);
    const length=m.length*1.19+1.15,width=(actor.isCat?Math.max(...m.hullOffsets.map(Math.abs))*2+(m.hullBeam??m.beam):m.beam)+1.12;
    if(!wet.surface.value){
      const T=this.T,map=new T.DataTexture(new Uint8Array(SURFACE_COLUMNS*SURFACE_ROWS*4),SURFACE_COLUMNS,SURFACE_ROWS,T.RGBAFormat);
      map.minFilter=map.magFilter=T.LinearFilter;map.generateMipmaps=false;
      wet.surface.value=map;
    }
    const map=wet.surface.value,bytes=map.image.data,datum=s.heave||0;
    for(let j=0;j<SURFACE_ROWS;j++)for(let i=0;i<SURFACE_COLUMNS;i++){
      const f=(i/(SURFACE_COLUMNS-1)-.5)*length,r=(j/(SURFACE_ROWS-1)-.5)*width;
      const x=s.x+f*fxAxis+r*rx,y=s.y+f*fyAxis+r*ry;
      const surface=this.scene.P.waveAt(x,y,s.time,env).height+this.contactHeight(x,y);
      const value=Math.round(65535*limit(.5+(surface-datum)/SURFACE_RANGE));
      const k=(j*SURFACE_COLUMNS+i)*4;
      bytes[k]=value>>8;bytes[k+1]=value&255;
    }
    wet.bounds.value.set(s.x,-s.y,1/length,1/width);
    wet.datum.value=datum;wet.basis.value.set(fxAxis,-fyAxis);wet.sampled.value=1;
    map.needsUpdate=true;
  }

  surfaceHeight(actor,x,y){
    const {bounds,basis,datum,sampled,surface}=actor.hullWetUniforms;
    if(!sampled.value)return null;
    const b=bounds.value,d=basis.value,dx=x-b.x,dz=-y-b.y;
    const u=(.5+(dx*d.x+dz*d.y)*b.z)*(SURFACE_COLUMNS-1);
    const v=(.5+(-dx*d.y+dz*d.x)*b.w)*(SURFACE_ROWS-1);
    if(u<0||v<0||u>SURFACE_COLUMNS-1||v>SURFACE_ROWS-1)return null;
    const i=Math.min(SURFACE_COLUMNS-2,Math.floor(u)),j=Math.min(SURFACE_ROWS-2,Math.floor(v));
    const bytes=surface.value.image.data,base=(j*SURFACE_COLUMNS+i)*4,row=SURFACE_COLUMNS*4;
    const read=k=>bytes[k]*256+bytes[k+1],a=u-i,c=v-j;
    return datum.value+SURFACE_RANGE*(mix(mix(read(base),read(base+4),a),mix(read(base+row),read(base+row+4),a),c)/65535-.5);
  }

  track(fx,id,hit,params,s){
    let track=fx.tracks[id];
    if(!track)track=fx.tracks[id]=[];
    const ageLimit=params.life,time=s.time;
    while(track.length&&time-track.at(-1).t>ageLimit)track.pop();
    const from=fx.previous[id];
    if(!hit){fx.previous[id]=null;return track;}
    const to={...hit,...params,t:time};
    if(!from){fx.segment++;to.segment=fx.segment;to.serial=0;track.unshift(to);fx.previous[id]=to;fx.distance[id]=0;return track;}
    const distance=Math.hypot(to.x-from.x,to.y-from.y),spacing=params.spacing;
    let offset=spacing-(fx.distance[id]||0);
    to.segment=from.segment;
    to.serial=from.serial;
    while(offset<=distance&&track.length<224){
      const t=offset/distance,point={...to};
      for(const key of ['x','y','t','strength','width','speed','dirX','dirY','driftX','driftY'])point[key]=mix(from[key],to[key],t);
      if(to.wakeHeight!=null)point.wakeHeight=mix(from.wakeHeight??to.wakeHeight,to.wakeHeight,t);
      point.serial=++to.serial;
      track.unshift(point);offset+=spacing;
    }
    // Bound memory even after a long run, keeping the newest samples.
    if(track.length>=224)track.length=216;
    fx.distance[id]=(distance+(fx.distance[id]||0))%spacing;
    fx.previous[id]=to;
    return track;
  }

  sample(id,actor,s,env,{reset=false,local=false}={}){
    this.bind(actor);
    const model=actor.model,profile=profiles[model.id]||(model.racingYacht?profiles.dinghy:profiles.yacht);
    let fx=this.actors.get(id);
    const recovering=!!s.recovering;
    if(reset||!fx||fx.actor!==actor||fx.boat!==actor.boatRoot||s.time<fx.time||
      Math.hypot(s.x-fx.x,s.y-fx.y)>Math.max(8,Math.hypot(s.vx,s.vy)*(s.time-fx.time)*2+2)||recovering!==fx.recovering){
      fx={actor,boat:actor.boatRoot,time:s.time,tracks:{},previous:{},distance:{},segment:0,contacts:[],packets:[],windows:[],strengths:{},films:[0,0,0,0],recovering};
      this.actors.set(id,fx);
    }
    const dt=limit(s.time-fx.time,0,.2);
    if(!local&&fx.contacts.length&&dt<(this.scene.quality==='low'?.035:.018))return fx;
    Object.assign(fx,{time:s.time,x:s.x,y:s.y,local,profile,env,state:s});
    fx.packets.length=fx.windows.length=fx.contacts.length=0;
    const drain=Math.exp(-dt*.58);
    for(let i=0;i<fx.films.length;i++)fx.films[i]*=drain;
    const P=this.scene.P,{fx:forwardX,fy:forwardY,rx,ry}=P.axes(s.theta);
    const density=P.configFor(s).waterDensity;
    const offsets=actor.isCat?model.hullOffsets:[0],beam=model.hullBeam??model.beam;
    const planing=limit((s.forces?.planingLift||0)/(model.mass*9.81));
    const probe=(x,z,y,joint)=>P.waterContact(s,{x,y,z},env,joint);
    const flow=contact=>{
      const {relativeX,relativeY}=contact,speed=Math.hypot(relativeX,relativeY);
      return {speed,dirX:speed>.025?relativeX/speed:forwardX,dirY:speed>.025?relativeY/speed:forwardY,
        driftX:mix(s.waterX||0,contact.waterX,.42),driftY:mix(s.waterY||0,contact.waterY,.42)};
    };
    const append=(id,kind,hit,side,depthScale,support=1)=>{
      const current=flow(hit),wet=smooth(-.045,depthScale,hit.depth)*support;
      const outward=side*(hit.relativeX*rx+hit.relativeY*ry);
      const impact=smooth(.40,1.8,hit.closing)*hit.entry;
      const target=smooth(.42,kind==='appendage'?7:4.2,current.speed)*wet;
      const previous=fx.strengths[id]??0,strength=mix(previous,target,1-Math.exp(-dt/profile.response));
      fx.strengths[id]=strength;
      const sample={...hit,...current,id,kind,side,wet,strength,impact,outward};
      fx.contacts.push(sample);
      return sample;
    };
    for(const [index,offset] of offsets.entries()){
      const wetHull=actor.isFoiler?limit((s.foiling?.hulls?.[index]?.wetFraction??s.foiling?.hullWetFraction??s.hydro?.hullWetFraction??1)*4.6):1;
      const sternX=model.length*-.465,bowX=model.length*.37;
      const span=actor.halfBeamAt(sternX)*.63;
      const sternProbes=[0,-span,span].map(z=>probe(sternX,offset+z,actor.bottomAt(sternX,z)));
      const weights=sternProbes.map(hit=>smooth(-.045,.13,hit.depth));
      const sternZ=span*(weights[2]-weights[1])/Math.max(.01,weights[0]+weights[1]+weights[2]);
      const sternHit=probe(sternX,offset+sternZ,actor.bottomAt(sternX,sternZ));
      const stern=append('stern'+index,'stern',sternHit,Math.sign(sternHit.point.z-offset),.13,wetHull);
      const bow=append('bow'+index,'bow',probe(bowX,offset,actor.bottomAt(bowX,0)),0,.15,wetHull*(1-.49*planing));
      if(local)bow.impact=Math.max(bow.impact,smooth(.45,1.6,bow.closing)*bow.entry*.95);
      const shoulders=[],middle=probe(0,offset,actor.bottomAt(0,0));
      for(const side of [-1,1])for(const [station,x] of [[0,model.length*.20],[1,-model.length*.22]]){
        const z=side*actor.halfBeamAt(x)*.72;
        let hit=probe(x,offset+z,actor.bottomAt(x,z));
        if(model.id!=='laser'&&wetHull>.025){
          // On the larger hulls the shoulders can be dry while the round
          // bottom is already displacing water and making a surface wave.
          const inner=z*.37,belly=probe(x,offset+inner,actor.bottomAt(x,inner));
          if(hit.depth<-.035&&belly.depth>hit.depth)hit=belly;
        }
        const shoulder=append('side'+index+side+station,'side',hit,side,Math.max(.105,model.hullDepth*.25),wetHull*(station===0?1-.46*planing:1));
        shoulder.hullIndex=index;
        shoulders.push(shoulder);
        const film=(station===0?2:0)+(side+1)/2;
        const band=limit(hit.depth*.56+shoulder.impact*.11+.014,0,.16);
        fx.films[film]=Math.max(fx.films[film],band);
      }
      const aft=shoulders.filter((_,i)=>i%2===1).reduce((a,b)=>a.depth>=b.depth?a:b);
      const belly=actor.isFoiler?append('belly'+index,'side',middle,0,.17,wetHull):null;
      const trackContact=stern.depth>-.065?stern:belly&&aft.depth<-.055?belly:aft;
      const activity=Math.max(stern.strength,aft.strength*.84,(belly?.strength??0)*.73);
      const width=beam*profile.wake*(.82+.36*activity);
      const hullBuoyancy=s.hydro?.hulls?.[index]?.buoyancy;
      const totalDisplacement=s.hydro?.submergedVolume??model.mass*wetHull/density;
      const displaced=hullBuoyancy==null?totalDisplacement/offsets.length:hullBuoyancy/(density*9.81);
      const displacement=limit(Math.cbrt(Math.max(0,displaced)/.16),0,2.65);
      const discharge=smooth(.50,3.1,trackContact.speed)*trackContact.wet;
      const wakeHeight=limit(profile.wave*(.58+.45*displacement)*(activity*2.60+discharge*.32+stern.impact*.20),0,.36);
      this.track(fx,'h'+index,wetHull>.022&&!recovering&&!s.capsized&&trackContact.speed>.36&&activity>.018?trackContact:null,
        {spacing:profile.spacing,width,life:profile.life,strength:limit(activity*(1.10+.14*displacement)+stern.impact*.13),wakeHeight},s);
      if(!recovering){
        const fore=shoulders.filter((_,i)=>i%2===0).reduce((a,b)=>a.depth>=b.depth?a:b);
        const root=bow.depth>-.055?bow:belly&&fore.depth<-.055?belly:fore;
        const core=profile.wave*Math.max(bow.strength*.97,fore.strength*.59,bow.impact*.66,(belly?.strength??0)*.52,root.impact*.59);
        if(core>.004)fx.packets.push({...root,amplitude:core,len:Math.max(1.44,model.length*.27),width:Math.max(1.02,beam*.98),phase:0});
        for(const h of shoulders.filter((_,i)=>i%2===0)){
          const power=h.strength*profile.wave*.49;
          if(power>.004)fx.packets.push({...h,amplitude:power,len:Math.max(1.15,model.length*.245),width:Math.max(.79,beam*.64),phase:.72});
        }
      }
    }
    const gear=(key,point,hinge,joint,support=1)=>{
      const tip=probe(point.x,point.z,point.y,joint),top=probe(hinge.x,hinge.z,hinge.y);
      let surface=tip,piercing=tip.depth>0&&top.depth<0;
      if(piercing){const f=limit(-top.depth/(tip.depth-top.depth));surface=probe(mix(hinge.x,point.x,f),mix(hinge.z,point.z,f),mix(hinge.y,point.y,f),
        joint&&{x:joint.x*f,y:joint.y*f,z:joint.z*f});}
      const contact=append(key,'appendage',surface,Math.sign(point.z),.12,piercing?1:smooth(0,.22,tip.depth));
      contact.piercing=piercing;
      if(tip.depth>0){
        fx.windows.push({x:tip.x,y:tip.y,radius:Math.max(.29,beam*.30),strength:.43*Math.exp(-tip.depth*1.65)});
        if(piercing)fx.windows.push({x:surface.x,y:surface.y,radius:Math.max(.25,beam*.17),strength:.31});
      }
      if(actor.isFoiler)this.track(fx,'f'+key,!recovering&&piercing&&contact.speed>2.6&&contact.strength>.023?contact:null,
        {spacing:.59,width:.065+.081*support,life:9,strength:contact.strength*(.19+.35*support)},s);
    };
    if(actor.isFoiler)for(const key of actor.foilKeys(s)){
      const p=root.FoilingPhysics.foilPose(s,key==='rudder'?0:key),f=s.foils?.[key];
      gear(key,p.wingCentre,p.hinge,p.jointVelocity,limit(Math.abs(f?.lift||0)/(model.mass*9.81)*2));
    }else{
      if(actor.isYacht&&actor.keel){
        const x=actor.keel.position.x;
        gear('keel',{x,y:-actor.keel.userData.physicalDepth,z:0},{x,y:model.deckY-model.hullDepth*.55,z:0});
      }
      if(!actor.isYacht&&model.daggerX!=null&&actor.daggerboard)gear('board',{x:model.daggerX,y:model.waterBlades?.board.tip??-(model.daggerDepth||.9)*.92,z:0},{x:model.daggerX,y:model.deckY,z:0});
      const rudderOffsets=model.rudderOffsets||[0];
      for(const [i,z] of rudderOffsets.entries()){
        const blade={...model.waterBlades.rudder,z};
        gear('rudder'+i,root.SailingBoats.rudderPoint(blade,1,s.rudder),root.SailingBoats.rudderPoint(blade,0,s.rudder));
      }
    }
    const h=P.waveAt(s.x,s.y,s.time,env),film=actor.hullWetUniforms;
    // Tangent fallback for boats too far away to need a sampled waterline.
    film.plane.value.set(-h.dx,1,h.dy,h.dx*s.x+h.dy*s.y-h.height);
    film.bounds.value.set(s.x,-s.y,1/model.length,1/model.beam);
    film.basis.value.set(forwardX,-forwardY);film.sampled.value=0;
    film.film.value.set(...fx.films);film.active.value=this.layers.has('materiale')?0:1;
    return fx;
  }

  remote(id,actor,s,env,near){
    this.bind(actor);
    if(near)this.sample(id,actor,s,env);
    else actor.hullWetUniforms.sampled.value=0;
  }

  forget(actor){
    actor.hullWetUniforms?.surface.value?.dispose();
    for(const [id,fx] of this.actors)if(fx.actor===actor)this.actors.delete(id);
    this.lastReflection=-Infinity;
  }

  publish(s,camera){
    const {contactCentres,contactShapes,contactWake,contactWindows,contactWaveCount,contactWindowCount,contactWaveBounds,contactWindowBounds}=this.uniforms;
    let waves=0,windows=0;
    const nearby=[...this.actors.entries()].filter(([,fx])=>s.time-fx.time<.48&&s.time-fx.time>-.5)
      .sort(([,a],[,b])=>Number(b.local)-Number(a.local)||Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y));
    for(const [id,fx] of this.actors)if(Math.abs(s.time-fx.time)>2)this.actors.delete(id);
    if(camera.position.y>=135){
      contactWaveCount.value=contactWindowCount.value=0;
      for(const [,fx] of nearby)fx.actor.hullWetUniforms.sampled.value=0;
      return;
    }
    const extend=(b,x,z,r)=>{
      b.x=Math.min(b.x,x-r);b.y=Math.min(b.y,z-r);
      b.z=Math.max(b.z,x+r);b.w=Math.max(b.w,z+r);
    };
    contactWaveBounds.value.set(s.x,-s.y,s.x,-s.y);
    contactWindowBounds.value.set(s.x,-s.y,s.x,-s.y);
    const push=({x,y,dirX,dirY,amplitude,len,width,phase},wake=0)=>{
      if(waves===MAX_WAVES)return;
      extend(contactWaveBounds.value,x,-y,Math.max(len,width));
      contactCentres.value[waves].set(x,-y,dirX,-dirY);
      contactShapes.value[waves].set(amplitude,len,width,phase);
      contactWake.value[waves++]=wake;
    };
    const sternPacket=(p,age,model)=>{
      const len=Math.max(1.82,model.length*.33,p.speed*.57)+age*.19;
      const froude=p.speed/Math.sqrt(9.81*model.length);
      const spread=limit(.44/Math.sqrt(Math.max(.12,froude)),.37,.68);
      const shift=age===0?len*.57:0;
      const fade=age===0?1:smooth(.12,.69,age)*(1-smooth(2.15,4.10,age))*Math.exp(-age*.39)*.72;
      if(p.wakeHeight*fade<.003)return false;
      push({x:p.x-p.dirX*shift,y:p.y-p.dirY*shift,dirX:p.dirX,dirY:p.dirY,
        amplitude:p.wakeHeight*fade,len,width:Math.max(1,p.width*2.10)+spread*age,phase:age*2.18},1);
      return true;
    };
    for(const [,fx] of nearby){
      if(!fx.local&&Math.hypot(fx.x-camera.position.x,fx.y+camera.position.z)>36)continue;
      const hullTracks=Object.entries(fx.tracks).filter(([key])=>key.startsWith('h'));
      for(const [key] of hullTracks)if(fx.previous[key])sternPacket(fx.previous[key],0,fx.actor.model);
      for(const p of fx.packets.slice(0,fx.local?4:1))push(p);
      for(const p of fx.windows){
        if(windows===MAX_WINDOWS||camera.position.y>=47)break;
        contactWindows.value[windows++].set(p.x,-p.y,p.radius,p.strength);
        extend(contactWindowBounds.value,p.x,-p.y,p.radius*1.59);
      }
      // Fixed world samples carry old wave fronts through turns and after stopping.
      for(const [,track] of hullTracks){
        if(!fx.local)break;
        let emitted=0;
        const model=fx.actor.model;
        for(const p of track){
          const age=s.time-p.t;
          if(age>=4.1||waves>=MAX_WAVES-2)break;
          const stride=Math.max(2,Math.round(Math.max(1.45,model.length*.33,p.speed*.48)/p.spacing));
          if(age<=.12||p.serial%stride!==0)continue;
          if(sternPacket(p,age,model)&&++emitted>=(fx.actor.isCat?2:4))break;
        }
      }
    }
    contactWaveCount.value=this.layers.has('lokale-boelger')?0:waves;
    contactWindowCount.value=this.layers.has('gennemsigtighed')?0:windows;
    // Sample the local hull and at most one close rival. Distant vessels
    // retain the tangent while the differences are subpixel.
    let remoteSampled=false;
    for(const [,fx] of nearby){
      const close=Math.hypot(fx.x-camera.position.x,fx.y+camera.position.z)<22;
      if(fx.local||(!remoteSampled&&close&&this.scene.quality!=='low')){
        this.updateSurface(fx);
        if(!fx.local)remoteSampled=true;
      }else fx.actor.hullWetUniforms.sampled.value=0;
    }
  }

  reflect(s,env){
    const {renderer,scene,camera,graphicsProfile}=this.scene,u=this.uniforms;
    const active=graphicsProfile.reflectionSize>0&&!this.layers.has('refleksion')&&camera.position.y>.20&&camera.position.y<39;
    if(!active){u.boatReflectionEnabled.value=0;return;}
    // This pass shares a single viewport for all boats and renders the sails
    // and shells only. The above-water clipping plane excludes appendages.
    const now=s.time;
    const aspect=camera.aspect;
    if(this.reflectionMode===this.scene.cameraMode&&this.reflectionQuality===graphicsProfile.id&&this.reflectionAspect===aspect&&now>=this.lastReflection&&now-this.lastReflection<graphicsProfile.reflectionInterval){
      if(camera.position.y<=u.boatReflectionHeight.value+.21)u.boatReflectionEnabled.value=0;
      return;
    }
    this.reflectionMode=this.scene.cameraMode;
    this.reflectionQuality=graphicsProfile.id;this.reflectionAspect=aspect;
    const width=graphicsProfile.reflectionSize;
    const height=Math.round(limit(width/aspect,160,512));
    if(this.target.width!==width||this.target.height!==height)this.target.setSize(width,height);
    this.lastReflection=now;
    const mirror=this.mirror,P=this.scene.P,{fx,fy,rx,ry}=P.axes(s.theta),m=this.scene.model;
    const samples=[[0,0],[-m.length*.24,0],[m.length*.24,0],[0,-m.beam*.32],[0,m.beam*.32]];
    // Anchor the common reflection pass to the surface beneath the boat.
    // A small footprint average removes short ripples from the mirror pose.
    const plane=samples.reduce((sum,[f,r])=>sum+P.waveAt(s.x+f*fx+r*rx,s.y+f*fy+r*ry,s.time,env).height,0)/samples.length;
    if(camera.position.y<=plane+.21){u.boatReflectionEnabled.value=0;return;}
    u.boatReflectionEnabled.value=1;
    camera.getWorldDirection(this.look);mirror.position.copy(camera.position);
    u.boatReflectionHeight.value=plane;
    mirror.position.y=2*plane-camera.position.y;
    this.look.y*=-1;
    mirror.lookAt(this.look.add(mirror.position));mirror.projectionMatrix.copy(camera.projectionMatrix);
    mirror.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    mirror.updateMatrixWorld();
    u.boatReflectionMatrix.value.multiplyMatrices(mirror.projectionMatrix,mirror.matrixWorldInverse);
    this.mirrorClip[0].constant=-plane+.074;
    const target=renderer.getRenderTarget(),background=scene.background,clipping=renderer.clippingPlanes,
      shadow=renderer.shadowMap.enabled,alpha=renderer.getClearAlpha();
    renderer.getClearColor(this.clear);
    try{
      scene.background=null;renderer.setClearColor(0,0);renderer.shadowMap.enabled=false;renderer.clippingPlanes=this.mirrorClip;
      renderer.setRenderTarget(this.target);renderer.render(scene,mirror);
    }finally{
      renderer.setRenderTarget(target);renderer.clippingPlanes=clipping;renderer.shadowMap.enabled=shadow;
      renderer.setClearColor(this.clear,alpha);scene.background=background;
    }
  }
}

HullWater.waveShader=waveShader;
root.SailingHullWater=HullWater;
})(typeof window==='undefined'?globalThis:window);
