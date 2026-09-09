/* ─── Tab Icon SVGs ─────────────────────────────────────── */

export const SettingsTabIcon = ({ id }: { id: string }) => {
  switch (id) {
    case "user":
      return (
        <svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="5.5" r="3" />
          <path d="M2.5 16.5c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="8" width="3" height="8" rx="1" />
          <rect x="7.5" y="4" width="3" height="12" rx="1" />
          <rect x="13" y="2" width="3" height="14" rx="1" />
        </svg>
      );
    case "sliders":
      return (
        <svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="4" x2="15" y2="4" /><circle cx="6" cy="4" r="1.5" fill="currentColor" />
          <line x1="3" y1="9" x2="15" y2="9" /><circle cx="12" cy="9" r="1.5" fill="currentColor" />
          <line x1="3" y1="14" x2="15" y2="14" /><circle cx="8" cy="14" r="1.5" fill="currentColor" />
        </svg>
      );
    case "link":
      return (
        <svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.5 10.5a4 4 0 005.66 0l2-2a4 4 0 00-5.66-5.66l-1 1" />
          <path d="M10.5 7.5a4 4 0 00-5.66 0l-2 2a4 4 0 005.66 5.66l1-1" />
        </svg>
      );
    case "app":
      return (
        <svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="14" height="14" rx="3" />
          <path d="M9 6v6M6 9l3 3 3-3" />
        </svg>
      );
    default:
      return null;
  }
};
