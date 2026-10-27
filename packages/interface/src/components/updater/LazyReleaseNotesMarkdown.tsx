import { lazy, Suspense } from "react";

// The markdown stack (react-markdown + remark-gfm) is only needed once notes
// are actually rendered; this single lazy boundary keeps it out of the eager
// entry graph for both updater modals.
const ReleaseNotesMarkdown = lazy(() => import("./ReleaseNotesMarkdown"));

interface LazyReleaseNotesMarkdownProps {
  markdown: string;
  className?: string;
}

export const LazyReleaseNotesMarkdown = ({ markdown, className }: LazyReleaseNotesMarkdownProps) => (
  <Suspense fallback={null}>
    <ReleaseNotesMarkdown markdown={markdown} className={className} />
  </Suspense>
);
