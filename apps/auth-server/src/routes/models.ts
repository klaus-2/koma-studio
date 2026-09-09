import type express from "express";
import type { Request, Response } from "express";

import { authenticateBearerToken } from "../auth/middleware.js";
import { modelReviewMutationLimiter } from "../security/rate-limiter.js";
import {
  deleteModelReview,
  getModelReviewDetail,
  listModelReviewLeaderboard,
  parseModelReviewInput,
  upsertModelReview,
  type ModelReviewQueryFilters,
} from "../services/model-reviews.js";
import { resolveLocaleFromHeaders, tServer } from "../services/server-i18n.js";
import { logger } from "../utils/logger.js";

import {
  jsonParser,
  parseModelReviewRankingMetric,
  parseModelReviewStage,
  parseModelReviewSource,
  parsePositiveInteger,
  parseTrimmedQuery,
  requireNoActiveBan,
  requireVerifiedEmail,
  urlEncodedParser,
} from "./_shared.js";

export function registerModelReviewsRoutes(app: express.Express): void {
    app.get("/api/model-reviews/leaderboard", authenticateBearerToken, requireNoActiveBan, async (req: Request, res: Response) => {
      try {
        const filters: ModelReviewQueryFilters = {
          ranking: parseModelReviewRankingMetric(req.query.ranking),
          stage: parseModelReviewStage(req.query.stage),
          source: parseModelReviewSource(req.query.source),
          language: parseTrimmedQuery(req.query.language, "all").slice(0, 24),
          search: parseTrimmedQuery(req.query.search).slice(0, 120),
          minReviews: Math.min(parsePositiveInteger(req.query.minReviews, 2), 100),
          limit: Math.min(parsePositiveInteger(req.query.limit, 25), 100),
        };

        const payload = await listModelReviewLeaderboard(filters, req.authUser?.sub ?? null);
        return res.status(200).json(payload);
      } catch (error) {
        logger.error("model_reviews_ranking_failed", {
          userId: req.authUser?.sub,
          message: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.rankingLoadFailed") });
      }
    });

    app.get("/api/model-reviews/models/:modelId", authenticateBearerToken, requireNoActiveBan, async (req: Request, res: Response) => {
      try {
        const modelId = parseTrimmedQuery(req.params.modelId);
        if (!modelId) {
          return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.invalidModel") });
        }

        const page = Math.min(parsePositiveInteger(req.query.page, 1), 100);
        const pageSize = Math.min(parsePositiveInteger(req.query.pageSize, 10), 20);
        const payload = await getModelReviewDetail(modelId, req.authUser?.sub ?? null, page, pageSize);
        return res.status(200).json(payload);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.modelDetailsLoadFailed");
        const invalidModelMessage = tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.invalidModel");
        const statusCode = message === invalidModelMessage ? 404 : 500;

        if (statusCode === 500) {
          logger.error("Model review detail failed", {
            userId: req.authUser?.sub,
            modelId: req.params.modelId,
            message,
          });
        }

        return res.status(statusCode).json({
          error: statusCode === 404 ? invalidModelMessage : tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.modelDetailsLoadFailed"),
        });
      }
    });

    app.put(
      "/api/model-reviews/models/:modelId/my-review",
      jsonParser,
      urlEncodedParser,
      modelReviewMutationLimiter,
      authenticateBearerToken,
      requireNoActiveBan,
      requireVerifiedEmail,
      async (req: Request, res: Response) => {
        try {
          const modelId = parseTrimmedQuery(req.params.modelId);
          if (!modelId) {
            return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.invalidModel") });
          }

          const input = parseModelReviewInput(req.body);
          const payload = await upsertModelReview(req.authUser!.sub, modelId, input);
          return res.status(200).json(payload);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.reviewSaveFailed");
          const invalidModelMessage = tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.invalidModel");
          const invalidPayloadMessage = tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.invalidPayload");
          const invalidFieldPrefix = tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.invalidField", {
            fieldName: "",
          }).replace(/\s*$/, "");
          const statusCode =
            message === invalidModelMessage
              ? 404
              : message.startsWith(invalidFieldPrefix) || message === invalidPayloadMessage
              ? 400
              : 500;

          if (statusCode === 500) {
            logger.error("Model review upsert failed", {
              userId: req.authUser?.sub,
              modelId: req.params.modelId,
              message,
            });
          }

          return res.status(statusCode).json({
            error:
              statusCode === 404
                ? invalidModelMessage
                : statusCode === 400
                  ? message
                  : tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.reviewSaveFailed"),
          });
        }
      },
    );

    app.delete(
      "/api/model-reviews/models/:modelId/my-review",
      modelReviewMutationLimiter,
      authenticateBearerToken,
      requireNoActiveBan,
      requireVerifiedEmail,
      async (req: Request, res: Response) => {
        try {
          const modelId = parseTrimmedQuery(req.params.modelId);
          if (!modelId) {
            return res.status(400).json({ error: tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.invalidModel") });
          }

          const payload = await deleteModelReview(req.authUser!.sub, modelId);
          return res.status(200).json(payload);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.reviewRemoveFailed");
          const invalidModelMessage = tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.invalidModel");
          const statusCode = message === invalidModelMessage ? 404 : 500;

          if (statusCode === 500) {
            logger.error("Model review delete failed", {
              userId: req.authUser?.sub,
              modelId: req.params.modelId,
              message,
            });
          }

          return res.status(statusCode).json({
            error: statusCode === 404 ? invalidModelMessage : tServer(resolveLocaleFromHeaders(req.headers), "modelReviews.error.reviewRemoveFailed"),
          });
        }
      },
    );

}
