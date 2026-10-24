const express = require('express');
const { ok, fail } = require('../utils/response');
const PaymentService = require('../services/payment');
const paymentConfig = require('../services/payment/config');
const { markOrderPaid } = require('../services/orderPaid');
const { queryOne } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

/**
 * 测试模式：模拟支付回调确认。
 * - GET：扫码/跳转后打开的落地页（模拟用户在微信/支付宝内完成支付后渠道的异步通知）。
 * - POST：应用内「模拟支付」按钮调用（需登录，只能支付自己的订单）。
 * 无论哪种，最终都通过 markOrderPaid 把订单置为已支付。
 */
router.get('/mock/confirm', async (req, res) => {
  try {
    if (paymentConfig.mode !== 'test') return res.status(403).send('仅测试模式可用');
    const orderId = Number(req.query.orderId);
    await markOrderPaid(orderId, 'test');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(
      `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>支付成功</title><style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f5f6f8;margin:0}` +
        `.card{background:#fff;padding:32px 40px;border-radius:16px;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.08)}` +
        `.ok{font-size:48px}.t{margin-top:12px;font-size:18px;font-weight:600;color:#16a34a}.s{margin-top:6px;color:#888;font-size:13px}</style></head>` +
        `<body><div class="card"><div class="ok">✅</div><div class="t">支付成功</div><div class="s">请返回 App 查看订单</div></div></body></html>`
    );
  } catch (e) {
    res.status(400).send(`<p>确认失败：${e.message}</p>`);
  }
});

router.post('/mock/confirm', authRequired, async (req, res) => {
  try {
    if (paymentConfig.mode !== 'test') return res.json(fail('仅测试模式可用'));
    const orderId = Number(req.body.orderId || req.body.order_id);
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.json(fail('订单不存在'));
    if (order.user_id !== req.user.id) return res.json(fail('无权操作'));
    if (order.status !== 0) return res.json(fail('订单状态不可支付'));
    await markOrderPaid(orderId, 'test');
    res.json(ok(null, '支付成功'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** 微信支付异步通知（application/json，需原始报文验签） */
router.post(
  '/notify/wechat',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req, res) => {
    try {
      // 用原始报文做签名校验；解析后的对象用于读取 resource
      req.rawBody = req.body && Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (req.rawBody || '');
      const result = await PaymentService.handleNotify('wechat', req);
      if (result && result.success) res.json({ code: 'SUCCESS', message: '成功' });
      else res.status(400).json({ code: 'FAIL', message: (result && result.code) || '失败' });
    } catch (e) {
      res.status(500).json({ code: 'FAIL', message: e.message });
    }
  }
);

/** 支付宝异步通知（application/x-www-form-urlencoded） */
router.post('/notify/alipay', async (req, res) => {
  try {
    const result = await PaymentService.handleNotify('alipay', req);
    res.send(result && result.success ? 'success' : 'failure');
  } catch (e) {
    res.send('failure');
  }
});

/** 支付宝同步回跳（用户支付完成后浏览器跳转回来） */
router.get('/return/alipay', async (req, res) => {
  const outTradeNo = req.query.out_trade_no;
  let orderId = null;
  if (outTradeNo) {
    const row = await queryOne('SELECT id FROM orders WHERE pay_no = ?', [outTradeNo]);
    orderId = row ? row.id : null;
  }
  res.redirect(orderId ? `/order/${orderId}` : '/orders');
});

module.exports = router;
