const { verify } = require('../utils/jwt');
const { queryOne } = require('../db');
const { fail } = require('../utils/response');

/**
 * 解析 Authorization: Bearer <token>，挂载 req.user
 */
async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json(fail('请先登录', 401));

  const payload = verify(token);
  if (!payload) return res.status(401).json(fail('登录已过期，请重新登录', 401));

  // 每次请求都查一次用户，保证封号/删除即时生效
  const user = await queryOne('SELECT * FROM users WHERE id = ? AND status = 1', [payload.id]);
  if (!user) return res.status(401).json(fail('账号状态异常', 401));

  req.user = user;
  next();
}

/** 管理员校验（需先经过 authRequired） */
function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 1) {
    return res.status(403).json(fail('无权限访问', 403));
  }
  next();
}

/** 兼容：无 token 也可访问，有则挂载用户信息 */
async function authOptional(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token) {
    const payload = verify(token);
    if (payload) {
      const user = await queryOne('SELECT * FROM users WHERE id = ? AND status = 1', [payload.id]);
      if (user) req.user = user;
    }
  }
  next();
}

module.exports = { authRequired, adminRequired, authOptional };
