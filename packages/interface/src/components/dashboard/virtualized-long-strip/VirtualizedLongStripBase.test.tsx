// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VirtualizedLongStrip } from "@/components/dashboard/VirtualizedLongStripClassic";
import { VirtualizedLongStripNoir } from "@/components/dashboard/noir/VirtualizedLongStripNoir";

const { scrollToIndexCalls } = vi.hoisted(() => ({
  scrollToIndexCalls: [] as Array<{ index: number; align: string | undefined }>,
}));

vi.mock("@tanstack/react-virtual", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-virtual")>();
  type Instance = ReturnType<typeof actual.useVirtualizer>;
  return {
    ...actual,
    useVirtualizer: (options: Parameters<typeof actual.useVirtualizer>[0]) => {
      const instance = actual.useVirtualizer(options);
      const original = instance.scrollToIndex.bind(instance);
      instance.scrollToIndex = (
        ...args: Parameters<Instance["scrollToIndex"]>
      ): ReturnType<Instance["scrollToIndex"]> => {
        scrollToIndexCalls.push({
          index: args[0],
          align: args[1]?.align as string | undefined,
        });
        return original(...args);
      };
      return instance;
    },
  };
});

afterEach(cleanup);

// jsdom has no layout engine: every element reports offsetHeight 0, and
// @tanstack/virtual-core skips ranges entirely for a zero-size container.
// Give the scroll container (DIV) a measured height and the strip items
// (LI) their estimate so the virtualizer produces a real range.
const stubElementMetrics = (): { restore: () => void } => {
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight",
  );
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement): number {
      return this.tagName === "DIV" ? 6000 : 600;
    },
  });
  return {
    restore: () => {
      if (original) {
        Object.defineProperty(HTMLElement.prototype, "offsetHeight", original);
      }
    },
  };
};

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

  it.each([
    ["classic", VirtualizedLongStrip],
    ["noir", VirtualizedLongStripNoir],
  ] as const)(
    "fills the stage track and centers each page in the %s variant",
    (_variant, Strip) => {
      const metrics = stubElementMetrics();
      try {
        render(
          <Strip
            itemCount={6}
            ariaLabel="Stage pages"
            renderItem={(index) => <span>Page {index + 1}</span>}
          />,
        );

        const region = screen.getByRole("region", { name: "Stage pages" });

        expect(region.style.width).toBe("100%");
        expect(region.style.alignSelf).toBe("stretch");
        expect(region.style.gridColumn).toBe("1 / -1");

        const items = screen.getAllByRole("listitem");
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
          expect(item.style.display).toBe("flex");
          expect(item.style.flexDirection).toBe("column");
          expect(item.style.alignItems).toBe("center");
        }
      } finally {
        metrics.restore();
      }
    },
  );

  it("keeps its own scrollbar only when no stage scroll element is given", () => {
    const stage = document.createElement("section");
    document.body.appendChild(stage);
    const scrollElementRef = { current: stage };
    try {
      const view = render(
        <VirtualizedLongStrip
          itemCount={6}
          ariaLabel="Own scroll"
          renderItem={(index) => <span>Page {index + 1}</span>}
        />,
      );
      const own = screen.getByRole("region", { name: "Own scroll" });
      expect(own.style.overflowY).toBe("auto");
      view.unmount();

      render(
        <VirtualizedLongStrip
          itemCount={6}
          ariaLabel="Stage scroll"
          scrollElementRef={scrollElementRef}
          renderItem={(index) => <span>Page {index + 1}</span>}
        />,
      );
      const shared = screen.getByRole("region", { name: "Stage scroll" });
      expect(shared.style.overflowY).toBe("");
      expect(shared.style.height).toBe("");
    } finally {
      stage.remove();
    }
  });

  it("reports the rendered first/last indexes to onVisibleRangeChange", async () => {
    const metrics = stubElementMetrics();
    const onVisibleRangeChange = vi.fn();

    try {
      render(
        <VirtualizedLongStrip
          itemCount={30}
          enabled={true}
          onVisibleRangeChange={onVisibleRangeChange}
          renderItem={(index) => <span>Page {index + 1}</span>}
        />,
      );

      await act(async () => {});

      expect(onVisibleRangeChange).toHaveBeenCalled();
      expect(onVisibleRangeChange).toHaveBeenLastCalledWith({
        start: 0,
        end: expect.any(Number),
      });
      const lastCall = onVisibleRangeChange.mock.lastCall?.[0];
      expect(lastCall?.start).toBe(0);
      expect(lastCall?.end).toBeGreaterThan(0);
      expect(lastCall?.end).toBeLessThan(30);
    } finally {
      metrics.restore();
    }
  });

  it("reports the shifted range after a scroll simulation", async () => {
    const metrics = stubElementMetrics();
    const onVisibleRangeChange = vi.fn();

    try {
      render(
        <VirtualizedLongStrip
          itemCount={30}
          estimatedItemHeight={600}
          enabled={true}
          onVisibleRangeChange={onVisibleRangeChange}
          renderItem={(index) => <span>Page {index + 1}</span>}
        />,
      );

      await act(async () => {});

      const region = screen.getByRole("region", { name: "Pages" });
      region.scrollTop = 18000;
      act(() => {
        region.dispatchEvent(new Event("scroll"));
      });
      await act(async () => {});

      const lastCall = onVisibleRangeChange.mock.lastCall?.[0];
      expect(lastCall?.start).toBeGreaterThan(0);
      expect(lastCall?.end).toBe(29);
    } finally {
      metrics.restore();
    }
  });

  it("renders identically without the callback prop", async () => {
    const metrics = stubElementMetrics();

    try {
      render(
        <VirtualizedLongStrip
          itemCount={30}
          enabled={true}
          renderItem={(index) => <span>Page {index + 1}</span>}
        />,
      );

      await act(async () => {});

      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    } finally {
      metrics.restore();
    }
  });

  it("does not report a range when virtualization is disabled", async () => {
    const onVisibleRangeChange = vi.fn();

    render(
      <VirtualizedLongStrip
        itemCount={5}
        enabled={false}
        onVisibleRangeChange={onVisibleRangeChange}
        renderItem={(index) => <span>Page {index + 1}</span>}
      />,
    );

    await act(async () => {});

    expect(onVisibleRangeChange).not.toHaveBeenCalled();
  });

  it("scrolls to the focusIndexSignal index (center-aligned)", async () => {
    const metrics = stubElementMetrics();
    const props = {
      itemCount: 30,
      enabled: true,
      renderItem: (index: number) => <span>Page {index + 1}</span>,
    };
    scrollToIndexCalls.length = 0;

    try {
      const view = render(<VirtualizedLongStrip {...props} />);
      await act(async () => {});
      expect(scrollToIndexCalls.length).toBe(0);

      await act(async () => {
        view.rerender(
          <VirtualizedLongStrip
            {...props}
            focusIndexSignal={{ index: 12, nonce: 1 }}
          />,
        );
        await new Promise((resolve) => {
          requestAnimationFrame(() => resolve(undefined));
        });
      });

      expect(scrollToIndexCalls.length).toBeGreaterThanOrEqual(1);
      expect(scrollToIndexCalls[0]).toEqual({ index: 12, align: "center" });
      expect(scrollToIndexCalls.at(-1)).toEqual({ index: 12, align: "center" });
    } finally {
      metrics.restore();
    }
  });

  it("re-scrolls when the nonce changes for the same index", async () => {
    const metrics = stubElementMetrics();
    const props = {
      itemCount: 30,
      enabled: true,
      renderItem: (index: number) => <span>Page {index + 1}</span>,
    };
    scrollToIndexCalls.length = 0;

    try {
      const view = render(
        <VirtualizedLongStrip
          {...props}
          focusIndexSignal={{ index: 10, nonce: 1 }}
        />,
      );
      await act(async () => {});

      expect(scrollToIndexCalls.length).toBeGreaterThanOrEqual(1);
      const afterFirstNonce = scrollToIndexCalls.length;

      await act(async () => {
        view.rerender(
          <VirtualizedLongStrip
            {...props}
            focusIndexSignal={{ index: 10, nonce: 2 }}
          />,
        );
        await new Promise((resolve) => {
          requestAnimationFrame(() => resolve(undefined));
        });
      });

      expect(scrollToIndexCalls.length).toBeGreaterThan(afterFirstNonce);
      expect(scrollToIndexCalls.every((call) => call.index === 10)).toBe(true);
    } finally {
      metrics.restore();
    }
  });

  it("ignores an out-of-range focusIndexSignal", async () => {
    const metrics = stubElementMetrics();
    const props = {
      itemCount: 30,
      enabled: true,
      renderItem: (index: number) => <span>Page {index + 1}</span>,
    };

    try {
      const view = render(<VirtualizedLongStrip {...props} />);
      await act(async () => {});

      const region = screen.getByRole("region", { name: "Pages" });
      await act(async () => {
        view.rerender(
          <VirtualizedLongStrip
            {...props}
            focusIndexSignal={{ index: 30, nonce: 1 }}
          />,
        );
      });

      expect(region.scrollTop).toBe(0);
    } finally {
      metrics.restore();
    }
  });
});
