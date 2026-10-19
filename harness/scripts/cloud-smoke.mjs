import { Sandbox } from '@vercel/sandbox';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const app = resolve(import.meta.dirname, '..');
const snapshotId = process.env.VERCEL_SANDBOX_SNAPSHOT_ID;
if (!snapshotId) throw new Error('Set the prepared snapshot ID');
const files = [];
async function collect(path) {
  for (const entry of await readdir(join(app, '..', 'outputs', path), { withFileTypes: true })) {
    if (entry.name === '__pycache__') continue;
    const name = join(path, entry.name);
    if (entry.isDirectory()) await collect(name);
    else files.push({ path: `/vercel/sandbox/project/outputs/${name.replaceAll('\\','/')}`, content: await readFile(join(app, '..', 'outputs', name)) });
  }
}
await collect('');
const sandbox = await Sandbox.create({ source: { type: 'snapshot', snapshotId }, persistent: false, resources: { vcpus: 1 }, timeout: 270000, networkPolicy: 'deny-all' });
try {
  await sandbox.writeFiles([...files, { path: '/vercel/sandbox/project/runner.py', content: await readFile(join(app, 'worker/runner.py')) }]);
  for (const command of ['gate','qa']) {
    await sandbox.writeFiles([{ path: '/vercel/sandbox/project/request.json', content: Buffer.from(JSON.stringify({ action:'command', command })) }]);
    const execution = await sandbox.runCommand({ cmd: '/vercel/sandbox/project/.venv/bin/python', args: ['/vercel/sandbox/project/runner.py'], cwd: '/vercel/sandbox/project' });
    const bytes = await sandbox.readFileToBuffer({ path: '/vercel/sandbox/project/result.json' });
    const result = JSON.parse(bytes?.toString() || '{}');
    if (execution.exitCode !== 0 || !result.passed) throw new Error(`Cloud ${command} failed`);
    console.log(`Cloud ${command}: PASS`);
    if (command === 'qa') console.log(result.stdout);
  }
} finally { await sandbox.stop(); }
