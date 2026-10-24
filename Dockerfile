# ============================================================
# 演出票务平台 - 多阶段构建镜像
# 阶段 1：构建前端（Vue3 + Vite）-> web/dist
# 阶段 2：安装后端生产依赖，放入前端产物，启动服务
# 说明：后端 Express 同时托管 web/dist 静态资源（同源 /api），
#       因此只需部署这一个服务即可。
# ============================================================

# ---------- 阶段 1：构建前端 ----------
FROM node:18-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build

# ---------- 阶段 2：后端运行 ----------
FROM node:18-alpine
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev
COPY server/ ./
# 数据库初始化脚本（initDb 启动时需要 database/schema.sql）
COPY database/ /app/database/
# 前端构建产物放到后端期望的路径（server/src -> ../../web/dist）
COPY --from=web /app/web/dist /app/web/dist
# 海报输出目录（纯 SVG，无原生依赖）
RUN mkdir -p public/posters

EXPOSE 3001

# 首次启动自动初始化数据库并写入演示数据（initDb/seedDemo 均幂等）；
# 之后每次启动为 no-op，不影响性能。随后启动主服务。
CMD ["sh", "-c", "node src/scripts/initDb.js; node src/scripts/seedDemo.js; node src/app.js"]
