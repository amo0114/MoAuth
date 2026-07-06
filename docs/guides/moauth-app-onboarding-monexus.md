# MoNexus 接入 MoAuth 详细教程

**示例应用**：MoNexus
**身份平台**：MoAuth（Connect + Account + Zitadel）
**协议**：OIDC Authorization Code + PKCE（`S256`）
**参考实现**：`external/subboost/local`（SubBoost 首版接入）
**更新日期**：2026-07-02

> 本文以 MoNexus 为例，说明**任意一方业务应用**接入 MoAuth 的完整步骤。SubBoost 已走通的路径，MoNexus 按同样模式复制即可。

---

## 0. 接入前你需要理解什么

### 0.1 职责分工

| 谁 | 做什么 | 不做什么 |
|----|--------|----------|
| **MoAuth Connect** | 对外 OIDC issuer、SSO、consent、代理 token | 不管 MoNexus 业务权限 |
| **MoAuth Account** | 用户密码登录、注册、handoff | 不代替 MoNexus 建本地 session |
| **MoNexus** | 发起登录、处理 callback、校验 token、建**本地 session** | 不实现密码认证、不信 Zitadel issuer |
| **Zitadel** | 隐藏用户目录与上游 token | 不对 MoNexus 直接暴露 |

### 0.2 用户看到的流程（首次登录）

```
MoNexus「使用统一账号登录」
  → Connect /oauth/v2/authorize
  → Account /login（输入密码）
  → Connect handoff + consent（首次或 scopes 扩大）
  → MoNexus /auth/moauth/callback?code=...
  → MoNexus 换 token、校验 id_token、创建本地 session
  → 进入 MoNexus 首页
```

### 0.3 当前平台限制（MVP）

| 项 | 现状 | MoNexus 要做什么 |
|----|------|------------------|
| Client 注册 | Connect 源码注册表 `apps/connect/src/config/clients.js` | **临时**需提交 PR 增加 MoNexus 条目；P4 Console 后改为 UI 配置 |
| Zitadel OIDC App | 需在 Zitadel 控制台创建 Application | 获取 `client_id` / `client_secret` |
| Provisioning | 在 Connect 注册 `provisioningPolicy`；在 MoNexus 实现本地策略 | 见 §7 |
| Issuer | **只信 Connect** | `MOAUTH_CONNECT_ISSUER`，禁止 Zitadel 域名 |

---

## 1. 前置条件

### 1.1 运行中的服务

本地开发默认端口：

| 服务 | URL | 启动命令 |
|------|-----|----------|
| Zitadel | `http://127.0.0.1:8081` | 见 `self-hosted/zitadel/` |
| Connect | `http://127.0.0.1:3000` | `npm run dev:connect` |
| Account | `http://127.0.0.1:3002` | `npm run dev:account` |
| MoNexus（新建） | `http://127.0.0.1:3003` | 你的应用 dev 命令 |

验证 Connect Discovery：

```bash
curl -s http://127.0.0.1:3000/.well-known/openid-configuration | jq '{issuer, authorization_endpoint, token_endpoint, jwks_uri}'
```

期望 `issuer` 为 `http://127.0.0.1:3000`，且各 endpoint 同源。

### 1.2 MoNexus 技术假设

本教程按 **Next.js App Router + Route Handlers** 描述（与 SubBoost 一致）。其他栈（Java/Spring、Go、Express）只需实现相同 HTTP 契约：

- `GET /api/auth/moauth/login` → 302 到 Connect authorize
- `GET /api/auth/moauth/callback` → 换 code、验 token、写 session

---

## 2. 第一步：在 Zitadel 创建 OIDC 应用

1. 登录 Zitadel 管理台（本地一般为 `http://127.0.0.1:8081/ui/console`）。
2. 进入 **Projects → 你的 Project → Applications → New**。
3. 类型选择 **Web → OIDC**。
4. 配置要点：

| 字段 | 本地开发示例 | 生产示例 |
|------|--------------|----------|
| Name | `MoNexus Dev` | `MoNexus Production` |
| Authentication Method | **Code** | **Code** |
| Grant Types | Authorization Code | 同左 |
| Response Types | `code` | `code` |
| Access Token Type | JWT 或 Bearer（与现网 Zitadel 配置一致） | 同左 |
| Redirect URIs | `http://127.0.0.1:3003/api/auth/moauth/callback` | `https://monexus.example.com/api/auth/moauth/callback` |
| Post Logout Redirect URIs（可选） | `http://127.0.0.1:3003/` | `https://monexus.example.com/` |
| Dev Mode | 本地可开 | 生产关闭 |
| PKCE | **Required S256**（若控制台有选项） | 必须 |

5. 保存后记录：

```bash
# 示例占位 — 替换为 Zitadel 实际输出
MONEXUS_ZITADEL_CLIENT_ID=123456789012345678
MONEXUS_ZITADEL_CLIENT_SECRET=<confidential-client-secret>   # 若选 confidential
```

> **说明**：Connect 代理 authorize/token 时，Zitadel 侧 client 的 redirect URI 必须与 MoNexus 回调 URL **完全一致**。Connect 注册表里的 `redirectUris` 也要一致（见下一步）。

---

## 3. 第二步：在 Connect 注册 MoNexus 客户端

> **目标态（P4）**：在 Console UI 创建，无需改 Connect 代码。
> **当前 MVP**：编辑 `apps/connect/src/config/clients.js`。

在 `CLIENTS` 数组中**新增** MoNexus 条目（保留 SubBoost 等其他 client）：

```javascript
// apps/connect/src/config/clients.js
import { validateRegisteredClient } from "@moauth/connect-contract";

const CLIENTS = [
  // ... 现有 SubBoost 等 client
  validateRegisteredClient(
    {
      clientId: "123456789012345678",           // 与 Zitadel Application Client ID 一致
      displayName: "MoNexus",                 // consent 页展示的应用名
      clientType: "confidential",             // 有 secret 用 confidential；纯 SPA 用 public
      redirectUris: [
        "http://127.0.0.1:3003/api/auth/moauth/callback",   // 本地
        // "https://monexus.example.com/api/auth/moauth/callback",  // 生产一并注册
      ],
      allowedScopes: ["openid", "profile", "email"],
      allowedPrompts: ["login", "select_account", "consent"],
      provisioningPolicy: "allowlist",        // 见 §7；C 端可选 auto-create
    },
    { allowLoopbackHttp: true }               // 仅开发；生产 URL 用 HTTPS 可去掉此选项
  ),
];
```

**字段说明**：

| 字段 | 要求 |
|------|------|
| `clientId` | 必须与 Zitadel OIDC Application ID 一致 |
| `displayName` | 用户在 Connect consent 页看到的名称 |
| `redirectUris` | 与 MoNexus 实际 callback URL **字符级精确匹配** |
| `allowedScopes` | 至少含 `openid`、`profile`、`email` |
| `provisioningPolicy` | 元数据策略标签；MoNexus 回调里还要实现本地判定 |

添加后运行 Connect 测试确认注册合法：

```bash
npm run test:connect
```

可选：在 `apps/connect/test/connect-app.test.js` 增加 MoNexus client 断言（与 SubBoost 测试并列）。

---

## 4. 第三步：配置 MoNexus 环境变量

在 MoNexus 项目根目录创建 `.env.local`（勿提交仓库）：

```bash
# MoNexus 自身
APP_URL=http://127.0.0.1:3003
NODE_ENV=development

# MoAuth / Connect（唯一信任的 issuer）
MOAUTH_CONNECT_ISSUER=http://127.0.0.1:3000
MOAUTH_CONNECT_CLIENT_ID=123456789012345678
MOAUTH_CONNECT_CLIENT_SECRET=<与-zitadel-一致>    # confidential client 必填

# 登录事务 cookie 签名（生产必须用强随机串）
MONEXUS_MOAUTH_TX_SECRET=<random-32bytes-base64url>

# 本地 dev：若 Connect 启用 dev HS256 重签，MoNexus 需与 Connect 同 secret
# 生产禁止使用 HS256 fallback，只用 Connect JWKS 验 RS256/ES256
# MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET=...

# Provisioning（与 Connect clients.js 中策略一致）
MONEXUS_PROVISIONING_POLICY=allowlist
```

**生产环境示例**：

```bash
NODE_ENV=production
APP_URL=https://monexus.example.com
MOAUTH_CONNECT_ISSUER=https://connect.example.com
MOAUTH_CONNECT_CLIENT_ID=123456789012345678
MOAUTH_CONNECT_CLIENT_SECRET=<from-secret-manager>
MONEXUS_MOAUTH_TX_SECRET=<from-secret-manager>

# 禁止
# MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK=true
# MOAUTH_ZITADEL_ISSUER=...
```

---

## 5. 第四步：实现登录入口（authorize 重定向）

### 5.1 路由

```
GET /api/auth/moauth/login
```

### 5.2 逻辑要点

1. 生成 `state`（≥22 字符）、`nonce`（≥16 字符）、`code_verifier` / `code_challenge`（S256）
2. 将 `{ state, nonce, codeVerifier, redirectUri }` 写入 **httpOnly 签名 cookie**（防 CSRF / 重放）
3. 302 到 Connect：

```
{MOAUTH_CONNECT_ISSUER}/oauth/v2/authorize
  ?client_id=...
  &redirect_uri=http://127.0.0.1:3003/api/auth/moauth/callback
  &response_type=code
  &scope=openid profile email
  &state=...
  &nonce=...
  &code_challenge=...
  &code_challenge_method=S256
```

### 5.3 参考代码（TypeScript）

可复用 `@moauth/connect-contract` 中的 PKCE 与 URL 构建（SubBoost 已示范）：

```typescript
// lib/monexus-oidc.ts — 模式同 external/subboost/local/src/lib/moauth-oidc.ts
import {
  buildAuthorizationUrl,
  createPkceChallenge,
  createPkceVerifier,
} from "@moauth/connect-contract";

export async function startMonexusMoauthLogin(request: NextRequest) {
  const issuer = process.env.MOAUTH_CONNECT_ISSUER!;
  const clientId = process.env.MOAUTH_CONNECT_CLIENT_ID!;
  const redirectUri = `${process.env.APP_URL}/api/auth/moauth/callback`;

  const codeVerifier = createPkceVerifier();
  const codeChallenge = createPkceChallenge(codeVerifier);
  const state = randomBase64Url(32);
  const nonce = randomBase64Url(24);

  // 签名 cookie 存 transaction（见 SubBoost signMoauthLoginTransaction）
  const signedTx = signLoginTransaction({ state, nonce, codeVerifier, redirectUri });

  const url = buildAuthorizationUrl(`${issuer}/oauth/v2/authorize`, {
    clientId,
    redirectUri,
    scopes: ["openid", "profile", "email"],
    state,
    nonce,
    codeChallenge,
    prompt: [], // 需要强制重新授权时传 ["consent"]
  });

  const res = NextResponse.redirect(url, 302);
  res.cookies.set("monexus_moauth_tx", signedTx, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
```

### 5.4 前端按钮

```tsx
// 登录页
<a href="/api/auth/moauth/login">使用 MoYuan ID 登录</a>
```

---

## 6. 第五步：实现 Callback（换 token + 建本地 session）

### 6.1 路由

```
GET /api/auth/moauth/callback?code=...&state=...
```

### 6.2 处理顺序（必须按序）

```
1. 读取并校验 monexus_moauth_tx cookie（state 绑定）
2. 校验 query.state === transaction.state
3. 处理 error=access_denied 等 OAuth 错误
4. POST {issuer}/oauth/v2/token（authorization_code + code_verifier）
5. 校验 id_token（issuer、aud、nonce、签名 / JWKS）
6. GET {issuer}/oidc/v1/userinfo（可选但推荐，与 sub 交叉校验）
7. 执行 MoNexus 本地 provisioning 策略（allowlist 等）
8. 创建 MoNexus 本地 session（独立 cookie）
9. 清除 monexus_moauth_tx cookie
10. 302 到 MoNexus 首页 /dashboard
```

### 6.3 Token 交换

```typescript
const body = new URLSearchParams({
  grant_type: "authorization_code",
  code,
  redirect_uri: transaction.redirectUri,
  client_id: clientId,
  code_verifier: transaction.codeVerifier,
});
if (clientSecret) body.set("client_secret", clientSecret);

const tokenRes = await fetch(`${issuer}/oauth/v2/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body,
});
```

### 6.4 校验 id_token（关键）

**生产**：

- `iss` === `MOAUTH_CONNECT_ISSUER`
- `aud` 包含 `MOAUTH_CONNECT_CLIENT_ID`
- `nonce` === transaction.nonce
- 签名：用 Connect JWKS（`{issuer}/oauth/v2/keys`）验 **RS256/ES256**

**开发**（仅当 Connect 配置了 `MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET`）：

- 可能为 HS256；需与 Connect 共享 secret（见 SubBoost `verifyMoauthIdToken`）

参考：`external/subboost/local/src/lib/moauth-id-token.ts`

```typescript
import { createRemoteJWKSet, jwtVerify } from "jose";

const jwks = createRemoteJWKSet(new URL(`${issuer}/oauth/v2/keys`));
const { payload } = await jwtVerify(idToken, jwks, {
  issuer,
  audience: clientId,
});
// 另验 payload.nonce === transaction.nonce
```

**禁止**：使用 Zitadel issuer 或 Zitadel JWKS 校验业务侧 id_token。

---

## 7. 第六步：本地用户映射与 Provisioning

统一身份登录成功 ≠ 自动获得 MoNexus 权限。MoNexus 必须实现**本地准入**。

### 7.1 策略类型（Connect 注册 + MoNexus 实现）

| 策略 | 适用场景 | MoNexus 行为 |
|------|----------|--------------|
| `allowlist` / `invite` | 管理后台、内部工具（推荐 MoNexus 首版） | 仅 `identity_subject_id` 已绑定或邮箱在批准名单才创建 session |
| `manual-binding` | 高敏系统 | 仅已有 `sub` 绑定 |
| `auto-create` | 面向普通用户的 C 端 | 邮箱已验证可自动建本地用户 |

Connect 合约：`@moauth/connect-contract` 的 `decideProvisioning` / `assertProvisioningAllowed`。

### 7.2 MoNexus 数据模型建议

```sql
-- 示例：本地用户表
CREATE TABLE monexus_users (
  id            UUID PRIMARY KEY,
  identity_sub  TEXT UNIQUE,          -- OIDC sub，主键映射
  email         TEXT,
  display_name  TEXT,
  role          TEXT NOT NULL,        -- MoNexus 本地角色
  status        TEXT NOT NULL,        -- active / suspended
  created_at    TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ
);
```

### 7.3 allowlist 示例逻辑

```typescript
import { assertProvisioningAllowed } from "@moauth/connect-contract";

const policy = process.env.MONEXUS_PROVISIONING_POLICY ?? "allowlist";

const localUser = await db.user.findBySub(idClaims.sub);
const invitedByEmail = idClaims.email
  ? await db.invite.findByEmail(idClaims.email)
  : null;

const facts = {
  hasSubjectBinding: localUser?.identitySub === idClaims.sub,
  hasApprovedLocalAccount: invitedByEmail != null,
  emailVerified: idClaims.emailVerified === true,
};

const decision = assertProvisioningAllowed(policy, facts);
// LOGIN_EXISTING → 直接建 session
// BIND_AND_LOGIN → 绑定 sub 后建 session
// DENY → 返回「无访问权限」，不建 session
```

SubBoost 完整实现见：`external/subboost/local/app/api/auth/moauth/callback/route.ts`。

---

## 8. 第七步：登出

### 8.1 MoNexus 本地登出（必须）

清除 MoNexus 自己的 session cookie；可选清除 `monexus_moauth_tx` 等临时 cookie。

### 8.2 Connect / Account 会话（可选）

- 默认：**不**强制下次登录显示 consent（Connect SSO 可能仍在）
- 若需下次强制授权：登录时带 `prompt=consent`（SubBoost 用 `SUBBOOST_LOGOUT_FORCE_CONSENT` 示范）

可选跳转 Connect 登出：

```
GET {MOAUTH_CONNECT_ISSUER}/oidc/v1/end_session
  ?post_logout_redirect_uri={APP_URL}/
  &id_token_hint={id_token}    # 若仍持有
```

### 8.3 身份边界

MoNexus logout **只需保证本地 session 失效**；不要求用户理解 Connect/Zitadel 多层会话。

---

## 9. 本地联调步骤（Checklist）

按顺序执行：

- [ ] Zitadel、Connect、Account、MoNexus 四服务已启动
- [ ] `clients.js` 已注册 MoNexus，`clientId` / `redirect_uri` 与 Zitadel 一致
- [ ] MoNexus `.env.local` 已配置 `MOAUTH_CONNECT_*`
- [ ] 浏览器无痕访问 `http://127.0.0.1:3003` → 点击统一登录
- [ ] 跳转到 Account，文案为「登录并继续」类提示
- [ ] 登录后 Connect consent 显示 **MoNexus** 应用名与 scopes
- [ ] 回调成功后进入 MoNexus 已登录态
- [ ] 数据库中 `identity_sub` 已写入
- [ ] 第二次登录：若 scopes 未变且已授权，consent **可静默跳过**
- [ ] 停止 Account：`/api/auth/moauth/login` 应对用户显示 Connect 不可用（fail-closed）

**自动化辅助**（MoAuth 仓库）：

```bash
npm run test:account-health-probe
npm run moauth:verify-oidc -- --static-only
```

---

## 10. 生产上线步骤

### 10.1 配置清单

| 项 | 生产值 |
|----|--------|
| `MOAUTH_CONNECT_ISSUER` | `https://connect.example.com` |
| MoNexus `APP_URL` | `https://monexus.example.com` |
| Redirect URI | `https://monexus.example.com/api/auth/moauth/callback` |
| Connect `clients.js` 或 Console | 注册 HTTPS redirect |
| Connect 签名 | `production-jwks` + 私钥文件 |
| MoNexus token 校验 | 仅 Connect JWKS，禁用 upstream fallback |

### 10.2 验收命令

```bash
# MoAuth 侧
npm run moauth:verify-oidc:release

# 浏览器清单
# 见 docs/reviews/moauth-release-readiness.md §4
```

### 10.3 OIDC 合规要点

- 必须使用 **PKCE S256**
- `state` 必须绑定浏览器 session
- `redirect_uri` 精确匹配，禁止开放重定向
- 映射主键用 **`sub`**，不用 email
- `email_verified=false` 时 MoNexus 可自行拒绝（按产品策略）

---

## 11. 目录结构建议（MoNexus 仓库）

```
monexus/
├── app/
│   └── api/
│       └── auth/
│           └── moauth/
│               ├── login/route.ts      # GET → authorize
│               └── callback/route.ts   # GET → token + session
├── lib/
│   ├── env.ts                          # MOAUTH_CONNECT_* 读取
│   ├── monexus-oidc.ts                 # transaction cookie、PKCE
│   ├── monexus-id-token.ts             # JWKS 校验
│   └── session.ts                      # MoNexus 本地 session
├── .env.local
└── package.json                        # 依赖 @moauth/connect-contract（可选，从 monorepo 引用）
```

若 MoNexus 在 MoAuth monorepo 外：可将 `connect-contract` 发布为内部 npm 包，或复制 SubBoost 中最小的 PKCE/URL 工具函数。

---

## 12. 常见错误排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| `client_id unknown` / authorize 立即失败 | Connect `clients.js` 未注册或 ID 不一致 | 对齐 Zitadel 与 `clients.js` |
| `redirect_uri mismatch` | 回调 URL 与注册不完全一致 | 检查尾斜杠、http/https、端口 |
| `invalid_grant` 换 token 失败 | `code_verifier` 与 authorize 时不一致；或 code 已用过 | 检查 transaction cookie |
| id_token 校验失败 `iss` | 用了 Zitadel issuer 或 dev/prod 签名模式不一致 | 只 pin Connect issuer |
| 登录成功但 MoNexus 拒绝 | allowlist 未批准 | 在 MoNexus 添加 invite / 绑定 `sub` |
| consent 每次都会出现 | 未记录 authorized-apps；或 `prompt=consent` | 检查 Account API；首次授权正常 |
| Account 宕机仍继续登录 | 不应发生 | Connect 应 fail-closed，检查 Account 健康探测 |

---

## 13. 与 SubBoost 差异对照

| 项 | SubBoost | MoNexus（建议） |
|----|----------|-----------------|
| 端口 | 3001 | 3003（自定） |
| Callback | `/api/auth/moauth/callback` | 同路径模式即可 |
| Provisioning | `allowlist` + `localAdmin` | 你的用户表 + invite |
| 登录按钮文案 | SubBoost 自有 | 「使用 MoYuan ID 登录」 |
| Connect displayName | `SubBoost` | `MoNexus` |

可直接 fork SubBoost 的 `app/api/auth/moauth/*` 与 `src/lib/moauth-*.ts`，全局替换环境变量前缀与 cookie 名。

---

## 14. 目标态：Console 接入（P4 后）

P4 交付后，MoNexus 接入将简化为：

1. 平台管理员在 **Console** 创建应用「MoNexus」
2. 填写 redirect URIs、scopes、provisioning 策略
3. Console 同步 Zitadel OIDC Client + Connect 注册表
4. 开发者复制 Console 展示的 `issuer`、`client_id`、示例 callback 到 MoNexus `.env`
5. **无需再改 Connect 源码**

当前 MVP 仍需 §3 的 `clients.js` PR。

---

## 15. 相关文档

| 文档 | 内容 |
|------|------|
| [`moauth_product_guide.md`](../moauth_product_guide.md) | 产品总览与架构 |
| [`moauth_prd.md`](../moauth_prd.md) §7 | 应用接入模型 |
| [`uuwu_06_interface_contracts_boundaries.md`](../uuwu_06_interface_contracts_boundaries.md) | handoff、错误码、接口边界 |
| [`uuwu_04_adr.md`](../uuwu_04_adr.md) ADR-010 | Connect-as-Public-Issuer |
| [`reviews/moauth-release-readiness.md`](../reviews/moauth-release-readiness.md) | 上线验收 |
| `external/subboost/local/app/api/auth/moauth/` | 参考实现 |

---

## 附录：MoNexus 最小环境变量模板

```bash
# === MoNexus ===
APP_URL=http://127.0.0.1:3003

# === MoAuth Connect（唯一 issuer）===
MOAUTH_CONNECT_ISSUER=http://127.0.0.1:3000
MOAUTH_CONNECT_CLIENT_ID=<zitadel-application-client-id>
MOAUTH_CONNECT_CLIENT_SECRET=<zitadel-client-secret>

# === 安全 ===
MONEXUS_MOAUTH_TX_SECRET=<openssl rand -base64 32>
MONEXUS_PROVISIONING_POLICY=allowlist
```