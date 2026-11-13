import { readFile } from 'node:fs/promises';
import { pool, transaction } from './db.js';
import { parseCatalog, importCatalog } from './catalog.js';
const file = process.argv[2] ?? new URL('./content/catalog.json', import.meta.url);
const catalog = parseCatalog(JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, '')));
await transaction(db => importCatalog(db, catalog));
console.log('Загружены 4 района, 16 брендов и 256 дизайнов.');
await pool.end();