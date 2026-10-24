/**
 * 演出资讯同步服务
 * ------------------------------------------------------------
 * 每晚从公网真实数据源（猫眼演出 / 大众点评 myshow）拉取演出数据，
 * 写入或更新 shows 表，同步真实海报图片，并记录同步日志。
 *
 * 数据源优先级：
 *   1) 若配置了 SYNC_API_URL，则同时抓取该自定义数据源（要求返回本站约定的 JSON 结构）
 *   2) 默认始终抓取公网演出数据源（真实数据，非模拟）
 *
 * 去重策略：优先按外部 source_id，其次按 标题 + 开演时间
 * 海报策略：公网图片下载落盘到 /posters/，远端 URL 变化或本地过期时重新下载
 */
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { query, queryOne, exec, transaction } = require('../db');
const maoyan = require('./sources/maoyanSource');
const { syncPoster, md5 } = require('./imageSyncService');
const { generatePoster } = require('./posterService');
const { httpJson } = require('../utils/http');

/** 是否为瞬时断连错误（云数据库休眠/网络抖动会出现） */
function isTransientDbError(e) {
  const msg = String((e && e.message) || '');
  return /ECONNREFUSED|ETIMEDOUT|ETIME|ECONNRESET|PROTOCOL_CONNECTION_LOST|EPIPE|socket disconnected|Connection lost/i.test(msg);
}

/**
 * 数据库操作重试包装器：专门应对"云数据库空闲休眠后被拒绝连接"的场景。
 * @param {Function} fn 执行的异步函数
 * @param {object} opts { times, waitMs, onRetry }
 */
async function withDbRetry(fn, opts = {}) {
  const times = opts.times || 3;
  const waitMs = opts.waitMs || 5000;
  let lastErr;
  for (let attempt = 1; attempt <= times; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isTransientDbError(e) || attempt === times) throw e;
      const msg = `数据库连接中断（${e.message}），${Math.round(waitMs / 1000)}s 后第 ${attempt + 1} 次重试...`;
      if (opts.onRetry) opts.onRetry(msg);
      console.warn(`[SYNC] ${msg}`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

/** 是否把公网海报下载到本地（默认否：直连源站图片，随源站同步更新） */
const DOWNLOAD_IMAGES = config.sync.downloadImages;

/** 分类归一：外部文案/枚举 -> 本站分类枚举 */
const CATEGORY_MAP = {
  演唱会: 'concert', 音乐会: 'concert', 话剧: 'drama', 舞台剧: 'drama', 歌剧: 'drama',
  音乐剧: 'drama', 戏曲: 'drama', 舞蹈: 'drama', 芭蕾: 'drama',
  脱口秀: 'talk', 相声: 'talk', 喜剧: 'talk',
  音乐节: 'festival', livehouse: 'festival',
  体育: 'sports', 赛事: 'sports',
};

function normalizeCategory(raw) {
  if (!raw) return 'other';
  const v = String(raw).toLowerCase();
  if (['concert', 'drama', 'talk', 'festival', 'sports', 'other'].includes(v)) return v;
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (String(raw).includes(key)) return val;
  }
  return 'other';
}

/** 归一化自定义数据源的一条记录 */
function normalizeCustomItem(raw) {
  return {
    sourceId: String(raw.sourceId || raw.source_id || raw.id || '').trim(),
    title: String(raw.title || '').trim(),
    subtitle: String(raw.subtitle || '').trim(),
    category: normalizeCategory(raw.category || raw.type),
    poster: String(raw.poster || raw.image || '').trim(),
    artist: String(raw.artist || raw.performer || '').trim(),
    venueName: String(raw.venueName || raw.venue_name || raw.venue || '').trim(),
    city: String(raw.city || '').trim(),
    address: String(raw.address || '').trim(),
    startTime: raw.startTime || raw.start_time || null,
    endTime: raw.endTime || raw.end_time || null,
    minPrice: Number(raw.minPrice ?? raw.min_price ?? 0),
    maxPrice: Number(raw.maxPrice ?? raw.max_price ?? 0),
    tags: Array.isArray(raw.tags) ? raw.tags.join(',') : String(raw.tags || ''),
    description: String(raw.description || ''),
    _posterFromRemote: true,
  };
}

/** 本次要同步的城市名：优先 SYNC_CITIES，其次 cities 表，缺省取几个热门城市 */
async function resolveSyncCities() {
  if (config.sync.cities.length) return config.sync.cities;

  try {
    const rows = await query('SELECT name FROM cities ORDER BY is_hot DESC, id ASC');
    const names = rows.map((r) => r.name);
    if (names.length) return names;
  } catch (e) {
    /* 表不存在时忽略 */
  }
  return ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安'];
}

/** 拉取自定义数据源（可选） */
async function fetchCustomSource() {
  if (!config.sync.apiUrl) return [];
  const raw = await httpJson(config.sync.apiUrl, {
    headers: config.sync.token ? { Authorization: `Bearer ${config.sync.token}` } : {},
  });
  const list = Array.isArray(raw) ? raw : raw.data || raw.list || [];
  return list.map(normalizeCustomItem).filter((i) => i.title && i.startTime);
}

/** 拉取公网数据源 */
async function fetchPublicSource(onProgress) {
  const cityNames = await resolveSyncCities();
  const pageSize = config.sync.pageSize;
  const pages = config.sync.pages;
  const withDetail = config.sync.withDetail;

  onProgress(`公网同步目标城市：${cityNames.join('、')}`);
  return await maoyan.fetchShows({ cityNames, pages, pageSize, withDetail, onProgress });
}

/* ============================ 写入数据库 ============================ */

/**
 * 把一批演出数据写入数据库（唤醒探测 + 分批事务 + 断连重试）
 * 云平台（Railway 等）容器内存通常很小，必须小批量提交，
 * 并由调用方在写完后立即释放数组引用以控制内存峰值。
 * @param {Array} items 待写入的演出数据
 * @param {string} sourceLabel 数据来源标识
 * @param {Function} onProgress 进度回调
 * @param {string} label 进度提示前缀（如城市名）
 * @returns {{created:number, updated:number, posterUpdated:number}}
 */
async function persistItems(items, sourceLabel, onProgress, label = '') {
  const tag = label ? `【${label}】` : '';
  // 本函数的循环体沿用自原 syncShows 的写入逻辑（分批事务 + 断连重试）
  let created = 0;
  let updated = 0;
  let posterUpdated = 0;

  // ============ 云数据库休眠兼容 ============
  // 抓取阶段可能持续十几分钟且完全不访问数据库（Railway 等平台的 MySQL 空闲会自动休眠），
  // 写入前先探测并唤醒数据库，再对整段写入做断连重试，避免 "抓到了却写不进去"。
  onProgress(`数据抓取完毕，准备写入数据库（正在探测数据库连接...）`);
  await withDbRetry(async () => {
    await query('SELECT 1');
  }, { times: 18, waitMs: 5000, onRetry: (m) => onProgress(m) });
  onProgress(`数据库连接正常，开始分批写入 ${items.length} 条演出数据...`);

  // ============ 分批写入 ============
  // 一次性用单个大事务写入上千场演出会导致容器内存超限被杀（云平台常见限制），
  // 因此按 CHUNK_SIZE 分批提交：内存可控、每批都是新连接（顺带保持数据库活跃）、
  // 中途失败也不会整体回滚导致前功尽弃。
  const CHUNK_SIZE = 50;
  for (let start = 0; start < items.length; start += CHUNK_SIZE) {
    const chunk = items.slice(start, start + CHUNK_SIZE);

    await withDbRetry(async () => {
      await transaction(async (conn) => {
    for (const item of chunk) {
      if (!item.title || !item.startTime) continue;

      // 去重：优先外部 sourceId，其次 标题 + 开演时间
      const [existRows] = await conn.execute(
        'SELECT id, poster, source_poster FROM shows WHERE (source_id <> "" AND source_id = ?) OR (title = ? AND start_time = ?) LIMIT 1',
        [item.sourceId, item.title, item.startTime]
      );
      const exist = existRows[0];

      // ---------- 同步真实海报 ----------
      // 默认直接引用公网的真实图片地址（无签名、无过期参数），源站换图本站即刻同步；
      // 需要本地留存可配置 SYNC_DOWNLOAD_IMAGES=true，届时下载到 /posters/ 并做增量更新。
      let posterPath = '';
      if (item.poster) {
        if (DOWNLOAD_IMAGES) {
          posterPath = await syncPoster(item.poster, {
            key: `s${md5(item.sourceId || item.title)}`,
            force: !exist || exist.source_poster !== item.poster,
          });
        } else {
          posterPath = item.poster;
        }
        if (posterPath && exist && exist.source_poster !== item.poster) posterUpdated++;
      }
      const finalPoster = posterPath || (exist ? exist.poster : '');
      const sourcePoster = item.poster || '';

      const tags = Array.isArray(item.tags) ? item.tags.join(',') : String(item.tags || '');
      const hot = calcHotScore(item);

      if (exist) {
        const [r] = await conn.execute(
          `UPDATE shows SET subtitle = ?, category = ?, poster = ?, source_poster = ?, artist = ?, venue_name = ?,
             city = ?, address = ?, end_time = ?, min_price = ?, max_price = ?, tags = ?, description = ?,
             hot_score = ?, source = ?, source_id = ?, sync_time = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [
            item.subtitle, item.category, finalPoster, sourcePoster, item.artist, item.venueName,
            item.city, item.address, item.endTime, item.minPrice, item.maxPrice,
            tags, item.description, hot, sourceLabel, item.sourceId, exist.id,
          ]
        );
        if (r.affectedRows > 0) updated++;
        if (finalPoster) continue; // 已有海报无需补图
      } else {
        const [ins] = await conn.execute(
          `INSERT INTO shows (title, subtitle, category, poster, source_poster, artist, venue_name, city, address, start_time,
             end_time, min_price, max_price, tags, description, status, hot_score, source, source_id, sync_time, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,NOW(),NOW(),NOW())`,
          [
            item.title, item.subtitle, item.category, finalPoster, sourcePoster, item.artist, item.venueName,
            item.city, item.address, item.startTime, item.endTime, item.minPrice, item.maxPrice,
            tags, item.description, hot, sourceLabel, item.sourceId,
          ]
        );
        created++;
      }

      // 公网没给图片且下载也没成功 → 本地兜底生成一张（仅兜底，正常情况不会走到）
      const newId = exist ? exist.id : null;
      const id = newId || await lastInsertId(conn);
      if (!finalPoster) {
        const url = generatePoster({ ...item, id });
        if (url) await conn.execute('UPDATE shows SET poster = ? WHERE id = ?', [url, id]);
      }
      // 公网数据源不返回票档，这里按价格区间自动生成官方票档，保证可正常下单
      await ensureTiers(conn, id, item);
    }
      }, { times: 4, waitMs: 8000, onRetry: (m) => onProgress(m) });
    });

    const doneCount = Math.min(start + CHUNK_SIZE, items.length);
    onProgress(`${tag}写入进度 ${doneCount}/${items.length}（新增 ${created} / 更新 ${updated}）`);
    // 每批之间让出事件循环，避免长时间占用 CPU 被平台限流
    await new Promise((r) => setTimeout(r, 100));
  }



  return { created, updated, posterUpdated };
}

/* ============================ 主流程 ============================ */

/**
 * 执行一次同步
 * @param {object} opts { onProgress }
 */
async function syncShows(opts = {}) {
  const startedAt = new Date();
  const onProgress = opts.onProgress || ((m) => console.log(`[SYNC] ${m}`));
  let sourceLabel = maoyan.SOURCE_NAME;

  // 计数器：跨所有批次累计（逐城市抓取、逐城市落库）
  const counters = { created: 0, updated: 0, posterUpdated: 0, total: 0 };
  const acc = (r, n) => {
    counters.created += r.created;
    counters.updated += r.updated;
    counters.posterUpdated += r.posterUpdated;
    counters.total += n;
  };

  try {
    // 1) 可选：自定义数据源（配置了才跑），数据量小，一次性写入
    try {
      const customItems = await fetchCustomSource();
      if (customItems.length) {
        sourceLabel += '+api';
        onProgress(`自定义数据源获取 ${customItems.length} 条`);
        acc(await persistItems(customItems, sourceLabel, onProgress, '自定义源'), customItems.length);
      }
    } catch (e) {
      onProgress(`自定义数据源拉取失败（已忽略）：${e.message}`);
    }

    // 2) 公网真实数据源：
    // 逐城市抓取并立即落库 + 释放引用，避免一次性堆积上千条把容器内存撑爆（云平台常见限制）
    const cityNames = await resolveSyncCities();
    const pageSize = config.sync.pageSize;
    const pages = config.sync.pages;
    const withDetail = config.sync.withDetail;
    onProgress(`公网同步目标城市：${cityNames.join('、')}`);

    for (const city of cityNames) {
      let cityItems = [];
      try {
        cityItems = await maoyan.fetchShows({ cityNames: [city], pages, pageSize, withDetail, onProgress });
      } catch (e) {
        onProgress(`「${city}」抓取失败：${e.message}`);
        continue;
      }
      if (!cityItems.length) {
        onProgress(`「${city}」未取到数据，跳过`);
        continue;
      }
      acc(await persistItems(cityItems, sourceLabel, onProgress, city), cityItems.length);
      cityItems.length = 0; // 立即释放引用，控制内存峰值
    }

    if (!counters.total) throw new Error('数据源未返回有效演出数据');
  } catch (e) {
    await recordLog({
      source: sourceLabel, status: 0, total: 0, created: 0, updated: 0,
      message: e.message, startedAt,
    });
    throw e;
  }

  const result = {
    source: sourceLabel,
    total: counters.total,
    created: counters.created,
    updated: counters.updated,
    posterUpdated: counters.posterUpdated,
    startedAt,
    finishedAt: new Date(),
  };
  await recordLog({ ...result, status: 1, message: '同步成功' });
  onProgress(`同步完成：新增 ${counters.created} / 更新 ${counters.updated} / 图片更新 ${counters.posterUpdated} / 共 ${counters.total} 条`);
  return result;
}

/** 取事务连接上最近一次 INSERT 的自增ID */
async function lastInsertId(conn) {
  const [rows] = await conn.execute('SELECT LAST_INSERT_ID() AS id');
  return rows[0]?.id || 0;
}

/**
 * 若某演出尚无票档，则按价格区间自动生成官方票档（普通票 / 进阶票 / VIP票），保证可下单。
 * 幂等：已有票档则不重复创建。
 */
async function ensureTiers(conn, showId, item) {
  if (!showId) return;
  const [rows] = await conn.execute('SELECT COUNT(1) AS cnt FROM ticket_tiers WHERE show_id = ?', [showId]);
  if (rows[0].cnt > 0) return;
  const min = Number(item.minPrice) || 0;
  const max = Number(item.maxPrice) || 0;
  const tiers = [];
  if (min > 0) tiers.push({ name: '普通票', price: min });
  if (max > 0 && max - min >= 50) {
    const mid = Math.round((min + max) / 2 / 10) * 10;
    if (mid !== min && mid !== max) tiers.push({ name: '进阶票', price: mid });
  }
  if (max > 0 && max !== min) tiers.push({ name: 'VIP票', price: max });
  if (!tiers.length) tiers.push({ name: '标准票', price: min });
  for (const t of tiers) {
    await conn.execute(
      'INSERT INTO ticket_tiers (show_id, name, price, original_price, stock, description, status) VALUES (?,?,?,?,?,?,1)',
      [showId, t.name, t.price, t.price, 100, `${t.name} · 官方渠道`]
    );
  }
}


/** 热度分：开演越近、价格区间越完整分数越高 */
function calcHotScore(item) {
  const start = new Date(item.startTime);
  if (Number.isNaN(start.getTime())) return 50;
  const days = Math.ceil((start.getTime() - Date.now()) / 86400000);
  let score = 50;
  if (days <= 7) score += 30;
  else if (days <= 30) score += 20;
  else if (days <= 90) score += 10;
  if (item.maxPrice > item.minPrice) score += 10;
  if (item.description) score += 5;
  if (item.poster) score += 5;
  return Math.min(100, score);
}

/** 写入同步日志表 */
async function recordLog({ source, status, total, created, updated, message, startedAt }) {
  try {
    await exec(
      `INSERT INTO sync_logs (source, status, total, created_count, updated_count, message, started_at, finished_at)
       VALUES (?,?,?,?,?,?,?,NOW())`,
      [source, status, total || 0, created || 0, updated || 0, message || '', startedAt || new Date()]
    );
  } catch (e) {
    console.error('[SYNC] 写日志失败:', e.message);
  }
}

/** 清理：同步完成后把已过期（结束时间超过 1 天）的演出自动下架 */
async function archiveExpiredShows() {
  const r = await exec(
    'UPDATE shows SET status = 0, updated_at = NOW() WHERE status = 1 AND end_time IS NOT NULL AND end_time < DATE_SUB(NOW(), INTERVAL 1 DAY)'
  );
  return r.affectedRows;
}

/** 供后台展示的最近同步日志 */
async function recentLogs(limit = 10) {
  try {
    return await query('SELECT * FROM sync_logs ORDER BY id DESC LIMIT ?', [Number(limit) || 10]);
  } catch (e) {
    return [];
  }
}

/** 确保海报输出目录存在 */
function ensurePosterDir() {
  const dir = path.join(__dirname, '../../public/posters');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { syncShows, archiveExpiredShows, recentLogs, ensurePosterDir, normalizeCategory };
