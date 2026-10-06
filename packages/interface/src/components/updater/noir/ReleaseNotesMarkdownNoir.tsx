import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ResourceExternalAnchor from "../../resources/ResourceExternalAnchor";

interface ReleaseNotesMarkdownProps {
  markdown: string;
  className?: string;
}

export const ReleaseNotesMarkdownNoir = ({ markdown, className = "" }: ReleaseNotesMarkdownProps) => (
  <div className={`text-[12px] leading-relaxed text-paper/70 ${className}`}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node: _node, ...props }) => (
          <ResourceExternalAnchor {...props} href={props.href ?? ""} />
        ),
        h1: (p) => <h1 className="mb-2 mt-3 font-display text-sm font-black uppercase tracking-tight text-paper first:mt-0" {...p} />,
        h2: (p) => <h2 className="mb-1.5 mt-3 font-display text-[13px] font-black uppercase tracking-tight text-paper first:mt-0" {...p} />,
        h3: (p) => <h3 className="mb-1 mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-crimson" {...p} />,
        ul: (p) => <ul className="my-1.5 space-y-1 border-l border-crimson/30 pl-3" {...p} />,
        li: (p) => <li className="before:mr-1.5 before:text-crimson before:content-['▸']" {...p} />,
        code: (p) => <code className="border border-gold/25 bg-gold/8 px-1 py-0.5 font-mono text-[10px] text-gold" {...p} />,
        strong: (p) => <strong className="font-bold text-paper" {...p} />,
        p: (p) => <p className="my-1.5" {...p} />,
      }}
    >
      {markdown}
    </ReactMarkdown>
  </div>
);

export default ReleaseNotesMarkdownNoir;
