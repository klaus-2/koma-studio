import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
    EXIT_UNUSABLE,
    classifyTauriVerdict,
    runImportQuery,
    runRecreateOnce,
} from "../../scripts/lib/mini-venv-verdict.mjs";
import type {
    ImportQueryResult,
    ReadinessEvidence,
    TauriVerdict,
} from "../../scripts/lib/mini-venv-verdict.mjs";
import { evaluateGate } from "../../scripts/mini-dev-gate.mjs";

const QUERY_MODULES = ["fastapi", "onnxruntime", "torch"];

const STAMPED: ReadinessEvidence = {
    ready: true,
    reason: 'up to date (profile "cpu")',
    stampedMatch: true,
};

const BROKEN_QUERY: ImportQueryResult = {
    ok: false,
    errored: false,
    status: 1,
    stderrTail: "ModuleNotFoundError: No module named 'onnxruntime'",
};

const READY: TauriVerdict = { verdict: "ready", exitCode: 0, reason: "ready" };

interface TempVenv {
    venvDir: string;
    pythonPath: string;
    sentinel: string;
}

const createTempVenv = (): TempVenv => {
    const venvDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-tauri-verdict-"));
    const pythonPath = path.join(
        venvDir,
        process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    );
    fs.mkdirSync(path.dirname(pythonPath), { recursive: true });
    fs.writeFileSync(pythonPath, "fake interpreter image\n", "utf-8");
    const sentinel = path.join(venvDir, "sentinel.txt");
    fs.writeFileSync(sentinel, "prove the delete never happened\n", "utf-8");
    return { venvDir, pythonPath, sentinel };
};

const buildHarness = ({
    venvDir,
    allowedVenvDir,
    pythonPath,
    installVerdicts,
    createSucceeds = true,
}: {
    venvDir: string;
    allowedVenvDir: string;
    pythonPath: string;
    installVerdicts: TauriVerdict[];
    createSucceeds?: boolean;
}) => {
    const invocations: Array<[string, readonly string[]]> = [];
    const deletions: string[] = [];
    const logs: string[] = [];
    return {
        invocations,
        deletions,
        logs,
        call: () =>
            runRecreateOnce({
                venvDir,
                allowedVenvDir,
                pythonPath,
                reason: BROKEN_QUERY.stderrTail,
                rmSync: (target, options) => {
                    deletions.push(target);
                    fs.rmSync(target, options);
                },
                existsSync: fs.existsSync,
                sizeOf: () => 4096,
                createCommand: "py",
                createArgs: ["-3.12", "-m", "venv", venvDir],
                run: (command, args) => {
                    invocations.push([command, args]);
                    if (createSucceeds) {
                        fs.mkdirSync(path.dirname(pythonPath), { recursive: true });
                        fs.writeFileSync(pythonPath, "recreated interpreter image\n", "utf-8");
                    }
                },
                install: () => {
                    const next = installVerdicts.shift();
                    if (next === undefined) {
                        throw new Error("runRecreateOnce re-invoked the install more than once");
                    }
                    return next;
                },
                log: (line) => logs.push(line),
            }),
    };
};

describe("mini venv verdict", () => {
    it("keeps 4 as the shared provably-unusable code across the three shells", () => {
        expect(EXIT_UNUSABLE).toBe(4);
        expect(classifyTauriVerdict({ readiness: STAMPED, query: BROKEN_QUERY })).toEqual({
            verdict: "unusable",
            exitCode: 4,
            reason: `the venv's own interpreter failed the import query (exit 1): ${BROKEN_QUERY.stderrTail}`,
        });
    });

    it("passes a stamped venv whose heavyweight imports resolve", () => {
        const verdict = classifyTauriVerdict({
            readiness: STAMPED,
            query: { ok: true, errored: false, status: 0, stderrTail: "<no output captured>" },
        });
        expect(verdict.verdict).toBe("ready");
        expect(verdict.exitCode).toBe(0);
        expect(verdict.reason).toContain("imports resolve");
    });

    it("never condemns a venv that was never installed", () => {
        const neverProvisioned: ReadinessEvidence[] = [
            { ready: false, reason: "no .venv-mini virtualenv found" },
            { ready: false, reason: 'no install stamp, so profile "nvidia-cuda-legacy" cannot be confirmed' },
            { ready: false, reason: "venv was provisioned for profile \"cpu\", not \"nvidia-cuda-legacy\"" },
            { ready: false, reason: "mini-backend/requirements.txt changed since the last install" },
            { ready: false, reason: "dependencies were never installed for this venv" },
        ];

        for (const readiness of neverProvisioned) {
            const verdict = classifyTauriVerdict({ readiness, query: BROKEN_QUERY });
            expect(verdict.exitCode).toBe(1);
            expect(verdict.verdict).toBe("needs-provisioning");
            expect(verdict.exitCode).not.toBe(EXIT_UNUSABLE);
        }
    });

    it("treats a ready venv without a matching stamp as adoption, never as unusable", () => {
        const adopted: ReadinessEvidence = {
            ready: true,
            reason: "existing venv satisfies requirements (no install stamp yet)",
        };
        expect(classifyTauriVerdict({ readiness: adopted, query: BROKEN_QUERY }).exitCode).toBe(0);
        expect(classifyTauriVerdict({ readiness: STAMPED })).toEqual({
            verdict: "ready",
            exitCode: 0,
            reason: STAMPED.reason,
        });
    });

    it("treats a query child that never started as unclassified, exit 1, never a recreate", () => {
        const missing = path.join(
            fs.mkdtempSync(path.join(os.tmpdir(), "koma-tauri-no-venv-")),
            "Scripts",
            "python.exe",
        );
        const query = runImportQuery({
            pythonPath: missing,
            modules: QUERY_MODULES,
            spawnSync,
            timeout: 10_000,
        });
        expect(query.errored).toBe(true);
        expect(query.ok).toBe(false);
        expect(query.status).toBeNull();

        const verdict = classifyTauriVerdict({ readiness: STAMPED, query });
        expect(verdict.verdict).toBe("unclassified");
        expect(verdict.exitCode).toBe(1);
        expect(verdict.reason).toContain("could not be launched");
        expect(evaluateGate(verdict.exitCode, {})).toEqual({
            blocked: false,
            exitCode: 0,
            notice: "",
        });
    });

    it("never calls a killed query a proof: a timeout is a transient, not unusability", () => {
        const killed: ImportQueryResult = {
            ok: false,
            errored: false,
            status: null,
            stderrTail: "<no output captured>",
        };
        const verdict = classifyTauriVerdict({ readiness: STAMPED, query: killed });
        expect(verdict.verdict).toBe("unclassified");
        expect(verdict.exitCode).toBe(1);
        expect(verdict.exitCode).not.toBe(EXIT_UNUSABLE);
        expect(evaluateGate(verdict.exitCode, {}).blocked).toBe(false);
    });

    it("runs a real child through the query and keeps the tail bounded and single-line", () => {
        const query = runImportQuery({
            pythonPath: process.execPath,
            modules: ["koma_absent_module"],
            spawnSync,
            timeout: 10_000,
        });
        expect(query.errored).toBe(false);
        expect(query.stderrTail.includes("\n")).toBe(false);
        expect(query.stderrTail.length).toBeLessThanOrEqual(4096);
    });

    it("maps the unusable verdict to a blocked gate and every other verdict to a pass", () => {
        expect(evaluateGate(classifyTauriVerdict({ readiness: STAMPED, query: BROKEN_QUERY }).exitCode, {}).blocked).toBe(true);
        for (const exitCode of [0, 1]) {
            expect(evaluateGate(exitCode, {}).blocked).toBe(false);
        }
    });
});

describe("mini venv recreate rung", () => {
    it("deletes the allowed venv once, recreates it and re-installs exactly once", () => {
        const { venvDir, pythonPath, sentinel } = createTempVenv();
        const harness = buildHarness({
            venvDir,
            allowedVenvDir: venvDir,
            pythonPath,
            installVerdicts: [READY],
        });

        expect(harness.call()).toEqual(READY);
        expect(harness.deletions).toEqual([venvDir]);
        expect(fs.existsSync(sentinel)).toBe(false);
        expect(fs.existsSync(venvDir)).toBe(true);
        expect(harness.invocations).toEqual([["py", ["-3.12", "-m", "venv", venvDir]]]);
        expect(harness.logs.some((line) => line.includes(BROKEN_QUERY.stderrTail))).toBe(true);
        expect(harness.logs.some((line) => line.includes(`Recreating ${venvDir} (4096 bytes)`))).toBe(
            true,
        );
    });

    it("stops after the one retry with the child's tail when the recreate did not fix it", () => {
        const { venvDir, pythonPath } = createTempVenv();
        const stillBroken: TauriVerdict = {
            verdict: "unusable",
            exitCode: EXIT_UNUSABLE,
            reason: BROKEN_QUERY.stderrTail,
        };
        const harness = buildHarness({
            venvDir,
            allowedVenvDir: venvDir,
            pythonPath,
            installVerdicts: [stillBroken],
        });

        expect(harness.call()).toEqual({
            verdict: "unusable",
            exitCode: 1,
            reason: BROKEN_QUERY.stderrTail,
        });
        expect(harness.deletions).toEqual([venvDir]);
        expect(harness.logs.some((line) => line.includes("recreate did not fix it"))).toBe(true);
    });

    it("throws with zero deletions when the target is not the allowed venv", () => {
        const { venvDir, pythonPath, sentinel } = createTempVenv();
        const elsewhere = path.join(path.dirname(venvDir), "not-the-venv");
        const harness = buildHarness({
            venvDir,
            allowedVenvDir: elsewhere,
            pythonPath,
            installVerdicts: [READY],
        });

        expect(() => harness.call()).toThrow(/Refusing to delete/);
        expect(harness.deletions).toEqual([]);
        expect(harness.invocations).toEqual([]);
        expect(fs.existsSync(sentinel)).toBe(true);

        const relative = buildHarness({
            venvDir,
            allowedVenvDir: ".venv-mini",
            pythonPath,
            installVerdicts: [READY],
        });
        expect(() => relative.call()).toThrow(/Refusing to delete/);
        expect(relative.deletions).toEqual([]);
    });

    it("exits 1 with the actionable line when the recreate produced no interpreter", () => {
        const { venvDir, pythonPath, sentinel } = createTempVenv();
        const installVerdicts: TauriVerdict[] = [READY];
        const harness = buildHarness({
            venvDir,
            allowedVenvDir: venvDir,
            pythonPath,
            installVerdicts,
            createSucceeds: false,
        });

        const verdict = harness.call();
        expect(verdict.exitCode).toBe(1);
        expect(verdict.reason).toContain(pythonPath);
        expect(harness.deletions).toEqual([venvDir]);
        expect(installVerdicts).toEqual([READY]);
        expect(harness.logs.some((line) => line.includes("has no interpreter at"))).toBe(true);
        expect(harness.logs.some((line) => line.includes("MINI_BACKEND_PYTHON"))).toBe(true);
        expect(fs.existsSync(sentinel)).toBe(false);
    });

    it("keeps mini-venv.mjs wiring-only: one rung call, one deletion target, no rm of anything else", () => {
        const source = fs.readFileSync(path.resolve("scripts", "mini-venv.mjs"), "utf-8");
        expect(source.match(/runRecreateOnce\(/g)).toHaveLength(1);
        expect(source.includes("allowedVenvDir: path.resolve(venvDir)")).toBe(true);
        expect(source.includes("if (outcome.exitCode === EXIT_UNUSABLE) {")).toBe(true);
        expect(source.match(/rmSync/g)).toHaveLength(3);
        expect(source.includes("fs.rmSync(provisioningLockPath, { force: true })")).toBe(true);
        expect(source.includes("rmSync: fs.rmSync")).toBe(true);
        expect(source.includes("readiness.ready && readiness.stampedMatch ? queryVenv(venvPython)")).toBe(
            true,
        );
    });
});
