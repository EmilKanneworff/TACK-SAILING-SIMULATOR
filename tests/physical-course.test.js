'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
test.use({launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']}});

const scenarios=[
 ['laser','gates','short'],['laser','gates','long'],
 ['laser','triangle','short'],['laser','triangle','long'],
 ['dinghy','triangle','short'],['yacht','triangle','short'],
 ['laser','gates','island']
];

for(const [boatId,type,variant] of scenarios){
 test(`${boatId} physically sails ${type} ${variant} with steering and trim`,async({page})=>{
  test.setTimeout(180000);
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.waitForFunction(()=>window.SAILING_GAME);
  await page.addScriptTag({path:'scripts/course-pilot.js'});
  const result=await page.evaluate(({boatId,type,variant})=>{
   const P=SailPhysics,env={...SAILING_GAME.env,boatId,speed:7,direction:0,waves:0,gusts:0,difficulty:'easy',courseType:type,courseVariant:variant};
   const editor=FriVindCourseEditorModel,island=variant==='island';
   let course;
   if(island){
    const marks=[
     {id:'west',label:'Vest',x:45,y:-285},
     {id:'south',label:'Syd',x:170,y:-500},
     {id:'east',label:'Øst',x:390,y:-465},
     {id:'northeast',label:'Nordøst',x:385,y:-280},
     {id:'north',label:'Nord',x:140,y:-160}
    ];
    const draft={version:1,map:editor.MAP,id:'bjorno',name:'Rundt om Bjørnø',
     weather:{direction:0,speed:7},template:type,
     start:{a:{x:60,y:-190},b:{x:110,y:-190},normal:{x:0,y:-1}},
     finish:{a:{x:72,y:-186},b:{x:72,y:-134},normal:{x:-1,y:0}},marks,
     route:marks.map(mark=>({kind:'round',side:'port',markIds:[mark.id]}))
    };
    const issues=editor.validate(draft,(x,y)=>SailingWorld.heightAt(x,y)+1);
    if(issues.length)throw Error(issues[0].message);
    course=editor.compile(draft,SailingCourse.geometry.rounding,SailingBoats.get(boatId));
   }
   const race=new SailingCourse(env,'course',type,course);
   const state=P.createState({...race.model.spawn,boatId,vx:0,vy:0},env);
   const pilot=FriVindCoursePilot(race,env.direction,{retry:true}),dt=1/60,events=[],log=[];
   race.beginCountdown(0,state);
   let landContacts=0,recoveries=0;
   const limitSeconds=boatId==='yacht'?3000:1500;
   for(let tick=1;tick<=limitSeconds/dt&&!race.finished;tick++){
    const now=tick*dt*1000;
    const previous={...state};
    P.step(state,pilot.control(state,now),env,dt);
    if(state.ground?.contact&&!previous.ground?.contact)landContacts++;
    if(state.capsized||state.recovering){
     if(SailingRecovery.update(state,env,now).started)recoveries++;
    }
    events.push(...race.update(previous,state,dt,{nowMs:now,discontinuity:state.recovering||previous.recovering}));
    if(tick%3600===0)log.push({time:now/1000,visit:race.index,x:Math.round(state.x),y:Math.round(state.y),...pilot.status()});
    if(!Number.isFinite(state.x))break;
   }
   return {finished:race.finished,time:race.time,visits:race.index,landContacts,recoveries,log,
    events:events.filter(event=>['start','mark','finish'].includes(event.type)).map(event=>event.type)};
  },{boatId,type,variant});
  console.log('PHYSICAL COURSE',JSON.stringify({boatId,type,variant,...result}));
  expect(result.finished,JSON.stringify(result.log)).toBe(true);
  expect(result.landContacts).toBe(0);
  expect(result.events.filter(event=>event==='mark')).toHaveLength(result.visits-1);
  expect(result.events.at(-1)).toBe('finish');
 });
}
