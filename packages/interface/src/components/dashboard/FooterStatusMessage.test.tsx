// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FooterStatusMessage } from './FooterStatusMessage';

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const SHORT_MESSAGE = 'Workspace saved.';
const LONG_MESSAGE =
  'AIO finished. 12 text(s) recognized, 12 translation(s) generated, 10 region(s) segmented, 12 image(s) cleaned, 12 block(s) ready to render. 1 warning: page 3 overflowed the bubble.';

describe('FooterStatusMessage', () => {
  it('renders a short message without the details button', () => {
    render(
      <FooterStatusMessage
        message={SHORT_MESSAGE}
        tone="info"
        textClassName="koma-footerbar__msg"
      />,
    );
    expect(screen.getByRole('status').textContent).toBe(SHORT_MESSAGE);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('truncates a long message and opens the full details popout', () => {
    render(
      <FooterStatusMessage
        message={LONG_MESSAGE}
        tone="success"
        textClassName="koma-footerbar__msg"
      />,
    );
    expect(screen.getByRole('status').textContent).not.toBe(LONG_MESSAGE);
    expect(screen.getByRole('status').textContent?.startsWith('AIO finished.')).toBe(
      true,
    );

    fireEvent.click(screen.getByRole('button'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain(LONG_MESSAGE);
  });

  it('announces errors as alerts', () => {
    render(
      <FooterStatusMessage
        message={SHORT_MESSAGE}
        tone="error"
        textClassName="koma-footerbar__msg"
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(SHORT_MESSAGE);
  });
});
