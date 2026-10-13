export declare const APP_VERSION_DEFINE_KEY: "__KOMA_APP_VERSION__";

export declare function readShellVersion(
  shellUrl: string,
  manifestName?: string,
): string;

export declare function appVersionDefine(
  shellUrl: string,
  manifestName?: string,
): Record<typeof APP_VERSION_DEFINE_KEY, string>;
