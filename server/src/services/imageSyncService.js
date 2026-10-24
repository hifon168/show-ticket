/**
 * 海报图片同步服务
 * ------------------------------------------------------------
 * 把公网数据源返回的真实海报 URL 下载并落盘到 server/public/posters/，
 * 统一以 /posters/xxx.jpg 的形式对外提供（避免盗链失败、也支持离线访问）。
 *
 * 更新策略：
 *   - 远端 URL 发生变化（shows.source_poster 不同）→ 强制重新下载
 *   - 本地文件不存在 → 下载
 *   - 本地文件超过 IMAGE_TTL_DAYS 天 → 下载（保证长期运行也能刷新）
 */
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { downloadFile } = require('../utils/http');

const OUT_DIR = path.join(__dirname, '../../public/posters');

/** 图片缓存有效期（天） */
const IMAGE_TTL_DAYS = Number(process.env.SYNC_IMAGE_TTL_DAYS || 7);

const md5 = (s) => crypto.createHash('md5').update(String(s)).digest('hex').slice(0, 16);

/** 按 URL 猜测扩展名 */
function extFromUrl(url) {
  const clean = String(url).split('?')[0];
  const m = clean.match(/\.(jpe?g|png|webp|gif|avif)$/i);
  if (m) return m[1].toLowerCase();
  return 'jpg';
}

/** 判断本地文件是否需要刷新 */
function needRefresh(file, ttlDays = IMAGE_TTL_DAYS) {
  try {
    const st = fs.statSync(file);
    const ageDays = (Date.now() - st.mtimeMs) / 86400000;
    if (st.size < 1024) return true;
    return ageDays > ttlDays;
  } catch (e) {
    return true; // 不存在
  }
}

/**
 * 同步一张海报
 * @param {string} remoteUrl 公网图片地址
 * @param {object} opts { key, force }
 *        key  文件名主体，缺省用 URL md5
 * @returns {Promise<string|null>} 本地可访问路径，失败返回 null
 */
async function syncPoster(remoteUrl, opts = {}) {
  if (!remoteUrl || !/^https?:\/\//i.test(remoteUrl)) return null;

  const ext = extFromUrl(remoteUrl);
  const key = (opts.key || md5(remoteUrl)).replace(/[^\w.-]/g, '_');
  const filename = `${key}.${ext}`;
  const filePath = path.join(OUT_DIR, filename);

  if (!opts.force && !needRefresh(filePath)) return `/posters/${filename}`;

  try {
    await downloadFile(remoteUrl, filePath, {
      headers: { Referer: 'https://show.maoyan.com/' },
      timeout: 25000,
      minSize: 1024,
    });
    return `/posters/${filename}`;
  } catch (e) {
    // 下载失败但有旧图 → 继续用旧图，不让流程中断
    try {
      if (fs.statSync(filePath).size > 1024) return `/posters/${filename}`;
    } catch (err) {
      /* 无旧图 */
    }
    console.warn('[IMG] 海报下载失败:', e.message);
    return null;
  }
}

module.exports = { syncPoster, OUT_DIR, md5, extFromUrl, needRefresh };
