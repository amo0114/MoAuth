# MoAuth Release Readiness（生产上线收尾）

**状态**：2026-07-02
**范围**：Connect-as-Public-Issuer（ADR-010）、OIDC CI 门禁、authorized-apps、浏览器端到端验收。
**原则**：不改变现有登录/授权主流程；仅补充文档、warning 与 release 验收门禁。

---

## 1. 密钥轮换（v1 限制与 v2 设计）

### v1 现状（当前代码）

Connect `production-jwks` **仅支持单把签名密钥**：

| 能力 | v1 |
|------|-----|
| JWKS 公钥数量 | 1（`MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID`） |
| 签名私钥 | 1（inline PEM 或 `PRIVATE_KEY_FILE`） |
| 实现位置 | `apps/connect/src/oidc/connect-jwks.js` |

**v1 限制**：无法在不停机情况下让 JWKS 同时暴露 current + previous 两把公钥；轮换需计划性维护窗口或接受短暂验签失败风险。

### v2 目标（文档设计，待实现）

1. **JWKS 同时暴露 current + previous**
   - `GET /oauth/v2/keys` 返回 `keys: [ currentJwk, previousJwk? ]`
   - 新签发的 `id_token` 仅使用 **current** 私钥与 `kid`
   - 验证方（SubBoost 等）按 header `kid` 在 JWKS 集合中查找公钥

2. **`kid` 不复用**
   - 每次轮换生成新 `kid`（建议：`moauth-connect-YYYYMMDD-N` 或 ULID）
   - **禁止**将旧 `kid` 绑定到新私钥

3. **旧 key 退役时机**
   - previous 私钥/公钥保留在 JWKS 中，直到：
     - 所有由 previous `kid` 签发的 `id_token` 已超过 `exp` + clock skew；且
     - 业务侧 token 缓存/TTL 已清空（建议 ≥ `id_token` 最大 TTL + 24h）
   - 默认 `id_token` TTL 跟随上游 Zitadel；保守保留期建议 **7 天**

4. **推荐轮换步骤（零停机目标）**
   ```
   1. 生成新密钥对 → kid=new，标记为 current
   2. 将旧公钥移至 previous，旧 kid 保留
   3. 部署 Connect：JWKS 含 [current, previous]；签名仅用 current
   4. 观察 7d：无 previous kid 验签错误
   5. 从 JWKS 移除 previous；安全销毁 previous 私钥
   ```

### v2 扩展点（代码锚点）

| 扩展点 | 文件 | 说明 |
|--------|------|------|
| 多密钥加载 | `connect-jwks.js` | `getConnectSigningKeys(): { current, previous? }` |
| JWKS 组装 | `connect-jwks.js` | `getConnectJwksDocument()` 返回多 `keys[]` |
| 签名选择 | `id-token-issuer.js` | `signIdTokenForConnect()` 仅用 current |
| 环境变量 | `env.js` | `MOAUTH_CONNECT_ID_TOKEN_SIGNING_PREVIOUS_*`（kid/file/alg） |
| 验证脚本 | `oidc-production-gates.mjs` | 校验 JWKS ≥1 且 current kid 存在；轮换期允许 2 keys |

---

## 2. authorized-apps file store 生产边界

| 场景 | 存储 | 说明 |
|------|------|------|
| 本地 / 单测 | `memory`（`NODE_ENV=test` 默认） | 无持久化，不影响测试 |
| 单实例 MVP | `file`（生产默认） | `data/authorized-apps.json` |
| 多实例生产 | **`db`（待实现）** | 必须共享读写；file store **禁止** |

**运行时 warning**：`NODE_ENV=production` 且 backend=`file` 时，Account 启动输出：

```
[MoAuth] WARNING: authorized-apps file store is single-instance MVP only...
```

**静态验收 warning**：`npm run moauth:verify-oidc` 在同样条件下输出 `[WARN]`，不阻断 CI。

多实例迁移 checklist（P1）：
- 实现 `@moauth/authorized-apps-store` DB adapter
- `MOAUTH_AUTHORIZED_APPS_STORE=db` + `DATABASE_URL`
- 灰度验证 `isGranted` scope 子集语义与 revoke 一致性

---

## 3. Staging / Release Live OIDC 验收

### 分层策略

| 环境 | 命令 | 要求 |
|------|------|------|
| PR / main CI | `npm run test:ci` | static-only，必过 |
| Staging | `npm run moauth:verify-oidc:release` | **live 必过**（`--strict-live`） |
| Production release | 同上 + 浏览器清单 | live + 人工 E2E |

### GitHub Actions（Release）

Workflow：`.github/workflows/moauth-oidc-release.yml`

- 触发：`workflow_dispatch`、tag `v*`
- 依赖仓库 Variables / Secrets：
  - `MOAUTH_CONNECT_ISSUER`（staging/production URL）
  - `MOAUTH_CONNECT_ID_TOKEN_SIGNING_*`（或 staging secret 注入）
  - 可选 `MOAUTH_VERIFY_ID_TOKEN`、`MOAUTH_VERIFY_CLIENT_ID`

### 手动 Staging 验收

```bash
export NODE_ENV=production
export MOAUTH_CONNECT_ISSUER=https://connect.staging.example.com
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE=production-jwks
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE=/secure/connect/private.pem
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID=moauth-connect-staging-1
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG=RS256

# 静态 + live（Connect 必须可达）
npm run moauth:verify-oidc:release

# 若已完成一次真实登录，附带 id_token 深度校验
MOAUTH_VERIFY_ID_TOKEN="<jwt>" \
MOAUTH_VERIFY_CLIENT_ID="<client_id>" \
npm run moauth:verify-oidc:release
```

---

## 4. 浏览器端到端验收清单

在 **真实公网域名**（或 staging 等价域名）下，使用无痕窗口执行。记录每步截图 / HAR 可选。

| # | 场景 | 操作 | 通过标准 |
|---|------|------|----------|
| E1 | 首次授权 | SubBoost → MoAuth 登录 → Account 登录 → Connect consent 确认 | callback 成功；SubBoost session 建立；`id_token.iss` = Connect issuer |
| E2 | 已授权静默登录 | 同用户再次从 SubBoost 登录（Connect SSO 存在，scopes 未扩大） | **不**展示 consent；直达 callback |
| E3 | `prompt=consent` | 登出后带 `prompt=consent` 或 `SUBBOOST_LOGOUT_FORCE_CONSENT=true` 再登录 | 必须展示 consent |
| E4 | scope 扩大 | 已授权 `openid profile`，新请求增加 `email` | 必须重新 consent；授权后 granted scopes 更新 |
| E5 | 撤销后重登 | Account「已授权应用」撤销 SubBoost → 再登录 | 必须展示 consent；`isGranted` 为 false |
| E6 | Account 不可达 | 停止 Account，从 SubBoost 发起登录 | Connect fail-closed（503 / 明确错误），不静默成功 |
| E7 | authorized-apps 查询失败 | 阻断 Account internal authorized-apps API | Connect 503 `AUTHORIZED_APPS_UNAVAILABLE`，不 finalize |
| E8 | SubBoost 普通 logout | 业务 logout（默认不 force consent） | 本地 session 清除；下次登录不强制 consent（SSO 仍可能存在） |
| E9 | 公网域名一致性 | 检查浏览器地址栏与 Set-Cookie | `issuer`、callback、`redirect_uri`、cookie `Domain` 均为同一公网品牌域；无 Zitadel 域名暴露给用户 |

---

## 5. 最终 Release Checklist

### P0 — 必须完成（阻断上线）

- [ ] `MOAUTH_CONNECT_ISSUER` / `MOAUTH_CONNECT_PUBLIC_URL` 指向生产公网域名（HTTPS）
- [ ] `production-jwks` 已配置；`dev-hs256` 在生产 discovery 中不可见
- [ ] `npm run moauth:verify-oidc:release` 在 staging **全绿**（discovery + JWKS + 静态门禁）
- [ ] SubBoost 仅配置 Connect issuer；`MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK` 未启用
- [ ] 浏览器 E1/E2/E6/E7/E9 通过
- [ ] authorized-apps fail-closed 已验证（E7）
- [ ] 私钥未入库；`secrets/connect-signing/` 未提交

### P1 — 强烈建议（首发后 1 个迭代内）

- [ ] 浏览器 E3/E4/E5/E8 全通过
- [ ] staging 附带真实 `MOAUTH_VERIFY_ID_TOKEN` 验签通过
- [ ] 单实例确认：file store warning 已评审并接受；或已切 DB store
- [ ] 密钥轮换 runbook 已交付运维（v2 实现前按 v1 维护窗口方案）
- [ ] Account / Connect 健康检查与告警接入
- [ ] 回滚方案：Connect issuer、JWKS kid、客户端 redirect_uri 同步回滚步骤

### P2 — 可后续增强

- [ ] JWKS v2：current + previous 双钥零停机轮换
- [ ] authorized-apps DB store + 多实例水平扩展
- [ ] 自动化 browser-e2e 纳入 release workflow
- [ ] OIDC 合规扫描（oauth.net、OWASP）
- [ ] 密钥自动轮换与 HSM/KMS 集成

---

## 相关命令速查

```bash
npm run test:ci                      # PR 门禁
npm run moauth:verify-oidc -- --static-only
npm run moauth:verify-oidc:release   # staging/release live
npm run moauth:generate-signing-keys
```

ADR 基线：`docs/uuwu_04_adr.md` ADR-010。