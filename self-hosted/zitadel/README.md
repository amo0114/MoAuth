# MoAuth 自托管 Zitadel 启动手册

本手册描述如何在本地通过 Docker Compose 启动一个自托管 Zitadel 实例，作为 Connect (OIDC 代理) 的隐藏身份核心 (IdP)。

## 前置条件

- Docker 24+ 与 Docker Compose v2+
- 可用端口：`8081`（Zitadel Console + Issuer）
- 浏览器可访问 `http://127.0.0.1.sslip.io:8081`（使用 sslip.io 将 localhost 解析为 127.0.0.1，使 Zitadel 的 TLS-less redirect URI 被浏览器接受）

## 1. 生成 Masterkey

Masterkey 用于加密 Zitadel 内部存储的敏感数据。**首次启动后不可更改**，否则将导致数据无法解密。

```bash
tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
```

将生成的 32 位字符串保存到下一步的 `.env` 文件中。

## 2. 配置环境变量

```bash
cd /mnt/e/workspacePulic/MoAuth/self-hosted/zitadel
cp .env.example .env
```

编辑 `.env`，将 `ZITADEL_MASTERKEY` 替换为上一步生成的随机字符串。其他默认值（`ZITADEL_EXTERNALDOMAIN=127.0.0.1.sslip.io`、`ZITADEL_EXTERNALPORT=8081`、`ZITADEL_EXTERNALSECURE=false`）适用于本地开发，无需修改。

关键变量说明：

| 变量 | 用途 | 何时必须修改 |
|------|------|-------------|
| `ZITADEL_MASTERKEY` | 加密 Zitadel 内部敏感数据 | 首次启动前生成，之后不可更改 |
| `ZITADEL_EXTERNALDOMAIN` | Zitadel 对外宣称的域名，必须与浏览器访问 URL 一致 | 部署到真实域名时修改 |
| `ZITADEL_EXTERNALPORT` | 对外端口，必须与浏览器访问 URL 一致 | 反向代理到 443/80 时修改 |
| `ZITADEL_EXTERNALSECURE` | 是否启用 TLS（影响 redirect URI 协议） | 生产部署改为 `true` |
| `ZITADEL_BOOTSTRAP_USERNAME` / `PASSWORD` / `EMAIL` | 首次启动创建的 master admin | 生产部署必须修改 |
| `ZITADEL_POSTGRES_PASSWORD` | Zitadel 数据库密码 | 生产部署必须修改 |

## 3. 启动服务

```bash
docker compose up -d
```

启动顺序：Postgres 先启动并通过 `pg_isready` 健康检查 → Zitadel `start-from-init` 初始化数据库 schema 与首个实例 → Zitadel 进入 `ready` 状态。

预期启动时间：30-60 秒（取决于机器性能）。

### 验证启动状态

```bash
# 查看容器状态
docker compose ps

# 等待 Zitadel 健康检查通过
docker compose logs -f zitadel
# 看到 "ready" 日志后 Ctrl+C 退出

# 直接探测 ready 端点
curl -sf http://127.0.0.1.sslip.io:8081/debug/healthz && echo "healthy"
```

## 4. 登录 Master Admin Console

浏览器访问：

```
http://127.0.0.1.sslip.io:8081
```

使用 `.env` 中的 bootstrap 凭据登录：

- 用户名：`moauth-admin`（或 `ZITADEL_BOOTSTRAP_USERNAME` 的值）
- 密码：`MoAuthAdminPass2026!`（或 `ZITADEL_BOOTSTRAP_PASSWORD` 的值）

## 5. 创建 MoAuth 组织与项目

1. **创建组织**：Console → 「Organizations」→ 「New」
   - 名称：`MoAuth`（与 `ZITADEL_ORG_NAME` 一致，默认已由 bootstrap 创建）
   - 若 bootstrap 已创建则跳过

2. **创建项目**：进入 `MoAuth` 组织 → 「Projects」→ 「New」
   - 名称：`MoAuth Connect`
   - 记录生成的 **Project ID**（后续需填入 `apps/connect/.env.local` 的 `ZITADEL_PROJECT_ID`）

## 6. 创建 OIDC Client（代表 SubBoost 应用）

1. 在 `MoAuth Connect` 项目下 → 「Applications」→ 「New」→ 类型选 `Web`
2. 认证方式（Grant Type）：
   - 勾选 `Authorization Code`
   - 勾选 `PKCE`（推荐）
3. **Redirect URIs**（必须精确匹配）：
   - `http://localhost:3001/api/auth/callback/oidc`（SubBoost 本地开发）
   - `http://127.0.0.1:3001/api/auth/callback/oidc`
4. **Post Logout URIs**：
   - `http://localhost:3001`
5. 保存后记录生成的 **Client ID** 与 **Client Secret**（仅展示一次，请立即复制保存）

## 7. 创建 Service User 与 PAT（代表 Connect 服务账号）

Connect 后端需要以服务账号身份调用 Zitadel Session API v2（`POST /v2/sessions`、`POST /v2/oidc/auth_requests/{id}`）来代理用户完成密码登录。

1. 在 `MoAuth` 组织下 → 「Users」→ 「Service Users」→ 「New」
   - 名称：`connect-service`
   - 记录生成的 **User ID**
2. 授予该服务账号 `IAM_LOGIN_CLIENT` 角色（使其拥有 `session.link` 等权限）：
   - 进入 `MoAuth` 组织 → 「Authorizations」→ 添加授权
   - 选择 `connect-service` 用户
   - 角色选择 `IAM_LOGIN_CLIENT`（或对应的项目级角色，取决于 Zitadel 版本）
3. 生成 Personal Access Token (PAT)：
   - 进入 `connect-service` 用户详情 → 「Personal Access Tokens」→ 「New」
   - 复制生成的 PAT（仅展示一次，格式类似 `xxxx-xxxx-xxxx`）

## 8. 配置 Connect 环境

将以下值复制到 `apps/connect/.env.local`：

```env
# 指向自托管实例
ZITADEL_ISSUER=http://127.0.0.1.sslip.io:8081
ZITADEL_API_BASE=http://127.0.0.1.sslip.io:8081

# 第 7 步生成的 PAT（不含 Bearer 前缀）
ZITADEL_SERVICE_USER_TOKEN=<pat-value>

# 第 5 步记录的 Org ID 与 Project ID
ZITADEL_ORG_ID=<org-id-from-console>
ZITADEL_PROJECT_ID=<project-id-from-step-5>
```

⚠️ **注意**：`ZITADEL_API_BASE` 与 `ZITADEL_ISSUER` 必须指向同一域名。`src/config/zitadel.js` 会校验两者一致，否则抛出 `ZITADEL_NOT_CONFIGURED`。

## 9. 端到端验证

```bash
# 启动 Connect
cd /mnt/e/workspacePulic/MoAuth/apps/connect
pnpm dev

# 启动 SubBoost
cd /mnt/e/workspacePulic/MoAuth/external/subboost
pnpm dev
```

浏览器访问 SubBoost（`http://localhost:3001`），点击登录 → 应重定向到 Connect 登录页 (`http://localhost:3000/login?authRequest=V2_xxx`) → 输入 Zitadel 中创建的测试用户凭据 → 成功后回到 SubBoost 完成登录。

## 10. 停止与重置

```bash
# 停止服务（保留数据）
docker compose down

# 完全重置（删除所有数据，下次启动将重新初始化）
docker compose down -v
```

⚠️ 完全重置后再次启动需要重新生成 masterkey 并重新走完第 5-8 步。**不要在生产环境使用 `-v`**。

## 故障排查

### Zitadel 容器无法进入 healthy

```bash
docker compose logs zitadel | tail -50
```

常见原因：
- Masterkey 不是 32 位字母数字 → 重新生成
- Postgres 未就绪 → 检查 `docker compose ps` 中 postgres 的状态
- 端口冲突 → 修改 `.env` 中的 `ZITADEL_EXTERNALPORT`

### 浏览器无法访问 `127.0.0.1.sslip.io:8081`

`sslip.io` 是公共 DNS 服务，将 `127.0.0.1.sslip.io` 解析为 `127.0.0.1`。若 DNS 失效：
- 检查 `/etc/hosts` 是否有覆盖条目
- 直接使用 `http://localhost:8081`，但需同步修改 `ZITADEL_EXTERNALDOMAIN=localhost`

### Connect 报 `ZITADEL_UNAUTHORIZED`

- 确认 PAT 有效且未过期
- 确认服务账号已授予 `IAM_LOGIN_CLIENT` 角色
- 查看日志：`docker compose logs -f zitadel | grep 403`

### Connect 报 `ZITADEL_AUTH_REQUEST_NOT_READY`

密码会话已建立但 Zitadel 要求补齐其他策略（MFA/Passkey）。在 Zitadel Console 中检查项目的登录策略配置，或为测试用户配置对应的认证因素。

## 参考

- 部署拓扑：`self-hosted/zitadel/docker-compose.yml`
- 环境变量：`self-hosted/zitadel/.env.example`
- Connect 配置校验逻辑：`apps/connect/src/config/zitadel.js`
- Zitadel 官方文档：https://zitadel.com/docs/self-hosting/deploy/linux
