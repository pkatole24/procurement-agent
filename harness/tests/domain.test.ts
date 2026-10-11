import test from 'node:test';
import assert from 'node:assert/strict';
import { assertOwned, assertActive, safeArtifact, validateDecisions, commentsMarkdown, type Run } from '../lib/domain';
import { verifyService, signService } from '../lib/service-auth';
import { readiness } from '../lib/readiness';
import { modelFailureMessage } from '../lib/model-failure';

test('agents cannot overwrite approvals or another role output', () => {
  assert.doesNotThrow(() => assertOwned('planner', 'audit-plan.json'));
  for (const role of ['planner','challenger','risk-assessor'] as const) assert.throws(() => assertOwned(role, 'auditor-comments.md'));
  assert.throws(() => assertOwned('qa-reviewer', 'review.md'));
  assert.throws(() => assertOwned('planner', 'rules.json'));
});
test('approvals cover all risks and reject stale versions and missing change reasons', () => {
  const risks = [{ id: 'R-01' }, { id: 'R-02' }];
  const valid = { version: 7, decisions: risks.map(r => ({ ...r, decision: 'Approve' as const, comment: '' })) };
  assert.doesNotThrow(() => validateDecisions(risks, valid, 7));
  assert.throws(() => validateDecisions(risks, valid, 8));
  assert.throws(() => validateDecisions(risks, { ...valid, decisions: [valid.decisions[0]] }, 7));
  assert.throws(() => validateDecisions(risks, { ...valid, decisions: [{ ...valid.decisions[0], decision: 'Change' },valid.decisions[1]] }, 7));
});
test('file paths cannot escape a run and comments cannot corrupt the existing pipe parser', () => {
  assert.throws(() => safeArtifact('../rules.json'));
  assert.throws(() => safeArtifact('samples/../../data/a.pdf'));
  assert.equal(safeArtifact('samples/T-01.csv'), 'samples/T-01.csv');
  const row = commentsMarkdown([{ id:'R-01', decision:'Change', comment:'A | B\nC' }]).split('\n').find(s => s.includes('R-01'))!;
  assert.equal(row.split('|').length, 5);
});
test('planning tools are unavailable before scope approval and after cancellation', () => {
  const run = { stage: 'risk-review' } as Run;
  assert.throws(() => assertActive(run, 'planner'));
  assert.throws(() => assertActive({ ...run, stage: 'cancelled' }, 'risk-assessor'));
});
test('internal service requests bind role context, expire, and reject tampering', () => {
  process.env.AUTH_SECRET = 'test-key-at-least-32-characters-long';
  const body = JSON.stringify({ runId:'example', role:'planner' });
  const signed = signService(body);
  assert.equal(verifyService(body, signed.timestamp, signed.signature), true);
  assert.equal(verifyService(body.replace('planner','challenger'), signed.timestamp, signed.signature), false);
  const expired = signService(body, String(Date.now() - 120000));
  assert.equal(verifyService(body, expired.timestamp, expired.signature), false);
  delete process.env.AUTH_SECRET;
});
test('live controls fail closed with incomplete configuration or direct provider credentials', () => {
  assert.equal(readiness({}).ready, false);
  const configured = Object.fromEntries(['AUTH_SECRET','AUTH_GITHUB_ID','AUTH_GITHUB_SECRET','AUDITOR_GITHUB_IDS','DATABASE_URL','BLOB_READ_WRITE_TOKEN','VERCEL_SANDBOX_SNAPSHOT_ID'].map(k => [k,'configured']));
  assert.equal(readiness({ ...configured, FREE_CREDITS_CONFIRMED:'true' }).ready, true);
  assert.equal(readiness({ ...configured, FREE_CREDITS_CONFIRMED:'true', ANTHROPIC_API_KEY:'paid' }).ready, false);
});
test('a Gateway card-verification rejection gives the auditor the actionable cause', () => {
  const message = modelFailureMessage({ code: 'model_call_failed', message: 'Gateway rejected request', details: { upstreamType: 'customer_verification_required', statusCode: 403 } });
  assert.match(message, /valid credit card/);
  assert.doesNotMatch(message, /credit balance/);
});
