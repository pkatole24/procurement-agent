import Link from 'next/link';
import { notFound } from 'next/navigation';
import { documents, exampleDocument } from '../../../lib/example';
import Markdown from '../../../components/markdown';

export default async function Document({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  if (!(document in documents)) notFound();
  const key = document as keyof typeof documents;
  const doc = documents[key];
  return <section className="section document-page"><div className="document-toolbar"><Link href="/">← Completed example</Link><a href={`/example/${doc.file}`} download className="button secondary">Download Markdown ↓</a></div><p className="eyebrow">FROZEN EXAMPLE · ORIGINAL RUN</p><Markdown text={await exampleDocument(key)} example /></section>;
}
