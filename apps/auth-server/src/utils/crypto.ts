import { createHash, timingSafeEqual } from "node:crypto";

export const safeTokenEquals = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const sha256Hex = (payload: string | Buffer): string =>
  createHash("sha256").update(payload).digest("hex");
