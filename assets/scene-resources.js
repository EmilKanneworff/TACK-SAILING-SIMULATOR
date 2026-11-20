/* Shared geometry and textures. The embedded sources also load from file://. */
(function (global) {
  'use strict';

  let resources;
  let crew;
  const sailWeaves=new Map();
  const share = asset => { asset.userData.sharedGraphics = true; return asset; };

  function textures(T){
    if(resources)return resources;
    const maps={},pending=[];
    const sources={...global.FRI_VIND_SURFACES,daylight:global.FRI_VIND_SKY_PHOTO};
    const loader=new T.TextureLoader();
    for(const [name,source] of Object.entries(sources)){
      pending.push(new Promise((resolve,reject)=>{
        const map=maps[name]=share(loader.load(source,resolve,undefined,()=>reject(Error(`Kunne ikke indlæse grafikressourcen ${name}.`))));
        map.colorSpace=name==='fabricNormal'?T.NoColorSpace:T.SRGBColorSpace;
        map.wrapS=T.RepeatWrapping;
        if(name==='daylight'||name==='overcast')map.mapping=T.EquirectangularReflectionMapping;
        else{map.wrapT=T.RepeatWrapping;map.anisotropy=4;}
      }));
    }
    resources={maps,ready:Promise.all(pending)};
    resources.ready.catch(()=>{});
    return resources;
  }

  function geometryFromGlb(T){
    // The local GLB contains only tightly packed float positions and u16
    // indices. Its deliberate subset needs no remote loader or decoder.
    const bytes=Uint8Array.from(global.atob(global.FRI_VIND_HUMAN_GLB),letter=>letter.charCodeAt(0));
    const header=new DataView(bytes.buffer),jsonLength=header.getUint32(12,true),binaryOffset=28+jsonLength;
    if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==bytes.length)throw Error('Besætningens GLB er ugyldig.');
    const gltf=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+jsonLength)));
    const get=(id,type,component,count)=>{
      const accessor=gltf.accessors[id],view=gltf.bufferViews[accessor.bufferView];
      if(accessor.componentType!==component)throw Error('Uventet attributtype i besætningens GLB.');
      return new type(bytes.buffer,binaryOffset+(view.byteOffset||0)+(accessor.byteOffset||0),accessor.count*count);
    };
    return Object.fromEntries(gltf.meshes.map(mesh=>{
      const [primitive]=mesh.primitives;
      const geometry=new T.BufferGeometry();
      const position=get(primitive.attributes.POSITION,Float32Array,5126,3);
      geometry.setAttribute('position',new T.BufferAttribute(position,3));
      geometry.setIndex(new T.BufferAttribute(get(primitive.indices,Uint16Array,5123,1),1));
      if(mesh.name.startsWith('head')){
        const colors=[];
        for(let i=0;i<position.length;i+=3){
          const [x,y,z]=[position[i],position[i+1],position[i+2]];
          const front=z>.066;
          const lip=front?Math.exp(-((y+.036)**2/.000045+x*x/.0011))*.21:0;
          const brow=front?Math.exp(-((y-.025)**2/.00010+(Math.abs(x)-.033)**2/.00024))*.20:0;
          const chin=Math.max(0,-y-.07)*1.8;
          colors.push(1-brow-chin,1-lip-brow-chin,1-lip*.96-brow-chin);
        }
        geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      }
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      return [mesh.name,share(geometry)];
    }));
  }

  function profile(T,rings,point){
    const vertices=[],colors=[],indices=[],uv=[],sides=20;
    for(let row=0;row<rings.length;row++)for(let side=0;side<=sides;side++){
      const angle=side/sides*Math.PI*2;
      const {position,shade}=point(rings[row],angle);
      vertices.push(...position);colors.push(...shade);uv.push(side/sides,row/(rings.length-1));
      if(row&&side){const a=(row-1)*(sides+1)+side-1,b=a+sides+1;indices.push(a,b,a+1,a+1,b,b+1);}
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    return share(geometry);
  }

  function crewGeometry(T){
    if(crew)return crew;
    crew=geometryFromGlb(T);
    crew.vest=profile(T,[[-.49,.08,.058],[-.43,.145,.087],[-.26,.167,.103],[-.12,.168,.111],[.07,.184,.129],
      [.22,.198,.12],[.34,.180,.108],[.44,.128,.090],[.51,.070,.060]],([y,width,depth],a)=>{
      const x=width*Math.cos(a),z=depth*Math.sin(a),front=Math.max(0,Math.sin(a));
      const pad=front*Math.min(1,Math.abs(x)*24)*.030*Math.max(0,1-Math.abs(y-.06)*1.8);
      const hem=y<-.30?.34:1,fold=1-.09*Math.pow(Math.sin(y*30+x*11),4);
      const shade=hem*fold*(.83+.17*front);
      return {position:[x,y,z+pad],shade:[shade,shade,shade]};
    });
    crew.boot=profile(T,[[-.097,.002,.019],[-.082,.036,.043],[-.035,.047,.054],[.026,.041,.060],[.087,.032,.053],[.113,.020,.032],[.125,.001,.003]],
      ([x,rise,width],a)=>{
        const y=.006+rise*Math.cos(a),z=-width*Math.sin(a),s=y<-.019?.35:.76+.15*Math.cos(a);
        return {position:[x,Math.max(-.038,y),z],shade:[s,s,s]};
      });
    return crew;
  }

  function groundMaterial(T,maps){
    const material=new T.MeshStandardMaterial({vertexColors:true,envMapIntensity:.20,roughness:.96,side:T.DoubleSide});
    material.onBeforeCompile=shader=>{
      for(const key of ['sand','grass','earth','stone'])shader.uniforms['site_'+key]={value:maps[key]};
      shader.vertexShader='varying vec3 sitePosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n sitePosition=(modelMatrix*vec4(position,1.)).xyz;');
      shader.fragmentShader=`varying vec3 sitePosition;
        uniform sampler2D site_sand,site_grass,site_earth,site_stone;
        ${shader.fragmentShader}`.replace('#include <map_fragment>',`
        float siteDistance=distance(cameraPosition,sitePosition);
        if(siteDistance<950.){
          vec2 site=sitePosition.xz;
          float macro=sin(site.x*.088+sin(site.y*.071))*cos(site.y*.064-site.x*.027);
          float coast=smoothstep(.17,2.55,sitePosition.y+macro*.61);
          vec3 rockNormal=normalize(cross(dFdx(sitePosition),dFdy(sitePosition)));
          float rocks=smoothstep(.16,.61,1.-abs(rockNormal.y))*smoothstep(.25,1.6,sitePosition.y);
          float wet=1.-smoothstep(.07,.52,sitePosition.y);
          vec3 sand=texture2D(site_sand,site/5.5).rgb*mix(1.,.63,wet);
          vec3 grass=texture2D(site_grass,site/9.3).rgb;
          vec3 soil=texture2D(site_earth,site/7.6).rgb;
          vec3 stone=texture2D(site_stone,site/5.2).rgb;
          vec3 photographic=mix(sand,mix(grass,soil,smoothstep(.18,.83,macro)*.48),coast);
          photographic=mix(photographic,stone,.78*rocks);
          diffuseColor.rgb=mix(diffuseColor.rgb,photographic*1.26,.78*(1.-smoothstep(230.,950.,siteDistance)));
        }
      `);
    };
    return material;
  }

  function sailWeave(T,width,height){
    const across=Math.max(1,Math.round(width*2.7)),along=Math.max(1,Math.round(height*2.7));
    const key=across+'x'+along;
    if(!sailWeaves.has(key)){
      const weave=share(textures(T).maps.fabricNormal.clone());
      weave.repeat.set(across,along);
      sailWeaves.set(key,weave);
    }
    return sailWeaves.get(key);
  }

  function timberBox(T,length,height,width){
    const geometry=new T.BoxGeometry(length,height,width),{position,normal,uv}=geometry.attributes;
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      const end=Math.abs(normal.getX(i))>.5,top=Math.abs(normal.getY(i))>.5;
      uv.setXY(i,(end?z:x)/2.4,(top?z:y)/.85);
    }
    return geometry;
  }

  global.SailingGraphics={textures,crewGeometry,groundMaterial,sailWeave,timberBox};
})(globalThis);
