import { AccountUser } from "../types";

export function AccountProfileCard({ user }: { user: AccountUser }) {
  return (
    <article className="account-panel">
      <h3>账号信息</h3>
      <dl className="account-kv">
        <div>
          <dt>用户名</dt>
          <dd>{user.loginName}</dd>
        </div>
        <div>
          <dt>邮箱</dt>
          <dd>{user.email || "—"}</dd>
        </div>
        <div>
          <dt>邮箱验证</dt>
          <dd>{user.emailVerified ? "已验证" : "未验证"}</dd>
        </div>
        <div>
          <dt>用户 ID</dt>
          <dd className="account-mono">{user.sub}</dd>
        </div>
      </dl>
    </article>
  );
}
