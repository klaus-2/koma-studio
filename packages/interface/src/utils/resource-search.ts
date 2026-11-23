
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
