# MoAuth Staging Release Readiness Tutorial

本文是一份面向操作员的详细教程，用于把当前 **Conditional NO-GO** 推进到 **Staging GO**。它基于：

- `deploy/staging/docker-compose.yml`
- `deploy/staging/.env.example`
- `deploy/staging/Caddyfile`
- `docs/deploy/moauth-staging-docker-runbook.md`
- `docs/reviews/moauth-staging-deployment-acceptance.md`

结论边界：

- 这份教程完成后，目标是得到 **Staging GO** 证据。
- 在 staging HTTPS live gate、真实 `id_token` 深验、浏览器 E1/E2/E6/E7/E9 证据全部完成前，不得宣称 Production GO。
- 本文不会记录任何 secret 原文。真实 `.env`、PEM、PAT、JWT 只能放在 gitignored 文件、CI secret 或临时 shell 环境中。

## 0. 整体流程

按顺序执行：

1. 准备真实 staging 域名和服务器。
2. 在服务器上准备仓库、Docker、`.env`、签名私钥和 runtime secrets。
3. 首启 Zitadel，取服务账号 PAT。
4. 创建 SubBoost OIDC client，并确保同一个 client 同时存在于 Zitadel 和 Connect registry。
5. 构建并启动 Docker Compose 栈。
6. 执行 HTTPS smoke checks。
7. 执行 `npm run moauth:verify-oidc:release`。
8. 完成浏览器 E1 登录，采集真实 `id_token` 并深验。
9. 完成浏览器 E1/E2/E6/E7/E9 证据。
10. 记录 file store 单实例 sign-off 或迁移 DB store。
11. 填写 staging acceptance record，给出 Staging GO 或 Staging NO-GO。

## 1. 准备真实 staging 域名

选择 4 个 HTTPS 域名。示例：

| 角色 | 示例 | 要求 |
|---|---|---|
| Connect issuer | `connect.staging.example.com` | 业务应用只信这个 issuer |
| Account Center | `account.staging.example.com` | 用户可见 |
| SubBoost | `app.staging.example.com` | 用户可见 |
| Zitadel | `id.staging.example.com` | 隐藏身份核心，不应出现在普通用户浏览器流程 |

在 DNS 服务商处添加 A/AAAA 记录，全部指向 staging 服务器公网 IP：

```bash
dig +short connect.staging.example.com
dig +short account.staging.example.com
dig +short app.staging.example.com
dig +short id.staging.example.com
```

通过标准：

- 每个域名都解析到 staging 服务器。
- 服务器入站 `80/tcp` 和 `443/tcp` 对公网开放，用于 Caddy 和 ACME。
- 不使用 loopback、localhost、内网域名作为 staging release 证据。

Zitadel 访问策略：

- `deploy/staging/Caddyfile` 默认只允许私网来源访问 `ZITADEL_HOST`。
- 如果操作员需要打开 Zitadel Console，优先通过 VPN、跳板机或私网访问。
- 如需临时放行公网 operator IP，只能短时间添加单个 `/32`，完成 client 创建后立刻撤回。不要把 Zitadel 变成长期公网入口。

## 2. 准备服务器和仓库

登录 staging 服务器：

```bash
ssh <operator>@<staging-server>
```

确认 Docker 可用：

```bash
docker version
docker compose version
```

如果尚未部署仓库：

```bash
git clone <repo-url> MoAuth
cd MoAuth
```

如果已经部署仓库：

```bash
cd /path/to/MoAuth
git status --short
git pull --ff-only
```

通过标准：

- `docker compose version` 返回 Compose v2。
- 当前 commit 是准备验收的 release candidate。
- 服务器能访问 Docker registry。若 `docker compose build` 卡在 `registry-1.docker.io` timeout，需要先配置 registry mirror、代理或预拉 base image，不能把网络超时当成应用验收结果。

## 3. 创建 staging env 和 secret 文件

从仓库根目录执行：

```bash
cp deploy/staging/.env.example deploy/staging/.env
chmod 600 deploy/staging/.env
mkdir -p deploy/staging/secrets/connect-signing
mkdir -p deploy/staging/artifacts
```

`deploy/staging/.env` 和 `deploy/staging/secrets/` 已被 `.gitignore` 忽略。不要提交真实值。

### 3.1 填写域名

编辑 `deploy/staging/.env`：

```dotenv
CONNECT_HOST=connect.staging.example.com
ACCOUNT_HOST=account.staging.example.com
SUBBOOST_HOST=app.staging.example.com
ZITADEL_HOST=id.staging.example.com
ACME_EMAIL=ops@example.com
```

替换成你的真实域名和 ACME 邮箱。

### 3.2 生成随机 secret

对每个 `change-me-*` 值生成独立随机值：

```bash
openssl rand -base64 48
```

至少需要替换：

| 变量 | 说明 |
|---|---|
| `ZITADEL_MASTERKEY` | Zitadel master key，首次启动后必须保持稳定 |
| `ZITADEL_POSTGRES_PASSWORD` | Zitadel Postgres 密码 |
| `ZITADEL_BOOTSTRAP_PASSWORD` | Zitadel 初始管理员密码 |
| `MOAUTH_CONNECT_SESSION_SECRET` | Connect session secret |
| `MOAUTH_CONNECT_TRANSACTION_SECRET` | Connect transaction secret |
| `MOAUTH_ACCOUNT_SESSION_SECRET` | Account session secret |
| `MOAUTH_HANDOFF_INTERNAL_TOKEN` | Connect 和 Account 之间的 internal bearer token |
| `MOAUTH_HANDOFF_STORE_SECRET` | Handoff store 加密 secret |
| `SUBBOOST_POSTGRES_PASSWORD` | SubBoost Postgres 密码 |
| `SUBBOOST_ENCRYPTION_KEY` | SubBoost 加密 key |
| `SUBBOOST_JWT_SECRET` | SubBoost JWT secret |
| `SUBBOOST_CRON_SECRET` | SubBoost cron secret |
| `SUBBOOST_MOAUTH_TX_SECRET` | SubBoost MoAuth transaction secret |

注意：

- `SUBBOOST_DATABASE_URL` 里的密码必须和 `SUBBOOST_POSTGRES_PASSWORD` 一致。
- 不要复用同一个随机值。
- 不要把这些值粘贴到聊天、PR、issue 或验收记录正文。

### 3.3 生成 Connect production-jwks 私钥

在仓库根目录执行：

```bash
npm run moauth:generate-signing-keys
cp secrets/connect-signing/private.pem deploy/staging/secrets/connect-signing/private.pem
chmod 600 deploy/staging/secrets/connect-signing/private.pem
```

确认 `.env` 中的路径：

```dotenv
CONNECT_SIGNING_PRIVATE_KEY_FILE_HOST=./secrets/connect-signing/private.pem
MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE=production-jwks
MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID=moauth-connect-staging-1
MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG=RS256
```

通过标准：

- `private.pem` 只在 secret 存储或 gitignored 路径中。
- `MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE` 是 `production-jwks`。
- staging 验收记录只记录 `kid`，不记录 PEM 原文。

## 4. 首启 Zitadel 并取得服务账号 PAT

进入 staging compose 目录：

```bash
cd deploy/staging
docker compose --env-file .env config >/tmp/moauth-staging-compose.yml
```

检查是否还有占位符：

```bash
grep -n "change-me" /tmp/moauth-staging-compose.yml
```

如果有输出，先回到 `.env` 替换占位符。检查后删除临时展开文件：

```bash
rm -f /tmp/moauth-staging-compose.yml
```

先启动 Zitadel 和它的数据库：

```bash
docker compose --env-file .env up -d zitadel-db zitadel
docker compose --env-file .env ps
docker compose --env-file .env logs -f zitadel
```

等待 `zitadel` 变为 healthy 后，读取首启生成的服务账号 PAT：

```bash
docker compose --env-file .env exec zitadel sh -c 'cat /bootstrap/connect-service.pat'
```

把输出值写入 `deploy/staging/.env`：

```dotenv
ZITADEL_SERVICE_USER_TOKEN=<redacted>
```

通过标准：

- `zitadel-db` healthy。
- `zitadel` healthy。
- `ZITADEL_SERVICE_USER_TOKEN` 已填入 `.env`。
- PAT 没有写入 git、聊天或验收报告。

## 5. 创建 SubBoost OIDC client

必须满足双登记：

- Zitadel 中存在 OIDC application。
- Connect client registry 中存在同一个 client，并且 redirect URI 完全一致。

推荐路径是通过 Account Admin 创建应用，让 Account 同步 Zitadel 与 Connect registry。手工只在 Zitadel 创建 app 不够，Connect authorize 会因为 registry 缺失而失败。

### 5.1 获取 Zitadel org/project 信息

使用 VPN、跳板机、私网访问或临时 operator IP 放行方式进入 Zitadel Console。记录：

```dotenv
ZITADEL_ORG_ID=<redacted-id>
ZITADEL_PROJECT_ID=<redacted-id>
```

写入 `deploy/staging/.env`。

### 5.2 先启动全栈占位态

此时 SubBoost client 可能仍是占位符。先启动全栈，用于让 Caddy 和 Account Admin 可访问。SubBoost 在 client 回填前可能无法完成登录，这是预期的临时状态。

```bash
docker compose --env-file .env build connect account subboost
docker compose --env-file .env up -d
docker compose --env-file .env ps
```

如果 build 因 Docker registry timeout 失败，先修网络或配置 registry mirror 后重试。

如果 `subboost` 因占位 `MOAUTH_CONNECT_CLIENT_ID` 无法通过业务登录，不要在这一步判定失败。先完成 §5.3 client 创建和 `.env` 回填，再重启相关服务。

### 5.3 在 Account Admin 创建应用

访问：

```text
https://account.staging.example.com/admin/applications
```

用 staging 管理员登录。若看不到管理后台，确认 `.env`：

```dotenv
MOAUTH_ACCOUNT_ADMIN_SUBJECTS=<zitadel-admin-subject-id>
MOAUTH_CONSOLE_ZITADEL_SYNC=true
```

创建应用：

| 字段 | 值 |
|---|---|
| 应用名 | `SubBoost Staging` |
| 应用主页 | `https://app.staging.example.com` |
| 回调地址 | `https://app.staging.example.com/api/auth/moauth/callback` |
| 环境 | `staging` |
| Provisioning policy | `allowlist` |
| Client type | 页面当前创建为 confidential |

创建成功后页面会返回：

- `clientId`
- 一次性展示的 `clientSecret`，如有

立刻写入 `deploy/staging/.env`：

```dotenv
MOAUTH_CONNECT_CLIENT_ID=<subboost-staging-client-id>
MOAUTH_CONNECT_CLIENT_SECRET=<subboost-client-secret-if-confidential>
```

回填后重启读取这些 env 的服务：

```bash
docker compose --env-file .env up -d connect subboost
docker compose --env-file .env ps
```

通过标准：

- Account Admin 应用列表能看到 `SubBoost Staging`。
- 该应用 `status=active`。
- redirect URI 是 staging HTTPS callback。
- Zitadel Console 中也能看到对应 OIDC app。
- `.env` 中 `MOAUTH_CONNECT_CLIENT_ID` 与页面显示一致。

如果你选择手工在 Zitadel 创建 OIDC app：

1. 在 Zitadel 创建 Authorization Code + PKCE 的 OIDC application。
2. redirect URI 必须是 `https://app.staging.example.com/api/auth/moauth/callback`。
3. 把 client id/secret 写入 `.env`。
4. 再通过 Account Admin 或受控数据迁移把同一个 client 注册到 Connect registry。
5. 不要只做 Zitadel 一侧，否则 Connect 会拒绝 unknown client。

## 6. 构建并启动完整 staging 栈

从 `deploy/staging` 执行：

```bash
docker compose --env-file .env build connect account subboost
docker compose --env-file .env up -d
docker compose --env-file .env ps
```

期望服务：

| 服务 | 期望状态 |
|---|---|
| `caddy` | running |
| `zitadel-db` | healthy |
| `zitadel` | healthy |
| `connect` | healthy |
| `account` | healthy |
| `subboost-db` | healthy |
| `subboost` | healthy |
| `subboost-cron` | running |

查看日志：

```bash
docker compose --env-file .env logs --tail=200 connect
docker compose --env-file .env logs --tail=200 account
docker compose --env-file .env logs --tail=200 subboost
docker compose --env-file .env logs --tail=200 caddy
```

通过标准：

- 没有 secret 缺失错误。
- Connect 启动时没有 dev-hs256 production fallback。
- Account `/api/health/ready` 中 `zitadel` 和 `handoff` 为 ready。
- SubBoost 指向的是 Connect issuer，不是 Zitadel issuer。

## 7. HTTPS smoke checks

在能访问公网 staging 域名的机器上执行：

```bash
curl -fsS https://connect.staging.example.com/.well-known/openid-configuration | jq .
curl -fsS https://connect.staging.example.com/oauth/v2/keys | jq .
curl -fsS https://account.staging.example.com/api/health/ready | jq .
curl -fsS https://app.staging.example.com/api/health/live | jq .
```

检查 discovery：

```bash
curl -fsS https://connect.staging.example.com/.well-known/openid-configuration \
  | jq -r '.issuer, .jwks_uri, .authorization_endpoint, .token_endpoint'
```

通过标准：

- `issuer` 是 `https://connect.staging.example.com`。
- `jwks_uri` 指向 Connect 域名。
- authorize/token/userinfo 等公开端点不泄露 Zitadel 域名给业务应用。

检查 JWKS 不含私钥字段：

```bash
curl -fsS https://connect.staging.example.com/oauth/v2/keys \
  | jq '.keys[] | has("d") or has("p") or has("q") or has("dp") or has("dq") or has("qi") or has("oth")'
```

通过标准：

- 每一行都是 `false`。
- JWKS 中存在 `kid=moauth-connect-staging-1` 或你配置的实际 `kid`。

## 8. 执行 release OIDC gate

从仓库根目录执行。不要把 secret 写进 shell history 长期保存；推荐使用临时 shell 或 gitignored env 文件。

```bash
cd /path/to/MoAuth
set -a
. deploy/staging/.env
set +a

export NODE_ENV=production
export MOAUTH_CONNECT_ISSUER=https://${CONNECT_HOST}
export MOAUTH_CONNECT_PUBLIC_URL=https://${CONNECT_HOST}
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE=production-jwks
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE=/path/to/MoAuth/deploy/staging/secrets/connect-signing/private.pem
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID=${MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID}
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG=${MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG}
export MOAUTH_VERIFY_SUBBOOST_ENV_FILE=/path/to/MoAuth/deploy/staging/.env

mkdir -p deploy/staging/artifacts
npm run moauth:verify-oidc:release 2>&1 | tee deploy/staging/artifacts/staging-oidc-release-$(date +%F-%H%M%S).log
```

通过标准：

- 命令 exit code 为 `0`。
- static checks 全部 PASS。
- live discovery/JWKS checks 全部 PASS。
- 允许出现 file store 单实例 WARN，但必须在 §12 sign-off。
- 第一次运行可以看到 `id_token_checks` SKIP，因为还没有真实登录 token。§10 完成后必须不再 SKIP。

失败处理：

| 现象 | 处理 |
|---|---|
| `live_connect_checks` FAIL | 检查 DNS、Caddy、Connect health、TLS 证书 |
| issuer 不匹配 | 检查 `CONNECT_HOST`、`MOAUTH_CONNECT_ISSUER`、Caddy 反代和 Connect env |
| JWKS kid 不匹配 | 检查 `MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID` 与私钥挂载 |
| SubBoost fallback gate FAIL | 检查 `MOAUTH_VERIFY_SUBBOOST_ENV_FILE` 中 `MOAUTH_CONNECT_ISSUER` 和 `SUBBOOST_MOAUTH_TX_SECRET` |

## 9. 浏览器 E1 首次登录

使用无痕窗口访问：

```text
https://app.staging.example.com
```

执行：

1. 点击 SubBoost 登录。
2. 浏览器应跳到 Connect/Account 域名，不应跳到 Zitadel 域名。
3. 在 Account 登录 staging 测试账号。
4. 回到 Connect consent 页面。
5. 点击 Allow。
6. 返回 SubBoost callback 并建立 SubBoost 本地 session。

E1 通过标准：

- 最终进入 SubBoost 已登录页面。
- callback URL 没有 `error=`。
- 普通用户浏览器地址栏不出现 `id.staging.example.com`。
- Account authorized-apps grant 记录成功。
- 产生真实 `id_token`，供 §10 深验。

证据：

- 录屏或关键截图。
- 最终 URL。
- 操作者。
- 时间戳。
- 测试账号标识，不能记录密码。

## 10. 真实 id_token 深验

E1 成功后，从 SubBoost token exchange/session 处理路径取得真实 staging `id_token`。

安全规则：

- 不把完整 JWT 写入 git、文档、聊天或验收报告。
- 只在临时 shell 里设置 `MOAUTH_VERIFY_ID_TOKEN`。
- 验收记录只写 claims 摘要：`iss`、`aud`、`kid`、`exp`。

执行：

```bash
cd /path/to/MoAuth
set -a
. deploy/staging/.env
set +a

export NODE_ENV=production
export MOAUTH_CONNECT_ISSUER=https://${CONNECT_HOST}
export MOAUTH_CONNECT_PUBLIC_URL=https://${CONNECT_HOST}
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE=production-jwks
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE=/path/to/MoAuth/deploy/staging/secrets/connect-signing/private.pem
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID=${MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID}
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG=${MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG}
export MOAUTH_VERIFY_SUBBOOST_ENV_FILE=/path/to/MoAuth/deploy/staging/.env
export MOAUTH_VERIFY_ID_TOKEN="<paste-real-staging-id-token-in-this-shell-only>"
export MOAUTH_VERIFY_CLIENT_ID="${MOAUTH_CONNECT_CLIENT_ID}"

npm run moauth:verify-oidc:release 2>&1 | tee deploy/staging/artifacts/staging-oidc-release-with-id-token-$(date +%F-%H%M%S).log
unset MOAUTH_VERIFY_ID_TOKEN
```

通过标准：

- 命令 exit code 为 `0`。
- `id_token_checks` 不再 SKIP。
- `id_token_iss_matches_discovery` PASS。
- `id_token_aud_contains_client_id` PASS。
- `id_token_signature_valid_with_connect_jwks` PASS。
- `iss` 是 Connect issuer，不是 Zitadel issuer。

## 11. 浏览器 P0 证据采集

所有场景都必须使用真实 staging HTTPS 域名。不要用 localhost 证据替代。

### 11.1 E2 warm SSO

前置：E1 已成功，浏览器仍保留 Connect SSO session。

操作：

1. 同一用户再次从 SubBoost 发起登录。
2. scope 不变。

通过标准：

- 不再要求输入 Account 密码。
- 不再展示 consent。
- 直接回到 SubBoost callback 并保持登录。

证据：

- 录屏或截图。
- 最终 URL。
- 操作者和时间戳。

### 11.2 E6 Account unavailable fail-closed

目标：证明 Account 不可用时 Connect 不会继续 finalize OIDC。

故障注入方式任选一种：

```bash
cd /path/to/MoAuth/deploy/staging
docker compose --env-file .env stop account
```

或在防火墙/安全组中临时阻断 Connect 到 Account 的服务间访问。

操作：

1. 使用无痕窗口从 SubBoost 发起登录。
2. 观察 Connect 登录路径。

通过标准：

- Connect 展示服务不可用页面或返回 503。
- 不跳到 SubBoost callback 成功态。
- 不产生成功授权。

恢复：

```bash
docker compose --env-file .env start account
docker compose --env-file .env ps
curl -fsS https://account.staging.example.com/api/health/ready | jq .
```

证据：

- 故障注入命令或变更记录。
- 浏览器截图或录屏。
- 恢复后的 health check。

### 11.3 E7 authorized-apps unavailable fail-closed

目标：证明 authorized-apps grant 写入失败时，Connect 不会 finalize OIDC。

推荐故障注入：

- 临时阻断 Connect 到 Account internal authorized-apps endpoint。
- 或临时停 Account，并在测试记录中明确这是 authorized-apps/API 不可达覆盖。

如果只能停 Account：

```bash
cd /path/to/MoAuth/deploy/staging
docker compose --env-file .env stop account
```

操作：

1. 清理浏览器 session 或使用无痕窗口。
2. 从 SubBoost 发起登录。
3. 登录 Account 后，在 Connect consent 点击 Allow。

通过标准：

- Connect 返回 503 或展示错误。
- 错误码应体现 `AUTHORIZED_APPS_UNAVAILABLE` 或等价服务不可用语义。
- 不跳到 SubBoost 成功 callback。
- 不 finalize auth request。

恢复：

```bash
docker compose --env-file .env start account
```

证据：

- 故障注入方式。
- 503 页面或响应截图。
- 证明 callback 未成功的最终 URL。

### 11.4 E9 public domain consistency

检查 E1/E2 全流程中的浏览器地址栏、redirect、cookie 和 discovery。

通过标准：

- 普通用户浏览器地址栏只出现 Connect、Account、SubBoost 域名。
- 不出现 Zitadel 域名。
- SubBoost 配置的 issuer 是 Connect issuer。
- Connect discovery 的 issuer 是 Connect 域名。
- Set-Cookie 在 HTTPS 下是 Secure。

辅助命令：

```bash
curl -fsS https://connect.staging.example.com/.well-known/openid-configuration | jq -r '.issuer'
curl -fsSI https://connect.staging.example.com/ | sed -n '/set-cookie/Ip'
curl -fsSI https://account.staging.example.com/ | sed -n '/set-cookie/Ip'
```

## 12. file store 单实例 sign-off

当前 staging compose 默认：

```dotenv
MOAUTH_CLIENT_REGISTRY_STORE=file
MOAUTH_AUTHORIZED_APPS_STORE=file
```

这只适合单实例。验收记录必须二选一：

| 项 | 选择 |
|---|---|
| 单实例 staging/production | 记录 operator sign-off，明确禁止水平扩容 |
| 多副本生产 | 先迁移 DB-backed store，再申请 Production GO |

sign-off 模板：

```markdown
## File Store Sign-off

- Environment: staging
- Decision: accept file store for single replica only
- Services: connect=1, account=1
- Expansion rule: no horizontal scaling before DB store migration
- Operator:
- Date:
```

## 13. 可选辅助探测

### 13.1 PR 级回归

在 release candidate 上执行：

```bash
npm run test:ci
npm run test:acceptance
```

通过标准：

- 两条命令 exit code 都是 `0`。

### 13.2 Account health probe

脚本默认支持 env 覆盖 Account/Connect URL：

```bash
MOAUTH_ACCOUNT_PUBLIC_URL=https://account.staging.example.com \
MOAUTH_CONNECT_PUBLIC_URL=https://connect.staging.example.com \
MOAUTH_CONNECT_CLIENT_ID="${MOAUTH_CONNECT_CLIENT_ID}" \
node scripts/test-account-health-probe.mjs
```

注意：

- 当前脚本的 authorize probe 使用本地 callback `http://127.0.0.1:3001/api/auth/moauth/callback`。
- 真实 staging evidence 不能依赖 loopback callback。
- 该脚本可作为辅助健康探测；Production GO 证据以 §8、§10、§11 为准。

## 14. 填写 staging acceptance record

建议新建 gitignored 或单独归档的验收记录，不要包含 secret：

```markdown
# MoAuth Staging Acceptance Record

- Date:
- Environment: staging
- Operator:
- Reviewer:
- Connect issuer:
- Account URL:
- SubBoost URL:
- Zitadel URL:
- JWKS kid:
- Commit SHA:
- Verdict: Staging GO / Staging NO-GO

## Automation

| Gate | Result | Evidence |
|---|---|---|
| docker compose config | pass/fail | |
| docker compose build | pass/fail | |
| smoke checks | pass/fail | |
| moauth:verify-oidc:release without token | pass/fail | |
| moauth:verify-oidc:release with id_token | pass/fail | |

## Browser P0

| ID | Result | Evidence |
|---|---|---|
| E1 first authorization | pass/fail | |
| E2 warm SSO | pass/fail | |
| E6 Account unavailable fail-closed | pass/fail | |
| E7 authorized-apps unavailable fail-closed | pass/fail | |
| E9 domain consistency | pass/fail | |

## id_token claims only

- iss:
- aud:
- kid:
- exp:

## File Store Decision

- client registry store:
- authorized apps store:
- single-instance sign-off:

## Blockers

1.
```

Staging GO 条件：

- `docker compose up -d` 后所有核心服务 healthy 或 running。
- `npm run moauth:verify-oidc:release` 无 token版本 exit 0。
- 带真实 `MOAUTH_VERIFY_ID_TOKEN` 的 release gate exit 0。
- E1/E2/E6/E7/E9 全部 PASS。
- file store 单实例 sign-off 完成，或已迁移 DB store。

任何一项失败，裁决都是 Staging NO-GO 或继续 Conditional NO-GO。

## 15. 回滚

如果上线 staging 后出现阻断：

```bash
cd /path/to/MoAuth/deploy/staging
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=200 connect account subboost
docker compose --env-file .env down
```

注意：

- `docker compose down` 不删除数据卷。
- 不要执行 `docker compose down -v`，除非你明确要销毁 staging 数据。
- 如果只需要回滚某个服务，优先恢复上一版镜像或上一版 `.env` 后 `docker compose up -d <service>`。

回滚后必须复查：

```bash
curl -fsS https://connect.staging.example.com/.well-known/openid-configuration | jq -r '.issuer'
curl -fsS https://account.staging.example.com/api/health/ready | jq .
curl -fsS https://app.staging.example.com/api/health/live | jq .
```

## 16. 最终裁决话术

如果全部通过：

```text
Staging GO. 代码 P0、staging HTTPS live gate、真实 id_token 深验、浏览器 E1/E2/E6/E7/E9 证据已完成。可进入 Production GO 复审，但仍需生产环境 secrets、域名、监控、备份和扩容策略确认。
```

如果还有缺口：

```text
Conditional NO-GO. 代码和 staging 编排已具备执行条件，但仍缺少 <具体证据>。在该证据补齐前，不得宣称 Production GO。
```
