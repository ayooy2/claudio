/**
 * Cloudflare Pages Functions — 音频代理
 * 将 /audio-proxy 请求代理到 Render 后端，流式传输音频。
 */

const BACKEND = 'https://claudio-api-rymi.onrender.com';

export const onRequest: PagesFunction = async (ctx) => {
  const url = new URL(ctx.request.url);
  const target = BACKEND + url.pathname + url.search;

  try {
    const backendRes = await fetch(target, {
      method: ctx.request.method,
      headers: ctx.request.headers,
      redirect: 'follow',
    });

    const headers = new Headers(backendRes.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.delete('content-encoding');

    return new Response(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Audio proxy error', detail: String(err) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
