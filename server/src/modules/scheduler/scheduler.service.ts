import cron from 'node-cron';
import { logger } from '../../common/logger.js';

const log = logger.child('scheduler');

type BroadcastFn = (data: Record<string, unknown>) => void;

export class SchedulerService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private jobs: any[] = [];
  private broadcast: BroadcastFn | null = null;

  start(broadcast: BroadcastFn) {
    this.broadcast = broadcast;

    // 07:00 Daily plan
    this.jobs.push(cron.schedule('0 7 * * *', () => {
      log.info('07:00 每日规划');
      broadcast({ type: 'scheduler', event: 'daily_plan', data: { message: '早上好！新的一天开始了，让我为你规划今天的音乐之旅。', time: '07:00', action: 'daily_plan' } });
    }));

    // 09:00 Switch to work mode (weekdays)
    this.jobs.push(cron.schedule('0 9 * * 1-5', () => {
      log.info('09:00 早间切换');
      broadcast({ type: 'scheduler', event: 'mode_switch', data: { message: '9点了，切换为专注模式。', time: '09:00', mood: 'focus', action: 'switch_work' } });
    }));

    // 12:00 Lunch
    this.jobs.push(cron.schedule('0 12 * * *', () => {
      log.info('12:00 午休切换');
      broadcast({ type: 'scheduler', event: 'mode_switch', data: { message: '午餐时间！来点轻松的音乐吧。', time: '12:00', mood: 'relaxed', action: 'switch_lunch' } });
    }));

    // 15:00 Afternoon energy (weekdays)
    this.jobs.push(cron.schedule('0 15 * * 1-5', () => {
      log.info('15:00 午后提神');
      broadcast({ type: 'scheduler', event: 'energy_boost', data: { message: '下午3点，来几首有节奏的歌提提神！', time: '15:00', mood: 'energetic', action: 'energy_boost' } });
    }));

    // 21:00 Night mode
    this.jobs.push(cron.schedule('0 21 * * *', () => {
      log.info('21:00 晚间放松');
      broadcast({ type: 'scheduler', event: 'mode_switch', data: { message: '夜幕降临，切换为舒缓模式。', time: '21:00', mood: 'calm', action: 'switch_night' } });
    }));

    // Hourly mood check
    this.jobs.push(cron.schedule('30 * * * *', () => {
      const h = new Date().getHours();
      if (h >= 7 && h <= 23) {
        broadcast({ type: 'scheduler', event: 'mood_check', data: { silent: true } });
      }
    }));

    log.info(`已注册 ${this.jobs.length} 个定时任务`);
  }

  stop() {
    for (const j of this.jobs) j.stop();
    this.jobs = [];
    log.info('所有定时任务已停止');
  }
}

export const schedulerService = new SchedulerService();
