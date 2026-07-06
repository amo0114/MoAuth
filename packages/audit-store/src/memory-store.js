import { randomUUID } from "node:crypto";

import { AUDIT_ERROR_CODES, AuditError } from "./errors.js";
import { AUDIT_EVENT_TYPES } from "./event-types.js";

const DEFAULT_LIMIT = 20;

function freezeEvent(record) {
  return Object.freeze({
    id: record.id,
    sub: record.sub,
    eventType: record.eventType,
    summary: record.summary,
    metadata: record.metadata ? Object.freeze({ ...record.metadata }) : null,
    createdAt: record.createdAt.toISOString(),
  });
}

function assertAppendPayload(payload) {
  for (const field of ["sub", "eventType", "summary"]) {
    if (payload?.[field] === undefined || payload?.[field] === null || payload?.[field] === "") {
      throw new AuditError(
        AUDIT_ERROR_CODES.AUDIT_INVALID_PAYLOAD,
        `Audit event is missing required field: ${field}.`,
        { field }
      );
    }
  }

  if (!Object.values(AUDIT_EVENT_TYPES).includes(payload.eventType)) {
    throw new AuditError(
      AUDIT_ERROR_CODES.AUDIT_INVALID_PAYLOAD,
      `Unsupported audit event type: ${payload.eventType}.`,
      { eventType: payload.eventType }
    );
  }
}

export function createMemoryAuditStore(options = {}) {
  const nowFn = options.now ?? (() => new Date());
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const events = [];
  let sequence = 0;

  function appendEvent(payload) {
    assertAppendPayload(payload);
    const record = {
      id: randomUUID(),
      sub: String(payload.sub),
      eventType: payload.eventType,
      summary: String(payload.summary),
      metadata:
        payload.metadata && typeof payload.metadata === "object"
          ? { ...payload.metadata }
          : null,
      createdAt: nowFn(),
      sequence: sequence++,
    };
    events.push(record);
    return freezeEvent(record);
  }

  function listBySub(sub, { limit = defaultLimit } = {}) {
    if (!sub) {
      return [];
    }

    const normalizedLimit = Math.max(1, Number(limit) || defaultLimit);
    return events
      .filter((record) => record.sub === sub)
      .sort((left, right) => {
        const timeDelta = right.createdAt.getTime() - left.createdAt.getTime();
        return timeDelta !== 0 ? timeDelta : right.sequence - left.sequence;
      })
      .slice(0, normalizedLimit)
      .map((record) => freezeEvent(record));
  }

  return {
    appendEvent,
    listBySub,
    _resetForTests() {
      events.length = 0;
      sequence = 0;
    },
  };
}