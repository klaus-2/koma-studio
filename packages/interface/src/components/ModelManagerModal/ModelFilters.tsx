import type { ModelFilterState } from '../../models/types';
import { useI18n } from '../../i18n';
import styles from './styles.module.css';

interface ModelFiltersProps {
  filters: ModelFilterState;
  languages: string[];
  allowCloud?: boolean;
  hideSourceToggle?: boolean;
  hideLanguageFilter?: boolean;
  hideStatusFilter?: boolean;
  onSourceChange: (source: ModelFilterState['source']) => void;
  onLanguageChange: (language: string) => void;
  onStatusChange: (status: ModelFilterState['status']) => void;
}

export const ModelFilters = ({
  filters,
  languages,
  allowCloud = true,
  hideSourceToggle = false,
  hideLanguageFilter = false,
  hideStatusFilter = false,
  onSourceChange,
  onLanguageChange,
  onStatusChange,
}: ModelFiltersProps) => {
  const { t } = useI18n();
  return (
    <div className={styles.filtersRow}>
    {/* Source segmented control */}
    {allowCloud && !hideSourceToggle && (
      <div className={styles.sourceToggle} role="tablist" aria-label={t("modelManager.filters.catalog")}>
        {(['all', 'local', 'cloud'] as const).map((src) => {
          const label =
            src === 'all' ? t("modelManager.filters.all") : src === 'local' ? t("modelManager.filters.local") : t("modelManager.filters.cloud");
          const isActive = filters.source === src;
          return (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={
                isActive ? styles.sourceToggleBtnActive : styles.sourceToggleBtn
              }
              onClick={() => onSourceChange(src)}
            >
              {label}
            </button>
          );
        })}
      </div>
    )}

    {!hideLanguageFilter && <label className={styles.filterField}>
      <span>{t("modelManager.filters.language")}</span>
      <select
        value={filters.language}
        onChange={(e) => onLanguageChange(e.target.value)}
      >
        <option value="all">{t("modelManager.filters.all")}</option>
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang.toUpperCase()}
          </option>
        ))}
      </select>
    </label>}

    {!hideStatusFilter && <label className={styles.filterField}>
      <span>{t("modelManager.filters.status")}</span>
      <select
        value={filters.status}
        onChange={(e) =>
          onStatusChange(e.target.value as ModelFilterState['status'])
        }
      >
        <option value="all">{t("modelManager.filters.all")}</option>
        <option value="installed">{t("modelManager.filters.installed")}</option>
        <option value="not_installed">{t("modelManager.filters.notInstalled")}</option>
        <option value="update_available">{t("modelManager.filters.updateAvailable")}</option>
      </select>
    </label>}
  </div>
  );
};

export default ModelFilters;
