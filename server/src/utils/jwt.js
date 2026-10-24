const jwt = require('jsonwebtoken');
const config = require('../config');

/** 签发 token */
function sign(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

/** 校验 token，失败返回 null */
function verify(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (e) {
    return null;
  }
}

module.exports = { sign, verify };
