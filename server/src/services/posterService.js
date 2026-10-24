/**
 * 演出海报生成服务
 * ------------------------------------------------------------
 * 同步/录入的演出常常没有海报图，页面会出现大片空白占位。
 * 这里按「演出分类 + 标题 + 艺人」生成一张 SVG 海报，零外网依赖：
 *   - 文件写入 server/public/posters/{id}.svg
 *   - shows.poster 存 '/posters/{id}.svg'，由 Express 静态托管
 * 前端 <img src="/posters/12.svg"> 同源直出。
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../../public/posters');

/** 分类主题：渐变配色 + 徽标文案 */
const THEMES = {
  concert: { from: '#ff3a6a', to: '#7c5cff', label: '演唱会' },
  drama: { from: '#2f6fed', to: '#00b8a9', label: '话剧歌剧' },
  talk: { from: '#ff9f1c', to: '#ff3a6a', label: '脱口秀' },
  festival: { from: '#8b5cf6', to: '#ec4899', label: '音乐节' },
  sports: { from: '#0ea5e9', to: '#22c55e', label: '体育赛事' },
  other: { from: '#64748b', to: '#334155', label: '精彩演出' },
};

/** XML 转义，防止标题中的 & < > 破坏 SVG */
function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

/** 标题折行：按视觉宽度切分（中文按 1 字、英文数字按 0.55 字计） */
function wrap(text, perLine = 9, maxLines = 3) {
  const lines = [];
  let cur = '';
  let width = 0;
  for (const ch of String(text || '')) {
    const w = /[\x00-\xff]/.test(ch) ? 0.55 : 1;
    if (width + w > perLine) {
      lines.push(cur);
      cur = ch;
      width = w;
      if (lines.length === maxLines) break;
    } else {
      cur += ch;
      width += w;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines) {
    // 超出行数用省略号收尾
    const last = lines[maxLines - 1];
    if (String(text).length > lines.join('').length) lines[maxLines - 1] = last.slice(0, -1) + '…';
  }
  return lines;
}

/** 生成海报 SVG 字符串（600 x 800，3:4 竖版） */
function buildPosterSvg({ id, title = '演出', artist = '', venue = '', city = '', startTime = '', category = 'other' }) {
  const t = THEMES[category] || THEMES.other;
  const lines = wrap(title, 9, 3);
  const startY = 300 - (lines.length - 1) * 26; // 标题块垂直居中

  const titleSvg = lines
    .map(
      (l, i) =>
        `<text x="60" y="${startY + i * 56}" font-size="46" font-weight="700" fill="#ffffff" font-family="PingFang SC,Microsoft YaHei,sans-serif">${esc(l)}</text>`
    )
    .join('');

  const dateText = startTime ? String(startTime).slice(0, 10).replace(/-/g, '.') : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <defs>
    <linearGradient id="bg${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${t.from}"/>
      <stop offset="100%" stop-color="${t.to}"/>
    </linearGradient>
    <linearGradient id="veil${id}" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="rgba(0,0,0,0.55)"/>
      <stop offset="60%" stop-color="rgba(0,0,0,0)"/>
    </linearGradient>
  </defs>
  <rect width="600" height="800" fill="url(#bg${id})"/>
  <circle cx="520" cy="90" r="150" fill="rgba(255,255,255,0.10)"/>
  <circle cx="70" cy="700" r="200" fill="rgba(255,255,255,0.08)"/>
  <circle cx="470" cy="330" r="60" fill="rgba(255,255,255,0.12)"/>
  <rect width="600" height="800" fill="url(#veil${id})"/>
  <rect x="60" y="150" width="${30 + t.label.length * 22}" height="44" rx="22" fill="rgba(255,255,255,0.22)"/>
  <text x="${75 + 0}" y="179" font-size="24" fill="#ffffff" font-family="PingFang SC,Microsoft YaHei,sans-serif">${esc(t.label)}</text>
  ${titleSvg}
  <g font-family="PingFang SC,Microsoft YaHei,sans-serif" fill="rgba(255,255,255,0.92)">
    <text x="60" y="470" font-size="26">${esc(artist || '精彩演出')}</text>
    <text x="60" y="700" font-size="22" fill="rgba(255,255,255,0.78)">${esc([city, venue].filter(Boolean).join(' · '))}</text>
    <text x="60" y="736" font-size="22" fill="rgba(255,255,255,0.78)">${esc(dateText)}</text>
  </g>
  <rect x="60" y="500" width="80" height="4" rx="2" fill="rgba(255,255,255,0.7)"/>
</svg>`;
}

/** 确保海报目录存在 */
function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}

/**
 * 为一场演出生成海报文件
 * @returns {string|null} 可访问的 URL，如 '/posters/12.svg'
 */
function generatePoster(show) {
  if (!show || !show.id) return null;
  ensureDir();
  const file = path.join(DIR, `${show.id}.svg`);
  const svg = buildPosterSvg({
    id: show.id,
    title: show.title,
    artist: show.artist,
    venue: show.venue_name || show.venueName,
    city: show.city,
    startTime: show.start_time || show.startTime,
    category: show.category,
  });
  fs.writeFileSync(file, svg, 'utf8');
  return `/posters/${show.id}.svg`;
}

module.exports = { generatePoster, buildPosterSvg, POSTER_DIR: DIR };
