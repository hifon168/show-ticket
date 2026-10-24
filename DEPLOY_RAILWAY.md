# 部署到 Railway（免费 · 自带 MySQL）

本项目是「Vue3 前端 + Express 后端 + MySQL」一体化应用：后端会同时托管构建后的前端（`web/dist`），
因此**只需部署一个服务 + 一个 MySQL 数据库**即可，无需单独部署前端。

Railway 提供 **$5 免费试用额度**（需绑定信用卡验证，不用不扣费），且自带 **MySQL 插件**，最省心。

---

## 方式 A：GitHub 一键部署（推荐，图形化）

### 1. 创建 GitHub 仓库并推送代码
（本机已 `git init` 并提交，你只需把代码推到 GitHub）

```bash
# 在你的 GitHub 网页上新建一个空仓库（如 show-ticket），然后：
git remote add origin https://github.com/<你的用户名>/show-ticket.git
git branch -M main
git push -u origin main
```

> 如果还没有 GitHub 账号：去 https://github.com 注册，免费。

### 2. 注册并登录 Railway
- 打开 https://railway.app ，用 GitHub 账号登录。

### 3. 新建项目并关联 GitHub 仓库
- 点击 **New Project → Deploy from GitHub repo**
- 授权并选择刚才推送的 `show-ticket` 仓库
- Railway 会自动读取仓库根目录的 `Dockerfile`（已配置好多阶段构建）开始构建

### 4. 添加 MySQL 数据库
- 在项目页面点击 **New → Database → MySQL**
- 稍等几十秒，Railway 会自动注入 `MYSQL_*` 环境变量到后端服务（后端配置已自动读取，无需手动填）

### 5. 配置后端环境变量
进入后端服务 → **Variables**，点击 **Raw Editor** 粘贴以下内容（Railway 会自动合并已有的 `MYSQL_*`）：

```env
NODE_ENV=production
CORS_ORIGIN=*
JWT_SECRET=换成一段随机字符串（例如 openssl rand -base64 32 的输出）
PAYMENT_MODE=test
PAY_BASE_URL=https://你的railway域名
```

> `PAY_BASE_URL` 先随便填，等拿到域名后再改回真实域名（影响支付回调/模拟确认链接，演示用 test 模式不强制）。

### 6. 重新部署并访问
- 改完变量后点 **Deploy** 重新部署
- 部署完成后，点服务页面的 URL（形如 `https://xxx.up.railway.app`）即可访问
- **无需手动建表**：镜像启动时会自动执行 `init-db` + `seed-demo`，写入 12 场演示演出、管理员、邀请码、二手票示例

### 7. 默认演示账号
| 用途 | 账号 | 密码 |
| --- | --- | --- |
| 管理员后台 | `13800000000` | `admin123` |
| 普通用户 | `13900000001` | `123456` |
| 普通用户 | `13900000002` | `123456` |
| 注册邀请码 | `VIP88888` / `TICKET66` / `WELCOME1` / `PX2026VIP` / `TEST0001` | |

---

## 方式 B：Railway CLI 直连部署（免 GitHub）

适合不想用 GitHub 的情况，在本机命令行操作：

```bash
# 1. 安装 Railway CLI（需要 Node，已具备）
npm i -g @railway/cli

# 2. 登录（会打开浏览器授权）
railway login

# 3. 在项目根目录初始化并关联
railway init          # 按提示新建项目
railway add mysql     # 添加 MySQL 插件（自动注入 MYSQL_*）

# 4. 设置环境变量（一次性）
railway variables --set NODE_ENV=production
railway variables --set CORS_ORIGIN=*
railway variables --set JWT_SECRET=你的随机串
railway variables --set PAYMENT_MODE=test

# 5. 部署
railway up

# 6. 查看分配给你的公网域名
railway domain
```

部署后镜像会自动初始化数据库与演示数据，直接打开域名即可。

---

## 常见问题

- **页面打不开 / 白屏**：先等 1–2 分钟（首次构建 + 自动建表较慢）；在 Railway 日志里看是否有报错。
- **接口 404**：确认部署的是 `main` 分支、Dockerfile 在仓库根目录。
- **想导入本地已有的 1427 场真实演出**：本地用 `mysqldump` 导出 `show_ticket` 库，再到 Railway 的 MySQL 插件用 `railway connect` 或控制台导入即可。
- **支付**：当前为 `PAYMENT_MODE=test` 模拟支付，下单后点「确认支付」即可走通完整流程；接真实微信/支付宝只需在 `.env` 填齐 `WX_*` / `ALIPAY_*` 并改 `PAYMENT_MODE=real`。
- **免费额度**：Railway 免费试用 $5/月，足够一个轻量演示；超出会自动暂停，不会产生费用（前提是未绑定后滥用）。
