import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@koma/ui/components/popover';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/utils';

import './FontFamilySelect.css';

const FONT_LIST_MAX_ROWS = 100;

export interface FontFamilySelectProps {
  value: string;
  onChange: (family: string) => void;
  families: readonly string[];
  ariaLabel: string;
  className?: string;
  defaultOptionLabel?: string;
  disabled?: boolean;
}

interface FontPickerRow {
  family: string;
  label: string;
  note: string | null;
}

interface FontPickerRows {
  rows: FontPickerRow[];
  hiddenFamilyCount: number;
}

export function FontFamilySelect({
  value,
  onChange,
  families,
  ariaLabel,
  className,
  defaultOptionLabel,
  disabled = false,
}: FontFamilySelectProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const storedFamily = value.trim();
  const normalizedStoredFamily = storedFamily.toLowerCase();
  const isStoredFamilyKnown = families.some((family) => family.toLowerCase() === normalizedStoredFamily);

  const { rows, hiddenFamilyCount } = useMemo<FontPickerRows>(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = (label: string): boolean => label.toLowerCase().includes(normalizedQuery);

    const pinnedRows: FontPickerRow[] = [];
    if (defaultOptionLabel && matchesQuery(defaultOptionLabel)) {
      pinnedRows.push({ family: '', label: defaultOptionLabel, note: null });
    }
    if (storedFamily !== '' && !isStoredFamilyKnown && matchesQuery(storedFamily)) {
      pinnedRows.push({ family: storedFamily, label: storedFamily, note: t('fontPicker.freeValue') });
    }

    const matchingFamilies = families.filter(matchesQuery);
    const visibleFamilies = matchingFamilies
      .slice(0, FONT_LIST_MAX_ROWS)
      .map((family) => ({ family, label: family, note: null }));

    return {
      rows: [...pinnedRows, ...visibleFamilies],
      hiddenFamilyCount: Math.max(0, matchingFamilies.length - visibleFamilies.length),
    };
  }, [defaultOptionLabel, families, isStoredFamilyKnown, query, storedFamily, t]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      searchRef.current?.focus();
    }
  }, [isOpen]);

  const commit = useCallback(
    (family: string) => {
      onChange(family);
      setIsOpen(false);
    },
    [onChange],
  );

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setIsOpen(nextOpen);
    if (nextOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, rows.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === 'Enter') {
        const activeRow = rows[activeIndex];
        if (activeRow) {
          event.preventDefault();
          commit(activeRow.family);
        }
      }
    },
    [activeIndex, commit, rows],
  );

  const triggerLabel = storedFamily === '' ? (defaultOptionLabel ?? '') : value;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn('koma-font-select__trigger', className)}
          aria-label={ariaLabel}
          disabled={disabled}
        >
          {triggerLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent className="koma-font-select__content" align="start">
        <div className="koma-font-select__panel">
          <input
            ref={searchRef}
            type="text"
            className="koma-font-select__search"
            placeholder={t('fontPicker.searchPlaceholder')}
            aria-label={t('fontPicker.searchAria')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="koma-font-select__list" role="listbox">
            {rows.map((row, index) => (
              <button
                key={`${row.label}:${row.family}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  'koma-font-select__row',
                  index === activeIndex && 'koma-font-select__row--active',
                )}
                onClick={() => commit(row.family)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="koma-font-select__name">{row.label}</span>
                {row.note && <span className="koma-font-select__note">{row.note}</span>}
              </button>
            ))}
            {rows.length === 0 && (
              <div className="koma-font-select__empty">{t('fontPicker.noMatches')}</div>
            )}
            {hiddenFamilyCount > 0 && (
              <div className="koma-font-select__more">
                {t('fontPicker.moreResults', { count: hiddenFamilyCount })}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
