"use client";

import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Fingerprint,
  Mail,
  Rocket,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { identityBrand } from "../config/brand.js";
import { getDictionary } from "./i18n/index.js";
import { buildAccountUrl } from "./connect-urls.js";

export function ConnectConsentPage({
  authRequestId,
  authRequestInfo,
  ssoUser,
  locale = "zh-CN",
  accountBaseUrl = identityBrand.accountBaseUrl,
}) {
  const t = getDictionary(locale);
  const appName = authRequestInfo?.clientDisplayName || t.login.currentAppFallback;
  const scopeItems = getScopeItems(authRequestInfo?.scopes || [], t);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  async function handleConsent(action) {
    if (!authRequestId) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/consent", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authRequest: authRequestId, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorCode = data?.error?.code || "";
        if (
          errorCode === "CONNECT_SESSION_REQUIRED" ||
          errorCode === "CONNECT_SESSION_INVALID"
        ) {
          window.location.assign(buildAccountUrl("/login", authRequestId, { accountBaseUrl }));
          return;
        }
        if (errorCode === "ACCOUNT_CENTER_UNAVAILABLE") {
          window.location.reload();
          return;
        }
        setNotice({
          tone: "warning",
          message: data?.error?.message || t.consent.errors.default,
        });
        setSubmitting(false);
        return;
      }
      if (data.callbackUrl) {
        window.location.assign(data.callbackUrl);
        return;
      }
      setNotice({
        tone: "warning",
        message: t.consent.errors.default,
      });
    } catch (cause) {
      setNotice({
        tone: "warning",
        message: t.notices.networkError.body(String(cause?.message || cause)),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSwitchAccount() {
    await fetch("/api/login", { method: "DELETE" }).catch(() => {});
    window.location.assign(buildAccountUrl("/login", authRequestId, { accountBaseUrl, requireLogin: true }));
  }

  const displayName = ssoUser?.loginName || ssoUser?.email || t.consent.unknownUser;
  const displayEmail = ssoUser?.email || "";

  return (
    <main className="connect-shell connect-shell--consent">
      <div className="consent-backdrop" aria-hidden="true">
        <div className="consent-blob consent-blob--blue" />
        <div className="consent-blob consent-blob--warm" />
      </div>

      <section
        className={`connect-card connect-card--consent${submitting ? " is-submitting" : ""}`}
        aria-label={t.consent.aria.card}
      >
        {submitting ? (
          <ConsentSubmittingOverlay appName={appName} message={t.consent.allowing} />
        ) : null}

        <div className={`consent-body${submitting ? " consent-body--hidden" : ""}`}>
          <div className="connection-rail" aria-label={t.aria.identityFlow(appName, identityBrand.productName)}>
            <IdentityNode kind="app" label={appName} />
            <div className="flow-bridge" aria-hidden="true">
              <span />
              <BadgeCheck />
              <span />
            </div>
            <IdentityNode kind="brand" label={identityBrand.productName} />
          </div>

          <header className="auth-heading consent-heading">
            <span className="consent-mark" aria-hidden="true">
              <Fingerprint />
            </span>
            <h1>{t.consent.title(appName)}</h1>
            <p>{t.consent.subtitle(identityBrand.productName)}</p>
          </header>

          <section className="continue-card consent-user-card" aria-label={t.consent.aria.currentUser}>
            <div className="continue-card-heading">
              <span className="continue-avatar consent-avatar" aria-hidden="true">
                {displayName.slice(0, 1).toUpperCase()}
              </span>
              <div className="continue-card-text">
                <strong>{displayName}</strong>
                {displayEmail ? <span>{displayEmail}</span> : null}
              </div>
            </div>
          </section>

          <section className="scope-panel consent-scope-panel" aria-label={t.aria.requestedScopes}>
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

          {notice ? (
            <div className={`action-notice consent-notice ${notice.tone}`} role="status" aria-live="polite">
              <span>{notice.message}</span>
            </div>
          ) : null}

          <div className="consent-actions consent-actions--polished">
            <button
              className="primary-action consent-primary"
              type="button"
              disabled={submitting}
              onClick={() => handleConsent("allow")}
            >
              <span>{t.consent.allow}</span>
              <ArrowRight aria-hidden="true" />
            </button>
            <div className="consent-secondary-row">
              <button
                className="consent-ghost-action"
                type="button"
                disabled={submitting}
                onClick={() => handleConsent("deny")}
              >
                {t.consent.deny}
              </button>
              <button className="text-action consent-switch" type="button" onClick={handleSwitchAccount}>
                {t.consent.switchAccount}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ConsentSubmittingOverlay({ appName, message }) {
  return (
    <div className="consent-submitting" role="status" aria-live="polite" aria-busy="true">
      <div className="consent-submitting-visual">
        <span className="consent-ripple consent-ripple--1" />
        <span className="consent-ripple consent-ripple--2" />
        <span className="consent-ripple consent-ripple--3" />
        <span className="consent-orbit consent-orbit--forward">
          <span className="consent-orbit-dot" />
        </span>
        <span className="consent-orbit consent-orbit--reverse">
          <span className="consent-orbit-dot consent-orbit-dot--small" />
        </span>
        <div className="consent-submitting-core">
          <ShieldCheck aria-hidden="true" />
        </div>
      </div>
      <p className="consent-submitting-title">{message}</p>
      <p className="consent-submitting-subtitle">正在连接至 {appName}</p>
      <div className="consent-progress" aria-hidden="true">
        <span className="consent-progress-bar" />
      </div>
    </div>
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
