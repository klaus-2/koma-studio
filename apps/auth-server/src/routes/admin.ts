import type express from "express";
import type { Request, Response } from "express";

import { authenticateBearerToken } from "../auth/middleware.js";
import { env } from "../config/env.js";
import {
  buildAdminPermissions,
  getAdminOverview,
  getAdminUserDetail,
  listAdminFeedApplications,
  listAdminFeedProfiles,
  listAdminUsers,
  updateAdminUser,
} from "../services/admin-panel.js";
import {
  createBanForUser,
  deleteAuthSessionsForUser,
  listModerationBans,
  updateBanState,
} from "../services/ban-enforcement.js";
import {
  createGuideCategory,
  createGuideEntry,
  createResourceCategory,
  createResourceEntry,
  deleteGuideCategory,
  deleteGuideEntry,
  deleteResourceCategory,
  deleteResourceEntry,
  getAdminGuideCatalog,
  getAdminResourceCatalog,
  updateGuideCategory,
  updateGuideEntry,
  updateResourceCategory,
  updateResourceEntry,
} from "../services/content-catalog.js";
import {
  createFeedApplication,
  getFeedPostDetail,
  listFeedPosts,
  listFeedReports,
  updateFeedPost,
  updateFeedReport,
} from "../services/feed.js";
import { resolveLocaleFromHeaders, tServer } from "../services/server-i18n.js";
import { logger } from "../utils/logger.js";
import type { FeedReportEvidence } from "../db/schema.js";

import {
  asObject,
  buildAuthenticatedUserResponse,
  ensureFeedViewerContext,
  getUserById,
  jsonParser,
  purgeDesktopClientSessionsForUser,
  requireAdminPanelAccess,
  requireBanManagementAccess,
  requireManageContentAccess,
  requireManageUsersAccess,
  requireModerationAccess,
  requireNoActiveBan,
  urlEncodedParser,
} from "./_shared.js";

export function registerAdminRoutes(app: express.Express): void {
    app.get(
      "/api/admin/bootstrap",
      authenticateBearerToken,
      requireNoActiveBan,
      requireAdminPanelAccess,
      async (req: Request, res: Response) => {
        const viewer = await ensureFeedViewerContext(req.authUser!.sub);
        const [overview, authenticatedUser] = await Promise.all([
          getAdminOverview(),
          getUserById(req.authUser!.sub),
        ]);

        if (!authenticatedUser) {
          return res.status(404).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.userNotFound") });
        }

        return res.status(200).json({
          user: await buildAuthenticatedUserResponse(authenticatedUser),
          permissions: buildAdminPermissions(viewer.appRole),
          overview,
        });
      },
    );

    app.get(
      "/api/admin/users",
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageUsersAccess,
      async (req: Request, res: Response) => {
        const payload = await listAdminUsers({
          query: typeof req.query.q === "string" ? req.query.q : undefined,
          role: typeof req.query.role === "string" ? req.query.role : undefined,
          emailVerified: typeof req.query.emailVerified === "string" ? req.query.emailVerified : undefined,
          page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
          pageSize: typeof req.query.pageSize === "string" ? Number(req.query.pageSize) : undefined,
        });
        return res.status(200).json(payload);
      },
    );

    app.get(
      "/api/admin/users/:userId",
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageUsersAccess,
      async (req: Request, res: Response) => {
        try {
          const userId = typeof req.params.userId === "string" ? req.params.userId : "";
          const payload = await getAdminUserDetail(userId, resolveLocaleFromHeaders(req.headers));
          return res.status(200).json(payload);
        } catch (error) {
          return res.status(404).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.userNotFound"),
          });
        }
      },
    );

    app.patch(
      "/api/admin/users/:userId",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageUsersAccess,
      async (req: Request, res: Response) => {
        try {
          const actor = await ensureFeedViewerContext(req.authUser!.sub);
          const userId = typeof req.params.userId === "string" ? req.params.userId : "";
          const payload = await updateAdminUser(
            userId,
            actor.appRole,
            req.body,
            resolveLocaleFromHeaders(req.headers),
          );
          return res.status(200).json(payload);
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "auth.admin.userUpdateFailed"),
          });
        }
      },
    );

    app.get(
      "/api/admin/feed/profiles",
      authenticateBearerToken,
      requireNoActiveBan,
      requireAdminPanelAccess,
      async (_req: Request, res: Response) => {
        const profiles = await listAdminFeedProfiles();
        return res.status(200).json({ profiles });
      },
    );

    app.get(
      "/api/admin/feed/applications",
      authenticateBearerToken,
      requireNoActiveBan,
      requireAdminPanelAccess,
      async (_req: Request, res: Response) => {
        const applications = await listAdminFeedApplications();
        return res.status(200).json({ applications });
      },
    );

    app.get(
      "/api/admin/feed/posts",
      authenticateBearerToken,
      requireNoActiveBan,
      requireAdminPanelAccess,
      async (req: Request, res: Response) => {
        const viewer = await ensureFeedViewerContext(req.authUser!.sub);
        const typeRaw = typeof req.query.type === "string" ? req.query.type.trim() : "all";
        const type = typeRaw === "recruitment" || typeRaw === "showcase" ? typeRaw : "all";
        const posts = await listFeedPosts({ viewer, type, mine: false });
        return res.status(200).json({ posts });
      },
    );

    app.patch(
      "/api/admin/feed/posts/:postId",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireModerationAccess,
      async (req: Request, res: Response) => {
        try {
          const viewer = await ensureFeedViewerContext(req.authUser!.sub);
          const post = await updateFeedPost(
            viewer,
            {
              ...asObject(req.body),
              id: typeof req.params.postId === "string" ? req.params.postId : "",
            },
            {
              autoFlagScoreThreshold: env.feedAutoFlagScoreThreshold,
            },
          );
          return res.status(200).json(post);
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.updatePostFailed"),
          });
        }
      },
    );

    app.get(
      "/api/admin/moderation/reports",
      authenticateBearerToken,
      requireNoActiveBan,
      requireModerationAccess,
      async (_req: Request, res: Response) => {
        const reports = await listFeedReports();
        return res.status(200).json({ reports });
      },
    );

    app.patch(
      "/api/admin/moderation/reports/:reportId",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireModerationAccess,
      async (req: Request, res: Response) => {
        try {
          const reportId = typeof req.params.reportId === "string" ? req.params.reportId : "";
          const report = await updateFeedReport(req.authUser!.sub, reportId, req.body);
          return res.status(200).json(report);
        } catch (error) {
          return res.status(400).json({
            error: tServer(resolveLocaleFromHeaders(req.headers), "feed.error.updateReportFailed"),
          });
        }
      },
    );

    app.get(
      "/api/admin/bans",
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
      "/api/admin/bans",
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
      "/api/admin/bans/:banId",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireBanManagementAccess,
      async (req: Request, res: Response) => {
        try {
          const body = asObject(req.body);
          const banId = typeof req.params.banId === "string" ? req.params.banId : "";
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

    app.get(
      "/api/admin/guides",
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (_req: Request, res: Response) => {
        const catalog = await getAdminGuideCatalog();
        return res.status(200).json(catalog);
      },
    );

    app.post(
      "/api/admin/guides/categories",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (req: Request, res: Response) => {
        try {
          const category = await createGuideCategory(req.body);
          return res.status(201).json(category);
        } catch (error) {
          return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "contentCatalog.error.failedToCreateGuideCategory") });
        }
      },
    );

    app.patch(
      "/api/admin/guides/categories/:categoryId",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (req: Request, res: Response) => {
        try {
          const categoryId = typeof req.params.categoryId === "string" ? req.params.categoryId : "";
          const category = await updateGuideCategory(categoryId, req.body);
          return res.status(200).json(category);
        } catch (error) {
          return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "contentCatalog.error.failedToUpdateGuideCategory") });
        }
      },
    );

    app.delete(
      "/api/admin/guides/categories/:categoryId",
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (req: Request, res: Response) => {
        const categoryId = typeof req.params.categoryId === "string" ? req.params.categoryId : "";
        await deleteGuideCategory(categoryId);
        return res.status(204).send();
      },
    );

    app.post(
      "/api/admin/guides/entries",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (req: Request, res: Response) => {
        try {
          const entry = await createGuideEntry(req.body);
          return res.status(201).json(entry);
        } catch (error) {
          return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "contentCatalog.error.failedToCreateGuide") });
        }
      },
    );

    app.patch(
      "/api/admin/guides/entries/:entryId",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (req: Request, res: Response) => {
        try {
          const entryId = typeof req.params.entryId === "string" ? req.params.entryId : "";
          const entry = await updateGuideEntry(entryId, req.body);
          return res.status(200).json(entry);
        } catch (error) {
          return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "contentCatalog.error.failedToUpdateGuide") });
        }
      },
    );

    app.delete(
      "/api/admin/guides/entries/:entryId",
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (req: Request, res: Response) => {
        const entryId = typeof req.params.entryId === "string" ? req.params.entryId : "";
        await deleteGuideEntry(entryId);
        return res.status(204).send();
      },
    );

    app.get(
      "/api/admin/resources",
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (_req: Request, res: Response) => {
        const catalog = await getAdminResourceCatalog();
        return res.status(200).json(catalog);
      },
    );

    app.post(
      "/api/admin/resources/categories",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (req: Request, res: Response) => {
        try {
          const category = await createResourceCategory(req.body);
          return res.status(201).json(category);
        } catch (error) {
          return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "contentCatalog.error.failedToCreateResourceCategory") });
        }
      },
    );

    app.patch(
      "/api/admin/resources/categories/:categoryId",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (req: Request, res: Response) => {
        try {
          const categoryId = typeof req.params.categoryId === "string" ? req.params.categoryId : "";
          const category = await updateResourceCategory(categoryId, req.body);
          return res.status(200).json(category);
        } catch (error) {
          return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "contentCatalog.error.failedToUpdateResourceCategory") });
        }
      },
    );

    app.delete(
      "/api/admin/resources/categories/:categoryId",
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (req: Request, res: Response) => {
        const categoryId = typeof req.params.categoryId === "string" ? req.params.categoryId : "";
        await deleteResourceCategory(categoryId);
        return res.status(204).send();
      },
    );

    app.post(
      "/api/admin/resources/entries",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (req: Request, res: Response) => {
        try {
          const entry = await createResourceEntry(req.body);
          return res.status(201).json(entry);
        } catch (error) {
          return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "contentCatalog.error.failedToCreateResource") });
        }
      },
    );

    app.patch(
      "/api/admin/resources/entries/:entryId",
      jsonParser,
      urlEncodedParser,
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (req: Request, res: Response) => {
        try {
          const entryId = typeof req.params.entryId === "string" ? req.params.entryId : "";
          const entry = await updateResourceEntry(entryId, req.body);
          return res.status(200).json(entry);
        } catch (error) {
          return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "contentCatalog.error.failedToUpdateResource") });
        }
      },
    );

    app.delete(
      "/api/admin/resources/entries/:entryId",
      authenticateBearerToken,
      requireNoActiveBan,
      requireManageContentAccess,
      async (req: Request, res: Response) => {
        const entryId = typeof req.params.entryId === "string" ? req.params.entryId : "";
        await deleteResourceEntry(entryId);
        return res.status(204).send();
      },
    );

}
