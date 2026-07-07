import {
  isZitadelConfigured,
  listHumanAuthFactors,
  listHumanPasswordless,
} from "@moauth/zitadel-client";

export async function getAccountSecuritySummary(session, options = {}) {
  const passwordChangeSupported = Boolean(session?.sub && isZitadelConfigured());
  const [mfa, passkeys] = passwordChangeSupported
    ? await Promise.all([
        loadMfaSummary(session.sub, options),
        loadPasskeySummary(session.sub, options),
      ])
    : [unsupportedMfaSummary(), unsupportedPasskeySummary()];

  return Object.freeze({
    status: "SECURITY_SUMMARY",
    password: Object.freeze({
      set: Boolean(session?.sub),
      changeSupported: passwordChangeSupported,
      status: passwordChangeSupported ? "managed_by_zitadel" : "backend_unavailable",
      source: "account_session",
    }),
    mfa,
    passkeys,
  });
}

async function loadMfaSummary(userId, options) {
  try {
    const factors = await listHumanAuthFactors(userId, options);
    const methods = uniqueValues(factors.map((factor) => factor.type).filter(Boolean));
    return Object.freeze({
      enabled: factors.length > 0,
      methods,
      supported: true,
      status: factors.length > 0 ? "enabled" : "not_configured",
      source: "zitadel_management_api",
    });
  } catch {
    return Object.freeze({
      enabled: false,
      methods: [],
      supported: true,
      status: "backend_unavailable",
      source: "zitadel_management_api",
    });
  }
}

async function loadPasskeySummary(userId, options) {
  try {
    const passkeys = await listHumanPasswordless(userId, options);
    return Object.freeze({
      count: passkeys.length,
      items: passkeys,
      supported: true,
      status: passkeys.length > 0 ? "enabled" : "not_configured",
      source: "zitadel_management_api",
    });
  } catch {
    return Object.freeze({
      count: 0,
      items: [],
      supported: true,
      status: "backend_unavailable",
      source: "zitadel_management_api",
    });
  }
}

function unsupportedMfaSummary() {
  return Object.freeze({
    enabled: false,
    methods: [],
    supported: false,
    status: "unsupported",
  });
}

function unsupportedPasskeySummary() {
  return Object.freeze({
    count: 0,
    items: [],
    supported: false,
    status: "unsupported",
  });
}

function uniqueValues(values) {
  return [...new Set(values)];
}
