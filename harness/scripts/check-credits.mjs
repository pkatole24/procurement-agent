import { gateway } from 'ai';
try {
  const credits = await gateway.getCredits();
  console.log(JSON.stringify({ availableCredit: credits.balance, usedCredit: credits.totalUsed }));
} catch (error) {
  console.log(JSON.stringify({ available: false, category: error?.name || 'GatewayError', message: 'Credit access could not be verified; live execution must remain disabled.' }));
  process.exitCode = 1;
}
