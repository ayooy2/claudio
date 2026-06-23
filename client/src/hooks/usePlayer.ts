import { useRef, useState, useCallback } from 'react';

export interface SongInfo {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  fee: number;
  pop?: number;
  url: string | null;
  isTrial?: boolean;
  cover?: string | null;
}

export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<SongInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => {
    try {
      const s = localStorage.getItem('claudio_volume');
      if (!s) return 0.6;
      const parsed = JSON.parse(s);
      return typeof parsed === 'number' ? parsed : 0.6;
    } catch { return 0.6; }
  });
  const [isMuted, setIsMuted] = useState(false);
  const [volumeBeforeMute, setVolumeBeforeMute] = useState(volume);
  const volumeRef = useRef(volume);
  const [playError, setPlayError] = useState<string | null>(null);

  // Ref for play to avoid stale closures in auto-play scenarios
  const playRef = useRef<(song: SongInfo) => Promise<void>>(undefined!);

  const play = useCallback(async (song: SongInfo) => {
    setCurrent(song);
    setCurrentTime(0);
    setDuration(song.duration || 0);
    setPlayError(null);

    // If no URL, fetch it first (with one retry on failure)
    let url = song.url;
    if (!url) {
      setIsLoading(true);
      const maxAttempts = 2;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const res = await fetch(`/api/song-url?name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist)}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          url = data.url;
          if (url) {
            setCurrent(prev => prev ? { ...prev, url, id: data.id || prev.id, cover: data.cover || prev.cover } : prev);
          }
          break; // success
        } catch (e) {
          console.warn('获取URL失败:', e);
          if (attempt < maxAttempts - 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
      setIsLoading(false);
    }

    if (!url) {
      setIsPlaying(false);
      setPlayError('获取歌曲链接失败');
      return;
    }

    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.volume = volumeRef.current;
      audioRef.current.load();
      try {
        await audioRef.current.play();
        setPlayError(null);
      } catch (e: any) {
        // AbortError is expected when a new play interrupts an old one
        if (e?.name !== 'AbortError') {
          console.warn('播放失败:', e?.message);
          setIsPlaying(false);
          setPlayError('播放失败: ' + (e?.message || '未知错误'));
        }
      }
    }
  }, []);

  playRef.current = play;

  // Use functional update to avoid stale isPlaying closure
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    setIsPlaying(prev => {
      if (prev) {
        audioRef.current!.pause();
      } else {
        audioRef.current!.play().catch(() => {});
      }
      return !prev;
    });
  }, []);

  const setVolume = useCallback((v: number) => {
    const val = Math.max(0, Math.min(1, v));
    volumeRef.current = val;
    setVolumeState(val);
    if (audioRef.current) audioRef.current.volume = val;
    setIsMuted(false);
    try { localStorage.setItem('claudio_volume', JSON.stringify(val)); } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volumeBeforeMute;
      volumeRef.current = volumeBeforeMute;
      setVolumeState(volumeBeforeMute);
      setIsMuted(false);
    } else {
      setVolumeBeforeMute(volume);
      audioRef.current.volume = 0;
      volumeRef.current = 0;
      setVolumeState(0);
      setIsMuted(true);
    }
  }, [isMuted, volume, volumeBeforeMute]);

  const seek = useCallback((pct: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = (audioRef.current.duration || 0) * pct;
    }
  }, []);

  return {
    audioRef, current, setCurrent, isPlaying, setIsPlaying, isLoading,
    currentTime, setCurrentTime, duration, setDuration,
    volume, isMuted, play, playRef, togglePlay, setVolume, toggleMute, seek,
    playError, clearError: () => setPlayError(null),
  };
}
