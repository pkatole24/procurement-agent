import { Sandbox } from '@vercel/sandbox';
import worker from '../evidence/worker.json';
import { readArtifact, writeArtifact } from './artifacts';
import { sql } from './db';
import type { Run } from './domain';

export async function python(run: Run, request: Record<string, unknown>, operationKey: string) {
  const db = sql();
  const cached = await db`SELECT result FROM audit_operations WHERE run_id=${run.id} AND operation_key=${operationKey}`;
  if (cached[0]) return cached[0].result;
  if (!process.env.VERCEL_SANDBOX_SNAPSHOT_ID) throw new Error('Python environment is not prepared');
  const sandbox = await Sandbox.create({ source: { type: 'snapshot', snapshotId: process.env.VERCEL_SANDBOX_SNAPSHOT_ID }, persistent: false, resources: { vcpus: 1 }, timeout: 270_000, networkPolicy: 'deny-all' });
  try {
    const previous = await db`SELECT name FROM audit_artifacts WHERE run_id=${run.id}`;
    const root = '/vercel/sandbox/project';
    await sandbox.writeFiles([
      { path: `${root}/runner.py`, content: Buffer.from(worker.content) },
      { path: `${root}/request.json`, content: Buffer.from(JSON.stringify(request)) },
      ...await Promise.all(previous.map(async row => ({ path: `${root}/outputs/${row.name}`, content: await readArtifact(run.id, row.name) })))
    ]);
    const command = await sandbox.runCommand({ cmd: `${root}/.venv/bin/python`, args: [`${root}/runner.py`], cwd: root });
    const buffer = await sandbox.readFileToBuffer({ path: `${root}/result.json` });
    if (!buffer) throw new Error(`Python runner stopped (exit ${command.exitCode})`);
    const result = JSON.parse(buffer.toString('utf8'));
    if (result.error) throw new Error(result.error);
    if (request.action === 'command' && result.passed) {
      const manifest = await sandbox.readFileToBuffer({ path: `${root}/output-manifest.json` });
      if (!manifest) throw new Error('Python output manifest missing');
      for (const name of JSON.parse(manifest.toString('utf8')) as string[]) {
        const content = await sandbox.readFileToBuffer({ path: `${root}/outputs/${name}` });
        if (!content) throw new Error(`Python output missing: ${name}`);
        await writeArtifact(run.id, name, content, run.version);
      }
    }
    await db`INSERT INTO audit_operations (run_id,operation_key,result) VALUES (${run.id},${operationKey},${JSON.stringify(result)}::jsonb) ON CONFLICT DO NOTHING`;
    return result;
  } finally { await sandbox.stop(); }
}
