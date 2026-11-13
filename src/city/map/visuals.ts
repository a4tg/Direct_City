import type {Catalog,World} from '../types';
import type {Placement,XY} from './types';
export const UNLOCK={duration:2200,reducedDuration:180,camera:360,fog:1700,appear:1450,effects:2400} as const;
export const effectTypes=['bell','paw','petals','curtain','spark','smoke','bubbles','lines','confetti','glow','stage','dramatic','pollen','bounce','showcase','scan'] as const;
export type WindowZone={id:string;points:XY[];color?:string;opacity?:number;duration?:number;activation?:'select'|'unlock'|'both'};
export type Preview={mode:'server'|'all'|'closed'|'district';districtId:string;fog:boolean;bounds:boolean};
export function visibility(catalog:Catalog,world:Pick<World,'buildings'|'districts'>,preview?:Preview){
 if(!preview||preview.mode==='server')return {buildings:world.buildings,districts:world.districts};
 const buildings=preview.mode==='all'?catalog.buildings.map(b=>b.id):preview.mode==='district'?catalog.buildings.filter(b=>b.districtId===preview.districtId).map(b=>b.id):[];
 return {buildings,districts:catalog.districts.filter(d=>catalog.buildings.some(b=>b.districtId===d.id&&buildings.includes(b.id))).map(d=>d.id)};
}
export function buildingRect(p:Placement,asset:{width:number;height:number}|null){
 const width=p.width*941,height=asset?width*asset.height/asset.width:width*.85;
 return {width,height,left:p.position.x*941-width*p.anchor.x,top:p.position.y*1672-height*p.anchor.y};
}
export function validWindow(w:WindowZone){
 return !!w&&typeof w.id==='string'&&w.id.length>0&&Array.isArray(w.points)&&w.points.length>=3&&w.points.every(p=>p&&[p.x,p.y].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1))&&
 (w.color===undefined||/^#[0-9a-f]{6}$/i.test(w.color))&&(w.opacity===undefined||(Number.isFinite(w.opacity)&&w.opacity>=0&&w.opacity<=1))&&
 (w.duration===undefined||(Number.isFinite(w.duration)&&w.duration>=100&&w.duration<=5000))&&
 (w.activation===undefined||['select','unlock','both'].includes(w.activation));
}
export function visibleWindows(windows:WindowZone[],event:'select'|'unlock'){
 return windows.filter(w=>!w.activation||w.activation==='both'||w.activation===event);
}
