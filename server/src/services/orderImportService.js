/**
 * 订单 Excel 导入服务
 * ------------------------------------------------------------
 * 支持列（中文表头，亦兼容常见英文名）：
 *   票品来源 | 二手票ID | 演出ID | 演出名称 | 票档名称 | 买方姓名 | 手机号 | 数量 | 单价 | 订单状态 | 备注 | 下单时间
 * 规则：
 *   - 票品来源：官方 / 二手，缺省「官方」
 *   - 二手票订单：填「二手票ID」自动关联票品、卖家、演出、票价；也可配合「演出ID」做一致性校验
 *   - 官方票订单：优先「演出ID」；否则按「演出名称」精确匹配，再退化为模糊匹配
 *   - 单价未填：二手票取挂单价；官方票取该票档价格；仍未取到则取演出最低价
 *   - 订单号：随机生成（不连号）
 *   - 导入订单不扣减库存（视为历史/外部订单），状态默认「已支付」
 * 返回：{ total, success, failed: [{ row, reason }] }
 */
const XLSX = require('xlsx');
const { queryOne, exec } = require('../db');
const { uniqueOrderNo } = require('./orderNoService');
const { money } = require('../utils/helpers');

/** 表头别名映射（去空格后匹配） */
const FIELD_MAP = {
  演出id: 'showId',
  showid: 'showId',
  演出编号: 'showId',
  演出名称: 'showName',
  演出: 'showName',
  showname: 'showName',
  票档名称: 'tierName',
  票档: 'tierName',
  tiername: 'tierName',
  买方姓名: 'buyerName',
  买家姓名: 'buyerName',
  姓名: 'buyerName',
  客户姓名: 'buyerName',
  buyername: 'buyerName',
  手机号: 'phone',
  电话: 'phone',
  联系电话: 'phone',
  phone: 'phone',
  数量: 'quantity',
  张数: 'quantity',
  quantity: 'quantity',
  单价: 'price',
  成交价: 'price',
  price: 'price',
  订单状态: 'statusText',
  状态: 'statusText',
  status: 'statusText',
  备注: 'remark',
  remark: 'remark',
  下单时间: 'createdAt',
  下单日期: 'createdAt',
  createdat: 'createdAt',
  // 二手票相关
  票品来源: 'sourceType',
  来源: 'sourceType',
  sourcetype: 'sourceType',
  source: 'sourceType',
  二手票id: 'ticketId',
  票品id: 'ticketId',
  二手票编号: 'ticketId',
  ticketid: 'ticketId',
  'ticket_id': 'ticketId',
};

const SOURCE_MAP = { 官方: 'official', official: 'official', 二手: 'resale', resale: 'resale', 二手票: 'resale' };

const STATUS_MAP = { 待支付: 0, 已支付: 1, 已取消: 2, 已完成: 3, 已退款: 4 };

/** 归一化一行数据：{ showId, showName, ... } */
function normalizeRow(raw) {
  const row = {};
  for (const [key, val] of Object.entries(raw || {})) {
    const field = FIELD_MAP[String(key).trim().toLowerCase()];
    if (field) row[field] = typeof val === 'string' ? val.trim() : val;
  }
  return row;
}

/** 按 ID / 名称匹配演出 */
async function matchShow(row) {
  if (row.showId && Number(row.showId)) {
    return await queryOne('SELECT id, title, min_price FROM shows WHERE id = ?', [Number(row.showId)]);
  }
  if (row.showName) {
    return (
      (await queryOne('SELECT id, title, min_price FROM shows WHERE title = ? LIMIT 1', [row.showName])) ||
      (await queryOne('SELECT id, title, min_price FROM shows WHERE title LIKE ? LIMIT 1', [`%${row.showName}%`]))
    );
  }
  return null;
}

/** 解析时间：兼容 Excel 序列号 / 字符串 */
function parseDate(v) {
  if (!v) return null;
  if (typeof v === 'number') {
    // Excel 日期序列号（1900 基准）
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(v).replace(/-/g, '/'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 执行导入
 * @param {Buffer} buffer xlsx/xls/csv 文件二进制
 */
async function importOrders(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('表格为空');
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const result = { total: rawRows.length, success: 0, failed: [] };

  for (let i = 0; i < rawRows.length; i++) {
    const lineNo = i + 2; // 含表头，Excel 行号
    try {
      const row = normalizeRow(rawRows[i]);
      if (!row.buyerName) throw new Error('缺少买方姓名');
      if (!row.phone) throw new Error('缺少手机号');

      // ---------- 票品来源 ----------
      let source = 'official';
      if (row.sourceType) {
        source = SOURCE_MAP[String(row.sourceType).trim().toLowerCase()] || 'official';
      }

      let ticketId = null;
      let sellerId = 0;
      let showId = null;
      let tierId = null;
      let tierName = row.tierName || '导入票品';
      let price = Number(row.price || 0);

      if (row.ticketId && Number(row.ticketId)) {
        // ---------- 二手票订单：按二手票ID关联票品与卖家 ----------
        const t = await queryOne(
          'SELECT id, seller_id, show_id, tier_name, seat_info, sell_price, quantity FROM resale_tickets WHERE id = ?',
          [Number(row.ticketId)]
        );
        if (!t) throw new Error(`未找到二手票：${row.ticketId}`);
        if (row.showId && Number(row.showId) !== t.show_id) throw new Error(`二手票 ${t.id} 与填写的演出不一致`);

        source = 'resale';
        ticketId = t.id;
        sellerId = t.seller_id;
        showId = t.show_id;
        tierName = row.tierName || [t.tier_name, t.seat_info].filter(Boolean).join(' ') || '二手票';
        if (!price) price = Number(t.sell_price);
        if (t.quantity <= 0) throw new Error(`二手票 ${t.id} 已售罄`);
      } else {
        if (source === 'resale') throw new Error('票品来源为「二手」时，必须填写二手票ID');
        if (!row.showId && !row.showName) throw new Error('缺少演出ID或演出名称');

        const show = await matchShow(row);
        if (!show) throw new Error(`未找到演出：${row.showName || row.showId}`);
        showId = show.id;

        // 单价：Excel 指定 > 票档价 > 演出最低价
        if (row.tierName) {
          const tier = await queryOne('SELECT id, name, price FROM ticket_tiers WHERE show_id = ? AND name = ? LIMIT 1', [
            show.id,
            row.tierName,
          ]);
          if (tier) {
            tierId = tier.id;
            if (!price) price = Number(tier.price);
          }
        }
        if (!price) price = Number(show.min_price || 0);
      }

      if (price <= 0) throw new Error('无法确定单价，请在表格中填写「单价」');

      const qty = Math.max(1, Number(row.quantity || 1));
      const amount = money(price * qty);
      const status = STATUS_MAP[row.statusText] !== undefined ? STATUS_MAP[row.statusText] : 1;
      const createdAt = parseDate(row.createdAt);
      const now = new Date();
      const buyer = String(row.buyerName).slice(0, 50);

      await exec(
        `INSERT INTO orders (order_no, user_id, seller_id, source, show_id, ticket_id, tier_id, tier_name,
           unit_price, quantity, amount, buyer_name, contact_name, contact_phone, status, remark,
           paid_at, created_at, updated_at)
         VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          await uniqueOrderNo('PX'), // 订单号随机生成，不连号
          sellerId,                  // 二手票卖家（官方票为 0）
          source,                    // official 官方票 / resale 二手票
          showId,
          ticketId,                  // 二手票ID（官方票为 NULL）
          tierId,
          tierName,
          price,
          qty,
          amount,
          buyer,
          buyer,
          String(row.phone).slice(0, 30),
          status,
          row.remark ? String(row.remark).slice(0, 200) : 'Excel导入',
          status === 0 ? null : createdAt || now,
          createdAt || now,
          now,
        ]
      );
      result.success++;
    } catch (e) {
      result.failed.push({ row: lineNo, reason: e.message });
    }
  }

  return result;
}

/**
 * 生成导入模板（xlsx 二进制）
 * @param {Array} shows 演出 [{id,title}]，用于给示例行填充 ID
 * @param {Array} tickets 二手票 [{id,show_id,tier_name,title,sell_price}]，用于给示例行填充二手票ID
 */
function buildTemplate(shows = [], tickets = []) {
  const header = [
    '票品来源',
    '二手票ID',
    '演出ID',
    '演出名称',
    '票档名称',
    '买方姓名',
    '手机号',
    '数量',
    '单价',
    '订单状态',
    '备注',
    '下单时间',
  ];

  const rows = [];

  // ---- 官方票示例行 ----
  if (shows.length) {
    rows.push([
      '官方',
      '',
      shows[0].id,
      shows[0].title,
      '',
      '张三',
      '13900000001',
      2,
      '',
      '已支付',
      '官方票示例行',
      '2026-10-23 10:00:00',
    ]);
    if (shows[1]) {
      rows.push([
        '官方',
        '',
        shows[1].id,
        shows[1].title,
        '',
        '李四',
        '13900000002',
        1,
        '',
        '待支付',
        '',
        '',
      ]);
    }
  } else {
    rows.push(['官方', '', '', '', '', '张三', '13900000001', 2, '', '已支付', '官方票示例行', '2026-10-23 10:00:00']);
  }

  // ---- 二手票示例行 ----
  if (tickets.length) {
    const t = tickets[0];
    rows.push([
      '二手',
      t.id,
      t.show_id,
      t.title || '',
      t.tier_name || '',
      '王五',
      '13900000003',
      1,
      Number(t.sell_price || 0),
      '已支付',
      '二手票示例行',
      '2026-10-23 11:00:00',
    ]);
  } else {
    rows.push(['二手', '填写二手票ID', '', '', '', '王五', '13900000003', 1, '', '已支付', '二手票示例行', '2026-10-23 11:00:00']);
  }

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [
    { wch: 10 }, // 票品来源
    { wch: 10 }, // 二手票ID
    { wch: 8 },  // 演出ID
    { wch: 28 }, // 演出名称
    { wch: 14 }, // 票档名称
    { wch: 12 }, // 买方姓名
    { wch: 14 }, // 手机号
    { wch: 8 },  // 数量
    { wch: 10 }, // 单价
    { wch: 10 }, // 订单状态
    { wch: 20 }, // 备注
    { wch: 20 }, // 下单时间
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '订单导入');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { importOrders, buildTemplate };
