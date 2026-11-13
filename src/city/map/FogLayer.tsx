import React from 'react';
import {useId} from 'react';
import type {Catalog} from '../types';
import type {Placement,MapAssets} from './types';
import {buildingRect} from './visuals';
const regions=['M-30 -30H455L438 180 443 350 428 540 320 620 -30 570Z','M480 -30H971V610L790 645 550 585 482 490 484 250Z','M-30 830L300 850 443 870 453 1100 432 1440 -30 1500Z','M515 850L971 820V1480L750 1490 497 1360 492 1130Z'];
export function FogLayer({catalog,visible,placements,assets,reveal,newDistrict}:{catalog:Catalog;visible:{buildings:string[];districts:string[]};placements:Placement[];assets:MapAssets;reveal:string|null;newDistrict:string|null}){
 const id=useId().replaceAll(':','');
 return <svg className="map-fog" viewBox="0 0 941 1672" aria-hidden="true">
 <defs>
  <radialGradient id={id+'cloud'}><stop stopColor="#e5deef" stopOpacity=".94"/><stop offset=".48" stopColor="#cbc6e0" stopOpacity=".83"/><stop offset="1" stopColor="#dcd7ea" stopOpacity="0"/></radialGradient>
  <linearGradient id={id+'district'} x2=".7" y2="1"><stop stopColor="#79728e" stopOpacity=".3"/><stop offset=".55" stopColor="#afa2c5" stopOpacity=".23"/><stop offset="1" stopColor="#d6c6de" stopOpacity=".12"/></linearGradient>
  <filter id={id+'soft'} x="-.2" y="-.2" width="1.4" height="1.4"><feGaussianBlur stdDeviation="16"/></filter>
 </defs>
 <g className="district-fog">{catalog.districts.filter(d=>!visible.districts.includes(d.id)||d.id===newDistrict).map(d=><g key={d.id} className={d.id===newDistrict?'fog-region-reveal':''} data-fog-district={d.id}>
 <path d={regions[d.position]} fill={'url(#'+id+'district)'} filter={'url(#'+id+'soft)'}/>
 <g className="district-cloud"><ellipse cx={d.position%2?730:220} cy={d.position<2?370:1120} rx="235" ry="260" fill={'url(#'+id+'cloud)'} opacity=".32"/></g>
 </g>)}</g>
 <g className="building-fog">{placements.filter(p=>!visible.buildings.includes(p.buildingId)||p.buildingId===reveal).map(p=>{
 const r=buildingRect(p,assets.buildings[String(p.slot)]),cx=r.left+r.width*.5,cy=r.top+r.height*.57;
 return <g key={p.buildingId} data-fog-building={p.buildingId} className={p.buildingId===reveal?'fog-building-reveal':''}>
 <ellipse cx={cx} cy={cy} rx={r.width*.76} ry={r.height*.57} fill={'url(#'+id+'cloud)'}/>
 <ellipse cx={cx-r.width*.22} cy={cy+r.height*.16} rx={r.width*.52} ry={r.height*.32} fill={'url(#'+id+'cloud)'} opacity=".62"/>
 <ellipse cx={cx+r.width*.28} cy={cy-r.height*.1} rx={r.width*.46} ry={r.height*.4} fill={'url(#'+id+'cloud)'} opacity=".52"/>
 </g>;
 })}</g></svg>;
}
