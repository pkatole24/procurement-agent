import { Client } from 'eve/client';
import { randomUUID } from 'node:crypto';
import { signService } from './service-auth';
import { sql, event } from './db';
import { readiness } from './readiness';
import type { Role } from './domain';

function origin() { return process.env.APP_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'); }
export function serviceHeaders(runId: string, role: Role) {
  const body = JSON.stringify({ runId, role });
  const signed = signService(body);
  return { 'x-harness-context': Buffer.from(body).toString('base64url'), 'x-harness-time': signed.timestamp, 'x-harness-signature': signed.signature };
}
export async function dispatch(runId: string, role: Role, message: string, key: string) {
  if (!readiness().ready) throw new Error('Live harness configuration is incomplete');
  const db = sql();
  await db`INSERT INTO audit_mail (id,run_id,sender,recipient,message,operation_key) VALUES (${randomUUID()},${runId},'lead',${role},${message},${key}) ON CONFLICT DO NOTHING`;
  await deliver(runId, key);
}
export async function deliver(runId: string, key: string) {
  const db = sql();
  const [mail] = await db`SELECT * FROM audit_mail WHERE run_id=${runId} AND operation_key=${key}`;
  if (!mail || mail.delivered) return;
  const role = mail.recipient as Role;
  const client = new Client({ host: origin(), headers: () => serviceHeaders(runId, role), redirect: 'manual' });
  let [stored] = await db`SELECT session_id FROM audit_sessions WHERE run_id=${runId} AND role=${role}`;
  if (!stored) {
    const { session } = await client.sessions.create();
    await db`INSERT INTO audit_sessions (run_id,role,session_id) VALUES (${runId},${role},${session.state.sessionId}) ON CONFLICT DO NOTHING`;
    [stored] = await db`SELECT session_id FROM audit_sessions WHERE run_id=${runId} AND role=${role}`;
  }
  await client.sessions.attach(stored.session_id).send(`[Delivery ${mail.id}; sender ${mail.sender}]\n${mail.message}`);
  await db`UPDATE audit_mail SET delivered=true WHERE id=${mail.id}`;
  await event(runId, mail.sender, `${role}: ${mail.message}`, `mail:${mail.id}`);
}
export async function cancelSessions(runId: string) {
  const rows = await sql()`SELECT * FROM audit_sessions WHERE run_id=${runId}`;
  await Promise.allSettled(rows.map(row => new Client({ host: origin(), headers: () => serviceHeaders(runId, row.role), redirect: 'manual' }).sessions.attach(row.session_id).cancel()));
}
