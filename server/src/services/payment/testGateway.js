/**
 * 本地测试支付网关（默认 PAYMENT_MODE=test 时生效）。
 * 无需任何商户密钥：返回指向本服务的「模拟回调」地址，扫码/跳转后或点击「模拟支付」
 * 都会触发该地址，将订单置为已支付，完整演示真实支付流程。
 */
module.exports = {
  /** 是否测试网关 */
  isTest: true,

  /**
   * 生成预支付信息
   * @param {object} order 订单（含 id / pay_no / amount）
   * @param {string} method wechat | alipay
   * @param {object} ctx { baseUrl }
   * @returns {Promise<object>} { method, mode, tradeNo, codeUrl, payUrl }
   */
  async createPayment(order, method, ctx) {
    const confirmUrl = `${ctx.baseUrl}/api/pay/mock/confirm?orderId=${order.id}&tradeNo=${encodeURIComponent(order.pay_no || '')}`;
    return {
      method,
      mode: 'test',
      tradeNo: order.pay_no || '',
      codeUrl: confirmUrl, // 微信扫码内容（扫码后打开该页即视为支付成功）
      payUrl: confirmUrl, // 支付宝跳转地址
    };
  },

  /**
   * 测试网关不做异步验签（模拟回调路由直接落库），这里始终返回成功。
   */
  async verifyNotify() {
    return { success: true };
  },
};
