export interface SidebarSkeletonSection {
  readonly id: string;
  readonly rows: readonly string[];
}

export const SIDEBAR_SKELETON_SECTIONS: readonly SidebarSkeletonSection[] = [
  { id: 'pipeline', rows: ['100%', '72%', '86%'] },
  { id: 'models', rows: ['100%', '64%'] },
  { id: 'options', rows: ['92%', '78%', '58%', '84%'] },
];
