/**
 * 定时任务调度器
 * - 每日按 SYNC_CRON（默认 03:00）自动同步演出资讯
 * - 同步后自动下架已过期演出
 * - 独立进程运行：npm run cron
 */
const cron = require('node-cron');
const config = require('../config');
const { syncShows, archiveExpiredShows } = require('./syncService');

async function runSyncTask() {
  console.log('[CRON] 开始执行每日演出资讯同步...');
  try {
    const r = await syncShows();
    const archived = await archiveExpiredShows();
    console.log(`[CRON] 同步结果 新增:${r.created} 更新:${r.updated}，已下架过期演出:${archived}`);
  } catch (e) {
    console.error('[CRON] 同步失败:', e.message);
  }
}

function startScheduler() {
  if (!cron.validate(config.sync.cron)) {
    console.warn(`[CRON] 表达式无效: ${config.sync.cron}`);
    return;
  }
  cron.schedule(config.sync.cron, runSyncTask, { timezone: 'Asia/Shanghai' });
  console.log(`[CRON] 已注册每日同步任务: ${config.sync.cron} (Asia/Shanghai)`);

  if (config.sync.onStart) {
    console.log('[CRON] 启动时立即执行一次同步');
    runSyncTask();
  }
}

module.exports = { startScheduler, runSyncTask };
