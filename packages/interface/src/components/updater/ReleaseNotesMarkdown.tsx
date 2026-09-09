import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ResourceExternalAnchor from "../resources/ResourceExternalAnchor";

interface ReleaseNotesMarkdownProps {
  markdown: string;
  className?: string;
}

export const ReleaseNotesMarkdown = ({
  markdown,
  className,
}: ReleaseNotesMarkdownProps) => (
  <div className={className}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
          <ResourceExternalAnchor {...props} href={props.href ?? ""} />
          ),
        }}
    >
      {markdown}
    </ReactMarkdown>
  </div>
);

export default ReleaseNotesMarkdown;
