"use client";

import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  Fingerprint,
  Key,
  Lock,
  Network,
  ShieldAlert,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import { identityBrand } from "../config/brand.js";

export function ConnectLoginPage({ transaction = null, transactionError = null, authRequestId = null, authRequestInfo = null, existingSession = null } = {}) {
  const appName = transaction?.clientDisplayName || authRequestInfo?.clientDisplayName || "当前应用";
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
      setInfo("请先填写账号和密码", hasChallenge ? "提交后会发往 Connect 后端调用 Zitadel Session API。" : "请从应用入口进入登录，以携带 authRequest。", "warning");
      return;
    }

    if (!hasChallenge) {
      setInfo(
        "缺少登录请求上下文",
        "请从目标应用重新进入登录。Connect 登录页需要 Zitadel 颁发的 authRequest 才能继续。",
        "warning"
      );
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
        const message = data?.error?.message || "登录失败，请稍后重试。";
        setInfo(loginErrorTitle(code), message, "warning");
        return;
      }

      if (data.status === "AUTH_REQUEST_FINALIZED" && data.callbackUrl) {
        window.location.assign(data.callbackUrl);
        return;
      }

      if (data.status === "SESSION_CREATED_PENDING_FINALIZE") {
        setInfo("需要继续完成登录策略", data.message || "会话已建立，但还需补齐 MFA/Passkey 等策略后才能继续回调。", "info");
        return;
      }

      setInfo("登录未完成", "后端返回了未识别的登录响应，请联系管理员。", "warning");
    } catch (cause) {
      setInfo("网络错误", `无法连接 Connect 后端：${String(cause?.message || cause)}`, "warning");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePasskey() {
    setShowMoreMethods(false);
    setShowAccountPicker(false);
    setInfo(
      "Passkey 尚未启用",
      hasChallenge
        ? "Passkey 流程将复用当前 authRequest，通过 Zitadel Session API 的 WebAuthn challenge 接入。"
        : `需要先冻结 ${identityBrand.publicDomain} 的 WebAuthn RP ID，并接入 Zitadel Session API 后再开启。`
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
        setInfo(loginErrorTitle(code), data?.error?.message || "无法继续当前会话，请重新登录。", "warning");
        return;
      }
      if (data.status === "AUTH_REQUEST_FINALIZED" && data.callbackUrl) {
        window.location.assign(data.callbackUrl);
        return;
      }
      setInfo("无法继续会话", "后端返回了未识别的响应，请重新登录。", "warning");
    } catch (cause) {
      setInfo("网络错误", `无法连接 Connect 后端：${String(cause?.message || cause)}`, "warning");
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
          "已检测到当前浏览器会话",
          `上次登录的账号 ${data.loginName ? `（${data.loginName}）` : ""} 仍可继续使用。账号选择 UI 将在后续接入。`,
          "info"
        );
      } else {
        setInfo("当前没有可继续使用的账号", `接入 ${identityBrand.gatewayName} session 后，这里会列出已登录账号，并支持一键继续或切换账号。`);
      }
    } catch {
      setInfo("无法读取当前会话", "Connect 后端不可达，请稍后再试。", "warning");
    }
  }

  function handleMoreMethods() {
    setShowMoreMethods((current) => !current);
    setShowAccountPicker(false);
    setInfo("更多登录方式", "邮箱验证码、企业 SSO 和恢复码会作为后续登录方式接入。");
  }

  return (
    <main className="connect-shell">
      <div className="identity-vault">
        <section className="identity-panel">
          <a className="brand-lockup" href="/">
            <span className="brand-mark">
              <BrandGlyph />
            </span>
            <span className="brand-name">{identityBrand.productName}</span>
          </a>

          <div className="identity-copy">
            <h1>
              统一身份，
              <br />
              <span>进入已接入应用。</span>
            </h1>
            <p>每次登录前都清楚展示目标应用和授权范围。{identityBrand.productName} 负责身份验证与会话衔接，业务权限和数据仍由各应用自己管理。</p>
          </div>

          <div className="feature-list" aria-label={`${identityBrand.productName} capabilities`}>
            <FeatureItem icon={<ShieldAlert aria-hidden="true" />} title="看清目标应用">
              登录页会显示即将进入的应用和请求范围，降低误点或钓鱼页面风险。
            </FeatureItem>
            <FeatureItem icon={<Fingerprint aria-hidden="true" />} title="少建一套登录">
              应用通过 OIDC + PKCE 接入统一账号，密码、Passkey 和 MFA 策略在身份层集中配置。
            </FeatureItem>
            <FeatureItem icon={<Network aria-hidden="true" />} title="边界留在正确位置">
              身份、授权请求和本地业务权限分层处理，后续接入新系统不必改造核心登录逻辑。
            </FeatureItem>
          </div>

          <div className="system-status">
            <span className="status-dot" aria-hidden="true" />
            <span>身份网关运行中</span>
          </div>
        </section>

        <section className="login-panel" aria-label="Sign in">
          <div className="login-form-shell">
            <div className="login-header">
              <h2>登录 {identityBrand.productName}</h2>
              <p>{hasChallenge ? `继续完成身份验证以进入 ${appName}。` : hasTransaction ? `继续访问 ${appName} 前，请先验证你的账号。` : "请从目标应用进入登录。"}</p>
              {transaction ? (
                <div className="request-summary">
                  <ShieldCheck aria-hidden="true" />
                  <span>
                    {transaction.clientDisplayName} 请求访问：{scopeLabel(transaction.scopes)}
                  </span>
                </div>
              ) : null}
              {hasAuthRequestInfo ? (
                <div className="request-summary">
                  <ShieldCheck aria-hidden="true" />
                  <span>
                    {authRequestInfo.clientDisplayName} 请求访问：{scopeLabel(authRequestInfo.scopes)}
                  </span>
                </div>
              ) : null}
              {authRequestExpired ? (
                <div className="transaction-alert">这次登录请求已失效，请从目标应用重新进入登录。</div>
              ) : null}
              {transactionError ? <div className="transaction-alert">{transactionError}</div> : null}
              {!hasChallenge && !hasTransaction ? (
                <div className="transaction-alert">缺少 Zitadel 颁发的 authRequest。请回到目标应用，从登录入口重新发起。</div>
              ) : null}
            </div>

            <form className="login-body" onSubmit={handleSubmit}>
              {hasExistingSession ? (
                <div className="continue-card" role="status" aria-live="polite">
                  <div className="continue-card-heading">
                    <span className="continue-avatar" aria-hidden="true">
                      {existingSession.loginName.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="continue-card-text">
                      <strong>以 {existingSession.loginName} 继续</strong>
                      <span>上次会话仍未过期，可直接进入 {appName}。</span>
                    </div>
                  </div>
                  <div className="continue-card-actions">
                    <button
                      className="primary-action"
                      type="button"
                      onClick={handleContinue}
                      disabled={continuing}
                      aria-disabled={continuing}
                    >
                      <span>{continuing ? "继续中…" : "继续进入"}</span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                    <button
                      className="text-action"
                      type="button"
                      onClick={() => setInfo("已切换账号", "请输入其他账号的邮箱/用户名和密码继续登录。")}
                    >
                      使用其他账号
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="field">
                <label htmlFor="login-name">邮箱或用户名</label>
                <div className="input-row">
                  <User aria-hidden="true" />
                  <input
                    id="login-name"
                    name="login-name"
                    autoComplete="username"
                    placeholder="name@example.com"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <div className="field-heading">
                  <label htmlFor="login-password">密码</label>
                  <button className="text-action subtle" type="button" onClick={() => setInfo("密码找回待接入", `下一步会接入 ${identityBrand.accountName} 的密码找回与邮箱验证流程。`)}>
                    忘记密码?
                  </button>
                </div>
                <div className="input-row">
                  <Key aria-hidden="true" />
                  <input
                    id="login-password"
                    name="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button className="icon-action" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="form-options">
                <label className="checkbox-row">
                  <input type="checkbox" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} />
                  <span>在这台设备上保持登录</span>
                </label>
              </div>

              {notice ? (
                <div className={`action-notice ${notice.tone}`} role="status" aria-live="polite">
                  <strong>{notice.title}</strong>
                  <span>{notice.message}</span>
                </div>
              ) : null}

              {showAccountPicker ? (
                <div className="inline-panel">
                  <strong>当前没有可继续使用的账号</strong>
                  <span>接入 {identityBrand.gatewayName} session 后，这里会列出已登录账号，并支持一键继续或切换账号。</span>
                </div>
              ) : null}

              {showMoreMethods ? (
                <div className="method-panel">
                  <button type="button" onClick={() => setInfo("邮箱验证码待接入", `验证码登录会复用 ${identityBrand.accountName} 的邮箱验证能力。`)}>
                    邮箱验证码
                  </button>
                  <button type="button" onClick={() => setInfo("企业 SSO 待接入", "企业组织 SSO 会作为客户端策略配置进入后续阶段。")}>
                    企业 SSO
                  </button>
                  <button type="button" onClick={() => setInfo("恢复码待接入", "恢复码适合 MFA 兜底场景，会在账号安全模块中实现。")}>
                    恢复码
                  </button>
                </div>
              ) : null}

              <button
                className="primary-action"
                type="submit"
                disabled={submitting || !hasChallenge}
                aria-disabled={submitting || !hasChallenge}
              >
                <span>{submitting ? "验证中…" : "验证并继续"}</span>
                <ArrowRight aria-hidden="true" />
              </button>

              <div className="divider">
                <span>OR</span>
              </div>

              <div className="alternate-actions">
                <button className="secondary-action" type="button" onClick={handlePasskey}>
                  <PasskeyGlyph />
                  使用 Passkey 登录
                </button>
                <button className="sso-action" type="button" onClick={handleMoreMethods}>
                  更多登录方式
                  <ChevronDown aria-hidden="true" />
                </button>
              </div>

              <div className="account-row">
                <button className="text-action" type="button" onClick={handleAccountPicker}>
                  选择账号
                </button>
                <span>还没有账号？</span>
                <button className="text-action" type="button" onClick={() => setInfo("创建账号待接入", `注册入口会接入 ${identityBrand.accountName} 的注册、邮箱验证与资料初始化流程。`)}>
                  <UserPlus aria-hidden="true" />
                  创建账号
                </button>
              </div>
            </form>

            <div className="login-footer">
              <Lock aria-hidden="true" />
              <span>加密连接，请确认当前域名</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function BrandGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  );
}

function PasskeyGlyph() {
  return (
    <svg className="passkey-glyph" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#161616" />
      <path d="M15.54 11c-.11-1.13-.73-2.05-1.62-2.56-.52-.3-1.16-.43-1.78-.43h-.31v7.71c0 .1.08.19.19.19h.12c.97 0 1.83-.47 2.4-1.25.57-.79.85-1.79.8-2.78.03-.29.09-.59.2-.88Z" fill="white" />
      <path d="M8.46 8.01h1.22c.1 0 .19.08.19.19v7.52c0 .1-.09.19-.19.19H8.46a.19.19 0 0 1-.18-.19V8.2c0-.1.08-.19.18-.19Z" fill="white" />
    </svg>
  );
}

function FeatureItem({ icon, title, children }) {
  return (
    <div className="feature-item">
      <span className="feature-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{children}</small>
      </span>
    </div>
  );
}

function scopeLabel(scopes = []) {
  const labels = [];
  if (scopes.includes("profile")) labels.push("基础资料");
  if (scopes.includes("email")) labels.push("邮箱");
  return labels.length ? labels.join("、") : "账号身份";
}

function loginErrorTitle(code) {
  if (code === "ZITADEL_NOT_CONFIGURED") return "身份核心未配置";
  if (code === "ZITADEL_AUTH_REQUEST_NOT_FOUND") return "登录请求已失效";
  if (code === "ZITADEL_AUTH_REQUEST_NOT_READY") return "需继续完成登录策略";
  if (code === "ZITADEL_SESSION_NOT_CREATED" || code === "ZITADEL_REQUEST_FAILED") return "账号或密码不正确";
  if (code === "ZITADEL_UNAUTHORIZED") return "身份核心拒绝服务账号";
  if (code === "LOGIN_CREDENTIALS_REQUIRED") return "请填写账号和密码";
  if (code === "ZITADEL_NOT_CONFIGURED") return "身份核心未配置";
  return "登录失败";
}
