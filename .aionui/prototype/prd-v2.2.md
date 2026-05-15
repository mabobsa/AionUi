@@ -0,0 +1,276 @@
# Aion 远程访问 + 账号体系 PRD v2.2

---

# A. 产品目标

## A.1 背景

Aion 已有 **WebUI 局域网模式**——同 WiFi 下用手机扫 QR 即可访问桌面端。问题是只能局域网，**外网/移动网络下用不了**。

用户想"出门也能用"时，目前只能自己配 SSH / Tunnel / Tailscale，**配置门槛把大多数用户挡在外面**——这是远程开发赛道（Cursor Remote / Codespaces / VS Code Remote）的公开痛点。

**v2.2 做的事**：把现有 WebUI **升级成"账号绑定 + 公网可达"**，由 Aion 托管中继。用户**只需登录账号**，即得专属公网地址。

## A.2 战略卖点

**零配置远程**——用户不用：装第三方客户端、注册第三方账号、配端口、配 SSH key、架服务器。**登录 Google = 拿到专属地址 = 手机扫码即用**。

这件事 Aion 比竞品更适合做：
- AionUI 桌面/浏览器是同一套 UI（不是 IDE 外挂方案）
- 账号是必做的（付费、Token、协作），远程接在账号上是顺手收益
- 中继服务可承接未来付费 Token，账号→远程→付费形成飞轮

## A.3 五个目标

| # | 目标 | 衡量 |
|---|---|---|
| G1 | 远程入口登录 = 自动激活 | 远程入口登录用户 ≥ 90% 自动激活成功，登录到 QR 可扫 ≤ 10 秒 |
| G2 | 账号入口收敛到唯一一处（侧栏底部） | 找账号 / 退账号 / 看 Token 100% 在侧栏 |
| G3 | 远程配置收敛到唯一一处（设置→远程连接） | toggle / 地址 / QR / 设备列表 100% 在该页 |
| G4 | 新客 ≤ 3 步完成首次激活 | "不用配 SSH / 内网穿透"卖点曝光 100% |
| G5 | 老客不被打扰 | 已激活用户每会话最多见 1 个远程相关元素 |

## A.4 不做

- 不做"已登录但未开远程"作常态曝光
- 不做多账号切换
- 不在账号面板放远程开关
- 不在设置→通用单开"账号"模块（账号入口=侧栏块）

---

# B. 产品功能

## B.1 状态机

```
GUEST ──远程入口登录──→ ACTIVE  ──toggle 关──→ INACTIVE
GUEST ──账号入口登录──→ INACTIVE ──toggle 开──→ ACTIVE
ACTIVE ──网络抖动──→ OFFLINE（toggle 仍 ON，状态变红）
任何登录态 ──退账号──→ GUEST（远程一并停）
```

四态：GUEST / ACTIVE / INACTIVE / OFFLINE（OFFLINE 是 ACTIVE 子态）。

## B.2 能力清单

**账号体系**
- Google OAuth 登录（v2.2 仅 Google）
- 唯一入口：侧栏底部账号块（Claude 桌面端做法）
- 退账号 = 自动关停远程 + 清地址 + 清设备

**远程访问（升级现有 WebUI）**
- 现有：WebUI 局域网模式（IP + 端口）→ 保留
- 新增：登录账号后分配 `abc12.aion.app` 公网专属地址（Aion 托管中继）
- toggle 唯一开关在「设置→远程连接」
- QR 在远程模式下生成专属地址 QR（手机扫即免登录进）
- 设备列表：本机可管理，远程设备只能看自己

**入口分布**
- 首页底部 dock 小球（4 态常驻）
- 首页输入卡下方 banner（仅 GUEST，可 snooze）
- 对话页右上小球（4 态常驻）
- 对话页长任务 banner（GUEST/INACTIVE 且任务 ≥ 30s，可 snooze）
- 侧栏底部账号块（4 态常驻）
- 首次任务后 onboarding 卡（一生一次）

## B.3 验收 DoD

- [ ] 4 个触点状态切换一致
- [ ] 远程入口登录全流程 ≤ 6 步交互
- [ ] 登录到 QR 可扫 ≤ 10 秒
- [ ] 用户全程不需装客户端 / 注册第三方 / 配端口
- [ ] 账号面板**无**远程开关；远程设置**无**账号信息
- [ ] 离线 toggle 保持 ON
- [ ] onboarding 卡每账号生命周期内仅一次
- [ ] 所有 class 用 `arco-*` 或 UnoCSS（dev-only 浮层除外）

---

# C. 交互细节

## C.1 首页

### C.1.1 输入卡下方 banner（仅 GUEST 且未 snooze）

```
📱 手机也能继续用 Aion · 不用配 SSH / 内网穿透  [使用 Google 登录]  ✕
   登录即开启远程访问，可在设置中关闭
```

- 位置：Aion 首页输入卡（`_guidInputCard_`）正下方
- 关 ✕ → snooze 24h（与对话页 banner 共享 key）
- 用 `arco-alert arco-alert-info` 样式

### C.1.2 底部 dock 小球（4 态常驻，36×36 圆形）

| 状态 | 颜色 | hover tooltip | click |
|---|---|---|---|
| GUEST | 蓝（primary）+ 红点 | 「登录解锁手机访问」 | 弹登录卡 |
| ACTIVE | 绿 + 绿点 | 「远程已开 · iPhone 在线 · abc12.aion.app」+ 跳设置 | 弹同 tooltip 内容的 popover |
| INACTIVE | 灰 | 「远程已关 · 点此开启」 | 直接开（短暂建链动画） |
| OFFLINE | 黄 + 脉动 | 「中继断开 · 点此重连」 | 重连 |

**注意**：默认就是小球，**不再有 v2.1 那种展开成长条 chip 的形态**。

### C.1.3 首次任务完成 onboarding 卡（一生一次）

- 触发：用户首次让 Aion 跑完一个任务（含工具调用 / 输出 ≥ 50 字）
- 持久化：`localStorage.aion-onboarding-shown`
- 形态：右下角浮卡，非模态

```
🎉 任务完成！

📱 想在手机继续追问吗？
Aion 内置远程服务，登录即可手机访问
· 不用配 SSH / 隧道 / 内网穿透
· 不用装额外客户端
· 5 秒拿到专属地址，扫码即用

[立即登录]    [稍后再说]
```

## C.2 对话页

### C.2.1 右上角小球（与首页 dock 小球完全同款交互）

- 位置：紧挨 Claude Code chip 左侧
- 形态/色彩/hover/click 完全复制 C.1.2

### C.2.2 长任务 banner（GUEST/INACTIVE，任务 ≥ 30s，可 snooze）

- 位置：消息流上方
- 用 `arco-alert arco-alert-info` 样式
- 同会话最多 1 次；× → snooze 24h（与首页 banner 共享 key）

| 状态 | 文案 | CTA |
|---|---|---|
| GUEST | 📱 任务还在跑？登录后可在手机继续看 | [登录] |
| INACTIVE | 📱 任务还在跑？开启远程可在手机继续看 | [开启远程] |

## C.3 侧栏底部账号块（Claude 风格 / 唯一账号入口）

### C.3.1 形态

```
〔头〕邮箱             ●  ← 状态点
       远程已连接 / 已关 / 中继断开
```

| acct | 头像 | 主文 | 副文 | 点 |
|---|---|---|---|---|
| GUEST | 灰 ? | 未登录 | 点此登录 | — |
| ACTIVE | 林 | linveer15@gmail.com | 远程已连接 | 绿 |
| INACTIVE | 林 | linveer15@gmail.com | 远程已关闭 | 灰 |
| OFFLINE | 林 | linveer15@gmail.com | 中继断开 ⚠ | 黄 |

### C.3.2 点击 → 账号面板

```
〔头〕林
     linveer15@gmail.com
─────────────
Token 余额      128.5K
Plan            Pro
─────────────
远程访问        ● 已开（绿色，只读）
专属地址        abc12.aion.app
─────────────
⚙ 账号设置        → 设置→通用→账号
🌐 远程连接设置   → 设置→远程连接
↗ 退出登录        弹强确认
```

**关键约束**：面板内无远程开关；远程状态只读。

## C.4 设置→远程连接

```
启用 WebUI [toggle]              localhost:5173（局域网，已有功能）
访问地址                          [复制]

允许远程访问 [toggle]             ← v2.2 新主开关
状态条：● 已激活 / ● 已关 / ⚠ 中继断开

专属访问地址（仅 ACTIVE/OFFLINE）  https://abc12.aion.app  [复制]

登录信息（QR 卡）                  [二维码 + 远程模式徽章]

已连接设备（仅 ACTIVE）            💻 本机 [当前]  📱 iPhone [移除]

🔐 本地兜底登录（折叠）             admin / 密码
```

**toggle 行为**：

| 当前态 | 点 toggle | 行为 |
|---|---|---|
| GUEST | OFF→ON | 弹登录卡（intent=remote） |
| INACTIVE | OFF→ON | 短暂建链动画 → ACTIVE |
| ACTIVE | ON→OFF | 直接关 + toast |
| OFFLINE | ON→OFF | 弹确认 |

## C.5 统一登录卡

**触发场景的 intent**：
- `remote`：dock/banner/conv-earth/conv-banner/sider(GUEST)/toggle(GUEST)/onboarding
- `account`：设置→通用→账号"登录"

**Step 1：登录**
```
🔐
登录 Aion 账号
用于身份识别、Token 计费

[G] 使用 Google 账号继续

(intent=remote)
登录后自动开启远程访问
Aion 托管中继 / 端口 / 安全，无需配置
可在设置中关闭

取消
```

**Step 2：进度（OAuth 成功后同卡推进）**
```
✓ 账号登录成功
✓ 已分配专属地址 abc12.aion.app
⟳ 与中继服务器建立连接中…    ← intent=remote 才有
```

**用 Aion 组件**：`arco-modal` + `arco-steps` + `arco-btn`。

## C.6 全局反馈

所有"已开 / 已关 / 已重连 / 已 snooze" 用 **Arco Message**（`arco-message arco-message-success`），不自造 toast。

---

# D. vs v2.1 主要改动

| # | v2.1 | v2.2 |
|---|---|---|
| 1 | 首页 chip 默认展开胶囊 | **改成 36×36 小球**，hover 弹 tooltip；引流主力交给 banner |
| 2 | 首页输入卡下方无 banner | **新增** banner（C.1.1），文案打"不用配 SSH" |
| 3 | 无 onboarding 卡 | **新增**首次任务后引导（C.1.3） |
| 4 | 自造 `.alm-*` `.conv-promo` | **改用** `arco-modal`/`arco-steps`/`arco-alert` |
| 5 | 自造 `v3Toast` | **改用** `arco-message` |
| 6 | 侧栏块简化 | **改 Claude 风格面板**，含 Token/Plan/远程状态只读 |
| 7 | conv 小球 hover 无内容 | **加 tooltip**（与首页 dock 同款） |

---

# E. HTML 实现规范（给反向喂 AI）

1. 不引入自造 class，全部用 `arco-*` 或 UnoCSS token
2. 优先复用 Aion 现有 DOM（如 `home-earth-icon` 的 globe svg）
3. CSS 用 `var(--color-*)` token，不写死 hex
4. 用户可见文案加 `data-i18n="..."` 标记
5. 不写 `requestAnimationFrame` 等运行时 hack；用 CSS transition / Arco 动画

---

文件：`docs/prd-aion-remote-access-v2.2.md`
