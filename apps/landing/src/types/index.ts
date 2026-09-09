export interface NavLink {
  label: string;
  href: string;
}

export interface Feature {
  id: string;
  icon: string;
  title: string;
  description: string;
  details: string[];
  color: "purple" | "cyan" | "emerald" | "amber" | "rose";
}

export interface WorkflowStep {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: "purple" | "cyan" | "emerald" | "amber";
}

export interface Competitor {
  name: string;
  price: string;
  features: Record<string, boolean | string>;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface PageLink {
  title: string;
  href: string;
}

export interface CompareStepResult {
  description: string;
  quality: "poor" | "average" | "good" | "excellent";
  notes: string[];
}

export interface SeoPage {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  keywords?: string[];
  intro?: string;
  heroTitle: string;
  heroSubtitle: string;
  summaryQuestion: string;
  summaryAnswer: string;
  summaryTakeaways?: string[];
  sections: SeoSection[];
  faqs: FaqItem[];
  relatedPages: PageLink[];
  sourceLinks?: PageLink[];
  downloadLinks?: PageLink[];
}

export interface SeoSection {
  title: string;
  content: string;
  features?: string[];
}

export interface ComparePage {
  slug: string;
  type: "hub" | "versus";
  title: string;
  metaTitle: string;
  metaDescription: string;
  keywords?: string[];
  heroTitle: string;
  heroSubtitle: string;
  intro: string;
  competitorName?: string;
  competitorUrl?: string;
  sourceLinks?: PageLink[];
  summaryQuestion: string;
  summaryAnswer: string;
  summaryTakeaways?: string[];
  comparisonRows?: CompareRow[];
  cleaner?: {
    provider: CompareStepResult;
    koma: CompareStepResult;
  };
  typeset?: {
    provider: CompareStepResult;
    koma: CompareStepResult;
  };
  sections: CompareSection[];
  faqs: FaqItem[];
  relatedPages: PageLink[];
  cards?: CompareCardEntry[];
}

export interface StatItem {
  label: string;
  value: string;
  suffix?: string;
}

export interface CompareRow {
  label: string;
  koma: string;
  competitor: string;
}

export interface CompareSection {
  title: string;
  content: string;
  bullets?: string[];
}

export interface CompareCardEntry {
  slug: string;
  title: string;
  summary: string;
}
