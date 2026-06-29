import { cookies } from "next/headers";
import { ConnectLoginPage } from "../../src/ui/connect-login-page.jsx";
import {
  LOGIN_TRANSACTION_COOKIE,
  readLoginTransactionFromCookie,
} from "../../src/oidc/transaction.js";
import { getAuthRequest } from "../../src/oidc/session.js";
import { findClientById } from "../../src/config/clients.js";
import { ZITADEL_ERROR_CODES } from "../../src/config/zitadel.js";
import {
  CONNECT_SESSION_COOKIE,
  readConnectSessionFromCookie,
} from "../../src/oidc/connect-session.js";

export default async function LoginPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const authRequestId = typeof resolvedSearchParams?.authRequest === "string" ? resolvedSearchParams.authRequest : "";
  const tx = typeof resolvedSearchParams?.tx === "string" ? resolvedSearchParams.tx : "";
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOGIN_TRANSACTION_COOKIE)?.value;

  let existingSession = null;
  if (authRequestId) {
    const connectCookie = cookieStore.get(CONNECT_SESSION_COOKIE)?.value;
    if (connectCookie) {
      try {
        const session = readConnectSessionFromCookie(connectCookie);
        existingSession = { loginName: session.loginName || null };
      } catch {
        existingSession = null;
      }
    }
  }

  if (authRequestId) {
    const authRequestInfo = await loadAuthRequestInfo(authRequestId);
    return <ConnectLoginPage authRequestId={authRequestId} authRequestInfo={authRequestInfo} existingSession={existingSession} />;
  }

  if (!tx) return <ConnectLoginPage />;

  try {
    const transaction = readLoginTransactionFromCookie(cookieValue, tx);
    return <ConnectLoginPage transaction={transaction} />;
  } catch {
    return <ConnectLoginPage transactionError="这次登录请求已失效，请从应用重新进入。" />;
  }
}

async function loadAuthRequestInfo(authRequestId) {
  try {
    const { payload } = await getAuthRequest(authRequestId);
    const authRequest = payload?.authRequest || {};
    const clientId = authRequest.clientId || "";
    const client = findClientById(clientId);
    return {
      clientId,
      clientDisplayName: client?.displayName || clientId,
      scopes: Array.isArray(authRequest.scope) ? authRequest.scope : [],
      redirectUri: authRequest.redirectUri || "",
      prompt: Array.isArray(authRequest.prompt) ? authRequest.prompt : [],
    };
  } catch (error) {
    return {
      clientId: "",
      clientDisplayName: "",
      scopes: [],
      redirectUri: "",
      prompt: [],
      lookupError:
        error.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND
          ? "expired"
          : "unavailable",
    };
  }
}