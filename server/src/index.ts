import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './common/logger.js';

process.on('unhandledRejection', (reason) => { console.error('Unhandled rejection:', reason); });
process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err); });

const log = logger.child('startup');

async function checkNeteaseApi(): Promise<boolean> {
  try {
    // Render 免费版冷启动需 30-60 秒，给足超时
    const res = await fetch(config.netease.apiBase + '/cloudsearch?keywords=test&limit=1', {
      signal: AbortSignal.timeout(45_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const { server } = createApp();

server.listen(config.port, async () => {
  console.log('');
  console.log('  ╔══════════════════════════════════╗');
  console.log('  ║    Claudio 个人AI电台 v2.0      ║');
  console.log('  ║                                ║');
  console.log(`  ║  服务地址: http://localhost:${config.port}  ║`);
  console.log(`  ║  WebSocket: ws://localhost:${config.port}/ws ║`);
  console.log('  ╚══════════════════════════════════╝');
  console.log('');

  log.info(`正在检查网易云 API (${config.netease.apiBase})...`);
  const apiOk = await checkNeteaseApi();
  if (apiOk) {
    log.info(`✅ 网易云 API 已连接: ${config.netease.apiBase}`);
  } else {
    log.error(`❌ 网易云 API 不可达: ${config.netease.apiBase}`);
    log.error('   歌曲搜索和播放将无法使用！');
    log.error('   本地开发: 请先运行 npm run dev:api (或 cd netease-api && npm start)');
    log.error('   生产环境: 请检查 NETEASE_API_BASE 环境变量是否正确');
  }
});

process.on('SIGINT', () => {
  logger.info('正在关闭...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
