const express = require('express');
const { query } = require('../db');
const { ok, fail } = require('../utils/response');
const PaymentService = require('../services/payment');

const router = express.Router();

/** 演出类型字典：与数据库 shows.category 保持一致 */
const CATEGORIES = [
  { value: 'concert', label: '演唱会', icon: '🎤' },
  { value: 'drama', label: '话剧', icon: '🎭' },
  { value: 'talk', label: '脱口秀', icon: '🎙️' },
  { value: 'festival', label: '音乐节', icon: '🎸' },
  { value: 'sports', label: '体育赛事', icon: '🏀' },
  { value: 'other', label: '其他', icon: '🎪' },
];

/** GET /api/meta/config  前端初始化配置：城市、分类、轮播 */
router.get('/config', async (req, res) => {
  try {
    const [cities, banners] = await Promise.all([
      query('SELECT id, name, is_hot FROM cities ORDER BY is_hot DESC, id ASC'),
      query('SELECT id, title, image, show_id, link FROM banners WHERE status = 1 ORDER BY sort ASC, id DESC LIMIT 10'),
    ]);
    res.json(
      ok({
        cities,
        categories: CATEGORIES,
        banners,
        payment: { mode: PaymentService.mode, methods: PaymentService.getMethods() },
      })
    );
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/meta/cities  城市列表 */
router.get('/cities', async (req, res) => {
  try {
    const rows = await query('SELECT id, name, is_hot FROM cities ORDER BY is_hot DESC, id ASC');
    res.json(ok(rows));
  } catch (e) {
    res.json(fail(e.message));
  }
});

module.exports = router;
module.exports.CATEGORIES = CATEGORIES;
