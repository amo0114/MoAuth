/**
 * P5+ placeholder for linux.do-style user levels (0-4).
 * Until a real reputation model exists, verified email => level 1, admin => level 4.
 */
export function resolveUserLevel(user) {
  if (!user?.sub) return 0;
  if (user.isAdmin) return 4;
  if (user.emailVerified) return 1;
  return 0;
}

export function assertMinUserLevel(user, minUserLevel = 0) {
  const level = resolveUserLevel(user);
  if (level < minUserLevel) {
    const error = new Error(`Requires user level ${minUserLevel} or higher.`);
    error.code = "USER_LEVEL_TOO_LOW";
    error.details = { level, required: minUserLevel };
    throw error;
  }
  return level;
}