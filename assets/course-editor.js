(() => {
'use strict';

const model=globalThis.FriVindCourseEditorModel;
const $=id=>document.getElementById(id);
const storageKey='fri-vind.courses.v2';
const steps={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,5],ArrowDown:[0,-5]};
const degrees=(x,y)=>(Math.atan2(x,y)*180/Math.PI+360)%360;
const id=()=>globalThis.crypto?.randomUUID?.()||String(Date.now());

class CourseEditor {
  constructor(bridge){
    this.bridge=bridge;
    this.library=[];
    this.history=[];
    try{
      const data=JSON.parse(localStorage.getItem(storageKey));
      const older=JSON.parse(localStorage.getItem('fri-vind.course.v1'));
      const records=Array.isArray(data?.courses)?data.courses:older?[older]:[];
      this.library=records.filter(course=>!model.validate(course).length).map(model.onCurrentMap);
      this.saved=this.library.find(course=>course.id===data?.selected)||this.library[0];
    }catch{}
    this.chart=new SailingMap($('editorMap'),{keepView:true,staticView:true,onWorldClick:p=>this.place(p)});
    $('editorWind').oninput=()=>this.windLabel();
    $('editorDraft').onclick=()=>this.suggest();
    $('editorBlank').onclick=()=>this.blank();
    $('editorNew').onclick=()=>this.setup();
    $('editorPoint').onchange=()=>this.draw();
    $('editorVisit').onchange=()=>this.draw();
    $('editorName').oninput=()=>{this.draft.name=$('editorName').value;this.draw();};
    $('editorSave').onclick=()=>this.save();
    $('editorUndo').onclick=()=>this.undo();
    $('editorRotate').onclick=()=>this.rotate();
    $('editorAddMark').onclick=()=>this.addMark();
    $('editorAddRound').onclick=()=>this.addVisit(false);
    $('editorAddGate').onclick=()=>this.addVisit(true);
    $('editorSide').onclick=()=>this.editVisit('side');
    $('editorUp').onclick=()=>this.editVisit(-1);
    $('editorDown').onclick=()=>this.editVisit(1);
    $('editorRemoveVisit').onclick=()=>this.editVisit('remove');
    $('editorOpenSaved').onclick=()=>this.openSaved();
    $('editorDuplicate').onclick=()=>this.duplicate();
    $('editorExport').onclick=()=>this.export();
    $('editorImport').onchange=event=>this.import(event.currentTarget.files[0]);
    $('editorMap').addEventListener('keydown',event=>{
      const delta=steps[event.key],item=this.selected();
      if(!delta||!item?.point||item.point.x===null)return;
      event.preventDefault();
      event.stopPropagation();
      this.place({x:item.point.x+delta[0],y:item.point.y+delta[1]});
    });
  }
  setup(focus=true){
    if(this.rotation){this.draft=this.rotation;this.rotation=null;}
    $('editorWindSetup').hidden=false;
    $('editorPlacement').hidden=true;
    $('editorWind').value=this.draft?.weather.direction??this.bridge.env().direction;
    this.windLabel();
    if(focus)$('editorWind').focus();
  }
  open(){
    $('editorSave').textContent=this.bridge.guest()?'Gem lokalt':'Gem og vælg banen';
    this.updateLibrary();
    if(this.draft||this.saved){
      this.draft??=model.clone(this.saved);
      this.layout();
    }else this.setup(false);
  }
  windLabel(){
    const direction=Number($('editorWind').value),name=['N','NØ','Ø','SØ','S','SV','V','NV'][Math.round(direction/45)%8];
    $('editorBearing').value=name+' · '+direction+'°';
    $('editorWind').setAttribute('aria-valuetext',$('editorBearing').value);
  }
  suggest(){
    const env=this.bridge.env(),boat=this.bridge.boat();
    const weather={direction:Number($('editorWind').value),speed:env.speed};
    const course=SailingCourse.geometry.makeModel({...env,...weather},boat,env.courseType);
    this.draft=model.draftFrom(course,weather,id(),course.name+' ved Faaborg');
    this.freePlacement=false;
    this.history=[];
    this.layout();
    $('editorPoint').focus();
  }
  blank(){
    const env=this.bridge.env(),direction=Number($('editorWind').value),axis=model.windAxis(direction);
    this.draft={version:model.VERSION,map:model.MAP,id:id(),name:'Min bane',revision:1,
      template:env.courseType,weather:{direction,speed:env.speed},marks:[],route:[],
      start:{a:null,b:null,normal:axis},finish:{a:null,b:null,normal:{x:-axis.x,y:-axis.y}}};
    this.history=[];
    this.freePlacement=true;
    this.layout();
    $('editorPoint').value='start-a';
    $('editorMap').focus();
  }
  targets(){
    if(!this.draft)return [];
    const {start,finish,marks}=this.draft;
    return [{id:'start-a',label:'Startbøje 1',line:'start',end:'a',point:start.a},
      {id:'start-b',label:'Startbøje 2',line:'start',end:'b',point:start.b},
      ...marks.map(mark=>({id:mark.id,label:'Mærke '+mark.label,point:mark})),
      {id:'finish-a',label:'Målbøje 1',line:'finish',end:'a',point:finish.a},
      {id:'finish-b',label:'Målbøje 2',line:'finish',end:'b',point:finish.b}];
  }
  selected(){return this.targets().find(point=>point.id===$('editorPoint').value);}
  layout(){
    $('editorWindSetup').hidden=true;
    $('editorPlacement').hidden=false;
    $('editorName').value=this.draft.name;
    this.refreshPoints();
    this.chart.resize();
    this.draw(true);
  }
  place(p){
    const item=this.selected();
    if(!item||this.rotation)return;
    const point={x:Math.round(p.x),y:Math.round(p.y)};
    if(item.line){
      const line=this.draft[item.line],other=line[item.end==='a'?'b':'a'];
      const edited=other?model.moveEndpoint(line,item.end,point):{...line,[item.end]:point};
      if(!edited){$('editorStatus').textContent='Der skal være afstand mellem linjens to bøjer.';return;}
      this.remember();
      this.draft[item.line]=edited;
      if(!item.point){
        const next=this.targets().find(target=>target.line===item.line&&!target.point);
        if(next)$('editorPoint').value=next.id;
        else if(this.freePlacement&&item.line==='start'&&!this.draft.marks.length)this.addMark(false);
      }
    }else {
      this.remember();
      if(this.freePlacement&&item.point.x===null){
        this.draft.route.push({kind:'round',markIds:[item.id],side:'port'});
        if(!this.draft.finish.a)$('editorPoint').value='finish-a';
      }
      Object.assign(item.point,point);
    }
    this.draw();
  }
  refreshPoints(selected=$('editorPoint').value){
    $('editorPoint').replaceChildren(...this.targets().map(point=>new Option(point.label,point.id)));
    if(this.targets().some(point=>point.id===selected))$('editorPoint').value=selected;
    $('editorGateMate').replaceChildren(...this.draft.marks.map(mark=>new Option(mark.label,mark.id)));
  }
  remember(){
    this.history.push(model.clone(this.draft));
    if(this.history.length>24)this.history.shift();
  }
  undo(){
    this.draft=this.rotation||this.history.pop()||this.draft;
    this.rotation=null;
    this.layout();
  }
  rotate(){
    if(this.rotation){
      this.history.push(this.rotation);
      this.rotation=null;
      this.draw();
      return;
    }
    if(this.targets().some(item=>!item.point||item.point.x===null))return;
    const direction=this.bridge.env().direction;
    const angle=model.angleDifference(direction,this.draft.weather.direction);
    if(!angle)return;
    this.rotation=this.draft;
    this.draft=model.rotate(this.draft,-angle);
    this.draft.weather={direction,speed:this.bridge.env().speed};
    this.layout();
  }
  addMark(remember=true){
    if(!this.draft||this.rotation||this.draft.marks.length>=100)return;
    if(remember)this.remember();
    const mark={id:'mark-'+id(),label:String(this.draft.marks.length+1),x:null,y:null};
    this.draft.marks.push(mark);
    this.refreshPoints(mark.id);
    this.draw();
  }
  addVisit(gate){
    const item=this.selected(),mate=$('editorGateMate').value;
    if(!item||item.line||item.point.x===null||this.rotation||this.draft.route.length>=100||gate&&(!mate||mate===item.id))return;
    this.remember();
    const entry=gate?{kind:'gate',markIds:[item.id,mate],label:'Gate'}:{kind:'round',markIds:[item.id],side:'port'};
    this.draft.route.push(entry);
    this.draw(false,this.draft.route.length-1);
  }
  editVisit(action){
    const index=Number($('editorVisit').value),route=this.draft.route,visit=route[index];
    if(!visit||this.rotation)return;
    this.remember();
    if(action==='side')visit.side=visit.side==='port'?'starboard':'port';
    else if(action==='remove')route.splice(index,1);
    else [route[index],route[index+action]]=[route[index+action],route[index]];
    this.draw(false,action==='side'||action==='remove'?index:index+action);
  }
  updateLibrary(){
    $('editorLibrary').replaceChildren(...this.library.map(course=>new Option(course.name,course.id)));
    if(this.saved)$('editorLibrary').value=this.saved.id;
    $('editorOpenSaved').disabled=!this.library.length;
    for(const key of ['editorExport','editorDuplicate'])$(key).disabled=!this.draft;
  }
  openSaved(){
    const source=this.library.find(course=>course.id===$('editorLibrary').value);
    if(!source)return;
    this.history=[];this.rotation=null;this.freePlacement=false;this.draft=model.clone(source);this.layout();
  }
  duplicate(){
    if(!this.draft||this.rotation)return;
    this.draft={...model.clone(this.draft),id:id(),name:(this.draft.name+' · kopi').slice(0,64),revision:1};
    this.history=[];this.layout();
  }
  export(){
    if(!this.draft||this.rotation)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(this.draft,null,2)],{type:'application/json'}));
    const download=document.createElement('a');
    download.href=url;download.download=this.draft.name.replace(/[^\p{L}\p{N}]+/gu,'-')+'.json';
    download.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async import(file){
    if(!file)return;
    const status=$('editorFileStatus');
    try{
      if(file.size>120000)throw new Error('Banefilen er for stor.');
      const draft=model.onCurrentMap(JSON.parse(await file.text())),issues=this.issues(draft);
      if(issues.length)throw new Error(issues[0].message);
      this.compile(draft);
      this.history=[];this.rotation=null;this.freePlacement=false;this.draft={...draft,id:id(),revision:1};
      this.layout();
      status.textContent='Banen er åbnet som et udkast.';
    }catch(error){status.textContent=error instanceof SyntaxError?'Filen indeholder ugyldig JSON.':error.message;}
    finally{$('editorImport').value='';}
  }
  compile(draft){return model.compile(draft,SailingCourse.geometry.rounding,this.bridge.boat());}
  issues(draft){
    const minDepth=Math.max(1,this.bridge.boat().draft??this.bridge.boat().hullDepth);
    return model.validate(draft,(x,y)=>SailingWorld.heightAt(x,y)+minDepth);
  }
  advice(course){
    const {direction,speed}=this.draft.weather;
    const start=model.lineAdvice(this.draft.start,direction);
    const length=Math.hypot(this.draft.start.b.x-this.draft.start.a.x,this.draft.start.b.y-this.draft.start.a.y);
    const recommended=Math.ceil(model.startWidth(this.bridge.entrants(),speed));
    const points=[course.startLine.centre,...course.route];
    const legs=points.slice(1).map((point,i)=>{
      const from=points[i],angle=Math.abs(model.angleDifference(degrees(point.x-from.x,point.y-from.y),direction));
      return angle<45?'kryds':angle>145?'læns':'slør';
    });
    const bias=start.deviation<1?'neutral':Math.round(start.deviation)+'° skæv, bøje '+(start.favored==='a'?1:2)+' ligger længst mod vinden';
    const crossesLand=points.slice(1).some((point,i)=>{
      const from=points[i],x=point.x-from.x,y=point.y-from.y,n=Math.ceil(Math.hypot(x,y)/10);
      for(let k=1;k<n;k++)if(SailingWorld.heightAt(from.x+x*k/n,from.y+y*k/n)>=0)return true;
      return false;
    });
    const cautions=[];
    if(length<recommended)cautions.push('Startlinjen er smal for feltet.');
    if(crossesLand)cautions.push('Et lige ben krydser land. Sejl udenom, eller flyt en bøje.');
    $('editorAdvice').textContent=[
      'Vind fra '+direction+'°. Start '+Math.round(length)+' m, anbefalet mindst '+recommended+' m for feltet.',
      'Linjen er '+bias+'. Baneben '+legs.join(' → ')+'.',...cautions
    ].join(' ');
  }
  draw(fit=false,selected=Number($('editorVisit').value)){
    const issues=this.issues(this.draft);
    let course;
    try{
      const geometry=this.draft.name.trim()?this.draft:{...this.draft,name:'Udkast'};
      course=this.compile(geometry);
      const view={mode:'course',model:course,target:()=>null};
      this.chart.course=view;
      this.chart.model=course;
      this.chart.state={...course.spawn};
      this.chart.env={...this.bridge.env(),...this.draft.weather};
      this.chart.selectedId=$('editorPoint').value;
      if(fit)this.chart.fitCourse(view);
      else this.chart.draw();
      if(this.issuesAtSpawn(course))issues.push({message:'Der skal være dybere vand på startsiden.'});
      this.advice(course);
    }catch(error){issues.push({message:error.message});}
    if(!course){
      const partial=model.courseGeometry(this.draft,this.bridge.boat());
      this.chart.course={mode:'course',model:partial,target:()=>null};
      this.chart.model=partial;
      this.chart.state=null;
      this.chart.env={...this.bridge.env(),...this.draft.weather};
      this.chart.selectedId=$('editorPoint').value;
      if(fit&&!partial.buoys.length)this.chart.fitArea();
      else this.chart.draw();
      $('editorAdvice').textContent='';
    }
    this.ready=Boolean(course&&!issues.length);
    $('editorSave').disabled=!this.ready||!!this.rotation;
    $('editorRotate').textContent=this.rotation?'Anvend rotation':'Tilpas til aktuel vind';
    $('editorRotate').disabled=!this.rotation&&(!course||this.draft.weather.direction===this.bridge.env().direction);
    selected=Math.max(0,Math.min(selected,this.draft.route.length-1));
    const visit=this.draft.route[selected];
    $('editorVisit').replaceChildren(...this.draft.route.map((part,i)=>{
      const label=part.label||part.markIds.map(id=>this.draft.marks.find(m=>m.id===id)?.label||id).join(' / ');
      const side=part.kind==='gate'?'gate':part.side==='port'?'bagbord':'styrbord';
      return new Option((i+1)+' · '+label+' · '+side,i);
    }));
    if(visit)$('editorVisit').value=String(selected);
    const item=this.selected(),isMark=item&&!item.line&&item.point.x!==null&&!this.rotation;
    const pending=this.targets().find(target=>!target.point||target.point.x===null);
    $('editorMapHelp').textContent=pending?'Vælg en bøje, og klik på kortet for at placere den. Træk og zoom som på søkortet.':'Vælg en bøje, og klik på kortet. Piletasterne flytter den 5 m.';
    $('editorGateMate').querySelectorAll('option').forEach(option=>{
      option.disabled=option.value===item?.id||this.draft.marks.find(mark=>mark.id===option.value)?.x===null;
    });
    if($('editorGateMate').selectedOptions[0]?.disabled)$('editorGateMate').value=[...$('editorGateMate').options].find(option=>!option.disabled)?.value||'';
    $('editorAddRound').disabled=!isMark;
    $('editorAddGate').disabled=!isMark||this.draft.marks.length<2;
    $('editorSide').disabled=!!this.rotation||!visit||visit.kind!=='round';
    $('editorUp').disabled=!!this.rotation||!visit||selected<=0;
    $('editorDown').disabled=!!this.rotation||!visit||selected>=this.draft.route.length-1;
    $('editorRemoveVisit').disabled=!!this.rotation||!visit;
    $('editorUndo').disabled=!this.rotation&&!this.history.length;
    $('editorStatus').textContent=pending?'Placér '+pending.label.toLowerCase()+'.':issues[0]?.message||(this.rotation?'Forhåndsvisning af rotation omkring startlinjens midte.':'Banen kan gemmes.');
    this.updateLibrary();
  }
  issuesAtSpawn(course){
    const {spawn}=course,boat=this.bridge.boat();
    return SailingWorld.heightAt(spawn.x,spawn.y)>-Math.max(1,boat.draft??boat.hullDepth);
  }
  save(){
    if(!this.ready)return;
    const next=model.clone(this.draft);
    next.name=next.name.trim();
    const old=this.library.find(course=>course.id===next.id);
    if(old)next.revision=(old.revision||1)+1;
    this.library=[next,...this.library.filter(course=>course.id!==next.id)];
    try{localStorage.setItem(storageKey,JSON.stringify({selected:next.id,courses:this.library}));}
    catch{$('editorStatus').textContent='Banen kan bruges i denne session.';}
    this.saved=next;
    this.draft=model.clone(next);
    this.bridge.save(next);
  }
}
globalThis.FriVindCourseEditor=CourseEditor;
})();
