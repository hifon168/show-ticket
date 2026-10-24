/**
 * 统一响应格式：{ code: 0 表示成功, message, data }
 */
function ok(data = null, message = 'ok') {
  return { code: 0, message, data };
}

function fail(message = '请求失败', code = 1, data = null) {
  return { code, message, data };
}

/** 分页数据包装 */
function page(list, total, pageNum, pageSize) {
  return {
    list,
    total,
    pageNum: Number(pageNum),
    pageSize: Number(pageSize),
    totalPage: Math.ceil(total / Number(pageSize)) || 0,
  };
}

module.exports = { ok, fail, page };
