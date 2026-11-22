/* Mean flow over the sailing terrain, plus deterministic travelling gusts.
 * World x is east, y north. Bearings are the direction the wind comes from. */
(function(install){
 if(typeof module!=='undefined'&&module.exports)module.exports=install;
 else install(globalThis);
})(function(g){
  'use strict';

  const baseStep=g.ArchipelagoData?.fieldBounds?25:10;
  const CONFIG=Object.freeze({
    referenceHeight:2,maxSpeed:20,gridStep:baseStep*(g.ArchipelagoData?.horizontalScale??1),directionStep:5,maxDeficit:.78,
    terrainMemory:155,landFetch:55,edgeFade:140,seed:2647
  });
  const B=Object.freeze(g.ArchipelagoData?.fieldBounds??{minX:-1300,maxX:1300,minY:-1500,maxY:600});
  const width=1+(B.maxX-B.minX)/CONFIG.gridStep,height=1+(B.maxY-B.minY)/CONFIG.gridStep;
  const DEG=Math.PI/180,cache=new Map(),pending=new Map();
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const smooth=x=>{const n=clamp(x,0,1);return n*n*(3-2*n);};
  const mix=(a,b,t)=>a+(b-a)*t;
  const wrap=d=>((d%360)+360)%360;
  const maxHeightScale=40;
  let ground,lastDirection,lastField;

  // This is the same grove mask used to distribute the rendered trees.
  function grove(x,y){
    return .20+.80*Math.pow(.5+.5*Math.sin(x*.023+y*.019)*Math.cos(x*.012-y*.025),1.8);
  }

  function groundRaster(){
    const world=g.SailingWorld,step=CONFIG.gridStep,pad=Math.ceil(480/step)*step;
    const x0=B.minX-pad,y0=B.minY-pad,w=width+2*pad/step,h=height+2*pad/step;
    const land=new Uint8Array(w*h),relief=new Float32Array(w*h),cover=new Float32Array(w*h);
    const houses=(world.LANDMARKS||[]).filter(p=>p.kind==='house');
    for(let j=0;j<h;j++)for(let i=0;i<w;i++){
      const x=x0+i*step,y=y0+j*step,k=j*w+i;
      for(let index=0;index<world.ISLANDS.length;index++){
        const island=world.ISLANDS[index];
        if(x<island.minX||x>island.maxX||y<island.minY||y>island.maxY)continue;
        const point=world.islandSample(island,x,y);
        if(point.distance>0)continue;
        if(!land[k]||point.height>relief[k])land[k]=index+1;
        relief[k]=Math.max(relief[k],point.height);
        cover[k]=Math.max(cover[k],(island.forest||0)*grove(x,y)*1.48);
      }
      if(!land[k])continue;
      let buildings=0;
      for(const house of houses){
        const d2=(house.x-x)**2+(house.y-y)**2;
        if(d2<1764)buildings+=.26*(1-d2/1764)**2;
      }
      // Porous covers overlap as one patch of drag, never as individual screens.
      cover[k]=1-(1-clamp(cover[k],0,.8))*(1-clamp(buildings,0,.65));
    }
    return {land,relief,cover,x0,y0,w,h};
  }

  function coefficients(relief,cover,slope,fetch,breadth){
    const height=relief*.9;
    const tall=1-Math.exp(-height/13),steep=clamp(slope/.24,0,1);
    const widthFactor=1-Math.exp(-breadth/44),landFactor=1-Math.exp(-fetch/CONFIG.landFetch);
    const target=Math.min(CONFIG.maxDeficit,(.06+.67*tall+.29*cover+.08*steep)*widthFactor*landFactor);
    return {
      target,
      wakeLength:12+(height+6*cover)*(6.2+2.2*cover),
      heightScale:clamp(4+1.04*height+6*cover,5,maxHeightScale),
      mixing:clamp(.45+.52*cover+.32*steep,0,1)
    };
  }

  function coastSections(direction,startV,cols,step){
    const {dx,dy,cx,cy}=direction;
    const polygons=g.SailingWorld.ISLANDS.map((land,owner)=>{
      const points=land.points||[{x:land.minX,y:land.minY},{x:land.minX,y:land.maxY},
        {x:land.maxX,y:land.maxY},{x:land.maxX,y:land.minY}];
      return {owner:owner+1,points:points.map(p=>({u:p.x*dx+p.y*dy,v:p.x*cx+p.y*cy}))};
    });
    return Array.from({length:cols},(_,col)=>{
      const v=startV+col*step,sections=[];
      for(const {owner,points} of polygons){
        const cuts=[];
        for(let i=0;i<points.length;i++){
          const a=points[i],b=points[(i+1)%points.length];
          if((a.v>v)!==(b.v>v))cuts.push(mix(a.u,b.u,(v-a.v)/(b.v-a.v)));
        }
        cuts.sort((a,b)=>a-b);
        for(let i=0;i+1<cuts.length;i+=2)if(cuts[i+1]-cuts[i]>.01)sections.push({from:cuts[i],to:cuts[i+1],owner});
      }
      sections.sort((a,b)=>a.from-b.from);
      const merged=[];
      for(const section of sections){
        const last=merged.at(-1);
        if(!last||section.from>last.to+1e-5)merged.push(section);
        else if(section.to>last.to){last.to=section.to;last.owner=section.owner;}
      }
      return merged;
    });
  }

  function* build(direction){
    ground ||= groundRaster();
    const step=CONFIG.gridStep,rad=direction*DEG,dx=-Math.sin(rad),dy=-Math.cos(rad),cx=-dy,cy=dx;
    const corners=[[B.minX,B.minY],[B.minX,B.maxY],[B.maxX,B.minY],[B.maxX,B.maxY]];
    const along=corners.map(([x,y])=>x*dx+y*dy),across=corners.map(([x,y])=>x*cx+y*cy);
    const startU=Math.floor((Math.min(...along)-470)/step)*step,startV=Math.floor(Math.min(...across)/step)*step-3*step;
    const rows=Math.ceil((Math.max(...along)-startU)/step)+2,cols=Math.ceil((Math.max(...across)-startV)/step)+5;
    const size=rows*cols,land=new Uint8Array(size),relief=new Float32Array(size),rough=new Float32Array(size);
    const breadth=new Uint16Array(size),exposure=new Float32Array(size),scale=new Float32Array(size),eddy=new Float32Array(size);
    const sections=coastSections({dx,dy,cx,cy},startV,cols,step),shore=[];
    const sectionIndex=new Uint16Array(cols);
    for(let row=0;row<rows;row++){
      const u=startU+row*step;
      let run=0;
      for(let col=0;col<=cols;col++){
        const v=startV+col*step,k=row*cols+col;
        if(col<cols){
          const coast=sections[col];
          while(coast[sectionIndex[col]]?.to<u)sectionIndex[col]++;
          const section=coast[sectionIndex[col]];
          if(section&&section.from<=u)land[k]=section.owner;
          const i=Math.round((u*dx+v*cx-ground.x0)/step),j=Math.round((u*dy+v*cy-ground.y0)/step);
          if(land[k]&&i>=0&&i<ground.w&&j>=0&&j<ground.h){
            const p=j*ground.w+i;
            relief[k]=ground.relief[p];rough[k]=ground.cover[p];
          }
          if(land[k]){run++;continue;}
        }
        for(let n=1;n<=run;n++)breadth[k-n]=run*step;
        run=0;
      }
      if(row%8===7)yield;
    }
    const retainTerrain=Math.exp(-step/CONFIG.terrainMemory),resolutionRatio=step/baseStep;
    const retainCover=.87**resolutionRatio,retainSlope=.84**resolutionRatio,retainBreadth=.95**resolutionRatio;
    for(let col=0;col<cols;col++){
      const wakes=[];
      for(const section of sections[col]){
        if(section.to<startU-step||section.to>startU+rows*step)continue;
        let peak=0,meanCover=0,slope=0,lastRelief=0,crossWidth=0;
        const first=Math.max(0,Math.ceil((section.from-startU)/step));
        const last=Math.min(rows-1,Math.floor((section.to-startU)/step));
        for(let row=first;row<=last;row++){
          const k=row*cols+col;
          peak=Math.max(relief[k],peak*retainTerrain);
          meanCover=mix(rough[k],meanCover,retainCover);
          slope=Math.max(Math.abs(relief[k]-lastRelief)/step,slope*retainSlope);
          lastRelief=relief[k];
          crossWidth=Math.max(breadth[k],crossWidth*retainBreadth);
        }
        const wake={...section,...coefficients(peak,meanCover,slope,section.to-section.from,crossWidth)};
        if(wake.target<.01)continue;
        wakes.push(wake);
        if(wake.target>.055){
          const u=section.to,v=startV+col*step;
          shore.push({x:u*dx+v*cx,y:u*dy+v*cy,owner:section.owner,deficit:wake.target});
        }
      }
      for(let row=0;row<rows;row++){
        const k=row*cols+col,u=startU+row*step;
        let deficit=0,hScale=5,turbulence=0;
        for(const wake of wakes){
          const distance=u-wake.to;
          // Extend into the last land cell for interpolation at the shoreline.
          if(u<Math.max(wake.from,wake.to-step)||distance>=4*wake.wakeLength)continue;
          // A denser core mixes out first, followed by a weaker tail. Both
          // lengths scale with obstacle height in metres, including roughness.
          const downwind=Math.max(0,distance)/wake.wakeLength;
          const fade=(.78*Math.exp(-((downwind/.64)**1.36))+.22*Math.exp(-downwind/1.15))*(1-smooth(downwind-3));
          const loss=wake.target*fade;
          if(loss<=deficit)continue;
          deficit=loss;hScale=wake.heightScale;turbulence=wake.mixing*loss;
        }
        exposure[k]=1-deficit;
        scale[k]=hScale/maxHeightScale;
        eddy[k]=turbulence/CONFIG.maxDeficit;
      }
      if(col%4===3)yield;
    }

    const data=new Uint8Array(width*height*4);
    const cells=[exposure,scale,eddy];
    function read(a,k,along,across){
      return mix(mix(a[k],a[k+1],across),mix(a[k+cols],a[k+cols+1],across),along);
    }
    const spread=12.5/step;
    for(let j=0;j<height;j++){
      for(let i=0;i<width;i++){
        const x=B.minX+i*step,y=B.minY+j*step,k=(j*width+i)*4;
        const u=(x*dx+y*dy-startU)/step,v=(x*cx+y*cy-startV)/step;
        const row=Math.floor(u),col=Math.floor(v),left=Math.floor(v-spread),right=Math.floor(v+spread);
        const base=row*cols,along=u-row,across=v-col,leftMix=(v-spread)-left,rightMix=(v+spread)-right;
        const fade=smooth(Math.min(i,j,width-1-i,height-1-j)*step/CONFIG.edgeFade);
        for(let channel=0;channel<3;channel++){
          const a=cells[channel],raw=.5*read(a,base+col,along,across)+
            .25*(read(a,base+left,along,leftMix)+read(a,base+right,along,rightMix));
          data[k+channel]=Math.round(255*(channel===0?mix(1,raw,fade):channel===2?raw*fade:raw));
        }
        data[k+3]=255;
      }
      if(j%8===7)yield;
    }
    return {data,direction,width,height,bounds:B,shore};
  }

  function store(direction,result){
    cache.delete(direction);
    cache.set(direction,result);
    if(cache.size>8)cache.delete(cache.keys().next().value);
    return result;
  }

  function grid(direction){
    if(cache.has(direction))return store(direction,cache.get(direction));
    const job=pending.get(direction)||build(direction);
    pending.delete(direction);
    let next;
    do{next=job.next();}while(!next.done);
    return store(direction,next.value);
  }

  function prepareGrid(direction){
    if(cache.has(direction))return true;
    if(pending.has(direction))return false;
    const job=build(direction);
    pending.set(direction,job);
    const work=()=>{
      if(pending.get(direction)!==job)return;
      const deadline=performance.now()+2.5;
      let next;
      do{next=job.next();}while(!next.done&&performance.now()<deadline);
      if(!next.done){setTimeout(work,0);return;}
      pending.delete(direction);
      store(direction,next.value);
    };
    setTimeout(work,0);
    return false;
  }

  // Keep fixed-step physics and drawing on the last complete wind field
  // while slices prepare the next bearings on the main event loop.
  function prepare(direction){
    const d=wrap(direction),step=CONFIG.directionStep,lo=Math.floor(d/step)*step;
    const a=prepareGrid(lo),b=d===lo||prepareGrid(wrap(lo+step));
    return a&&b;
  }

  function field(direction){
    const d=wrap(direction);
    if(d===lastDirection)return lastField;
    const step=CONFIG.directionStep,lo=Math.floor(d/step)*step,t=(d-lo)/step;
    const a=grid(lo);
    lastDirection=d;
    lastField={a,b:t===0?a:grid(wrap(lo+step)),blend:smooth(t)};
    return lastField;
  }

  function channel(data,k,row,a,b,c){
    return mix(mix(data[k+c],data[k+c+4],a),mix(data[k+c+row],data[k+c+row+4],a),b)/255;
  }

  function terrain(x,y,direction,enabled=true,z=CONFIG.referenceHeight){
    const u=(x-B.minX)/CONFIG.gridStep,v=(y-B.minY)/CONFIG.gridStep;
    if(!enabled||u<0||v<0||u>width-1||v>height-1)return {exposure:1,turbulence:0};
    const i=Math.min(width-2,Math.floor(u)),j=Math.min(height-2,Math.floor(v));
    const k=(j*width+i)*4,row=width*4,a=u-i,b=v-j;
    const grids=field(direction),first=grids.a.data,second=grids.b.data;
    const sample=c=>{
      const value=channel(first,k,row,a,b,c);
      return first===second?value:mix(value,channel(second,k,row,a,b,c),grids.blend);
    };
    const heightScale=Math.max(5,sample(1)*maxHeightScale),vertical=Math.exp(-Math.max(0,z-CONFIG.referenceHeight)/heightScale);
    return {exposure:1-(1-sample(0))*vertical,turbulence:sample(2)*vertical};
  }

  const terms=Object.freeze([
    [.58,.023,0,0,.82,.010], [.29,.049,.012,1.8,0,0], [.13,.011,-.014,.5,0,0]
  ]);
  const seedPhase=seed=>Math.abs(Math.trunc(Number.isFinite(seed)?seed:CONFIG.seed))%6283*.001;
  function variation(along,across,phase){
    let gust=0;
    for(const [weight,x,y,bend,curve,period] of terms){
      gust+=weight*Math.sin(x*along+y*across+bend+phase+curve*Math.sin(period*across));
    }
    return gust;
  }
  function at(x,y,time,env={},height=CONFIG.referenceHeight){
    env ||= {};
    const speed=env.speed??5,direction=wrap(env.direction??0),gusts=env.gusts??.20;
    const {exposure,turbulence}=terrain(x,y,direction,env.shelter!==false,height);
    let gust=0,shift=0;
    if(gusts){
      const d=direction*DEG,sin=Math.sin(d),cos=Math.cos(d),phase=seedPhase(env.windSeed);
      const along=x*sin+y*cos+speed*.84*time,across=x*cos-y*sin;
      gust=clamp(variation(along,across,phase)+1.05*turbulence*Math.sin(.097*along-.056*across+phase),-1,1);
      shift=gusts*(7*Math.sin(.017*along+.013*across+phase)+21*turbulence*Math.sin(.072*along+.039*across+phase));
    }
    const strength=Math.max(0,speed*exposure*(1+gusts*gust)),bearing=wrap(direction+shift),a=bearing*DEG;
    return {vx:-strength*Math.sin(a),vy:-strength*Math.cos(a),speed:strength,direction:bearing,gust,exposure,meanSpeed:speed*exposure,turbulence};
  }

  // Evaluate exactly the same lookup, coordinates and travelling phases on the water.
  const fixed=n=>Number(n).toFixed(5);
  const gustShader=terms.map(([weight,x,y,bend,curve,period])=>
    `${fixed(weight)}*sin(${fixed(x)}*along+${fixed(y)}*across+${fixed(bend)}+windSeedPhase+${fixed(curve)}*sin(${fixed(period)}*across))`).join('+');
  const shader=`
    uniform sampler2D windFieldFrom,windFieldTo;
    uniform float windFieldBlend,windFieldEnabled,windSeedPhase;
    vec3 localWind(vec2 p){
      float a=windDirection*0.017453292519943,si=sin(a),co=cos(a);
      vec2 world=vec2(p.x,-p.y);
      vec2 uv=(world-vec2(${fixed(B.minX)},${fixed(B.minY)}))/vec2(${fixed(B.maxX-B.minX)},${fixed(B.maxY-B.minY)});
      vec3 terrain=vec3(1.,0.,0.);
      if(windFieldEnabled>.5&&all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){
        vec2 cell=(uv*vec2(${fixed(width-1)},${fixed(height-1)})+.5)/vec2(${fixed(width)},${fixed(height)});
        terrain=mix(texture2D(windFieldFrom,cell).rgb,texture2D(windFieldTo,cell).rgb,windFieldBlend);
      }
      float along=dot(world,vec2(si,co))+windSpeed*.84*time,across=dot(world,vec2(co,-si));
      float g=clamp(${gustShader}+1.05*terrain.b*sin(.097*along-.056*across+windSeedPhase),-1.,1.);
      float heading=a+.017453292519943*gustStrength*(7.*sin(.017*along+.013*across+windSeedPhase)+21.*terrain.b*sin(.072*along+.039*across+windSeedPhase));
      return vec3(-sin(heading),cos(heading),max(0.,windSpeed*terrain.r*(1.+gustStrength*g)));
    }
  `;
  g.SailingWind={at,terrain,field,prepare,grove,shader,seedPhase,CONFIG,bounds:B};
});
