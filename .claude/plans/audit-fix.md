# 全面审计修复计划

## 问题汇总（5 Agent 并行分析）

### P0 - 必须修复（7 项）
1. 3 个路由未挂载（chat/taste/plan）— 死代码
2. 无 unhandledRejection 处理 — 进程可能崩溃
3. recommend() fetch 无超时 — 可能永久挂起
4. 收藏数据双写不一致（App vs SearchPanel）
5. claudio_recent_plays 从未写入 — 历史记录永远为空
6. queue 为空不清除旧数据 — 页面加载显示过期队列
7. services/api.ts 与 lib/api.ts 功能重叠

### P1 - 应该修复（10 项）
8. Socket.IO 建立连接但从未使用 — 浪费资源
9. localStorage useEffect 7 依赖触发全量序列化
10. CORS 完全开放 (origin: '*')
11. 5 个死组件未使用（ChatBar/Clock/Controls/DjMessage/useApi）
12. 15 处英文错误信息需翻译为中文
13. recommend() 缺少 AbortSignal.timeout
14. audio proxy 用 console 而非 logger
15. calendar/weather 服务无日志
16. 搜索输入无长度限制
17. 生产环境开启 sourcemap

### P2 - 建议修复（8 项）
18. wyy.json 同步读取应改异步+缓存
19. toggleMute 依赖导致不必要重建
20. 进度条拖拽 mouseup 监听器可能泄漏
21. PlayerService.queue 无上限
22. BRAIN_API_URL 默认值可能不正确
23. main.tsx keyboard handler 因 isAdmin 重绑定
24. admin 页面 fetch 失败无错误提示
25. useApi hook 所有 catch 返回空值
