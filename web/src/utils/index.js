/** 通用工具函数 */

/** 金额格式化：¥380 起 */
export function formatPrice(min, max) {
  const a = Number(min || 0);
  const b = Number(max || 0);
  if (a && b && a !== b) return `¥${fmtNum(a)} - ${fmtNum(b)}`;
  return `¥${fmtNum(a || b)}`;
}

export function fmtNum(n) {
  const v = Number(n || 0);
  return v.toFixed(2).replace(/\.00$/, '');
}

/**
 * 将任意时间输入规范化为可被 JS Date 解析的本地时间字符串。
 * - 已经是 'YYYY-MM-DD HH:mm:ss' 形式：直接按本地（北京时间）解析，保留原有时分。
 * - 带 T 的 ISO 字符串：去掉 T 与尾部的 Z/毫秒，按北京时间原样展示，避免出现 "T"。
 */
function toLocalInput(d) {
  if (typeof d !== 'string') return d;
  let s = d.trim();
  if (s.includes('T')) {
    // 2026-12-10T11:00:00.000Z -> 2026-12-10 11:00:00
    s = s.replace('T', ' ').replace(/\.\d+$/, '').replace(/Z$/, '');
  }
  return s.replace(/-/g, '/');
}

/** 日期格式化：2026-11-20 19:30（北京时间） */
export function formatDate(d, withTime = true) {
  if (!d) return '';
  const date = new Date(toLocalInput(d));
  if (Number.isNaN(date.getTime())) {
    return String(d).replace('T', ' ').replace(/Z$/, '').replace(/\.\d+$/, '').slice(0, 16);
  }
  const p = (n) => String(n).padStart(2, '0');
  const ymd = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  return withTime ? `${ymd} ${p(date.getHours())}:${p(date.getMinutes())}` : ymd;
}

/** 相对时间：刚刚 / 3分钟前 / 2天前 */
export function fromNow(d) {
  if (!d) return '';
  const t = new Date(toLocalInput(d)).getTime();
  const diff = Date.now() - t;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 2592000000) return `${Math.floor(diff / 86400000)} 天前`;
  return formatDate(d, false);
}

/** 演出分类中文名 */
export const CATEGORY_TEXT = {
  concert: '演唱会',
  drama: '话剧',
  talk: '脱口秀',
  festival: '音乐节',
  sports: '体育赛事',
  other: '其他',
};

/** 订单状态 */
export const ORDER_STATUS_TEXT = {
  0: '待支付',
  1: '已支付',
  2: '已取消',
  3: '已完成',
  4: '已退款',
};

/** 二手票状态 */
export const TICKET_STATUS_TEXT = { 0: '在售', 1: '已售出', 2: '已下架' };

/** 手机号脱敏 */
export function maskPhone(p) {
  return String(p || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}
