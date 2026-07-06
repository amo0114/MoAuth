# MoAuth 产品使用指南

**版本**：1.0
**更新日期**：2026-07-02
**读者**：产品、研发、运维、业务应用接入方
**关联文档**：[`moauth_prd.md`](./moauth_prd.md)（需求基线）、[`uuwu_04_adr.md`](./uuwu_04_adr.md)（架构决策）、[`reviews/moauth-release-readiness.md`](./reviews/moauth-release-readiness.md)（上线验收）

---

## 1. 产品是什么

**MoAuth**（代码品牌默认 **MoYuan ID**）是一套**自维护的统一身份系统**，面向一方自有业务应用（如 SubBoost）及未来多个内部产品。

它解决的核心问题：

- 用户**注册一次**，即可登录多个业务应用
- 业务应用通过**标准 OIDC** 接入，无需各自实现账号体系
- 终端用户只见品牌化 **Connect**（登录网关）与 **Account**（账号中心），**不感知**底层认证核心 Zitadel
- 各业务应用保留**本地 session、角色权限与业务数据**；统一身份只回答「你是谁」（`sub`）

一句话定义（来自 PRD）：

> 建设一套自维护的统一身份系统：用户在一个账号中心注册并管理账号，通过 Connect 登录网关访问多个自有业务应用；认证协议与数据由自部署 Zitadel 承担，但对终端用户和业务应用完全隐藏。

---

## 2. 产品做什么（能力边界）

### 2.1 用户能做什么

| 能力 | 说明 | 主要入口 |
|------|------|----------|
| 注册账号 | 邮箱注册、验证 | Account `/register` |
| 登录业务应用 | 从 SubBoost 等跳转统一登录 | Connect → Account |
| 授权应用访问 | 确认应用名与 scopes | Connect consent |
| 找回/重置密码 | 邮件重置流程 | Account |
| 管理资料与会话 | 查看资料、活动、已授权应用（持续完善） | Account 中心 |
| 跨应用 SSO | 已登录 Connect 后，第二应用可快速授权 | Connect SSO |

### 2.2 系统能做什么（平台能力）

| 能力 | 说明 |
|------|------|
| OIDC 发行（Connect） | 对外唯一 issuer；Discovery / authorize / token / JWKS / userinfo |
| 登录网关（Connect） | SSO 会话、consent、prompt 语义、OIDC 代理 |
| 账号中心（Account） | 密码登录 UI、注册、handoff 回传 Connect |
| 授权记忆 | 同用户+同应用+scopes 子集已授权时，可跳过 consent |
| Fail-closed | Account 或 authorized-apps 不可用时，Connect 拒绝静默放行 |
| 首应用验证 | SubBoost 作为首个 OIDC 接入方（allowlist 策略） |

### 2.3 明确不做什么（非目标）

- 不从零自研 OAuth/OIDC Server（Zitadel 为隐藏核心）
- 不在统一身份层承载业务权限（角色、配额归各应用）
- MVP 不做第三方社交登录开放平台
- 不要求所有应用共享同一业务 cookie

---

## 3. 系统架构

### 3.1 组件一览

```
┌─────────────────────────────────────────────────────────────────┐
│                        终端用户 / 业务应用                        │
└────────────┬───────────────────────────────┬────────────────────┘
             │ OIDC (Code + PKCE)            │ 浏览器
             ▼                               ▼
    ┌────────────────┐              ┌────────────────┐
    │    Connect     │◄── handoff ──│    Account     │
    │  (登录网关)     │              │  (账号中心)     │
    │  :3000         │              │  :3002         │
    └────────┬───────┘              └────────┬───────┘
             │ OIDC 代理 / Session API        │ Session API
             ▼                               ▼
    ┌────────────────────────────────────────────────┐
    │              Zitadel（隐藏认证核心）:8081          │
    └────────────────────────────────────────────────┘

    ┌────────────────┐
    │   SubBoost     │  … 其他业务应用
    │   :3001        │
    └────────────────┘
```

### 3.2 域名与职责（生产目标态）

| 组件 | 域名示例 | 职责 |
|------|----------|------|
| **Connect** | `connect.example.com` | 对外 OIDC issuer、SSO、consent、OIDC 端点代理 |
| **Account** | `account.example.com` | 注册、密码登录、资料、handoff 签发 |
| **业务应用** | 各应用自有域 | OIDC 客户端、本地 session、业务权限 |
| **Zitadel** | 内网/受限域 | 用户目录、协议、上游 token（不对用户暴露） |

### 3.3 关键架构原则（ADR-010）

1. **Connect 是唯一对外 OIDC issuer** — `discovery.issuer`、`id_token.iss`、`jwks_uri` 均指向 Connect
2. **Account 收密码，Connect 不收密码**（生产默认）
3. **Handoff 是短期一次性凭证**，不是长期 session
4. **业务应用只 pin Connect issuer**，不得直接信任 Zitadel
5. **映射主键是 `sub`**，不用 email 作跨系统唯一键

---

## 4. 核心特性详解

### 4.1 Connect-as-Public-Issuer

业务应用配置的 Discovery URL 形如：

```
https://connect.example.com/.well-known/openid-configuration
```

Connect 将 Zitadel 的 OIDC 响应**重写**为 Connect 域名，并在生产模式下用 Connect 私钥重签 `id_token`，使 `iss` 与 discovery 一致。

**生产签名模式**（`production-jwks`）：

- 算法：RS256（默认）或 ES256
- JWKS：`GET /oauth/v2/keys` 由 Connect 直接发行
- 配置：见 §6.3

**开发模式**（仅 `NODE_ENV !== production`）：

- 可选 `dev-hs256` 重签（`MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET`）
- 生产**禁止** dev-hs256

### 4.2 Login Handoff（Account → Connect）

当用户尚无 Connect SSO 时：

1. Connect 将用户导向 Account `/login?auth_request=...`
2. Account 调用 Zitadel 校验密码，签发**一次性 handoff code**（TTL ≤ 60s）
3. 浏览器跳回 Connect `/login/handoff?code=...`
4. Connect **服务端**调用 Account `POST /api/handoff/consume` 换取 session
5. Connect 建立 SSO，按需展示 consent，finalize 后回调业务应用

密码与 Zitadel session 权威在 Account/Zitadel；浏览器不长期持有 `sessionToken`。

### 4.3 Consent 与授权记忆

- 用户确认授权后，Account 记录 **authorized-apps** 投影
- 键：`sub` + `clientId`；**scope 子集**语义：已授权 scopes ⊇ 本次请求 scopes → 可**静默跳过** consent
- `prompt=consent` 强制展示授权页
- 用户在 Account 撤销授权后，下次登录需重新 consent
- authorized-apps API 不可用时 Connect **503 fail-closed**

### 4.4 SSO 与 prompt 语义

| prompt | 行为 |
|--------|------|
| （默认） | 有 Connect SSO → consent/继续；无 SSO → 跳转 Account 登录 |
| `login` | 清除 SSO 语义，跳转 Account 重新登录 |
| `none` | 无 SSO 时返回 `login_required`，不展示交互页 |
| `consent` | 强制 consent |
| `select_account` | 跳转 Account 账号选择（演进中） |

### 4.5 SubBoost 接入与访问控制

- SubBoost 通过标准 OIDC Authorization Code + PKCE 连接 Connect
- 统一身份登录成功**不自动**获得 SubBoost 管理权限
- 默认 **allowlist/invite**；无映射则 `APP_ACCESS_DENIED`
- 普通 logout **不**默认 `force_consent`（可通过环境变量开启）

### 4.6 生产就绪能力（当前版本）

| 能力 | 状态 |
|------|------|
| OIDC 静态 CI 门禁 | ✅ `npm run test:ci` |
| 密钥生成脚本 | ✅ `npm run moauth:generate-signing-keys` |
| OIDC 验收脚本 | ✅ `npm run moauth:verify-oidc` |
| Release live 验收 | ✅ `npm run moauth:verify-oidc:release` |
| JWKS 单钥（v1） | ✅ |
| JWKS 双钥轮换（v2） | 📋 设计完成，待实现 |
| authorized-apps file store | ✅ 单实例 MVP |
| authorized-apps DB store | 📋 多实例前必须 |

---

## 5. 如何使用

### 5.1 环境要求

- **Node.js** ≥ 20.19
- **Zitadel** 自部署实例（本地默认 `http://127.0.0.1:8081`）
- npm workspaces  monorepo

### 5.2 本地开发快速启动

**端口约定**：

| 服务 | 端口 | 命令 |
|------|------|------|
| Connect | 3000 | `npm run dev:connect` |
| Account | 3002 | `npm run dev:account` |
| SubBoost | 3001 | 见 `external/subboost` |
| Zitadel | 8081 | 见 `self-hosted/zitadel` |

**推荐启动顺序**：

```bash
# 1. 安装依赖
npm ci

# 2. 启动 Zitadel（另终端，见 self-hosted 文档）

# 3. 启动 Connect
npm run dev:connect

# 4. 启动 Account
npm run dev:account

# 5. （可选）启动 SubBoost 验证全链路
cd external/subboost && npm run dev
```

**验证 Discovery**：

```bash
curl -s http://127.0.0.1:3000/.well-known/openid-configuration | jq .issuer
# 期望：http://127.0.0.1:3000
```

**健康检查**：

```bash
curl -s http://127.0.0.1:3002/api/health/ready | jq .
npm run test:account-health-probe
```

### 5.3 业务应用接入（OIDC 客户端）

> **详细分步教程**（以 MoNexus 为例）：[`guides/moauth-app-onboarding-monexus.md`](./guides/moauth-app-onboarding-monexus.md)

#### 步骤 1：在 Zitadel/Connect 注册 OIDC Client

获取 `client_id`、`client_secret`（若为 confidential client）、`redirect_uri`。

#### 步骤 2：配置环境变量（以 SubBoost 为例）

```bash
MOAUTH_CONNECT_ISSUER=http://127.0.0.1:3000
MOAUTH_CONNECT_CLIENT_ID=<your-client-id>
MOAUTH_CONNECT_CLIENT_SECRET=<optional>
# 仅本地 dev HS256 重签时需要，生产勿用：
# MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET=...
```

#### 步骤 3：实现标准 OIDC 流程

1. 生成 `state`、`nonce`、`code_verifier`（PKCE S256）
2. 重定向用户到 `{issuer}/oauth/v2/authorize?...`
3. 回调接收 `code`，向 `{issuer}/oauth/v2/token` 换 token
4. 用 Connect JWKS 校验 `id_token`（`iss` = Connect issuer，`aud` = client_id）
5. 以 `sub` 映射本地用户，创建**应用本地 session**

#### 步骤 4：校验 issuer 边界

- ✅ 只配置 `MOAUTH_CONNECT_ISSUER`
- ❌ 不要配置 Zitadel 为 issuer
- ❌ 生产不要启用 `MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK`

### 5.4 生产部署要点

#### Connect

```bash
NODE_ENV=production
MOAUTH_CONNECT_ISSUER=https://connect.example.com
MOAUTH_CONNECT_PUBLIC_URL=https://connect.example.com
MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE=production-jwks
MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE=/secure/connect/private.pem
MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG=RS256
MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID=moauth-connect-1
ZITADEL_ISSUER=https://zitadel-internal.example.com
# ... 其他 ZITADEL_* 服务配置
```

生成密钥：

```bash
npm run moauth:generate-signing-keys
# 输出：secrets/connect-signing/private.pem、public.pem、connect-signing.env.snippet
```

#### Account

```bash
NODE_ENV=production
MOAUTH_ACCOUNT_PUBLIC_URL=https://account.example.com
MOAUTH_HANDOFF_INTERNAL_TOKEN=<强随机内部令牌>
MOAUTH_AUTHORIZED_APPS_STORE=file          # 仅单实例 MVP
MOAUTH_AUTHORIZED_APPS_STORE_PATH=/data/authorized-apps.json
# 多实例生产：MOAUTH_AUTHORIZED_APPS_STORE=db（待实现）
```

> **注意**：`NODE_ENV=production` 且使用 `file` store 时，Account 启动会输出**单实例 MVP 警告**。多副本部署前必须迁移 DB store。

#### Connect → Account 探测（同机/容器）

```bash
MOAUTH_ACCOUNT_INTERNAL_URL=http://account:3002
MOAUTH_ACCOUNT_HEALTH_PROBE_PATH=/api/health/ready
```

### 5.5 验收与 CI

| 场景 | 命令 |
|------|------|
| 日常 PR | `npm run test:ci` |
| 静态生产门禁 | `NODE_ENV=production npm run moauth:verify-oidc -- --static-only` |
| Staging/Release | `npm run moauth:verify-oidc:release` |
| 浏览器清单 | 见 [`reviews/moauth-release-readiness.md`](./reviews/moauth-release-readiness.md) §4 |

---

## 6. 环境变量参考（常用）

### 6.1 Connect

| 变量 | 说明 |
|------|------|
| `MOAUTH_CONNECT_ISSUER` | 对外 OIDC issuer |
| `MOAUTH_CONNECT_PUBLIC_URL` | 公网 URL（默认同 issuer） |
| `MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE` | `production-jwks` / `dev-hs256` / `off` |
| `MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE` | 生产私钥文件（推荐） |
| `MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY` | 内联 PEM（备选） |
| `MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG` | `RS256` / `ES256` |
| `MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID` | JWKS key id |
| `MOAUTH_ACCOUNT_PUBLIC_URL` | Account 公网地址 |
| `MOAUTH_ACCOUNT_INTERNAL_URL` | Account 内网探测地址 |
| `MOAUTH_HANDOFF_INTERNAL_TOKEN` | handoff / internal API 鉴权 |
| `CONNECT_PASSWORD_LOGIN_FALLBACK` | `true` 才启用 Connect 密码表单（生产默认关） |

### 6.2 Account

| 变量 | 说明 |
|------|------|
| `MOAUTH_ACCOUNT_PUBLIC_URL` | Account 对外 URL |
| `MOAUTH_AUTHORIZED_APPS_STORE` | `memory`（测试）/ `file`（默认生产单实例） |
| `MOAUTH_AUTHORIZED_APPS_STORE_PATH` | file store 路径 |
| `ZITADEL_ISSUER` / `ZITADEL_API_BASE` | Zitadel 连接 |
| `ZITADEL_SERVICE_USER_TOKEN` | 服务账号 PAT |

### 6.3 业务应用（SubBoost 示例）

| 变量 | 说明 |
|------|------|
| `MOAUTH_CONNECT_ISSUER` | 只信 Connect |
| `MOAUTH_CONNECT_CLIENT_ID` | OIDC client_id |
| `MOAUTH_CONNECT_CLIENT_SECRET` | 可选 |
| `MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK` | 仅本地 dev 逃生，生产禁止 |

---

## 7. 典型用户旅程

### 7.1 首次从 SubBoost 登录

1. 用户点击 SubBoost「使用 MoAuth 登录」
2. 浏览器 → Connect `/oauth/v2/authorize`
3. 无 SSO → 跳转 Account 登录页「登录并继续」
4. 输入密码 → handoff → Connect consent（若首次或 scopes 扩大）
5. 用户确认 → 回调 SubBoost → 建立 SubBoost 本地 session

### 7.2 已授权用户再次登录

1. SubBoost 发起 authorize
2. Connect 有 SSO + authorized-apps 命中 scope 子集
3. **跳过 consent**，静默 finalize → 回调 SubBoost

### 7.3 注册新用户

1. 从 Connect/Account 登录页进入「创建账号」
2. Account 完成注册与邮箱验证
3. 回到 Account `/login` 输入密码 → handoff → Connect → 业务应用

---

## 8. 仓库结构（开发者）

```
MoAuth/
├── apps/
│   ├── connect/          # Connect 登录网关（Next.js）
│   └── account/          # Account 账号中心（Next.js）
├── packages/
│   ├── connect-contract/ # OIDC 契约与 prompt 常量
│   ├── handoff-store/    # Handoff 一次性存储
│   ├── authorized-apps-store/  # Consent 投影存储
│   ├── zitadel-client/   # Zitadel Session/OIDC 客户端
│   └── ...
├── scripts/
│   ├── generate-connect-signing-keys.mjs
│   ├── verify-oidc.mjs
│   └── test-account-health-probe.mjs
├── docs/                 # PRD、ADR、接口契约、本指南
├── external/subboost/    # 首版接入验证应用
└── self-hosted/zitadel/  # Zitadel 自托管配置
```

---

## 9. 测试状态说明（2026-07-02）

最近一次测试摘要：

| 套件 | 结果 |
|------|------|
| Connect | **67/67** PASS |
| OIDC 静态门禁 | **9/9** PASS |
| authorized-apps-store | **6/6** PASS |
| handoff-store | **7/7** PASS |
| zitadel-client | **24/24** PASS |
| Account | **39/40** PASS（1 项 handoff 测试需 live Zitadel 或 mock 补强） |
| `npm run test:ci` | Account 上述 1 项失败时会整体失败；核心 OIDC/Connect 路径正常 |

本地快速回归（不依赖 Zitadel 进程）：

```bash
npm run test:connect
npm run test:oidc-gates
npm run test:authorized-apps-store
npm run test:handoff-store
npm run test:zitadel-client
```

---

## 10. 路线图（摘要）

| 阶段 | 目标 |
|------|------|
| P1 | Connect OIDC 代理、SSO ✅ 大部分完成 |
| P2 | Account MVP + Handoff ✅ 进行中 |
| P3 | SubBoost 端到端闭环 ✅ PoC 可验证 |
| P4 | Console 应用管理后台 | 待建设 |
| P5 | MFA、Passkey、会话管理 | 演进中 |
| P6 | 多应用接入套件 | 待建设 |
| P7 | 生产加固、观测、密钥轮换 v2 | 部分完成（CI/验收） |

---

## 11. 获取帮助

| 主题 | 文档 |
|------|------|
| 产品需求与 FR | [`moauth_prd.md`](./moauth_prd.md) |
| 架构决策 | [`uuwu_04_adr.md`](./uuwu_04_adr.md) |
| 接口契约 | [`uuwu_06_interface_contracts_boundaries.md`](./uuwu_06_interface_contracts_boundaries.md) |
| 上线验收 | [`reviews/moauth-release-readiness.md`](./reviews/moauth-release-readiness.md) |
| 文档索引 | [`uuwu_00_index.md`](./uuwu_00_index.md) |

---

## 附录 A：品牌配置

通过环境变量覆盖默认品牌（不固化早期占位名）：

```bash
NEXT_PUBLIC_IDENTITY_PRODUCT_NAME=MoYuan ID
NEXT_PUBLIC_IDENTITY_ACCOUNT_NAME=MoYuan 账号中心
NEXT_PUBLIC_IDENTITY_GATEWAY_NAME=Connect
NEXT_PUBLIC_IDENTITY_PUBLIC_DOMAIN=id.example.com
NEXT_PUBLIC_IDENTITY_ACCOUNT_URL=https://account.example.com
```

## 附录 B：常见问题

**Q：业务应用能否直接用 Zitadel 的 issuer？**
A：不能。必须只信任 Connect issuer（ADR-010）。

**Q：Connect 为什么有时不显示密码框？**
A：生产默认 Account 收密码；仅 `CONNECT_PASSWORD_LOGIN_FALLBACK=true` 时 Connect 才显示密码表单。

**Q：多实例 Account 如何用 authorized-apps？**
A：file store 仅适合单实例；多副本需 DB store（见 release-readiness 文档）。

**Q：如何确认 Connect 能连上 Account？**
A：`GET /api/health/ready` 返回 `ok: true`，或运行 `npm run test:account-health-probe`。