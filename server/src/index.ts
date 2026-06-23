import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './common/logger.js';

const log = logger.child('startup');

async function checkNeteaseApi(): Promise<boolean> {
  try {
    const res = await fetch(config.netease.apiBase + '/cloudsearch?keywords=test&limit=1', {
      signal: AbortSignal.timeout(5_000),
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

  const apiOk = await checkNeteaseApi();
  if (apiOk) {
    log.info(`网易云 API 已连接: ${config.netease.apiBase}`);
  } else {
    log.warn(`网易云 API 未就绪: ${config.netease.apiBase}，歌曲搜索/播放将不可用`);
    log.warn('请确保已运行: cd netease-api && npm start');
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
