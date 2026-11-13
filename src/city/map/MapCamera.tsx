import {forwardRef,useEffect,useImperativeHandle,useRef,type ReactNode} from 'react';
import {clampCamera,zoomAt,minScale,focusCamera,isTap,frameZoom,bookmark,restoreCamera,releaseVelocity,type CameraFrame,type Camera,type Bounds} from './math';
import type {XY} from './types';
import {pinchCamera} from './pinch';
export type CameraControls={focus:(point:XY,frame?:CameraFrame)=>void;overview:()=>void;zoom:(factor:number)=>void};
type Props={children:ReactNode;userId:string;initial:XY|null;onTap:(id:string)=>void;editing:boolean;position:(id:string)=>XY;onMove:(id:string,point:XY)=>void;onEditSelect:(id:string)=>void};
export const MapCamera=forwardRef<CameraControls,Props>(function MapCamera(props,ref){
 const viewport=useRef<HTMLDivElement>(null),world=useRef<HTMLDivElement>(null);
 const latest=useRef(props);latest.current=props;
 const controls=useRef<CameraControls>({focus:()=>{},overview:()=>{},zoom:()=>{}});
 useImperativeHandle(ref,()=>({focus:(...a)=>controls.current.focus(...a),overview:()=>controls.current.overview(),zoom:f=>controls.current.zoom(f)}),[]);
 useEffect(()=>{
  const contentTop=62;
  const el=viewport.current!,layer=world.current!,storage='pryamogorod:map-camera:v2:'+props.userId;
  let b:Bounds={width:el.clientWidth,height:Math.max(1,el.clientHeight-contentTop),mapWidth:941,mapHeight:1672};
  let c:Camera={x:0,y:0,s:minScale(b)},frame=0,anim=0,initialized=false,disposed=false;
  let stored:unknown=null,legacy=false;
  try{stored=JSON.parse(localStorage.getItem(storage)??'null');if(!stored){stored=JSON.parse(localStorage.getItem('pryamogorod:map-camera:v1:'+props.userId)??'null');legacy=true;}}catch{}
  const pointers=new Map<number,XY>();
  let gesture:{id:string|null;start:XY;last:XY;at:number;max:number;pinched:boolean;lastTime:number;velocity:XY;original:XY|null}|null=null;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastScale=0;
  function draw(){if(c.s!==lastScale){layer.style.setProperty('--map-hit-min',44/c.s+'px');lastScale=c.s;}layer.style.transform='translate3d('+c.x+'px,'+(c.y+contentTop)+'px,0) scale('+c.s+')';}
  function paint(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(!disposed)draw();});}
  function stop(){cancelAnimationFrame(anim);anim=0;}
  function save(){
   if(!initialized)return;
   try{localStorage.setItem(storage,JSON.stringify(bookmark(c,b)));}catch{}
  }
  function moveTo(target:Camera){
   stop();target=clampCamera(target,b);
   if(reduced()){c=target;draw();save();return;}
   const from={...c},start=performance.now();
   const run=(now:number)=>{const t=Math.min(1,(now-start)/360),ease=1-Math.pow(1-t,3);c={x:from.x+(target.x-from.x)*ease,y:from.y+(target.y-from.y)*ease,s:from.s+(target.s-from.s)*ease};draw();if(t<1)anim=requestAnimationFrame(run);else{anim=0;save();}};
   anim=requestAnimationFrame(run);
  }
  controls.current={
   focus:(p,f='building')=>moveTo(focusCamera(c,b,p,frameZoom(b,f))),
   overview:()=>moveTo(focusCamera(c,b,{x:.5,y:.5},1)),
   zoom:f=>moveTo(zoomAt(c,b,f,{x:b.width/2,y:b.height/2})),
  };
  function cancelGesture(){pointers.clear();gesture=null;el.classList.remove('is-dragging');}
  function visibility(){if(document.hidden){stop();cancelGesture();save();}}
  const resize=new ResizeObserver(()=>{
   cancelGesture();
   stop();
   const center={x:(b.width/2-c.x)/(c.s*941),y:(b.height/2-c.y)/(c.s*1672)},zoom=c.s/minScale(b);
   b={...b,width:el.clientWidth,height:Math.max(1,el.clientHeight-contentTop)};
   if(!b.width||!b.height)return;
   if(!initialized){
    initialized=true;
    c=restoreCamera(stored,b,legacy)??focusCamera(c,b,latest.current.initial??{x:.5,y:.43},frameZoom(b,latest.current.initial?'building':'plaza'));
   }else c=focusCamera(c,b,center,zoom);
   paint();save();
  });resize.observe(el);
  const local=(e:{clientX:number;clientY:number})=>{const rect=el.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top-contentTop};};
  function down(e:PointerEvent){
   if(e.button!==0)return;e.preventDefault();stop();el.focus({preventScroll:true});
   const p=local(e);pointers.set(e.pointerId,p);el.setPointerCapture(e.pointerId);
   if(pointers.size===1){const id=(e.target as Element).closest<HTMLElement>('[data-building-id]')?.dataset.buildingId??null;gesture={id,start:p,last:p,at:performance.now(),max:0,pinched:false,lastTime:performance.now(),velocity:{x:0,y:0},original:id&&latest.current.editing?latest.current.position(id):null};if(id&&latest.current.editing)latest.current.onEditSelect(id);}
   else if(gesture)gesture.pinched=true;
   el.classList.add('is-dragging');
  }
  function move(e:PointerEvent){
   if(!pointers.has(e.pointerId)||!gesture)return;
   e.preventDefault();const before=[...pointers.values()],p=local(e);pointers.set(e.pointerId,p);
   const after=[...pointers.values()];
   if(after.length>=2){
    c=pinchCamera(c,b,before,after);gesture.pinched=true;
   }else{
    gesture.max=Math.max(gesture.max,Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y));
    if(latest.current.editing&&gesture.id&&gesture.original){
     latest.current.onMove(gesture.id,{x:Math.max(0,Math.min(1,gesture.original.x+(p.x-gesture.start.x)/(c.s*941))),y:Math.max(0,Math.min(1,gesture.original.y+(p.y-gesture.start.y)/(c.s*1672)))});
    }else{
     const now=performance.now(),dt=Math.max(8,now-gesture.lastTime),dx=p.x-gesture.last.x,dy=p.y-gesture.last.y;
     c=clampCamera({...c,x:c.x+dx,y:c.y+dy},b);gesture.velocity=releaseVelocity({x:dx/dt,y:dy/dt},0);gesture.lastTime=now;
    }
   }
   gesture.last=p;paint();
  }
  function inertia(v:XY){
   if(reduced()){save();return;}let last=performance.now();
   const run=(now:number)=>{const dt=Math.min(32,now-last);last=now;const next=clampCamera({...c,x:c.x+v.x*dt,y:c.y+v.y*dt},b);if(Math.abs(next.x-c.x)<.01)v.x=0;if(Math.abs(next.y-c.y)<.01)v.y=0;c=next;v.x*=Math.pow(.91,dt/16);v.y*=Math.pow(.91,dt/16);draw();if(Math.hypot(v.x,v.y)>.02)anim=requestAnimationFrame(run);else{anim=0;save();}};
   anim=requestAnimationFrame(run);
  }
  function up(e:PointerEvent){
   if(!pointers.has(e.pointerId))return;if(gesture){const end=local(e);gesture.max=Math.max(gesture.max,Math.hypot(end.x-gesture.start.x,end.y-gesture.start.y));}pointers.delete(e.pointerId);
   if(pointers.size){if(gesture){gesture.last=[...pointers.values()][0];gesture.pinched=true;}return;}
   el.classList.remove('is-dragging');
   if(gesture){
    const g=gesture;gesture=null;
    if(e.type==='pointerup'&&g.id&&isTap(g.max,g.pinched,performance.now()-g.at))latest.current.onTap(g.id);
    if(e.type==='pointerup'&&!g.pinched&&g.max>=8&&!latest.current.editing)inertia(releaseVelocity(g.velocity,performance.now()-g.lastTime));else save();
   }
  }
  function wheel(e:WheelEvent){e.preventDefault();stop();c=zoomAt(c,b,Math.exp(-e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?b.height:1)*.0015),local(e));paint();save();}
  function key(e:KeyboardEvent){
   if(e.target!==el||e.ctrlKey||e.metaKey||e.altKey)return;
   const delta=50;
   if(e.key==='Home'){e.preventDefault();controls.current.overview();}
   else if(e.key==='+'||e.key==='='){e.preventDefault();controls.current.zoom(1.25);}
   else if(e.key==='-'){e.preventDefault();controls.current.zoom(.8);}
   else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    e.preventDefault();stop();c=clampCamera({...c,x:c.x+(e.key==='ArrowLeft'?delta:e.key==='ArrowRight'?-delta:0),y:c.y+(e.key==='ArrowUp'?delta:e.key==='ArrowDown'?-delta:0)},b);paint();save();
   }
  }
  document.addEventListener('visibilitychange',visibility);
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('wheel',wheel,{passive:false});el.addEventListener('keydown',key);
  return()=>{document.removeEventListener('visibilitychange',visibility);disposed=true;save();stop();cancelAnimationFrame(frame);resize.disconnect();pointers.clear();el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('wheel',wheel);el.removeEventListener('keydown',key);};
 },[props.userId]);
 return <div ref={viewport} className={'map-viewport'+(props.editing?' is-editing':'')} tabIndex={0} role="application" aria-label="Город. Перетаскивайте карту, меняйте масштаб колёсиком или двумя пальцами. Стрелки перемещают, плюс и минус меняют масштаб."><div ref={world} className="map-world">{props.children}</div></div>;
});
