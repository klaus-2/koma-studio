import { describe, expect, it } from "vitest";

import { toBridgeRejectionError } from "./bridge-rejection";

describe("toBridgeRejectionError", () => {
  it("keeps the message of a string rejection from Result<_, String>", () => {
    const rejection = toBridgeRejectionError(
      "error sending request for url (http://127.0.0.1:3001/api/auth/login): connection refused",
    );

    expect(rejection).toBeInstanceOf(Error);
    expect(rejection.message).toBe(
      "error sending request for url (http://127.0.0.1:3001/api/auth/login): connection refused",
    );
  });

  it("keeps the code of a tagged enum rejection such as DesktopError", () => {
    expect(toBridgeRejectionError({ code: "invalid_url" }).message).toBe(
      '{"code":"invalid_url"}',
    );
  });

  it("passes an Error through untouched", () => {
    const original = new Error("already an error");

    expect(toBridgeRejectionError(original)).toBe(original);
  });

  it("says nothing rather than crashing when the bridge gives nothing", () => {
    expect(toBridgeRejectionError(null).message).toBe("");
    expect(toBridgeRejectionError(undefined).message).toBe("");
    expect(toBridgeRejectionError("").message).toBe("");
  });
});
