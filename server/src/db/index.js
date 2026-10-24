/**
 * MySQL 连接池与基础查询封装
 * - query(sql, params)      : 查询，返回数组
 * - queryOne(sql, params)   : 查询单条
 * - exec(sql, params)       : 写操作，返回 OkPacket
 * - transaction(fn)         : 事务，fn 接收 connection
 */
const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool(config.db);

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function exec(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

/**
 * 事务封装：fn 内使用 conn.query / conn.execute
 * @example await transaction(async (conn) => { await conn.execute('UPDATE ...'); })
 */
async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, queryOne, exec, transaction };
