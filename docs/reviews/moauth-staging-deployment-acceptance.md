# MoAuth Staging 部署验收清单

**状态**：可执行验收模板
**前置裁决**：[Conditional NO-GO](./moauth-release-readiness-2026-07-06-conditional.md)（代码 P0 已过，待 staging 证据）
**目标裁决**：**Staging GO** → 作为 Production GO 前置门
**基线文档**：`docs/reviews/moauth-release-readiness.md` · `docs/uuwu_04_adr.md` ADR-010

---

## 当前裁决

**Conditional NO-GO** — 不是「可生产上线」，而是：

> 代码 P0 已修复 → 可进入 staging release readiness 复审 → 生产 GO 仍待 staging/生产环境证据。

对外建议表述：

> 代码 P0 已修复，可合并并进入 staging 部署验收；在 staging HTTPS live gate + id_token 深验 + 浏览器 E1/E9 完成前，不得宣称生产 GO。

### 代码侧结论

| 项 | 状态 |
|----|------|
| Issue 1 grant → finalize 顺序 | ✅ `consent-flow.js` + 单测 |
| Issue 2 id_token fail-closed 502 | ✅ |
| Issue 3 handoff token 单测隔离 | ✅ |
| 生产 secret 无 dev fallback | ✅ Connect / Account / SubBoost |
| JWKS 仅公钥字段 | ✅ `toPublicJwk()` + proxy 单测 |
| `test:acceptance` | ✅ connect 75/75，e2e 8/8 |

### 仍不是 Production GO 的原因

1. 无 staging HTTPS live release 证据。
2. `production-jwks` / issuer / Zitadel client 未部署到 staging/production。
3. `MOAUTH_VERIFY_ID_TOKEN` 仍需真实 token 深验。
4. 浏览器 E2E / 全链路未作为 production 证据完成。
5. authorized-apps file store 单实例 WARN：单实例可接受，扩副本前需 DB 或 sign-off。

---

## Recommended Actions 执行入口

从 [Conditional NO-GO 报告](./moauth-release-readiness-2026-07-06-conditional.md#recommended-actions) 推进 staging 复审时，直接按下表进入本文对应章节：

| ID | 动作 | 本文入口 | 产物 / 通过标准 |
|----|------|----------|-----------------|
| RA1 | 填写 staging 域名与完整 production env；完成 D1–D7 部署 | §1–§3 | 域名、secret 注入、Zitadel client、SubBoost redirect_uri 均已配置 |
| RA2 | 运行 staging live OIDC gate 并归档输出 | §4.2 | `npm run moauth:verify-oidc:release` exit 0；日志写入 `artifacts/staging-oidc-release-<date>.log` |
| RA3 | 完成 P0 浏览器证据 | §5 P0 | E1 / E2 / E6 / E7 / E9 截图或录屏、最终 URL、操作者记录齐全 |
| RA4 | E1 后采集真实 `id_token` 深验 | §4.3 | `id_token` 不再 SKIP；`iss` 为 Connect issuer；签名可用 Connect JWKS 验证 |
| RA5 | 形成 Staging GO / NO-GO 记录 | §7 | 验收记录填写完整；若 GO，再进入 Production GO 前置项 |

**硬性边界**：RA2–RA4 必须使用 staging HTTPS 公网域名；loopback、本地模拟或缺少 `MOAUTH_VERIFY_ID_TOKEN` 的结果只能作为预检查，不能作为 Production GO 证据。

---

## 0. 验收结论定义

| 裁决 | 条件 |
|------|------|
| **Staging GO** | 本文 §4 自动化全绿 + §5 P0 浏览器 E1/E2/E6/E7/E9 通过 + §6 sign-off 完成 |
| **Staging NO-GO** | 任一 P0 项 FAIL；或 id_token 深验 FAIL |
| **Production GO** | Staging GO + §5 P1 浏览器项 + 运维 runbook/告警（见 `moauth-release-readiness.md` §5 P1） |

---

## 1. Staging 拓扑与域名（部署前填写）

将下列占位符替换为真实 staging 值，验收全程只使用 HTTPS 公网域名（禁止 loopback 作为 staging 证据）。

| 角色 | 变量 | Staging 值（填写） | 用户可见 |
|------|------|-------------------|----------|
| Connect（Public Issuer） | `MOAUTH_CONNECT_ISSUER` | `https://connect.staging.<brand>` | ✅ |
| Connect 公网 URL | `MOAUTH_CONNECT_PUBLIC_URL` | 同 issuer | ✅ |
| Account Center | `MOAUTH_ACCOUNT_PUBLIC_URL` | `https://account.staging.<brand>` | ✅ |
| SubBoost | `APP_URL` | `https://app.staging.<brand>` | ✅ |
| Zitadel（隐藏） | `ZITADEL_ISSUER` | `https://id.internal.<brand>` 或内网 | ❌ 不对用户暴露 |

**网络要求**

- [ ] Connect / Account / SubBoost 对外 HTTPS，证书有效（非自签，或企业根证书已分发）
- [ ] Zitadel 仅服务间可达；浏览器地址栏不出现 Zitadel 域名
- [ ] Connect → Account 健康探测使用 `MOAUTH_ACCOUNT_INTERNAL_URL`（可与 public 相同，staging 建议显式配置）
- [ ] SubBoost `redirect_uri` 已在 Connect client registry 与 Zitadel OIDC app 双向登记

---

## 2. 密钥与 Secret 清单（部署前）

> **禁止**将下列值写入 git、PR、聊天或验收报告正文。验收报告只记录「已配置 / kid / 指纹」，不记录 secret 原文。

### 2.1 Connect

| 变量 | 必填 | 说明 |
|------|------|------|
| `NODE_ENV` | ✅ | `production` |
| `MOAUTH_CONNECT_ISSUER` | ✅ | HTTPS 公网 issuer |
| `MOAUTH_CONNECT_PUBLIC_URL` | ✅ | 通常与 issuer 相同 |
| `MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE` | ✅ | `production-jwks` |
| `MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY` 或 `_FILE` | ✅ | RS256 私钥 PEM |
| `MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID` | ✅ | 建议 `moauth-connect-staging-1` |
| `MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG` | ✅ | `RS256`（默认） |
| `MOAUTH_CONNECT_SESSION_SECRET` | ✅ | 生产随机 secret，无 dev fallback |
| `MOAUTH_CONNECT_TRANSACTION_SECRET` | ✅ | 生产随机 secret |
| `MOAUTH_HANDOFF_INTERNAL_TOKEN` | ✅ | 与 Account 一致 |
| `ZITADEL_ISSUER` | ✅ | 隐藏认证核心 |
| `ZITADEL_SERVICE_USER_TOKEN` | ✅ | Connect 服务账号 PAT |
| `ZITADEL_ORG_ID` / `ZITADEL_PROJECT_ID` | ✅ | 按 bootstrap |
| `MOAUTH_ACCOUNT_PUBLIC_URL` | ✅ | Account HTTPS |
| `MOAUTH_ACCOUNT_INTERNAL_URL` | 建议 | 服务间探测基址 |
| `MOAUTH_CLIENT_REGISTRY_STORE` | 建议 | staging 单实例可用 `file` |
| `MOAUTH_AUTHORIZED_APPS_STORE` | 建议 | staging 单实例可用 `file` |

**禁止项**

- [ ] 未设置 `MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET`（dev-hs256）
- [ ] `MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK` ≠ `true`

### 2.2 Account

| 变量 | 必填 | 说明 |
|------|------|------|
| `NODE_ENV` | ✅ | `production` |
| `MOAUTH_ACCOUNT_PUBLIC_URL` | ✅ | HTTPS |
| `MOAUTH_CONNECT_PUBLIC_URL` | ✅ | Connect HTTPS |
| `MOAUTH_ACCOUNT_SESSION_SECRET` | ✅ | 生产随机 secret |
| `MOAUTH_HANDOFF_INTERNAL_TOKEN` | ✅ | 与 Connect 一致 |
| `ZITADEL_*` | ✅ | 同 Connect 租户 |

### 2.3 SubBoost

| 变量 | 必填 | 说明 |
|------|------|------|
| `NODE_ENV` | ✅ | `production` |
| `APP_URL` | ✅ | HTTPS |
| `MOAUTH_CONNECT_ISSUER` | ✅ | **仅** Connect issuer，非 Zitadel |
| `MOAUTH_CONNECT_CLIENT_ID` | ✅ | registry / Zitadel app client id |
| `MOAUTH_CONNECT_CLIENT_SECRET` | 视 client 类型 | confidential 时必填 |
| `SUBBOOST_MOAUTH_TX_SECRET` | ✅ | 生产随机 secret |
| `DATABASE_URL` / `JWT_SECRET` / `ENCRYPTION_KEY` | ✅ | SubBoost 业务必需 |

**禁止项**

- [ ] `MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK=true`
- [ ] `MOAUTH_ZITADEL_ISSUER` 作为业务验签 issuer（production）

### 2.4 生成 Connect 签名密钥（首次 staging）

```bash
npm run moauth:generate-signing-keys
# 输出至 secrets/connect-signing/（gitignored）
# 将 private.pem 部署到 staging secret 存储，配置 MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE 或 inline
```

---

## 3. 部署步骤检查（运维）

按顺序勾选，每步留部署日志链接或时间戳。

| # | 步骤 | 通过标准 |
|---|------|----------|
| D1 | Zitadel staging 实例就绪；Org/Project/OIDC app 已创建 | PAT 可用；redirect_uri 含 SubBoost callback |
| D2 | Connect 部署 `NODE_ENV=production` + production-jwks | 进程启动无 secret 缺失错误 |
| D3 | Account 部署 | `/api/health/ready` 返回 200，`zitadel`+`handoff` ready |
| D4 | client registry 种子 / `data/oidc-clients.json` 含 SubBoost staging client | `clientId`、redirect_uri、displayName 正确 |
| D5 | SubBoost 部署并指向 Connect issuer | `MOAUTH_CONNECT_ISSUER` 为 HTTPS Connect |
| D6 | TLS / 反向代理 | 浏览器无 mixed-content；cookie `Secure` 生效 |
| D7 | 秘密轮换记录 | kid、部署时间、负责人写入运维台账（不含 PEM 原文） |

---

## 4. 自动化验收（验收机执行）

在**能访问 staging 公网**的跳板机或 CI 上执行。先将 staging secrets 注入环境（或 `.env.staging` gitignored 文件），**不要** commit。

### 4.1 PR 级回归（可选，发布前最后一轮）

```bash
cd /path/to/MoAuth
npm run test:ci
```

| 项 | 通过标准 |
|----|----------|
| Exit code | `0` |
| 静态 gate | 13/13 passed（含 SubBoost `SUBBOOST_MOAUTH_TX_SECRET`） |

**CI 耦合说明**：`test:ci` 静态 gate 在 `NODE_ENV=production` 且设置 `MOAUTH_VERIFY_SUBBOOST_ENV_FILE` 时，会要求 SubBoost env 文件包含 `SUBBOOST_MOAUTH_TX_SECRET`。未配置时可能出现 12/13；这是 staging env 完整性要求，不是代码回退。

### 4.2 Staging 静态 + Live OIDC Gate（P0）

```bash
export NODE_ENV=production
export MOAUTH_CONNECT_ISSUER=https://connect.staging.<brand>
export MOAUTH_CONNECT_PUBLIC_URL=https://connect.staging.<brand>
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE=production-jwks
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE=/secure/connect/private.pem
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID=moauth-connect-staging-1
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG=RS256
export MOAUTH_CONNECT_SESSION_SECRET=<redacted>
export MOAUTH_CONNECT_TRANSACTION_SECRET=<redacted>
export MOAUTH_ACCOUNT_SESSION_SECRET=<redacted>
export MOAUTH_HANDOFF_INTERNAL_TOKEN=<redacted>
export MOAUTH_VERIFY_SUBBOOST_ENV_FILE=/secure/subboost/.env

npm run moauth:verify-oidc:release
```

| 项 | 通过标准 |
|----|----------|
| Exit code | `0` |
| Static checks | 全部 `[PASS]`（允许 `[WARN] authorized_apps_file_store_single_instance_only`） |
| Live discovery | `discovery_issuer_matches_config`；端点同源 |
| Live JWKS | `jwks_has_signing_keys`；`jwks_kid_matches_config`；**无私钥 JWK 字段**（`d`,`p`,`q` 等） |
| Dev marker | `discovery_no_dev_resign_marker` PASS |
| id_token | 首次可为 `[SKIP]`；§4.3 完成后不得 SKIP |

**归档**：完整终端输出保存为 `artifacts/staging-oidc-release-<date>.log`

### 4.3 id_token 深度校验（P0，完成 E1 后）

从 SubBoost 成功登录后，从 token 响应或 SubBoost session 提取 `id_token`（勿写入 git）：

```bash
export MOAUTH_VERIFY_ID_TOKEN="<jwt>"
export MOAUTH_VERIFY_CLIENT_ID="<subboost_client_id>"
npm run moauth:verify-oidc:release
```

| 检查项 | 通过标准 |
|--------|----------|
| `id_token_signature_valid` | PASS |
| `id_token_iss_matches_connect` | `iss` = staging Connect issuer |
| `id_token_aud_matches_client` | `aud` 含 SubBoost client_id |
| `id_token_exp_not_expired` | PASS |

### 4.4 Account 健康探测（P0）

将脚本中的 URL 改为 staging（或设置 env 后改脚本常量）：

```bash
# 默认探测 127.0.0.1；staging 需指向公网 URL
MOAUTH_CONNECT_PUBLIC_URL=https://connect.staging.<brand> \
MOAUTH_ACCOUNT_PUBLIC_URL=https://account.staging.<brand> \
node scripts/test-account-health-probe.mjs
```

| 项 | 通过标准 |
|----|----------|
| Account `/api/health/live` | 200 |
| Account `/api/health/ready` | 200，`zitadel`+`handoff` true |
| Connect 路由 | Account ready 时登录路由到 Account；不可达时 fail-closed |

### 4.5 GitHub Actions（可选）

```text
Workflow: .github/workflows/moauth-oidc-release.yml
Inputs: connect_issuer, verify_id_token, verify_client_id
```

| 项 | 通过标准 |
|----|----------|
| `test:ci` job | 绿 |
| `moauth:verify-oidc:release` job | 绿 |

---

## 5. 浏览器验收（P0 / P1）

**环境**：无痕窗口；真实 staging HTTPS 域名；测试账号事先在 Zitadel 存在。

记录模板见 §7。每项至少：截图或录屏 + 最终 URL + 时间 + 操作者。

### P0 — Staging GO 必需

| # | 场景 | 操作 | 通过标准 | 证据 |
|---|------|------|----------|------|
| E1 | 首次授权 | SubBoost 登录 → Account 密码 → Connect consent Allow | SubBoost dashboard/session 建立；callback 无 error；`id_token.iss`=Connect | ☐ |
| E2 | 静默登录 | 同用户再次 SubBoost 登录（scope 不变，SSO 在） | **不**出现 consent；直达 callback | ☐ |
| E6 | Account 不可达 | 停止 Account  replica 或阻断 Connect→Account | Connect 展示不可用 / 503；**不** finalize OIDC | ☐ |
| E7 | authorized-apps 失败 | 阻断 Account internal authorized-apps（防火墙/停服务） | Connect 登录或 consent 返回 503 `AUTHORIZED_APPS_UNAVAILABLE`；**不** finalize | ☐ |
| E9 | 域名一致性 | 检查地址栏、redirect、Set-Cookie | 用户只见 `<brand>` 域；无 Zitadel 域名；issuer/callback/cookie 一致 | ☐ |

### P1 — Production GO 前强烈建议

| # | 场景 | 通过标准 | 证据 |
|---|------|----------|------|
| E3 | `prompt=consent` 或 force consent | 必须展示 consent | ☐ |
| E4 | scope 扩大 | 必须 re-consent | ☐ |
| E5 | 撤销后重登 | Account 撤销 SubBoost 后必须 consent | ☐ |
| E8 | SubBoost logout | 本地 session 清除；默认不 force consent | ☐ |

### E1 验收后必做

- [ ] 执行 §4.3 id_token 深验
- [ ] 在验收记录填写 jwt `iss`/`aud`/`kid`（不贴完整 token）

---

## 6. 单实例 Store 与运维 Sign-off（P0 决策项）

staging 若使用 file store，**必须**书面确认：

| 项 | 决策 | 签字 |
|----|------|------|
| `MOAUTH_AUTHORIZED_APPS_STORE=file` | ☐ 接受（仅单实例） / ☐ 已切 `db` | |
| `MOAUTH_CLIENT_REGISTRY_STORE=file` | ☐ 接受（仅单实例） / ☐ 已切共享存储 | |
| 多副本扩容前 | ☐ 已明确禁止在未迁移 DB 前水平扩展 Account/Connect | |

---

## 7. 验收记录模板

```markdown
# MoAuth Staging Acceptance Record

- **Date**:
- **Environment**: staging
- **Reviewer**:
- **Connect issuer**:
- **Account URL**:
- **SubBoost URL**:
- **JWKS kid**:
- **Zitadel org/project**（无 secret）:
- **Verdict**: Staging GO / Staging NO-GO

## Automation
- test:ci: pass/fail —
- moauth:verify-oidc:release (no token): pass/fail — log:
- moauth:verify-oidc:release (with id_token): pass/fail —
- account-health-probe: pass/fail —

## Browser E2E
| ID | Result | Notes |
|----|--------|-------|
| E1 | | |
| E2 | | |
| E6 | | |
| E7 | | |
| E9 | | |

## id_token sample (claims only, no full JWT)
- iss:
- aud:
- kid:
- exp:

## Caveats accepted
- file store single-instance: yes/no

## Blockers (if NO-GO)
1.
```

---

## 8. 回滚检查（部署失败或 Staging NO-GO）

| # | 回滚动作 | 验证 |
|---|----------|------|
| R1 | 恢复上一版 Connect/Account/SubBoost 镜像或配置 | 健康检查 200 |
| R2 | 若轮换过 JWKS kid，恢复 previous kid 或维护窗口公告 | 旧 token 验签策略已文档化 |
| R3 | SubBoost `MOAUTH_CONNECT_ISSUER` 与 redirect_uri 与 registry 同步回滚 | authorize 不报 invalid_client |
| R4 | 确认无 partial deploy（Connect 新 + SubBoost 旧 issuer 不一致） | E1 smoke |

---

## 9. 快速命令索引

```bash
# PR / 合并前
npm run test:ci

# Staging live（核心）
npm run moauth:verify-oidc:release

# 带 id_token
MOAUTH_VERIFY_ID_TOKEN="..." MOAUTH_VERIFY_CLIENT_ID="..." npm run moauth:verify-oidc:release

# 健康探测（改 staging URL）
node scripts/test-account-health-probe.mjs

# 生成签名密钥（仅首次）
npm run moauth:generate-signing-keys
```

---

## 10. 相关文档

- [Conditional NO-GO 复审](./moauth-release-readiness-2026-07-06-conditional.md)
- [Release Readiness 总清单](./moauth-release-readiness.md)
- [全链路审查 Prompt](./moauth-full-chain-release-review-prompt.md)
- ADR-010：`docs/uuwu_04_adr.md`
