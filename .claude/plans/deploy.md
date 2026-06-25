# 部署计划：Claudio 全栈上线

## 目标
将 Claudio 音乐播放器部署为在线服务，前端在 Cloudflare Pages，后端在 Render.com，
代码托管在 GitHub (ayooy2/claudio)。

## 架构

```
用户浏览器
    │
    ├──→ Cloudflare Pages (前端静态站)
    │    https://claudio.pages.dev
    │    ├─ index.html
    │    ├─ assets/ (JS/CSS)
    │    └─ 配置 API_BASE → 后端地址
    │
    └──→ Render.com (后端 Node.js)
         https://claudio.onrender.com
         ├─ Express 4 (REST API + 静态文件)
         ├─ Socket.IO (WebSocket)
         ├─ 音频代理 (/api/audio-proxy)
         └─ 调用 → NeteaseCloudMusicApi (Render 内部服务)
```

## 为什么不用 Cloudflare Workers

后端依赖：
- Node.js Streams（音频代理流式传输）
- Socket.IO（WebSocket 持久连接）
- 文件系统（TTS 缓存、wyy.json）
- NeteaseCloudMusicApi（374 个 Node.js 模块）

Workers 是 V8 isolates，不支持 Node.js API，改造成本远超收益。

## 部署步骤

### Step 1: 准备代码（我来做）

1. 修改 `client/vite.config.ts` — 生产环境 API 地址用环境变量
2. 创建 `render.yaml` — Render 部署配置
3. 更新 `.env.example` — 补全所有环境变量
4. 创建 `.gitignore` — 排除 node_modules、.env、dist 等
5. 创建 `README.md` — 项目说明 + 部署指南

### Step 2: 推送 GitHub（我来做）

```bash
git remote add origin https://github.com/ayooy2/claudio.git
git push -u origin master
```

### Step 3: 部署后端到 Render（用户操作）

1. 打开 https://render.com → 登录 GitHub
2. New → Web Service → 选 ayooy2/claudio
3. 配置：
   - Name: claudio-api
   - Environment: Node
   - Build Command: `npm ci --workspace=server && npm run build -w server`
   - Start Command: `node server/dist/index.js`
   - Environment Variables: 填入 API 密钥
4. 创建后获得 URL: `https://claudio-api.onrender.com`

### Step 4: 部署 Netease API 到 Render（用户操作）

1. New → Web Service → 选 ayooy2/claudio
2. 配置：
   - Name: claudio-netease
   - Environment: Node
   - Root Directory: `netease-api`
   - Build Command: `npm ci`
   - Start Command: `npx NeteaseCloudMusicApi -p 3000`
3. 创建后获得 URL: `https://claudio-netease.onrender.com`
4. 回到 claudio-api 设置中更新 `NETEASE_API_BASE` 为此 URL

### Step 5: 部署前端到 Cloudflare Pages（用户操作）

1. 打开 https://dash.cloudflare.com → Pages
2. Connect to Git → 选 ayooy2/claudio
3. 配置：
   - Framework preset: Vite
   - Build command: `npm ci --workspace=client && npm run build -w client`
   - Build output directory: `client/dist`
   - Environment Variables:
     - `VITE_API_BASE` = `https://claudio-api.onrender.com`
4. 部署后获得 URL: `https://claudio.pages.dev`

## 关键改动

### 1. client/vite.config.ts
```typescript
export default defineConfig({
  // ...
  define: {
    __API_BASE__: JSON.stringify(process.env.VITE_API_BASE || ''),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true },
      '/tts': 'http://localhost:8080'
    }
  }
});
```

### 2. client/src — API 请求基础路径
前端 fetch 调用改为：`fetch(__API_BASE__ + '/api/...')`，
开发模式下 `__API_BASE__` 为空字符串，走 Vite proxy。

### 3. render.yaml
```yaml
services:
  - type: web
    name: claudio-api
    runtime: node
    buildCommand: npm ci --workspace=server && npm run build -w server
    startCommand: node server/dist/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: NETEASE_API_BASE
        sync: false
      - key: BRAIN_API_KEY
        sync: false
      # ... 其他密钥

  - type: web
    name: claudio-netease
    runtime: node
    rootDir: netease-api
    buildCommand: npm ci
    startCommand: npx NeteaseCloudMusicApi -p 3000
```

## 费用

| 服务 | 平台 | 费用 |
|------|------|------|
| 前端 | Cloudflare Pages | 免费（无限带宽） |
| 后端 | Render.com | 免费（750h/月，会休眠） |
| 网易云 API | Render.com | 免费（750h/月，会休眠） |
| 域名 | Cloudflare | 免费（*.pages.dev） |

注意：Render 免费版会在 15 分钟无请求后休眠，首次访问需等待 ~30 秒冷启动。
