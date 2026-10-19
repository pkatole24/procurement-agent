import { randomUUID } from 'node:crypto';
import { getRun, updateRun, event, sql } from './db';
import { readArtifact, readJson, writeArtifact } from './artifacts';
import { dispatch, deliver } from './dispatch';
import { python } from './python';
import { assertActive, type Role, type Run } from './domain';

export async function actor(auth: { attributes?: Record<string, unknown> } | null | undefined) {
  const runId = auth?.attributes?.runId;
  const role = auth?.attributes?.role as Role;
  if (typeof runId !== 'string' || !role) throw new Error('Missing verified run identity');
  const run = await getRun(runId);
  assertActive(run, role);
  return { run, role };
}
const roleCommands: Record<Role, string[]> = {
  'extract-rules': ['verify-rules'], 'spend-analyst': ['analyse','verify-analytics'],
  'findings-analyst': ['verify-history'], 'risk-assessor': ['register','gate'],
  planner: ['gate','pack'], challenger: [], 'qa-reviewer': ['qa']
};
export async function runCheck(run: Run, role: Role, command: string, key: string) {
  if (!roleCommands[role]?.includes(command)) throw new Error('Command outside role ownership');
  const result = await python(run, { action: 'command', command }, key);
  await event(run.id, role, `${command}: ${result.passed ? 'PASS' : 'FAIL'}\n${result.stdout}\n${result.stderr}`, key);
  if (command === 'pack' && result.passed) {
    const current = await getRun(run.id);
    if (!current.data.appliedChecks?.includes(key)) await updateRun(current, 'planning', { ...current.data, qaVersion: null, plannerDone: null, challengerDone: null, appliedChecks: [...(current.data.appliedChecks || []), key] }, current.pack_version + 1);
  }
  if (command === 'qa') {
    const current = await getRun(run.id);
    if (current.pack_version !== run.pack_version) throw new Error('Pack changed during QA; rerun checks');
    if (!current.data.appliedChecks?.includes(key)) await updateRun(current, 'planning', { ...current.data, qaVersion: result.passed ? run.pack_version : null, qaReport: result.stdout, appliedChecks: [...(current.data.appliedChecks || []),key] });
  }
  return result;
}
async function ensureCheck(run: Run, role: Role, command: string, key: string) {
  const result = await runCheck(run, role, command, key);
  if (!result.passed) throw new Error(`${command} failed. Correct the owned output before retrying.`);
}
export async function completeStage(run: Run, role: Role, key: string) {
  if (role === 'extract-rules') {
    await ensureCheck(run, role, 'verify-rules', key + ':verify');
    const current = await getRun(run.id);
    await updateRun(current, 'analysing', { ...current.data, done: {} });
    await Promise.all([
      dispatch(run.id, 'spend-analyst', 'Run analyse and verify-analytics using the unchanged scripts; finish with complete_stage.', `${key}:spend`),
      dispatch(run.id, 'findings-analyst', 'Extract all committee evidence into history.json, verify it, and finish with complete_stage.', `${key}:history`)
    ]);
  } else if (role === 'spend-analyst' || role === 'findings-analyst') {
    await ensureCheck(run, role, role === 'spend-analyst' ? 'verify-analytics' : 'verify-history', key + ':verify');
    let current = await getRun(run.id);
    const done = { ...current.data.done, [role]: true };
    const both = done['spend-analyst'] && done['findings-analyst'];
    try { current = await updateRun(current, both ? 'assessing' : 'analysing', { ...current.data, done }); }
    catch {
      current = await getRun(run.id);
      const merged = { ...current.data.done, [role]: true };
      current = await updateRun(current, merged['spend-analyst'] && merged['findings-analyst'] ? 'assessing' : 'analysing', { ...current.data, done: merged });
    }
    if (current.stage === 'assessing') await dispatch(run.id, 'risk-assessor', 'Assess the verified rules, analytics, and history. Build the initial register and finish with complete_stage. Do not approve risks.', `assessment:${run.id}`);
  } else if (role === 'risk-assessor') {
    await ensureCheck(run, role, 'register', key + ':register');
    const current = await getRun(run.id);
    if (run.stage === 'revising') {
      await ensureCheck(current, role, 'gate', key + ':gate');
      const latest = await getRun(run.id);
      await updateRun(latest, 'planning', { ...latest.data, qaVersion: null, plannerDone: null, challengerDone: null, challengeRound: 0 });
      await dispatch(run.id, 'planner', 'Approval gate passed. Build the pack for approved risks only, then message challenger and qa-reviewer with PACK READY vN. They are waiting; preserve their names and the two-round protocol.', key + ':planner');
    } else await updateRun(current, 'risk-review', { ...current.data, registerVersion: current.version + 1 });
  } else throw new Error('Team roles complete using their DONE messages and publish_review');
  return { completed: true };
}
export function unresolvedChallenges(markdown: string) {
  return markdown.split('\n').filter(line => /^\|\s*\d+\s*\|/.test(line)).filter(line => !['resolved', 'declined', 'for the auditor'].includes(line.split('|')[8]?.trim().toLowerCase()));
}
export async function sendTeam(run: Run, role: Role, recipient: Role | 'lead', message: string, key: string, round?: number) {
  if (!['planner','challenger','qa-reviewer'].includes(role) || !['planner','challenger','qa-reviewer','lead'].includes(recipient)) throw new Error('Not a team communication');
  const db = sql();
  if (/^CHALLENGE #/.test(message)) {
    if (role !== 'challenger' || recipient !== 'planner' || ![1,2].includes(round || 0)) throw new Error('Challenge needs a round and planner recipient');
    const rows = await db`SELECT message FROM audit_mail WHERE run_id=${run.id} AND sender='challenger' AND message LIKE 'CHALLENGE #%'`;
    const sameRound = rows.filter(row => row.message.includes(`[round ${round}]`));
    const existing = await db`SELECT id FROM audit_mail WHERE run_id=${run.id} AND operation_key=${key}`;
    if (!existing.length && (rows.length >= 12 || sameRound.length >= (round === 1 ? 8 : 4))) throw new Error('Challenge round limit reached');
    message = `${message} [round ${round}]`;
  }
  if (/^PACK READY v\d+/.test(message)) {
    if (role !== 'planner' || Number(message.match(/^PACK READY v(\d+)/)?.[1]) !== run.pack_version) throw new Error('Only announce the current successfully built pack');
  }
  if (/^CHALLENGER DONE/.test(message)) {
    if (role !== 'challenger' || round !== 2) throw new Error('Challenger must finish two rounds');
    if (unresolvedChallenges((await readArtifact(run.id, 'challenges.md')).toString()).length) throw new Error('Open challenges block completion');
    const current = await getRun(run.id);
    await updateRun(current, 'planning', { ...current.data, challengerDone: run.pack_version, challengeRound: 2 });
  }
  if (/^PLANNER DONE/.test(message)) {
    const current = await getRun(run.id);
    if (role !== 'planner' || current.data.qaVersion !== run.pack_version || current.data.challengerDone !== run.pack_version) throw new Error('Latest QA and challenger completion required');
    await updateRun(current, 'planning', { ...current.data, plannerDone: run.pack_version });
  }
  if (recipient === 'lead') { await event(run.id, role, message, key); return { recorded: true }; }
  await db`INSERT INTO audit_mail (id,run_id,sender,recipient,message,operation_key) VALUES (${randomUUID()},${run.id},${role},${recipient},${message},${key}) ON CONFLICT DO NOTHING`;
  await deliver(run.id, key);
  return { delivered: true };
}
export async function publishReview(run: Run, key: string) {
  if (!run.pack_version || run.data.plannerDone !== run.pack_version || run.data.challengerDone !== run.pack_version) throw new Error('Latest planner and challenger completion required');
  await ensureCheck(run, 'qa-reviewer', 'qa', key + ':final-qa');
  const current = await getRun(run.id);
  if (unresolvedChallenges((await readArtifact(run.id, 'challenges.md')).toString()).length) throw new Error('Unresolved challenge');
  if (current.pack_version !== run.pack_version) throw new Error('Pack changed during final review');
  await writeArtifact(run.id, 'review.md', `${current.data.qaReport}\n\n## Auditor sign-off\n\nDecision:\n\nName:\n\nDate:\n\nComments:\n`, current.version);
  await event(run.id, 'qa-reviewer', `QA DONE v${run.pack_version}`, key);
  await updateRun(current, 'signoff', { ...current.data, signoffVersion: current.pack_version });
  return { verdict: 'READY FOR SIGN-OFF', version: current.pack_version };
}
