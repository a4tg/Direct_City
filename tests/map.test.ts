import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clampCamera,zoomAt,focusCamera,minScale,bookmark,restoreCamera,frameZoom,releaseVelocity,isTap,shouldReveal,validateLayout} from '../src/city/map/math';
const layout=JSON.parse(readFileSync('src/city/map/layout.json','utf8'));
const b={width:320,height:570,mapWidth:941,mapHeight:1672};
test('sixteen placements use unique stable building IDs and source-map coordinates',()=>{
 const l=validateLayout(layout);assert.equal(l.placements.length,16);
 assert.equal(l.placements[0].buildingId,'building-meiku-neko');assert.equal(l.placements[4].buildingId,'building-klimych');
 for(const p of l.placements){assert.ok(p.platform.length>=3);assert.ok(Array.isArray(p.windows));assert.ok(p.width>=.08&&p.width<=.4);}
 for(let region=0;region<4;region++){const p=l.placements.slice(region*4,region*4+4);assert.ok(p[0].position.x<p[1].position.x);assert.ok(p[0].position.y<p[2].position.y);}
});
test('invalid placement imports cannot change shape, duplicate IDs or exceed valid ranges',()=>{
 for(const change of [(l:any)=>l.placements.pop(),(l:any)=>l.placements[1].slot=1,(l:any)=>l.placements[1].buildingId=l.placements[0].buildingId,(l:any)=>l.placements[0].width=2,(l:any)=>l.placements[0].windows=[{id:'x',points:[{x:3,y:0}]}]]){
  const value=structuredClone(layout);change(value);assert.throws(()=>validateLayout(value));
 }
});
test('zoom preserves the world point under the gesture within bounds',()=>{
 const c=focusCamera({x:0,y:0,s:1},b,{x:.5,y:.5},2),p={x:150,y:240};
 const next=zoomAt(c,b,1.2,p);
 assert.ok(Math.abs((p.x-c.x)/c.s-(p.x-next.x)/next.s)<.001);
 assert.ok(Math.abs((p.y-c.y)/c.s-(p.y-next.y)/next.s)<.001);
});
test('camera cannot shrink to nothing, escape city bounds or grow without limit',()=>{
 const c=clampCamera({x:99999,y:-99999,s:.0001},b);
 assert.equal(c.s,minScale(b));assert.ok(c.x>=0||c.x>=b.width-b.mapWidth*c.s);
 const huge=clampCamera({x:999,y:999,s:999},b);assert.equal(huge.s,minScale(b)*3);assert.ok(huge.x<=0&&huge.y<=0);
});
test('focus uses normalized source coordinates and stays valid after resizing',()=>{
 const c=focusCamera({x:0,y:0,s:1},b,layout.placements[0].position,2.2);
 assert.ok(Number.isFinite(c.x)&&Number.isFinite(c.y));
 const desktop={...b,width:1000,height:700},next=focusCamera(c,desktop,{x:.5,y:.5},2);
 assert.equal(next.s,minScale(desktop)*2);
});
test('dragging, pinching and long presses never become building taps',()=>{
 assert.equal(isTap(3,false,150),true);assert.equal(isTap(20,false,150),false);
 assert.equal(isTap(0,true,100),false);assert.equal(isTap(0,false,900),false);
});
test('only a server-confirmed new brand triggers a reveal, not refresh or duplicate design',()=>{
 assert.equal(shouldReveal({sceneId:'klimych-intro',buildingId:'building-klimych'},[]),true);
 assert.equal(shouldReveal({sceneId:null,buildingId:'building-klimych'},['building-klimych']),false);
 assert.equal(shouldReveal({sceneId:'klimych-meeting',buildingId:'building-klimych'},['building-klimych']),false);
});

test('two-pointer pinch scales and translates around the moving midpoint',async()=>{
 const {pinchCamera}=await import('../src/city/map/pinch');
 const c=focusCamera({x:0,y:0,s:1},b,{x:.5,y:.5},1.25);
 const before=[{x:100,y:250},{x:200,y:250}],after=[{x:60,y:260},{x:260,y:260}];
 const next=pinchCamera(c,b,before,after);
 assert.equal(next.s,c.s*2);
 assert.ok(Math.abs((150-c.x)/c.s-(160-next.x)/next.s)<.001);
 assert.ok(Math.abs((250-c.y)/c.s-(260-next.y)/next.s)<.001);
 assert.equal(pinchCamera(c,b,[],[]),c);
});


test('responsive overview fills width and keeps proportional geometry on mobile and desktop',()=>{
 for(const [width,height] of [[360,498],[390,542],[430,630],[1280,538],[1920,718]]){
  const bounds={...b,width,height},c=focusCamera({x:0,y:0,s:1},bounds,{x:.5,y:.43},1);
  assert.ok(Math.abs(c.s*bounds.mapWidth-width)<.001);assert.ok(Math.abs(c.x)<.001);
  assert.ok(c.y<=0&&c.y>=height-bounds.mapHeight*c.s);
  assert.equal(frameZoom(bounds,'plaza'),width<600?1:1.08);
 }
});
test('camera bookmarks survive reload and resize; legacy contain zoom upgrades without narrow bars',()=>{
 const desktop={...b,width:1200,height:600};
 const c=focusCamera({x:0,y:0,s:1},desktop,{x:.45,y:.7},1.8),saved=bookmark(c,desktop);
 assert.deepEqual(restoreCamera(saved,desktop),c);
 const mobile=restoreCamera(saved,b)!;assert.equal(mobile.s,minScale(b)*1.8);
 const old=restoreCamera({centerX:.5,centerY:.7,zoom:1.45},desktop,true)!;
 assert.equal(old.s,minScale(desktop));assert.equal(old.x,0);
 for(const value of [null,{}, {version:2,centerX:NaN,centerY:0,zoom:1},{version:3,centerX:0,centerY:0,zoom:1}])assert.equal(restoreCamera(value,b),null);
 const invalid=restoreCamera({version:2,centerX:9,centerY:-9,zoom:999},b)!;
 assert.deepEqual(clampCamera(invalid,b),invalid);assert.equal(invalid.s,minScale(b)*3);
});
test('inertia caps vector speed and never restarts after holding still',()=>{
 const v=releaseVelocity({x:10,y:10},0);assert.ok(Math.hypot(v.x,v.y)<=2.2000001);assert.equal(v.x,v.y);
 assert.deepEqual(releaseVelocity({x:1,y:1},101),{x:0,y:0});
 assert.deepEqual(releaseVelocity({x:.1,y:.2},10),{x:.1,y:.2});
});
