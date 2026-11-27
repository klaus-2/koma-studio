import React, { useEffect, useId, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

import type { KomaPose } from '../../stores/koma-mascot-store';
import './KomaNekoRig.css';

export interface KomaNekoRigProps {
  pose?: KomaPose;
  size?: number | string;
  animated?: boolean;

  gazeX?: number;
  gazeY?: number;
  className?: string;
  label?: string;
}

const HEAD_SILHOUETTE =
  'M 122 52 C 150 52 172 64 179 84 C 182 92 183 99 182 104 L 193 111 L 181 116 L 188 123 L 175 124 C 167 136 147 142 122 142 C 97 142 77 136 69 124 L 56 123 L 63 116 L 51 111 L 62 104 C 61 99 62 92 65 84 C 72 64 94 52 122 52 Z';
const EAR_LEFT_OUTER = 'M 67 86 C 57 62 54 36 62 24 C 73 20 96 34 110 56 C 94 61 78 72 67 86 Z';
const EAR_LEFT_INNER = 'M 71 76 C 65 59 64 41 68 33 C 76 32 91 42 101 56 C 89 60 79 67 71 76 Z';
const EAR_RIGHT_OUTER = 'M 177 86 C 187 62 190 36 182 24 C 171 20 148 34 134 56 C 150 61 166 72 177 86 Z';
const EAR_RIGHT_INNER = 'M 173 76 C 179 59 180 41 176 33 C 168 32 153 42 143 56 C 155 60 165 67 173 76 Z';
const BODY_SEATED =
  'M 90 134 C 76 154 64 178 65 204 C 66 220 77 228 96 228 L 148 228 C 167 228 178 220 179 204 C 180 178 168 154 154 134 Z';
const TAIL_SEATED =
  'M 164 218 C 192 222 216 206 218 182 C 220 160 206 147 192 150 C 182 152 179 161 184 167 C 188 172 196 171 198 178 C 200 189 188 202 164 202 Z';

interface RimmedPathProps {
  p: string;
  d: string;
  auraWidth?: number;
  coreWidth?: number;
  diag?: boolean;
}

const RimmedPath: React.FC<RimmedPathProps> = ({
  p,
  d,
  auraWidth = 9.0,
  coreWidth = 4.3,
  diag = false,
}) => (
  <>
    <path
      d={d}
      fill="none"
      stroke={`url(#${p}-${diag ? 'rim-diag' : 'rim-aura'})`}
      strokeWidth={auraWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      filter={`url(#${p}-bloom-wide)`}
      opacity={0.72}
    />
    <path
      d={d}
      fill="none"
      stroke={`url(#${p}-rim-core)`}
      strokeWidth={coreWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      filter={`url(#${p}-bloom-tight)`}
      opacity={0.96}
    />
    <path d={d} fill={`url(#${p}-fur)`} />
  </>
);

const OpenEye: React.FC<{
  p: string;
  cx: number;
  cy: number;
  scale?: number;
  gazeX: number;
  gazeY: number;
}> = ({ p, cx, cy, scale = 1, gazeX, gazeY }) => {
  const rx = 19.2 * scale;
  const ry = 20.4 * scale;
  const prx = 9.4 * scale;
  const pry = 11.4 * scale;
  const px = Math.max(-4.2, Math.min(4.2, gazeX * 4.2));
  const py = Math.max(-3.6, Math.min(3.6, gazeY * 3.6));

  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <ellipse cx={0} cy={1} rx={rx + 5.5} ry={ry + 5.5} fill={`url(#${p}-eye-halo)`} />
      <ellipse cx={0} cy={0} rx={rx} ry={ry} fill={`url(#${p}-iris)`} />
      <path
        d={`M ${-rx * 0.92} ${-ry * 0.14} A ${rx} ${ry} 0 0 1 ${rx * 0.92} ${-ry * 0.14} Q 0 ${-ry * 0.44} ${-rx * 0.92} ${-ry * 0.14} Z`}
        fill="#001A4D"
        opacity={0.52}
      />
      <path
        d={`M ${-rx * 0.72} ${ry * 0.34} Q 0 ${ry * 1.12} ${rx * 0.72} ${ry * 0.34} Q 0 ${ry * 0.72} ${-rx * 0.72} ${ry * 0.34} Z`}
        fill="#A6FFFF"
        opacity={0.86}
      />
      <g transform={`translate(${px}, ${py})`}>
        <ellipse cx={0} cy={-1.2} rx={prx} ry={pry} fill="#050B1F" />
        <ellipse
          cx={0}
          cy={-1.2}
          rx={prx * 1.08}
          ry={pry * 1.08}
          fill="none"
          stroke="#0052CC"
          strokeWidth={1.2}
          opacity={0.45}
        />
        <ellipse cx={-5.8 * scale} cy={-7.2 * scale} rx={4.9 * scale} ry={5.2 * scale} fill="#FFFFFF" />
        <circle cx={5.6 * scale} cy={4.6 * scale} r={2.3 * scale} fill="#FFFFFF" opacity={0.96} />
        <circle cx={-2.4 * scale} cy={6.9 * scale} r={1.25 * scale} fill="#D4FFFF" opacity={0.85} />
      </g>
      <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="none" stroke="#030208" strokeWidth={1.4} opacity={0.72} />
    </g>
  );
};

const HappyArcEye: React.FC<{ p: string; cx: number; cy: number; flip?: boolean }> = ({
  p,
  cx,
  cy,
  flip = false,
}) => (
  <g transform={`translate(${cx}, ${cy}) scale(${flip ? -1 : 1}, 1)`}>
    <path
      d="M -16 3 Q 0 -10 16 4 Q 0 -3.5 -16 3 Z"
      fill={`url(#${p}-closed-eye)`}
      filter={`url(#${p}-cyan-glow)`}
    />
    <path
      d="M -13 1.5 Q 0 -7.2 13 2.2"
      fill="none"
      stroke="#BDF8FF"
      strokeWidth={1.4}
      strokeLinecap="round"
      opacity={0.9}
    />
  </g>
);

const SleepArcEye: React.FC<{ p: string; cx: number; cy: number; rot?: number }> = ({
  p,
  cx,
  cy,
  rot = 0,
}) => (
  <g transform={`translate(${cx}, ${cy}) rotate(${rot})`}>
    <path
      d="M -14 -2 Q 0 8 14 -2 Q 0 3.2 -14 -2 Z"
      fill={`url(#${p}-closed-eye)`}
      filter={`url(#${p}-cyan-glow)`}
      opacity={0.88}
    />
  </g>
);

const ChestHeart: React.FC<{ p: string; cx: number; cy: number; scale?: number }> = ({
  p,
  cx,
  cy,
  scale = 1,
}) => (
  <g transform={`translate(${cx}, ${cy}) scale(${scale})`}>
    <g className="koma-rig__heart">
      <path
        d="M 0 11.5 C -2 9.4 -13.5 1.8 -13.5 -5.4 C -13.5 -10.5 -9.4 -13.8 -4.8 -13.8 C -2.1 -13.8 -0.4 -12.1 0 -10.3 C 0.4 -12.1 2.1 -13.8 4.8 -13.8 C 9.4 -13.8 13.5 -10.5 13.5 -5.4 C 13.5 1.8 2 9.4 0 11.5 Z"
        fill="#FFFFFF"
        filter={`url(#${p}-heart-glow)`}
      />
    </g>
  </g>
);

const ToeBeans: React.FC<{ p: string; cx: number; cy: number; rot?: number; scale?: number }> = ({
  p,
  cx,
  cy,
  rot = 0,
  scale = 1,
}) => (
  <g transform={`translate(${cx}, ${cy}) rotate(${rot}) scale(${scale})`} filter={`url(#${p}-pink-glow)`}>
    <path
      d="M 0 -4.8 C 4.8 -4.8 7.6 -0.8 6.8 3.2 C 6.2 6.0 3.0 6.8 0 6.0 C -3.0 6.8 -6.2 6.0 -6.8 3.2 C -7.6 -0.8 -4.8 -4.8 0 -4.8 Z"
      fill={`url(#${p}-bean-pink)`}
    />
    <ellipse cx={-8.6} cy={-5.2} rx={2.7} ry={3.6} transform="rotate(-24 -8.6 -5.2)" fill={`url(#${p}-bean-pink)`} />
    <ellipse cx={-3.3} cy={-9.6} rx={2.7} ry={3.7} transform="rotate(-8 -3.3 -9.6)" fill={`url(#${p}-bean-pink)`} />
    <ellipse cx={3.3} cy={-9.6} rx={2.7} ry={3.7} transform="rotate(8 3.3 -9.6)" fill={`url(#${p}-bean-pink)`} />
    <ellipse cx={8.6} cy={-5.2} rx={2.7} ry={3.6} transform="rotate(24 8.6 -5.2)" fill={`url(#${p}-bean-pink)`} />
  </g>
);

const FrontHead: React.FC<{
  p: string;
  pose: KomaPose;
  blinking: boolean;
  gazeX: number;
  gazeY: number;
  rotOverride?: number;
}> = ({ p, pose, blinking, gazeX, gazeY, rotOverride }) => {
  const showPinkEars = pose !== 'back';
  const isSurprised = pose === 'surprised';
  const isHappy = pose === 'happy' || pose === 'celebrate';
  const isContent = pose === 'stretch' || pose === 'casting';
  const isWink = pose === 'wink';

  const rot =
    rotOverride !== undefined
      ? rotOverride
      : pose === 'curious'
        ? 16
        : pose === 'wave'
          ? -5
          : pose === 'wink'
            ? -3
            : pose === 'working'
              ? 5
              : 0;

  return (
    <g className="koma-rig__head">
      <g transform={rot !== 0 ? `rotate(${rot} 122 126)` : undefined}>

        <g className="koma-rig__ear-l">
          <path d={EAR_LEFT_OUTER} fill="none" stroke={`url(#${p}-rim-aura)`} strokeWidth={9.0} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${p}-bloom-wide)`} opacity={0.74} />
          <path d={EAR_LEFT_OUTER} fill="none" stroke={`url(#${p}-rim-core)`} strokeWidth={4.4} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${p}-bloom-tight)`} opacity={0.98} />
        </g>
        <g className="koma-rig__ear-r">
          <path d={EAR_RIGHT_OUTER} fill="none" stroke={`url(#${p}-rim-aura)`} strokeWidth={9.0} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${p}-bloom-wide)`} opacity={0.74} />
          <path d={EAR_RIGHT_OUTER} fill="none" stroke={`url(#${p}-rim-core)`} strokeWidth={4.4} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${p}-bloom-tight)`} opacity={0.98} />
        </g>
        <path d={HEAD_SILHOUETTE} fill="none" stroke={`url(#${p}-rim-aura)`} strokeWidth={9.4} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${p}-bloom-wide)`} opacity={0.74} />
        <path d={HEAD_SILHOUETTE} fill="none" stroke={`url(#${p}-rim-core)`} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${p}-bloom-tight)`} opacity={0.98} />

        <g className="koma-rig__ear-l">
          <path d={EAR_LEFT_OUTER} fill={`url(#${p}-fur)`} />
          {showPinkEars && (
            <>
              <path d={EAR_LEFT_INNER} fill={`url(#${p}-ear-pink)`} />
              <path d="M 80 73 L 76 62 L 85 67 L 85 57 L 93 64 L 97 54 L 103 60 Z" fill="#050308" />
            </>
          )}
        </g>
        <g className="koma-rig__ear-r">
          <path d={EAR_RIGHT_OUTER} fill={`url(#${p}-fur)`} />
          {showPinkEars && (
            <>
              <path d={EAR_RIGHT_INNER} fill={`url(#${p}-ear-pink)`} />
              <path d="M 164 73 L 168 62 L 159 67 L 159 57 L 151 64 L 147 54 L 141 60 Z" fill="#050308" />
            </>
          )}
        </g>
        <path d={HEAD_SILHOUETTE} fill={`url(#${p}-fur)`} />
        <path d="M 103 53.5 Q 122 49.5 141 53.5" fill="none" stroke="#FFE89E" strokeWidth={1.7} strokeLinecap="round" opacity={0.72} />

        {pose !== 'back' && (
          <g>
            {isHappy || isContent || blinking ? (
              <>
                <HappyArcEye p={p} cx={94} cy={108} />
                <HappyArcEye p={p} cx={150} cy={108} flip />
              </>
            ) : isWink ? (
              <>
                <OpenEye p={p} cx={93} cy={108} scale={1.02} gazeX={gazeX} gazeY={gazeY} />
                <HappyArcEye p={p} cx={150} cy={110} flip />
              </>
            ) : isSurprised ? (
              <>
                <OpenEye p={p} cx={93} cy={106} scale={1.07} gazeX={gazeX} gazeY={gazeY} />
                <OpenEye p={p} cx={151} cy={106} scale={1.07} gazeX={gazeX} gazeY={gazeY} />
              </>
            ) : (
              <>
                <OpenEye p={p} cx={94} cy={108} scale={1} gazeX={gazeX} gazeY={gazeY} />
                <OpenEye p={p} cx={150} cy={108} scale={1} gazeX={gazeX} gazeY={gazeY} />
              </>
            )}

            <path d="M 118 118.2 L 126 118.2 Q 124 123.4 122 123.6 Q 120 123.4 118 118.2 Z" fill="#FF3B7F" />

            {isHappy ? (
              <>
                <path
                  d="M 115.2 126.8 Q 122 124.8 128.8 126.8 C 129.4 135 125.8 138.6 122 138.6 C 118.2 138.6 114.6 135 115.2 126.8 Z"
                  fill={`url(#${p}-mouth-pink)`}
                  filter={`url(#${p}-pink-glow)`}
                />
                <ellipse cx={122} cy={134.8} rx={4.2} ry={2.4} fill="#FF89B7" opacity={0.72} />
              </>
            ) : isSurprised ? (
              <>
                <ellipse cx={122} cy={132} rx={5.2} ry={6.8} fill={`url(#${p}-mouth-pink)`} filter={`url(#${p}-pink-glow)`} />
                <ellipse cx={122} cy={133.6} rx={3.1} ry={3.4} fill="#FF84B4" opacity={0.65} />
              </>
            ) : (
              <path
                d="M 117.5 126 Q 120 128.4 122 126.4 Q 124 128.4 126.5 126"
                fill="none"
                stroke="#FF2E7A"
                strokeWidth={1.35}
                strokeLinecap="round"
                opacity={0.32}
              />
            )}
          </g>
        )}
      </g>
    </g>
  );
};

export const KomaNekoRig: React.FC<KomaNekoRigProps> = React.memo(
  ({
    pose = 'idle',
    size = 96,
    animated = true,
    gazeX = 0,
    gazeY = 0,
    className = '',
    label,
  }) => {
    const prefersReducedMotion = useReducedMotion() === true;
    const isAnimated = animated && !prefersReducedMotion;
    const rawId = useId();
    const p = `kn-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const [blinking, setBlinking] = useState(false);

    const hasOpenEyes =
      pose === 'idle' ||
      pose === 'curious' ||
      pose === 'wave' ||
      pose === 'peek' ||
      pose === 'working';

    useEffect(() => {
      if (!isAnimated || !hasOpenEyes) {
        setBlinking(false);
        return;
      }
      let blinkTimer: number | null = null;
      let scheduleTimer: number | null = null;

      const scheduleNext = (): void => {
        const delayMs = 3200 + Math.floor(Math.random() * 2800);
        scheduleTimer = window.setTimeout(() => {
          setBlinking(true);
          blinkTimer = window.setTimeout(() => {
            setBlinking(false);
            scheduleNext();
          }, 130);
        }, delayMs);
      };

      scheduleNext();
      return () => {
        if (scheduleTimer !== null) window.clearTimeout(scheduleTimer);
        if (blinkTimer !== null) window.clearTimeout(blinkTimer);
      };
    }, [hasOpenEyes, isAnimated]);

    const isExcited =
      pose === 'happy' || pose === 'celebrate' || pose === 'casting' || pose === 'working';
    const dim = typeof size === 'number' ? `${size}px` : size;

    return (
      <span
        className={`koma-rig ${isAnimated ? 'koma-rig--animated' : ''} ${isExcited ? 'koma-rig--excited' : ''} ${className}`.trim()}
        style={{ width: dim, height: dim }}
        data-koma-pose={pose}
      >
        <svg
          className="koma-rig__svg"
          viewBox="0 0 256 256"
          role={label ? 'img' : undefined}
          aria-label={label}
          aria-hidden={label ? undefined : true}
        >
          <defs>
            <linearGradient id={`${p}-rim-aura`} x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#FFE17D" />
              <stop offset="28%" stopColor="#FF9A2E" />
              <stop offset="62%" stopColor="#FF1E6E" />
              <stop offset="100%" stopColor="#D8125B" />
            </linearGradient>
            <linearGradient id={`${p}-rim-core`} x1="48%" y1="0%" x2="52%" y2="100%">
              <stop offset="0%" stopColor="#FFF2B2" />
              <stop offset="26%" stopColor="#FFB938" />
              <stop offset="58%" stopColor="#FF2E7A" />
              <stop offset="100%" stopColor="#E11D62" />
            </linearGradient>
            <linearGradient id={`${p}-rim-diag`} x1="35%" y1="0%" x2="65%" y2="100%">
              <stop offset="0%" stopColor="#FFE68A" />
              <stop offset="32%" stopColor="#FF9B26" />
              <stop offset="68%" stopColor="#FF1E6E" />
              <stop offset="100%" stopColor="#C91056" />
            </linearGradient>
            <radialGradient id={`${p}-fur`} cx="46%" cy="38%" r="65%">
              <stop offset="0%" stopColor="#0E0A16" />
              <stop offset="58%" stopColor="#06040A" />
              <stop offset="100%" stopColor="#030206" />
            </radialGradient>
            <linearGradient id={`${p}-ear-pink`} x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#FF6BA3" />
              <stop offset="45%" stopColor="#FF1F6A" />
              <stop offset="100%" stopColor="#C60D4F" />
            </linearGradient>
            <radialGradient id={`${p}-iris`} cx="50%" cy="66%" r="56%" fx="50%" fy="76%">
              <stop offset="0%" stopColor="#9CFFFF" />
              <stop offset="30%" stopColor="#38F9FF" />
              <stop offset="62%" stopColor="#0094FF" />
              <stop offset="88%" stopColor="#0044A8" />
              <stop offset="100%" stopColor="#002366" />
            </radialGradient>
            <radialGradient id={`${p}-eye-halo`} cx="50%" cy="55%" r="50%">
              <stop offset="0%" stopColor="#38F9FF" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#0099FF" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#0099FF" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${p}-closed-eye`} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="50%" stopColor="#5CEEFF" />
              <stop offset="100%" stopColor="#93C5FD" />
            </linearGradient>
            <linearGradient id={`${p}-mouth-pink`} x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#C21453" />
              <stop offset="45%" stopColor="#FF2D78" />
              <stop offset="100%" stopColor="#FF76AA" />
            </linearGradient>
            <linearGradient id={`${p}-bean-pink`} x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#FF6EA6" />
              <stop offset="100%" stopColor="#FF1E6E" />
            </linearGradient>
            <linearGradient id={`${p}-orbit`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF3EA5" />
              <stop offset="45%" stopColor="#C084FC" />
              <stop offset="100%" stopColor="#38F9FF" />
            </linearGradient>
            <filter id={`${p}-bloom-wide`} x="-35%" y="-35%" width="170%" height="170%">
              <feGaussianBlur stdDeviation="5.2" />
            </filter>
            <filter id={`${p}-bloom-tight`} x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="1.4" result="b1" />
              <feMerge>
                <feMergeNode in="b1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`${p}-heart-glow`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.4" result="hb" />
              <feMerge>
                <feMergeNode in="hb" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`${p}-cyan-glow`} x="-45%" y="-45%" width="190%" height="190%">
              <feGaussianBlur stdDeviation="2.2" result="cb" />
              <feMerge>
                <feMergeNode in="cb" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`${p}-pink-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.8" result="pb" />
              <feMerge>
                <feMergeNode in="pb" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {pose === 'peek' && (
            <g>
              <g className="koma-rig__tail">
                <RimmedPath
                  p={p}
                  d="M 184 196 C 216 196 234 176 234 146 C 234 118 214 102 194 105 C 181 107 178 119 186 125 C 193 130 205 127 207 142 C 209 162 196 176 178 178 Z"
                  auraWidth={8.6}
                  coreWidth={4.2}
                />
              </g>
              <g className="koma-rig__body">
                <RimmedPath
                  p={p}
                  d="M 54 194 C 54 150 86 124 134 124 C 178 124 206 150 206 188 C 206 206 192 212 170 212 L 82 212 C 62 212 54 205 54 194 Z"
                />
              </g>
              <g transform="translate(4, 34)">
                <FrontHead p={p} pose="idle" blinking={blinking} gazeX={gazeX} gazeY={gazeY} />
              </g>
              <g>
                <RimmedPath
                  p={p}
                  d="M 42 196 C 42 178 58 170 82 170 C 102 170 116 178 116 194 C 116 208 102 214 78 214 C 54 214 42 208 42 196 Z"
                  auraWidth={7.4}
                  coreWidth={3.6}
                />
                <path d="M 66 198 C 66 205 68 210 70 212 M 84 196 C 85 204 86 210 88 212" fill="none" stroke="#FF2474" strokeWidth={1.5} strokeLinecap="round" opacity={0.55} />
                <RimmedPath
                  p={p}
                  d="M 134 194 C 134 178 148 170 168 170 C 192 170 208 178 208 196 C 208 208 196 214 172 214 C 148 214 134 208 134 194 Z"
                  auraWidth={7.4}
                  coreWidth={3.6}
                />
                <path d="M 164 196 C 163 204 162 210 160 212 M 182 198 C 182 205 180 210 178 212" fill="none" stroke="#FF2474" strokeWidth={1.5} strokeLinecap="round" opacity={0.55} />
              </g>
            </g>
          )}

          {pose === 'sleep' && (
            <g>
              <g className="koma-rig__body">
                <RimmedPath
                  p={p}
                  d="M 64 188 C 58 140 94 102 152 104 C 204 106 234 142 232 182 C 230 210 198 220 150 220 C 102 220 68 212 64 188 Z"
                  auraWidth={9.2}
                  coreWidth={4.4}
                />
                <path d="M 148 166 C 154 134 184 128 206 144" fill="none" stroke="#FF2474" strokeWidth={1.8} strokeLinecap="round" opacity={0.55} />
              </g>
              <g transform="translate(-24, 34) rotate(-14 122 108)">
                <path d={EAR_LEFT_OUTER} fill="none" stroke={`url(#${p}-rim-aura)`} strokeWidth={8.6} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${p}-bloom-wide)`} opacity={0.72} />
                <path d={EAR_LEFT_OUTER} fill="none" stroke={`url(#${p}-rim-core)`} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${p}-bloom-tight)`} opacity={0.96} />
                <path d={EAR_RIGHT_OUTER} fill="none" stroke={`url(#${p}-rim-aura)`} strokeWidth={8.6} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${p}-bloom-wide)`} opacity={0.72} />
                <path d={EAR_RIGHT_OUTER} fill="none" stroke={`url(#${p}-rim-core)`} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${p}-bloom-tight)`} opacity={0.96} />
                <path d={HEAD_SILHOUETTE} fill="none" stroke={`url(#${p}-rim-aura)`} strokeWidth={8.8} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${p}-bloom-wide)`} opacity={0.72} />
                <path d={HEAD_SILHOUETTE} fill="none" stroke={`url(#${p}-rim-core)`} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${p}-bloom-tight)`} opacity={0.96} />
                <path d={EAR_LEFT_OUTER} fill={`url(#${p}-fur)`} />
                <path d={EAR_LEFT_INNER} fill={`url(#${p}-ear-pink)`} />
                <path d="M 80 73 L 76 62 L 85 67 L 85 57 L 93 64 L 97 54 L 103 60 Z" fill="#050308" />
                <path d={EAR_RIGHT_OUTER} fill={`url(#${p}-fur)`} />
                <path d={EAR_RIGHT_INNER} fill={`url(#${p}-ear-pink)`} />
                <path d="M 164 73 L 168 62 L 159 67 L 159 57 L 151 64 L 147 54 L 141 60 Z" fill="#050308" />
                <path d={HEAD_SILHOUETTE} fill={`url(#${p}-fur)`} />
                <SleepArcEye p={p} cx={95} cy={112} rot={4} />
                <SleepArcEye p={p} cx={149} cy={112} rot={-4} />
                <path d="M 118 119 L 126 119 Q 124 124 122 124.2 Q 120 124 118 119 Z" fill="#FF3B7F" />
              </g>
              <RimmedPath
                p={p}
                d="M 54 196 C 54 182 72 178 102 182 C 118 184 126 194 124 204 C 122 214 96 216 74 214 C 58 212 54 206 54 196 Z"
                auraWidth={7.4}
                coreWidth={3.5}
              />
              <RimmedPath
                p={p}
                d="M 102 198 C 102 184 124 180 156 186 C 186 192 214 182 222 162 C 230 166 234 186 220 204 C 202 224 152 226 118 216 C 106 212 102 206 102 198 Z"
                auraWidth={8.2}
                coreWidth={3.9}
              />
              <g fontFamily="ui-monospace, monospace" fontWeight={800}>
                <text className="koma-rig__zzz-1" x={172} y={88} fontSize={18} fill="#38F9FF" filter={`url(#${p}-cyan-glow)`}>z</text>
                <text className="koma-rig__zzz-2" x={192} y={64} fontSize={24} fill="#FF5C93" filter={`url(#${p}-pink-glow)`}>Z</text>
                <text className="koma-rig__zzz-3" x={214} y={42} fontSize={16} fill="#FFD166" filter={`url(#${p}-pink-glow)`}>z</text>
              </g>
            </g>
          )}

          {pose === 'stretch' && (
            <g className="koma-rig__stretch-root">
              <g className="koma-rig__tail">
                <RimmedPath
                  p={p}
                  d="M 196 124 C 228 118 242 88 232 60 C 223 36 196 26 176 34 C 164 40 162 56 172 62 C 182 68 194 60 202 68 C 212 78 206 102 186 108 Z"
                  auraWidth={8.6}
                  coreWidth={4.2}
                />
              </g>
              <RimmedPath
                p={p}
                d="M 26 206 C 26 194 42 186 72 178 C 104 168 122 132 146 106 C 164 86 194 86 208 112 C 220 134 216 178 214 206 C 214 216 202 220 190 220 C 178 220 174 212 178 202 C 184 188 182 170 172 162 C 156 196 126 218 78 220 L 42 220 C 30 220 26 214 26 206 Z"
              />
              <path d="M 52 216 C 68 206 86 196 106 192" fill="none" stroke="#FF2474" strokeWidth={1.6} strokeLinecap="round" opacity={0.58} />
              <g transform="translate(-32, 66) scale(0.89)">
                <FrontHead p={p} pose="stretch" blinking={false} gazeX={0} gazeY={0} rotOverride={0} />
              </g>
            </g>
          )}

          {pose === 'celebrate' && (
            <g className="koma-rig__float">
              <g transform="translate(36, 54)" filter={`url(#${p}-cyan-glow)`}>
                <g className="koma-rig__spark">
                  <path d="M 0 -11 L 2.6 -2.6 L 11 0 L 2.6 2.6 L 0 11 L -2.6 2.6 L -11 0 L -2.6 -2.6 Z" fill="#38F9FF" />
                </g>
              </g>
              <g transform="translate(220, 48)" filter={`url(#${p}-pink-glow)`}>
                <g className="koma-rig__spark">
                  <path d="M 0 -10 L 2.4 -2.4 L 10 0 L 2.4 2.4 L 0 10 L -2.4 2.4 L -10 0 L -2.4 -2.4 Z" fill="#FFD166" />
                </g>
              </g>
              <path
                d="M 192 34 C 190.5 32.5 184 28 184 24 C 184 21.2 186.2 19.2 188.8 19.2 C 190.4 19.2 191.5 20.2 192 21.4 C 192.5 20.2 193.6 19.2 195.2 19.2 C 197.8 19.2 200 21.2 200 24 C 200 28 193.5 32.5 192 34 Z"
                fill="#FF2E7A"
                filter={`url(#${p}-pink-glow)`}
              />
              <g className="koma-rig__tail">
                <RimmedPath
                  p={p}
                  d="M 96 206 C 64 218 32 206 28 180 C 24 156 42 140 58 144 C 68 146 72 158 64 164 C 58 168 50 166 48 176 C 46 188 64 196 92 190 Z"
                  auraWidth={8.4}
                  coreWidth={4.0}
                />
              </g>
              <RimmedPath
                p={p}
                d="M 94 130 C 82 154 84 188 98 214 C 108 232 132 232 144 216 C 170 212 186 192 184 164 C 182 144 170 132 156 128 Z"
                auraWidth={8.8}
                coreWidth={4.2}
              />
              <ChestHeart p={p} cx={138} cy={166} />
              <RimmedPath
                p={p}
                d="M 104 174 C 86 168 68 158 61 142 C 56 128 71 118 85 128 C 98 138 108 156 112 168 Z"
                auraWidth={7.8}
                coreWidth={3.8}
              />
              <ToeBeans p={p} cx={77} cy={144} rot={-24} scale={0.96} />
              <RimmedPath
                p={p}
                d="M 158 162 C 172 148 186 128 194 112 C 200 100 218 104 220 118 C 222 134 204 156 182 172 C 172 178 160 172 158 162 Z"
                auraWidth={7.8}
                coreWidth={3.8}
              />
              <ToeBeans p={p} cx={204} cy={124} rot={24} scale={0.98} />
              <g transform="translate(8, -10)">
                <FrontHead p={p} pose="happy" blinking={false} gazeX={0} gazeY={0} rotOverride={-4} />
              </g>
            </g>
          )}

          {pose !== 'peek' && pose !== 'sleep' && pose !== 'stretch' && pose !== 'celebrate' && (
            <g className={pose === 'casting' ? 'koma-rig__float' : undefined}>
              {pose === 'casting' && (
                <g>
                  <ellipse
                    cx={128}
                    cy={144}
                    rx={98}
                    ry={30}
                    transform="rotate(-18 128 144)"
                    fill="none"
                    stroke={`url(#${p}-orbit)`}
                    strokeWidth={3.2}
                    filter={`url(#${p}-pink-glow)`}
                    opacity={0.88}
                  />
                  <ellipse
                    cx={128}
                    cy={144}
                    rx={98}
                    ry={30}
                    transform="rotate(-18 128 144)"
                    fill="none"
                    stroke="#E0F9FF"
                    strokeWidth={1.2}
                    opacity={0.7}
                  />
                  <g transform="translate(36, 98)" filter={`url(#${p}-cyan-glow)`}>
                    <g className="koma-rig__spark">
                      <path d="M 0 -12 L 2.8 -2.8 L 12 0 L 2.8 2.8 L 0 12 L -2.8 2.8 L -12 0 L -2.8 -2.8 Z" fill="#FFFFFF" />
                    </g>
                  </g>
                  <g transform="translate(216, 84)" filter={`url(#${p}-pink-glow)`}>
                    <g className="koma-rig__spark">
                      <path d="M 0 -9 L 2.2 -2.2 L 9 0 L 2.2 2.2 L 0 9 L -2.2 2.2 L -9 0 L -2.2 -2.2 Z" fill="#E879F9" />
                    </g>
                  </g>
                  <g transform="translate(224, 178)" filter={`url(#${p}-cyan-glow)`}>
                    <g className="koma-rig__spark">
                      <path d="M 0 -10 L 2.4 -2.4 L 10 0 L 2.4 2.4 L 0 10 L -2.4 2.4 L -10 0 L -2.4 -2.4 Z" fill="#38F9FF" />
                    </g>
                  </g>
                </g>
              )}

              <g className="koma-rig__tail">
                <RimmedPath p={p} d={TAIL_SEATED} auraWidth={8.6} coreWidth={4.2} diag />
              </g>

              <g className="koma-rig__body">
                <RimmedPath p={p} d={BODY_SEATED} />
                {pose === 'back' ? (
                  <>
                    <path d="M 85 184 C 81 198 83 214 91 224" fill="none" stroke="#FF2A7A" strokeWidth={1.8} strokeLinecap="round" opacity={0.58} />
                    <path d="M 159 184 C 163 198 161 214 153 224" fill="none" stroke="#FF2A7A" strokeWidth={1.8} strokeLinecap="round" opacity={0.58} />
                  </>
                ) : (
                  <>
                    <path d="M 88 176 C 85 196 89 216 97 226" fill="none" stroke="#FF2474" strokeWidth={1.8} strokeLinecap="round" opacity={0.62} />
                    <path d="M 156 176 C 159 196 155 216 147 226" fill="none" stroke="#FF2474" strokeWidth={1.8} strokeLinecap="round" opacity={0.62} />
                    <path d="M 112 198 C 112 212 113 222 115 227" fill="none" stroke="#FF2474" strokeWidth={1.35} strokeLinecap="round" opacity={0.45} />
                    <path d="M 132 198 C 132 212 131 222 129 227" fill="none" stroke="#FF2474" strokeWidth={1.35} strokeLinecap="round" opacity={0.45} />
                    <ChestHeart p={p} cx={122} cy={162} scale={1.02} />
                  </>
                )}
              </g>

              <FrontHead p={p} pose={pose} blinking={blinking} gazeX={gazeX} gazeY={gazeY} />

              {pose === 'wave' && (
                <g className="koma-rig__wave-paw">
                  <RimmedPath
                    p={p}
                    d="M 146 176 C 154 156 164 134 173 121 C 182 108 202 110 207 125 C 213 142 199 169 178 186 C 166 196 150 190 146 176 Z"
                    auraWidth={8.6}
                    coreWidth={4.2}
                  />
                  <ToeBeans p={p} cx={187} cy={136} rot={18} scale={1.12} />
                </g>
              )}

              {pose === 'surprised' && (
                <g className="koma-rig__alert" filter={`url(#${p}-pink-glow)`}>
                  <path d="M 194 74 L 210 52" stroke="#FF1E6E" strokeWidth={6.5} strokeLinecap="round" />
                  <path d="M 203 91 L 226 83" stroke="#FF1E6E" strokeWidth={6.5} strokeLinecap="round" />
                  <path d="M 201 108 L 222 113" stroke="#FF1E6E" strokeWidth={6.0} strokeLinecap="round" />
                </g>
              )}

              {pose === 'happy' && (
                <g className="koma-rig__spark">
                  <path
                    d="M 206 86 C 204 84 196 79 196 74 C 196 70.5 198.8 68.2 202 68.2 C 204 68.2 205.4 69.4 206 70.8 C 206.6 69.4 208 68.2 210 68.2 C 213.2 68.2 216 70.5 216 74 C 216 79 208 84 206 86 Z"
                    fill="#FF2474"
                    filter={`url(#${p}-pink-glow)`}
                  />
                </g>
              )}

              {pose === 'working' && (
                <g transform="translate(196, 62)" filter={`url(#${p}-cyan-glow)`}>
                  <g className="koma-rig__float">
                    <rect x={-14} y={-12} width={28} height={24} rx={4} fill="#0B1226" stroke="#38F9FF" strokeWidth={2} />
                    <line x1={-8} y1={-5} x2={8} y2={-5} stroke="#38F9FF" strokeWidth={2} strokeLinecap="round" />
                    <line x1={-8} y1={1} x2={5} y2={1} stroke="#FF2E7A" strokeWidth={2} strokeLinecap="round" />
                    <line x1={-8} y1={7} x2={8} y2={7} stroke="#FFD166" strokeWidth={2} strokeLinecap="round" />
                  </g>
                </g>
              )}
            </g>
          )}
        </svg>
      </span>
    );
  },
);

KomaNekoRig.displayName = 'KomaNekoRig';
export default KomaNekoRig;
