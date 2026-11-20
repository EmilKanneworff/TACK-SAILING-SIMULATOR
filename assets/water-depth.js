/* Shared static bathymetry used to damp waves at the waterline. World x=east, y=north. */
(function (root) {
  'use strict';
  const metricBounds=root.ArchipelagoData?.fieldBounds;
  const bounds=Object.freeze(metricBounds??{minX:-1300,maxX:1300,minY:-1500,maxY:600});
  const resolution=metricBounds?20:10;
  const width=1+Math.ceil((bounds.maxX-bounds.minX)/resolution),height=1+Math.ceil((bounds.maxY-bounds.minY)/resolution),minDepth=-8,span=48;
  const stepX=(bounds.maxX-bounds.minX)/(width-1),stepY=(bounds.maxY-bounds.minY)/(height-1);
  const open={depth:minDepth+span,dx:0,dy:0};
  let grid;
  function data(){
    if(grid)return grid;
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
  const shader=`
    uniform sampler2D bathymetryMap;
    float seaDepth(vec2 p){
      vec2 uv=(vec2(p.x,-p.y)-vec2(${bounds.minX}.0,${bounds.minY}.0))/vec2(${bounds.maxX-bounds.minX}.0,${bounds.maxY-bounds.minY}.0);
      if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 40.;
      vec2 value=texture2D(bathymetryMap,(uv*vec2(${width-1}.0,${height-1}.0)+.5)/vec2(${width}.0,${height}.0)).rg;
      return -8.+48.*dot(value,vec2(256./257.,1./257.));
    }
  `;
  root.SailingWaterDepth={data,sample,damp,width,height,shader,swellDepth:2.4,chopDepth:1.4};
})(globalThis);
