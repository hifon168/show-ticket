/**
 * 手动执行一次演出资讯同步：node src/scripts/syncShows.js
 * 常用于 crontab / 服务器计划任务：
 *   0 3 * * * cd /opt/show-ticket/server && /usr/bin/node src/scripts/syncShows.js >> logs/sync.log 2>&1
 */
require('dotenv').config();
const { syncShows, archiveExpiredShows } = require('../services/syncService');

(async () => {
  try {
    const r = await syncShows();
    const archived = await archiveExpiredShows();
    console.log('同步完成：', { ...r, archived });
    process.exit(0);
  } catch (e) {
    console.error('同步失败：', e.message);
    process.exit(1);
  }
})();
