import type { RepairLevel,RepairStep,Point } from '../../../server/klimych-rules';
export function RepairObject({level,step,done,progress,point,collected}:{level:RepairLevel;step:RepairStep|undefined;done:string[];progress:number;point:Point|null;collected:boolean}) {
 const has=(id:string)=>done.includes(id);
 const path=step?.path;
 return <>
 <defs><pattern id="khatch" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M0 16L16 0" stroke="#222" strokeWidth="1" opacity=".15"/></pattern></defs>
 <rect x="30" y="35" width="940" height="590" rx="8" fill="url(#khatch)" stroke="#252525" strokeWidth="3"/>
 <path d="M70 575H930" stroke="#222" strokeWidth="4"/>
 <g stroke="#242424" strokeWidth="7" strokeLinejoin="round" fill="#faf8ef" className={'k-object '+(!done.length?'damaged':'')}>
 {level.objectId==='stool'&&<g>
  <path d="M300 290L320 540H370L380 290M590 290L610 540H665L650 290" transform={!has('seat')?'rotate(3 600 320)':undefined}/>
  <path d="M290 290L350 225H720L700 290Z" fill="#ddd9cc"/><rect x="290" y="270" width="410" height="45"/>
  <path d="M370 430H605" strokeWidth="20"/><circle cx="600" cy="350" r="25"/><path d="M585 350H615"/>
  {has('clamp')&&<path d="M645 305H695V400H630M630 375V430" strokeWidth="13" fill="none"/>}
 </g>}
 {level.objectId==='tap'&&<g>
  <path d="M130 550H850" strokeWidth="18"/><path d="M490 540V330Q490 250 560 250H730V300H560V540Z"/>
  <rect x="465" y="310" width="95" height="42"/><path d="M510 250V205H700" strokeWidth="20"/>
  <path d="M230 540V490H490" fill="none" strokeWidth="22"/><circle cx="230" cy="490" r="54" fill="#d7d3c9"/><path d="M195 490H265M230 455V525"/>
  {!has('water-off')&&<g className="k-drip"><path d="M730 355Q700 400 730 410Q760 400 730 355Z" fill="#777"/></g>}
  {has('cover')&&!has('assemble')&&<circle cx="510" cy="350" r="45" fill="#555"/>}
  {!has('gasket')&&<><circle cx="170" cy="350" r="37"/><circle cx="170" cy="350" r="18" fill="#333"/></>}
  {has('gasket')&&<circle cx="510" cy="350" r="20" fill="#fff"/>}
 </g>}
 {level.objectId==='shelf'&&<g>
  <path d="M170 160H820M170 160V540" strokeWidth="3" opacity=".3"/>
  <g transform={has('align')?'':'rotate(8 280 300)'}>
   <rect x="240" y="300" width="530" height="48" fill="#dad6c9"/><path d="M280 348V435L360 348M720 348V435L640 348" fill="#999"/>
  </g>
  {has('level-in')&&<><rect x="360" y="256" width="280" height="44"/><rect x="460" y="264" width="80" height="27"/><circle cx={has('align')?500:528} cy="278" r="8" fill="#222"/></>}
  <circle cx="280" cy="380" r="16"/><circle cx="720" cy="380" r="16"/>
 </g>}
 {level.objectId==='door'&&<g>
  <path d="M270 565V140H740V565" fill="#d2cfc4"/>
  <g transform={step?.id==='swing'&&point?'skewY('+Math.min(12,Math.max(0,(point.y-400)/10))+')':undefined}>
   <rect x="320" y="170" width="380" height="390"/><rect x="360" y="210" width="290" height="280"/><circle cx="665" cy="400" r="14" fill="#222"/>
  </g>
  <rect x="300" y="220" width="62" height="80"/><rect x="300" y="450" width="62" height="62"/>
  <path d={has('clip')?'M330 275H350':'M350 275H420'} strokeWidth="10"/>
  <path d="M320 250H340"/>
 </g>}
 {level.objectId==='drawer'&&<g>
  <rect x="220" y="160" width="560" height="390" fill="#c9c5b9"/>
  <rect x="250" y="205" width="500" height="300" fill="#555"/>
  <path d="M280 330H720M280 350H720" stroke="#eee"/>
  <g transform={has('pull')&&!has('push')?'translate(0 135)':undefined}>
   <path d="M260 290H740L785 410H215Z" fill="#aaa69a"/><rect x="215" y="315" width="570" height="95"/><path d="M450 350H550" strokeWidth="15"/>
  </g>
  {has('pull')&&!has('push')&&<circle cx="680" cy={has('align')?330:350} r="18" fill="#fff"/>}
 </g>}
 </g>
 {has('check')||has('test')||has('level-out')||has('swing')||has('glide')?<text x="500" y="100" textAnchor="middle" className="k-svg-label">ПРОВЕРЕНО · РАБОТАЕТ</text>:null}
 {step&&<g className="k-guides" fill="none" stroke="#292929" strokeWidth="3">
  {step.type==='trace'&&path&&<>
   <polyline points={path.map(p=>p.x+','+p.y).join(' ')} strokeDasharray="12 9" strokeWidth="10" stroke="#fff"/>
   <polyline points={path.map(p=>p.x+','+p.y).join(' ')} strokeDasharray="12 9"/>
   {path.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="25" fill="#fff"/><text x={p.x} y={p.y+8} className="k-svg-num">{i+1}</text></g>)}
  </>}
  {step.type==='sequence'?step.sequence?.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r={65} fill="#fff" fillOpacity=".8"/><text x={p.x} y={p.y+10} className="k-svg-num">{i+1}</text></g>):step.type!=='trace'&&<>
   <circle cx={step.zone.x} cy={step.zone.y} r={step.radius} strokeDasharray="10 7" fill="#fff" fillOpacity=".5"/>
   <circle cx={step.zone.x} cy={step.zone.y} r="7" fill="#222"/>
   {step.from&&<><circle cx={step.from.x} cy={step.from.y} r="48" strokeWidth="7"/><path d={'M'+step.from.x+' '+step.from.y+'L'+step.zone.x+' '+step.zone.y} strokeDasharray="10 10"/><text x={step.from.x} y={step.from.y-60} className="k-svg-label">ВЗЯТЬ</text></>}
   {step.type==='rotate'&&<>
    <circle cx={step.zone.x} cy={step.zone.y} r="115" strokeWidth="16" stroke="#fff"/>
    <circle cx={step.zone.x} cy={step.zone.y} r="115" strokeDasharray="15 8"/>
    <path d={'M'+(step.zone.x+115)+' '+step.zone.y+'l-15 -20m15 20l15 -20'} transform={step.turn!<0?'rotate(180 '+(step.zone.x+115)+' '+step.zone.y+')':undefined} strokeWidth="5"/>
    <text x={step.zone.x} y={step.zone.y-140} className="k-svg-label">{step.turn!<0?'ПРОТИВ ЧАСОВОЙ':'ПО ЧАСОВОЙ'} · ¾</text>
   </>}
  </>}
  {progress>0&&<circle cx={step.zone.x} cy={step.zone.y} r="95" strokeWidth="15" strokeDasharray={progress*597+' 597'} transform={'rotate(-90 '+step.zone.x+' '+step.zone.y+')'}/>}
  {collected&&<path d={'M'+(step.zone.x-140)+' '+step.zone.y+'h280M'+step.zone.x+' '+(step.zone.y-140)+'v280'} strokeDasharray="3 10" opacity=".55"/>}
 </g>}
 </>;
}
