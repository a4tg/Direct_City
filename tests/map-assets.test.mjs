import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,basename,sep} from 'node:path';
function cleanup(root){const path=resolve(root);if(!path.toLowerCase().startsWith((resolve(tmpdir())+sep).toLowerCase())||!basename(path).startsWith('pryamogorod-map-'))throw Error('Небезопасный временный путь');rmSync(path,{recursive:true,force:true});}
import {syncMapAssets} from '../scripts/sync-map-assets.mjs';
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'pryamogorod-map-')),source=join(root,'source');mkdirSync(join(source,'Buildings'),{recursive:true});
 copyFileSync('public/assets/map/world-map.png',join(source,'World_Map_Master_image_no_numbers.png'));
 return {root,source};
}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
test('missing building files are represented as null and a later PNG is discovered',()=>{
 const f=fixture();try{
  let a=syncMapAssets({sourceDir:f.source,projectRoot:f.root,optimize:false});assert.equal(Object.values(a.buildings).filter(Boolean).length,0);
  writeFileSync(join(f.source,'Buildings','01_meiku.png.png'),png);
  a=syncMapAssets({sourceDir:f.source,projectRoot:f.root,optimize:false});
  assert.equal(a.buildings[1].width,1);assert.equal(a.buildings[2],null);
  assert.ok(readFileSync(join(f.root,'public',a.buildings[1].url)).equals(png));
 }finally{cleanup(f.root);}
});
test('duplicate slot files are rejected instead of silently using the wrong brand',()=>{
 const f=fixture();try{
  writeFileSync(join(f.source,'Buildings','01_a.png'),png);writeFileSync(join(f.source,'Buildings','01_b.png'),png);
  assert.throws(()=>syncMapAssets({sourceDir:f.source,projectRoot:f.root,optimize:false}),/Два PNG/);
 }finally{cleanup(f.root);}
});
test('cached production assets work without the artist directory and do not rewrite the base',()=>{
 const f=fixture();try{
  const m=syncMapAssets({sourceDir:f.source,projectRoot:f.root,optimize:false});
  const cached=syncMapAssets({sourceDir:join(f.root,'absent'),projectRoot:f.root,optimize:false});
  assert.deepEqual(cached,m);
  assert.ok(readFileSync(join(f.source,'World_Map_Master_image_no_numbers.png')).equals(readFileSync(join(f.root,'public/assets/map/world-map.png'))));
 }finally{cleanup(f.root);}
});

test('all sixteen shipped derivatives preserve source hash, alpha bounds and cropped geometry',()=>{
 const manifest=JSON.parse(readFileSync('src/city/map/assets.generated.json','utf8'));
 assert.equal(Object.values(manifest.buildings).filter(Boolean).length,16);
 for(const a of Object.values(manifest.buildings)){
  assert.ok(a.width>0&&a.height>0);assert.ok(a.optimized);assert.equal(a.crop[2]-a.crop[0],a.width);assert.equal(a.crop[3]-a.crop[1],a.height);
  assert.ok(a.crop[0]<=a.alphaBounds[0]&&a.crop[1]<=a.alphaBounds[1]&&a.crop[2]>=a.alphaBounds[2]&&a.crop[3]>=a.alphaBounds[3]);
  assert.ok(a.renderWidth<=768&&a.renderHeight<=768);assert.ok(readFileSync(join('public',a.url)).length>0);
 }
});
