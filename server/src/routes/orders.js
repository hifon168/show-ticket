const express = require('express');
const { query, queryOne, exec, transaction } = require('../db');
const { ok, fail, page } = require('../utils/response');
const { pager, genOrderNo, money } = require('../utils/helpers');
const { authRequired } = require('../middleware/auth');
const { uniqueOrderNo } = require('../services/orderNoService');
const PaymentService = require('../services/payment');

const router = express.Router();

/** 解析选座明细：兼容对象/数组/JSON 字符串，过滤非法项 */
function parseSeats(raw) {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && x.tierId && x.price != null)
    .map((x) => ({ seatNo: String(x.seatNo || ''), area: String(x.area || ''), price: Number(x.price), tierId: Number(x.tierId) }));
}

/** 订单状态字典 */
const ORDER_STATUS = {
  0: '待支付',
  1: '已支付',
  2: '已取消',
  3: '已完成',
  4: '已退款',
};

/** 自动取消超时未支付订单（15 分钟） */
async function autoCancelTimeoutOrders(userId) {
  await exec(
    `UPDATE orders SET status = 2, updated_at = NOW()
     WHERE user_id = ? AND status = 0 AND created_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
    [userId]
  );
}

/**
 * POST /api/orders  创建订单
 * body: { showId, tierId, quantity, contactName, contactPhone, remark }
 *      二手票下单：{ ticketId, quantity, contactName, contactPhone }
 */
router.post('/', authRequired, async (req, res) => {
  try {
    const { showId, tierId, ticketId, quantity = 1, contactName, contactPhone, buyerName, remark } = req.body || {};
    const qty = Math.max(1, Number(quantity));
    if (!contactName || !contactPhone) return res.json(fail('请填写取票联系人与手机号'));

    // 买方姓名：未单独填写时取取票联系人
    const buyer = String(buyerName || contactName || '').slice(0, 50);

    let order;

    if (ticketId) {
      // ---------- 二手票下单 ----------
      const ticket = await queryOne('SELECT * FROM resale_tickets WHERE id = ?', [ticketId]);
      if (!ticket) return res.json(fail('该二手票不存在'));
      if (ticket.status !== 0) return res.json(fail('该票已下架或已售出'));
      if (ticket.quantity < qty) return res.json(fail('剩余票数不足'));
      if (ticket.seller_id === req.user.id) return res.json(fail('不能购买自己发布的票'));

      const show = await queryOne('SELECT * FROM shows WHERE id = ?', [ticket.show_id]);
      const amount = money(ticket.sell_price * qty);

      order = await transaction(async (conn) => {
        const [r] = await conn.execute(
          `INSERT INTO orders (order_no, user_id, seller_id, source, show_id, ticket_id, tier_id, tier_name,
             unit_price, quantity, amount, buyer_name, contact_name, contact_phone, status, remark, created_at, updated_at)
           VALUES (?, ?, ?, 'resale', ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW(), NOW())`,
          [
            await uniqueOrderNo('PX'),
            req.user.id,
            ticket.seller_id,
            ticket.show_id,
            ticket.id,
            `${ticket.tier_name || ''}${ticket.seat_info ? ' ' + ticket.seat_info : ''}`.trim(),
            ticket.sell_price,
            qty,
            amount,
            buyer,
            contactName,
            contactPhone,
            remark || '',
          ]
        );
        // 锁定库存（预占）：减少可售数量，支付失败/取消时回滚
        const [upd] = await conn.execute(
          'UPDATE resale_tickets SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
          [qty, ticket.id, qty]
        );
        if (upd.affectedRows === 0) throw new Error('剩余票数不足');
        return r.insertId;
      });
    } else {
      // ---------- 官方票档下单（支持选座） ----------
      if (!showId) return res.json(fail('参数不完整'));

      // 选座模式：body.seats 为座位明细数组 [{seatNo,area,price,tierId}]
      const seats = parseSeats(req.body && req.body.seats);
      if (seats.length) {
        const qty = seats.length;
        const amount = money(seats.reduce((s, x) => s + Number(x.price || 0), 0));
        const groups = {};
        for (const it of seats) groups[it.tierId] = (groups[it.tierId] || 0) + 1;

        const show = await queryOne('SELECT * FROM shows WHERE id = ? AND status = 1', [showId]);
        if (!show) return res.json(fail('演出不存在或已下架'));
        for (const tid of Object.keys(groups)) {
          if (Number(tid) <= 0) continue; // 默认区域（无对应票档）不校验
          const t = await queryOne('SELECT id FROM ticket_tiers WHERE id = ? AND show_id = ?', [tid, showId]);
          if (!t) return res.json(fail('票档不存在'));
        }

        const sessionDate = String((req.body && req.body.sessionDate) || '').slice(0, 20);
        order = await transaction(async (conn) => {
          for (const [tid, cnt] of Object.entries(groups)) {
            if (Number(tid) <= 0) continue; // 默认区域不扣票档库存
            const [upd] = await conn.execute(
              'UPDATE ticket_tiers SET stock = stock - ? WHERE id = ? AND stock >= ?',
              [cnt, tid, cnt]
            );
            if (upd.affectedRows === 0) throw new Error('部分票档库存不足');
          }
          const first = seats[0];
          const [r] = await conn.execute(
            `INSERT INTO orders (order_no, user_id, seller_id, source, show_id, ticket_id, tier_id, tier_name,
               unit_price, quantity, amount, buyer_name, contact_name, contact_phone, status, remark, seats, session_date, created_at, updated_at)
             VALUES (?, ?, 0, 'official', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NOW(), NOW())`,
            [
              await uniqueOrderNo('PX'),
              req.user.id,
              showId,
              first.tierId,
              `选座 ${qty}张`,
              first.price,
              qty,
              amount,
              buyer,
              contactName,
              contactPhone,
              remark || '',
              JSON.stringify({ sessionDate, items: seats }),
              sessionDate,
            ]
          );
          await conn.execute('UPDATE shows SET sold_count = sold_count + ? WHERE id = ?', [qty, showId]);
          return r.insertId;
        });
      } else {
        // 传统票档模式
        if (!tierId) return res.json(fail('参数不完整'));
        const show = await queryOne('SELECT * FROM shows WHERE id = ? AND status = 1', [showId]);
        if (!show) return res.json(fail('演出不存在或已下架'));
        const tier = await queryOne('SELECT * FROM ticket_tiers WHERE id = ? AND show_id = ?', [tierId, showId]);
        if (!tier) return res.json(fail('票档不存在'));
        if (tier.stock < qty) return res.json(fail('库存不足'));

        const amount = money(tier.price * qty);

        order = await transaction(async (conn) => {
          const [r] = await conn.execute(
            `INSERT INTO orders (order_no, user_id, seller_id, source, show_id, ticket_id, tier_id, tier_name,
               unit_price, quantity, amount, buyer_name, contact_name, contact_phone, status, remark, created_at, updated_at)
             VALUES (?, ?, 0, 'official', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW(), NOW())`,
            [
              await uniqueOrderNo('PX'),
              req.user.id,
              showId,
              tier.id,
              tier.name,
              tier.price,
              qty,
              amount,
              buyer,
              contactName,
              contactPhone,
              remark || '',
            ]
          );
          const [upd] = await conn.execute('UPDATE ticket_tiers SET stock = stock - ? WHERE id = ? AND stock >= ?', [
            qty,
            tier.id,
            qty,
          ]);
          if (upd.affectedRows === 0) throw new Error('库存不足');
          await conn.execute('UPDATE shows SET sold_count = sold_count + ? WHERE id = ?', [qty, showId]);
          return r.insertId;
        });
      }
    }

    const row = await queryOne('SELECT * FROM orders WHERE id = ?', [order]);
    res.json(ok(row, '下单成功，请尽快完成支付'));
  } catch (e) {
    res.json(fail(e.message || '下单失败'));
  }
});

/**
 * GET /api/orders  我的订单列表（status 可选：0待支付 1已支付 2已取消 3已完成 4已退款）
 */
router.get('/', authRequired, async (req, res) => {
  try {
    await autoCancelTimeoutOrders(req.user.id);
    const { status } = req.query;
    const { pageNum, pageSize, offset } = pager(req.query, 10);

    const where = ['o.user_id = ?'];
    const params = [req.user.id];
    if (status !== undefined && status !== '' && status !== 'all') {
      where.push('o.status = ?');
      params.push(Number(status));
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const totalRow = await queryOne(`SELECT COUNT(1) AS total FROM orders o ${whereSql}`, params);
    const list = await query(
      `SELECT o.*, s.title AS show_title, s.poster, s.city, s.venue_name, s.start_time, s.artist
       FROM orders o LEFT JOIN shows s ON s.id = o.show_id
       ${whereSql} ORDER BY o.created_at DESC LIMIT ?, ?`,
      [...params, offset, pageSize]
    );
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/orders/sold  我卖出的订单（卖家视角） */
router.get('/sold', authRequired, async (req, res) => {
  try {
    const { pageNum, pageSize, offset } = pager(req.query, 10);
    const totalRow = await queryOne('SELECT COUNT(1) AS total FROM orders WHERE seller_id = ?', [req.user.id]);
    const list = await query(
      `SELECT o.*, s.title AS show_title, s.poster, s.city, s.venue_name, s.start_time
       FROM orders o LEFT JOIN shows s ON s.id = o.show_id
       WHERE o.seller_id = ? ORDER BY o.created_at DESC LIMIT ?, ?`,
      [req.user.id, offset, pageSize]
    );
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/orders/:id  订单详情 */
router.get('/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await queryOne(
      `SELECT o.*, s.title AS show_title, s.poster, s.city, s.venue_name, s.start_time, s.artist
       FROM orders o LEFT JOIN shows s ON s.id = o.show_id WHERE o.id = ?`,
      [id]
    );
    if (!row) return res.json(fail('订单不存在'));
    if (row.user_id !== req.user.id && row.seller_id !== req.user.id && req.user.role !== 1) {
      return res.json(fail('无权查看该订单'));
    }
    res.json(ok({ ...row, statusText: ORDER_STATUS[row.status] }));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/**
 * POST /api/orders/:id/pay  发起支付（生成预支付信息）
 * - 测试模式：返回指向本服务的「模拟支付」地址（扫码/跳转或应用内确认均可）。
 * - 真实模式：返回微信 code_url（扫码）或支付宝跳转地址；支付结果由异步通知落库。
 * 注意：本接口只"下单到支付渠道"，真正把订单置为已支付发生在回调 / 模拟确认时。
 */
router.post('/:id/pay', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { payMethod = 'wechat' } = req.body || {};
    if (!['wechat', 'alipay'].includes(payMethod)) return res.json(fail('不支持的支付方式'));
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.json(fail('订单不存在'));
    if (order.user_id !== req.user.id) return res.json(fail('无权支付该订单'));
    if (order.status !== 0) return res.json(fail('订单状态不可支付'));

    const payInfo = await PaymentService.createPayment(order, payMethod);
    res.json(ok(payInfo, '请完成支付'));
  } catch (e) {
    res.json(fail(e.message || '发起支付失败'));
  }
});

/** POST /api/orders/:id/cancel  取消订单（归还库存） */
router.post('/:id/cancel', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.json(fail('订单不存在'));
    if (order.user_id !== req.user.id) return res.json(fail('无权操作'));
    if (order.status !== 0) return res.json(fail('当前状态不可取消'));

    await transaction(async (conn) => {
      await conn.execute('UPDATE orders SET status = 2, updated_at = NOW() WHERE id = ?', [id]);
      if (order.source === 'official' && order.tier_id) {
        await conn.execute('UPDATE ticket_tiers SET stock = stock + ? WHERE id = ?', [order.quantity, order.tier_id]);
        await conn.execute('UPDATE shows SET sold_count = sold_count - ? WHERE id = ?', [order.quantity, order.show_id]);
      }
      if (order.source === 'resale' && order.ticket_id) {
        await conn.execute('UPDATE resale_tickets SET quantity = quantity + ?, status = 0 WHERE id = ?', [
          order.quantity,
          order.ticket_id,
        ]);
      }
    });
    res.json(ok(null, '订单已取消'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** POST /api/orders/:id/confirm  确认收货/完成 */
router.post('/:id/confirm', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order || order.user_id !== req.user.id) return res.json(fail('订单不存在'));
    if (order.status !== 1) return res.json(fail('当前状态不可确认'));
    await exec('UPDATE orders SET status = 3, updated_at = NOW() WHERE id = ?', [id]);
    res.json(ok(null, '已完成，祝观演愉快'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** POST /api/orders/:id/refund  申请退款 */
router.post('/:id/refund', authRequired, async (req, res) => {
  try {
    const { reason = '' } = req.body || {};
    const id = Number(req.params.id);
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order || order.user_id !== req.user.id) return res.json(fail('订单不存在'));
    if (order.status !== 1) return res.json(fail('当前状态不可退款'));

    await transaction(async (conn) => {
      await conn.execute('UPDATE orders SET status = 4, remark = CONCAT(IFNULL(remark,""), " | 退款原因:", ?), updated_at = NOW() WHERE id = ?', [
        reason,
        id,
      ]);
      // 退款归还库存
      if (order.source === 'official' && order.tier_id) {
        await conn.execute('UPDATE ticket_tiers SET stock = stock + ? WHERE id = ?', [order.quantity, order.tier_id]);
      }
      if (order.source === 'resale' && order.ticket_id) {
        await conn.execute('UPDATE resale_tickets SET quantity = quantity + ?, sold_count = sold_count - ?, status = 0 WHERE id = ?', [
          order.quantity,
          order.quantity,
          order.ticket_id,
        ]);
      }
    });
    res.json(ok(null, '退款申请已提交'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

module.exports = router;
module.exports.ORDER_STATUS = ORDER_STATUS;
