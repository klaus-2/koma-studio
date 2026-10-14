// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VirtualizedLongStrip } from "@/components/dashboard/VirtualizedLongStripClassic";
import { VirtualizedLongStripNoir } from "@/components/dashboard/noir/VirtualizedLongStripNoir";

afterEach(cleanup);

describe("long-strip accessibility", () => {
  it("renders a named, keyboard-focusable scroll region", async () => {
    const user = userEvent.setup();

    render(
      <VirtualizedLongStrip
        itemCount={2}
        enabled={false}
        ariaLabel="Páginas do capítulo"
        renderItem={(index) => <span>Página {index + 1}</span>}
      />,
    );

    const region = screen.getByRole("region", {
      name: "Páginas do capítulo",
    });

    await user.tab();

    expect(document.activeElement).toBe(region);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("preserves child focus during an ordinary rerender", async () => {
    const user = userEvent.setup();

    const props = {
      itemCount: 2,
      enabled: false,
      itemKey: (index: number): string => `page-${index}`,
      renderItem: (index: number) => (
        <button type="button">Página {index + 1}</button>
      ),
    };

    const view = render(<VirtualizedLongStrip {...props} />);
    const button = screen.getByRole("button", { name: "Página 1" });

    await user.click(button);
    view.rerender(<VirtualizedLongStrip {...props} />);

    expect(document.activeElement).toBe(button);
  });

  it("renders an empty semantic list without placeholder items", () => {
    render(
      <VirtualizedLongStrip
        itemCount={0}
        enabled={false}
        renderItem={() => null}
      />,
    );

    expect(screen.getByRole("list")).toBeDefined();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("shares the same semantic structure in the Noir variant", () => {
    render(
      <VirtualizedLongStripNoir
        itemCount={1}
        enabled={false}
        ariaLabel="Chapter pages"
        renderItem={() => <span>Page content</span>}
      />,
    );

    const region = screen.getByRole("region", {
      name: "Chapter pages",
    });

    expect(region.getAttribute("data-variant")).toBe("noir");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
