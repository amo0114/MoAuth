# 3. 交付契约（Delivery Contract / 项目契约）

## 3.1 项目范围声明（Scope Statement）

### 3.1.1 In-Scope

| 编号 | 范围项 | 验收口径 |
|---|---|---|
| S-I-001 | Uuwu 统一身份总体架构设计 | PRD、ADR、组件图、序列图、边界说明会签 |
| S-I-002 | Zitadel 租户/实例、项目、应用、OIDC client 配置 | SubBoost client 可完成标准 OIDC 登录 |
| S-I-003 | `connect.uuwu.de` 登录入口 | 登录、注册、忘记密码、错误页、SSO session 检测可用 |
| S-I-004 | Uuwu 品牌化 UI | 正常用户流程不出现 Casdoor/Zitadel 默认品牌页面 |
| S-I-005 | SubBoost OIDC 接入 | 登录按钮、authorize、callback、token exchange、userinfo、本地 session |
| S-I-006 | SubBoost 本地账号绑定策略 | `uuwu_subject_id` 与本地用户绑定，未授权用户不可登录管理功能 |
| S-I-007 | Logout 策略 | 支持当前应用退出；支持跳转全局退出流程 |
| S-I-008 | Cookie 与域名策略 | Connect、Account、SubBoost cookie 归属清晰并通过浏览器测试 |
| S-I-009 | 安全基线 | HTTPS、CSRF、state、PKCE、redirect URI、限流、审计 |
| S-I-010 | 基础运维能力 | CI/CD、环境变量、secret 管理、日志、指标、告警、备份、回滚 |
| S-I-011 | Phase 3 Account Center | 资料、邮箱、密码、MFA/Passkey、session、授权应用基础管理 |
| S-I-012 | Phase 4 接入套件 | OIDC 接入文档、Next.js、Java/Spring、Go 示例 |

### 3.1.2 Out-of-Scope

| 编号 | 不做项 | 理由 |
|---|---|---|
| S-O-001 | 从零实现 OAuth2/OIDC Server | 协议复杂且安全责任高；甲方原则明确禁止 |
| S-O-002 | 第三方开发者市场 | MVP 目标是一方项目统一登录 |
| S-O-003 | 复杂企业 IAM / SCIM / 外部企业 SAML 联邦 | 超出首版业务价值，后续按企业客户需求评估 |
| S-O-004 | 业务应用统一共享 session | 违反边界原则；应用需本地 session |
| S-O-005 | 将 SubBoost 业务权限迁入身份层 | 身份层只表达身份，不承载业务授权 |
| S-O-006 | 移动 App 原生 Passkey 深度集成 | Phase 4 后按移动端需求单独设计 |
| S-O-007 | 所有历史 Casdoor 用户自动迁移 | 需确认是否存在真实用户；若存在，作为独立迁移工作包 |
| S-O-008 | 生产法务条款最终文本 | 本稿只提供高阶建议，正式合同由法务确认 |

---

## 3.2 交付物清单（Deliverables）

| ID | 交付物 | 内容 | 验收标准 |
|---|---|---|---|
| D-001 | 最终 PRD | 需求、KPI、范围、FR/NFR、UAT 标准 | 甲方产品/技术负责人签字 |
| D-002 | ADR 集 | 关键架构决策 5+ 条 | 决策状态 Accepted 或带明确待确认项 |
| D-003 | 系统架构图 | Context、Container、核心序列图 | 甲方技术评审通过 |
| D-004 | Zitadel 配置清单 | instance/tenant/project/app/client/scopes/redirect URI | 配置可复现 |
| D-005 | Uuwu Connect/Login App | 登录、注册、密码重置、账号选择、错误页、基础 consent | UAT 通过 |
| D-006 | SubBoost OIDC 集成代码 | 登录按钮、回调、token/userinfo、用户绑定、本地 session | 测试通过并合并 |
| D-007 | Account Center | 资料、密码、MFA/Passkey、session、授权应用基础管理 | Phase 3 UAT 通过 |
| D-008 | 安全设计与测试报告 | OIDC 校验、Cookie、CSRF、限流、审计、漏洞扫描 | 无阻断级问题 |
| D-009 | 运维 Runbook | 部署、回滚、备份恢复、告警处理、日志查询 | 演练通过 |
| D-010 | 接入指南 | Next.js、Java/Spring、Go、通用 OIDC 模板 | 新测试应用按指南接入成功 |
| D-011 | 培训材料 | 管理员、开发者、运维交接 | 培训完成并有签到/录屏 |
| D-012 | 生产上线计划 | 灰度、监控、回滚、通知、值守安排 | 甲方上线评审通过 |

---

## 3.3 里程碑与高阶时间表

> 实际日历排期需结合甲方环境准备、决策效率与人员排期在合同中锁定；以下作为相对里程碑与验收门。

| 里程碑 | 阶段 | 主要成果 | 入口标准 | 出口标准 |
|---|---|---|---|---|
| M0 | 需求细化与架构决策 | PRD v1、ADR、域名/部署/核心选型确认 | 草稿评审完成 | ADR-001/002/003 会签 |
| M1 | OIDC 技术验证 | Zitadel tenant、SubBoost 测试 client、Code + PKCE 跑通 | DNS/TLS/测试环境可用 | 新用户和已有用户可登录 SubBoost 测试环境 |
| M2 | Uuwu Connect MVP | 品牌登录、注册、密码重置、错误页、session 检测 | M1 通过 | 正常流程不展示第三方默认 UI |
| M3 | SubBoost 生产级集成 | 本地账号绑定、本地 session、allowlist、logout、审计 | M2 通过 | UAT 全量通过 |
| M4 | 安全与运维加固 | 压测、安全测试、监控、备份、回滚 | M3 代码冻结 | 无阻断级问题，Runbook 演练通过 |
| M5 | Account Center | 资料、密码、MFA/Passkey、session、授权应用 | M4 通过 | Phase 3 UAT 通过 |
| M6 | Multi-App Integration Kit | 多语言接入指南与示例 | M5 通过 | 第二个测试应用按指南接入成功 |

---

## 3.4 责任矩阵（RACI Matrix）

| 工作项 | 甲方产品 | 甲方技术/运维 | 乙方架构师 | 乙方开发 | 第三方/供应商 |
|---|---|---|---|---|---|
| 需求确认 | A | C | R | C | I |
| 架构决策 | C | A | R | C | I |
| 域名/DNS/TLS 准备 | I | A/R | C | C | C |
| Zitadel 选型与配置 | C | A | R | R | C |
| Connect UI 设计 | A | C | R | R | I |
| SubBoost 接入 | C | A/R | C | R | I |
| 邮件服务配置 | C | A/R | C | R | C |
| 安全测试 | C | A | R | R | C |
| UAT | A/R | R | C | C | I |
| 生产部署 | I | A/R | C | R | C |
| 运维交接 | A | R | R | C | I |
| 变更审批 | A | A | R/C | C | I |

说明：R = Responsible，A = Accountable，C = Consulted，I = Informed。

---

## 3.5 变更管理流程

### 3.5.1 流程

1. **提出变更**：任何新增范围、指标调整、技术栈变更、域名变更、上线策略变更必须提交 Change Request。
2. **影响分析**：乙方评估对范围、工期、成本、风险、安全、兼容性、运维的影响。
3. **方案评审**：甲乙双方评审是否纳入当前阶段、后续阶段或拒绝。
4. **审批签署**：甲方授权人书面确认后进入执行。
5. **基线更新**：更新 PRD、ADR、WBS、接口契约、验收标准与付款里程碑。
6. **实施与验证**：按变更验收标准完成测试与会签。

### 3.5.2 影响分析模板

| 字段 | 内容 |
|---|---|
| CR ID | CR-YYYYMMDD-XXX |
| 变更标题 | 例如：MVP 增加 Google 外部登录 |
| 变更原因 | 业务价值/合规要求/技术约束 |
| 影响范围 | PRD、ADR、代码、测试、部署、文档 |
| 工作量影响 | 人天/故事点 |
| 时间影响 | 影响的里程碑 |
| 成本影响 | 人力、云资源、第三方服务 |
| 风险影响 | 新增风险与缓解措施 |
| 安全影响 | 是否需额外安全评审 |
| 验收标准 | Given-When-Then 或测试项 |
| 审批人 | 甲方授权人、乙方项目负责人 |

---

## 3.6 验收与付款里程碑建议

| 付款节点 | 对应里程碑 | 建议比例 | 付款条件 |
|---|---|---:|---|
| P-001 | M0 完成 | 15% | PRD/ADR/范围基线会签 |
| P-002 | M1 完成 | 20% | SubBoost 测试环境 OIDC 跑通 |
| P-003 | M3 完成 | 30% | Uuwu Connect MVP + SubBoost UAT 通过 |
| P-004 | M4 完成 | 20% | 安全、压测、运维演练通过 |
| P-005 | M6 或项目收尾 | 15% | 文档、培训、交接、二应用示例验收 |

---

## 3.7 知识产权与保密条款高阶建议

| 条款 | 建议 |
|---|---|
| 业务代码 IP | 为甲方定制开发的 Connect UI、SubBoost 集成代码、配置模板归甲方所有 |
| 第三方开源 | Zitadel、OIDC SDK、UI 组件等遵循各自开源许可证；交付时提供 SBOM |
| 乙方通用方法论 | 乙方保留通用架构方法、模板、非甲方专属经验 |
| 密钥与数据 | 乙方不得在本地长期保存生产 secret、用户数据、备份文件 |
| 保密 | 域名、client secret、用户数据、架构细节、漏洞报告均为保密信息 |
| 安全漏洞披露 | 发现高危漏洞后应在约定时限内通知甲方并提供修复方案 |

---

## 3.8 假设与依赖

| 依赖 ID | 依赖项 | 提供方 | 缺失影响 |
|---|---|---|---|
| DEP-001 | `uuwu.de` DNS 管理权限 | 甲方 | 无法配置 `connect/account` 域名 |
| DEP-002 | TLS 证书或证书自动化权限 | 甲方/乙方 | 无法满足 HTTPS 与 WebAuthn 要求 |
| DEP-003 | 邮件发送域名、SMTP/API Key | 甲方 | 注册验证、密码重置不可用 |
| DEP-004 | SubBoost 代码仓库和部署权限 | 甲方 | 无法实现集成 |
| DEP-005 | 测试用户与测试邮箱 | 甲方 | UAT 阻塞 |
| DEP-006 | 生产部署环境与 secret 管理 | 甲方/乙方 | 上线阻塞 |
| DEP-007 | 法务对 Zitadel Cloud/DPA 的确认 | 甲方 | 生产核心部署模式无法锁定 |
| DEP-008 | UI 品牌规范 | 甲方 | 品牌化体验无法验收 |
| DEP-009 | SubBoost 用户表、权限模型、登录现状说明 | 甲方 | 本地账号绑定策略无法落地 |
