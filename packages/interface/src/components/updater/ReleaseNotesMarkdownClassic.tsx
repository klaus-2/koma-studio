import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import ResourceExternalAnchor from "../resources/ResourceExternalAnchor";

interface ReleaseNotesMarkdownProps {
  markdown: string;
  className?: string;
}

// Hoisted so the markdown pipeline identity is stable across renders: fresh
// plugin/component arrays would force react-markdown to re-parse the whole
// changelog on every parent render.
const REMARK_PLUGINS = [remarkGfm];

const COMPONENTS: Components = {
  a: ({ node: _node, ...props }) => (
    <ResourceExternalAnchor {...props} href={props.href ?? ""} />
  ),
};

export const ReleaseNotesMarkdownClassic = memo(function ReleaseNotesMarkdownClassic({
  markdown,
  className,
}: ReleaseNotesMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
});

export default ReleaseNotesMarkdownClassic;
