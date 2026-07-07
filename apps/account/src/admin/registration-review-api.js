import { reactivateHumanUser, deleteHumanUser } from "@moauth/zitadel-client";

import { recordAuditEvent } from "../audit/service.js";
import { getRegistrationReviewStore } from "../registration-review/store.js";

export function listRegistrationReviews(filters = {}) {
  const store = getRegistrationReviewStore();
  const allowedFilters = {};
  if (filters.reviewStatus) allowedFilters.reviewStatus = filters.reviewStatus;
  return store.list(allowedFilters);
}

export async function approveRegistrationReview(id, actor, options = {}) {
  const store = getRegistrationReviewStore();
  const record = store.getById(id);
  if (!record) return null;

  const allowedStatuses = new Set(["pending", "approving", "approve_failed"]);
  if (!allowedStatuses.has(record.reviewStatus)) {
    throw Object.assign(new Error("只能批准待审核、批准中或批准失败的记录"), { code: "REVIEW_INVALID_STATUS", status: 400 });
  }

  // Step 1: 标记 approving（中间态）
  store.update(id, {
    reviewStatus: "approving",
    reviewedBySubjectId: actor.sub,
    reviewedAt: new Date(),
  });

  // Step 2: 激活。approving 重试仍然调用 Zitadel，避免崩溃发生在中间态写入后、外部操作前。
  try {
    await reactivateHumanUser(record.userId, options);
  } catch (error) {
    store.update(id, { reviewStatus: "approve_failed", reviewNote: error.message });
    recordAuditEvent({
      eventType: "registration_approve_failed",
      sub: actor.sub,
      summary: `审核批准失败: ${record.email}`,
      metadata: { reviewId: id, userId: record.userId, error: error.message },
    });
    throw Object.assign(new Error(`激活用户失败: ${error.message}`), { code: "REVIEW_APPROVE_FAILED", status: 502 });
  }

  // Step 3: 标记 approved（终态）
  store.update(id, { reviewStatus: "approved" });
  recordAuditEvent({
    eventType: "registration_approved",
    sub: actor.sub,
    summary: `审核通过: ${record.email}`,
    metadata: { reviewId: id, userId: record.userId },
  });

  return store.getById(id);
}

export async function rejectRegistrationReview(id, actor, reviewNote, options = {}) {
  const store = getRegistrationReviewStore();
  const record = store.getById(id);
  if (!record) return null;

  const allowedStatuses = new Set(["pending", "rejecting", "reject_failed"]);
  if (!allowedStatuses.has(record.reviewStatus)) {
    throw Object.assign(new Error("只能拒绝待审核、拒绝中或拒绝失败的记录"), { code: "REVIEW_INVALID_STATUS", status: 400 });
  }

  // Step 1: 标记 rejecting（中间态）
  store.update(id, {
    reviewStatus: "rejecting",
    reviewedBySubjectId: actor.sub,
    reviewedAt: new Date(),
    reviewNote: reviewNote || null,
  });

  // Step 2: 删除 Zitadel 用户。rejecting 重试仍然调用 delete；404 视为已删除。
  try {
    await deleteHumanUser(record.userId, options);
  } catch (error) {
    if (error?.status !== 404 && error?.code !== "ZITADEL_AUTH_REQUEST_NOT_FOUND") {
      store.update(id, { reviewStatus: "reject_failed", reviewNote: error.message });
      recordAuditEvent({
        eventType: "registration_reject_failed",
        sub: actor.sub,
        summary: `审核拒绝失败: ${record.email}`,
        metadata: { reviewId: id, userId: record.userId, error: error.message },
      });
      throw Object.assign(new Error(`删除用户失败: ${error.message}`), { code: "REVIEW_REJECT_FAILED", status: 502 });
    }
  }

  // Step 3: 标记 rejected（终态）
  store.update(id, { reviewStatus: "rejected" });
  recordAuditEvent({
    eventType: "registration_rejected",
    sub: actor.sub,
    summary: `审核拒绝: ${record.email}`,
    metadata: { reviewId: id, userId: record.userId },
  });

  return store.getById(id);
}

export function mapReviewError(error) {
  if (error?.code === "REVIEW_INVALID_STATUS") return { status: 400, body: { error: error.message } };
  if (error?.code === "REVIEW_APPROVE_FAILED" || error?.code === "REVIEW_REJECT_FAILED") {
    return { status: (error?.status || 502), body: { error: error.message } };
  }
  return { status: 500, body: { error: error?.message || "Failed to process review request." } };
}
