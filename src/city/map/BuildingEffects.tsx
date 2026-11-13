import React from 'react';
import type {CSSProperties} from 'react';
import type {Placement} from './types';
import {visibleWindows} from './visuals';
export function BuildingEffects({p,event}:{p:Placement;event:'select'|'unlock'}){
 const windows=visibleWindows(p.windows,event);
 return <>
 {windows.length>0&&<svg className="building-windows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{windows.map(w=><polygon key={w.id} points={w.points.map(p=>p.x*100+','+p.y*100).join(' ')} style={{fill:w.color??'#ffe9a5','--light-opacity':w.opacity??.65,'--light-duration':(w.duration??1800)+'ms'} as CSSProperties}/>)}</svg>}
 {p.effect.enabled&&<div className={'building-effect effect-'+p.effect.type} style={{left:p.effect.point.x*100+'%',top:p.effect.point.y*100+'%'}} aria-hidden="true"><i/><i/><i/></div>}
 </>;
}
