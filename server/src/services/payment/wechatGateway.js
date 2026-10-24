/**
 * 微信支付 V3 —— Native 扫码支付（真实通道，PAYMENT_MODE=real 且已配置密钥时启用）。
 * 使用 Node 内置 crypto / https 自包含实现，避免对第三方签名封装的强依赖。
 *
 * 需要配置（.env）：
 *   WX_APPID / WX_MCHID / WX_APIV3_KEY / WX_SERIAL_NO / WX_PRIVATE_KEY（PKCS#8 私钥内容或 PEM 文件路径）
 *   WX_PLATFORM_CERT（可选，平台证书公钥 PEM，用于回调验签；缺失时仅做解密、跳过验签并告警）
 *   WX_NOTIFY_URL
 */
const crypto = require('crypto');
const https = require('https');
const config = require('./config');

const GATEWAY = 'https://api.mch.weixin.qq.com';

function privateKey() {
  const k = config.wechat.privateKey;
  if (!k) return '';
  if (k.includes('BEGIN PRIVATE KEY') || k.includes('BEGIN RSA PRIVATE KEY')) return k;
  try {
    const fs = require('fs');
    return fs.readFileSync(k, 'utf8');
  } catch {
    return k;
  }
}

function platformCert() {
  const c = config.wechat.platformCert;
  if (!c) return null;
  if (c.includes('BEGIN CERTIFICATE')) return c;
  try {
    const fs = require('fs');
    return fs.readFileSync(c, 'utf8');
  } catch {
    return c;
  }
}

function buildAuthorization(method, urlPath, bodyStr) {
  const mchid = config.wechat.mchid;
  const serialNo = config.wechat.serialNo;
  const key = privateKey();
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${bodyStr}\n`;
  const signature = crypto.createSign('RSA-SHA256').update(message).sign(key, 'base64');
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${serialNo}"`;
}

function httpsPost(path, bodyObj) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(bodyObj);
    const authorization = buildAuthorization('POST', path, bodyStr);
    const data = Buffer.from(bodyStr);
    const req = https.request(
      `${GATEWAY}${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'show-ticket/1.0',
          'Content-Length': data.length,
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            const json = buf ? JSON.parse(buf) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
            else reject(new Error(`微信支付错误 ${res.statusCode}: ${json.message || buf}`));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function createPayment(order, method, ctx) {
  const totalFee = Math.round(Number(order.amount) * 100); // 元 → 分
  const description = `演出门票-${order.order_no}`.slice(0, 126);
  const expire = new Date(Date.now() + 15 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '+08:00');
  const body = {
    appid: config.wechat.appid,
    mchid: config.wechat.mchid,
    description,
    out_trade_no: order.pay_no,
    notify_url: config.wechat.notifyUrl,
    time_expire: expire,
    amount: { total: totalFee, currency: 'CNY' },
  };
  const resp = await httpsPost('/v3/pay/transactions/native', body);
  if (!resp.code_url) throw new Error('微信支付未返回 code_url');
  return {
    method: 'wechat',
    mode: 'real',
    tradeNo: order.pay_no,
    codeUrl: resp.code_url,
    payUrl: resp.code_url,
  };
}

/** 解密回调中的 resource（AES-256-GCM，密钥为 APIv3 Key） */
function decryptResource(resource) {
  const key = Buffer.from(config.wechat.apiV3Key, 'utf8');
  const nonce = Buffer.from(resource.nonce, 'utf8');
  const aad = Buffer.from(resource.associated_data || '', 'utf8');
  const ciphertext = Buffer.from(resource.ciphertext, 'base64');
  const tag = ciphertext.slice(ciphertext.length - 16);
  const data = ciphertext.slice(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

/** 验证微信回调签名（需要平台证书），返回 boolean */
function verifySignature(timestamp, nonce, bodyStr, signature) {
  const cert = platformCert();
  if (!cert) {
    console.warn('[微信支付] 未配置 WX_PLATFORM_CERT，跳过回调验签（仅做解密）。生产环境务必配置以校验来源。');
    return true;
  }
  try {
    const ok = crypto
      .createVerify('RSA-SHA256')
      .update(`${timestamp}\n${nonce}\n${bodyStr}\n`)
      .verify(cert, signature, 'base64');
    return ok;
  } catch (e) {
    console.error('[微信支付] 回调验签失败', e.message);
    return false;
  }
}

/**
 * 处理微信异步通知
 * @param {object} req express 请求（含 headers 与 raw body）
 */
async function verifyNotify(req) {
  const timestamp = req.headers['wechatpay-timestamp'];
  const nonce = req.headers['wechatpay-nonce'];
  const signature = req.headers['wechatpay-signature'];
  const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  if (!verifySignature(timestamp, nonce, bodyStr, signature)) {
    return { success: false, code: 'SIGN_INVALID' };
  }
  try {
    const resource = typeof req.body === 'string' ? JSON.parse(req.body).resource : req.body.resource;
    const decrypted = decryptResource(resource);
    // trade_state: SUCCESS 才视为支付成功
    if (decrypted.trade_state !== 'SUCCESS') {
      return { success: false, code: decrypted.trade_state || 'NOT_PAID' };
    }
    return { success: true, outTradeNo: decrypted.out_trade_no, transactionId: decrypted.transaction_id };
  } catch (e) {
    console.error('[微信支付] 回调解密失败', e.message);
    return { success: false, code: 'DECRYPT_FAIL' };
  }
}

module.exports = { createPayment, verifyNotify };
