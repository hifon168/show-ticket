/**
 * 通用 HTTP 客户端
 * ------------------------------------------------------------
 * 提供同步任务所需的两个能力：
 *   1) httpJson      —— GET 一个 URL 并按 JSON 解析（带 UA / Referer / 超时）
 *   2) downloadFile  —— GET 一个二进制资源并落盘（用于同步真实海报图）
 * 不依赖第三方包，直接使用 Node 内置 http / https / fs。
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/** 浏览器标识：部分数据源会校验 UA / Referer */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 发起一次 GET 请求，返回原始 Buffer
 * @param {string} url      完整 URL
 * @param {object} opts     { headers, timeout, maxRedirects }
 * @returns {Promise<{buffer:Buffer, status:number, headers:object}>}
 */
function request(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const { headers = {}, timeout = 20000, maxRedirects = 3 } = opts;

    const fire = (target, left) => {
      let u;
      try {
        u = new URL(target);
      } catch (e) {
        return reject(new Error(`非法 URL：${target}`));
      }
      const client = u.protocol === 'https:' ? https : http;
      const req = client.get(
        u,
        {
          headers: {
            'User-Agent': BROWSER_UA,
            Accept: '*/*',
            'Accept-Encoding': 'gzip, deflate',
            ...headers,
          },
        },
        (res) => {
          const { statusCode = 0, headers: resHeaders = {} } = res;

          // 跟随 3xx 重定向
          if ([301, 302, 303, 307, 308].includes(statusCode) && resHeaders.location && left > 0) {
            res.resume();
            const next = new URL(resHeaders.location, target).href;
            return fire(next, left - 1);
          }

          // 内容解压
          const enc = String(resHeaders['content-encoding'] || '').toLowerCase();
          const stream = enc === 'gzip' ? res.pipe(zlib.createGunzip())
            : enc === 'deflate' ? res.pipe(zlib.createInflate())
            : res;

          const chunks = [];
          stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          stream.on('error', (e) => reject(e));
          stream.on('end', () => resolve({ buffer: Buffer.concat(chunks), status: statusCode, headers: resHeaders }));
        }
      );

      req.on('error', reject);
      req.setTimeout(timeout, () => {
        req.destroy(new Error(`请求超时（>${timeout}ms）：${u.host}`));
      });
    };

    fire(url, maxRedirects);
  });
}

/**
 * GET 并解析 JSON
 * @param {string} url
 * @param {object} opts { headers, timeout }
 */
async function httpJson(url, opts = {}) {
  const { buffer, status } = await request(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers || {}) } });
  if (status !== 200) throw new Error(`HTTP ${status}：${url}`);
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch (e) {
    throw new Error(`JSON 解析失败：${url}`);
  }
}

/**
 * 下载二进制资源到磁盘
 * @param {string} url      资源地址
 * @param {string} filePath 落盘绝对路径（父目录会自动创建）
 * @param {object} opts     { headers, timeout, minSize }
 * @returns {Promise<number>} 写入的字节数
 */
async function downloadFile(url, filePath, opts = {}) {
  const { minSize = 1024 } = opts;
  const { buffer, status, headers } = await request(url, opts);
  if (status !== 200) throw new Error(`下载失败 HTTP ${status}：${url}`);
  const type = String(headers['content-type'] || '');
  if (type && !type.startsWith('image/')) throw new Error(`不是图片资源（${type}）：${url}`);
  if (buffer.length < minSize) throw new Error(`图片过小疑似占位图（${buffer.length}B）：${url}`);

  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, buffer);
  return buffer.length;
}

module.exports = { request, httpJson, downloadFile, BROWSER_UA };
