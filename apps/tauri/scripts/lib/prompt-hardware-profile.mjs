/**
 * Interactive hardware-profile picker for the hardened release pipeline.
 *
 * The pipeline produces exactly one `mini-backend` sidecar, and that sidecar
 * carries whichever acceleration profile is chosen here — so the choice has to
 * be made before the first pip install, not after the binary exists.
 *
 * Selection order, highest priority first:
 *   1. `--profile <id>` on the command line
 *   2. `$KOMA_BUILD_PROFILE`
 *   3. an interactive prompt, when stdin is a TTY
 *   4. `DEFAULT_PROFILE` (cpu), when stdin is not a TTY
 *
 * Step 4 is what keeps CI working: a build machine has no terminal to answer
 * a question, so a non-interactive run must never block on one. It also means
 * an unattended build is reproducible — it always gets `cpu` unless it was
 * explicitly told otherwise.
 */
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
    DEFAULT_PROFILE,
    PROFILE_IDS,
    findProfile,
    normalizeProfile,
    profilesForPlatform,
} from "./hardware-profiles.mjs";
/** Environment variable that pre-answers the prompt for scripted builds. */
export const PROFILE_ENV_VAR = "KOMA_BUILD_PROFILE";
/**
 * Validate a profile that was supplied non-interactively.
 *
 * `available` is the platform-filtered catalog, so this also rejects
 * combinations that exist but cannot be built here (`amd-rocm` on Windows).
 */
const assertBuildable = (profileId, platformKey, available) => {
    const profile = findProfile(profileId);
    if (!profile) {
        throw new Error(
            `Unknown hardware profile "${profileId}". Known profiles: ${PROFILE_IDS.join(", ")}.`,
        );
    }
    if (!available.some((candidate) => candidate.id === profile.id)) {
        throw new Error(
            `Hardware profile "${profile.id}" cannot be built for platform "${platformKey}". ` +
            `Available here: ${available.map((candidate) => candidate.id).join(", ")}.`,
        );
    }
    return profile.id;
};
const renderMenu = (available, log) => {
    log("");
    log("Select the hardware acceleration profile to bake into this build.");
    log("The chosen profile's dependencies replace the CPU set entirely; the");
    log("pipeline produces one mini-backend sidecar, not one per profile.");
    log("");
    available.forEach((profile, index) => {
        const marker = profile.id === DEFAULT_PROFILE ? " (default)" : "";
        log(`  ${index + 1}) ${profile.label}${marker}`);
        log(`     ${profile.id} — ${profile.summary}`);
    });
    log("");
};
/**
 * Map an answer to a profile id. Accepts the menu number or the profile id
 * itself, so `2` and `nvidia-cuda` are equivalent. Returns `null` when the
 * answer matches nothing, which re-prompts rather than guessing.
 */
const interpretAnswer = (answer, available) => {
    const normalized = normalizeProfile(answer);
    if (normalized === null) return DEFAULT_PROFILE;
    if (/^\d+$/.test(normalized)) {
        const chosen = available[Number(normalized) - 1];
        return chosen ? chosen.id : null;
    }
    const byId = available.find((profile) => profile.id === normalized);
    return byId ? byId.id : null;
};
/**
 * Resolve the profile for this build.
 *
 * @param {object} options
 * @param {string} options.platformKey     Target platform: "win" | "mac" | "linux".
 * @param {string|null} [options.cliProfile]  Value of `--profile`, if passed.
 * @param {NodeJS.ProcessEnv} [options.env]   Environment to read the override from.
 * @param {boolean} [options.interactive]     Override TTY detection (tests).
 * @param {(message: string) => void} [options.log]
 * @returns {Promise<{ profile: string, source: "cli" | "env" | "prompt" | "default" }>}
 */
export const resolveHardwareProfile = async ({
    platformKey,
    cliProfile = null,
    env = process.env,
    interactive = Boolean(stdin.isTTY && stdout.isTTY),
    log = (message) => console.log(message),
} = {}) => {
    const available = profilesForPlatform(platformKey);
    if (available.length === 0) {
        throw new Error(`No hardware profile is defined for platform "${platformKey}".`);
    }
    const fromCli = normalizeProfile(cliProfile);
    if (fromCli !== null) {
        return { profile: assertBuildable(fromCli, platformKey, available), source: "cli" };
    }
    const fromEnv = normalizeProfile(env[PROFILE_ENV_VAR]);
    if (fromEnv !== null) {
        return { profile: assertBuildable(fromEnv, platformKey, available), source: "env" };
    }
    if (!interactive) {
        return { profile: DEFAULT_PROFILE, source: "default" };
    }
    renderMenu(available, log);
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
        // Bounded retries: an operator who cannot answer in five tries is almost
        // certainly piping input by accident, and an unbounded loop in a build
        // script would spin forever instead of failing visibly.
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const answer = await rl.question(
                `Profile [1-${available.length} or id, blank = ${DEFAULT_PROFILE}]: `,
            );
            const chosen = interpretAnswer(answer, available);
            if (chosen) return { profile: chosen, source: "prompt" };
            log(`  "${answer.trim()}" is not one of the options above. Try again.`);
        }
        throw new Error("No valid hardware profile was selected after 5 attempts.");
    } finally {
        rl.close();
    }
};