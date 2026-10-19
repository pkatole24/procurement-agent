import { z } from 'zod';

export const roles = ['extract-rules', 'spend-analyst', 'findings-analyst', 'risk-assessor', 'planner', 'challenger', 'qa-reviewer'] as const;
export type Role = typeof roles[number];
export type Stage = 'extracting' | 'analysing' | 'assessing' | 'risk-review' | 'revising' | 'planning' | 'signoff' | 'signed-off' | 'paused' | 'blocked' | 'cancelled';
export type Run = { id: string; owner: string; stage: Stage; version: number; pack_version: number; data: Record<string, any>; created_at: string };
export const roleSchema = z.enum(roles);
export const decisionSchema = z.object({ version: z.number().int().nonnegative(), decisions: z.array(z.object({ id: z.string().regex(/^R-[A-Za-z0-9_-]+$/), decision: z.enum(['Approve', 'Reject', 'Change']), comment: z.string().max(4000) })).min(1) });

const owned: Record<Role, string[]> = {
  'extract-rules': ['rules.json'], 'spend-analyst': [], 'findings-analyst': ['history.json'],
  'risk-assessor': ['risk-ratings.json'], planner: ['audit-plan.json'],
  challenger: ['challenges.md'], 'qa-reviewer': []
};
export function assertOwned(role: Role, name: string) {
  if (!owned[role].includes(name)) throw new Error(`${role} cannot write ${name}`);
}
export function safeArtifact(name: string) {
  if (!/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(name) || name.split('/').some(p => p === '..' || p === '.')) throw new Error('Invalid artifact path');
  return name;
}
export function validateDecisions(risks: { id: string }[], input: z.infer<typeof decisionSchema>, version: number) {
  if (input.version !== version) throw new Error('The register changed. Reload before submitting decisions.');
  const ids = new Set(risks.map(r => r.id));
  if (input.decisions.length !== ids.size || new Set(input.decisions.map(d => d.id)).size !== ids.size || input.decisions.some(d => !ids.has(d.id))) throw new Error('Decide every risk exactly once');
  if (input.decisions.some(d => d.decision === 'Change' && !d.comment.trim())) throw new Error('Describe every requested change');
}
export function commentsMarkdown(decisions: z.infer<typeof decisionSchema>['decisions']) {
  // The unchanged Python parser splits on pipes; escaped pipes are still delimiters.
  const clean = (s: string) => s.replaceAll('|', ' / ').replace(/[\r\n]+/g, ' ');
  return '# Auditor decisions\n\n| Risk ID | Decision | Comment |\n| --- | --- | --- |\n' + decisions.map(d => `| ${d.id} | ${d.decision} | ${clean(d.comment)} |`).join('\n') + '\n';
}
export function assertActive(run: Run, role: Role) {
  const allowed: Record<Role, Stage[]> = {
    'extract-rules': ['extracting'], 'spend-analyst': ['analysing'], 'findings-analyst': ['analysing'],
    'risk-assessor': ['assessing', 'revising'], planner: ['planning'], challenger: ['planning'], 'qa-reviewer': ['planning']
  };
  if (!allowed[role].includes(run.stage)) throw new Error(`Role ${role} is unavailable at ${run.stage}`);
}
