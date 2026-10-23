export interface DeclaredAuthFlag {
    processValue?: string;
    fileValue?: string;
}

export interface KillInvocation {
    command: string;
    args: string[];
}

export function shouldStartAuthServer(declared: DeclaredAuthFlag): boolean;

export function buildTaskList(declared: DeclaredAuthFlag): string[];

export function buildKillInvocation(platform: string, pid: number): KillInvocation | null;
