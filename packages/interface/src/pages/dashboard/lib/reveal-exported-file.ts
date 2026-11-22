import { desktopBridge } from '@/lib/desktop-bridge';

export const revealExportedFile = async (filePath: string): Promise<boolean> => {
  const bridge = desktopBridge.desktop;
  if (!bridge?.system) {
    return false;
  }
  try {
    const result = await bridge.system.revealPath(filePath);
    return result.opened;
  } catch (error) {
    bridge
      .sessionLog({
        level: 'warn',
        source: 'renderer',
        message: `reveal-path failed for "${filePath}": ${error instanceof Error ? error.message : String(error)}`,
      })
      .catch(() => undefined);
    return false;
  }
};

export const hasRevealPathBridge = (): boolean =>
  desktopBridge.desktop?.system !== undefined;
