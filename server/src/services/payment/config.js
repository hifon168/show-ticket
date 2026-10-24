/**
 * 支付配置：统一从环境变量读取。
 *
 * PAYMENT_MODE:
 *   - 'test' 本地测试模式（默认）。无需任何商户密钥，模拟「扫码/跳转 → 回调 → 订单置为已支付」完整流程，用于本地演示。
 *   - 'real' 真实通道。需配置下方微信支付 V3 或支付宝的密钥；缺密钥的通道会自动从可用列表中剔除。
 *
 * 注意：真实商户密钥需你本人在「微信支付商户平台」与「支付宝开放平台」实名注册后获取，
 * 任何代理都无法代申请。拿到密钥后把 PAYMENT_MODE 改为 real 并填好对应项即可上线。
 */
require('dotenv').config();

const hasWx = !!(process.env.WX_APPID && process.env.WX_MCHID && process.env.WX_APIV3_KEY && process.env.WX_SERIAL_NO && process.env.WX_PRIVATE_KEY);
const hasAli = !!(process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY && process.env.ALIPAY_PUBLIC_KEY);

module.exports = {
  mode: String(process.env.PAYMENT_MODE || 'test').toLowerCase() === 'real' && (hasWx || hasAli) ? 'real' : 'test',
  baseUrl: (process.env.PAY_BASE_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, ''),

  // 微信支付 V3
  wechat: {
    appid: process.env.WX_APPID || '',
    mchid: process.env.WX_MCHID || '',
    apiV3Key: process.env.WX_APIV3_KEY || '',
    serialNo: process.env.WX_SERIAL_NO || '',
    privateKey: process.env.WX_PRIVATE_KEY || '',
    // 微信平台证书公钥（PEM 内容或文件路径），用于回调验签；缺失时跳过验签（仅解密）
    platformCert: process.env.WX_PLATFORM_CERT || '',
    notifyUrl: process.env.WX_NOTIFY_URL || '',
    enabled: hasWx,
  },

  // 支付宝
  alipay: {
    appId: process.env.ALIPAY_APP_ID || '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    publicKey: process.env.ALIPAY_PUBLIC_KEY || '',
    notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
    returnUrl: process.env.ALIPAY_RETURN_URL || '',
    enabled: hasAli,
  },

  /** 当前实际可用的支付方式（前端据此渲染） */
  getMethods() {
    const methods = [];
    if (this.mode === 'real') {
      if (this.wechat.enabled) methods.push({ value: 'wechat', label: '微信支付', icon: '💚', type: 'qr' });
      if (this.alipay.enabled) methods.push({ value: 'alipay', label: '支付宝', icon: '💙', type: 'redirect' });
    } else {
      // 测试模式：两条通道都可用，均走本地模拟网关
      methods.push({ value: 'wechat', label: '微信支付（测试）', icon: '💚', type: 'qr' });
      methods.push({ value: 'alipay', label: '支付宝（测试）', icon: '💙', type: 'redirect' });
    }
    return methods;
  },
};
