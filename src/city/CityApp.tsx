import { useCallback, useEffect, useRef, useState } from 'react';
import type { Catalog,World,Redemption } from './types';
import { api } from './api';
import {shouldReveal} from './map/math';
import type {Reveal} from './map/types';
import { WorldMap } from './WorldMap';
import { Collection } from './Collection';
import { QRScanner,tokenFromLink } from './QRScanner';
import { Story } from './Story';
import { ModuleScreen } from './ModuleScreen';
import './city.css';
import { DevTools } from './DevTools';

export function CityApp() {
 const [catalog,setCatalog]=useState<Catalog|null>(null);
 const [world,setWorld]=useState<World|null>(null);
 const [tab,setTab]=useState<'map'|'album'|'qr'>('map');
 const [buildingId,setBuildingId]=useState<string|null>(null);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [reveal,setReveal]=useState<Reveal|null>(null);
 const worldRef=useRef(world);worldRef.current=world;
 const [retry,setRetry]=useState(0);
 const handled=useRef(new Set<string>());
 const pending=useRef<string|null>(null);
 const refresh=useCallback(async()=>{
  const [nextCatalog,nextWorld]=await Promise.all([api<Catalog>('/catalog'),api<World>('/world')]);
  setCatalog(nextCatalog);setWorld(nextWorld);
 },[]);
 useEffect(()=>{
  let active=true;
  void api('/session','POST',{}).then(()=>Promise.all([api<Catalog>('/catalog'),api<World>('/world')]))
   .then(([nextCatalog,nextWorld])=>{if(active){setCatalog(nextCatalog);setWorld(nextWorld);setError('');}})
   .catch(error=>{if(active)setError((error as Error).message);});
  return()=>{active=false;};
 },[retry]);
 const activate=useCallback(async(token:string)=>{
  if(pending.current)return;
  pending.current=token;setBusy(true);setError('');
  try{
   const result=await api<Redemption>('/qr/redeem','POST',{token});
   setNotice(result.duplicate?'Этот дизайн уже в альбоме. Начислено городских монет: '+result.reward+'.':'Новый стикер добавлен в альбом.');
   const animate=shouldReveal(result,worldRef.current?.buildings??[]);
   const districtId=catalog?.buildings.find(b=>b.id===result.buildingId)?.districtId;
   const newDistrictId=districtId&&!worldRef.current?.districts.includes(districtId)?districtId:undefined;
   await refresh();setBuildingId(null);setTab('map');if(animate)setReveal({activationId:result.activationId,buildingId:result.buildingId,newDistrictId});
  }catch(error){setError((error as Error).message);throw error;}
  finally{pending.current=null;setBusy(false);}
 },[refresh,catalog]);
 useEffect(()=>{
  if(!world)return;
  const scan=()=>{
   if(!location.hash.startsWith('#qr='))return;
   try{
    const token=tokenFromLink(location.href);
    history.replaceState(null,'',location.pathname+location.search);
    if(handled.current.has(token))return;
    handled.current.add(token);void activate(token).catch(()=>{});
   }catch(error){setError((error as Error).message);}
  };
  scan();window.addEventListener('hashchange',scan);
  return()=>window.removeEventListener('hashchange',scan);
 },[world,activate]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(timer);},[notice]);
 const scene=world?.scenes.find(item=>!item.completedAt);
 const building=catalog?.buildings.find(item=>item.id===buildingId);
 const brand=catalog?.brands.find(item=>item.id===building?.brandId);
 const mapMode=!!world&&!!catalog&&(!!reveal||(!scene&&!building&&tab==='map'));
 return <div className={'city-shell'+(mapMode?' map-mode':'')}>
  <header className="city-header"><button className="city-logo" onClick={()=>{setBuildingId(null);setTab('map');}}>Прямогород<span>город маленьких историй</span></button>
   {world&&<span className="city-coins" aria-label={'Городские монеты: '+world.balance}>✦ {BigInt(world.balance).toLocaleString('ru-RU')}</span>}
  </header>
  <main className="city-main">
   {error&&<div className="city-message error" role="alert">{error}<button onClick={()=>{setError('');if(!world)setRetry(retry+1);}}>{world?'Закрыть':'Повторить'}</button></div>}
   {notice&&!reveal&&(scene||building||tab!=='map')&&<p className="city-message" role="status">{notice}</p>}
   {!world||!catalog?<p>Загружаем город…</p>:reveal?<WorldMap catalog={catalog} world={world} notice={notice} scan={()=>setTab('qr')} enter={()=>{}} reveal={reveal} onRevealComplete={()=>setReveal(null)}/>:scene?<Story key={scene.id} scene={scene} onComplete={refresh}/>:
    building&&brand?<><button className="back-map" onClick={()=>setBuildingId(null)}>← На карту</button>
     <ModuleScreen building={building} brand={brand} userId={world.user.id}/></>:
    tab==='map'?<WorldMap catalog={catalog} world={world} notice={notice} scan={()=>{setBuildingId(null);setTab('qr');}} enter={id=>{if(world.buildings.includes(id))setBuildingId(id);}}/>:
    tab==='album'?<Collection catalog={catalog} world={world}/>:<QRScanner activate={activate}/>}
   {import.meta.env.DEV&&world?.dev&&catalog&&!building&&!scene&&<DevTools catalog={catalog} activate={activate} refresh={refresh} reset={async()=>{
    await api('/dev/new-game','POST',{});handled.current.clear();setReveal(null);setNotice('Начата новая тестовая игра.');setBuildingId(null);setTab('map');await refresh();
   }}/>}
  </main>
  <nav className="city-nav" aria-label="Прямогород">
   <button disabled={busy} aria-current={!building&&tab==='map'?'page':undefined} onClick={()=>{setBuildingId(null);setTab('map');}}><NavIcon kind="map"/><span>Карта</span></button>
   <button disabled={busy} aria-current={!building&&tab==='album'?'page':undefined} onClick={()=>{setBuildingId(null);setTab('album');}}><NavIcon kind="album"/><span>Коллекция</span></button>
   <button disabled={busy} aria-current={!building&&tab==='qr'?'page':undefined} onClick={()=>{setBuildingId(null);setTab('qr');}}><NavIcon kind="qr"/><span>QR-стикер</span></button>
  </nav>
 </div>;
}
function NavIcon({kind}:{kind:'map'|'album'|'qr'}){
 return <svg viewBox="0 0 24 24" aria-hidden="true">{kind==='map'?<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zm6-3v15m6-12v15"/>:kind==='album'?<path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-7-2-10 1zm0 0v15M5 8h3m-3 4h3m8-4h3m-3 4h3"/>:<path d="M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h2v2h-2zm4 0h2v6h-6v-2m-3-7h3m-3 3v3M6 5v2m12-2v2M6 17v2"/>}</svg>;
}
