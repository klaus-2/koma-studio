import React, { useId } from 'react';
import { useReducedMotion } from 'framer-motion';

export type DockToolPreviewKind =
  | 'config'
  | 'area-select'
  | 'clear-page'
  | 'segment-brush'
  | 'segment-eraser'
  | 'paint'
  | 'paint-eraser'
  | 'magic-wand'
  | 'healing'
  | 'clear-paint'
  | 'reset-edits';

export interface DockToolAnimatedPreviewProps {
  kind: DockToolPreviewKind;
  variant?: 'noir' | 'classic';
  size?: 'tooltip' | 'card';
  className?: string;
  label?: string;
}

interface Palette {
  frameBg: string;
  panelBg: string;
  panelStroke: string;
  halftoneDot: string;
  speedLine: string;
  bubbleFill: string;
  bubbleStroke: string;
  glyph: string;
  accent: string;
  accentSoft: string;
  secondary: string;
  secondarySoft: string;
  gold: string;
  goldSoft: string;
  mint: string;
  mintSoft: string;
  cursorFill: string;
  cursorStroke: string;
  smudge: string;
  eraseReveal: string;
}

const PALETTES: Record<'noir' | 'classic', Palette> = {
  noir: {
    frameBg: '#09090f',
    panelBg: '#12131f',
    panelStroke: 'rgba(244, 240, 234, 0.22)',
    halftoneDot: 'rgba(244, 240, 234, 0.14)',
    speedLine: 'rgba(244, 240, 234, 0.24)',
    bubbleFill: '#f5f1e8',
    bubbleStroke: '#141522',
    glyph: '#191a29',
    accent: '#ef233c',
    accentSoft: 'rgba(239, 35, 60, 0.26)',
    secondary: '#38bdf8',
    secondarySoft: 'rgba(56, 189, 248, 0.3)',
    gold: '#fbbf24',
    goldSoft: 'rgba(251, 191, 36, 0.24)',
    mint: '#3ef2b0',
    mintSoft: 'rgba(62, 242, 176, 0.25)',
    cursorFill: '#ffffff',
    cursorStroke: '#09090f',
    smudge: '#7c7f94',
    eraseReveal: '#1a1d30',
  },
  classic: {
    frameBg: '#0b0e1c',
    panelBg: '#131932',
    panelStroke: 'rgba(226, 232, 240, 0.22)',
    halftoneDot: 'rgba(203, 213, 225, 0.14)',
    speedLine: 'rgba(196, 181, 253, 0.26)',
    bubbleFill: '#f8fafc',
    bubbleStroke: '#1e1b4b',
    glyph: '#1e293b',
    accent: '#c084fc',
    accentSoft: 'rgba(192, 132, 252, 0.26)',
    secondary: '#22d3ee',
    secondarySoft: 'rgba(34, 211, 238, 0.3)',
    gold: '#fbbf24',
    goldSoft: 'rgba(251, 191, 36, 0.24)',
    mint: '#34d399',
    mintSoft: 'rgba(52, 211, 153, 0.25)',
    cursorFill: '#ffffff',
    cursorStroke: '#0f172a',
    smudge: '#64748b',
    eraseReveal: '#1b2242',
  },
};

const MangaGlyphColumn = ({
  x,
  y,
  color,
  opacity = 1,
}: {
  x: number;
  y: number;
  color: string;
  opacity?: number;
}) => (
  <g stroke={color} strokeWidth={2.2} strokeLinecap="round" opacity={opacity}>
    <line x1={x} y1={y} x2={x + 6} y2={y} />
    <line x1={x + 3} y1={y - 2} x2={x + 3} y2={y + 6} />
    <line x1={x} y1={y + 11} x2={x + 6} y2={y + 11} />
    <line x1={x + 1} y1={y + 16} x2={x + 5} y2={y + 16} />
    <line x1={x} y1={y + 22} x2={x + 6} y2={y + 22} />
    <line x1={x + 3} y1={y + 20} x2={x + 3} y2={y + 26} />
  </g>
);

const BaseMangaScene = ({
  palette,
  dotPatternId,
  speedLines = false,
}: {
  palette: Palette;
  dotPatternId: string;
  speedLines?: boolean;
}) => (
  <g>
    <rect x={8} y={8} width={204} height={100} rx={5} fill={palette.panelBg} stroke={palette.panelStroke} strokeWidth={1.2} />
    <rect x={9} y={9} width={202} height={98} rx={4} fill={`url(#${dotPatternId})`} opacity={0.8} />
    {speedLines ? (
      <g stroke={palette.speedLine} strokeWidth={1.1} strokeLinecap="round">
        <line x1={16} y1={24} x2={82} y2={18} />
        <line x1={18} y1={42} x2={98} y2={34} />
        <line x1={14} y1={60} x2={106} y2={52} />
        <line x1={22} y1={78} x2={94} y2={71} />
        <line x1={16} y1={94} x2={88} y2={88} />
      </g>
    ) : (
      <g opacity={0.55}>
        <path
          d="M 16 104 C 24 72, 46 62, 68 68 C 86 73, 98 84, 108 104 Z"
          fill={palette.eraseReveal}
          stroke={palette.panelStroke}
          strokeWidth={1.1}
        />
        <circle cx={56} cy={46} r={16} fill={palette.eraseReveal} stroke={palette.panelStroke} strokeWidth={1.1} />
      </g>
    )}
  </g>
);

export const DockToolAnimatedPreview: React.FC<DockToolAnimatedPreviewProps> = React.memo(({
  kind,
  variant = 'noir',
  size = 'tooltip',
  className,
  label,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const dotPatternId = `dock-dot-${safeId}`;
  const healClipId = `dock-heal-clip-${safeId}`;
  const wipeClipId = `dock-wipe-clip-${safeId}`;
  const eraseClipId = `dock-erase-clip-${safeId}`;
  const palette = PALETTES[variant];

  return (
    <div
      className={[
        'koma-dock-svg-preview',
        size === 'card' ? 'koma-dock-svg-preview--card' : 'koma-dock-svg-preview--tooltip',
        prefersReducedMotion ? 'koma-dock-svg--paused' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-preview-kind={kind}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
    >
      <svg
        viewBox="0 0 220 116"
        className="koma-dock-svg-preview__svg"
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        <defs>
          <pattern id={dotPatternId} width={8} height={8} patternUnits="userSpaceOnUse">
            <circle cx={2.5} cy={2.5} r={1} fill={palette.halftoneDot} />
          </pattern>
          <clipPath id={healClipId}>
            <rect className="koma-dock-svg-heal-reveal" x={76} y={24} width={92} height={68} rx={4} />
          </clipPath>
          <clipPath id={wipeClipId}>
            <rect className="koma-dock-svg-wipe-reveal" x={18} y={14} width={184} height={88} rx={4} />
          </clipPath>
          <clipPath id={eraseClipId}>
            <rect className="koma-dock-svg-erase-reveal" x={58} y={32} width={104} height={54} rx={4} />
          </clipPath>
        </defs>

        <rect x={0} y={0} width={220} height={116} rx={8} fill={palette.frameBg} />

        {kind === 'config' && (
          <g>
            <BaseMangaScene palette={palette} dotPatternId={dotPatternId} />
            <ellipse cx={148} cy={58} rx={36} ry={34} fill={palette.bubbleFill} stroke={palette.bubbleStroke} strokeWidth={1.4} />
            <MangaGlyphColumn x={145} y={42} color={palette.glyph} opacity={0.35} />
            <circle
              className="koma-dock-svg-reticle"
              cx={148}
              cy={58}
              r={18}
              fill={palette.accentSoft}
              stroke={palette.accent}
              strokeWidth={1.6}
              strokeDasharray="4 3"
            />
            <circle cx={148} cy={58} r={2.2} fill={palette.accent} />
            <g>
              <rect x={16} y={20} width={78} height={76} rx={5} fill={palette.frameBg} stroke={palette.panelStroke} strokeWidth={1} opacity={0.94} />
              <text x={24} y={35} fill={palette.secondary} fontSize={7} fontFamily="monospace" fontWeight={700}>SIZE</text>
              <rect x={24} y={40} width={62} height={4} rx={2} fill={palette.panelStroke} />
              <rect x={24} y={40} width={36} height={4} rx={2} fill={palette.accent} className="koma-dock-svg-slider-a" />
              <circle cx={60} cy={42} r={4.2} fill={palette.cursorFill} stroke={palette.accent} strokeWidth={1.5} className="koma-dock-svg-knob-a" />

              <text x={24} y={62} fill={palette.gold} fontSize={7} fontFamily="monospace" fontWeight={700}>TOL</text>
              <rect x={24} y={67} width={62} height={4} rx={2} fill={palette.panelStroke} />
              <rect x={24} y={67} width={26} height={4} rx={2} fill={palette.gold} className="koma-dock-svg-slider-b" />
              <circle cx={50} cy={69} r={4.2} fill={palette.cursorFill} stroke={palette.gold} strokeWidth={1.5} className="koma-dock-svg-knob-b" />
            </g>
          </g>
        )}

        {kind === 'area-select' && (
          <g>
            <BaseMangaScene palette={palette} dotPatternId={dotPatternId} />
            <ellipse cx={140} cy={58} rx={36} ry={34} fill={palette.bubbleFill} stroke={palette.bubbleStroke} strokeWidth={1.4} />
            <MangaGlyphColumn x={144} y={42} color={palette.glyph} />
            <MangaGlyphColumn x={130} y={46} color={palette.glyph} />
            <rect
              className="koma-dock-svg-marquee"
              x={112}
              y={26}
              width={56}
              height={64}
              rx={3}
              fill={palette.accentSoft}
              stroke={palette.accent}
              strokeWidth={1.8}
              strokeDasharray="5 3"
            />
            <g className="koma-dock-svg-handles" fill={palette.cursorFill} stroke={palette.accent} strokeWidth={1.3}>
              <rect x={109} y={23} width={6} height={6} rx={1} />
              <rect x={165} y={23} width={6} height={6} rx={1} />
              <rect x={109} y={87} width={6} height={6} rx={1} />
              <rect x={165} y={87} width={6} height={6} rx={1} />
            </g>
            <g className="koma-dock-svg-drag-cursor">
              <path d="M 168 88 L 168 74 L 179 84 L 173 85 Z" fill={palette.cursorFill} stroke={palette.cursorStroke} strokeWidth={1.2} />
            </g>
          </g>
        )}

        {kind === 'clear-page' && (
          <g>
            <BaseMangaScene palette={palette} dotPatternId={dotPatternId} />
            <ellipse cx={64} cy={52} rx={26} ry={24} fill={palette.bubbleFill} stroke={palette.bubbleStroke} strokeWidth={1.2} />
            <ellipse cx={154} cy={62} rx={32} ry={28} fill={palette.bubbleFill} stroke={palette.bubbleStroke} strokeWidth={1.2} />
            <g className="koma-dock-svg-clear-boxes">
              <rect x={44} y={32} width={40} height={40} rx={3} fill={palette.accentSoft} stroke={palette.accent} strokeWidth={1.5} strokeDasharray="4 2" />
              <rect x={128} y={38} width={52} height={48} rx={3} fill={palette.accentSoft} stroke={palette.accent} strokeWidth={1.5} strokeDasharray="4 2" />
            </g>
            <g className="koma-dock-svg-sweep-bar">
              <rect x={14} y={12} width={16} height={92} fill={palette.accent} opacity={0.45} />
              <line x1={30} y1={12} x2={30} y2={104} stroke={palette.gold} strokeWidth={2} />
            </g>
          </g>
        )}

        {kind === 'segment-brush' && (
          <g>
            <BaseMangaScene palette={palette} dotPatternId={dotPatternId} />
            <ellipse cx={128} cy={58} rx={44} ry={36} fill={palette.bubbleFill} stroke={palette.bubbleStroke} strokeWidth={1.4} />
            <MangaGlyphColumn x={138} y={40} color={palette.glyph} />
            <MangaGlyphColumn x={118} y={43} color={palette.glyph} />
            <g fill="none" stroke={palette.secondary} strokeLinecap="round" strokeWidth={11} opacity={0.62}>
              <line x1={141} y1={38} x2={141} y2={70} className="koma-dock-svg-draw-line" />
              <line x1={121} y1={41} x2={121} y2={73} className="koma-dock-svg-draw-line-2" />
            </g>
            <circle cx={121} cy={70} r={6} fill={palette.secondarySoft} stroke={palette.secondary} strokeWidth={1.6} className="koma-dock-svg-brush-dot" />
          </g>
        )}

        {kind === 'segment-eraser' && (
          <g>
            <BaseMangaScene palette={palette} dotPatternId={dotPatternId} />
            <ellipse cx={128} cy={58} rx={44} ry={36} fill={palette.bubbleFill} stroke={palette.bubbleStroke} strokeWidth={1.4} />
            <MangaGlyphColumn x={136} y={42} color={palette.glyph} />
            <rect x={131} y={38} width={16} height={34} rx={6} fill={palette.secondary} opacity={0.55} />
            <g clipPath={`url(#${eraseClipId})`}>
              <path
                d="M 74 44 C 92 40, 110 46, 122 52 C 118 68, 92 72, 72 64 Z"
                fill={palette.secondary}
                opacity={0.55}
              />
            </g>
            <g className="koma-dock-svg-eraser-nib">
              <rect x={76} y={47} width={14} height={10} rx={2.5} fill={palette.cursorFill} stroke={palette.accent} strokeWidth={1.5} transform="rotate(-14 83 52)" />
            </g>
          </g>
        )}

        {kind === 'paint' && (
          <g>
            <BaseMangaScene palette={palette} dotPatternId={dotPatternId} />
            <ellipse cx={126} cy={58} rx={46} ry={36} fill={palette.bubbleFill} stroke={palette.bubbleStroke} strokeWidth={1.4} />
            <MangaGlyphColumn x={122} y={42} color={palette.smudge} opacity={0.48} />
            <path
              className="koma-dock-svg-paint-path"
              d="M 118 39 L 130 42 L 116 54 L 132 57 L 118 68 L 130 72"
              fill="none"
              stroke={palette.bubbleFill}
              strokeWidth={13}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={126} cy={66} r={5.5} fill={palette.accentSoft} stroke={palette.accent} strokeWidth={1.6} className="koma-dock-svg-paint-head" />
          </g>
        )}

        {kind === 'paint-eraser' && (
          <g>
            <BaseMangaScene palette={palette} dotPatternId={dotPatternId} speedLines />
            <rect x={68} y={32} width={86} height={52} rx={6} fill={palette.bubbleFill} opacity={0.92} />
            <g clipPath={`url(#${eraseClipId})`}>
              <BaseMangaScene palette={palette} dotPatternId={dotPatternId} speedLines />
            </g>
            <g className="koma-dock-svg-eraser-nib-wide">
              <rect x={140} y={48} width={15} height={18} rx={3} fill={palette.cursorFill} stroke={palette.secondary} strokeWidth={1.6} />
            </g>
          </g>
        )}

        {kind === 'magic-wand' && (
          <g>
            <BaseMangaScene palette={palette} dotPatternId={dotPatternId} speedLines />
            <MangaGlyphColumn x={120} y={40} color={palette.bubbleFill} />
            <MangaGlyphColumn x={136} y={44} color={palette.bubbleFill} />
            <path
              className="koma-dock-svg-wand-ants"
              d="M 112 34 L 150 36 L 149 78 L 111 76 Z"
              fill={palette.goldSoft}
              stroke={palette.gold}
              strokeWidth={1.8}
              strokeDasharray="5 3"
            />
            <circle cx={126} cy={56} r={10} fill="none" stroke={palette.gold} strokeWidth={1.5} className="koma-dock-svg-ripple" />
            <path d="M 156 26 L 158 31 L 163 33 L 158 35 L 156 40 L 154 35 L 149 33 L 154 31 Z" fill={palette.gold} className="koma-dock-svg-sparkle" />
          </g>
        )}

        {kind === 'healing' && (
          <g>
            <BaseMangaScene palette={palette} dotPatternId={dotPatternId} speedLines />
            <path
              d="M 88 46 Q 112 36, 134 49 T 156 56 Q 144 74, 114 70 T 86 58 Z"
              fill={palette.smudge}
              opacity={0.78}
            />
            <g clipPath={`url(#${healClipId})`}>
              <BaseMangaScene palette={palette} dotPatternId={dotPatternId} speedLines />
            </g>
            <g className="koma-dock-svg-heal-cursor">
              <line x1={82} y1={24} x2={82} y2={92} stroke={palette.mint} strokeWidth={1.4} strokeDasharray="3 3" opacity={0.75} />
              <circle cx={82} cy={58} r={9} fill={palette.mintSoft} stroke={palette.mint} strokeWidth={1.8} />
              <path d="M 82 52 L 83.8 56.2 L 88 58 L 83.8 59.8 L 82 64 L 80.2 59.8 L 76 58 L 80.2 56.2 Z" fill={palette.mint} />
            </g>
          </g>
        )}

        {kind === 'clear-paint' && (
          <g>
            <BaseMangaScene palette={palette} dotPatternId={dotPatternId} />
            <ellipse cx={116} cy={58} rx={48} ry={34} fill={palette.bubbleFill} stroke={palette.bubbleStroke} strokeWidth={1.4} />
            <g clipPath={`url(#${wipeClipId})`} stroke={palette.accent} strokeWidth={6} strokeLinecap="round" opacity={0.75}>
              <line x1={88} y1={42} x2={138} y2={48} />
              <line x1={84} y1={60} x2={146} y2={62} />
              <line x1={96} y1={74} x2={136} y2={76} />
            </g>
            <g className="koma-dock-svg-wipe-bar">
              <line x1={18} y1={16} x2={18} y2={100} stroke={palette.gold} strokeWidth={2.2} />
            </g>
          </g>
        )}

        {kind === 'reset-edits' && (
          <g>
            <BaseMangaScene palette={palette} dotPatternId={dotPatternId} />
            <ellipse cx={116} cy={58} rx={46} ry={34} fill={palette.bubbleFill} stroke={palette.bubbleStroke} strokeWidth={1.4} />
            <g className="koma-dock-svg-reset-layer">
              <rect x={88} y={38} width={54} height={40} rx={8} fill={palette.accentSoft} stroke={palette.accent} strokeWidth={1.6} />
              <path d="M 96 58 L 136 58" stroke={palette.accent} strokeWidth={5} strokeLinecap="round" />
            </g>
            <g className="koma-dock-svg-rewind-ring">
              <circle cx={110} cy={58} r={22} fill={palette.frameBg} opacity={0.72} />
              <path
                d="M 124 44 A 20 20 0 1 0 128 66"
                fill="none"
                stroke={palette.secondary}
                strokeWidth={2.8}
                strokeLinecap="round"
              />
              <polygon points="118,38 128,44 119,50" fill={palette.secondary} />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
});

DockToolAnimatedPreview.displayName = 'DockToolAnimatedPreview';

export default DockToolAnimatedPreview;
