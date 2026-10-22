// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ModelProgressBarNoir } from "@/components/ModelManagerModal/noir/ModelProgressBarNoir";

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      vars && "count" in vars ? `${key}:${vars.count}` : key,
  }),
}));

afterEach(cleanup);

const progress = (overrides: Partial<Parameters<typeof ModelProgressBarNoir>[0]["progress"]> = {}) => ({
  modelId: "paddleocr_latin_v5",
  bytesDownloaded: 6_362_861,
  totalBytes: 12_725_723,
  speedBytesPerSecond: 1_694_483,
  percent: 50,
  attempt: 1,
  ...overrides,
});

describe("ModelProgressBarNoir", () => {
  it("renders the percentage and the byte counters when the total is known", () => {
    render(<ModelProgressBarNoir progress={progress()} />);

    expect(screen.getByText(/50\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/6\.07 MB/)).toBeInTheDocument();
    expect(screen.getByText(/12\.1 MB/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("renders an indeterminate state instead of 0.0% when the total is unknown", () => {
    render(
      <ModelProgressBarNoir
        progress={progress({ totalBytes: null, percent: null, bytesDownloaded: 1_048_576 })}
      />,
    );

    expect(screen.queryByText(/0\.0%/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/modelManager\.progress\.unknownTotal/).length).toBeGreaterThan(0);
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
    expect(screen.getByText(/1\.00 MB/)).toBeInTheDocument();
  });

  it("never renders a percentage above 100", () => {
    render(<ModelProgressBarNoir progress={progress({ percent: 140 })} />);

    expect(screen.getByText(/100\.0%/)).toBeInTheDocument();
  });
});
