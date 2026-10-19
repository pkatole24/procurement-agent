import { Sandbox } from '@vercel/sandbox';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.env.FREE_HOBBY_CONFIRMED !== 'true') throw new Error('Set FREE_HOBBY_CONFIRMED=true only for the confirmed Hobby project');
const app = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(app, 'evidence/manifest.json'), 'utf8'));
const sandbox = await Sandbox.create({ persistent: false, resources: { vcpus: 1 }, timeout: 270_000 });
try {
  await sandbox.writeFiles(await Promise.all(manifest.map(async item => ({ path: `/vercel/sandbox/project/${item.path}`, content: await readFile(resolve(app, 'evidence', item.path)) }))));
  await sandbox.writeFiles([{ path: '/vercel/sandbox/project/harness-constraints.txt', content: await readFile(resolve(app, 'worker/constraints.txt')) }]);
  for (const options of [
    { cmd: 'bash', args: ['-c', 'apt-get update && apt-get install -y poppler-utils python3-venv'], sudo: true },
    { cmd: 'python3', args: ['-m', 'venv', '/vercel/sandbox/project/.venv'] },
    { cmd: '/vercel/sandbox/project/.venv/bin/pip', args: ['install', '-r', '/vercel/sandbox/project/requirements.txt', '-c', '/vercel/sandbox/project/harness-constraints.txt'] },
    { cmd: 'bash', args: ['-c', 'chmod -R a-w /vercel/sandbox/project/data /vercel/sandbox/project/scripts /vercel/sandbox/project/.claude; mkdir -p /vercel/sandbox/project/outputs'] }
  ]) {
    const result = await sandbox.runCommand(options);
    if (result.exitCode !== 0) throw new Error(`Environment preparation failed: ${await result.stderr()}`);
  }
  const snapshot = await sandbox.snapshot();
  console.log(`Set VERCEL_SANDBOX_SNAPSHOT_ID=${snapshot.snapshotId} in the harness environment.`);
} finally { await sandbox.stop(); }
