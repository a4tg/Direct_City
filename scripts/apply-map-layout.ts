import {readFileSync,writeFileSync} from 'node:fs';
import {validateLayout} from '../src/city/map/math';
const path=process.argv[2];if(!path)throw Error('Укажите экспортированный JSON.');
const old=validateLayout(JSON.parse(readFileSync('src/city/map/layout.json','utf8')));
const next=validateLayout(JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,'')));
if(old.placements.map(p=>p.buildingId).sort().join()!==next.placements.map(p=>p.buildingId).sort().join())throw Error('ID зданий должны остаться прежними.');
if(next.placements.some(p=>old.placements.find(v=>v.buildingId===p.buildingId)?.slot!==p.slot))throw Error('Утверждённые номера площадок менять нельзя.');
writeFileSync('src/city/map/layout.json',JSON.stringify(next,null,2)+'\n');
console.log('Раскладка применена. Серверные открытия не изменены.');
