import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { actor, sendTeam } from '../../lib/engine';

export default defineTool({
  description: 'Send a recorded message directly to a teammate or lead. Preserve PACK READY vN, CHALLENGE #n, RESPONSE #n, QA vN, and DONE protocols. Challenger sets round=2 on its DONE messages.',
  inputSchema: z.object({ recipient: z.enum(['planner','challenger','qa-reviewer','lead']), message: z.string().max(6000), round: z.number().int().min(1).max(2).optional() }),
  async execute(input, ctx) {
    const { run, role } = await actor(ctx.session.auth.initiator);
    return sendTeam(run, role, input.recipient, input.message, `team:${ctx.callId}`, input.round);
  }
});
