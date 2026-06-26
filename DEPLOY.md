# Claudio 部署指南

## 架构

```
┌─────────────────────┐     ┌──────────────────────┐
│  Cloudflare Pages   │     │   Render (Backend)    │
│  (前端静态站点)       │────▶│   Express + Socket.IO │
│  *.pages.dev        │     │   *.onrender.com      │
└─────────────────────┘     └──────────┬───────────┘
                                       │
                            ┌──────────▼───────────┐
                            │   Render (Netease)    │
                            │   NeteaseCloudMusicApi│
                            │   *.onrender.com      │
                            └──────────────────────┘
```

## 第一步：部署后端到 Render

### 1.1 注册 Render
1. 访问 https://render.com 注册账号（可用 GitHub 登录）

### 1.2 创建 Netease API 服务
1. Dashboard → New → Web Service
2. 连接 GitHub 仓库 `ayooy2/claudio`
3. 配置：
   - **Name**: `claudio-netease`
   - **Region**: Singapore (离中国最近)
   - **Branch**: `master`
   - **Root Directory**: `netease-api`
   - **Runtime**: Node
   - **Build Command**: `npm ci`
   - **Start Command**: `npx NeteaseCloudMusicApi -p 3000`
   - **Plan**: Free
4. 点击 Create Web Service
5. 记下生成的 URL，如 `https://claudio-netease-xxxx.onrender.com`

### 1.3 创建主后端服务
1. Dashboard → New → Web Service
2. 连接同一个 GitHub 仓库
3. 配置：
   - **Name**: `claudio-api`
   - **Region**: Singapore
   - **Branch**: `master`
   - **Root Directory**: (留空，根目录)
   - **Runtime**: Node
   - **Build Command**: `npm ci --workspace=server && npm run build -w server`
   - **Start Command**: `node server/dist/index.js`
   - **Plan**: Free
4. 添加环境变量：

| Key | Value | 说明 |
|-----|-------|------|
| `NODE_ENV` | `production` | |
| `NETEASE_API_BASE` | `https://claudio-netease-xxxx.onrender.com` | 上一步的 URL |
| `CORS_ORIGINS` | `https://claudio.pages.dev` | 前端域名（后面会更新） |
| `BRAIN_API_URL` | `https://api.deepseek.com` | AI 服务地址 |
| `BRAIN_API_KEY` | (你的 API Key) | 可选 |
| `BRAIN_MODEL` | `deepseek-chat` | |
| `OPENWEATHER_API_KEY` | (你的 API Key) | 可选 |
| `OPENWEATHER_CITY` | `Beijing` | |

5. 创建后记下 URL，如 `https://claudio-api-xxxx.onrender.com`

> ⚠️ Render 免费版会在 15 分钟无请求后休眠，首次请求需 30-60 秒冷启动。

---

## 第二步：部署前端到 Cloudflare Pages

### 2.1 注册 Cloudflare
1. 访问 https://dash.cloudflare.com 注册
2. 左侧菜单 → Workers & Pages

### 2.2 创建 Pages 项目
1. Create application → Pages → Connect to Git
2. 授权 GitHub，选择 `ayooy2/claudio` 仓库
3. 配置：
   - **Production branch**: `master`
   - **Framework preset**: None
   - **Build command**: `npm run build -w client`
   - **Build output directory**: `client/dist`
4. 添加环境变量：

| Key | Value |
|-----|-------|
| `VITE_API_BASE` | `https://claudio-api-xxxx.onrender.com` |

5. 保存并部署
6. 部署成功后会得到 URL：`https://claudio.pages.dev`（或类似）

### 2.3 更新后端 CORS
回到 Render 的 `claudio-api` 服务，将 `CORS_ORIGINS` 更新为实际的 Cloudflare Pages URL。

---

## 第三步：验证

1. 打开 `https://claudio.pages.dev`
2. 搜索一首歌并播放
3. 检查管理后台 `https://claudio.pages.dev/admin`

---

## 其他设备继续开发

### 克隆仓库
```bash
git clone https://github.com/ayooy2/claudio.git
cd claudio
npm install
```

### 本地开发
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env，填入必要配置
# NETEASE_API_BASE=http://localhost:3000
# BRAIN_API_URL=https://api.deepseek.com
# BRAIN_API_KEY=your_key

# 启动所有服务（前端 + 后端 + 网易云API）
npm run dev
```

前端: http://localhost:5173
后端: http://localhost:8080
管理后台: http://localhost:5173/admin

### 提交代码
```bash
git add -A
git commit -m "your message"
git push origin master
```

推送后 Cloudflare Pages 和 Render 会自动重新部署。

---

## 常见问题

### Q: 后端休眠了怎么办？
Render 免费版 15 分钟无请求会休眠。首次访问需等 30-60 秒。可以使用 UptimeRobot 等服务定时 ping 保持活跃。

### Q: 如何自定义域名？
- Cloudflare Pages: Settings → Custom domains → 添加你的域名
- Render: Settings → Custom domains

### Q: 如何查看日志？
- Render: Dashboard → 服务 → Logs
- Cloudflare Pages: 部署详情 → Functions logs

### Q: Socket.IO 连不上？
确保 `CORS_ORIGINS` 包含前端域名，且 Render 服务没有休眠。
