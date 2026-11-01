import fs from "node:fs";
import path from "node:path";

/**
 * A PID lock that keeps two builds from writing the same output.
 *
 * The holder PID decides staleness: a dead process leaves the lock free to
 * take over. On Windows `process.kill(pid, 0)` reports EPERM for a process
 * owned by another user, and that means "alive", not "dead".
 */
const pidAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
};

/**
 * Take the lock at `lockPath`, or fail while the holder is still alive.
 *
 * The lock file is removed when this process exits; a leftover file from a
 * killed process is stale and the next run takes it over.
 */
export const acquireBuildLock = (lockPath, { label }) => {
  if (fs.existsSync(lockPath)) {
    let holder = null;
    try {
      holder = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
    } catch {
      // A corrupt lock is stale by definition.
    }
    if (
      holder
      && typeof holder.pid === "number"
      && holder.pid !== process.pid
      && pidAlive(holder.pid)
    ) {
      throw new Error(
        `another ${label} is running (PID ${holder.pid}, started ${holder.startedAt}) `
          + "— run one at a time; wait for it or kill it",
      );
    }
    console.warn(`[build-lock] stale lock from PID ${holder?.pid ?? "unknown"} — taking over`);
  }
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(
    lockPath,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
  );
  process.on("exit", () => {
    try {
      fs.rmSync(lockPath, { force: true });
    } catch {
      // best-effort: a dead PID makes any leftover lock stale anyway
    }
  });
};
