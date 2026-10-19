import { z } from 'zod';
import { requireAuditor, auth } from '../../../../lib/auth';
import { getRun, sql, updateRun, event } from '../../../../lib/db';
import { decisionSchema, validateDecisions, commentsMarkdown, type Role } from '../../../../lib/domain';
import { readJson, readArtifact, writeArtifact } from '../../../../lib/artifacts';
import { dispatch, deliver, cancelSessions } from '../../../../lib/dispatch';
import { errorResponse, sameOrigin } from '../../../../lib/http';
import { readiness } from '../../../../lib/readiness';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    await requireAuditor(); const { id } = await context.params; const run = await getRun(id);
    const artifacts = await sql()`SELECT name,version FROM audit_artifacts WHERE run_id=${id} ORDER BY name`;
    const events = await sql()`SELECT id,role,message,created_at FROM audit_events WHERE run_id=${id} ORDER BY id DESC LIMIT 100`;
    const usage = await sql()`SELECT role,turn_id,step_index,generation_id,cost_usd,input_tokens,output_tokens,created_at FROM audit_model_steps WHERE run_id=${id} ORDER BY created_at,role,turn_id,step_index`;
    const risks = artifacts.some(a => a.name === 'risk-ratings.json') ? (await readJson(id, 'risk-ratings.json')).risks : [];
    return Response.json({ run, artifacts, events, usage, risks });
  } catch (e) { return errorResponse(e); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    sameOrigin(request); const auditor = await requireAuditor(); const { id } = await context.params;
    const input = await request.json(); const run = await getRun(id);
    if (input.version !== run.version) throw new Error('Stale run version');
    if (input.action === 'cancel') {
      await updateRun(run, 'cancelled', run.data); await cancelSessions(id);
      await event(id, 'auditor', `Cancelled by GitHub account ${auditor}`, `cancel:${run.version}`);
    } else if (input.action === 'decisions') {
      if (run.stage !== 'risk-review' || !readiness().ready) throw new Error('Risk approval gate unavailable');
      const parsed = decisionSchema.parse(input); const ratings = await readJson(id, 'risk-ratings.json');
      validateDecisions(ratings.risks, parsed, run.version);
      await updateRun(run, 'revising', { ...run.data, decisions: parsed.decisions, approvedBy: auditor, approvedRegisterVersion: run.version });
      await writeArtifact(id, 'auditor-comments.md', commentsMarkdown(parsed.decisions), run.version);
      await event(id, 'auditor', 'Submitted version-bound risk decisions.', `decisions:${run.version}`);
      await dispatch(id, 'risk-assessor', 'The auditor submitted decisions in auditor-comments.md. Apply only requested changes, declare revision, build the revision, verify gate, then complete_stage. Do not alter decisions.', `revise:${run.version}`);
    } else if (input.action === 'signoff') {
      if (run.stage !== 'signoff' || input.packVersion !== run.pack_version || run.data.qaVersion !== run.pack_version) throw new Error('Latest passing pack required');
      const comments = z.string().max(4000).parse(input.comments || ''); const session = await auth();
      const current = (await readArtifact(id, 'review.md')).toString('utf8');
      const signoff = { account: auditor, name: session?.user?.name || auditor, date: new Date().toISOString(), comments, packVersion: run.pack_version };
      const escape = (s: string) => s.replace(/[\r\n]/g, ' ').replace(/([\\`*_{}\[\]<>#])/g, '\\$1');
      await updateRun(run, 'signed-off', { ...run.data, signoff });
      await writeArtifact(id, 'review.md', current.split('## Auditor sign-off')[0] + `## Auditor sign-off\n\nDecision: Sign off\n\nName: ${escape(signoff.name)} (GitHub ID ${auditor})\n\nDate: ${signoff.date}\n\nPack version: ${run.pack_version}\n\nComments: ${escape(comments)}\n`, run.version);
      await cancelSessions(id); await event(id, 'auditor', 'Signed off the latest verified pack.', `signoff:${run.pack_version}`);
    } else if (input.action === 'return') {
      if (run.stage !== 'signoff' || input.packVersion !== run.pack_version || !readiness().ready) throw new Error('Current sign-off gate required');
      const reason = z.string().trim().min(10).max(4000).parse(input.reason);
      await updateRun(run, 'planning', { ...run.data, qaVersion: null, plannerDone: null, challengerDone: null, returnedBy: auditor, returnReason: reason });
      await event(id, 'auditor', `Returned pack v${run.pack_version}: ${reason}`, `return:${run.version}`);
      await dispatch(id, 'planner', `The auditor returned pack v${run.pack_version} for correction: ${reason}. Revise audit-plan.json only within approved scope, rebuild and re-announce PACK READY. Preserve the existing two-round challenge limit. Tell the lead if a rating or scope decision is needed.`, `return:${run.version}:planner`);
    } else if (input.action === 'retry') {
      if (!['paused','blocked'].includes(run.stage) || !readiness().ready) throw new Error('Retry unavailable');
      const stage = run.data.resumeStage;
      if (!['extracting','analysing','assessing','revising','planning'].includes(stage)) throw new Error('No resumable stage');
      await updateRun(run, stage, { ...run.data, error: null });
      const pending = await sql()`SELECT operation_key FROM audit_mail WHERE run_id=${id} AND delivered=false`;
      for (const mail of pending) await deliver(id, mail.operation_key);
      const roles: Role[] = stage === 'extracting' ? ['extract-rules'] : stage === 'analysing' ? ['spend-analyst','findings-analyst'].filter(r => !run.data.done?.[r]) as Role[] : stage === 'planning' ? ['planner','challenger','qa-reviewer'] : ['risk-assessor'];
      for (const role of roles) await dispatch(id, role, 'Resume from the persisted artifacts and prior messages. Do not repeat committed decisions. Verify the owned output and finish the current stage/protocol.', `retry:${run.version}:${role}`);
    } else throw new Error('Unknown action');
    return Response.json({ id });
  } catch (e) { return errorResponse(e); }
}
