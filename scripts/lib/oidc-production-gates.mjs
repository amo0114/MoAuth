import { readFileSync } from "node:fs";

const DISCOVERY_ORIGIN_FIELDS = [
  "authorization_endpoint",
  "token_endpoint",
  "jwks_uri",
];

function normalizeUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function isProductionRuntime(env) {
  return env.NODE_ENV === "production";
}

function normalizeSigningMode(env) {
  const mode = String(env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE || "").trim().toLowerCase();
  if (["production-jwks", "production"].includes(mode)) return "production-jwks";
  if (["dev-hs256", "dev"].includes(mode)) return "dev-hs256";
  if (["off", "disabled", "none"].includes(mode)) return "off";
  return null;
}

function resolveSigningMode(env) {
  const explicit = normalizeSigningMode(env);
  if (explicit === "production-jwks") return "production-jwks";
  if (explicit === "off") return "off";
  if (explicit === "dev-hs256") {
    return isProductionRuntime(env) ? "off" : "dev-hs256";
  }
  if (hasPrivateKeyMaterial(env)) return "production-jwks";
  if (String(env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET || "").trim() && !isProductionRuntime(env)) {
    return "dev-hs256";
  }
  return "off";
}

function hasPrivateKeyMaterial(env) {
  const inline = String(env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY || "").trim();
  if (inline) return true;
  const keyFile = String(env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE || "").trim();
  return keyFile.length > 0;
}

function readPrivateKeyPem(env) {
  const inline = String(env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY || "").trim();
  if (inline) return inline;
  const keyFile = String(env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE || "").trim();
  if (!keyFile) return "";
  return readFileSync(keyFile, "utf8").trim();
}

function parseEnvFile(content) {
  const env = {};
  for (const line of String(content || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function loadSupplementalEnv(envFilePath) {
  if (!envFilePath) return {};
  return parseEnvFile(readFileSync(envFilePath, "utf8"));
}

function check(name, passed, detail = "") {
  return { name, passed, detail, status: passed ? "PASS" : "FAIL" };
}

function skip(name, detail = "") {
  return { name, passed: true, detail, status: "SKIP" };
}

function warn(name, detail = "") {
  return { name, passed: true, detail, status: "WARN" };
}

function hasEnvValue(env, name) {
  return String(env[name] || "").trim().length > 0;
}

function checkRequiredSecret(env, name) {
  return check(
    `${name.toLowerCase()}_present`,
    hasEnvValue(env, name),
    hasEnvValue(env, name) ? "configured" : `${name} is required`
  );
}

export function resolveAuthorizedAppsStoreBackend(env) {
  const backend = String(env.MOAUTH_AUTHORIZED_APPS_STORE || "").trim().toLowerCase();
  if (backend === "memory") return "memory";
  if (backend === "file") return "file";
  return env.NODE_ENV === "test" ? "memory" : "file";
}

export function evaluateAuthorizedAppsStoreWarnings(env) {
  const warnings = [];
  if (env.NODE_ENV !== "production") {
    return warnings;
  }
  const backend = resolveAuthorizedAppsStoreBackend(env);
  if (backend === "file") {
    warnings.push(
      warn(
        "authorized_apps_file_store_single_instance_only",
        "MOAUTH_AUTHORIZED_APPS_STORE=file is MVP single-instance only; migrate to db before scaling Account replicas"
      )
    );
  }
  return warnings;
}

export function evaluateStaticProductionGates(env, options = {}) {
  const checks = [];
  const issuer = normalizeUrl(
    env.MOAUTH_CONNECT_ISSUER || env.MOAUTH_CONNECT_PUBLIC_URL || ""
  );
  const signingMode = resolveSigningMode(env);
  const production = isProductionRuntime(env);
  const configuredAlg = String(env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG || "RS256")
    .trim()
    .toUpperCase();
  const configuredKid = String(env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID || "moauth-connect-1").trim();

  checks.push(
    check(
      "connect_issuer_configured",
      Boolean(issuer),
      issuer ? `issuer=${issuer}` : "MOAUTH_CONNECT_ISSUER is required"
    )
  );

  if (production) {
    checks.push(
      check(
        "production_signing_mode",
        signingMode === "production-jwks",
        `mode=${signingMode}`
      )
    );
    checks.push(
      check(
        "production_dev_hs256_disabled",
        signingMode !== "dev-hs256",
        signingMode === "dev-hs256" ? "dev-hs256 must be off in production" : `mode=${signingMode}`
      )
    );
    checks.push(
      check(
        "production_private_key_present",
        hasPrivateKeyMaterial(env),
        hasPrivateKeyMaterial(env)
          ? "private key configured via inline PEM or PRIVATE_KEY_FILE"
          : "MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY(_FILE) is required"
      )
    );
    if (hasPrivateKeyMaterial(env)) {
      try {
        const pem = readPrivateKeyPem(env);
        checks.push(
          check(
            "production_private_key_readable",
            pem.includes("BEGIN") && pem.includes("PRIVATE KEY"),
            "private key PEM is readable"
          )
        );
      } catch (error) {
        checks.push(
          check(
            "production_private_key_readable",
            false,
            String(error?.message || error)
          )
        );
      }
    }
    checks.push(
      check(
        "production_upstream_fallback_disabled",
        env.MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK !== "true",
        `MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK=${env.MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK || "(unset)"}`
      )
    );
    checks.push(checkRequiredSecret(env, "MOAUTH_CONNECT_SESSION_SECRET"));
    checks.push(checkRequiredSecret(env, "MOAUTH_CONNECT_TRANSACTION_SECRET"));
    checks.push(checkRequiredSecret(env, "MOAUTH_ACCOUNT_SESSION_SECRET"));
    checks.push(checkRequiredSecret(env, "MOAUTH_HANDOFF_INTERNAL_TOKEN"));
  } else {
    checks.push(skip("production_signing_mode", "NODE_ENV is not production"));
    checks.push(skip("production_dev_hs256_disabled", "NODE_ENV is not production"));
    checks.push(skip("production_private_key_present", "NODE_ENV is not production"));
    checks.push(skip("production_private_key_readable", "NODE_ENV is not production"));
    checks.push(skip("production_upstream_fallback_disabled", "NODE_ENV is not production"));
    checks.push(skip("moauth_connect_session_secret_present", "NODE_ENV is not production"));
    checks.push(skip("moauth_connect_transaction_secret_present", "NODE_ENV is not production"));
    checks.push(skip("moauth_account_session_secret_present", "NODE_ENV is not production"));
    checks.push(skip("moauth_handoff_internal_token_present", "NODE_ENV is not production"));
  }

  const supplemental = options.subboostEnvFile
    ? loadSupplementalEnv(options.subboostEnvFile)
    : {};
  const subboostProduction =
    (supplemental.NODE_ENV || env.MOAUTH_VERIFY_SUBBOOST_NODE_ENV || env.NODE_ENV) === "production";
  if (subboostProduction) {
    const fallback =
      supplemental.MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK ||
      env.MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK;
    checks.push(
      check(
        "subboost_production_upstream_fallback_disabled",
        fallback !== "true",
        `MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK=${fallback || "(unset)"}`
      )
    );
    checks.push(checkRequiredSecret({ ...env, ...supplemental }, "SUBBOOST_MOAUTH_TX_SECRET"));
  } else if (options.subboostEnvFile) {
    checks.push(skip("subboost_production_upstream_fallback_disabled", "SubBoost env is not production"));
    checks.push(skip("subboost_moauth_tx_secret_present", "SubBoost env is not production"));
  } else {
    checks.push(skip("subboost_production_upstream_fallback_disabled", "no SubBoost env file provided"));
    checks.push(skip("subboost_moauth_tx_secret_present", "no SubBoost env file provided"));
  }

  const warnings = evaluateAuthorizedAppsStoreWarnings(env);

  return {
    issuer,
    signingMode,
    configuredAlg: configuredAlg === "ES256" ? "ES256" : "RS256",
    configuredKid,
    checks,
    warnings,
    passed: checks.every((item) => item.passed),
  };
}

export function evaluateDiscoveryDocument(discovery, issuer, options = {}) {
  const checks = [];
  const expectedIssuer = normalizeUrl(issuer);
  const production = options.production === true;
  const actualIssuer = normalizeUrl(discovery?.issuer || "");

  checks.push(
    check(
      "discovery_issuer_matches_config",
      actualIssuer === expectedIssuer,
      `discovery=${actualIssuer || "(missing)"} expected=${expectedIssuer}`
    )
  );

  let connectOrigin = "";
  try {
    connectOrigin = new URL(expectedIssuer).origin;
  } catch {
    checks.push(check("discovery_connect_origin", false, `invalid issuer URL: ${expectedIssuer}`));
  }

  if (connectOrigin) {
    for (const field of DISCOVERY_ORIGIN_FIELDS) {
      const value = discovery?.[field];
      let sameOrigin = false;
      let detail = `${field}=${value || "(missing)"}`;
      try {
        sameOrigin = new URL(String(value || "")).origin === connectOrigin;
      } catch {
        sameOrigin = false;
        detail = `${field} is not a valid URL`;
      }
      checks.push(check(`discovery_${field}_same_origin`, sameOrigin, detail));
    }
  }

  if (production) {
    checks.push(
      check(
        "discovery_no_dev_resign_marker",
        discovery?.moauth_dev_id_token_resign !== true,
        discovery?.moauth_dev_id_token_resign === true
          ? "moauth_dev_id_token_resign must not appear in production"
          : "marker absent"
      )
    );
  } else {
    checks.push(skip("discovery_no_dev_resign_marker", "not running production discovery gate"));
  }

  return {
    checks,
    passed: checks.every((item) => item.passed),
  };
}

export function evaluateJwksDocument(jwks, { configuredAlg, configuredKid }) {
  const checks = [];
  const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
  const signingKeys = keys.filter((key) => key.use === "sig" || !key.use);

  checks.push(check("jwks_has_signing_keys", signingKeys.length > 0, `keys=${signingKeys.length}`));

  const matched = signingKeys.find((key) => key.kid === configuredKid);
  checks.push(
    check(
      "jwks_kid_matches_config",
      Boolean(matched),
      `expected kid=${configuredKid}`
    )
  );
  if (matched) {
    checks.push(
      check(
        "jwks_alg_matches_config",
        String(matched.alg || "").toUpperCase() === configuredAlg,
        `jwks alg=${matched.alg || "(missing)"} expected=${configuredAlg}`
      )
    );
  } else {
    checks.push(
      check("jwks_alg_matches_config", false, `kid ${configuredKid} not found in JWKS`)
    );
  }

  return {
    checks,
    matchedKey: matched || null,
    passed: checks.every((item) => item.passed),
  };
}

export async function evaluateIdTokenClaims(idToken, jwks, { issuer, clientId }) {
  const { createLocalJWKSet, decodeJwt, decodeProtectedHeader, jwtVerify } = await import("jose");
  const checks = [];
  const expectedIssuer = normalizeUrl(issuer);

  let header;
  let payload;
  try {
    header = decodeProtectedHeader(idToken);
    payload = decodeJwt(idToken);
  } catch (error) {
    checks.push(check("id_token_decodable", false, String(error?.message || error)));
    return { checks, passed: false };
  }

  checks.push(check("id_token_decodable", true, `alg=${header.alg || "(missing)"}`));

  const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
  const kidFound = keys.some((key) => key.kid === header.kid);
  checks.push(
    check(
      "id_token_header_kid_in_jwks",
      kidFound,
      `kid=${header.kid || "(missing)"}`
    )
  );

  checks.push(
    check(
      "id_token_iss_matches_discovery",
      normalizeUrl(payload.iss || "") === expectedIssuer,
      `iss=${payload.iss || "(missing)"} expected=${expectedIssuer}`
    )
  );

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud].filter(Boolean);
  checks.push(
    check(
      "id_token_aud_contains_client_id",
      audience.includes(clientId),
      `aud=${JSON.stringify(audience)} clientId=${clientId}`
    )
  );

  try {
    await jwtVerify(idToken, createLocalJWKSet(jwks), {
      issuer: expectedIssuer,
      audience: clientId,
    });
    checks.push(check("id_token_signature_valid_with_connect_jwks", true, "jwtVerify passed"));
  } catch (error) {
    checks.push(
      check(
        "id_token_signature_valid_with_connect_jwks",
        false,
        String(error?.message || error)
      )
    );
  }

  return {
    checks,
    header,
    payload,
    passed: checks.every((item) => item.passed),
  };
}

export function summarizeChecks(groups, warnings = []) {
  const flat = groups.flatMap((group) => group.checks || []);
  const warningItems = Array.isArray(warnings) ? warnings : [];
  return {
    total: flat.length,
    passed: flat.filter((item) => item.passed && item.status !== "WARN").length,
    failed: flat.filter((item) => !item.passed && item.status === "FAIL").length,
    skipped: flat.filter((item) => item.status === "SKIP").length,
    warnings: warningItems.length,
    checks: flat,
    ok: flat.every((item) => item.passed),
  };
}
