const NEEDS_QUOTING = /[",\n\r]/;

const escapeCsvField = (value: string): string => {
  if (!NEEDS_QUOTING.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
};

export const serializeCsvRows = (
  rows: readonly (readonly string[])[],
): string => rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');

export const parseCsvRows = (rawText: string): string[][] => {
  const text = rawText.charCodeAt(0) === 0xfeff ? rawText.slice(1) : rawText;
  if (text.length === 0) {
    return [];
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      fieldStarted = false;
      continue;
    }

    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      fieldStarted = false;
      continue;
    }

    field += ch;
    fieldStarted = true;
  }

  if (field.length > 0 || row.length > 0 || fieldStarted) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};
