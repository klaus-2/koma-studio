import { describe, expect, it } from 'vitest';

import { buildWatermarkTextLayerFont } from './watermarkRenderer';

describe('buildWatermarkTextLayerFont', () => {
  it('quotes a plain family under the layer weight, with no fallback stack', () => {
    expect(buildWatermarkTextLayerFont(40, 'Arial')).toBe('700 40px "Arial"');
    expect(buildWatermarkTextLayerFont(40, 'Cabin')).toBe('700 40px "Cabin"');
  });

  it('keeps the first family instead of quoting a whole fallback stack as one name', () => {
    expect(buildWatermarkTextLayerFont(28, 'Foo, monospace')).toBe('700 28px "Foo"');
  });

  it('escapes an embedded quote so it cannot close the quoted token', () => {
    expect(buildWatermarkTextLayerFont(24, 'Impact" ; color:red')).toBe('700 24px "Impact\\" ; color:red"');
  });

  it('defaults an empty family to Arial instead of an unresolvable font', () => {
    expect(buildWatermarkTextLayerFont(40, '')).toBe('700 40px "Arial"');
    expect(buildWatermarkTextLayerFont(40, '   ')).toBe('700 40px "Arial"');
  });

  it('unwraps a family stored with its own quotes', () => {
    expect(buildWatermarkTextLayerFont(32, '"Cabin"')).toBe('700 32px "Cabin"');
  });
});
