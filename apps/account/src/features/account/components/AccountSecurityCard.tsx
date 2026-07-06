export function AccountSecurityCard() {
  return (
    <article className="account-panel">
      <h3>安全状态</h3>
      <ul className="account-status-list">
        <li>
          <span>密码</span>
          <strong>已设置</strong>
        </li>
        <li>
          <span>多因素认证</span>
          <strong className="is-muted">管理入口已开放</strong>
        </li>
        <li>
          <span>Passkey</span>
          <strong className="is-muted">管理入口已开放</strong>
        </li>
      </ul>
    </article>
  );
}
