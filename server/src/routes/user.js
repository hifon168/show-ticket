const express = require('express');
const { query, queryOne, exec } = require('../db');
const { ok, fail, page } = require('../utils/response');
const { pager } = require('../utils/helpers');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const SHOW_FIELDS = `s.id, s.title, s.subtitle, s.category, s.poster, s.artist, s.venue_name, s.city,
  s.start_time, s.end_time, s.min_price, s.max_price, s.tags, s.view_count`;

/** GET /api/user/favorites  我的收藏 */
router.get('/favorites', authRequired, async (req, res) => {
  try {
    const { pageNum, pageSize, offset } = pager(req.query, 10);
    const totalRow = await queryOne('SELECT COUNT(1) AS total FROM favorites WHERE user_id = ?', [req.user.id]);
    const list = await query(
      `SELECT ${SHOW_FIELDS}, f.created_at AS favorited_at
       FROM favorites f JOIN shows s ON s.id = f.show_id
       WHERE f.user_id = ? ORDER BY f.id DESC LIMIT ?, ?`,
      [req.user.id, offset, pageSize]
    );
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/user/history  浏览记录（同一演出去重，取最近一次） */
router.get('/history', authRequired, async (req, res) => {
  try {
    const { pageNum, pageSize, offset } = pager(req.query, 10);
    const totalRow = await queryOne(
      'SELECT COUNT(DISTINCT show_id) AS total FROM browse_history WHERE user_id = ?',
      [req.user.id]
    );
    const list = await query(
      `SELECT ${SHOW_FIELDS}, MAX(h.created_at) AS viewed_at
       FROM browse_history h JOIN shows s ON s.id = h.show_id
       WHERE h.user_id = ? GROUP BY h.show_id ORDER BY viewed_at DESC LIMIT ?, ?`,
      [req.user.id, offset, pageSize]
    );
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** DELETE /api/user/history  清空浏览记录 */
router.delete('/history', authRequired, async (req, res) => {
  await exec('DELETE FROM browse_history WHERE user_id = ?', [req.user.id]);
  res.json(ok(null, '已清空'));
});

/** DELETE /api/user/history/:showId  删除单条浏览记录 */
router.delete('/history/:showId', authRequired, async (req, res) => {
  await exec('DELETE FROM browse_history WHERE user_id = ? AND show_id = ?', [req.user.id, Number(req.params.showId)]);
  res.json(ok(null, '已删除'));
});

/** POST /api/user/messages  提交用户留言（需后台审核） */
router.post('/messages', authRequired, async (req, res) => {
  try {
    const { content, contact = '' } = req.body || {};
    if (!content || String(content).trim().length < 2) return res.json(fail('留言内容至少 2 个字'));
    await exec(
      'INSERT INTO user_messages (user_id, nickname, content, contact, status, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [req.user.id, req.user.nickname, String(content).slice(0, 500), contact]
    );
    res.json(ok(null, '留言已提交，等待审核'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/user/messages  我的留言列表 */
router.get('/messages', authRequired, async (req, res) => {
  try {
    const { pageNum, pageSize, offset } = pager(req.query, 10);
    const totalRow = await queryOne('SELECT COUNT(1) AS total FROM user_messages WHERE user_id = ?', [req.user.id]);
    const list = await query(
      'SELECT * FROM user_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?, ?',
      [req.user.id, offset, pageSize]
    );
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/user/messages/public  已审核通过的公开留言墙 */
router.get('/messages/public', async (req, res) => {
  try {
    const list = await query(
      'SELECT id, nickname, content, reply, created_at FROM user_messages WHERE status = 1 ORDER BY id DESC LIMIT 50'
    );
    res.json(ok(list));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/user/stats  用户中心统计卡片 */
router.get('/stats', authRequired, async (req, res) => {
  try {
    const [fav, hist, tickets, orderPending, orderPaid] = await Promise.all([
      queryOne('SELECT COUNT(1) AS c FROM favorites WHERE user_id = ?', [req.user.id]),
      queryOne('SELECT COUNT(DISTINCT show_id) AS c FROM browse_history WHERE user_id = ?', [req.user.id]),
      queryOne('SELECT COUNT(1) AS c FROM resale_tickets WHERE seller_id = ? AND status = 0', [req.user.id]),
      queryOne('SELECT COUNT(1) AS c FROM orders WHERE user_id = ? AND status = 0', [req.user.id]),
      queryOne('SELECT COUNT(1) AS c FROM orders WHERE user_id = ? AND status = 1', [req.user.id]),
    ]);
    res.json(
      ok({
        favorites: fav.c,
        history: hist.c,
        tickets: tickets.c,
        pendingOrders: orderPending.c,
        paidOrders: orderPaid.c,
      })
    );
  } catch (e) {
    res.json(fail(e.message));
  }
});

module.exports = router;
