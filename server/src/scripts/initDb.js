/**
 * 数据库初始化脚本：cd server && npm run init-db
 * 1. 创建数据库（如不存在）
 * 2. 执行 database/schema.sql 建表 + 字典数据
 * 3. 写入演示数据：管理员账号、邀请码、演出/票档/轮播
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { generatePoster } = require('../services/posterService');

const SCHEMA_PATH = path.join(__dirname, '../../../database/schema.sql');

async function main() {
  const { host, port, user, password, database } = config.db;

  // 1) 先连不上具体库，创建数据库
  const root = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  await root.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_general_ci;`);
  console.log(`✅ 数据库 \`${database}\` 已就绪`);
  await root.end();

  // 2) 执行建表 SQL
  const conn = await mysql.createConnection({ host, port, user, password, database, multipleStatements: true });
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await conn.query(sql);
  console.log('✅ 数据表已创建');

  // 3) 管理员账号
  const adminPhone = '13800000000';
  const adminPwd = 'admin123';
  const [adminRows] = await conn.query('SELECT id FROM users WHERE phone = ?', [adminPhone]);
  if (adminRows.length === 0) {
    await conn.query(
      `INSERT INTO users (phone, password, nickname, role, status, created_at)
       VALUES (?, ?, '超级管理员', 1, 1, NOW())`,
      [adminPhone, bcrypt.hashSync(adminPwd, 10)]
    );
    console.log(`✅ 管理员已创建：${adminPhone} / ${adminPwd}`);
  } else {
    console.log('ℹ️  管理员已存在，跳过');
  }

  // 4) 演示邀请码（注册必填）
  const [codeRows] = await conn.query('SELECT COUNT(1) AS c FROM invite_codes');
  if (codeRows[0].c === 0) {
    const codes = ['VIP88888', 'TICKET66', 'WELCOME1', 'PX2026VIP', 'TEST0001'];
    for (const c of codes) {
      await conn.query('INSERT INTO invite_codes (code, status, created_at) VALUES (?, 0, NOW())', [c]);
    }
    console.log(`✅ 已生成 ${codes.length} 个演示邀请码：${codes.join(', ')}`);
  }

  // 5) 演示演出 + 票档 + 轮播
  const [showRows] = await conn.query('SELECT COUNT(1) AS c FROM shows');
  if (showRows[0].c === 0) {
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
    const demo = [
      ['周杰伦「嘉年华」世界巡回演唱会', 'concert', '周杰伦', '国家体育场（鸟巢）', '北京', [580, 980, 1580, 2280], 99],
      ['薛之谦「天外来物」巡回演唱会', 'concert', '薛之谦', '梅赛德斯奔驰文化中心', '上海', [380, 680, 1080, 1680], 96],
      ['陈奕迅 FEAR and DREAMS 巡回演唱会', 'concert', '陈奕迅', '杭州奥体中心体育馆', '杭州', [480, 880, 1380, 1980], 94],
      ['开心麻花《乌龙山伯爵》', 'drama', '开心麻花', '北京喜剧院', '北京', [180, 280, 480, 880], 88],
      ['话剧《暗恋桃花源》', 'drama', '赖声川', '上剧场', '上海', [280, 480, 680, 980], 85],
      ['笑果脱口秀城市漫游', 'talk', '笑果文化', '广州大剧院', '广州', [160, 260, 380, 680], 82],
      ['单口喜剧专场·呼兰', 'talk', '呼兰', '成都东郊记忆', '成都', [150, 220, 380, 580], 76],
      ['草莓音乐节 2026', 'festival', '摩登天空', '武汉园博园', '武汉', [320, 520, 880, 1280], 92],
      ['迷笛音乐节 秋季场', 'festival', '迷笛', '常州太湖湾', '常州', [280, 480, 680, 980], 70],
      ['CBA 常规赛 广东 vs 辽宁', 'sports', '广东宏远', '东莞篮球中心', '东莞', [120, 280, 480, 880], 68],
      ['五月天「好好好想见到你」演唱会', 'concert', '五月天', '深圳大运中心', '深圳', [480, 880, 1380, 1880], 97],
      ['《只此青绿》舞蹈诗剧', 'drama', '中国东方演艺集团', '南京保利大剧院', '南京', [180, 380, 580, 880], 83],
    ];

    for (let i = 0; i < demo.length; i++) {
      const d = demo[i];
      const start = new Date(Date.now() + (i + 1) * 4 * 86400000);
      const end = new Date(start.getTime() + 3 * 3600000);
      const [r] = await conn.query(
        `INSERT INTO shows (title, subtitle, category, poster, artist, venue_name, city, address, start_time, end_time,
           min_price, max_price, tags, description, status, hot_score, source, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,'admin',NOW(),NOW())`,
        [
          d[0],
          '官方票务 · 支持在线选座',
          d[1],
          '',
          d[2],
          d[3],
          d[4],
          `${d[4]}市${d[3]}`,
          fmt(start),
          fmt(end),
          d[5][0],
          d[5][d[5].length - 1],
          ['热门', '可在线选座'].join(','),
          `${d[0]} —— 主演：${d[2]}；场馆：${d[3]}（${d[4]}）。演出时长约 150 分钟，具体以现场为准。`,
          d[6],
        ]
      );
      const showId = r.insertId;
      // 自动生成海报（演示数据无外链图片）
      const posterUrl = generatePoster({
        id: showId,
        title: d[0],
        artist: d[2],
        venue_name: d[3],
        city: d[4],
        start_time: fmt(start),
        category: d[1],
      });
      if (posterUrl) await conn.query('UPDATE shows SET poster = ? WHERE id = ?', [posterUrl, showId]);

      const names = ['看台', '内场', 'VIP', '至尊VIP'];
      for (let k = 0; k < d[5].length; k++) {
        await conn.query(
          `INSERT INTO ticket_tiers (show_id, name, price, original_price, stock, description, status, created_at)
           VALUES (?,?,?,?,?,?,1,NOW())`,
          [showId, `${names[k] || '票档'}${d[5][k]}`, d[5][k], Math.round(d[5][k] * 1.15), 200 - k * 30, `${names[k] || ''}区域，数量有限`]
        );
      }
    }
    console.log(`✅ 已写入 ${demo.length} 场演示演出及票档`);

    await conn.query(
      `INSERT INTO banners (title, image, show_id, sort, status, created_at) VALUES
       ('热门演唱会场次火热开售', '', 1, 1, 1, NOW()),
       ('音乐节季 · 全场限时优惠', '', 8, 2, 1, NOW()),
       ('话剧精选 · 好戏连连', '', 4, 3, 1, NOW())`
    );
    console.log('✅ 已写入首页轮播');
  }

  await conn.end();
  console.log('\n🎉 初始化完成！默认管理员：13800000000 / admin123');
  console.log('   演示邀请码：VIP88888 / TICKET66 / WELCOME1 / PX2026VIP / TEST0001\n');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ 初始化失败:', e.message);
  process.exit(1);
});
