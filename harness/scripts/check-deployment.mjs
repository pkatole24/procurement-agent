const origin = process.env.APP_ORIGIN || 'https://procurement-audit-harness.vercel.app';
for (const path of ['/', '/workspace', '/example/planning-memo', '/example/review', '/example/evidence?ref=rule%3ACPR-001', '/example/evidence?ref=metric%3A%24.tests.split_purchases.overall.windows', '/example/sources/contract-rules.pdf', '/example/samples/T-01A.csv']) {
  const response = await fetch(origin + path, { redirect:'manual' });
  if (response.status !== 200) throw new Error(`HTTP ${response.status}: ${path}`);
  console.log(`HTTP 200: ${path}`);
}
for (const path of ['/api/runs', '/api/runs/00000000-0000-0000-0000-000000000000/artifacts?name=rules.json', '/eve/v1/info']) {
  const response = await fetch(origin + path, { redirect:'manual' });
  if (response.status !== 401) throw new Error(`Expected private-route 401, got ${response.status}: ${path}`);
  console.log(`Anonymous access denied: ${path}`);
}
const ready = await (await fetch(origin + '/api/readiness')).json();
console.log(JSON.stringify({ liveReady: ready.ready, missingConfiguration: ready.missing }));
