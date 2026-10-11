import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const app = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(join(app, 'evidence/manifest.json'), 'utf8'));
for (const item of manifest) {
  const content = await readFile(join(app, '..', item.path));
  if (createHash('sha256').update(content).digest('hex') !== item.sha256) throw new Error(`Original file changed: ${item.path}`);
}
const index = JSON.parse(await readFile(join(app, 'public/example/index.json'), 'utf8'));
for (const name of [...index.documents, ...index.samples.map(s => `samples/${s}`)]) {
  const a = await readFile(join(app, '..', 'outputs', name));
  const b = await readFile(join(app, 'public/example', name));
  if (!a.equals(b)) throw new Error(`Original example differs: ${name}`);
}
console.log('Original input, code, instructions and completed pack checksums verified unchanged.');
