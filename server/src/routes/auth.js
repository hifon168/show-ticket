const express = require('express');
const bcrypt = require('bcryptjs');
const { query, queryOne, exec, transaction } = require('../db');
const { ok, fail } = require('../utils/response');
const { sign } = require('../utils/jwt');
const { isPhone } = require('../utils/helpers');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

/** 去掉密码字段 */
function safeUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

/**
 * POST /api/auth/register
 * 注册：必须填写邀请码，且邀请码未被使用
 */
router.post('/register', async (req, res) => {
  try {
    const { phone, password, nickname, inviteCode } = req.body || {};

    if (!isPhone(phone)) return res.json(fail('请输入正确的手机号'));
    if (!password || String(password).length < 6) return res.json(fail('密码至少 6 位'));
    if (!inviteCode) return res.json(fail('邀请码不能为空，注册必须填写邀请码'));

    const exists = await queryOne('SELECT id FROM users WHERE phone = ?', [phone]);
    if (exists) return res.json(fail('该手机号已注册'));

    const code = await queryOne('SELECT * FROM invite_codes WHERE code = ?', [String(inviteCode).trim().toUpperCase()]);
    if (!code) return res.json(fail('邀请码不存在'));
    if (code.status !== 0) return res.json(fail('该邀请码已被使用'));
    if (code.expires_at && new Date(code.expires_at) < new Date()) return res.json(fail('该邀请码已过期'));

    const passwordHash = bcrypt.hashSync(String(password), 10);

    const userId = await transaction(async (conn) => {
      // 1. 创建用户
      const [r1] = await conn.execute(
        `INSERT INTO users (phone, password, nickname, avatar, invite_code_id, role, status, created_at)
         VALUES (?, ?, ?, '', ?, 0, 1, NOW())`,
        [phone, passwordHash, nickname || `用户${String(phone).slice(-4)}`, code.id]
      );
      const uid = r1.insertId;
      // 2. 核销邀请码（加锁避免并发重复使用）
      const [r2] = await conn.execute(
        'UPDATE invite_codes SET status = 1, used_by = ?, used_at = NOW() WHERE id = ? AND status = 0',
        [uid, code.id]
      );
      if (r2.affectedRows === 0) throw new Error('邀请码已被使用');
      return uid;
    });

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    res.json(ok({ token: sign({ id: user.id, role: user.role }), user: safeUser(user) }, '注册成功'));
  } catch (e) {
    res.json(fail(e.message || '注册失败'));
  }
});

/**
 * POST /api/auth/login  用户登录
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body || {};
    const user = await queryOne('SELECT * FROM users WHERE phone = ?', [phone]);
    if (!user) return res.json(fail('账号不存在'));
    if (user.status !== 1) return res.json(fail('账号已被禁用，请联系客服'));
    if (!bcrypt.compareSync(String(password || ''), user.password)) return res.json(fail('密码错误'));

    res.json(ok({ token: sign({ id: user.id, role: user.role }), user: safeUser(user) }, '登录成功'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/**
 * POST /api/auth/admin-login  管理员登录（校验 role = 1）
 */
router.post('/admin-login', async (req, res) => {
  try {
    const { phone, password } = req.body || {};
    const user = await queryOne('SELECT * FROM users WHERE phone = ? AND role = 1', [phone]);
    if (!user) return res.json(fail('管理员账号不存在'));
    if (!bcrypt.compareSync(String(password || ''), user.password)) return res.json(fail('密码错误'));

    res.json(ok({ token: sign({ id: user.id, role: user.role }), user: safeUser(user) }, '登录成功'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/auth/me  当前登录用户 */
router.get('/me', authRequired, async (req, res) => {
  res.json(ok(safeUser(req.user)));
});

/** PUT /api/auth/profile  修改个人资料 */
router.put('/profile', authRequired, async (req, res) => {
  try {
    const { nickname, avatar, gender, birthday, city } = req.body || {};
    await exec(
      `UPDATE users SET nickname = IFNULL(?, nickname), avatar = IFNULL(?, avatar),
       gender = IFNULL(?, gender), birthday = IFNULL(?, birthday), city = IFNULL(?, city), updated_at = NOW()
       WHERE id = ?`,
      [nickname, avatar, gender, birthday || null, city, req.user.id]
    );
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json(ok(safeUser(user), '保存成功'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** PUT /api/auth/password  修改密码 */
router.put('/password', authRequired, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) return res.json(fail('新密码至少 6 位'));
    if (!bcrypt.compareSync(String(oldPassword || ''), req.user.password)) return res.json(fail('原密码不正确'));
    await exec('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [
      bcrypt.hashSync(String(newPassword), 10),
      req.user.id,
    ]);
    res.json(ok(null, '修改成功'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** POST /api/auth/check-invite  校验邀请码是否可用（前端注册前预校验） */
router.post('/check-invite', async (req, res) => {
  const code = await queryOne('SELECT * FROM invite_codes WHERE code = ?', [
    String((req.body || {}).inviteCode || '').trim().toUpperCase(),
  ]);
  if (!code) return res.json(fail('邀请码不存在'));
  if (code.status !== 0) return res.json(fail('该邀请码已被使用'));
  if (code.expires_at && new Date(code.expires_at) < new Date()) return res.json(fail('该邀请码已过期'));
  res.json(ok({ valid: true }, '邀请码可用'));
});

module.exports = router;
