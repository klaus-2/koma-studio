// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '../../../i18n';
import FooterMemoryMeter, {
  type FooterMemoryMeterData,
} from './FooterMemoryMeter';

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

function renderMeter(data: FooterMemoryMeterData) {
  return render(
    <I18nProvider>
      <FooterMemoryMeter {...data} />
    </I18nProvider>,
  );
}

describe('FooterMemoryMeter', () => {
  it('warns when usage reaches 85%', () => {
    renderMeter({
      ram: { used: 850, total: 1000 },
      vram: { used: 100, total: 1000, free: 900 },
    });

    expect(screen.getByLabelText('Memory near limit')).toBeDefined();
  });

  it('prefers free VRAM for the near-limit calculation', () => {
    renderMeter({
      ram: { used: 100, total: 1000 },
      vram: { used: 100, total: 1000, free: 50 },
    });

    expect(screen.getByLabelText('Memory near limit')).toBeDefined();
  });

  it('stays neutral below the threshold', () => {
    renderMeter({
      ram: { used: 500, total: 1000 },
      vram: { used: 500, total: 1000, free: 500 },
    });

    expect(screen.queryByLabelText('Memory near limit')).toBeNull();
    expect(screen.getAllByText('500 MB')).toHaveLength(2);
  });

  it('renders nothing when no stats are available', () => {
    const { container } = renderMeter({ ram: null, vram: null });

    expect(container.innerHTML).toBe('');
  });
});
