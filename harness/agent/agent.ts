import { defineAgent, defineDynamic } from 'eve';
import { readiness } from '../lib/readiness';
import { getRun } from '../lib/db';

export default defineAgent({
  defaultTools: false,
  tool: false,
  model: defineDynamic({ events: {
    async 'step.started'(_event, ctx) {
      if (!readiness().ready) throw new Error('Live execution is disabled');
      const id = ctx.session.auth.initiator?.attributes.runId;
      if (typeof id !== 'string') throw new Error('Missing run identity');
      const run = await getRun(id);
      if (['paused','blocked','cancelled','signed-off','risk-review','signoff'].includes(run.stage)) throw new Error('Run is waiting or stopped');
      return process.env.HARNESS_MODEL || 'anthropic/claude-sonnet-5';
    }
  }}),
  limits: { maxInputTokensPerSession: 600000, maxOutputTokensPerSession: 60000, maxTokenCostUsdPerSession: 0.5 }
});
