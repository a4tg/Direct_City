import { useEffect, useRef, useState } from 'react';
import { MeikuGame } from '../../modules/meiku/MeikuGame';
import { useGame } from '../../game/store';
import { begin, decay, type Progress } from '../../game/behavior';
import { initial } from '../../game/balance';
import { resolveMeikuSave, type SyncCheckpoint } from './meikuSync';
import { saveProgress, setSaveScope } from '../../game/save';
import { api } from '../api';
import type { ModuleSave } from '../types';
import { handleModuleEvent, type GameModule, type ModuleProps } from './registry';

const moduleStorageKey=(userId:string)=>'pryamogorod:meiku:'+userId;
function localProgress(key:string):Progress|null {
 try { const value=JSON.parse(localStorage.getItem(key)??'null');return value?.state??null; }catch{return null;}
}
export default function MeikuAdapter({buildingId,userId}:ModuleProps) {
 const [ready,setReady]=useState(false);
 const [status,setStatus]=useState('Загружаем сохранение Мэйку…');
 const revision=useRef(0);
 const flush=useRef<(()=>Promise<void>)|null>(null);
 const reload=useRef<(()=>Promise<void>)|null>(null);
 useEffect(()=>{
  let mounted=true;
  let timer:number|undefined;
  let unsubscribe=()=>{};
  let saving=false;
  let conflict=false;
  let pending:Progress|null=null;
  let last='';
  const scope=moduleStorageKey(userId);
  const syncKey=scope+':server-sync';
  const original=useGame.getState().progress;
  async function save() {
   if(!pending||saving||conflict)return;
   saving=true;
   const data=pending;pending=null;
   try{
    const result=await meikuModule.save(buildingId,{progress:data},revision.current);
    revision.current=result.revision;
    localStorage.setItem(syncKey,JSON.stringify({revision:result.revision,serialized:JSON.stringify(data)}));
    if(mounted)setStatus('Прогресс Мэйку сохранён на сервере. Кошелёк Мэйку относится к этому модулю.');
   }catch(error){
    pending??=data;
    conflict=true;
    if(mounted)setStatus((error as Error).message+' Локальная копия сохранена.');
   }finally{saving=false;if(pending&&!conflict)void save();}
  }
  async function load(forceServer=false) {
   const remote=await meikuModule.load(buildingId) as ModuleSave;
   if(!mounted)return;
   const serverRevision=remote.save?.revision??0;
   const legacy=localProgress('meiku-world');
   const scoped=localProgress(scope);
   const data=remote.save?.data.progress as Partial<Progress>|undefined;
   let checkpoint:SyncCheckpoint|null=null;
   try{checkpoint=JSON.parse(localStorage.getItem(syncKey)??'null');}catch{/* Keep the local copy if sync metadata is unavailable. */}
   const selection=resolveMeikuSave(data,serverRevision,scoped,legacy,checkpoint,forceServer);
   revision.current=selection.baseRevision;
   const restored=decay({...initial,...selection.progress},Date.now());
   if(legacy)await api('/legacy/meiku','POST',{data:{version:1,state:legacy}});
   if(!mounted)return;
   if(data&&selection.progress===data)localStorage.setItem(syncKey,JSON.stringify({revision:serverRevision,serialized:JSON.stringify(data)}));
   setSaveScope(scope);
   saveProgress(restored);
   useGame.setState({progress:restored,pet:begin(Date.now(),restored.friendship>0),pendingUpgrades:[]});
   last=JSON.stringify(restored);conflict=selection.conflict;
   remote.events.forEach(meikuModule.handleEvent);
   pending=selection.upload?restored:null;
   setStatus(selection.conflict?'Есть несинхронизированная локальная копия. Она сохранена; автоматическая запись остановлена. Перед загрузкой серверной копии будет создана резервная.':legacy&&!remote.save?'Локальный Мэйку перенесён в модуль. Городские монеты учитываются отдельно.':'Сохранение Мэйку загружено.');
   setReady(true);
   void save();
  }
  reload.current=async()=>{
   if(saving){setStatus('Дождитесь завершения текущего сохранения.');return;}
   const backup=localStorage.getItem(scope);
   if(backup)localStorage.setItem(scope+':before-server-load',backup);
   pending=null;await load(true);
  };
  flush.current=async()=>{conflict=false;pending=useGame.getState().progress;await save();};
  void load().then(()=>{
   if(!mounted)return;
   unsubscribe=useGame.subscribe(next=>{
    const serialized=JSON.stringify(next.progress);
    if(serialized===last)return;
    last=serialized;pending=next.progress;
    clearTimeout(timer);timer=window.setTimeout(()=>void save(),1200);
   });
  }).catch(error=>{if(mounted)setStatus((error as Error).message);});
  return ()=>{
   mounted=false;unsubscribe();clearTimeout(timer);void save();
   setSaveScope('meiku-world');
   useGame.setState({progress:localProgress('meiku-world')??original,pet:begin(Date.now(),true),pendingUpgrades:[]});
  };
 },[buildingId,userId]);
 return <div className="meiku-module">
  <div className="module-save"><p role="status">{status}</p>
   <button onClick={()=>void flush.current?.()} disabled={!ready}>Сохранить</button>
   <button onClick={()=>{void reload.current?.().catch(error=>setStatus((error as Error).message));}}>Загрузить серверную копию</button>
  </div>
  {ready&&<MeikuGame/>}
 </div>;
}
export const meikuModule:GameModule={
 id:'meiku',characterBrandId:'meiku-neko',entry:'MeikuAdapter',
 Screen:MeikuAdapter,collection:{accepts:'moduleEvent',catalogBrandId:'meiku-neko'},
 load:buildingId=>api<ModuleSave>('/modules/'+encodeURIComponent(buildingId)),
 save:(buildingId,data,revision)=>api('/modules/'+encodeURIComponent(buildingId),'PUT',{data,revision}),
 handleEvent:handleModuleEvent,
};