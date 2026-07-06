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
| **`moauth_prd.md`** | **PRD v2.0（产品主基线）**：产品矩阵、Connect/Account/Console 职责、分阶段路线、会签级 FR | **全体评审参与方（优先）** |
| **`moauth_product_guide.md`** | **产品使用指南**：产品定义、架构、特性、本地启动、接入、部署与验收（面向研发/运维/接入方） | 研发、运维、业务应用负责人 |
| **`guides/moauth-app-onboarding-monexus.md`** | **应用接入教程（MoNexus 示例）**：Zitadel/Connect 注册、OIDC 路由、token 校验、provisioning、联调与上线 | 新业务应用研发 |
| `uuwu_00_index.md` | 文档包索引、基线结论、评审顺序、参考基线、版本管理建议 | 全体评审参与方 |
| `uuwu_01_executive_summary.md` | 执行摘要、需求理解、假设约束、风险、澄清问题 | 甲方决策层、产品负责人、技术负责人 |
| `uuwu_02_prd.md` | 专业 PRD v1（历史稿）；与 `moauth_prd.md` 冲突时以 v2 为准 | 产品、研发、测试、安全、运维 |
| `uuwu_03_delivery_contract.md` | 交付契约：范围、交付物、里程碑、RACI、变更、付款、依赖 | 商务、法务、项目管理、交付负责人 |
| `uuwu_04_adr.md` | 架构决策记录 ADR：Zitadel、Login App、域名 Cookie、OIDC、部署等 | 架构委员会、研发负责人、安全负责人 |
| `uuwu_05_wbs_implementation_plan.md` | 任务拆分与实施计划：WBS、任务表、团队、Spike | 项目经理、研发、测试、DevOps |
| `uuwu_06_interface_contracts_boundaries.md` | 接口契约与实施边界：C4 图、接口、错误码、序列图、DoD | 后端、前端、客户端、测试、安全、运维 |
| `uuwu_99_full_combined.md` | 完整合并版，按 `00` 至 `06` 顺序汇总全部内容 | 需要单文件审阅、归档或发送的评审方 |

---

## 基线结论摘要

> **2026-06-30 更新**：产品定义以 [`moauth_prd.md`](./moauth_prd.md) **v2.1（已会签）** 为主基线。以下为摘要。

1. **目标不是“给 SubBoost 加一个第三方登录按钮”**，而是建设可复用统一身份产品：**Account（注册与账号管理）+ Connect（登录与 OIDC 网关）+ Console（应用配置）**。
2. **ZITADEL 作为隐藏认证核心（自部署为目标形态）**；终端用户只见 Connect / Account 品牌体验。
3. **注册、邮箱验证、找回密码归 Account**；Connect 仅提供登录、授权、SSO 与跳转入口。
4. **业务应用统一 OIDC Authorization Code + PKCE**，保留本地 session 与权限；**新增应用通过 Console 配置，不改 Connect 核心代码**。
5. **SubBoost 是首个验证应用**；默认 allowlist，统一身份注册成功不自动获得 SubBoost 管理权限。
6. **`connect.*` 与 `account.*` 分域名**；品牌名通过配置注入，不固化早期占位名 Uuwu。
7. **推荐实施顺序**：P1 Connect 基础 → **P2 Account MVP** → P3 SubBoost 闭环 → P4 应用管理后台。

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
