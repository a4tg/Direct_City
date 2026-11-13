import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { transaction } from './db.js';
import { ensureBuilding,fail } from './world.js';
import { levels,evaluateResult,applyResult,initialWorkshop,type WorkshopProgress,type Completion } from './klimych-rules.js';
export const klimychBuilding='building-klimych';
export function tutorialData(data:Record<string,unknown>,old:unknown):WorkshopProgress {
 if(Object.keys(data).length!==1||data.tutorialSeen!==true)fail('Прогресс заказов изменяется только через завершение раунда.');
 return {...(old as WorkshopProgress??initialWorkshop()),tutorialSeen:true};
}
async function progress(db:PoolClient,id:string) {
 const result=await db.query('SELECT data,revision FROM module_saves WHERE user_id=$1 AND building_id=$2',[id,klimychBuilding]);
 return {progress:(result.rows[0]?.data??initialWorkshop()) as WorkshopProgress,revision:result.rows[0]?.revision??0};
}
export function registerKlimych(app:FastifyInstance,user:(cookie?:string)=>Promise<string>) {
 app.get('/api/modules/building-klimych/workshop',async request=>{
  const id=await user(request.headers.cookie);
  return transaction(async db=>{
   await ensureBuilding(db,id,klimychBuilding);
   const current=await progress(db,id);
   const collection=await db.query("SELECT design_id FROM user_collection WHERE user_id=$1 AND design_id LIKE 'klimych-%'",[id]);
   return {...current,collectedTools:collection.rows.map(r=>r.design_id),rewardsEnabled:false};
  });
 });
 app.post<{Body:{levelId:string}}>('/api/modules/building-klimych/runs',{
  schema:{body:{type:'object',required:['levelId'],additionalProperties:false,properties:{levelId:{type:'string',enum:levels.map(l=>l.id)}}}},
 },async request=>{
  const id=await user(request.headers.cookie);
  return transaction(async db=>{
   await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[id]);
   await ensureBuilding(db,id,klimychBuilding);
   const current=await progress(db,id);
   if(!current.progress.tutorialSeen)fail('Сначала пройдите вводный инструктаж.',409);
   if(!current.progress.unlocked.includes(request.body.levelId))fail('Заказ ещё закрыт.',403);
   const runId=randomUUID();
   await db.query('INSERT INTO klimych_runs(id,user_id,level_id) VALUES($1,$2,$3)',[runId,id,request.body.levelId]);
   return {runId,rewardsEnabled:false};
  });
 });
 app.post<{Params:{runId:string};Body:{elapsedMs:number;errors:number;steps:Completion[]}}>('/api/modules/building-klimych/runs/:runId/finish',{
  schema:{params:{type:'object',required:['runId'],properties:{runId:{type:'string',format:'uuid'}}},body:{
   type:'object',required:['elapsedMs','errors','steps'],additionalProperties:false,properties:{
    elapsedMs:{type:'integer',minimum:0,maximum:120000},errors:{type:'integer',minimum:0,maximum:1000},
    steps:{type:'array',maxItems:16,items:{type:'object',required:['stepId','precision'],additionalProperties:false,properties:{stepId:{type:'string',maxLength:80},precision:{type:'number',minimum:0,maximum:1}}}},
   },
  }},
 },async request=>{
  const id=await user(request.headers.cookie);
  return transaction(async db=>{
   await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[id]);
   await ensureBuilding(db,id,klimychBuilding);
   const run=await db.query('SELECT * FROM klimych_runs WHERE id=$1 AND user_id=$2 FOR UPDATE',[request.params.runId,id]);
   if(!run.rowCount)fail('Раунд не найден.',404);
   const current=await progress(db,id);
   if(run.rows[0].result)return {result:run.rows[0].result,...current,rewardsEnabled:false,replayed:true};
   const level=levels.find(l=>l.id===run.rows[0].level_id)!;
   const body=request.body;
   if(body.elapsedMs>level.duration*1000)fail('Время выходит за пределы заказа.');
   if(body.steps.some((s,i)=>s.stepId!==level.steps[i]?.id))fail('Нарушен порядок операций.');
   const result=evaluateResult(level,body.steps,body.errors,body.elapsedMs);
   const next=applyResult(current.progress,result);
   await db.query('UPDATE klimych_runs SET result=$1,finished_at=now() WHERE id=$2',[result,request.params.runId]);
   const saved=await db.query(`INSERT INTO module_saves(user_id,building_id,data) VALUES($1,$2,$3)
    ON CONFLICT(user_id,building_id) DO UPDATE SET data=EXCLUDED.data,revision=module_saves.revision+1,updated_at=now() RETURNING revision`,[id,klimychBuilding,next]);
   // Telemetry is not a proof of honest play: no wallet/ledger writes here.
   return {result,progress:next,revision:saved.rows[0].revision,rewardsEnabled:false,replayed:false};
  });
 });
}
