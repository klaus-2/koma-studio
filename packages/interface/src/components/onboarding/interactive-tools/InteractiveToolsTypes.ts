export type InteractiveMissionId = 'healing' | 'text' | 'selection';

export const INTERACTIVE_MISSION_ORDER: readonly InteractiveMissionId[] = [
  'healing',
  'text',
  'selection',
];

export type InteractiveToolsCompletion = Readonly<Record<InteractiveMissionId, boolean>>;

export const createInitialCompletion = (initialDone = false): InteractiveToolsCompletion => ({
  healing: initialDone,
  text: initialDone,
  selection: initialDone,
});

export const countCompletedMissions = (completion: InteractiveToolsCompletion): number =>
  INTERACTIVE_MISSION_ORDER.filter((id) => completion[id]).length;

export const areAllMissionsComplete = (completion: InteractiveToolsCompletion): boolean =>
  INTERACTIVE_MISSION_ORDER.every((id) => completion[id]);
