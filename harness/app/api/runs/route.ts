import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuditor } from '../../../lib/auth';
import { sql, getRun, updateRun, event } from '../../../lib/db';
import { readiness } from '../../../lib/readiness';
import { dispatch } from '../../../lib/dispatch';
import { exampleIndex } from '../../../lib/example';
import { errorResponse, sameOrigin } from '../../../lib/http';

export const dynamic = 'force-dynamic';
export async function GET() {
  try { await requireAuditor(); return Response.json({ runs: await sql()`SELECT * FROM audit_runs ORDER BY created_at DESC LIMIT 50` }); }
  catch (e) { return errorResponse(e); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const owner = await requireAuditor();
    if (!readiness().ready) throw new Error('Live configuration incomplete');
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    const dataset = (await exampleIndex()).manifestHash;
    await sql()`INSERT INTO audit_runs (id,owner,stage,data) VALUES (${id},${owner},'extracting',${JSON.stringify({ dataset, done: {} })}::jsonb) ON CONFLICT(id) DO NOTHING`;
    const run = await getRun(id);
    if (run.owner !== owner) throw new Error('Unauthorized');
    try { await dispatch(id, 'extract-rules', 'The auditor explicitly started this run. Extract all testable rules using the human-invoked skill and source PDF. Write rules.json, verify it, and finish with complete_stage.', `start:${id}`); }
    catch { await updateRun(await getRun(id), 'paused', { ...run.data, resumeStage: 'extracting', error: 'Execution could not start. Check free-service access and retry.' }); }
    await event(id, 'auditor', 'Started a fresh run on the immutable WBC dataset.', `created:${id}`);
    return Response.json({ id });
  } catch (e) { return errorResponse(e); }
}
