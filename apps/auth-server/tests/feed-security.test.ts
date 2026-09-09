import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeFeedPostRisk,
  getCommunityLinkWarnings,
  normalizeCommunityUrl,
  validateDiscordWebhookUrl,
} from "../src/services/feed-security.ts";

test("normalizeCommunityUrl accepts canonical https urls", () => {
  assert.equal(
    normalizeCommunityUrl("https://discord.com/invite/koma"),
    "https://discord.com/invite/koma",
  );
  assert.equal(
    normalizeCommunityUrl("discord.com/invite/koma"),
    "https://discord.com/invite/koma",
  );
});

test("normalizeCommunityUrl rejects unsupported protocols and malformed urls", () => {
  assert.equal(normalizeCommunityUrl("http://example.com"), null);
  assert.equal(normalizeCommunityUrl("javascript:alert(1)"), null);
  assert.equal(normalizeCommunityUrl("data:text/html;base64,abc"), null);
  assert.equal(normalizeCommunityUrl("not a url"), null);
});

test("getCommunityLinkWarnings highlights suspicious but valid https links", () => {
  const warnings = getCommunityLinkWarnings("https://mega.nz/free-nitro-gift", "pt-br");

  assert.ok(warnings.includes("Host de alto risco para golpes ou distribuicao maliciosa."));
  assert.ok(warnings.includes("Termos suspeitos detectados na URL."));
});

test("analyzeFeedPostRisk flags suspicious recruitment copy and malformed links", () => {
  const result = analyzeFeedPostRisk({
    title: "Ganhe Nitro grátis hoje",
    body:
      "Clique agora para baixar o pack premium e receber seu bônus imediato. sem experiência e pagamento em BTC.",
    urls: ["https://mega.nz/free-nitro", "javascript:alert(1)"],
    locale: "pt-br",
  });

  assert.equal(result.blocked, true);
  assert.ok(result.score >= 100);
  assert.ok(result.reasons.includes("URL invalida ou nao segura."));
  assert.ok(result.reasons.includes("Vocabulario altamente suspeito detectado no post."));
});

test("validateDiscordWebhookUrl only accepts official Discord https webhook urls", () => {
  const valid = validateDiscordWebhookUrl("https://discord.com/api/webhooks/123456789012345678/token_abc");
  assert.equal(valid.valid, true);
  assert.equal(valid.error, null);

  const invalidHost = validateDiscordWebhookUrl("https://example.com/api/webhooks/123/token");
  assert.equal(invalidHost.valid, false);

  const invalidProtocol = validateDiscordWebhookUrl("http://discord.com/api/webhooks/123/token");
  assert.equal(invalidProtocol.valid, false);
});
