/**
 * API 基础路径工具
 * 开发模式：空字符串，走 Vite proxy（/api → localhost:8080）
 * 生产模式：VITE_API_BASE 环境变量（如 https://claudio-api.onrender.com）
 */
const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return BASE + path;
}
