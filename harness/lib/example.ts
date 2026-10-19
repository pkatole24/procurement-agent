import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const documents = {
  'risk-register': { file: 'risk-register.md', title: 'Risk register', description: 'Evidence, ratings and approved audit focus' },
  'planning-memo': { file: 'planning-memo.md', title: 'Planning memo', description: 'Purpose, scope and the approach to this audit' },
  'risk-control-matrix': { file: 'risk-control-matrix.md', title: 'Risk–control matrix', description: 'How risks connect to controls and tests' },
  'audit-program': { file: 'audit-program.md', title: 'Audit program', description: 'Test steps, targeted samples and evidence requests' },
  challenges: { file: 'challenges.md', title: 'Team challenges', description: 'Questions raised and how the planner resolved them' },
  review: { file: 'review.md', title: 'QA and sign-off', description: 'Quote, number, traceability and sample checks' }
} as const;
export async function exampleIndex() { return JSON.parse(await readFile(join(process.cwd(), 'public/example/index.json'), 'utf8')); }
export async function exampleDocument(key: keyof typeof documents) { return readFile(join(process.cwd(), 'public/example', documents[key].file), 'utf8'); }
