/**
 * API 基础路径工具
 * 开发模式：空字符串，走 Vite proxy（/api → localhost:8080）
 * 生产模式：VITE_API_BASE 环境变量（如 https://claudio-api.onrender.com）
 */
const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return BASE + path;
}

/**
 * 将后端返回的 /api/audio-proxy 相对路径转换为绝对 URL
 * 后端返回 "/api/audio-proxy?url=..." 形式的相对路径，
 * 跨域部署时浏览器会将其解析到前端域名而非后端域名，导致播放失败。
 */
export function toAbsoluteUrl(url: string | null): string | null {
  if (!url) return null;
  // 已经是绝对 URL（http/https），直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // 相对路径，拼接后端 BASE
  return BASE + (url.startsWith('/') ? '' : '/') + url;
}
