/**
 * Connect JWKS issuer (v1: single signing key).
 *
 * v2 extension: load current + optional previous private keys, expose both public
 * JWKs in getConnectJwksDocument(), sign only with current. See
 * docs/reviews/moauth-release-readiness.md §1.
 */
import { exportJWK, importPKCS8 } from "jose";

import {
  getConnectIdTokenSigningAlgorithm,
  getConnectIdTokenSigningKeyId,
  getConnectIdTokenSigningPrivateKeyPem,
  isProductionIdTokenSigningEnabled,
} from "../config/env.js";

let signingKeyPromise = null;
let jwksDocumentPromise = null;

async function loadSigningKey() {
  const pem = getConnectIdTokenSigningPrivateKeyPem();
  if (!pem) {
    throw new Error("MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY is required for production-jwks mode.");
  }
  const alg = getConnectIdTokenSigningAlgorithm();
  return importPKCS8(pem, alg, { extractable: true });
}

function toPublicJwk(jwk) {
  const privateFields = new Set(["d", "p", "q", "dp", "dq", "qi", "oth"]);
  return Object.fromEntries(
    Object.entries(jwk).filter(([key]) => !privateFields.has(key))
  );
}

export async function getConnectSigningKey() {
  if (!isProductionIdTokenSigningEnabled()) {
    return null;
  }
  if (!signingKeyPromise) {
    signingKeyPromise = loadSigningKey();
  }
  return signingKeyPromise;
}

export async function getConnectJwksDocument() {
  if (!isProductionIdTokenSigningEnabled()) {
    return null;
  }
  if (!jwksDocumentPromise) {
    jwksDocumentPromise = (async () => {
      const privateKey = await getConnectSigningKey();
      const alg = getConnectIdTokenSigningAlgorithm();
      const kid = getConnectIdTokenSigningKeyId();
      const publicJwk = toPublicJwk(await exportJWK(privateKey));
      return {
        keys: [
          {
            ...publicJwk,
            kid,
            use: "sig",
            alg,
          },
        ],
      };
    })();
  }
  return jwksDocumentPromise;
}

export function resetConnectJwksCacheForTests() {
  signingKeyPromise = null;
  jwksDocumentPromise = null;
}
