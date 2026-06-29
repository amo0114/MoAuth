# 1. 执行摘要与需求理解（Executive Summary & Requirements Understanding）

## 1.1 执行摘要

甲方当前的核心诉求不是在 SubBoost 中增加一个孤立的 OAuth 登录按钮，而是建设一个可复用、可扩展、可品牌化的一方统一身份系统。目标体验类似“QQ 登录”：用户注册一个 **Uuwu Account**，即可跨 SubBoost 和未来多个 Uuwu 一方业务应用完成统一登录；业务应用可将用户重定向到统一的 **Uuwu Connect** 登录/授权入口；若用户已经存在有效 SSO 会话，登录流程应快速完成；必要时展示账号选择或授权确认页面；业务应用仍保留自己的本地会话、业务权限和业务数据。

本方案建议采用 **Zitadel 作为隐藏身份认证核心（Authentication Core / IdP）**，并在其前方建设 Uuwu 品牌的 `connect.uuwu.de` 和 `account.uuwu.de`。Zitadel 负责 OAuth2/OIDC、用户、会话、令牌、MFA、Passkey、安全审计等高风险能力；Uuwu Connect / Account Center 负责用户可见品牌体验、登录流程、账号中心和业务应用接入体验。SubBoost 作为首个生产级客户端，使用标准 **OIDC Authorization Code + PKCE** 接入，并在登录成功后创建自己的本地业务 session。

---

## 1.2 高阶需求分类

### 1.2.1 功能性需求分类

| 分类 | 需求摘要 | 来源 | 验收方向 |
|---|---|---|---|
| 统一账号 | 用户注册一个 Uuwu Account，可跨多个 Uuwu 一方项目登录 | 甲方原文 | 同一 `sub` 可被 SubBoost 与第二个测试应用识别 |
| Uuwu Connect | `connect.uuwu.de` 作为 OIDC 登录、授权、账号选择、logout 入口 | 甲方原文 | 业务应用只接入标准 OIDC，不直接依赖 Zitadel Session API |
| Uuwu Account Center | `account.uuwu.de` 提供资料、邮箱、密码、MFA、Passkey、会话、授权应用管理 | 甲方原文 | 用户可完成账号安全自助操作 |
| SubBoost 首发集成 | SubBoost 增加 “Use Uuwu Account”，完成 callback、token exchange、userinfo、本地绑定、本地 session | 甲方原文 | 新用户/已有用户/未授权用户路径均通过 UAT |
| 业务应用接入标准 | 后续 Java、JavaScript、TypeScript、Go、移动端、API 服务按 OIDC 接入 | 甲方原文 | 输出接入指南和样例应用 |
| 授权与账号选择 | 已登录用户快速登录；多账号时选择账号；必要时展示授权确认 | 甲方原文 | account picker、consent 页面按策略出现 |
| 登出与会话 | 区分业务应用本地登出和 Uuwu 全局会话登出 | 架构补充 | 当前应用退出与全局退出路径清晰 |

### 1.2.2 非功能性需求分类

| 分类 | 需求摘要 | 验收方向 |
|---|---|---|
| 安全 | HTTPS、Secure/HttpOnly/SameSite Cookie、CSRF、state、nonce、PKCE、redirect URI 精确匹配、限流、审计 | 安全测试、代码审查、配置审查 |
| 性能 | 首次登录、已有 SSO 快速登录、OIDC proxy 延迟、token/userinfo 延迟可量化 | 压测、合成监控、APM |
| 可用性 | 身份入口是多应用关键基础设施，需要健康检查、告警、备份、恢复、回滚 | Runbook、故障演练 |
| 可扩展性 | 支持更多一方应用、多语言技术栈、未来移动端、API 服务 | 第二个测试应用接入成功 |
| 可维护性 | 自定义 Login App 必须可升级、可测试、可观测、可回滚 | CI/CD、自动化测试、文档 |
| 合规与审计 | 认证、注册、MFA、Passkey、授权、登出等事件可追踪 | 审计日志抽样、保留策略 |

---

## 1.3 本稿基线决策

| 决策 ID | 基线决策 | 说明 |
|---|---|---|
| BD-001 | 认证核心采用 Zitadel，Casdoor 保留为实验对照与迁移源 | Casdoor 已可用但 UI 定制上限不满足长期目标；Zitadel 官方 Login App 与 Session API 更贴合自有品牌 Connect 产品路线。 |
| BD-002 | 业务应用统一使用 OIDC Authorization Code + PKCE | 与未来多语言、多应用接入目标一致；`S256` 作为强制 PKCE 方法。 |
| BD-003 | Phase 1 可用 Hosted Login V2 做技术验证；生产 MVP 以 fork/self-host Login App 为目标 | Hosted Login 快速，但品牌和流程控制有限；Login App 更适合长期产品化。 |
| BD-004 | SubBoost 首版采用“本地账号绑定 + 本地 session” | Uuwu Connect 只证明身份；SubBoost 仍控制本地角色、权限、配额、业务审计。 |
| BD-005 | 默认注册策略：Uuwu Account 可注册；SubBoost 管理访问默认 invite/allowlist | 避免任何新注册 Uuwu 账号自动成为 SubBoost 管理员。 |
| BD-006 | Passkey MVP 先固定在 `connect.uuwu.de` 登录域 | WebAuthn/Passkey 凭据受 RP ID 与 Origin 约束，域名变化会影响可用性。 |
| BD-007 | 隐藏 Zitadel 核心不作为普通用户入口 | 用户可见品牌应为 Uuwu Account / Uuwu Connect。 |

---

## 1.4 假设与约束日志（Assumptions & Constraints Log）

| ID | 描述 | 来源 | 影响 | 验证方式 |
|---|---|---|---|---|
| A-001 | SubBoost 是首个真实业务客户端，MVP 不同时接入多个生产应用 | 甲方原文 | 范围收敛，优先验证端到端 OIDC 与本地 session | Phase 0 需求确认会签 |
| A-002 | `connect.uuwu.de` 是 OIDC 登录入口，`account.uuwu.de` 是账号中心入口 | 甲方原文 | 域名、Cookie、Passkey RP ID、回调 URL 均围绕该结构设计 | DNS、TLS、反向代理配置验收 |
| A-003 | 业务应用不得直接依赖 Zitadel Session API 作为运行时登录凭证 | 甲方原文 + 架构约束 | 防止业务应用与 IdP 内部会话耦合 | 代码审查与接口契约检查 |
| A-004 | MVP 用户规模按 500 并发认证会话、50 RPS 授权入口设计 | 架构师假设 | 影响部署规格、压测目标与成本 | 甲方提供 DAU/峰值登录数据后校准 |
| A-005 | SubBoost 当前包含本地管理员登录模型，OIDC 用户是否自动成为管理员需受控 | 甲方原文 + 风险判断 | 影响账号绑定、权限授予、UAT 用例 | 甲方确认 SubBoost 用户类型与开放策略 |
| A-006 | 生产首版不从零实现 OAuth2/OIDC Server | 甲方原文 | 降低协议实现风险与安全责任 | ADR-001 会签 |
| A-007 | 初期不建设第三方开发者市场和动态自助应用注册 | 甲方原文 | 减少管理后台与审批流程开发量 | Scope Statement 锁定 |
| A-008 | 邮件服务、DNS、TLS 证书、域名所有权由甲方提供或授权乙方配置 | 架构师假设 | 影响注册、验证、密码重置、Passkey 与部署进度 | 项目启动清单验收 |
| A-009 | 生产环境审计日志建议至少保留 365 天 | 架构师假设 | 影响日志存储、合规与成本 | 安全评审确认 |
| A-010 | Zitadel Cloud 可用于 PoC；生产是否使用 Cloud 需由甲方法务、数据合规与成本评审确认 | 架构师假设 | 影响运维责任、备份、DPA、SLA 与数据驻留 | Phase 0 架构决策门 |
| A-011 | Account Center 可在 Phase 3 交付，不阻塞 SubBoost OIDC MVP | 甲方 roadmap | 优先上线登录闭环，账号中心后续完善 | 里程碑评审 |
| A-012 | 外部社交登录不是 MVP 必须项 | 甲方原文 optional | 避免扩大范围和合规风险 | Scope Statement 锁定 |

---

## 1.5 风险与缓解措施（Risk Register）

| 风险 ID | 优先级 | 风险描述 | 触发条件 | 影响 | 缓解措施 | 责任方 |
|---|---:|---|---|---|---|---|
| R-001 | 高 | 自定义 Login UI 错误使用 Zitadel Session API，削弱认证安全模型 | 在浏览器暴露服务账号 token、跳过 session 验证、业务应用消费 session token | 账号接管、令牌泄漏、认证绕过 | Login App 采用 BFF 模式；服务账号 token 仅保存在服务端；安全代码审查；渗透测试 | 乙方 |
| R-002 | 高 | SubBoost 将 Uuwu 身份误映射为管理员权限 | 自动开户策略未受控 | 越权访问管理功能 | 默认 invite/allowlist；权限由 SubBoost 本地角色控制；UAT 覆盖未授权用户 | 甲方 + 乙方 |
| R-003 | 高 | 域名变化导致 Passkey 不可用或体验割裂 | 先在临时域启用 Passkey，后迁移到 `connect.uuwu.de` | 用户无法使用既有 Passkey | MVP 前冻结登录域；Passkey 延后到域名稳定后启用；RP ID 策略单独评审 | 甲方 + 乙方 |
| R-004 | 高 | Consent 页面能力与产品诉求不一致 | 默认 IdP 行为不满足 Uuwu 授权确认体验 | 阻塞品牌体验与多应用扩展 | Phase 0 做 consent Spike；MVP 可先做一方应用轻量授权确认，第三方复杂 consent 延后 | 乙方 |
| R-005 | 中 | Hosted Login V2 品牌定制无法完全满足 Uuwu 产品感 | 只使用 Hosted Login 而不 fork Login App | 用户看到 IdP 痕迹，产品体验不统一 | Hosted Login 仅用于技术验证；生产 MVP 切到 self-host/fork Login App | 乙方 |
| R-006 | 中 | Cookie、SameSite、跨子域回调配置不当 | 浏览器阻止 Cookie 或 CSRF 防护误伤 | 登录循环、无法回调、Safari 兼容问题 | Cookie 设计审查；浏览器矩阵测试；callback 白名单；CSRF 集成测试 | 乙方 |
| R-007 | 中 | Zitadel Cloud 与自托管切换成本被低估 | 后续合规要求强制迁移 | 延期、数据迁移风险 | 所有业务应用只依赖 OIDC Discovery 与标准 claims；避免绑定 Cloud-only 特性 | 乙方 |
| R-008 | 中 | 邮件验证、密码重置链路受垃圾邮件或域名信誉影响 | SMTP 配置不稳定，SPF/DKIM/DMARC 缺失 | 注册、找回密码失败 | 配置发信域名、模板测试、告警与重试、手动恢复流程 | 甲方 + 乙方 |
| R-009 | 中 | 审计日志量增长导致成本不可控 | 多应用接入后登录量增长 | 运维成本上升 | 日志分级、冷热存储、保留策略、脱敏 | 乙方 |
| R-010 | 低 | Casdoor / Zitadel / Ory 争议导致决策拖延 | Phase 0 未签署核心选型 | 后续设计反复 | 使用 ADR-001 在 Phase 0 签署决策 | 甲方 |
| R-011 | 中 | 用户资料同步与本地业务字段混淆 | 业务应用把 email 作为唯一主键 | 账号合并、邮箱修改后错误绑定 | 所有应用必须以 `sub` 为唯一身份映射键，email 仅作为属性 | 乙方 |
| R-012 | 中 | 全局登出预期与实际应用本地 session 行为不一致 | 用户以为“一处退出处处退出” | 安全投诉和体验误解 | MVP 明确“当前应用退出”和“全局 Uuwu 会话退出”的差异；Phase 4 再做 back-channel logout | 甲方 + 乙方 |

---

## 1.6 澄清问题列表（Clarification Questions）

| ID | 澄清问题 | 本稿默认假设 | 需确认时间点 |
|---|---|---|---|
| Q-001 | SubBoost 是面向管理员、普通用户，还是两者都有？ | MVP 按管理员/内部用户处理，自动开户关闭 | Phase 0 |
| Q-002 | Uuwu Account 是否允许公开注册？ | 允许注册 Uuwu Account，但具体应用访问需本地授权 | Phase 0 |
| Q-003 | 是否必须生产自托管 Zitadel？ | PoC 用 Zitadel Cloud；生产部署模式作为架构门决策 | Phase 0 |
| Q-004 | `account.uuwu.de` 与 `connect.uuwu.de` 是否必须 Day 1 分离部署？ | Day 1 保留两个域名；实现上可同一 Next.js 应用内分区 | Phase 0 |
| Q-005 | 是否需要正式 consent 页面？ | MVP 对一方应用展示轻量授权确认；第三方复杂 consent 延后 | Phase 1 |
| Q-006 | 是否需要外部社交登录？ | MVP 不接外部 IdP；Phase 2 后评估 Google/GitHub 等 | Phase 1 |
| Q-007 | MFA 强制策略是什么？ | 管理员类账号强制 TOTP 或 Passkey；普通账号先可选 | Phase 1 |
| Q-008 | 用户资料字段是否需要手机号、地址、生日等？ | MVP 标准 claims 为 `sub/name/email/email_verified/picture` | Phase 1 |
| Q-009 | Logout 是否需要跨所有应用立即生效？ | MVP 区分“退出当前应用”和“退出所有 Uuwu 会话”；跨应用强制同步延后 | Phase 1 |
| Q-010 | Casdoor 现有用户是否需要迁移？ | 若现有仅测试账号，则不迁移；若有真实账号，需单独迁移计划 | Phase 0 |
| Q-011 | 邮件服务由谁提供？ | 甲方提供发信域名与 SMTP/API Key，乙方配置模板 | Phase 0 |
| Q-012 | 是否有 GDPR / 德国 / EU 数据驻留要求？ | 按 EU 数据保护基线设计，具体 DPA 与数据驻留由甲方法务确认 | Phase 0 |
| Q-013 | SubBoost 的 signup allowed 策略是否按环境区分？ | dev/staging 可自动开户，prod 使用 allowlist/invite | Phase 0 |
| Q-014 | Uuwu 未来是否允许第三方开发者接入？ | Phase 4 前仅支持一方应用 | Phase 0 |
