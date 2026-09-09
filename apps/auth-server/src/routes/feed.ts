import type express from "express";
import type { Request, Response } from "express";

import { authenticateBearerToken } from "../auth/middleware.js";
import { env } from "../config/env.js";
import {
  createBanForUser,
  deleteAuthSessionsForUser,
  listModerationBans,
  updateBanState,
} from "../services/ban-enforcement.js";
import {
  buildApplicationNotificationWebhookPayload,
  buildReportModerationWebhookPayload,
  createFeedApplication,
  createFeedPost,
  createFeedReport,
  getFeedAuthorNotificationWebhookUrl,
  getFeedPostDetail,
  getFeedProfile,
  listFeedPosts,
  listFeedReports,
  listReceivedFeedApplications,
  listSentFeedApplications,
  updateFeedApplication,
  updateFeedPost,
  updateFeedReport,
  upsertFeedProfile,
} from "../services/feed.js";
import { resolveLocaleFromHeaders, tServer } from "../services/server-i18n.js";
import { sendDiscordWebhook } from "../services/discord-webhooks.js";
import { logger } from "../utils/logger.js";
import type { FeedReportEvidence } from "../db/schema.js";

import {
  asObject,
  ensureFeedViewerContext,
  jsonParser,
  purgeDesktopClientSessionsForUser,
  requireBanManagementAccess,
  requireModerationAccess,
  requireNoActiveBan,
  requireVerifiedEmail,
  urlEncodedParser,
} from "./_shared.js";

export function registerFeedRoutes(app: express.Express): void {
    app.get("/api/feed/profile", authenticateBearerToken, requireNoActiveBan, async (req: Request, res: Response) => {
      const profile = await getFeedProfile(req.authUser!.sub);
      return res.status(200).json(profile);
    });

    app.patch(
      "/api/feed/profile",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      async (req: Request, res: Response) => {
        try {
        const profile = await upsertFeedProfile(
          req.authUser!.sub,
          req.body,
          resolveLocaleFromHeaders(req.headers),
        );
          return res.status(200).json(profile);
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.invalidProfile"),
          });
        }
      },
    );

    app.get("/api/feed/posts", authenticateBearerToken, requireNoActiveBan, async (req: Request, res: Response) => {
      try {
        const viewer = await ensureFeedViewerContext(req.authUser!.sub);
        const typeRaw = typeof req.query.type === "string" ? req.query.type.trim() : "all";
        const type = typeRaw === "recruitment" || typeRaw === "showcase" ? typeRaw : "all";
        const mine = req.query.mine === "true";
        const posts = await listFeedPosts({ viewer, type, mine });
        return res.status(200).json({ posts });
        } catch (error) {
          return res.status(500).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.loadPostsFailed"),
          });
        }
    });

    app.post(
      "/api/feed/posts",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireVerifiedEmail,
      async (req: Request, res: Response) => {
        try {
          const viewer = await ensureFeedViewerContext(req.authUser!.sub);
          const post = await createFeedPost(viewer, req.body, {
            maxLinks: env.feedMaxLinksPerPost,
            maxMediaItems: env.feedMaxMediaItems,
            autoFlagScoreThreshold: env.feedAutoFlagScoreThreshold,
          });
          return res.status(201).json(post);
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.createPostFailed"),
          });
        }
      },
    );

    app.patch(
      "/api/feed/posts",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireVerifiedEmail,
      async (req: Request, res: Response) => {
        try {
          const viewer = await ensureFeedViewerContext(req.authUser!.sub);
          const post = await updateFeedPost(viewer, req.body, {
            autoFlagScoreThreshold: env.feedAutoFlagScoreThreshold,
          });
          return res.status(200).json(post);
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.updatePostFailed"),
          });
        }
      },
    );

    app.patch(
      "/api/feed/posts/:postId",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireVerifiedEmail,
      async (req: Request, res: Response) => {
        try {
          const viewer = await ensureFeedViewerContext(req.authUser!.sub);
          const post = await updateFeedPost(viewer, {
            ...asObject(req.body),
            id: req.params.postId,
          }, {
            autoFlagScoreThreshold: env.feedAutoFlagScoreThreshold,
          });
          return res.status(200).json(post);
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.updatePostFailed"),
          });
        }
      },
    );

    app.get("/api/feed/posts/:postId", authenticateBearerToken, requireNoActiveBan, async (req: Request, res: Response) => {
      try {
        const viewer = await ensureFeedViewerContext(req.authUser!.sub);
        const postId = req.params.postId ?? "";
        const post = await getFeedPostDetail(viewer, postId);
        return res.status(200).json(post);
        } catch (error) {
          return res.status(404).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.postNotFound"),
          });
      }
    });

    app.post(
      "/api/feed/posts/:postId/applications",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireVerifiedEmail,
      async (req: Request, res: Response) => {
        try {
          const viewer = await ensureFeedViewerContext(req.authUser!.sub);
          const postId = req.params.postId ?? "";
          const application = await createFeedApplication(viewer, postId, req.body);
          const post = await getFeedPostDetail(viewer, postId);
          const authorWebhookUrl = await getFeedAuthorNotificationWebhookUrl(post.author.id);
          if (authorWebhookUrl) {
            const webhookResult = await sendDiscordWebhook(
              authorWebhookUrl,
              buildApplicationNotificationWebhookPayload(application, post),
            );
            if (!webhookResult.ok) {
              logger.warn("feed_author_application_webhook_failed", {
                postId: post.id,
                authorUserId: post.author.id,
                status: webhookResult.status,
                error: webhookResult.error,
              });
            }
          }
          return res.status(201).json(application);
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.createApplicationFailed"),
          });
        }
      },
    );

    app.get(
      "/api/feed/applications/sent",
      authenticateBearerToken,
      requireNoActiveBan,
      async (req: Request, res: Response) => {
        const applications = await listSentFeedApplications(req.authUser!.sub);
        return res.status(200).json({ applications });
      },
    );

    app.get(
      "/api/feed/applications/received",
      authenticateBearerToken,
      requireNoActiveBan,
      async (req: Request, res: Response) => {
        const viewer = await ensureFeedViewerContext(req.authUser!.sub);
        const applications = await listReceivedFeedApplications(viewer);
        return res.status(200).json({ applications });
      },
    );

    app.patch(
      "/api/feed/applications/:applicationId",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      async (req: Request, res: Response) => {
        try {
          const viewer = await ensureFeedViewerContext(req.authUser!.sub);
          const applicationId = req.params.applicationId ?? "";
          const application = await updateFeedApplication(viewer, applicationId, req.body);
          return res.status(200).json(application);
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.updateApplicationFailed"),
          });
        }
      },
    );

    app.post(
      "/api/feed/reports",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireVerifiedEmail,
      async (req: Request, res: Response) => {
        try {
          const body = asObject(req.body);
          const postId = typeof body?.postId === "string" ? body.postId.trim() : "";
          if (!postId) {
            return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.postIdRequired") });
          }
          const report = await createFeedReport(req.authUser!.sub, postId, body);
          if (env.feedModerationDiscordWebhookUrl) {
            const webhookResult = await sendDiscordWebhook(
              env.feedModerationDiscordWebhookUrl,
              buildReportModerationWebhookPayload(report),
            );
            if (!webhookResult.ok) {
              logger.warn("feed_moderation_webhook_failed", {
                reportId: report.id,
                status: webhookResult.status,
                error: webhookResult.error,
              });
            }
          }
          return res.status(201).json(report);
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.createReportFailed"),
          });
        }
      },
    );

    app.get(
      "/api/feed/mod/reports",
      authenticateBearerToken,
      requireNoActiveBan,
      requireModerationAccess,
      async (_req: Request, res: Response) => {
        const reports = await listFeedReports();
        return res.status(200).json({ reports });
      },
    );

    app.patch(
      "/api/feed/mod/reports",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireModerationAccess,
      async (req: Request, res: Response) => {
        try {
          const body = asObject(req.body);
          const reportId = typeof body?.id === "string" ? body.id.trim() : "";
          if (!reportId) {
            return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.reportIdRequired") });
          }
          const report = await updateFeedReport(req.authUser!.sub, reportId, body);
          return res.status(200).json(report);
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.updateReportFailed"),
          });
        }
      },
    );

    app.get(
      "/api/feed/mod/posts",
      authenticateBearerToken,
      requireNoActiveBan,
      requireModerationAccess,
      async (req: Request, res: Response) => {
        const viewer = await ensureFeedViewerContext(req.authUser!.sub);
        const typeRaw = typeof req.query.type === "string" ? req.query.type.trim() : "all";
        const type = typeRaw === "recruitment" || typeRaw === "showcase" ? typeRaw : "all";
        const posts = await listFeedPosts({ viewer, type, mine: false });
        return res.status(200).json({ posts });
      },
    );

    app.patch(
      "/api/feed/mod/posts",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireModerationAccess,
      async (req: Request, res: Response) => {
        try {
          const viewer = await ensureFeedViewerContext(req.authUser!.sub);
          const post = await updateFeedPost(viewer, req.body, {
            autoFlagScoreThreshold: env.feedAutoFlagScoreThreshold,
          });
          return res.status(200).json(post);
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.updateModerationFailed"),
          });
        }
      },
    );

    app.get(
      "/api/feed/mod/bans",
      authenticateBearerToken,
      requireNoActiveBan,
      requireBanManagementAccess,
      async (_req: Request, res: Response) => {
        const bans = (await listModerationBans()).map((ban) => ({
          banId: ban.banId,
          activeBan: ban.presentation,
          matchedTargets: ban.matchedTargets,
        }));
        return res.status(200).json({ bans });
      },
    );

    app.post(
      "/api/feed/mod/bans",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireBanManagementAccess,
      async (req: Request, res: Response) => {
        try {
          const body = asObject(req.body);
          const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";
          const scopeRaw = typeof body?.scope === "string" ? body.scope.trim() : "account_only";
          const scope =
            scopeRaw === "account_hwid" || scopeRaw === "account_hwid_mac_ip" ? scopeRaw : "account_only";
          const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
          const expiresAt =
            typeof body?.expiresAt === "string" && body.expiresAt.trim()
              ? new Date(body.expiresAt)
              : null;
          if (!targetUserId || !reason) {
            return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.banTargetRequired") });
          }
          const evidence = Array.isArray(body?.evidence)
            ? (body?.evidence as FeedReportEvidence[])
            : [
                {
                  source: "moderator" as const,
                  note: reason,
                  createdAt: new Date().toISOString(),
                },
              ];
          const activeBan = await createBanForUser({
            targetUserId,
            actorUserId: req.authUser!.sub,
            scope,
            reason,
            evidence,
            expiresAt: expiresAt && Number.isFinite(expiresAt.getTime()) ? expiresAt : null,
          });
          await deleteAuthSessionsForUser(targetUserId);
          purgeDesktopClientSessionsForUser(targetUserId);
          return res.status(201).json({
            banId: activeBan.banId,
            activeBan: activeBan.presentation,
            matchedTargets: activeBan.matchedTargets,
          });
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.createBanFailed"),
          });
        }
      },
    );

    app.patch(
      "/api/feed/mod/bans",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireBanManagementAccess,
      async (req: Request, res: Response) => {
        try {
          const body = asObject(req.body);
          const banId = typeof body?.banId === "string" ? body.banId.trim() : "";
          if (!banId) {
            return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.banIdRequired") });
          }
          const lift = body?.lift === true;
          const expiresAt =
            typeof body?.expiresAt === "string" && body.expiresAt.trim()
              ? new Date(body.expiresAt)
              : undefined;
          const reason = typeof body?.reason === "string" ? body.reason.trim() : undefined;
          await updateBanState({
            banId,
            liftedAt: lift ? new Date() : undefined,
            expiresAt: expiresAt && Number.isFinite(expiresAt.getTime()) ? expiresAt : undefined,
            reason,
          });
          return res.status(200).json({ success: true, banId });
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.updateBanFailed"),
          });
        }
      },
    );

}
