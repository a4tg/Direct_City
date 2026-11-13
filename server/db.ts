import pg from 'pg';
import type { PoolClient } from 'pg';
export const pool = new pg.Pool({
 connectionString: process.env.DATABASE_URL ?? 'postgresql://pryamogorod:local-dev-only@127.0.0.1:55432/pryamogorod',
 max: 10,
});
export async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
 const client = await pool.connect();
 try {
  await client.query('BEGIN');
  const value = await run(client);
  await client.query('COMMIT');
  return value;
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 } finally { client.release(); }
}
