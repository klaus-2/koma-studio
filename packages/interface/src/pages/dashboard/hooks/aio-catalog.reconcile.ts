import {
  AIO_STAGE_KEYS,
  isStageOptionSelectable,
} from '@/models/aioStageCatalog';
import type {
  AioStageOption,
  AioStageOptionMap,
  LocalModelEntries,
} from '@/models/aioStageCatalog';
import type { AioStageKey } from '@/types/aioModelPresets';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function equalCatalogData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) return false;

    return left.every((value: unknown, index: number) =>
      equalCatalogData(value, right[index]),
    );
  }

  if (!isRecord(left) || !isRecord(right)) return false;

  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;

  return keys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      equalCatalogData(left[key], right[key]),
  );
}

export function reconcileCatalog(
  previous: AioStageOptionMap,
  incoming: AioStageOptionMap,
): AioStageOptionMap {
  const next: AioStageOptionMap = { ...previous };
  let changed = false;

  for (const stage of AIO_STAGE_KEYS) {
    const previousOptions = previous[stage];
    const previousByKey = new Map(
      previousOptions.map((option) => [option.key, option]),
    );

    const options = incoming[stage].map((option) => {
      const existing = previousByKey.get(option.key);
      return existing && equalCatalogData(existing, option)
        ? existing
        : option;
    });

    const sameList =
      previousOptions.length === options.length &&
      previousOptions.every((option, index) => option === options[index]);

    if (!sameList) {
      next[stage] = options;
      changed = true;
    }
  }

  return changed ? next : previous;
}

export function reconcileStageSelection(
  selectedKey: string,
  options: readonly AioStageOption[],
  entries: LocalModelEntries,
): string {

  if (options.some((option) => option.key === selectedKey)) {
    return selectedKey;
  }

  return (
    options.find((option) => isStageOptionSelectable(option, entries))?.key ??
    options.find((option) => option.implemented)?.key ??
    options[0]?.key ??
    ''
  );
}

export function reconcileSelections(
  previous: Record<AioStageKey, string>,
  options: AioStageOptionMap,
  entries: LocalModelEntries,
): Record<AioStageKey, string> {
  const next = { ...previous };
  let changed = false;

  for (const stage of AIO_STAGE_KEYS) {
    const key = reconcileStageSelection(
      previous[stage],
      options[stage],
      entries,
    );
    next[stage] = key;
    changed ||= key !== previous[stage];
  }

  return changed ? next : previous;
}
