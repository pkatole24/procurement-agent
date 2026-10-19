import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = { title: 'Procurement Audit · WBC', description: 'An evidence-led procurement audit planning workspace for West Berkshire Council.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><header className="site-header"><Link href="/" className="brand"><span className="brand-mark">P</span><span>Procurement Audit<span className="brand-sub">West Berkshire Council</span></span></Link><nav aria-label="Main navigation"><Link href="/workspace" className="nav-cta">Auditor workspace <span aria-hidden>↗</span></Link></nav></header><main>{children}</main><footer><span>Public evidence. Reproducible figures. Human judgment.</span><span>Independent audit planning · AI-assisted</span></footer></body></html>;
}
