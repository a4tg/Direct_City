import {existsSync,readFileSync,readdirSync,mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const defaultMapSource=process.env.MAP_SOURCE_DIR??'C:/Users/artem/Desktop/мир MeikuNeko/MAP';
const hash=b=>createHash('sha256').update(b).digest('hex');
const size=b=>{if(b.subarray(1,4).toString()!=='PNG')throw Error('Ожидается PNG');return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)}};
export function syncMapAssets({sourceDir=defaultMapSource,projectRoot=root,optimize=true}={}){
 const dest=join(projectRoot,'public/assets/map'),manifestFile=join(projectRoot,'src/city/map/assets.generated.json');
 mkdirSync(dest,{recursive:true});mkdirSync(dirname(manifestFile),{recursive:true});
 const base=join(sourceDir,'World_Map_Master_image_no_numbers.png');
 if(!existsSync(base)){
  if(existsSync(manifestFile)&&existsSync(join(dest,'world-map.png')))return JSON.parse(readFileSync(manifestFile,'utf8').replace(/^\uFEFF/,''));
  throw Error('Не найдена утверждённая карта без номеров. Задайте MAP_SOURCE_DIR.');
 }
 const dir=join(sourceDir,'Buildings');
 const found=new Map();
 for(const name of existsSync(dir)?readdirSync(dir).sort():[]){
  const match=/^(\d{2})_.*\.png(?:\.png)?$/i.exec(name);if(!match)continue;
  const slot=Number(match[1]);if(slot<1||slot>16)continue;
  if(found.has(slot))throw Error('Два PNG для площадки '+slot+': '+found.get(slot)+' и '+name);
  found.set(slot,name);
 }
 const baseBytes=readFileSync(base),baseHash=hash(baseBytes);
 if(!existsSync(join(dest,'world-map.png'))||hash(readFileSync(join(dest,'world-map.png')))!==baseHash)copyFileSync(base,join(dest,'world-map.png'));
 const assets={};
 for(let slot=1;slot<=16;slot++){
  const name=found.get(slot);if(!name){assets[slot]=null;continue;}
  const source=join(dir,name),bytes=readFileSync(source),sha256=hash(bytes),dimensions=size(bytes);
  const stem='building-'+String(slot).padStart(2,'0')+'-'+sha256.slice(0,12)+'-trim2';
  let filename=stem+'.png',optimized=false,geometry=dimensions;
  if(optimize){
   const target=join(dest,stem+'.webp');
   const metadata=target+'.json';
   if(existsSync(target)&&existsSync(metadata)){optimized=true;geometry=JSON.parse(readFileSync(metadata,'utf8'));}
   else {const run=spawnSync(process.env.PYTHON??'python',[join(root,'scripts/prepare-map-image.py'),source,target],{windowsHide:true,stdio:'pipe'});optimized=run.status===0&&existsSync(target);if(optimized){geometry=JSON.parse(run.stdout.toString());writeFileSync(metadata,JSON.stringify(geometry));}}
   if(optimized)filename=stem+'.webp';
  }
  if(!optimized&&!existsSync(join(dest,filename)))copyFileSync(source,join(dest,filename));
  assets[slot]={url:'/assets/map/'+filename,sourceFile:name,sha256,...geometry,optimized,bytes:readFileSync(join(dest,filename)).length};
 }
 const manifest={base:{url:'/assets/map/world-map.png',...size(baseBytes),sha256:baseHash},buildings:assets};
 const content=JSON.stringify(manifest,null,2)+'\n';
 if(!existsSync(manifestFile)||readFileSync(manifestFile,'utf8')!==content)writeFileSync(manifestFile,content);
 return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const m=syncMapAssets();console.log('Карта: '+Object.values(m.buildings).filter(Boolean).length+'/16 PNG; оригиналы сохранены.');
}
