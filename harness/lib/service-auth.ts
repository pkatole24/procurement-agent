import { createHmac, timingSafeEqual } from 'node:crypto';

export function signService(body: string, timestamp = String(Date.now())) {
  if (!process.env.AUTH_SECRET) throw new Error('Service signing key unavailable');
  return { timestamp, signature: createHmac('sha256', process.env.AUTH_SECRET).update(timestamp + '\n' + body).digest('hex') };
}
export function verifyService(body: string, timestamp: string, signature: string) {
  if (!process.env.AUTH_SECRET || !/^\d+$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 60_000 || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = signService(body, timestamp).signature;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
