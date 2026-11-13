import { describe, expect, it } from "vitest";

import {
  clampGlossary,
  GLOSSARY_MAX_TERMS,
  mergeWorkGlossary,
  type GlossaryTerm,
} from "@/utils/glossary";

const term = (
  source: string,
  target: string,
  never_translate = false,
): GlossaryTerm => ({ source, target, never_translate });

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

  it("always emits never_translate, coerced to a strict boolean", () => {
    expect(
      clampGlossary([
        { source: "a", target: "b", never_translate: true },
        { source: "c", target: "d", never_translate: "yes" },
        { source: "e", target: "f" },
        term("g", "h", true),
      ]),
    ).toEqual([
      term("a", "b", true),
      term("c", "d", false),
      term("e", "f", false),
      term("g", "h", true),
    ]);
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

describe("mergeWorkGlossary", () => {
  it("lets work terms win on NFKC-duplicate sources", () => {
    const globalTerms = [term("\uFB01x", "ligature-global"), term("先輩", "global-senpai")];
    const workTerms = [term("fix", "work-fix"), term("先輩", "work-senpai")];
    expect(mergeWorkGlossary(globalTerms, workTerms, GLOSSARY_MAX_TERMS)).toEqual([
      term("fix", "work-fix"),
      term("先輩", "work-senpai"),
    ]);
  });

  it("keeps work terms ahead of surviving global terms", () => {
    const globalTerms = [term("alpha", "global-alpha"), term("beta", "global-beta")];
    const workTerms = [term("gamma", "work-gamma")];
    expect(mergeWorkGlossary(globalTerms, workTerms, GLOSSARY_MAX_TERMS)).toEqual([
      term("gamma", "work-gamma"),
      term("alpha", "global-alpha"),
      term("beta", "global-beta"),
    ]);
  });

  it("respects the 200-term clamp on the merged list", () => {
    const globalTerms = Array.from({ length: 150 }, (_, index) =>
      term(`global-${index}`, `target-${index}`),
    );
    const workTerms = Array.from({ length: 100 }, (_, index) =>
      term(`work-${index}`, `target-${index}`),
    );
    const merged = mergeWorkGlossary(globalTerms, workTerms, GLOSSARY_MAX_TERMS);
    expect(globalTerms.length + workTerms.length).toBeGreaterThan(GLOSSARY_MAX_TERMS);
    expect(merged).toHaveLength(200);
    expect(merged[99]).toEqual(term("work-99", "target-99"));
    expect(merged[100]).toEqual(term("global-0", "target-0"));
    expect(merged[199]).toEqual(term("global-99", "target-99"));
  });

  it("honors a smaller explicit clamp", () => {
    const globalTerms = [term("alpha", "global-alpha"), term("beta", "global-beta")];
    const workTerms = [term("gamma", "work-gamma")];
    expect(mergeWorkGlossary(globalTerms, workTerms, 2)).toEqual([
      term("gamma", "work-gamma"),
      term("alpha", "global-alpha"),
    ]);
  });

  it("passes the global glossary through when the work has no terms", () => {
    const globalTerms = [term("先輩", "senpai"), term("後輩", "kouhai")];
    expect(mergeWorkGlossary(globalTerms, [], GLOSSARY_MAX_TERMS)).toEqual(globalTerms);
  });

  it("drops incomplete pairs and never mutates its inputs", () => {
    const globalTerms = [term("alpha", "global-alpha"), term("", "orphan")];
    const workTerms = [term("gamma", "work-gamma"), term("delta", "")];
    const globalCopy = [...globalTerms];
    const workCopy = [...workTerms];
    expect(mergeWorkGlossary(globalTerms, workTerms, GLOSSARY_MAX_TERMS)).toEqual([
      term("gamma", "work-gamma"),
      term("alpha", "global-alpha"),
    ]);
    expect(globalTerms).toEqual(globalCopy);
    expect(workTerms).toEqual(workCopy);
  });
});
