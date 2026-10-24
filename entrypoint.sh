#!/bin/bash
# 自包含启动脚本：启动内置 MariaDB -> 建库/写入演示数据（幂等）-> 前台启动后端
set -e

MYSQL_DATA="${MYSQL_DATA:-/var/lib/mysql}"
DB_PASSWORD="${DB_PASSWORD:-rootpass}"
DB_NAME="${DB_NAME:-show_ticket}"

echo "[entrypoint] 初始化 MariaDB 数据目录（如需）..."
if [ ! -d "$MYSQL_DATA/mysql" ]; then
  mysql_install_db --user=mysql --datadir="$MYSQL_DATA" --auth-root-authentication-method=normal >/dev/null 2>&1
fi

# 选择实际的守护进程名（不同 MariaDB 版本可能是 mariadbd / mysqld）
if command -v mariadbd >/dev/null 2>&1; then
  DAEMON=mariadbd
else
  DAEMON=mysqld
fi

echo "[entrypoint] 启动 MariaDB ($DAEMON)..."
mkdir -p /run/mysqld && chown -R mysql:mysql /run/mysqld
"$DAEMON" --user=mysql --datadir="$MYSQL_DATA" >/var/log/mysqld.log 2>&1 &

# 等待数据库就绪
for i in $(seq 1 60); do
  if mysqladmin --user=root status >/dev/null 2>&1; then
    echo "[entrypoint] MariaDB 已就绪"
    break
  fi
  sleep 1
done

echo "[entrypoint] 配置 root 密码与数据库..."
mysql --user=root <<SQL
ALTER USER 'root'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_general_ci;
FLUSH PRIVILEGES;
SQL

cd /app/server
echo "[entrypoint] 初始化数据库与演示数据（幂等）..."
node src/scripts/initDb.js
node src/scripts/seedDemo.js

echo "[entrypoint] 启动后端，监听端口 ${PORT:-7860}..."
exec node src/app.js
