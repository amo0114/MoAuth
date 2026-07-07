"use client";

import { useState } from "react";

import { getAccountPublicErrorMessage } from "./account-public-error-message.js";

export function AccountForgotPasswordPage({ authRequestId = "" }) {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({ tone: "danger", message: getAccountPublicErrorMessage(data?.error?.code, "forgotPassword") });
        return;
      }

      let message = data.message || "如果该邮箱已注册，我们已发送密码重置说明。";
      if (data.dev?.verificationCode) {
        message += ` 开发模式验证码：${data.dev.verificationCode}`;
      }
      setNotice({ tone: "info", message });
    } catch {
      setNotice({ tone: "danger", message: getAccountPublicErrorMessage(null, "forgotPassword") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="account-shell">
      <section className="account-card">
        <h1 className="account-brand">找回密码</h1>
        <p className="account-subtitle">输入注册邮箱，我们将发送密码重置说明。</p>

        {notice ? (
          <div className="account-notice" data-tone={notice.tone}>
            {notice.message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="account-field">
            <label htmlFor="forgot-email">邮箱</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="account-actions">
            <button className="account-button" type="submit" disabled={submitting}>
              {submitting ? "发送中…" : "发送重置说明"}
            </button>
          </div>
        </form>

        <div className="account-links">
          <a href={buildAuthHref("/login", authRequestId)}>返回登录</a>
          <a href={buildAuthHref("/reset-password", authRequestId)}>已有验证码</a>
        </div>
      </section>
    </main>
  );
}

function buildAuthHref(pathname, authRequestId) {
  if (!authRequestId) return pathname;
  return `${pathname}?auth_request=${encodeURIComponent(authRequestId)}`;
}
