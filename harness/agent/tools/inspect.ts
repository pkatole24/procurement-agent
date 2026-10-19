import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { actor } from '../../lib/engine';
import { readArtifact } from '../../lib/artifacts';
import { python } from '../../lib/python';
import { sql } from '../../lib/db';
import manifest from '../../evidence/manifest.json';

export default defineTool({
  description: 'List evidence and artifacts; read an artifact in bounded pages, preview CSV aggregates, or inspect one PDF page in plain, layout and image form.',
  inputSchema: z.object({ file: z.string().optional(), page: z.number().int().positive().optional(), offset: z.number().int().nonnegative().default(0) }),
  async execute(input, ctx) {
    const { run, role } = await actor(ctx.session.auth.initiator);
    if (!input.file) return { sources: manifest.filter(x => x.path.startsWith('data/')), artifacts: await sql()`SELECT name FROM audit_artifacts WHERE run_id=${run.id}` };
    if (input.file.startsWith('data/')) {
      if (!['extract-rules','findings-analyst'].includes(role)) throw new Error('Source PDFs are limited to extraction roles');
      return python(run, { action: 'pdf', file: input.file.slice(5), page: input.page || 1 }, `inspect:${ctx.callId}`);
    }
    const name = input.file.replace(/^outputs\//, '');
    if (name.startsWith('analytics-full/')) {
      if (role === 'challenger') throw new Error('Challenger uses summary evidence only');
      return python(run, { action: 'preview', file: name.slice(15) }, `inspect:${ctx.callId}`);
    }
    const text = (await readArtifact(run.id, name)).toString('utf8');
    return { text: text.slice(input.offset, input.offset + 18000), offset: input.offset, nextOffset: input.offset + 18000 < text.length ? input.offset + 18000 : null, characters: text.length };
  },
  toModelOutput(result: any) {
    if (result.image) return { type: 'content' as const, value: [
      { type: 'text' as const, text: JSON.stringify({ ...result, image: undefined }) },
      { type: 'file' as const, data: { type: 'data' as const, data: result.image }, mediaType: 'image/png' }
    ] };
    return { type: 'json' as const, value: result };
  }
});
