import { AUDIT_EVENT_TYPES } from "@moauth/audit-store";
import { deleteHumanUser, reactivateHumanUser } from "@moauth/zitadel-client";

import { recordAuditEvent } from "../audit/service.js";
import { getRegistrationReviewStore } from "./store.js";

const STUCK_STATUSES = ["approving", "rejecting"];
const DEFAULT_RECONCILE_INTERVAL_MS = 60_000;
const SYSTEM_RECONCILER_SUB = "system:registration-review-reconcile";

export async function reconcileRegistrationReviews(options = {}) {
  const store = options.store || getRegistrationReviewStore();
  const actorSub = options.actorSub || SYSTEM_RECONCILER_SUB;
  const records = store.list({ reviewStatus: STUCK_STATUSES });
  const reconciled = [];
  const failed = [];

  for (const snapshot of records) {
    const record = store.getById(snapshot.id);
    if (!record || !STUCK_STATUSES.includes(record.reviewStatus)) {
      continue;
    }

    try {
      if (record.reviewStatus === "approving") {
        await reconcileApprovingRecord(store, record, actorSub, options);
        reconciled.push({ id: record.id, userId: record.userId, from: "approving", to: "approved" });
      } else if (record.reviewStatus === "rejecting") {
        await reconcileRejectingRecord(store, record, actorSub, options);
        reconciled.push({ id: record.id, userId: record.userId, from: "rejecting", to: "rejected" });
      }
    } catch (error) {
      failed.push({
        id: record.id,
        userId: record.userId,
        from: record.reviewStatus,
        error: error.message,
      });
    }
  }

  return Object.freeze({
    status: "REGISTRATION_REVIEWS_RECONCILED",
    reconciled: reconciled.map(Object.freeze),
    failed: failed.map(Object.freeze),
  });
}

export function startRegistrationReviewReconcileLoop(options = {}) {
  const intervalMs = options.intervalMs || DEFAULT_RECONCILE_INTERVAL_MS;
  let running = false;

  async function run() {
    if (running) return;
    running = true;
    try {
      await reconcileRegistrationReviews(options);
    } catch (error) {
      console.error("[RegistrationReview] reconcile failed", error);
    } finally {
      running = false;
    }
  }

  void run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();

  return Object.freeze({
    run,
    stop() {
      clearInterval(timer);
    },
  });
}

async function reconcileApprovingRecord(store, record, actorSub, options) {
  try {
    await reactivateHumanUser(record.userId, options);
  } catch (error) {
    store.update(record.id, { reviewStatus: "approve_failed", reviewNote: error.message });
    recordAuditEvent({
      eventType: AUDIT_EVENT_TYPES.REGISTRATION_APPROVE_FAILED,
      sub: actorSub,
      summary: `审核批准恢复失败: ${record.email}`,
      metadata: { reviewId: record.id, userId: record.userId, error: error.message },
    });
    throw error;
  }

  store.update(record.id, { reviewStatus: "approved" });
  recordReconciledAuditEvent(actorSub, record, "approving", "approved");
}

async function reconcileRejectingRecord(store, record, actorSub, options) {
  try {
    await deleteHumanUser(record.userId, options);
  } catch (error) {
    if (!isZitadelNotFound(error)) {
      store.update(record.id, { reviewStatus: "reject_failed", reviewNote: error.message });
      recordAuditEvent({
        eventType: AUDIT_EVENT_TYPES.REGISTRATION_REJECT_FAILED,
        sub: actorSub,
        summary: `审核拒绝恢复失败: ${record.email}`,
        metadata: { reviewId: record.id, userId: record.userId, error: error.message },
      });
      throw error;
    }
  }

  store.update(record.id, { reviewStatus: "rejected" });
  recordReconciledAuditEvent(actorSub, record, "rejecting", "rejected");
}

function recordReconciledAuditEvent(actorSub, record, fromStatus, toStatus) {
  recordAuditEvent({
    eventType: AUDIT_EVENT_TYPES.REGISTRATION_REVIEW_RECONCILED,
    sub: actorSub,
    summary: `恢复注册审核中间态: ${record.email}`,
    metadata: {
      reviewId: record.id,
      userId: record.userId,
      fromStatus,
      toStatus,
    },
  });
}

function isZitadelNotFound(error) {
  return error?.status === 404 ||
    error?.details?.status === 404 ||
    error?.code === "ZITADEL_AUTH_REQUEST_NOT_FOUND";
}
