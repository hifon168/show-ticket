/**
 * 公网演出数据源适配器 —— 猫眼 / 大众点评演出（myshow）
 * ------------------------------------------------------------
 * 真实公开接口（无需鉴权，页面同款请求）：
 *   基址        https://m.dianping.com/myshow
 *   分类导航    GET /ajax/performance/navigation
 *   城市反查    GET /ajax/city/currentCity?lat={lat}&lng={lng}
 *   演出列表    GET /ajax/performances/{categoryId};st={sort};p={page};s={size};tft=0?cityId={cityId}
 *   演出详情    GET /ajax/performance/{performanceId}
 *   演出海报    data[].posterUrl（真实 CDN 图片，非 AI 生成）
 *
 * 注意：列表接口不要带 sellChannel 参数，否则服务端会忽略 cityId 返回定位城市的演出。
 *
 * 输出统一结构的 objects，交给 syncService 落库：
 *   { sourceId, title, subtitle, category, poster, artist, venueName, city, address,
 *     startTime, endTime, minPrice, maxPrice, tags, description, latitude, longitude }
 */
const { httpJson } = require('../../utils/http');

const BASE = 'https://m.dianping.com/myshow';
const REFERER = 'https://show.maoyan.com/';

const DEFAULT_HEADERS = { Referer: REFERER, Origin: 'https://show.maoyan.com' };

/** 数据源方分类ID -> 本站分类枚举 */
const CATEGORY_MAP = {
  1: 'concert', // 演唱会
  6: 'concert', // 音乐会
  10: 'festival', // 音乐节
  17: 'festival', // Livehouse
  4: 'drama', // 话剧音乐剧
  3: 'drama', // 戏曲艺术
  14: 'drama', // 沉浸剧场
  5: 'drama', // 舞蹈芭蕾
  15: 'talk', // 脱口秀
  16: 'talk', // 相声
  2: 'sports', // 体育赛事
  12: 'sports', // 电竞赛事
  7: 'other', // 亲子演出
  9: 'other', // 休闲展览
  8: 'other', // 其他
};

/** 默认抓取的分类ID（对应演唱会/音乐节/话剧/脱口秀/音乐会/体育） */
const DEFAULT_CATEGORY_IDS = [1, 10, 4, 15, 6, 2];

/**
 * 城市中心坐标：用于 currentCity 接口反查数据源的城市ID。
 * 未在此表中的城市会自动跳过（可自行补充后重启服务）。
 */
const CITY_COORDS = {
  北京: [39.9042, 116.4074], 上海: [31.2304, 121.4737], 广州: [23.1291, 113.2644],
  深圳: [22.5431, 114.0579], 杭州: [30.2741, 120.1551], 成都: [30.5728, 104.0668],
  重庆: [29.563, 106.5516], 南京: [32.0603, 118.7969], 武汉: [30.5928, 114.3055],
  西安: [34.3416, 108.9398], 天津: [39.1256, 117.2168], 苏州: [31.2989, 120.5853],
  长沙: [28.2282, 112.9388], 郑州: [34.7466, 113.6254], 青岛: [36.0671, 120.3826],
  沈阳: [41.8057, 123.4315], 昆明: [25.0389, 102.7183], 厦门: [24.4798, 118.0894],
  福州: [26.0745, 119.2965], 宁波: [29.8683, 121.544], 合肥: [31.8206, 117.2272],
  东莞: [23.0207, 113.7518], 哈尔滨: [45.8038, 126.5349], 济南: [36.6512, 117.1201],
  大连: [38.914, 121.6147], 无锡: [31.4912, 120.3119], 温州: [27.9943, 120.6994],
  南昌: [28.682, 115.8579], 南宁: [22.817, 108.3665], 贵阳: [26.647, 106.6302],
  兰州: [36.0611, 103.8343], 太原: [37.8706, 112.5489], 石家庄: [38.0428, 114.5149],
  长春: [43.8171, 125.3235], 常州: [31.8113, 119.9741], 佛山: [23.0215, 113.1218],
  珠海: [22.2707, 113.5767], 乌鲁木齐: [43.8256, 87.6168], 拉萨: [29.652, 91.1721],
  呼和浩特: [40.8414, 111.7519], 银川: [38.4872, 106.2309], 西宁: [36.6171, 101.7782],
  海口: [20.0444, 110.1999], 三亚: [18.2528, 109.5119], 泉州: [24.8741, 118.6757],
  徐州: [34.2058, 117.1839], 烟台: [37.4638, 121.4479], 洛阳: [34.6197, 112.454],
  中国香港: [22.3193, 114.1694], 中国澳门: [22.1987, 113.5439], 台北: [25.033, 121.5654],
};

const pad = (n) => String(n).padStart(2, '0');
const toMysql = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/* ============================ 工具 ============================ */

/** 带并发限制地执行一批异步任务 */
async function mapLimit(tasks, limit, iterator) {
  const results = new Array(tasks.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, tasks.length)).fill(0).map(async () => {
    while (cursor < tasks.length) {
      const i = cursor++;
      try {
        results[i] = await iterator(tasks[i], i);
      } catch (e) {
        results[i] = null; // 单个任务失败不影响整体
      }
    }
  });
  await Promise.all(workers);
  return results.filter(Boolean);
}

/**
 * 解析演出时间文案 -> { startTime, endTime }
 * 兼容：
 *   2026.10.31 18:30 周六
 *   2026.11.14 / 11.15
 *   2026.10.23 - 11.01
 *   2026.10.23 - 2027.03.01
 *   2026.10.25 周日
 *   2026.10.24 / 10.27
 */
function parseShowTime(text) {
  if (!text) return null;
  const s = String(text).replace(/[－—~～]/g, '-').replace(/\s+/g, ' ').trim();
  if (!s) return null;

  // 首个完整日期
  const full = s.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (!full) return null;
  let [Y, M, D] = [Number(full[1]), Number(full[2]), Number(full[3])];

  // 紧跟的时间
  const timeM = s.match(/(\d{1,2}):(\d{2})/);
  const hasTime = !!timeM;

  const start = new Date(Y, M - 1, D, hasTime ? Number(timeM[1]) : 19, hasTime ? Number(timeM[2]) : 30, 0);
  if (Number.isNaN(start.getTime())) return null;

  // 结束日期：优先取分隔符右侧的日期
  let end = null;
  const tail = s.slice(full.index + full[0].length);
  const m2 = tail.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/); // 跨年写法 2027.03.01
  const m3 = tail.match(/^[^\d]*(\d{1,2})[.\-/](\d{1,2})/); // 同年简写 11.15
  if (m2) {
    end = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]), 23, 59, 59);
  } else if (m3) {
    let eM = Number(m3[1]);
    const eD = Number(m3[2]);
    let eY = Y;
    // 「11.01」跟在「2026.10.23 -」后面，若月份小于起始月说明跨年了
    if (eM < M) eY = Y + 1;
    end = new Date(eY, eM - 1, eD, 23, 59, 59);
    if (end < start) end = null;
  }

  if (!end) {
    end = hasTime ? new Date(start.getTime() + 3 * 3600 * 1000) : new Date(Y, M - 1, D, 23, 59, 59);
  }

  return { startTime: toMysql(start), endTime: toMysql(end) };
}

/** 解析价区文案 -> { minPrice, maxPrice } */
function parsePrice(priceRange, lowestPrice) {
  let min = 0;
  let max = 0;
  const nums = String(priceRange || '').match(/\d+(?:\.\d+)?/g) || [];
  if (nums.length >= 2) {
    min = Number(nums[0]);
    max = Number(nums[1]);
  } else if (nums.length === 1) {
    min = Number(nums[0]);
    max = min;
  }
  if (!min && lowestPrice) min = Number(lowestPrice) || 0;
  if (!max) max = Math.max(min, Math.round(min * 3.5)); // 只有单值时给个合理上限
  if (min > max) [min, max] = [max, min];
  return { minPrice: min, maxPrice: max };
}

/** 从标题里尽力抽取艺人/剧目：命中「《》」优先，否则返回空（不臆造） */
function extractArtist(title) {
  if (!title) return '';
  const quoted = title.match(/《([^》]{1,30})》/);
  if (quoted) return quoted[1];
  // 「xxx音乐会/演唱会/ Live」前面的部分作为艺人，去掉城市和站次后缀
  const m = title.match(/^([^《]{1,20}?)(?:演唱会|音乐会|巡回演?唱?会|粉丝见面会|见面会|Live ?Tour|TOUR)/i);
  if (m) return m[1].replace(/[-—\s]*(北京|上海|广州|深圳|杭州|成都|重庆|南京|武汉|西安|天津|苏州)站?$/, '').trim();
  return '';
}

/* ============================ 接口封装 ============================ */

/** 拉取分类导航（包含全部演出门类） */
async function fetchCategories() {
  const json = await httpJson(`${BASE}/ajax/performance/navigation`, { headers: DEFAULT_HEADERS });
  if (!json || json.code !== 200) throw new Error('获取演出分类失败');
  return Array.isArray(json.data) ? json.data : [];
}

/** 按经纬度反查数据源的城市ID */
async function resolveCityId(cityName) {
  const coord = CITY_COORDS[cityName];
  if (!coord) return null;
  try {
    const json = await httpJson(`${BASE}/ajax/city/currentCity?lat=${coord[0]}&lng=${coord[1]}`, {
      headers: DEFAULT_HEADERS,
      timeout: 15000,
    });
    if (json && json.code === 200 && json.data && json.data.id) {
      return { id: Number(json.data.id), name: json.data.nm || cityName };
    }
  } catch (e) {
    /* 忽略，交给调用方跳过 */
  }
  return null;
}

/** 拉取指定城市 + 分类的演出列表（单页） */
async function fetchList({ cityId, categoryId, page = 1, pageSize = 20 }) {
  const url = `${BASE}/ajax/performances/${categoryId};st=0;p=${page};s=${pageSize};tft=0?cityId=${cityId}`;
  const json = await httpJson(url, { headers: DEFAULT_HEADERS, timeout: 20000 });
  if (!json || json.code !== 200) return { list: [], paging: null };
  return { list: Array.isArray(json.data) ? json.data : [], paging: json.paging || null };
}

/** 拉取演出详情（用于补全简介、座位图等） */
async function fetchDetail(performanceId) {
  const json = await httpJson(`${BASE}/ajax/performance/${performanceId}`, {
    headers: DEFAULT_HEADERS,
    timeout: 15000,
  });
  if (json && json.code === 200 && json.data) return json.data;
  return null;
}

/* ============================ 归一化 ============================ */

/** 单条原始数据 -> 本站结构 */
function toNormalizedItem(raw, cityName) {
  const title = String(raw.name || '').trim();
  if (!title) return null;

  const time = parseShowTime(raw.showTimeRange);
  if (!time) return null; // 无法确定开演时间的数据不要

  const price = parsePrice(raw.priceRange, raw.lowestPrice);
  const artist = extractArtist(title);
  // 简介：接口多数不提供，用真实字段拼一段（不使用任何虚构内容）
  const descParts = [
    raw.shopName ? `演出场馆：${raw.shopName}` : '',
    raw.address ? `场馆地址：${raw.address}` : '',
    raw.showTimeRange ? `演出时间：${raw.showTimeRange}` : '',
    raw.priceRange ? `票价区间：${raw.priceRange} 元` : '',
  ].filter(Boolean);
  const tags = [CATEGORY_MAP[raw.categoryId] === 'concert' ? '热门' : '推荐', raw.cityName || cityName].filter(Boolean);

  return {
    sourceId: `myshow-${raw.performanceId}`,
    title,
    subtitle: [raw.cityName || cityName, raw.shopName].filter(Boolean).join(' · ').slice(0, 255),
    category: CATEGORY_MAP[raw.categoryId] || 'other',
    poster: raw.posterUrl || '',
    artist,
    venueName: raw.shopName || '',
    city: raw.cityName || cityName,
    address: raw.address || '',
    startTime: time.startTime,
    endTime: time.endTime,
    minPrice: price.minPrice,
    maxPrice: price.maxPrice,
    tags: tags.join(','),
    description: descParts.join('\n'),
    latitude: Number(raw.lat) || 0,
    longitude: Number(raw.lng) || 0,
    // 原始素材，供同步器补充处理
    _raw: raw,
    _categoryName: '',
  };
}

/**
 * 按城市拉取真实演出数据
 * @param {object} opts
 *   cityNames     要同步的城市名数组
 *   categoryIds   数据源方分类ID数组，缺省 DEFAULT_CATEGORY_IDS
 *   pages         每个分类抓几页
 *   pageSize      每页条数
 *   withDetail    是否逐条拉取详情补全简介
 *   onProgress    (msg) => void
 * @returns {Promise<Array>} 归一化后的演出数组（已按 sourceId 去重）
 */
async function fetchShows(opts = {}) {
  const {
    cityNames = [],
    categoryIds = DEFAULT_CATEGORY_IDS,
    pages = 1,
    pageSize = 20,
    withDetail = true,
    onProgress = () => {},
  } = opts;

  const resolvedCities = [];
  for (const name of cityNames) {
    // eslint-disable-next-line no-await-in-loop
    const resolved = await resolveCityId(name);
    if (!resolved) {
      onProgress(`跳过城市「${name}」（缺少坐标，请补充 CITY_COORDS）`);
      continue;
    }
    resolvedCities.push({ id: resolved.id, name });
  }
  onProgress(`已定位 ${resolvedCities.length} 个城市：${resolvedCities.map((c) => c.name).join('、')}`);

  const all = [];

  // 先抓第 1 页，按 paging.hasMore 决定是否继续翻页（避免无效请求）
  for (const city of resolvedCities) {
    // eslint-disable-next-line no-await-in-loop
    const firstPage = await mapLimit(categoryIds, 3, async (cid) => {
      const { list, paging } = await fetchList({ cityId: city.id, categoryId: cid, page: 1, pageSize });
      return { cid, list, paging };
    });

    const restTasks = [];
    for (const item of firstPage) {
      const rows = item ? item.list : [];
      all.push(...rows.map((raw) => toNormalizedItem(raw, city.name)));
      if (!item || !item.paging || !item.paging.hasMore) continue;
      for (let p = 2; p <= pages; p++) {
        restTasks.push({ cityId: city.id, cityName: city.name, categoryId: item.cid, page: p });
      }
    }

    if (restTasks.length) {
      const restPages = await mapLimit(restTasks, 4, async (t) => {
        const { list } = await fetchList({ cityId: t.cityId, categoryId: t.categoryId, page: t.page, pageSize });
        return list.map((raw) => toNormalizedItem(raw, t.cityName));
      });
      all.push(...restPages.flat());
    }

    onProgress(`「${city.name}」抓取完成，累计 ${all.length} 条`);
  }

  // 按 sourceId 去重（同一演出可能出现在多个分类）
  const unique = new Map();
  for (const item of all) {
    if (item && !unique.has(item.sourceId)) unique.set(item.sourceId, item);
  }
  let items = [...unique.values()];
  onProgress(`去重后 ${items.length} 条真实演出`);

  // 可选：拉详情补全简介（真实演出介绍文案）
  if (withDetail && items.length) {
    let ok = 0;
    await mapLimit(items, 4, async (item) => {
      const d = await fetchDetail(item._raw.performanceId);
      if (!d) return;
      const desc = String(d.summary || d.detail || d.ticketNotes || '').replace(/<[^>]+>/g, ' ').trim();
      if (desc) {
        item.description = desc.slice(0, 4000);
        ok++;
      }
      if (!item.poster && d.posterUrl) item.poster = d.posterUrl;
    });
    onProgress(`详情补全 ${ok}/${items.length} 条`);
  }

  return items.map(({ _raw, _categoryName, ...rest }) => rest);
}

module.exports = {
  fetchShows,
  fetchCategories,
  fetchList,
  fetchDetail,
  resolveCityId,
  parseShowTime,
  parsePrice,
  extractArtist,
  CATEGORY_MAP,
  CITY_COORDS,
  DEFAULT_CATEGORY_IDS,
  SOURCE_NAME: 'myshow',
};
