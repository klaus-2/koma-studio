import type { LucideIcon } from 'lucide-react';

import type {
  FeedBanScope,
  FeedRecruitmentRoleOpening,
} from '../../services/scanlationFeed';

export type FeedTab = 'recruitment' | 'showcase' | 'moderation';
export type RecruitmentRoleValue = FeedRecruitmentRoleOpening['role'];
export type ContactPlatformKey =
  | 'discord'
  | 'twitter_x'
  | 'telegram'
  | 'email'
  | 'whatsapp'
  | 'instagram';

export type RecruitmentRoleOption = {
  value: RecruitmentRoleValue;
  label: string;
  shortName: string | null;
  cssKey: string;
};

export type ContactPlatformMeta = Record<
  ContactPlatformKey,
  {
    label: string;
    placeholder: string;
    icon: LucideIcon;
    mode: 'text' | 'username_or_url' | 'email';
  }
>;

export type SocialPlatformOption = {
  value: ContactPlatformKey;
  label: string;
  icon: LucideIcon;
  cssKey: string;
  type: 'url' | 'username';
};

export type ModerationBanScopeOption = {
  key: FeedBanScope;
  label: string;
};

export type RecruitmentFormState = {
  title: string;
  summary: string;
  body: string;
  scanlationName: string;
  workTitle: string;
  experience: string;
  paidWork: boolean;
  socialLinks: Array<{
    id: string;
    platform: ContactPlatformKey;
    value: string;
  }>;
  showSocialInput: boolean;
  pendingSocialPlatform: ContactPlatformKey;
  pendingSocialValue: string;
  socialError: string;
  candidateRequirements: {
    portfolio: boolean;
    experience: boolean;
    availability: boolean;
    contact: boolean;
    availabilityHoursPerWeek: string;
    availabilityDays: string[];
    availabilityDescription: string;
  };
  roleOpenings: Array<{
    id: string;
    role: RecruitmentRoleValue;
    compensationAmount: string;
  }>;
  pendingRole: RecruitmentRoleValue;
  pendingCompensationAmount: string;
  showRoleInput: boolean;
  roleError: string;
};

export type ShowcaseFormState = {
  title: string;
  summary: string;
  body: string;
  scanlationName: string;
  workTitle: string;
  chapterLabel: string;
  description: string;
  genres: string;
};

export type ApplicationFormState = {
  message: string;
  experience: string;
  availabilityHoursPerWeek: string;
  availabilityDays: string[];
  availabilityDescription: string;
  preferredContactType: ContactPlatformKey;
  preferredContactValue: string;
  portfolioLinks: string;
};

export type ReportFormState = {
  reasonCode: string;
  details: string;
};
