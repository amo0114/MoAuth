# 注册防护与管理员后台增强 — 实施计划 (v3)

## 概述

为 MoAuth 用户体系增加注册防护，提供管理员对注册流程的完整管控能力，同时补齐 AdminUsers 页面缺失的后端操作 API。

---

## 一、架构总览

```
                    ┌──────────────────────┐
                    │  RegistrationConfig  │
                    │  (mode, updatedBy)   │
                    └──────┬───────────────┘
                           │ 读取
                           ▼
  POST /api/register ──→ 模式校验阀 ──→ [open] ──→ Zitadel 创建用户 ──→ 返回成功
                              │
                              ├── [closed] ──→ 403 "注册已关闭" (不调用 Zitadel)
                              │
                              ├── [review] ──→ validateRegistrationInput
                              │                  → Zitadel 创建用户
                              │                  → deactivate (fail-closed, 失败→补偿删除→503)
                              │                  → 写入审核队列 (reviewStatus=pending, 失败→补偿删除→503)
                              │                  → 返回 "等待审核"
                              │
                              └── [invite] ──→ validateRegistrationInput (先校验输入，不写邀请码)
                                               → 校验 inviteCode 必填/有效性/额度 (不消费)
                                               → reserveInviteCode(code) → 返回 reservationId
                                               → Zitadel 创建用户
                                               → 成功 consumeInviteCode(reservationId) | 失败 releaseInviteCode(reservationId)
                                               → 返回成功
```

### 关键语义约束

| 模式 | 原子性保证 | 失败补偿 |
|------|-----------|---------|
| open | 无额外要求 | Zitadel 自身回滚 |
| closed | 无 | 纯校验，不调用 Zitadel |
| review | **必须 fail-closed**：用户不可登录 + 审核记录持久化，任一失败则整体失败 | deactivate 失败 → delete 已创建用户 → 503；写审核记录失败 → delete 用户 (若已 deactivate) → 503 |
| invite | **先输入校验 → reserve → 注册 → 成功 consume / 失败 release** | 注册成功 → `consumeInviteCode(reservationId)` 记录 userId/email；注册失败 → `releaseInviteCode(reservationId)` 幂等回滚 |

---

## 二、实施顺序

```
Batch 1 (P1+P2)      Batch 2 (P3)          Batch 3 (P4)          Batch 4 (P5)
 ┌──────────────┐     ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
 │ Config Store  │     │ 审核队列      │      │ 邀请码系统    │      │ 启用/禁用    │
 │ API + AdminUI │     │ (fail-closed) │      │ (reservation │      │ API          │
 │ 模式校验阀    │     │ + 审核 UI     │      │  /consume)   │      │ (含全面审核   │
 │ (open/closed) │     │ Zitadel 函数  │      │ + 管理 UI    │      │  保护)       │
 └──────────────┘     └──────────────┘      └──────────────┘      └──────────────┘
```

**设计理由**: P1 单独上线仅存储配置、无实际门禁，价值有限。P1+P2 一起完成后即有可验证的 closed/open 行为。P3 是最高风险事务逻辑，单独交付。P4 邀请码依赖 P1/P2 但不依赖 P3。P5 需要读取 P3 的 review store 来防绕过，因此最后做。

不在本轮范围内:
- **动态管理员注册** (session 一致性、自降权、env 冲突未解决)
- **管理员直接设密码** (需单独确认 Zitadel 管理 API 与审计语义)
- **requireEmailVerify / enforceMfa** (无执行点, 假开关)
- **通用管理员删除用户** (高危操作, 需额外评审)

在本轮范围内但作为系统安全流程而非通用功能的删除操作:
- **审核补偿删除**: P3 deactivate 失败或写 store 失败时，系统自动删除已创建的 Zitadel 用户
- **审核拒绝删除**: P3 管理员拒绝审核时，调用 `deleteHumanUser` 删除 Zitadel 用户

---

## 三、Phase 1 — 注册配置存储层

### 3.1 注册配置 Store

**文件**: `apps/account/src/registration/config-store.js`

遵循现有 `application-requests/store.js` 的 file-based store 模式。

```javascript
// 持久化数据结构 (data/registration-config.json)
{
  "version": 1,
  "mode": "open",        // "open" | "closed" | "review" | "invite"
  "updatedAt": "2026-07-06T...",
  "updatedBy": "admin-subject-id"
}
```

**导出接口**:
- `getRegistrationConfig()` → `{ mode, updatedAt, updatedBy }`
- `setRegistrationConfig({ mode }, actor)` → 写文件 + 审计事件
- 支持 `memory` / `file` 两种 backend，规则与现有 stores 一致: `NODE_ENV=test` 用 memory，其余用 file

**环境变量**:
- `MOAUTH_REGISTRATION_CONFIG_STORE_PATH` — 自定义路径，默认 `../../data/registration-config.json`

### 3.2 注册设置 API

| 方法 | 路由 | 功能 |
|------|------|------|
| GET | `/api/admin/registration-config` | 获取当前注册模式 |
| PATCH | `/api/admin/registration-config` | 更新模式（body: `{ mode: "open"|"closed"|"review"|"invite" }`） |

**路由文件**: `apps/account/app/api/admin/registration-config/route.js`
**Service**: `apps/account/src/admin/registration-admin-api.js`

校验: `mode` 必须是四个合法值之一，否则 400。

### 3.3 AdminSettings 页面接入

修改 `apps/account/src/features/admin/components/AdminSettings.tsx`:
- 将原本的 `allowRegister` 布尔开关替换为注册模式选择器
- 新增 `RegistrationModeSelector` 组件，RadioGroup 展示四种模式
- 加载时调用 `GET /api/admin/registration-config`
- "保存"按钮调用 `PATCH /api/admin/registration-config`
- "重置"按钮恢复为上次保存的值
- 去掉 `requireEmailVerify` / `enforceMfa` 开关（本轮不做）
- 保留品牌信息区块（无需后端，纯展示）

**新组件**: `apps/account/src/features/admin/components/RegistrationModeSelector.tsx`

四种模式文案:

| 模式 | label | 说明 |
|------|-------|------|
| open | 开放注册 | 任何用户可自行注册 |
| closed | 关闭注册 | 禁止新用户注册 |
| review | 审核注册 | 新用户注册后需管理员审核通过方可登录 |
| invite | 邀请码注册 | 仅持有效邀请码的用户可注册 |

---

## 四、Phase 2 — 注册门禁 (open / closed)

### 4.1 注册模式校验阀

修改 `apps/account/src/lifecycle/service.js` 中的 `registerAccountUser`:

```javascript
export async function registerAccountUser(input, options = {}) {
  assertZitadelReady();

  const config = getRegistrationConfig();

  // === 模式校验 ===
  if (config.mode === "closed") {
    throw lifecycleError("REGISTRATION_CLOSED", "注册已关闭，请联系管理员。", 403);
  }

  validateRegistrationInput(input);

  // ...
}
```

`closed` 模式在输入校验之前拦截，不调用 Zitadel，无副作用。

`open` 模式行为不变，与现有流程一致。

### 4.2 前端注册页适配

`apps/account/src/ui/account-register-page.jsx`: 如果 `POST /api/register` 返回 `REGISTRATION_CLOSED`，展示关闭提示而非通用错误。

---

## 五、Phase 3 — 审核模式 (review)

### 5.1 Zitadel Client 新增函数

**文件**: `packages/zitadel-client/src/users.js`

```javascript
// PUT /v2/users/{userId}/deactivate
export async function deactivateHumanUser(userId, options = {})

// PUT /v2/users/{userId}/reactivate
export async function reactivateHumanUser(userId, options = {})

// DELETE /v2/users/{userId}
export async function deleteHumanUser(userId, options = {})
```

更新 `packages/zitadel-client/src/index.js` 导出。

### 5.2 审核模式注册流程 (fail-closed)

修改 `apps/account/src/lifecycle/service.js`:

```javascript
export async function registerAccountUser(input, options = {}) {
  assertZitadelReady();
  const config = getRegistrationConfig();

  if (config.mode === "closed") {
    throw lifecycleError("REGISTRATION_CLOSED", "注册已关闭，请联系管理员。", 403);
  }

  validateRegistrationInput(input);

  // === 审核模式 ===
  if (config.mode === "review") {
    return await registerForReview(input, options);
  }

  // === 开放模式（现有路径） ===
  const result = await registerHumanUser(...);
  return { status: "REGISTERED", ... };
}

async function registerForReview(input, options) {
  // (1) 在 Zitadel 创建用户
  let result;
  try {
    result = await registerHumanUser(input, options);
  } catch (error) {
    // Zitadel 创建失败 → 直接返回错误（无副作用需回滚）
    throw error;
  }

  const { userId, loginName, email } = result;

  // (2) 立即停用 — 若失败则补偿删除
  try {
    await deactivateHumanUser(userId, options);
  } catch (error) {
    // 补偿: 删除已创建的用户
    try {
      await deleteHumanUser(userId, options);
    } catch (deleteError) {
      // 补偿也失败 → 严重审计告警，人工介入
      recordAuditEvent({
        eventType: "registration_review_compensation_failed",
        summary: `审核模式: deactivate 失败后补偿删除也失败, userId=${userId}`,
        metadata: { userId, deactivateError: error.message, deleteError: deleteError.message },
      });
    }
    throw lifecycleError("REGISTRATION_REVIEW_FAILED", "注册处理失败，请稍后重试。", 503);
  }

  // (3) 写入审核队列 — 若失败则补偿删除
  try {
    createRegistrationReview({ userId, loginName, email, displayName: input.displayName });
  } catch (error) {
    // 补偿: 删除已停用的用户
    try {
      await deleteHumanUser(userId, options);
    } catch (deleteError) {
      recordAuditEvent({
        eventType: "registration_review_compensation_failed",
        summary: `审核模式: store 写入失败后补偿删除也失败, userId=${userId}`,
        metadata: { userId, storeError: error.message, deleteError: deleteError.message },
      });
    }
    throw lifecycleError("REGISTRATION_REVIEW_FAILED", "注册处理失败，请稍后重试。", 503);
  }

  return { status: "PENDING_REVIEW", message: "注册成功，等待管理员审核。" };
}
```

### 5.3 审核队列 Store

**文件**: `apps/account/src/registration-review/store.js`

独立于用户状态。审核记录使用 `reviewStatus` 字段，不与 Zitadel user state / email verified 混淆。

```javascript
// 数据结构 (data/registration-reviews.json)
{
  "version": 1,
  "records": {
    "uuid": {
      id: "uuid",
      userId: "zitadel-user-id",
      email: "user@example.com",
      loginName: "username",
      displayName: "display name",
      reviewStatus: "pending",    // "pending" | "approving" | "approved" | "rejecting" | "rejected" | "approve_failed" | "reject_failed"
      reviewNote: null,
      reviewedBySubjectId: null,
      reviewedAt: null,
      createdAt: "2026-07-06T...",
      updatedAt: "2026-07-06T...",
    }
  }
}
```

**reviewStatus 状态机**:

```
                     approve 开始                  approve 成功
  pending ──────────────────────────────────────────────────────────→ approved
           (store: approving)  (Zitadel reactivate)  (store: approved)

  approving ───── (跳过 reactivate) ───────────────────────────────→ approved
           (检测到 approving = 上次 reactivate 已成功但 store 未写完)

                     reject 开始                   reject 成功
  pending ──────────────────────────────────────────────────────────→ rejected
           (store: rejecting)  (Zitadel delete)      (store: rejected)

  rejecting ───── (跳过 delete, 或 delete 404=成功) ───────────────→ rejected
           (检测到 rejecting = 上次 delete 已成功但 store 未写完)

  中间态失败:
  approving → approve_failed (Zitadel reactivate 失败)
  rejecting → reject_failed  (Zitadel delete 失败)
```

**为什么引入中间态**:

`approve` 操作涉及两步——Zitadel reactivate + store update。如果 Zitadel 成功但 store 写失败，用户已激活但记录仍显示 pending。中间态让系统可以检测和恢复:

- `approving`: Zitadel reactivate 成功后、store update 前写入。重试时检测到 `approving` 可跳过 reactivate 直接完成 store write
- `rejecting`: Zitadel delete 成功、store update 前写入。重试时跳过 delete；若 delete 返回 404 按"已删除"处理为成功
- `approve_failed` / `reject_failed`: 外部操作失败时标记，管理员可重试

### 5.4 审核队列 API

| 方法 | 路由 | 功能 |
|------|------|------|
| GET | `/api/admin/registration-reviews` | 列出审核记录，支持 `?reviewStatus=pending` 过滤 |
| POST | `/api/admin/registration-reviews/[id]/approve` | 通过审核: store update → `approving` → `reactivateHumanUser` → store update → `approved` |
| POST | `/api/admin/registration-reviews/[id]/reject` | 拒绝审核: store update → `rejecting` → `deleteHumanUser` → store update → `rejected` |

**approve 实现**:

```javascript
async function approveRegistrationReview(id, actor) {
  const store = getRegistrationReviewStore();

  const record = store.getById(id);
  if (!record) throw new NotFoundError();

  const allowedStatuses = new Set(["pending", "approving", "approve_failed"]);
  if (!allowedStatuses.has(record.reviewStatus)) {
    throw new Error("只能批准待审核、批准中或批准失败的记录");
  }

  // Step 1: 标记 approving（中间态）
  store.update(id, {
    reviewStatus: "approving",
    reviewedBySubjectId: actor.sub,
    reviewedAt: new Date(),
  });

  // Step 2: 激活 Zitadel 用户
  // 如果已经是 approving（重试场景），跳过 reactivate（上次已成功）
  if (record.reviewStatus !== "approving") {
    try {
      await reactivateHumanUser(record.userId);
    } catch (error) {
      // 标记为 approve_failed，可重试
      store.update(id, { reviewStatus: "approve_failed", reviewNote: error.message });
      recordAuditEvent({ eventType: "registration_approve_failed", ... });
      throw error;
    }
  }

  // Step 3: 标记 approved（终态）
  store.update(id, { reviewStatus: "approved" });
  recordAuditEvent({ eventType: "registration_approved", ... });

  return store.getById(id);
}
```

**reject 实现**:

```javascript
async function rejectRegistrationReview(id, actor, reviewNote) {
  const store = getRegistrationReviewStore();

  const record = store.getById(id);
  if (!record) throw new NotFoundError();

  const allowedStatuses = new Set(["pending", "rejecting", "reject_failed"]);
  if (!allowedStatuses.has(record.reviewStatus)) {
    throw new Error("只能拒绝待审核、拒绝中或拒绝失败的记录");
  }

  // Step 1: 标记 rejecting（中间态）
  store.update(id, {
    reviewStatus: "rejecting",
    reviewedBySubjectId: actor.sub,
    reviewedAt: new Date(),
    reviewNote: reviewNote || null,
  });

  // Step 2: 删除 Zitadel 用户（系统安全流程，不属于通用的"管理员删除用户"）
  // 如果已经是 rejecting（重试场景），跳过 delete（上次已成功）
  if (record.reviewStatus !== "rejecting") {
    try {
      await deleteHumanUser(record.userId);
    } catch (error) {
      // Zitadel 返回 404 = 用户已被删除，按成功处理
      if (error.status === 404) {
        // 视为已删除，继续完成 rejected
      } else {
        store.update(id, { reviewStatus: "reject_failed", reviewNote: error.message });
        recordAuditEvent({ eventType: "registration_reject_failed", ... });
        throw error;
      }
    }
  }

  // Step 3: 标记 rejected（终态）
  store.update(id, { reviewStatus: "rejected" });
  recordAuditEvent({ eventType: "registration_rejected", ... });

  return store.getById(id);
}
```

**路由文件**:
- `apps/account/app/api/admin/registration-reviews/route.js`
- `apps/account/app/api/admin/registration-reviews/[id]/approve/route.js`
- `apps/account/app/api/admin/registration-reviews/[id]/reject/route.js`

**Service**: `apps/account/src/admin/registration-review-api.js`

### 5.5 审核队列 UI

修改 `apps/account/src/features/admin/components/AdminUsers.tsx`:

- 在用户列表上方增加筛选 Tabs: `全部 | 活跃 | 待审核 | 已禁用`

  - **待审核 Tab**: 调用 `GET /api/admin/registration-reviews?reviewStatus=pending`
    - 展示审核队列卡片列表：邮箱、登录名、注册时间
    - 每条记录有: `通过` (绿色) + `拒绝` (红色) 按钮
    - 点击后弹出确认对话框，可选填写备注
    - `approve_failed` / `reject_failed` 状态显示错误信息 + "重试"按钮

  - **活跃 / 已禁用 Tab**: 保持现有用户列表逻辑

- reviewStatus 与 user.status 独立展示，不合并

**新组件**: `apps/account/src/features/admin/components/RegistrationReviewPanel.tsx`

---

## 六、Phase 4 — 邀请码模式 (invite)

### 6.1 邀请码事务模型

**核心原则**: 先校验输入，再 reserve，Zitadel 失败则 release。

```
registerAccountUser(invite mode):
  1. validateRegistrationInput(input)          ← 先校验输入，不碰邀请码
  2. 检查 inviteCode 必填/格式                 ← 纯校验
  3. reserveInviteCode(code) → reservationId   ← 预占额度
  4. Zitadel registerHumanUser(...)
     成功 → consumeInviteCode(reservationId)  ← 标记已消费，记录 userId/email/consumedAt
     失败 → releaseInviteCode(reservationId)  ← 幂等回滚
  5. 返回成功
```

**为什么需要 reservationId**:

只按 `code` release 会导致并发/重试场景互相释放额度:

| 时序 | 请求 A | 请求 B |
|------|--------|--------|
| T1 | reserve(code) → usedCount=1 | |
| T2 | | reserve(code) → 额度用完 → 拒绝 |
| T3 | Zitadel 失败 → release(code) → usedCount=0 | |
| T4 | | 重试 reserve(code) → usedCount=1 → 成功！ |

B 本该被拒绝 (T2 额度用完)，但因为 A 的 release 释放了不属于 B 的额度，B 意外通过了。

用 `reservationId` 解决:

```javascript
reserveInviteCode(code) {
  // 内部按 (code, reservationId) 记录预占
  // release(reservationId) 只释放该 reservation 占用的额度
  // 同一个 reservationId 多次 release 幂等
}

releaseInviteCode(reservationId) {
  // 仅当该 reservationId 尚未 release 时，usedCount -= 1
  // 已 release 过的 reservationId 无操作
}
```

### 6.2 邀请码 Store

**文件**: `apps/account/src/registration/config-store.js`（追加）

```javascript
{
  "version": 1,
  "mode": "invite",
  "updatedAt": "...",
  "updatedBy": "...",
  "inviteCodes": {
    "MOAUTH-uuid": {
      code: "MOAUTH-uuid",
      maxUseCount: 1,
      usedCount: 0,
      isRevoked: false,
      createdBy: "admin-subject-id",
      createdAt: "...",
      expiresAt: null,
    }
  },
  "inviteReservations": {
    "reservation-uuid-1": {
      reservationId: "reservation-uuid-1",
      code: "MOAUTH-xxx",
      status: "active",      // "active" | "consumed" | "released"
      createdAt: "...",
      consumedAt: null,       // 成功消费时间
      consumedByUserId: null, // 消费用户的 Zitadel userId
      consumedByEmail: null,  // 消费用户的邮箱
    }
  }
}
```

**接口**:
- `listInviteCodes()` → 所有邀请码
- `createInviteCode({ maxUseCount, expiresAt })` → 生成新码
- `revokeInviteCode(code)` → `isRevoked = true`
- `reserveInviteCode(code)` → 校验有效 + usedCount < maxUseCount → 创建 reservation (status=active) → usedCount+=1 → 返回 `{ reservationId, code }`
- `releaseInviteCode(reservationId)` → 查找 reservation，仅当 status=active 时 usedCount-=1, status=released
- `consumeInviteCode(reservationId, { userId, email })` → status=consumed, 记录 consumedAt/consumedByUserId/consumedByEmail

### 6.3 注册 Service 邀请码流程

```javascript
export async function registerAccountUser(input, options = {}) {
  assertZitadelReady();
  const config = getRegistrationConfig();

  if (config.mode === "closed") {
    throw lifecycleError("REGISTRATION_CLOSED", "注册已关闭", 403);
  }

  validateRegistrationInput(input);

  let reservation = null;

  if (config.mode === "invite") {
    if (!input.inviteCode) {
      throw lifecycleError("INVITE_CODE_REQUIRED", "需要邀请码才能注册", 403);
    }
    // reserve: 校验并预占额度
    reservation = reserveInviteCode(input.inviteCode);
  }

  try {
    const result = await registerHumanUser(input, options);
    // 注册成功 → 标记 reservation 已消费，记录 userId/email
    if (reservation) {
      consumeInviteCode(reservation.reservationId, {
        userId: result.userId,
        email: result.email,
      });
    }
    return { status: "REGISTERED", ... };
  } catch (error) {
    // 注册失败 → 释放邀请码额度 (幂等)
    if (reservation) {
      releaseInviteCode(reservation.reservationId);
    }
    throw error;
  }
}
```

### 6.4 邀请码管理 API

| 方法 | 路由 | 功能 |
|------|------|------|
| GET | `/api/admin/invite-codes` | 列出邀请码（含使用量、状态） |
| POST | `/api/admin/invite-codes` | 生成新邀请码 (body: `{ maxUseCount, expiresAt? }`) |
| DELETE | `/api/admin/invite-codes/[code]` | 作废邀请码 |

### 6.5 邀请码管理 UI

**新组件**: `apps/account/src/features/admin/components/InviteCodeManager.tsx`
- 展示邀请码列表表格: 代码、创建时间、过期时间、使用次数/上限、状态
- "生成邀请码"按钮 → 弹出表单（次数、过期时间可选）
- 每行"作废"操作

### 6.6 注册页邀请码输入

修改 `apps/account/src/ui/account-register-page.jsx`:
- 注册页面在提交前显示邀请码输入框（用户无法预知当前模式，始终显示）
- 非 invite 模式下忽略该字段

---

## 七、Phase 5 — 用户启用/禁用 API

### 7.1 用户状态管理 API

**约束**: 通用启用/禁用 API **不得绕过审核流程**。

```javascript
export async function setUserStatus(userId, targetStatus, actor) {
  const user = await getHumanUser(userId);
  if (!user) throw new NotFoundError();

  // === 保护: 如果用户有审核记录且非 approved，禁止通过通用 API 启用 ===
  // 覆盖: pending/approving/rejecting/approve_failed/reject_failed/rejected
  // 原则: 只要有审核记录且不是 approved，就不允许绕过审核流程
  if (targetStatus === "active") {
    const reviewStore = getRegistrationReviewStore();
    const reviews = reviewStore.list({ userId });
    const unapprovedReviewExists = reviews.some(
      (r) => r.reviewStatus !== "approved"
    );
    if (unapprovedReviewExists) {
      throw new Error("该用户处于审核流程中，请通过审核队列操作");
    }
  }

  // 管理员不可禁用自己
  if (targetStatus === "disabled" && userId === actor.sub) {
    throw new Error("不能禁用自己");
  }

  // 已处目标状态 → 400
  const currentState = user.state;
  if (targetStatus === "disabled" && currentState === "USER_STATE_INACTIVE") {
    throw new Error("用户已处于禁用状态");
  }
  if (targetStatus === "active" && currentState !== "USER_STATE_INACTIVE") {
    throw new Error("用户已处于启用状态");
  }

  if (targetStatus === "disabled") {
    await deactivateHumanUser(userId);
  } else {
    await reactivateHumanUser(userId);
  }

  recordAuditEvent({
    eventType: `admin_user_${targetStatus}`,
    sub: actor.sub,
    summary: `${targetStatus === "disabled" ? "禁用" : "启用"}用户 ${userId}`,
    metadata: { userId, targetStatus },
  });

  return { status: targetStatus === "disabled" ? "disabled" : "active" };
}
```

### 7.2 API 路由

| 方法 | 路由 | 功能 |
|------|------|------|
| PATCH | `/api/admin/users/[id]/status` | body: `{ status: "active"|"disabled" }` |

**路由文件**: `apps/account/app/api/admin/users/[id]/status/route.js`
**Service**: `apps/account/src/admin/users-api.js`（追加 `setUserStatus`）

### 7.3 AdminUsers 页面操作接入

将以下菜单项的 `onClick` 连接到真实 API:

| 菜单项 | API |
|--------|-----|
| 启用账户 | `PATCH /api/admin/users/[id]/status { status: "active" }` |
| 禁用账户 | `PATCH /api/admin/users/[id]/status { status: "disabled" }` |
| 查看详情 | 弹窗显示用户完整信息（前端已有数据） |

**本轮不接入的操作**:
- ~~设为/取消管理员~~ — 需动态管理员 ADR
- ~~重置密码~~ — 管理员直接设密码需单独确认 Zitadel 管理 API
- ~~删除用户~~ — 通用管理员删除不在本轮范围；P3 审核拒绝是系统安全流程，不受此限制

---

## 八、测试矩阵

### Phase 2 — closed 模式

| # | 测试用例 | 预期 |
|---|---------|------|
| T2.1 | mode=closed 时 POST /api/register | 返回 403 REGISTRATION_CLOSED |
| T2.2 | mode=closed 时 Zitadel API 未被调用 | mock 验证 registerHumanUser 未被调用 |
| T2.3 | mode=open 时注册正常工作 | 返回 REGISTERED, Zitadel 被调用 |

### Phase 3 — review 模式 fail-closed

| # | 测试用例 | 预期 |
|---|---------|------|
| T3.1 | 正常审核注册流程 | 用户创建 → deactivate → 写审核记录 → 返回 PENDING_REVIEW |
| T3.2 | deactivate 失败 → 补偿删除用户 | deleteHumanUser 被调用, 返回 503 |
| T3.3 | deactivate 失败且补偿删除也失败 | 审计事件 registration_review_compensation_failed, 返回 503 |
| T3.4 | 写审核记录失败 → 补偿删除用户 | deleteHumanUser 被调用, 返回 503 |
| T3.5 | 写审核记录失败且补偿删除也失败 | 审计事件, 返回 503 |
| T3.6 | approve 成功 | store: approving → reactivateHumanUser → store: approved |
| T3.7 | approve 时 reactivateHumanUser 失败 | store: approve_failed, 可重试 |
| T3.8 | reject 成功 | store: rejecting → deleteHumanUser → store: rejected |
| T3.9 | reject 时 deleteHumanUser 失败 | store: reject_failed, 可重试 |
| T3.10 | 重复 approve same record | 已 approved → 拒绝, 已 approve_failed → 允许重试 |
| T3.11 | 非 approved 审核状态的用户不能被通用启用 API 激活 | pending/approving/rejecting/approve_failed/reject_failed/rejected 全部 → 拒绝 |

### Phase 4 — invite 模式 reservation 幂等

| # | 测试用例 | 预期 |
|---|---------|------|
| T4.1 | 正常邀请码注册 | reserve → register → 成功, usedCount+=1 |
| T4.2 | 输入校验失败 → 不调用 reserve | 密码<8字符 → reserve 未被调用 |
| T4.3 | inviteCode 为空时拒绝 | 返回 INVITE_CODE_REQUIRED, reserve 未被调用 |
| T4.4 | 无效邀请码拒绝 | 返回错误, reserve/register 未被调用 |
| T4.5 | 额度用完拒绝 | usedCount=maxUseCount → 拒绝 |
| T4.6 | Zitadel 注册失败 → release 额度 | releaseInviteCode(reservationId) 被调用, usedCount 回滚 |
| T4.7 | 重复 release (幂等) | 第二次 release 不改变 usedCount |
| T4.8 | 过期邀请码拒绝 | expiresAt 已过 → 拒绝 |
| T4.9 | 已作废邀请码拒绝 | isRevoked=true → 拒绝 |
| T4.10 | 注册成功后 consumeInviteCode 记录 userId/email/consumedAt | 检查 reservation 的 consumed 字段 |

### Phase 5 — 用户启用/禁用

| # | 测试用例 | 预期 |
|---|---------|------|
| T5.1 | 管理员禁用活跃用户 | deactivateHumanUser 被调用 → status=disabled |
| T5.2 | 管理员启用已禁用用户 | reactivateHumanUser 被调用 → status=active |
| T5.3 | 管理员不能禁用自己 | 返回 400 |
| T5.4 | 已处目标状态 → 400 | 重复 disable → 400 |
| T5.5 | 有 pending review 的用户不能通过通用 API 启用 | 返回错误 |
| T5.6 | 有 rejected / approving / rejecting / approve_failed / reject_failed review 的用户都不能通过通用 API 启用 | 全部返回错误 |
| T5.7 | 已 approved 的用户可以通过通用 API 启用/禁用 | 正常执行 |
| T5.8 | 不存在审核记录的用户可以通过通用 API 启用/禁用 | 正常执行 |

---

## 九、文件清单

### 新增文件

| # | 文件路径 | 用途 | Phase |
|---|---------|------|-------|
| 1 | `apps/account/src/registration/config-store.js` | 注册配置 + 邀请码存储 | P1/P4 |
| 2 | `apps/account/src/admin/registration-admin-api.js` | 注册设置管理 Service | P1 |
| 3 | `apps/account/app/api/admin/registration-config/route.js` | 注册设置 API | P1 |
| 4 | `apps/account/src/features/admin/components/RegistrationModeSelector.tsx` | 注册模式选择器 UI | P1 |
| 5 | `apps/account/src/registration-review/store.js` | 审核队列存储 (含中间态) | P3 |
| 6 | `apps/account/src/admin/registration-review-api.js` | 审核队列 Service (含 approve/reject 中间态) | P3 |
| 7 | `apps/account/app/api/admin/registration-reviews/route.js` | 审核队列列表 API | P3 |
| 8 | `apps/account/app/api/admin/registration-reviews/[id]/approve/route.js` | 审核通过 API | P3 |
| 9 | `apps/account/app/api/admin/registration-reviews/[id]/reject/route.js` | 审核拒绝 API | P3 |
| 10 | `apps/account/src/features/admin/components/RegistrationReviewPanel.tsx` | 审核队列面板 UI | P3 |
| 11 | `apps/account/app/api/admin/invite-codes/route.js` | 邀请码管理 API | P4 |
| 12 | `apps/account/src/features/admin/components/InviteCodeManager.tsx` | 邀请码管理面板 UI | P4 |
| 13 | `apps/account/app/api/admin/users/[id]/status/route.js` | 启用/禁用用户 API | P5 |

### 修改文件

| # | 文件路径 | 修改内容 | Phase |
|---|---------|---------|-------|
| 1 | `apps/account/src/lifecycle/service.js` | 增加模式校验 (closed/open) | P2 |
| 2 | `apps/account/src/lifecycle/service.js` | 追加 review 流程 (含补偿事务) | P3 |
| 3 | `apps/account/src/lifecycle/service.js` | 追加 invite 流程 (含 reservation) | P4 |
| 4 | `apps/account/src/features/admin/components/AdminSettings.tsx` | 替换为真实 API + 模式选择器 | P1 |
| 5 | `apps/account/src/features/admin/components/AdminUsers.tsx` | 增加审核 Tab + 启用/禁用操作接入 | P3/P5 |
| 6 | `apps/account/src/admin/users-api.js` | 追加 `setUserStatus` (含审核保护) | P5 |
| 7 | `packages/zitadel-client/src/users.js` | 追加 deactivate / reactivate / delete | P3 |
| 8 | `packages/zitadel-client/src/index.js` | 导出新函数 | P3 |
| 9 | `apps/account/src/ui/account-register-page.jsx` | 邀请码输入框 | P4 |
| 10 | `apps/account/app/api/register/route.js` | 传递 inviteCode 参数 | P4 |

---

## 十、风险与注意事项

1. **审核 fail-closed**: deactivate/write 失败必须补偿删除用户，不可返回"等待审核"。补偿本身可能再失败 → 审计告警 + 人工介入
2. **邀请码 reservation 幂等**: 用 `reservationId` 而非只按 `code` release，防止并发/重试场景下互相释放额度。file store 单实例串行，不超卖；多实例部署需升级数据库
3. **审核保护**: P5 通用启用 API 会检查 review 记录 —— 所有非 approved 状态 (pending/approving/rejecting/approve_failed/reject_failed/rejected) 的用户都不能绕过审核流程被激活
4. **中间态恢复**: `approve_failed` / `reject_failed` 允许管理员重试。`approving` / `rejecting` 状态可在服务重启后检测并恢复
5. **向后兼容**: 默认 `mode: "open"`，现有部署升级后行为不变
6. **不在本轮范围**: 动态管理员、管理员直接重置密码、通用管理员删除用户
7. **删除操作的区分**: P3 审核拒绝和补偿删除是系统安全流程，与通用的"管理员删除用户"不同，后者需额外 ADR
