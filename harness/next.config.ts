import type { NextConfig } from 'next';
import { withEve } from 'eve/next';

const config: NextConfig = {
  outputFileTracingIncludes: { '/*': ['./evidence/**/*', './worker/runner.py'] },
  serverExternalPackages: ['@vercel/sandbox']
};
export default withEve(config);
