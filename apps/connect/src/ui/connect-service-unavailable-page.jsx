"use client";

import { ArrowRight } from "lucide-react";
import { identityBrand } from "../config/brand.js";
import { getDictionary } from "./i18n/index.js";

export function ConnectServiceUnavailablePage({
  reason = "account_center",
  authRequestInfo = null,
  locale = "zh-CN",
}) {
  const t = getDictionary(locale);
  const copy = t.unavailable[reason] || t.unavailable.accountCenter;
  const appName = authRequestInfo?.clientDisplayName || t.login.currentAppFallback;

  function handleRetry() {
    window.location.reload();
  }

  const flowSteps = [
    { key: "app", label: appName, state: copy.flow.app, status: "waiting" },
    { key: "connect", label: identityBrand.gatewayName, state: copy.flow.connect, status: "ok" },
    {
      key: "account",
      label: copy.flow.accountRole(identityBrand.accountName),
      state: copy.flow.account,
      status: "fault",
    },
  ];

  return (
    <main className="connect-shell connect-shell--unavailable">
      <section className="connect-card connect-card--unavailable" aria-label={copy.ariaCard}>
        <div className="unavailable-meta-bar" role="status">
          <span className="unavailable-code">{copy.statusCode}</span>
          <span className="unavailable-meta-divider" aria-hidden="true" />
          <span className="unavailable-meta-label">{copy.statusLabel}</span>
        </div>

        <ol className="unavailable-flow" aria-label={copy.flow.aria}>
          {flowSteps.map((step, index) => (
            <li
              key={step.key}
              className={`unavailable-flow-step unavailable-flow-step--${step.status}${
                index < flowSteps.length - 1 ? " unavailable-flow-step--linked" : ""
              }`}
            >
              <span className="unavailable-flow-marker" aria-hidden="true" />
              <div className="unavailable-flow-copy">
                <span className="unavailable-flow-name">{step.label}</span>
                <span className="unavailable-flow-state">{step.state}</span>
              </div>
            </li>
          ))}
        </ol>

        <header className="auth-heading unavailable-heading">
          <h1>{copy.title}</h1>
          <p>{copy.body(identityBrand.accountName)}</p>
        </header>

        <aside className="unavailable-note" role="note">
          <p>{copy.hint}</p>
        </aside>

        <div className="unavailable-actions">
          <button className="primary-action unavailable-retry" type="button" onClick={handleRetry}>
            <span>{copy.retry}</span>
            <ArrowRight aria-hidden="true" />
          </button>
        </div>

        <footer className="unavailable-footer">
          <span>{identityBrand.gatewayName}</span>
          <span aria-hidden="true">·</span>
          <span>{identityBrand.productName}</span>
        </footer>
      </section>
    </main>
  );
}