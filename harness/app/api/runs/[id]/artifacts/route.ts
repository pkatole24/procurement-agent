import { requireAuditor } from '../../../../../lib/auth';
import { getRun } from '../../../../../lib/db';
import { readArtifact } from '../../../../../lib/artifacts';
import { safeArtifact } from '../../../../../lib/domain';
import { errorResponse } from '../../../../../lib/http';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuditor(); const { id } = await params; await getRun(id);
    const url = new URL(request.url); const name = safeArtifact(url.searchParams.get('name') || '');
    const bytes = await readArtifact(id, name);
    return new Response(new Uint8Array(bytes), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', ...(url.searchParams.has('download') ? { 'content-disposition': `attachment; filename="${name.split('/').pop()}"` } : {}) } });
  } catch (e) { return errorResponse(e); }
}
