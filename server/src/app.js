const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const { fail } = require('./utils/response');
const { startScheduler } = require('./services/scheduler');

const app = express();

// ---------------- 全局中间件 ----------------
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(
  express.json({
    limit: '1mb',
    // 保留原始报文，供微信支付异步通知验签使用
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

// ---------------- 健康检查 ----------------
app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { time: new Date(), env: config.env } });
});

// ---------------- 演出海报等静态资源 ----------------
app.use('/posters', express.static(path.join(__dirname, '../public/posters'), { maxAge: '7d' }));

// ---------------- 业务路由 ----------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/meta', require('./routes/meta'));
app.use('/api/shows', require('./routes/shows'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/pay', require('./routes/pay'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/user', require('./routes/user'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));

// ---------------- 生产环境托管前端静态资源 ----------------
const distPath = path.join(__dirname, '../../web/dist');
app.use(express.static(distPath));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) res.status(404).json(fail('接口不存在', 404));
  });
});

// ---------------- 404 / 错误处理 ----------------
app.use((req, res) => res.status(404).json(fail('接口不存在', 404)));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json(fail(err.message || '服务器内部错误', 500));
});

// ---------------- 启动 ----------------
app.listen(config.port, () => {
  console.log(`\n  🎫 演出票务后端服务已启动: http://localhost:${config.port}`);
  console.log(`     环境: ${config.env}\n`);
  // 启动每日演出资讯同步定时任务
  startScheduler();
});

module.exports = app;
