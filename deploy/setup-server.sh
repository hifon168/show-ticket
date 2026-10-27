#!/usr/bin/env bash
# ============================================================
# 国内云服务器初始化脚本（Ubuntu 22.04，以 root 运行）
# 用途：安装运行所需的基础环境（Nginx / MySQL / Node / PM2 / Git）
# 注意：含交互步骤（mysql_secure_installation、创建数据库）已标注，请按需手动执行
# ============================================================
set -e

echo "== 1. 更新系统 =="
apt update && apt -y upgrade

echo "== 2. 安装 Nginx / MySQL / Git =="
apt -y install nginx mysql-server git curl ufw

echo "== 3. 安装 Node.js 18 =="
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt -y install nodejs

echo "== 4. 安装 PM2 进程守护 =="
npm install -g pm2

echo "== 5. MySQL 安全初始化（交互，请按提示设置 root 密码并移除匿名用户） =="
mysql_secure_installation

echo "== 6. 创建数据库与专用用户（把下面的密码改成你的强密码后取消注释执行） =="
# mysql -u root -p <<'SQL'
# CREATE DATABASE show_ticket CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
# CREATE USER 'show_ticket'@'localhost' IDENTIFIED BY '改成强密码';
# GRANT ALL PRIVILEGES ON show_ticket.* TO 'show_ticket'@'localhost';
# FLUSH PRIVILEGES;
# SQL

echo "== 7. 创建部署目录 =="
mkdir -p /www/show-ticket/logs /www/show-ticket/web/dist /var/www/certbot
chown -R $(logname):$(logname) /www/show-ticket 2>/dev/null || true

echo "== 8. 配置防火墙（仅放行 22/80/443） =="
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

echo ""
echo "基础环境安装完成。"
echo "下一步："
echo "  1) 部署代码到 /www/show-ticket"
echo "  2) 复制 deploy/.env.production.example 为 server/.env 并填值"
echo "  3) 参考 DEPLOY_CN.md 配置 Nginx + SSL"
echo "  4) pm2 start ecosystem.config.js --env production"
