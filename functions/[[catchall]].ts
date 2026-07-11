/**
 * Cloudflare Pages Functions — 边缘代理
 * 将 HTTP 请求代理到 Render 后端，利用 Cloudflare 全球边缘节点降低延迟。
 * WebSocket (socket.io) 不经过此代理，客户端直连 Render。
 */

const BACKEND = 'https://claudio-api.onrender.com';

// 不代理的路径前缀
const SKIP_PREFIXES = ['/ws', '/socket.io'];

export const onRequest: PagesFunction = async (ctx) => {
  const url = new URL(ctx.request.url);
  const path = url.pathname;

  // 跳过 WebSocket 相关路径
  if (SKIP_PREFIXES.some(p => path.startsWith(p))) {
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
