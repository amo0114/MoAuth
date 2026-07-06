import { AUDIT_ERROR_CODES } from "@moauth/audit-store";

import { getAuditStore } from "./store.js";

const ACTIVITY_LIMIT = 20;

export function recordAuditEvent(payload) {
  return getAuditStore().appendEvent(payload);
}

export function listAuditEventsForSub(sub, options = {}) {
  return getAuditStore().listBySub(sub, {
    limit: options.limit ?? ACTIVITY_LIMIT,
  });
}

export function toActivityListResponse(events) {
  return Object.freeze({
    status: "ACTIVITY_LIST",
    events: events.map((event) =>
      Object.freeze({
        id: event.id,
        eventType: event.eventType,
        summary: event.summary,
        createdAt: event.createdAt,
        metadata: event.metadata,
      })
    ),
  });
}

export function auditErrorStatus(code) {
  if (code === AUDIT_ERROR_CODES.AUDIT_INVALID_PAYLOAD) return 400;
  if (code === AUDIT_ERROR_CODES.AUDIT_UNAUTHORIZED) return 401;
  return 500;
}