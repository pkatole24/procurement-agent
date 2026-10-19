export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Request failed';
  const status = message === 'Unauthorized' ? 401 : message === 'Run not found' ? 404 : 409;
  console.error('Harness request failed:', message === 'Unauthorized' ? message : error instanceof Error ? error.name : 'UnknownError');
  const safeMessages = ['Stale run version','The register changed. Reload before submitting decisions.','Decide every risk exactly once','Describe every requested change','Latest passing pack required','Current sign-off gate required','Live configuration incomplete','Retry unavailable','No resumable stage'];
  return Response.json({ error: status === 401 ? 'Sign in with an authorized GitHub account.' : status === 404 || safeMessages.includes(message) ? message : 'Action could not complete. Reload the workspace and check configuration, stage and version.' }, { status });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) throw new Error('Unauthorized');
}
