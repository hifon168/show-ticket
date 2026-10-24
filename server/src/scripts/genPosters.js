/**
 * 为缺少海报的演出批量生成 SVG 海报
 * 运行：cd server && npm run gen-posters      （只补缺失的）
 *       cd server && npm run gen-posters -- --all （全部重新生成）
 */
require('dotenv').config();
const { query, exec } = require('../db');
const { generatePoster } = require('../services/posterService');

(async () => {
  const force = process.argv.includes('--all');
  const rows = force
    ? await query('SELECT id, title, artist, venue_name, city, start_time, category FROM shows')
    : await query(
        `SELECT id, title, artist, venue_name, city, start_time, category FROM shows
         WHERE poster IS NULL OR poster = '' OR poster = '0' ORDER BY id`
      );

  let n = 0;
  for (const s of rows) {
    const url = generatePoster(s);
    if (url) {
      await exec('UPDATE shows SET poster = ? WHERE id = ?', [url, s.id]);
      n++;
    }
  }
  console.log(`✅ 已为 ${n} 场演出生成海报（共 ${rows.length} 场待处理）`);
  process.exit(0);
})().catch((e) => {
  console.error('❌ 生成失败:', e.message);
  process.exit(1);
});
