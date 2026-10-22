import { describe, expect, it } from "vitest";

import type { GateVerdict } from "../../scripts/mini-dev-gate.mjs";

const loadGate = async () => {
    const missingModule = "../../scripts/mini-dev-gate.mjs";
    const gate: typeof import("../../scripts/mini-dev-gate.mjs") = await import(
        /* @vite-ignore */ missingModule
    );
    return gate;
};

const evaluate = async (
    checkExitCode: number,
    env: Record<string, string | undefined>,
): Promise<GateVerdict> => {
    const gate = await loadGate();
    return gate.evaluateGate(checkExitCode, env);
};

describe("mini dev gate", () => {
    it("passes a ready runtime through with no message", async () => {
        const verdict = await evaluate(0, {});
        expect(verdict.blocked).toBe(false);
        expect(verdict.exitCode).toBe(0);
        expect(verdict.notice).toBe("");
    });

    it("passes a needs-provisioning runtime through: a missing venv is not unusable", async () => {
        const verdict = await evaluate(1, {});
        expect(verdict.blocked).toBe(false);
        expect(verdict.exitCode).toBe(0);
        expect(verdict.notice).toBe("");
    });

    it("blocks an unusable runtime and names the repair command", async () => {
        const verdict = await evaluate(4, {});
        expect(verdict.blocked).toBe(true);
        expect(verdict.exitCode).toBe(4);
        expect(verdict.notice).toContain("bun run mini:install-deps");
        expect(verdict.notice).toContain("bun run mini:repair");
    });

    it("honours KOMA_SKIP_MINI_BOOTSTRAP as a deliberate opt-out", async () => {
        const verdict = await evaluate(4, { KOMA_SKIP_MINI_BOOTSTRAP: "1" });
        expect(verdict.blocked).toBe(false);
        expect(verdict.exitCode).toBe(0);
        expect(verdict.notice).toContain("KOMA_SKIP_MINI_BOOTSTRAP");
    });

    it("honours CI as a deliberate opt-out", async () => {
        const verdict = await evaluate(4, { CI: "true" });
        expect(verdict.blocked).toBe(false);
        expect(verdict.exitCode).toBe(0);
        expect(verdict.notice).toContain("CI");
    });
});

describe("mini dev gate rebuild", () => {
    it("rebuilds a provably unusable venv", async () => {
        const gate = await loadGate();
        expect(gate.shouldRebuild(4, {})).toBe(true);
    });

    it("leaves a ready or not-yet-provisioned venv alone", async () => {
        const gate = await loadGate();
        expect(gate.shouldRebuild(0, {})).toBe(false);
        expect(gate.shouldRebuild(1, {})).toBe(false);
    });

    it("never rebuilds when the gate is disabled on purpose", async () => {
        const gate = await loadGate();
        expect(gate.shouldRebuild(4, { KOMA_SKIP_MINI_BOOTSTRAP: "1" })).toBe(false);
        expect(gate.shouldRebuild(4, { CI: "true" })).toBe(false);
    });
});
