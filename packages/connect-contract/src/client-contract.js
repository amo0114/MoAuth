import { OIDC_CONTRACT_ERROR_CODES, assertCondition } from "./errors.js";
import { PKCE_CHALLENGE_METHOD, assertS256Challenge } from "./pkce.js";

export const REQUIRED_OIDC_SCOPES = Object.freeze(["openid", "profile", "email"]);
export const STANDARD_OIDC_CLAIMS = Object.freeze(["sub", "name", "email", "email_verified", "picture"]);
export const PROVISIONING_POLICIES = Object.freeze(["invite", "allowlist", "manual-binding", "auto-create"]);
export const CLIENT_TYPES = Object.freeze(["confidential", "public"]);
export const PROMPT_VALUES = Object.freeze(["login", "select_account", "consent", "none"]);

const STATE_MIN_LENGTH = 22;
const NONCE_MIN_LENGTH = 16;

export function normalizeIssuer(issuer) {
  assertCondition(
    typeof issuer === "string" && issuer.trim().length > 0,
    OIDC_CONTRACT_ERROR_CODES.INVALID_DISCOVERY_CONFIG,
    "issuer is required."
  );
  const parsed = parseUrl(issuer.trim(), OIDC_CONTRACT_ERROR_CODES.INVALID_DISCOVERY_CONFIG, "issuer must be an absolute URL.");
  assertCondition(
    parsed.protocol === "https:" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1",
    OIDC_CONTRACT_ERROR_CODES.INVALID_DISCOVERY_CONFIG,
    "issuer must use HTTPS outside local development.",
    { issuer }
  );
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/+$/, "");
}

export function buildDiscoveryMetadata(input) {
  const issuer = normalizeIssuer(input.issuer);
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/v2/authorize`,
    token_endpoint: `${issuer}/oauth/v2/token`,
    userinfo_endpoint: `${issuer}/oidc/v1/userinfo`,
    jwks_uri: `${issuer}/oauth/v2/keys`,
    end_session_endpoint: `${issuer}/oidc/v1/end_session`,
    response_types_supported: ["code"],
    scopes_supported: [...REQUIRED_OIDC_SCOPES],
    claims_supported: [...STANDARD_OIDC_CLAIMS],
    code_challenge_methods_supported: [PKCE_CHALLENGE_METHOD],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
  };
}

export function normalizeScopes(scope) {
  const raw = Array.isArray(scope) ? scope : String(scope || "").split(/\s+/);
  const scopes = raw.map((item) => String(item).trim()).filter(Boolean);
  return [...new Set(scopes)];
}

export function validateRegisteredClient(input, options = {}) {
  const clientId = stringField(input, "clientId");
  const displayName = stringField(input, "displayName");
  const clientType = stringField(input, "clientType") || "confidential";
  const provisioningPolicy = stringField(input, "provisioningPolicy");
  const redirectUris = Array.isArray(input?.redirectUris) ? input.redirectUris : [];
  const allowedScopes = normalizeScopes(input?.allowedScopes?.length ? input.allowedScopes : REQUIRED_OIDC_SCOPES);
  const allowedPrompts = normalizePromptValues(input?.allowedPrompts?.length ? input.allowedPrompts : PROMPT_VALUES);

  assertCondition(clientId.length > 0, OIDC_CONTRACT_ERROR_CODES.INVALID_CLIENT_REGISTRATION, "clientId is required.");
  assertCondition(displayName.length > 0, OIDC_CONTRACT_ERROR_CODES.INVALID_CLIENT_REGISTRATION, "displayName is required.");
  assertCondition(CLIENT_TYPES.includes(clientType), OIDC_CONTRACT_ERROR_CODES.INVALID_CLIENT_REGISTRATION, "clientType is invalid.", {
    clientType,
  });
  assertCondition(
    PROVISIONING_POLICIES.includes(provisioningPolicy),
    OIDC_CONTRACT_ERROR_CODES.INVALID_CLIENT_REGISTRATION,
    "provisioningPolicy must be explicit.",
    { provisioningPolicy, allowed: PROVISIONING_POLICIES }
  );
  assertCondition(redirectUris.length > 0, OIDC_CONTRACT_ERROR_CODES.INVALID_CLIENT_REGISTRATION, "At least one redirect URI is required.");

  const normalizedRedirectUris = redirectUris.map((uri) => validateRedirectUri(uri, options));
  assertCondition(
    new Set(normalizedRedirectUris).size === normalizedRedirectUris.length,
    OIDC_CONTRACT_ERROR_CODES.INVALID_CLIENT_REGISTRATION,
    "redirectUris must not contain duplicates."
  );

  for (const requiredScope of REQUIRED_OIDC_SCOPES) {
    assertCondition(
      allowedScopes.includes(requiredScope),
      OIDC_CONTRACT_ERROR_CODES.UNSUPPORTED_SCOPE,
      `Client must allow required scope: ${requiredScope}`,
      { requiredScope, allowedScopes }
    );
  }

  return Object.freeze({
    clientId,
    displayName,
    clientType,
    redirectUris: Object.freeze(normalizedRedirectUris),
    allowedScopes: Object.freeze(allowedScopes),
    allowedPrompts: Object.freeze(allowedPrompts),
    requiredScopes: REQUIRED_OIDC_SCOPES,
    requiredClaims: STANDARD_OIDC_CLAIMS,
    provisioningPolicy,
  });
}

export function validateAuthorizationRequest(input, client) {
  const warnings = [];
  const clientId = stringField(input, "client_id");
  const redirectUri = stringField(input, "redirect_uri");
  const responseType = stringField(input, "response_type");
  const state = stringField(input, "state");
  const nonce = stringField(input, "nonce");
  const codeChallenge = stringField(input, "code_challenge");
  const codeChallengeMethod = stringField(input, "code_challenge_method");
  const scopes = normalizeScopes(input?.scope);
  const promptValues = normalizePromptValues(input?.prompt ? String(input.prompt).split(/\s+/) : []);

  assertCondition(clientId === client.clientId, OIDC_CONTRACT_ERROR_CODES.INVALID_AUTHORIZATION_REQUEST, "client_id does not match registered client.", {
    clientId,
    expectedClientId: client.clientId,
  });
  assertCondition(responseType === "code", OIDC_CONTRACT_ERROR_CODES.INVALID_AUTHORIZATION_REQUEST, "response_type must be code.", {
    responseType,
  });
  assertCondition(client.redirectUris.includes(redirectUri), OIDC_CONTRACT_ERROR_CODES.REDIRECT_URI_MISMATCH, "redirect_uri must exactly match registration.", {
    redirectUri,
  });
  assertRequiredScopes(scopes);
  assertScopesAllowed(scopes, client.allowedScopes);
  assertCondition(
    state.length >= STATE_MIN_LENGTH,
    OIDC_CONTRACT_ERROR_CODES.INVALID_AUTHORIZATION_REQUEST,
    "state must be high-entropy and bound to the browser session.",
    { minLength: STATE_MIN_LENGTH }
  );
  if (!nonce) {
    warnings.push("nonce is recommended for OIDC authorization requests.");
  } else {
    assertCondition(
      nonce.length >= NONCE_MIN_LENGTH,
      OIDC_CONTRACT_ERROR_CODES.INVALID_AUTHORIZATION_REQUEST,
      "nonce is too short.",
      { minLength: NONCE_MIN_LENGTH }
    );
  }
  assertS256Challenge(codeChallengeMethod, codeChallenge);
  assertPromptsAllowed(promptValues, client.allowedPrompts);

  return Object.freeze({
    clientId,
    redirectUri,
    responseType,
    scopes: Object.freeze(scopes),
    state,
    nonce: nonce || null,
    codeChallenge,
    codeChallengeMethod,
    prompt: Object.freeze(promptValues),
    warnings: Object.freeze(warnings),
  });
}

export function buildAuthorizationUrl(authorizationEndpoint, request) {
  const url = new URL(authorizationEndpoint);
  url.searchParams.set("client_id", request.clientId);
  url.searchParams.set("redirect_uri", request.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", request.scopes.join(" "));
  url.searchParams.set("state", request.state);
  if (request.nonce) url.searchParams.set("nonce", request.nonce);
  url.searchParams.set("code_challenge", request.codeChallenge);
  url.searchParams.set("code_challenge_method", PKCE_CHALLENGE_METHOD);
  if (request.prompt.length > 0) url.searchParams.set("prompt", request.prompt.join(" "));
  return url.toString();
}

function validateRedirectUri(uri, options) {
  assertCondition(typeof uri === "string" && uri.trim().length > 0, OIDC_CONTRACT_ERROR_CODES.INVALID_CLIENT_REGISTRATION, "redirect URI is required.");
  const raw = uri.trim();
  const parsed = parseUrl(raw, OIDC_CONTRACT_ERROR_CODES.INVALID_CLIENT_REGISTRATION, "redirect URI must be an absolute URL.");
  assertCondition(!parsed.hash, OIDC_CONTRACT_ERROR_CODES.INVALID_CLIENT_REGISTRATION, "redirect URI must not contain a fragment.", { uri: raw });
  const allowLoopbackHttp = options.allowLoopbackHttp === true;
  const isHttps = parsed.protocol === "https:";
  const isAllowedLoopback = allowLoopbackHttp && parsed.protocol === "http:" && isLoopbackHost(parsed.hostname);
  assertCondition(
    isHttps || isAllowedLoopback,
    OIDC_CONTRACT_ERROR_CODES.INVALID_CLIENT_REGISTRATION,
    "redirect URI must use HTTPS outside explicit loopback development.",
    { uri: raw }
  );
  return raw;
}

function assertRequiredScopes(scopes) {
  for (const requiredScope of REQUIRED_OIDC_SCOPES) {
    assertCondition(
      scopes.includes(requiredScope),
      OIDC_CONTRACT_ERROR_CODES.UNSUPPORTED_SCOPE,
      `Authorization request is missing required scope: ${requiredScope}`,
      { requiredScope, scopes }
    );
  }
}

function assertScopesAllowed(scopes, allowedScopes) {
  const unsupported = scopes.filter((scope) => !allowedScopes.includes(scope));
  assertCondition(
    unsupported.length === 0,
    OIDC_CONTRACT_ERROR_CODES.UNSUPPORTED_SCOPE,
    "Authorization request includes unsupported scopes.",
    { unsupported, allowedScopes }
  );
}

function assertPromptsAllowed(promptValues, allowedPrompts) {
  if (promptValues.length === 0) return;
  assertCondition(
    !(promptValues.includes("none") && promptValues.length > 1),
    OIDC_CONTRACT_ERROR_CODES.UNSUPPORTED_PROMPT,
    "prompt=none must not be combined with other prompt values.",
    { promptValues }
  );
  const unsupported = promptValues.filter((prompt) => !allowedPrompts.includes(prompt));
  assertCondition(
    unsupported.length === 0,
    OIDC_CONTRACT_ERROR_CODES.UNSUPPORTED_PROMPT,
    "Authorization request includes unsupported prompt values.",
    { unsupported, allowedPrompts }
  );
}

function normalizePromptValues(values) {
  const normalized = normalizeScopes(values);
  const unsupported = normalized.filter((value) => !PROMPT_VALUES.includes(value));
  assertCondition(
    unsupported.length === 0,
    OIDC_CONTRACT_ERROR_CODES.UNSUPPORTED_PROMPT,
    "Unsupported prompt value.",
    { unsupported, allowed: PROMPT_VALUES }
  );
  return normalized;
}

function stringField(input, key) {
  const value = input?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function parseUrl(value, code, message) {
  try {
    return new URL(value);
  } catch {
    assertCondition(false, code, message, { value });
  }
}
