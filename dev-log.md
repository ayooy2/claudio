# Claudio 开发日志

## 2026-06-26

### fix: 播放链路全面修复 — 网易云API配置+超时+错误处理
- **根因**: `render.yaml` 中 `NETEASE_API_BASE` 未设默认值，部署后指向 `localhost:3000`（不存在）
- **根因**: 音乐服务超时仅10秒，Render免费版冷启动需30-60秒
- **根因**: `ECONNREFUSED` 等连接失败无明确错误提示
- **修复**:
  - `render.yaml`: `NETEASE_API_BASE` 设为 `https://claudio-netease.onrender.com`
  - `music.service.ts`: 新增 `neteaseFetch()` 封装，45秒超时+2次重试+ECONNREFUSED检测
  - `app.ts`: 歌词接口超时从10s增至45s
  - `index.ts`: 启动健康检查超时从5s增至45s，日志更明确（✅/❌标识）
- **涉及文件**: `render.yaml`, `server/src/app.ts`, `server/src/index.ts`, `server/src/modules/music/music.service.ts`

### feat: 左右分屏布局 + 移动端适配
- 新增分屏布局：桌面端点击歌词按钮后，左侧封面+右侧歌词
- 可拖拽分割线：鼠标/触屏拖拽调整左右比例（25%~75%），双击重置50/50
- 分割线半透明设计，hover高亮
- 分屏时右侧歌词区域自带迷你进度条
- 移动端（<768px）保持全屏沉浸式歌词面板
- 移动端CSS优化：更大触控目标(44x44px)、紧凑头部、设置面板自适应宽度
- splitRatio持久化到localStorage
- **涉及文件**: `client/src/App.tsx`

### fix: 播放失败无反馈修复
- **问题**: `togglePlay` 使用 `.catch(() => {})` 静默吞掉所有播放错误，用户看不到任何提示
- **问题**: `attachAudio` 的 `onerror` 仅 `console.warn`，未设置 `playError`
- **修复**: `togglePlay` 无src时提示"没有可播放的歌曲"，播放失败时显示具体错误信息
- **修复**: `attachAudio` 的 `onerror` 区分 `MEDIA_ERR_ABORTED`（切换歌曲正常触发）和其他错误
- **修复**: 暴露 `setPlayError` 供 App.tsx 使用
- **涉及文件**: `client/src/hooks/usePlayer.ts`, `client/src/App.tsx`

---

## 历史重要改动

### fix: Admin后台与播放器打通
- SceneSettings 重写为使用 App.tsx 的 11 个真实场景
- MusicLibrary 收藏同步到 `claudio_favorites`
- SystemSettings 移除无效 API 配置，系统信息全部从 API 获取
- Dashboard 活跃场景数从 localStorage 读取
- LyricsManager "保存" → "导出 LRC"
- App.tsx 新增 useEffect 读取 `/api/prefs` 配置

### fix: 播放器loading状态管理
- 增加超时时间适配 Render 冷启动（45秒）

### fix: 黑胶/全屏封面容器背景透明 + 粒子特效
- `.cover-vinyl` 完全透明
- 为极光场景添加粒子特效

### feat: 歌单面板完整功能
- 支持多种导入格式（网易云链接、JSON、M3U、CSV）
- 批量操作、拖拽排序、点击外部关闭
- 修复降序模式下拖拽索引错误
- Promise.allSettled 替代 Promise.all
