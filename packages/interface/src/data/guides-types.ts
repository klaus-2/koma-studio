/* ============================================================
   KŌMA STUDIO — Guides & Resources Type Definitions (v2)
   ============================================================ */

   import type { LucideIcon } from 'lucide-react';

   /* ─── Guide Step ─── */
   
   export type GuideStepType =
     | 'text'
     | 'image'
     | 'video'
     | 'code'
     | 'tip'
     | 'warning'
     | 'danger'
     | 'info'
     | 'shortcut-table'
     | 'compare'
     | 'checklist'
     | 'quote'
     | 'divider'
     | 'callout-pro'
     | 'interactive-demo';
   
   export type GuideDifficulty = 'beginner' | 'intermediate' | 'advanced';
   export type AccentColor = 'purple' | 'cyan' | 'rose' | 'amber' | 'emerald';
   
   export interface GuideStep {
     id: string;
     title?: string;
     type: GuideStepType;
     content: string;
     tip?: string;
     warning?: string;
     image?: {
       src: string;
       alt: string;
       caption?: string;
       zoomable?: boolean;
     };
     code?: {
       language: string;
       snippet: string;
       filename?: string;
       highlightLines?: number[];
       copyable?: boolean;
     };
     shortcuts?: Array<{
       keys: string[];
       description: string;
       category?: string;
     }>;
     checklist?: Array<{
       id: string;
       label: string;
       checked?: boolean;
     }>;
     proOnly?: boolean;
   }
   
   /* ─── Guide Section (logical grouping within one guide) ─── */
   
   export interface GuideSection {
     id: string;
     title: string;
     description?: string;
     steps: GuideStep[];
   }
   
   /* ─── Guide Entry ─── */
   
   export type GuideCategoryId =
     | 'quick-start'
     | 'workflows'
     | 'tools-translator'
     | 'tools-typesetter'
     | 'tools-cleaner'
     | 'tools-qc'
     | 'ai-models'
     | 'keyboard-shortcuts'
     | 'automation'
     | 'troubleshooting';
   
   export interface GuideEntry {
     id: string;
     category: GuideCategoryId;
     title: string;
     subtitle: string;
     icon: LucideIcon;
     accentColor: AccentColor;
     difficulty: GuideDifficulty;
     estimatedTime: string;
     tags: string[];
     sections: GuideSection[];
   }
   
   /* ─── Category Meta ─── */
   
   export interface GuideCategoryMeta {
     id: GuideCategoryId;
     label: string;
     icon: LucideIcon;
     description: string;
     accentColor: AccentColor;
   }
   
   /* ─── Resources ─── */
   
   export type ResourceTab =
     | 'fonts'
     | 'sfx-library'
     | 'glossary'
     | 'communities'
     | 'tools-external'
     | 'changelog';
   
   export interface FontEntry {
     name: string;
     family: string;
     style: string;
     usage: string;
     license: 'free' | 'open-source' | 'commercial' | 'mixed';
     previewText?: string;
     downloadUrl?: string;
      links?: ResourceLink[];
      tags: string[];
    }
   
   export interface SfxEntry {
     japanese: string;
     romaji: string;
     english: string;
     portuguese?: string;
     category: 'impact' | 'emotion' | 'ambient' | 'action' | 'voice' | 'misc';
     usageNote?: string;
     commonIn?: string;
   }
   
   export interface GlossaryEntry {
     term: string;
     definition: string;
     category:
       | 'general'
       | 'typesetting'
       | 'cleaning'
       | 'translation'
       | 'technical'
       | 'roles';
     relatedTerms?: string[];
   }
   
   export interface ResourceLink {
     label: string;
     url: string;
     kind?: 'download' | 'docs' | 'site' | 'mirror' | 'community';
   }
   
   export interface CommunityEntry {
     name: string;
     platform: 'discord' | 'reddit' | 'forum' | 'website' | 'telegram';
     url: string;
     description: string;
     language: string;
     memberCount?: string;
     icon?: string;
     free?: boolean;
   }
   
   export interface ExternalToolEntry {
     name: string;
     description: string;
     url: string;
      downloadUrl?: string;
      links?: ResourceLink[];
     category: 'editing' | 'ocr' | 'translation' | 'fonts' | 'hosting' | 'utility';
     free: boolean;
     icon: LucideIcon;
   }
   
   export interface ChangelogItem {
     text: string;
     type: 'added' | 'improved' | 'fixed' | 'removed';
     proOnly?: boolean;
   }
   
   export interface ChangelogVersion {
     version: string;
     date: string;
     kind: 'major' | 'minor' | 'patch';
     summary: string;
     changes: ChangelogItem[];
   }
   
   export interface ResourceCategoryMeta {
     id: ResourceTab;
     label: string;
     icon: LucideIcon;
     description: string;
     accentColor: AccentColor;
     itemCount: number;
   }
   
   /* ─── Navigation ─── */
   
   export type InfoViewMode = 'home' | 'category' | 'reader';
