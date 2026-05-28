import { Router } from 'express';
import { getStore } from '../store/index.js';

export const planRouter = Router();

planRouter.get('/today', async (_req, res) => {
  const store = getStore();
  let plan = store.getTodayPlan();

  if (plan.length === 0) {
    // Auto-generate daily plan
    const today = new Date().toISOString().slice(0, 10);
    const isWeekend = [0, 6].includes(new Date().getDay());
    const slots = isWeekend
      ? [
          { time_slot: '09:00', mood: 'relaxed', playlist: ['Bossa Nova', '轻快爵士'], notes: '周末自然醒' },
          { time_slot: '12:00', mood: 'happy', playlist: ['欢快流行', 'Funk'], notes: '午餐时光' },
          { time_slot: '15:00', mood: 'casual', playlist: ['随机推荐'], notes: '下午自由活动' },
          { time_slot: '19:00', mood: 'happy', playlist: ['派对/聚会'], notes: '周末夜晚' },
          { time_slot: '22:00', mood: 'calm', playlist: ['舒缓爵士', '民谣'], notes: '放松入睡' },
        ]
      : [
          { time_slot: '07:30', mood: 'wake_up', playlist: ['轻快流行', 'City Pop'], notes: '起床唤醒' },
          { time_slot: '09:00', mood: 'focus', playlist: ['后摇', '氛围音乐'], notes: '上午专注' },
          { time_slot: '12:00', mood: 'relaxed', playlist: ['民谣', 'J-Pop'], notes: '午休放松' },
          { time_slot: '13:30', mood: 'focus', playlist: ['Lo-Fi Hip Hop', '古典'], notes: '下午工作' },
          { time_slot: '15:00', mood: 'energetic', playlist: ['流行摇滚', '电子'], notes: '午后提神' },
          { time_slot: '18:00', mood: 'casual', playlist: ['随机推荐', '热门新歌'], notes: '下班通勤' },
          { time_slot: '20:00', mood: 'relaxed', playlist: ['R&B', 'Soul'], notes: '晚间休闲' },
          { time_slot: '22:30', mood: 'calm', playlist: ['爵士钢琴', '纯音乐'], notes: '准备入睡' },
        ];

    plan = [];
    for (const s of slots) {
      plan.push(store.setPlan(today, s.time_slot, s.mood, s.playlist, s.notes));
    }
  }

  res.json(plan);
});
