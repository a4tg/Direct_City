import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {visibility,buildingRect,validWindow,visibleWindows,UNLOCK,effectTypes} from '../src/city/map/visuals';
import {FogLayer} from '../src/city/map/FogLayer';
import {BuildingLayer} from '../src/city/map/BuildingLayer';
import {BuildingInfoPanel} from '../src/city/map/BuildingInfoPanel';
import {validateLayout,shouldReveal} from '../src/city/map/math';
import type {MapAssets} from '../src/city/map/types';
import type {Catalog} from '../src/city/types';
const layout=validateLayout(JSON.parse(readFileSync('src/city/map/layout.json','utf8')));
const assets:MapAssets=JSON.parse(readFileSync('src/city/map/assets.generated.json','utf8'));
const catalog:Catalog={
 districts:[0,1,2,3].map(i=>({id:'district-'+(i+1),name:'Район '+i,position:i})),
 brands:layout.placements.map(p=>({id:'brand-'+p.slot,name:p.title,mascot:'Персонаж',archetype:'',personality:'',worldRole:'Описание',theme:'',sourceRef:''})),
 buildings:layout.placements.map(p=>({id:p.buildingId,brandId:'brand-'+p.slot,districtId:'district-'+(Math.floor((p.slot-1)/4)+1),name:p.title,position:(p.slot-1)%4,moduleId:'pending',provisional:false})),designs:[]};
const world={buildings:[] as string[],districts:[] as string[]};
const fog=(visible=world,reveal:string|null=null,newDistrict:string|null=null)=>renderToStaticMarkup(<FogLayer catalog={catalog} visible={visible} placements={layout.placements} assets={assets} reveal={reveal} newDistrict={newDistrict}/>);
test('new user has four atmospheric districts and sixteen individual fogs',()=>{
 const html=fog();assert.equal((html.match(/data-fog-district=/g)??[]).length,4);assert.equal((html.match(/data-fog-building=/g)??[]).length,16);
});
test('first QR of each brand clears only its building and district; reload does not reveal again',()=>{
 for(const b of catalog.buildings){
  const visible=visibility(catalog,{buildings:[b.id],districts:[b.districtId]});
  const html=fog(visible);assert.equal((html.match(/data-fog-district=/g)??[]).length,3);assert.equal((html.match(/data-fog-building=/g)??[]).length,15);
  assert.ok(!html.includes('data-fog-building="'+b.id+'"'));assert.ok(!html.includes('fog-building-reveal'));
  assert.equal(shouldReveal({sceneId:null,buildingId:b.id},[b.id]),false);
  const reveal=fog(visible,b.id,b.districtId);assert.ok(reveal.includes('fog-building-reveal'));assert.ok(reveal.includes('fog-region-reveal'));
  assert.ok(!fog(visible,b.id).includes('fog-region-reveal'));
 }
});
test('preview visibility is derived separately and never mutates server progress',()=>{
 const snapshot=JSON.stringify(world);
 const all=visibility(catalog,world,{mode:'all',districtId:'district-1',fog:false,bounds:false});assert.equal(all.buildings.length,16);assert.equal(all.districts.length,4);
 const district=visibility(catalog,world,{mode:'district',districtId:'district-2',fog:true,bounds:false});assert.equal(district.buildings.length,4);assert.deepEqual(district.districts,['district-2']);
 assert.equal(JSON.stringify(world),snapshot);assert.deepEqual(visibility(catalog,world),world);
});
test('only one selected open house emits effects; locked houses emit none',()=>{
 const props={placements:layout.placements,assets,catalog,selected:layout.placements[0].buildingId,reveal:null,onTap:()=>{},debug:false,effectKey:1};
 const closed=renderToStaticMarkup(<BuildingLayer {...props} visible={[]}/>);assert.ok(!closed.includes('class="building-effect '));
 const open=renderToStaticMarkup(<BuildingLayer {...props} visible={catalog.buildings.map(b=>b.id)}/>);
 assert.equal((open.match(/class="building-effect /g)??[]).length,1);assert.equal((open.match(/<i/g)??[]).length>=3,true);
 assert.equal(new Set(layout.placements.map(p=>p.effect.type)).size,16);assert.equal(effectTypes.length,16);
});
test('all artwork stays in source bounds, keeps aspect ratio and avoids another house rectangle',()=>{
 const rects=layout.placements.map(p=>buildingRect(p,assets.buildings[String(p.slot)]));
 rects.forEach((r,i)=>{assert.ok(r.left>=-.01&&r.top>=0&&r.left+r.width<=941.01&&r.top+r.height<=1672);const a=assets.buildings[String(i+1)]!;assert.ok(Math.abs(r.width/r.height-a.width/a.height)<1e-8);});
 for(let i=0;i<16;i++)for(let j=i+1;j<16;j++){const a=rects[i],b=rects[j];assert.ok(a.left+a.width<=b.left||b.left+b.width<=a.left||a.top+a.height<=b.top||b.top+b.height<=a.top,'Overlap '+i+'/'+j);}
});
test('window zones reject invalid data and honour activation modes',()=>{
 const w={id:'window',points:[{x:.2,y:.2},{x:.3,y:.2},{x:.3,y:.3}],color:'#aabbcc',opacity:.5,duration:500,activation:'select' as const};
 assert.ok(validWindow(w));for(const patch of [{opacity:2},{duration:0},{color:'url(x)'},{activation:'always'},{points:[{x:2,y:0}]}])assert.equal(validWindow({...w,...patch} as any),false);
 assert.equal(visibleWindows([w],'unlock').length,0);assert.equal(visibleWindows([w],'select').length,1);
 const l=structuredClone(layout);l.placements[0].windows=[{...w,opacity:5}];assert.throws(()=>validateLayout(l));
});
test('closed cards lead to QR and expose no entry; open cards show server brand and description',()=>{
 const props={building:catalog.buildings[0],brand:catalog.brands[0],title:layout.placements[0].title,enter:()=>{},close:()=>{},scan:()=>{}};
 const locked=renderToStaticMarkup(<BuildingInfoPanel {...props} open={false}/>);assert.ok(locked.includes('Открыть QR-сканер'));assert.ok(!locked.includes('Войти'));
 const open=renderToStaticMarkup(<BuildingInfoPanel {...props} open/>);assert.ok(open.includes('Войти'));assert.ok(open.includes('Описание'));assert.ok(open.includes('Персонаж'));
});
test('unlock configuration is short, reduced motion is short and no visual config grants rewards',()=>{
 assert.ok(UNLOCK.duration>=1500&&UNLOCK.duration<=2500);assert.ok(UNLOCK.reducedDuration<300);assert.ok(UNLOCK.camera<UNLOCK.duration);
 assert.equal(Object.keys(UNLOCK).some(k=>/coin|reward/i.test(k)),false);
});

test('a reveal suppresses another selected house effect, keeping the three-particle budget',()=>{
 const html=renderToStaticMarkup(<BuildingLayer placements={layout.placements} assets={assets} catalog={catalog} visible={catalog.buildings.map(b=>b.id)} selected={layout.placements[0].buildingId} reveal={layout.placements[5].buildingId} onTap={()=>{}} debug={false} effectKey={1}/>);
 assert.equal((html.match(/class="building-effect /g)??[]).length,1);
 assert.ok(html.includes('effect-smoke'));assert.ok(!html.includes('effect-bell'));
});
