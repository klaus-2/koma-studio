// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '@/i18n';
import RenderTextPreviewContextMenuNoir from './RenderTextPreviewContextMenuNoir';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const preset = {
  id: 'preset-1',
  folderId: null,
  name: 'Bubble Classic',
  description: 'soft',
  style: {},
  defaultShapeKind: 'rounded',
  padding: 10,
  createdAt: 0,
  updatedAt: 0,
} as never;

function Harness({
  targetRegion,
  onToggleRegionLock = vi.fn(),
}: {
  targetRegion?: Record<string, unknown>;
  onToggleRegionLock?: (field: string) => void;
} = {}) {
  const [submenu, setSubmenu] = useState<'presets' | null>(null);
  return (
    <RenderTextPreviewContextMenuNoir
      contextMenu={{ regionId: 'r1', x: 24, y: 24 }}
      targetRegion={(targetRegion ?? { id: 'r1', renderText: 'hello' }) as never}
      editable
      contextSubmenu={submenu}
      presetSearch=""
      presetFolderFilter={null}
      availableTypographyPresets={[preset]}
      availableTypographyFolders={[]}
      filteredTypographyPresets={[preset]}
      groupedTypographyPresets={[[null, [preset]]]}
      typographyFolderNameById={new Map()}
      canApplyPreset
      canConvertShape
      onContextSubmenuChange={setSubmenu}
      onPresetSearchChange={vi.fn()}
      onPresetFolderFilterChange={vi.fn()}
      onCopyRecognized={vi.fn()}
      onCopyTranslated={vi.fn()}
      onEditRendered={vi.fn()}
      onApplyPresetById={vi.fn()}
      onConvertShape={vi.fn()}
      onToggleRegionLock={onToggleRegionLock}
      onRemoveRegion={vi.fn()}
    />
  );
}

describe('noir region context menu', () => {
  it('opens the preset picker outside the clipped menu root', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Harness />
      </I18nProvider>,
    );

    const presetRow = screen.getByRole('menuitem', {
      name: /preset/i,
      hidden: false,
    });
    await user.click(presetRow);

    const presetButton = await screen.findByText('Bubble Classic');
    const picker = presetButton.closest('[role="menu"]');
    expect(picker).not.toBeNull();
    // Portaled to <body>: the clipped menu root is no longer an ancestor.
    expect(picker?.closest('.panel-cut.absolute')).toBeNull();
    expect(picker?.className).toContain('fixed');
  });

  it('lists the three region lock fields and dispatches their toggles', async () => {
    const user = userEvent.setup();
    const onToggleRegionLock = vi.fn();
    render(
      <I18nProvider>
        <Harness
          targetRegion={{ id: 'r1', lockedFields: { text: true } }}
          onToggleRegionLock={onToggleRegionLock}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('menuitem', { name: 'Lock geometry' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Lock text' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Lock style' })).toBeTruthy();

    await user.click(screen.getByRole('menuitem', { name: 'Lock geometry' }));
    expect(onToggleRegionLock).toHaveBeenCalledWith('geometry');
    expect(onToggleRegionLock).toHaveBeenCalledTimes(1);
  });
});
