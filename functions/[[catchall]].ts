/**
 * Cloudflare Pages Functions — 边缘代理
 * 仅代理 /api/* 和 /audio-proxy 请求到 Render 后端。
 * 静态文件（HTML/JS/CSS）由 Cloudflare Pages 直接服务，不经过此函数。
 */

const BACKEND = 'https://claudio-api-rymi.onrender.com';

// 只代理这些路径前缀
const PROXY_PREFIXES = ['/api/', '/audio-proxy'];

export const onRequest: PagesFunction = async (ctx) => {
  const url = new URL(ctx.request.url);
  const path = url.pathname;

  // 只代理 API 和音频请求，其他路径返回 404（让 Pages 服务静态文件）
  if (!PROXY_PREFIXES.some(p => path.startsWith(p))) {
    return new Response('Not Found', { status: 404 });
  }

  // 构造后端 URL
  const target = BACKEND + path + url.search;

  try {
    const backendRes = await fetch(target, {
      method: ctx.request.method,
      headers: ctx.request.headers,
      body: ctx.request.body,
      redirect: 'follow',
    });

    // 透传响应，添加 CORS 头
    const headers = new Headers(backendRes.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.delete('content-encoding'); // 避免双重压缩

    return new Response(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Edge proxy error', detail: String(err) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
