import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

export function isAuditor(id: unknown) {
  return typeof id === 'string' && (process.env.AUDITOR_GITHUB_IDS || '').split(',').map(s => s.trim()).filter(Boolean).includes(id);
}
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    signIn({ account }) { return isAuditor(account?.providerAccountId); },
    jwt({ token, account }) { if (account) token.githubId = account.providerAccountId; return token; },
    session({ session, token }) { if (session.user) session.user.id = String(token.githubId || ''); return session; }
  }
});
export async function requireAuditor() {
  const session = await auth();
  if (!session?.user?.id || !isAuditor(session.user.id)) throw new Error('Unauthorized');
  return session.user.id;
}
