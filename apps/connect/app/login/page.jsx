import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ConnectConsentPage } from "../../src/ui/connect-consent-page.jsx";
import { ConnectLoginPage } from "../../src/ui/connect-login-page.jsx";
import { ConnectServiceUnavailablePage } from "../../src/ui/connect-service-unavailable-page.jsx";
import { isAccountCenterAvailable } from "../../src/account/account-availability.js";
import { checkAuthorizedAppFromAccount } from "../../src/authorized-apps/account-client.js";
import { buildAccountLoginUrl } from "../../src/oidc/account-redirect.js";
import { normalizeClientCallbackUrl } from "../../src/oidc/client-callback-url.js";
import { loadAuthRequestInfo } from "../../src/oidc/auth-request-info.js";
import { finalizeAuthRequest } from "../../src/oidc/session.js";
import {
  CONNECT_SESSION_COOKIE,
  clearConnectSessionCookieOptions,
  readOptionalConnectSession,
} from "../../src/oidc/connect-session.js";
import {
  buildOidcErrorRedirect,
  hasPrompt,
  resolveLoginRoute,
} from "../../src/oidc/prompt-flow.js";
import {
  LOGIN_TRANSACTION_COOKIE,
  readLoginTransactionFromCookie,
} from "../../src/oidc/transaction.js";
import { getAccountPublicUrl, getPublicAppUrl, isPasswordLoginFallbackEnabled } from "../../src/config/env.js";
import { detectLocaleFromHeaders, getDictionary, resolveLocale } from "../../src/ui/i18n/index.js";

function isNextRedirect(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

export default async function LoginPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const authRequestId =
    typeof resolvedSearchParams?.authRequest === "string"
      ? resolvedSearchParams.authRequest
      : typeof resolvedSearchParams?.authRequestID === "string"
        ? resolvedSearchParams.authRequestID
        : "";
  const tx = typeof resolvedSearchParams?.tx === "string" ? resolvedSearchParams.tx : "";
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = resolveLocale(resolvedSearchParams?.locale) || detectLocaleFromHeaders(headerStore);
  const dictionary = getDictionary(locale);
  const passwordFallbackEnabled = isPasswordLoginFallbackEnabled();
  const accountBaseUrl = getAccountPublicUrl();

  if (authRequestId) {
    const authRequestInfo = await loadAuthRequestInfo(authRequestId);
    if (authRequestInfo.lookupError === "expired") {
      redirect(buildAccountLoginUrl(authRequestId));
    }

    const accountAvailable = await isAccountCenterAvailable();
    if (!accountAvailable) {
      const staleConnect = readOptionalConnectSession(cookieStore.get(CONNECT_SESSION_COOKIE)?.value);
      if (staleConnect) {
        cookieStore.set(
          CONNECT_SESSION_COOKIE,
          "",
          clearConnectSessionCookieOptions(`${getPublicAppUrl()}/login`)
        );
      }
      return (
        <ConnectServiceUnavailablePage
          reason="account_center"
          authRequestInfo={authRequestInfo}
          locale={locale}
        />
      );
    }

    const connectSession = readOptionalConnectSession(cookieStore.get(CONNECT_SESSION_COOKIE)?.value);
    const route = resolveLoginRoute({
      hasConnectSso: Boolean(connectSession?.sessionId),
      prompt: authRequestInfo.prompt,
      passwordFallbackEnabled,
    });

    if (route.clearSso) {
      cookieStore.set(CONNECT_SESSION_COOKIE, "", clearConnectSessionCookieOptions(`${getPublicAppUrl()}/login`));
    }

    if (route.type === "login_required") {
      const callbackUrl = buildOidcErrorRedirect({
        redirectUri: authRequestInfo.redirectUri,
        state: authRequestInfo.state,
        error: "login_required",
        errorDescription: "No active Connect session is available.",
      });
      if (callbackUrl) {
        redirect(callbackUrl);
      }
    }

    if (route.type === "redirect_account") {
      redirect(
        buildAccountLoginUrl(authRequestId, {
          requireLogin: hasPrompt(authRequestInfo.prompt, "login"),
        })
      );
    }

    if (route.type === "consent" && connectSession) {
      if (!route.forceConsent) {
        const sub = connectSession.sub || connectSession.loginName;
        if (sub && authRequestInfo.clientId) {
          try {
            const granted = await checkAuthorizedAppFromAccount({
              sub,
              clientId: authRequestInfo.clientId,
              scopes: authRequestInfo.scopes,
            });
            if (granted) {
              const finalized = await finalizeAuthRequest({
                authRequestId,
                sessionId: connectSession.sessionId,
                sessionToken: connectSession.sessionToken,
              });
              redirect(normalizeClientCallbackUrl(finalized.callbackUrl, authRequestInfo));
            }
          } catch (error) {
            if (isNextRedirect(error)) {
              throw error;
            }
            cookieStore.set(
              CONNECT_SESSION_COOKIE,
              "",
              clearConnectSessionCookieOptions(`${getPublicAppUrl()}/login`)
            );
            return (
              <ConnectServiceUnavailablePage
                reason={
                  (await isAccountCenterAvailable()) ? "authorized_apps" : "account_center"
                }
                authRequestInfo={authRequestInfo}
                locale={locale}
              />
            );
          }
        }
      }

      return (
        <ConnectConsentPage
          authRequestId={authRequestId}
          authRequestInfo={authRequestInfo}
          ssoUser={{
            loginName: connectSession.loginName,
            email: connectSession.email,
            sub: connectSession.sub,
          }}
          locale={locale}
          accountBaseUrl={accountBaseUrl}
        />
      );
    }

    if (route.type === "password_fallback") {
      const existingSession = connectSession
        ? { loginName: connectSession.loginName || null }
        : null;
      return (
        <ConnectLoginPage
          authRequestId={authRequestId}
          authRequestInfo={authRequestInfo}
          existingSession={existingSession}
          locale={locale}
          passwordFallbackEnabled
          accountBaseUrl={accountBaseUrl}
        />
      );
    }

    redirect(buildAccountLoginUrl(authRequestId));
  }

  if (!tx) {
    return <ConnectLoginPage locale={locale} passwordFallbackEnabled={passwordFallbackEnabled} accountBaseUrl={accountBaseUrl} />;
  }

  try {
    const transaction = readLoginTransactionFromCookie(cookieStore.get(LOGIN_TRANSACTION_COOKIE)?.value, tx);
    return <ConnectLoginPage transaction={transaction} locale={locale} passwordFallbackEnabled={passwordFallbackEnabled} accountBaseUrl={accountBaseUrl} />;
  } catch {
    return <ConnectLoginPage transactionError={dictionary.alerts.authRequestExpired} locale={locale} passwordFallbackEnabled={passwordFallbackEnabled} accountBaseUrl={accountBaseUrl} />;
  }
}
