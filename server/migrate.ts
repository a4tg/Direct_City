import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { pool, transaction } from './db.js';

await transaction(async db => {
 await db.query("SELECT pg_advisory_xact_lock(7320041)");
 await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
 const directory = new URL('./migrations/', import.meta.url);
 for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
  const sql = await readFile(fileURLToPath(new URL(name, directory)), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const previous = await db.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name]);
  if (previous.rowCount) {
   if (previous.rows[0].checksum !== checksum) throw new Error('Изменена применённая миграция ' + name);
   continue;
  }
  await db.query(sql.replace(/^\uFEFF/, ''));
  await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name,checksum]);
  console.log('Применена миграция', name);
 }
});
await pool.end();
