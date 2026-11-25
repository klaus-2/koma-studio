import { describe, expect, it } from 'vitest';

import { parseCsvRows, serializeCsvRows } from './csvCodec';

describe('csvCodec RFC-4180 roundtrip', () => {
  it('roundtrips commas, embedded quotes, multiline fields and empty cells', () => {
    const rows = [
      ['imageId', 'regionId', 'chapterLabel', 'ocrText', 'translation', 'notes'],
      ['img-1', 'r1', 'Ch. 01', '先輩, 「おはよう」', 'Line 1\nLine 2', ''],
      ['img-2', 'r2', '', 'He said "Run!"', 'Line A\r\nLine B', 'trailing, note'],
    ];

    const csv = serializeCsvRows(rows);
    expect(parseCsvRows(csv)).toEqual(rows);
  });

  it('strips UTF-8 BOM and ignores a single trailing newline at EOF', () => {
    const input = '\uFEFFa,b,c\r\n1,"two, ""three""",\r\n';
    expect(parseCsvRows(input)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'two, "three"', ''],
    ]);
  });

  it('preserves empty quoted single-cell rows and returns empty list on empty string', () => {
    expect(parseCsvRows('')).toEqual([]);
    expect(parseCsvRows('""')).toEqual([['']]);
  });

  it('preserves CWE-1236 apostrophe-prefixed payloads intact at codec level', () => {
    const rows = [
      ['ocrText', 'translation'],
      ["'=1+1", "'-Dash line"],
    ];
    expect(parseCsvRows(serializeCsvRows(rows))).toEqual(rows);
  });
});
