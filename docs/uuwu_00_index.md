# Uuwu Unified Identity / Connect 交付文档包

**版本**：v1.0  
**交付身份**：乙方解决方案架构师 / 企业架构师  
**目标用途**：需求确认、合同谈判、项目启动、技术评审、实施指导  
**输入基线**：甲方《Uuwu Unified Identity / Connect Requirements Draft》  
**输出格式**：Markdown 分卷文档，可直接纳入 Git 仓库进行版本控制。

---

## 文档结构

| 文件 | 内容 | 建议评审对象 |
|---|---|---|
| `uuwu_00_index.md` | 文档包索引、基线结论、评审顺序、参考基线、版本管理建议 | 全体评审参与方 |
| `uuwu_01_executive_summary.md` | 执行摘要、需求理解、假设约束、风险、澄清问题 | 甲方决策层、产品负责人、技术负责人 |
| `uuwu_02_prd.md` | 专业 PRD：目标、用户画像、FR/NFR、数据集成、验收标准 | 产品、研发、测试、安全、运维 |
| `uuwu_03_delivery_contract.md` | 交付契约：范围、交付物、里程碑、RACI、变更、付款、依赖 | 商务、法务、项目管理、交付负责人 |
| `uuwu_04_adr.md` | 架构决策记录 ADR：Zitadel、Login App、域名 Cookie、OIDC、部署等 | 架构委员会、研发负责人、安全负责人 |
| `uuwu_05_wbs_implementation_plan.md` | 任务拆分与实施计划：WBS、任务表、团队、Spike | 项目经理、研发、测试、DevOps |
| `uuwu_06_interface_contracts_boundaries.md` | 接口契约与实施边界：C4 图、接口、错误码、序列图、DoD | 后端、前端、客户端、测试、安全、运维 |
| `uuwu_99_full_combined.md` | 完整合并版，按 `00` 至 `06` 顺序汇总全部内容 | 需要单文件审阅、归档或发送的评审方 |

---

## 基线结论摘要

1. **目标不是“给 SubBoost 加一个第三方登录按钮”**，而是建设可复用的一方统一身份产品：Uuwu Account + Uuwu Connect。
2. **Zitadel 建议作为隐藏认证核心（IdP/Auth Core）**，负责协议、用户、会话、MFA、Passkey、令牌与审计；Uuwu 自有 Connect/Login UI 负责用户可见体验。
3. **业务应用统一采用 OIDC Authorization Code + PKCE**，并在应用内保留本地 session、业务角色、权限、审计与业务数据。
4. **SubBoost 是首个落地应用**，MVP 必须证明注册/登录/SSO 快速登录/OIDC callback/userinfo/本地账号绑定/本地 session 的完整闭环。
5. **生产 MVP 推荐 fork 或 self-host Zitadel Login App**，Hosted Login V2 可用于 Phase 0/1 快速技术验证。
6. **`connect.uuwu.de` 与 `account.uuwu.de` 建议从 Day 1 保留域名边界**；实现上可先同仓/同服务分区部署，避免后续 Passkey、Cookie、品牌与用户认知迁移成本。
7. **SubBoost 首版默认 invite/allowlist**，防止任何 Uuwu 新注册账号自动成为 SubBoost 管理员。

---

## 推荐评审顺序

1. 先评审 `uuwu_01_executive_summary.md`，确认业务目标、范围、假设和风险。
2. 再评审 `uuwu_04_adr.md`，锁定关键架构选择，避免后续反复。
3. 接着评审 `uuwu_02_prd.md` 和 `uuwu_06_interface_contracts_boundaries.md`，确认需求与接口。
4. 最后评审 `uuwu_03_delivery_contract.md` 和 `uuwu_05_wbs_implementation_plan.md`，进入商务与实施计划。

---

## 外部标准与参考基线

| 类别 | 官方来源 | URL | 访问日期 | 本方案采用基线 |
|---|---|---|---|---|
| OIDC 身份层 | OpenID Connect Core 1.0 incorporating errata set 2 | [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) | 2026-06-28 | OIDC 是构建在 OAuth 2.0 之上的身份层，用于让客户端验证最终用户身份并获取基本用户资料。 |
| OAuth 安全实践 | RFC 9700：Best Current Practice for OAuth 2.0 Security | [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html) | 2026-06-28 | Authorization Code Flow 应结合 PKCE；本方案将 `S256` 设为强制要求。 |
| Zitadel Login UI / Login App | ZITADEL Docs：Build your own Login UI、Login App、OIDC endpoints、Session API | [Build your own Login UI](https://zitadel.com/docs/guides/integrate/login-ui)；[Login App](https://zitadel.com/docs/guides/integrate/login-ui/login-app)；[OpenID Connect Endpoints in ZITADEL](https://zitadel.com/docs/apis/openidoauth/endpoints)；[Session API](https://zitadel.com/docs/reference/api/session)；[ZITADEL login app source](https://github.com/zitadel/zitadel/tree/main/apps/login) | 2026-06-28 | Zitadel Login UI/Login App 路线支持自定义登录体验；OIDC endpoints 可按自定义域暴露；Session API 用于自定义登录流程中的 session 创建、校验与 MFA/Passkey 等认证步骤。 |
| WebAuthn / Passkey | W3C Web Authentication Level 3 | [Web Authentication: An API for accessing Public Key Credentials Level 3](https://www.w3.org/TR/webauthn-3/) | 2026-06-28 | Passkey/Public Key Credential 与 WebAuthn Relying Party、RP ID、Origin 作用域绑定，登录域名与 RP ID 策略必须在上线前冻结。 |

---

## 版本管理建议

| 字段 | 建议 |
|---|---|
| 文档仓库 | `uuwu-identity-docs` 或项目根目录 `/docs/identity/` |
| 分支策略 | `main` 保存已签署版本，`draft/*` 保存评审版本 |
| 版本命名 | `v1.0-contract-baseline`、`v1.1-post-uat` |
| 变更管理 | 所有新增需求、指标调整、域名变更、部署模式变更必须创建 Change Request |
| 会签对象 | 甲方产品负责人、甲方技术负责人、甲方法务/商务、乙方交付负责人、乙方架构师 |
