/* Shared bathymetry and accumulated wave phase along incoming rays.
 * World x=east, y=north. */
(function(install){
 if(typeof module!=='undefined'&&module.exports)module.exports=install;
 else install(globalThis);
})(function(root){
  'use strict';
  const metricBounds=root.ArchipelagoData?.fieldBounds;
  const bounds=Object.freeze(metricBounds??{minX:-1300,maxX:1300,minY:-1500,maxY:600});
  const resolution=metricBounds?20*(root.ArchipelagoData.horizontalScale??1):10;
  const width=1+Math.ceil((bounds.maxX-bounds.minX)/resolution),height=1+Math.ceil((bounds.maxY-bounds.minY)/resolution),minDepth=-8,span=48;
  const stepX=(bounds.maxX-bounds.minX)/(width-1),stepY=(bounds.maxY-bounds.minY)/(height-1);
  const open={depth:minDepth+span,dx:0,dy:0};
  let grid;
  function data(){
    if(grid)return grid;
    const baked=root.TackArchipelagoFields?.depth;
    if(baked?.length===width*height*4)return (grid=baked);
    if(root.TackArchipelagoFields)throw Error('Produktionsbuildets dybdegitter har forkerte dimensioner.');
    grid=new Uint8Array(width*height*4);
    for(let j=0;j<height;j++)for(let i=0;i<width;i++){
      const d=-root.SailingWorld.heightAt(bounds.minX+i*stepX,bounds.minY+j*stepY);
      const edge=Math.min(i,j,width-1-i,height-1-j)/5;
      const t=Math.min(1,edge),blend=t*t*(3-2*t);
      const value=Math.round(65535*((1-blend)+blend*Math.max(0,Math.min(1,(d-minDepth)/span))));
      const k=(j*width+i)*4;
      grid[k]=value>>8;grid[k+1]=value&255;grid[k+3]=255;
    }
    return grid;
  }
  function sample(x,y){
    const u=(x-bounds.minX)/stepX,v=(y-bounds.minY)/stepY;
    if(u<0||v<0||u>width-1||v>height-1)return open;
    const i=Math.min(width-2,Math.floor(u)),j=Math.min(height-2,Math.floor(v));
    const a=u-i,b=v-j,bytes=data(),k=(j*width+i)*4,row=width*4;
    const read=i=>minDepth+span*(bytes[i]*256+bytes[i+1])/65535;
    const f=read(k),g=read(k+4),h=read(k+row),l=read(k+row+4);
    return {depth:(f*(1-a)+g*a)*(1-b)+(h*(1-a)+l*a)*b,dx:((g-f)*(1-b)+(l-h)*b)/stepX,dy:((h-f)*(1-a)+(l-g)*a)/stepY};
  }
  const damp=(depth,limit)=>{
    const q=Math.max(0,Math.min(1,depth/limit));
    return {value:q*q*(3-2*q),slope:6*q*(1-q)/limit};
  };
  const gravity=9.82,phaseRange=1024,breakingRatio=.68,breakingOnset=.6;
  // Smooth saturation of the combined significant height above a shoal.
  // The derivative is with respect to Hs / (breakingRatio * depth).
  function breakingLimit(ratio){
    if(ratio<=breakingOnset)return {gain:1,derivative:0};
    const span=1-breakingOnset,tail=span/(span+ratio-breakingOnset);
    const gain=(1-span*tail)/ratio;
    return {gain,derivative:(tail*tail-gain)/ratio};
  }
  // Invert omega²=g*k*tanh(k*h). The polynomial gives a close initial k in
  // intermediate depth as well as the deep- and shallow-water limits.
  function waveNumber(deepK,depth){
    const h=Math.max(1e-6,depth),x=deepK*h;
    if(x>=5)return deepK;
    const polynomial=1+x*(.66667+x*(.35550+x*(.16085+x*(.06321+x*(.02175+x*.00654)))));
    return Math.sqrt(x*x+x/polynomial)/h;
  }
  function phaseVelocity(wavelength,depth){
    const k=2*Math.PI/wavelength;
    return Math.sqrt(gravity/k*Math.tanh(k*Math.max(0,depth)));
  }
  function waveGain(depth,limit,deepK){
    if(depth<=0)return 0;
    const bottom=damp(depth,limit).value;
    if(depth*deepK>=5)return bottom;
    const k=waveNumber(deepK,depth),relativeDepth=2*k*depth;
    const groupRatio=deepK/k*(1+relativeDepth/Math.sinh(relativeDepth));
    return bottom*Math.min(1.55,1/Math.sqrt(groupRatio));
  }
  const pathWidth=1+Math.ceil((width-1)/2),pathHeight=1+Math.ceil((height-1)/2);
  const pathStepX=(bounds.maxX-bounds.minX)/(pathWidth-1),pathStepY=(bounds.maxY-bounds.minY)/(pathHeight-1);
  const paths=new Map();
  let pathDepth;
  const roundBearing=angle=>((Math.round(angle/10)*10)%360+360)%360;
  const roundPeriod=period=>Math.max(.75,Math.round(period*4)/4);
  function pathField(longBearing,shortBearing,longPeriod,shortPeriod){
    const signatures=[[roundBearing(longBearing),roundPeriod(longPeriod)],[roundBearing(shortBearing),roundPeriod(shortPeriod)]];
    const key=signatures.flat().join(':');
    if(paths.has(key))return paths.get(key);
    if(!pathDepth){
      pathDepth=new Float32Array(pathWidth*pathHeight);
      for(let j=0;j<pathHeight;j++)for(let i=0;i<pathWidth;i++)
        pathDepth[j*pathWidth+i]=sample(bounds.minX+i*pathStepX,bounds.minY+j*pathStepY).depth;
    }
    const bytes=new Uint8Array(pathWidth*pathHeight*4),travel=new Float32Array(pathWidth*pathHeight);
    for(const [band,[bearing,period]] of signatures.entries()){
      const angle=bearing*Math.PI/180,fx=-Math.sin(angle),fy=-Math.cos(angle);
      const alongX=Math.abs(fx)/pathStepX>=Math.abs(fy)/pathStepY;
      const along=alongX?fx:fy,across=alongX?fy:fx,sign=Math.sign(along);
      const rows=alongX?pathWidth:pathHeight,columns=alongX?pathHeight:pathWidth;
      const distance=(alongX?pathStepX:pathStepY)/Math.abs(along),shift=distance*across/(alongX?pathStepY:pathStepX);
      const index=(i,j)=>alongX?i+j*pathWidth:j+i*pathWidth;
      const deepK=(2*Math.PI/period)**2/gravity,indices=new Float32Array(401);
      for(let i=1;i<indices.length;i++)indices[i]=waveNumber(deepK,Math.max(.6,i*.1))/deepK-1;
      for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
        const i=sign>0?row:rows-1-row,k=index(i,col),d=pathDepth[k];
        const previous=col-shift,a=Math.floor(previous),weight=previous-a;
        let upstream=0;
        if(row&&a>=0&&a<columns-1)upstream=travel[index(i-sign,a)]*(1-weight)+travel[index(i-sign,a+1)]*weight;
        const excess=d>0?indices[Math.min(400,Math.max(1,Math.round(d*10)))]:0;
        // Stop the incoming ray across land. Energy leaking around a
        // headland is already reduced by the shared directional exposure.
        travel[k]=d>0?upstream+distance*excess:0;
        const edge=Math.min(i,col,rows-1-i,columns-1-col),t=Math.min(1,edge/8);
        const value=Math.round(65535*Math.min(1,travel[k]*t*t*(3-2*t)/phaseRange));
        bytes[k*4+band*2]=value>>8;bytes[k*4+band*2+1]=value&255;
      }
    }
    const result={key,data:bytes,width:pathWidth,height:pathHeight};
    paths.set(key,result);
    if(paths.size>8)paths.delete(paths.keys().next().value);
    return result;
  }
  const flatPath={v:0,dx:0,dy:0};
  function samplePath(field,x,y,band){
    const u=(x-bounds.minX)/pathStepX,v=(y-bounds.minY)/pathStepY;
    if(u<0||v<0||u>pathWidth-1||v>pathHeight-1)return flatPath;
    const i=Math.min(pathWidth-2,Math.floor(u)),j=Math.min(pathHeight-2,Math.floor(v));
    const a=u-i,b=v-j,bytes=field.data,k=(j*pathWidth+i)*4+band*2,row=pathWidth*4;
    const f=bytes[k]*256+bytes[k+1],g=bytes[k+4]*256+bytes[k+5];
    const h=bytes[k+row]*256+bytes[k+row+1],l=bytes[k+row+4]*256+bytes[k+row+5],scale=phaseRange/65535;
    return {v:((f*(1-a)+g*a)*(1-b)+(h*(1-a)+l*a)*b)*scale,
      dx:((g-f)*(1-b)+(l-h)*b)*scale/pathStepX,dy:((h-f)*(1-a)+(l-g)*a)*scale/pathStepY};
  }
  const shaderOrigin=[bounds.minX,bounds.minY].map(value=>value.toFixed(3)).join(',');
  const shaderExtent=[bounds.maxX-bounds.minX,bounds.maxY-bounds.minY].map(value=>value.toFixed(3)).join(',');
  const shader=`
    uniform sampler2D bathymetryMap;
    float seaDepth(vec2 p){
      vec2 uv=(vec2(p.x,-p.y)-vec2(${shaderOrigin}))/vec2(${shaderExtent});
      if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 40.;
      vec2 value=texture2D(bathymetryMap,(uv*vec2(${width-1}.0,${height-1}.0)+.5)/vec2(${width}.0,${height}.0)).rg;
      return -8.+48.*dot(value,vec2(256./257.,1./257.));
    }
    vec2 wavePath(sampler2D tex,vec2 p){
      vec2 uv=(vec2(p.x,-p.y)-vec2(${shaderOrigin}))/vec2(${shaderExtent});
      if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return vec2(0.);
      vec4 value=texture2D(tex,(uv*vec2(${pathWidth-1}.0,${pathHeight-1}.0)+.5)/vec2(${pathWidth}.0,${pathHeight}.0));
      return ${phaseRange}.0*vec2(dot(value.rg,vec2(256./257.,1./257.)),dot(value.ba,vec2(256./257.,1./257.)));
    }
    float shallowWaveGain(float d,float limit,float deepK){
      if(d<=0.)return 0.;
      float bottom=smoothstep(0.,limit,d),h=max(.000001,d),x=deepK*h;
      if(x>=5.)return bottom;
      float polynomial=1.+x*(.66667+x*(.35550+x*(.16085+x*(.06321+x*(.02175+x*.00654)))));
      float k=sqrt(x*x+x/polynomial)/h,relativeDepth=2.*k*d;
      float groupRatio=deepK/k*(1.+relativeDepth/max(.000001,.5*(exp(relativeDepth)-exp(-relativeDepth))));
      return bottom*min(1.55,inversesqrt(groupRatio));
    }
    vec2 breakingLimit(float ratio){
      const float span=${(1-breakingOnset).toFixed(2)};
      float tail=span/(span+ratio-${breakingOnset});
      float gain=(1.-span*tail)/ratio;
      return vec2(gain,(tail*tail-gain)/ratio);
    }
  `;
  root.SailingWaterDepth={data,sample,damp,width,height,shader,waveNumber,phaseVelocity,waveGain,pathField,samplePath,
    breakingLimit,breakingRatio,breakingOnset,swellDepth:2.4,chopDepth:1.4};
});
