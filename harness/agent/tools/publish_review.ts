import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { actor, publishReview } from '../../lib/engine';

export default defineTool({
  description: 'QA only: rerun all checks after team completion, publish the exact report with blank auditor sign-off, and open the final human gate.',
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const { run, role } = await actor(ctx.session.auth.initiator);
    if (role !== 'qa-reviewer') throw new Error('QA reviewer only');
    return publishReview(run, `review:${ctx.callId}`);
  },
  endsTurn: true
});
