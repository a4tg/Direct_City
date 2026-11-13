import { useEffect,useRef,useState, type PointerEvent as ReactPointerEvent } from 'react';
import { api } from '../../city/api';
import { handleModuleEvent,type GameModule,type ModuleProps } from '../../city/modules/registry';
import { levels,tools,toolName,scoring,type WorkshopProgress,type RepairResult,type Point } from '../../../server/klimych-rules';
import { newRound,tick,togglePause,accept,resultOf,checkGesture,distance,angleTravel,timingPosition,type Round,type Gesture,type Sample } from './engine';
import { RepairObject } from './RepairObject';
import './klimych.css';
type Workshop={progress:WorkshopProgress;revision:number;collectedTools:string[];rewardsEnabled:false};
type Finished={result:RepairResult;progress:WorkshopProgress;revision:number;rewardsEnabled:false};
type Pending={runId:string;payload:{elapsedMs:number;errors:number;steps:RepairResult['steps']}};
const medalNames={gold:'Золото',silver:'Серебро',bronze:'Бронза',retry:'Повторная попытка'};
const image=(id:string)=>tools.find(t=>t.id===id)?.image;
export default function KlimychGame({userId}:ModuleProps) {
 const [workshop,setWorkshop]=useState<Workshop|null>(null);
 const [round,setRound]=useState<Round|null>(null);
 const roundRef=useRef(round);roundRef.current=round;
 const [runId,setRunId]=useState('');
 const [selected,setSelected]=useState('hand');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [saved,setSaved]=useState(false);
 const [gestureProgress,setGestureProgress]=useState(0);
 const [cursor,setCursor]=useState<Point|null>(null);
 const [toolWall,setToolWall]=useState(false);
 const gesture=useRef<Gesture|null>(null);
 const held=useRef(false);
 const blockedPointer=useRef(false);
 const sequence=useRef<Sample[]>([]);
 const keyboard=useRef<Sample[]>([]);
 const stage=useRef<SVGSVGElement>(null);
 const inFlight=useRef(false);
 const mounted=useRef(true);
 const queueKey='pryamogorod:klimych:pending:'+userId;
 function clearGesture(){gesture.current=null;held.current=false;blockedPointer.current=false;setGestureProgress(0);setCursor(null);keyboard.current=[];}
 async function send(pending:Pending) {
  if(inFlight.current)return;
  inFlight.current=true;
  try {
   const result=await api<Finished>('/modules/building-klimych/runs/'+pending.runId+'/finish','POST',pending.payload);
   if(mounted.current){
    setWorkshop(current=>current?{...current,progress:result.progress,revision:result.revision}:current);
    setSaved(true);setMessage('Результат сохранён. Денежные награды пока отключены.');
   }
   localStorage.removeItem(queueKey);
  }catch(error){if(mounted.current)setMessage((error as Error).message+' Результат хранится локально; повторите отправку.');}
  finally{inFlight.current=false;}
 }
 async function load() {
  setBusy(true);setMessage('');
  try{
   const data=await klimychModule.load('building-klimych') as Workshop;
   if(!mounted.current)return;
   setWorkshop(data);
   const raw=localStorage.getItem(queueKey);
   if(raw)await send(JSON.parse(raw));
  }catch(error){if(mounted.current)setMessage((error as Error).message);}
  finally{if(mounted.current)setBusy(false);}
 }
 useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false;};},[userId]);
 useEffect(()=>{
  let last=performance.now();
  const interval=window.setInterval(()=>{
   const now=performance.now(),delta=now-last;last=now;
   const current=roundRef.current;
   if(!current||current.status!=='active')return;
   setRound(r=>r?tick(r,Math.min(delta,500)):r);
   const g=gesture.current;
   const step=current.level.steps[current.step];
   if(g&&held.current&&step?.type==='hold'){
    const next={...g.points[g.points.length-1],t:performance.now()};
    g.points.push(next);
    const ratio=(next.t-g.points[0].t)/(step.holdMs??2000);
    setGestureProgress(Math.min(1,ratio));
    if(ratio>=1){
     const attempt=checkGesture(step,g,current.elapsedMs);
     held.current=false;gesture.current=null;blockedPointer.current=true;
     setRound(r=>r?accept(r,attempt):r);setGestureProgress(0);
    }
   }
  },80);
  const visibility=()=>{
   if(document.hidden){clearGesture();setRound(r=>r?.status==='active'?togglePause(r):r);}
  };
  document.addEventListener('visibilitychange',visibility);
  return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 useEffect(()=>{
  if(round?.status!=='finished'||!runId)return;
  clearGesture();
  const result=resultOf(round);
  const pending:Pending={runId,payload:{elapsedMs:Math.round(result.elapsedMs),errors:result.errors,steps:result.steps}};
  try{localStorage.setItem(queueKey,JSON.stringify(pending));void send(pending);}
  catch{setMessage('Не удалось сохранить локальную копию. Оставьте экран открытым и повторите отправку.');}
 },[round?.status,runId]);
 async function tutorial(){
  if(!workshop||busy)return;setBusy(true);
  try{
   const result=await klimychModule.save('building-klimych',{tutorialSeen:true},workshop.revision);
   setWorkshop({...workshop,revision:result.revision,progress:{...workshop.progress,tutorialSeen:true}});
  }catch(error){setMessage((error as Error).message);await load();}
  finally{setBusy(false);}
 }
 async function start(levelId:string){
  if(busy||inFlight.current)return;setBusy(true);setMessage('');
  try{
   const result=await api<{runId:string}>('/modules/building-klimych/runs','POST',{levelId});
   clearGesture();sequence.current=[];setRunId(result.runId);setSelected('hand');setSaved(false);
   setRound(newRound(levels.find(l=>l.id===levelId)!));
  }catch(error){setMessage((error as Error).message);}
  finally{setBusy(false);}
 }
 function locationOf(event:{clientX:number;clientY:number}):Sample {
  const matrix=stage.current!.getScreenCTM()!;
  const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
  return {x:p.x,y:p.y,t:performance.now()};
 }
 function beginGesture(event:ReactPointerEvent,source:'object'|'tool',tool=selected){
  const r=roundRef.current;if(!r||r.status!=='active')return;
  if(event.button!==0)return;
  event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
  blockedPointer.current=false;
  const p=locationOf(event);
  gesture.current={points:[p],source,tool};held.current=true;setCursor(p);
 }
 function moveGesture(event:ReactPointerEvent){
  const g=gesture.current,r=roundRef.current;
  if(!g||!held.current||!r||r.status!=='active')return;
  const p=locationOf(event);g.points.push(p);setCursor(p);
  const s=r.level.steps[r.step];
  if(s.type==='rotate')setGestureProgress(Math.min(1,Math.abs(angleTravel(g.points,s.zone))/(Math.abs(s.turn??1))));
  if(s.type==='hold'&&distance(p,s.zone)>s.radius){held.current=false;gesture.current=null;setGestureProgress(0);setRound(cur=>cur?accept(cur,{ok:false,precision:0,reason:'Инструмент соскользнул. Удерживай крепление.'}):cur);}
 }
 function endGesture(event:ReactPointerEvent){
  if(blockedPointer.current){blockedPointer.current=false;return;}
  const g=gesture.current,r=roundRef.current;
  if(!g||!r||r.status!=='active'){clearGesture();return;}
  g.points.push(locationOf(event));
  const step=r.level.steps[r.step];
  if(step.type==='sequence'){
   const next=step.sequence![sequence.current.length];
   if(g.tool!==step.tool||distance(g.points[g.points.length-1],next)>step.radius){
    sequence.current=[];setRound(cur=>cur?accept(cur,{ok:false,precision:0,reason:'Сборка не по порядку. Начни с детали 1.'}):cur);
   }else{
    sequence.current.push(g.points[g.points.length-1]);
    if(sequence.current.length===step.sequence!.length){setRound(cur=>cur?accept(cur,{ok:true,precision:1,reason:''}):cur);sequence.current=[];setMessage('');}
    else setMessage('Деталь на месте. Теперь следующая по номеру.');
   }
  }else{
   const attempt=checkGesture(step,g,r.elapsedMs);
   setRound(cur=>cur?accept(cur,attempt):cur);
  }
  clearGesture();
 }
 function cancelGesture(){clearGesture();}
 const active=round?.level.steps[round.step];
 const collected=Boolean(workshop?.collectedTools.includes(tools.find(t=>t.id===selected)?.designId??''));
 function keyboardRotate(key:string) {
  if(!round||round.status!=='active'||!['rotate','trace'].includes(active?.type??'')||!active)return;
  const points=keyboard.current;
  if(active.type==='trace'){
   if(key==='Escape'){keyboard.current=[];setCursor(null);return;}
   if(key==='Enter'){
    const attempt=checkGesture(active,{points,source:'object',tool:selected},round.elapsedMs);
    setRound(r=>r?accept(r,attempt):r);keyboard.current=[];setCursor(null);return;
   }
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key))return;
   if(!points.length)points.push({...active.path![0],t:performance.now()});
   const last=points[points.length-1];
   const p={x:last.x+(key==='ArrowRight'?20:key==='ArrowLeft'?-20:0),y:last.y+(key==='ArrowDown'?20:key==='ArrowUp'?-20:0),t:performance.now()};
   points.push(p);setCursor(p);return;
  }
  if(key==='Escape'){keyboard.current=[];setGestureProgress(0);return;}
  if(key==='Enter'){
   const attempt=checkGesture(active,{points,source:'object',tool:selected},round.elapsedMs);
   setRound(r=>r?accept(r,attempt):r);keyboard.current=[];setGestureProgress(0);return;
  }
  if(!['ArrowLeft','ArrowRight'].includes(key))return;
  if(!points.length)points.push({x:active.zone.x+115,y:active.zone.y,t:performance.now()});
  const previous=points[points.length-1];
  const angle=Math.atan2(previous.y-active.zone.y,previous.x-active.zone.x)+(key==='ArrowRight'?1:-1)*Math.PI/12;
  points.push({x:active.zone.x+115*Math.cos(angle),y:active.zone.y+115*Math.sin(angle),t:performance.now()});
  setGestureProgress(Math.min(1,Math.abs(angleTravel(points,active.zone))/Math.abs(active.turn??1)));
 }
 const quality=round?Math.max(0,100-round.errors*scoring.errorPenalty):100;
 const result=round?.status==='finished'?resultOf(round):null;
 return <section className={'klimych'+(round&&round.status!=='finished'?' in-round':'')} aria-label="Мастерская Климыча">
  <div className="k-masthead"><div><span className="k-eyebrow">ПРЯМОГОРОД / МАСТЕРСКАЯ № 02</span><h1>МАСТЕР НА ВСЕ РУКИ<br/><b>КЛИМЫЧ</b></h1></div><div className="k-portrait" role="img" aria-label="Оригинальный Климыч, одобрительно поднявший палец"/></div>
  {!workshop?<><p role="status">{message||'Открываем мастерскую…'}</p><button onClick={()=>void load()} disabled={busy}>Повторить загрузку</button></>:
   !workshop.progress.tutorialSeen?<div className="k-instruction">
    <span className="k-stamp">ВВОДНЫЙ ИНСТРУКТАЖ</span><h2>Не силой. С умом.</h2>
    <p>Осмотри деталь рукой. Потом бери инструмент. Перетаскивай его на крепление, вращай по кольцу, удерживай или веди по пунктиру.</p>
    <ol><li>Сначала точность. Скорость — потом.</li><li>Инструменты для пяти заказов уже на верстаке.</li><li>Стрелки на кольце задают направление. Не перетягивай.</li><li>Пауза останавливает время. Возврат из фонового режима — через паузу.</li></ol>
    <p>Это условный игровой ремонт. В жизни перекрывай воду и отключай питание перед работой.</p>
    <button disabled={busy} onClick={()=>void tutorial()}>Принять заказ-наряд</button>
   </div>:
   !round?<><div className="k-section-title"><h2>Доска заказов</h2><span>{workshop.progress.completed.length} / 5 ВЫПОЛНЕНО</span></div>
    <p className="k-note">Рабочие инструменты выданы мастерской. Коллекционные дают дополнительный прицел; без них доступны все основные заказы.</p>
    <div className="k-orders">{levels.map((l,i)=>{
     const best=workshop.progress.best[l.id],open=workshop.progress.unlocked.includes(l.id);
     return <article key={l.id} className={open?'':'locked'}><span className="k-order-no">{String(i+1).padStart(2,'0')}</span><div><h3>{l.title}</h3><p>{l.problem}</p><small>{l.duration} СЕК · {best?best.score+' / 100 · '+medalNames[best.medal]:'ЕЩЁ НЕ ВЫПОЛНЕН'}</small></div><button disabled={!open||busy} onClick={()=>void start(l.id)}>{open?'Взять заказ':'После предыдущего'}</button></article>;
    })}</div>
    <button className="k-wall-toggle" onClick={()=>setToolWall(!toolWall)}>{toolWall?'Свернуть стенд':'Инструментальный стенд · 16 предметов'}</button>
    {toolWall&&<div className="k-wall">{tools.map(t=><figure key={t.id}><img src={t.image} alt={t.name} loading="lazy"/><figcaption>{t.name}<small>{workshop.collectedTools.includes(t.designId)?'Коллекционный · прицел':'Рабочий реестр'}</small></figcaption></figure>)}</div>}
   </>:
   result?<div className="k-result"><span className="k-stamp">ЗАКАЗ {result.completed?'ВЫПОЛНЕН':'НЕ ЗАВЕРШЁН'}</span><h2>{medalNames[result.medal]}</h2>
    <svg viewBox="0 0 1000 660" className="k-result-object" aria-label="Предмет после ремонта"><RepairObject level={round!.level} step={undefined} done={result.steps.map(s=>s.stepId)} progress={0} point={null} collected={false}/></svg><div className="k-score">{result.score}<small>/ 100</small></div>
    <dl><div><dt>Качество · 70%</dt><dd>{result.quality} / 100</dd></div><div><dt>Время · 30%</dt><dd>{(result.elapsedMs/1000).toFixed(1)} с</dd></div><div><dt>Оценка скорости</dt><dd>{result.timeScore} / 100</dd></div><div><dt>Ошибки</dt><dd>{result.errors}</dd></div></dl>
    <p className="k-quote">{result.medal==='gold'?'Вот это работа. Хоть на выставку.':result.medal==='silver'?'Крепко сделано. Есть за что похвалить.':result.medal==='bronze'?'Держится. Но я бы ещё раз проверил.':'Спешка — не инструмент. Попробуем аккуратнее.'}</p>
    <p>Монеты за ремонт не начисляются.</p>
    {!saved&&<button disabled={inFlight.current} onClick={()=>{const raw=localStorage.getItem(queueKey);if(raw)void send(JSON.parse(raw));else void send({runId,payload:{elapsedMs:Math.round(result.elapsedMs),errors:result.errors,steps:result.steps}});}}>Повторить сохранение</button>}
    <div className="k-actions"><button disabled={busy||!saved} onClick={()=>void start(round!.level.id)}>Повторить заказ</button><button disabled={!saved} onClick={()=>{setRound(null);clearGesture();setMessage('');}}>К списку заказов</button>
     {saved&&workshop.progress.unlocked.includes(levels[levels.findIndex(l=>l.id===round!.level.id)+1]?.id)&&<button onClick={()=>void start(levels[levels.findIndex(l=>l.id===round!.level.id)+1].id)}>Следующий заказ →</button>}
    </div>
   </div>:
   <div className="k-round">
    <div className="k-job-header"><div><span className="k-eyebrow">ЗАКАЗ-НАРЯД / {round.step+1} ИЗ {round.level.steps.length}</span><h2>{round.level.title}</h2></div><div className="k-meters"><strong aria-label="Осталось времени">{Math.ceil(round.level.duration-round.elapsedMs/1000)} с</strong><span>Качество ≈ {quality}%</span></div></div>
    <div className="k-stage-wrap">
     <svg ref={stage} viewBox="0 0 1000 660" className="k-stage" role="application" aria-label={'Объект ремонта. '+active?.instruction} tabIndex={0}
      onContextMenu={e=>e.preventDefault()} onPointerDown={e=>beginGesture(e,'object')} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={cancelGesture}
      onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Escape'].includes(e.key)&&['rotate','trace'].includes(active?.type??'')){e.preventDefault();keyboardRotate(e.key);}}}>
      <RepairObject level={round.level} step={active} done={round.completions.map(c=>c.stepId)} progress={gestureProgress} point={cursor} collected={collected}/>
      <>{cursor&&active?.type==='trace'&&<circle cx={cursor.x} cy={cursor.y} r="18" fill="#222" stroke="white" strokeWidth="5"/>}</>{cursor&&gesture.current?.source==='tool'&&image(selected)&&<image href={image(selected)} x={cursor.x-65} y={cursor.y-65} width="130" height="130" pointerEvents="none"/>}
     </svg>
     {round.status==='paused'&&<div className="k-pause"><b>ПЕРЕКУР БЕЗ СЕКУНДОМЕРА</b><p>Время остановлено.</p><button onClick={()=>setRound(r=>r?togglePause(r):r)}>Продолжить работу</button></div>}
    </div>
    {active?.timed&&<div className="k-timing" aria-label="Окно точного удара"><span/><i style={{left:timingPosition(round.elapsedMs)*100+'%'}}/></div>}
    <div className="k-step-help"><span className="k-step-index">{String(round.step+1).padStart(2,'0')}</span><div><strong>{active?.instruction}</strong><small>{active?.type==='rotate'?'Можно также: стрелки ←/→ на объекте, Enter — отпустить.':active?.type==='trace'?'Можно также: стрелки ведут курсор по линии, Enter — закончить.':''}</small></div></div>
    <p className="k-feedback" role="status">{round.message}</p>
    <div className="k-tool-label"><span>ИНСТРУМЕНТЫ НА ВЕРСТАКЕ</span><strong>В руке: {toolName(selected)}</strong></div>
    <div className="k-tools">{['hand',...new Set([...round.level.steps.map(s=>s.tool).filter(t=>t!=='hand')])].map(id=><button key={id} className={selected===id?'selected':''} aria-pressed={selected===id} aria-label={'Инструмент: '+toolName(id)} disabled={round.status!=='active'}
     onClick={()=>setSelected(id)} onPointerDown={e=>{if(active?.type==='drag'&&!active.objectDrag){setSelected(id);beginGesture(e,'tool',id);}}} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={cancelGesture}>
      {id==='hand'?<span className="k-hand">☞</span>:<img src={image(id)} alt="" draggable={false}/>}<span>{toolName(id)}</span>
      {workshop.collectedTools.includes(tools.find(t=>t.id===id)?.designId??'')&&<small>ПРИЦЕЛ +</small>}
     </button>)}</div>
    <div className="k-actions"><button onClick={()=>{clearGesture();setRound(r=>r?togglePause(r):r);}}>{round.status==='paused'?'Продолжить':'Пауза'}</button><button disabled={busy} onClick={()=>void start(round.level.id)}>Заново</button><button onClick={()=>{clearGesture();setRound(null);setMessage('Заказ прерван. Лучшие результаты сохранены.');}}>В мастерскую</button></div>
   </div>}
  {message&&<p className="k-save-status" role="status">{message}</p>}
 </section>;
}
export const klimychModule:GameModule={
 id:'klimych',characterBrandId:'klimych',entry:'KlimychGame',Screen:KlimychGame,
 collection:{accepts:'moduleEvent',catalogBrandId:'klimych'},
 load:()=>api<Workshop>('/modules/building-klimych/workshop'),
 save:(buildingId,data,revision)=>api('/modules/'+encodeURIComponent(buildingId),'PUT',{data,revision}),
 handleEvent:handleModuleEvent,
};
