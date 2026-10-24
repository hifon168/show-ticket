# 免费云部署指南（免信用卡）

Railway 的 $5 试用额度已过期、Koyeb 现在也要求绑定信用卡验证，因此本指南主推 **Hugging Face Spaces（Docker SDK）**：

- ✅ **完全免费、免信用卡**
- ✅ 2 vCPU / 16GB RAM / 50GB 磁盘（远超演示所需）
- ✅ 公开网址 `https://<用户名>-<空间名>.hf.space`
- ✅ 从 Dockerfile 自动构建，Git 推送即部署
- ⚠️ 免费实例空闲约 48 小时后会休眠，首次访问需 ~30–90s 冷启动（自动唤醒）
- ⚠️ 磁盘为「临时盘」，**重建/重新推送代码时数据会重置**（本项目镜像启动会自动重建库并写入演示数据，所以无影响）

> 本项目的镜像是**自包含**的：内置 MariaDB（MySQL 兼容），容器启动时自动建库 + 写入演示数据，**无需任何外部数据库、无需填数据库连接**。所以部署几乎零配置。

---

## 方式一：Hugging Face Spaces（推荐 · 免信用卡）

### 1. 注册并新建 Space
1. 打开 https://huggingface.co 免费注册（**无需信用卡**）。
2. 右上角头像 → **New Space**。
3. 填写：
   - Space name：任意，例如 `show-ticket`
   - License：选 `mit` 或任意
   - **SDK：选择 `Docker`**（关键）
   - Space hardware：**CPU · Free**
   - Visibility：Public（或 Private 均可）
4. 点击 **Create Space**。

### 2. 把代码推送到这个 Space
Space 本质是一个 Git 仓库。在本机项目根目录执行（把 `<用户名>`/`<空间名>` 换成你自己的）：

```bash
# 生成 HF 访问令牌：https://huggingface.co/settings/tokens （勾选 write 权限）
# 推送时用户名填你的 HF 用户名，密码处粘贴上面生成的令牌

git remote add hf https://huggingface.co/spaces/<用户名>/<空间名>
git push hf main
```

> 若本地默认分支不是 `main`，先 `git branch -M main` 再推送。
> 也可以不推 HF，而在 Space 页面用 **Files → "Link a repository"** 直接关联你的 GitHub 仓库（前提是代码已在 GitHub）。

### 3. 等待构建并访问
- 在 Space 页面的 **Logs** 标签可实时查看构建/启动日志（首次构建含前端构建 + MariaDB，约几分钟）。
- 状态变为 **Running** 后，打开 `https://<用户名>-<空间名>.hf.space` 即可。
- 无需任何环境变量（镜像已内置合理默认值）。可选：在 Space **Settings → Variables and secrets** 设置 `JWT_SECRET`（改默认密钥）、`PAYMENT_MODE=test`、`PAY_BASE_URL=你的hf域名`。

### 4. 默认演示账号（镜像启动自动写入）
| 用途 | 账号 | 密码 |
| --- | --- | --- |
| 管理员后台 | `13800000000` | `admin123` |
| 普通用户 | `13900000001` | `123456` |
| 普通用户 | `13900000002` | `123456` |
| 注册邀请码 | `VIP88888` / `TICKET66` / `WELCOME1` / `PX2026VIP` / `TEST0001` | |

---

## 方式二：想要更大控制（付费/绑卡平台）

如果之后愿意绑卡或付费，以下平台同样兼容本项目镜像（因为镜像自带数据库）：

- **Railway**：仍是开发者体验最好的之一，但需选付费计划（试用已过期）。沿用根目录 `railway.json` 即可。
- **Koyeb**：1 个永久免费 web 服务（512MB），但注册需 $29 预授权验证（不扣费，数日释放）。免费实例无持久盘，正好契合本项目「每次启动自动建库」的设计。
- **Fly.io / Render(付费)**：均支持 Docker，镜像直接可用。

> 这些平台若提供自己的 MySQL 插件，也可以不用内置 MariaDB：把 `entrypoint.sh` 里启动数据库的部分去掉，并改用平台注入的数据库连接变量即可（本项目 `server/src/config/index.js` 已支持 `MYSQL_*` 回退）。

---

## 备选：用免费远程 MySQL（filess.io）替代内置库

如果你想让数据独立于容器（不被临时盘重置影响），可选用 **filess.io** 的免费 MySQL（无需信用卡，2 个库 / 每库 10MB，演示数据远小于此）：

1. 到 https://filess.io 注册，创建一个 MySQL 数据库，拿到连接串（host/port/user/password/db）。
2. 在 HF Space 的 **Variables and secrets** 设置：`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`（覆盖镜像内置的本地 MariaDB）。
3. 但此时容器里仍会启动一个 MariaDB 占用资源——若想彻底不用内置库，需把 `entrypoint.sh` 中「启动 MariaDB」「ALTER USER」「CREATE USER」等段注释掉，仅保留 `node initDb.js && node seedDemo.js && node app.js`。

---

## 常见问题

- **首次打开很慢 / 白屏**：免费实例冷启动需 30–90s（要起 MariaDB + 建库 + 起后端）。看 Logs 是否在跑，稍等刷新。
- **改代码后没更新**：在 Space 页面点 **Restart** 或重新 `git push hf main` 触发重建（重建会重置数据库，但会自动重新写演示数据）。
- **想导入本地 1427 场真实演出**：在 HF Space 的终端/或本地 `mysqldump` 导出后，用 `railway`/`koyeb` 等方式导入；或进容器执行导入。演示足够则无需此步。
- **支付**：默认 `PAYMENT_MODE=test` 模拟支付，下单后点「确认支付」即可走通完整流程；接真实微信/支付宝只需填 `WX_*`/`ALIPAY_*` 并改 `PAYMENT_MODE=real`。
- **本地也能跑这个镜像**：装好 Docker 后 `docker build -t show-ticket . && docker run -p 7860:7860 show-ticket`，浏览器开 `http://localhost:7860`。
