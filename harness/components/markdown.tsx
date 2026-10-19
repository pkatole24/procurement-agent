import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Markdown({ text, example = false }: { text: string; example?: boolean }) {
  const linked = example ? text.replace(/\[(rule|metric|history):([^\]]+)\]/g, (_match, kind, reference) => `[${kind}:${reference.replace(/([\\\[\]])/g, '\\$1')}](/example/evidence?ref=${encodeURIComponent(kind + ':' + reference)})`) : text;
  return <article className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{linked}</ReactMarkdown></article>;
}
