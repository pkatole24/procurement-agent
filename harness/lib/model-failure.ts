export function modelFailureMessage(failure: { code: string; message: string; details?: unknown }) {
  const details = JSON.stringify(failure.details ?? {});
  if (/customer_verification_required/i.test(`${failure.message} ${details}`)) {
    return 'AI Gateway requires a valid credit card on the Pvk team to unlock model requests. Add it in Vercel AI Gateway, then start a new run.';
  }
  if (/insufficient_funds|quota_for_entity_exceeded|\b402\b/i.test(`${failure.message} ${details}`)) {
    return 'AI Gateway rejected the model request. Check the project budget and AI Gateway credit balance.';
  }
  return `Agent turn failed (${failure.code}). Saved progress retained.`;
}
