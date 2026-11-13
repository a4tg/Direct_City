import { useState } from 'react';
import QRCode from 'qrcode';
import type {Catalog} from './types';
import {api} from './api';

export function DevTools({catalog,reset,activate,refresh}:{catalog:Catalog;reset:()=>Promise<void>;activate:(token:string)=>Promise<void>;refresh:()=>Promise<void>}) {
 const [brand,setBrand]=useState(catalog.brands[0]?.id??'');
 const [design,setDesign]=useState('');
 const [issued,setIssued]=useState<{token:string;link:string;image:string}|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const items=catalog.designs.filter(item=>item.brandId===brand);
 const selected=items.find(item=>item.id===design)?.id??items[0]?.id;
 async function run(action:()=>Promise<void>) {setBusy(true);setError('');try{await action();}catch(error){setError((error as Error).message);}finally{setBusy(false);}}
 async function issue() {
  const result=await api<{token:string;link:string}>('/dev/qr','POST',{designId:selected});
  setIssued({...result,image:await QRCode.toDataURL(result.link,{width:240,margin:2})});
 }
 return <details className="dev-tools"><summary>Режим разработчика</summary>
  <p>Выберите любой бренд первым. Новая тестовая игра создаёт отдельного пользователя и сохраняет прежние записи в базе.</p>
  <button disabled={busy} onClick={()=>void run(async()=>{await reset();setIssued(null);})}>Начать новую тестовую игру</button>
  <label className="field">Первый или следующий бренд<select value={brand} onChange={event=>{setBrand(event.target.value);setDesign('');}}>
   {catalog.brands.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
  </select></label>
  <label className="field">Дизайн<select value={selected??''} onChange={event=>setDesign(event.target.value)}>
   {items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
  </select></label>
  <button disabled={busy||!selected} onClick={()=>void run(issue)}>Создать новый тестовый QR</button>
  {issued&&<div className="test-qr"><img src={issued.image} alt="Тестовый QR"/><a href={issued.link}>Открыть QR-ссылку</a>
   <button disabled={busy} onClick={()=>void run(()=>activate(issued.token))}>Активировать этот QR</button>
   <small>Чтобы проверить повторный дизайн, создайте новый QR для того же дизайна. Повторное нажатие текущего QR проверяет запрет повторного использования.</small>
  </div>}
  <label className="field">Импорт каталога JSON<input type="file" accept=".json,application/json" disabled={busy} onChange={event=>{
   const file=event.target.files?.[0];if(!file)return;
   void run(async()=>{await api('/dev/catalog/import','POST',JSON.parse(await file.text()));await refresh();});
  }}/></label><p role="alert">{error}</p>
 </details>;
}