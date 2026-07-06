import { getHumanUser, isZitadelConfigured } from "@moauth/zitadel-client";

export async function resolveHandoffIdentity(
  { userId, loginName, email, emailVerified, scopes },
  options = {}
) {
  const normalizedScopes = Array.isArray(scopes) ? scopes : [];
  let resolvedSub = userId || null;
  let resolvedLoginName = loginName || null;
  let resolvedEmail = email ?? null;
  let resolvedEmailVerified = resolvedEmail ? Boolean(emailVerified) : false;

  const needsProfileLookup =
    Boolean(userId) &&
    isZitadelConfigured() &&
    (!resolvedLoginName || !resolvedEmail);

  if (needsProfileLookup) {
    const profile = await getHumanUser(userId, options);
    resolvedSub = profile.id || resolvedSub;
    resolvedLoginName = profile.loginName || resolvedLoginName;
    if (profile.email) {
      resolvedEmail = profile.email;
      resolvedEmailVerified = profile.emailVerified;
    }
  }

  return {
    sub: resolvedSub || resolvedLoginName,
    loginName: resolvedLoginName,
    email: resolvedEmail,
    emailVerified: resolvedEmailVerified,
  };
}