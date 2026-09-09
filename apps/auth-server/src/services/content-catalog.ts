import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import guidesSeedJson from "../content-seeds/guides.seed.json" with { type: "json" };
import resourcesSeedJson from "../content-seeds/resources.seed.json" with { type: "json" };
import { db } from "../db/client.js";
import {
  guideCategory,
  guideEntry,
  resourceCategory,
  resourceEntry,
  type SerializableGuideSection,
  type SerializableResourcePayload,
} from "../db/schema.js";
import { tServer } from "./server-i18n.js";
import { logger } from "../utils/logger.js";

type ContentStatus = "draft" | "published";
type TranslationVars = Record<string, string | number | null | undefined>;

const CONTENT_CATALOG_LOCALE = "en" as const;

interface GuideSeedCategory {
  id: string;
  label: string;
  description: string;
  accentColor: string;
  iconName?: string;
  status: ContentStatus;
  sortOrder: number;
}

interface GuideSeedEntry {
  id: string;
  categoryId: string;
  title: string;
  subtitle: string;
  accentColor: string;
  difficulty: string;
  estimatedTime: string;
  tags: string[];
  iconName?: string;
  status: ContentStatus;
  sortOrder: number;
  sections: SerializableGuideSection[];
}

interface ResourceSeedCategory {
  id: string;
  label: string;
  description: string;
  accentColor: string;
  iconName?: string;
  itemCount: number;
  status: ContentStatus;
  sortOrder: number;
}

interface ResourceSeedEntry {
  id: string;
  categoryId: string;
  title: string;
  subtitle: string | null;
  tags: string[];
  iconName?: string | null;
  status: ContentStatus;
  sortOrder: number;
  payload: SerializableResourcePayload;
}

const guideSeed = guidesSeedJson as {
  categories: GuideSeedCategory[];
  entries: GuideSeedEntry[];
};

const resourceSeed = resourcesSeedJson as {
  categories: ResourceSeedCategory[];
  entries: ResourceSeedEntry[];
};

const tContent = (key: string, vars?: TranslationVars): string =>
  tServer(CONTENT_CATALOG_LOCALE, key, vars);

const getContentFieldLabel = (fieldKey: string): string => {
  const key = `contentCatalog.field.${fieldKey}`;
  const label = tContent(key);
  return label === key ? fieldKey : label;
};

const CONTENT_STATUSES = new Set<ContentStatus>(["draft", "published"]);

const GUIDE_DIFFICULTIES = new Set(["beginner", "intermediate", "advanced"]);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const sanitizeText = (value: unknown, maxLength: number, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new Error(tContent("contentCatalog.error.invalidField", { fieldName }));
  }

  const normalized = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  if (!normalized) {
    throw new Error(tContent("contentCatalog.error.requiredField", { fieldName }));
  }
  return normalized;
};

const sanitizeOptionalText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  return normalized || null;
};

const parseStatus = (value: unknown, fallback: ContentStatus): ContentStatus => {
  if (typeof value !== "string") {
    return fallback;
  }

  return CONTENT_STATUSES.has(value as ContentStatus) ? (value as ContentStatus) : fallback;
};

const parseSortOrder = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;

const parseStringArray = (value: unknown, maxItems: number, maxLength: number): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim().slice(0, maxLength) : ""))
        .filter(Boolean),
    ),
  ).slice(0, maxItems);
};

const parseGuideSections = (value: unknown): SerializableGuideSection[] => {
  if (!Array.isArray(value)) {
    throw new Error(tContent("contentCatalog.error.invalidSections"));
  }

  return value.map((section, index) => {
    const payload = asRecord(section);
    if (!payload) {
      throw new Error(tContent("contentCatalog.error.invalidSectionItem", { index }));
    }

    const id = sanitizeText(payload.id ?? `section-${index + 1}`, 120, getContentFieldLabel("sectionId"));
    const title = sanitizeText(payload.title, 160, getContentFieldLabel("sectionTitle"));
    const description = sanitizeOptionalText(payload.description, 500) ?? undefined;
    const steps = Array.isArray(payload.steps) ? payload.steps : [];

    return {
      id,
      title,
      description,
      steps,
    };
  });
};

const parseResourcePayload = (value: unknown): SerializableResourcePayload => {
  const payload = asRecord(value);
  if (!payload) {
    throw new Error(tContent("contentCatalog.error.invalidPayload"));
  }
  return payload;
};

const mapGuideCategory = (row: typeof guideCategory.$inferSelect) => ({
  id: row.id,
  label: row.label,
  description: row.description,
  accentColor: row.accentColor,
  iconName: row.iconName,
  status: row.status,
  sortOrder: row.sortOrder,
});

const mapGuideEntry = (row: typeof guideEntry.$inferSelect) => ({
  id: row.id,
  categoryId: row.categoryId,
  title: row.title,
  subtitle: row.subtitle,
  accentColor: row.accentColor,
  difficulty: row.difficulty,
  estimatedTime: row.estimatedTime,
  tags: row.tags as string[],
  iconName: row.iconName,
  status: row.status,
  sortOrder: row.sortOrder,
  sections: row.sections as SerializableGuideSection[],
});

const mapResourceCategory = (row: typeof resourceCategory.$inferSelect) => ({
  id: row.id,
  label: row.label,
  description: row.description,
  accentColor: row.accentColor,
  iconName: row.iconName,
  itemCount: row.itemCount,
  status: row.status,
  sortOrder: row.sortOrder,
});

const mapResourceEntry = (row: typeof resourceEntry.$inferSelect) => ({
  id: row.id,
  categoryId: row.categoryId,
  title: row.title,
  subtitle: row.subtitle,
  tags: row.tags as string[],
  iconName: row.iconName,
  status: row.status,
  sortOrder: row.sortOrder,
  payload: row.payload as SerializableResourcePayload,
});

const getNextSortOrder = async (
  tableName: "guideCategory" | "guideEntry" | "resourceCategory" | "resourceEntry",
  categoryId?: string,
): Promise<number> => {
  if (tableName === "guideCategory") {
    const rows = await db.select({ sortOrder: guideCategory.sortOrder }).from(guideCategory).orderBy(asc(guideCategory.sortOrder));
    return (rows.at(-1)?.sortOrder ?? -1) + 1;
  }

  if (tableName === "resourceCategory") {
    const rows = await db
      .select({ sortOrder: resourceCategory.sortOrder })
      .from(resourceCategory)
      .orderBy(asc(resourceCategory.sortOrder));
    return (rows.at(-1)?.sortOrder ?? -1) + 1;
  }

  if (tableName === "guideEntry") {
    if (!categoryId) {
      return 0;
    }
    const rows = await db
      .select({ sortOrder: guideEntry.sortOrder })
      .from(guideEntry)
      .where(eq(guideEntry.categoryId, categoryId))
      .orderBy(asc(guideEntry.sortOrder));
    return (rows.at(-1)?.sortOrder ?? -1) + 1;
  }

  if (!categoryId) {
    return 0;
  }
  const rows = await db
    .select({ sortOrder: resourceEntry.sortOrder })
    .from(resourceEntry)
    .where(eq(resourceEntry.categoryId, categoryId))
    .orderBy(asc(resourceEntry.sortOrder));
  return (rows.at(-1)?.sortOrder ?? -1) + 1;
};

const refreshResourceCategoryItemCount = async (categoryId: string): Promise<void> => {
  const rows = await db
    .select({ id: resourceEntry.id })
    .from(resourceEntry)
    .where(eq(resourceEntry.categoryId, categoryId));

  await db
    .update(resourceCategory)
    .set({
      itemCount: rows.length,
      updatedAt: new Date(),
    })
    .where(eq(resourceCategory.id, categoryId));
};

export const ensureContentCatalogSeeded = async (): Promise<void> => {
  let existingGuideCategories: { id: string }[];
  try {
    existingGuideCategories = await db.select({ id: guideCategory.id }).from(guideCategory).limit(1);
  } catch (error) {
    throw new Error(
      `DB not ready for seeding (migrations pending?). Original: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (existingGuideCategories.length === 0) {
    const now = new Date();
    await db.insert(guideCategory).values(
      guideSeed.categories.map((category) => ({
        id: category.id,
        label: category.label,
        description: category.description,
        accentColor: category.accentColor,
        iconName: category.iconName ?? "BookOpen",
        status: category.status,
        sortOrder: category.sortOrder,
        createdAt: now,
        updatedAt: now,
      })),
    );

    await db.insert(guideEntry).values(
      guideSeed.entries.map((entry) => ({
        id: entry.id,
        categoryId: entry.categoryId,
        title: entry.title,
        subtitle: entry.subtitle,
        accentColor: entry.accentColor,
        difficulty: entry.difficulty,
        estimatedTime: entry.estimatedTime,
        tags: entry.tags,
        iconName: entry.iconName ?? "BookOpen",
        status: entry.status,
        sortOrder: entry.sortOrder,
        sections: entry.sections,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  const existingResourceCategories = await db.select({ id: resourceCategory.id }).from(resourceCategory).limit(1);
  if (existingResourceCategories.length === 0) {
    const now = new Date();
    await db.insert(resourceCategory).values(
      resourceSeed.categories.map((category) => ({
        id: category.id,
        label: category.label,
        description: category.description,
        accentColor: category.accentColor,
        iconName: category.iconName ?? "BookOpen",
        itemCount: category.itemCount,
        status: category.status,
        sortOrder: category.sortOrder,
        createdAt: now,
        updatedAt: now,
      })),
    );

    await db.insert(resourceEntry).values(
      resourceSeed.entries.map((entry) => ({
        id: entry.id,
        categoryId: entry.categoryId,
        title: entry.title,
        subtitle: entry.subtitle,
        tags: entry.tags,
        iconName: entry.iconName ?? null,
        status: entry.status,
        sortOrder: entry.sortOrder,
        payload: entry.payload,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
};

export const getPublishedGuideCatalog = async (): Promise<{
  categories: ReturnType<typeof mapGuideCategory>[];
  entries: ReturnType<typeof mapGuideEntry>[];
}> => {
  try {
    const [categories, entries] = await Promise.all([
      db
        .select()
        .from(guideCategory)
        .where(eq(guideCategory.status, "published"))
        .orderBy(asc(guideCategory.sortOrder), asc(guideCategory.label)),
      db
        .select()
        .from(guideEntry)
        .where(eq(guideEntry.status, "published"))
        .orderBy(asc(guideEntry.sortOrder), asc(guideEntry.title)),
    ]);

    return {
      categories: categories.map(mapGuideCategory),
      entries: entries.map(mapGuideEntry),
    };
  } catch (error) {
    logger.warn("Failed to fetch published guide catalog", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { categories: [], entries: [] };
  }
};

export const getPublishedResourceCatalog = async (): Promise<{
  categories: ReturnType<typeof mapResourceCategory>[];
  entries: ReturnType<typeof mapResourceEntry>[];
}> => {
  try {
    const [categories, entries] = await Promise.all([
      db
        .select()
        .from(resourceCategory)
        .where(eq(resourceCategory.status, "published"))
        .orderBy(asc(resourceCategory.sortOrder), asc(resourceCategory.label)),
      db
        .select()
        .from(resourceEntry)
        .where(eq(resourceEntry.status, "published"))
        .orderBy(asc(resourceEntry.sortOrder), asc(resourceEntry.title)),
    ]);

    return {
      categories: categories.map(mapResourceCategory),
      entries: entries.map(mapResourceEntry),
    };
  } catch (error) {
    logger.warn("Failed to fetch published resource catalog", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { categories: [], entries: [] };
  }
};

export const getAdminGuideCatalog = async () => {
  const [categories, entries] = await Promise.all([
    db.select().from(guideCategory).orderBy(asc(guideCategory.sortOrder), asc(guideCategory.label)),
    db.select().from(guideEntry).orderBy(asc(guideEntry.sortOrder), asc(guideEntry.title)),
  ]);

  return {
    categories: categories.map(mapGuideCategory),
    entries: entries.map(mapGuideEntry),
  };
};

export const getAdminResourceCatalog = async () => {
  const [categories, entries] = await Promise.all([
    db.select().from(resourceCategory).orderBy(asc(resourceCategory.sortOrder), asc(resourceCategory.label)),
    db.select().from(resourceEntry).orderBy(asc(resourceEntry.sortOrder), asc(resourceEntry.title)),
  ]);

  return {
    categories: categories.map(mapResourceCategory),
    entries: entries.map(mapResourceEntry),
  };
};

export const createGuideCategory = async (body: unknown) => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tContent("contentCatalog.error.invalidGuideCategory"));
  }

  const id = sanitizeText(payload.id ?? randomUUID(), 120, "id");
  const now = new Date();
  const [created] = await db
    .insert(guideCategory)
    .values({
      id,
      label: sanitizeText(payload.label, 160, getContentFieldLabel("label")),
      description: sanitizeText(payload.description, 500, getContentFieldLabel("description")),
      accentColor: sanitizeText(payload.accentColor ?? "purple", 40, getContentFieldLabel("accentColor")),
      iconName: sanitizeText(payload.iconName ?? "BookOpen", 80, getContentFieldLabel("iconName")),
      status: parseStatus(payload.status, "draft"),
      sortOrder: parseSortOrder(payload.sortOrder, await getNextSortOrder("guideCategory")),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error(tContent("contentCatalog.error.failedToCreateGuideCategory"));
  }

  return mapGuideCategory(created);
};

export const updateGuideCategory = async (categoryId: string, body: unknown) => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tContent("contentCatalog.error.invalidGuideCategory"));
  }

  const [updated] = await db
    .update(guideCategory)
    .set({
      label:
        payload.label !== undefined ? sanitizeText(payload.label, 160, getContentFieldLabel("label")) : undefined,
      description:
        payload.description !== undefined
          ? sanitizeText(payload.description, 500, getContentFieldLabel("description"))
          : undefined,
      accentColor:
        payload.accentColor !== undefined
          ? sanitizeText(payload.accentColor, 40, getContentFieldLabel("accentColor"))
          : undefined,
      iconName:
        payload.iconName !== undefined
          ? sanitizeText(payload.iconName, 80, getContentFieldLabel("iconName"))
          : undefined,
      status: payload.status !== undefined ? parseStatus(payload.status, "draft") : undefined,
      sortOrder: payload.sortOrder !== undefined ? parseSortOrder(payload.sortOrder) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(guideCategory.id, categoryId))
    .returning();

  if (!updated) {
    throw new Error(tContent("contentCatalog.error.guideCategoryNotFound"));
  }

  return mapGuideCategory(updated);
};

export const deleteGuideCategory = async (categoryId: string): Promise<void> => {
  await db.delete(guideCategory).where(eq(guideCategory.id, categoryId));
};

export const createGuideEntry = async (body: unknown) => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tContent("contentCatalog.error.invalidGuide"));
  }

  const categoryId = sanitizeText(payload.categoryId, 120, getContentFieldLabel("categoryId"));
  const [category] = await db.select({ id: guideCategory.id }).from(guideCategory).where(eq(guideCategory.id, categoryId)).limit(1);
  if (!category) {
    throw new Error(tContent("contentCatalog.error.guideCategoryNotFound"));
  }

  const difficulty = sanitizeText(
    payload.difficulty ?? "beginner",
    40,
    getContentFieldLabel("difficulty"),
  );
  if (!GUIDE_DIFFICULTIES.has(difficulty)) {
    throw new Error(
      tContent("contentCatalog.error.invalidDifficulty", { fieldName: getContentFieldLabel("difficulty") }),
    );
  }

  const now = new Date();
  const [created] = await db
    .insert(guideEntry)
    .values({
      id: sanitizeText(payload.id ?? randomUUID(), 120, "id"),
      categoryId,
      title: sanitizeText(payload.title, 160, getContentFieldLabel("title")),
      subtitle: sanitizeText(payload.subtitle, 500, getContentFieldLabel("subtitle")),
      accentColor: sanitizeText(payload.accentColor ?? "purple", 40, getContentFieldLabel("accentColor")),
      difficulty,
      estimatedTime: sanitizeText(payload.estimatedTime ?? "5 min", 80, getContentFieldLabel("estimatedTime")),
      tags: parseStringArray(payload.tags, 24, 60),
      iconName: sanitizeText(payload.iconName ?? "BookOpen", 80, getContentFieldLabel("iconName")),
      status: parseStatus(payload.status, "draft"),
      sortOrder: parseSortOrder(payload.sortOrder, await getNextSortOrder("guideEntry", categoryId)),
      sections: parseGuideSections(payload.sections ?? []),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error(tContent("contentCatalog.error.failedToCreateGuide"));
  }

  return mapGuideEntry(created);
};

export const updateGuideEntry = async (entryId: string, body: unknown) => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tContent("contentCatalog.error.invalidGuide"));
  }

  const [current] = await db.select().from(guideEntry).where(eq(guideEntry.id, entryId)).limit(1);
  if (!current) {
    throw new Error(tContent("contentCatalog.error.guideNotFound"));
  }

  const difficulty =
    payload.difficulty !== undefined
      ? sanitizeText(payload.difficulty, 40, getContentFieldLabel("difficulty"))
      : undefined;
  if (difficulty && !GUIDE_DIFFICULTIES.has(difficulty)) {
    throw new Error(
      tContent("contentCatalog.error.invalidDifficulty", { fieldName: getContentFieldLabel("difficulty") }),
    );
  }

  const nextCategoryId =
    payload.categoryId !== undefined
      ? sanitizeText(payload.categoryId, 120, getContentFieldLabel("categoryId"))
      : current.categoryId;

  const [updated] = await db
    .update(guideEntry)
    .set({
      categoryId: nextCategoryId,
      title:
        payload.title !== undefined ? sanitizeText(payload.title, 160, getContentFieldLabel("title")) : undefined,
      subtitle:
        payload.subtitle !== undefined
          ? sanitizeText(payload.subtitle, 500, getContentFieldLabel("subtitle"))
          : undefined,
      accentColor:
        payload.accentColor !== undefined
          ? sanitizeText(payload.accentColor, 40, getContentFieldLabel("accentColor"))
          : undefined,
      difficulty,
      estimatedTime:
        payload.estimatedTime !== undefined
          ? sanitizeText(payload.estimatedTime, 80, getContentFieldLabel("estimatedTime"))
          : undefined,
      tags: payload.tags !== undefined ? parseStringArray(payload.tags, 24, 60) : undefined,
      iconName:
        payload.iconName !== undefined
          ? sanitizeText(payload.iconName, 80, getContentFieldLabel("iconName"))
          : undefined,
      status: payload.status !== undefined ? parseStatus(payload.status, "draft") : undefined,
      sortOrder: payload.sortOrder !== undefined ? parseSortOrder(payload.sortOrder) : undefined,
      sections: payload.sections !== undefined ? parseGuideSections(payload.sections) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(guideEntry.id, entryId))
    .returning();

  if (!updated) {
    throw new Error(tContent("contentCatalog.error.guideNotFound"));
  }

  return mapGuideEntry(updated);
};

export const deleteGuideEntry = async (entryId: string): Promise<void> => {
  await db.delete(guideEntry).where(eq(guideEntry.id, entryId));
};

export const createResourceCategory = async (body: unknown) => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tContent("contentCatalog.error.invalidResourceCategory"));
  }

  const now = new Date();
  const [created] = await db
    .insert(resourceCategory)
    .values({
      id: sanitizeText(payload.id ?? randomUUID(), 120, "id"),
      label: sanitizeText(payload.label, 160, getContentFieldLabel("label")),
      description: sanitizeText(payload.description, 500, getContentFieldLabel("description")),
      accentColor: sanitizeText(payload.accentColor ?? "purple", 40, getContentFieldLabel("accentColor")),
      iconName: sanitizeText(payload.iconName ?? "BookOpen", 80, getContentFieldLabel("iconName")),
      itemCount: parseSortOrder(payload.itemCount, 0),
      status: parseStatus(payload.status, "draft"),
      sortOrder: parseSortOrder(payload.sortOrder, await getNextSortOrder("resourceCategory")),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error(tContent("contentCatalog.error.failedToCreateResourceCategory"));
  }

  return mapResourceCategory(created);
};

export const updateResourceCategory = async (categoryId: string, body: unknown) => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tContent("contentCatalog.error.invalidResourceCategory"));
  }

  const [updated] = await db
    .update(resourceCategory)
    .set({
      label:
        payload.label !== undefined ? sanitizeText(payload.label, 160, getContentFieldLabel("label")) : undefined,
      description:
        payload.description !== undefined
          ? sanitizeText(payload.description, 500, getContentFieldLabel("description"))
          : undefined,
      accentColor:
        payload.accentColor !== undefined
          ? sanitizeText(payload.accentColor, 40, getContentFieldLabel("accentColor"))
          : undefined,
      iconName:
        payload.iconName !== undefined
          ? sanitizeText(payload.iconName, 80, getContentFieldLabel("iconName"))
          : undefined,
      status: payload.status !== undefined ? parseStatus(payload.status, "draft") : undefined,
      sortOrder: payload.sortOrder !== undefined ? parseSortOrder(payload.sortOrder) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(resourceCategory.id, categoryId))
    .returning();

  if (!updated) {
    throw new Error(tContent("contentCatalog.error.resourceCategoryNotFound"));
  }

  return mapResourceCategory(updated);
};

export const deleteResourceCategory = async (categoryId: string): Promise<void> => {
  await db.delete(resourceCategory).where(eq(resourceCategory.id, categoryId));
};

export const createResourceEntry = async (body: unknown) => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tContent("contentCatalog.error.invalidResource"));
  }

  const categoryId = sanitizeText(payload.categoryId, 120, getContentFieldLabel("categoryId"));
  const [category] = await db
    .select({ id: resourceCategory.id })
    .from(resourceCategory)
    .where(eq(resourceCategory.id, categoryId))
    .limit(1);
  if (!category) {
    throw new Error(tContent("contentCatalog.error.resourceCategoryNotFound"));
  }

  const now = new Date();
  const [created] = await db
    .insert(resourceEntry)
    .values({
      id: sanitizeText(payload.id ?? randomUUID(), 120, "id"),
      categoryId,
      title: sanitizeText(payload.title, 160, getContentFieldLabel("title")),
      subtitle: sanitizeOptionalText(payload.subtitle, 500),
      tags: parseStringArray(payload.tags, 24, 60),
      iconName: sanitizeOptionalText(payload.iconName, 80),
      status: parseStatus(payload.status, "draft"),
      sortOrder: parseSortOrder(payload.sortOrder, await getNextSortOrder("resourceEntry", categoryId)),
      payload: parseResourcePayload(payload.payload ?? {}),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error(tContent("contentCatalog.error.failedToCreateResource"));
  }

  await refreshResourceCategoryItemCount(categoryId);
  return mapResourceEntry(created);
};

export const updateResourceEntry = async (entryId: string, body: unknown) => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tContent("contentCatalog.error.invalidResource"));
  }

  const [current] = await db.select().from(resourceEntry).where(eq(resourceEntry.id, entryId)).limit(1);
  if (!current) {
    throw new Error(tContent("contentCatalog.error.resourceNotFound"));
  }

  const nextCategoryId =
    payload.categoryId !== undefined
      ? sanitizeText(payload.categoryId, 120, getContentFieldLabel("categoryId"))
      : current.categoryId;

  const [updated] = await db
    .update(resourceEntry)
    .set({
      categoryId: nextCategoryId,
      title:
        payload.title !== undefined ? sanitizeText(payload.title, 160, getContentFieldLabel("title")) : undefined,
      subtitle: payload.subtitle !== undefined ? sanitizeOptionalText(payload.subtitle, 500) : undefined,
      tags: payload.tags !== undefined ? parseStringArray(payload.tags, 24, 60) : undefined,
      iconName: payload.iconName !== undefined ? sanitizeOptionalText(payload.iconName, 80) : undefined,
      status: payload.status !== undefined ? parseStatus(payload.status, "draft") : undefined,
      sortOrder: payload.sortOrder !== undefined ? parseSortOrder(payload.sortOrder) : undefined,
      payload: payload.payload !== undefined ? parseResourcePayload(payload.payload) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(resourceEntry.id, entryId))
    .returning();

  if (!updated) {
    throw new Error(tContent("contentCatalog.error.resourceNotFound"));
  }

  await refreshResourceCategoryItemCount(current.categoryId);
  if (current.categoryId !== nextCategoryId) {
    await refreshResourceCategoryItemCount(nextCategoryId);
  }
  return mapResourceEntry(updated);
};

export const deleteResourceEntry = async (entryId: string): Promise<void> => {
  const [current] = await db.select().from(resourceEntry).where(eq(resourceEntry.id, entryId)).limit(1);
  if (!current) {
    return;
  }

  await db.delete(resourceEntry).where(eq(resourceEntry.id, entryId));
  await refreshResourceCategoryItemCount(current.categoryId);
};
