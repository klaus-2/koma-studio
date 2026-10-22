import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_PROFILE } from "../../scripts/lib/hardware-profiles.mjs";
import {
    ACCELERATION_PROFILE_KEY,
    readEnvFileValue,
    resolveActiveProfile,
} from "../../scripts/lib/mini-dev-env.mjs";

const LEGACY = "nvidia-cuda-legacy";

const buildFakeApp = (envFileBodies: Record<string, string>): string => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-tauri-dev-env-"));
    for (const [name, body] of Object.entries(envFileBodies)) {
        fs.writeFileSync(path.join(rootDir, name), body, "utf-8");
    }
    return rootDir;
};

describe("mini dev env detection", () => {
    it("reads a quoted declaration from .env.development", () => {
        const rootDir = buildFakeApp({
            ".env.development": `${ACCELERATION_PROFILE_KEY}='${LEGACY}'\n`,
        });

        expect(readEnvFileValue(rootDir, ACCELERATION_PROFILE_KEY)).toBe(LEGACY);
        expect(
            resolveActiveProfile({
                fileValue: readEnvFileValue(rootDir, ACCELERATION_PROFILE_KEY),
            }),
        ).toBe(LEGACY);
    });

    it("takes the highest-precedence file and treats no declaration as nothing", () => {
        const rootDir = buildFakeApp({
            ".env.development.local": `${ACCELERATION_PROFILE_KEY}=cpu\n`,
            ".env.development": `${ACCELERATION_PROFILE_KEY}='${LEGACY}'\n`,
        });
        const emptyDir = buildFakeApp({ ".env.development": "VITE_OTHER=1\n" });

        expect(readEnvFileValue(rootDir, ACCELERATION_PROFILE_KEY)).toBe("cpu");
        expect(readEnvFileValue(emptyDir, ACCELERATION_PROFILE_KEY)).toBe("");
    });

    it("--profile overrides the declared profile", () => {
        expect(
            resolveActiveProfile({ argvProfile: "cpu", fileValue: LEGACY }),
        ).toBe("cpu");
        expect(
            resolveActiveProfile({
                argvProfile: LEGACY,
                envProfile: "cpu",
                fileValue: "amd-rocm",
            }),
        ).toBe(LEGACY);
    });

    it("$KOMA_BUILD_PROFILE overrides the declared profile", () => {
        expect(
            resolveActiveProfile({ envProfile: "intel-openvino", fileValue: LEGACY }),
        ).toBe("intel-openvino");
    });

    it("keeps cpu as the default when nothing declares a profile", () => {
        expect(resolveActiveProfile({})).toBe(DEFAULT_PROFILE);
        expect(resolveActiveProfile({ fileValue: "" })).toBe(DEFAULT_PROFILE);
        expect(
            resolveActiveProfile({ argvProfile: null, envProfile: null, fileValue: "" }),
        ).toBe(DEFAULT_PROFILE);
    });

    it("passes an unrecognized value through so the requirement lookup reports it", () => {
        expect(resolveActiveProfile({ fileValue: "nvidia-cuda-legacyx" })).toBe(
            "nvidia-cuda-legacyx",
        );
    });
});
