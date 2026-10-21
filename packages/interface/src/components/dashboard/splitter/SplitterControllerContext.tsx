/**
 * Splitter controller context — host the controller outside DashboardPage so
 * cut-drag / recipe ticks only re-render context consumers.
 */
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { SplitterController } from "./useSplitterController";

const SplitterControllerContext = createContext<SplitterController | null>(null);

export function SplitterControllerProvider({
  controller,
  children,
}: {
  controller: SplitterController;
  children: ReactNode;
}): ReactNode {
  return (
    <SplitterControllerContext.Provider value={controller}>
      {children}
    </SplitterControllerContext.Provider>
  );
}

export function useSplitterControllerContext(): SplitterController {
  const controller = useContext(SplitterControllerContext);
  if (!controller) {
    throw new Error(
      "useSplitterControllerContext must be used inside SplitterControllerProvider",
    );
  }
  return controller;
}
