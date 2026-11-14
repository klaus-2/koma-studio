import type { AioTextRegion } from '../types/dashboard.types';
import type { RegionLockFields } from '../typography/types';

/** Single source of per-field region-lock semantics (F1). */
export type RegionLockField = 'geometry' | 'text' | 'style';

const REGION_LOCK_FIELDS: readonly RegionLockField[] = [
  'geometry',
  'text',
  'style',
];

export const isRegionFieldLocked = (
  region: { locked?: boolean; lockedFields?: RegionLockFields },
  field: RegionLockField,
): boolean => {
  const { lockedFields } = region;
  if (lockedFields) {
    return lockedFields[field] === true;
  }
  // Legacy `locked: true` without per-field flags locks all three fields.
  return region.locked === true;
};

/**
 * Normalizes the lock flags of a region: a legacy `locked: true` without
 * `lockedFields` materializes as all three fields; an empty/absent set
 * normalizes to `undefined`.
 */
export const normalizeRegionLockFields = (
  region: { locked?: boolean; lockedFields?: RegionLockFields },
): RegionLockFields | undefined => {
  const { lockedFields } = region;
  if (lockedFields) {
    const normalized: RegionLockFields = {};
    for (const field of REGION_LOCK_FIELDS) {
      if (lockedFields[field] === true) {
        normalized[field] = true;
      }
    }
    return REGION_LOCK_FIELDS.some((field) => normalized[field] === true)
      ? normalized
      : undefined;
  }
  return region.locked === true
    ? { geometry: true, text: true, style: true }
    : undefined;
};

/** Toggles one lock field and re-syncs `locked` (true ⇔ all three). */
export const withRegionLockField = (
  region: AioTextRegion,
  field: RegionLockField,
  locked: boolean,
): AioTextRegion => {
  const baseFields: RegionLockFields =
    region.lockedFields ??
    (region.locked === true
      ? { geometry: true, text: true, style: true }
      : {});
  const nextFields: RegionLockFields = { ...baseFields };
  if (locked) {
    nextFields[field] = true;
  } else {
    delete nextFields[field];
  }
  const anyLocked = REGION_LOCK_FIELDS.some(
    (candidate) => nextFields[candidate] === true,
  );
  const allLocked = REGION_LOCK_FIELDS.every(
    (candidate) => nextFields[candidate] === true,
  );
  return {
    ...region,
    lockedFields: anyLocked ? nextFields : undefined,
    locked: allLocked,
  };
};
