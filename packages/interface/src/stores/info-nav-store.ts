/* ============================================================
   KŌMA STUDIO — Info Navigation Store (Enhanced)
   Guides & Resources navigation, progress, bookmarks
   ============================================================ */

   import { create } from 'zustand';
   import { devtools, persist } from 'zustand/middleware';
   
   import type { GuideCategoryId, ResourceTab } from '../data/guides-types';
   
   interface InfoNavStore {
     /* ── Guides Navigation ── */
     guidesView: 'home' | 'category' | 'reader';
     guidesCategory: GuideCategoryId | null;
     guidesEntryId: string | null;
     guidesActiveStep: number;
     guidesSearch: string;
   
     /* ── Guides Progress ── */
     stepProgress: Record<string, number>;   // guideId → last step index
     readGuides: Record<string, boolean>;    // guideId → completed
     bookmarks: string[];                    // guideIds
     checklistState: Record<string, boolean>;
     recentGuides: string[];                 // last 5 guideIds viewed
   
   /* ── Resources Navigation ── */
   resourcesCategory: ResourceTab;
   resourcesTab: ResourceTab;
   resourcesSearch: string;

  setResourcesCategory: (cat: ResourceTab) => void;
  setResourcesSearch: (q: string) => void;
  navigateToResourceCategory: (cat: ResourceTab) => void;
  navigateResourcesHome: () => void;
   
     /* ── Guides Actions ── */
     navigateToGuideCategory: (cat: GuideCategoryId) => void;
     navigateToGuideEntry: (cat: GuideCategoryId, id: string) => void;
     navigateGuidesHome: () => void;
     setGuidesActiveStep: (idx: number) => void;
     setGuidesSearch: (q: string) => void;
     updateStepProgress: (guideId: string, step: number) => void;
     markGuideRead: (guideId: string) => void;
     toggleBookmark: (guideId: string) => void;
     toggleChecklistItem: (itemId: string) => void;
     addToRecentGuides: (guideId: string) => void;
   
     /* ── Resources Actions ── */
     setResourcesTab: (tab: ResourceTab) => void;
   }
   
   export const useInfoNavStore = create<InfoNavStore>()(
     devtools(
     persist(
       (set, get) => ({
         /* ── Guides defaults ── */
         guidesView: 'home',
         guidesCategory: null,
         guidesEntryId: null,
         guidesActiveStep: 0,
         guidesSearch: '',
   
         stepProgress: {},
         readGuides: {},
         bookmarks: [],
         checklistState: {},
         recentGuides: [],
   
         /* ── Resources ── */
   resourcesCategory: 'fonts',
   resourcesTab: 'fonts',
   resourcesSearch: '',

  setResourcesCategory: (cat) => set({ resourcesCategory: cat }),
  setResourcesSearch: (q) => set({ resourcesSearch: q }),

  navigateToResourceCategory: (cat) =>
    set({ resourcesCategory: cat }),

  navigateResourcesHome: () =>
    set({
      resourcesCategory: 'fonts',
      resourcesTab: 'fonts',
      resourcesSearch: '',
    }),
   
         /* ── Guides Actions ── */
         navigateToGuideCategory: (cat) =>
           set({
             guidesView: 'category',
             guidesCategory: cat,
             guidesEntryId: null,
             guidesActiveStep: 0,
           }),
   
         navigateToGuideEntry: (cat, id) => {
           const progress = get().stepProgress[id] ?? 0;
           set({
             guidesView: 'reader',
             guidesCategory: cat,
             guidesEntryId: id,
             guidesActiveStep: progress,
           });
           get().addToRecentGuides(id);
         },
   
         navigateGuidesHome: () =>
           set({
             guidesView: 'home',
             guidesCategory: null,
             guidesEntryId: null,
             guidesActiveStep: 0,
             guidesSearch: '',
           }),
   
         setGuidesActiveStep: (idx) => {
           const guideId = get().guidesEntryId;
           set({ guidesActiveStep: idx });
           if (guideId) {
             get().updateStepProgress(guideId, idx);
           }
         },
   
         setGuidesSearch: (q) => set({ guidesSearch: q }),
   
         updateStepProgress: (guideId, step) =>
           set((s) => ({
             stepProgress: { ...s.stepProgress, [guideId]: step },
           })),
   
         markGuideRead: (guideId) =>
           set((s) => ({
             readGuides: { ...s.readGuides, [guideId]: true },
           })),
   
         toggleBookmark: (guideId) =>
           set((s) => ({
             bookmarks: s.bookmarks.includes(guideId)
               ? s.bookmarks.filter((id) => id !== guideId)
               : [...s.bookmarks, guideId],
           })),
   
         toggleChecklistItem: (itemId) =>
           set((s) => ({
             checklistState: {
               ...s.checklistState,
               [itemId]: !s.checklistState[itemId],
             },
           })),
   
         addToRecentGuides: (guideId) =>
           set((s) => {
             const filtered = s.recentGuides.filter((id) => id !== guideId);
             return { recentGuides: [guideId, ...filtered].slice(0, 5) };
           }),
   
         /* ── Resources Actions ── */
         setResourcesTab: (tab) => set({ resourcesTab: tab }),
       }),
       {
         name: 'koma_info_nav',
         partialize: (state) => ({
           stepProgress: state.stepProgress,
           readGuides: state.readGuides,
           bookmarks: state.bookmarks,
           checklistState: state.checklistState,
           recentGuides: state.recentGuides,
           resourcesTab: state.resourcesTab,
         }),
       },
     ),
     { name: 'info-nav-store' },
     ),
   );
