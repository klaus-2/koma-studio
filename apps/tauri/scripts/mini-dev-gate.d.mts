export interface GateVerdict {
    blocked: boolean;
    exitCode: number;
    notice: string;
}

export function evaluateGate(
    checkExitCode: number,
    env: Record<string, string | undefined>,
): GateVerdict;
