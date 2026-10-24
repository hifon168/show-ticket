const express = require('express');
const multer = require('multer');
const { query, queryOne, exec, transaction } = require('../db');
const { ok, fail, page } = require('../utils/response');
const { pager, genInviteCode } = require('../utils/helpers');
const { authRequired, adminRequired } = require('../middleware/auth');
const { syncShows, archiveExpiredShows } = require('../services/syncService');
const { generatePoster } = require('../services/posterService');
const { importOrders, buildTemplate } = require('../services/orderImportService');

const router = express.Router();

// Excel 上传：内存存储，限制 5MB，仅接受表格文件
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(xlsx|xls|csv)$/i.test(file.originalname)) return cb(null, true);
    cb(new Error('仅支持 .xlsx / .xls / .csv 文件'));
  },
});

// 后台所有接口都需要管理员权限
router.use(authRequired, adminRequired);

/** GET /api/admin/stats  后台首页统计 */
router.get('/stats', async (req, res) => {
  try {
    const [users, shows, orders, tickets, codes, pendingMsg, amount] = await Promise.all([
      queryOne('SELECT COUNT(1) AS c FROM users WHERE role = 0'),
      queryOne('SELECT COUNT(1) AS c FROM shows'),
      queryOne('SELECT COUNT(1) AS c FROM orders'),
      queryOne('SELECT COUNT(1) AS c FROM resale_tickets'),
      queryOne('SELECT COUNT(1) AS c FROM invite_codes WHERE status = 0'),
      queryOne('SELECT COUNT(1) AS c FROM user_messages WHERE status = 0'),
      queryOne('SELECT IFNULL(SUM(amount),0) AS c FROM orders WHERE status IN (1,3)'),
    ]);
    res.json(
      ok({
        users: users.c,
        shows: shows.c,
        orders: orders.c,
        tickets: tickets.c,
        unusedCodes: codes.c,
        pendingMessages: pendingMsg.c,
        gmv: amount.c,
      })
    );
  } catch (e) {
    res.json(fail(e.message));
  }
});

/* ============================ 演出管理 ============================ */

/** GET /api/admin/shows  演出列表（含已下架） */
router.get('/shows', async (req, res) => {
  try {
    const { keyword = '', category, status, city } = req.query;
    const { pageNum, pageSize, offset } = pager(req.query, 10);
    const where = ['1=1'];
    const params = [];
    if (keyword) {
      where.push('(title LIKE ? OR artist LIKE ? OR venue_name LIKE ?)');
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }
    if (category && category !== 'all') {
      where.push('category = ?');
      params.push(category);
    }
    if (status !== undefined && status !== '' && status !== 'all') {
      where.push('status = ?');
      params.push(Number(status));
    }
    if (city && city !== 'all') {
      where.push('city = ?');
      params.push(city);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const totalRow = await queryOne(`SELECT COUNT(1) AS total FROM shows ${whereSql}`, params);
    const list = await query(`SELECT * FROM shows ${whereSql} ORDER BY id DESC LIMIT ?, ?`, [...params, offset, pageSize]);
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/admin/shows/:id  演出详情（含票档） */
router.get('/shows/:id', async (req, res) => {
  try {
    const show = await queryOne('SELECT * FROM shows WHERE id = ?', [Number(req.params.id)]);
    if (!show) return res.json(fail('演出不存在'));
    const tiers = await query('SELECT * FROM ticket_tiers WHERE show_id = ? ORDER BY price ASC', [show.id]);
    res.json(ok({ ...show, tiers }));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** POST /api/admin/shows  新增演出（含票档） */
router.post('/shows', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title) return res.json(fail('演出名称不能为空'));
    const tiers = Array.isArray(b.tiers) ? b.tiers : [];
    const minPrice = tiers.length ? Math.min(...tiers.map((t) => Number(t.price || 0))) : Number(b.minPrice || 0);
    const maxPrice = tiers.length ? Math.max(...tiers.map((t) => Number(t.price || 0))) : Number(b.maxPrice || 0);

    const showId = await transaction(async (conn) => {
      const [r] = await conn.execute(
        `INSERT INTO shows (title, subtitle, category, poster, artist, venue_name, city, address,
           start_time, end_time, min_price, max_price, tags, description, status, source, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'admin', NOW(), NOW())`,
        [
          b.title,
          b.subtitle || '',
          b.category || 'concert',
          b.poster || '',
          b.artist || '',
          b.venue_name || b.venueName || '',
          b.city || '',
          b.address || '',
          b.start_time || b.startTime || null,
          b.end_time || b.endTime || null,
          minPrice,
          maxPrice,
          Array.isArray(b.tags) ? b.tags.join(',') : b.tags || '',
          b.description || '',
          b.status !== undefined ? Number(b.status) : 1,
        ]
      );
      const sid = r.insertId;
      for (const t of tiers) {
        await conn.execute(
          `INSERT INTO ticket_tiers (show_id, name, price, original_price, stock, description, status, created_at)
           VALUES (?,?,?,?,?,?,1,NOW())`,
          [sid, t.name, Number(t.price || 0), Number(t.original_price || t.price || 0), Number(t.stock || 0), t.description || '']
        );
      }
      return sid;
    });

    // 未填海报地址时自动生成一张
    if (!b.poster) {
      const url = generatePoster({ id: showId, ...b, start_time: b.start_time || b.startTime });
      if (url) await exec('UPDATE shows SET poster = ? WHERE id = ?', [url, showId]);
    }

    res.json(ok({ id: showId }, '新增成功'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** PUT /api/admin/shows/:id  编辑演出 */
router.put('/shows/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const show = await queryOne('SELECT * FROM shows WHERE id = ?', [id]);
    if (!show) return res.json(fail('演出不存在'));

    await exec(
      `UPDATE shows SET title = IFNULL(?, title), subtitle = IFNULL(?, subtitle), category = IFNULL(?, category),
        poster = IFNULL(?, poster), artist = IFNULL(?, artist), venue_name = IFNULL(?, venue_name),
        city = IFNULL(?, city), address = IFNULL(?, address), start_time = IFNULL(?, start_time),
        end_time = IFNULL(?, end_time), min_price = IFNULL(?, min_price), max_price = IFNULL(?, max_price),
        tags = IFNULL(?, tags), description = IFNULL(?, description), status = IFNULL(?, status),
        updated_at = NOW() WHERE id = ?`,
      [
        b.title,
        b.subtitle,
        b.category,
        b.poster,
        b.artist,
        b.venue_name || b.venueName,
        b.city,
        b.address,
        b.start_time || b.startTime,
        b.end_time || b.endTime,
        b.minPrice !== undefined ? Number(b.minPrice) : null,
        b.maxPrice !== undefined ? Number(b.maxPrice) : null,
        Array.isArray(b.tags) ? b.tags.join(',') : b.tags,
        b.description,
        b.status !== undefined ? Number(b.status) : null,
        id,
      ]
    );

    // 编辑后仍无海报 → 补一张
    const fresh = await queryOne('SELECT poster FROM shows WHERE id = ?', [id]);
    if (!fresh?.poster) {
      const url = generatePoster({ id, ...b, start_time: b.start_time || b.startTime });
      if (url) await exec('UPDATE shows SET poster = ? WHERE id = ?', [url, id]);
    }

    res.json(ok(null, '保存成功'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** DELETE /api/admin/shows/:id  删除演出 */
router.delete('/shows/:id', async (req, res) => {
  await exec('DELETE FROM shows WHERE id = ?', [Number(req.params.id)]);
  res.json(ok(null, '已删除'));
});

/** ---------- 票档管理 ---------- */
router.post('/tiers', async (req, res) => {
  const b = req.body || {};
  if (!b.show_id && !b.showId) return res.json(fail('缺少演出ID'));
  const r = await exec(
    `INSERT INTO ticket_tiers (show_id, name, price, original_price, stock, description, status, created_at)
     VALUES (?,?,?,?,?,?,1,NOW())`,
    [
      Number(b.show_id || b.showId),
      b.name,
      Number(b.price || 0),
      Number(b.original_price || b.price || 0),
      Number(b.stock || 0),
      b.description || '',
    ]
  );
  res.json(ok({ id: r.insertId }, '新增票档成功'));
});

router.put('/tiers/:id', async (req, res) => {
  const b = req.body || {};
  await exec(
    `UPDATE ticket_tiers SET name = IFNULL(?, name), price = IFNULL(?, price), original_price = IFNULL(?, original_price),
      stock = IFNULL(?, stock), description = IFNULL(?, description), status = IFNULL(?, status) WHERE id = ?`,
    [
      b.name,
      b.price !== undefined ? Number(b.price) : null,
      b.original_price !== undefined ? Number(b.original_price) : null,
      b.stock !== undefined ? Number(b.stock) : null,
      b.description,
      b.status !== undefined ? Number(b.status) : null,
      Number(req.params.id),
    ]
  );
  res.json(ok(null, '保存成功'));
});

router.delete('/tiers/:id', async (req, res) => {
  await exec('DELETE FROM ticket_tiers WHERE id = ?', [Number(req.params.id)]);
  res.json(ok(null, '已删除'));
});

/* ============================ 邀请码管理 ============================ */

/** GET /api/admin/invite-codes  邀请码列表 */
router.get('/invite-codes', async (req, res) => {
  try {
    const { status } = req.query;
    const { pageNum, pageSize, offset } = pager(req.query, 10);
    const where = status !== undefined && status !== '' && status !== 'all' ? 'WHERE ic.status = ?' : '';
    const params = where ? [Number(status)] : [];
    const totalRow = await queryOne(`SELECT COUNT(1) AS total FROM invite_codes ic ${where}`, params);
    const list = await query(
      `SELECT ic.*, u.nickname AS used_by_nickname, u.phone AS used_by_phone
       FROM invite_codes ic LEFT JOIN users u ON u.id = ic.used_by
       ${where} ORDER BY ic.id DESC LIMIT ?, ?`,
      [...params, offset, pageSize]
    );
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** POST /api/admin/invite-codes  批量生成邀请码 body: { count, days } */
router.post('/invite-codes', async (req, res) => {
  try {
    const count = Math.min(500, Math.max(1, Number((req.body || {}).count || 10)));
    const days = Number((req.body || {}).days || 0);
    const expiresAt = days > 0 ? new Date(Date.now() + days * 86400000) : null;

    const codes = [];
    for (let i = 0; i < count; i++) {
      let code = genInviteCode(8);
      // 避免重复
      // eslint-disable-next-line no-await-in-loop
      while (await queryOne('SELECT id FROM invite_codes WHERE code = ?', [code])) code = genInviteCode(8);
      codes.push(code);
    }
    await transaction(async (conn) => {
      for (const c of codes) {
        await conn.execute(
          'INSERT INTO invite_codes (code, status, created_by, expires_at, created_at) VALUES (?, 0, ?, ?, NOW())',
          [c, req.user.id, expiresAt]
        );
      }
    });
    res.json(ok({ codes }, `已生成 ${count} 个邀请码`));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** DELETE /api/admin/invite-codes/:id  删除邀请码 */
router.delete('/invite-codes/:id', async (req, res) => {
  await exec('DELETE FROM invite_codes WHERE id = ?', [Number(req.params.id)]);
  res.json(ok(null, '已删除'));
});

/* ============================ 用户管理 ============================ */

/** GET /api/admin/users  用户列表 */
router.get('/users', async (req, res) => {
  try {
    const { keyword = '' } = req.query;
    const { pageNum, pageSize, offset } = pager(req.query, 10);
    const where = keyword ? 'WHERE phone LIKE ? OR nickname LIKE ?' : '';
    const params = keyword ? [`%${keyword}%`, `%${keyword}%`] : [];
    const totalRow = await queryOne(`SELECT COUNT(1) AS total FROM users ${where}`, params);
    const list = await query(
      `SELECT id, phone, nickname, avatar, role, status, city, created_at,
              (SELECT COUNT(1) FROM orders o WHERE o.user_id = users.id) AS order_count
       FROM users ${where} ORDER BY id DESC LIMIT ?, ?`,
      [...params, offset, pageSize]
    );
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** PUT /api/admin/users/:id/status  启用/禁用用户 */
router.put('/users/:id/status', async (req, res) => {
  await exec('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [
    Number((req.body || {}).status),
    Number(req.params.id),
  ]);
  res.json(ok(null, '操作成功'));
});

/* ============================ 留言审核 ============================ */

/** GET /api/admin/messages  留言列表 */
router.get('/messages', async (req, res) => {
  try {
    const { status } = req.query;
    const { pageNum, pageSize, offset } = pager(req.query, 10);
    const where = status !== undefined && status !== '' && status !== 'all' ? 'WHERE m.status = ?' : '';
    const params = where ? [Number(status)] : [];
    const totalRow = await queryOne(`SELECT COUNT(1) AS total FROM user_messages m ${where}`, params);
    const list = await query(
      `SELECT m.*, u.phone FROM user_messages m LEFT JOIN users u ON u.id = m.user_id
       ${where} ORDER BY m.id DESC LIMIT ?, ?`,
      [...params, offset, pageSize]
    );
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** PUT /api/admin/messages/:id  审核留言 body: { status: 1通过 2拒绝, reply } */
router.put('/messages/:id', async (req, res) => {
  const { status, reply = '' } = req.body || {};
  await exec('UPDATE user_messages SET status = ?, reply = ?, audited_at = NOW() WHERE id = ?', [
    Number(status),
    reply,
    Number(req.params.id),
  ]);
  res.json(ok(null, '审核完成'));
});

router.delete('/messages/:id', async (req, res) => {
  await exec('DELETE FROM user_messages WHERE id = ?', [Number(req.params.id)]);
  res.json(ok(null, '已删除'));
});

/* ============================ 订单 / 二手票管理 ============================ */

router.get('/orders', async (req, res) => {
  try {
    const { status } = req.query;
    const { pageNum, pageSize, offset } = pager(req.query, 10);
    const where = status !== undefined && status !== '' && status !== 'all' ? 'WHERE o.status = ?' : '';
    const params = where ? [Number(status)] : [];
    const totalRow = await queryOne(`SELECT COUNT(1) AS total FROM orders o ${where}`, params);
    const list = await query(
      `SELECT o.*, s.title AS show_title, u.nickname AS buyer_nickname
       FROM orders o LEFT JOIN shows s ON s.id = o.show_id LEFT JOIN users u ON u.id = o.user_id
       ${where} ORDER BY o.id DESC LIMIT ?, ?`,
      [...params, offset, pageSize]
    );
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/admin/orders/template  下载订单导入模板 */
router.get('/orders/template', async (req, res) => {
  try {
    const shows = await query('SELECT id, title FROM shows ORDER BY id DESC LIMIT 2');
    // 取一条在售二手票，塞入模板作为「二手票」示例行
    const tickets = await query(
      `SELECT t.id, t.show_id, t.tier_name, t.sell_price, s.title
         FROM resale_tickets t LEFT JOIN shows s ON s.id = t.show_id
        WHERE t.status = 0 AND t.quantity > 0
        ORDER BY t.id DESC LIMIT 1`
    );
    const buf = buildTemplate(shows, tickets);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="order_import_template.xlsx"');
    res.send(buf);
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** POST /api/admin/orders/import  Excel 批量导入订单（form-data: file） */
router.post('/orders/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json(fail('请上传 Excel 文件'));
    const result = await importOrders(req.file.buffer);
    res.json(ok(result, `导入完成：成功 ${result.success} 条，失败 ${result.failed.length} 条`));
  } catch (e) {
    res.json(fail(e.message || '导入失败'));
  }
});

router.get('/tickets', async (req, res) => {
  try {
    const { pageNum, pageSize, offset } = pager(req.query, 10);
    const totalRow = await queryOne('SELECT COUNT(1) AS total FROM resale_tickets');
    const list = await query(
      `SELECT t.*, s.title AS show_title, u.nickname AS seller_nickname
       FROM resale_tickets t LEFT JOIN shows s ON s.id = t.show_id LEFT JOIN users u ON u.id = t.seller_id
       ORDER BY t.id DESC LIMIT ?, ?`,
      [offset, pageSize]
    );
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

router.post('/tickets/:id/status', async (req, res) => {
  await exec('UPDATE resale_tickets SET status = ?, updated_at = NOW() WHERE id = ?', [
    Number((req.body || {}).status),
    Number(req.params.id),
  ]);
  res.json(ok(null, '操作成功'));
});

router.delete('/tickets/:id', async (req, res) => {
  await exec('DELETE FROM resale_tickets WHERE id = ?', [Number(req.params.id)]);
  res.json(ok(null, '已删除'));
});

/* ============================ 轮播管理 ============================ */

router.get('/banners', async (req, res) => {
  res.json(ok(await query('SELECT * FROM banners ORDER BY sort ASC, id DESC')));
});

router.post('/banners', async (req, res) => {
  const b = req.body || {};
  const r = await exec(
    'INSERT INTO banners (title, image, show_id, link, sort, status, created_at) VALUES (?,?,?,?,?,1,NOW())',
    [b.title || '', b.image || '', b.show_id || null, b.link || '', Number(b.sort || 0)]
  );
  res.json(ok({ id: r.insertId }, '新增成功'));
});

router.put('/banners/:id', async (req, res) => {
  const b = req.body || {};
  await exec(
    `UPDATE banners SET title = IFNULL(?, title), image = IFNULL(?, image), show_id = IFNULL(?, show_id),
      link = IFNULL(?, link), sort = IFNULL(?, sort), status = IFNULL(?, status) WHERE id = ?`,
    [b.title, b.image, b.show_id, b.link, b.sort, b.status, Number(req.params.id)]
  );
  res.json(ok(null, '保存成功'));
});

router.delete('/banners/:id', async (req, res) => {
  await exec('DELETE FROM banners WHERE id = ?', [Number(req.params.id)]);
  res.json(ok(null, '已删除'));
});

/* ============================ 演出资讯同步 ============================ */

/** GET /api/admin/sync-logs  同步日志 */
router.get('/sync-logs', async (req, res) => {
  const { pageNum, pageSize, offset } = pager(req.query, 10);
  const totalRow = await queryOne('SELECT COUNT(1) AS total FROM sync_logs');
  const list = await query('SELECT * FROM sync_logs ORDER BY id DESC LIMIT ?, ?', [offset, pageSize]);
  res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
});

/* 同步任务运行状态（单实例内存态，够后台页面轮询用） */
const syncState = {
  running: false,
  startedAt: null,
  finishedAt: null,
  progress: [],
  lastResult: null,
  lastError: '',
};

/** GET /api/admin/sync-status  查看当前同步进度 */
router.get('/sync-status', (req, res) => {
  res.json(ok({ ...syncState, running: syncState.running }));
});

/** POST /api/admin/sync  手动触发一次同步（异步执行，立即返回） */
router.post('/sync', async (req, res) => {
  if (syncState.running) return res.json(fail('同步任务正在执行中，请稍后再试'));

  syncState.running = true;
  syncState.startedAt = new Date();
  syncState.finishedAt = null;
  syncState.progress = [];
  syncState.lastError = '';

  // 后台执行，避免数据量较大时接口超时
  (async () => {
    try {
      const result = await syncShows({
        onProgress: (m) => {
          syncState.progress.push({ t: new Date(), m });
          if (syncState.progress.length > 200) syncState.progress.shift();
          console.log(`[SYNC] ${m}`);
        },
      });
      const archived = await archiveExpiredShows();
      syncState.lastResult = { ...result, archived };
      console.log(`[SYNC] 后台同步完成，自动下架过期演出 ${archived} 条`);
    } catch (e) {
      syncState.lastError = e.message;
      console.error('[SYNC] 后台同步失败:', e.message);
    } finally {
      syncState.finishedAt = new Date();
      syncState.running = false;
    }
  })();

  res.json(ok({ started: true }, '同步任务已启动，可在同步日志查看进度'));
});

module.exports = router;
