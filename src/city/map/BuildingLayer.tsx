import React from 'react';
import {memo,useState} from 'react';
import type {Placement,MapAssets} from './types';
import type {Catalog} from '../types';
import {BuildingEffects} from './BuildingEffects';
import {buildingRect} from './visuals';
export const BuildingLayer=memo(function BuildingLayer({placements,assets,catalog,visible,selected,reveal,onTap,debug,effectKey}:{placements:Placement[];assets:MapAssets;catalog:Catalog;visible:string[];selected:string|null;reveal:string|null;onTap:(id:string)=>void;debug:boolean;effectKey:number}){
 return <div className="map-building-layer">{placements.map(p=>{
  const b=catalog.buildings.find(b=>b.id===p.buildingId),brand=catalog.brands.find(brand=>brand.id===b?.brandId);
  return b&&brand?<BuildingSprite key={p.buildingId} p={p} asset={assets.buildings[String(p.slot)]} open={visible.includes(p.buildingId)} selected={selected===p.buildingId&&!reveal} reveal={reveal===p.buildingId} label={brand.name} debug={debug} onTap={onTap} effectKey={effectKey}/>:null;
 })}</div>;
});
function BuildingSprite({p,asset,open,selected,reveal,label,debug,onTap,effectKey}:{p:Placement;asset:MapAssets['buildings'][string];open:boolean;selected:boolean;reveal:boolean;label:string;debug:boolean;onTap:(id:string)=>void;effectKey:number}){
 const [failed,setFailed]=useState(false);
 const rect=buildingRect(p,asset);
 return <div className={['map-building',open?'open':'locked',selected?'selected':'',reveal?'revealing':''].join(' ')} data-building-id={p.buildingId} style={{...rect,zIndex:Math.round(p.position.y*1000)}} data-slot={p.slot}>
  <div className="building-picture" key={(reveal?'unlock':selected?effectKey:0)+p.buildingId}>
   {asset&&!failed?<img src={asset.url} width={asset.width} height={asset.height} alt="" draggable={false} onError={()=>setFailed(true)}/>:<div className="building-placeholder"><span>{String(p.slot).padStart(2,'0')}</span><small>{label}</small></div>}
   {open&&(selected||reveal)&&<BuildingEffects p={p} event={reveal?'unlock':'select'}/>}
  </div>
  <button className={'building-hit'+(debug?' debug':'')} data-building-id={p.buildingId} style={{left:(p.hit.x-p.hit.width/2)*100+'%',top:(p.hit.y-p.hit.height/2)*100+'%',width:p.hit.width*100+'%',height:p.hit.height*100+'%'}} aria-label={label+(open?' — открыто':' — нужен QR')} data-locked={!open} onClick={e=>{if(e.detail===0)onTap(p.buildingId);}}>
   <span className="building-badge">{open?'✦':'⌑'} {String(p.slot).padStart(2,'0')}</span>
  </button>
  {debug&&<><div className="anchor-cross" style={{left:p.anchor.x*100+'%',top:p.anchor.y*100+'%'}}>+</div><div className="entry-dot" style={{left:p.entry.x*100+'%',top:p.entry.y*100+'%'}}/></>}
 </div>;
}
