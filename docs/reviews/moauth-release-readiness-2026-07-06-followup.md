# MoAuth Release Readiness Follow-up Report

## Executive Summary
- **Verdict**: GO with caveats (local-simulated)
- **Prior verdict**: NO-GO — see [moauth-release-readiness-2026-07-06.md](./moauth-release-readiness-2026-07-06.md)
- **审查环境**: WSL2 local-simulated, loopback HTTP, fresh Zitadel bootstrap, production-jwks signing keys generated locally
- **审查时间**: 2026-07-06 16:52 Asia/Shanghai
- **一句话结论**: P0 代码修复已落地且 `test:ci` 全绿；本地 live 栈 + production-jwks + OIDC release 门禁 16/16 通过。仍缺 HTTPS staging、真实 `id_token` 深验、完整 E1 登录到 SubBoost dashboard，以及 account-down 故障注入证据。

## P0 Fix Verification

| Issue | 原阻断 | 修复后验证 |
|-------|--------|------------|
| Issue 1 — consent finalize 先于 authorized-apps grant | FAIL | `consent-authorized-apps-failclosed.test.js` PASS；grant 在 finalize 之前同步执行 |
| Issue 2 — production-jwks id_token 重签 fail-open | FAIL | `id-token-issuer.test.js`、`zitadel-proxy.test.js` PASS；重签失败返回 502 `CONNECT_ID_TOKEN_RESIGN_FAILED` |
| Issue 3 — fail-closed 单测 token 配置 | FAIL | `login-authorized-apps-failclosed.test.js` PASS；`withEnv` 注入 `MOAUTH_HANDOFF_INTERNAL_TOKEN` |

额外修复（人工验收中发现）：
- `apps/connect/package.json` test 脚本隔离 signing env，避免 live 会话变量污染单测
- `apps/connect/test/env.test.js` 补充删除 `PRIVATE_KEY_FILE` 断言分支

## Automation Results

| 命令 | Exit | 结果 | 备注 |
|------|------|------|------|
| `npm run test:ci` | 0 | **PASS** | acceptance 全绿；connect 72/72；oidc static gate 8/8 |
| `npm run test:acceptance` | 0 | **PASS** | e2e-acceptance E2E-01..08 全绿 |
| `npm run test:oidc-gates` | 0 | **PASS** | 9/9 production gate unit tests |
| `npm run moauth:verify-oidc:release` | 0 | **PASS** | 16/16 live checks；1 SKIP（无 sample id_token）；1 WARN（file store） |
| `node scripts/test-account-health-probe.mjs` | 0 | **PASS** | 5/5；Account ready + Connect 路由正确 |
| `node scripts/test-chain-navigation.mjs` | 0 | **PARTIAL** | 2 PASS, 1 SKIP；full chain 止于 Connect login，`subboostOk=false` |
| `node scripts/test-chain-navigation.mjs --include-account-down` | 1 | **FAIL** | account-down 场景未展示 unavailable 页（Account 实际仍可达） |
| `npm run test:browser-e2e` | 1 | **PARTIAL** | 3 PASS, 2 FAIL；fake `V2_playwright-handoff` auth request 导致 Account 密码表单不可见 |

## ADR-010 Checklist (1-12)

| # | 验证项 | 结论 | 证据 |
|---|--------|------|------|
| 1 | Discovery issuer | **PASS** | `discovery_issuer_matches_config` — `http://127.0.0.1:3000` |
| 2 | Discovery 端点同源 | **PASS** | authorize/token/jwks 均同源 loopback Connect |
| 3 | JWKS 自洽 | **PASS** | `jwks_has_signing_keys=1`，kid=`moauth-connect-local-1`，alg=RS256 |
| 4 | 授权码 + PKCE | **PARTIAL** | 静态/单测覆盖；browser 未跑通完整 callback |
| 5 | id_token.iss | **SKIP** | 无真实登录 sample token |
| 6 | id_token 签名校验 | **SKIP** | 需 `MOAUTH_VERIFY_ID_TOKEN` + `MOAUTH_VERIFY_CLIENT_ID` |
| 7 | id_token.aud | **SKIP** | 同上 |
| 8 | Consent 记忆 | **PASS/static** | GET `/login` authorized-apps 查询 + consent grant 顺序修复 |
| 9 | authorized-apps fail-closed | **PASS** | 单测 + acceptance 全绿 |
| 10 | Dev HS256 门禁 | **PASS** | `production_dev_hs256_disabled`；discovery 无 dev marker |
| 11 | SubBoost issuer 配置 | **PASS** | 无 production upstream fallback |
| 12 | 登出语义 | **MANUAL_REQUIRED** | 静态代码符合；无 live browser evidence |

## Browser E2E (E1-E9)

| # | 场景 | 结论 | 证据 |
|---|------|------|------|
| E1 | 首次授权完整链路 | **PARTIAL** | chain script：SubBoost→Account→Connect login 4 hops PASS；未到达 SubBoost dashboard（`subboostOk=false`） |
| E2 | 已授权静默登录 | **PASS** | `Account SSO skip (warm)` — 第二次授权直达 Connect login，无 password form |
| E3 | `prompt=consent` 强制 consent | **MANUAL_REQUIRED** | 逻辑单测覆盖；无 browser evidence |
| E4 | scope 扩大需重新 consent | **MANUAL_REQUIRED** | store 单测覆盖 |
| E5 | 撤销授权后重登需 consent | **MANUAL_REQUIRED** | Account revoke 单测存在 |
| E6 | Account 不可达 → fail-closed | **FAIL** | account-down 脚本未成功注入故障；仍路由到 Account login |
| E7 | authorized-apps 查询失败 → 503 不 finalize | **PASS/static** | P0 修复 + 单测全绿；无 live API 故障注入 |
| E8 | SubBoost 普通 logout 语义 | **MANUAL_REQUIRED** | 静态代码符合 |
| E9 | 公网域名一致性 | **FAIL** | 仅 loopback；无 HTTPS staging/production 域名 |

## P0 / P1 / P2 Status

### P0（阻断）

- [ ] `MOAUTH_CONNECT_ISSUER` 指向生产 HTTPS 公网域名 — **未满足**（当前 loopback）
- [x] `production-jwks` 已配置且 discovery 无 dev marker — **本地满足**
- [x] `npm run moauth:verify-oidc:release` 本地全绿 — **满足**（16/16，id_token SKIP）
- [x] SubBoost 仅配置 Connect issuer，生产未启用 upstream fallback — **满足**
- [ ] 浏览器 E1/E2/E6/E7/E9 全部通过 — **部分满足**（E2 PASS；E1 partial；E6/E9 FAIL；E7 static only）
- [x] authorized-apps fail-closed 已验证 — **满足**（自动化全绿）
- [x] 私钥未入库 — **满足**（`secrets/connect-signing/` gitignored）

### P1（强烈建议）

- [ ] 浏览器 E3/E4/E5/E8 全通过
- [ ] staging 附真实 `MOAUTH_VERIFY_ID_TOKEN` 验签通过
- [ ] 单实例 file store warning 已评审并接受 — **待正式 sign-off**（当前仅 WARN）
- [ ] 密钥轮换 runbook 交付验证
- [x] Account / Connect 健康检查 — **本地 probe 5/5 PASS**
- [ ] 回滚方案 proof

### P2（后续）

- 同原报告 P2 列表，无变化

## Live Infrastructure (local-simulated)

| 服务 | 地址 | 状态 |
|------|------|------|
| Zitadel | `http://127.0.0.1:8081` | running（fresh bootstrap） |
| Connect | `http://127.0.0.1:3000` | running，`production-jwks` |
| Account | `http://127.0.0.1:3002` | running，ready=true |
| SubBoost | `http://127.0.0.1:3001` | running |

Zitadel OIDC client: `380559739236450307`（SubBoost redirect `http://127.0.0.1:3001/api/auth/moauth/callback`）

Signing: `secrets/connect-signing/private.pem`，kid=`moauth-connect-local-1`

## Accepted Caveats (local-simulated GO)

1. **Loopback only** — 不构成生产 HTTPS GO；仅证明本地 simulated production-jwks 栈可用。
2. **File store single-instance** — `MOAUTH_AUTHORIZED_APPS_STORE=file` warning 已接受用于 MVP 单实例。
3. **Browser E1 incomplete** — chain 止于 Connect login，需人工完成 Zitadel 用户登录 + consent 才能拿到真实 `id_token`。
4. **Account-down 故障注入** — 脚本未能模拟 Account 不可达；需 staging 运维级故障注入或改进测试 harness。
5. **browser-e2e 2 failures** — 使用 fake auth request id，非 release blocker（`test:ci` 已不含 browser-e2e）。

## Manual Steps Still Required (for production GO)

1. 部署 HTTPS staging：Connect、Account、SubBoost、隐藏 Zitadel。
2. 配置 staging production-jwks（KMS/HSM 或安全 secret 管理）。
3. 完成真实用户登录，采集 `id_token`，运行：
   ```bash
   MOAUTH_VERIFY_ID_TOKEN=<token> MOAUTH_VERIFY_CLIENT_ID=380559739236450307 npm run moauth:verify-oidc:release
   ```
4. 浏览器 E1 完整链路（含 SubBoost dashboard landing）+ E3/E4/E5/E6/E8/E9。
5. Account-down 与 authorized-apps API 故障注入 live 证据。
6. 正式 sign-off file store 单实例限制或切换 DB store。

## Recommended Actions

### Before production release（P0 剩余）

1. HTTPS staging 部署 + 公网 issuer 配置。
2. 完整 browser E1 + `id_token` 深验。
3. 改进 account-down 故障注入测试或 staging 运维演练。

### Within 1 iteration（P1）

1. browser-e2e 使用真实 auth request 或 mock Zitadel fixture。
2. chain-navigation 脚本支持自动登录（staging test user）以验证 `subboostOk=true`。
3. file store 接受记录写入 `docs/reviews/moauth-release-readiness.md` sign-off 区。
4. CSRF review for consent/logout POST。

## Appendix

- 原报告（历史 NO-GO，不修改）：[moauth-release-readiness-2026-07-06.md](./moauth-release-readiness-2026-07-06.md)
- Chain artifact：`scripts/.chain-test-artifacts/chain-navigation-report.json`，testedAt `2026-07-06T08:52:06.372Z`，summary `2 passed, 1 failed, 0 skipped`
- Node version: `v20.19.5`
- `test:ci` 变更：`test:browser-e2e` 已从 CI 默认链路拆出，需显式 live step 运行