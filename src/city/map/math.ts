import {effectTypes,validWindow} from './visuals';
import type {XY,MapLayout} from './types';
export type Camera={x:number;y:number;s:number};
export type Bounds={width:number;height:number;mapWidth:number;mapHeight:number};
// Width-fit is the overview floor: portrait art never collapses into a narrow desktop strip.
export const minScale=(b:Bounds)=>b.width/b.mapWidth;
export function clampCamera(c:Camera,b:Bounds):Camera{
 const s=Math.max(minScale(b),Math.min(minScale(b)*3,c.s));
 const axis=(v:number,size:number,view:number)=>size<view?(view-size)/2:Math.max(view-size,Math.min(0,v));
 return {s,x:axis(c.x,b.mapWidth*s,b.width),y:axis(c.y,b.mapHeight*s,b.height)};
}
export function zoomAt(c:Camera,b:Bounds,factor:number,p:XY):Camera{
 const s=Math.max(minScale(b),Math.min(minScale(b)*3,c.s*factor));
 return clampCamera({s,x:p.x-(p.x-c.x)*s/c.s,y:p.y-(p.y-c.y)*s/c.s},b);
}
export function focusCamera(c:Camera,b:Bounds,p:XY,zoom=2):Camera{
 const s=minScale(b)*zoom;
 return clampCamera({s,x:b.width/2-p.x*b.mapWidth*s,y:b.height/2-p.y*b.mapHeight*s},b);
}

export type CameraFrame='building'|'reveal'|'plaza'|'editor';
export const frameZoom=(b:Bounds,frame:CameraFrame)=>frame==='plaza'?(b.width<600?1:1.08):frame==='editor'?(b.width<600?1.9:1.65):(b.width<600?1.55:1.35);
export type CameraBookmark={version:2;centerX:number;centerY:number;zoom:number};
export function bookmark(c:Camera,b:Bounds):CameraBookmark{
 return {version:2,centerX:(b.width/2-c.x)/(c.s*b.mapWidth),centerY:(b.height/2-c.y)/(c.s*b.mapHeight),zoom:c.s/minScale(b)};
}
export function restoreCamera(value:unknown,b:Bounds,legacy=false):Camera|null{
 if(!value||typeof value!=='object')return null;
 const v=value as CameraBookmark;
 if(![v.centerX,v.centerY,v.zoom].every(n=>typeof n==='number'&&Number.isFinite(n))||v.zoom<=0||(!legacy&&v.version!==2))return null;
 const zoom=legacy?v.zoom*Math.min(b.width/b.mapWidth,b.height/b.mapHeight)/minScale(b):v.zoom;
 return focusCamera({x:0,y:0,s:minScale(b)},b,{x:Math.max(0,Math.min(1,v.centerX)),y:Math.max(0,Math.min(1,v.centerY))},Math.max(1,Math.min(3,zoom)));
}
export function releaseVelocity(v:XY,age:number):XY{
 if(age>100)return {x:0,y:0};
 const factor=Math.min(1,2.2/Math.max(.001,Math.hypot(v.x,v.y)));
 return {x:v.x*factor,y:v.y*factor};
}

export const isTap=(distance:number,pinched:boolean,elapsed:number)=>!pinched&&distance<8&&elapsed<600;
export function shouldReveal(result:{sceneId:string|null;buildingId:string},known:string[]){return !!result.sceneId&&!known.includes(result.buildingId);}
export function validateLayout(value:unknown):MapLayout{
 const l=value as MapLayout;
 if(l?.version!==1||l.width!==941||l.height!==1672||!Array.isArray(l.placements)||l.placements.length!==16)throw Error('Нужны 16 площадок карты 941×1672.');
 const ids=new Set<string>(),slots=new Set<number>();
 const unit=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1;
 const point=(p:XY)=>p&&unit(p.x)&&unit(p.y);
 for(const p of l.placements){
  if(!p||!/^building-[a-z0-9-]+$/.test(p.buildingId)||ids.has(p.buildingId)||!Number.isInteger(p.slot)||p.slot<1||p.slot>16||slots.has(p.slot)||!point(p.position)||!point(p.anchor)||!point(p.entry)||!unit(p.width)||p.width<.08||p.width>.4||!Array.isArray(p.platform)||p.platform.length<3||!p.platform.every(point)||!p.hit||![p.hit.x,p.hit.y,p.hit.width,p.hit.height].every(unit)||!p.hit.width||!p.hit.height||!Array.isArray(p.windows)||p.windows.some(w=>!validWindow(w))||!p.effect||!point(p.effect.point)||!effectTypes.includes(p.effect.type)||typeof p.effect.enabled!=='boolean')throw Error('Некорректная площадка.');
  ids.add(p.buildingId);slots.add(p.slot);
 }
 return l;
}
