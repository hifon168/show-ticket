/**
 * 订单号生成：随机、不可推测、不连号
 * 冲突时重新随机（orders.order_no 有唯一索引兜底）
 */
const { queryOne } = require('../db');
const { genOrderNo, randomStr } = require('../utils/helpers');

async function uniqueOrderNo(prefix = 'PX') {
  for (let i = 0; i < 6; i++) {
    const no = genOrderNo(prefix);
    // eslint-disable-next-line no-await-in-loop
    const dup = await queryOne('SELECT id FROM orders WHERE order_no = ?', [no]);
    if (!dup) return no;
  }
  return genOrderNo(prefix) + randomStr(3);
}

module.exports = { uniqueOrderNo };
