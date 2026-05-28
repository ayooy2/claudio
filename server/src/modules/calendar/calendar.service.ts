import { config } from '../../config.js';

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
      return { mock: true, events: [] };
    }

    try {
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
      return { mock: false, events };
    } catch {
      return { mock: true, events: [] };
    }
  }
}

export const calendarService = new CalendarService();
