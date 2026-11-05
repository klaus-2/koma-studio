import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { isDirectExecution } from "../../scripts/lib/is-direct-execution.mjs";

describe("isDirectExecution", () => {
    it("matches only the launched script", () => {
        const scriptPath = path.resolve(path.join("some", "dir", "script.mjs"));
        const otherPath = path.resolve(path.join("some", "dir", "other.mjs"));
        const scriptUrl = pathToFileURL(scriptPath).href;

        expect(isDirectExecution(scriptUrl, scriptPath)).toBe(true);
        expect(isDirectExecution(scriptUrl, otherPath)).toBe(false);
    });

    it("counts a missing or malformed argv[1] as not direct", () => {
        const scriptUrl = pathToFileURL(path.resolve("script.mjs")).href;

        expect(isDirectExecution(scriptUrl, undefined)).toBe(false);
        expect(isDirectExecution(scriptUrl, "no-such-arg")).toBe(false);
    });
});
