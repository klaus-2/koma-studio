import { beforeEach, describe, expect, it } from "vitest";

import { useWorksStore } from "@/pages/dashboard/stores/works-store";

describe("useWorksStore.assignChapterToWork", () => {
  beforeEach(() => {
    useWorksStore.setState({ works: [] });
  });

  it("attaching a chapter to one work detaches it from every other work", () => {
    const firstId = useWorksStore.getState().createWork("Work A");
    const secondId = useWorksStore.getState().createWork("Work B");
    expect(firstId).not.toBeNull();
    expect(secondId).not.toBeNull();

    useWorksStore.getState().assignChapterToWork("Chapter 01", firstId);
    useWorksStore.getState().assignChapterToWork("Chapter 01", secondId);

    const works = useWorksStore.getState().works;
    expect(works.find((work) => work.id === secondId)?.chapterLabels).toEqual([
      "Chapter 01",
    ]);
    // Exclusivity: a chapter belongs to at most one work.
    expect(works.find((work) => work.id === firstId)?.chapterLabels).toEqual(
      [],
    );
  });

  it("re-attaching to the owning work keeps it in place and still detaches the others", () => {
    const firstId = useWorksStore.getState().createWork("Work A");
    const secondId = useWorksStore.getState().createWork("Work B");
    if (!firstId || !secondId) throw new Error("fixture works missing");

    useWorksStore.getState().assignChapterToWork("Chapter 01", firstId);
    useWorksStore.getState().assignChapterToWork("Chapter 01", secondId);
    useWorksStore.getState().assignChapterToWork("Chapter 01", secondId);

    const works = useWorksStore.getState().works;
    expect(works.find((work) => work.id === secondId)?.chapterLabels).toEqual([
      "Chapter 01",
    ]);
    expect(works.find((work) => work.id === firstId)?.chapterLabels).toEqual(
      [],
    );
  });

  it("assignChapterToWork(null) detaches the label from every work", () => {
    const firstId = useWorksStore.getState().createWork("Work A");
    const secondId = useWorksStore.getState().createWork("Work B");
    if (!firstId || !secondId) throw new Error("fixture works missing");

    useWorksStore.getState().assignChapterToWork("Chapter 02", firstId);
    useWorksStore.getState().assignChapterToWork("Chapter 02", null);

    const works = useWorksStore.getState().works;
    expect(
      works.every((work) => !work.chapterLabels.includes("Chapter 02")),
    ).toBe(true);
  });
});
