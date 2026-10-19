import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { actor } from '../../lib/engine';
import { updateRun, event } from '../../lib/db';

export default defineTool({
  description: 'Stop and report missing/malformed evidence or a failure outside your ownership. Preserve progress; do not invent evidence or weaken checks.',
  inputSchema: z.object({ reason: z.string().min(10).max(4000) }),
  async execute({ reason }, ctx) {
    const { run, role } = await actor(ctx.session.auth.initiator);
    await updateRun(run, 'blocked', { ...run.data, resumeStage: run.stage, error: reason });
    await event(run.id, role, reason, `block:${ctx.callId}`);
    return { blocked: true };
  },
  endsTurn: true
});
