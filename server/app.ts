import Fastify from 'fastify';
import { registerKlimych, tutorialData, klimychBuilding } from './klimych.js';
import { randomUUID } from 'node:crypto';
import { pool, transaction } from './db.js';
import { createSession, ensureBuilding, fail, hash, issueToken, redeem, snapshot } from './world.js';
import { importCatalog, parseCatalog } from './catalog.js';

type Config = { dev: boolean; origin: string; duplicateReward: number; secureCookies: boolean };
export function buildApp(config: Config) {
 const app = Fastify({ logger: false, bodyLimit: 1024 * 1024, ajv:{customOptions:{removeAdditional:false}} });
 const rates = new Map<string,{ count:number; until:number }>();
 app.addHook('onRequest', async (request, reply) => {
  reply.header('Cache-Control','no-store');
  if (request.method !== 'GET' && request.headers.origin !== config.origin) fail('Недопустимый источник запроса.',403);
  const now = Date.now();
  if (rates.size > 5000) for (const [key,item] of rates) if (item.until < now) rates.delete(key);
  const bucket = rates.get(request.ip);
  if (!bucket || bucket.until < now) rates.set(request.ip,{ count:1,until:now+60000 });
  else if (++bucket.count > 300) fail('Слишком много запросов. Попробуйте через минуту.',429);
 });
 app.setErrorHandler((error, request, reply) => {
  const problem=error as Error & {statusCode?:number};
  const status = typeof problem.statusCode === 'number' ? problem.statusCode : 500;
  if (status >= 500) console.error('API',request.method,request.routeOptions.url,problem.message);
  reply.code(status).send({ error:status >= 500 ? 'Сервер временно недоступен.' : problem.message });
 });
 async function user(cookie?: string) {
  const token = cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith('pg_session='))?.slice(11);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) fail('Нужна игровая сессия.',401);
  const result = await pool.query('SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()',[hash(token)]);
  if (!result.rowCount) fail('Игровая сессия истекла.',401);
  return result.rows[0].user_id as string;
 }
 const setCookie = (token: string) => 'pg_session='+token+'; Path=/api; HttpOnly; SameSite=Strict; Max-Age=2592000'+(config.secureCookies?'; Secure':'');
 app.get('/api/health', async()=>{await pool.query('SELECT 1');return { ready:true };});
 app.post('/api/session', async (request, reply) => {
  try { return { userId:await user(request.headers.cookie) }; }
  catch(error) { if ((error as {statusCode?:number}).statusCode !== 401) throw error; }
  const session = await createSession();
  reply.header('Set-Cookie',setCookie(session.token));
  return { userId:session.id };
 });
 app.get('/api/world',async request => ({ ...await snapshot(await user(request.headers.cookie)), dev:config.dev }));
 app.get('/api/catalog', async()=>({
  districts:(await pool.query('SELECT * FROM districts ORDER BY position')).rows,
  brands:(await pool.query('SELECT id,name,mascot,archetype,personality,world_role AS "worldRole",collection_theme AS theme,source_ref AS "sourceRef" FROM brands ORDER BY id')).rows,
  buildings:(await pool.query('SELECT id,brand_id AS "brandId",district_id AS "districtId",name,position,module_id AS "moduleId",provisional FROM buildings ORDER BY district_id,position')).rows,
  designs:(await pool.query('SELECT id,brand_id AS "brandId",slot,name,image FROM designs ORDER BY brand_id,slot')).rows,
 }));
 app.post<{Body:{token:string}}>('/api/qr/redeem',{
  schema:{body:{type:'object',required:['token'],additionalProperties:false,properties:{token:{type:'string',pattern:'^pg1_[A-Za-z0-9_-]{43}$'}}}},
 },async request=>redeem(await user(request.headers.cookie),request.body.token,config.dev,config.duplicateReward));
 app.post<{Params:{id:string};Body:{choices:string[]}}>('/api/scenes/:id/complete',{
  schema:{body:{type:'object',required:['choices'],additionalProperties:false,properties:{choices:{type:'array',maxItems:32,items:{type:'string',maxLength:100}}}}},
 },async request => {
  const id = await user(request.headers.cookie);
  return transaction(async db => {
   const result = await db.query(`SELECT s.script FROM user_scenes us JOIN story_scenes s ON s.id=us.scene_id WHERE us.user_id=$1 AND s.id=$2`,[id,request.params.id]);
   if (!result.rowCount) fail('Сцена недоступна.',403);
   const script = result.rows[0].script;
   let current = script.start;
   let index = 0;
   for (let step=0; step<32; step++) {
    const node = script.nodes.find((item:{id:string})=>item.id===current);
    if (!node) fail('Некорректный сценарий.',500);
    if (!node.choices.length) {
     if(index !== request.body.choices.length) fail('Лишние ответы.');
     await db.query('UPDATE user_scenes SET completed_at=coalesce(completed_at,now()),choices=coalesce(choices,$1) WHERE user_id=$2 AND scene_id=$3',
      [JSON.stringify(request.body.choices),id,request.params.id]);
     return { completed:true };
    }
    const answer=request.body.choices[index++];
    const choice = node.choices.find((item:{id:string})=>item.id===answer);
    if(!choice) fail('Не выбран допустимый ответ.');
    current = choice.next;
   }
   fail('Сценарий слишком длинный.');
  });
 });
 app.get<{Params:{id:string}}>('/api/modules/:id',async request=>{
  const id=await user(request.headers.cookie);
  return transaction(async db=>{
   await ensureBuilding(db,id,request.params.id);
   const save=await db.query('SELECT data,revision FROM module_saves WHERE user_id=$1 AND building_id=$2',[id,request.params.id]);
   return { save:save.rows[0]??null, events:(await db.query('SELECT id,data FROM module_events WHERE user_id=$1 AND building_id=$2',[id,request.params.id])).rows };
  });
 });
 app.put<{Params:{id:string};Body:{data:Record<string,unknown>;revision:number}}>('/api/modules/:id',{
  schema:{body:{type:'object',required:['data','revision'],additionalProperties:false,properties:{data:{type:'object'},revision:{type:'integer',minimum:0}}}},
 },async request=>{
  const id=await user(request.headers.cookie);
  return transaction(async db=>{
   await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[id]);
   await ensureBuilding(db,id,request.params.id);
   const saved=await db.query('SELECT revision,data FROM module_saves WHERE user_id=$1 AND building_id=$2 FOR UPDATE',[id,request.params.id]);
   if((saved.rows[0]?.revision??0)!==request.body.revision) fail('Сохранение обновлено в другой вкладке. Загрузите свежую версию.',409);
   const moduleData=request.params.id===klimychBuilding?tutorialData(request.body.data,saved.rows[0]?.data):request.body.data;
   const result=await db.query(`INSERT INTO module_saves(user_id,building_id,data) VALUES($1,$2,$3)
     ON CONFLICT(user_id,building_id) DO UPDATE SET data=EXCLUDED.data,revision=module_saves.revision+1,updated_at=now() RETURNING revision`,
     [id,request.params.id,moduleData]);
   return { revision:result.rows[0].revision };
  });
 });
 app.post<{Body:{data:Record<string,unknown>}}>('/api/legacy/meiku',{
  schema:{body:{type:'object',required:['data'],additionalProperties:false,properties:{data:{type:'object'}}}},
 },async request=>{
  const id=await user(request.headers.cookie);
  await pool.query('INSERT INTO legacy_imports(user_id,data) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,request.body.data]);
  return { backedUp:true, coinsTransferred:false };
 });
 if(config.dev) {
  app.post('/api/dev/new-game',async (request,reply)=>{
   await user(request.headers.cookie);
   const session=await createSession(true);
   reply.header('Set-Cookie',setCookie(session.token));
   return { userId:session.id };
  });
  app.post<{Body:{designId:string}}>('/api/dev/qr',{
   schema:{body:{type:'object',required:['designId'],additionalProperties:false,properties:{designId:{type:'string',maxLength:80}}}},
  },async request=>{
   await user(request.headers.cookie);
   const token=await issueToken(request.body.designId,true);
   return { token, link:config.origin+'/#qr='+encodeURIComponent(token) };
  });
  app.post('/api/dev/catalog/import',async request=>{
   await user(request.headers.cookie);
   const catalog=parseCatalog(request.body);
   await transaction(db=>importCatalog(db,catalog));
   return { brands:16,designs:256 };
  });
 }
 registerKlimych(app,user);
 return app;
}