/**
 * 一次性回填：为所有「没有票档」的演出按价格区间生成官方票档。
 * 公网数据源不返回票档，之前同步的演出都缺少 ticket_tiers，导致详情页无法选票档、下单报错。
 * 运行：node src/scripts/backfillTiers.js
 */
require('dotenv').config();
const cfg = require('../config');
const mysql = require('mysql2/promise');

function buildTiers(min, max) {
  const m = Number(min) || 0;
  const x = Number(max) || 0;
  const tiers = [];
  if (m > 0) tiers.push({ name: '普通票', price: m });
  if (x > 0 && x - m >= 50) {
    const mid = Math.round((m + x) / 2 / 10) * 10;
    if (mid !== m && mid !== x) tiers.push({ name: '进阶票', price: mid });
  }
  if (x > 0 && x !== m) tiers.push({ name: 'VIP票', price: x });
  if (!tiers.length) tiers.push({ name: '标准票', price: m });
  return tiers;
}

(async () => {
  const conn = await mysql.createConnection({
    host: cfg.db.host, port: cfg.db.port, user: cfg.db.user,
    password: cfg.db.password, database: cfg.db.database,
  });
  const [shows] = await conn.query(
    `SELECT id, min_price, max_price FROM shows
     WHERE id NOT IN (SELECT DISTINCT show_id FROM ticket_tiers WHERE show_id IS NOT NULL)`
  );
  console.log(`需补票档的演出：${shows.length} 场`);
  let done = 0;
  for (const s of shows) {
    const tiers = buildTiers(s.min_price, s.max_price);
    for (const t of tiers) {
      await conn.execute(
        'INSERT INTO ticket_tiers (show_id, name, price, original_price, stock, description, status) VALUES (?,?,?,?,?,?,1)',
        [s.id, t.name, t.price, t.price, 100, `${t.name} · 官方渠道`]
      );
    }
    done++;
    if (done % 200 === 0) console.log(`  已处理 ${done} 场`);
  }
  await conn.end();
  console.log(`完成，共为 ${done} 场演出生成票档`);
})().catch((e) => { console.error('回填失败：', e.message); process.exit(1); });
