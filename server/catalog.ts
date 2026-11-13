import type { PoolClient } from 'pg';

export type Catalog = {
 source: string;
 districts: { id: string; name: string; position: number }[];
 brands: { id: string; name: string; mascot: string; archetype: string; personality: string; worldRole: string; theme: string; sourceRef: string;
  building: { id: string; districtId: string; position: number; name: string; moduleId: string; provisional: boolean } }[];
 designs: { id: string; brandId: string; slot: number; name: string; image: string | null;
  effect: { kind: 'collect' } | { kind: 'coins'; amount: number } | { kind: 'moduleEvent'; name: string } }[];
};
const identifier = /^[a-z0-9][a-z0-9-]{0,79}$/;
function requireValue(value: unknown, message: string): asserts value {
 if (!value) throw Object.assign(new Error(message), { statusCode: 400 });
}
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= 2000; }

export function parseCatalog(value: unknown): Catalog {
 requireValue(value && typeof value === 'object', 'Ожидается объект каталога.');
 const catalog = value as Catalog;
 requireValue(text(catalog.source), 'Нужна ссылка на источник.');
 requireValue(Array.isArray(catalog.districts) && catalog.districts.length === 4, 'Нужны четыре района.');
 requireValue(Array.isArray(catalog.brands) && catalog.brands.length === 16, 'Нужны 16 брендов.');
 requireValue(Array.isArray(catalog.designs) && catalog.designs.length === 256, 'Нужны 256 дизайнов.');
 const ids = new Set<string>();
 const districtIds = new Set<string>();
 const brandIds = new Set<string>();
 const locations = new Set<string>();
 const slots = new Set<string>();
 for (const district of catalog.districts) {
  requireValue(district && identifier.test(district.id) && text(district.name) && Number.isInteger(district.position) &&
    district.position >= 0 && district.position < 4 && !districtIds.has(district.id), 'Некорректный район.');
  requireValue(!locations.has(String(district.position)), 'Повтор позиции района.');
  districtIds.add(district.id); locations.add(String(district.position));
 }
 locations.clear();
 for (const brand of catalog.brands) {
  requireValue(brand && identifier.test(brand.id) && !brandIds.has(brand.id) &&
    [brand.name,brand.mascot,brand.archetype,brand.personality,brand.worldRole,brand.theme,brand.sourceRef].every(text), 'Некорректный бренд.');
  const building = brand.building;
  requireValue(building && identifier.test(building.id) && !ids.has(building.id) && districtIds.has(building.districtId) &&
    Number.isInteger(building.position) && building.position >= 0 && building.position < 4 && text(building.name) &&
    ['meiku','klimych','pending'].includes(building.moduleId) && typeof building.provisional === 'boolean', 'Некорректное здание.');
  requireValue(!locations.has(building.districtId + building.position), 'Повтор позиции здания.');
  brandIds.add(brand.id); ids.add(building.id); locations.add(building.districtId + building.position);
 }
 ids.clear();
 for (const design of catalog.designs) {
  requireValue(design && identifier.test(design.id) && !ids.has(design.id) && brandIds.has(design.brandId) &&
    Number.isInteger(design.slot) && design.slot >= 1 && design.slot <= 16 && text(design.name), 'Некорректный дизайн.');
  requireValue(design.image === null || (text(design.image) && design.image.startsWith('/assets/') &&
    !design.image.includes('..') && !design.image.includes('\\')), 'Изображение должно находиться в /assets/.');
  requireValue(!slots.has(design.brandId + ':' + design.slot), 'Повтор слота дизайна.');
  const effect = design.effect;
  requireValue(effect && (effect.kind === 'collect' || effect.kind === 'coins' &&
    Number.isSafeInteger(effect.amount) && effect.amount >= 0 && effect.amount <= 1000000 ||
    effect.kind === 'moduleEvent' && identifier.test(effect.name)), 'Некорректный эффект.');
  slots.add(design.brandId + ':' + design.slot); ids.add(design.id);
 }
 return catalog;
}

export async function importCatalog(db: PoolClient, catalog: Catalog) {
 await db.query('SELECT pg_advisory_xact_lock(7320042)');
 for (const item of catalog.districts) {
  await db.query('INSERT INTO districts(id,name,position) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name',
   [item.id,item.name,item.position]);
 }
 for (const brand of catalog.brands) {
  await db.query(`INSERT INTO brands(id,name,mascot,archetype,personality,world_role,collection_theme,source_ref)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, mascot=EXCLUDED.mascot,
   archetype=EXCLUDED.archetype,personality=EXCLUDED.personality,world_role=EXCLUDED.world_role,
   collection_theme=EXCLUDED.collection_theme,source_ref=EXCLUDED.source_ref`,
   [brand.id,brand.name,brand.mascot,brand.archetype,brand.personality,brand.worldRole,brand.theme,catalog.source+' · '+brand.sourceRef]);
  const building = brand.building;
  const previousBuilding=await db.query('SELECT brand_id,district_id,position FROM buildings WHERE id=$1',[building.id]);
  requireValue(!previousBuilding.rowCount || previousBuilding.rows[0].brand_id===brand.id && previousBuilding.rows[0].district_id===building.districtId && previousBuilding.rows[0].position===building.position,'Изменение принадлежности здания требует отдельной миграции.');
  await db.query(`INSERT INTO buildings(id,brand_id,district_id,name,position,module_id,provisional) VALUES($1,$2,$3,$4,$5,$6,$7)
   ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,district_id=EXCLUDED.district_id,position=EXCLUDED.position,
   module_id=EXCLUDED.module_id,provisional=EXCLUDED.provisional`,
   [building.id,brand.id,building.districtId,building.name,building.position,building.moduleId,building.provisional]);
  for (const kind of ['intro','meeting']) {
   const text = kind === 'intro'
    ? 'Ваше знакомство с Прямогородом начинается здесь. ' + brand.worldRole + ' — направление этого места.'
    : 'Ещё одна дверь Прямогорода открыта. Здесь вас встречает ' + brand.mascot + '.';
   const script = { temporary: true, start: 'welcome', nodes: [
    { id: 'welcome', speaker: brand.mascot, portrait: brand.id === 'meiku-neko' ? '/assets/meiku/idle-box.png' : null,
      text, choices: [{ id: 'hello', text: 'Познакомиться', next: 'finish' },{ id:'look',text:'Осмотреться',next:'finish' }] },
    { id: 'finish', speaker: brand.mascot, portrait: null,
      text: brand.name + ' · ' + brand.archetype + '. ' + brand.personality + '.', choices: [] },
   ] };
   await db.query('INSERT INTO story_scenes(id,brand_id,kind,script) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',
    [brand.id + '-' + kind,brand.id,kind,script]);
  }
 }
 for (const design of catalog.designs) {
  const previous = await db.query('SELECT brand_id,slot FROM designs WHERE id=$1', [design.id]);
  requireValue(!previous.rowCount || previous.rows[0].brand_id === design.brandId && previous.rows[0].slot === design.slot,
   'Нельзя изменить бренд или слот существующего ID.');
  await db.query(`INSERT INTO designs(id,brand_id,slot,name,image,effect) VALUES($1,$2,$3,$4,$5,$6)
   ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,image=EXCLUDED.image,effect=EXCLUDED.effect`,
   [design.id,design.brandId,design.slot,design.name,design.image,design.effect]);
 }
}