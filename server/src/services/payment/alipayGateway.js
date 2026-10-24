/**
 * 支付宝 —— 手机网站支付（真实通道，PAYMENT_MODE=real 且已配置密钥时启用）。
 * 使用官方 alipay-sdk 处理签名与验签。
 *
 * 需要配置（.env）：
 *   ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY（应用私钥 PKCS#8）/ ALIPAY_PUBLIC_KEY（支付宝公钥）
 *   ALIPAY_NOTIFY_URL / ALIPAY_RETURN_URL
 */
const { AlipaySdk } = require('alipay-sdk');
const config = require('./config');

function getClient() {
  return new AlipaySdk({
    appId: config.alipay.appId,
    privateKey: config.alipay.privateKey,
    alipayPublicKey: config.alipay.publicKey,
    gateway: 'https://openapi.alipay.com/gateway.do',
    signType: 'RSA2',
  });
}

async function createPayment(order, method, ctx) {
  const client = getClient();
  const bizContent = {
    out_trade_no: order.pay_no,
    total_amount: Number(order.amount).toFixed(2),
    subject: `演出门票-${order.order_no}`.slice(0, 256),
    product_code: 'QUICK_WAP_WAY',
    quit_url: `${ctx.baseUrl}/order/${order.id}`,
  };
  // 手机网站支付：GET 方式返回可直接跳转的支付 URL
  const payUrl = await client.pageExecute(
    'alipay.trade.wap.pay',
    {
      notifyUrl: config.alipay.notifyUrl,
      returnUrl: config.alipay.returnUrl,
      bizContent,
    },
    { method: 'GET' }
  );
  return {
    method: 'alipay',
    mode: 'real',
    tradeNo: order.pay_no,
    codeUrl: payUrl,
    payUrl,
  };
}

/**
 * 处理支付宝异步通知（body 为 form-urlencoded 解析后的对象）
 * @returns {Promise<{success:boolean, outTradeNo?:string, code?:string}>}
 */
async function verifyNotify(req) {
  const params = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    const client = getClient();
    const ok = client.checkNotifySign(params);
    if (!ok) return { success: false, code: 'SIGN_INVALID' };
    const status = params.trade_status;
    if (status !== 'TRADE_SUCCESS' && status !== 'TRADE_FINISHED') {
      return { success: false, code: status || 'NOT_PAID' };
    }
    return { success: true, outTradeNo: params.out_trade_no };
  } catch (e) {
    console.error('[支付宝] 回调解密/验签失败', e.message);
    return { success: false, code: 'VERIFY_FAIL' };
  }
}

module.exports = { createPayment, verifyNotify };
