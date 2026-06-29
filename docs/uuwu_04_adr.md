# 4. ADR（Architecture Decision Records 架构决策记录）

## ADR-001：选择 Zitadel 作为 Uuwu 隐藏认证核心

**状态**：Proposed，建议 Phase 0 签署为 Accepted。

### 上下文

甲方已部署 Casdoor 实验环境，但对 Casdoor 原生登录 UI 定制上限不满意。Uuwu 的目标不是暴露第三方 IdP 默认页面，而是建设自有品牌的 Uuwu Account / Uuwu Connect。候选包括 Casdoor、Zitadel、Ory Hydra/Kratos、自研认证核心。Zitadel 官方 Login App 提供 Next.js、OIDC proxy、Session API、账号选择、自助账号、多因素和 Passkey 能力，且 OIDC 相关端点可由 Login UI 代理到 Zitadel 后端。

### 决策

采用 **Zitadel 作为认证核心 / IdP**。Casdoor 保留为实验参照，不作为 Uuwu Connect 长期核心。Ory 作为后续替代方案保留，不进入 MVP 主线。禁止自研 OAuth2/OIDC Server。

### 备选方案与权衡

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| Zitadel | 官方支持 Hosted Login、Login App、Session API、OIDC、MFA、Passkeys、账号选择；适合自有品牌 Login UI | 需要学习 Zitadel API 与 Login App 架构；自定义 UI 需安全审查 | 采用 |
| Casdoor | 已有部署；支持 OAuth2/OIDC/SAML/WebAuthn/MFA 等能力；接入成本低 | 甲方已明确 UI 定制不满意；长期产品化 Connect 受限 | 不作为长期核心 |
| Ory Hydra + Kratos | Hydra 是 OIDC/OAuth Provider，Kratos 负责身份与自助流程；UI 控制力强 | 组合复杂度高，需要 Hydra/Kratos/Consent/Login 多组件编排 | 作为备选 |
| 自研 OIDC Server | 最大控制力 | 协议、安全、兼容、审计、令牌生命周期风险极高 | 禁止 |

### 后果

**正面影响**

- 复用成熟协议栈与安全能力。
- 业务应用只需标准 OIDC 接入。
- Uuwu 可通过自定义 Login App 控制品牌体验。
- 支持后续 MFA、Passkey、账号选择、Account Center。

**负面影响**

- 需维护 Login App 与 Zitadel API 集成。
- Zitadel 版本升级需回归测试 OIDC 与 Session API。
- Hosted Login 与 forked Login App 的功能差异需持续跟踪。

**迁移/回滚策略**

- 所有业务应用只依赖 OIDC Discovery、标准 endpoints、标准 claims。
- 若未来迁移到 Ory 或其他 IdP，应用侧主要变更 discovery URL、client 配置、claims 映射。

### 与业务目标关联

支撑“一个 Uuwu 账号、多 Uuwu 应用、标准 OIDC、Uuwu 品牌体验、不自研协议栈”的核心目标。

---

## ADR-002：生产 MVP 采用 Uuwu 自有品牌 Login App，Hosted Login V2 仅作为技术验证捷径

**状态**：Proposed。

### 上下文

Zitadel Hosted Login 可提供集中登录与品牌定制，并支持多认证方式、MFA、Passkey、自助流程；但 Hosted Login 的 UI/文案/流程控制不如自托管 Login App 灵活。官方 Login App 是可自托管的 Next.js 实现，适合更深品牌控制。

### 决策

- Phase 0/1 技术验证允许使用 Hosted Login V2 或官方 Login App 原型，以最快验证 OIDC、SubBoost、session、userinfo。
- 面向用户的生产 MVP 采用 **Uuwu 自有品牌 Login App**：优先 fork/self-host Zitadel Login App，并按 Uuwu UI 重构。
- 不从零实现 OIDC 端点；Login App 仅代理 OIDC endpoints 并调用 Zitadel Session/OIDC APIs。

### 备选方案与权衡

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| Hosted Login V2 | 最快、低维护、安全面小 | 品牌与流程定制上限较低 | 技术验证可用 |
| Fork/Self-host Login App | UI 控制强，官方模式，仍复用 Zitadel 协议能力 | 需要维护前端/BFF 与安全审查 | 生产 MVP 采用 |
| Fully Custom Account/Connect | 完全自由 | 工作量和安全风险最高 | 不用于 MVP |

### 后果

- 项目分为“技术可行性验证”和“产品级品牌体验”两个层次。
- Login App 后端必须是 confidential server/BFF，服务账号 token 不得暴露到浏览器。
- 升级 Zitadel Login App 上游版本时需要回归自定义页面与 OIDC 代理。

### 与业务目标关联

保证 Uuwu 品牌体验，同时不牺牲协议正确性与安全性。

---

## ADR-003：域名、Cookie 与 Passkey 边界策略

**状态**：Proposed。

### 上下文

甲方目标域名为 `account.uuwu.de` 和 `connect.uuwu.de`。Passkeys/WebAuthn 与 RP ID 作用域强相关，Public Key Credential 只能在其注册时绑定的 RP ID 所标识的实体范围内使用。

### 决策

1. `connect.uuwu.de`：统一 OIDC 登录、授权、账号选择、logout、Passkey 登录 ceremony。
2. `account.uuwu.de`：账号中心；涉及 Passkey 注册/验证的操作可跳转或内嵌到 `connect.uuwu.de` 安全上下文完成。
3. 隐藏 Zitadel 核心不得作为普通用户入口；必要 OIDC endpoints 通过 Connect/Login App 代理。
4. MVP 不启用跨多个无治理子域的 domain-wide RP ID。Passkey RP ID 策略在 Phase 2 安全评审后冻结。
5. Cookie 归属：
   - Connect cookie：仅 `connect.uuwu.de`，用于 Login App session/account picker。
   - Account cookie：仅 `account.uuwu.de`，用于 Account Center UI。
   - Business App cookie：仅业务应用自身域名，例如 SubBoost。
   - 不使用 `.uuwu.de` 广域业务 session cookie。

### 备选方案与权衡

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| `connect` 与 `account` Day 1 分域 | 架构清晰，符合长期产品模型 | 初始部署复杂度略高 | 采用域名分离，代码可同仓 |
| MVP 单域 `auth.uuwu.de` | 简单快速 | 后续 Passkey、品牌与迁移风险 | 只可做内部 PoC |
| `.uuwu.de` 广域 cookie | 跨子域共享方便 | 安全面扩大，不利于业务边界 | 禁止业务 session 使用 |

### 后果

- 用户认知清晰：登录授权看 Connect，资料安全看 Account。
- Cookie 隔离降低跨应用风险。
- Passkey 上线前必须冻结登录域名与 RP ID。

### 与业务目标关联

保障 Uuwu 品牌一致性、安全边界与未来多应用可扩展性。

---

## ADR-004：业务应用统一采用 OIDC Authorization Code + PKCE，并保留本地 session

**状态**：Accepted 建议。

### 上下文

甲方明确要求业务应用使用标准 OIDC，不直接依赖 proprietary session APIs。OIDC 是 OAuth 2.0 之上的身份层，可向客户端提供身份验证结果与用户资料。OAuth 2.0 安全最佳实践建议 PKCE 用于 OAuth 客户端，并推荐 S256。

### 决策

所有 Uuwu 一方业务应用采用：

```text
OIDC Authorization Code + PKCE
Scopes: openid profile email
Claims: sub, name, email, email_verified, picture
Business mapping: Uuwu sub -> local app user ID
```

业务应用登录成功后必须建立自己的本地 session，并在本地管理角色、权限、配额、业务审计。

### 备选方案与权衡

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| OIDC Code + PKCE | 标准、安全、跨语言生态成熟 | 需要每个应用实现回调与 session | 采用 |
| 业务应用直接读 Zitadel Session | 接入看似简单 | 与 IdP 内部 session 耦合，令牌语义错误 | 禁止 |
| 统一反向代理注入用户头 | 对老系统接入快 | 复杂授权与 CSRF/SSRF/边界风险 | 后续特定场景评估 |

### 后果

- 新应用接入有统一模式。
- Identity 与业务权限解耦。
- 每个应用需完成本地 session、CSRF 与权限控制。

### 与业务目标关联

支撑未来 Java、JavaScript、TypeScript、Go、移动端与 API 服务接入。

---

## ADR-005：SubBoost 本地账号供应策略采用 invite/allowlist 优先

**状态**：Proposed。

### 上下文

SubBoost 当前存在本地管理员登录模型。若任何 Uuwu 新注册账号都能自动进入 SubBoost，存在管理后台越权风险。

### 决策

SubBoost MVP 默认策略：

1. Uuwu Account 可注册。
2. SubBoost 管理功能访问需满足本地 allowlist、邀请、预创建账号或管理员批准。
3. 若本地账号已绑定 `uuwu_subject_id`，直接登录并同步基础资料。
4. 若本地账号未绑定但邮箱匹配已批准账号，执行一次性绑定。
5. 若未批准，显示 `APP_ACCESS_DENIED`，不创建 SubBoost session。

### 备选方案与权衡

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| 自动创建 SubBoost 用户 | 用户体验最好 | 管理后台风险高 | 不用于管理员 MVP |
| Invite/allowlist | 安全可控 | 需要管理员配置 | 采用 |
| 纯手动绑定 | 风险最低 | 运营成本高 | 作为高敏环境可选 |

### 后果

- 保护 SubBoost 业务权限边界。
- 需要提供管理员配置 allowlist 的流程或数据库初始化脚本。
- 普通用户产品化时可为不同 client 配置不同 provisioning policy。

### 与业务目标关联

满足“身份层负责身份，业务应用负责本地权限”的边界原则。

---

## ADR-006：Consent 首版采用一方应用轻量授权确认，复杂授权市场延后

**状态**：Proposed。

### 上下文

甲方需要用户在必要时看到授权或账号选择页面。Uuwu 当前仅面向一方应用，不建设第三方开发者市场。

### 决策

MVP consent 策略：

1. 一方应用首次登录展示轻量授权确认页：应用名称、logo、请求资料、隐私说明。
2. 若应用是 Uuwu 内部可信应用，可配置“首次确认后记住”。
3. 第三方应用、细粒度 scope、用户撤销授权、动态 consent 文案进入 Phase 4+。
4. 若 Zitadel 当前 consent 行为无法满足 Uuwu UI，则在 Connect/Login App 中实现轻量展示，但不绕过 Zitadel 授权语义。

### 备选方案与权衡

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| 不展示 consent | 最快 | 用户透明度不足 | 不推荐 |
| 一方轻量 consent | 平衡透明度与复杂度 | 需维护应用元数据 | 采用 |
| 完整第三方 consent 平台 | 可扩展到开放生态 | 远超 MVP 范围 | 延后 |

### 后果

- 用户理解“正在授权哪个 Uuwu 应用”。
- 应用元数据需纳入 client 配置。
- 复杂授权撤销进入 Account Center 后续增强。

### 与业务目标关联

增强信任感和品牌体验，为未来多应用接入打基础。

---

## ADR-007：部署策略采用“Cloud PoC + 可迁移生产架构”基线

**状态**：Proposed。

### 上下文

甲方候选部署模型包括 Zitadel Hosted Login、fork/self-host Login App、完全自定义 Account/Connect。Zitadel 可采用 Cloud 或 self-hosted 两类部署方式。Cloud 适合快速启动，self-hosted 适合完全控制组件和环境。

### 决策

1. Phase 0/1 技术验证默认使用 Zitadel Cloud 测试租户或轻量自托管测试实例。
2. 生产部署在 M0 决策门二选一：
   - **推荐默认**：Zitadel Cloud + Uuwu custom domain + self-host Uuwu Login App。
   - **合规优先**：self-hosted Zitadel + self-host Uuwu Login App。
3. 无论选择 Cloud 还是 self-host，业务应用只依赖 OIDC 标准接口，不依赖环境私有 API。

### 备选方案与权衡

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| Zitadel Cloud | 启动快、运维负担低 | 需法务确认 DPA、数据驻留、SLA | 默认 PoC，生产可选 |
| Self-hosted Zitadel | 控制力强、可隐藏核心 | 运维、备份、升级责任高 | 合规优先场景采用 |
| 完全自托管 + 自研 UI/协议 | 控制最大 | 风险最大 | 不采用 |

### 后果

- 早期交付速度与长期可控性兼顾。
- 需明确 Cloud 到 self-host 的数据迁移策略。
- Secret、备份、版本升级、监控策略需按最终部署模式细化。

### 与业务目标关联

支持快速验证 SubBoost，同时为长期统一身份平台保留部署自主权。

---

## ADR-008：Connect Login App 使用 Zitadel Session API v2 完成密码登录与单会话 Continue

**状态**：Accepted for Phase 1 PoC。

### 上下文

Phase 1 需要证明用户只通过 Connect 登录页即可完成 OIDC Authorization Code + PKCE 闭环，同时隐藏 Zitadel 真实域名和默认登录页。Connect 既要代理 OIDC endpoints，又要通过服务端 BFF 调用 Zitadel Session API v2 创建认证 session 并 finalize authRequest。

本次 PoC 还验证了一个账号选择最小闭环：用户首次登录时选择保持登录，Connect 将 Zitadel `sessionId`、`sessionToken` 与 `loginName` 存入签名 HttpOnly cookie；下一次新的 authRequest 可通过 `/api/login/continue` 复用该 session 直接 finalize，而不重新输入密码。

### 决策

1. 密码登录由 Connect BFF 调用 Zitadel Session API v2，浏览器只提交 `authRequest`、`loginName`、`password` 与 `rememberSession` 到 `POST /api/login`。
2. authRequest finalize 必须调用 Zitadel v2 CreateCallback，并使用嵌套 payload：

```json
{
  "session": {
    "sessionId": "sess_123",
    "sessionToken": "token_abc"
  }
}
```

3. 服务用户必须拥有 `IAM_LOGIN_CLIENT` 角色，以获得 finalize 所需的 `session.link` 权限。
4. 记住登录状态时，Connect 写入签名 HttpOnly cookie `moauth_connect_session`。生产环境必须配置 `MOAUTH_CONNECT_SESSION_SECRET`，不得使用开发默认值。
5. `/api/login/continue` 只能从服务端读取 cookie 中的 `sessionId` 和 `sessionToken` 并 finalize 新 authRequest；不得把 `sessionToken` 暴露给前端 JavaScript。
6. Connect OIDC proxy 只改写必要的边界字段：discovery URL/issuer、OIDC redirect `Location` header、Set-Cookie Domain。token、userinfo、authorization code 与 client callback 语义保持 Zitadel 原样。
7. Zitadel 返回相对 `Location`（如 `/ui/v2/login?authRequest=...`）时，Connect proxy 必须补全为 Connect issuer 下的绝对 URL，避免 Next.js redirect adapter 处理相对 URL 失败。

### 备选方案与权衡

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| Connect BFF + Zitadel Session API v2 | 隐藏 Zitadel；保留自定义 UI；业务应用只接 OIDC | 需要维护 BFF、PAT 权限和 Session API 契约 | 采用 |
| 直接跳转 Zitadel Hosted Login | 实现最快、安全面小 | 用户看到 Zitadel/Hosted UI；品牌与流程控制不足 | 仅可作为早期技术验证 |
| 业务应用直接调用 Zitadel Session API | 接入看似简单 | 业务应用获得 IdP 内部 session 语义，破坏边界 | 禁止 |
| 前端保存 session token | 实现 continue 简单 | 增加 token 泄漏风险 | 禁止 |

### 验证结果

- password flow 已验证：authorize -> `/api/login` -> token exchange -> userinfo。
- continue flow 已验证：remembered cookie -> new authorize -> `/api/login/continue` -> token exchange。
- id token `iss` 通过 proxy 暴露为 Connect issuer，而非 Zitadel 真实域。
- 单元测试覆盖：CreateCallback nested body、403 `session.link` 权限提示、relative `Location` rewrite、continue cookie 成功/失败路径。

### 后果

- Connect 成为用户可见的 Login App 和 OIDC proxy，Zitadel 继续作为隐藏认证核心。
- 后续 Passkey/WebAuthn 必须沿用 BFF 模式，并在生产前冻结 Connect 域名/RP ID。
- 多账号 picker 可在当前单会话 continue 契约上扩展，但需要设计多个 remembered session 的安全存储和展示规则。

### 与业务目标关联

该决策完成 Phase 1 的核心验证：自定义 Connect 登录体验、标准 OIDC + PKCE 客户端接入、隐藏 Zitadel、并为账号选择和后续 MFA/Passkey 流程建立可复用边界。
