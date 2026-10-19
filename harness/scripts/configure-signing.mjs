import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['exec','--yes','--package=vercel','--','vercel','env','add','AUTH_SECRET','production','--sensitive','--yes','--scope','pvk'], {
  input: randomBytes(48).toString('base64url') + '\n', encoding: 'utf8', shell: process.platform === 'win32'
});
if (result.status !== 0) throw new Error('Signing-key setup failed; inspect the Vercel environment names without printing values.');
console.log('Production signing key configured without displaying or saving its value locally.');
