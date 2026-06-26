import { config } from '../../config.js';
import { logger } from '../../common/logger.js';

const log = logger.child('calendar');

export interface CalendarEvent {
  summary: string;
  start: string;
  end: string;
}

export interface CalendarResult {
  mock: boolean;
  events: CalendarEvent[];
}

export class CalendarService {
  async getTodayEvents(): Promise<CalendarResult> {
    if (config.mock.calendar) {
      log.info('使用 mock 日历数据');
      const today = new Date().toISOString().slice(0, 10);
      return {
        mock: true,
        events: [
          { summary: '每日站会', start: `${today}T09:30:00`, end: `${today}T09:45:00` },
          { summary: '项目评审', start: `${today}T14:00:00`, end: `${today}T15:00:00` },
        ],
      };
    }

    // Real Feishu API
    const { appId, appSecret } = config.feishu;
    if (!appId || !appSecret) {
      log.warn('飞书 appId/appSecret 未配置，返回空日历');
      return { mock: true, events: [] };
    }

    try {
      log.info('正在获取飞书日历事件');
      const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      });
      const tokenData = await tokenRes.json() as any;
      const token = tokenData?.tenant_access_token;
      if (!token) throw new Error('飞书 token 获取失败');

      const today = new Date().toISOString().slice(0, 10);
      const calRes = await fetch(
        `https://open.feishu.cn/open-apis/calendar/v4/calendars/primary/events?start_time=${today}T00:00:00+08:00&end_time=${today}T23:59:59+08:00`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const calData = await calRes.json() as any;
      const events = (calData?.data?.items ?? []).map((e: any) => ({
        summary: e.summary ?? '忙',
        start: e.start_time?.date_time ?? e.start_time?.date ?? '',
        end: e.end_time?.date_time ?? e.end_time?.date ?? '',
      }));
      log.info(`获取到 ${events.length} 个日历事件`);
      return { mock: false, events };
    } catch (err) {
      log.warn('飞书日历获取失败，回退到 mock 数据', err);
      return { mock: true, events: [] };
    }
  }
}

export const calendarService = new CalendarService();
