import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiUrl } from '../lib/api.js';

// WebSocket 直连后端（不经过边缘代理，Pages Functions 不支持 WebSocket）
// 优先 VITE_WS_URL > VITE_API_BASE > 当前 origin
const WS_URL = (import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_BASE || `${location.protocol}//${location.host}`).replace(/\/$/, '');

export function useSocket() {
  const socket = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(WS_URL, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    socket.current = s;

    return () => { s.disconnect(); };
  }, []);

  return { socket: socket.current, connected };
}
