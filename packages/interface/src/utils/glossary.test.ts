import { describe, expect, it } from "vitest";

import { clampGlossary, type GlossaryTerm } from "@/utils/glossary";

const term = (source: string, target: string): GlossaryTerm => ({ source, target });

describe("clampGlossary", () => {
  it("trims both sides and drops incomplete or non-string pairs", () => {
    expect(
      clampGlossary([
        term("  先輩  ", "  senpai  "),
        term("", "orphan-target"),
        term("orphan-source", ""),
        term("   ", "y"),
      ]),
    ).toEqual([term("先輩", "senpai")]);
  });

  it("keeps the first pair for a duplicated source", () => {
    expect(
      clampGlossary([
        term("先輩", "senpai"),
        term("先輩", "senior"),
        term("先輩", "elder"),
      ]),
    ).toEqual([term("先輩", "senpai")]);
  });

  it("matches sources case-sensitively", () => {
    expect(clampGlossary([term("GLOSSARY", "a"), term("glossary", "b")])).toEqual([
      term("GLOSSARY", "a"),
      term("glossary", "b"),
    ]);
  });

  it("rejects a non-list glossary", () => {
    expect(clampGlossary(null)).toEqual([]);
    expect(clampGlossary("先輩=senpai")).toEqual([]);
    expect(clampGlossary({ source: "先輩", target: "senpai" })).toEqual([]);
  });

  it("skips entries that are not objects", () => {
    expect(
      clampGlossary([null, "x", 3, term("先輩", "senpai")]),
    ).toEqual([term("先輩", "senpai")]);
  });

  it("caps the list at 200 terms", () => {
    const terms = Array.from({ length: 250 }, (_, index) =>
      term(`source-${index}`, `target-${index}`),
    );
    const clamped = clampGlossary(terms);
    expect(clamped).toHaveLength(200);
    expect(clamped[199]).toEqual(term("source-199", "target-199"));
  });

  it("truncates source at 120 and target at 240 characters", () => {
    const clamped = clampGlossary([term("s".repeat(500), "t".repeat(500))]);
    expect(clamped).toHaveLength(1);
    expect(clamped[0]?.source).toHaveLength(120);
    expect(clamped[0]?.target).toHaveLength(240);
  });
});
