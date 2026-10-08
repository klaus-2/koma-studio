export const SettingsTabIcon = ({ id }: { id: string }) => {
  const p = {
    viewBox: "0 0 18 18", width: 13, height: 13, fill: "none",
    stroke: "currentColor", strokeWidth: 2, strokeLinecap: "square" as const, strokeLinejoin: "miter" as const
  };
  switch (id) {
    case "user": return (<svg {...p}><circle cx="9" cy="5.5" r="3" /><path d="M2.5 16.5c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5" /></svg>);
    case "chart": return (<svg {...p}><path d="M2 16h14M3.5 16V9M9 16V4M14.5 16V6.5" /></svg>);
    case "sliders": return (<svg {...p}><path d="M3 4h12M3 9h12M3 14h12" /><rect x="4.5" y="2.5" width="3" height="3" fill="currentColor" stroke="none" /><rect x="10.5" y="7.5" width="3" height="3" fill="currentColor" stroke="none" /><rect x="6.5" y="12.5" width="3" height="3" fill="currentColor" stroke="none" /></svg>);
    case "link": return (<svg {...p}><path d="M7.5 10.5a4 4 0 005.66 0l2-2a4 4 0 00-5.66-5.66l-1 1" /><path d="M10.5 7.5a4 4 0 00-5.66 0l-2 2a4 4 0 005.66 5.66l1-1" /></svg>);
    case "app": return (<svg {...p}><rect x="2.5" y="2.5" width="13" height="13" /><path d="M9 6v6M6 9.5l3 3 3-3" /></svg>);
    default: return null;
  }
};
