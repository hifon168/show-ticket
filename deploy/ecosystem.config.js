// PM2 进程守护配置
// 用法：在 server/ 目录下执行 `pm2 start ecosystem.config.js --env production`
module.exports = {
  apps: [
    {
      name: 'show-ticket-server',
      cwd: '/www/show-ticket/server',
      script: 'src/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: '/www/show-ticket/logs/err.log',
      out_file: '/www/show-ticket/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
