import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiUrl } from '../lib/api.js';

// 生产模式连接后端地址，开发模式连接当前 origin（走 Vite proxy）
const WS_URL = (import.meta.env.VITE_API_BASE || `${location.protocol}//${location.host}`).replace(/\/$/, '');

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
