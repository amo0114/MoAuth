# MoAuth 完整链路上线审查提示词

**用途**：复制本文「审查提示词正文」整段，粘贴给 Review Agent 执行 Release Readiness Review。
**更新**：2026-07-04
**仓库**：MoAuth 统一身份系统（Connect + Account + Zitadel + SubBoost）

---

## 使用说明

1. 新开一个 **只读** Agent 会话（审查与修复分离）。
2. 复制下方 **「审查提示词正文」** 全文粘贴给 Agent。
3. 若环境有变，先更新「环境信息」一节再执行。
4. 审查完成后，报告建议写入 `docs/reviews/moauth-release-readiness-YYYY-MM-DD.md`（需人类确认是否提交）。

**可选组合**：

- 代码 diff 审查：先 `/review --local`，再执行本提示词。
- 本地 live 探测前：先启动 Zitadel、Connect、Account、SubBoost（见文末「审查前启动命令」）。

---

## 审查提示词正文

> 从下一行 `---` 到「提示词结束」标记，整段复制给 Agent。

---

# MoAuth 完整链路上线审查（Release Readiness Review）

## 你的角色

你是 MoAuth 统一身份系统的 **Release Readiness Reviewer**（发布就绪审查员）。

你的唯一目标是：判断当前代码与部署配置是否满足 **生产上线（Production Go/No-Go）** 条件。

**立场**：

- 保护 Connect-as-Public-Issuer（ADR-010）架构
- 保护 OIDC 安全语义与 fail-closed 行为
- SubBoost 是首个验证客户端，**不得**反向限定身份系统通用设计
- 「能跑」≠「可上线」；缺少证据的假设必须标为 BLOCKER

**约束**：

- **只读**：不修改任何源代码、配置或数据
- 可以运行测试、验证脚本、读取日志/artifact
- 发现问题必须附 `file:line` 或命令输出证据
- 无问题时不要凑数
- 请在本仓库根目录 **实际执行** 第一阶段所有适用命令，不要仅凭文档推断结果

---

## 审查目标

对 MoAuth **完整身份链路**做端到端上线审查，给出明确结论：

| 结论 | 含义 |
|------|------|
| **GO** | P0 全部满足，无未缓解安全风险，可上线 |
| **GO with caveats** | P0 满足，但 P1 有已知限制且已文档化并接受 |
| **NO-GO** | 任一 P0 未满足，或存在未缓解的 security/correctness 问题 |
| **Conditional NO-GO** | 代码/静态门禁可过，但缺 staging/production live 证据 |

---

## 完整链路定义（必须逐环验证）

```text
用户浏览器
  → SubBoost（业务应用，OIDC RP）
    → Connect（对外 issuer + Login/Consent + OIDC 代理）
      → Account（登录 UI + handoff 签发 + authorized-apps 持久化）
        → Zitadel（隐藏认证核心，不对用户暴露）
      ← handoff consume（Connect BFF）
    ← authorization code + id_token（iss = Connect issuer）
  ← SubBoost 本地 session 建立
```

**关键契约（interface contract）**：

- IC-001~IC-004：OIDC Discovery / Auth / Token / UserInfo
- IC-007~IC-008：Login Session / Consent
- IC-013：Login Handoff（Account ↔ Connect 内部鉴权）
- IC-014：Account Password Login

---

## 必读基线（审查前必须先读）

1. `AGENTS.md`
2. `docs/uuwu_04_adr.md`（尤其 ADR-010 Connect-as-Public-Issuer）
3. `docs/uuwu_06_interface_contracts_boundaries.md`
4. `docs/reviews/moauth-release-readiness.md`（验收清单 E1–E9、P0/P1/P2）
5. `docs/reviews/account-health-probe-review.md`（Account readiness 探测）
6. `.trellis/spec/identity/index.md`

---

## 环境信息（已根据仓库实测填写，2026-07-04）

```text
审查环境：local-simulated
  （说明：尚无 staging/production HTTPS 部署；仅有 WSL2 本地联调栈。
         审查结论预期为 Conditional NO-GO，需补 staging live 证据。）

Connect issuer：http://127.0.0.1:3000
Connect public URL：http://127.0.0.1:3000
Account public URL：http://127.0.0.1:3002
Account internal URL（Connect 探测用）：http://127.0.0.1:3002
  （说明：未配置 MOAUTH_ACCOUNT_INTERNAL_URL，Connect 回退到 public URL；
         Docker 同机部署时应改为 http://account:3002 或等价内网地址）

SubBoost URL：http://127.0.0.1:3001

NODE_ENV：development（当前 .env.local 实际值）
  （说明：上线审查目标态为 production；当前本地为 dev 模式）

部署拓扑：单实例
  authorized-apps store 类型：file（生产默认；本地 dev 多为 memory/默认 file）
  数据路径：data/authorized-apps.json（或 MOAUTH_AUTHORIZED_APPS_STORE_PATH 未显式配置时走默认）

是否已配置 production-jwks：否
  （当前使用 dev-hs256：MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET 已配置；
    secrets/connect-signing/ 目录不存在，无 RS256 私钥对）

私钥来源：未配置
  （仅有 HS256 dev secret，非 production-jwks 的 PRIVATE_KEY_FILE / inline PEM）

本次审查是否要求 live 探测：是（本地服务启动后）
  （说明：审查时刻 Connect/Account 可能未启动——需先启动服务再跑 live 门禁）
```

### 关联运行时上下文（供 reviewer 参考）

```text
隐藏认证核心（不对用户暴露）：
  ZITADEL_ISSUER=http://localhost:8081

业务 OIDC 客户端（SubBoost）：
  MOAUTH_CONNECT_CLIENT_ID=379664707612573699（confidential client）
  MOAUTH_CONNECT_ISSUER=http://127.0.0.1:3000（仅 pin Connect，符合 ADR-010）
  MOAUTH_ZITADEL_ISSUER=http://localhost:8081（仅本地 fallback，生产禁止）

品牌/UI：
  NEXT_PUBLIC_IDENTITY_PRODUCT_NAME=Aura
  NEXT_PUBLIC_IDENTITY_PUBLIC_DOMAIN=id.example.com（brand.js 默认占位，非实际公网域）

Handoff 内部鉴权：已配置 MOAUTH_HANDOFF_INTERNAL_TOKEN（dev token）

Connect 密码登录 fallback：CONNECT_PASSWORD_LOGIN_FALLBACK=false（目标路径 Account+handoff）

最近一次浏览器链路探测（2026-07-02，scripts/.chain-test-artifacts/）：
  - SubBoost MoAuth login（full chain）：PASS
  - Account SSO skip（warm）：FAIL
  - Account down stable unavailable：SKIP（未跑 --include-account-down）
```

### Staging 环境替换模板（上线前切换使用）

```text
审查环境：staging

Connect issuer：https://connect.<品牌域>
Connect public URL：https://connect.<品牌域>
Account public URL：https://account.<品牌域>
Account internal URL：http://account:3002（或等价内网地址）
SubBoost URL：https://app.<品牌域>

NODE_ENV：production

部署拓扑：单实例
  authorized-apps store 类型：file

是否已配置 production-jwks：是
私钥来源：PRIVATE_KEY_FILE
  MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE=production-jwks
  MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG=RS256
  MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID=moauth-connect-staging-1

本次审查是否要求 live 探测：是
```

---

## 第一阶段：自动化门禁（必须执行并记录输出）

在仓库根目录依次执行，记录每条命令的 exit code 和关键输出：

```bash
# 1) PR 级 CI 等价门禁（单元测试 + OIDC 静态门禁）
npm run test:ci

# 2) 全量 acceptance（跨服务 handoff + store + connect + account）
npm run test:acceptance

# 3) OIDC production gates 单测
npm run test:oidc-gates

# 4) 静态 OIDC 验收（NODE_ENV=production）
NODE_ENV=production npm run moauth:verify-oidc -- --static-only

# 5) 若 Connect 已部署且环境变量已配置 — live 验收（staging/release 必做）
npm run moauth:verify-oidc:release

# 6) 若已有真实登录产生的 id_token — 深度验签
MOAUTH_VERIFY_ID_TOKEN="<jwt>" \
MOAUTH_VERIFY_CLIENT_ID="<client_id>" \
npm run moauth:verify-oidc:release

# 7) 浏览器链路探测（需本地/staging 服务已启动 + Playwright）
node scripts/test-chain-navigation.mjs
node scripts/test-chain-navigation.mjs --include-account-down

# 8) Account health probe 脚本
node scripts/test-account-health-probe.mjs
```

**判定规则**：

- `test:ci` 失败 → 直接 **NO-GO**
- staging 候选：`moauth:verify-oidc:release` 必须全绿 → 否则 **NO-GO**
- live 不可达时：只能给 **Conditional NO-GO**，并列出缺失的 live 证据
- 当前 local-simulated + 无 production-jwks：静态门禁可通过，但 production live 项预期 FAIL

---

## 第二阶段：ADR-010 OIDC 验证清单（12 项，逐项 PASS/FAIL/UNKNOWN）

对照 `docs/uuwu_04_adr.md`「生产上线前 OIDC 验证清单」：

| # | 验证项 | 通过标准 | 你的结论 | 证据 |
|---|--------|----------|----------|------|
| 1 | Discovery issuer | `issuer` = `MOAUTH_CONNECT_ISSUER` | | |
| 2 | Discovery 端点同源 | auth/token/jwks 均以 Connect 域名为 origin | | |
| 3 | JWKS 自洽 | `/oauth/v2/keys` 公钥 kid/alg 与 id_token header 一致 | | |
| 4 | 授权码 + PKCE | authorize → callback → token；state/nonce 校验 | | |
| 5 | id_token.iss | 严格等于 discovery issuer | | |
| 6 | id_token 签名校验 | 业务应用用 Connect JWKS 验签；**不得**依赖 Zitadel JWKS | | |
| 7 | id_token.aud | 包含业务 client_id | | |
| 8 | Consent 记忆 | scopes 子集二次登录跳过 consent；`prompt=consent` 强制展示 | | |
| 9 | authorized-apps fail-closed | API 不可用时 Connect 503，不静默放行 | | |
| 10 | Dev HS256 门禁 | production discovery **不得**出现 `moauth_dev_id_token_resign` | | |
| 11 | SubBoost issuer 配置 | 仅 pin Connect issuer；生产禁止 upstream fallback | | |
| 12 | 登出语义 | 业务 session 清除；默认不 force consent | | |

任何 #1/#5/#6/#9/#10 为 FAIL → **NO-GO**

**当前环境预判**（供对照，以实测为准）：

- #3/#6/#10：本地 dev-hs256 模式下，production 语义项预期 FAIL 或 N/A
- #1/#2：loopback 下可通过，但不满足公网 HTTPS P0

---

## 第三阶段：浏览器端到端清单（E1–E9）

对照 `docs/reviews/moauth-release-readiness.md` §4。

若无法实际操作浏览器，则检查自动化/脚本/测试是否覆盖等价场景，标为 `MANUAL_REQUIRED` 并说明缺什么证据。

| # | 场景 | P 级 | 结论 | 证据 |
|---|------|------|------|------|
| E1 | 首次授权完整链路 | P0 | | |
| E2 | 已授权静默登录（无 consent） | P0 | | |
| E3 | `prompt=consent` 强制 consent | P1 | | |
| E4 | scope 扩大需重新 consent | P1 | | |
| E5 | 撤销授权后重登需 consent | P1 | | |
| E6 | Account 不可达 → Connect fail-closed | P0 | | |
| E7 | authorized-apps 查询失败 → 503 不 finalize | P0 | | |
| E8 | SubBoost 普通 logout 语义 | P1 | | |
| E9 | 公网域名一致性（无 Zitadel 暴露） | P0 | | |

P0 场景任一 FAIL 且无已接受缓解 → **NO-GO**

**已知风险点**（2026-07-02 链路透传）：E2（Account SSO skip warm）曾 FAIL，审查需重点复核。

---

## 第四阶段：关键代码路径审查（只读）

必须阅读并核对以下模块的实现与测试覆盖：

### Connect OIDC 核心

- `apps/connect/src/oidc/proxy.js`, `proxy-core.js`, `proxy-node.js`
- `apps/connect/src/oidc/connect-jwks.js`, `id-token-issuer.js`, `id-token-resign.js`
- `apps/connect/src/oidc/prompt-flow.js`, `connect-session.js`, `connect-session-store.js`
- `apps/connect/src/oidc/client-callback-url.js`
- `apps/connect/app/oauth/[...path]/route.js`
- `apps/connect/app/api/login/route.js`, `app/api/login/continue/route.js`
- `apps/connect/app/api/consent/route.js`
- `apps/connect/middleware.js`

### Account + Handoff

- `apps/connect/src/handoff/**`
- `apps/connect/src/account/**`（Account 可达性探测）
- `apps/account/**`（health ready/live、handoff 签发）

### 持久化与 fail-closed

- `packages/authorized-apps-store/**`
- `packages/handoff-store/**`
- `apps/connect/test/login-authorized-apps-failclosed.test.js`
- `apps/connect/test/account-availability.test.js`
- `apps/connect/test/login-fallback-gate.test.js`
- `apps/connect/test/prompt-flow.test.js`

### 跨服务 acceptance

- `packages/e2e-acceptance/test/handoff-acceptance.test.js`
- `packages/e2e-acceptance/fixtures/handoff-flow.js`

### 生产门禁脚本

- `scripts/verify-oidc.mjs`
- `scripts/lib/oidc-production-gates.mjs`
- `scripts/test/oidc-production-gates.test.js`
- `.github/workflows/moauth-oidc-release.yml`

### 审查重点（代码层）

1. redirect_uri / client callback 白名单是否严格
2. handoff token 是否一次性、短时、内部鉴权
3. id_token 重签后 claims 映射是否正确（iss/aud/sub）
4. Account 探测是否用 `/api/health/ready` 而非 SSR `/login`
5. authorized-apps `isGranted` scope 子集语义是否正确
6. 生产环境是否泄漏 dev-hs256、Zitadel 域名、私钥路径
7. 错误路径是否 fail-closed（503 + 明确错误码），而非静默降级

---

## 第五阶段：生产边界与运维就绪

### P0 — 必须完成（阻断上线）

- [ ] `MOAUTH_CONNECT_ISSUER` / `MOAUTH_CONNECT_PUBLIC_URL` 指向生产 HTTPS 公网域名
- [ ] `production-jwks` 已配置；`dev-hs256` 在生产 discovery 中不可见
- [ ] `npm run moauth:verify-oidc:release` 在 staging **全绿**
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
- [ ] 回滚方案：Connect issuer、JWKS kid、redirect_uri 同步回滚步骤

### P2 — 可后续增强

- [ ] JWKS v2：current + previous 双钥零停机轮换
- [ ] authorized-apps DB store + 多实例水平扩展
- [ ] 自动化 browser-e2e 纳入 release workflow
- [ ] OIDC 合规扫描（oauth.net、OWASP）
- [ ] 密钥自动轮换与 HSM/KMS 集成

### 已知 v1 限制（若接受需在报告中显式写出）

- JWKS 仅单 kid/单私钥，轮换需维护窗口（见 `docs/reviews/moauth-release-readiness.md` §1）
- authorized-apps file store 仅适合单实例 MVP（见同文档 §2）

---

## 第六阶段：安全专项（快速扫雷）

检查是否存在：

- Open redirect（redirect_uri 未校验）
- Session fixation / cookie 属性缺失（Secure, HttpOnly, SameSite）
- id_token 算法降级或 kid 混淆
- handoff token 重放
- 敏感信息写入日志/错误响应
- CSRF 保护缺口
- 生产启用 `MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK`

每项：有风险标 P0/P1，附攻击路径与修复建议。

---

## 输出格式（严格遵守）

```markdown
# MoAuth Release Readiness Report

## Executive Summary
- **Verdict**: GO | GO with caveats | NO-GO | Conditional NO-GO
- **审查环境**:
- **审查时间**:
- **一句话结论**:

## Automation Results
| 命令 | Exit | 结果 | 备注 |
|------|------|------|------|
| npm run test:ci | | | |
| ... | | | |

## ADR-010 Checklist (1–12)
（表格：每项 PASS/FAIL/UNKNOWN + 证据）

## Browser E2E (E1–E9)
（表格：每项 PASS/FAIL/MANUAL_REQUIRED + 证据）

## P0 / P1 / P2 Status
### P0（阻断）
- [x]/[ ] 项目 ...

### P1（强烈建议）
...

### P2（后续）
...

## Code Findings

### Issue 1 -- Severity: bug
- File: path/to/file.ext:LINE
- Description:
- Impact:
- Suggestion:
- Blocks release: yes/no

### Issue 2 -- Severity: suggestion
...

（Severity: bug | suggestion | nit；无问题则写 "No code findings"）

## Security Sweep
（条目或 "No material risks found"）

## Accepted Caveats（仅 GO with caveats 时填写）
- 限制描述 / 缓解措施 / 责任方 / 跟进时间

## Manual Steps Still Required（若 live/E2E 未能自动化）
1. ...

## Recommended Actions（按优先级排序）
### Before release（P0）
1. ...
### Within 1 iteration（P1）
1. ...

## Appendix
- 关键命令输出摘要
- 参考文档版本/路径
```

---

## 最终判定规则（必须执行）

1. 任一 **P0 自动化门禁失败** → **NO-GO**
2. ADR 清单 #1/#5/#6/#9/#10 任一 FAIL → **NO-GO**
3. E6/E7/E9 任一 FAIL → **NO-GO**
4. 存在未缓解的 **Severity: bug** 且 `Blocks release: yes` → **NO-GO**
5. 仅 P1 未满足但已写入 Accepted Caveats 且产品方明确接受 → **GO with caveats**
6. 全部 P0 满足 + 无阻断 bug → **GO**
7. 当前为 local-simulated、无 HTTPS、无 production-jwks、缺 staging live → 默认 **Conditional NO-GO**（除非实测推翻）

完成后：

- 将完整报告写入 `docs/reviews/moauth-release-readiness-YYYY-MM-DD.md`（仅建议路径，需人类确认是否提交）
- 在回复中给出 Verdict 和 Top 3 阻断项（若有）

---

**提示词结束**

---

## 审查前启动命令（本地 live 探测）

```bash
# 1) Zitadel（见 self-hosted/zitadel/）
# 2) Connect
npm run dev:connect    # http://127.0.0.1:3000

# 3) Account
npm run dev:account    # http://127.0.0.1:3002

# 4) SubBoost（见 external/subboost/local）

# 5) 快速探测
curl -s http://127.0.0.1:3000/.well-known/openid-configuration | head -c 300
curl -s http://127.0.0.1:3002/api/health/ready
```

## 生产上线前额外步骤（staging）

```bash
# 生成 RS256 密钥对
npm run moauth:generate-signing-keys

# 配置 production-jwks 环境变量后
export NODE_ENV=production
export MOAUTH_CONNECT_ISSUER=https://connect.<品牌域>
export MOAUTH_CONNECT_PUBLIC_URL=https://connect.<品牌域>
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE=production-jwks
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE=/secure/moauth/connect/private.pem
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID=moauth-connect-staging-1
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG=RS256

npm run moauth:verify-oidc:release
```

## 相关文档

| 文档 | 路径 |
|------|------|
| Release 验收清单 | `docs/reviews/moauth-release-readiness.md` |
| ADR-010 细则 | `docs/uuwu_04_adr.md` |
| 接口契约 | `docs/uuwu_06_interface_contracts_boundaries.md` |
| Account 健康探测 | `docs/reviews/account-health-probe-review.md` |
| 应用接入教程 | `docs/guides/moauth-app-onboarding-monexus.md` |
| OIDC Release Workflow | `.github/workflows/moauth-oidc-release.yml` |