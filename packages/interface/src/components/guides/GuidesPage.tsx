/* ============================================================
   KŌMA STUDIO — Guides Page (Router)
   ============================================================ */

   import { useInfoNavStore } from '../../stores/info-nav-store';
   import GuidesHome from './GuidesHome';
   import GuidesCategoryView from './GuidesCategoryView';
   import GuideReader from './GuideReader';
   
   export default function GuidesPage() {
     const view = useInfoNavStore((s) => s.guidesView);
     const category = useInfoNavStore((s) => s.guidesCategory);
     const entryId = useInfoNavStore((s) => s.guidesEntryId);
   
     if (view === 'reader' && category && entryId) {
       return <GuideReader categoryId={category} entryId={entryId} />;
     }
   
     if (view === 'category' && category) {
       return <GuidesCategoryView categoryId={category} />;
     }
   
     return <GuidesHome />;
   }