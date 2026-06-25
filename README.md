# 🎵 Claudio — 个人 AI 音乐电台

一个基于网易云音乐的个人 AI 音乐播放器，支持搜索、播放、歌词、收藏、队列管理等功能。

## 功能特性

- 🔍 **搜索播放** — 搜索网易云音乐并在线播放
- 📋 **播放队列** — 队列管理、上一曲/下一曲、循环模式
- 📝 **歌词显示** — LRC 歌词同步显示 + 沉浸式歌词模式
- ❤️ **收藏管理** — 收藏喜欢的歌曲
- 🎨 **自适应布局** — 三档自适应字体，封面/时钟可切换
- 📱 **PWA 支持** — 可安装为桌面应用
- 🤖 **AI 对话** — DeepSeek 驱动的智能对话
- 🌤️ **天气播报** — OpenWeather 天气信息
- 🔊 **TTS 语音** — Fish Audio / 阿里云语音合成

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite 6 + TailwindCSS 4 |
| 后端 | Express 4 + Socket.IO + TypeScript |
| 音乐源 | NeteaseCloudMusicApi |
| AI | DeepSeek API |

## 本地开发

```bash
# 安装依赖
npm install

# 启动所有服务（网易云API + 后端 + 前端）
npm run dev
```

访问 http://localhost:5173

## 线上部署

### 1. 推送到 GitHub

```bash
git remote add origin https://github.com/ayooy2/claudio.git
git push -u origin master
```

### 2. 部署网易云 API（Render.com）

1. 打开 [render.com](https://render.com) → 登录 GitHub
2. **New** → **Web Service** → 选择 `ayooy2/claudio`
3. 配置：
   - **Name**: `claudio-netease`
   - **Root Directory**: `netease-api`
   - **Build Command**: `npm ci`
   - **Start Command**: `npx NeteaseCloudMusicApi -p 3000`
4. 创建后获得 URL: `https://claudio-netease.onrender.com`

### 3. 部署后端 API（Render.com）

1. **New** → **Web Service** → 选择 `ayooy2/claudio`
2. 配置：
   - **Name**: `claudio-api`
   - **Build Command**: `npm ci --workspace=server && npm run build -w server`
   - **Start Command**: `node server/dist/index.js`
3. 添加环境变量：
   - `NODE_ENV` = `production`
   - `NETEASE_API_BASE` = `https://claudio-netease.onrender.com`（步骤2的URL）
   - `BRAIN_API_KEY` = 你的 DeepSeek API Key
   - 其他可选变量见 `.env.example`
4. 创建后获得 URL: `https://claudio-api.onrender.com`

### 4. 部署前端（Cloudflare Pages）

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Pages**
2. **Connect to Git** → 选择 `ayooy2/claudio`
3. 配置：
   - **Framework preset**: Vite
   - **Build command**: `npm ci --workspace=client && npm run build -w client`
   - **Build output directory**: `client/dist`
4. 添加环境变量：
   - `VITE_API_BASE` = `https://claudio-api.onrender.com`（步骤3的URL）
5. 部署后获得 URL: `https://claudio.pages.dev`

### 部署架构

```
浏览器
  ├──→ Cloudflare Pages (前端)
  │    https://claudio.pages.dev
  │
  └──→ Render.com (后端)
       https://claudio-api.onrender.com
       └──→ Render.com (网易云 API)
            https://claudio-netease.onrender.com
```

## 费用

| 服务 | 平台 | 费用 |
|------|------|------|
| 前端 | Cloudflare Pages | 免费 |
| 后端 | Render.com | 免费（会休眠） |
| 网易云 API | Render.com | 免费（会休眠） |

> ⚠️ Render 免费版在 15 分钟无请求后休眠，首次访问需等待 ~30 秒冷启动。

## 项目结构

```
claudio/
├── client/          # 前端 React 应用
│   ├── src/
│   │   ├── hooks/   # usePlayer, useSocket 等
│   │   ├── components/  # SearchPanel, QueueDrawer 等
│   │   └── lib/     # 工具函数
│   └── vite.config.ts
├── server/          # 后端 Express 服务
│   └── src/
│       ├── modules/ # music, weather, tts 等模块
│       └── common/  # logger, config 等
├── netease-api/     # 网易云音乐 API 代理
├── render.yaml      # Render 部署配置
└── docker/          # Docker 部署配置
```

## License

MIT
