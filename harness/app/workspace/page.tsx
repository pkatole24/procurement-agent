import { auth, isAuditor, signIn, signOut } from '../../lib/auth';
import { readiness } from '../../lib/readiness';
import Workspace from '../../components/workspace';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const configured = !!(process.env.AUTH_SECRET && process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
  const session = configured ? await auth() : null;
  const ready = readiness();
  return <section className="section workspace"><p className="eyebrow">PRIVATE AUDITOR WORKSPACE</p><h1>Evidence to decision.</h1><p className="lede">Run the WBC audit workflow, review recommendations and approve the final pack. This project's AI Gateway budget is $4 with no reset.</p>{session?.user?.id && isAuditor(session.user.id) ? <><div className="session-bar"><span>Signed in as {session.user.name}</span><form action={async () => { 'use server'; await signOut({ redirectTo: '/' }); }}><button className="text-link">Sign out</button></form></div><Workspace readiness={ready} /></> : <div className="login-panel"><h2>Auditor access</h2><p>Private controls are restricted to authorized GitHub accounts. The completed example is open to everyone.</p>{configured ? <form action={async () => { 'use server'; await signIn('github', { redirectTo: '/workspace' }); }}><button className="button">Continue with GitHub ↗</button></form> : <p className="notice">GitHub sign-in is awaiting deployment configuration. The public example is available now.</p>}</div>}</section>;
}
