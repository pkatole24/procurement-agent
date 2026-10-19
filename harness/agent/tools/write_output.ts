import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { actor } from '../../lib/engine';
import { assertOwned } from '../../lib/domain';
import { writeArtifact } from '../../lib/artifacts';

export default defineTool({
  description: 'Write your owned output as a complete strict JSON or Markdown file. Original scripts, evidence, and approvals are immutable.',
  inputSchema: z.object({ name: z.string(), content: z.string().max(600000) }),
  async execute({ name, content }, ctx) {
    const { run, role } = await actor(ctx.session.auth.initiator);
    assertOwned(role, name);
    if (name.endsWith('.json')) JSON.parse(content);
    const hash = await writeArtifact(run.id, name, content, run.version);
    return { name, sha256: hash };
  }
});
