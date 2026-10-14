import type { ReactElement } from "react";

import { VirtualizedLongStripBase } from "@/components/dashboard/virtualized-long-strip/VirtualizedLongStripBase";
import type { VirtualizedLongStripProps } from "@/components/dashboard/virtualized-long-strip/VirtualizedLongStripBase";

export type { VirtualizedLongStripProps } from "@/components/dashboard/virtualized-long-strip/VirtualizedLongStripBase";

export function VirtualizedLongStrip(
  props: VirtualizedLongStripProps,
): ReactElement {
  return <VirtualizedLongStripBase {...props} variant="classic" />;
}
