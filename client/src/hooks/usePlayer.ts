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

    // Abort any in-flight fetch
    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 15000);

    let url = song.url;
    if (!url) {
      setIsLoading(true);
      const maxAttempts = 2;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const res = await fetch(
            `/api/song-url?name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist)}`,
            { signal: abortCtrl.signal }
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          url = data.url;
          if (url) {
            setCurrent(prev => prev ? { ...prev, url, id: data.id || prev.id, cover: data.cover || prev.cover } : prev);
          }
          break;
        } catch (e: any) {
          if (e?.name === 'AbortError') break;
          console.warn(`获取URL失败 (attempt ${attempt + 1}):`, e);
          if (attempt < maxAttempts - 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
      setIsLoading(false);
    }

    clearTimeout(timeoutId);

    if (!url) {
      setIsPlaying(false);
      setPlayError('获取歌曲链接失败');
      return;
    }

    // Play with audio element
    const audio = audioRef.current;
    if (!audio) {
      setPlayError('播放器未就绪');
      return;
    }

    // Stop current playback first
    try { audio.pause(); } catch {}

    audio.src = url;
    audio.volume = volumeRef.current;
    audio.load();

    // Wait for canplay before calling play()
    try {
      await new Promise<void>((resolve, reject) => {
        const onCanPlay = () => { cleanup(); resolve(); };
        const onErr = () => {
          cleanup();
          const err = audio.error;
          reject(new Error(err ? `媒体错误 code=${err.code}` : '加载失败'));
        };
        const cleanup = () => {
          audio.removeEventListener('canplay', onCanPlay);
          audio.removeEventListener('error', onErr);
        };
        audio.addEventListener('canplay', onCanPlay, { once: true });
        audio.addEventListener('error', onErr, { once: true });
        // Timeout for loading
        setTimeout(() => { cleanup(); reject(new Error('加载超时')); }, 10000);
      });

      await audio.play();
      setIsPlaying(true);
      setPlayError(null);
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        // New play interrupted this one — don't show error
        return;
      }
      console.warn('播放失败:', e?.message);
      setIsPlaying(false);
      setPlayError(e?.message || '播放失败');
    }
  }, []);

  playRef.current = play;

  // Use functional update to avoid stale isPlaying closure
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
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
    volume, volumeRef, isMuted, play, playRef, togglePlay, setVolume, toggleMute, seek,
    playError, clearError: () => setPlayError(null),
  };
}
