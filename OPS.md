# Claudio 运维手册

## 架构总览

```
用户浏览器
    │
    ├──→ Cloudflare Pages (前端 + 边缘代理)
    │    https://claudio-1vy.pages.dev
    │    ├─ 静态文件: index.html, assets/*.js, sw.js
    │    ├─ functions/api/[[path]].ts → 代理 /api/* 到 Render
    │    └─ functions/audio-proxy.ts → 代理 /audio-proxy 到 Render
    │
    ├──→ Render (后端 API)
    │    https://claudio-api-rymi.onrender.com
    │    ├─ Express REST API
    │    ├─ Socket.IO (WebSocket)
    │    └─ 音频代理 → 网易CDN
    │
    └──→ Render (网易云 API)
         https://claudio-netease.onrender.com
         └─ NeteaseCloudMusicApi
```

## 常见问题排查

### 1. 网站打不开 (404)

**症状**: 访问 `claudio-1vy.pages.dev` 返回 "Not Found"

**排查步骤**:
1. 打开 Cloudflare Dashboard → Pages → claudio → Deployments
2. 检查最新部署状态：
   - 🟢 成功 → 检查 Build output directory 是否为 `client/dist`
   - 🔴 失败 → 点进去看错误日志
3. 如果部署成功但还是 404：
   - 检查 `functions/` 目录下的文件名是否正确
   - `functions/api/[[path]].ts` — 注意是双中括号 `[[]path]` 不对，必须是 `[[path]]`
   - `functions/audio-proxy.ts`

**修复**: 重新部署或修正文件名后 retry

### 2. API 请求失败

**症状**: 页面加载了但歌曲列表为空，搜索不工作

**排查步骤**:
1. 测试后端是否在线：
   ```bash
   curl https://claudio-api-rymi.onrender.com/api/playlist
   ```
2. 如果返回 404 或超时 → Render 服务休眠或挂了
3. 等 30-60 秒让 Render 冷启动，再试

**修复**: Render 免费版 15 分钟无请求会休眠。可用 UptimeRobot 定时 ping 保持活跃。

### 3. 歌曲播放失败

**症状**: 点击歌曲显示"播放失败"或一直加载中

**排查步骤**:
1. 打开浏览器 F12 → Network 标签
2. 找到失败的请求（通常是 `/api/song-url` 或 `/api/audio-proxy`）
3. 查看错误：
   - `410` → CDN URL 过期，刷新页面重试
   - `403` → 网易 CDN 拒绝，可能是 IP 被限
   - `502` → 后端代理错误
   - `timeout` → 网络慢或 Render 休眠

**修复**: 大多数情况刷新页面即可。如果持续失败，检查 Render 服务是否正常。

### 4. WebSocket 连不上

**症状**: 实时功能不工作（播放状态不同步）

**排查步骤**:
1. WebSocket 直连 Render 后端（不经过 Cloudflare 边缘）
2. 检查 `VITE_WS_URL` 环境变量是否设置为 `https://claudio-api-rymi.onrender.com`
3. 如果没设置，WebSocket 会尝试连接 `claudio-1vy.pages.dev`，但 Pages Functions 不支持 WebSocket

**修复**: 在 Cloudflare Pages Settings → Environment variables 添加 `VITE_WS_URL=https://claudio-api-rymi.onrender.com`

### 5. 歌曲匹配错误

**症状**: 播放的歌曲不是指定歌手的版本

**原因**: 搜索结果按热度排序，热门翻唱可能覆盖原版

**排查**: 搜索时会匹配 5 个结果并优先精确匹配歌手名。如果还是不对，可能是网易云没有该歌手的版本。

## 部署流程

### 推送代码
```bash
cd E:/Claudio
git add -A
git commit -m "你的改动说明"
git push origin master
```

推送后 Cloudflare Pages 和 Render 会自动重新部署。

### 手动重新部署
- **Cloudflare Pages**: Dashboard → Deployments → 最新记录 → Retry deployment
- **Render**: Dashboard → 服务 → Manual Deploy → Deploy latest commit

## 环境变量

### Cloudflare Pages (Settings → Environment variables)
| 变量 | 值 | 说明 |
|------|-----|------|
| `VITE_API_BASE` | `https://claudio-api-rymi.onrender.com` | API 后端地址 |
| `VITE_WS_URL` | `https://claudio-api-rymi.onrender.com` | WebSocket 地址 |

### Render 后端 (Settings → Environment)
| 变量 | 值 | 说明 |
|------|-----|------|
| `NODE_ENV` | `production` | |
| `CORS_ORIGINS` | `https://claudio-1vy.pages.dev,https://claudio-api-rymi.onrender.com` | 允许的跨域来源 |
| `NETEASE_API_BASE` | `https://claudio-netease.onrender.com` | 网易云 API 地址 |
| `NETEASE_COOKIE` | (你的 cookie) | 网易云登录 cookie |
| `BRAIN_API_URL` | `https://api.deepseek.com` | AI 服务地址 |
| `BRAIN_API_KEY` | (你的 key) | AI API Key |

## Pages Functions 文件结构

```
functions/
├── api/
│   └── [[path]].ts    ← 代理 /api/* 请求到 Render
└── audio-proxy.ts     ← 代理 /audio-proxy 请求到 Render
```

**重要**: `[[path]].ts` 的文件名必须是双中括号，不能是 `[[]path].ts`，否则 Cloudflare 不识别。

## 费用

| 服务 | 平台 | 费用 |
|------|------|------|
| 前端 + 边缘代理 | Cloudflare Pages | 免费 |
| 后端 API | Render | 免费（会休眠） |
| 网易云 API | Render | 免费（会休眠） |

## 关键链接

- **前端**: https://claudio-1vy.pages.dev
- **后端 API**: https://claudio-api-rymi.onrender.com
- **Cloudflare Dashboard**: https://dash.cloudflare.com/a8aaf2bd86d4592e244c700e69d6893a/pages/view/claudio
- **Render Dashboard**: https://dashboard.render.com
- **GitHub 仓库**: https://github.com/ayooy2/claudio
