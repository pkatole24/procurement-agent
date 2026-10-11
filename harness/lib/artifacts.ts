import { get, put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { sql, getRun } from './db';
import { safeArtifact } from './domain';

export async function writeArtifact(runId: string, name: string, content: string | Buffer, version: number) {
  safeArtifact(name);
  const hash = createHash('sha256').update(content).digest('hex');
  const blob = await put(`runs/${runId}/${hash}/${name}`, content, { access: 'private', addRandomSuffix: false, allowOverwrite: true });
  await sql()`INSERT INTO audit_artifacts (run_id,name,url,sha256,version) VALUES (${runId},${name},${blob.url},${hash},${version}) ON CONFLICT (run_id,name) DO UPDATE SET url=excluded.url,sha256=excluded.sha256,version=excluded.version`;
  return hash;
}
export async function readArtifact(runId: string, name: string): Promise<Buffer> {
  safeArtifact(name);
  const rows = await sql()`SELECT * FROM audit_artifacts WHERE run_id=${runId} AND name=${name}`;
  if (!rows[0]) throw new Error(`Missing artifact: ${name}`);
  const result = await get(rows[0].url, { access: 'private' });
  if (!result || !result.stream) throw new Error(`Artifact unavailable: ${name}`);
  const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== rows[0].sha256) throw new Error(`Artifact checksum failed: ${name}`);
  return bytes;
}
export async function readJson(runId: string, name: string) { return JSON.parse((await readArtifact(runId, name)).toString('utf8')); }
