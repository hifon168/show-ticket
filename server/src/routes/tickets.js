const express = require('express');
const { query, queryOne, exec } = require('../db');
const { ok, fail, page } = require('../utils/response');
const { pager, money } = require('../utils/helpers');
const { authRequired, authOptional } = require('../middleware/auth');

const router = express.Router();

const LIST_SQL = `
  SELECT t.*, s.title AS show_title, s.poster, s.city, s.venue_name, s.start_time, s.artist, s.category,
         u.nickname AS seller_nickname, u.avatar AS seller_avatar
  FROM resale_tickets t
  LEFT JOIN shows s ON s.id = t.show_id
  LEFT JOIN users u ON u.id = t.seller_id
`;

/**
 * GET /api/tickets  二手票务集市列表
 * query: city, category, keyword, showId, sort(price_asc|price_desc|time|discount), onlyMine
 */
router.get('/', async (req, res) => {
  try {
    const { city, category, keyword, showId, sort = 'time' } = req.query;
    const { pageNum, pageSize, offset } = pager(req.query, 10);

    const where = ['t.status = 0', 't.quantity > 0'];
    const params = [];
    if (city && city !== 'all') {
      where.push('s.city = ?');
      params.push(city);
    }
    if (category && category !== 'all') {
      where.push('s.category = ?');
      params.push(category);
    }
    if (showId) {
      where.push('t.show_id = ?');
      params.push(Number(showId));
    }
    if (keyword) {
      where.push('(s.title LIKE ? OR s.artist LIKE ? OR s.venue_name LIKE ? OR t.seat_info LIKE ?)');
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw, kw);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const orderMap = {
      time: 't.created_at DESC',
      price_asc: 't.sell_price ASC',
      price_desc: 't.sell_price DESC',
      discount: '(t.sell_price / IFNULL(t.original_price, t.sell_price)) ASC',
    };

    const totalRow = await queryOne(`SELECT COUNT(1) AS total FROM resale_tickets t LEFT JOIN shows s ON s.id = t.show_id ${whereSql}`, params);
    const list = await query(
      `${LIST_SQL} ${whereSql} ORDER BY ${orderMap[sort] || orderMap.time} LIMIT ?, ?`,
      [...params, offset, pageSize]
    );
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/tickets/mine  我挂出的票 */
router.get('/mine', authRequired, async (req, res) => {
  try {
    const { pageNum, pageSize, offset } = pager(req.query, 10);
    const totalRow = await queryOne('SELECT COUNT(1) AS total FROM resale_tickets WHERE seller_id = ?', [req.user.id]);
    const list = await query(`${LIST_SQL} WHERE t.seller_id = ? ORDER BY t.created_at DESC LIMIT ?, ?`, [
      req.user.id,
      offset,
      pageSize,
    ]);
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/tickets/:id  二手票详情 */
router.get('/:id', authOptional, async (req, res) => {
  try {
    const row = await queryOne(`${LIST_SQL} WHERE t.id = ?`, [Number(req.params.id)]);
    if (!row) return res.json(fail('票品不存在'));
    await exec('UPDATE resale_tickets SET view_count = view_count + 1 WHERE id = ?', [row.id]).catch(() => {});
    res.json(ok({ ...row, isMine: !!req.user && req.user.id === row.seller_id }));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/**
 * POST /api/tickets  卖家挂票（发布售卖信息）
 * body: { showId, title, tierName, seatInfo, originalPrice, sellPrice, quantity, description, images, contactPhone }
 */
router.post('/', authRequired, async (req, res) => {
  try {
    const b = req.body || {};
    const showId = Number(b.showId);
    if (!showId) return res.json(fail('请选择关联演出'));
    const show = await queryOne('SELECT * FROM shows WHERE id = ?', [showId]);
    if (!show) return res.json(fail('演出不存在'));

    const sellPrice = money(b.sellPrice);
    const originalPrice = money(b.originalPrice || show.min_price || sellPrice);
    const quantity = Math.max(1, Number(b.quantity || 1));
    if (sellPrice <= 0) return res.json(fail('请填写正确的售价'));

    const result = await exec(
      `INSERT INTO resale_tickets (seller_id, show_id, title, tier_name, seat_info, original_price, sell_price,
        quantity, sold_count, description, images, contact_phone, status, view_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, 0, NOW(), NOW())`,
      [
        req.user.id,
        showId,
        b.title || show.title,
        b.tierName || '',
        b.seatInfo || '',
        originalPrice,
        sellPrice,
        quantity,
        b.description || '',
        Array.isArray(b.images) ? JSON.stringify(b.images) : b.images || '[]',
        b.contactPhone || req.user.phone || '',
      ]
    );
    res.json(ok({ id: result.insertId }, '发布成功，等待买家咨询'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** PUT /api/tickets/:id  编辑挂票信息 */
router.put('/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const t = await queryOne('SELECT * FROM resale_tickets WHERE id = ?', [id]);
    if (!t) return res.json(fail('票品不存在'));
    if (t.seller_id !== req.user.id && req.user.role !== 1) return res.json(fail('无权修改'));

    const b = req.body || {};
    await exec(
      `UPDATE resale_tickets SET title = IFNULL(?, title), tier_name = IFNULL(?, tier_name),
        seat_info = IFNULL(?, seat_info), original_price = IFNULL(?, original_price), sell_price = IFNULL(?, sell_price),
        quantity = IFNULL(?, quantity), description = IFNULL(?, description), contact_phone = IFNULL(?, contact_phone),
        updated_at = NOW() WHERE id = ?`,
      [
        b.title,
        b.tierName,
        b.seatInfo,
        b.originalPrice !== undefined ? money(b.originalPrice) : null,
        b.sellPrice !== undefined ? money(b.sellPrice) : null,
        b.quantity !== undefined ? Number(b.quantity) : null,
        b.description,
        b.contactPhone,
        id,
      ]
    );
    res.json(ok(null, '保存成功'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** POST /api/tickets/:id/status  上架/下架 status: 0 在售 1 已售出 2 已下架 */
router.post('/:id/status', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    const t = await queryOne('SELECT * FROM resale_tickets WHERE id = ?', [id]);
    if (!t) return res.json(fail('票品不存在'));
    if (t.seller_id !== req.user.id && req.user.role !== 1) return res.json(fail('无权操作'));
    await exec('UPDATE resale_tickets SET status = ?, updated_at = NOW() WHERE id = ?', [Number(status), id]);
    res.json(ok(null, Number(status) === 0 ? '已上架' : '已下架'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** DELETE /api/tickets/:id  删除挂票 */
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const t = await queryOne('SELECT * FROM resale_tickets WHERE id = ?', [id]);
    if (!t) return res.json(fail('票品不存在'));
    if (t.seller_id !== req.user.id && req.user.role !== 1) return res.json(fail('无权操作'));
    await exec('DELETE FROM resale_tickets WHERE id = ?', [id]);
    res.json(ok(null, '已删除'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

module.exports = router;
