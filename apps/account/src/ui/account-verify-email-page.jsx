"use client";

import { useState } from "react";

import { getAccountPublicErrorMessage } from "./account-public-error-message.js";

export function AccountVerifyEmailPage({ userId = "", authRequestId = "", initialCode = "" }) {
  const [verificationCode, setVerificationCode] = useState(initialCode);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/email/verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, verificationCode: verificationCode.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({ tone: "danger", message: getAccountPublicErrorMessage(data?.error?.code, "verifyEmail") });
        return;
      }

      const loginHref = buildAuthHref("/login", authRequestId);
      window.location.assign(`${loginHref}${loginHref.includes("?") ? "&" : "?"}registered=1`);
    } catch {
      setNotice({ tone: "danger", message: getAccountPublicErrorMessage(null, "verifyEmail") });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/email/verify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({ tone: "danger", message: getAccountPublicErrorMessage(data?.error?.code, "resendVerification") });
        return;
      }
      let message = "验证邮件已重新发送。";
      if (data.dev?.emailVerificationCode) {
        message += ` 开发模式验证码：${data.dev.emailVerificationCode}`;
        setVerificationCode(data.dev.emailVerificationCode);
      }
      setNotice({ tone: "info", message });
    } catch {
      setNotice({ tone: "danger", message: getAccountPublicErrorMessage(null, "resendVerification") });
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="account-shell">
      <section className="account-card">
        <h1 className="account-brand">验证邮箱</h1>
        <p className="account-subtitle">请输入邮件中的验证码以完成注册。</p>

        {notice ? (
          <div className="account-notice" data-tone={notice.tone}>
            {notice.message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="account-field">
            <label htmlFor="verify-code">验证码</label>
            <input
              id="verify-code"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              required
            />
          </div>

          <div className="account-actions">
            <button className="account-button" type="submit" disabled={submitting || !userId}>
              {submitting ? "验证中…" : "完成验证"}
            </button>
            <button className="account-button account-button-secondary" type="button" onClick={handleResend} disabled={resending || !userId}>
              {resending ? "发送中…" : "重新发送验证码"}
            </button>
          </div>
        </form>

        <div className="account-links">
          <a href={buildAuthHref("/login", authRequestId)}>返回登录</a>
        </div>
      </section>
    </main>
  );
}

function buildAuthHref(pathname, authRequestId) {
  if (!authRequestId) return pathname;
  return `${pathname}?auth_request=${encodeURIComponent(authRequestId)}`;
}
