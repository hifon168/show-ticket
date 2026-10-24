/**
 * 验证：Excel 导入订单 / 买方姓名 / 随机订单号不连号
 * 运行：cd server && node src/scripts/testImport.js
 */
require('dotenv').config();
const XLSX = require('xlsx');
const http = require('http');
const { query } = require('../db');

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}`;

function req(method, path, body, token) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const r = http.request(
      `${BASE}${path}`,
      {
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let o = '';
        res.on('data', (c) => (o += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(o));
          } catch {
            resolve({ raw: o.slice(0, 200) });
          }
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

/** multipart/form-data 上传 */
function upload(path, filename, buffer, token) {
  const boundary = '----wb' + Date.now();
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, buffer, tail]);

  return new Promise((resolve, reject) => {
    const r = http.request(
      `${BASE}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let o = '';
        res.on('data', (c) => (o += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(o));
          } catch {
            resolve({ raw: o.slice(0, 300) });
          }
        });
      }
    );
    r.on('error', reject);
    r.write(body);
    r.end();
  });
}

(async () => {
  const admin = await req('POST', '/api/auth/admin-login', { phone: '13800000000', password: 'admin123' });
  const token = admin.data.token;

  // 1. 下载模板确认可用
  const tpl = await new Promise((resolve) => {
    http
      .get(`${BASE}/api/admin/orders/template`, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, size: Buffer.concat(chunks).length }));
      })
      .on('error', () => resolve({ status: 0, size: 0 }));
  });
  console.log(tpl.status === 200 && tpl.size > 3000 ? '✅' : '❌', `模板下载 → HTTP ${tpl.status}, ${tpl.size} bytes`);

  // 2. 构造导入文件（含 1 条故意失败：演出不存在）
  const shows = await query('SELECT id, title FROM shows ORDER BY id LIMIT 2');
  const rows = [
    ['演出ID', '演出名称', '票档名称', '买方姓名', '手机号', '数量', '单价', '订单状态', '备注', '下单时间'],
    [shows[0].id, shows[0].title, '', '张三', '13900000011', 2, 880, '已支付', '导入测试A', '2026-10-20 10:00:00'],
    [shows[1].id, shows[1].title, '', '李四', '13900000012', 1, '', '待支付', '导入测试B', '2026-10-21 11:00:00'],
    [999999, '不存在的演出', '', '王五', '13900000013', 1, 100, '已支付', '应失败', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '订单导入');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const imp = await upload('/api/admin/orders/import', 'orders.xlsx', buf, token);
  console.log(
    imp.code === 0 ? '✅' : '❌',
    `Excel 导入 → 成功 ${imp.data?.success}/${imp.data?.total}，失败 ${imp.data?.failed?.length}`
  );
  (imp.data?.failed || []).forEach((f) => console.log('     第' + f.row + '行：' + f.reason));

  // 3. 校验导入结果：买方姓名、来源、订单号
  const imported = await query(
    `SELECT order_no, buyer_name, contact_name, source, status, quantity, unit_price, amount
     FROM orders WHERE remark LIKE '导入测试%' ORDER BY id`
  );
  console.log(imported.length >= 2 ? '✅' : '❌', `导入订单落库 ${imported.length} 条`);
  imported.forEach((o) =>
    console.log(`     订单号 ${o.order_no} | 买方 ${o.buyer_name} | 来源 ${o.source} | 状态 ${o.status} | ${o.quantity}×${o.unit_price}=${o.amount}`)
  );

  // 4. 订单号随机性：连续生成 8 个，检查是否连号
  const { genOrderNo } = require('../utils/helpers');
  const samples = Array.from({ length: 8 }, () => genOrderNo('PX'));
  console.log('     随机订单号样本：', samples.join(' '));
  const numeric = samples.map((s) => parseInt(s.replace(/\D/g, ''), 10));
  let consecutive = 0;
  for (let i = 1; i < numeric.length; i++) if (Math.abs(numeric[i] - numeric[i - 1]) <= 2) consecutive++;
  console.log(consecutive === 0 ? '✅' : '❌', `订单号非连续（相邻差值 ≤2 的对数：${consecutive}）`);

  // 5. 清理测试数据
  await query("DELETE FROM orders WHERE remark LIKE '导入测试%'");
  console.log('✅ 测试数据已清理');
  process.exit(0);
})().catch((e) => {
  console.error('❌ 异常:', e.message);
  process.exit(1);
});
