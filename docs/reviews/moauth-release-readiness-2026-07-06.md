# MoAuth Release Readiness Report

## Executive Summary
- **Verdict**: NO-GO
- **审查环境**: local-simulated, WSL2/local, no staging/production HTTPS evidence
- **审查时间**: 2026-07-06 15:30 Asia/Shanghai
- **一句话结论**: 当前候选不能上线：PR 级 CI 失败、production-jwks 未配置、live 链路不可达，并且 consent finalize 与 id_token 重签路径存在发布阻断风险。

## Automation Results
| 命令 | Exit | 结果 | 备注 |
|------|------|------|------|
| `npm run test:ci` | 1 | FAIL | `apps/connect/test/login-authorized-apps-failclosed.test.js:27` 期望 `AUTHORIZED_APPS_UNAVAILABLE`，实际 `AUTHORIZED_APPS_UNAUTHORIZED`；browser-e2e 也因 Connect/Account 未启动失败。 |
| `npm run test:acceptance` | 1 | FAIL | 同一 Connect fail-closed 单测失败；handoff-store、authorized-apps-store、audit-store、zitadel-client、account 子集通过。 |
| `npm run test:oidc-gates` | 0 | PASS | 9/9 production gate unit tests passed。 |
| `NODE_ENV=production npm run moauth:verify-oidc -- --static-only` | 1 | FAIL | 裸环境：`MOAUTH_CONNECT_ISSUER` 缺失，`signingMode=off`，无 production 私钥。 |
| `set -a; . apps/connect/.env.local; set +a; NODE_ENV=production MOAUTH_VERIFY_SUBBOOST_ENV_FILE=external/subboost/local/.env npm run moauth:verify-oidc -- --static-only` | 1 | FAIL | 本地 env 下 issuer 已配置为 loopback，但 `production_signing_mode` 与 `production_private_key_present` 失败；file store warning。 |
| `npm run moauth:verify-oidc:release` | 1 | FAIL | 裸环境 issuer 缺失，live checks skipped/failed。 |
| `set -a; . apps/connect/.env.local; set +a; MOAUTH_VERIFY_SUBBOOST_ENV_FILE=external/subboost/local/.env npm run moauth:verify-oidc:release` | 1 | FAIL | 本地 env：`signingMode=dev-hs256`，`live_connect_checks` fetch failed。 |
| `MOAUTH_VERIFY_ID_TOKEN=... MOAUTH_VERIFY_CLIENT_ID=... npm run moauth:verify-oidc:release` | N/A | NOT_RUN | 没有真实登录产生的 sample `id_token`。 |
| `node scripts/test-chain-navigation.mjs` | 1 | FAIL | 提权后 Playwright 可启动；SubBoost `http://127.0.0.1:3001` connection refused，0/3 passed。 |
| `node scripts/test-chain-navigation.mjs --include-account-down` | 1 | FAIL | 同上，Account ready=false，SubBoost refused connection。 |
| `node scripts/test-account-health-probe.mjs` | 1 | FAIL | Account `/api/health/live` fetch failed；Connect account-down fetch failed；1 passed, 2 failed, 2 skipped。 |

## ADR-010 Checklist (1-12)
| # | 验证项 | 结论 | 证据 |
|---|--------|------|------|
| 1 | Discovery issuer | UNKNOWN | Live discovery 未能执行：`moauth:verify-oidc:release` 报 `live_connect_checks — fetch failed`。 |
| 2 | Discovery 端点同源 | UNKNOWN | 无可达 Connect live discovery；静态脚本具备该检查，见 [scripts/lib/oidc-production-gates.mjs](/root/projects/MoAuth/scripts/lib/oidc-production-gates.mjs:229)。 |
| 3 | JWKS 自洽 | FAIL | 本地 production static gate：`production_signing_mode — mode=off`，`production_private_key_present` FAIL；无 `secrets/` 目录。 |
| 4 | 授权码 + PKCE | UNKNOWN | Browser chain 未跑通，SubBoost 3001 connection refused；静态代码生成 state/nonce/PKCE，见 [shared.ts](/root/projects/MoAuth/external/subboost/local/app/api/auth/moauth/login/shared.ts:31)。 |
| 5 | id_token.iss | UNKNOWN | 无真实 `id_token`；且重签失败会吞错返回上游 token，见 Issue 2。 |
| 6 | id_token 签名校验 | UNKNOWN | 无 production JWKS/live token；当前 local env 为 `dev-hs256`。生产必须用 Connect JWKS。 |
| 7 | id_token.aud | UNKNOWN | 缺 sample `id_token`。 |
| 8 | Consent 记忆 | PARTIAL | GET `/login` 查询 authorized-apps 后可跳过 consent，见 [page.jsx](/root/projects/MoAuth/apps/connect/app/login/page.jsx:107)；但 allow consent 提交路径记录失败会被吞掉，见 Issue 1。 |
| 9 | authorized-apps fail-closed | FAIL | `npm run test:ci` 和 `npm run test:acceptance` 均在 `login-authorized-apps-failclosed.test.js:27` 失败；另外 consent POST 会先 finalize 再异步记录。 |
| 10 | Dev HS256 门禁 | PASS/static, FAIL/env-readiness | Gate unit tests PASS；本地 production static gate PASS `production_dev_hs256_disabled`，但 release env 未配置 production-jwks。 |
| 11 | SubBoost issuer 配置 | PASS/static-local | SubBoost env 没有 production fallback；代码只有非 production 且显式 `MOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK=true` 才允许 upstream issuer，见 [env.ts](/root/projects/MoAuth/external/subboost/local/src/lib/env.ts:51)。 |
| 12 | 登出语义 | PARTIAL | SubBoost clears local session and only forces consent when `SUBBOOST_LOGOUT_FORCE_CONSENT=true`, see [route.ts](/root/projects/MoAuth/external/subboost/local/app/api/auth/logout/route.ts:12)。未有 live E2E。 |

## Browser E2E (E1-E9)
| # | 场景 | 结论 | 证据 |
|---|------|------|------|
| E1 | 首次授权完整链路 | FAIL | `node scripts/test-chain-navigation.mjs`: SubBoost `127.0.0.1:3001` connection refused。 |
| E2 | 已授权静默登录 | FAIL | 同脚本 `Account SSO skip (warm)` 失败于 SubBoost connection refused。 |
| E3 | `prompt=consent` 强制 consent | MANUAL_REQUIRED | 未有 live browser evidence；逻辑支持 `forceConsent`，见 [prompt-flow.js](/root/projects/MoAuth/apps/connect/src/oidc/prompt-flow.js:61)。 |
| E4 | scope 扩大需重新 consent | MANUAL_REQUIRED | Store 单测覆盖 subset 语义，但无 browser evidence。 |
| E5 | 撤销授权后重登需 consent | MANUAL_REQUIRED | Account revoke 单测存在，缺 live browser evidence。 |
| E6 | Account 不可达 -> fail-closed | FAIL | `test-account-health-probe` 在服务未启动时失败；chain script account-down 场景也因 SubBoost 不可达失败。 |
| E7 | authorized-apps 查询失败 -> 503 不 finalize | FAIL | `login-authorized-apps-failclosed.test.js:27` failure；POST `/api/consent` 还存在静默 finalize 风险。 |
| E8 | SubBoost 普通 logout 语义 | MANUAL_REQUIRED | 静态代码符合默认不 force consent；缺 live browser evidence。 |
| E9 | 公网域名一致性 | FAIL | 当前只有 loopback local env；无 staging/production HTTPS 域名证据。 |

## P0 / P1 / P2 Status
### P0（阻断）
- [ ] `MOAUTH_CONNECT_ISSUER` / public URL 指向生产 HTTPS 公网域名：未满足，当前 local env 为 `http://127.0.0.1:3000`。
- [ ] `production-jwks` 已配置且 production discovery 不出现 dev marker：未满足，static gate 报 signing mode/private key FAIL。
- [ ] `npm run moauth:verify-oidc:release` staging 全绿：未满足，exit 1。
- [x] SubBoost 仅配置 Connect issuer，生产未启用 upstream fallback：本地 static gate 未发现 fallback。
- [ ] 浏览器 E1/E2/E6/E7/E9 通过：未满足。
- [ ] authorized-apps fail-closed 已验证：未满足，自动化失败且代码路径有风险。
- [x] 私钥未入库：`find secrets -maxdepth 3 -type f` 报 `No such file or directory`。

### P1（强烈建议）
- [ ] 浏览器 E3/E4/E5/E8 全通过：缺 live evidence。
- [ ] staging 附真实 `MOAUTH_VERIFY_ID_TOKEN` 验签通过：缺 sample token。
- [ ] 单实例 file store warning 已评审并接受，或已切 DB store：当前仅 warning，未见接受记录。
- [ ] 密钥轮换 runbook：v1 限制已记录，未验证 runbook 交付。
- [ ] Account / Connect 健康检查与告警接入：本地 health probe 未通过。
- [ ] 回滚方案：未在本次审查中发现完整 release rollback proof。

### P2（后续）
- [ ] JWKS v2 current + previous 双钥轮换。
- [ ] authorized-apps DB store + 多实例水平扩展。
- [ ] 自动化 browser-e2e 纳入 release workflow。
- [ ] OIDC 合规扫描。
- [ ] 密钥自动轮换与 HSM/KMS 集成。

## Code Findings

### Issue 1 -- Severity: bug
- File: [route.js](/root/projects/MoAuth/apps/connect/app/api/consent/route.js:87)
- Description: Consent `allow` 先调用 `finalizeAuthRequest`，再用 `void recordConsentSideEffects(...).catch(() => {})` 异步记录 authorized-apps grant。`recordAuthorizedAppFromAccount` 失败会被吞掉。
- Impact: Account authorized-apps API 不可用时，用户点击 allow 仍可能完成 OIDC callback，违反 IC-008 `AUTHORIZED_APPS_UNAVAILABLE` fail-closed 与 E7。
- Suggestion: 在 finalize 前同步检查/记录 required grant；Account/API 不可用时返回 503 `AUTHORIZED_APPS_UNAVAILABLE`，不得 finalize。审计可 best-effort，授权记忆不可 best-effort。
- Blocks release: yes

### Issue 2 -- Severity: bug
- File: [id-token-issuer.js](/root/projects/MoAuth/apps/connect/src/oidc/id-token-issuer.js:107)
- Description: `rewriteOidcTokenResponseBody` 捕获所有重签/上游验签错误并返回原始 token body。
- Impact: production-jwks 模式下，如果 Connect 重签失败，业务应用可能收到上游 Zitadel `id_token`，导致 `id_token.iss`、kid/JWKS、Connect discovery 不一致；这直接冲突 ADR-010 #5/#6。
- Suggestion: production-jwks 下重签失败必须 fail-closed，返回 502/invalid token response，不得透传上游 `id_token`。dev 模式也应至少显式告警。
- Blocks release: yes

### Issue 3 -- Severity: bug
- File: [account-client.js](/root/projects/MoAuth/apps/connect/src/authorized-apps/account-client.js:46)
- Description: `checkAuthorizedAppFromAccount` 在未配置 `MOAUTH_HANDOFF_INTERNAL_TOKEN` 时先抛 `AUTHORIZED_APPS_UNAUTHORIZED`，导致 fail-closed 单测期望的 Account 503 error code 无法被验证。
- Impact: PR 级 CI 与 acceptance 失败；更重要的是 release gate 对 E7 的自动化证据缺失。
- Suggestion: 测试中提供 internal token 以覆盖 Account 503 propagation；生产路径也应明确区分 misconfiguration 401 与 projection unavailable 503。
- Blocks release: yes

### Issue 4 -- Severity: bug
- File: [memory-store.js](/root/projects/MoAuth/packages/handoff-store/src/memory-store.js:188)
- Description: Memory handoff store 的 consume 通过 `entry.consumedAt = now` + `entry.record = null` 标记消费，但记录仍留在 map。第二次 consume 会走 `entry.consumedAt` 分支，未读 record，当前单进程内可用；但它不是 compare-and-delete/事务，且跨进程仍只能依赖共享 store。
- Impact: 当前内存实现通过单元测试，但不构成 production 跨进程一次性消费证据；IC-013 明确推荐 Redis/Postgres，Account/Connect 独立进程时不得仅 Account 内存。
- Suggestion: 对 production 明确禁用 memory handoff store 或接入事务型共享 store；报告中作为 P1/P0 按部署拓扑决策。
- Blocks release: no for current single-instance local; yes for multi-instance production

## Security Sweep
- Open redirect: No material issue found in static path. Client redirect URI exact match enforced at [client-contract.js](/root/projects/MoAuth/packages/connect-contract/src/client-contract.js:127) and deny redirect uses recorded `redirectUri`.
- Session/cookie: Connect and SubBoost cookies are HttpOnly/SameSite=Lax and Secure when HTTPS, see [connect-session.js](/root/projects/MoAuth/apps/connect/src/oidc/connect-session.js:78) and [moauth-oidc.ts](/root/projects/MoAuth/external/subboost/local/src/lib/moauth-oidc.ts:109). Production depends on HTTPS deployment evidence, currently missing.
- id_token algorithm/kid: production-jwks static unit gates exist, but production env lacks private key and token rewrite fail-open is a blocker.
- Handoff replay: Unit tests and store code cover hash/TTL/replay; live/cross-process production evidence missing.
- Sensitive information: Report avoids secret values. No `secrets/` files found.
- CSRF: Consent POST/session actions rely on same-site cookies; no explicit CSRF token evidence found in this pass. Needs follow-up before broad browser exposure.
- Upstream fallback: SubBoost fallback is gated to non-production and explicit opt-in; production gate rejects it.

## Accepted Caveats
N/A. Verdict is NO-GO, not GO with caveats.

## Manual Steps Still Required
1. Start a real staging stack with HTTPS Connect, Account, SubBoost, and hidden Zitadel.
2. Configure `production-jwks` with `MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE`, `KID`, and `ALG`.
3. Run `npm run moauth:verify-oidc:release` against staging and capture full output.
4. Produce a real login `id_token`, then run deep verification with `MOAUTH_VERIFY_ID_TOKEN` and `MOAUTH_VERIFY_CLIENT_ID`.
5. Re-run browser E1-E9, including Account down and authorized-apps API failure injection.
6. Document acceptance of single-instance file store or switch to DB store before scaling.

## Recommended Actions
### Before release（P0）
1. Fix `/api/consent` authorized-apps fail-closed ordering: no finalize until required grant/check succeeds.
2. Make production id_token rewrite fail-closed when Connect verification/re-signing fails.
3. Repair the authorized-apps fail-closed test setup and make `npm run test:ci` / `npm run test:acceptance` green.
4. Configure staging production-jwks and run release live verification successfully.
5. Bring up Connect/Account/SubBoost/Zitadel and pass E1/E2/E6/E7/E9 with browser evidence.

### Within 1 iteration（P1）
1. Add browser automation for prompt=consent, scope expansion, revoke-and-relogin, and logout semantics.
2. Decide and document file store single-instance acceptance or implement DB store.
3. Add CSRF-specific review/tests for consent and logout POST endpoints.
4. Deliver key rotation and rollback runbooks.

## Appendix
- Required baseline read: `AGENTS.md`, `docs/uuwu_04_adr.md`, `docs/uuwu_06_interface_contracts_boundaries.md`, `docs/reviews/moauth-release-readiness.md`, `docs/reviews/account-health-probe-review.md`, `.trellis/spec/identity/index.md`.
- Browser artifact: `scripts/.chain-test-artifacts/chain-navigation-report.json`, testedAt `2026-07-06T07:26:05.822Z`, summary `0 passed, 3 failed, 0 skipped`.
- Local ports before live probe: `ss -ltnp` showed no listeners on 3000, 3001, 3002, or 8081.
- Node version: `v20.19.5`.
