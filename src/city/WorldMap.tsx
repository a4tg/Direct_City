import {lazy,Suspense,useEffect,useRef,useState,type CSSProperties} from 'react';
import type {Catalog,World} from './types';
import sourceLayout from './map/layout.json';
import sourceAssets from './map/assets.generated.json';
import {MapCamera,type CameraControls} from './map/MapCamera';
import {BuildingLayer} from './map/BuildingLayer';
import {FogLayer} from './map/FogLayer';
import {BuildingInfoPanel} from './map/BuildingInfoPanel';
import {validateLayout} from './map/math';
import {UNLOCK,visibility,type Preview} from './map/visuals';
import type {MapLayout,MapAssets,Placement,Reveal} from './map/types';
import './map/map.css';
const Editor=import.meta.env.DEV?lazy(()=>import('./map/MapDevEditor')):null;
const defaults=validateLayout(sourceLayout),assets=sourceAssets as MapAssets;
export function WorldMap({catalog,world,enter,scan,reveal=null,onRevealComplete,notice=''}:{catalog:Catalog;world:World;enter:(id:string)=>void;scan:()=>void;reveal?:Reveal|null;onRevealComplete?:()=>void;notice?:string}){
 const camera=useRef<CameraControls>(null),scene=useRef<HTMLElement>(null);
 const [layout,setLayout]=useState<MapLayout>(defaults);
 const [selected,setSelected]=useState<string|null>(null),[showList,setShowList]=useState(false),[effectKey,setEffectKey]=useState(0);
 const [editing,setEditing]=useState(false),[moving,setMoving]=useState(false),[ready,setReady]=useState(false),[imageError,setImageError]=useState(false);
 const [editorSelected,setEditorSelected]=useState(defaults.placements[0].buildingId);
 const [preview,setPreview]=useState<Preview>({mode:'all',districtId:catalog.districts[0].id,fog:false,bounds:false});
 const [simulation,setSimulation]=useState<Reveal|null>(null),[simulated,setSimulated]=useState<string[]>([]);
 const dev=import.meta.env.DEV&&world.dev&&editing;
 const activeReveal=reveal??(dev?simulation:null);
 const storage='pryamogorod:map-layout-draft:v2';
 useEffect(()=>{if(import.meta.env.DEV&&world.dev){try{const raw=localStorage.getItem(storage);if(raw){const value=validateLayout(JSON.parse(raw));if(value.placements.map(p=>p.buildingId).sort().join()===defaults.placements.map(p=>p.buildingId).sort().join())setLayout(value);}}catch{}}},[world.dev]);
 const completeRef=useRef(onRevealComplete);completeRef.current=onRevealComplete;
 const finish=()=>{if(reveal)completeRef.current?.();else setSimulation(null);};
 const finishRef=useRef(finish);finishRef.current=finish;
 useEffect(()=>{
  if(!activeReveal||!ready)return;
  const p=layout.placements.find(p=>p.buildingId===activeReveal.buildingId);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(p){if(!reduced)camera.current?.focus(p.position,'reveal');setSelected(p.buildingId);setEffectKey(k=>k+1);}
  const timer=window.setTimeout(()=>finishRef.current(),reduced?UNLOCK.reducedDuration:UNLOCK.duration);
  return()=>clearTimeout(timer);
 },[activeReveal?.activationId,ready]);
 useEffect(()=>{if(!activeReveal)return;const timer=setTimeout(()=>finishRef.current(),6000);return()=>clearTimeout(timer);},[activeReveal?.activationId]);
 const select=(id:string)=>{
  if(dev){setEditorSelected(id);setSelected(id);setEffectKey(k=>k+1);return;}
  setSelected(id);setEffectKey(k=>k+1);
  const p=layout.placements.find(p=>p.buildingId===id);if(p)camera.current?.focus(p.position,'building');
 };
 const change=(p:Placement)=>setLayout(current=>{
  const next={...current,placements:current.placements.map(v=>v.buildingId===p.buildingId?p:v)};
  try{localStorage.setItem(storage,JSON.stringify(next));}catch{}return next;
 });
 const visible=visibility(catalog,world,dev?preview:undefined);
 if(dev&&simulated.length){visible.buildings=[...new Set([...visible.buildings,...simulated])];visible.districts=[...new Set([...visible.districts,...catalog.buildings.filter(b=>simulated.includes(b.id)).map(b=>b.districtId)])];}
 const selectedBuilding=catalog.buildings.find(b=>b.id===selected),brand=catalog.brands.find(b=>b.id===selectedBuilding?.brandId),placement=layout.placements.find(p=>p.buildingId===selected);
 const initial=layout.placements.find(p=>p.buildingId===world.user.firstBuilding)?.position??null;
 const revealedTitle=layout.placements.find(p=>p.buildingId===activeReveal?.buildingId)?.title;
 return <section ref={scene} className={'world-map-scene'+(dev?' editor-preview':'')} aria-label="Карта Прямогорода" style={{'--unlock-duration':UNLOCK.duration+'ms','--fog-duration':UNLOCK.fog+'ms','--appear-duration':UNLOCK.appear+'ms','--effect-duration':UNLOCK.effects+'ms'} as CSSProperties}>
  <div className="map-frame">
   <MapCamera ref={camera} userId={world.user.id} initial={initial} onTap={select} editing={dev&&moving} position={id=>layout.placements.find(p=>p.buildingId===id)!.position} onMove={(id,position)=>{const p=layout.placements.find(p=>p.buildingId===id);if(p)change({...p,position});}} onEditSelect={setEditorSelected}>
    <img className="map-base" src={assets.base.url} width={941} height={1672} alt="Прямогород: четыре квартала, дороги и центральный фонтан" draggable={false} onLoad={()=>setReady(true)} onError={()=>{setImageError(true);setReady(true);}}/>
    <div className="map-environment" aria-hidden="true"><i/><i/></div>
    <BuildingLayer placements={layout.placements} assets={assets} catalog={catalog} visible={visible.buildings} selected={selected} reveal={activeReveal?.buildingId??null} onTap={select} debug={dev&&preview.bounds} effectKey={effectKey}/>
    {(!dev||preview.fog)&&<FogLayer catalog={catalog} visible={visible} placements={layout.placements} assets={assets} reveal={activeReveal?.buildingId??null} newDistrict={activeReveal?.newDistrictId??null}/>}
    {dev&&preview.bounds&&<svg className="map-platforms" viewBox="0 0 941 1672" aria-hidden="true">{layout.placements.map(p=><g key={p.buildingId}><polygon points={p.platform.map(v=>v.x*941+','+v.y*1672).join(' ')}/><circle cx={p.position.x*941} cy={p.position.y*1672} r="5"/><text x={p.position.x*941} y={p.position.y*1672+25}>{p.slot}</text></g>)}</svg>}
   </MapCamera>
   <div className="map-heading"><span className="map-area-label">Город маленьких историй</span><span className="map-progress" aria-label={'Открыто зданий: '+world.buildings.length+' из 16'}><i aria-hidden="true">⌂</i> {world.buildings.length}<small> / 16</small></span></div>
   <div className="map-toolbar" aria-label="Камера карты">
    <button aria-label="Увеличить карту" title="Увеличить" onClick={()=>camera.current?.zoom(1.3)}>＋</button>
    <button aria-label="Уменьшить карту" title="Уменьшить" onClick={()=>camera.current?.zoom(1/1.3)}>−</button>
    <span className="toolbar-divider"/>
    <button aria-label="Площадь" title="К фонтану" onClick={()=>camera.current?.focus({x:.5,y:.43},'plaza')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v7m-4-5 4-2 4 2M5 15h14M7 11c0 5 10 5 10 0M4 18c2 4 14 4 16 0M12 12v7"/></svg></button>
    <button aria-label="Обзор" title="Обзор города" onClick={()=>camera.current?.overview()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5M9 9h6v6H9z"/></svg></button>
    <button aria-label="Здания" title="Все адреса" aria-expanded={showList} onClick={()=>setShowList(!showList)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7M8 10h1m6 0h1"/></svg></button>
   </div>
   {!world.buildings.length&&!selected&&!dev&&<div className="map-first-hint"><span>Каждая история начинается с двери</span><button onClick={scan}>Найти свой QR-стикер →</button></div>}
   {imageError&&<p className="map-image-error" role="alert">Не удалось загрузить карту. Проверьте синхронизацию ассетов.</p>}
   {selectedBuilding&&brand&&placement&&!dev&&!activeReveal&&<BuildingInfoPanel building={selectedBuilding} brand={brand} title={placement.title} open={world.buildings.includes(selectedBuilding.id)} scan={scan} enter={()=>{if(world.buildings.includes(selectedBuilding.id))enter(selectedBuilding.id);}} close={()=>setSelected(null)}/>}
   {notice&&!selected&&!activeReveal&&world.buildings.length>0&&<p className="map-notice" role="status">{notice}</p>}
   {activeReveal&&<div className="map-unlock-message" role="status"><small>НОВАЯ ИСТОРИЯ</small><strong>{revealedTitle}</strong><button onClick={finish}>Пропустить анимацию →</button></div>}
   {showList&&<div className="map-building-list" aria-label="Список зданий"><div className="map-list-title">Адреса города<button aria-label="Закрыть список" onClick={()=>setShowList(false)}>×</button></div>{layout.placements.map(p=>{const b=catalog.buildings.find(b=>b.id===p.buildingId),name=catalog.brands.find(v=>v.id===b?.brandId)?.name;return <button key={p.buildingId} onClick={()=>{setShowList(false);select(p.buildingId);}}>{String(p.slot).padStart(2,'0')} · {name}<span>{world.buildings.includes(p.buildingId)?'Открыто':'Нужен QR'}</span></button>;})}</div>}
   {import.meta.env.DEV&&world.dev&&<button className="map-editor-toggle" onClick={()=>{setEditing(!editing);setMoving(false);setSimulation(null);setSimulated([]);setSelected(null);}}>{dev?'Закрыть лабораторию':'Лаборатория карты'}</button>}
  </div>
  {dev&&Editor&&<Suspense fallback={<p>Открываем лабораторию…</p>}><Editor layout={layout} assets={assets} catalog={catalog} preview={preview} setPreview={v=>{setPreview(v);setSimulated([]);setSimulation(null);}} selected={editorSelected} select={id=>{setEditorSelected(id);setSelected(id);const p=layout.placements.find(p=>p.buildingId===id);if(p)camera.current?.focus(p.position,'editor');}} change={change} moving={moving} setMoving={setMoving} testEffect={()=>{scene.current?.scrollIntoView({block:'start'});setSelected(editorSelected);setEffectKey(k=>k+1);}} simulate={district=>{scene.current?.scrollIntoView({block:'start'});const b=catalog.buildings.find(b=>b.id===editorSelected)!;setPreview({...preview,mode:'closed',fog:true});setSimulated([editorSelected]);setSimulation({activationId:'preview-'+Date.now(),buildingId:editorSelected,...district?{newDistrictId:b.districtId}:{}});}} reset={()=>{setLayout(defaults);localStorage.removeItem(storage);}}/></Suspense>}
 </section>;
}
