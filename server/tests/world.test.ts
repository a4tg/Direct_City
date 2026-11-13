import { test,after,before,beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { pool } from '../db.js';
import { hash,issueToken } from '../world.js';
const origin='http://localhost:5173';
let app=buildApp({dev:true,origin,duplicateReward:10,secureCookies:false});
const production=buildApp({dev:false,origin,duplicateReward:10,secureCookies:true});
const call=(method:'GET'|'POST'|'PUT',url:string,cookie?:string,payload?:unknown)=>app.inject({method,url,headers:{origin,'content-type':'application/json',...cookie?{cookie}:{}},payload:payload===undefined?undefined:JSON.stringify(payload)});
async function session() {
 const response=await call('POST','/api/session',undefined,{});
 assert.equal(response.statusCode,200);
 return {cookie:String(response.headers['set-cookie']).split(';')[0],id:response.json().userId as string};
}
async function issue(cookie:string,designId:string) {
 const response=await call('POST','/api/dev/qr',cookie,{designId});
 assert.equal(response.statusCode,200);
 return response.json().token as string;
}
before(async()=>{
 assert.ok(process.env.DATABASE_URL,'Укажите DATABASE_URL отдельной тестовой базы.');
 const database=(await pool.query('SELECT current_database() AS name')).rows[0].name;
 assert.match(database,/_test$/, 'Интеграционные тесты разрешены только в базе с суффиксом _test.');
});
beforeEach(async()=>{
 await app.close();
 app=buildApp({dev:true,origin,duplicateReward:10,secureCookies:false});
});
after(async()=>{await app.close();await production.close();await pool.end();});

test('all sixteen brands can be first and later buildings get a meeting scene',async()=>{
 const catalog=(await call('GET','/api/catalog')).json();
 assert.equal(catalog.brands.length,16);assert.equal(catalog.designs.length,256);assert.equal(catalog.districts.length,4);
 for (const brand of catalog.brands) {
  const user=await session();
  let state=(await call('GET','/api/world',user.cookie)).json();
  assert.deepEqual(state.buildings,[]);assert.equal(state.user.firstBuilding,null);
  const design=catalog.designs.find((item:{brandId:string})=>item.brandId===brand.id);
  const token=await issue(user.cookie,design.id);
  const result=await call('POST','/api/qr/redeem',user.cookie,{token});
  assert.equal(result.statusCode,200);assert.equal(result.json().sceneId,brand.id+'-intro');
  state=(await call('GET','/api/world',user.cookie)).json();
  const expected=catalog.buildings.find((b:{brandId:string})=>b.brandId===brand.id);
  assert.deepEqual(state.buildings,[expected.id]);assert.deepEqual(state.districts,[expected.districtId]);
  assert.equal(state.user.firstBuilding,expected.id);assert.deepEqual(state.collection,[design.id]);
  assert.equal(state.scenes[0].id,brand.id+'-intro');assert.equal(state.scenes[0].brandId,brand.id);
  assert.equal(state.scenes[0].script.nodes[0].speaker,brand.mascot);
  assert.equal(state.collection.length,1);
  assert.equal((await call('POST','/api/scenes/'+brand.id+'-intro/complete',user.cookie,{choices:['invalid']})).statusCode,400);
  assert.equal((await call('POST','/api/scenes/'+brand.id+'-intro/complete',user.cookie,{choices:[brand.id==='meiku-neko'?'look':'hello']})).statusCode,200);
  const second=catalog.designs.find((item:{brandId:string})=>item.brandId!==brand.id);
  const next=await issue(user.cookie,second.id);
  const meeting=(await call('POST','/api/qr/redeem',user.cookie,{token:next})).json();
  assert.equal(meeting.sceneId,second.brandId+'-meeting');
 }
});

test('token redemption is atomic and duplicate design rewards are server-owned',async()=>{
 const user=await session();
 const first=await issue(user.cookie,'meiku-neko-01');
 const concurrent=await Promise.all(Array.from({length:12},()=>call('POST','/api/qr/redeem',user.cookie,{token:first})));
 assert.equal(concurrent.filter(item=>item.statusCode===200).length,1);
 assert.equal(concurrent.filter(item=>item.statusCode===409).length,11);
 let state=(await call('GET','/api/world',user.cookie)).json();
 assert.equal(state.balance,'0');assert.equal(state.collection.length,1);
 const duplicates=await Promise.all(Array.from({length:6},()=>issue(user.cookie,'meiku-neko-01')));
 const results=await Promise.all(duplicates.map(token=>call('POST','/api/qr/redeem',user.cookie,{token})));
 assert.ok(results.every(item=>item.statusCode===200&&item.json().duplicate&&item.json().reward==='10'));
 state=(await call('GET','/api/world',user.cookie)).json();
 assert.equal(state.balance,'60');assert.equal(state.collection.length,1);
 const ledger=await pool.query('SELECT sum(amount)::text AS total,count(*)::integer AS count FROM coin_ledger WHERE user_id=$1',[user.id]);
 assert.deepEqual(ledger.rows[0],{total:'60',count:6});
 const token=await issue(user.cookie,'meiku-neko-02');
 assert.equal((await call('POST','/api/qr/redeem',user.cookie,{token,reward:999999})).statusCode,400);
 assert.equal((await call('POST','/api/qr/redeem',user.cookie,{token})).statusCode,200);
 const stored=(await pool.query('SELECT token_hash FROM qr_tokens ORDER BY created_at DESC LIMIT 1')).rows[0];
 assert.ok(!stored.token_hash.includes('pg1_'));
});

test('two users cannot redeem one token and a session can be reused',async()=>{
 const one=await session(),two=await session();
 const token=await issue(one.cookie,'walnut-01');
 const results=await Promise.all([call('POST','/api/qr/redeem',one.cookie,{token}),call('POST','/api/qr/redeem',two.cookie,{token})]);
 assert.deepEqual(results.map(item=>item.statusCode).sort(),[200,409]);
 assert.equal((await call('POST','/api/session',one.cookie,{})).json().userId,one.id);
});

test('module access, revision control, legacy backup and scene completion are protected',async()=>{
 const user=await session();
 const building='building-meiku-neko';
 assert.equal((await call('GET','/api/modules/'+building,user.cookie)).statusCode,403);
 const token=await issue(user.cookie,'meiku-neko-03');
 await call('POST','/api/qr/redeem',user.cookie,{token});
 const first=await call('PUT','/api/modules/'+building,user.cookie,{revision:0,data:{progress:{coins:1000500016}}});
 assert.equal(first.json().revision,1);
 assert.equal((await call('PUT','/api/modules/'+building,user.cookie,{revision:0,data:{}})).statusCode,409);
 assert.equal((await call('GET','/api/modules/'+building,user.cookie)).json().save.data.progress.coins,1000500016);
 for(let n=0;n<2;n++)assert.equal((await call('POST','/api/legacy/meiku',user.cookie,{data:{version:0,state:{coins:1000500016}}})).statusCode,200);
 assert.equal((await pool.query('SELECT count(*)::integer AS count FROM legacy_imports WHERE user_id=$1',[user.id])).rows[0].count,1);
 assert.equal((await call('GET','/api/world',user.cookie)).json().balance,'0');
 assert.equal((await call('POST','/api/scenes/walnut-intro/complete',user.cookie,{choices:[]})).statusCode,403);
 assert.equal((await call('POST','/api/qr/redeem',undefined,{token})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/api/session',headers:{origin:'https://elsewhere.invalid'},payload:{}})).statusCode,403);
});

test('production has no developer routes or redemption of test QR',async()=>{
 const user=await session();
 const token=await issue(user.cookie,'koyo-01');
 for(const url of ['/api/dev/qr','/api/dev/new-game','/api/dev/catalog/import']) {
  const response=await production.inject({method:'POST',url,headers:{origin,cookie:user.cookie},payload:{}});
  assert.equal(response.statusCode,404);
 }
 const response=await production.inject({method:'POST',url:'/api/qr/redeem',headers:{origin,cookie:user.cookie},payload:{token}});
 assert.equal(response.statusCode,403);
});
test('registry relations and a fresh user have no implicit unlocks or rewards',async()=>{
 const catalog=(await call('GET','/api/catalog')).json();
 assert.equal(catalog.buildings.length,16);
 assert.equal(new Set(catalog.buildings.map((b:{id:string})=>b.id)).size,16);
 for(const district of catalog.districts)assert.equal(catalog.buildings.filter((b:{districtId:string})=>b.districtId===district.id).length,4);
 for(const brand of catalog.brands) {
  assert.equal(catalog.buildings.filter((b:{brandId:string})=>b.brandId===brand.id).length,1);
  assert.equal(catalog.designs.filter((d:{brandId:string})=>d.brandId===brand.id).length,16);
 }
 const user=await session();
 const state=(await call('GET','/api/world',user.cookie)).json();
 assert.equal(state.balance,'0');assert.equal(state.user.firstBuilding,null);
 for(const field of ['buildings','districts','collection','scenes'])assert.deepEqual(state[field],[]);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM qr_activations WHERE user_id=$1',[user.id])).rows[0].n,0);
});

test('same-district and other-district unlocks preserve the first building and collect without extra intros',async()=>{
 const catalog=(await call('GET','/api/catalog')).json();
 const first=catalog.buildings[0];
 const same=catalog.buildings.find((b:{id:string;districtId:string})=>b.id!==first.id&&b.districtId===first.districtId);
 const other=catalog.buildings.find((b:{districtId:string})=>b.districtId!==first.districtId);
 const user=await session();
 for(const [index,building] of [first,same,other].entries()){
  const design=catalog.designs.find((d:{brandId:string})=>d.brandId===building.brandId);
  const result=await call('POST','/api/qr/redeem',user.cookie,{token:await issue(user.cookie,design.id)});
  assert.equal(result.statusCode,200);
  assert.equal(result.json().buildingId,building.id);
  assert.equal(result.json().sceneId,building.brandId+(index===0?'-intro':'-meeting'));
  const state=(await call('GET','/api/world',user.cookie)).json();
  assert.deepEqual(new Set(state.buildings),new Set([first,same,other].slice(0,index+1).map(b=>b.id)));
  assert.deepEqual(new Set(state.districts),new Set([first,same,other].slice(0,index+1).map(b=>b.districtId)));
  assert.equal(state.user.firstBuilding,first.id);
  assert.equal(state.collection.length,index+1);
  assert.equal(state.balance,'0');
 }
 const secondDesign=catalog.designs.filter((d:{brandId:string})=>d.brandId===first.brandId)[1];
 const acquired=await call('POST','/api/qr/redeem',user.cookie,{token:await issue(user.cookie,secondDesign.id)});
 assert.equal(acquired.json().duplicate,false);assert.equal(acquired.json().sceneId,null);
 const state=(await call('GET','/api/world',user.cookie)).json();
 assert.equal(state.collection.length,4);assert.equal(state.scenes.length,3);
 assert.equal(state.scenes.filter((s:{kind:string})=>s.kind==='intro').length,1);
});

test('reward, collection, completed scene and module save survive a new app instance and session reload',async()=>{
 const user=await session();
 await call('POST','/api/qr/redeem',user.cookie,{token:await issue(user.cookie,'meiku-neko-01')});
 await call('POST','/api/scenes/meiku-neko-intro/complete',user.cookie,{choices:['look']});
 const duplicate=await issue(user.cookie,'meiku-neko-01');
 await call('POST','/api/qr/redeem',user.cookie,{token:duplicate});
 const data={progress:{coins:1000500000,friendship:49,ownedUpgrades:{bed:true}},verification:'phase-1'};
 assert.equal((await call('PUT','/api/modules/building-meiku-neko',user.cookie,{revision:0,data})).statusCode,200);
 const before=(await call('GET','/api/world',user.cookie)).json();
 const reopened=buildApp({dev:true,origin,duplicateReward:10,secureCookies:false});
 try {
  const headers={origin,cookie:user.cookie};
  assert.equal((await reopened.inject({method:'POST',url:'/api/session',headers,payload:{}})).json().userId,user.id);
  for(let n=0;n<3;n++) {
   const state=(await reopened.inject({method:'GET',url:'/api/world',headers})).json();
   assert.deepEqual(state,before);assert.equal(state.balance,'10');assert.ok(state.scenes[0].completedAt);
  }
  const save=(await reopened.inject({method:'GET',url:'/api/modules/building-meiku-neko',headers})).json();
  assert.deepEqual(save.save.data,data);assert.equal(save.save.revision,1);
  assert.equal((await reopened.inject({method:'POST',url:'/api/qr/redeem',headers,payload:{token:duplicate}})).statusCode,409);
  assert.equal((await reopened.inject({method:'GET',url:'/api/world',headers})).json().balance,'10');
 }finally{await reopened.close();}
});

test('two simultaneous uses of a rewarding token credit exactly one ledger entry',async()=>{
 const user=await session();
 await call('POST','/api/qr/redeem',user.cookie,{token:await issue(user.cookie,'walnut-01')});
 const token=await issue(user.cookie,'walnut-01');
 const responses=await Promise.all([call('POST','/api/qr/redeem',user.cookie,{token}),call('POST','/api/qr/redeem',user.cookie,{token})]);
 assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);
 assert.equal((await call('GET','/api/world',user.cookie)).json().balance,'10');
 assert.deepEqual((await pool.query('SELECT count(*)::int AS n,sum(amount)::text AS total FROM coin_ledger WHERE user_id=$1',[user.id])).rows[0],{n:1,total:'10'});
});

test('forged reward ownership and forged building access cannot change server progress',async()=>{
 const one=await session(),two=await session();
 const token=await issue(one.cookie,'walnut-02');
 for(const extra of [{reward:999999},{designId:'meiku-neko-01'},{buildingId:'building-meiku-neko'},{userId:two.id}]) {
  assert.equal((await call('POST','/api/qr/redeem',one.cookie,{token,...extra})).statusCode,400);
 }
 assert.equal((await call('GET','/api/world',one.cookie)).json().collection.length,0);
 const redeemed=await call('POST','/api/qr/redeem',one.cookie,{token});
 assert.equal(redeemed.json().designId,'walnut-02');
 assert.equal(redeemed.json().buildingId,'building-walnut');
 for(const method of ['GET','PUT'] as const) {
  assert.equal((await call(method,'/api/modules/building-meiku-neko',one.cookie,method==='PUT'?{revision:0,data:{unlocked:true,coins:99999}}:undefined)).statusCode,403);
  assert.equal((await call(method,'/api/modules/building-walnut',two.cookie,method==='PUT'?{revision:0,data:{unlocked:true}}:undefined)).statusCode,403);
 }
 const state=(await call('GET','/api/world',two.cookie)).json();
 assert.deepEqual(state.buildings,[]);assert.equal(state.balance,'0');
 assert.equal((await call('POST','/api/world',one.cookie,{buildings:['building-meiku-neko'],balance:'9999'})).statusCode,404);
});

test('unknown and expired tokens leave the world unchanged',async()=>{
 const user=await session();
 const before=(await call('GET','/api/world',user.cookie)).json();
 assert.equal((await call('POST','/api/qr/redeem',user.cookie,{token:'pg1_'+'A'.repeat(43)})).statusCode,404);
 const token=await issue(user.cookie,'koyo-02');
 await pool.query("UPDATE qr_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[hash(token)]);
 assert.equal((await call('POST','/api/qr/redeem',user.cookie,{token})).statusCode,410);
 assert.deepEqual((await call('GET','/api/world',user.cookie)).json(),before);
});

test('database failures roll back token, collection, unlocks, scene, wallet and ledger',async()=>{
 const user=await session();
 const first=await issue(user.cookie,'meiku-neko-04');
 const before=(await call('GET','/api/world',user.cookie)).json();
 const name='verification_'+user.id.replaceAll('-','');
 // Fault injection is confined to this test user in the guarded *_test database.
 await pool.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF NEW.user_id::text = '${user.id}' THEN RAISE EXCEPTION 'verification injected failure'; END IF; RETURN NEW; END $$`);
 try {
  await pool.query(`CREATE TRIGGER ${name} BEFORE INSERT ON user_scenes FOR EACH ROW EXECUTE FUNCTION ${name}()`);
  assert.equal((await call('POST','/api/qr/redeem',user.cookie,{token:first})).statusCode,500);
  assert.deepEqual((await call('GET','/api/world',user.cookie)).json(),before);
  assert.equal((await pool.query('SELECT used_by FROM qr_tokens WHERE token_hash=$1',[hash(first)])).rows[0].used_by,null);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM qr_activations WHERE user_id=$1',[user.id])).rows[0].n,0);
  await pool.query(`DROP TRIGGER ${name} ON user_scenes`);
  assert.equal((await call('POST','/api/qr/redeem',user.cookie,{token:first})).statusCode,200);
  const duplicate=await issue(user.cookie,'meiku-neko-04');
  const stable=(await call('GET','/api/world',user.cookie)).json();
  await pool.query(`CREATE TRIGGER ${name} BEFORE INSERT ON coin_ledger FOR EACH ROW EXECUTE FUNCTION ${name}()`);
  assert.equal((await call('POST','/api/qr/redeem',user.cookie,{token:duplicate})).statusCode,500);
  assert.deepEqual((await call('GET','/api/world',user.cookie)).json(),stable);
  assert.equal((await pool.query('SELECT used_by FROM qr_tokens WHERE token_hash=$1',[hash(duplicate)])).rows[0].used_by,null);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM coin_ledger WHERE user_id=$1',[user.id])).rows[0].n,0);
  await pool.query(`DROP TRIGGER ${name} ON coin_ledger`);
  assert.equal((await call('POST','/api/qr/redeem',user.cookie,{token:duplicate})).statusCode,200);
  assert.equal((await call('GET','/api/world',user.cookie)).json().balance,'10');
 }finally{
  await pool.query(`DROP TRIGGER IF EXISTS ${name} ON user_scenes`);
  await pool.query(`DROP TRIGGER IF EXISTS ${name} ON coin_ledger`);
  await pool.query(`DROP FUNCTION ${name}()`);
 }
});

test('module data is isolated between users and concurrent revisions cannot both win',async()=>{
 const one=await session(),two=await session();
 for(const user of [one,two])await call('POST','/api/qr/redeem',user.cookie,{token:await issue(user.cookie,'meiku-neko-05')});
 const url='/api/modules/building-meiku-neko';
 const responses=await Promise.all([
  call('PUT',url,one.cookie,{revision:0,data:{owner:one.id,value:'one'}}),
  call('PUT',url,one.cookie,{revision:0,data:{owner:one.id,value:'two'}}),
 ]);
 assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);
 const saved=(await call('GET',url,one.cookie)).json();
 assert.equal(saved.save.revision,1);assert.equal(saved.save.data.owner,one.id);
 assert.equal((await call('GET',url,two.cookie)).json().save,null);
 assert.equal((await call('GET','/api/world',one.cookie)).json().balance,'0');
});

test('production derives real-token reward from its stored design and uses secure sessions',async()=>{
 const user=await session();
 const token=await issueToken('koyo-03',false);
 const headers={origin,cookie:user.cookie};
 const result=await production.inject({method:'POST',url:'/api/qr/redeem',headers,payload:{token}});
 assert.equal(result.statusCode,200);assert.equal(result.json().buildingId,'building-koyo');
 assert.equal(result.json().designId,'koyo-03');assert.equal(result.json().reward,'0');
 const repeated=await issueToken('koyo-03',false);
 assert.equal((await production.inject({method:'POST',url:'/api/qr/redeem',headers,payload:{token:repeated}})).json().reward,'10');
 assert.equal((await production.inject({method:'POST',url:'/api/qr/redeem',headers,payload:{token:repeated}})).statusCode,409);
 assert.equal((await production.inject({method:'GET',url:'/api/world',headers})).json().balance,'10');
 const fresh=await production.inject({method:'POST',url:'/api/session',headers:{origin},payload:{}});
 const cookie=String(fresh.headers['set-cookie']);
 for(const attribute of ['HttpOnly','SameSite=Strict','Secure'])assert.ok(cookie.includes(attribute));
});
