import "./server-only.js";

export {
  ZITADEL_API_BASE_ENV,
  ZITADEL_ISSUER_ENV,
  ZITADEL_SERVICE_USER_TOKEN_ENV,
  ZITADEL_ORG_ID_ENV,
  ZITADEL_PROJECT_ID_ENV,
  ZITADEL_ERROR_CODES,
  ZitadelConfigError,
  getZitadelConfig,
  isZitadelConfigured,
  buildZitadelFetch,
} from "./config.js";

export {
  isAuthRequestId,
  assertAuthRequestId,
  getAuthRequest,
  createPasswordSession,
  getSession,
  hydratePasswordSession,
  finalizeAuthRequest,
} from "./session.js";

export { getHumanUser, updateHumanProfile, mapHumanUser } from "./profile.js";

export {
  listUsers,
  searchHumanUserByEmail,
  registerHumanUser,
  verifyUserEmail,
  resendEmailVerificationCode,
  requestPasswordReset,
  setPasswordWithVerificationCode,
  changeUserPassword,
  deactivateHumanUser,
  reactivateHumanUser,
  deleteHumanUser,
} from "./users.js";

export {
  listHumanAuthFactors,
  listHumanPasswordless,
  mapHumanAuthFactor,
  mapHumanPasswordlessToken,
} from "./security.js";

export {
  getCachedAuthRequest,
  setCachedAuthRequest,
  clearAuthRequestCache,
} from "./cache.js";

export {
  buildOidcAppPayload,
  createOidcApplication,
  updateOidcApplication,
  deactivateOidcApplication,
  reactivateOidcApplication,
} from "./applications.js";
