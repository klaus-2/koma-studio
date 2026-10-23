import { describe, expect, it } from "vitest";

import { buildKillInvocation, buildTaskList, shouldStartAuthServer } from "../../scripts/dev-desktop.mjs";

describe("dev:desktop auth server decision", () => {
    it("fans out to the auth server when login is demanded", () => {
        expect(shouldStartAuthServer({ fileValue: "false" })).toBe(true);
        expect(buildTaskList({ fileValue: "false" })).toEqual([
            "mini:ensure",
            "auth-server:dev",
            "dev",
        ]);
    });

    it("leaves the auth server down for a clone that declared nothing", () => {
        expect(shouldStartAuthServer({ fileValue: "" })).toBe(false);
        expect(buildTaskList({})).toEqual(["mini:ensure", "dev"]);
    });

    it("keeps the flag's own precedence over the env files", () => {
        expect(shouldStartAuthServer({ processValue: "true", fileValue: "false" })).toBe(false);
        expect(shouldStartAuthServer({ processValue: "", fileValue: "false" })).toBe(true);
    });

    it("treats an unreadable flag as local-only rather than guessing login on", () => {
        expect(shouldStartAuthServer({ fileValue: "maybe" })).toBe(false);
    });
});

describe("dev:desktop shutdown", () => {
    it("kills the whole process tree on Windows", () => {
        expect(buildKillInvocation("win32", 4242)).toEqual({
            command: "taskkill",
            args: ["/pid", "4242", "/t", "/f"],
        });
    });

    it("signals the child directly on the other platforms", () => {
        expect(buildKillInvocation("linux", 4242)).toBeNull();
        expect(buildKillInvocation("darwin", 4242)).toBeNull();
    });
});
