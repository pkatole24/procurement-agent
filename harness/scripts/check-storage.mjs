import { neon } from '@neondatabase/serverless';
import { put, get, del } from '@vercel/blob';
import { randomUUID, createHash } from 'node:crypto';

const db = neon(process.env.DATABASE_URL);
const id = randomUUID();
let blob;
try {
  await db`INSERT INTO audit_runs (id,owner,stage,data) VALUES (${id},'harness-storage-smoke','cancelled','{"fixture":true}'::jsonb)`;
  const content = Buffer.from('Harness private storage verification. No council data or approvals.');
  const hash = createHash('sha256').update(content).digest('hex');
  blob = await put(`runs/${id}/smoke.txt`, content, { access:'private', addRandomSuffix:false });
  await db`INSERT INTO audit_artifacts (run_id,name,url,sha256,version) VALUES (${id},'smoke.txt',${blob.url},${hash},0)`;
  const downloaded = await get(blob.url, { access:'private' });
  const bytes = Buffer.from(await new Response(downloaded.stream).arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error('Cloud artifact checksum mismatch');
  console.log('Free database + private Blob artifact round trip: PASS');
} finally {
  if (blob) await del(blob.url);
  await db`DELETE FROM audit_artifacts WHERE run_id=${id}`;
  await db`DELETE FROM audit_runs WHERE id=${id} AND owner='harness-storage-smoke'`;
  console.log('Synthetic smoke-test data cleaned up.');
}
