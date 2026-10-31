import fs from "node:fs";
import path from "node:path";

import { expect, test as base, type Page } from "@playwright/test";

import { E2eBridgeHost } from "../host/bridge-host.ts";
import { seedE2eProfile } from "./seed.ts";

const SIDECAR_NOISE =
  /127\.0\.0\.1:(3001|8000|8001)|localhost:(3001|8000|8001)|Failed to fetch|net::ERR_CONNECTION_REFUSED|net::ERR_FAILED|Failed to load resource|fonts\.googleapis|fonts\.gstatic/i;

export interface E2eProblem {
  kind: "pageerror" | "console-error" | "http-5xx";
  detail: string;
}

export class SummaryRecorder {
  private readonly steps: Record<string, unknown> = {};

  record(step: string, value: unknown): void {
    this.steps[step] = value;
  }

  write(runRoot: string): void {
    const directory = path.join(runRoot, "report");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, "summary.json"),
      JSON.stringify(this.steps, null, 2),
      "utf8",
    );
  }
}

export const capture = async (page: Page, runRoot: string, name: string): Promise<void> => {
  const directory = path.join(runRoot, "report", "screenshots");
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${name}.png`),
    fullPage: false,
  });
};

interface E2eFixtures {
  app: Page;
  problems: E2eProblem[];
  host: E2eBridgeHost;
  summary: SummaryRecorder;
  runRoot: string;
  backendUrl: string;
}

export const test = base.extend<E2eFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires destructuring
  runRoot: async ({}, use) => {
    const runRoot = process.env.E2E_RUN_ROOT;
    if (!runRoot) throw new Error("E2E_RUN_ROOT is required");
    await use(runRoot);
  },
  // eslint-disable-next-line no-empty-pattern -- Playwright requires destructuring
  backendUrl: async ({}, use) => {
    const backendUrl = process.env.E2E_BACKEND_URL;
    if (!backendUrl) throw new Error("E2E_BACKEND_URL is required");
    await use(backendUrl);
  },
  summary: async ({ runRoot }, use) => {
    const summary = new SummaryRecorder();
    await use(summary);
    summary.write(runRoot);
  },
  // eslint-disable-next-line no-empty-pattern -- Playwright requires destructuring
  problems: async ({}, use) => {
    await use([]);
  },
  host: async ({ page, runRoot, backendUrl }, use) => {
    const host = new E2eBridgeHost({ runRoot, backendUrl, page });
    await use(host);
  },
  app: async ({ page, host, problems }, use) => {
    page.on("pageerror", (error) => {
      problems.push({ kind: "pageerror", detail: error.message });
    });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (SIDECAR_NOISE.test(text)) return;
      problems.push({ kind: "console-error", detail: text });
    });
    page.on("response", (response) => {
      if (response.status() >= 500 && !SIDECAR_NOISE.test(response.url())) {
        problems.push({
          kind: "http-5xx",
          detail: `${response.status()} ${response.url()}`,
        });
      }
    });

    await seedE2eProfile(page);

    await page.exposeBinding(
      "__komaE2EHostCall",
      async (
        _source: unknown,
        channel: string,
        args: Record<string, unknown>,
      ): Promise<unknown> => host.handle(channel, args),
    );

    await page.goto("/e2e/index.html#/dashboard", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("#root")).toBeVisible();
    try {
      await expect(
        page.getByRole("tab", { name: "AIO", exact: true }),
      ).toBeVisible({
        timeout: 120_000,
      });
    } catch (error) {
      console.error("[e2e] boot problems:", problems);
      console.error("[e2e] boot html:", (await page.content()).slice(0, 2000));
      throw error;
    }

    await use(page);
  },
});

export { expect };
