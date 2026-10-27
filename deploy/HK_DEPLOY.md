# 香港服务器部署指南（免备案 · 演示首选）

> 你已决定走香港服务器。核心好处：**服务器在中国香港 → 强制 ICP 备案不适用**，前面担心的经营范围、售票面貌、公安备案全部不用管；**代码零改动**，直接复用 `deploy/` 包。
> 国内访问延迟约 30–60ms，演示足够。

---

## 一、购买（2026 参考价，以官网实时为准）

**推荐：腾讯云轻量应用服务器**
- 地域：**中国香港**
- 镜像：**Ubuntu 22.04 LTS**
- 配置：2 核 2G / 30M 峰值带宽 / 1TB 月流量
- 价格：新用户年付约 **¥199–299**（续费约 ¥45/月）

备选：阿里云轻量应用服务器（香港）2 核 2G 年付约 **¥408**。
> 均比境内（¥99）略贵，但省掉数周备案 + 合规风险，演示/快速上线最划算。

---

## 二、域名（免备案的关键）

- 域名在国内注册商（阿里云万网 / 腾讯云）购买即可，**必须完成域名实名认证**（否则会被暂停解析）。
- 把域名 DNS 解析到香港服务器公网 IP。**解析到香港（境外）IP 不触发 ICP 备案拦截，无需备案。**
- 不要先在国内提交 ICP 备案——那是给「境内服务器」准备的，香港服务器用不上。

---

## 三、SSL 证书（HTTPS，免费，无需备案）

证书签发只验证域名所有权，不要求备案，用 Let's Encrypt 即可：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d 你的域名.com -d www.你的域名.com
```

或：在云厂商控制台申请免费 DV 证书，下载 Nginx 版后按 `nginx.conf` 注释路径放置。

---

## 四、部署步骤（复用 deploy/ 包，跳过备案）

```bash
# 1) 服务器初始化（装 Nginx / MySQL / Node18 / PM2 / Git + 开防火墙）
bash setup-server.sh

# 2) 部署代码
cd /www/show-ticket
git clone <你的仓库地址> .
cd server && npm install --production
cd ../web && npm install && npm run build      # 产物在 web/dist

# 3) 配置环境变量
cp ../deploy/.env.production.example server/.env
vim server/.env        # 填 DB_* / JWT_SECRET / CORS_ORIGIN

# 4) 数据库：应用启动自动建表（幂等）；如需手动：
cd /www/show-ticket/server && npm run init-db

# 5) SSL（见第三章）
certbot --nginx -d 你的域名.com -d www.你的域名.com

# 6) Nginx：复制配置并替换域名
cp ../deploy/nginx.conf /etc/nginx/sites-available/show-ticket
vim /etc/nginx/sites-available/show-ticket     # 把"你的域名.com"全替换
ln -s /etc/nginx/sites-available/show-ticket /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 7) 启动与守护
cd /www/show-ticket/server
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup          # 按提示设置开机自启
```

---

## 五、公安备案说明

服务器在香港（境外），按规则**无需 ICP 备案，公安联网备案通常也非强制**，多数同类项目不做。如不放心可自愿做，但一般不影响上线。

---

## 六、与境内方案的差异

| 项目 | 境内服务器 | 香港服务器（本方案） |
|---|---|---|
| ICP 备案 | 必须（7–20 天） | 不需要 |
| 经营范围 / 售票面貌 | 需规避 | 无限制 |
| 公安备案 | 必须（备案后 30 天） | 通常不需要 |
| 价格（2 核 2G/年） | ¥99 起 | ¥199–408 |
| 国内访问速度 | 最快 | 略慢（延迟 30–60ms，够用） |
| 代码改动 | 零 | 零 |

---

## 七、注意事项

- **支付**：微信/支付宝商户接入对境外服务器有限制，但演示不收款无影响（默认 `PAYMENT_MODE=test`）。
- **同步**：每日 23:00（北京时间）自动同步 17 城，PM2 常驻后照常运行。
- **流量**：香港轻量有月流量包，演示量级足够；超额约 1 元/GB，留意控制台余量。
- **数据库**：`config/index.js` 已兼容 `DB_*` 命名，按 `.env.production.example` 填即可，无需改代码。
