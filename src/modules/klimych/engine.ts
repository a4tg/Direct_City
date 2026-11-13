import { evaluateResult, type Point, type RepairLevel, type RepairStep, type Completion } from '../../../server/klimych-rules';
export type Sample=Point&{t:number};
export type Gesture={points:Sample[];source:'tool'|'object';tool:string};
export type Attempt={ok:boolean;precision:number;reason:string};
export type Round={level:RepairLevel;step:number;elapsedMs:number;errors:number;completions:Completion[];status:'active'|'paused'|'finished';message:string};
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export function newRound(level:RepairLevel):Round{return {level,step:0,elapsedMs:0,errors:0,completions:[],status:'active',message:level.problem};}
export function tick(round:Round,ms:number):Round {
 if(round.status!=='active')return round;
 const elapsedMs=Math.min(round.level.duration*1000,round.elapsedMs+Math.max(0,ms));
 return {...round,elapsedMs,status:elapsedMs>=round.level.duration*1000?'finished':'active'};
}
export function togglePause(round:Round):Round{return round.status==='finished'?round:{...round,status:round.status==='active'?'paused':'active'};}
export function accept(round:Round,attempt:Attempt):Round {
 if(round.status!=='active')return round;
 if(!attempt.ok)return {...round,errors:round.errors+1,message:attempt.reason};
 const step=round.level.steps[round.step];
 const completions=[...round.completions,{stepId:step.id,precision:attempt.precision}];
 return {...round,step:round.step+1,completions,status:round.step+1===round.level.steps.length?'finished':'active',message:step.success};
}
export const resultOf=(round:Round)=>evaluateResult(round.level,round.completions,round.errors,round.elapsedMs);
export const timingPosition=(elapsedMs:number)=>(elapsedMs%1800)/1800;
function fail(reason:string):Attempt{return {ok:false,precision:0,reason};}
function success(precision=1):Attempt{return {ok:true,precision:Math.max(.1,Math.min(1,precision)),reason:''};}
export function rotation(points:Sample[]) {
 let angle=0;
 for(let i=1;i<points.length;i++){
  let diff=points[i].t-points[i-1].t; // Angle is passed in t by the caller below.
  if(diff>Math.PI)diff-=2*Math.PI;if(diff<-Math.PI)diff+=2*Math.PI;
  if(Math.abs(diff)<1.5)angle+=diff;
 }
 return angle;
}
export function angleTravel(points:Sample[],zone:Point) {
 return rotation(points.map(p=>({...p,t:Math.atan2(p.y-zone.y,p.x-zone.x)})));
}
export function checkGesture(step:RepairStep,g:Gesture,elapsedMs:number):Attempt {
 const points=g.points;
 if(!points.length)return fail('Нет движения.');
 if(g.tool!==step.tool)return fail('Не тот инструмент. Сейчас нужен: '+(step.tool==='hand'?'рука':'инструмент из подсказки')+'.');
 const first=points[0],last=points[points.length-1];
 if(step.type==='rotate'){
  const r=distance(first,step.zone);
  if(r<35||r>160)return fail('Начни на кольце вокруг крепления.');
  if(points.some(p=>distance(p,step.zone)>180||distance(p,step.zone)<20))return fail('Веди по кольцу, не через центр.');
  const angle=angleTravel(points,step.zone)*(Math.sign(step.turn??1));
  const required=Math.abs(step.turn??Math.PI*1.5);
  if(angle<required-.25)return fail(angle<0?'Вращай в другую сторону.':'Не дотянул. Пройди до конечной риски.');
  if(angle>required+.9)return fail('Перетянул крепление. Нужна аккуратность, а не сила.');
  return success(1-Math.abs(angle-required)/2);
 }
 if(step.type==='trace'){
  const path=step.path??[];
  if(path.length<2||distance(first,path[0])>step.radius)return fail('Начни у точки 1 и следуй пунктиру.');
  let reached=1,off=0;
  function segmentDistance(p:Point,a:Point,b:Point){
   const dx=b.x-a.x,dy=b.y-a.y;
   const f=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
   return distance(p,{x:a.x+f*dx,y:a.y+f*dy});
  }
  for(const p of points){
   const near=Math.min(...path.slice(1).map((b,i)=>segmentDistance(p,path[i],b)));
   if(near>step.radius)off++;
   if(reached<path.length&&distance(p,path[reached])<step.radius)reached++;
  }
  if(reached!==path.length||points.length<4)return fail('Пройди всю траекторию по порядку, включая обратный ход.');
  if(off>points.length*.15)return fail('Слишком далеко от линии. Повтори точнее.');
  return success(1-off/points.length);
 }
 if(step.type==='sequence'){
  if(points.length!==step.sequence?.length||points.some((p,i)=>distance(p,step.sequence![i])>step.radius))return fail('Сборка не по порядку. Начни с детали 1.');
  return success();
 }
 if(step.type==='drag'){
  if(step.objectDrag){
   if(g.source!=='object'||!step.from||distance(first,step.from)>step.radius)return fail('Возьми деталь у начальной метки.');
   if(distance(first,last)<25)return fail('Деталь нужно переместить, а не просто нажать.');
  }else if(g.source!=='tool')return fail('Перетащи инструмент прямо из панели на деталь.');
  const d=distance(last,step.zone);
  if(d>step.radius)return fail('Совмести деталь с конечной меткой.');
  return success(1-d/(step.radius*3));
 }
 if(distance(first,step.zone)>step.radius||distance(last,step.zone)>step.radius)return fail(step.error);
 if(step.type==='hold'){
  const duration=last.t-first.t;
  if(duration<(step.holdMs??2000)-80)return fail('Удерживай непрерывно до заполнения индикатора.');
  if(points.some(p=>distance(p,step.zone)>step.radius))return fail('Инструмент соскользнул. Удерживай его на креплении.');
  return success();
 }
 if(step.type==='tap'&&step.timed){
  const timing=timingPosition(elapsedMs);
  if(timing<.32||timing>.68)return fail('Удар вне светлого окна. Лишние удары портят соединение.');
  return success(1-Math.abs(timing-.5));
 }
 return success(1-distance(last,step.zone)/(step.radius*4));
}
