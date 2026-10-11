export function readiness(env: Record<string, string | undefined> = process.env) {
  const requirements = ['AUTH_SECRET','AUTH_GITHUB_ID','AUTH_GITHUB_SECRET','AUDITOR_GITHUB_IDS','DATABASE_URL','BLOB_READ_WRITE_TOKEN','VERCEL_SANDBOX_SNAPSHOT_ID'];
  const missing = requirements.filter(k => !env[k]?.trim());
  if (env.FREE_CREDITS_CONFIRMED !== 'true') missing.push('FREE_CREDITS_CONFIRMED');
  if (env.AI_GATEWAY_API_KEY || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY) missing.push('Remove paid/direct model credentials');
  if (!/^anthropic\//.test(env.HARNESS_MODEL || 'anthropic/claude-sonnet-5')) missing.push('Claude model required');
  return { ready: missing.length === 0, missing, spending: 'Budgeted AI Gateway credits only' };
}
