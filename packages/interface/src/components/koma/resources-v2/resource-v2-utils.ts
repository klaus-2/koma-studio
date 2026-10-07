import type { ResourceLink } from '@/data/guides-types';

export const RESOURCE_EASE = [
  0.22,
  1,
  0.36,
  1,
] as const;

export function normalizeResourceSearch(
  value: string,
): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .trim();
}

export function matchesResourceSearch(
  query: string,
  values: Array<
    string | null | undefined
  >,
): boolean {
  const normalizedQuery =
    normalizeResourceSearch(query);

  if (!normalizedQuery) return true;

  return values.some((value) =>
    normalizeResourceSearch(
      value ?? '',
    ).includes(normalizedQuery),
  );
}

export function deduplicateResourceLinks(
  links: ResourceLink[],
): ResourceLink[] {
  const seen = new Set<string>();

  return links.filter((link) => {
    const normalizedUrl =
      link.url?.trim();

    if (!normalizedUrl) return false;

    const key = `${link.kind ?? 'site'}:${link.label}:${normalizedUrl}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export async function copyResourceText(
  value: string,
): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(
      value,
    );

    return;
  }

  const textarea =
    document.createElement('textarea');

  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.inset = '0 auto auto 0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function resourceSlug(
  value: string,
): string {
  return normalizeResourceSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
