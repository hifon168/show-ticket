/**
 * 统一支付服务入口。
 * - 根据 PAYMENT_MODE 与通道可用性选择网关（test / wechat / alipay）。
 * - createPayment(order, method)：生成预支付信息（二维码内容 / 跳转地址）。
 * - handleNotify(method, req)：验签 + 解密 + 落库（调用 orderPaid.markOrderPaid）。
 * - getMethods()：返回前端可用的支付方式列表。
 */
const config = require('./config');
const testGateway = require('./testGateway');
const wechatGateway = require('./wechatGateway');
const alipayGateway = require('./alipayGateway');
const { genOrderNo } = require('../../utils/helpers');
const { queryOne, exec } = require('../../db');
const { markOrderPaid } = require('../orderPaid');

function gatewayFor(method) {
  if (config.mode === 'real') {
    if (method === 'wechat' && config.wechat.enabled) return wechatGateway;
    if (method === 'alipay' && config.alipay.enabled) return alipayGateway;
    throw new Error('该支付方式未配置真实密钥，暂不可用');
  }
  return testGateway;
}

/**
 * 生成预支付信息。会先确保订单带有 out_trade_no（pay_no）并落库。
 */
async function createPayment(order, method) {
  const gw = gatewayFor(method);
  // 生成并保存商户订单号（幂等追踪）
  const outTradeNo = order.pay_no || `${genOrderNo('PAY')}${String(order.id).padStart(4, '0')}`;
  if (!order.pay_no) {
    await exec('UPDATE orders SET pay_no = ? WHERE id = ?', [outTradeNo, order.id]);
  }
  const fresh = await queryOne('SELECT * FROM orders WHERE id = ?', [order.id]);
  const info = await gw.createPayment(fresh, method, { baseUrl: config.baseUrl });
  return { ...info, outTradeNo, amount: fresh.amount };
}

/**
 * 处理支付渠道异步通知（或模拟回调）。
 */
async function handleNotify(method, req) {
  const gw = gatewayFor(method);
  const result = await gw.verifyNotify(req);
  if (!result || !result.success) return result;
  const orderId = result.orderId || (await resolveOrderId(result.outTradeNo));
  if (orderId) await markOrderPaid(orderId, method);
  return { ...result, orderId };
}

async function resolveOrderId(outTradeNo) {
  if (!outTradeNo) return null;
  const row = await queryOne('SELECT id FROM orders WHERE pay_no = ?', [outTradeNo]);
  return row ? row.id : null;
}

module.exports = {
  config,
  createPayment,
  handleNotify,
  getMethods: () => config.getMethods(),
  mode: config.mode,
};
