---
title: 演出票务平台
emoji: 🎫
colorFrom: pink
colorTo: purple
sdk: docker
app_port: 7860
---

# 🎫 演出票务平台（移动端优先 · 全端自适应）

> 技术栈：**Vue 3 + Vite + Tailwind CSS**（前端） / **Node.js + Express + MySQL**（后端）。

---

## 一、整体架构说明

```
┌──────────────────────── 前端 web（Vue3 + Tailwind） ────────────────────────┐
│ 移动端：底部 Tab + 全屏页面          平板/桌面：顶部导航 + 多列栅格 + 后台侧边栏 │
│ pages: 首页/搜索/演出列表/详情/下单/支付/订单/二手集市/挂票/私聊/用户中心/后台   │
│ 统一 api 层（axios）→  /api/*   （dev 由 vite proxy 转发到 3001）            │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │  HTTP JSON  { code, message, data }
┌───────────────────────────────▼────────────────────────────────────────────┐
│ 后端 server（Express）                                                       │
│  routes:  auth 用户认证（注册必填邀请码）                                     │
│           meta 城市/分类/轮播配置                                             │
│           shows 演出列表·详情·收藏·搜索·首页聚合                              │
│           orders 下单·支付·取消·退款·确认                                     │
│           tickets 二手票集市·卖家挂票·上下架                                  │
│           user  收藏·浏览记录·留言·统计                                       │
│           chat  私聊会话·消息（转票沟通）                                     │
│           admin 演出/邀请码/用户/留言/订单/二手票/轮播/同步日志（RBAC 管理员）   │
│  services: syncService（演出资讯同步）、scheduler（node-cron 每日 03:00）      │
│            posterService（演出海报生成）、orderImportService（Excel 导入订单）  │
│            orderNoService（随机不连号订单号）                                  │
│  middleware: JWT 鉴权、管理员校验、统一响应                                    │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │  mysql2 连接池
┌───────────────────────────────▼────────────────────────────────────────────┐
│ MySQL：users / invite_codes / shows / ticket_tiers / orders / resale_tickets │
│        favorites / browse_history / user_messages / chat_* / banners /       │
│        cities / venues / search_hot / sync_logs                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 关键设计点

| 模块    | 说明                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------ |
| 邀请制注册 | `invite_codes` 表 + 事务内「创建用户 + 核销邀请码」，防并发重复使用                                                                 |
| 库存与订单 | 下单事务内预占库存；取消/退款归还；待支付订单 15 分钟超时自动取消                                                                          |
| 支付    | 演示环境同步返回支付成功（`orders/:id/pay`），生产接入微信/支付宝只需替换该函数                                                             |
| 二手票   | `resale_tickets` 独立表，支持挂票、上下架、折扣展示、私聊议价、担保下单                                                                 |
| 私聊转票  | `chat_conversations` + `chat_messages`，按「买家+卖家+票品」唯一会话；前端 3s 轮询（可改 WebSocket）                                |
| 每日同步  | `node-cron` 按 `SYNC_CRON`（默认 03:00 Asia/Shanghai）拉取外部 API，按 `source_id`/标题+时间 upsert，写 `sync_logs`，并自动下架过期演出 |
| 演出海报  | 无外链图片时按「分类 + 标题 + 艺人」自动生成 SVG 海报（`server/public/posters/{id}.svg`，由 `/posters` 静态托管），同步 / 后台录入 / 存量脚本均自动补齐 |
| 订单号    | 纯随机 14 位（前缀 `PX` + 12 位随机字符，32 字符集），**不连号、不可推测**，唯一性由唯一索引 + 重试兜底 |
| Excel 导入 | 后台一键上传订单表，自动匹配演出、生成随机订单号，返回逐行成功/失败明细 |
| 响应式   | Tailwind 断点：`md` 起切换为桌面布局（顶部导航 + 2/3 列栅格 + 后台侧边栏），移动端走底部 Tab 与安全区适配                                          |

---

## 二、目录结构

```
演出票/
├── database/
│   └── schema.sql              # 建表 SQL（16 张表 + 城市/场馆/热词字典）
├── server/                     # 后端
│   ├── .env.example            # 环境变量模板
│   ├── package.json
│   └── src/
│       ├── app.js              # 应用入口（含静态资源托管 / 404 / 错误兜底）
│       ├── config/index.js
│       ├── db/index.js         # 连接池 + query/exec/transaction
│       ├── middleware/auth.js  # JWT 鉴权 / 管理员校验
│       ├── utils/              # 统一响应、JWT、工具函数
│       ├── routes/             # auth / meta / shows / orders / tickets / user / chat / admin
│       ├── services/
│       │   ├── syncService.js  # 演出资讯同步（外部 API 或内置模拟源）
│       │   └── scheduler.js    # 每日定时任务
│       └── scripts/
│           ├── initDb.js       # 建库建表 + 演示数据
│           ├── syncShows.js    # 手动执行一次同步（配合 crontab）
│           └── cronWorker.js   # 独立常驻定时进程（PM2）
└── web/                        # 前端
    ├── index.html  vite.config.js  tailwind.config.js  postcss.config.js
    └── src/
        ├── main.js  App.vue  style.css
        ├── api/index.js        # 全部接口
        ├── router/index.js     # 路由 + 登录/管理员守卫
        ├── stores/             # user / config（pinia）
        ├── utils/index.js      # 金额、时间、状态字典
        ├── components/         # NavBar TabBar ShowCard SkeletonList EmptyState PullRefresh AppToast
        ├── views/              # C 端 18 个页面
        └── admin/              # 后台 10 个页面
```

---

## 三、快速开始（本地开发）

### 1. 环境要求

- Node.js ≥ 16（推荐 18/20）
- MySQL ≥ 5.7（推荐 8.0）

### 2. 初始化数据库

```bash
# 方式一：一键初始化（推荐）—— 自动建库建表 + 演示数据
cd server
cp .env.example .env        # Windows: copy .env.example .env
npm install
npm run init-db

# 方式二：手动执行 SQL
mysql -u root -p -e "CREATE DATABASE show_ticket DEFAULT CHARSET utf8mb4;"
mysql -u root -p show_ticket < ../database/schema.sql
```

> 初始化完成后默认账号：
>
> - **管理员**：`13800000000` / `admin123`
> - **演示邀请码**：`VIP88888`、`TICKET66`、`WELCOME1`、`PX2026VIP`、`TEST0001`

### 3. 启动后端

```bash
cd server
npm run dev       # 开发（nodemon） 或 npm start
# → http://localhost:3001/api/health
```

### 4. 启动前端

```bash
cd web
npm install
npm run dev       # → http://localhost:5173
```

浏览器打开 `http://localhost:5173` 即可（接口已由 vite 代理到 3001）。

### 5. 一键启动（最省事）

双击项目根目录的 **`start.bat`**：自动拉起 MySQL → 启动后端（3001，同时托管前端 `web/dist`）→ 打开浏览器。

> 后端已内置 SPA fallback + 静态资源托管，**只跑一个 3001 端口就能看到完整网站**：http://localhost:3001

### 6. 演示数据 & 冒烟测试

```bash
cd server
npm run migrate     # 幂等补齐新增字段（orders.buyer_name 等），升级时执行
npm run gen-posters # 为缺海报的演出生成 SVG 海报（--all 强制全部重生成）
npm run seed-demo   # 补充演示用户/二手票/留言/私聊示例，避免相关页面空白
npm run smoke       # 端到端冒烟测试（32 项：注册邀请码→下单→支付→挂票→私聊→后台→同步）
```

演示账号：

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 管理员 | `13800000000` | `admin123` |
| 卖家（票友小王） | `13900000001` | `123456` |
| 买家（转票达人） | `13900000002` | `123456` |

新用户注册需邀请码：初始有 `VIP88888 / TICKET66 / WELCOME1 / PX2026VIP / TEST0001`，后台可持续批量生成。

---

## 四、建表 SQL

见 [`database/schema.sql`](./database/schema.sql)，共 16 张表：

| 表                                      | 用途                                |
| -------------------------------------- | --------------------------------- |
| `users`                                | 用户（手机号登录、角色、状态）                   |
| `invite_codes`                         | 邀请码（注册必填，含使用人/过期时间）               |
| `cities` / `venues`                    | 城市、场馆字典                           |
| `shows`                                | 演出主表（分类、艺人、场馆、时间、价格区间、热度、来源、同步时间） |
| `ticket_tiers`                         | 官方票档（价格/原价/库存）                    |
| `orders`                               | 订单（官方票 & 二手票统一，含快照价格、支付信息、状态机）    |
| `resale_tickets`                       | 二手票（卖家挂票，票面价/转让价/座位/数量/状态）        |
| `favorites` / `browse_history`         | 收藏、浏览记录                           |
| `user_messages`                        | 用户留言（需后台审核）                       |
| `chat_conversations` / `chat_messages` | 私聊会话与消息                           |
| `banners` / `search_hot` / `sync_logs` | 轮播、搜索热词、同步日志                      |

---

## 五、后端接口清单

> 统一前缀 `/api`，统一响应 `{ code: 0, message, data }`，`code !== 0` 为业务失败。  
> 需要登录的接口在 Header 传 `Authorization: Bearer <token>`。

### 认证 `/auth`

| 方法   | 路径                   | 说明                                            |
| ---- | -------------------- | --------------------------------------------- |
| POST | `/auth/register`     | 注册（phone/password/nickname/**inviteCode 必填**） |
| POST | `/auth/login`        | 用户登录                                          |
| POST | `/auth/admin-login`  | 管理员登录（校验 role=1）                              |
| POST | `/auth/check-invite` | 校验邀请码是否可用                                     |
| GET  | `/auth/me`           | 当前用户                                          |
| PUT  | `/auth/profile`      | 修改资料                                          |
| PUT  | `/auth/password`     | 修改密码                                          |

### 配置 `/meta`

`GET /meta/config`（城市+分类+轮播）、`GET /meta/cities`

### 演出 `/shows`

| 方法   | 路径                      | 说明                                                                                                 |
| ---- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| GET  | `/shows/home`           | 首页聚合：轮播 / 即将上演 / 近期上新 / 热门                                                                         |
| GET  | `/shows`                | 列表（city、category、date=today/tomorrow/weekend/week/month、start/end、keyword、sort=hot/time/price/new） |
| GET  | `/shows/search`         | 搜索（演出名 / 艺人 / 场馆）                                                                                  |
| GET  | `/shows/search/suggest` | 联想词 / 热词                                                                                           |
| GET  | `/shows/:id`            | 详情（票档、是否收藏、二手在售；自动记录浏览历史）                                                                          |
| POST | `/shows/:id/favorite`   | 收藏 / 取消收藏                                                                                          |

### 订单 `/orders`

`POST /orders`（下单：官方 `showId+tierId` 或二手 `ticketId`）、`GET /orders`、`GET /orders/sold`（我卖出的）、`GET /orders/:id`、  
`POST /orders/:id/pay`（模拟支付）、`POST /orders/:id/cancel`、`POST /orders/:id/confirm`、`POST /orders/:id/refund`

### 二手票 `/tickets`

`GET /tickets`（集市，支持 city/category/keyword/showId/sort）、`GET /tickets/mine`、`GET /tickets/:id`、  
`POST /tickets`（挂票）、`PUT /tickets/:id`、`POST /tickets/:id/status`、`DELETE /tickets/:id`

### 用户中心 `/user`

`GET /user/stats`、`GET /user/favorites`、`GET|DELETE /user/history`、`DELETE /user/history/:showId`、  
`GET|POST /user/messages`、`GET /user/messages/public`

### 私聊 `/chat`

`POST /chat/start`、`GET /chat/conversations`、`GET /chat/:id/messages`、`POST /chat/:id/send`、`GET /chat/unread`

### 后台 `/admin`（需管理员）

`GET /admin/stats`；演出 `/admin/shows`（GET/POST/PUT/DELETE）、票档 `/admin/tiers`（POST/PUT/DELETE）；  
邀请码 `/admin/invite-codes`（GET/POST 批量/DELETE）；用户 `/admin/users`、`PUT /admin/users/:id/status`；  
留言 `/admin/messages`、`PUT /admin/messages/:id`（审核+回复）；  
订单 `/admin/orders`、`GET /admin/orders/template`（下载导入模板）、`POST /admin/orders/import`（Excel 导入，form-data: file）；
二手票 `/admin/tickets`、`POST /admin/tickets/:id/status`；  
轮播 `/admin/banners`（GET/POST/PUT/DELETE）；同步 `GET /admin/sync-logs`、`POST /admin/sync`（手动触发）

---

## 六、定时同步脚本

### 1）随服务启动（默认方式）

`server/src/app.js` 启动时调用 `startScheduler()`，按 `.env` 的 `SYNC_CRON`（默认 `0 3 * * *`，Asia/Shanghai）每日自动同步，并在同步后自动下架已过期演出。

### 2）独立常驻进程（推荐生产）

```bash
cd server && npm run cron
# PM2: pm2 start src/scripts/cronWorker.js --name show-ticket-cron
```

### 3）系统 crontab / 计划任务

```bash
0 3 * * * cd /opt/show-ticket/server && /usr/bin/node src/scripts/syncShows.js >> logs/sync.log 2>&1
```

### 4）数据源配置

在 `.env` 配置 `SYNC_API_URL`（返回 JSON 数组，字段格式见 `syncService.js` 顶部注释），  
留空则使用内置模拟数据源，保证开箱即可演示「每日自动同步更新演出资讯」。  
后台「数据概览 → 立即同步」可手动触发并查看 `sync_logs` 同步日志。

---

### Excel 导入订单列说明

后台「订单管理 → Excel 导入订单」→ 先下载模板，填写后上传（支持 `.xlsx / .xls / .csv`，≤5MB）：

| 列名 | 必填 | 说明 |
| --- | --- | --- |
| 演出ID | 二选一 | 优先按 ID 匹配 |
| 演出名称 | 二选一 | ID 为空时按名称精确/模糊匹配 |
| 买方姓名 | ✅ | 写入 `orders.buyer_name` |
| 手机号 | ✅ | 取票联系电话 |
| 数量 | | 默认 1 |
| 单价 | | 留空时取票档价 → 演出最低价 |
| 票档名称 | | 用于匹配票档并取价 |
| 订单状态 | | 待支付/已支付/已取消/已完成/已退款，默认「已支付」 |
| 备注 / 下单时间 | | 可留空 |

> 导入订单 `source = import`，**不扣减库存**（视为历史/外部订单）；导入结果会逐行回显失败原因。

## 七、生产部署说明

### 1. 构建前端

```bash
cd web && npm install && npm run build     # 产出 web/dist
```

### 2. 启动后端（Express 同时托管 dist 静态资源）

```bash
cd server
cp .env.example .env    # 修改 DB_*、JWT_SECRET、CORS_ORIGIN、SYNC_*
npm install --production
npm run init-db         # 首次执行
pm2 start src/app.js --name show-ticket-api -i max
pm2 start src/scripts/cronWorker.js --name show-ticket-cron
pm2 save && pm2 startup
```

> `app.js` 已做 SPA fallback：`GET /非/api 路径` → 返回 `web/dist/index.html`，因此**只需部署 Node 服务**即可。

### 3. Nginx（HTTPS / 静态缓存 / 反向代理，可选）

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # 前端构建产物（可选：也可直接由 Node 托管）
    root /opt/show-ticket/web/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 接口反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|webp|svg|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    client_max_body_size 10m;
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;
}
```

若使用 Nginx 托管静态资源，请把 `.env` 的 `CORS_ORIGIN` 改为前端域名，例如：

```env
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
```

### 4. Docker（可选）

```dockerfile
# 后端
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --production
COPY server/ ./
EXPOSE 3001
CMD ["node", "src/app.js"]
```

### 5. 数据库备份

```bash
mysqldump -u root -p show_ticket > show_ticket_$(date +%F).sql
```

---

## 八、功能清单对照


| 需求 | 落地位置 |
| --- | --- |
| 登录 / 注册（注册必填邀请码） | `views/LoginView.vue`、`RegisterView.vue`；`routes/auth.js` |
| 后台生成 & 管理邀请码 | `admin/AdminInvite.vue`；`POST /admin/invite-codes`（支持批量 + 有效期） |
| 用户中心：资料 / 收藏 / 浏览记录 / 发布售卖 | `views/UserView.vue`、`ProfileView.vue`、`FavoritesView.vue`、`HistoryView.vue`、`SellTicketView.vue` |
| 演出列表 + 城市/类型/日期筛选 | `views/ShowListView.vue`；`GET /shows` |
| 演出详情（海报/艺人/场馆/时间/票价区间/站内付款） | `views/ShowDetailView.vue` → `OrderConfirmView` → `PaymentView` |
| 后台录入演出 + 每日自动同步 | `admin/AdminShows.vue`（含票档）；`services/syncService.js` + `scheduler.js` |
| 首页：轮播 / 分类导航 / 即将上演 / 近期上新榜 | `views/HomeView.vue`；`GET /shows/home` |
| 搜索（艺人 / 名称 / 场馆） | `views/SearchView.vue`；`GET /shows/search`、`/search/suggest` |
| 后台：演出 / 邀请码 / 用户 / 留言审核 | `src/admin/*` + `routes/admin.js` |
| UI：简洁年轻化、卡片式、骨架屏、下拉刷新 | `style.css` 组件类、`components/SkeletonList.vue`、`components/PullRefresh.vue` |
| 下单 / 支付 / 订单 / 挂票 / 二手集市 / 私聊转票 | `views/Order*.vue`、`MarketView.vue`、`TicketDetailView.vue`、`SellTicketView.vue`、`Chat*.vue` |

---

## 九、常见问题

1. **注册提示邀请码已使用** → 一个邀请码仅可注册一次，到后台「邀请码管理」批量生成新的。
2. **页面空白/接口 404** → 确认后端 3001 已启动；前端 `npm run dev` 依赖 vite proxy，生产请用 `pm2` 启动后端托管 `dist`。
3. **MySQL 连接失败** → 检查 `.env` 的 `DB_*`；MySQL 8 默认认证方式若报 `ER_NOT_SUPPORTED_AUTH_MODE`，执行：
   `ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '你的密码';`
4. **支付** → 演示环境为模拟支付，生产请在 `server/src/routes/orders.js` 的 `/:id/pay` 中接入真实渠道并处理异步回调。
5. **私聊实时性** → 当前为 3 秒轮询，可替换为 WebSocket / Socket.IO 以降低延迟。
