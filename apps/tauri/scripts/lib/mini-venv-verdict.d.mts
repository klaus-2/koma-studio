import type { SpawnSyncOptions } from "node:child_process";

export type TauriVerdictKind =
    | "ready"
    | "needs-provisioning"
    | "unusable"
    | "unclassified";

export interface TauriVerdict {
    verdict: TauriVerdictKind;
    exitCode: number;
    reason: string;
}

export interface ReadinessEvidence {
    ready: boolean;
    reason: string;
    stampedMatch?: boolean;
}

export interface ImportQueryResult {
    ok: boolean;
    errored: boolean;
    status: number | null;
    stderrTail: string;
}

export interface SpawnSyncLikeResult {
    error?: Error;
    status?: number | null;
    stderr?: string | Uint8Array | null;
}

export type SpawnSyncLike = (
    command: string,
    args: readonly string[],
    options?: SpawnSyncOptions,
) => SpawnSyncLikeResult;

export interface ImportQueryInput {
    pythonPath: string;
    modules: readonly string[];
    spawnSync: SpawnSyncLike;
    timeout: number;
}

export interface ClassifyInput {
    readiness: ReadinessEvidence;
    query?: ImportQueryResult | null;
}

export interface RecreateInput {
    venvDir: string;
    allowedVenvDir: string;
    pythonPath: string;
    reason: string;
    rmSync: (target: string, options: { recursive: true; force: true }) => void;
    existsSync: (target: string) => boolean;
    sizeOf: (directory: string) => number;
    createCommand: string;
    createArgs: readonly string[];
    run: (command: string, args: readonly string[]) => void;
    install: () => TauriVerdict;
    log: (line: string) => void;
}

export const EXIT_UNUSABLE: 4;

export function runImportQuery(input: ImportQueryInput): ImportQueryResult;
export function classifyTauriVerdict(input: ClassifyInput): TauriVerdict;
export function runRecreateOnce(input: RecreateInput): TauriVerdict;
