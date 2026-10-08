import type React from "react";
import type { Dispatch, SetStateAction, ReactNode } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import DiscordRichPresenceDebugPanel from "../../../components/debug/DiscordRichPresenceDebugPanel";
import ResourceExternalAnchor from "../../../components/resources/ResourceExternalAnchor";
import { WEBHOOK_EVENT_OPTIONS, type DiscordWebhookConfig, type DiscordWebhookEventKey } from "../../../services/discordWebhook";
import type { AuthUser } from "../../../contexts/AuthContext";
import type { useI18n } from "../../../i18n";
import type { BloggerConfig, ImgurConfig, ImgurRateLimitStatus } from "../../../types";
import { IntegGuide } from "../../../pages/CollapsibleGuide";
import type { BloggerFeedbackState, WebhookFeedbackState, WebhookTestStatus } from "../settings.types";
import {
  Sec, Field, Alert, InkToggle, inputCls, selectCls,
  btnPrimary, btnGhost, iconBtnDanger,
} from "./primitives";

type TranslationFn = ReturnType<typeof useI18n>["t"];

interface SettingsIntegrationsTabArgs {
  t: TranslationFn;
  webhook: DiscordWebhookConfig;
  webhookTestStatus: WebhookTestStatus;
  updateWebhook: <K extends keyof DiscordWebhookConfig>(key: K, value: DiscordWebhookConfig[K]) => void;
  testWebhook: () => Promise<void>;
  updateWebhookEvent: (key: DiscordWebhookEventKey, value: boolean) => void;
  webhookSaved: boolean;
  saveWebhook: () => void;
  webhookFeedback: WebhookFeedbackState;
  user: AuthUser | null;
  bloggerConfig: BloggerConfig;
  updateBloggerConfig: <K extends keyof BloggerConfig>(key: K, value: BloggerConfig[K]) => void;
  updateBloggerNestedConfig: <K extends "optimizer" | "preprocess", F extends keyof BloggerConfig[K]>(group: K, field: F, value: BloggerConfig[K][F]) => void;
  bloggerLabelsInput: string;
  setBloggerLabelsInput: Dispatch<SetStateAction<string>>;
  setBloggerSaved: Dispatch<SetStateAction<boolean>>;
  setBloggerFeedback: Dispatch<SetStateAction<BloggerFeedbackState>>;
  bloggerSecureStorage: boolean;
  bloggerTesting: boolean;
  handleTestBloggerConnection: () => Promise<void>;
  handleSaveBloggerConfig: () => Promise<void>;
  bloggerSaved: boolean;
  bloggerFeedback: BloggerFeedbackState;
  imgurConfig: ImgurConfig;
  imgurRateLimit: ImgurRateLimitStatus;
  fmtDate: (value: number | string | null) => string;
  updateImgurConfig: <K extends keyof ImgurConfig>(key: K, value: ImgurConfig[K]) => void;
  addImgurKey: () => void;
  updateImgurKey: (keyId: string, field: "label" | "clientId" | "enabled", value: string | boolean) => void;
  removeImgurKey: (keyId: string) => void;
  imgurSecureStorage: boolean;
  handleSaveImgurConfig: () => Promise<void>;
  imgurSaved: boolean;
  imgurFeedback: BloggerFeedbackState;
}

const LiveDot = ({ on }: { on: boolean }) => (
  <span aria-hidden className={`ml-2 inline-block h-2 w-2 ${on ? "blink bg-mint" : "bg-paper/20"}`} />
);

const CardFooter = ({ secure, secureLabel, fallbackLabel, persistLabel, children }: {
  secure: boolean; secureLabel: string; fallbackLabel: string; persistLabel: string; children: ReactNode;
}) => (
  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-paper/8 pt-4">
    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/35">
      {persistLabel}: <strong className={secure ? "text-mint" : "text-gold"}>{secure ? secureLabel : fallbackLabel}</strong>
    </span>
    <div className="flex gap-2">{children}</div>
  </div>
);

export const renderSettingsIntegrationsTabNoir = (a: SettingsIntegrationsTabArgs): React.ReactElement => {
  const { t } = a;
  const imgurLive = a.imgurConfig.keys.some((k) => k.enabled && k.clientId.trim());

  return (
    <div className="space-y-5" key="integrations">
      {/* ═══════════ DISCORD ═══════════ */}
      <Sec
        icon={<svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>}
        title="Discord"
        accent="Webhook"
        desc={t("settings.integrations.discord.description")}
        actions={<LiveDot on={a.webhook.enabled} />}
      >
        <div className="space-y-4">
          <Field label={t("settings.integrations.discord.webhookUrl")}>
            <div className="flex gap-2">
              <input type="url" className={inputCls} placeholder={t("settings.integrations.discord.webhookPlaceholder")}
                value={a.webhook.url} onChange={(e) => a.updateWebhook("url", e.target.value)} />
              <button type="button"
                className={`${btnGhost} shrink-0 ${a.webhookTestStatus === "success" ? "!border-mint/50 !text-mint" :
                  a.webhookTestStatus === "error" ? "!border-crimson/50 !text-crimson" : ""
                  }`}
                disabled={!a.webhook.url.trim() || a.webhookTestStatus === "testing"}
                onClick={() => void a.testWebhook()}>
                {a.webhookTestStatus === "testing" && <span className="blink">{t("settings.integrations.testing")}</span>}
                {a.webhookTestStatus === "idle" && t("settings.integrations.test")}
                {a.webhookTestStatus === "success" && `✓ ${t("settings.integrations.ok")}`}
                {a.webhookTestStatus === "error" && `✕ ${t("settings.integrations.failed")}`}
              </button>
            </div>
          </Field>

          <Field label={t("settings.integrations.discord.botName")} optional>
            <input type="text" className={inputCls} placeholder={t("dashboard.topbar.brand")}
              value={a.webhook.botName} onChange={(e) => a.updateWebhook("botName", e.target.value)} />
          </Field>

          <Field label={t("settings.integrations.discord.events")}>
            <div className="grid gap-2 sm:grid-cols-2">
              {WEBHOOK_EVENT_OPTIONS.map((ev) => {
                const on = a.webhook.events[ev.key];
                return (
                  <label key={ev.key}
                    className={`panel-cut-sm flex cursor-pointer items-start gap-3 border p-3 transition-colors ${on ? "border-crimson/40 bg-crimson/5" : "border-paper/10 bg-ink/40"
                      }`}>
                    <InkToggle checked={on} onChange={(v) => a.updateWebhookEvent(ev.key, v)} label={t(ev.label as any)} />
                    <span className="min-w-0">
                      <span className="block font-display text-[11px] font-bold uppercase tracking-tight text-paper">{t(ev.label as any)}</span>
                      <span className="mt-0.5 block font-mono text-[9px] text-paper/40">{t(ev.desc as any)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper/8 pt-4">
            <label className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-paper/60">
              {t("settings.integrations.discord.webhookActive")}
              <InkToggle checked={a.webhook.enabled} onChange={(v) => a.updateWebhook("enabled", v)} />
            </label>
            <button type="button" className={btnPrimary} onClick={a.saveWebhook}>
              {a.webhookSaved ? `✓ ${t("settings.integrations.saved")}` : t("settings.modePresets.save")}
            </button>
          </div>

          {a.webhookFeedback && (
            <Alert tone={a.webhookFeedback.type === "error" ? "error" : "success"}>{a.webhookFeedback.message}</Alert>
          )}
        </div>

        <div className="mt-4">
          <IntegGuide title={t("settings.integrations.discord.howToSetup")}>
            <ol className="list-decimal space-y-1 pl-4 font-mono text-[11px] text-paper/60">
              <li>{t("settings.integrations.discord.step1")} <strong className="text-paper">{t("settings.integrations.discord.step1Strong")}</strong>.</li>
              <li>{t("settings.integrations.discord.step2")}</li>
            </ol>
          </IntegGuide>
        </div>
      </Sec>

      <DiscordRichPresenceDebugPanel user={a.user} />

      {/* ═══════════ BLOGGER ═══════════ */}
      <Sec
        icon={<svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M5 4a3 3 0 00-3 3v10a3 3 0 003 3h14a3 3 0 003-3V7a3 3 0 00-3-3H5zm1.5 4.5a1 1 0 011-1h9a1 1 0 110 2h-9a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2h-6a1 1 0 01-1-1z" /></svg>}
        title={t("settings.integrations.blogger.title")}
        desc={t("settings.integrations.blogger.description")}
        actions={<LiveDot on={Boolean(a.bloggerConfig.blogId.trim())} />}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("settings.integrations.blogger.label")}>
              <input type="text" className={inputCls} value={a.bloggerConfig.label}
                onChange={(e) => a.updateBloggerConfig("label", e.target.value)}
                placeholder={t("settings.integrations.blogger.labelPlaceholder")} />
            </Field>
            <Field label={t("settings.integrations.blogger.blogId")}>
              <input type="text" className={inputCls} value={a.bloggerConfig.blogId}
                onChange={(e) => a.updateBloggerConfig("blogId", e.target.value)}
                placeholder={t("settings.integrations.blogger.blogIdPlaceholder")} />
            </Field>
          </div>

          <Field label={t("settings.integrations.blogger.clientId")}>
            <input type="text" className={inputCls} value={a.bloggerConfig.clientId}
              onChange={(e) => a.updateBloggerConfig("clientId", e.target.value)}
              placeholder={t("settings.integrations.blogger.clientIdPlaceholder")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("settings.integrations.blogger.clientSecret")}>
              <input type="password" className={inputCls} value={a.bloggerConfig.clientSecret}
                onChange={(e) => a.updateBloggerConfig("clientSecret", e.target.value)}
                placeholder={t("settings.integrations.blogger.clientSecretPlaceholder")} />
            </Field>
            <Field label={t("settings.integrations.blogger.refreshToken")}>
              <input type="password" className={inputCls} value={a.bloggerConfig.refreshToken}
                onChange={(e) => a.updateBloggerConfig("refreshToken", e.target.value)}
                placeholder={t("settings.integrations.blogger.refreshTokenPlaceholder")} />
            </Field>
          </div>

          <Field label={t("settings.integrations.blogger.defaultLabels")}>
            <input type="text" className={inputCls} value={a.bloggerLabelsInput}
              onChange={(e) => { a.setBloggerLabelsInput(e.target.value); a.setBloggerSaved(false); a.setBloggerFeedback(null); }}
              placeholder={t("settings.integrations.blogger.defaultLabelsPlaceholder")} />
          </Field>

          {/* Optimizer */}
          <div className="panel-cut-sm border border-azure/20 bg-azure/[0.03] p-4">
            <p className="kicker mb-3 !text-azure">// OPTIMIZER</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("settings.integrations.blogger.optimizer")}>
                <select className={selectCls} value={a.bloggerConfig.optimizer.provider}
                  onChange={(e) => a.updateBloggerNestedConfig("optimizer", "provider", e.target.value as BloggerConfig["optimizer"]["provider"])}>
                  <option value="cloudinary">{t("settings.integrations.blogger.optimizerCloudinary")}</option>
                  <option value="template">{t("settings.integrations.blogger.optimizerTemplate")}</option>
                </select>
              </Field>
              <Field label={a.bloggerConfig.optimizer.provider === "cloudinary"
                ? t("settings.integrations.blogger.cloudName")
                : t("settings.integrations.blogger.urlTemplate")}>
                {a.bloggerConfig.optimizer.provider === "cloudinary" ? (
                  <input type="text" className={inputCls} value={a.bloggerConfig.optimizer.cloudinary.cloudName}
                    onChange={(e) => a.updateBloggerNestedConfig("optimizer", "cloudinary", { ...a.bloggerConfig.optimizer.cloudinary, cloudName: e.target.value })}
                    placeholder={t("settings.integrations.blogger.cloudNamePlaceholder")} />
                ) : (
                  <input type="text" className={inputCls} value={a.bloggerConfig.optimizer.template}
                    onChange={(e) => a.updateBloggerNestedConfig("optimizer", "template", e.target.value)}
                    placeholder="https://wsrv.nl/?url={{url}}&output=webp" />
                )}
              </Field>
            </div>
            {a.bloggerConfig.optimizer.provider === "cloudinary" && (
              <div className="mt-4">
                <Field label={t("settings.integrations.blogger.cloudinaryTransformation")}>
                  <input type="text" className={inputCls} value={a.bloggerConfig.optimizer.cloudinary.transformation}
                    onChange={(e) => a.updateBloggerNestedConfig("optimizer", "cloudinary", { ...a.bloggerConfig.optimizer.cloudinary, transformation: e.target.value })}
                    placeholder="c_limit,f_auto,q_auto" />
                </Field>
              </div>
            )}
            <label className="mt-4 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-wider text-paper/60">
              {t("settings.integrations.blogger.optimizerEnabled")}
              <InkToggle checked={a.bloggerConfig.optimizer.enabled}
                onChange={(v) => a.updateBloggerNestedConfig("optimizer", "enabled", v)} />
            </label>
          </div>

          {/* Preprocess */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label={t("settings.integrations.blogger.maxWidth")}>
              <input type="number" className={inputCls} value={a.bloggerConfig.preprocess.maxWidth}
                onChange={(e) => a.updateBloggerNestedConfig("preprocess", "maxWidth", Number(e.target.value))} min={320} max={8192} />
            </Field>
            <Field label={t("settings.integrations.blogger.maxHeight")}>
              <input type="number" className={inputCls} value={a.bloggerConfig.preprocess.maxHeight}
                onChange={(e) => a.updateBloggerNestedConfig("preprocess", "maxHeight", Number(e.target.value))} min={320} max={8192} />
            </Field>
            <Field label={t("common.format")}>
              <select className={selectCls} value={a.bloggerConfig.preprocess.outputFormat}
                onChange={(e) => a.updateBloggerNestedConfig("preprocess", "outputFormat", e.target.value as BloggerConfig["preprocess"]["outputFormat"])}>
                <option value="original">{t("common.original")}</option>
                <option value="jpeg">{t("settings.downloadFormat.jpeg")}</option>
                <option value="png">{t("settings.downloadFormat.png")}</option>
                <option value="webp">{t("settings.downloadFormat.webp")}</option>
              </select>
            </Field>
            <Field label={t("common.quality")}>
              <input type="number" className={inputCls} value={a.bloggerConfig.preprocess.quality}
                onChange={(e) => a.updateBloggerNestedConfig("preprocess", "quality", Number(e.target.value))}
                min={0.2} max={1} step={0.05} />
            </Field>
          </div>

          <CardFooter secure={a.bloggerSecureStorage}
            persistLabel={t("common.persistence")}
            secureLabel={t("common.secureStore")} fallbackLabel={t("common.browserFallback")}>
            <button type="button" className={btnGhost} disabled={a.bloggerTesting}
              onClick={() => void a.handleTestBloggerConnection()}>
              {a.bloggerTesting
                ? <span className="blink">{t("settings.integrations.testing")}</span>
                : t("settings.integrations.blogger.testConnection")}
            </button>
            <button type="button" className={btnPrimary} onClick={() => void a.handleSaveBloggerConfig()}>
              {a.bloggerSaved ? `✓ ${t("settings.integrations.saved")}` : t("common.save")}
            </button>
          </CardFooter>

          {a.bloggerFeedback && (
            <Alert tone={a.bloggerFeedback.type === "error" ? "error" : "success"}>{a.bloggerFeedback.message}</Alert>
          )}

          {/* Quota specs */}
          <div className="grid grid-cols-2 gap-3">
            {[
              [t("settings.integrations.blogger.requestsPerDay"), t("settings.integrations.blogger.value.requestsPerDay")],
              [t("settings.integrations.blogger.requestsPerUser"), t("settings.integrations.blogger.value.requestsPerUser")],
            ].map(([l, v]) => (
              <div key={l} className="panel-cut-sm border border-paper/8 bg-ink/40 p-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-paper/35">{l}</p>
                <p className="mt-1 font-display text-sm font-black text-gold">{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <IntegGuide title={t("settings.integrations.blogger.credentialsGuideTitle")}>
            <ol className="list-decimal space-y-1 pl-4 font-mono text-[11px] text-paper/60">
              <li>{t("settings.integrations.blogger.step1")} <strong className="text-paper">{t("settings.integrations.blogger.term.googleCloudConsole")}</strong>, {t("settings.integrations.blogger.step1Suffix")}</li>
              <li>{t("settings.integrations.blogger.step2")} <strong className="text-paper">{t("settings.integrations.blogger.term.bloggerApiV3")}</strong> {t("settings.integrations.blogger.step2And")} <strong className="text-paper">{t("settings.integrations.blogger.term.googleDriveApi")}</strong>.</li>
              <li>{t("settings.integrations.blogger.step3")} <strong className="text-paper">{t("settings.integrations.blogger.term.oauthClientId")}</strong> ({t("settings.integrations.blogger.webApplication")}).</li>
              <li>{t("settings.integrations.blogger.step4")} <code className="text-azure">https://developers.google.com/oauthplayground</code> {t("settings.integrations.blogger.step4Suffix")}</li>
              <li>{t("settings.integrations.blogger.step5")} <strong className="text-paper">{t("settings.integrations.blogger.term.clientId")}</strong> {t("settings.integrations.blogger.step5And")} <strong className="text-paper">{t("settings.integrations.blogger.term.clientSecret")}</strong>.</li>
              <li>{t("settings.integrations.blogger.step6")}</li>
              <li>{t("settings.integrations.blogger.step7")} <strong className="text-paper">{t("settings.integrations.blogger.term.oauthPlayground")}</strong>, {t("settings.integrations.blogger.step7Suffix")}</li>
              <li>{t("settings.integrations.blogger.step8")} <strong className="text-paper">{t("settings.integrations.blogger.term.exchangeCodeForTokens")}</strong> {t("settings.integrations.blogger.step8Suffix")} <strong className="text-paper">{t("settings.integrations.blogger.term.refreshToken")}</strong>.</li>
              <li>{t("settings.integrations.blogger.step9")} <strong className="text-paper">{t("settings.integrations.blogger.term.cloudName")}</strong> {t("settings.integrations.blogger.step9Suffix")}</li>
              <li>{t("settings.integrations.blogger.step10")} <strong className="text-paper">{t("settings.integrations.blogger.term.blogId")}</strong> {t("settings.integrations.blogger.step10Suffix")}</li>
              <li>{t("settings.integrations.blogger.step11")}</li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px]">
              {([
                ["https://cloud.google.com/docs/quotas/view-manage", t("settings.integrations.blogger.googleQuotas")],
                ["https://developers.google.com/oauthplayground", t("settings.integrations.blogger.oauthPlayground")],
                ["https://cloudinary.com/documentation/fetch_remote_images", t("settings.integrations.blogger.cloudinaryFetch")],
                ["https://developers.google.com/workspace/drive/api/guides/api-specific-auth", t("settings.integrations.blogger.driveScopes")],
              ] as [string, string][]).map(([href, label]) => (
                <ResourceExternalAnchor key={href} href={href}>
                  <span className="inline-flex items-center gap-1 text-azure underline decoration-azure/40 underline-offset-2 hover:decoration-azure">
                    {label} <ExternalLink size={9} />
                  </span>
                </ResourceExternalAnchor>
              ))}
            </div>
          </IntegGuide>

          <IntegGuide title={t("settings.integrations.blogger.driveScopesGuideTitle")}>
            <Alert tone="info">
              <p>{t("settings.integrations.blogger.minimumPractical")} <code className="text-azure">https://www.googleapis.com/auth/drive</code></p>
              <p className="mt-1">{t("settings.integrations.blogger.driveScopesNote")}</p>
            </Alert>
          </IntegGuide>
        </div>
      </Sec>

      {/* ═══════════ IMGUR ═══════════ */}
      <Sec
        icon={<svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M12 3.5c-4.971 0-9 3.019-9 6.75 0 2.297 1.55 4.327 3.916 5.55-.086.711-.376 1.566-1.058 2.46-.18.235-.204.557-.06.815a.79.79 0 00.731.402c1.461-.074 2.959-.657 4.138-1.596.439.042.884.064 1.333.064 4.971 0 9-3.019 9-6.75s-4.029-6.75-9-6.75z" /></svg>}
        title={t("settings.integrations.imgur.title")}
        desc={t("settings.integrations.imgur.description")}
        actions={<LiveDot on={imgurLive} />}
      >
        <div className="space-y-4">
          {/* Rate limit config + status */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={t("settings.integrations.imgur.limitPerHour")}>
              <input type="number" className={inputCls} value={a.imgurConfig.rateLimitPerHour}
                onChange={(e) => a.updateImgurConfig("rateLimitPerHour", Number(e.target.value))} min={1} max={500} />
            </Field>
            <Field label={t("settings.integrations.imgur.batchDelay")}>
              <input type="number" className={inputCls} value={a.imgurConfig.batchDelayMs}
                onChange={(e) => a.updateImgurConfig("batchDelayMs", Number(e.target.value))} min={0} max={30000} step={100} />
            </Field>
            <div className="panel-cut-sm border border-mint/25 bg-mint/[0.04] p-3">
              <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-paper/35">{t("settings.integrations.imgur.remaining")}</p>
              <p className="mt-1 font-display text-xl font-black text-mint">{a.imgurRateLimit.remainingThisHour}</p>
            </div>
          </div>

          <Alert tone="info">
            {t("settings.integrations.imgur.used", { used: a.imgurRateLimit.usedThisHour, limit: a.imgurRateLimit.limitPerHour })}
            {a.imgurRateLimit.resetsAt ? ` · ${t("settings.integrations.imgur.reset", { value: a.fmtDate(a.imgurRateLimit.resetsAt) })}` : ""}
          </Alert>

          {/* Keys */}
          <div className="flex items-center justify-between">
            <span className="kicker">// {t("settings.integrations.imgur.clientIds")}</span>
            <button type="button" className={btnGhost} onClick={a.addImgurKey}>
              <Plus size={10} /> {t("common.add")}
            </button>
          </div>

          {a.imgurConfig.keys.length === 0 ? (
            <div className="panel-cut-sm border border-dashed border-paper/15 p-6 text-center font-mono text-[10px] uppercase tracking-wider text-paper/35">
              {t("settings.integrations.imgur.noClientIds")}
            </div>
          ) : (
            <div className="space-y-2">
              {a.imgurConfig.keys.map((key, i) => (
                <div key={key.id}
                  className={`panel-cut-sm grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-2 border p-2.5 ${key.enabled ? "border-paper/12 bg-ink/50" : "border-paper/8 bg-ink/30 opacity-60"
                    }`}>
                  <span aria-hidden className="font-display text-sm font-black text-paper/20">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <input type="text" className={inputCls} value={key.label}
                    onChange={(e) => a.updateImgurKey(key.id, "label", e.target.value)} placeholder={t("common.label")} />
                  <input type="text" className={inputCls} value={key.clientId}
                    onChange={(e) => a.updateImgurKey(key.id, "clientId", e.target.value)}
                    placeholder={t("settings.integrations.imgur.clientIdPlaceholder")} />
                  <InkToggle checked={key.enabled} onChange={(v) => a.updateImgurKey(key.id, "enabled", v)} />
                  <button type="button" className={iconBtnDanger} onClick={() => a.removeImgurKey(key.id)}
                    aria-label={t("common.delete")}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <CardFooter secure={a.imgurSecureStorage}
            persistLabel={t("common.persistence")}
            secureLabel={t("common.secureStore")} fallbackLabel={t("common.browserFallback")}>
            <button type="button" className={btnPrimary} onClick={() => void a.handleSaveImgurConfig()}>
              {a.imgurSaved ? `✓ ${t("settings.integrations.saved")}` : t("common.save")}
            </button>
          </CardFooter>

          {a.imgurFeedback && (
            <Alert tone={a.imgurFeedback.type === "error" ? "error" : "success"}>{a.imgurFeedback.message}</Alert>
          )}
        </div>

        <div className="mt-4">
          <IntegGuide title={t("settings.integrations.imgur.quickGuideTitle")}>
            <ol className="list-decimal space-y-1 pl-4 font-mono text-[11px] text-paper/60">
              <li>{t("settings.integrations.imgur.step1")} <strong className="text-paper">{t("settings.integrations.imgur.term.clientId")}</strong>.</li>
              <li>{t("settings.integrations.imgur.step2")}</li>
              <li>{t("settings.integrations.imgur.step3")} <code className="text-azure">{t("settings.integrations.imgur.authorizationHeaderExample")}</code>. {t("settings.integrations.imgur.step3Suffix")}</li>
              <li>{t("settings.integrations.imgur.step4")} <strong className="text-paper">{t("settings.integrations.imgur.term.rateLimit")}</strong> {t("settings.integrations.imgur.step4Suffix")}</li>
              <li>{t("settings.integrations.imgur.step5")}</li>
              <li>{t("settings.integrations.imgur.step6")}</li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px]">
              {([
                ["https://api.imgur.com/endpoints/image", t("settings.integrations.imgur.imageApi")],
                ["https://help.imgur.com/hc/en-us/articles/210076663-Uploading-Content", t("settings.integrations.imgur.uploading")],
              ] as [string, string][]).map(([href, label]) => (
                <ResourceExternalAnchor key={href} href={href}>
                  <span className="inline-flex items-center gap-1 text-azure underline decoration-azure/40 underline-offset-2 hover:decoration-azure">
                    {label} <ExternalLink size={9} />
                  </span>
                </ResourceExternalAnchor>
              ))}
            </div>
          </IntegGuide>
        </div>
      </Sec>
    </div>
  );
};
