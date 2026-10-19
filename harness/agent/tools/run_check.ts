import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { actor, runCheck } from '../../lib/engine';

export default defineTool({
  description: 'Execute an approved unchanged Python script: verify-rules, analyse, verify-analytics, verify-history, register, gate, pack, or qa. Check passed before continuing.',
  inputSchema: z.object({ command: z.enum(['verify-rules','analyse','verify-analytics','verify-history','register','gate','pack','qa']) }),
  async execute({ command }, ctx) {
    const { run, role } = await actor(ctx.session.auth.initiator);
    return runCheck(run, role, command, `check:${ctx.callId}`);
  }
});
