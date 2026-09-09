/**
 * The hardware-profile catalog is duplicated by necessity: the build pipeline
 * needs it in JavaScript (`scripts/lib/hardware-profiles.mjs`) and the runtime
 * DLL repair needs it in Python (`packages/mini-backend/scripts/ensure-mini-deps.py`). Nothing in
 * either language can import the other, so the only protection against the two
 * drifting apart is this test, which parses the Python map out of the source
 * and compares it entry-for-entry with the JavaScript one.
 *
 * A drift here is not cosmetic: it means an installer built for a profile the
 * runtime cannot repair, or vice versa.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
    DEFAULT_PROFILE,
    HARDWARE_PROFILES,
    PLATFORM_KEYS,
    PROFILE_IDS,
    findProfile,
    normalizeProfile,
    platformKeyFromNodePlatform,
    profilesForPlatform,
    pythonSystemNameFor,
    resolveProfileRequirements,
} from "../../scripts/lib/hardware-profiles.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** `("profile", "System"): "file.txt"` pairs out of the Python source. */
const parsePythonProfileRequirements = (): Map<string, string> => {
    // The canonical copy lives in the shared backend package
    const source = fs.readFileSync(
        path.join(repoRoot, "..", "..", "packages", "mini-backend", "scripts", "ensure-mini-deps.py"),
        "utf8",
    );
    const start = source.indexOf("PROFILE_REQUIREMENTS");
    expect(start, "PROFILE_REQUIREMENTS not found in ensure-mini-deps.py").toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf("\n}", start));

    const entries = new Map<string, string>();
    const pattern = /\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)\s*:\s*"([^"]+)"/g;
    for (const [, profileId, systemName, requirementsFile] of body.matchAll(pattern)) {
        if (!profileId || !systemName || !requirementsFile) continue;
        entries.set(`${profileId}|${systemName}`, requirementsFile);
    }
    return entries;
};

/** The JS catalog flattened into the same `profile|System` keying. */
const flattenJsCatalog = (): Map<string, string> => {
    const entries = new Map<string, string>();
    for (const profile of HARDWARE_PROFILES) {
        for (const platformKey of PLATFORM_KEYS) {
            const relativePath = profile.requirements[platformKey];
            if (!relativePath) continue;
            entries.set(`${profile.id}|${pythonSystemNameFor(platformKey)}`, relativePath);
        }
    }
    return entries;
};

describe("hardware profile catalog", () => {
    it("points every profile at a requirements file that exists", () => {
        for (const platformKey of PLATFORM_KEYS) {
            for (const profile of profilesForPlatform(platformKey)) {
                const { relativePath } = resolveProfileRequirements(profile.id, platformKey);
                const absolute = path.join(repoRoot, "..", "..", "packages", "mini-backend", relativePath);
                expect(fs.existsSync(absolute), `${profile.id}/${platformKey} -> ${relativePath}`).toBe(true);
            }
        }
    });

    it("builds every accelerated profile on top of the base requirements", () => {
        for (const platformKey of PLATFORM_KEYS) {
            for (const profile of profilesForPlatform(platformKey)) {
                if (profile.id === DEFAULT_PROFILE) continue;
                const { relativePath } = resolveProfileRequirements(profile.id, platformKey);
                const contents = fs.readFileSync(path.join(repoRoot, "..", "..", "packages", "mini-backend", relativePath), "utf8");
                // Without this include a profile build would drop fastapi/uvicorn and
                // produce a sidecar that cannot start at all. The legacy profile uses
                // requirements-base-no-ort (avoids the onnxruntime CPU×GPU conflict).
                const baseInclude =
                    relativePath === "requirements-windows-nvidia-legacy.txt"
                        ? /^\s*-r\s+requirements-base-no-ort\.txt\s*$/m
                        : /^\s*-r\s+requirements\.txt\s*$/m;
                expect(contents, `${relativePath} must include the base set`).toMatch(baseInclude);
            }
        }
    });

    it("agrees with PROFILE_REQUIREMENTS in ensure-mini-deps.py", () => {
        const fromPython = parsePythonProfileRequirements();
        const fromJs = flattenJsCatalog();

        // The CPU profile is intentionally absent from the Python map: the runtime
        // repair path treats it as "nothing to install" via
        // NO_EXTRA_DEPENDENCY_PROFILES rather than as a requirements file.
        for (const key of Array.from(fromJs.keys())) {
            if (key.startsWith(`${DEFAULT_PROFILE}|`)) fromJs.delete(key);
        }

        expect(Object.fromEntries([...fromJs].sort())).toEqual(
            Object.fromEntries([...fromPython].sort()),
        );
    });

    it("treats cpu as the default and keeps it buildable everywhere", () => {
        expect(DEFAULT_PROFILE).toBe("cpu");
        for (const platformKey of PLATFORM_KEYS) {
            expect(resolveProfileRequirements(DEFAULT_PROFILE, platformKey).relativePath).toBe(
                "requirements.txt",
            );
        }
    });

    it("rejects unknown profiles and unsupported platform combinations", () => {
        expect(() => resolveProfileRequirements("turbo", "linux")).toThrow(/Unknown hardware profile/);
        expect(() => resolveProfileRequirements("amd-rocm", "win")).toThrow(/not available on "win"/);
        expect(() => resolveProfileRequirements("apple-mps", "linux")).toThrow(/not available/);
        expect(() => resolveProfileRequirements("nvidia-cuda", "mac")).toThrow(/not available/);
    });

    it("normalizes casing and surrounding whitespace", () => {
        expect(normalizeProfile("  NVIDIA-CUDA ")).toBe("nvidia-cuda");
        expect(normalizeProfile("   ")).toBeNull();
        expect(normalizeProfile(undefined)).toBeNull();
        expect(findProfile(" Cpu ")?.id).toBe("cpu");
        expect(findProfile("nope")).toBeNull();
    });

    it("maps Node platforms onto the build platform keys", () => {
        expect(platformKeyFromNodePlatform("win32")).toBe("win");
        expect(platformKeyFromNodePlatform("darwin")).toBe("mac");
        expect(platformKeyFromNodePlatform("linux")).toBe("linux");
    });

    it("exposes unique profile ids", () => {
        expect(new Set(PROFILE_IDS).size).toBe(PROFILE_IDS.length);
    });
});