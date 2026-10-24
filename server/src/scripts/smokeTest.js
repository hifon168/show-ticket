/**
 * 端到端冒烟测试：注册(邀请码) → 登录 → 演出详情 → 官方下单 → 支付
 * → 挂二手票 → 二手下单 → 私聊 → 收藏/足迹 → 管理员登录 → 后台接口
 * 运行：cd server && node src/scripts/smokeTest.js
 */
require('dotenv').config();
const http = require('http');

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}`;

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      `${BASE}${path}`,
      { method, headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(out));
          } catch {
            reject(new Error(`非JSON响应 ${method} ${path}: ${out.slice(0, 200)}`));
          }
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' → ' + extra : ''}`);
}

(async () => {
  const phone = `139${Date.now().toString().slice(-8)}`;
  const sellerPhone = `138${Date.now().toString().slice(-8)}`;

  // 0. 管理员登录并现场生成邀请码（保证脚本可重复执行）
  const admin0 = await req('POST', '/api/auth/admin-login', { phone: '13800000000', password: 'admin123' });
  const codeRes = await req('POST', '/api/admin/invite-codes', { count: 3, days: 30 }, admin0.data?.token);
  const [CODE1, CODE2, CODE3] = codeRes.data?.codes || [];
  check('管理员生成邀请码', codeRes.code === 0, [CODE1, CODE2, CODE3].join(','));

  // 1. 邀请码校验
  const chk = await req('POST', '/api/auth/check-invite', { inviteCode: CODE1 });
  check('校验邀请码可用', chk.code === 0);
  const bad = await req('POST', '/api/auth/check-invite', { inviteCode: 'NOTEXIST' });
  check('无效邀请码被拒绝', bad.code !== 0);

  // 2. 注册（必须邀请码）
  const noCode = await req('POST', '/api/auth/register', { phone: '13700000001', password: '123456' });
  check('无邀请码注册被拦截', noCode.code !== 0 && /邀请码/.test(noCode.message || ''), noCode.message);

  const reg = await req('POST', '/api/auth/register', { phone, password: '123456', nickname: '冒烟用户', inviteCode: CODE1 });
  check('带邀请码注册成功', reg.code === 0, reg.message);
  const token = reg.data?.token;

  // 邀请码已核销，不能二次使用
  const reuse = await req('POST', '/api/auth/register', { phone: '13700000002', password: '123456', inviteCode: CODE1 });
  check('同一邀请码不可重复使用', reuse.code !== 0);

  // 3. 登录 + 用户信息
  const login = await req('POST', '/api/auth/login', { phone, password: '123456' });
  check('登录成功', login.code === 0);
  const me = await req('GET', '/api/auth/me', null, token);
  check('获取当前用户', me.code === 0 && me.data.phone === phone);

  // 4. 演出详情 + 票档 + 收藏 + 浏览记录
  const detail = await req('GET', '/api/shows/1', null, token);
  check('演出详情含票档', detail.code === 0 && detail.data.tiers.length > 0, `${detail.data.tiers?.length} 个票档`);
  const fav = await req('POST', '/api/shows/1/favorite', null, token);
  check('收藏演出', fav.code === 0 && fav.data.favorited === true);
  const favList = await req('GET', '/api/user/favorites', null, token);
  check('收藏列表', favList.code === 0 && favList.data.list.length > 0);
  const hist = await req('GET', '/api/user/history', null, token);
  check('浏览记录已生成', hist.code === 0 && hist.data.list.length > 0);

  // 5. 官方票下单 + 支付
  const tier = detail.data.tiers[0];
  const order = await req('POST', '/api/orders', { showId: 1, tierId: tier.id, quantity: 2, contactName: '张三', contactPhone: '13900000001' }, token);
  check('官方票下单成功', order.code === 0, order.message);
  const orderId = order.data?.id;

  const pay = await req('POST', `/api/orders/${orderId}/pay`, { payMethod: 'wechat' }, token);
  check('支付成功', pay.code === 0 && pay.data.status === 1);
  const orderDetail = await req('GET', `/api/orders/${orderId}`, null, token);
  check('订单状态=已支付', orderDetail.code === 0 && orderDetail.data.status === 1);

  // 6. 二手挂票 + 集市 + 二手下单
  const sell = await req('POST', '/api/tickets', {
    showId: 1, tierName: '内场A区', seatInfo: '3排12号', originalPrice: 1580, sellPrice: 999, quantity: 2,
    description: '临时有事去不了，可小刀', contactPhone: '13900000002',
  }, token);
  check('卖家挂票成功', sell.code === 0, sell.message);
  const ticketId = sell.data?.id;

  const market = await req('GET', '/api/tickets?sort=price_asc');
  check('二手集市有数据', market.code === 0 && market.data.list.length > 0, `${market.data.total} 条`);

  // 第二个用户买二手票
  const reg2 = await req('POST', '/api/auth/register', { phone: sellerPhone, password: '123456', nickname: '买家', inviteCode: CODE3 });
  const token2 = reg2.data?.token;
  const order2 = await req('POST', '/api/orders', { ticketId, quantity: 1, contactName: '李四', contactPhone: '13900000003' }, token2);
  check('二手票下单成功', order2.code === 0, order2.message);
  const pay2 = await req('POST', `/api/orders/${order2.data?.id}/pay`, { payMethod: 'alipay' }, token2);
  check('二手票支付成功', pay2.code === 0);

  const sold = await req('GET', '/api/orders/sold', null, token);
  check('卖家可见卖出订单', sold.code === 0 && sold.data.list.length > 0);

  // 7. 私聊
  const conv = await req('POST', '/api/chat/start', { ticketId }, token2);
  check('发起私聊会话', conv.code === 0);
  await req('POST', `/api/chat/${conv.data?.id}/send`, { content: '票还在吗？可以便宜点吗' }, token2);
  const msgs = await req('GET', `/api/chat/${conv.data?.id}/messages`, null, token);
  check('私聊消息收发正常', msgs.code === 0 && msgs.data.length > 0);

  // 8. 留言
  const msg = await req('POST', '/api/user/messages', { content: '希望增加更多演出场次', contact: '13900000001' }, token);
  check('提交留言成功', msg.code === 0);

  // 9. 管理员 + 后台
  const admin = await req('POST', '/api/auth/admin-login', { phone: '13800000000', password: 'admin123' });
  check('管理员登录', admin.code === 0);
  const atoken = admin.data?.token;

  const stats = await req('GET', '/api/admin/stats', null, atoken);
  check('后台统计', stats.code === 0, `用户${stats.data?.users} 演出${stats.data?.shows} 订单${stats.data?.orders}`);

  const codes = await req('POST', '/api/admin/invite-codes', { count: 3, days: 30 }, atoken);
  check('后台批量生成邀请码', codes.code === 0 && codes.data.codes.length === 3, codes.data?.codes?.join(','));

  const users = await req('GET', '/api/admin/users', null, atoken);
  check('后台用户列表', users.code === 0 && users.data.total >= 3, `${users.data?.total} 个用户`);

  const pending = await req('GET', '/api/admin/messages?status=0', null, atoken);
  const firstMsg = pending.data?.list?.[0];
  if (firstMsg) {
    const audit = await req('PUT', `/api/admin/messages/${firstMsg.id}`, { status: 1, reply: '感谢反馈' }, atoken);
    check('后台审核留言', audit.code === 0);
  }

  const newShow = await req('POST', '/api/admin/shows', {
    title: '冒烟测试演出', category: 'concert', artist: '测试艺人', city: '北京',
    venue_name: '测试场馆', start_time: '2026-12-01 19:30:00', status: 1,
    tiers: [{ name: '看台', price: 300, stock: 100 }],
  }, atoken);
  check('后台新增演出+票档', newShow.code === 0, newShow.message);

  // 10. 每日同步（手动触发）
  const sync = await req('POST', '/api/admin/sync', null, atoken);
  check('每日同步任务可执行', sync.code === 0, `新增${sync.data?.created} 更新${sync.data?.updated}`);

  // 11. 搜索
  const search = await req('GET', '/api/shows/search?keyword=' + encodeURIComponent('周杰伦'));
  check('搜索按艺人命中', search.code === 0 && search.data.total > 0, `${search.data?.total} 条`);

  // 12. 筛选
  const filtered = await req('GET', '/api/shows?category=concert&sort=time&pageSize=5');
  check('分类筛选', filtered.code === 0 && filtered.data.list.every((s) => s.category === 'concert'));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n📊 通过 ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log('失败项：', failed.map((f) => f.name).join(' | '));
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error('冒烟测试异常：', e.message);
  process.exit(1);
});
