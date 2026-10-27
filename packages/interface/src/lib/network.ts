interface NetworkInformationLike {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
  readonly downlink?: number;
}

declare global {
  interface Navigator {
    readonly connection?: NetworkInformationLike;
  }
}

/**
 * True when background work (idle prefetch, remote catalog prime) should not
 * compete with the critical path: data-saver on, a 2G/3G radio, or a measured
 * downlink under 2 Mbps.
 */
export const isConstrainedConnection = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }

  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-data: reduce)").matches
  ) {
    return true;
  }

  const connection = navigator.connection;
  if (!connection) {
    return false;
  }

  if (connection.saveData === true) {
    return true;
  }

  if (
    connection.effectiveType === "slow-2g" ||
    connection.effectiveType === "2g" ||
    connection.effectiveType === "3g"
  ) {
    return true;
  }

  return (
    typeof connection.downlink === "number" &&
    connection.downlink > 0 &&
    connection.downlink < 2
  );
};
