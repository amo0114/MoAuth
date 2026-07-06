#!/usr/bin/env node
/**
 * MoAuth production OIDC verification gate.
 *
 * Usage:
 *   node scripts/verify-oidc.mjs
 *   node scripts/verify-oidc.mjs --static-only
 *   NODE_ENV=production MOAUTH_CONNECT_ISSUER=... node scripts/verify-oidc.mjs
 */
import {
  evaluateDiscoveryDocument,
  evaluateIdTokenClaims,
  evaluateJwksDocument,
  evaluateStaticProductionGates,
  summarizeChecks,
} from "./lib/oidc-production-gates.mjs";

function parseArgs(argv) {
  const options = {
    staticOnly: false,
    strictLive: false,
    issuer: "",
    subboostEnvFile: process.env.MOAUTH_VERIFY_SUBBOOST_ENV_FILE || "",
    idToken: process.env.MOAUTH_VERIFY_ID_TOKEN || "",
    clientId:
      process.env.MOAUTH_VERIFY_CLIENT_ID ||
      process.env.MOAUTH_CONNECT_CLIENT_ID ||
      "",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--static-only") {
      options.staticOnly = true;
      continue;
    }
    if (arg === "--strict-live") {
      options.strictLive = true;
      continue;
    }
    if (arg === "--issuer" && argv[i + 1]) {
      options.issuer = String(argv[++i]).trim();
      continue;
    }
    if (arg === "--subboost-env" && argv[i + 1]) {
      options.subboostEnvFile = String(argv[++i]).trim();
      continue;
    }
    if (arg === "--id-token" && argv[i + 1]) {
      options.idToken = String(argv[++i]).trim();
      continue;
    }
    if (arg === "--client-id" && argv[i + 1]) {
      options.clientId = String(argv[++i]).trim();
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`MoAuth OIDC verification

Options:
  --static-only           Run configuration gates only
  --strict-live           Fail when live Connect checks cannot run (staging/release)
  --issuer <url>          Override MOAUTH_CONNECT_ISSUER
  --subboost-env <path>   SubBoost .env file for production fallback gate
  --id-token <jwt>        Optional id_token for signature/claim checks
  --client-id <id>        Business client_id for aud verification

Environment:
  MOAUTH_CONNECT_ISSUER
  MOAUTH_CONNECT_PUBLIC_URL
  MOAUTH_CONNECT_ID_TOKEN_SIGNING_* (see ADR-010)
  MOAUTH_VERIFY_ID_TOKEN / MOAUTH_VERIFY_CLIENT_ID
  MOAUTH_VERIFY_SUBBOOST_ENV_FILE
`);
}

function logCheck(item) {
  const suffix = item.detail ? ` — ${item.detail}` : "";
  console.log(`[${item.status}] ${item.name}${suffix}`);
}

async function fetchJson(url, timeoutMs = 8000) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { response, body };
}

async function runLiveChecks({
  issuer,
  configuredAlg,
  configuredKid,
  production,
  idToken,
  clientId,
}) {
  const groups = [];
  const liveMeta = { reachable: false, reason: "" };

  try {
    const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
    const { response, body } = await fetchJson(discoveryUrl);
    if (!response.ok) {
      liveMeta.reason = `discovery HTTP ${response.status}`;
      return { groups, liveMeta };
    }

    liveMeta.reachable = true;
    const discoveryGroup = evaluateDiscoveryDocument(body, issuer, { production });
    groups.push({ name: "discovery", ...discoveryGroup });

    const jwksUrl = body?.jwks_uri || `${issuer}/oauth/v2/keys`;
    const jwksResult = await fetchJson(jwksUrl);
    if (!jwksResult.response.ok) {
      groups.push({
        name: "jwks",
        passed: false,
        checks: [
          {
            name: "jwks_fetch",
            passed: false,
            detail: `HTTP ${jwksResult.response.status}`,
            status: "FAIL",
          },
        ],
      });
    } else {
      const jwksGroup = evaluateJwksDocument(jwksResult.body, {
        configuredAlg,
        configuredKid,
      });
      groups.push({ name: "jwks", ...jwksGroup });

      if (idToken && clientId) {
        const tokenGroup = await evaluateIdTokenClaims(idToken, jwksResult.body, {
          issuer,
          clientId,
        });
        groups.push({ name: "id_token", ...tokenGroup });
      } else {
        groups.push({
          name: "id_token",
          passed: true,
          checks: [
            {
              name: "id_token_checks",
              passed: true,
              detail: "skipped (set MOAUTH_VERIFY_ID_TOKEN and MOAUTH_VERIFY_CLIENT_ID)",
              status: "SKIP",
            },
          ],
        });
      }
    }
  } catch (error) {
    liveMeta.reason = String(error?.message || error);
  }

  return { groups, liveMeta };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const env = { ...process.env };
  const staticResult = evaluateStaticProductionGates(env, {
    subboostEnvFile: args.subboostEnvFile || undefined,
  });
  const issuer = args.issuer || staticResult.issuer;
  const production = env.NODE_ENV === "production";

  console.log("MoAuth OIDC verification");
  console.log(`  NODE_ENV=${env.NODE_ENV || "(unset)"}`);
  console.log(`  signingMode=${staticResult.signingMode}`);
  console.log(`  issuer=${issuer || "(unset)"}`);

  const groups = [{ name: "static", checks: staticResult.checks, passed: staticResult.passed }];
  for (const item of staticResult.checks) {
    logCheck(item);
  }
  for (const item of staticResult.warnings || []) {
    logCheck(item);
  }

  let liveSummary = null;
  if (!args.staticOnly && issuer) {
    const { groups: liveGroups, liveMeta } = await runLiveChecks({
      issuer,
      configuredAlg: staticResult.configuredAlg,
      configuredKid: staticResult.configuredKid,
      production,
      idToken: args.idToken,
      clientId: args.clientId,
    });

    if (liveMeta.reachable) {
      for (const group of liveGroups) {
        groups.push(group);
        for (const item of group.checks) {
          logCheck(item);
        }
      }
    } else {
      const skipCheck = {
        name: "live_connect_checks",
        passed: !args.strictLive,
        detail: liveMeta.reason || "Connect issuer unreachable",
        status: args.strictLive ? "FAIL" : "SKIP",
      };
      groups.push({ name: "live", checks: [skipCheck], passed: skipCheck.passed });
      logCheck(skipCheck);
    }
  } else if (args.staticOnly) {
    const skipCheck = {
      name: "live_connect_checks",
      passed: true,
      detail: "--static-only",
      status: "SKIP",
    };
    groups.push({ name: "live", checks: [skipCheck], passed: true });
    logCheck(skipCheck);
  } else {
    const skipCheck = {
      name: "live_connect_checks",
      passed: true,
      detail: "issuer not configured",
      status: "SKIP",
    };
    groups.push({ name: "live", checks: [skipCheck], passed: true });
    logCheck(skipCheck);
  }

  liveSummary = summarizeChecks(groups, staticResult.warnings);
  console.log("");
  const warningSuffix =
    liveSummary.warnings > 0 ? `, ${liveSummary.warnings} warned` : "";
  console.log(
    `Summary: ${liveSummary.passed}/${liveSummary.total} passed, ${liveSummary.failed} failed, ${liveSummary.skipped} skipped${warningSuffix}`
  );

  if (!liveSummary.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`OIDC verification failed: ${error?.message || error}`);
  process.exitCode = 1;
});