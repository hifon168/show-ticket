/**
 * 演示数据补充：普通用户 + 二手票 + 公开留言 + 私聊示例
 * 用于让二手集市、私聊、留言墙等页面开箱即有内容
 * 运行：cd server && npm run seed-demo
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, queryOne, exec } = require('../db');

const DEMO_USERS = [
  { phone: '13900000001', password: '123456', nickname: '票友小王', city: '北京' },
  { phone: '13900000002', password: '123456', nickname: '转票达人', city: '上海' },
];

async function main() {
  // 1. 演示用户
  const userIds = {};
  for (const u of DEMO_USERS) {
    let row = await queryOne('SELECT id FROM users WHERE phone = ?', [u.phone]);
    if (!row) {
      const r = await exec(
        `INSERT INTO users (phone, password, nickname, city, role, status, created_at) VALUES (?,?,?,?,0,1,NOW())`,
        [u.phone, bcrypt.hashSync(u.password, 10), u.nickname, u.city]
      );
      row = { id: r.insertId };
      console.log(`✅ 演示用户：${u.phone} / ${u.password}（${u.nickname}）`);
    }
    userIds[u.phone] = row.id;
  }
  const sellerId = userIds['13900000001'];
  const buyerId = userIds['13900000002'];

  // 2. 二手票（取前 3 场演出）
  const shows = await query('SELECT id, title, min_price, max_price FROM shows WHERE status = 1 ORDER BY hot_score DESC LIMIT 3');
  const seatList = [
    { tier: '内场A区', seat: '5排8-9号', off: 0.72, qty: 2, desc: '临时出差去不了，两张连座一起出，可小刀，支持平台担保交易。' },
    { tier: '看台', seat: '12排15号', off: 0.85, qty: 1, desc: '和朋友买重了，原价转让，电子票直接转赠。' },
    { tier: 'VIP区', seat: '2排3-4号', off: 0.9, qty: 2, desc: '前排好位置，含应援礼包，诚心要的私聊。' },
  ];

  for (let i = 0; i < shows.length; i++) {
    const s = shows[i];
    const cfg = seatList[i % seatList.length];
    const original = Number(s.max_price);
    const sell = Math.round(original * cfg.off);
    const exists = await queryOne('SELECT id FROM resale_tickets WHERE show_id = ? AND seller_id = ?', [s.id, sellerId]);
    if (exists) continue;
    await exec(
      `INSERT INTO resale_tickets (seller_id, show_id, title, tier_name, seat_info, original_price, sell_price,
        quantity, sold_count, description, images, contact_phone, status, view_count, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,0,?,?,?,0,?,NOW(),NOW())`,
      [sellerId, s.id, s.title, cfg.tier, cfg.seat, original, sell, cfg.qty, cfg.desc, '[]', '13900000001', 30 + i * 17]
    );
  }
  console.log(`✅ 已补充 ${shows.length} 条二手在售票`);

  // 3. 公开留言
  const hasMsg = await queryOne('SELECT id FROM user_messages WHERE status = 1');
  if (!hasMsg) {
    await exec(
      `INSERT INTO user_messages (user_id, nickname, content, reply, status, created_at, audited_at) VALUES
       (?, '票友小王', '抢票太难了，希望增加开票提醒功能～', '已收到，开票提醒功能已排期，感谢支持！', 1, NOW(), NOW()),
       (?, '转票达人', '二手票下单流程很顺畅，担保交易让人放心。', '感谢认可！我们会持续优化体验。', 1, NOW(), NOW())`,
      [sellerId, buyerId]
    );
    console.log('✅ 已补充公开留言');
  }

  // 4. 私聊示例
  const ticket = await queryOne('SELECT id, show_id FROM resale_tickets WHERE seller_id = ? LIMIT 1', [sellerId]);
  const hasConv = await queryOne('SELECT id FROM chat_conversations WHERE user_a = ? AND user_b = ?', [buyerId, sellerId]);
  if (ticket && !hasConv) {
    const r = await exec(
      `INSERT INTO chat_conversations (user_a, user_b, ticket_id, show_id, last_message, last_message_at, created_at)
       VALUES (?,?,?,?,'好的，那就平台下单吧', NOW(), NOW())`,
      [buyerId, sellerId, ticket.id, ticket.show_id]
    );
    const cid = r.insertId;
    const msgs = [
      [buyerId, '你好，这张票还在吗？'],
      [sellerId, '在的，两张连座，价格可以小刀～'],
      [buyerId, '800 可以吗？'],
      [sellerId, '成交，走平台担保下单吧'],
      [buyerId, '好的，那就平台下单吧'],
    ];
    for (const [sender, content] of msgs) {
      await exec('INSERT INTO chat_messages (conversation_id, sender_id, type, content, is_read, created_at) VALUES (?,?,?,?,?,NOW())', [
        cid,
        sender,
        'text',
        content,
        1,
      ]);
    }
    console.log('✅ 已补充私聊会话示例');
  }

  console.log('\n🎉 演示数据补充完成');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ 失败:', e.message);
  process.exit(1);
});
