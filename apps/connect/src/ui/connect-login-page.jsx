"use client";

import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  CircleUserRound,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Languages,
  Mail,
  MoreHorizontal,
  Rocket,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { identityBrand } from "../config/brand.js";
import { getDictionary } from "./i18n/index.js";
import { buildAccountUrl } from "./connect-urls.js";

export function ConnectLoginPage({
  transaction = null,
  transactionError = null,
  authRequestId = null,
  authRequestInfo = null,
  existingSession = null,
  locale = "zh-CN",
  passwordFallbackEnabled = false,
  accountBaseUrl = identityBrand.accountBaseUrl,
} = {}) {
  const t = getDictionary(locale);
  const appName = transaction?.clientDisplayName || authRequestInfo?.clientDisplayName || t.login.currentAppFallback;
  const scopes = transaction?.scopes || authRequestInfo?.scopes || [];
  const scopeItems = getScopeItems(scopes, t);
  const hasTransaction = Boolean(transaction);
  const hasChallenge = Boolean(authRequestId);
  const hasAuthRequestInfo = Boolean(authRequestInfo && authRequestInfo.clientDisplayName);
  const authRequestExpired = authRequestInfo?.lookupError === "expired";
  const hasExistingSession = Boolean(existingSession && existingSession.loginName && hasChallenge);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showMoreMethods, setShowMoreMethods] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [continuing, setContinuing] = useState(false);

  function setInfo(title, message, tone = "info") {
    setNotice({ title, message, tone });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setShowMoreMethods(false);
    setShowAccountPicker(false);

    if (!identifier.trim() || !password.trim()) {
      setInfo(
        t.notices.credentialsRequired.title,
        hasChallenge ? t.notices.credentialsRequired.bodyChallenge : t.notices.credentialsRequired.bodyNoChallenge,
        "warning"
      );
      return;
    }

    if (!hasChallenge) {
      setInfo(t.alerts.missingContext, t.alerts.missingContextBody, "warning");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authRequest: authRequestId,
          loginName: identifier.trim(),
          password,
          rememberSession,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const code = data?.error?.code || "LOGIN_UNKNOWN";
        const message = data?.error?.message || t.errorMessages.ZITADEL_REQUEST_FAILED;
        setInfo(loginErrorTitle(code, t), message, "warning");
        return;
      }

      if (data.status === "AUTH_REQUEST_FINALIZED" && data.callbackUrl) {
        window.location.assign(data.callbackUrl);
        return;
      }

      if (data.status === "SESSION_CREATED_PENDING_FINALIZE") {
        setInfo(
          t.notices.sessionPendingFinalize.title,
          data.message || t.notices.sessionPendingFinalize.body,
          "info"
        );
        return;
      }

      setInfo(t.notices.unrecognizedResponse.title, t.notices.unrecognizedResponse.body, "warning");
    } catch (cause) {
      setInfo(t.notices.networkError.title, t.notices.networkError.body(String(cause?.message || cause)), "warning");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePasskey() {
    setShowMoreMethods(false);
    setShowAccountPicker(false);
    setInfo(
      t.notices.passkeyDisabled.title,
      hasChallenge
        ? t.notices.passkeyDisabled.bodyChallenge
        : t.notices.passkeyDisabled.bodyNoChallenge(identityBrand.publicDomain)
    );
  }

  async function handleContinue() {
    if (!hasExistingSession || !authRequestId) return;
    setContinuing(true);
    setShowMoreMethods(false);
    setShowAccountPicker(false);
    try {
      const response = await fetch("/api/login/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authRequest: authRequestId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = data?.error?.code || "LOGIN_UNKNOWN";
        setInfo(loginErrorTitle(code, t), data?.error?.message || t.notices.sessionContinueFallback, "warning");
        return;
      }
      if (data.status === "AUTH_REQUEST_FINALIZED" && data.callbackUrl) {
        window.location.assign(data.callbackUrl);
        return;
      }
      setInfo(t.notices.sessionContinueFailed.title, t.notices.sessionContinueFailed.body, "warning");
    } catch (cause) {
      setInfo(t.notices.networkError.title, t.notices.networkError.body(String(cause?.message || cause)), "warning");
    } finally {
      setContinuing(false);
    }
  }

  async function handleAccountPicker() {
    setShowAccountPicker((current) => !current);
    setShowMoreMethods(false);
    try {
      const response = await fetch("/api/login", { method: "GET" });
      const data = await response.json().catch(() => ({}));
      if (data.status === "SESSION_ACTIVE") {
        setInfo(
          t.notices.accountPickerActive.title,
          t.notices.accountPickerActive.body(data.loginName || ""),
          "info"
        );
      } else {
        setInfo(
          t.notices.accountPickerEmpty.title,
          t.notices.accountPickerEmpty.body(identityBrand.gatewayName)
        );
      }
    } catch {
      setInfo(t.notices.accountPickerError.title, t.notices.accountPickerError.body, "warning");
    }
  }

  function handleMoreMethods() {
    setShowMoreMethods((current) => !current);
    setShowAccountPicker(false);
    setInfo(t.notices.moreMethods.title, t.notices.moreMethods.body);
  }

  function handleAccountRoute(path, title, message) {
    if (typeof window !== "undefined") {
      window.location.assign(buildAccountUrl(path, authRequestId, { accountBaseUrl }));
      return;
    }
    setInfo(title, message);
  }

  function handleLocaleSwitch() {
    if (typeof window === "undefined") return;
    const nextLocale = locale === "en-US" ? "zh-CN" : "en-US";
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("locale", nextLocale);
    window.location.assign(nextUrl.toString());
  }

  return (
    <main className="connect-shell">
      <section className="connect-card" aria-label={t.aria.loginCard(identityBrand.productName)}>
        <div className="connection-rail" aria-label={t.aria.identityFlow(appName, identityBrand.productName)}>
          <IdentityNode kind="app" label={appName} />
          <div className="flow-bridge" aria-hidden="true">
            <span />
            <BadgeCheck />
            <span />
          </div>
          <IdentityNode kind="brand" label={identityBrand.productName} />
        </div>

        <header className="auth-heading">
          <h1>{hasChallenge || hasTransaction ? t.login.continueTo(appName) : t.login.title(identityBrand.productName)}</h1>
          <p>
            {hasChallenge || hasTransaction
              ? t.login.requestingAccess(appName, identityBrand.productName)
              : t.login.introNoContext}
          </p>
        </header>

        {hasChallenge || hasTransaction || hasAuthRequestInfo ? (
          <section className="scope-panel" aria-label={t.aria.requestedScopes}>
            <p>{t.scopes.allow(appName)}</p>
            <div className="scope-list">
              {scopeItems.map((scope) => (
                <div className="scope-row" key={scope.key}>
                  <span className="scope-icon">
                    {scope.key === "email" ? <Mail aria-hidden="true" /> : null}
                    {scope.key === "profile" ? <UserRound aria-hidden="true" /> : null}
                    {scope.key === "fallback" ? <ShieldCheck aria-hidden="true" /> : null}
                  </span>
                  <span>{scope.label}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {authRequestExpired ? (
          <div className="transaction-alert">{t.alerts.authRequestExpired}</div>
        ) : null}
        {transactionError ? <div className="transaction-alert">{transactionError}</div> : null}
        {!hasChallenge && !hasTransaction ? (
          <div className="transaction-alert">{t.alerts.missingAuthRequest}</div>
        ) : null}

        {!passwordFallbackEnabled && hasChallenge ? (
          <div className="transaction-alert">
            {t.alerts.redirectingToAccount(identityBrand.accountName)}
          </div>
        ) : null}

        <form className="login-body" onSubmit={handleSubmit}>
          {passwordFallbackEnabled && hasExistingSession ? (
            <div className="continue-card" role="status" aria-live="polite">
              <div className="continue-card-heading">
                <span className="continue-avatar" aria-hidden="true">
                  {existingSession.loginName.slice(0, 1).toUpperCase()}
                </span>
                <div className="continue-card-text">
                  <strong>{t.continueCard.heading(existingSession.loginName)}</strong>
                  <span>{t.continueCard.sub(appName)}</span>
                </div>
              </div>
              <div className="continue-card-actions">
                <button
                  className="compact-action"
                  type="button"
                  onClick={handleContinue}
                  disabled={continuing}
                  aria-disabled={continuing}
                >
                  <ArrowRight aria-hidden="true" />
                  <span>{continuing ? t.continueCard.ctaProgress : t.continueCard.cta}</span>
                </button>
                <button
                  className="text-action"
                  type="button"
                  onClick={() => setInfo(t.notices.accountSwitched.title, t.notices.accountSwitched.body)}
                >
                  {t.continueCard.switch}
                </button>
              </div>
            </div>
          ) : null}

          {passwordFallbackEnabled ? (
            <>
              <div className="field-stack">
                <label className="sr-only" htmlFor="login-name">
                  {t.form.identifierLabel}
                </label>
                <div className="input-row">
                  <CircleUserRound aria-hidden="true" />
                  <input
                    id="login-name"
                    name="login-name"
                    autoComplete="username"
                    placeholder={t.form.identifierPlaceholder}
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                  />
                </div>

                <label className="sr-only" htmlFor="login-password">
                  {t.form.passwordLabel}
                </label>
                <div className="input-row">
                  <KeyRound aria-hidden="true" />
                  <input
                    id="login-password"
                    name="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder={t.form.passwordPlaceholder}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    className="icon-action"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? t.form.hidePassword : t.form.showPassword}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="form-options">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(event) => setRememberSession(event.target.checked)}
                  />
                  <span>{t.form.rememberSession}</span>
                </label>
                <button
                  className="text-action"
                  type="button"
                  onClick={() => handleAccountRoute(
                    "/forgot-password",
                    t.notices.passwordRecovery.title,
                    t.notices.passwordRecovery.body(identityBrand.accountName)
                  )}
                >
                  {t.form.forgotPassword}
                </button>
              </div>
            </>
          ) : null}

          {notice ? (
            <div className={`action-notice ${notice.tone}`} role="status" aria-live="polite">
              <strong>{notice.title}</strong>
              <span>{notice.message}</span>
            </div>
          ) : null}

          {showAccountPicker ? (
            <div className="inline-panel">
              <strong>{t.notices.accountPickerEmpty.title}</strong>
              <span>{t.notices.accountPickerEmpty.body(identityBrand.gatewayName)}</span>
            </div>
          ) : null}

          {showMoreMethods ? (
            <div className="method-panel">
              <button
                type="button"
                onClick={() => setInfo(
                  t.notices.emailCode.title,
                  t.notices.emailCode.body(identityBrand.accountName)
                )}
              >
                {t.methods.emailCode}
              </button>
              <button
                type="button"
                onClick={() => setInfo(t.notices.enterpriseSso.title, t.notices.enterpriseSso.body)}
              >
                {t.methods.enterpriseSso}
              </button>
              <button
                type="button"
                onClick={() => setInfo(t.notices.recoveryCode.title, t.notices.recoveryCode.body)}
              >
                {t.methods.recoveryCode}
              </button>
            </div>
          ) : null}

          {passwordFallbackEnabled ? (
            <>
              <button
                className="primary-action"
                type="submit"
                disabled={submitting || !hasChallenge}
                aria-disabled={submitting || !hasChallenge}
              >
                <span>{submitting ? t.form.submitting : t.form.submit}</span>
                <ArrowRight aria-hidden="true" />
              </button>

              <div className="divider">
                <span>{t.form.orDivider}</span>
              </div>

              <div className="alternate-actions">
                <button className="secondary-action" type="button" onClick={handleAccountPicker}>
                  <Users aria-hidden="true" />
                  <span>{t.form.accountPicker}</span>
                </button>
                <button className="secondary-action" type="button" onClick={handlePasskey}>
                  <Fingerprint aria-hidden="true" />
                  <span>{t.form.passkey}</span>
                </button>
                <button className="secondary-action" type="button" onClick={handleMoreMethods}>
                  <MoreHorizontal aria-hidden="true" />
                  <span>{t.form.moreMethods}</span>
                  <ChevronDown aria-hidden="true" />
                </button>
              </div>
            </>
          ) : hasChallenge ? (
            <button
              className="primary-action"
              type="button"
              onClick={() => window.location.assign(buildAccountUrl("/login", authRequestId, { accountBaseUrl }))}
            >
              <span>{t.form.continueAtAccount(identityBrand.accountName)}</span>
              <ArrowRight aria-hidden="true" />
            </button>
          ) : null}

          <div className="account-row">
            <span>{t.form.noAccount}</span>
            <button
              className="text-action"
              type="button"
              onClick={() => handleAccountRoute(
                "/register",
                t.notices.createAccount.title,
                t.notices.createAccount.body(identityBrand.accountName)
              )}
            >
              <UserPlus aria-hidden="true" />
              {t.form.createAccount}
            </button>
          </div>
        </form>
      </section>

      <footer className="connect-footer">
        <span>{t.footer.copyright(identityBrand.productName)}</span>
        <nav aria-label={t.aria.footerNav}>
          <a href="#privacy">{t.footer.privacy}</a>
          <a href="#terms">{t.footer.terms}</a>
          <a href={`mailto:${identityBrand.supportEmail}`}>{t.footer.help}</a>
          <button type="button" onClick={handleLocaleSwitch}>
            <Languages aria-hidden="true" />
            <span>{locale === "en-US" ? "中文" : "English"}</span>
            <ChevronDown aria-hidden="true" />
          </button>
        </nav>
      </footer>
    </main>
  );
}

function IdentityNode({ kind, label }) {
  return (
    <div className="identity-node">
      <span className={`identity-icon ${kind}`}>
        {kind === "brand" ? <BrandGlyph /> : <Rocket aria-hidden="true" />}
      </span>
      <strong>{label}</strong>
    </div>
  );
}

function BrandGlyph() {
  return (
    <svg viewBox="0 0 32 24" fill="none" aria-hidden="true">
      <path d="M2.8 21 8.3 3.3c.28-.87 1.5-.92 1.86-.08L16 16.9 21.84 3.22c.36-.84 1.58-.79 1.86.08L29.2 21h-5.4l-2.16-7.5-3.2 7.5h-4.88l-3.2-7.5L8.2 21H2.8Z" fill="currentColor" />
    </svg>
  );
}

function getScopeItems(scopes = [], t) {
  const dictionary = t || getDictionary("zh-CN");
  const items = [];
  if (scopes.includes("profile")) items.push({ key: "profile", label: dictionary.scopes.profile });
  if (scopes.includes("email")) items.push({ key: "email", label: dictionary.scopes.email });
  if (!items.length) items.push({ key: "fallback", label: dictionary.scopes.fallback });
  return items;
}

function loginErrorTitle(code, t) {
  const dictionary = t || getDictionary("zh-CN");
  return dictionary.errors[code] || dictionary.errors.LOGIN_UNKNOWN;
}
