import { OIDC_CONTRACT_ERROR_CODES, OidcContractError, validateAuthorizationRequest } from "@moauth/connect-contract";
import { findClientById } from "../config/clients.js";

export function parseAuthorizeRequest(searchParams) {
  return resolveAuthorizeRequest(searchParams).authRequest;
}

export function resolveAuthorizeRequest(searchParams) {
  const clientId = searchParams.get("client_id") || "";
  const client = findClientById(clientId);
  if (!client) {
    throw new OidcContractError(OIDC_CONTRACT_ERROR_CODES.INVALID_AUTHORIZATION_REQUEST, "Unknown OIDC client.", {
      clientId,
    });
  }

  const authRequest = validateAuthorizationRequest(
      {
        client_id: clientId,
        redirect_uri: searchParams.get("redirect_uri") || "",
        response_type: searchParams.get("response_type") || "",
        scope: searchParams.get("scope") || "",
        state: searchParams.get("state") || "",
        nonce: searchParams.get("nonce") || "",
        code_challenge: searchParams.get("code_challenge") || "",
        code_challenge_method: searchParams.get("code_challenge_method") || "",
        prompt: searchParams.get("prompt") || "",
      },
      client
    );

  return Object.freeze({ authRequest, client });
}

export function buildAuthorizeErrorUrl(error) {
  const params = new URLSearchParams({
    code: error?.code || OIDC_CONTRACT_ERROR_CODES.INVALID_AUTHORIZATION_REQUEST,
    message: error?.message || "Invalid authorization request.",
  });
  return `/authorize/error?${params.toString()}`;
}
