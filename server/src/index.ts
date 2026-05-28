import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './common/logger.js';

const { server } = createApp();

server.listen(config.port, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════╗');
  console.log('  ║    Claudio 个人AI电台 v2.0      ║');
  console.log('  ║                                ║');
  console.log(`  ║  服务地址: http://localhost:${config.port}  ║`);
  console.log(`  ║  WebSocket: ws://localhost:${config.port}/ws ║`);
  console.log('  ╚══════════════════════════════════╝');
  console.log('');
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
