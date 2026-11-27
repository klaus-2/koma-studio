(function (global) {
  'use strict';

  const TOOL_KINDS = [
    'healing',
    'magic-wand',
    'segment-brush',
    'segment-eraser',
    'paint',
    'paint-eraser',
    'clear-paint',
    'reset-edits',
    'area-select',
    'config',
    'clear-page',
    'stage-detect',
    'stage-ocr',
    'stage-translate',
    'stage-segment',
    'stage-clean',
    'stage-render',
  ];

  const PALETTES = {
    noir: {
      bg: '#07070D',
      gutter: '#0C0D17',
      panelBg: '#131422',
      panelDark: '#0D0E18',
      panelStroke: 'rgba(242, 237, 227, 0.28)',
      inkLine: 'rgba(242, 237, 227, 0.22)',
      halftone: 'rgba(242, 237, 227, 0.16)',
      speedline: 'rgba(242, 237, 227, 0.28)',
      charFill: '#1B1D30',
      charShade: '#0E101D',
      bubbleFill: '#F5F0E6',
      bubbleStroke: '#151624',
      glyph: '#171826',
      glyphMuted: '#8B8D9E',
      accent: '#FF2E63',
      accentSoft: 'rgba(255, 46, 99, 0.22)',
      secondary: '#4DC9FF',
      secondarySoft: 'rgba(77, 201, 255, 0.26)',
      gold: '#FFC857',
      goldSoft: 'rgba(255, 200, 87, 0.22)',
      mint: '#3EF2B0',
      mintSoft: 'rgba(62, 242, 176, 0.24)',
      hudBg: 'rgba(10, 10, 18, 0.94)',
      hudText: '#F2EDE3',
      hudMuted: 'rgba(242, 237, 227, 0.52)',
      smudge: '#76798E',
      radius: 0,
    },
    classic: {
      bg: '#080B18',
      gutter: '#0D1226',
      panelBg: '#141A33',
      panelDark: '#0E1328',
      panelStroke: 'rgba(226, 232, 240, 0.26)',
      inkLine: 'rgba(203, 213, 225, 0.24)',
      halftone: 'rgba(196, 181, 253, 0.17)',
      speedline: 'rgba(168, 85, 247, 0.30)',
      charFill: '#1D2446',
      charShade: '#111630',
      bubbleFill: '#F8FAFC',
      bubbleStroke: '#1E1B4B',
      glyph: '#1E293B',
      glyphMuted: '#7E8BA3',
      accent: '#A855F7',
      accentSoft: 'rgba(168, 85, 247, 0.24)',
      secondary: '#06B6D4',
      secondarySoft: 'rgba(6, 182, 212, 0.26)',
      gold: '#F59E0B',
      goldSoft: 'rgba(245, 158, 11, 0.24)',
      mint: '#10B981',
      mintSoft: 'rgba(16, 185, 129, 0.25)',
      hudBg: 'rgba(10, 13, 28, 0.94)',
      hudText: '#F1F5F9',
      hudMuted: 'rgba(186, 199, 247, 0.62)',
      smudge: '#64748B',
      radius: 10,
    },
  };

  function buildDefs(id, pal) {
    return `
      <defs>
        <pattern id="${id}-dots" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.4" fill="${pal.halftone}" />
        </pattern>
        <pattern id="${id}-screentone" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
          <circle cx="2.5" cy="2.5" r="1.5" fill="${pal.halftone}" />
        </pattern>
        <pattern id="${id}-grid" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M 14 0 L 0 0 0 14" fill="none" stroke="${pal.mint}" stroke-width="0.7" opacity="0.35" />
        </pattern>
        <linearGradient id="${id}-beam-accent" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${pal.accent}" stop-opacity="0" />
          <stop offset="75%" stop-color="${pal.accent}" stop-opacity="0.36" />
          <stop offset="100%" stop-color="${pal.gold}" stop-opacity="0.95" />
        </linearGradient>
        <linearGradient id="${id}-beam-cyan" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${pal.secondary}" stop-opacity="0" />
          <stop offset="80%" stop-color="${pal.secondary}" stop-opacity="0.32" />
          <stop offset="100%" stop-color="${pal.secondary}" stop-opacity="0.95" />
        </linearGradient>
        <linearGradient id="${id}-beam-mint" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${pal.mint}" stop-opacity="0" />
          <stop offset="80%" stop-color="${pal.mint}" stop-opacity="0.28" />
          <stop offset="100%" stop-color="${pal.mint}" stop-opacity="0.95" />
        </linearGradient>
        <filter id="${id}-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="${id}-panel-clip">
          <rect x="16" y="16" width="408" height="200" rx="${pal.radius ? 7 : 0}" />
        </clipPath>
        <clipPath id="${id}-heal-reveal">
          <rect class="td-heal-clip" x="150" y="34" width="0" height="164" />
        </clipPath>
        <clipPath id="${id}-erase-reveal">
          <rect class="td-erase-clip" x="112" y="38" width="220" height="156" />
        </clipPath>
        <clipPath id="${id}-paint-erase-reveal">
          <rect class="td-pe-clip" x="110" y="40" width="0" height="152" />
        </clipPath>
        <clipPath id="${id}-wipe-reveal">
          <rect class="td-wipe-clip" x="16" y="16" width="408" height="200" />
        </clipPath>
        <clipPath id="${id}-clean-reveal">
          <rect class="td-clean-clip" x="210" y="30" width="0" height="172" />
        </clipPath>
      </defs>
    `;
  }

  function mangaArtwork(id, pal, opts) {
    const o = opts || {};
    const speed = o.speedLines !== false;
    return `
      <g clip-path="url(#${id}-panel-clip)">
        <rect x="16" y="16" width="408" height="200" fill="${pal.panelBg}" />

        <rect x="16" y="16" width="408" height="128" fill="url(#${id}-screentone)" opacity="0.9" />

        <line x1="158" y1="16" x2="142" y2="216" stroke="${pal.panelStroke}" stroke-width="2" opacity="0.45" />
        ${
          speed
            ? `
              <g stroke="${pal.speedline}" stroke-linecap="round">
                <line x1="16" y1="42" x2="196" y2="26" stroke-width="2.2" />
                <line x1="16" y1="74" x2="246" y2="54" stroke-width="1.6" />
                <line x1="16" y1="108" x2="262" y2="92" stroke-width="2.6" />
                <line x1="16" y1="142" x2="232" y2="128" stroke-width="1.5" />
                <line x1="16" y1="178" x2="210" y2="168" stroke-width="2.0" />
                <line x1="300" y1="24" x2="424" y2="18" stroke-width="1.8" />
                <line x1="316" y1="194" x2="424" y2="184" stroke-width="2.2" />
              </g>
            `
            : ''
        }

        <g opacity="0.92">

          <path d="M 26 216 C 34 166 64 146 106 146 C 142 146 168 164 180 216 Z" fill="${pal.charFill}" stroke="${pal.panelStroke}" stroke-width="1.8" />
          <path d="M 86 148 L 106 184 L 126 148" fill="none" stroke="${pal.panelStroke}" stroke-width="2" />

          <rect x="96" y="128" width="20" height="24" fill="${pal.charShade}" />
          <path d="M 68 96 C 64 62 86 42 114 44 C 142 46 156 68 152 100 C 148 122 132 136 108 136 C 84 136 72 118 68 96 Z" fill="${pal.charFill}" stroke="${pal.panelStroke}" stroke-width="1.8" />

          <path d="M 64 94 L 54 78 L 69 72 L 62 52 L 84 54 L 96 36 L 114 46 L 134 38 L 140 56 L 160 60 L 150 78 L 162 94 L 148 92 L 138 72 L 124 84 L 112 68 L 96 86 L 84 72 L 74 92 Z" fill="${pal.charShade}" stroke="${pal.panelStroke}" stroke-width="1.5" stroke-linejoin="round" />

          <path d="M 118 96 L 136 93 L 133 102 L 119 102 Z" fill="${pal.bubbleFill}" opacity="0.72" />
          <circle cx="127" cy="97.5" r="3" fill="${pal.secondary}" />
        </g>
      </g>

      <rect x="16" y="16" width="408" height="200" rx="${pal.radius ? 7 : 0}" fill="none" stroke="${pal.panelStroke}" stroke-width="2.2" />
    `;
  }

  function speechBubble(pal, cx, cy, rx, ry, tailSide) {
    const tail =
      tailSide === 'left'
        ? `M ${cx - rx * 0.72} ${cy + ry * 0.42} L ${cx - rx - 18} ${cy + ry * 0.65} L ${cx - rx * 0.42} ${cy + ry * 0.78}`
        : '';
    return `
      <g>
        <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${pal.bubbleFill}" stroke="${pal.bubbleStroke}" stroke-width="3" />
        ${
          tail
            ? `<path d="${tail}" fill="${pal.bubbleFill}" stroke="${pal.bubbleStroke}" stroke-width="3" stroke-linejoin="round" />
               <ellipse cx="${cx}" cy="${cy}" rx="${rx - 1.5}" ry="${ry - 1.5}" fill="${pal.bubbleFill}" />`
            : ''
        }
      </g>
    `;
  }

  function verticalJpText(x, y, chars, color, size, opacity) {
    const s = size || 17;
    const op = opacity !== undefined ? opacity : 1;
    return `
      <g fill="${color}" opacity="${op}" font-family="'Noto Sans JP', 'Inter', sans-serif" font-weight="900" font-size="${s}" text-anchor="middle">
        ${chars
          .map((ch, idx) => `<text x="${x}" y="${y + idx * (s + 4)}">${ch}</text>`)
          .join('')}
      </g>
    `;
  }

  function hudTag(pal, text, color, x, y) {
    const rx = pal.radius ? 6 : 0;
    const w = Math.max(66, text.length * 7.6 + 18);
    return `
      <g transform="translate(${x}, ${y})">
        <rect x="0" y="0" width="${w}" height="22" rx="${rx}" fill="${pal.hudBg}" stroke="${color}" stroke-width="1.3" />
        <text x="${w / 2}" y="14.5" fill="${color}" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="800" letter-spacing="1.2" text-anchor="middle">${text}</text>
      </g>
    `;
  }

  function buildSceneMarkup(kind, theme, id) {
    const pal = PALETTES[theme] || PALETTES.noir;
    let body = '';

    switch (kind) {
      case 'healing': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: true })}

          <g clip-path="url(#${id}-panel-clip)">
            <rect x="160" y="34" width="242" height="164" fill="${pal.panelBg}" />
            <rect x="160" y="34" width="242" height="164" fill="url(#${id}-screentone)" />
            <g stroke="${pal.speedline}" stroke-width="2.2" stroke-linecap="round">
              <line x1="164" y1="64" x2="396" y2="48" />
              <line x1="164" y1="98" x2="398" y2="82" />
              <line x1="164" y1="132" x2="396" y2="116" />
              <line x1="164" y1="166" x2="398" y2="150" />
            </g>

            <g class="td-smudge">
              <path d="M 192 84 Q 240 62 290 88 T 358 102 Q 344 148 278 144 T 188 122 Z" fill="${pal.smudge}" opacity="0.85" />
              <path d="M 218 96 L 268 90 M 224 114 L 314 108 M 242 128 L 328 124" stroke="${pal.panelDark}" stroke-width="6" stroke-linecap="round" opacity="0.55" />
            </g>

            <g clip-path="url(#${id}-heal-reveal)">
              <rect x="160" y="34" width="242" height="164" fill="${pal.panelBg}" />
              <rect x="160" y="34" width="242" height="164" fill="url(#${id}-screentone)" />
              <g stroke="${pal.speedline}" stroke-width="2.2" stroke-linecap="round">
                <line x1="164" y1="64" x2="396" y2="48" />
                <line x1="164" y1="98" x2="398" y2="82" />
                <line x1="164" y1="132" x2="396" y2="116" />
                <line x1="164" y1="166" x2="398" y2="150" />
              </g>
            </g>

            <g class="td-heal-cursor">
              <rect x="134" y="34" width="24" height="164" fill="url(#${id}-beam-mint)" />
              <rect x="144" y="34" width="14" height="164" fill="url(#${id}-grid)" />
              <line x1="158" y1="34" x2="158" y2="198" stroke="${pal.mint}" stroke-width="2.4" filter="url(#${id}-glow)" />
              <circle cx="158" cy="116" r="18" fill="${pal.mintSoft}" stroke="${pal.mint}" stroke-width="2.4" filter="url(#${id}-glow)" />
              <path d="M 158 106 L 161 113 L 168 116 L 161 119 L 158 126 L 155 119 L 148 116 L 155 113 Z" fill="${pal.mint}" />
            </g>
          </g>
          ${hudTag(pal, 'AI HEAL', pal.mint, 26, 26)}
        `;
        break;
      }

      case 'magic-wand': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: true })}

          <g transform="translate(284, 126) rotate(-7)">
            <text x="0" y="0" fill="${pal.bubbleFill}" stroke="${pal.panelDark}" stroke-width="7" paint-order="stroke" font-family="'Noto Sans JP', sans-serif" font-weight="900" font-size="46" text-anchor="middle" letter-spacing="2">ドン!</text>

            <g class="td-wand-select" opacity="0">
              <text x="0" y="0" fill="${pal.goldSoft}" stroke="${pal.gold}" stroke-width="3.2" stroke-dasharray="7 4" class="td-ants" font-family="'Noto Sans JP', sans-serif" font-weight="900" font-size="46" text-anchor="middle" letter-spacing="2">ドン!</text>
            </g>
          </g>

          <circle class="td-ripple" cx="270" cy="112" r="14" fill="none" stroke="${pal.gold}" stroke-width="2.8" opacity="0" />
          <g class="td-wand-cursor" transform="translate(338, 66)">
            <line x1="8" y1="8" x2="34" y2="34" stroke="${pal.hudText}" stroke-width="4" stroke-linecap="round" />
            <line x1="8" y1="8" x2="15" y2="15" stroke="${pal.gold}" stroke-width="4.5" stroke-linecap="round" />
            <path class="td-spark" d="M 0 -13 L 3 -3 L 13 0 L 3 3 L 0 13 L -3 3 L -13 0 L -3 -3 Z" fill="${pal.gold}" filter="url(#${id}-glow)" />
          </g>
          ${hudTag(pal, 'WAND · TOL 28', pal.gold, 26, 26)}
        `;
        break;
      }

      case 'segment-brush': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: false })}
          ${speechBubble(pal, 286, 116, 98, 76, 'left')}
          ${verticalJpText(308, 78, ['本', '当', 'な', 'の'], pal.glyph, 20)}
          ${verticalJpText(266, 86, ['そ', 'れ', 'は', '…'], pal.glyph, 20)}

          <g fill="none" stroke="${pal.secondary}" stroke-width="24" stroke-linecap="round" opacity="0.58" filter="url(#${id}-glow)">
            <line class="td-seg-1" x1="308" y1="68" x2="308" y2="152" stroke-dasharray="90" stroke-dashoffset="90" />
            <line class="td-seg-2" x1="266" y1="74" x2="266" y2="156" stroke-dasharray="90" stroke-dashoffset="90" />
          </g>

          <g class="td-brush-cursor">
            <circle cx="308" cy="68" r="14" fill="${pal.secondarySoft}" stroke="${pal.secondary}" stroke-width="2.4" />
            <circle cx="308" cy="68" r="3" fill="${pal.secondary}" />
          </g>
          ${hudTag(pal, 'MASK BRUSH', pal.secondary, 26, 26)}
        `;
        break;
      }

      case 'segment-eraser': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: false })}
          ${speechBubble(pal, 286, 116, 98, 76, 'left')}
          ${verticalJpText(308, 82, ['待', 'っ', 'て'], pal.glyph, 22)}

          <rect x="294" y="60" width="28" height="94" rx="14" fill="${pal.secondary}" opacity="0.52" />

          <g clip-path="url(#${id}-erase-reveal)">
            <path d="M 150 96 C 188 84 228 96 266 108 C 258 144 202 152 146 134 Z" fill="${pal.secondary}" opacity="0.62" />
          </g>

          <g class="td-eraser-cursor">
            <rect x="138" y="102" width="28" height="20" rx="4" fill="${pal.bubbleFill}" stroke="${pal.accent}" stroke-width="2.6" transform="rotate(-16 152 112)" />
            <rect x="148" y="102" width="12" height="20" rx="2" fill="${pal.accent}" opacity="0.85" transform="rotate(-16 152 112)" />
          </g>
          ${hudTag(pal, 'MASK ERASER', pal.accent, 26, 26)}
        `;
        break;
      }

      case 'paint': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: false })}
          ${speechBubble(pal, 282, 116, 102, 78, 'left')}

          ${verticalJpText(282, 78, ['残', '像', '跡'], pal.glyphMuted, 22, 0.5)}

          <path
            class="td-paint-stroke"
            d="M 272 64 L 296 72 L 266 96 L 298 106 L 266 130 L 296 144"
            fill="none"
            stroke="${pal.bubbleFill}"
            stroke-width="28"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-dasharray="220"
            stroke-dashoffset="220"
          />
          <g class="td-paint-cursor">
            <circle cx="272" cy="64" r="14" fill="${pal.accentSoft}" stroke="${pal.accent}" stroke-width="2.4" />
            <circle cx="272" cy="64" r="3" fill="${pal.accent}" />
          </g>
          ${hudTag(pal, 'PAINT FILL', pal.accent, 26, 26)}
        `;
        break;
      }

      case 'paint-eraser': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: true })}

          <path d="M 118 68 C 166 56 264 60 302 88 C 318 118 294 162 246 168 C 190 174 128 158 116 122 Z" fill="${pal.bubbleFill}" opacity="0.94" />

          <g clip-path="url(#${id}-paint-erase-reveal)">
            ${mangaArtwork(id, pal, { speedLines: true })}
          </g>
          <g class="td-pe-cursor">
            <line x1="112" y1="48" x2="112" y2="184" stroke="${pal.secondary}" stroke-width="2" stroke-dasharray="5 4" opacity="0.8" />
            <rect x="98" y="100" width="28" height="32" rx="5" fill="${pal.bubbleFill}" stroke="${pal.secondary}" stroke-width="2.8" />
            <rect x="98" y="118" width="28" height="14" rx="3" fill="${pal.secondary}" opacity="0.85" />
          </g>
          ${hudTag(pal, 'PAINT ERASER', pal.secondary, 26, 26)}
        `;
        break;
      }

      case 'clear-paint': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: false })}
          ${speechBubble(pal, 262, 116, 114, 76, 'left')}

          <g clip-path="url(#${id}-wipe-reveal)" stroke-linecap="round">
            <path d="M 192 84 Q 254 74 328 92" fill="none" stroke="${pal.accent}" stroke-width="14" opacity="0.72" />
            <path d="M 184 118 Q 262 112 342 122" fill="none" stroke="${pal.secondary}" stroke-width="12" opacity="0.65" />
            <path d="M 206 148 Q 264 146 318 154" fill="none" stroke="${pal.accent}" stroke-width="12" opacity="0.68" />
          </g>
          <g class="td-wipe-bar">
            <rect x="20" y="20" width="28" height="192" fill="url(#${id}-beam-accent)" />
            <line x1="48" y1="20" x2="48" y2="212" stroke="${pal.gold}" stroke-width="3" filter="url(#${id}-glow)" />
          </g>
          ${hudTag(pal, 'CLEAR PAINT', pal.gold, 26, 26)}
        `;
        break;
      }

      case 'reset-edits': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: false })}
          ${speechBubble(pal, 274, 116, 102, 76, 'left')}

          <g class="td-reset-layer">
            <rect x="218" y="68" width="112" height="96" rx="14" fill="${pal.accentSoft}" stroke="${pal.accent}" stroke-width="2.4" stroke-dasharray="6 4" />
            <path d="M 236 100 L 310 100 M 242 126 L 304 126" stroke="${pal.accent}" stroke-width="10" stroke-linecap="round" opacity="0.8" />
            <rect x="172" y="138" width="46" height="32" rx="6" fill="${pal.secondarySoft}" stroke="${pal.secondary}" stroke-width="2" />
          </g>

          <g class="td-rewind-ring" transform="translate(274, 116)">
            <circle cx="0" cy="0" r="38" fill="${pal.hudBg}" opacity="0.82" />
            <path d="M 22 -16 A 27 27 0 1 0 27 8" fill="none" stroke="${pal.secondary}" stroke-width="4.5" stroke-linecap="round" filter="url(#${id}-glow)" />
            <polygon points="14,-26 30,-16 15,-6" fill="${pal.secondary}" />
          </g>
          ${hudTag(pal, 'RESET EDITS', pal.secondary, 26, 26)}
        `;
        break;
      }

      case 'area-select': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: false })}
          ${speechBubble(pal, 286, 116, 86, 74, 'left')}
          ${verticalJpText(302, 82, ['見', 'つ', 'け'], pal.glyph, 20)}
          ${verticalJpText(270, 90, ['た', 'よ', '！'], pal.glyph, 20)}

          <rect
            class="td-marquee"
            x="212"
            y="46"
            width="148"
            height="138"
            rx="${pal.radius ? 6 : 0}"
            fill="${pal.accentSoft}"
            stroke="${pal.accent}"
            stroke-width="2.6"
            stroke-dasharray="8 5"
          />
          <g class="td-handles" fill="${pal.hudText}" stroke="${pal.accent}" stroke-width="2">
            <rect x="206" y="40" width="12" height="12" rx="${pal.radius ? 2 : 0}" />
            <rect x="354" y="40" width="12" height="12" rx="${pal.radius ? 2 : 0}" />
            <rect x="206" y="178" width="12" height="12" rx="${pal.radius ? 2 : 0}" />
            <rect x="354" y="178" width="12" height="12" rx="${pal.radius ? 2 : 0}" />
            <rect x="292" y="190" width="68" height="18" rx="${pal.radius ? 4 : 0}" fill="${pal.hudBg}" stroke="${pal.accent}" stroke-width="1.2" />
            <text x="326" y="202.5" fill="${pal.hudText}" stroke="none" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="800" text-anchor="middle">148×138</text>
          </g>
          <g class="td-drag-cursor">
            <path d="M 360 184 L 360 156 L 380 176 L 369 178 Z" fill="${pal.hudText}" stroke="${pal.bg}" stroke-width="2" />
          </g>
          ${hudTag(pal, 'AREA SELECT', pal.accent, 26, 26)}
        `;
        break;
      }

      case 'config': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: false })}
          ${speechBubble(pal, 314, 116, 78, 72, 'left')}
          ${verticalJpText(314, 86, ['調', '整', '中'], pal.glyph, 19, 0.35)}

          <circle class="td-reticle-outer" cx="314" cy="116" r="46" fill="${pal.goldSoft}" stroke="${pal.gold}" stroke-width="1.6" stroke-dasharray="5 4" />
          <circle class="td-reticle" cx="314" cy="116" r="28" fill="${pal.accentSoft}" stroke="${pal.accent}" stroke-width="2.4" />
          <circle cx="314" cy="116" r="3.5" fill="${pal.accent}" />

          <g transform="translate(28, 34)">
            <rect x="0" y="0" width="166" height="164" rx="${pal.radius ? 10 : 0}" fill="${pal.hudBg}" stroke="${pal.panelStroke}" stroke-width="1.4" />
            <text x="14" y="24" fill="${pal.hudText}" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="800" letter-spacing="1.4">
            <line x1="14" y1="34" x2="152" y2="34" stroke="${pal.panelStroke}" stroke-width="1" />

            <text x="14" y="56" fill="${pal.secondary}" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700">BRUSH SIZE</text>
            <rect x="14" y="66" width="138" height="7" rx="3.5" fill="rgba(255,255,255,0.12)" />
            <rect class="td-slider-a" x="14" y="66" width="76" height="7" rx="3.5" fill="${pal.accent}" />
            <circle class="td-knob-a" cx="90" cy="69.5" r="7" fill="${pal.hudText}" stroke="${pal.accent}" stroke-width="2.5" />

            <text x="14" y="106" fill="${pal.gold}" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700">TOLERANCE</text>
            <rect x="14" y="116" width="138" height="7" rx="3.5" fill="rgba(255,255,255,0.12)" />
            <rect class="td-slider-b" x="14" y="116" width="54" height="7" rx="3.5" fill="${pal.gold}" />
            <circle class="td-knob-b" cx="68" cy="119.5" r="7" fill="${pal.hudText}" stroke="${pal.gold}" stroke-width="2.5" />

            <rect x="14" y="138" width="64" height="16" rx="${pal.radius ? 4 : 0}" fill="${pal.mintSoft}" stroke="${pal.mint}" stroke-width="1" />
            <text x="46" y="149.5" fill="${pal.mint}" font-family="'JetBrains Mono', monospace" font-size="8.5" font-weight="800" text-anchor="middle">LIVE SYNC</text>
          </g>
        `;
        break;
      }

      case 'clear-page': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: false })}
          ${speechBubble(pal, 128, 102, 56, 48, '')}
          ${speechBubble(pal, 314, 122, 68, 56, 'left')}

          <g class="td-clear-boxes">
            <rect x="74" y="54" width="108" height="96" rx="${pal.radius ? 6 : 0}" fill="${pal.accentSoft}" stroke="${pal.accent}" stroke-width="2.2" stroke-dasharray="6 4" />
            <rect x="248" y="66" width="132" height="112" rx="${pal.radius ? 6 : 0}" fill="${pal.secondarySoft}" stroke="${pal.secondary}" stroke-width="2.2" stroke-dasharray="6 4" />
            <rect x="74" y="42" width="32" height="14" fill="${pal.accent}" />
            <text x="90" y="52" fill="${pal.bg}" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="900" text-anchor="middle">#01</text>
            <rect x="248" y="54" width="32" height="14" fill="${pal.secondary}" />
            <text x="264" y="64" fill="${pal.bg}" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="900" text-anchor="middle">#02</text>
          </g>
          <g class="td-sweep-bar">
            <rect x="16" y="18" width="34" height="196" fill="url(#${id}-beam-accent)" />
            <line x1="50" y1="18" x2="50" y2="214" stroke="${pal.gold}" stroke-width="3.2" filter="url(#${id}-glow)" />
          </g>
          ${hudTag(pal, 'CLEAR PAGE', pal.accent, 26, 26)}
        `;
        break;
      }

      case 'stage-detect': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: true })}
          ${speechBubble(pal, 142, 126, 52, 46, '')}
          ${verticalJpText(142, 110, ['え', 'っ', '!?'], pal.glyph, 16)}
          ${speechBubble(pal, 314, 118, 72, 60, 'left')}
          ${verticalJpText(324, 92, ['行', 'く', 'ぞ'], pal.glyph, 18)}
          ${verticalJpText(300, 98, ['今', 'だ', '！'], pal.glyph, 18)}

          <g class="td-det-box-1" opacity="0">
            <rect x="90" y="80" width="104" height="92" rx="${pal.radius ? 6 : 0}" fill="${pal.accentSoft}" stroke="${pal.accent}" stroke-width="2.4" />
            <rect x="90" y="64" width="54" height="16" fill="${pal.accent}" />
            <text x="117" y="75" fill="${pal.bg}" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="900" text-anchor="middle">#01 99%</text>
          </g>
          <g class="td-det-box-2" opacity="0">
            <rect x="242" y="58" width="144" height="120" rx="${pal.radius ? 6 : 0}" fill="${pal.secondarySoft}" stroke="${pal.secondary}" stroke-width="2.4" />
            <rect x="242" y="43" width="54" height="16" fill="${pal.secondary}" />
            <text x="269" y="54" fill="${pal.bg}" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="900" text-anchor="middle">#02 98%</text>
          </g>

          <g class="td-scan-y">
            <rect x="18" y="18" width="404" height="24" fill="url(#${id}-beam-cyan)" />
            <line x1="18" y1="42" x2="422" y2="42" stroke="${pal.secondary}" stroke-width="2.6" filter="url(#${id}-glow)" />
          </g>
          ${hudTag(pal, '01 · DETECT', pal.accent, 26, 26)}
        `;
        break;
      }

      case 'stage-ocr': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: false })}
          ${speechBubble(pal, 142, 122, 74, 66, '')}
          ${verticalJpText(154, 92, ['行', 'く', 'ぞ', '！'], pal.glyph, 19)}
          ${verticalJpText(128, 102, ['今', 'す', 'ぐ'], pal.glyph, 19)}

          <rect class="td-ocr-beam" x="98" y="66" width="88" height="14" fill="${pal.secondary}" opacity="0.45" filter="url(#${id}-glow)" />

          <g transform="translate(238, 48)">
            <rect x="0" y="0" width="172" height="136" rx="${pal.radius ? 10 : 0}" fill="${pal.hudBg}" stroke="${pal.secondary}" stroke-width="1.6" />
            <text x="14" y="24" fill="${pal.secondary}" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="800">
            <line x1="14" y1="34" x2="158" y2="34" stroke="${pal.panelStroke}" stroke-width="1" />
            <text class="td-ocr-line-1" x="14" y="66" fill="${pal.hudText}" font-family="'Noto Sans JP', sans-serif" font-size="18" font-weight="800" opacity="0">行くぞ！</text>
            <text class="td-ocr-line-2" x="14" y="96" fill="${pal.hudText}" font-family="'Noto Sans JP', sans-serif" font-size="18" font-weight="800" opacity="0">今すぐ</text>
            <rect class="td-ocr-ready" x="14" y="108" width="82" height="18" rx="${pal.radius ? 4 : 0}" fill="${pal.mintSoft}" stroke="${pal.mint}" stroke-width="1" opacity="0" />
            <text class="td-ocr-ready" x="55" y="120" fill="${pal.mint}" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="800" text-anchor="middle" opacity="0">CONF 99.4%</text>
          </g>
          ${hudTag(pal, '02 · OCR', pal.secondary, 26, 26)}
        `;
        break;
      }

      case 'stage-translate': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: false })}

          <g transform="translate(30, 62)">
            <rect x="0" y="0" width="154" height="122" rx="${pal.radius ? 10 : 0}" fill="${pal.hudBg}" stroke="${pal.panelStroke}" stroke-width="1.5" />
            <text x="14" y="24" fill="${pal.hudMuted}" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="800">SOURCE · JA</text>
            <text x="14" y="64" fill="${pal.hudText}" font-family="'Noto Sans JP', sans-serif" font-size="16.5" font-weight="800">行くぞ、相棒！</text>
            <rect x="14" y="84" width="88" height="20" rx="${pal.radius ? 4 : 0}" fill="${pal.goldSoft}" stroke="${pal.gold}" stroke-width="1" />
            <text x="58" y="97.5" fill="${pal.gold}" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="800" text-anchor="middle">GLOSSARY: 相棒</text>
          </g>

          <g transform="translate(192, 122)">
            <line x1="0" y1="0" x2="54" y2="0" stroke="${pal.accent}" stroke-width="2.6" stroke-dasharray="6 4" class="td-ants" />
            <circle class="td-bridge-dot" cx="0" cy="0" r="6" fill="${pal.gold}" filter="url(#${id}-glow)" />
          </g>

          <g transform="translate(254, 62)">
            <rect x="0" y="0" width="156" height="122" rx="${pal.radius ? 10 : 0}" fill="${pal.hudBg}" stroke="${pal.accent}" stroke-width="1.8" />
            <text x="14" y="24" fill="${pal.accent}" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="800">TARGET · EN/PT</text>
            <g class="td-tl-out" opacity="0">
              <text x="14" y="60" fill="${pal.hudText}" font-family="'Inter', sans-serif" font-size="16" font-weight="800">Let's go,</text>
              <text x="14" y="82" fill="${pal.gold}" font-family="'Inter', sans-serif" font-size="16" font-weight="800">partner!</text>
              <rect x="14" y="94" width="96" height="18" rx="${pal.radius ? 4 : 0}" fill="${pal.mintSoft}" stroke="${pal.mint}" stroke-width="1" />
              <text x="62" y="106" fill="${pal.mint}" font-family="'JetBrains Mono', monospace" font-size="8.5" font-weight="800" text-anchor="middle">CONTEXT SYNCED</text>
            </g>
          </g>
          ${hudTag(pal, '03 · TRANSLATE', pal.accent, 26, 26)}
        `;
        break;
      }

      case 'stage-segment': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: true })}
          ${speechBubble(pal, 286, 116, 94, 74, 'left')}
          ${verticalJpText(308, 82, ['決', '着', 'だ'], pal.glyph, 21)}
          ${verticalJpText(268, 88, ['終', 'わ', 'り'], pal.glyph, 21)}

          <g class="td-seg-mask" opacity="0">
            <rect x="294" y="60" width="28" height="92" rx="8" fill="${pal.secondary}" opacity="0.55" filter="url(#${id}-glow)" />
            <rect x="254" y="66" width="28" height="92" rx="8" fill="${pal.secondary}" opacity="0.55" filter="url(#${id}-glow)" />
            <rect x="291" y="57" width="34" height="98" rx="9" fill="none" stroke="${pal.secondary}" stroke-width="2" stroke-dasharray="5 3" class="td-ants" />
            <rect x="251" y="63" width="34" height="98" rx="9" fill="none" stroke="${pal.secondary}" stroke-width="2" stroke-dasharray="5 3" class="td-ants" />
          </g>
          ${hudTag(pal, '04 · SEGMENT MASK', pal.secondary, 26, 26)}
        `;
        break;
      }

      case 'stage-clean': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: true })}

          ${speechBubble(pal, 298, 116, 86, 72, 'left')}
          ${verticalJpText(312, 84, ['完', '壁', 'に'], pal.glyph, 20)}
          ${verticalJpText(282, 90, ['消', '去', '！'], pal.glyph, 20)}

          <g clip-path="url(#${id}-clean-reveal)">
            ${mangaArtwork(id, pal, { speedLines: true })}
            ${speechBubble(pal, 298, 116, 86, 72, 'left')}
          </g>

          <rect class="td-hd-frame" x="208" y="38" width="182" height="156" rx="${pal.radius ? 8 : 0}" fill="none" stroke="${pal.mint}" stroke-width="2.4" stroke-dasharray="8 4" />
          <g class="td-clean-bar">
            <line x1="210" y1="38" x2="210" y2="194" stroke="${pal.mint}" stroke-width="3" filter="url(#${id}-glow)" />
            <circle cx="210" cy="116" r="10" fill="${pal.hudBg}" stroke="${pal.mint}" stroke-width="2.2" />
          </g>
          ${hudTag(pal, '05 · HD CROP CLEAN', pal.mint, 26, 26)}
        `;
        break;
      }

      case 'stage-render': {
        body = `
          ${mangaArtwork(id, pal, { speedLines: false })}
          ${speechBubble(pal, 286, 116, 98, 76, 'left')}

          <g class="td-render-text" opacity="0">
            <text x="286" y="106" fill="${pal.glyph}" stroke="${pal.bubbleFill}" stroke-width="4" paint-order="stroke" font-family="'Archivo Black', 'Inter', sans-serif" font-weight="900" font-size="22" text-anchor="middle" letter-spacing="0.5">LET'S GO,</text>
            <text x="286" y="134" fill="${pal.accent}" stroke="${pal.bubbleFill}" stroke-width="4" paint-order="stroke" font-family="'Archivo Black', 'Inter', sans-serif" font-weight="900" font-size="22" text-anchor="middle" letter-spacing="0.5">PARTNER!</text>
          </g>
          <g class="td-render-box" opacity="0">
            <rect x="212" y="76" width="148" height="76" rx="${pal.radius ? 6 : 0}" fill="none" stroke="${pal.accent}" stroke-width="1.8" stroke-dasharray="5 3" />
            <rect x="208" y="72" width="8" height="8" fill="${pal.hudText}" stroke="${pal.accent}" stroke-width="1.6" />
            <rect x="356" y="72" width="8" height="8" fill="${pal.hudText}" stroke="${pal.accent}" stroke-width="1.6" />
            <rect x="208" y="148" width="8" height="8" fill="${pal.hudText}" stroke="${pal.accent}" stroke-width="1.6" />
            <rect x="356" y="148" width="8" height="8" fill="${pal.hudText}" stroke="${pal.accent}" stroke-width="1.6" />
          </g>
          ${hudTag(pal, '06 · LIVE RENDER', pal.gold, 26, 26)}
        `;
        break;
      }
    }

    return `
      <svg class="td-svg" viewBox="0 0 440 232" xmlns="http://www.w3.org/2000/svg">
        ${buildDefs(id, pal)}
        <rect x="0" y="0" width="440" height="232" rx="${pal.radius}" fill="${pal.bg}" />
        ${body}
      </svg>
    `;
  }

  function buildToolTimeline(svgRoot, kind, duration) {
    const d = duration || 2.4;
    const tl = global.gsap.timeline({ paused: true });
    const q = (s) => svgRoot.querySelector(s);
    const qAll = (s) => Array.from(svgRoot.querySelectorAll(s));

    qAll('.td-ants').forEach((el) => {
      tl.fromTo(el, { attr: { 'stroke-dashoffset': 0 } }, { attr: { 'stroke-dashoffset': -44 }, duration: d, ease: 'none' }, 0);
    });

    switch (kind) {
      case 'healing': {
        const clip = q('.td-heal-clip');
        const cur = q('.td-heal-cursor');
        if (clip) {
          tl.fromTo(
            clip,
            { attr: { width: 0 } },
            {
              keyframes: [
                { attr: { width: 0 }, duration: d * 0.1 },
                { attr: { width: 236 }, duration: d * 0.56, ease: 'power2.inOut' },
                { attr: { width: 236 }, duration: d * 0.22 },
                { attr: { width: 0 }, duration: d * 0.12, ease: 'power2.in' },
              ],
            },
            0,
          );
        }
        if (cur) {
          tl.fromTo(
            cur,
            { x: 0 },
            {
              keyframes: [
                { x: 0, duration: d * 0.1 },
                { x: 232, duration: d * 0.56, ease: 'power2.inOut' },
                { x: 232, duration: d * 0.22 },
                { x: 0, duration: d * 0.12, ease: 'power2.in' },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'magic-wand': {
        const sel = q('.td-wand-select');
        const rip = q('.td-ripple');
        const cur = q('.td-wand-cursor');
        const sp = q('.td-spark');
        if (cur) {
          tl.fromTo(
            cur,
            { x: 28, y: -12 },
            {
              keyframes: [
                { x: -64, y: 42, duration: d * 0.24, ease: 'power2.out' },
                { x: -64, y: 42, duration: d * 0.56 },
                { x: 28, y: -12, duration: d * 0.2, ease: 'power2.inOut' },
              ],
            },
            0,
          );
        }
        if (rip) {
          tl.fromTo(
            rip,
            { attr: { r: 8 }, opacity: 0 },
            {
              keyframes: [
                { attr: { r: 8 }, opacity: 0, duration: d * 0.22 },
                { attr: { r: 12 }, opacity: 0.95, duration: d * 0.05 },
                { attr: { r: 72 }, opacity: 0, duration: d * 0.35, ease: 'power2.out' },
                { attr: { r: 8 }, opacity: 0, duration: d * 0.38 },
              ],
            },
            0,
          );
        }
        if (sel) {
          tl.fromTo(
            sel,
            { opacity: 0 },
            {
              keyframes: [
                { opacity: 0, duration: d * 0.24 },
                { opacity: 1, duration: d * 0.12, ease: 'power2.out' },
                { opacity: 1, duration: d * 0.48 },
                { opacity: 0, duration: d * 0.16 },
              ],
            },
            0,
          );
        }
        if (sp) {
          tl.fromTo(
            sp,
            { scale: 0.8, rotation: 0, transformOrigin: 'center center' },
            {
              keyframes: [
                { scale: 1.35, rotation: 45, duration: d * 0.35, ease: 'sine.inOut' },
                { scale: 0.8, rotation: 90, duration: d * 0.65, ease: 'sine.inOut' },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'segment-brush': {
        const s1 = q('.td-seg-1');
        const s2 = q('.td-seg-2');
        const cur = q('.td-brush-cursor');
        if (s1) {
          tl.fromTo(
            s1,
            { attr: { 'stroke-dashoffset': 90 } },
            {
              keyframes: [
                { attr: { 'stroke-dashoffset': 90 }, duration: d * 0.08 },
                { attr: { 'stroke-dashoffset': 0 }, duration: d * 0.32, ease: 'power1.inOut' },
                { attr: { 'stroke-dashoffset': 0 }, duration: d * 0.48 },
                { attr: { 'stroke-dashoffset': 90 }, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (s2) {
          tl.fromTo(
            s2,
            { attr: { 'stroke-dashoffset': 90 } },
            {
              keyframes: [
                { attr: { 'stroke-dashoffset': 90 }, duration: d * 0.42 },
                { attr: { 'stroke-dashoffset': 0 }, duration: d * 0.3, ease: 'power1.inOut' },
                { attr: { 'stroke-dashoffset': 0 }, duration: d * 0.16 },
                { attr: { 'stroke-dashoffset': 90 }, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (cur) {
          tl.fromTo(
            cur,
            { x: 0, y: 0 },
            {
              keyframes: [
                { x: 0, y: 0, duration: d * 0.08 },
                { x: 0, y: 84, duration: d * 0.32, ease: 'power1.inOut' },
                { x: -42, y: 6, duration: d * 0.06, ease: 'power2.out' },
                { x: -42, y: 88, duration: d * 0.28, ease: 'power1.inOut' },
                { x: -42, y: 88, duration: d * 0.14 },
                { x: 0, y: 0, duration: d * 0.12, ease: 'power2.inOut' },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'segment-eraser': {
        const clip = q('.td-erase-clip');
        const cur = q('.td-eraser-cursor');
        if (clip) {
          tl.fromTo(
            clip,
            { attr: { x: 112, width: 220 } },
            {
              keyframes: [
                { attr: { x: 112, width: 220 }, duration: d * 0.12 },
                { attr: { x: 268, width: 64 }, duration: d * 0.56, ease: 'power2.inOut' },
                { attr: { x: 268, width: 64 }, duration: d * 0.2 },
                { attr: { x: 112, width: 220 }, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (cur) {
          tl.fromTo(
            cur,
            { x: 0, y: 0 },
            {
              keyframes: [
                { x: 0, y: 0, duration: d * 0.12 },
                { x: 116, y: 6, duration: d * 0.56, ease: 'power2.inOut' },
                { x: 116, y: 6, duration: d * 0.2 },
                { x: 0, y: 0, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'paint': {
        const stroke = q('.td-paint-stroke');
        const cur = q('.td-paint-cursor');
        if (stroke) {
          tl.fromTo(
            stroke,
            { attr: { 'stroke-dashoffset': 220 } },
            {
              keyframes: [
                { attr: { 'stroke-dashoffset': 220 }, duration: d * 0.1 },
                { attr: { 'stroke-dashoffset': 0 }, duration: d * 0.58, ease: 'power1.inOut' },
                { attr: { 'stroke-dashoffset': 0 }, duration: d * 0.2 },
                { attr: { 'stroke-dashoffset': 220 }, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (cur) {
          tl.fromTo(
            cur,
            { x: 0, y: 0 },
            {
              keyframes: [
                { x: 0, y: 0, duration: d * 0.1 },
                { x: 24, y: 8, duration: d * 0.12, ease: 'sine.inOut' },
                { x: -6, y: 32, duration: d * 0.12, ease: 'sine.inOut' },
                { x: 26, y: 42, duration: d * 0.12, ease: 'sine.inOut' },
                { x: -6, y: 66, duration: d * 0.12, ease: 'sine.inOut' },
                { x: 24, y: 80, duration: d * 0.1, ease: 'sine.inOut' },
                { x: 24, y: 80, duration: d * 0.2 },
                { x: 0, y: 0, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'paint-eraser': {
        const clip = q('.td-pe-clip');
        const cur = q('.td-pe-cursor');
        if (clip) {
          tl.fromTo(
            clip,
            { attr: { width: 0 } },
            {
              keyframes: [
                { attr: { width: 0 }, duration: d * 0.1 },
                { attr: { width: 210 }, duration: d * 0.58, ease: 'power2.inOut' },
                { attr: { width: 210 }, duration: d * 0.2 },
                { attr: { width: 0 }, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (cur) {
          tl.fromTo(
            cur,
            { x: 0 },
            {
              keyframes: [
                { x: 0, duration: d * 0.1 },
                { x: 210, duration: d * 0.58, ease: 'power2.inOut' },
                { x: 210, duration: d * 0.2 },
                { x: 0, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'clear-paint': {
        const clip = q('.td-wipe-clip');
        const bar = q('.td-wipe-bar');
        if (clip) {
          tl.fromTo(
            clip,
            { attr: { x: 16, width: 408 } },
            {
              keyframes: [
                { attr: { x: 16, width: 408 }, duration: d * 0.1 },
                { attr: { x: 408, width: 16 }, duration: d * 0.56, ease: 'power2.inOut' },
                { attr: { x: 408, width: 16 }, duration: d * 0.22 },
                { attr: { x: 16, width: 408 }, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (bar) {
          tl.fromTo(
            bar,
            { x: 0, opacity: 0.4 },
            {
              keyframes: [
                { x: 0, opacity: 1, duration: d * 0.1 },
                { x: 364, opacity: 1, duration: d * 0.56, ease: 'power2.inOut' },
                { x: 376, opacity: 0, duration: d * 0.22 },
                { x: 0, opacity: 0.4, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'reset-edits': {
        const layer = q('.td-reset-layer');
        const ring = q('.td-rewind-ring');
        if (layer) {
          tl.fromTo(
            layer,
            { opacity: 1 },
            {
              keyframes: [
                { opacity: 1, duration: d * 0.16 },
                { opacity: 0.04, duration: d * 0.42, ease: 'power2.inOut' },
                { opacity: 0.04, duration: d * 0.28 },
                { opacity: 1, duration: d * 0.14 },
              ],
            },
            0,
          );
        }
        if (ring) {
          tl.fromTo(
            ring,
            { rotation: 0, svgOrigin: '274 116' },
            { rotation: -360, duration: d, ease: 'power2.inOut' },
            0,
          );
        }
        break;
      }

      case 'area-select': {
        const m = q('.td-marquee');
        const h = q('.td-handles');
        const cur = q('.td-drag-cursor');
        if (m) {
          tl.fromTo(
            m,
            { scaleX: 0.18, scaleY: 0.18, opacity: 0.5, svgOrigin: '212 46' },
            {
              keyframes: [
                { scaleX: 1, scaleY: 1, opacity: 1, duration: d * 0.52, ease: 'power2.out' },
                { scaleX: 1, scaleY: 1, opacity: 1, duration: d * 0.34 },
                { scaleX: 0.18, scaleY: 0.18, opacity: 0.5, duration: d * 0.14, ease: 'power2.in' },
              ],
            },
            0,
          );
        }
        if (h) {
          tl.fromTo(
            h,
            { opacity: 0 },
            {
              keyframes: [
                { opacity: 0, duration: d * 0.44 },
                { opacity: 1, duration: d * 0.12 },
                { opacity: 1, duration: d * 0.32 },
                { opacity: 0, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (cur) {
          tl.fromTo(
            cur,
            { x: -124, y: -116 },
            {
              keyframes: [
                { x: 0, y: 0, duration: d * 0.52, ease: 'power2.out' },
                { x: 0, y: 0, duration: d * 0.34 },
                { x: -124, y: -116, duration: d * 0.14, ease: 'power2.in' },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'config': {
        const ret = q('.td-reticle');
        const retO = q('.td-reticle-outer');
        const sA = q('.td-slider-a');
        const kA = q('.td-knob-a');
        const sB = q('.td-slider-b');
        const kB = q('.td-knob-b');
        if (ret) {
          tl.fromTo(
            ret,
            { attr: { r: 22 } },
            {
              keyframes: [
                { attr: { r: 40 }, duration: d * 0.5, ease: 'sine.inOut' },
                { attr: { r: 22 }, duration: d * 0.5, ease: 'sine.inOut' },
              ],
            },
            0,
          );
        }
        if (retO) {
          tl.fromTo(
            retO,
            { attr: { r: 54 } },
            {
              keyframes: [
                { attr: { r: 34 }, duration: d * 0.5, ease: 'sine.inOut' },
                { attr: { r: 54 }, duration: d * 0.5, ease: 'sine.inOut' },
              ],
            },
            0,
          );
        }
        if (sA) {
          tl.fromTo(
            sA,
            { attr: { width: 44 } },
            {
              keyframes: [
                { attr: { width: 118 }, duration: d * 0.5, ease: 'sine.inOut' },
                { attr: { width: 44 }, duration: d * 0.5, ease: 'sine.inOut' },
              ],
            },
            0,
          );
        }
        if (kA) {
          tl.fromTo(
            kA,
            { attr: { cx: 58 } },
            {
              keyframes: [
                { attr: { cx: 132 }, duration: d * 0.5, ease: 'sine.inOut' },
                { attr: { cx: 58 }, duration: d * 0.5, ease: 'sine.inOut' },
              ],
            },
            0,
          );
        }
        if (sB) {
          tl.fromTo(
            sB,
            { attr: { width: 108 } },
            {
              keyframes: [
                { attr: { width: 42 }, duration: d * 0.5, ease: 'sine.inOut' },
                { attr: { width: 108 }, duration: d * 0.5, ease: 'sine.inOut' },
              ],
            },
            0,
          );
        }
        if (kB) {
          tl.fromTo(
            kB,
            { attr: { cx: 122 } },
            {
              keyframes: [
                { attr: { cx: 56 }, duration: d * 0.5, ease: 'sine.inOut' },
                { attr: { cx: 122 }, duration: d * 0.5, ease: 'sine.inOut' },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'clear-page': {
        const boxes = q('.td-clear-boxes');
        const bar = q('.td-sweep-bar');
        if (boxes) {
          tl.fromTo(
            boxes,
            { opacity: 1 },
            {
              keyframes: [
                { opacity: 1, duration: d * 0.16 },
                { opacity: 0.05, duration: d * 0.5, ease: 'power2.inOut' },
                { opacity: 0.05, duration: d * 0.22 },
                { opacity: 1, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (bar) {
          tl.fromTo(
            bar,
            { x: 0, opacity: 0 },
            {
              keyframes: [
                { x: 0, opacity: 1, duration: d * 0.12 },
                { x: 370, opacity: 1, duration: d * 0.56, ease: 'power2.inOut' },
                { x: 386, opacity: 0, duration: d * 0.2 },
                { x: 0, opacity: 0, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'stage-detect': {
        const scan = q('.td-scan-y');
        const b1 = q('.td-det-box-1');
        const b2 = q('.td-det-box-2');
        if (scan) {
          tl.fromTo(
            scan,
            { y: 0, opacity: 0 },
            {
              keyframes: [
                { y: 0, opacity: 1, duration: d * 0.08 },
                { y: 170, opacity: 1, duration: d * 0.52, ease: 'power1.inOut' },
                { y: 175, opacity: 0, duration: d * 0.28 },
                { y: 0, opacity: 0, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (b1) {
          tl.fromTo(
            b1,
            { opacity: 0, scale: 0.92, svgOrigin: '118 92' },
            {
              keyframes: [
                { opacity: 0, scale: 0.92, duration: d * 0.18 },
                { opacity: 1, scale: 1, duration: d * 0.14, ease: 'back.out(1.7)' },
                { opacity: 1, scale: 1, duration: d * 0.56 },
                { opacity: 0, scale: 0.92, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (b2) {
          tl.fromTo(
            b2,
            { opacity: 0, scale: 0.92, svgOrigin: '314 118' },
            {
              keyframes: [
                { opacity: 0, scale: 0.92, duration: d * 0.34 },
                { opacity: 1, scale: 1, duration: d * 0.14, ease: 'back.out(1.7)' },
                { opacity: 1, scale: 1, duration: d * 0.4 },
                { opacity: 0, scale: 0.92, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'stage-ocr': {
        const beam = q('.td-ocr-beam');
        const l1 = q('.td-ocr-line-1');
        const l2 = q('.td-ocr-line-2');
        const ready = qAll('.td-ocr-ready');
        if (beam) {
          tl.fromTo(
            beam,
            { y: 0, opacity: 0.7 },
            {
              keyframes: [
                { y: 92, opacity: 0.85, duration: d * 0.52, ease: 'power1.inOut' },
                { y: 92, opacity: 0, duration: d * 0.34 },
                { y: 0, opacity: 0.7, duration: d * 0.14 },
              ],
            },
            0,
          );
        }
        if (l1) {
          tl.fromTo(
            l1,
            { opacity: 0, x: -8 },
            {
              keyframes: [
                { opacity: 0, x: -8, duration: d * 0.16 },
                { opacity: 1, x: 0, duration: d * 0.16, ease: 'power2.out' },
                { opacity: 1, x: 0, duration: d * 0.56 },
                { opacity: 0, x: -8, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (l2) {
          tl.fromTo(
            l2,
            { opacity: 0, x: -8 },
            {
              keyframes: [
                { opacity: 0, x: -8, duration: d * 0.34 },
                { opacity: 1, x: 0, duration: d * 0.16, ease: 'power2.out' },
                { opacity: 1, x: 0, duration: d * 0.38 },
                { opacity: 0, x: -8, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (ready.length) {
          tl.fromTo(
            ready,
            { opacity: 0 },
            {
              keyframes: [
                { opacity: 0, duration: d * 0.5 },
                { opacity: 1, duration: d * 0.14 },
                { opacity: 1, duration: d * 0.24 },
                { opacity: 0, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'stage-translate': {
        const dot = q('.td-bridge-dot');
        const out = q('.td-tl-out');
        if (dot) {
          tl.fromTo(
            dot,
            { x: 0, opacity: 1 },
            {
              keyframes: [
                { x: 54, opacity: 1, duration: d * 0.36, ease: 'power2.inOut' },
                { x: 54, opacity: 0, duration: d * 0.5 },
                { x: 0, opacity: 1, duration: d * 0.14 },
              ],
            },
            0,
          );
        }
        if (out) {
          tl.fromTo(
            out,
            { opacity: 0, y: 6 },
            {
              keyframes: [
                { opacity: 0, y: 6, duration: d * 0.3 },
                { opacity: 1, y: 0, duration: d * 0.18, ease: 'power2.out' },
                { opacity: 1, y: 0, duration: d * 0.4 },
                { opacity: 0, y: 6, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'stage-segment': {
        const mask = q('.td-seg-mask');
        if (mask) {
          tl.fromTo(
            mask,
            { opacity: 0, scaleY: 0.2, svgOrigin: '286 60' },
            {
              keyframes: [
                { opacity: 0, scaleY: 0.2, duration: d * 0.12 },
                { opacity: 1, scaleY: 1, duration: d * 0.44, ease: 'power2.out' },
                { opacity: 1, scaleY: 1, duration: d * 0.32 },
                { opacity: 0, scaleY: 0.2, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'stage-clean': {
        const clip = q('.td-clean-clip');
        const bar = q('.td-clean-bar');
        if (clip) {
          tl.fromTo(
            clip,
            { attr: { width: 0 } },
            {
              keyframes: [
                { attr: { width: 0 }, duration: d * 0.12 },
                { attr: { width: 178 }, duration: d * 0.54, ease: 'power2.inOut' },
                { attr: { width: 178 }, duration: d * 0.22 },
                { attr: { width: 0 }, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (bar) {
          tl.fromTo(
            bar,
            { x: 0 },
            {
              keyframes: [
                { x: 0, duration: d * 0.12 },
                { x: 178, duration: d * 0.54, ease: 'power2.inOut' },
                { x: 178, duration: d * 0.22 },
                { x: 0, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        break;
      }

      case 'stage-render': {
        const txt = q('.td-render-text');
        const box = q('.td-render-box');
        if (txt) {
          tl.fromTo(
            txt,
            { opacity: 0, scale: 0.84, svgOrigin: '286 116' },
            {
              keyframes: [
                { opacity: 0, scale: 0.84, duration: d * 0.14 },
                { opacity: 1, scale: 1, duration: d * 0.24, ease: 'back.out(1.8)' },
                { opacity: 1, scale: 1, duration: d * 0.5 },
                { opacity: 0, scale: 0.84, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        if (box) {
          tl.fromTo(
            box,
            { opacity: 0 },
            {
              keyframes: [
                { opacity: 0, duration: d * 0.3 },
                { opacity: 1, duration: d * 0.16 },
                { opacity: 1, duration: d * 0.42 },
                { opacity: 0, duration: d * 0.12 },
              ],
            },
            0,
          );
        }
        break;
      }
    }

    tl.to({}, { duration: 0.001 }, d - 0.001);
    return tl;
  }

  global.KomaToolDemos = {
    TOOL_KINDS,
    buildSceneMarkup,
    buildToolTimeline,
  };
})(window);
