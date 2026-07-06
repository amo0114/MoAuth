import { createRemoteJWKSet, customFetch, SignJWT, jwtVerify } from "jose";

import {
  getConnectIdTokenSigningAlgorithm,
  getConnectIdTokenSigningKeyId,
  getIdTokenSigningMode,
  getIdTokenSigningSecret,
  isConnectIdTokenResignEnabled,
  isProductionIdTokenSigningEnabled,
} from "../config/env.js";
import { getConnectSigningKey } from "./connect-jwks.js";

export const CONNECT_ID_TOKEN_RESIGN_ERROR_CODE = "CONNECT_ID_TOKEN_RESIGN_FAILED";

export class ConnectIdTokenResignError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "ConnectIdTokenResignError";
    this.code = CONNECT_ID_TOKEN_RESIGN_ERROR_CODE;
    this.cause = cause;
  }
}

function expandLoopbackIssuerAliases(issuer) {
  const aliases = [issuer];
  try {
    const parsed = new URL(issuer);
    if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
      return aliases;
    }
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    const altHost = parsed.hostname === "localhost" ? "127.0.0.1" : "localhost";
    const alt = new URL(issuer);
    alt.hostname = altHost;
    if (!parsed.port && port !== "80" && port !== "443") {
      alt.port = port;
    }
    aliases.push(alt.toString().replace(/\/$/, ""));
  } catch {
    return aliases;
  }
  return [...new Set(aliases)];
}

function buildIssuerAllowlist(...issuers) {
  const allowlist = [];
  for (const issuer of issuers) {
    if (typeof issuer === "string" && issuer) {
      allowlist.push(...expandLoopbackIssuerAliases(issuer));
    }
  }
  return [...new Set(allowlist)];
}

async function verifyUpstreamIdToken({ idToken, upstreamIssuer, connectIssuer, fetchImpl }) {
  const jwksUrl = new URL(`${upstreamIssuer}/oauth/v2/keys`);
  const upstreamJwks = createRemoteJWKSet(jwksUrl, {
    [customFetch]: fetchImpl,
  });
  const { payload } = await jwtVerify(idToken, upstreamJwks, {
    issuer: buildIssuerAllowlist(upstreamIssuer, connectIssuer),
  });
  return payload;
}

async function signIdTokenForConnect({ payload, connectIssuer }) {
  const mode = getIdTokenSigningMode();
  if (mode === "dev-hs256") {
    const signingSecret = getIdTokenSigningSecret();
    if (!signingSecret) return null;
    const secret = new TextEncoder().encode(signingSecret);
    return new SignJWT({ ...payload, iss: connectIssuer })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .sign(secret);
  }

  if (mode === "production-jwks") {
    const signingKey = await getConnectSigningKey();
    if (!signingKey) return null;
    const alg = getConnectIdTokenSigningAlgorithm();
    const kid = getConnectIdTokenSigningKeyId();
    return new SignJWT({ ...payload, iss: connectIssuer })
      .setProtectedHeader({ alg, typ: "JWT", kid })
      .sign(signingKey);
  }

  return null;
}

export async function resignIdTokenForConnectIssuer({
  idToken,
  upstreamIssuer,
  connectIssuer,
  fetchImpl = fetch,
}) {
  if (!idToken || !isConnectIdTokenResignEnabled()) {
    return idToken;
  }

  const payload = await verifyUpstreamIdToken({
    idToken,
    upstreamIssuer,
    connectIssuer,
    fetchImpl,
  });
  const resigned = await signIdTokenForConnect({ payload, connectIssuer });
  if (!resigned && isProductionIdTokenSigningEnabled()) {
    throw new ConnectIdTokenResignError(
      "Connect id_token re-signing is enabled but no Connect signing key was available."
    );
  }
  return resigned || idToken;
}

export async function rewriteOidcTokenResponseBody(body, { upstreamIssuer, connectIssuer, fetchImpl }) {
  if (!body || typeof body !== "object" || typeof body.id_token !== "string") {
    return body;
  }

  if (!isConnectIdTokenResignEnabled()) {
    return body;
  }

  try {
    const idToken = await resignIdTokenForConnectIssuer({
      idToken: body.id_token,
      upstreamIssuer,
      connectIssuer,
      fetchImpl,
    });
    return { ...body, id_token: idToken };
  } catch (error) {
    if (isProductionIdTokenSigningEnabled()) {
      if (error?.code === CONNECT_ID_TOKEN_RESIGN_ERROR_CODE) {
        throw error;
      }
      throw new ConnectIdTokenResignError(
        "Connect could not verify and re-sign the upstream id_token for the public issuer.",
        error
      );
    }
    return body;
  }
}
