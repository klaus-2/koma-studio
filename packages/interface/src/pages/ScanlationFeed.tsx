import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LazyMotion, domMax, useReducedMotion } from 'framer-motion';
import {
  AtSign,
  Camera,
  Globe,
  Mail,
  MessageCircle,
  Send,
} from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';
import {
  createScanlationFeedClient,
  type FeedApplication,
  type FeedBan,
  type FeedContactEntry,
  type FeedPost,
  type FeedPostMediaItem,
  type FeedReport,
} from '../services/scanlationFeed';
import {
  useScanlationFeedMutations,
  useScanlationFeedQuery,
} from '../query/scanlationFeed';
import { preprocessImgurImageFile, uploadImgurImages } from '../services/imgur';
import { validateDiscordWebhookUrl } from '../services/discordWebhook';
import ScanlationFeedApplyReportModals from './scanlation-feed/ScanlationFeedApplyReportModals';
import ScanlationFeedComposerModal from './scanlation-feed/ScanlationFeedComposerModal';
import ScanlationFeedContent from './scanlation-feed/ScanlationFeedContent';
import type {
  ApplicationFormState,
  ContactPlatformKey,
  ContactPlatformMeta,
  FeedTab,
  ModerationBanScopeOption,
  RecruitmentFormState,
  RecruitmentRoleOption,
  RecruitmentRoleValue,
  ReportFormState,
  ShowcaseFormState,
  SocialPlatformOption,
} from './scanlation-feed/ScanlationFeed.types';

import './ScanlationFeedPage.css';

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */

interface ScanlationFeedPageProps {
  onBackDashboard: () => void;
}

const EMPTY_FEED_POSTS: FeedPost[] = [];
const EMPTY_FEED_APPLICATIONS: FeedApplication[] = [];
const EMPTY_FEED_REPORTS: FeedReport[] = [];
const EMPTY_FEED_BANS: FeedBan[] = [];

const isAdminRole = (r: string | undefined): boolean =>
  r === 'admin' || r === 'owner';

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */

export const ScanlationFeedPage = ({
  onBackDashboard,
}: ScanlationFeedPageProps) => {
  const { t, locale } = useI18n();
  const prefersReducedMotion = useReducedMotion();
  const { user, getAuthToken, refreshSession } = useAuth();

  const RECRUITMENT_ROLES = useMemo<readonly RecruitmentRoleOption[]>(() => [
    { value: 'RAW', label: t('feed.roles.raw'), shortName: null, cssKey: 'raw' },
    { value: 'CL', label: t('feed.roles.cl'), shortName: 'CL', cssKey: 'cl' },
    { value: 'RD', label: t('feed.roles.rd'), shortName: 'RD', cssKey: 'rd' },
    { value: 'TL', label: t('feed.roles.tl'), shortName: 'TL', cssKey: 'tl' },
    { value: 'PR', label: t('feed.roles.pr'), shortName: 'PR', cssKey: 'pr' },
    { value: 'TS', label: t('feed.roles.ts'), shortName: 'TS', cssKey: 'ts' },
    { value: 'QC', label: t('feed.roles.qc'), shortName: 'QC', cssKey: 'qc' },
  ], [t]);

  const CONTACT_PLATFORM_META = useMemo<ContactPlatformMeta>(() => ({
    discord: {
      label: t('feed.contact.discord'),
      placeholder: t('feed.contact.placeholder.discord'),
      icon: MessageCircle,
      mode: 'text',
    },
    twitter_x: {
      label: t('feed.contact.twitter_x'),
      placeholder: t('feed.contact.placeholder.twitter_x'),
      icon: AtSign,
      mode: 'username_or_url',
    },
    telegram: {
      label: t('feed.contact.telegram'),
      placeholder: t('feed.contact.placeholder.telegram'),
      icon: Send,
      mode: 'text',
    },
    email: {
      label: t('feed.contact.email'),
      placeholder: t('feed.contact.placeholder.email'),
      icon: Mail,
      mode: 'email',
    },
    whatsapp: {
      label: t('feed.contact.whatsapp'),
      placeholder: t('feed.contact.placeholder.whatsapp'),
      icon: MessageCircle,
      mode: 'text',
    },
    instagram: {
      label: t('feed.contact.instagram'),
      placeholder: t('feed.contact.placeholder.instagram'),
      icon: Camera,
      mode: 'username_or_url',
    },
  }), [t]);

  const SOCIAL_PLATFORMS = useMemo<readonly SocialPlatformOption[]>(() => [
    {
      value: 'discord',
      label: t('feed.contact.discord'),
      icon: MessageCircle,
      cssKey: 'discord',
      type: 'url' as const,
    },
    {
      value: 'twitter_x',
      label: t('feed.contact.twitter_x'),
      icon: Globe,
      cssKey: 'twitter_x',
      type: 'username' as const,
    },
    {
      value: 'telegram',
      label: t('feed.contact.telegram'),
      icon: Send,
      cssKey: 'telegram',
      type: 'url' as const,
    },
    {
      value: 'email',
      label: t('feed.contact.email'),
      icon: Mail,
      cssKey: 'email',
      type: 'url' as const,
    },
    {
      value: 'whatsapp',
      label: t('feed.contact.whatsapp'),
      icon: MessageCircle,
      cssKey: 'whatsapp',
      type: 'url' as const,
    },
    {
      value: 'instagram',
      label: t('feed.contact.instagram'),
      icon: Camera,
      cssKey: 'instagram',
      type: 'username' as const,
    },
  ], [t]);

  const WEEKDAY_OPTIONS = useMemo<readonly string[]>(() => [
    t('feed.weekdays.seg'),
    t('feed.weekdays.ter'),
    t('feed.weekdays.qua'),
    t('feed.weekdays.qui'),
    t('feed.weekdays.sex'),
    t('feed.weekdays.sab'),
    t('feed.weekdays.dom'),
  ], [t]);

  const REPORT_REASONS = useMemo(() => [
    { key: 'malicious_link', label: t('feed.report.reasons.malicious_link') },
    { key: 'spam', label: t('feed.report.reasons.spam') },
    { key: 'impersonation', label: t('feed.report.reasons.impersonation') },
    { key: 'harassment', label: t('feed.report.reasons.harassment') },
    { key: 'copyright', label: t('feed.report.reasons.copyright') },
    { key: 'other', label: t('feed.report.reasons.other') },
  ] as const, [t]);

  const buildSocialContactEntry = useCallback((
    platform: ContactPlatformKey,
    rawValue: string,
  ): FeedContactEntry => {
    const trimmed = rawValue.trim();
    const meta = CONTACT_PLATFORM_META[platform];
    const plain = trimmed.replace(/^@/, '');
    if (platform === 'email')
      return {
        type: platform,
        value: trimmed,
        url: trimmed.includes('@') ? `mailto:${trimmed}` : null,
      };
    if (
      meta.mode === 'username_or_url' &&
      !/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ) {
      const base =
        platform === 'twitter_x' ? 'https://x.com/' : 'https://instagram.com/';
      return { type: platform, value: plain, url: `${base}${plain}` };
    }
    return { type: platform, value: trimmed, url: null };
  }, [CONTACT_PLATFORM_META]);

  const client = useMemo(
    () => createScanlationFeedClient({ getAuthToken, refreshSession }),
    [getAuthToken, refreshSession],
  );
  const canModerate = isAdminRole(user?.appRole);
  const postDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'pt-br' ? 'pt-BR' : locale === 'zh-tw' ? 'zh-TW' : locale, {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [locale],
  );
  const recruitmentRoleByValue = useMemo(
    () =>
      new Map<RecruitmentRoleValue, RecruitmentRoleOption>(
        RECRUITMENT_ROLES.map((role) => [role.value, role]),
      ),
    [RECRUITMENT_ROLES],
  );
  const socialPlatformByValue = useMemo(
    () =>
      new Map<ContactPlatformKey, SocialPlatformOption>(
        SOCIAL_PLATFORMS.map((platform) => [platform.value, platform]),
      ),
    [SOCIAL_PLATFORMS],
  );
  const moderationBanScopes = useMemo<readonly ModerationBanScopeOption[]>(
    () => [
      { key: 'account_only', label: t('common.account') },
      { key: 'account_hwid', label: t('feed.moderation.scope.accountHwid') },
      { key: 'account_hwid_mac_ip', label: t('feed.moderation.scope.full') },
    ],
    [t],
  );
  const heroTitle = useMemo(
    () =>
      canModerate
        ? t('feed.hero.title')
        : `${t('feed.tab.recruitment')} & ${t('feed.tab.showcase')}`,
    [canModerate, t],
  );

  /* state */
  const [tab, setTab] = useState<FeedTab>('recruitment');
  // ponytail: render-rule fix — this only tracks the previous fetch's count for
  // the new-application notice below; a ref holds it without re-rendering.
  const previousReceivedCountRef = useRef(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [reportingPost, setReportingPost] = useState<FeedPost | null>(null);
  const [applyingPost, setApplyingPost] = useState<FeedPost | null>(null);

  const [banTargetUserId, setBanTargetUserId] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banScope, setBanScope] = useState<
    'account_only' | 'account_hwid' | 'account_hwid_mac_ip'
  >('account_hwid_mac_ip');
  const [profileWebhook, setProfileWebhook] = useState('');
  const [profileWebhookEnabled, setProfileWebhookEnabled] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [mediaItems, setMediaItems] = useState<FeedPostMediaItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const [recruitmentForm, setRecruitmentForm] = useState<RecruitmentFormState>({
    title: '',
    summary: '',
    body: '',
    scanlationName: '',
    workTitle: '',
    experience: '',
    paidWork: false,
    socialLinks: [],
    showSocialInput: false,
    pendingSocialPlatform: 'discord',
    pendingSocialValue: '',
    socialError: '',
    candidateRequirements: {
      portfolio: false,
      experience: true,
      availability: true,
      contact: true,
      availabilityHoursPerWeek: '',
      availabilityDays: [] as string[],
      availabilityDescription: '',
    },
    roleOpenings: [],
    pendingRole: 'RAW',
    pendingCompensationAmount: '',
    showRoleInput: false,
    roleError: '',
  });

  const [showcaseForm, setShowcaseForm] = useState<ShowcaseFormState>({
    title: '',
    summary: '',
    body: '',
    scanlationName: '',
    workTitle: '',
    chapterLabel: '',
    description: '',
    genres: '',
  });

  const [applicationForm, setApplicationForm] = useState<ApplicationFormState>({
    message: '',
    experience: '',
    availabilityHoursPerWeek: '',
    availabilityDays: [],
    availabilityDescription: '',
    preferredContactType: 'discord',
    preferredContactValue: '',
    portfolioLinks: '',
  });

  const [reportForm, setReportForm] = useState<ReportFormState>({
    reasonCode: 'malicious_link',
    details: '',
  });

  const feedDataQuery = useScanlationFeedQuery(client, tab, canModerate);
  const {
    saveProfileMutation,
    createPostMutation,
    applyToPostMutation,
    createReportMutation,
    updateModerationPostMutation,
    updateModerationReportMutation,
    createBanMutation,
  } = useScanlationFeedMutations(client, tab, canModerate, {
    id: user?.id,
    name: user?.name,
    email: user?.email,
  });

  const loading = feedDataQuery.isLoading || feedDataQuery.isFetching;
  const profile = feedDataQuery.data?.profile ?? null;
  const posts = feedDataQuery.data?.posts ?? EMPTY_FEED_POSTS;
  const sentApplications =
    feedDataQuery.data?.sentApplications ?? EMPTY_FEED_APPLICATIONS;
  const receivedApplications =
    feedDataQuery.data?.receivedApplications ?? EMPTY_FEED_APPLICATIONS;
  const reports = feedDataQuery.data?.reports ?? EMPTY_FEED_REPORTS;
  const bans = feedDataQuery.data?.bans ?? EMPTY_FEED_BANS;

  useEffect(() => {
    if (tab === 'moderation' && !canModerate) {
      setTab('recruitment');
    }
  }, [canModerate, tab]);

  useEffect(() => {
    if (!feedDataQuery.error) {
      setError(null);
      return;
    }
    setError(
      feedDataQuery.error instanceof Error
        ? feedDataQuery.error.message
        : t('feed.error.loadFailed'),
    );
  }, [feedDataQuery.error, t]);

  useEffect(() => {
    if (!profile) {
      return;
    }
    setRulesAccepted(Boolean(profile.rulesAcceptedAt));
    setProfileWebhookEnabled(profile.authorNotificationWebhookEnabled);
    setProfileWebhook(profile.authorNotificationWebhookUrl ?? '');
  }, [profile]);

  useEffect(() => {
    const previousCount = previousReceivedCountRef.current;
    if (receivedApplications.length > previousCount && previousCount > 0)
      setFeedback(t('feed.feedback.newApplication'));
    previousReceivedCountRef.current = receivedApplications.length;
  }, [receivedApplications.length, t]);

  const visiblePosts = useMemo(
    () =>
      posts.filter((post) =>
        tab === 'recruitment'
          ? post.type === 'recruitment'
          : tab === 'showcase'
            ? post.type === 'showcase'
            : true,
      ),
    [posts, tab],
  );
  const formattedVisiblePostDates = useMemo(
    () =>
      new Map(
        visiblePosts.map((post) => [
          post.id,
          postDateFormatter.format(new Date(post.createdAt)),
        ]),
      ),
    [postDateFormatter, visiblePosts],
  );

  /* handlers */
  const handleUploadMedia = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const items = await Promise.all(
        Array.from(files).map((f) => preprocessImgurImageFile(f)),
      );
      const result = await uploadImgurImages({ items });
      setMediaItems((c) => [...c, ...result.items]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('imgur.error.uploadFailed'));
    } finally {
      setUploading(false);
    }
  }, [t]);

  const toggleCandidateRequirement = useCallback(
    (k: 'portfolio' | 'experience' | 'availability' | 'contact') => {
      setRecruitmentForm((c) => ({
        ...c,
        candidateRequirements: {
          ...c.candidateRequirements,
          [k]: !c.candidateRequirements[k],
        },
      }));
    },
    [],
  );

  const toggleRequirementAvailabilityDay = useCallback((day: string) => {
    setRecruitmentForm((c) => ({
      ...c,
      candidateRequirements: {
        ...c.candidateRequirements,
        availabilityDays: c.candidateRequirements.availabilityDays.includes(day)
          ? c.candidateRequirements.availabilityDays.filter((d) => d !== day)
          : [...c.candidateRequirements.availabilityDays, day],
      },
    }));
  }, []);

  const addRoleOpening = useCallback(() => {
    setRecruitmentForm((c) => {
      if (c.roleOpenings.some((e) => e.role === c.pendingRole)) {
        return {
          ...c,
          roleError: t('feed.error.roleDuplicate', {
            role: recruitmentRoleByValue.get(c.pendingRole)?.label ?? c.pendingRole,
          }),
        };
      }
      if (c.paidWork && c.pendingCompensationAmount.trim()) {
        const v = Number(c.pendingCompensationAmount);
        if (Number.isNaN(v) || v < 0)
          return { ...c, roleError: t('feed.error.valuePositive') };
      }
      return {
        ...c,
        roleOpenings: [
          ...c.roleOpenings,
          {
            id: `${c.pendingRole}-${Date.now()}`,
            role: c.pendingRole,
            compensationAmount: c.pendingCompensationAmount,
          },
        ],
        pendingCompensationAmount: '',
        pendingRole: 'RAW',
        showRoleInput: false,
        roleError: '',
      };
    });
  }, [recruitmentRoleByValue, t]);

  const removeRoleOpening = useCallback((id: string) => {
    setRecruitmentForm((c) => ({
      ...c,
      roleOpenings: c.roleOpenings.filter((e) => e.id !== id),
      roleError: '',
    }));
  }, []);

  const addSocialLink = useCallback(() => {
    setRecruitmentForm((c) => {
      const v = c.pendingSocialValue.trim();
      const meta = CONTACT_PLATFORM_META[c.pendingSocialPlatform];
      if (!v)
        return {
          ...c,
          socialError: t('feed.error.platformRequired', { platform: meta.label }),
        };
      if (c.socialLinks.some((e) => e.platform === c.pendingSocialPlatform))
        return {
          ...c,
          socialError: t('feed.error.platformDuplicate', { platform: meta.label }),
        };
      return {
        ...c,
        socialLinks: [
          ...c.socialLinks,
          {
            id: `${c.pendingSocialPlatform}-${Date.now()}`,
            platform: c.pendingSocialPlatform,
            value: v,
          },
        ],
        pendingSocialValue: '',
        pendingSocialPlatform: 'discord',
        showSocialInput: false,
        socialError: '',
      };
    });
  }, [CONTACT_PLATFORM_META, t]);

  const removeSocialLink = useCallback((id: string) => {
    setRecruitmentForm((c) => ({
      ...c,
      socialLinks: c.socialLinks.filter((e) => e.id !== id),
      socialError: '',
    }));
  }, []);

  const handleSaveProfile = useCallback(async () => {
    try {
      if (profileWebhookEnabled && profileWebhook.trim()) {
        const v = validateDiscordWebhookUrl(profileWebhook.trim());
        if (!v.valid) {
          setError(v.error);
          return;
        }
      }
      await saveProfileMutation.mutateAsync({
        rulesAccepted,
        authorNotificationWebhookEnabled: profileWebhookEnabled,
        authorNotificationWebhookUrl: profileWebhook.trim() || undefined,
      });
      setFeedback(t('feed.feedback.profileUpdated'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('feed.error.saveProfileFailed'));
    }
  }, [profileWebhook, profileWebhookEnabled, rulesAccepted, saveProfileMutation, t]);

  const resetComposerForms = useCallback(() => {
    setMediaItems([]);
    setRecruitmentForm({
      title: '',
      summary: '',
      body: '',
      scanlationName: '',
      workTitle: '',
      experience: '',
      paidWork: false,
      socialLinks: [],
      showSocialInput: false,
      pendingSocialPlatform: 'discord',
      pendingSocialValue: '',
      socialError: '',
      candidateRequirements: {
        portfolio: false,
        experience: true,
        availability: true,
        contact: true,
        availabilityHoursPerWeek: '',
        availabilityDays: [],
        availabilityDescription: '',
      },
      roleOpenings: [],
      pendingRole: 'RAW',
      pendingCompensationAmount: '',
      showRoleInput: false,
      roleError: '',
    });
    setShowcaseForm({
      title: '',
      summary: '',
      body: '',
      scanlationName: '',
      workTitle: '',
      chapterLabel: '',
      description: '',
      genres: '',
    });
  }, []);

  const handleCreatePost = useCallback(async () => {
    try {
      const rf = recruitmentForm;
      const payload =
        tab === 'recruitment'
          ? {
              type: 'recruitment',
              title: rf.title,
              summary: rf.summary,
              body: rf.body,
              media: mediaItems,
              recruitment: {
                scanlationName: rf.scanlationName,
                workTitle: rf.workTitle || null,
                roles: rf.roleOpenings.map((e) => e.role),
                roleOpenings: rf.roleOpenings.map((e) => ({
                  role: e.role,
                  compensationAmount: rf.paidWork
                    ? e.compensationAmount || null
                    : null,
                })),
                experience: rf.experience || null,
                availabilityHoursPerWeek: rf.candidateRequirements
                  .availabilityHoursPerWeek
                  ? Number(rf.candidateRequirements.availabilityHoursPerWeek)
                  : null,
                availabilityDays: rf.candidateRequirements.availabilityDays,
                paidWork: rf.paidWork,
                compensation: rf.paidWork
                  ? rf.roleOpenings
                      .map((e) => `${e.role}: ${e.compensationAmount || '-'}`)
                      .join(' | ')
                  : null,
                contactTypes: rf.socialLinks.map(
                  (i) => CONTACT_PLATFORM_META[i.platform].label,
                ),
                contacts: rf.socialLinks.map((i) =>
                  buildSocialContactEntry(i.platform, i.value),
                ),
                candidateRequirements: {
                  portfolio: rf.candidateRequirements.portfolio,
                  experience: rf.candidateRequirements.experience,
                  availability: rf.candidateRequirements.availability,
                  availabilityHoursPerWeek: rf.candidateRequirements
                    .availabilityHoursPerWeek
                    ? Number(rf.candidateRequirements.availabilityHoursPerWeek)
                    : null,
                  availabilityDays: rf.candidateRequirements.availabilityDays,
                  availabilityDescription:
                    rf.candidateRequirements.availabilityDescription || null,
                  contact: rf.candidateRequirements.contact,
                },
              },
            }
          : {
              type: 'showcase',
              title: showcaseForm.title,
              summary: showcaseForm.summary,
              body: showcaseForm.body,
              media: mediaItems,
              showcase: {
                scanlationName: showcaseForm.scanlationName,
                workTitle: showcaseForm.workTitle,
                chapterLabel: showcaseForm.chapterLabel || null,
                description: showcaseForm.description || null,
                genres: showcaseForm.genres
                  .split(',')
                  .map((g) => g.trim())
                  .filter(Boolean),
              },
            };
      await createPostMutation.mutateAsync(payload);
      setFeedback(
        tab === 'recruitment'
          ? t('feed.feedback.postPublishedRecruit')
          : t('feed.feedback.postPublishedShowcase'),
      );
      setComposerOpen(false);
      resetComposerForms();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('feed.error.publishFailed'));
    }
  }, [
    CONTACT_PLATFORM_META,
    buildSocialContactEntry,
    createPostMutation,
    mediaItems,
    recruitmentForm,
    resetComposerForms,
    showcaseForm,
    t,
    tab,
  ]);

  const handleApply = useCallback(async () => {
    if (!applyingPost) return;
    try {
      const af = applicationForm;
      await applyToPostMutation.mutateAsync({
        postId: applyingPost.id,
        payload: {
        message: af.message,
        experience: af.experience || null,
        availabilityHoursPerWeek: af.availabilityHoursPerWeek
          ? Number(af.availabilityHoursPerWeek)
          : null,
        availabilityDays: af.availabilityDays,
        availabilityDescription: af.availabilityDescription || null,
        preferredContact: {
          type: af.preferredContactType,
          value: af.preferredContactValue,
        },
        portfolioLinks: af.portfolioLinks
          .split(/\r?\n|,/)
          .map((l) => l.trim())
          .filter(Boolean),
        },
      });
      setApplyingPost(null);
      setApplicationForm({
        message: '',
        experience: '',
        availabilityHoursPerWeek: '',
        availabilityDays: [],
        availabilityDescription: '',
        preferredContactType: 'discord',
        preferredContactValue: '',
        portfolioLinks: '',
      });
      setFeedback(t('feed.feedback.applicationSent'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('feed.error.applyFailed'));
    }
  }, [applyingPost, applicationForm, applyToPostMutation, t]);

  const handleReport = useCallback(async () => {
    if (!reportingPost) return;
    try {
      await createReportMutation.mutateAsync({
        postId: reportingPost.id,
        reasonCode: reportForm.reasonCode,
        details: reportForm.details,
      });
      setReportingPost(null);
      setReportForm({ reasonCode: 'malicious_link', details: '' });
      setFeedback(t('feed.feedback.reportSent'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('feed.error.reportFailed'));
    }
  }, [createReportMutation, reportForm, reportingPost, t]);

  const handleModerationPost = useCallback(
    async (post: FeedPost, status: FeedPost['moderationStatus']) => {
      try {
        await updateModerationPostMutation.mutateAsync({
          id: post.id,
          moderationStatus: status,
        });
        setFeedback(t('feed.feedback.postStatusUpdated', { status }));
      } catch (e) {
        setError(e instanceof Error ? e.message : t('feed.error.moderatePostFailed'));
      }
    },
    [t, updateModerationPostMutation],
  );

  const handleResolveReport = useCallback(
    async (report: FeedReport, status: FeedReport['status']) => {
      try {
        await updateModerationReportMutation.mutateAsync({
          id: report.id,
          status,
          resolutionNotes:
            status === 'resolved'
              ? t('feed.moderation.notes.resolved')
              : t('feed.moderation.notes.dismissed'),
        });
        setFeedback(t('feed.feedback.reportUpdated'));
      } catch (e) {
        setError(e instanceof Error ? e.message : t('feed.error.moderateReportFailed'));
      }
    },
    [t, updateModerationReportMutation],
  );

  const handleStartBanFromPost = useCallback((post: FeedPost) => {
    setBanTargetUserId(post.author.id);
    setBanReason(t('feed.moderation.banReasonPost', { title: post.title }));
    setTab('moderation');
  }, [t]);

  const handleCreateBan = useCallback(async () => {
    try {
      await createBanMutation.mutateAsync({
        targetUserId: banTargetUserId,
        scope: banScope,
        reason: banReason,
      });
      setFeedback(t('feed.feedback.banApplied'));
      setBanReason('');
      setBanTargetUserId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('feed.error.banFailed'));
    }
  }, [banReason, banScope, banTargetUserId, createBanMutation, t]);

  const handleRulesAcceptedChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setRulesAccepted(event.target.checked);
    },
    [],
  );

  const handleProfileWebhookEnabledChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setProfileWebhookEnabled(event.target.checked);
    },
    [],
  );

  const handleProfileWebhookChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setProfileWebhook(event.target.value);
    },
    [],
  );

  const handlePaidWorkToggle = useCallback((value: boolean) => {
    setRecruitmentForm((current) => ({
      ...current,
      paidWork: value,
      roleError: '',
    }));
  }, []);

  const handleRequirementPortfolioChange = useCallback(
    () => toggleCandidateRequirement('portfolio'),
    [toggleCandidateRequirement],
  );

  const handleRequirementExperienceChange = useCallback(
    () => toggleCandidateRequirement('experience'),
    [toggleCandidateRequirement],
  );

  const handleRequirementAvailabilityChange = useCallback(
    () => toggleCandidateRequirement('availability'),
    [toggleCandidateRequirement],
  );

  const handleRequirementContactChange = useCallback(
    () => toggleCandidateRequirement('contact'),
    [toggleCandidateRequirement],
  );

  const openComposer = useCallback(() => {
    setComposerOpen(true);
  }, []);


  const composerTypeLabel =
    tab === 'recruitment' ? t('feed.composer.typeRecruit') : t('feed.composer.typeShowcase');

  /* ═══════════════════════════════════════════
     Render
     ═══════════════════════════════════════════ */
  return (
    <div className="koma-feed">
      {/* LazyMotion provider for the feed tree's `m` components. domMax (not
          domAnimation) because the composer sections animate `layout`. */}
      <LazyMotion features={domMax}>
      <ScanlationFeedContent
        tab={tab}
        canModerate={canModerate}
        heroTitle={heroTitle}
        composerTypeLabel={composerTypeLabel}
        feedback={feedback}
        error={error}
        loading={loading}
        currentUserId={user?.id}
        profile={profile}
        rulesAccepted={rulesAccepted}
        profileWebhookEnabled={profileWebhookEnabled}
        profileWebhook={profileWebhook}
        visiblePosts={visiblePosts}
        formattedVisiblePostDates={formattedVisiblePostDates}
        sentApplications={sentApplications}
        receivedApplications={receivedApplications}
        reports={reports}
        bans={bans}
        banTargetUserId={banTargetUserId}
        banReason={banReason}
        banScope={banScope}
        moderationBanScopes={moderationBanScopes}
        onBackDashboard={onBackDashboard}
        onTabChange={setTab}
        onOpenComposer={openComposer}
        onApplyPost={setApplyingPost}
        onReportPost={setReportingPost}
        onModerationPost={(post, status) =>
          void handleModerationPost(post, status)
        }
        onStartBanFromPost={handleStartBanFromPost}
        onRulesAcceptedChange={handleRulesAcceptedChange}
        onProfileWebhookEnabledChange={handleProfileWebhookEnabledChange}
        onProfileWebhookChange={handleProfileWebhookChange}
        onSaveProfile={() => void handleSaveProfile()}
        setBanTargetUserId={setBanTargetUserId}
        setBanReason={setBanReason}
        setBanScope={setBanScope}
        onResolveReport={(report, status) =>
          void handleResolveReport(report, status)
        }
        onCreateBan={() => void handleCreateBan()}
      />

      <ScanlationFeedComposerModal
        open={composerOpen}
        tab={tab}
        composerTypeLabel={composerTypeLabel}
        recruitmentForm={recruitmentForm}
        showcaseForm={showcaseForm}
        mediaItems={mediaItems}
        uploading={uploading}
        weekDayOptions={WEEKDAY_OPTIONS}
        recruitmentRoles={RECRUITMENT_ROLES}
        socialPlatforms={SOCIAL_PLATFORMS}
        contactPlatformMeta={CONTACT_PLATFORM_META}
        recruitmentRoleByValue={recruitmentRoleByValue}
        socialPlatformByValue={socialPlatformByValue}
        prefersReducedMotion={Boolean(prefersReducedMotion)}
        setOpen={setComposerOpen}
        setRecruitmentForm={setRecruitmentForm}
        setShowcaseForm={setShowcaseForm}
        onPaidWorkToggle={handlePaidWorkToggle}
        onRequirementPortfolioChange={handleRequirementPortfolioChange}
        onRequirementExperienceChange={handleRequirementExperienceChange}
        onRequirementAvailabilityChange={handleRequirementAvailabilityChange}
        onRequirementContactChange={handleRequirementContactChange}
        onToggleRequirementAvailabilityDay={toggleRequirementAvailabilityDay}
        onAddRoleOpening={addRoleOpening}
        onRemoveRoleOpening={removeRoleOpening}
        onAddSocialLink={addSocialLink}
        onRemoveSocialLink={removeSocialLink}
        onUploadMedia={(files) => void handleUploadMedia(files)}
        onCreatePost={() => void handleCreatePost()}
      />

      <ScanlationFeedApplyReportModals
        applyingPost={applyingPost}
        reportingPost={reportingPost}
        applicationForm={applicationForm}
        reportForm={reportForm}
        weekDayOptions={WEEKDAY_OPTIONS}
        reportReasons={REPORT_REASONS}
        applyPending={applyToPostMutation.isPending}
        reportPending={createReportMutation.isPending}
        setApplyingPost={setApplyingPost}
        setReportingPost={setReportingPost}
        setApplicationForm={setApplicationForm}
        setReportForm={setReportForm}
        onApply={() => void handleApply()}
        onReport={() => void handleReport()}
      />
      </LazyMotion>
    </div>
  );
};
