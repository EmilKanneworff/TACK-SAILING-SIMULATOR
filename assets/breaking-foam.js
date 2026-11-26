/* Short-lived foam patches emitted from steep or depth-limited wave crests. */
(function(root){
  'use strict';
  const LIMIT=80;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const smooth=x=>{const q=clamp(x,0,1);return q*q*(3-2*q);};
  function hash(x,y){const h=Math.sin(x*127.1+y*311.7)*43758.5453;return h-Math.floor(h);}
  class BreakingFoam{
    constructor(scene){
      this.scene=scene;
      const T=scene.T,geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(LIMIT*18),3).setUsage(T.DynamicDrawUsage));
      geometry.setAttribute('shape',new T.BufferAttribute(new Float32Array(LIMIT*24),4).setUsage(T.DynamicDrawUsage));
      const material=new T.ShaderMaterial({uniforms:scene.waterUniforms,side:T.DoubleSide,transparent:true,depthWrite:false,
        vertexShader:`uniform float time,sea;attribute vec4 shape;varying vec4 foamShape;varying float distanceToEye;${scene.waveShader}
          ${root.SailingHullWater.waveShader}
          void main(){foamShape=shape;vec4 p=modelMatrix*vec4(position,1.);p.y=wave(p.xz).x+contactWave(p.xz).x+.033;
          distanceToEye=distance(cameraPosition,p.xyz);gl_Position=projectionMatrix*viewMatrix*p;}`,
        fragmentShader:`uniform float fogDensity;varying vec4 foamShape;varying float distanceToEye;
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float cells(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
          void main(){float specks=cells(foamShape.xy*vec2(12.,7.)+foamShape.w);
            float edge=1.-smoothstep(.42,.96,length(foamShape.xy)+.23*(specks-.5));
            float holes=smoothstep(.28,.72,specks);
            float alpha=edge*holes*foamShape.z*exp(-pow(distanceToEye*fogDensity,2.));
            gl_FragColor=vec4(vec3(.68,.79,.73)*(.84+.16*specks),alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`});
      this.mesh=scene.mesh(geometry,material);
      this.mesh.name='World-space breaking wave foam';
      this.mesh.frustumCulled=false;this.mesh.renderOrder=2;
      this.patches=[];this.recent=new Map();this.last=-Infinity;this.index=0;
      geometry.setDrawRange(0,0);
    }
    impact(hit,time,energy){
      if(this.patches.length>=LIMIT)return;
      this.patches.push({x:hit.x,y:hit.y,time,life:1.1+Math.min(.8,energy),length:.28+energy*.52,width:.18+energy*.32,
        angle:Math.atan2(hit.dirX,hit.dirY),noise:time*21,strength:clamp(energy*.48,.13,.68),vx:hit.driftX,vy:hit.driftY});
    }
    update(state,env,reset){
      const time=state.time,scene=this.scene,P=scene.P;
      if(reset||time<this.last){this.patches.length=0;this.recent.clear();this.last=-Infinity;this.index=0;}
      this.patches=this.patches.filter(p=>time-p.time<p.life);
      const windSea=(env.chop??0)>.3&&(env.speed??0)>.15;
      if(scene.graphicsProfile.ambientFoam&&time-this.last>(.14+.13*scene.cpuDetail)&&(state.seaState>.14||windSea)){
        this.last=time;
        const step=3.8,ix=Math.round(state.x/step),iy=Math.round(state.y/step);
        const radius=scene.graphicsProfile.id==='balanced'?9:13;
        const lane=this.index++%3;
        for(const [key,t] of this.recent)if(time-t>5)this.recent.delete(key);
        for(let j=-radius;j<=radius;j++)for(let i=-radius;i<=radius;i++){
          if((i+j+3*radius)%3!==lane||i*i+j*j>radius*radius)continue;
          const u=ix+i,v=iy+j,random=hash(u,v);
          if(random>.58||this.patches.length>=LIMIT)continue;
          const key=u+','+v;
          if(time-(this.recent.get(key)??-100)<2.9)continue;
          const x=step*(u+random*.53),y=step*(v+hash(v,u)*.53),depth=root.SailingWaterDepth.sample(x,y).depth;
          if(depth<=.30)continue;
          const wave=P.waveAt(x,y,time,env);
          if(wave.height<.075||wave.curvature<.020)continue;
          const slope=Math.hypot(wave.dx,wave.dy);
          const coast=depth<2.8&&wave.height>.20*depth&&slope>.070;
          const crest=wave.height>.20&&wave.curvature>.036&&slope>.14;
          const smallCrest=windSea&&wave.curvature>.13&&slope>.13;
          if(!coast&&!crest&&!smallCrest)continue;
          const wind=P.windAt(x,y,time,env);
          const shortPatch=!coast&&!crest;
          if(!coast&&wind.speed<(shortPatch?10:7.5))continue;
          const strength=coast?.61:clamp((slope-.122)*3.7,.19,.72);
          const size=shortPatch?.55:1;
          this.recent.set(key,time);
          this.patches.push({x,y,time,life:(1.6+random*2.2)*(.65+.35*size),length:(1.05+random*.98+strength*.7)*size,width:(.23+random*.25)*size,
            angle:Math.atan2(wave.dx,wave.dy)+(random-.5)*.22,noise:random*81,strength,vx:.29*wave.waterVx+.010*wind.vx,vy:.29*wave.waterVy+.010*wind.vy});
        }
      }
      const g=this.mesh.geometry,pos=g.attributes.position.array,shape=g.attributes.shape.array;
      let vertex=0;
      for(const p of this.patches){
        const age=time-p.time,progress=age/p.life;
        const alpha=p.strength*smooth(age/.17)*(1-smooth(progress));
        const x=p.x+age*p.vx,y=p.y+age*p.vy,w=p.width*(1+progress*.85),l=p.length*(1+progress*.43);
        const si=Math.sin(p.angle),co=Math.cos(p.angle),ox=co*l,oy=-si*l,tx=si*w,ty=co*w;
        for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){
          pos[3*vertex]=x+u*ox+v*tx;pos[3*vertex+1]=0;pos[3*vertex+2]=-(y+u*oy+v*ty);
          shape[4*vertex]=u;shape[4*vertex+1]=v;shape[4*vertex+2]=alpha;shape[4*vertex+3]=p.noise;
          vertex++;
        }
      }
      g.setDrawRange(0,vertex);
      g.attributes.position.needsUpdate=g.attributes.shape.needsUpdate=true;
    }
  }
  root.SailingBreakingFoam=BreakingFoam;
})(globalThis);
