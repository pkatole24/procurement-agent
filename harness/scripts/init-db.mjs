import { neon } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before initializing the free database');
const db = neon(process.env.DATABASE_URL);
const text = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
await db.transaction(text.split(';').filter(s => s.trim()).map(s => db.query(s)));
console.log('Harness database initialized.');
