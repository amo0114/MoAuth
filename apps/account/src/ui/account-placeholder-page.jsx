import Link from "next/link";

export function AccountPlaceholderPage({ title, description, authRequestId = "", backHref = "/login" }) {
  const loginHref = authRequestId ? `${backHref}?auth_request=${encodeURIComponent(authRequestId)}` : backHref;

  return (
    <main className="account-shell">
      <section className="account-card">
        <h1 className="account-brand">{title}</h1>
        <p className="account-placeholder">{description}</p>
        <div className="account-actions">
          <Link className="account-button" href={loginHref} style={{ textAlign: "center", display: "block" }}>
            返回登录
          </Link>
        </div>
      </section>
    </main>
  );
}