import { useThemeStore } from '@koma/ui/stores/theme-store';

import { chip, iconBtn, inputCls, selectCls } from '../../pages/settings/noir/primitives';
import { btnGhost, btnPrimary } from '../system/v2/kit';

export type OnbTone = 'neutral' | 'accent' | 'info' | 'warn' | 'success' | 'danger';

export interface OnbSkin {
  readonly noir: boolean;
  readonly backdrop: string;
  readonly dialog: string;
  readonly rail: string;
  readonly railItem: string;
  readonly railItemOn: string;
  readonly railItemOff: string;
  readonly railNum: string;
  readonly railNumOn: string;
  readonly railLabel: string;
  readonly header: string;
  readonly kicker: string;
  readonly title: string;
  readonly titleAccent: string;
  readonly subtitle: string;
  readonly closeBtn: string;
  readonly footer: string;
  readonly counter: string;
  readonly track: string;
  readonly fill: string;
  readonly section: string;
  readonly sectionIcon: string;
  readonly sectionTitle: string;
  readonly sectionDesc: string;
  readonly item: string;
  readonly itemOn: string;
  readonly itemOff: string;
  readonly press: string;
  readonly itemTitle: string;
  readonly label: string;
  readonly hint: string;
  readonly input: string;
  readonly select: string;
  readonly checkbox: string;
  readonly btnPrimary: string;
  readonly btnGhost: string;
  readonly btnSmall: string;
  readonly choice: string;
  readonly choiceOn: string;
  readonly choiceOff: string;
  readonly segment: string;
  readonly segmentItem: string;
  readonly segmentOn: string;
  readonly segmentOff: string;
  readonly row: string;
  readonly rowTitle: string;
  readonly rowDesc: string;
  readonly tab: string;
  readonly tabOn: string;
  readonly tabOff: string;
  readonly body: string;
  readonly muted: string;
  readonly mono: string;
  readonly badge: (tone: OnbTone) => string;
  readonly notice: (tone: OnbTone) => string;
}

const NOIR_FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson';

const NOIR_CHIP_TONE = {
  neutral: 'neutral',
  accent: 'crimson',
  info: 'azure',
  warn: 'gold',
  success: 'mint',
  danger: 'crimson',
} as const satisfies Record<OnbTone, Parameters<typeof chip>[0]>;

const NOIR_NOTICE_TONE: Record<OnbTone, string> = {
  neutral: 'border-paper/30 bg-paper/5',
  accent: 'border-crimson bg-crimson/8',
  info: 'border-azure bg-azure/8',
  warn: 'border-gold bg-gold/8',
  success: 'border-mint bg-mint/8',
  danger: 'border-crimson bg-crimson/10',
};

const CLASSIC_NOTICE_TONE: Record<OnbTone, string> = {
  neutral: 'info',
  accent: 'info',
  info: 'info',
  warn: 'warn',
  success: 'success',
  danger: 'error',
};

export const NOIR_SKIN: OnbSkin = {
  noir: true,
  backdrop: 'bg-ink/85 backdrop-blur-md',
  dialog: 'glass panel-cut halftone text-paper',
  rail: 'border-r border-paper/10 bg-ink/55',
  railItem: `panel-cut-sm border transition-colors ${NOIR_FOCUS}`,
  railItemOn: 'border-crimson/60 bg-crimson/10 text-paper',
  railItemOff: 'border-transparent text-paper/45 hover:bg-paper/5 hover:text-paper/85',
  railNum: 'font-display text-base font-black leading-none text-paper/25',
  railNumOn: 'font-display text-base font-black leading-none text-crimson',
  railLabel: 'font-mono text-[11px] font-bold uppercase tracking-[0.14em]',
  header: 'border-b border-paper/10',
  kicker: 'font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-crimson',
  title: 'font-display text-xl font-black uppercase leading-tight tracking-tight text-paper sm:text-2xl',
  titleAccent: 'font-accent font-normal normal-case italic text-crimson',
  subtitle: 'font-mono text-[11px] leading-relaxed text-paper/50',
  closeBtn: iconBtn,
  footer: 'border-t border-paper/10 bg-ink/40',
  counter: 'font-mono text-[10px] font-bold tracking-[0.18em] text-paper/45',
  track: 'h-1 overflow-hidden bg-paper/10',
  fill: 'h-full bg-gradient-to-r from-crimson to-gold',
  section: 'glass panel-cut-sm border border-paper/8 p-4 sm:p-5',
  sectionIcon:
    'panel-cut-sm flex h-8 w-8 shrink-0 items-center justify-center border border-crimson/40 bg-crimson/10 text-crimson',
  sectionTitle: 'font-display text-sm font-black uppercase tracking-tight text-paper',
  sectionDesc: 'mt-1 font-mono text-[10px] leading-relaxed text-paper/45',
  item: 'panel-cut-sm border p-3',
  itemOn: 'border-crimson/50 bg-crimson/8',
  itemOff: 'border-paper/10 bg-ink/50',
  press: `cursor-pointer text-left transition-colors hover:border-paper/30 ${NOIR_FOCUS}`,
  itemTitle: 'font-display text-xs font-black uppercase tracking-tight text-paper',
  label: 'font-mono text-[9px] uppercase tracking-[0.24em] text-paper/40',
  hint: 'font-mono text-[9px] text-paper/35',
  input: inputCls,
  select: selectCls,
  checkbox:
    'h-4 w-4 shrink-0 cursor-pointer accent-crimson disabled:cursor-not-allowed disabled:opacity-40',
  btnPrimary,
  btnGhost,
  btnSmall: `panel-cut-sm hard-hover inline-flex shrink-0 items-center gap-1.5 border border-paper/20 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-paper/70 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 ${NOIR_FOCUS}`,
  choice: `panel-cut-sm flex w-full items-center gap-3 border p-3 text-left transition-colors ${NOIR_FOCUS}`,
  choiceOn: 'border-crimson bg-crimson/10 text-paper',
  choiceOff: 'border-paper/12 bg-ink/50 text-paper/80 hover:border-paper/30',
  segment: 'flex gap-1 border border-paper/12 bg-ink/60 p-1',
  segmentItem: `inline-flex min-h-[32px] flex-1 items-center justify-center gap-1.5 px-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${NOIR_FOCUS}`,
  segmentOn: 'bg-crimson text-ink',
  segmentOff: 'text-paper/55 hover:bg-paper/5 hover:text-paper',
  row: 'panel-cut-sm flex items-center justify-between gap-4 border border-paper/8 bg-ink/50 px-4 py-3',
  rowTitle: 'block font-display text-xs font-bold uppercase tracking-tight text-paper',
  rowDesc: 'mt-0.5 block font-mono text-[10px] leading-relaxed text-paper/45',
  tab: `panel-cut-sm inline-flex min-h-[32px] shrink-0 items-center gap-1.5 whitespace-nowrap border px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${NOIR_FOCUS}`,
  tabOn: 'border-crimson bg-crimson/10 text-crimson',
  tabOff: 'border-paper/12 text-paper/50 hover:border-paper/30 hover:text-paper',
  body: 'text-[13px] leading-relaxed text-paper/80',
  muted: 'font-mono text-[10px] leading-relaxed text-paper/45',
  mono: 'font-mono text-[10px] text-paper/50',
  badge: (tone) => chip(NOIR_CHIP_TONE[tone]),
  notice: (tone) =>
    `flex flex-wrap items-start gap-2 border-l-2 px-3 py-2 font-mono text-[11px] leading-relaxed text-paper/80 ${NOIR_NOTICE_TONE[tone]}`,
};

export const CLASSIC_SKIN: OnbSkin = {
  noir: false,
  backdrop: 'koma-onb-c-backdrop',
  dialog: 'koma-onb-c-dialog',
  rail: 'koma-onb-c-rail',
  railItem: 'koma-onb-c-railItem',
  railItemOn: 'koma-onb-c-railItem--on',
  railItemOff: '',
  railNum: 'koma-onb-c-railNum',
  railNumOn: 'koma-onb-c-railNum koma-onb-c-railNum--on',
  railLabel: '',
  header: 'koma-onb-c-header',
  kicker: 'koma-onb-c-kicker',
  title: 'koma-onb-c-title',
  titleAccent: '',
  subtitle: 'koma-onb-c-subtitle',
  closeBtn: 'koma-onb-c-close',
  footer: 'koma-onb-c-footer',
  counter: 'koma-onb-c-counter',
  track: 'koma-onb-c-track',
  fill: 'koma-onb-c-fill',
  section: 'koma-onb-c-section',
  sectionIcon: 'koma-onb-c-icon',
  sectionTitle: 'koma-onb-c-sectionTitle',
  sectionDesc: 'koma-onb-c-desc',
  item: 'koma-onb-c-item',
  itemOn: 'koma-onb-c-item--on',
  itemOff: '',
  press: 'koma-onb-c-press',
  itemTitle: 'koma-onb-c-itemTitle',
  label: 'koma-onb-c-label',
  hint: 'koma-onb-c-hint',
  input: 'koma-input',
  select: 'koma-select koma-onb-c-select',
  checkbox: 'koma-onb-c-check',
  btnPrimary: 'koma-btn koma-btn--primary koma-btn--sm',
  btnGhost: 'koma-btn koma-btn--ghost koma-btn--sm',
  btnSmall: 'koma-btn koma-btn--ghost koma-btn--xs',
  choice: 'koma-onb-c-item koma-onb-c-press koma-onb-c-choice',
  choiceOn: 'koma-onb-c-item--on',
  choiceOff: '',
  segment: 'koma-onb-c-seg',
  segmentItem: 'koma-onb-c-seg__item',
  segmentOn: 'koma-onb-c-seg__item--on',
  segmentOff: '',
  row: 'koma-onb-c-row',
  rowTitle: 'koma-onb-c-rowTitle',
  rowDesc: 'koma-onb-c-rowDesc',
  tab: 'koma-onb-c-tab',
  tabOn: 'koma-onb-c-tab--on',
  tabOff: '',
  body: 'koma-onb-c-body',
  muted: 'koma-onb-c-muted',
  mono: 'koma-onb-c-mono',
  badge: (tone) => `koma-onb-c-badge koma-onb-c-badge--${tone}`,
  notice: (tone) => `koma-stg-alert koma-stg-alert--${CLASSIC_NOTICE_TONE[tone]}`,
};

export const useOnbSkin = (): OnbSkin =>
  useThemeStore((s) => s.family) === 'noir' ? NOIR_SKIN : CLASSIC_SKIN;
