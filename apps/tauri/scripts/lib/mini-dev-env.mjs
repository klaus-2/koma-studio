import fs from "node:fs";
import path from "node:path";

import { DEFAULT_PROFILE, normalizeProfile } from "./hardware-profiles.mjs";

export const ACCELERATION_PROFILE_KEY = "MINI_BACKEND_ACCELERATION_PROFILE";

export const AUTH_DISABLED_KEY = "VITE_AUTH_DISABLED";

const ENV_FILE_PRECEDENCE = [
    ".env.development.local",
    ".env.local",
    ".env.development",
    ".env",
];

const findEnvFileEntry = (rootDir, key) => {
    const pattern = new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\r\\n#]+)["']?`, "m");
    for (const fileName of ENV_FILE_PRECEDENCE) {
        const filePath = path.join(rootDir, fileName);
        if (!fs.existsSync(filePath)) continue;
        const match = fs.readFileSync(filePath, "utf8").match(pattern);
        if (match) return { fileName, value: match[1] };
    }
    return null;
};

export const readEnvFileValue = (rootDir, key) =>
    findEnvFileEntry(rootDir, key)?.value ?? "";

export const resolveActiveProfile = ({
    argvProfile = null,
    envProfile = null,
    fileValue = "",
}) => {
    const explicit = normalizeProfile(argvProfile) ?? normalizeProfile(envProfile);
    if (explicit !== null) return explicit;
    return normalizeProfile(fileValue) ?? DEFAULT_PROFILE;
};
