import { readiness } from '../../../lib/readiness';
export async function GET() { return Response.json(readiness()); }
