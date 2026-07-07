# Aura（MoAuth）

**Aura** 是一套自托管的统一身份系统。仓库内部代号 **MoAuth**（Mo + Auth），对外产品名称为 **Aura**。

用户在一个账号中心注册并管理账号，通过 Connect 登录网关访问多个业务应用（如 SubBoost）。底层认证由自部署 [Zitadel](https://zitadel.com/) 承担，但对终端用户和业务应用隐藏。

## 架构一览

```
用户浏览器
    │
    ├─ connect.<domain>   → Connect（对外 OIDC Issuer、授权/consent）
    ├─ account.<domain>   → Account（注册、登录、账号管理）
    ├─ app.<domain>       → SubBoost（示例业务应用）
    └─ id.<domain>        → Zitadel（仅运维/内网，不对用户暴露）
```

| 组件 | 职责 |
|------|------|
| **Connect** | 对外 OIDC issuer；代理 Zitadel 协议端点；签发 `id_token` |
| **Account** | 密码登录、注册、会话 handoff 到 Connect |
| **Zitadel** | 用户目录、MFA、服务账号；不直接面向业务应用 |
| **SubBoost** | 示例一方应用，通过 OIDC + PKCE 接入 Connect |

业务应用只信任 **Connect** 的 issuer（`https://connect.<domain>`），不直接对接 Zitadel。

## 快速开始（本地开发）

**要求**：Node.js ≥ 20.19、npm、自托管 Zitadel（见 `self-hosted/zitadel/`）

```bash
git clone <repo-url> MoAuth
cd MoAuth
git submodule update --init --recursive
npm install

# 终端 1：Zitadel（见 self-hosted/zitadel/README.md）
# 终端 2
npm run dev:connect    # http://127.0.0.1:3000
# 终端 3
npm run dev:account    # http://127.0.0.1:3002
```

品牌名、域名通过环境变量配置，默认产品名为 **Aura**：

```bash
NEXT_PUBLIC_IDENTITY_PRODUCT_NAME=Aura
NEXT_PUBLIC_IDENTITY_ACCOUNT_NAME=Aura 账号中心
```

更多细节见 [`docs/moauth_product_guide.md`](docs/moauth_product_guide.md)。

## 生产 / Staging 部署（Docker Compose）

完整 Runbook：[`docs/deploy/moauth-staging-docker-runbook.md`](docs/deploy/moauth-staging-docker-runbook.md)

### 1. 准备服务器

- Linux + Docker Compose v2
- DNS 解析到服务器：
  - `connect.<domain>`
  - `account.<domain>`
  - `app.<domain>`
  - `id.<domain>`（建议仅内网/运维可访问）
- **已有 Nginx** 占 80/443 时：使用本仓库的 Nginx 模式（默认），不要用 Caddy

### 2. 配置环境

```bash
cd MoAuth
git submodule update --init --recursive
cp deploy/staging/.env.example deploy/staging/.env
mkdir -p deploy/staging/secrets/connect-signing deploy/staging/bootstrap
```

编辑 `deploy/staging/.env`：

- 填写真实域名（如 `connect.oai-o.com`）
- `ZITADEL_MASTERKEY` 必须 **32 位字母数字**（`tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32`），不要用 base64
- 生成 Connect 签名私钥：

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out deploy/staging/secrets/connect-signing/private.pem
```

### 3. 启动 Zitadel 并完成 Bootstrap

```bash
cd deploy/staging
docker compose up -d zitadel-db zitadel
docker compose logs -f zitadel   # 等待 healthy
docker compose exec zitadel sh -c 'cat /bootstrap/connect-service.pat'
```

将 PAT 写入 `.env` 的 `ZITADEL_SERVICE_USER_TOKEN`，并在 Zitadel 控制台创建 SubBoost OIDC 应用，填写 `MOAUTH_CONNECT_CLIENT_ID`。

### 4. 构建并启动（ARM64 / 无法拉 GHCR 时必做本地构建）

GHCR 镜像目前为 **amd64**。Oracle ARM 等机器需本地构建：

```bash
cd deploy/staging
docker compose -f docker-compose.yml -f docker-compose.build.yml build connect account subboost
docker compose up -d
docker compose ps
```

服务绑定到本机回环地址，供 Nginx 反代：

| 服务 | 本地端口 |
|------|----------|
| Connect | `127.0.0.1:13000` |
| Account | `127.0.0.1:13002` |
| SubBoost | `127.0.0.1:13001` |
| Zitadel | `127.0.0.1:18080` |

### 5. 配置 Nginx

参考 [`deploy/staging/nginx.example.conf`](deploy/staging/nginx.example.conf)。

**关键**：反代时必须设置：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto https;
```

否则 Zitadel discovery 会返回 `http://` issuer，OIDC 校验会失败。

### 6. 验收

```bash
curl -fsS https://connect.<domain>/.well-known/openid-configuration | jq .issuer
# 期望: "https://connect.<domain>"

curl -fsS https://account.<domain>/api/health/ready | jq .
curl -fsS https://app.<domain>/api/health/live | jq .
```

浏览器：从 SubBoost 点击「使用 Aura 登录」，完成 Account 登录 → Connect 授权 → 回到应用。

### 可选：使用 Caddy 作为边缘代理

若服务器 80/443 未被占用：

```bash
docker compose --profile caddy up -d
```

## 仓库结构

```
MoAuth/
├── apps/
│   ├── connect/      # OIDC 网关（对外 issuer）
│   └── account/      # 账号中心
├── packages/         # 共享库（handoff、client-registry 等）
├── external/subboost # SubBoost 业务应用（git submodule）
├── deploy/staging/   # Docker Compose 生产模板
├── self-hosted/zitadel/
└── docs/             # PRD、ADR、部署 Runbook
```

## 命名说明

| 名称 | 含义 |
|------|------|
| **Aura** | 对外产品品牌（登录页、账号中心 UI） |
| **MoAuth** | 仓库与内部服务代号（如 `moauth-connect` 镜像名） |
| **MoYuan ID** | 历史占位品牌，已废弃；代码默认已改回 Aura |
| **Connect / Account** | 子产品名称，不变 |

## 常见问题

### `/.well-known/openid-configuration` 返回 404

Next.js 对 `/.well-known/` 路径需显式路由。本仓库已在 `apps/connect/app/.well-known/[...path]/route.js` 修复。**必须重新构建 Connect 镜像**后部署。

### `ZITADEL_MASTERKEY must be 32 bytes, but is 64`

使用了 `openssl rand -base64` 生成了 64 字符。请改用 32 位字母数字（见 `.env.example` 注释）。

### Zitadel bootstrap `permission denied` on `/bootstrap/`

确保 `deploy/staging/bootstrap/` 目录存在且可写；compose 已改为 bind mount `./bootstrap:/bootstrap:rw`。

### GHCR pull 失败（ARM64）

在服务器上本地 build（见上文 §4），不要依赖 `docker compose pull`。

## 文档索引

- [产品使用指南](docs/moauth_product_guide.md)
- [Staging Docker Runbook](docs/deploy/moauth-staging-docker-runbook.md)
- [应用接入教程（MoNexus 示例）](docs/guides/moauth-app-onboarding-monexus.md)
- [Zitadel 自托管](self-hosted/zitadel/README.md)

## License

Private / 内部项目。部署前请轮换所有 `change-me-*` 密钥，勿将 `.env` 或 `bootstrap/` 提交到 Git。