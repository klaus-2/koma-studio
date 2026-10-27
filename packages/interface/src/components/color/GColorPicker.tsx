import { lazy, Suspense, type ComponentProps } from "react";

const ReactGPicker = lazy(() => import("react-gcolor-picker"));

export const GColorPicker = (props: ComponentProps<typeof ReactGPicker>) => (
  <Suspense
    fallback={
      <span
        aria-hidden
        style={{ display: "block", inlineSize: 240, blockSize: 180 }}
      />
    }
  >
    <ReactGPicker {...props} />
  </Suspense>
);
