const crypto = require('crypto');

/** 无歧义字符集（去掉 I/O/0/1 等易混字符中的 0、1，保留可读字母数字） */
const NO_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomStr(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += NO_CHARS[crypto.randomInt(0, NO_CHARS.length)];
  return s;
}

/**
 * 生成订单号：纯随机、不可推测、不连号
 * 结构：前缀(2) + 随机串(12)，如 PXR4M7QK9WZX3HNB
 * 说明：不使用自增序列，也不嵌入时间戳，避免被遍历/推测订单量；
 *      32 字符集 ^ 12 ≈ 3.7e17 种组合，唯一性由 order_no 唯一索引 + 重试兜底。
 */
function genOrderNo(prefix = 'PX') {
  return `${prefix}${randomStr(12)}`;
}

/** 生成邀请码（大写字母+数字，默认 8 位） */
function genInviteCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < len; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

/** 手机号简单校验（中国大陆） */
function isPhone(phone) {
  return /^1[3-9]\d{9}$/.test(String(phone || ''));
}

/** 安全取整：金额统一保留 2 位小数 */
function money(val) {
  return Math.round(Number(val || 0) * 100) / 100;
}

/** 分页参数归一化 */
function pager(query, defaultSize = 10, maxSize = 50) {
  const pageNum = Math.max(1, Number(query.pageNum || query.page || 1));
  const pageSize = Math.min(maxSize, Math.max(1, Number(query.pageSize || query.size || defaultSize)));
  return { pageNum, pageSize, offset: (pageNum - 1) * pageSize };
}

module.exports = { genOrderNo, genInviteCode, isPhone, money, pager, randomStr };
