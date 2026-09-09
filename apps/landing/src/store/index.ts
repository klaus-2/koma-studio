"use client";

import { create } from "zustand";

interface AppState {
  isScrolled: boolean;
  setIsScrolled: (v: boolean) => void;

  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (v: boolean) => void;
  toggleMobileMenu: () => void;

  activeFeature: string | null;
  setActiveFeature: (id: string | null) => void;

  workflowStep: number;
  setWorkflowStep: (step: number) => void;

  expandedFaq: number | null;
  setExpandedFaq: (idx: number | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isScrolled: false,
  setIsScrolled: (v) => set({ isScrolled: v }),

  isMobileMenuOpen: false,
  setIsMobileMenuOpen: (v) => set({ isMobileMenuOpen: v }),
  toggleMobileMenu: () =>
    set((s) => ({ isMobileMenuOpen: !s.isMobileMenuOpen })),

  activeFeature: null,
  setActiveFeature: (id) => set({ activeFeature: id }),

  workflowStep: 0,
  setWorkflowStep: (step) => set({ workflowStep: step }),

  expandedFaq: null,
  setExpandedFaq: (idx) => set({ expandedFaq: idx }),
}));
