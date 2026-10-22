export interface GateVerdict {
    blocked: boolean;
    exitCode: number;
    notice: string;
}

export interface GateDisabled {
    disabled: boolean;
    reason: string;
}

export function gateDisabledByEnv(
    env: Record<string, string | undefined>,
): GateDisabled;

export function shouldRebuild(
    checkExitCode: number,
    env: Record<string, string | undefined>,
): boolean;

export function evaluateGate(
    checkExitCode: number,
    env: Record<string, string | undefined>,
): GateVerdict;
