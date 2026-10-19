import { eveChannel } from 'eve/channels/eve';
import { verifyService } from '../../lib/service-auth';
import { roleSchema } from '../../lib/domain';
import { getRun } from '../../lib/db';
import { modelFailureMessage } from '../../lib/model-failure';

export default eveChannel({
  turnPolicy: 'queue',
  auth: async request => {
    const encoded = request.headers.get('x-harness-context');
    if (!encoded) return null;
    const body = Buffer.from(encoded, 'base64url').toString('utf8');
    if (!verifyService(body, request.headers.get('x-harness-time') || '', request.headers.get('x-harness-signature') || '')) return null;
    try {
      const claim = JSON.parse(body);
      const role = roleSchema.parse(claim.role);
      await getRun(claim.runId);
      return { authenticator: 'harness-service', principalId: `run:${claim.runId}:${role}`, principalType: 'app' as const, attributes: { runId: claim.runId, role } };
    } catch { return null; }
  },
  events: {
    async 'step.completed'(step, _channel, ctx) {
      const id = ctx.session.auth.initiator?.attributes.runId;
      const role = ctx.session.auth.initiator?.attributes.role;
      if (typeof id !== 'string' || typeof role !== 'string') return;
      const { sql } = await import('../../lib/db');
      const cost = step.usage?.costUsd;
      await sql()`INSERT INTO audit_model_steps (run_id,role,turn_id,step_index,generation_id,cost_usd,input_tokens,output_tokens)
        VALUES (${id},${role},${step.turnId},${step.stepIndex},${step.providerMetadata?.gateway.generationId || null},${cost == null ? null : cost},${step.usage?.inputTokens ?? null},${step.usage?.outputTokens ?? null})
        ON CONFLICT (run_id,role,turn_id,step_index) DO NOTHING`;
    },
    async 'turn.failed'(failure, _channel, ctx) {
      const { getRun, updateRun, event } = await import('../../lib/db');
      const id = ctx.session.auth.initiator?.attributes.runId;
      if (typeof id !== 'string') return;
      const run = await getRun(id);
      if (['cancelled', 'signed-off', 'risk-review', 'signoff'].includes(run.stage)) return;
      const reason = modelFailureMessage(failure);
      await updateRun(run, 'paused', { ...run.data, resumeStage: run.stage, error: reason });
      await event(id, 'system', reason, `failure:${ctx.session.turn.id}`);
    }
  }
});
