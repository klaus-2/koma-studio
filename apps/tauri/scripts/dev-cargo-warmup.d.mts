export function resolveDevFeatureArgs(cargoTomlText: string): string[];

export function isTransientLinkerFailure(output: string): boolean;

export function warmUp(): Promise<number>;
