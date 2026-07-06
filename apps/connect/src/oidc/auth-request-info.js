import { getAuthRequest } from "./session.js";
import { findClientById } from "../config/clients.js";
import { ZITADEL_ERROR_CODES } from "../config/zitadel.js";

export async function loadAuthRequestInfo(authRequestId, options = {}) {
  try {
    const { payload } = await getAuthRequest(authRequestId, options);
    const authRequest = payload?.authRequest || {};
    const clientId = authRequest.clientId || "";
    const client = findClientById(clientId);
    return {
      authRequestId,
      clientId,
      clientDisplayName: client?.displayName || clientId,
      scopes: Array.isArray(authRequest.scope) ? authRequest.scope : [],
      redirectUri: authRequest.redirectUri || "",
      state: authRequest.state || "",
      prompt: Array.isArray(authRequest.prompt) ? authRequest.prompt : [],
      lookupError: null,
    };
  } catch (error) {
    return {
      authRequestId,
      clientId: "",
      clientDisplayName: "",
      scopes: [],
      redirectUri: "",
      state: "",
      prompt: [],
      lookupError:
        error.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND
          ? "expired"
          : "unavailable",
    };
  }
}