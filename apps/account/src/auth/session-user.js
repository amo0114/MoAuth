import { getHumanUser, hydratePasswordSession, isZitadelConfigured } from "@moauth/zitadel-client";

import { isAccountAdminSubject } from "../config/env.js";

export function extractUserFromZitadelSession(session, fallbackLoginName = "") {
  const userFactor = session.factors?.user || session.payload?.user || {};
  const loginName = userFactor.loginName || fallbackLoginName;
  const email = userFactor.email ?? null;

  return {
    sub: userFactor.id || loginName,
    loginName,
    email,
    emailVerified: email ? userFactor.emailVerified === true : false,
  };
}

export async function enrichUserFromZitadelProfile(session, options = {}) {
  const hydratedSession = await hydratePasswordSession(session, options);
  const userFactor = hydratedSession.factors?.user || hydratedSession.payload?.user || {};
  const userId = userFactor.id || hydratedSession.payload?.userId || null;
  const base = extractUserFromZitadelSession(hydratedSession);

  if (!userId || !isZitadelConfigured()) {
    return withAdminFlag(base);
  }

  if (base.email && base.loginName) {
    return withAdminFlag(base);
  }

  const profile = await getHumanUser(userId, options);
  return withAdminFlag({
    sub: profile.id || base.sub,
    loginName: profile.loginName || base.loginName,
    email: profile.email ?? base.email,
    emailVerified: profile.email ? profile.emailVerified : base.emailVerified,
  });
}

function withAdminFlag(user) {
  return {
    ...user,
    isAdmin: isAccountAdminSubject(user.sub || user.loginName),
  };
}