import {useState} from 'react';
import type {Catalog} from '../types';
import type {MapLayout,Placement,MapAssets} from './types';
import {validateLayout} from './math';
import {effectTypes,type Preview,type WindowZone} from './visuals';
const effectNames=['Колокольчик','Лапка','Лепестки','Ветер','Искра','Дым','Пузыри','Световые линии','Конфетти','Блеск','Сценический свет','Драматический свет','Пыльца','Прыжок','Витрина','Сканирование'];
export default function MapDevEditor({layout,assets,catalog,preview,setPreview,selected,select,change,moving,setMoving,reset,testEffect,simulate}:{layout:MapLayout;assets:MapAssets;catalog:Catalog;preview:Preview;setPreview:(p:Preview)=>void;selected:string;select:(id:string)=>void;change:(p:Placement)=>void;moving:boolean;setMoving:(v:boolean)=>void;reset:()=>void;testEffect:()=>void;simulate:(district:boolean)=>void}){
 const p=layout.placements.find(p=>p.buildingId===selected)??layout.placements[0];
 const [error,setError]=useState(''),[json,setJSON]=useState(''),[zone,setZone]=useState(0);
 const w=p.windows[zone],asset=assets.buildings[String(p.slot)];
 function update(patch:Partial<Placement>){const next={...p,...patch};try{validateLayout({...layout,placements:layout.placements.map(v=>v.buildingId===p.buildingId?next:v)});change(next);setError('');}catch(e){setError((e as Error).message);}}
 function updateZone(patch:Partial<WindowZone>){if(w)update({windows:p.windows.map((v,i)=>i===zone?{...v,...patch}:v)});}
 function exportJSON(){const url=URL.createObjectURL(new Blob([JSON.stringify(layout,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='map-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const slider=(label:string,value:number,min:number,max:number,fn:(v:number)=>void)=><label>{label} <output>{value.toFixed(3)}</output><input type="range" min={min} max={max} step=".001" value={value} onChange={e=>fn(Number(e.target.value))}/></label>;
 return <section className="map-dev-editor" aria-label="Лаборатория карты"><h3>Лаборатория карты</h3><p>Предпросмотр не открывает здания на сервере и не начисляет монеты.</p>
 <div className="editor-preview-controls">
 <label>Состояние города<select value={preview.mode} onChange={e=>setPreview({...preview,mode:e.target.value as Preview['mode']})}><option value="server">Прогресс игрока</option><option value="all">Все 16 зданий</option><option value="closed">Всё закрыто</option><option value="district">Один район открыт</option></select></label>
 <label>Район<select value={preview.districtId} onChange={e=>setPreview({...preview,districtId:e.target.value})}>{catalog.districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
 <label><input type="checkbox" checked={preview.fog} onChange={e=>setPreview({...preview,fog:e.target.checked})}/> Туман</label>
 <label><input type="checkbox" checked={preview.bounds} onChange={e=>setPreview({...preview,bounds:e.target.checked})}/> Границы и якоря</label>
 <button onClick={()=>simulate(false)}>Открытие здания</button><button onClick={()=>simulate(true)}>Первое открытие района</button>
 </div>
 <label>Здание<select value={p.buildingId} onChange={e=>{select(e.target.value);setJSON('');setZone(0);}}>{layout.placements.map(v=><option key={v.buildingId} value={v.buildingId}>{v.slot}. {v.title}</option>)}</select></label>
 <button onClick={testEffect}>Проиграть эффект</button>
 <details><summary>Размещение и зона нажатия</summary>
 <label><input type="checkbox" checked={moving} onChange={e=>setMoving(e.target.checked)}/> Перетаскивать дома вместо камеры</label>
 {slider('Основание X',p.position.x,0,1,x=>update({position:{...p.position,x}}))}
 {slider('Основание Y',p.position.y,0,1,y=>update({position:{...p.position,y}}))}
 {slider('Ширина',p.width,.08,.4,width=>update({width}))}
 {slider('Якорь X',p.anchor.x,0,1,x=>update({anchor:{...p.anchor,x}}))}
 {slider('Якорь Y',p.anchor.y,0,1,y=>update({anchor:{...p.anchor,y}}))}
 {slider('Зона нажатия: ширина',p.hit.width,.2,1,width=>update({hit:{...p.hit,width}}))}
 {slider('Зона нажатия: высота',p.hit.height,.2,1,height=>update({hit:{...p.hit,height}}))}
 {slider('Вход X',p.entry.x,0,1,x=>update({entry:{...p.entry,x}}))}
 {slider('Вход Y',p.entry.y,0,1,y=>update({entry:{...p.entry,y}}))}
 </details>
 <details><summary>Индивидуальный эффект</summary>
 <label>Эффект<select value={p.effect.type} onChange={e=>update({effect:{...p.effect,type:e.target.value as Placement['effect']['type']}})}>{effectTypes.map((v,i)=><option key={v} value={v}>{effectNames[i]}</option>)}</select></label>
 <label><input type="checkbox" checked={p.effect.enabled} onChange={e=>update({effect:{...p.effect,enabled:e.target.checked}})}/> Эффект включён</label>
 {slider('Эффект X',p.effect.point.x,0,1,x=>update({effect:{...p.effect,point:{...p.effect.point,x}}}))}
 {slider('Эффект Y',p.effect.point.y,0,1,y=>update({effect:{...p.effect,point:{...p.effect.point,y}}}))}
 </details>
 <details open><summary>Световые зоны</summary>
 <p>Координаты относятся к видимому обрезанному холсту. Добавьте полигон, настройте вершины. Нажатие на иллюстрацию добавляет вершину.</p>
 <button onClick={()=>{setZone(p.windows.length);update({windows:[...p.windows,{id:'window-'+Date.now(),points:[{x:.4,y:.4},{x:.6,y:.4},{x:.6,y:.6},{x:.4,y:.6}],color:'#ffe6a1',opacity:.65,duration:1800,activation:'both'}]});}}>Добавить полигон</button>
 {p.windows.length>0&&<label>Полигон<select value={zone} onChange={e=>setZone(Number(e.target.value))}>{p.windows.map((v,i)=><option key={v.id} value={i}>{v.id}</option>)}</select></label>}
 {asset&&<div className="window-editor-art" style={{aspectRatio:asset.width+'/'+asset.height}}>
 <img src={asset.url} alt={'Световые зоны: '+p.title}/>
 <svg viewBox="0 0 100 100" preserveAspectRatio="none" onClick={e=>{if(!w)return;const r=e.currentTarget.getBoundingClientRect();updateZone({points:[...w.points,{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}]});}}>
 {p.windows.map((v,i)=><polygon key={v.id} points={v.points.map(p=>p.x*100+','+p.y*100).join(' ')} fill={v.color??'#ffe6a1'} fillOpacity={i===zone ? .55 : .2} stroke={i===zone?'#ff4687':'#fff'} strokeWidth=".6"/>)}
 {w?.points.map((v,i)=><g key={i}><circle cx={v.x*100} cy={v.y*100} r="1.1" fill="#ff4687"/><text x={v.x*100+1.5} y={v.y*100} fontSize="3" fill="#fff">{i+1}</text></g>)}
 </svg></div>}
 {w&&<><label>Цвет<input type="color" value={w.color??'#ffe6a1'} onChange={e=>updateZone({color:e.target.value})}/></label>
 {slider('Прозрачность',w.opacity??.65,0,1,opacity=>updateZone({opacity}))}
 <label>Длительность, мс<input type="number" min="100" max="5000" step="100" value={w.duration??1800} onChange={e=>updateZone({duration:Number(e.target.value)})}/></label>
 <label>Когда включать<select value={w.activation??'both'} onChange={e=>updateZone({activation:e.target.value as WindowZone['activation']})}><option value="both">Выбор и открытие</option><option value="select">Выбор</option><option value="unlock">Открытие</option></select></label>
 {w.points.map((v,i)=><div className="window-point" key={i}><span>Вершина {i+1}</span>{(['x','y'] as const).map(axis=><label key={axis}>{axis.toUpperCase()}<input type="number" min="0" max="1" step=".005" value={+v[axis].toFixed(4)} onChange={e=>updateZone({points:w.points.map((pt,j)=>j===i?{...pt,[axis]:Number(e.target.value)}:pt)})}/></label>)}</div>)}
 <button disabled={w.points.length<=3} onClick={()=>updateZone({points:w.points.slice(0,-1)})}>Убрать последнюю вершину</button>
 <button onClick={()=>{update({windows:p.windows.filter((_,i)=>i!==zone)});setZone(0);}}>Удалить полигон</button></>}
 <details><summary>JSON световых зон</summary><textarea aria-label="JSON световых зон" value={json||JSON.stringify(p.windows,null,2)} onChange={e=>setJSON(e.target.value)}/><button onClick={()=>{try{update({windows:JSON.parse(json||JSON.stringify(p.windows))});}catch{setError('Некорректный JSON окон.');}}}>Применить зоны окон</button></details>
 </details>
 <div className="editor-actions"><button onClick={exportJSON}>Экспорт JSON</button><button onClick={reset}>Вернуть исходную раскладку</button></div>
 <small>Черновик сохраняется автоматически только в этом браузере. После экспорта: npm run map:layout -- путь-к-map-layout.json.</small><p role="alert">{error}</p>
 </section>;
}
