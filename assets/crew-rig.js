/* Original FRI VIND clothing mesh. Skin weights blend at shoulders, elbows,
   hips, knees and cuffs. The boat's articulated pose drives the skeleton. */
(function (global) {
  'use strict';

  const limbs = [
    { start: 'hips', middle: 'knees', end: 'feet', first: .47, second: .47, girth: [.102,.117,.087,.071,.076,.042], x: .16, y: 0 },
    { start: 'shoulders', middle: 'elbows', end: 'hands', first: .32, second: .31, girth: [.063,.076,.063,.051,.053,.027], x: .19, y: .45 }
  ];
  const limit = (value, min, max) => Math.max(min, Math.min(max, value));
  const blend = value => { const t=limit(value,0,1);return t*t*(3-2*t); };
  const garmentMeshes=new Map();

  class CrewRig {
    constructor(T, material, seated) {
      this.T=T;
      this.down=new T.Vector3(0,-1,0);
      this.direction=new T.Vector3();
      this.inverse=new T.Quaternion();
      this.root=new T.Bone();
      this.upperBody=new T.Bone();
      this.upperBody.position.y=.49;
      this.root.add(this.upperBody);
      this.chain=[];
      this.bones=[this.root,this.upperBody];
      const vertices=[], colors=[], indices=[], skinIndices=[], weights=[],uv=[];
      const sides=10,stride=sides+1;
      const cached=garmentMeshes.get(seated);

      for(const limb of limbs)for(const side of [0,1]){
        const leg=limb.start==='hips';
        const first=seated?(leg?.35:.27):limb.first,second=seated?(leg?.41:.25):limb.second;
        const chain={limb,side};
        const parent=leg?this.root:this.upperBody;
        const x=limb.x*(side===0?-1:1);
        const start=this.makeBone(parent,x,leg?limb.y:limb.y-.49,0);
        const middle=this.makeBone(start,0,-first,0);
        const end=this.makeBone(middle,0,-second,0);
        Object.assign(chain,{start,middle,end,parent});
        this.chain.push(chain);
        if(cached)continue;
        const b=this.bones.indexOf(start),base=vertices.length/3,length=first+second;
        const distances=[-.025,first*.17,first*.76,first,first+second*.32,length];
        for(let row=0;row<distances.length;row++){
          const distance=distances[row];
          const hinged=blend((distance-first+.075)/.15);
          const cuff=blend((distance-length+.064)/.064);
          const waist=1-blend((distance+.025)/.12);
          for(let j=0;j<=sides;j++){
            const angle=2*Math.PI*j/sides, radius=limb.girth[row]*(1+.055*Math.cos(angle*3+row));
            vertices.push(x+Math.cos(angle)*radius,limb.y-distance,Math.sin(angle)*radius*(leg?.88:.93));
            uv.push(j/sides*1.8,distance*5);
            const panel=row===3||row===4, seam=j===2||j===7;
            const shade=(seam?.72:panel?.84:.97)+.05*Math.cos(angle+row*.45);
            colors.push(shade,shade,shade);
            skinIndices.push(b,b+1,b+2,leg?0:1);
            weights.push((1-hinged)*(1-waist),(1-cuff)*hinged,cuff,waist*(1-hinged));
          }
        }
        for(let row=0;row<distances.length-1;row++)for(let j=0;j<sides;j++){
          const a=base+row*stride+j,b=a+stride,c=a+1;
          indices.push(a,c,b,c,c+stride,b);
        }
      }
      const geometry=cached||new T.BufferGeometry();
      if(!cached){
        geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
        geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
        geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
        geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndices,4));
        geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
        geometry.setIndex(indices);geometry.computeVertexNormals();
        geometry.userData.sharedGraphics=true;
        garmentMeshes.set(seated,geometry);
      }
      this.mesh=new T.SkinnedMesh(geometry,material);
      this.mesh.name='FRI VIND · rigget sejldragt';
      this.mesh.castShadow=true;
      this.mesh.receiveShadow=true;
      this.mesh.frustumCulled=false;
      this.mesh.add(this.root);
      this.mesh.updateMatrixWorld(true);
      this.mesh.bind(new T.Skeleton(this.bones));
    }

    makeBone(parent,x,y,z){
      const bone=new this.T.Bone();
      bone.position.set(x,y,z);
      bone.visualRotation=new this.T.Quaternion();
      parent.add(bone);
      this.bones.push(bone);
      return bone;
    }

    pose(body,bodyRotation){
      const {pelvis,chest}=body;
      this.root.position.set(pelvis.x,pelvis.y,pelvis.z);
      this.root.quaternion.copy(bodyRotation);
      this.inverse.copy(bodyRotation).invert();
      this.upperBody.position.set(chest.x-pelvis.x,chest.y-pelvis.y,chest.z-pelvis.z).applyQuaternion(this.inverse);
      for(const chain of this.chain){
        const {side,limb,start,middle,end}=chain;
        const a=body[limb.start][side],b=body[limb.middle][side],c=body[limb.end][side];
        this.setBone(start,a,b,chain.parent===this.root?pelvis:chest,bodyRotation);
        this.setBone(middle,b,c,a,start.visualRotation);
        this.setBone(end,c,null,b,middle.visualRotation);
      }
    }

    setBone(bone,point,next,parentPoint,parentRotation){
      const inverse=this.inverse.copy(parentRotation).invert();
      bone.position.set(point.x-parentPoint.x,point.y-parentPoint.y,point.z-parentPoint.z).applyQuaternion(inverse);
      if(next){
        this.direction.set(next.x-point.x,next.y-point.y,next.z-point.z).normalize();
        bone.visualRotation.setFromUnitVectors(this.down,this.direction);
      }else bone.visualRotation.copy(parentRotation);
      bone.quaternion.copy(inverse).multiply(bone.visualRotation);
    }
  }

  global.SailingCrewRig=CrewRig;
})(globalThis);
