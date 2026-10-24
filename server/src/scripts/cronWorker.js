/**
 * 独立常驻的定时任务进程：node src/scripts/cronWorker.js
 * 用于生产环境把定时任务与 Web 进程分离（PM2 分别启动 app.js 与 cronWorker.js）
 */
require('dotenv').config();
const { startScheduler } = require('../services/scheduler');

console.log('[CRON] 定时任务守护进程已启动，等待触发...');
startScheduler();

// 防止进程退出
process.on('SIGINT', () => {
  console.log('[CRON] 已停止');
  process.exit(0);
});
