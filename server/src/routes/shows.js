const express = require('express');
const { query, queryOne, exec } = require('../db');
const { ok, fail, page } = require('../utils/response');
const { pager } = require('../utils/helpers');
const { authRequired, authOptional } = require('../middleware/auth');

const router = express.Router();

/** 列表公共字段 */
const LIST_FIELDS = `s.id, s.title, s.subtitle, s.category, s.poster, s.artist, s.venue_name, s.city,
  s.start_time, s.end_time, s.min_price, s.max_price, s.tags, s.status, s.view_count, s.hot_score,
  s.created_at, s.updated_at`;

/**
 * GET /api/shows  演出列表（支持城市/类型/日期/关键词筛选）
 * query: city, category, date(today|tomorrow|week|weekend|month), start, end, keyword, sort(hot|time|price), pageNum, pageSize
 */
router.get('/', async (req, res) => {
  try {
    const { city, category, date, start, end, keyword, sort = 'hot' } = req.query;
    const { pageNum, pageSize, offset } = pager(req.query, 10);

    const where = ["s.status = 1"];
    const params = [];

    if (city && city !== 'all') {
      where.push('s.city = ?');
      params.push(city);
    }
    if (category && category !== 'all') {
      where.push('s.category = ?');
      params.push(category);
    }
    if (keyword) {
      where.push('(s.title LIKE ? OR s.artist LIKE ? OR s.venue_name LIKE ?)');
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }

    // 日期快捷筛选
    const now = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    if (date === 'today') {
      where.push('DATE(s.start_time) = ?');
      params.push(fmt(now));
    } else if (date === 'tomorrow') {
      const t = new Date(now.getTime() + 86400000);
      where.push('DATE(s.start_time) = ?');
      params.push(fmt(t));
    } else if (date === 'week') {
      const t = new Date(now.getTime() + 7 * 86400000);
      where.push('s.start_time BETWEEN ? AND ?');
      params.push(now, t);
    } else if (date === 'weekend') {
      // 本周六、周日
      const day = now.getDay() || 7; // 周日=7
      const sat = new Date(now.getTime() + (6 - day) * 86400000);
      const sun = new Date(sat.getTime() + 86400000);
      where.push('DATE(s.start_time) IN (?, ?)');
      params.push(fmt(sat), fmt(sun));
    } else if (date === 'month') {
      const t = new Date(now.getTime() + 30 * 86400000);
      where.push('s.start_time BETWEEN ? AND ?');
      params.push(now, t);
    }
    if (start) {
      where.push('s.start_time >= ?');
      params.push(start);
    }
    if (end) {
      where.push('s.start_time <= ?');
      params.push(end);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const orderMap = {
      hot: 's.hot_score DESC, s.start_time ASC',
      time: 's.start_time ASC',
      price: 's.min_price ASC',
      new: 's.created_at DESC',
    };

    const totalRow = await queryOne(`SELECT COUNT(1) AS total FROM shows s ${whereSql}`, params);
    const list = await query(
      `SELECT ${LIST_FIELDS} FROM shows s ${whereSql} ORDER BY ${orderMap[sort] || orderMap.hot} LIMIT ?, ?`,
      [...params, offset, pageSize]
    );
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/**
 * GET /api/shows/home  首页聚合数据：轮播 + 即将上演 + 近期上新榜单 + 热门推荐
 */
router.get('/home', async (req, res) => {
  try {
    const { city } = req.query;
    const cityWhere = city && city !== 'all' ? 'AND city = ?' : '';
    const cityParam = city && city !== 'all' ? [city] : [];

    const [banners, upcoming, newest, hot] = await Promise.all([
      query('SELECT id, title, image, show_id, link FROM banners WHERE status = 1 ORDER BY sort ASC, id DESC LIMIT 6'),
      query(
        `SELECT ${LIST_FIELDS} FROM shows s WHERE s.status = 1 AND s.start_time >= NOW() ${cityWhere}
         ORDER BY s.start_time ASC LIMIT 10`,
        cityParam
      ),
      query(
        `SELECT ${LIST_FIELDS} FROM shows s WHERE s.status = 1 ${cityWhere}
         ORDER BY s.created_at DESC LIMIT 10`,
        cityParam
      ),
      query(
        `SELECT ${LIST_FIELDS} FROM shows s WHERE s.status = 1 ${cityWhere}
         ORDER BY s.hot_score DESC LIMIT 10`,
        cityParam
      ),
    ]);
    res.json(ok({ banners, upcoming, newest, hot }));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/**
 * GET /api/shows/search  搜索（艺人 / 演出名称 / 场馆）
 */
router.get('/search', async (req, res) => {
  try {
    const { keyword = '', pageNum = 1, pageSize = 10 } = req.query;
    const { offset } = pager(req.query, 10);
    if (!keyword) return res.json(ok(page([], 0, pageNum, pageSize)));

    const kw = `%${keyword}%`;
    const where = 'WHERE s.status = 1 AND (s.title LIKE ? OR s.artist LIKE ? OR s.venue_name LIKE ? OR s.subtitle LIKE ?)';
    const params = [kw, kw, kw, kw];
    const totalRow = await queryOne(`SELECT COUNT(1) AS total FROM shows s ${where}`, params);
    const list = await query(
      `SELECT ${LIST_FIELDS} FROM shows s ${where} ORDER BY s.hot_score DESC LIMIT ?, ?`,
      [...params, offset, pageSize]
    );
    res.json(ok(page(list, totalRow.total, pageNum, pageSize)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/shows/search/suggest  搜索热词/联想词 */
router.get('/search/suggest', async (req, res) => {
  try {
    const { keyword = '' } = req.query;
    if (!keyword) {
      const rows = await query('SELECT keyword, times FROM search_hot ORDER BY times DESC LIMIT 10');
      return res.json(ok(rows.map((r) => r.keyword)));
    }
    const kw = `%${keyword}%`;
    const rows = await query(
      `SELECT DISTINCT s.title AS keyword FROM shows s
       WHERE s.status = 1 AND (s.title LIKE ? OR s.artist LIKE ? OR s.venue_name LIKE ?) LIMIT 10`,
      [kw, kw, kw]
    );
    res.json(ok(rows.map((r) => r.keyword)));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/**
 * GET /api/shows/:id  演出详情（含票档、是否收藏）
 */
router.get('/:id', authOptional, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const show = await queryOne('SELECT * FROM shows WHERE id = ?', [id]);
    if (!show) return res.json(fail('演出不存在'));

    const tiers = await query(
      'SELECT id, name, price, original_price, stock, description FROM ticket_tiers WHERE show_id = ? AND status = 1 ORDER BY price ASC',
      [id]
    );

    // 二手在售票数量
    const resale = await queryOne(
      'SELECT COUNT(1) AS cnt, MIN(sell_price) AS min_price FROM resale_tickets WHERE show_id = ? AND status = 0',
      [id]
    );

    // 浏览量 +1
    exec('UPDATE shows SET view_count = view_count + 1 WHERE id = ?', [id]).catch(() => {});

    let favorited = false;
    if (req.user) {
      const fav = await queryOne('SELECT id FROM favorites WHERE user_id = ? AND show_id = ?', [req.user.id, id]);
      favorited = !!fav;
      // 记录浏览历史（保留最近 50 条）
      await exec('INSERT INTO browse_history (user_id, show_id, created_at) VALUES (?, ?, NOW())', [req.user.id, id]);
      await exec(
        `DELETE FROM browse_history WHERE user_id = ? AND id NOT IN (
           SELECT id FROM (SELECT id FROM browse_history WHERE user_id = ? ORDER BY id DESC LIMIT 50) t
         )`,
        [req.user.id, req.user.id]
      );
    }

    res.json(ok({ ...show, tiers, favorited, resale }));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** POST /api/shows/:id/favorite  收藏 / 取消收藏 */
router.post('/:id/favorite', authRequired, async (req, res) => {
  try {
    const showId = Number(req.params.id);
    const fav = await queryOne('SELECT id FROM favorites WHERE user_id = ? AND show_id = ?', [req.user.id, showId]);
    if (fav) {
      await exec('DELETE FROM favorites WHERE id = ?', [fav.id]);
      return res.json(ok({ favorited: false }, '已取消收藏'));
    }
    await exec('INSERT INTO favorites (user_id, show_id, created_at) VALUES (?, ?, NOW())', [req.user.id, showId]);
    res.json(ok({ favorited: true }, '收藏成功'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

module.exports = router;
