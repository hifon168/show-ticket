const express = require('express');
const { query, queryOne, exec } = require('../db');
const { ok, fail } = require('../utils/response');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/chat/start  发起私聊（买家向卖家咨询/转票）
 * body: { ticketId } 或 { sellerId, showId }
 * 同一买家+卖家+票品只保留一个会话
 */
router.post('/start', authRequired, async (req, res) => {
  try {
    const { ticketId, sellerId, showId } = req.body || {};

    let peerId = sellerId ? Number(sellerId) : 0;
    let sid = showId ? Number(showId) : null;

    if (ticketId) {
      const t = await queryOne('SELECT * FROM resale_tickets WHERE id = ?', [ticketId]);
      if (!t) return res.json(fail('票品不存在'));
      peerId = t.seller_id;
      sid = t.show_id;
    }
    if (!peerId) return res.json(fail('缺少聊天对象'));
    if (peerId === req.user.id) return res.json(fail('不能与自己聊天'));

    let conv = await queryOne(
      'SELECT * FROM chat_conversations WHERE user_a = ? AND user_b = ? AND ticket_id <=> ?',
      [req.user.id, peerId, ticketId || null]
    );
    if (!conv) {
      const r = await exec(
        `INSERT INTO chat_conversations (user_a, user_b, ticket_id, show_id, last_message, last_message_at, created_at)
         VALUES (?, ?, ?, ?, '', NOW(), NOW())`,
        [req.user.id, peerId, ticketId || null, sid]
      );
      conv = await queryOne('SELECT * FROM chat_conversations WHERE id = ?', [r.insertId]);
    }
    res.json(ok(conv));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/chat/conversations  我的会话列表 */
router.get('/conversations', authRequired, async (req, res) => {
  try {
    const rows = await query(
      `SELECT c.*,
              u.nickname AS peer_nickname, u.avatar AS peer_avatar,
              s.title AS show_title, s.poster AS show_poster, t.sell_price
       FROM chat_conversations c
       JOIN users u ON u.id = IF(c.user_a = ?, c.user_b, c.user_a)
       LEFT JOIN shows s ON s.id = c.show_id
       LEFT JOIN resale_tickets t ON t.id = c.ticket_id
       WHERE c.user_a = ? OR c.user_b = ?
       ORDER BY c.last_message_at DESC`,
      [req.user.id, req.user.id, req.user.id]
    );
    // 未读数
    const withUnread = await Promise.all(
      rows.map(async (c) => {
        const r = await queryOne(
          'SELECT COUNT(1) AS c FROM chat_messages WHERE conversation_id = ? AND sender_id != ? AND is_read = 0',
          [c.id, req.user.id]
        );
        return { ...c, unread: r.c };
      })
    );
    res.json(ok(withUnread));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/chat/:conversationId/messages  会话消息 */
router.get('/:conversationId/messages', authRequired, async (req, res) => {
  try {
    const cid = Number(req.params.conversationId);
    const conv = await queryOne('SELECT * FROM chat_conversations WHERE id = ?', [cid]);
    if (!conv) return res.json(fail('会话不存在'));
    if (conv.user_a !== req.user.id && conv.user_b !== req.user.id) return res.json(fail('无权查看'));

    const list = await query(
      `SELECT m.*, u.nickname AS sender_nickname, u.avatar AS sender_avatar
       FROM chat_messages m JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? ORDER BY m.id ASC`,
      [cid]
    );
    // 对方发来的消息标记已读
    await exec('UPDATE chat_messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ?', [cid, req.user.id]);
    res.json(ok(list));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** POST /api/chat/:conversationId/send  发送消息 */
router.post('/:conversationId/send', authRequired, async (req, res) => {
  try {
    const cid = Number(req.params.conversationId);
    const { content, type = 'text' } = req.body || {};
    if (!content || !String(content).trim()) return res.json(fail('消息内容不能为空'));

    const conv = await queryOne('SELECT * FROM chat_conversations WHERE id = ?', [cid]);
    if (!conv) return res.json(fail('会话不存在'));
    if (conv.user_a !== req.user.id && conv.user_b !== req.user.id) return res.json(fail('无权发送'));

    await exec('INSERT INTO chat_messages (conversation_id, sender_id, type, content, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())', [
      cid,
      req.user.id,
      type,
      String(content).slice(0, 1000),
    ]);
    await exec('UPDATE chat_conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?', [
      String(content).slice(0, 100),
      cid,
    ]);
    res.json(ok(null, '已发送'));
  } catch (e) {
    res.json(fail(e.message));
  }
});

/** GET /api/chat/unread  未读消息总数 */
router.get('/unread', authRequired, async (req, res) => {
  try {
    const r = await queryOne(
      `SELECT COUNT(1) AS c FROM chat_messages m
       JOIN chat_conversations c ON c.id = m.conversation_id
       WHERE (c.user_a = ? OR c.user_b = ?) AND m.sender_id != ? AND m.is_read = 0`,
      [req.user.id, req.user.id, req.user.id]
    );
    res.json(ok({ unread: r.c }));
  } catch (e) {
    res.json(fail(e.message));
  }
});

module.exports = router;
