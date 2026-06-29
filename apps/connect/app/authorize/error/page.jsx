export default function AuthorizeErrorPage({ searchParams }) {
  const code = searchParams?.code || "INVALID_AUTHORIZATION_REQUEST";
  const message = searchParams?.message || "授权请求未通过当前身份服务的合同校验。";

  return (
    <main className="error-shell">
      <section className="error-card">
        <div className="error-code">{code}</div>
        <h1>无法继续授权</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}
