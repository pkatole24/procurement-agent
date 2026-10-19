import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { actor, completeStage } from '../../lib/engine';

export default defineTool({
  description: 'Verify and finish your extraction, analysis, or risk-assessment stage. The server enforces the next stage and human gate.',
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const { run, role } = await actor(ctx.session.auth.initiator);
    return completeStage(run, role, `finish:${ctx.callId}`);
  },
  endsTurn: true
});
