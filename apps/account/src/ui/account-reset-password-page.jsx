"use client";

import { useState } from "react";

export function AccountResetPasswordPage({ authRequestId = "" }) {
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          verificationCode: verificationCode.trim(),
          newPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message || "重置失败，请重试。");
      }

      const loginHref = buildAuthHref("/login", authRequestId);
      window.location.assign(`${loginHref}${loginHref.includes("?") ? "&" : "?"}reset=1`);
    } catch (error) {
      setNotice({ tone: "danger", message: String(error.message || error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="account-shell">
      <section className="account-card">
        <h1 className="account-brand">设置新密码</h1>
        <p className="account-subtitle">输入邮箱、验证码和新密码完成重置。</p>

        {notice ? (
          <div className="account-notice" data-tone={notice.tone}>
            {notice.message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="account-field">
            <label htmlFor="reset-email">邮箱</label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="account-field">
            <label htmlFor="reset-code">验证码</label>
            <input
              id="reset-code"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              required
            />
          </div>

          <div className="account-field">
            <label htmlFor="reset-password">新密码</label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>

          <div className="account-actions">
            <button className="account-button" type="submit" disabled={submitting}>
              {submitting ? "保存中…" : "更新密码"}
            </button>
          </div>
        </form>

        <div className="account-links">
          <a href={buildAuthHref("/forgot-password", authRequestId)}>重新获取验证码</a>
        </div>
      </section>
    </main>
  );
}

function buildAuthHref(pathname, authRequestId) {
  if (!authRequestId) return pathname;
  return `${pathname}?auth_request=${encodeURIComponent(authRequestId)}`;
}