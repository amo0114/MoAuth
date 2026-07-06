# Account 健康探测方案 — 实施与测试评审报告

**日期**: 2026-07-02
**范围**: Connect → Account（MoYuan ID）可达性探测专业化改造
**状态**: 已实施，单元 + 集成测试通过

---

## 1. 背景与问题

### 1.1 改造前行为

Connect 通过 `isAccountCenterAvailable()` 对 Account 发起：

```
GET {MOAUTH_ACCOUNT_PUBLIC_URL}/login
```

判定规则：`status > 0 && status < 500` 即视为可用。

### 1.2 主要缺陷

| 缺陷 | 影响 |
|------|------|
| 探测 SSR 页面而非服务契约 | 进程存活 ≠ 身份链路就绪 |
| 无 JSON 语义 | 无法区分「页面 200」与「handoff/Zitadel 配置缺失」 |
| 每次登录请求同步探测 | 失败时固定等待超时（默认 2.5s） |
| 仅 public URL | Docker 同机部署时无法区分浏览器入口与服务间内网地址 |
| 无熔断 | Account 宕机后重复打满超时 |

---

## 2. 方案设计

采用 Kubernetes 风格的 **liveness / readiness** 分层：

```
┌─────────────┐     GET /api/health/ready      ┌─────────────┐
│   Connect   │ ─────────────────────────────► │   Account   │
│  (3000)     │   (internal URL, JSON ok)      │   (3002)    │
└─────────────┘                                └─────────────┘
       │                                              │
       │ 浏览器跳转                                    │ 检查 Zitadel 配置
       └──────── MOAUTH_ACCOUNT_PUBLIC_URL ──────────┘   + handoff token
```

### 2.1 Account 端点

| 端点 | 语义 | 响应 |
|------|------|------|
| `GET /api/health/live` | 进程存活 | `{ ok: true, service: "account" }` |
| `GET /api/health/ready` | 身份链路就绪 | `{ ok, service, checks: { zitadel, handoff } }` |

`ready` 当前检查项（配置级，不每次 ping Zitadel，避免探测本身变慢）：

- `zitadel`: `isZitadelConfigured()`
- `handoff`: `MOAUTH_HANDOFF_INTERNAL_TOKEN` 已配置

### 2.2 Connect 探测逻辑

- 目标 URL: `{MOAUTH_ACCOUNT_INTERNAL_URL || MOAUTH_ACCOUNT_PUBLIC_URL}{MOAUTH_ACCOUNT_HEALTH_PROBE_PATH}`
- 默认路径: `/api/health/ready`
- 成功条件: HTTP 2xx 且 `body.ok === true`
- 短期缓存:
  - 成功 → 10s 正缓存
  - 失败 → 30s 负缓存（简易熔断）

### 2.3 环境变量

| 变量 | 用途 | 默认 |
|------|------|------|
| `MOAUTH_ACCOUNT_PUBLIC_URL` | 用户浏览器跳转 | `http://127.0.0.1:3002` |
| `MOAUTH_ACCOUNT_INTERNAL_URL` | 服务间探测（Docker 内网） | 未设则等同 public |
| `MOAUTH_ACCOUNT_HEALTH_PROBE_PATH` | 探测路径 | `/api/health/ready` |
| `MOAUTH_ACCOUNT_HEALTH_PROBE_TIMEOUT_MS` | 超时 | `2500` |
| `MOAUTH_ACCOUNT_HEALTH_POSITIVE_CACHE_MS` | 成功缓存 | `10000` |
| `MOAUTH_ACCOUNT_HEALTH_NEGATIVE_CACHE_MS` | 失败缓存 | `30000` |

---

## 3. 代码变更清单

### 3.1 Account（新增）

| 文件 | 说明 |
|------|------|
| `apps/account/app/api/health/live/route.js` | Liveness 端点 |
| `apps/account/app/api/health/ready/route.js` | Readiness 端点 |
| `apps/account/src/health/ready-check.js` | 就绪检查逻辑（可单测） |
| `apps/account/test/health.test.js` | 就绪检查单元测试 |

### 3.2 Connect（修改）

| 文件 | 说明 |
|------|------|
| `apps/connect/src/account/account-availability.js` | 改探 ready + 缓存 |
| `apps/connect/src/config/env.js` | internal URL / probe 配置 |
| `apps/connect/test/account-availability.test.js` | 探测与缓存单测 |
| `apps/connect/test/env.test.js` | env 辅助函数单测 |

### 3.3 工具链（修改）

| 文件 | 说明 |
|------|------|
| `packages/browser-e2e/helpers/services.js` | E2E 等待逻辑改探 `/api/health/ready` |
| `scripts/test-account-health-probe.mjs` | Live 集成探测脚本（新增） |
| `package.json` | 新增 `npm run test:account-health-probe` |

### 3.4 行为触发点（未改路由，仍调用同一函数）

- `apps/connect/app/login/page.jsx` — OAuth 登录入口
- `apps/connect/app/api/consent/route.js` — 授权提交前 fail-closed

---

## 4. 测试矩阵与结果

### 4.1 单元测试

```bash
node --test apps/account/test/health.test.js \
         apps/connect/test/account-availability.test.js \
         apps/connect/test/env.test.js
```

| 用例 | 结果 |
|------|------|
| ready 缺 Zitadel → `ok: false` | PASS |
| ready 缺 handoff token → `ok: false` | PASS |
| ready 配置完整 → `ok: true` | PASS |
| Connect 解析 ready JSON `ok: true` | PASS |
| Connect 连接失败 / 503 / 缺 ok 字段 | PASS |
| Connect 负缓存（30s 内不重复探测） | PASS |
| internal URL 优先于 public URL | PASS |

**结果**: 15/15 PASS

### 4.2 Live 集成测试 — Account 运行中

```bash
npm run test:account-health-probe
```

| 用例 | 结果 | 备注 |
|------|------|------|
| `GET /api/health/live` | PASS | HTTP 200 |
| `GET /api/health/ready` | PASS | `checks.zitadel=true, handoff=true` |
| `isAccountCenterAvailable()` 模块探测 | PASS | `available=true` |
| 有效 `authRequest` 登录流程 | PASS | 307 重定向至 Account `/login`（预期） |
| 负缓存 | PASS | 同进程内 1 次 fetch |

**结果**: 5/5 PASS

### 4.3 Live 集成测试 — Account 停止（3002 关闭）

| 用例 | 结果 | 备注 |
|------|------|------|
| health 端点不可达 | FAIL（预期） | 记录状态，不计入 exit code |
| Connect 登录页（有效 authRequest） | PASS | HTTP 200，渲染 `connect-card--unavailable` |
| 负缓存 | PASS | |

**结果**: 关键路径 2/2 PASS，exit code 0

### 4.4 手动抽检

```bash
# Account up
curl http://127.0.0.1:3002/api/health/ready
# → {"ok":true,"service":"account","checks":{"zitadel":true,"handoff":true}}

# Account down + 有效 OAuth 流程
curl "http://127.0.0.1:3000/login?authRequest=V2_..."
# → 200，页面含 unavailable-flow / connect-card--unavailable
```

---

## 5. Docker / 同机部署建议

### 5.1 Compose 示例

```yaml
services:
  connect:
    environment:
      MOAUTH_ACCOUNT_PUBLIC_URL: https://id.example.com
      MOAUTH_ACCOUNT_INTERNAL_URL: http://account:3002
      MOAUTH_ACCOUNT_HEALTH_PROBE_PATH: /api/health/ready

  account:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/api/health/ready"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 15s
```

### 5.2 职责分离

| 通道 | URL | 用途 |
|------|-----|------|
| Public | `https://id.example.com` | 浏览器登录、handoff 回跳 |
| Internal | `http://account:3002` | Connect 探测、内部 API |

避免 Connect 通过公网域名探测自身（hairpin NAT、TLS 终止、CDN 干扰）。

### 5.3 运维建议

- **Orchestrator**: liveness → `/api/health/live`，readiness → `/api/health/ready`
- **监控**: 对 ready 503 计数告警
- **发布**: Account ready 失败时，Connect 应 fail-closed（已实现）

---

## 6. 已知限制与后续项

| 项 | 说明 | 优先级 |
|----|------|--------|
| ready 不 ping Zitadel | 仅验证配置，不验证 Zitadel 进程可达 | P2 — 可加 `ACCOUNT_HEALTH_DEEP_CHECK=true` |
| Connect 无对称 health 端点 | browser-e2e 仍用 Connect `/login` 探测 | P3 |
| 正缓存 10s | Account 宕机后最长 10s 内可能仍判可用 | 可接受；可缩短或加主动失效 |
| 无效 authRequest 仍先 redirect | 过期 authRequest 在可用性检查前 redirect 到 Account | P2 — 可调整检查顺序 |

---

## 7. 评审检查项

- [x] Account 提供标准 health/live + health/ready
- [x] Connect 探测 JSON readiness 而非 SSR `/login`
- [x] 支持 public / internal URL 分离
- [x] 失败熔断（负缓存 30s）
- [x] Account 宕机时 Connect 显示独立不可用页（非继续授权）
- [x] 单元测试覆盖核心逻辑
- [x] Live 脚本可复现 up/down 场景
- [ ] 生产 Compose/K8s manifest 落地（待运维 PR）
- [ ] ready 深度检查 Zitadel 连通性（可选增强）

---

## 8. 复现命令

```bash
# 终端 1
npm run dev:connect    # http://127.0.0.1:3000

# 终端 2
npm run dev:account    # http://127.0.0.1:3002

# 单元测试
node --test apps/account/test/health.test.js \
         apps/connect/test/account-availability.test.js \
         apps/connect/test/env.test.js

# Live 集成（Account 需运行）
npm run test:account-health-probe

# 模拟 Account 宕机后验证 fail-closed
fuser -k 3002/tcp
npm run test:account-health-probe   # 应 PASS unavailable 场景
npm run dev:account                 # 恢复
```

---

## 9. 结论

改造已完成并通过测试。Connect 对 Account 的探测从「GET `/login` 看 status」升级为「GET `/api/health/ready` 看 JSON 契约」，并具备 Docker 内网探测与失败熔断能力。Account 停止时，有效 OAuth 流程会在 Connect 侧 fail-closed，展示不可用诊断页，不会继续进入授权。

**建议评审结论**: 批准合并；运维侧按第 5 节补充 Compose healthcheck 与 internal URL 配置。