# ============================================================
# 演出票务平台 - 自包含镜像（Node + 内置 MariaDB/MySQL）
# 适用于任何支持 Docker 的平台：Hugging Face Spaces（免费·免信用卡）、Koyeb、Fly、Render(付费) 等。
# 数据库随容器启动并自动建库 + 写入演示数据，无需外部数据库、无需信用卡。
# 说明：后端 Express 同时托管构建后的前端（web/dist），同源 /api，只需这一个服务。
# ============================================================

FROM node:18-alpine

# 安装 MariaDB（MySQL 兼容）与运行依赖
RUN apk add --no-cache mariadb mariadb-client bash

WORKDIR /app

# ---------- 阶段 1：构建前端（Vue3 + Vite） ----------
COPY web/ ./web/
RUN cd web && npm install && npm run build && rm -rf node_modules

# ---------- 阶段 2：后端生产依赖 ----------
COPY server/ ./server/
WORKDIR /app/server
RUN npm install --omit=dev
RUN mkdir -p public/posters

# ---------- 准备 MySQL/MariaDB 数据目录 ----------
ENV MYSQL_DATA=/var/lib/mysql
RUN mkdir -p "$MYSQL_DATA" && chown -R mysql:mysql "$MYSQL_DATA"

# ---------- 入口：启动数据库 -> 建库/演示数据 -> 启动后端 ----------
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER root
EXPOSE 7860

# 默认环境变量（平台一般会通过 PORT 注入；此处兜底）
ENV PORT=7860 \
    NODE_ENV=production \
    DB_HOST=127.0.0.1 \
    DB_PORT=3306 \
    DB_USER=root \
    DB_PASSWORD=rootpass \
    DB_NAME=show_ticket \
    CORS_ORIGIN=*

ENTRYPOINT ["/entrypoint.sh"]
