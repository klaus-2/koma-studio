import { memo } from "react";

import cl1 from "@koma/ui/assets/cl-before.webp";
import cl2 from "@koma/ui/assets/cl-after.webp";
import tl1 from "@koma/ui/assets/tl-before.webp";
import tl2 from "@koma/ui/assets/tl-after.webp";
import rd1 from "@koma/ui/assets/cl-before-2.webp";
import rd2 from "@koma/ui/assets/cl-after-2.webp";
import aio1 from "@koma/ui/assets/aio-before.webp";
import aio2 from "@koma/ui/assets/aio-after.webp";

import { useI18n } from "../../i18n";

export interface CoverConfig {
  id: string;
  badge?: string;
  badgeNew?: boolean;
  title: string;
  subtitle: string;
  beforeImg: string;
  afterImg: string;
}

export function buildAuthCovers(
  t: (key: Parameters<ReturnType<typeof useI18n>["t"]>[0]) => string,
): CoverConfig[] {
  return [
    {
      id: "1",
      badge: t("auth.cover.popular"),
      title: t("auth.cover.cleanRedraw"),
      subtitle: "",
      beforeImg: cl1,
      afterImg: cl2,
    },
    {
      id: "2",
      title: t("auth.cover.translation"),
      subtitle: "",
      beforeImg: tl1,
      afterImg: tl2,
    },
    {
      id: "3",
      badge: t("auth.cover.new"),
      badgeNew: true,
      title: t("auth.cover.typography"),
      subtitle: "",
      beforeImg: cl2,
      afterImg: cl1,
    },
    {
      id: "4",
      title: t("auth.cover.fullEditing"),
      subtitle: t("auth.cover.allInOne"),
      beforeImg: aio1,
      afterImg: aio2,
    },
    {
      id: "5",
      title: t("auth.cover.finalQc"),
      subtitle: "",
      beforeImg: rd1,
      afterImg: rd2,
    },
  ];
}

/** Floating before/after cover cards — shared classic/noir markup. */
export const ManhwaCovers = memo(function ManhwaCovers() {
  const { t } = useI18n();
  const covers = buildAuthCovers(t);

  return (
    <>
      {covers.map((c) => (
        <div
          key={c.id}
          className={`manhwa-float manhwa-float--${c.id}`}
          aria-hidden="true"
        >
          <div className="manhwa-float__preview">
            <img
              className="manhwa-float__img manhwa-float__img--after"
              src={c.afterImg}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <div className="manhwa-float__before-wrap">
              <img
                className="manhwa-float__img manhwa-float__img--before"
                src={c.beforeImg}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </div>
            <div className="manhwa-float__bar">
              <span className="manhwa-float__handle" />
            </div>
          </div>

          <div className="manhwa-float__gradient" />

          {c.badge && (
            <div
              className={`manhwa-float__badge${c.badgeNew ? " manhwa-float__badge--new" : ""}`}
            >
              {c.badge}
            </div>
          )}

          <div className="manhwa-float__bottom">
            <span className="manhwa-float__title">{c.title}</span>
            <span className="manhwa-float__subtitle">{c.subtitle}</span>
          </div>
        </div>
      ))}
    </>
  );
});

const IconAI = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1zm4.5 7l.75 1.75L15 10.5l-1.75.75L12.5 13l-.75-1.75L10 10.5l1.75-.75L12.5 8zM3 10l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
  </svg>
);

const IconTools = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M12.1 3.9a4 4 0 00-5.3.5L4.5 6.7a1 1 0 000 1.4l3.4 3.4a1 1 0 001.4 0l2.3-2.3a4 4 0 00.5-5.3l-1.8 1.8-1.4-1.4 1.8-1.8zM2 13l2.5-2.5 1 1L3 14a.7.7 0 01-1-1z" />
  </svg>
);

const IconBook = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2.5A1.5 1.5 0 013.5 1h4a.5.5 0 01.5.5V6l-1.3-.9a.5.5 0 00-.6 0L5 6V1.5H3.5a.5.5 0 000 1H4v9H3.5A1.5 1.5 0 012 10V2.5zM3.5 12H12v-1H3.5a.5.5 0 000 1zM5 1h7.5A1.5 1.5 0 0114 2.5v8a1.5 1.5 0 01-1.5 1.5H3.5A1.5 1.5 0 012 10.5V12h10V2H5v-.5a.5.5 0 00-.08-.28z" />
  </svg>
);

/** Quote + stats + toolkit + community — shared classic/noir side panel body. */
export const AuthSideContent = memo(function AuthSideContent() {
  const { t } = useI18n();

  return (
    <div className="auth-right-content">
      <blockquote className="auth-quote">
        <span className="auth-quote__mark">&ldquo;</span>
        {t("auth.quote.line1")}
        <br />
        {t("auth.quote.line2")}
        <br />
        {t("auth.quote.line3")}
      </blockquote>

      <div className="auth-stats">
        <div className="auth-stat">
          <span className="auth-stat__number">
            {t("auth.stats.activeScanlatorsValue")}
          </span>
          <span className="auth-stat__label">
            {t("auth.stats.activeScanlators")}
          </span>
        </div>
        <div className="auth-stat__sep" />
        <div className="auth-stat">
          <span className="auth-stat__number">{t("auth.stats.toolsValue")}</span>
          <span className="auth-stat__label">{t("auth.stats.tools")}</span>
        </div>
        <div className="auth-stat__sep" />
        <div className="auth-stat">
          <span className="auth-stat__number">
            {t("auth.stats.pagesProcessedValue")}
          </span>
          <span className="auth-stat__label">
            {t("auth.stats.pagesProcessed")}
          </span>
        </div>
      </div>

      <div className="auth-toolkit">
        <div className="auth-toolkit__group">
          <span className="auth-toolkit__label">
            <IconAI />
            {t("auth.toolkit.ai")}
          </span>
          <div className="auth-toolkit__tags">
            <span className="auth-genre auth-genre--purple">
              {t("auth.toolkit.aiClean")}
            </span>
            <span className="auth-genre auth-genre--purple">
              {t("auth.toolkit.aiTranslation")}
            </span>
            <span className="auth-genre auth-genre--cyan">
              {t("auth.toolkit.autoRedraw")}
            </span>
          </div>
        </div>

        <div className="auth-toolkit__group">
          <span className="auth-toolkit__label">
            <IconTools />
            {t("auth.toolkit.tools")}
          </span>
          <div className="auth-toolkit__tags">
            <span className="auth-genre auth-genre--rose">
              {t("auth.toolkit.advancedEditor")}
            </span>
            <span className="auth-genre auth-genre--rose">
              {t("auth.toolkit.proTypesetting")}
            </span>
            <span className="auth-genre auth-genre--amber">
              {t("auth.toolkit.qualityControl")}
            </span>
          </div>
        </div>

        <div className="auth-toolkit__group">
          <span className="auth-toolkit__label">
            <IconBook />
            {t("auth.toolkit.learning")}
          </span>
          <div className="auth-toolkit__tags">
            <span className="auth-genre auth-genre--emerald">
              {t("auth.toolkit.guides")}
            </span>
            <span className="auth-genre auth-genre--amber">
              {t("auth.toolkit.resources")}
            </span>
          </div>
        </div>
      </div>

      <div className="auth-community">
        <div className="auth-community__avatars">
          <span className="auth-avatar auth-avatar--1" />
          <span className="auth-avatar auth-avatar--2" />
          <span className="auth-avatar auth-avatar--3" />
          <span className="auth-avatar auth-avatar--4" />
          <span className="auth-avatar auth-avatar--join">
            {t("auth.community.joinIndicator")}
          </span>
        </div>
        <p className="auth-community__label">{t("auth.community.join")}</p>
      </div>
    </div>
  );
});
