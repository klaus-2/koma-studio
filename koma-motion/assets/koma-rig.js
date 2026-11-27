function pivotOf(el, fallback) {
  return (el && el.getAttribute('data-pivot')) || fallback;
}

(function (global) {
  'use strict';

  const POSES = [
    'idle',
    'wink',
    'happy',
    'curious',
    'wave',
    'peek',
    'sleep',
    'stretch',
    'surprised',
    'back',
    'casting',
    'celebrate',
    'working',
  ];

  function buildDefs(p) {
    return `
      <defs>

        <linearGradient id="${p}-rim-aura" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#FFE17D" />
          <stop offset="28%" stop-color="#FF9A2E" />
          <stop offset="62%" stop-color="#FF1E6E" />
          <stop offset="100%" stop-color="#D8125B" />
        </linearGradient>

        <linearGradient id="${p}-rim-core" x1="48%" y1="0%" x2="52%" y2="100%">
          <stop offset="0%" stop-color="#FFF2B2" />
          <stop offset="26%" stop-color="#FFB938" />
          <stop offset="58%" stop-color="#FF2E7A" />
          <stop offset="100%" stop-color="#E11D62" />
        </linearGradient>

        <linearGradient id="${p}-rim-diag" x1="35%" y1="0%" x2="65%" y2="100%">
          <stop offset="0%" stop-color="#FFE68A" />
          <stop offset="32%" stop-color="#FF9B26" />
          <stop offset="68%" stop-color="#FF1E6E" />
          <stop offset="100%" stop-color="#C91056" />
        </linearGradient>

        <radialGradient id="${p}-fur" cx="46%" cy="38%" r="65%">
          <stop offset="0%" stop-color="#0E0A16" />
          <stop offset="58%" stop-color="#06040A" />
          <stop offset="100%" stop-color="#030206" />
        </radialGradient>

        <linearGradient id="${p}-ear-pink" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#FF6BA3" />
          <stop offset="45%" stop-color="#FF1F6A" />
          <stop offset="100%" stop-color="#C60D4F" />
        </linearGradient>

        <radialGradient id="${p}-iris" cx="50%" cy="66%" r="56%" fx="50%" fy="76%">
          <stop offset="0%" stop-color="#9CFFFF" />
          <stop offset="30%" stop-color="#38F9FF" />
          <stop offset="62%" stop-color="#0094FF" />
          <stop offset="88%" stop-color="#0044A8" />
          <stop offset="100%" stop-color="#002366" />
        </radialGradient>

        <radialGradient id="${p}-eye-halo" cx="50%" cy="55%" r="50%">
          <stop offset="0%" stop-color="#38F9FF" stop-opacity="0.45" />
          <stop offset="60%" stop-color="#0099FF" stop-opacity="0.16" />
          <stop offset="100%" stop-color="#0099FF" stop-opacity="0" />
        </radialGradient>

        <linearGradient id="${p}-closed-eye" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stop-color="#60A5FA" />
          <stop offset="50%" stop-color="#5CEEFF" />
          <stop offset="100%" stop-color="#93C5FD" />
        </linearGradient>

        <linearGradient id="${p}-mouth-pink" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#C21453" />
          <stop offset="45%" stop-color="#FF2D78" />
          <stop offset="100%" stop-color="#FF76AA" />
        </linearGradient>

        <linearGradient id="${p}-bean-pink" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#FF6EA6" />
          <stop offset="100%" stop-color="#FF1E6E" />
        </linearGradient>

        <linearGradient id="${p}-orbit" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FF3EA5" />
          <stop offset="45%" stop-color="#C084FC" />
          <stop offset="100%" stop-color="#38F9FF" />
        </linearGradient>

        <filter id="${p}-bloom-wide" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="5.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
          </feMerge>
        </filter>

        <filter id="${p}-bloom-tight" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="1.4" result="b1" />
          <feMerge>
            <feMergeNode in="b1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="${p}-heart-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.4" result="hb" />
          <feColorMatrix in="hb" type="matrix"
            values="1 0 0 0 0.08
                    0 0.82 0 0 0.02
                    0 0 0.92 0 0.06
                    0 0 0 0.95 0" result="tinted" />
          <feMerge>
            <feMergeNode in="tinted" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="${p}-cyan-glow" x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="2.2" result="cb" />
          <feMerge>
            <feMergeNode in="cb" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="${p}-pink-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.8" result="pb" />
          <feMerge>
            <feMergeNode in="pb" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    `;
  }

  function rimmedShape(p, pathD, opts) {
    const o = opts || {};
    const auraW = o.auraWidth || 9.2;
    const coreW = o.coreWidth || 4.4;
    const grad = o.grad || `${p}-rim-aura`;
    const coreGrad = o.coreGrad || `${p}-rim-core`;
    return `
      <path d="${pathD}" fill="none" stroke="url(#${grad})" stroke-width="${auraW}" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-wide)" opacity="0.72" />
      <path d="${pathD}" fill="none" stroke="url(#${coreGrad})" stroke-width="${coreW}" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-tight)" opacity="0.96" />
      <path d="${pathD}" fill="url(#${p}-fur)" />
    `;
  }

  function openEye(p, cx, cy, idPrefix, scale) {
    const s = scale || 1;
    const rx = 19.2 * s;
    const ry = 20.4 * s;
    const prx = 9.4 * s;
    const pry = 11.4 * s;
    return `
      <g class="koma-eye-open ${idPrefix}" transform="translate(${cx}, ${cy})">
        <ellipse cx="0" cy="1" rx="${rx + 5.5}" ry="${ry + 5.5}" fill="url(#${p}-eye-halo)" />
        <ellipse cx="0" cy="0" rx="${rx}" ry="${ry}" fill="url(#${p}-iris)" />

        <path d="M ${-rx * 0.92} ${-ry * 0.14} A ${rx} ${ry} 0 0 1 ${rx * 0.92} ${-ry * 0.14} Q 0 ${-ry * 0.44} ${-rx * 0.92} ${-ry * 0.14} Z" fill="#001A4D" opacity="0.52" />

        <path d="M ${-rx * 0.72} ${ry * 0.34} Q 0 ${ry * 1.12} ${rx * 0.72} ${ry * 0.34} Q 0 ${ry * 0.72} ${-rx * 0.72} ${ry * 0.34} Z" fill="#A6FFFF" opacity="0.86" />

        <g class="koma-pupil">
          <ellipse cx="0" cy="-1.2" rx="${prx}" ry="${pry}" fill="#050B1F" />
          <ellipse cx="0" cy="-1.2" rx="${prx * 1.08}" ry="${pry * 1.08}" fill="none" stroke="#0052CC" stroke-width="1.2" opacity="0.45" />

          <ellipse cx="${-5.8 * s}" cy="${-7.2 * s}" rx="${4.9 * s}" ry="${5.2 * s}" fill="#FFFFFF" />

          <circle cx="${5.6 * s}" cy="${4.6 * s}" r="${2.3 * s}" fill="#FFFFFF" opacity="0.96" />

          <circle cx="${-2.4 * s}" cy="${6.9 * s}" r="${1.25 * s}" fill="#D4FFFF" opacity="0.85" />
        </g>

        <ellipse cx="0" cy="0" rx="${rx}" ry="${ry}" fill="none" stroke="#030208" stroke-width="1.4" opacity="0.72" />
      </g>
    `;
  }

  function happyArcEye(p, cx, cy, idPrefix, flip) {
    const dir = flip ? -1 : 1;
    return `
      <g class="koma-eye-arc ${idPrefix}" transform="translate(${cx}, ${cy}) scale(${dir}, 1)">
        <path d="M -16 3 Q 0 -10 16 4 Q 0 -3.5 -16 3 Z" fill="url(#${p}-closed-eye)" filter="url(#${p}-cyan-glow)" />
        <path d="M -13 1.5 Q 0 -7.2 13 2.2" fill="none" stroke="#BDF8FF" stroke-width="1.4" stroke-linecap="round" opacity="0.9" />
      </g>
    `;
  }

  function sleepArcEye(p, cx, cy, rot) {
    return `
      <g transform="translate(${cx}, ${cy}) rotate(${rot || 0})">
        <path d="M -14 -2 Q 0 8 14 -2 Q 0 3.2 -14 -2 Z" fill="url(#${p}-closed-eye)" filter="url(#${p}-cyan-glow)" opacity="0.88" />
      </g>
    `;
  }

  function chestHeart(p, cx, cy, scale) {
    const s = scale || 1;
    return `
      <g class="koma-heart" transform="translate(${cx}, ${cy}) scale(${s})">
        <path
          d="M 0 11.5 C -2 9.4 -13.5 1.8 -13.5 -5.4 C -13.5 -10.5 -9.4 -13.8 -4.8 -13.8 C -2.1 -13.8 -0.4 -12.1 0 -10.3 C 0.4 -12.1 2.1 -13.8 4.8 -13.8 C 9.4 -13.8 13.5 -10.5 13.5 -5.4 C 13.5 1.8 2 9.4 0 11.5 Z"
          fill="#FFFFFF"
          filter="url(#${p}-heart-glow)"
        />
      </g>
    `;
  }

  function toeBeans(p, cx, cy, rot, scale) {
    const s = scale || 1;
    return `
      <g transform="translate(${cx}, ${cy}) rotate(${rot || 0}) scale(${s})" filter="url(#${p}-pink-glow)">

        <path d="M 0 -4.8 C 4.8 -4.8 7.6 -0.8 6.8 3.2 C 6.2 6.0 3.0 6.8 0 6.0 C -3.0 6.8 -6.2 6.0 -6.8 3.2 C -7.6 -0.8 -4.8 -4.8 0 -4.8 Z" fill="url(#${p}-bean-pink)" />

        <ellipse cx="-8.6" cy="-5.2" rx="2.7" ry="3.6" transform="rotate(-24 -8.6 -5.2)" fill="url(#${p}-bean-pink)" />
        <ellipse cx="-3.3" cy="-9.6" rx="2.7" ry="3.7" transform="rotate(-8 -3.3 -9.6)" fill="url(#${p}-bean-pink)" />
        <ellipse cx="3.3" cy="-9.6" rx="2.7" ry="3.7" transform="rotate(8 3.3 -9.6)" fill="url(#${p}-bean-pink)" />
        <ellipse cx="8.6" cy="-5.2" rx="2.7" ry="3.6" transform="rotate(24 8.6 -5.2)" fill="url(#${p}-bean-pink)" />
      </g>
    `;
  }

  const HEAD_SILHOUETTE =
    'M 122 52 ' +
    'C 150 52 172 64 179 84 ' +
    'C 182 92 183 99 182 104 ' +
    'L 193 111 L 181 116 ' + // Right cheek tuft 1
    'L 188 123 L 175 124 ' + // Right cheek tuft 2
    'C 167 136 147 142 122 142 ' +
    'C 97 142 77 136 69 124 ' +
    'L 56 123 L 63 116 ' +   // Left cheek tuft 2
    'L 51 111 L 62 104 ' +   // Left cheek tuft 1
    'C 61 99 62 92 65 84 ' +
    'C 72 64 94 52 122 52 Z';

  const EAR_LEFT_OUTER = 'M 67 86 C 57 62 54 36 62 24 C 73 20 96 34 110 56 C 94 61 78 72 67 86 Z';
  const EAR_LEFT_INNER = 'M 71 76 C 65 59 64 41 68 33 C 76 32 91 42 101 56 C 89 60 79 67 71 76 Z';

  const EAR_RIGHT_OUTER = 'M 177 86 C 187 62 190 36 182 24 C 171 20 148 34 134 56 C 150 61 166 72 177 86 Z';
  const EAR_RIGHT_INNER = 'M 173 76 C 179 59 180 41 176 33 C 168 32 153 42 143 56 C 155 60 165 67 173 76 Z';

  const BODY_SEATED =
    'M 90 134 ' +
    'C 76 154 64 178 65 204 ' +
    'C 66 220 77 228 96 228 ' +
    'L 148 228 ' +
    'C 167 228 178 220 179 204 ' +
    'C 180 178 168 154 154 134 Z';

  const TAIL_SEATED =
    'M 164 218 ' +
    'C 192 222 216 206 218 182 ' +
    'C 220 160 206 147 192 150 ' +
    'C 182 152 179 161 184 167 ' +
    'C 188 172 196 171 198 178 ' +
    'C 200 189 188 202 164 202 Z';

  function renderFrontHead(p, pose, headOpts) {
    const o = headOpts || {};
    const showPinkEars = pose !== 'back';
    const isSurprised = pose === 'surprised';
    const isHappy = pose === 'happy' || pose === 'celebrate';
    const isContent = pose === 'stretch' || pose === 'casting';
    const isWink = pose === 'wink';

    const staticRot =
      o.rot !== undefined
        ? o.rot
        : pose === 'curious'
          ? 16
          : pose === 'wave'
            ? -5
            : pose === 'wink'
              ? -3
              : 0;
    const headTransform = staticRot !== 0 ? ` transform="rotate(${staticRot} 122 126)"` : '';

    let eyesMarkup = '';
    if (pose === 'back') {
      eyesMarkup = '';
    } else if (isHappy || isContent) {
      eyesMarkup = `
        ${happyArcEye(p, 94, 108, 'koma-eye-l', false)}
        ${happyArcEye(p, 150, 108, 'koma-eye-r', true)}
      `;
    } else if (isWink) {
      eyesMarkup = `
        ${openEye(p, 93, 108, 'koma-eye-l', 1.02)}
        ${happyArcEye(p, 150, 110, 'koma-eye-r', true)}
      `;
    } else if (isSurprised) {
      eyesMarkup = `
        ${openEye(p, 93, 106, 'koma-eye-l', 1.07)}
        ${openEye(p, 151, 106, 'koma-eye-r', 1.07)}
      `;
    } else {
      eyesMarkup = `
        ${openEye(p, 94, 108, 'koma-eye-l', 1.0)}
        ${openEye(p, 150, 108, 'koma-eye-r', 1.0)}

        <g class="koma-blink-lids" opacity="0">
          ${happyArcEye(p, 94, 110, 'koma-blink-l', false)}
          ${happyArcEye(p, 150, 110, 'koma-blink-r', true)}
        </g>
      `;
    }

    let mouthMarkup = '';
    if (pose !== 'back') {
      const nose = `<path d="M 118 118.2 L 126 118.2 Q 124 123.4 122 123.6 Q 120 123.4 118 118.2 Z" fill="#FF3B7F" />`;
      if (isHappy) {
        mouthMarkup = `
          ${nose}
          <path d="M 115.2 126.8 Q 122 124.8 128.8 126.8 C 129.4 135 125.8 138.6 122 138.6 C 118.2 138.6 114.6 135 115.2 126.8 Z" fill="url(#${p}-mouth-pink)" filter="url(#${p}-pink-glow)" />
          <ellipse cx="122" cy="134.8" rx="4.2" ry="2.4" fill="#FF89B7" opacity="0.72" />
        `;
      } else if (isSurprised) {
        mouthMarkup = `
          ${nose}
          <ellipse cx="122" cy="132" rx="5.2" ry="6.8" fill="url(#${p}-mouth-pink)" filter="url(#${p}-pink-glow)" />
          <ellipse cx="122" cy="133.6" rx="3.1" ry="3.4" fill="#FF84B4" opacity="0.65" />
        `;
      } else {
        mouthMarkup = `
          ${nose}
          <path d="M 117.5 126 Q 120 128.4 122 126.4 Q 124 128.4 126.5 126" fill="none" stroke="#FF2E7A" stroke-width="1.35" stroke-linecap="round" opacity="0.32" />
        `;
      }
    }

    return `
      <g class="koma-head" data-pivot="122,126"${headTransform}>

        <g class="koma-ear-l" data-pivot="88,68">
          <path d="${EAR_LEFT_OUTER}" fill="none" stroke="url(#${p}-rim-aura)" stroke-width="9.0" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-wide)" opacity="0.74" />
          <path d="${EAR_LEFT_OUTER}" fill="none" stroke="url(#${p}-rim-core)" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-tight)" opacity="0.98" />
        </g>
        <g class="koma-ear-r" data-pivot="156,68">
          <path d="${EAR_RIGHT_OUTER}" fill="none" stroke="url(#${p}-rim-aura)" stroke-width="9.0" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-wide)" opacity="0.74" />
          <path d="${EAR_RIGHT_OUTER}" fill="none" stroke="url(#${p}-rim-core)" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-tight)" opacity="0.98" />
        </g>
        <path d="${HEAD_SILHOUETTE}" fill="none" stroke="url(#${p}-rim-aura)" stroke-width="9.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-wide)" opacity="0.74" />
        <path d="${HEAD_SILHOUETTE}" fill="none" stroke="url(#${p}-rim-core)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-tight)" opacity="0.98" />

        <g class="koma-ear-l" data-pivot="88,68">
          <path d="${EAR_LEFT_OUTER}" fill="url(#${p}-fur)" />
          ${
            showPinkEars
              ? `
                <path d="${EAR_LEFT_INNER}" fill="url(#${p}-ear-pink)" />
                <path d="M 80 73 L 76 62 L 85 67 L 85 57 L 93 64 L 97 54 L 103 60 Z" fill="#050308" />
              `
              : ''
          }
        </g>
        <g class="koma-ear-r" data-pivot="156,68">
          <path d="${EAR_RIGHT_OUTER}" fill="url(#${p}-fur)" />
          ${
            showPinkEars
              ? `
                <path d="${EAR_RIGHT_INNER}" fill="url(#${p}-ear-pink)" />
                <path d="M 164 73 L 168 62 L 159 67 L 159 57 L 151 64 L 147 54 L 141 60 Z" fill="#050308" />
              `
              : ''
          }
        </g>
        <path d="${HEAD_SILHOUETTE}" fill="url(#${p}-fur)" />

        <path d="M 103 53.5 Q 122 49.5 141 53.5" fill="none" stroke="#FFE89E" stroke-width="1.7" stroke-linecap="round" opacity="0.72" />

        <g class="koma-face">
          ${eyesMarkup}
          ${mouthMarkup}
        </g>
      </g>
    `;
  }

  function renderFrontSeatedPose(p, pose) {
    const isBack = pose === 'back';
    const isWave = pose === 'wave';
    const isSurprised = pose === 'surprised';
    const isCasting = pose === 'casting';
    const isWorking = pose === 'working';
    const isHappy = pose === 'happy';

    const bodyDetailLines = isBack
      ? `

        <path d="M 85 184 C 81 198 83 214 91 224" fill="none" stroke="#FF2A7A" stroke-width="1.8" stroke-linecap="round" opacity="0.58" />
        <path d="M 159 184 C 163 198 161 214 153 224" fill="none" stroke="#FF2A7A" stroke-width="1.8" stroke-linecap="round" opacity="0.58" />
      `
      : `

        <path d="M 88 176 C 85 196 89 216 97 226" fill="none" stroke="#FF2474" stroke-width="1.8" stroke-linecap="round" opacity="0.62" />
        <path d="M 156 176 C 159 196 155 216 147 226" fill="none" stroke="#FF2474" stroke-width="1.8" stroke-linecap="round" opacity="0.62" />
        <path d="M 112 198 C 112 212 113 222 115 227" fill="none" stroke="#FF2474" stroke-width="1.35" stroke-linecap="round" opacity="0.45" />
        <path d="M 132 198 C 132 212 131 222 129 227" fill="none" stroke="#FF2474" stroke-width="1.35" stroke-linecap="round" opacity="0.45" />
        ${chestHeart(p, 122, 162, 1.02)}
      `;

    const wavingPaw = isWave
      ? `
        <g class="koma-wave-paw" data-pivot="154,172">
          ${rimmedShape(
            p,
            'M 146 176 C 154 156 164 134 173 121 C 182 108 202 110 207 125 C 213 142 199 169 178 186 C 166 196 150 190 146 176 Z',
            { auraWidth: 8.6, coreWidth: 4.2 },
          )}
          ${toeBeans(p, 187, 136, 18, 1.12)}
        </g>
      `
      : '';

    const fxMarkup = (() => {
      if (isSurprised) {
        return `
          <g class="koma-fx-alert" filter="url(#${p}-pink-glow)">
            <path d="M 194 74 L 210 52" stroke="#FF1E6E" stroke-width="6.5" stroke-linecap="round" />
            <path d="M 203 91 L 226 83" stroke="#FF1E6E" stroke-width="6.5" stroke-linecap="round" />
            <path d="M 201 108 L 222 113" stroke="#FF1E6E" stroke-width="6.0" stroke-linecap="round" />
          </g>
        `;
      }
      if (isCasting) {
        return `
          <g class="koma-fx-orbit">
            <ellipse cx="128" cy="144" rx="98" ry="30" transform="rotate(-18 128 144)" fill="none" stroke="url(#${p}-orbit)" stroke-width="3.2" filter="url(#${p}-pink-glow)" opacity="0.88" />
            <ellipse cx="128" cy="144" rx="98" ry="30" transform="rotate(-18 128 144)" fill="none" stroke="#E0F9FF" stroke-width="1.2" opacity="0.7" />
            <g class="koma-spark-1" transform="translate(36, 98)" filter="url(#${p}-cyan-glow)">
              <path d="M 0 -12 L 2.8 -2.8 L 12 0 L 2.8 2.8 L 0 12 L -2.8 2.8 L -12 0 L -2.8 -2.8 Z" fill="#FFFFFF" />
            </g>
            <g class="koma-spark-2" transform="translate(216, 84)" filter="url(#${p}-pink-glow)">
              <path d="M 0 -9 L 2.2 -2.2 L 9 0 L 2.2 2.2 L 0 9 L -2.2 2.2 L -9 0 L -2.2 -2.2 Z" fill="#E879F9" />
            </g>
            <g class="koma-spark-3" transform="translate(224, 178)" filter="url(#${p}-cyan-glow)">
              <path d="M 0 -10 L 2.4 -2.4 L 10 0 L 2.4 2.4 L 0 10 L -2.4 2.4 L -10 0 L -2.4 -2.4 Z" fill="#38F9FF" />
            </g>
            <g class="koma-spark-4" transform="translate(30, 194)" filter="url(#${p}-pink-glow)">
              <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill="#F472B6" />
            </g>
          </g>
        `;
      }
      if (isWorking) {
        return `
          <g class="koma-fx-work">

            <g class="koma-work-chip" transform="translate(196, 62)" filter="url(#${p}-cyan-glow)">
              <rect x="-14" y="-12" width="28" height="24" rx="4" fill="#0B1226" stroke="#38F9FF" stroke-width="2" />
              <line x1="-8" y1="-5" x2="8" y2="-5" stroke="#38F9FF" stroke-width="2" stroke-linecap="round" />
              <line x1="-8" y1="1" x2="5" y2="1" stroke="#FF2E7A" stroke-width="2" stroke-linecap="round" />
              <line x1="-8" y1="7" x2="8" y2="7" stroke="#FFD166" stroke-width="2" stroke-linecap="round" />
            </g>
            <circle class="koma-work-dot-1" cx="42" cy="78" r="3.5" fill="#38F9FF" filter="url(#${p}-cyan-glow)" />
            <circle class="koma-work-dot-2" cx="218" cy="112" r="2.8" fill="#FFD166" filter="url(#${p}-pink-glow)" />
          </g>
        `;
      }
      if (isHappy) {
        return `
          <g class="koma-fx-hearts">
            <path class="koma-float-heart-1" d="M 206 86 C 204 84 196 79 196 74 C 196 70.5 198.8 68.2 202 68.2 C 204 68.2 205.4 69.4 206 70.8 C 206.6 69.4 208 68.2 210 68.2 C 213.2 68.2 216 70.5 216 74 C 216 79 208 84 206 86 Z" fill="#FF2474" filter="url(#${p}-pink-glow)" />
            <path class="koma-float-heart-2" d="M 44 74 C 42.8 72.8 38 69.8 38 66.8 C 38 64.6 39.7 63.2 41.6 63.2 C 42.8 63.2 43.6 64 44 64.8 C 44.4 64 45.2 63.2 46.4 63.2 C 48.3 63.2 50 64.6 50 66.8 C 50 69.8 45.2 72.8 44 74 Z" fill="#FF6EA6" filter="url(#${p}-pink-glow)" opacity="0.85" />
          </g>
        `;
      }
      return '';
    })();

    return `
      <g class="koma-root-group" data-pivot="122,226">
        ${isCasting ? fxMarkup : ''}

        <g class="koma-tail" data-pivot="166,210">
          ${rimmedShape(p, TAIL_SEATED, { auraWidth: 8.6, coreWidth: 4.2, grad: `${p}-rim-diag` })}
        </g>

        <g class="koma-body" data-pivot="122,226">
          ${rimmedShape(p, BODY_SEATED, { auraWidth: 9.0, coreWidth: 4.3 })}
          ${bodyDetailLines}
        </g>

        ${renderFrontHead(p, pose)}

        ${wavingPaw}

        ${!isCasting ? fxMarkup : ''}
      </g>
    `;
  }

  function renderPeekPose(p) {
    return `
      <g class="koma-root-group" data-pivot="128,210">

        <g class="koma-tail" data-pivot="188,184">
          ${rimmedShape(
            p,
            'M 184 196 C 216 196 234 176 234 146 C 234 118 214 102 194 105 C 181 107 178 119 186 125 C 193 130 205 127 207 142 C 209 162 196 176 178 178 Z',
            { auraWidth: 8.6, coreWidth: 4.2 },
          )}
        </g>

        <g class="koma-body" data-pivot="128,205">
          ${rimmedShape(
            p,
            'M 54 194 C 54 150 86 124 134 124 C 178 124 206 150 206 188 C 206 206 192 212 170 212 L 82 212 C 62 212 54 205 54 194 Z',
            { auraWidth: 9.0, coreWidth: 4.3 },
          )}
        </g>

        <g transform="translate(4, 34)">
          ${renderFrontHead(p, 'idle')}
        </g>

        <g class="koma-paws">
          ${rimmedShape(
            p,
            'M 42 196 C 42 178 58 170 82 170 C 102 170 116 178 116 194 C 116 208 102 214 78 214 C 54 214 42 208 42 196 Z',
            { auraWidth: 7.4, coreWidth: 3.6 },
          )}
          <path d="M 66 198 C 66 205 68 210 70 212 M 84 196 C 85 204 86 210 88 212" fill="none" stroke="#FF2474" stroke-width="1.5" stroke-linecap="round" opacity="0.55" />

          ${rimmedShape(
            p,
            'M 134 194 C 134 178 148 170 168 170 C 192 170 208 178 208 196 C 208 208 196 214 172 214 C 148 214 134 208 134 194 Z',
            { auraWidth: 7.4, coreWidth: 3.6 },
          )}
          <path d="M 164 196 C 163 204 162 210 160 212 M 182 198 C 182 205 180 210 178 212" fill="none" stroke="#FF2474" stroke-width="1.5" stroke-linecap="round" opacity="0.55" />
        </g>
      </g>
    `;
  }

  function renderSleepPose(p) {
    return `
      <g class="koma-root-group" data-pivot="128,200">

        <g class="koma-body" data-pivot="128,196">
          ${rimmedShape(
            p,
            'M 64 188 C 58 140 94 102 152 104 C 204 106 234 142 232 182 C 230 210 198 220 150 220 C 102 220 68 212 64 188 Z',
            { auraWidth: 9.2, coreWidth: 4.4 },
          )}

          <path d="M 148 166 C 154 134 184 128 206 144" fill="none" stroke="#FF2474" stroke-width="1.8" stroke-linecap="round" opacity="0.55" />
        </g>

        <g class="koma-head" data-pivot="102,152" transform="translate(-24, 34) rotate(-14 122 108)">
          <path d="${EAR_LEFT_OUTER}" fill="none" stroke="url(#${p}-rim-aura)" stroke-width="8.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-wide)" opacity="0.72" />
          <path d="${EAR_LEFT_OUTER}" fill="none" stroke="url(#${p}-rim-core)" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-tight)" opacity="0.96" />
          <path d="${EAR_RIGHT_OUTER}" fill="none" stroke="url(#${p}-rim-aura)" stroke-width="8.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-wide)" opacity="0.72" />
          <path d="${EAR_RIGHT_OUTER}" fill="none" stroke="url(#${p}-rim-core)" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-tight)" opacity="0.96" />
          <path d="${HEAD_SILHOUETTE}" fill="none" stroke="url(#${p}-rim-aura)" stroke-width="8.8" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-wide)" opacity="0.72" />
          <path d="${HEAD_SILHOUETTE}" fill="none" stroke="url(#${p}-rim-core)" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#${p}-bloom-tight)" opacity="0.96" />

          <path d="${EAR_LEFT_OUTER}" fill="url(#${p}-fur)" />
          <path d="${EAR_LEFT_INNER}" fill="url(#${p}-ear-pink)" />
          <path d="M 80 73 L 76 62 L 85 67 L 85 57 L 93 64 L 97 54 L 103 60 Z" fill="#050308" />
          <path d="${EAR_RIGHT_OUTER}" fill="url(#${p}-fur)" />
          <path d="${EAR_RIGHT_INNER}" fill="url(#${p}-ear-pink)" />
          <path d="M 164 73 L 168 62 L 159 67 L 159 57 L 151 64 L 147 54 L 141 60 Z" fill="#050308" />
          <path d="${HEAD_SILHOUETTE}" fill="url(#${p}-fur)" />

          ${sleepArcEye(p, 95, 112, 4)}
          ${sleepArcEye(p, 149, 112, -4)}
          <path d="M 118 119 L 126 119 Q 124 124 122 124.2 Q 120 124 118 119 Z" fill="#FF3B7F" />
        </g>

        <g class="koma-tail" data-pivot="206,184">
          ${rimmedShape(
            p,
            'M 54 196 C 54 182 72 178 102 182 C 118 184 126 194 124 204 C 122 214 96 216 74 214 C 58 212 54 206 54 196 Z',
            { auraWidth: 7.4, coreWidth: 3.5 },
          )}
          ${rimmedShape(
            p,
            'M 102 198 C 102 184 124 180 156 186 C 186 192 214 182 222 162 C 230 166 234 186 220 204 C 202 224 152 226 118 216 C 106 212 102 206 102 198 Z',
            { auraWidth: 8.2, coreWidth: 3.9 },
          )}
        </g>

        <g class="koma-fx-zzz" font-family="JetBrains Mono, monospace" font-weight="800">
          <text class="koma-z1" x="172" y="88" font-size="18" fill="#38F9FF" filter="url(#${p}-cyan-glow)">z</text>
          <text class="koma-z2" x="192" y="64" font-size="24" fill="#FF5C93" filter="url(#${p}-pink-glow)">Z</text>
          <text class="koma-z3" x="214" y="42" font-size="16" fill="#FFD166" filter="url(#${p}-pink-glow)">z</text>
        </g>
      </g>
    `;
  }

  function renderStretchPose(p) {
    return `
      <g class="koma-root-group" data-pivot="132,216">

        <g class="koma-tail" data-pivot="196,120">
          ${rimmedShape(
            p,
            'M 196 124 C 228 118 242 88 232 60 C 223 36 196 26 176 34 C 164 40 162 56 172 62 C 182 68 194 60 202 68 C 212 78 206 102 186 108 Z',
            { auraWidth: 8.6, coreWidth: 4.2 },
          )}
        </g>

        <g class="koma-body" data-pivot="154,210">
          ${rimmedShape(
            p,
            'M 26 206 ' +
              'C 26 194 42 186 72 178 ' +
              'C 104 168 122 132 146 106 ' +
              'C 164 86 194 86 208 112 ' +
              'C 220 134 216 178 214 206 ' +
              'C 214 216 202 220 190 220 ' +
              'C 178 220 174 212 178 202 ' +
              'C 184 188 182 170 172 162 ' +
              'C 156 196 126 218 78 220 ' +
              'L 42 220 C 30 220 26 214 26 206 Z',
            { auraWidth: 9.0, coreWidth: 4.3 },
          )}

          <path d="M 52 216 C 68 206 86 196 106 192" fill="none" stroke="#FF2474" stroke-width="1.6" stroke-linecap="round" opacity="0.58" />
        </g>

        <g transform="translate(-32, 66) scale(0.89)">
          ${renderFrontHead(p, 'stretch', { rot: 0 })}
        </g>
      </g>
    `;
  }

  function renderCelebratePose(p) {
    return `
      <g class="koma-root-group" data-pivot="128,176">

        <g class="koma-fx-celebrate">
          <g class="koma-spark-1" transform="translate(36, 54)" filter="url(#${p}-cyan-glow)">
            <path d="M 0 -11 L 2.6 -2.6 L 11 0 L 2.6 2.6 L 0 11 L -2.6 2.6 L -11 0 L -2.6 -2.6 Z" fill="#38F9FF" />
          </g>
          <g class="koma-spark-2" transform="translate(220, 48)" filter="url(#${p}-pink-glow)">
            <path d="M 0 -10 L 2.4 -2.4 L 10 0 L 2.4 2.4 L 0 10 L -2.4 2.4 L -10 0 L -2.4 -2.4 Z" fill="#FFD166" />
          </g>
          <g class="koma-spark-3" transform="translate(226, 174)" filter="url(#${p}-pink-glow)">
            <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill="#FF2E7A" />
          </g>
          <path class="koma-float-heart-1" d="M 192 34 C 190.5 32.5 184 28 184 24 C 184 21.2 186.2 19.2 188.8 19.2 C 190.4 19.2 191.5 20.2 192 21.4 C 192.5 20.2 193.6 19.2 195.2 19.2 C 197.8 19.2 200 21.2 200 24 C 200 28 193.5 32.5 192 34 Z" fill="#FF2E7A" filter="url(#${p}-pink-glow)" />
        </g>

        <g class="koma-tail" data-pivot="92,196">
          ${rimmedShape(
            p,
            'M 96 206 C 64 218 32 206 28 180 C 24 156 42 140 58 144 C 68 146 72 158 64 164 C 58 168 50 166 48 176 C 46 188 64 196 92 190 Z',
            { auraWidth: 8.4, coreWidth: 4.0 },
          )}
        </g>

        <g class="koma-body" data-pivot="132,174">
          ${rimmedShape(
            p,
            'M 94 130 C 82 154 84 188 98 214 C 108 232 132 232 144 216 C 170 212 186 192 184 164 C 182 144 170 132 156 128 Z',
            { auraWidth: 8.8, coreWidth: 4.2 },
          )}
          ${chestHeart(p, 138, 166, 1.0)}
        </g>

        <g class="koma-paw-l" data-pivot="102,164">
          ${rimmedShape(
            p,
            'M 104 174 C 86 168 68 158 61 142 C 56 128 71 118 85 128 C 98 138 108 156 112 168 Z',
            { auraWidth: 7.8, coreWidth: 3.8 },
          )}
          ${toeBeans(p, 77, 144, -24, 0.96)}
        </g>

        <g class="koma-paw-r" data-pivot="166,154">
          ${rimmedShape(
            p,
            'M 158 162 C 172 148 186 128 194 112 C 200 100 218 104 220 118 C 222 134 204 156 182 172 C 172 178 160 172 158 162 Z',
            { auraWidth: 7.8, coreWidth: 3.8 },
          )}
          ${toeBeans(p, 204, 124, 24, 0.98)}
        </g>

        <g transform="translate(8, -10)">
          ${renderFrontHead(p, 'happy', { rot: -4 })}
        </g>
      </g>
    `;
  }

  function buildSvgMarkup(pose, prefix) {
    const p = prefix || 'koma';
    let scene = '';
    if (pose === 'peek') {
      scene = renderPeekPose(p);
    } else if (pose === 'sleep') {
      scene = renderSleepPose(p);
    } else if (pose === 'stretch') {
      scene = renderStretchPose(p);
    } else if (pose === 'celebrate') {
      scene = renderCelebratePose(p);
    } else {
      scene = renderFrontSeatedPose(p, pose);
    }

    return `
      <svg class="koma-svg" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" overflow="visible">
        ${buildDefs(p)}
        ${scene}
      </svg>
    `;
  }

  function buildPoseTimeline(svgRoot, pose, duration) {
    const d = duration || 2.4;
    const tl = global.gsap.timeline({ paused: true });

    const q = (sel) => svgRoot.querySelector(sel);
    const qAll = (sel) => Array.from(svgRoot.querySelectorAll(sel));

    const rootG = q('.koma-root-group');
    const body = q('.koma-body');
    const head = q('.koma-head');
    const tail = q('.koma-tail');
    const earL = qAll('.koma-ear-l');
    const earR = qAll('.koma-ear-r');
    const heart = q('.koma-heart');
    const wavePaw = q('.koma-wave-paw');
    const pawL = q('.koma-paw-l');
    const pawR = q('.koma-paw-r');
    const blinkLids = q('.koma-blink-lids');
    const openEyes = qAll('.koma-eye-open');

    if (body && pose !== 'celebrate' && pose !== 'stretch') {
      const origin = pivotOf(body, '122 226').replace(',', ' ');
      const amp = pose === 'sleep' ? 0.038 : 0.024;
      tl.fromTo(
        body,
        { scaleX: 1, scaleY: 1, svgOrigin: origin },
        {
          keyframes: [
            { scaleX: 1 + amp, scaleY: 1 - amp * 0.9, duration: d * 0.5, ease: 'sine.inOut' },
            { scaleX: 1, scaleY: 1, duration: d * 0.5, ease: 'sine.inOut' },
          ],
        },
        0,
      );
    }

    if (tail && pose !== 'sleep') {
      const origin = pivotOf(tail, '166 210').replace(',', ' ');
      const swing = pose === 'celebrate' || pose === 'happy' ? 11 : pose === 'stretch' ? 8 : 6.5;
      tl.fromTo(
        tail,
        { rotation: 0, svgOrigin: origin },
        {
          keyframes: [
            { rotation: swing, duration: d * 0.25, ease: 'sine.out' },
            { rotation: -swing * 0.85, duration: d * 0.5, ease: 'sine.inOut' },
            { rotation: 0, duration: d * 0.25, ease: 'sine.in' },
          ],
        },
        0,
      );
    }

    if (heart) {
      const fast = pose === 'happy' || pose === 'celebrate' || pose === 'casting' || pose === 'working';
      const beatPeak = fast ? 1.15 : 1.09;
      tl.fromTo(
        heart,
        { scale: 1, transformOrigin: 'center center' },
        {
          keyframes: [
            { scale: beatPeak, duration: d * 0.14, ease: 'power2.out' },
            { scale: 0.98, duration: d * 0.12, ease: 'power2.in' },
            { scale: beatPeak * 0.95, duration: d * 0.12, ease: 'power2.out' },
            { scale: 1, duration: d * 0.62, ease: 'sine.inOut' },
          ],
        },
        0,
      );
    }

    if (earR.length > 0 && pose !== 'sleep') {
      const origin = pivotOf(earR[0], '156 68').replace(',', ' ');
      tl.fromTo(
        earR,
        { rotation: 0, svgOrigin: origin },
        {
          keyframes: [
            { rotation: 0, duration: d * 0.56 },
            { rotation: 7.5, duration: d * 0.06, ease: 'power2.out' },
            { rotation: -2.5, duration: d * 0.05, ease: 'power2.inOut' },
            { rotation: 4, duration: d * 0.05, ease: 'power2.out' },
            { rotation: 0, duration: d * 0.08, ease: 'sine.out' },
            { rotation: 0, duration: d * 0.2 },
          ],
        },
        0,
      );
    }
    if (earL.length > 0 && pose !== 'sleep') {
      const origin = pivotOf(earL[0], '88 68').replace(',', ' ');
      tl.fromTo(
        earL,
        { rotation: 0, svgOrigin: origin },
        {
          keyframes: [
            { rotation: 0, duration: d * 0.22 },
            { rotation: -4, duration: d * 0.28, ease: 'sine.inOut' },
            { rotation: 0, duration: d * 0.5, ease: 'sine.inOut' },
          ],
        },
        0,
      );
    }

    if (blinkLids && openEyes.length > 0) {
      const blinkAt = d * 0.42;
      tl.to(openEyes, { opacity: 0, duration: 0.04 }, blinkAt);
      tl.to(blinkLids, { opacity: 1, duration: 0.04 }, blinkAt);
      tl.to(blinkLids, { opacity: 0, duration: 0.05 }, blinkAt + 0.11);
      tl.to(openEyes, { opacity: 1, duration: 0.05 }, blinkAt + 0.11);
    }

    if (pose === 'idle' && head) {
      const hOrig = pivotOf(head, '122 126').replace(',', ' ');
      tl.fromTo(
        head,
        { y: 0, rotation: 0, svgOrigin: hOrig },
        {
          keyframes: [
            { y: 2.4, rotation: 1.8, duration: d * 0.5, ease: 'sine.inOut' },
            { y: 0, rotation: 0, duration: d * 0.5, ease: 'sine.inOut' },
          ],
        },
        0,
      );
    }

    if (pose === 'curious' && head) {
      const hOrig = pivotOf(head, '122 126').replace(',', ' ');
      tl.fromTo(
        head,
        { rotation: 15, y: 0, svgOrigin: hOrig },
        {
          keyframes: [
            { rotation: 21, y: 1.5, duration: d * 0.45, ease: 'sine.inOut' },
            { rotation: 13.5, y: -1, duration: d * 0.35, ease: 'sine.inOut' },
            { rotation: 15, y: 0, duration: d * 0.2, ease: 'sine.inOut' },
          ],
        },
        0,
      );
    }

    if (pose === 'wink' && head) {
      const hOrig = pivotOf(head, '122 126').replace(',', ' ');
      tl.fromTo(
        head,
        { rotation: -3, y: 0, svgOrigin: hOrig },
        {
          keyframes: [
            { rotation: -7, y: 2.5, duration: d * 0.38, ease: 'power2.out' },
            { rotation: -1.5, y: -1, duration: d * 0.34, ease: 'sine.inOut' },
            { rotation: -3, y: 0, duration: d * 0.28, ease: 'sine.inOut' },
          ],
        },
        0,
      );
    }

    if (pose === 'wave') {
      if (head) {
        const hOrig = pivotOf(head, '122 126').replace(',', ' ');
        tl.fromTo(
          head,
          { rotation: -6, y: 0, svgOrigin: hOrig },
          {
            keyframes: [
              { rotation: -10, y: -2, duration: d * 0.5, ease: 'sine.inOut' },
              { rotation: -6, y: 0, duration: d * 0.5, ease: 'sine.inOut' },
            ],
          },
          0,
        );
      }
      if (wavePaw) {
        const pOrig = pivotOf(wavePaw, '156 174').replace(',', ' ');
        tl.fromTo(
          wavePaw,
          { rotation: -6, svgOrigin: pOrig },
          {
            keyframes: [
              { rotation: 14, duration: d * 0.18, ease: 'sine.inOut' },
              { rotation: -10, duration: d * 0.18, ease: 'sine.inOut' },
              { rotation: 14, duration: d * 0.18, ease: 'sine.inOut' },
              { rotation: -10, duration: d * 0.18, ease: 'sine.inOut' },
              { rotation: -6, duration: d * 0.28, ease: 'sine.inOut' },
            ],
          },
          0,
        );
      }
    }

    if (pose === 'happy') {
      if (rootG) {
        const rOrig = pivotOf(rootG, '122 226').replace(',', ' ');
        tl.fromTo(
          rootG,
          { y: 0, scaleY: 1, scaleX: 1, svgOrigin: rOrig },
          {
            keyframes: [
              { y: 2, scaleY: 0.95, scaleX: 1.04, duration: d * 0.14, ease: 'power2.in' },
              { y: -9, scaleY: 1.04, scaleX: 0.97, duration: d * 0.22, ease: 'power2.out' },
              { y: 0, scaleY: 0.97, scaleX: 1.03, duration: d * 0.18, ease: 'power2.in' },
              { y: -4, scaleY: 1.02, scaleX: 0.99, duration: d * 0.2, ease: 'sine.out' },
              { y: 0, scaleY: 1, scaleX: 1, duration: d * 0.26, ease: 'sine.inOut' },
            ],
          },
          0,
        );
      }
      const h1 = q('.koma-float-heart-1');
      const h2 = q('.koma-float-heart-2');
      if (h1) {
        tl.fromTo(
          h1,
          { y: 4, opacity: 0.4, scale: 0.85, transformOrigin: 'center center' },
          {
            keyframes: [
              { y: -12, opacity: 1, scale: 1.12, duration: d * 0.55, ease: 'sine.out' },
              { y: 4, opacity: 0.4, scale: 0.85, duration: d * 0.45, ease: 'sine.in' },
            ],
          },
          0,
        );
      }
      if (h2) {
        tl.fromTo(
          h2,
          { y: -6, opacity: 0.9, scale: 1, transformOrigin: 'center center' },
          {
            keyframes: [
              { y: 6, opacity: 0.35, scale: 0.8, duration: d * 0.5, ease: 'sine.inOut' },
              { y: -6, opacity: 0.9, scale: 1, duration: d * 0.5, ease: 'sine.inOut' },
            ],
          },
          0,
        );
      }
    }

    if (pose === 'peek' && head) {
      const hOrig = pivotOf(head, '122 126').replace(',', ' ');
      tl.fromTo(
        head,
        { y: 0, rotation: 0, svgOrigin: hOrig },
        {
          keyframes: [
            { y: -5.5, rotation: 2.2, duration: d * 0.45, ease: 'sine.inOut' },
            { y: 1.2, rotation: -1.8, duration: d * 0.35, ease: 'sine.inOut' },
            { y: 0, rotation: 0, duration: d * 0.2, ease: 'sine.inOut' },
          ],
        },
        0,
      );
    }

    if (pose === 'sleep') {
      const z1 = q('.koma-z1');
      const z2 = q('.koma-z2');
      const z3 = q('.koma-z3');
      [
        [z1, 0, -10],
        [z2, 0.25, -14],
        [z3, 0.5, -12],
      ].forEach(([el, offset, dy]) => {
        if (!el) return;
        tl.fromTo(
          el,
          { y: 4, opacity: 0.35, scale: 0.88, transformOrigin: 'center center' },
          {
            keyframes: [
              { y: dy, opacity: 1, scale: 1.08, duration: d * 0.5, ease: 'sine.inOut' },
              { y: 4, opacity: 0.35, scale: 0.88, duration: d * 0.5, ease: 'sine.inOut' },
            ],
          },
          offset * 0.2,
        );
      });
    }

    if (pose === 'stretch' && rootG) {
      const rOrig = pivotOf(rootG, '132 216').replace(',', ' ');
      tl.fromTo(
        rootG,
        { scaleX: 1, scaleY: 1, svgOrigin: rOrig },
        {
          keyframes: [
            { scaleX: 1.06, scaleY: 0.94, duration: d * 0.45, ease: 'power2.inOut' },
            { scaleX: 1.07, scaleY: 0.93, duration: d * 0.15, ease: 'none' },
            { scaleX: 1, scaleY: 1, duration: d * 0.4, ease: 'power2.inOut' },
          ],
        },
        0,
      );
    }

    if (pose === 'surprised') {
      if (rootG) {
        const rOrig = pivotOf(rootG, '122 226').replace(',', ' ');
        tl.fromTo(
          rootG,
          { y: 0, scaleY: 1, scaleX: 1, svgOrigin: rOrig },
          {
            keyframes: [
              { y: -8, scaleY: 1.05, scaleX: 0.96, duration: d * 0.14, ease: 'power3.out' },
              { y: 1, scaleY: 0.97, scaleX: 1.03, duration: d * 0.12, ease: 'power2.in' },
              { y: -2, scaleY: 1.01, scaleX: 0.99, duration: d * 0.16, ease: 'sine.out' },
              { y: 0, scaleY: 1, scaleX: 1, duration: d * 0.58, ease: 'sine.inOut' },
            ],
          },
          0,
        );
      }
      const alertFx = q('.koma-fx-alert');
      if (alertFx) {
        tl.fromTo(
          alertFx,
          { scale: 0.92, opacity: 0.75, svgOrigin: '188 92' },
          {
            keyframes: [
              { scale: 1.14, opacity: 1, duration: d * 0.18, ease: 'back.out(2)' },
              { scale: 0.96, opacity: 0.85, duration: d * 0.32, ease: 'sine.inOut' },
              { scale: 1.08, opacity: 1, duration: d * 0.22, ease: 'sine.inOut' },
              { scale: 0.92, opacity: 0.75, duration: d * 0.28, ease: 'sine.inOut' },
            ],
          },
          0,
        );
      }
    }

    if (pose === 'casting') {
      if (rootG) {
        tl.fromTo(
          rootG,
          { y: 0 },
          {
            keyframes: [
              { y: -9, duration: d * 0.5, ease: 'sine.inOut' },
              { y: 0, duration: d * 0.5, ease: 'sine.inOut' },
            ],
          },
          0,
        );
      }
      qAll('.koma-spark-1, .koma-spark-2, .koma-spark-3, .koma-spark-4').forEach((sp, i) => {
        tl.fromTo(
          sp,
          { scale: 0.65, opacity: 0.55, rotation: 0, transformOrigin: 'center center' },
          {
            keyframes: [
              { scale: 1.22, opacity: 1, rotation: 45, duration: d * 0.5, ease: 'sine.inOut' },
              { scale: 0.65, opacity: 0.55, rotation: 90, duration: d * 0.5, ease: 'sine.inOut' },
            ],
          },
          (i % 2) * (d * 0.15),
        );
      });
    }

    if (pose === 'celebrate') {
      if (rootG) {
        const rOrig = pivotOf(rootG, '128 176').replace(',', ' ');
        tl.fromTo(
          rootG,
          { y: 4, rotation: -3, svgOrigin: rOrig },
          {
            keyframes: [
              { y: -12, rotation: 4, duration: d * 0.45, ease: 'sine.inOut' },
              { y: 4, rotation: -3, duration: d * 0.55, ease: 'sine.inOut' },
            ],
          },
          0,
        );
      }
      if (pawL) {
        tl.fromTo(
          pawL,
          { rotation: -6, svgOrigin: '102 158' },
          {
            keyframes: [
              { rotation: 10, duration: d * 0.5, ease: 'sine.inOut' },
              { rotation: -6, duration: d * 0.5, ease: 'sine.inOut' },
            ],
          },
          0,
        );
      }
      if (pawR) {
        tl.fromTo(
          pawR,
          { rotation: 6, svgOrigin: '166 154' },
          {
            keyframes: [
              { rotation: -12, duration: d * 0.5, ease: 'sine.inOut' },
              { rotation: 6, duration: d * 0.5, ease: 'sine.inOut' },
            ],
          },
          0,
        );
      }
      qAll('.koma-spark-1, .koma-spark-2, .koma-spark-3').forEach((sp, i) => {
        tl.fromTo(
          sp,
          { scale: 0.7, opacity: 0.6, rotation: 0, transformOrigin: 'center center' },
          {
            keyframes: [
              { scale: 1.25, opacity: 1, rotation: 45, duration: d * 0.5, ease: 'sine.inOut' },
              { scale: 0.7, opacity: 0.6, rotation: 90, duration: d * 0.5, ease: 'sine.inOut' },
            ],
          },
          i * 0.12,
        );
      });
    }

    if (pose === 'working') {
      if (head) {
        const hOrig = pivotOf(head, '122 126').replace(',', ' ');
        tl.fromTo(
          head,
          { rotation: 4, y: 1, svgOrigin: hOrig },
          {
            keyframes: [
              { rotation: 8, y: 2.5, duration: d * 0.5, ease: 'sine.inOut' },
              { rotation: 4, y: 1, duration: d * 0.5, ease: 'sine.inOut' },
            ],
          },
          0,
        );
      }
      const chip = q('.koma-work-chip');
      if (chip) {
        tl.fromTo(
          chip,
          { y: 0, rotation: -4, transformOrigin: 'center center' },
          {
            keyframes: [
              { y: -8, rotation: 4, duration: d * 0.5, ease: 'sine.inOut' },
              { y: 0, rotation: -4, duration: d * 0.5, ease: 'sine.inOut' },
            ],
          },
          0,
        );
      }
    }

    tl.to({}, { duration: 0.001 }, d - 0.001);
    return tl;
  }

  global.KomaRig = {
    POSES,
    buildSvgMarkup,
    buildPoseTimeline,
  };
})(window);
