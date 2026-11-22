/* A single orthographic view keeps the game's boat models at one scale. */
(function (global) {
  'use strict';

  function start() {
    const page=document.getElementById('boatComparison');
    const canvas=document.getElementById('comparisonSea');
    const labels=page.querySelector('.comparison-labels');
    const models=[...global.SailingBoats.LIST].sort((a,b)=>a.length-b.length);
    const slots=models.map(model=>Math.max(11,model.length+3.5));
    const span=slots.reduce((total,width)=>total+width,0);
    const meters=new Intl.NumberFormat('da-DK',{maximumFractionDigits:2});
    labels.style.gridTemplateColumns=slots.map(width=>width+'fr').join(' ');
    for(const model of models){
      const item=document.createElement('li');
      const name=document.createElement('strong');
      const length=document.createElement('span');
      name.textContent=model.name;
      length.textContent=meters.format(model.length)+' m';
      item.append(name,length);
      labels.append(item);
    }

    document.body.classList.add('boat-comparison');
    document.title='Sammenlign størrelser · TACK';
    page.hidden=false;
    const unavailable=error=>{
      canvas.hidden=true;
      document.getElementById('comparisonError').hidden=false;
      console.error(error);
    };
    try{
      const T=global.THREE,P=global.SailPhysics;
      const scene=new global.SailingScene(T,canvas,P,'low',{comparison:true});
      const north=-10000;
      const env={speed:5,direction:180,waves:0,waveHeight:0,chop:0,gusts:0,shelter:false,difficulty:'hard'};
      let left=-span/2;
      for(const [i,model] of models.entries()){
        const actor=scene.createBoatActor(model.id);
        const state=P.createState({boatId:model.id,x:left+slots[i]/2,y:north,theta:Math.PI,vx:0,vy:0,sheet:.86,crewPose:1},env);
        actor.updateBoat(state,env,1/60);
        left+=slots[i];
      }

      const top=Math.max(...models.map(model=>model.mastHeight))+3;
      const bottom=-3.5;
      page.style.setProperty('--comparison-aspect',span/(top-bottom));
      scene.camera=new T.OrthographicCamera(-span/2,span/2,top,bottom,.1,1500);
      scene.camera.position.set(0,17.5,-north+60);
      scene.camera.lookAt(0,0,-north);
      scene.sky.position.set(0,0,-north);
      scene.water.position.set(0,0,-north);
      const water=scene.waterUniforms;
      water.sea.value=water.windWaveScale.value=0;
      water.waveShelterEnabled.value=water.windFieldEnabled.value=0;
      water.waterDetail.value=1;
      water.seaRipples.value=.8;
      scene.renderer.setPixelRatio(Math.min(global.devicePixelRatio||1,1.5));

      const draw=()=>{
        scene.renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
        scene.render();
        page.dataset.ready='true';
      };
      scene.skyPhotoReady.then(()=>{
        scene.sky.material.uniforms.photoMix.value=scene.skyPhotoLoaded ? .25 : 0;
        draw();
        new ResizeObserver(draw).observe(canvas);
      }).catch(unavailable);
    }catch(error){unavailable(error);}
  }

  global.SailingComparison={start};
})(globalThis);
