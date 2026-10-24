/**
 * 订单支付成功后的统一落库逻辑（被真实回调 / 模拟回调 / 测试确认 共用）。
 * 幂等：仅当订单处于「待支付(0)」时才处理。
 */
const { queryOne, exec, transaction } = require('../db');

async function markOrderPaid(orderId, payMethod = 'unknown') {
  const order = await queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) throw new Error('订单不存在');
  if (order.status !== 0) return order; // 已处理过，直接返回

  await transaction(async (conn) => {
    await conn.execute(
      'UPDATE orders SET status = 1, pay_method = ?, paid_at = NOW(), updated_at = NOW() WHERE id = ? AND status = 0',
      [payMethod, orderId]
    );

    // 二手票支付成功：增加真实售出数，售罄自动下架
    if (order.source === 'resale' && order.ticket_id) {
      const t = await queryOne('SELECT * FROM resale_tickets WHERE id = ?', [order.ticket_id]);
      if (t) {
        await conn.execute('UPDATE resale_tickets SET sold_count = sold_count + ? WHERE id = ?', [order.quantity, t.id]);
        const nt = await queryOne('SELECT * FROM resale_tickets WHERE id = ?', [t.id]);
        if (nt && nt.quantity <= 0) {
          await conn.execute("UPDATE resale_tickets SET status = 1 WHERE id = ?", [t.id]);
        }
      }
    }
  });
  return order;
}

module.exports = { markOrderPaid };
