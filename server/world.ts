import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function fail(message: string, statusCode = 400): never {
 throw Object.assign(new Error(message), { statusCode });
}

export async function createSession(isTest = false) {
 const id = randomUUID();
 const token = randomBytes(32).toString('hex');
 await transaction(async db => {
  await db.query('INSERT INTO users(id,is_test) VALUES($1,$2)', [id,isTest]);
  await db.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'30 days\')',[hash(token),id]);
  await db.query('INSERT INTO wallets(user_id) VALUES($1)',[id]);
  await db.query('INSERT INTO game_progress(user_id) VALUES($1)',[id]);
 });
 return { id, token };
}

export async function issueToken(designId: string, isTest: boolean) {
 const exists = await pool.query('SELECT 1 FROM designs WHERE id=$1', [designId]);
 if (!exists.rowCount) fail('Дизайн отсутствует в каталоге.', 404);
 const token = 'pg1_' + randomBytes(32).toString('base64url');
 await pool.query('INSERT INTO qr_tokens(id,token_hash,design_id,is_test) VALUES($1,$2,$3,$4)',[randomUUID(),hash(token),designId,isTest]);
 return token;
}

export async function redeem(userId: string, token: string, allowTest: boolean, duplicateReward: number) {
 return transaction(async db => {
  await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
  const qr = await db.query(`SELECT q.*,d.brand_id,d.effect FROM qr_tokens q JOIN designs d ON d.id=q.design_id
    WHERE q.token_hash=$1 FOR UPDATE OF q`,[hash(token)]);
  if (!qr.rowCount) fail('QR-код не найден.',404);
  const code = qr.rows[0];
  if (code.used_by) fail('Этот QR-код уже использован.',409);
  if (code.is_test && !allowTest) fail('Тестовый QR доступен только в режиме разработки.',403);
  if (code.expires_at && new Date(code.expires_at).getTime() <= Date.now()) fail('Срок действия QR-кода истёк.',410);
  const building = (await db.query('SELECT * FROM buildings WHERE brand_id=$1',[code.brand_id])).rows[0];
  const acquired = await db.query('INSERT INTO user_collection(user_id,design_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING design_id',
    [userId,code.design_id]);
  const duplicate = acquired.rowCount === 0;
  const reward = duplicate ? duplicateReward : code.effect.kind === 'coins' ? code.effect.amount : 0;
  const activationId = randomUUID();
  await db.query('UPDATE qr_tokens SET used_by=$1,used_at=now() WHERE id=$2',[userId,code.id]);
  await db.query('INSERT INTO qr_activations(id,token_id,user_id,design_id,duplicate,reward) VALUES($1,$2,$3,$4,$5,$6)',
    [activationId,code.id,userId,code.design_id,duplicate,reward]);
  const unlocked = await db.query('INSERT INTO unlocked_buildings(user_id,building_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING building_id',
    [userId,building.id]);
  let sceneId: string | null = null;
  if (unlocked.rowCount) {
    const first = await db.query('UPDATE users SET first_building=$1 WHERE id=$2 AND first_building IS NULL RETURNING id',[building.id,userId]);
    await db.query('INSERT INTO unlocked_districts(user_id,district_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[userId,building.district_id]);
    sceneId = code.brand_id + (first.rowCount ? '-intro' : '-meeting');
    await db.query('INSERT INTO user_scenes(user_id,scene_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[userId,sceneId]);
  }
  if (reward > 0) {
    await db.query('UPDATE wallets SET balance=balance+$1 WHERE user_id=$2',[reward,userId]);
    await db.query('INSERT INTO coin_ledger(id,user_id,activation_id,amount,reason) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(),userId,activationId,reward,duplicate?'duplicate_design':'design_effect']);
  }
  if (!duplicate && code.effect.kind === 'moduleEvent') {
    await db.query('INSERT INTO module_events(id,user_id,building_id,activation_id,data) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(),userId,building.id,activationId,{ name:code.effect.name, designId:code.design_id }]);
  }
  return { activationId, buildingId:building.id, designId:code.design_id, duplicate, reward:String(reward), sceneId };
 });
}

export async function snapshot(userId: string) {
 return transaction(async db => {
  await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const user = (await db.query('SELECT id,first_building AS "firstBuilding",is_test AS "isTest" FROM users WHERE id=$1',[userId])).rows[0];
  const balance = (await db.query('SELECT balance FROM wallets WHERE user_id=$1',[userId])).rows[0].balance;
  const collection = (await db.query('SELECT design_id AS "designId" FROM user_collection WHERE user_id=$1',[userId])).rows.map(row=>row.designId);
  const buildings = (await db.query('SELECT building_id FROM unlocked_buildings WHERE user_id=$1',[userId])).rows.map(row=>row.building_id);
  const districts = (await db.query('SELECT district_id FROM unlocked_districts WHERE user_id=$1',[userId])).rows.map(row=>row.district_id);
  const scenes = (await db.query(`SELECT s.id,s.kind,s.brand_id AS "brandId",s.script,us.completed_at AS "completedAt"
    FROM user_scenes us JOIN story_scenes s ON s.id=us.scene_id WHERE us.user_id=$1 ORDER BY us.created_at,s.id`,[userId])).rows;
  return { user, balance, collection, buildings, districts, scenes };
 });
}

export async function ensureBuilding(db: PoolClient, userId: string, buildingId: string) {
 const result = await db.query('SELECT 1 FROM unlocked_buildings WHERE user_id=$1 AND building_id=$2',[userId,buildingId]);
 if (!result.rowCount) fail('Здание ещё закрыто.',403);
}