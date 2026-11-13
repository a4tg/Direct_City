import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { pool } from '../db.js';
import { levels,tools } from '../klimych-rules.js';
const origin='http://localhost:5173';
const app=buildApp({dev:true,origin,duplicateReward:10,secureCookies:false});
const call=(method:'GET'|'POST'|'PUT',url:string,cookie?:string,payload?:unknown)=>app.inject({method,url,headers:{origin,...cookie?{cookie}:{}},payload:payload as Record<string,unknown>});
before(async()=>{assert.ok(process.env.DATABASE_URL);assert.match((await pool.query('SELECT current_database() AS name')).rows[0].name,/_test$/);});
after(async()=>{await app.close();await pool.end();});
async function user(unlock=true){
 const res=await call('POST','/api/session',undefined,{});
 const cookie=String(res.headers['set-cookie']).split(';')[0];
 if(unlock){
  const token=(await call('POST','/api/dev/qr',cookie,{designId:'klimych-01'})).json().token;
  assert.equal((await call('POST','/api/qr/redeem',cookie,{token})).statusCode,200);
 }
 return cookie;
}
async function workshop(cookie:string){return (await call('GET','/api/modules/building-klimych/workshop',cookie)).json();}
async function tutorial(cookie:string){
 const current=await workshop(cookie);
 return call('PUT','/api/modules/building-klimych',cookie,{revision:current.revision,data:{tutorialSeen:true}});
}
test('closed building is protected; tutorial and level availability are server checked',async()=>{
 const cookie=await user(false);
 assert.equal((await call('GET','/api/modules/building-klimych/workshop',cookie)).statusCode,403);
 assert.equal((await call('POST','/api/modules/building-klimych/runs',cookie,{levelId:'stool'})).statusCode,403);
 const open=await user();
 assert.equal((await call('POST','/api/modules/building-klimych/runs',open,{levelId:'stool'})).statusCode,409);
 assert.equal((await tutorial(open)).statusCode,200);
 assert.equal((await call('POST','/api/modules/building-klimych/runs',open,{levelId:'drawer'})).statusCode,403);
 const saved=await workshop(open);
 assert.deepEqual(saved.collectedTools,['klimych-01']);assert.equal(saved.rewardsEnabled,false);
 assert.equal((await call('PUT','/api/modules/building-klimych',open,{revision:saved.revision,data:{best:{stool:100},tutorialSeen:true}})).statusCode,400);
});
test('all five jobs save results and medals; finish is idempotent, concurrent and never credits money',async()=>{
 const cookie=await user();await tutorial(cookie);
 const before=(await call('GET','/api/world',cookie)).json().balance;
 for(const level of levels){
  const started=await call('POST','/api/modules/building-klimych/runs',cookie,{levelId:level.id});
  assert.equal(started.statusCode,200);
  const payload={elapsedMs:25000,errors:0,steps:level.steps.map(s=>({stepId:s.id,precision:1}))};
  const url='/api/modules/building-klimych/runs/'+started.json().runId+'/finish';
  assert.equal((await call('POST',url,cookie,{...payload,coins:1000})).statusCode,400);
  assert.equal((await call('POST',url,cookie,{...payload,steps:[{stepId:'fake',precision:1}]})).statusCode,400);
  const responses=await Promise.all([call('POST',url,cookie,payload),call('POST',url,cookie,payload)]);
  assert.ok(responses.every(r=>r.statusCode===200));
  assert.deepEqual(responses[0].json().result,responses[1].json().result);
  assert.equal(responses.filter(r=>r.json().replayed).length,1);
  assert.equal(responses[0].json().result.completed,true);
 }
 const progress=await workshop(cookie);
 assert.equal(progress.progress.completed.length,5);assert.equal(progress.progress.unlocked.length,5);
 assert.equal(Object.keys(progress.progress.best).length,5);
 assert.equal((await call('GET','/api/world',cookie)).json().balance,before);
 const id=(await call('POST','/api/session',cookie,{})).json().userId;
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM coin_ledger WHERE user_id=$1',[id])).rows[0].n,0);
 const restarted=buildApp({dev:true,origin,duplicateReward:10,secureCookies:false});
 try{
  const reloaded=await restarted.inject({method:'GET',url:'/api/modules/building-klimych/workshop',headers:{cookie}});
  assert.deepEqual(reloaded.json(),progress);
 }finally{await restarted.close();}
});
test('run ownership, revision conflicts, timeout and collection-derived tools are preserved',async()=>{
 const one=await user(),two=await user();await tutorial(one);await tutorial(two);
 const started=(await call('POST','/api/modules/building-klimych/runs',one,{levelId:'stool'})).json();
 const url='/api/modules/building-klimych/runs/'+started.runId+'/finish';
 const payload={elapsedMs:60000,errors:0,steps:[]};
 assert.equal((await call('POST',url,two,payload)).statusCode,404);
 assert.equal((await call('POST',url,one,payload)).json().result.medal,'retry');
 assert.deepEqual((await workshop(one)).progress.unlocked,['stool']);
 const current=await workshop(one);
 assert.equal((await call('PUT','/api/modules/building-klimych',one,{revision:0,data:{tutorialSeen:true}})).statusCode,409);
 const token=(await call('POST','/api/dev/qr',one,{designId:'klimych-05'})).json().token;
 await call('POST','/api/qr/redeem',one,{token});
 assert.ok((await workshop(one)).collectedTools.includes(tools[4].designId));
 assert.equal((await workshop(one)).revision,current.revision);
});
