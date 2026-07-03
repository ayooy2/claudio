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

### fix: 客户端错误信息透传
- **问题**: SearchPanel 搜索失败/选歌失败时只显示通用"获取播放链接失败"，用户无法知道真实原因
- **问题**: `play()` 函数忽略服务器返回的 `data.error`，只显示"获取歌曲链接失败"
- **修复**: 搜索失败显示服务器返回的具体错误（如"网易云API不可达"）
- **修复**: 选歌失败显示 `data.error` 而非通用提示
- **修复**: `play()` 捕获 `data.error` 并展示给用户
- **移动端**: 错误toast `bottom:70px`（避免与控制栏重叠），`max-width:90vw`，`word-break:break-word`
- **涉及文件**: `client/src/components/SearchPanel.tsx`, `client/src/hooks/usePlayer.ts`, `client/src/App.tsx`

### feat: 移动端全面适配
- **PlaylistPanel**:
  - 宽度从固定500px → 移动端100vw，解决溢出问题
  - 双栏布局 → 移动端tab切换（歌单列表/歌曲列表）
  - 按钮触控目标从18-28px → 36-44px（pl-btn/pl-btn-sm CSS类）
  - 禁用移动端HTML5拖拽（触屏不支持）
  - 歌曲行padding增大，提升可点击性
- **App.tsx 控制栏**:
  - 所有功能按钮移动端44-52px（Queue/Like/Lyrics/Mode/Volume）
  - Prev/Next 44px, Play 52px
  - 进度条触控区从4px → 20px（移动端），支持touch拖拽
  - 音量：移动端点击静音（移除hover依赖），桌面端保留滑块
  - 字体：时间码9px → 11px，队列位置9px → 11px
  - 歌词面板：关闭按钮44px，播放控制52-56px，时间码11px
- **SearchPanel**:
  - 关闭按钮/标签页/收藏按钮 → 44px触控目标
  - 搜索框字体14px → 15px
  - 添加sp-btn/sp-like-btn移动端CSS类
- **涉及文件**: `client/src/App.tsx`, `client/src/components/PlaylistPanel.tsx`, `client/src/components/SearchPanel.tsx`

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

## 2026-07-03

### fix: 播放逻辑永久修复 — 事件监听竞态/重试条件/togglePlay检测
- **根因1**: `usePlayer.ts` 中先设置 `audio.src` 再添加 `canplay` 事件监听器，缓存命中时 `canplay` 在监听器注册前触发，导致 Promise 永久挂起直到 30s 超时
- **根因2**: `audio.currentSrc === url` 比较失效 — 浏览器将 `currentSrc` 规范化为绝对URL，与相对路径 `/api/audio-proxy?url=...` 永远不匹配
- **根因3**: code=4 重试条件检查 `song.url`（播放列表歌曲始终为 null），导致 URL 过期重试永远不触发
- **根因4**: `togglePlay` 仅检查 `audio.src`，未检查 `audio.currentSrc`，部分场景误判为"没有可播放的歌曲"
- **修复**:
  - 先注册 `canplay`/`error` 监听器，再赋值 `audio.src`（消除竞态条件）
  - 改用 `readyState >= HAVE_FUTURE_DATA` 检测缓存命中（无需URL字符串比较）
  - code=4 重试不再依赖 `song.url` 条件
  - `togglePlay` 同时检查 `src` 和 `currentSrc`
  - 重试块同样修复事件监听顺序
  - 增强 `ensureAudioReady` 注释说明其用途
