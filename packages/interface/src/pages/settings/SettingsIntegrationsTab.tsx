import type { JSX } from "react";
import type { Dispatch, SetStateAction } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Plus, Trash2 } from "lucide-react";

import DiscordRichPresenceDebugPanel from "../../components/debug/DiscordRichPresenceDebugPanel";
import ResourceExternalAnchor from "../../components/resources/ResourceExternalAnchor";
import { WEBHOOK_EVENT_OPTIONS, type DiscordWebhookConfig, type DiscordWebhookEventKey } from "../../services/discordWebhook";
import type { AuthUser } from "../../contexts/AuthContext";
import type { useI18n } from "../../i18n";
import type { BloggerConfig, ImgurConfig, ImgurRateLimitStatus } from "../../types";
import { cn } from "@/utils/dashboard.utils";
import { IntegGuide } from "../CollapsibleGuide";
import type { BloggerFeedbackState, WebhookFeedbackState, WebhookTestStatus } from "./settings.types";

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
  updateBloggerNestedConfig: <K extends "optimizer" | "preprocess", F extends keyof BloggerConfig[K]>(
    group: K,
    field: F,
    value: BloggerConfig[K][F],
  ) => void;
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

export const renderSettingsIntegrationsTab = ({
  t,
  webhook,
  webhookTestStatus,
  updateWebhook,
  testWebhook,
  updateWebhookEvent,
  webhookSaved,
  saveWebhook,
  webhookFeedback,
  user,
  bloggerConfig,
  updateBloggerConfig,
  updateBloggerNestedConfig,
  bloggerLabelsInput,
  setBloggerLabelsInput,
  setBloggerSaved,
  setBloggerFeedback,
  bloggerSecureStorage,
  bloggerTesting,
  handleTestBloggerConnection,
  handleSaveBloggerConfig,
  bloggerSaved,
  bloggerFeedback,
  imgurConfig,
  imgurRateLimit,
  fmtDate,
  updateImgurConfig,
  addImgurKey,
  updateImgurKey,
  removeImgurKey,
  imgurSecureStorage,
  handleSaveImgurConfig,
  imgurSaved,
  imgurFeedback,
}: SettingsIntegrationsTabArgs): JSX.Element => (
<div className="koma-integ-panel" key="integrations">

  {/* ═══════════════════ DISCORD WEBHOOK ═══════════════════ */}
  <section className="koma-integ-card">
    <div className="koma-integ-card__head">
      <span className="koma-integ-card__icon koma-integ-card__icon--discord" aria-hidden="true">
        {/* Discord icon inline SVG */}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      </span>
      <div className="koma-integ-card__title-group">
        <h3 className="koma-integ-card__title">
          Discord Webhook
          <span className={`koma-integ-status${webhook.enabled ? " koma-integ-status--on" : " koma-integ-status--off"}`} />
        </h3>
        <p className="koma-integ-card__desc">
          {t("settings.integrations.discord.description")}
        </p>
      </div>
    </div>

    <div className="koma-integ-body">
      {/* URL + Test */}
      <div className="koma-ig-field">
        <label className="koma-ig-field__label">{t("settings.integrations.discord.webhookUrl")}</label>
        <div className="koma-ig-field__row">
          <input type="url" className="koma-ig-field__input" placeholder={t("settings.integrations.discord.webhookPlaceholder")} value={webhook.url} onChange={(e) => updateWebhook("url", e.target.value)} />
          <button
            type="button"
            className={cn("koma-btn koma-btn--ghost koma-btn--sm", webhookTestStatus === "success" && "koma-ig-test--success", webhookTestStatus === "error" && "koma-ig-test--error")}
            disabled={!webhook.url.trim() || webhookTestStatus === "testing"}
            onClick={() => void testWebhook()}
          >
            {webhookTestStatus === "testing" && <><span className="auth-spinner" style={{ width: 11, height: 11 }} /> {t("settings.integrations.testing")}</>}
            {webhookTestStatus === "idle" && t("settings.integrations.test")}
            {webhookTestStatus === "success" && t("settings.integrations.ok")}
            {webhookTestStatus === "error" && t("settings.integrations.failed")}
          </button>
        </div>
      </div>

      {/* Bot name */}
      <div className="koma-ig-field">
        <label className="koma-ig-field__label koma-ig-field__label--opt">{t("settings.integrations.discord.botName")}</label>
        <input type="text" className="koma-ig-field__input" placeholder={t("dashboard.topbar.brand")} value={webhook.botName} onChange={(e) => updateWebhook("botName", e.target.value)} />
      </div>

      {/* Events */}
      <div className="koma-ig-field">
        <label className="koma-ig-field__label">{t("settings.integrations.discord.events")}</label>
        <div className="koma-ig-events">
          {WEBHOOK_EVENT_OPTIONS.map((ev) => (
            <label key={ev.key} className="koma-ig-event">
              <input type="checkbox" checked={webhook.events[ev.key]} onChange={(e) => updateWebhookEvent(ev.key, e.target.checked)} />
              <div className="koma-ig-event__info">
                <span className="koma-ig-event__name">{t(ev.label as any)}</span>
                <span className="koma-ig-event__desc">{t(ev.desc as any)}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="koma-ig-footer">
        <label className="koma-ig-toggle-row">
          <span>{t("settings.integrations.discord.webhookActive")}</span>
          <div className={cn("koma-ig-toggle", webhook.enabled && "koma-ig-toggle--on")}>
            <input type="checkbox" className="koma-ig-toggle__input" checked={webhook.enabled} onChange={(e) => updateWebhook("enabled", e.target.checked)} />
            <span className="koma-ig-toggle__track"><span className="koma-ig-toggle__thumb" /></span>
          </div>
        </label>
        <button type="button" className="koma-btn koma-btn--primary koma-btn--sm" onClick={saveWebhook}>
          {webhookSaved ? t("settings.integrations.saved") : t("settings.modePresets.save")}
        </button>
      </div>
    </div>

    {/* Feedback */}
    {webhookFeedback && (
      <div className={`koma-ig-alert${webhookFeedback.type === "error" ? " koma-ig-alert--error" : " koma-ig-alert--success"}`} role={webhookFeedback.type === "error" ? "alert" : "status"}>
        {webhookFeedback.type === "error" ? <AlertTriangle size={12} className="koma-ig-alert__icon" /> : <CheckCircle2 size={12} className="koma-ig-alert__icon" />}
        <span>{webhookFeedback.message}</span>
      </div>
    )}

    {/* Guide */}
    <IntegGuide title={t("settings.integrations.discord.howToSetup")}>
      <ol className="koma-ig-guide__steps">
        <li>{t("settings.integrations.discord.step1")} <strong>{t("settings.integrations.discord.step1Strong")}</strong>.</li>
        <li>{t("settings.integrations.discord.step2")}</li>
      </ol>
    </IntegGuide>
  </section>

  <DiscordRichPresenceDebugPanel user={user} />

  {/* ═══════════════════ BLOGGER CDN ═══════════════════ */}
  <section className="koma-integ-card">
    <div className="koma-integ-card__head">
      <span className="koma-integ-card__icon koma-integ-card__icon--blogger" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M5 4a3 3 0 00-3 3v10a3 3 0 003 3h14a3 3 0 003-3V7a3 3 0 00-3-3H5zm1.5 4.5a1 1 0 011-1h9a1 1 0 110 2h-9a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2h-6a1 1 0 01-1-1z" /></svg>
      </span>
      <div className="koma-integ-card__title-group">
        <h3 className="koma-integ-card__title">
          {t("settings.integrations.blogger.title")}
          <span className={`koma-integ-status${bloggerConfig.blogId.trim() ? " koma-integ-status--on" : " koma-integ-status--off"}`} />
        </h3>
        <p className="koma-integ-card__desc">{t("settings.integrations.blogger.description")}</p>
      </div>
    </div>

    <div className="koma-integ-body">
      <div className="koma-ig-grid">
        <div className="koma-ig-field">
          <label className="koma-ig-field__label">{t("settings.integrations.blogger.label")}</label>
          <input type="text" className="koma-ig-field__input" value={bloggerConfig.label} onChange={(e) => updateBloggerConfig("label", e.target.value)} placeholder={t("settings.integrations.blogger.labelPlaceholder")} />
        </div>
        <div className="koma-ig-field">
          <label className="koma-ig-field__label">{t("settings.integrations.blogger.blogId")}</label>
          <input type="text" className="koma-ig-field__input" value={bloggerConfig.blogId} onChange={(e) => updateBloggerConfig("blogId", e.target.value)} placeholder={t("settings.integrations.blogger.blogIdPlaceholder")} />
        </div>
      </div>

      <div className="koma-ig-field">
        <label className="koma-ig-field__label">{t("settings.integrations.blogger.clientId")}</label>
        <input type="text" className="koma-ig-field__input" value={bloggerConfig.clientId} onChange={(e) => updateBloggerConfig("clientId", e.target.value)} placeholder={t("settings.integrations.blogger.clientIdPlaceholder")} />
      </div>

      <div className="koma-ig-grid">
        <div className="koma-ig-field">
          <label className="koma-ig-field__label">{t("settings.integrations.blogger.clientSecret")}</label>
          <input type="password" className="koma-ig-field__input" value={bloggerConfig.clientSecret} onChange={(e) => updateBloggerConfig("clientSecret", e.target.value)} placeholder={t("settings.integrations.blogger.clientSecretPlaceholder")} />
        </div>
        <div className="koma-ig-field">
          <label className="koma-ig-field__label">{t("settings.integrations.blogger.refreshToken")}</label>
          <input type="password" className="koma-ig-field__input" value={bloggerConfig.refreshToken} onChange={(e) => updateBloggerConfig("refreshToken", e.target.value)} placeholder={t("settings.integrations.blogger.refreshTokenPlaceholder")} />
        </div>
      </div>

      <div className="koma-ig-field">
        <label className="koma-ig-field__label">{t("settings.integrations.blogger.defaultLabels")}</label>
        <input type="text" className="koma-ig-field__input" value={bloggerLabelsInput} onChange={(e) => { setBloggerLabelsInput(e.target.value); setBloggerSaved(false); setBloggerFeedback(null); }} placeholder={t("settings.integrations.blogger.defaultLabelsPlaceholder")} />
      </div>

      {/* Optimizer */}
      <div className="koma-ig-grid">
        <div className="koma-ig-field">
          <label className="koma-ig-field__label">{t("settings.integrations.blogger.optimizer")}</label>
          <select className="koma-ig-field__select" value={bloggerConfig.optimizer.provider} onChange={(e) => updateBloggerNestedConfig("optimizer", "provider", e.target.value as BloggerConfig["optimizer"]["provider"])}>
            <option value="cloudinary">{t("settings.integrations.blogger.optimizerCloudinary")}</option>
            <option value="template">{t("settings.integrations.blogger.optimizerTemplate")}</option>
          </select>
        </div>
        <div className="koma-ig-field">
          <label className="koma-ig-field__label">
            {bloggerConfig.optimizer.provider === "cloudinary" ? t("settings.integrations.blogger.cloudName") : t("settings.integrations.blogger.urlTemplate")}
          </label>
          {bloggerConfig.optimizer.provider === "cloudinary" ? (
            <input type="text" className="koma-ig-field__input" value={bloggerConfig.optimizer.cloudinary.cloudName} onChange={(e) => updateBloggerNestedConfig("optimizer", "cloudinary", { ...bloggerConfig.optimizer.cloudinary, cloudName: e.target.value })} placeholder={t("settings.integrations.blogger.cloudNamePlaceholder")} />
          ) : (
            <input type="text" className="koma-ig-field__input" value={bloggerConfig.optimizer.template} onChange={(e) => updateBloggerNestedConfig("optimizer", "template", e.target.value)} placeholder="https://wsrv.nl/?url={{url}}&output=webp" />
          )}
        </div>
      </div>

      {bloggerConfig.optimizer.provider === "cloudinary" && (
        <div className="koma-ig-field">
          <label className="koma-ig-field__label">{t("settings.integrations.blogger.cloudinaryTransformation")}</label>
          <input type="text" className="koma-ig-field__input" value={bloggerConfig.optimizer.cloudinary.transformation} onChange={(e) => updateBloggerNestedConfig("optimizer", "cloudinary", { ...bloggerConfig.optimizer.cloudinary, transformation: e.target.value })} placeholder="c_limit,f_auto,q_auto" />
        </div>
      )}

      <label className="koma-ig-toggle-row">
        <span>{t("settings.integrations.blogger.optimizerEnabled")}</span>
        <div className={cn("koma-ig-toggle", bloggerConfig.optimizer.enabled && "koma-ig-toggle--on")}>
          <input type="checkbox" className="koma-ig-toggle__input" checked={bloggerConfig.optimizer.enabled} onChange={(e) => updateBloggerNestedConfig("optimizer", "enabled", e.target.checked)} />
          <span className="koma-ig-toggle__track"><span className="koma-ig-toggle__thumb" /></span>
        </div>
      </label>

      {/* Preprocess */}
      <div className="koma-ig-quota-grid">
        <div className="koma-ig-quota-cell">
          <span className="koma-ig-quota-cell__label">{t("settings.integrations.blogger.maxWidth")}</span>
          <input type="number" className="koma-ig-field__input" value={bloggerConfig.preprocess.maxWidth} onChange={(e) => updateBloggerNestedConfig("preprocess", "maxWidth", Number(e.target.value))} min={320} max={8192} style={{ height: 26, fontSize: 11 }} />
        </div>
        <div className="koma-ig-quota-cell">
          <span className="koma-ig-quota-cell__label">{t("settings.integrations.blogger.maxHeight")}</span>
          <input type="number" className="koma-ig-field__input" value={bloggerConfig.preprocess.maxHeight} onChange={(e) => updateBloggerNestedConfig("preprocess", "maxHeight", Number(e.target.value))} min={320} max={8192} style={{ height: 26, fontSize: 11 }} />
        </div>
        <div className="koma-ig-quota-cell">
          <span className="koma-ig-quota-cell__label">{t("common.format")}</span>
          <select className="koma-ig-field__select" value={bloggerConfig.preprocess.outputFormat} onChange={(e) => updateBloggerNestedConfig("preprocess", "outputFormat", e.target.value as BloggerConfig["preprocess"]["outputFormat"])} style={{ height: 26, fontSize: 11 }}>
            <option value="original">{t("common.original")}</option>
            <option value="jpeg">{t("settings.downloadFormat.jpeg")}</option>
            <option value="png">{t("settings.downloadFormat.png")}</option>
            <option value="webp">{t("settings.downloadFormat.webp")}</option>
          </select>
        </div>
        <div className="koma-ig-quota-cell">
          <span className="koma-ig-quota-cell__label">{t("common.quality")}</span>
          <input type="number" className="koma-ig-field__input" value={bloggerConfig.preprocess.quality} onChange={(e) => updateBloggerNestedConfig("preprocess", "quality", Number(e.target.value))} min={0.2} max={1} step={0.05} style={{ height: 26, fontSize: 11 }} />
        </div>
      </div>

      {/* Footer */}
      <div className="koma-ig-footer">
        <div className="koma-ig-footer__info">
          <span className="koma-ig-footer__label">{t("common.persistence")}</span>
          <span className="koma-ig-footer__value">{bloggerSecureStorage ? t("common.secureStore") : t("common.browserFallback")}</span>
        </div>
        <div className="koma-ig-footer__actions">
          <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" disabled={bloggerTesting} onClick={() => void handleTestBloggerConnection()}>
            {bloggerTesting ? <><span className="auth-spinner" style={{ width: 11, height: 11 }} /> {t("settings.integrations.testing")}</> : t("settings.integrations.blogger.testConnection")}
          </button>
          <button type="button" className="koma-btn koma-btn--primary koma-btn--sm" onClick={() => void handleSaveBloggerConfig()}>
            {bloggerSaved ? t("settings.integrations.saved") : t("common.save")}
          </button>
        </div>
      </div>
    </div>

    {bloggerFeedback && (
      <div className={`koma-ig-alert${bloggerFeedback.type === "error" ? " koma-ig-alert--error" : " koma-ig-alert--success"}`} role={bloggerFeedback.type === "error" ? "alert" : "status"}>
        {bloggerFeedback.type === "error" ? <AlertTriangle size={11} className="koma-ig-alert__icon" /> : <CheckCircle2 size={11} className="koma-ig-alert__icon" />}
        <span>{bloggerFeedback.message}</span>
      </div>
    )}

    {/* Quota */}
    <div className="koma-ig-quota-grid">
      <div className="koma-ig-quota-cell">
        <span className="koma-ig-quota-cell__label">{t("settings.integrations.blogger.requestsPerDay")}</span>
        <span className="koma-ig-quota-cell__value">{t("settings.integrations.blogger.value.requestsPerDay")}</span>
      </div>
      <div className="koma-ig-quota-cell">
        <span className="koma-ig-quota-cell__label">{t("settings.integrations.blogger.requestsPerUser")}</span>
        <span className="koma-ig-quota-cell__value">{t("settings.integrations.blogger.value.requestsPerUser")}</span>
      </div>
    </div>

    {/* Guide */}
    <IntegGuide title={t("settings.integrations.blogger.credentialsGuideTitle")}>
      <ol className="koma-ig-guide__steps">
        <li>{t("settings.integrations.blogger.step1")} <strong>{t("settings.integrations.blogger.term.googleCloudConsole")}</strong>, {t("settings.integrations.blogger.step1Suffix")}</li>
        <li>{t("settings.integrations.blogger.step2")} <strong>{t("settings.integrations.blogger.term.bloggerApiV3")}</strong> {t("settings.integrations.blogger.step2And")} <strong>{t("settings.integrations.blogger.term.googleDriveApi")}</strong>.</li>
        <li>{t("settings.integrations.blogger.step3")} <strong>{t("settings.integrations.blogger.term.oauthClientId")}</strong> ({t("settings.integrations.blogger.webApplication")}).</li>
        <li>{t("settings.integrations.blogger.step4")} <code>https://developers.google.com/oauthplayground</code> {t("settings.integrations.blogger.step4Suffix")}</li>
        <li>{t("settings.integrations.blogger.step5")} <strong>{t("settings.integrations.blogger.term.clientId")}</strong> {t("settings.integrations.blogger.step5And")} <strong>{t("settings.integrations.blogger.term.clientSecret")}</strong>.</li>
        <li>{t("settings.integrations.blogger.step6")}</li>
        <li>{t("settings.integrations.blogger.step7")} <strong>{t("settings.integrations.blogger.term.oauthPlayground")}</strong>, {t("settings.integrations.blogger.step7Suffix")}</li>
        <li>{t("settings.integrations.blogger.step8")} <strong>{t("settings.integrations.blogger.term.exchangeCodeForTokens")}</strong> {t("settings.integrations.blogger.step8Suffix")} <strong>{t("settings.integrations.blogger.term.refreshToken")}</strong>.</li>
        <li>{t("settings.integrations.blogger.step9")} <strong>{t("settings.integrations.blogger.term.cloudName")}</strong> {t("settings.integrations.blogger.step9Suffix")}</li>
        <li>{t("settings.integrations.blogger.step10")} <strong>{t("settings.integrations.blogger.term.blogId")}</strong> {t("settings.integrations.blogger.step10Suffix")}</li>
        <li>{t("settings.integrations.blogger.step11")}</li>
      </ol>
      <div className="koma-ig-guide__links">
        <ResourceExternalAnchor href="https://cloud.google.com/docs/quotas/view-manage">{t("settings.integrations.blogger.googleQuotas")} <ExternalLink size={9} /></ResourceExternalAnchor>
        <ResourceExternalAnchor href="https://developers.google.com/oauthplayground">{t("settings.integrations.blogger.oauthPlayground")} <ExternalLink size={9} /></ResourceExternalAnchor>
        <ResourceExternalAnchor href="https://cloudinary.com/documentation/fetch_remote_images">{t("settings.integrations.blogger.cloudinaryFetch")} <ExternalLink size={9} /></ResourceExternalAnchor>
        <ResourceExternalAnchor href="https://developers.google.com/workspace/drive/api/guides/api-specific-auth">{t("settings.integrations.blogger.driveScopes")} <ExternalLink size={9} /></ResourceExternalAnchor>
      </div>
    </IntegGuide>

    <IntegGuide title={t("settings.integrations.blogger.driveScopesGuideTitle")}>
      <div className="koma-ig-alert koma-ig-alert--info">
        <Info size={11} className="koma-ig-alert__icon" />
        <div>
          <p>{t("settings.integrations.blogger.minimumPractical")} <code>https://www.googleapis.com/auth/drive</code></p>
          <p>{t("settings.integrations.blogger.driveScopesNote")}</p>
        </div>
      </div>
    </IntegGuide>
  </section>

  {/* ═══════════════════ IMGUR UPLOAD ═══════════════════ */}
  <section className="koma-integ-card">
    <div className="koma-integ-card__head">
      <span className="koma-integ-card__icon koma-integ-card__icon--imgur" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3.5c-4.971 0-9 3.019-9 6.75 0 2.297 1.55 4.327 3.916 5.55-.086.711-.376 1.566-1.058 2.46-.18.235-.204.557-.06.815a.79.79 0 00.731.402c1.461-.074 2.959-.657 4.138-1.596.439.042.884.064 1.333.064 4.971 0 9-3.019 9-6.75s-4.029-6.75-9-6.75z" /></svg>
      </span>
      <div className="koma-integ-card__title-group">
        <h3 className="koma-integ-card__title">
          {t("settings.integrations.imgur.title")}
          <span className={`koma-integ-status${imgurConfig.keys.some((k) => k.enabled && k.clientId.trim()) ? " koma-integ-status--on" : " koma-integ-status--off"}`} />
        </h3>
        <p className="koma-integ-card__desc">{t("settings.integrations.imgur.description")}</p>
      </div>
    </div>

    <div className="koma-integ-body">
      {/* Rate limit config */}
      <div className="koma-ig-quota-grid">
        <div className="koma-ig-quota-cell">
          <span className="koma-ig-quota-cell__label">{t("settings.integrations.imgur.limitPerHour")}</span>
          <input type="number" className="koma-ig-field__input" value={imgurConfig.rateLimitPerHour} onChange={(e) => updateImgurConfig("rateLimitPerHour", Number(e.target.value))} min={1} max={500} style={{ height: 26, fontSize: 11 }} />
        </div>
        <div className="koma-ig-quota-cell">
          <span className="koma-ig-quota-cell__label">{t("settings.integrations.imgur.batchDelay")}</span>
          <input type="number" className="koma-ig-field__input" value={imgurConfig.batchDelayMs} onChange={(e) => updateImgurConfig("batchDelayMs", Number(e.target.value))} min={0} max={30000} step={100} style={{ height: 26, fontSize: 11 }} />
        </div>
        <div className="koma-ig-quota-cell">
          <span className="koma-ig-quota-cell__label">{t("settings.integrations.imgur.remaining")}</span>
          <span className="koma-ig-quota-cell__value">{imgurRateLimit.remainingThisHour}</span>
        </div>
      </div>

      <div className="koma-ig-alert koma-ig-alert--info">
        <Info size={11} className="koma-ig-alert__icon" />
        <span>
          {t("settings.integrations.imgur.used", { used: imgurRateLimit.usedThisHour, limit: imgurRateLimit.limitPerHour })}
          {imgurRateLimit.resetsAt ? ` · ${t("settings.integrations.imgur.reset", { value: fmtDate(imgurRateLimit.resetsAt) })}` : ""}
        </span>
      </div>

      {/* Keys header */}
      <div className="koma-ig-field__row" style={{ justifyContent: "space-between" }}>
        <span className="koma-ig-field__label" style={{ margin: 0 }}>{t("settings.integrations.imgur.clientIds")}</span>
        <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" onClick={addImgurKey}>
          <Plus size={10} /> {t("common.add")}
        </button>
      </div>

      {/* Keys */}
      {imgurConfig.keys.length === 0 ? (
        <div className="koma-ig-alert koma-ig-alert--info">
          <Info size={11} className="koma-ig-alert__icon" />
          <span>{t("settings.integrations.imgur.noClientIds")}</span>
        </div>
      ) : (
        <div className="koma-ig-key-list">
          {imgurConfig.keys.map((key) => (
            <div key={key.id} className="koma-ig-key-card">
              <div className="koma-ig-key-card__fields">
                <input type="text" className="koma-ig-field__input" value={key.label} onChange={(e) => updateImgurKey(key.id, "label", e.target.value)} placeholder={t("common.label")} />
                <input type="text" className="koma-ig-field__input" value={key.clientId} onChange={(e) => updateImgurKey(key.id, "clientId", e.target.value)} placeholder={t("settings.integrations.imgur.clientIdPlaceholder")} />
              </div>
              <div className="koma-ig-key-card__right">
                <div className={cn("koma-ig-toggle", key.enabled && "koma-ig-toggle--on")}>
                  <input type="checkbox" className="koma-ig-toggle__input" checked={key.enabled} onChange={(e) => updateImgurKey(key.id, "enabled", e.target.checked)} />
                  <span className="koma-ig-toggle__track"><span className="koma-ig-toggle__thumb" /></span>
                </div>
                <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" onClick={() => removeImgurKey(key.id)} style={{ color: "rgba(244, 63, 94, 0.7)" }}>
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="koma-ig-footer">
        <div className="koma-ig-footer__info">
          <span className="koma-ig-footer__label">{t("common.persistence")}</span>
          <span className="koma-ig-footer__value">{imgurSecureStorage ? t("common.secureStore") : t("common.browserFallback")}</span>
        </div>
        <button type="button" className="koma-btn koma-btn--primary koma-btn--sm" onClick={() => void handleSaveImgurConfig()}>
          {imgurSaved ? t("settings.integrations.saved") : t("common.save")}
        </button>
      </div>
    </div>

    {imgurFeedback && (
      <div className={`koma-ig-alert${imgurFeedback.type === "error" ? " koma-ig-alert--error" : " koma-ig-alert--success"}`} role={imgurFeedback.type === "error" ? "alert" : "status"}>
        {imgurFeedback.type === "error" ? <AlertTriangle size={11} className="koma-ig-alert__icon" /> : <CheckCircle2 size={11} className="koma-ig-alert__icon" />}
        <span>{imgurFeedback.message}</span>
      </div>
    )}

    {/* Guide */}
    <IntegGuide title={t("settings.integrations.imgur.quickGuideTitle")}>
      <ol className="koma-ig-guide__steps">
        <li>{t("settings.integrations.imgur.step1")} <strong>{t("settings.integrations.imgur.term.clientId")}</strong>.</li>
        <li>{t("settings.integrations.imgur.step2")}</li>
        <li>{t("settings.integrations.imgur.step3")} <code>{t("settings.integrations.imgur.authorizationHeaderExample")}</code>. {t("settings.integrations.imgur.step3Suffix")}</li>
        <li>{t("settings.integrations.imgur.step4")} <strong>{t("settings.integrations.imgur.term.rateLimit")}</strong> {t("settings.integrations.imgur.step4Suffix")}</li>
        <li>{t("settings.integrations.imgur.step5")}</li>
        <li>{t("settings.integrations.imgur.step6")}</li>
      </ol>
      <div className="koma-ig-guide__links">
        <ResourceExternalAnchor href="https://api.imgur.com/endpoints/image">{t("settings.integrations.imgur.imageApi")} <ExternalLink size={9} /></ResourceExternalAnchor>
        <ResourceExternalAnchor href="https://help.imgur.com/hc/en-us/articles/210076663-Uploading-Content">{t("settings.integrations.imgur.uploading")} <ExternalLink size={9} /></ResourceExternalAnchor>
      </div>
    </IntegGuide>
  </section>
</div>
);
