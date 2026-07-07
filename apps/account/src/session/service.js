import { getAccountSessionStore } from "./account-session-store.js";

export function toSessionListResponse(session, options = {}) {
  const storeSessions = getAccountSessionStore().listBySub(session.sub, { now: options.now });
  const sessions = ensureCurrentSession(storeSessions, session);

  return Object.freeze({
    status: "SESSION_LIST",
    capabilities: Object.freeze({
      source: "server_session_store",
      currentSessionRevocation: true,
      remoteSessionListing: true,
      remoteSessionRevocation: true,
    }),
    sessions: sessions.map((record) => toPublicSessionRecord(record, record.id === session.id)),
  });
}

export function revokeAccountSessionById(session, sessionId) {
  const normalizedSessionId = String(sessionId || "").trim();
  if (!normalizedSessionId) {
    throw sessionServiceError("SESSION_ID_REQUIRED", "Session id is required.", 400);
  }

  const targetSessionId = normalizedSessionId === "current" ? session.id : normalizedSessionId;
  const revoked = getAccountSessionStore().revokeForSub({
    sub: session.sub,
    sessionId: targetSessionId,
  });

  if (!revoked) {
    throw sessionServiceError(
      "SESSION_NOT_FOUND",
      "Account session was not found.",
      404
    );
  }

  return Object.freeze({
    status: "SESSION_REVOKED",
    sessionId: targetSessionId,
    current: targetSessionId === session.id,
  });
}

function ensureCurrentSession(sessions, currentSession) {
  if (sessions.some((record) => record.id === currentSession.id)) {
    return sessions;
  }
  return [currentSession, ...sessions];
}

function toPublicSessionRecord(session, current) {
  return Object.freeze({
    id: session.id,
    kind: session.deviceLabel || "Account 会话",
    label: current ? "当前浏览器" : session.deviceLabel || "浏览器会话",
    current,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt || session.createdAt,
    expiresAt: session.expiresAt,
    source: "server_session_store",
    revocable: true,
    userAgent: session.userAgent || undefined,
  });
}

function sessionServiceError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}
