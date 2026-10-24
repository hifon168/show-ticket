/**
 * 轻量迁移：幂等补齐新增字段（可重复执行）
 * 目前包含：
 *   - orders.buyer_name   买方姓名
 *   - shows.source_poster 公网原始海报地址（用于判断图片是否需要刷新）
 * 运行：cd server && npm run migrate
 */
require('dotenv').config();
const { query, exec } = require('../db');

const MIGRATIONS = [
  {
    name: 'orders.buyer_name',
    table: 'orders',
    column: 'buyer_name',
    sql: `ALTER TABLE orders ADD COLUMN buyer_name VARCHAR(50) NOT NULL DEFAULT '' COMMENT '买方姓名' AFTER amount`,
  },
  {
    name: 'shows.source_poster',
    table: 'shows',
    column: 'source_poster',
    sql: `ALTER TABLE shows ADD COLUMN source_poster VARCHAR(500) NOT NULL DEFAULT '' COMMENT '公网原始海报URL' AFTER poster`,
  },
];

async function hasColumn(table, column) {
  const rows = await query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

(async () => {
  for (const m of MIGRATIONS) {
    // eslint-disable-next-line no-await-in-loop
    if (await hasColumn(m.table, m.column)) {
      console.log(`⏭️  已存在，跳过：${m.name}`);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await exec(m.sql);
    console.log(`✅ 已添加字段：${m.name}`);
  }
  console.log('\n🎉 迁移完成');
  process.exit(0);
})().catch((e) => {
  console.error('❌ 迁移失败:', e.message);
  process.exit(1);
});
