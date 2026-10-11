import { neon } from '@neondatabase/serverless';
import type { Run } from './domain';

export function sql() {
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured');
  return neon(process.env.DATABASE_URL);
}
export async function getRun(id: string): Promise<Run> {
  const rows = await sql()`SELECT * FROM audit_runs WHERE id = ${id}`;
  if (!rows[0]) throw new Error('Run not found');
  return rows[0] as Run;
}
export async function updateRun(run: Run, stage: Run['stage'], data: Run['data'], packVersion = run.pack_version) {
  const rows = await sql()`UPDATE audit_runs SET stage = ${stage}, data = ${JSON.stringify(data)}::jsonb, version = version + 1, pack_version = ${packVersion} WHERE id = ${run.id} AND version = ${run.version} RETURNING *`;
  if (!rows[0]) throw new Error('Concurrent update. Retry from current run state.');
  return rows[0] as Run;
}
export async function event(runId: string, role: string, message: string, key: string) {
  await sql()`INSERT INTO audit_events (run_id, role, message, operation_key) VALUES (${runId}, ${role}, ${message}, ${key}) ON CONFLICT (run_id, operation_key) DO NOTHING`;
}
