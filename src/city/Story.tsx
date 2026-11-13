import { useState } from 'react';
import type { Scene } from './types';
import { api } from './api';

export function Story({scene,onComplete}:{scene:Scene;onComplete:()=>Promise<void>}) {
 const [nodeId,setNodeId]=useState(scene.script.start);
 const [choices,setChoices]=useState<string[]>([]);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const node=scene.script.nodes.find(item=>item.id===nodeId);
 if(!node) return <p role="alert">В сцене отсутствует реплика.</p>;
 async function complete() {
  setSaving(true);setError('');
  try {await api('/scenes/'+encodeURIComponent(scene.id)+'/complete','POST',{choices});await onComplete();}
  catch(error){setError((error as Error).message);setSaving(false);}
 }
 return <section className="story-panel" aria-label="Знакомство">
  <p className="eyebrow">{scene.kind==='intro'?'Первое знакомство с городом':'Новая встреча'} · временная сцена</p>
  <div className="portrait">{node.portrait?<img src={node.portrait} alt={node.speaker}/>:<span>{node.speaker.slice(0,1)}</span>}</div>
  <h2>{node.speaker}</h2><p className="dialogue" role="status">{node.text}</p>
  <div className="answers">{node.choices.map(choice=><button key={choice.id} disabled={saving}
   onClick={()=>{setChoices([...choices,choice.id]);setNodeId(choice.next);}}>{choice.text}</button>)}
   {!node.choices.length&&<button disabled={saving} onClick={()=>void complete()}>{saving?'Сохраняем…':'Завершить знакомство'}</button>}
  </div><p role="alert">{error}</p>
 </section>;
}