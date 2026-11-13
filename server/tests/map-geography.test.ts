import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pool} from '../db.js';
import {buildApp} from '../app.js';
const origin='http://localhost:5173',app=buildApp({dev:true,origin,duplicateReward:10,secureCookies:false});
before(async()=>{assert.ok(process.env.DATABASE_URL);assert.match((await pool.query('SELECT current_database() AS name')).rows[0].name,/_test$/);});
after(async()=>{await app.close();await pool.end();});
test('map migration preserves opened buildings, first character, wallet, collection, scene and module data',async()=>{
 const db=await pool.connect(),id=randomUUID();
 try{
  await db.query('BEGIN');
  await db.query('ALTER TABLE buildings DROP CONSTRAINT buildings_district_id_position_key');
  const old=['meiku-neko','klimych','ouborka','petpower','multizavrik','walnut','rastvor','generalim','yesmix','paw-factory','nuzhnoe','toutes-peaux','hobbylab','mymania','koyo','pole-yagoda'];
  for(let i=0;i<old.length;i++)await db.query('UPDATE buildings SET district_id=$1,position=$2 WHERE id=$3',['district-'+(Math.floor(i/4)+1),i%4,'building-'+old[i]]);
  await db.query('ALTER TABLE buildings ADD CONSTRAINT buildings_district_id_position_key UNIQUE(district_id,position)');
  await db.query("INSERT INTO users(id,first_building) VALUES($1,'building-klimych')",[id]);
  await db.query("INSERT INTO wallets(user_id,balance) VALUES($1,23)",[id]);
  await db.query("INSERT INTO unlocked_buildings(user_id,building_id) VALUES($1,'building-klimych'),($1,'building-meiku-neko')",[id]);
  await db.query("INSERT INTO unlocked_districts(user_id,district_id) VALUES($1,'district-1')",[id]);
  await db.query("INSERT INTO user_collection(user_id,design_id) VALUES($1,'meiku-neko-01')",[id]);
  await db.query("INSERT INTO user_scenes(user_id,scene_id,completed_at) VALUES($1,'klimych-intro',now())",[id]);
  await db.query("INSERT INTO module_saves(user_id,building_id,data) VALUES($1,'building-meiku-neko',$2)",[id,{progress:{coins:1000500000,friendship:53}}]);
  const snapshot=async()=>({
   first:(await db.query('SELECT first_building FROM users WHERE id=$1',[id])).rows,
   wallet:(await db.query('SELECT balance FROM wallets WHERE user_id=$1',[id])).rows,
   buildings:(await db.query('SELECT building_id FROM unlocked_buildings WHERE user_id=$1 ORDER BY building_id',[id])).rows,
   collection:(await db.query('SELECT design_id FROM user_collection WHERE user_id=$1',[id])).rows,
   scene:(await db.query('SELECT scene_id,completed_at FROM user_scenes WHERE user_id=$1',[id])).rows,
   save:(await db.query('SELECT data,revision FROM module_saves WHERE user_id=$1',[id])).rows,
  });
  const prior=await snapshot();
  await db.query(readFileSync('server/migrations/003_map_geography.sql','utf8'));
  assert.deepEqual(await snapshot(),prior);
  assert.deepEqual((await db.query('SELECT district_id FROM unlocked_districts WHERE user_id=$1 ORDER BY district_id',[id])).rows.map(r=>r.district_id),['district-1','district-2']);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM unlocked_buildings WHERE user_id=$1",[id])).rows[0].n,2);
 }finally{await db.query('ROLLBACK');db.release();}
});
test('catalog reimport cannot silently move an existing building between map slots',async()=>{
 const user=await app.inject({method:'POST',url:'/api/session',headers:{origin},payload:{}});
 const cookie=String(user.headers['set-cookie']).split(';')[0];
 const catalog=JSON.parse(readFileSync('server/content/catalog.json','utf8').replace(/^\uFEFF/,''));
 const same=catalog.brands.filter((b:any)=>b.building.districtId==='district-1');
 [same[0].building.position,same[1].building.position]=[same[1].building.position,same[0].building.position];
 const before=(await pool.query('SELECT id,district_id,position FROM buildings ORDER BY id')).rows;
 const result=await app.inject({method:'POST',url:'/api/dev/catalog/import',headers:{origin,cookie},payload:catalog});
 assert.equal(result.statusCode,400);
 assert.deepEqual((await pool.query('SELECT id,district_id,position FROM buildings ORDER BY id')).rows,before);
});
