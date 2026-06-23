import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = `${location.protocol}//${location.host}`;

export function useSocket() {
  const socket = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(WS_URL, {
      path: '/ws',
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    socket.current = s;

    return () => { s.disconnect(); };
  }, []);

  return { socket: socket.current, connected };
}

// Use ref for handler to avoid re-binding on every render
export function useSocketEvent<T>(socket: Socket | null, event: string, handler: (data: T) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;
    const fn = (data: T) => handlerRef.current(data);
    socket.on(event, fn);
    return () => { socket.off(event, fn); };
  }, [socket, event]);
}
