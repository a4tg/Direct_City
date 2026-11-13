import { lazy, Suspense } from 'react';
import type { Brand,Building } from './types';
const MeikuAdapter=lazy(()=>import('./modules/MeikuAdapter'));
const KlimychGame=lazy(()=>import('../modules/klimych/KlimychGame'));
export function ModuleScreen({building,brand,userId}:{building:Building;brand:Brand;userId:string}) {
 if(building.moduleId==='klimych')return <Suspense fallback={<p>Открываем мастерскую…</p>}><KlimychGame buildingId={building.id} userId={userId}/></Suspense>;
 if(building.moduleId==='meiku')return <Suspense fallback={<p>Открываем дом Мэйку…</p>}><MeikuAdapter buildingId={building.id} userId={userId}/></Suspense>;
 return <section className="module-placeholder">
  <span className="eyebrow">{brand.name}</span><h2>{brand.mascot}</h2>
  <p>{brand.worldRole}</p><p>Здание открыто. Игровая механика этого места появится на следующем этапе.</p>
 </section>;
}