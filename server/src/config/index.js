/**
 * 全局配置：统一从环境变量读取，便于直接部署到不同环境
 */
require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 3001),
  env: process.env.NODE_ENV || 'development',
  // CORS 白名单
  corsOrigin: (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim()),

  // MySQL
  // 优先读 DB_*；Railway 的 MySQL 插件会自动注入 MYSQL_* 变量，无需手动映射
  db: {
    host: process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
    user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'show_ticket',
    // 连接池配置
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // 以字符串形式返回 DATETIME（'YYYY-MM-DD HH:mm:ss'），避免被序列化成带 T 的 ISO/UTC
    dateStrings: true,
    // 会话时区统一为北京时间，确保 NOW() 与读数一致
    timezone: '+08:00',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'show_ticket_default_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // 演出资讯每日同步（公网真实数据源）
  sync: {
    // 可选：额外自定义数据源，留空则只跑公网真实数据源
    apiUrl: process.env.SYNC_API_URL || '',
    token: process.env.SYNC_API_TOKEN || '',
    // 默认每天晚上 23:00 自动同步（Asia/Shanghai）
    cron: process.env.SYNC_CRON || '0 23 * * *',
    onStart: String(process.env.SYNC_ON_START || 'false') === 'true',
    // 同步城市（留空=同步 cities 表全部城市）
    cities: String(process.env.SYNC_CITIES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    pageSize: Number(process.env.SYNC_PAGE_SIZE || 20),
    pages: Number(process.env.SYNC_PAGES || 1),
    withDetail: String(process.env.SYNC_WITH_DETAIL || 'true') === 'true',
    // 是否把公网海报下载到本地；false=直连源站图片（换图自动同步）
    downloadImages: String(process.env.SYNC_DOWNLOAD_IMAGES || 'false') === 'true',
  },
};
