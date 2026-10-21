/**
 * Mini-backend process helpers (free port, health wait, exit wait).
 */
import nodeNet from "node:net";
import { sleep } from "./shared.ts";

const getRandomLocalPort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = nodeNet.createServer();
    server.once("error", (error) => {
      reject(error);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate random local port")));
        return;
      }

      const port = address.port;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });

const waitForMiniBackend = async (
  baseUrl: string,
  {
    attempts = 20,
    delayMs = 500,
  }: { attempts?: number; delayMs?: number } = {},
): Promise<boolean> => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return true;
      }
    } catch {
      // backend still booting
    }

    await sleep(delayMs);
  }

  return false;
};

const waitForMiniBackendProcessExit = async (
  exitPromise: Promise<void> | null,
  timeoutMs: number,
): Promise<boolean> => {
  if (!exitPromise) {
    return true;
  }

  try {
    return await Promise.race([
      exitPromise.then(() => true),
      sleep(timeoutMs).then(() => false),
    ]);
  } catch {
    return false;
  }
};

export {
  getRandomLocalPort,
  waitForMiniBackend,
  waitForMiniBackendProcessExit,
};
