import { useCallback, useEffect, useState } from 'react';

import type { useI18n } from '../../../i18n';
import {
  deserializeBloggerLabels,
  loadBloggerConfig,
  saveBloggerConfig,
  serializeBloggerLabels,
  testBloggerConnection,
} from '../../../services/blogger';
import { DEFAULT_BLOGGER_CONFIG, type BloggerConfig } from '../../../types';
import type { BloggerFeedbackState } from '../settings.types';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseSettingsBloggerArgs {
  t: TranslationFn;
}

export const useSettingsBlogger = ({ t }: UseSettingsBloggerArgs) => {
  const [bloggerConfig, setBloggerConfig] = useState<BloggerConfig>(DEFAULT_BLOGGER_CONFIG);
  const [bloggerLabelsInput, setBloggerLabelsInput] = useState("");
  const [bloggerTesting, setBloggerTesting] = useState(false);
  const [bloggerSaved, setBloggerSaved] = useState(false);
  const [bloggerSecureStorage, setBloggerSecureStorage] = useState(false);
  const [bloggerFeedback, setBloggerFeedback] = useState<BloggerFeedbackState>(null);

  useEffect(() => {
    let cancelled = false;

    void loadBloggerConfig()
      .then(({ config, secureStorage }) => {
        if (cancelled) {
          return;
        }
        setBloggerConfig(config);
        setBloggerLabelsInput(serializeBloggerLabels(config.defaultLabels));
        setBloggerSecureStorage(secureStorage);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setBloggerConfig(DEFAULT_BLOGGER_CONFIG);
        setBloggerLabelsInput("");
        setBloggerSecureStorage(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateBloggerConfig = useCallback(<K extends keyof BloggerConfig>(key: K, value: BloggerConfig[K]) => {
    setBloggerConfig((prev) => ({ ...prev, [key]: value }));
    setBloggerSaved(false);
    setBloggerFeedback(null);
  }, []);

  const updateBloggerNestedConfig = useCallback(
    <K extends "optimizer" | "preprocess", F extends keyof BloggerConfig[K]>(
      group: K,
      field: F,
      value: BloggerConfig[K][F],
    ) => {
      setBloggerConfig((prev) => ({
        ...prev,
        [group]: {
          ...prev[group],
          [field]: value,
        },
      }));
      setBloggerSaved(false);
      setBloggerFeedback(null);
    },
    [],
  );

  const buildBloggerDraftConfig = useCallback((): BloggerConfig => ({
    ...bloggerConfig,
    defaultLabels: deserializeBloggerLabels(bloggerLabelsInput),
  }), [bloggerConfig, bloggerLabelsInput]);

  const handleSaveBloggerConfig = useCallback(async () => {
    try {
      const result = await saveBloggerConfig(buildBloggerDraftConfig());
      setBloggerConfig(result.config);
      setBloggerLabelsInput(serializeBloggerLabels(result.config.defaultLabels));
      setBloggerSecureStorage(result.secureStorage);
      setBloggerSaved(true);
      setBloggerFeedback({
        type: "success",
        message: result.secureStorage
          ? t("settings.integrations.blogger.successSecure")
          : t("settings.integrations.blogger.successLocal"),
      });
      setTimeout(() => setBloggerSaved(false), 3000);
    } catch (error) {
      setBloggerSaved(false);
      setBloggerFeedback({
        type: "error",
        message: error instanceof Error ? error.message : t("settings.integrations.blogger.saveError"),
      });
    }
  }, [buildBloggerDraftConfig, t]);

  const handleTestBloggerConnection = useCallback(async () => {
    setBloggerTesting(true);
    setBloggerFeedback(null);

    try {
      const result = await testBloggerConnection(buildBloggerDraftConfig());
      setBloggerFeedback({
        type: "success",
        message: result.message,
      });
    } catch (error) {
      setBloggerFeedback({
        type: "error",
        message: error instanceof Error ? error.message : t("settings.integrations.blogger.testError"),
      });
    } finally {
      setBloggerTesting(false);
    }
  }, [buildBloggerDraftConfig, t]);

  return {
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
  };
};
