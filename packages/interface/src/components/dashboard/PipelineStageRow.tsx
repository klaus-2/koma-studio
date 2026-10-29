import {
  memo,
  type ComponentProps,
  type ReactElement,
} from "react";

import { PreviewStageItem } from "./PreviewStageItem";
import { TranslatorVisualStageItem } from "./TranslatorVisualStageItem";
import { CleanerStageItem } from "./CleanerStageItem";
import { TypesetterStageItem } from "./TypesetterStageItem";

type PreviewProps = ComponentProps<typeof PreviewStageItem>;
type CleanerProps = ComponentProps<typeof CleanerStageItem>;
type TranslatorProps = ComponentProps<typeof TranslatorVisualStageItem>;
type TypesetterProps = ComponentProps<typeof TypesetterStageItem>;

export type PipelineStageRowProps =
  | { kind: "cleaner"; props: CleanerProps }
  | { kind: "preview"; props: PreviewProps }
  | { kind: "translator"; props: TranslatorProps }
  | { kind: "typesetter"; props: TypesetterProps };

const PipelineStageRowComponent = (value: PipelineStageRowProps): ReactElement => {
  switch (value.kind) {
    case "cleaner":
      return <CleanerStageItem {...value.props} />;
    case "translator":
      return <TranslatorVisualStageItem {...value.props} />;
    case "typesetter":
      return <TypesetterStageItem {...value.props} />;
    case "preview":
      return <PreviewStageItem {...value.props} />;
  }
};

/**
 * The row's `props` object is rebuilt per item render, so the default
 * reference equality always fails. Compare the kind and the inner props
 * shallowly instead — stable callbacks and unchanged data bail the row out.
 */
const areStageRowPropsEqual = (
  previous: PipelineStageRowProps,
  next: PipelineStageRowProps,
): boolean => {
  if (previous.kind !== next.kind) return false;
  const previousProps = previous.props;
  const nextProps = next.props;
  for (const key of Object.keys(nextProps)) {
    if (
      previousProps[key as keyof typeof previousProps] !==
      nextProps[key as keyof typeof nextProps]
    ) {
      return false;
    }
  }
  return true;
};

export const PipelineStageRow = memo(
  PipelineStageRowComponent,
  areStageRowPropsEqual,
);
