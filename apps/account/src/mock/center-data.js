export function getSecuritySummary() {
  return Object.freeze({
    status: "SECURITY_SUMMARY",
    password: { set: true },
    mfa: { enabled: false, methods: [] },
    passkeys: { count: 0, items: [] },
  });
}

export function getSessionList(session) {
  return Object.freeze({
    status: "SESSION_LIST",
    sessions: [
      Object.freeze({
        id: session.id,
        kind: "account",
        label: "当前浏览器",
        current: true,
        createdAt: session.createdAt,
        lastSeenAt: session.createdAt,
        expiresAt: session.expiresAt,
      }),
    ],
  });
}

export function getApplicationList() {
  return Object.freeze({
    status: "APPLICATION_LIST",
    applications: [
      Object.freeze({
        clientId: "subboost-dev",
        displayName: "SubBoost",
        scopes: ["openid", "profile", "email"],
        grantedAt: null,
        status: "authorized",
        source: "projection_pending",
      }),
    ],
  });
}

export function getActivityList(session) {
  return Object.freeze({
    status: "ACTIVITY_LIST",
    events: [
      Object.freeze({
        id: `evt-login-${session.id}`,
        eventType: "login_success",
        summary: "账号中心登录成功",
        createdAt: session.createdAt,
      }),
    ],
  });
}