import { readdir, readFile, mkdir, writeFile, cp, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const original = resolve(app, '..');
const target = join(app, 'evidence');
try { await access(join(original, 'CLAUDE.md')); }
catch {
  const manifest = JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8'));
  for (const item of manifest) {
    const hash = createHash('sha256').update(await readFile(join(target, item.path))).digest('hex');
    if (hash !== item.sha256) throw new Error(`Packaged evidence changed: ${item.path}`);
  }
  await access(join(app, 'public/example/index.json'));
  console.log('Using verified standalone evidence package.');
  process.exit(0);
}
const files = [];
async function collect(directory) {
  for (const item of await readdir(join(original, directory), { withFileTypes: true })) {
    if (item.name.startsWith('.') || item.name === '__pycache__') continue;
    const path = join(directory, item.name);
    if (item.isDirectory()) await collect(path);
    else if (!item.name.endsWith('.pyc')) files.push(path);
  }
}
await collect('data');
await collect('scripts');
await collect('.claude');
files.push('CLAUDE.md', 'requirements.txt');
await mkdir(target, { recursive: true });
const manifest = [];
for (const file of files.sort()) {
  const content = await readFile(join(original, file));
  const path = file.replaceAll('\\', '/');
  manifest.push({ path, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') });
  await mkdir(dirname(join(target, file)), { recursive: true });
  await writeFile(join(target, file), content);
}
await writeFile(join(target, 'manifest.json'), JSON.stringify(manifest, null, 2));
const prompts = { guide: await readFile(join(original, 'CLAUDE.md'), 'utf8'), roles: {}, skills: {} };
for (const name of ['spend-analyst','findings-analyst','risk-assessor','planner','challenger','qa-reviewer']) prompts.roles[name] = await readFile(join(original, '.claude/agents', `${name}.md`), 'utf8');
for (const name of ['extract-rules','risk-assessment','audit-program']) prompts.skills[name] = await readFile(join(original, '.claude/skills', name, 'SKILL.md'), 'utf8');
await writeFile(join(target, 'prompts.json'), JSON.stringify(prompts));
await writeFile(join(target, 'worker.json'), JSON.stringify({ content: await readFile(join(app, 'worker/runner.py'), 'utf8') }));
const publicDir = join(app, 'public', 'example');
await mkdir(publicDir, { recursive: true });
const documents = ['risk-register.md', 'planning-memo.md', 'risk-control-matrix.md', 'audit-program.md', 'challenges.md', 'review.md'];
for (const name of documents) await cp(join(original, 'outputs', name), join(publicDir, name));
for (const name of ['rules.json', 'analytics.json', 'history.json']) await cp(join(original, 'outputs', name), join(publicDir, name));
await cp(join(original, 'outputs', 'samples'), join(publicDir, 'samples'), { recursive: true });
await cp(join(original, 'data'), join(publicDir, 'sources'), { recursive: true });
const samples = (await readdir(join(publicDir, 'samples'))).filter(name => name.endsWith('.csv'));
const sources = manifest.filter(item => item.path.startsWith('data/')).map(item => ({ ...item, url: `/example/sources/${item.path.slice(5)}` }));
await writeFile(join(publicDir, 'index.json'), JSON.stringify({ documents, samples, sources, dataset: 'West Berkshire Council', manifestHash: createHash('sha256').update(JSON.stringify(manifest)).digest('hex') }, null, 2));
console.log(`Packaged ${manifest.length} original files without editing their contents.`);
