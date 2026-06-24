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

    // 停止当前播放
    try { audio.pause(); } catch {}

    // 先添加事件监听，再设置 src（浏览器会在 src 赋值后自动开始加载）
    try {
      await new Promise<void>((resolve, reject) => {
        const onCanPlay = () => { cleanup(); resolve(); };
        const onErr = () => {
          cleanup();
          const err = audio.error;
          if (!err) return resolve();
          // ABORTED = 新播放中断旧播放，不算错误
          if (err.code === MediaError.MEDIA_ERR_ABORTED) return resolve();
          const errMsg = ['', '用户中止', '网络错误', '解码错误', '格式不支持'][err.code] || '未知';
          reject(new Error(`媒体错误 code=${err.code} (${errMsg})`));
        };
        const cleanup = () => {
          audio.removeEventListener('canplay', onCanPlay);
          audio.removeEventListener('error', onErr);
          clearTimeout(timer);
        };
        audio.addEventListener('canplay', onCanPlay, { once: true });
        audio.addEventListener('error', onErr, { once: true });
        // 设置 src 触发加载
        audio.src = url;
        audio.volume = volumeRef.current;
        // 如果同一首歌已经可以播放，直接 resolve（在 src 赋值后检查）
        if (audio.currentSrc === url && audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          cleanup(); resolve(); return;
        }
        // 超时
        const timer = setTimeout(() => { cleanup(); reject(new Error('加载超时（10s）')); }, 10000);
      });

      await audio.play();
      setIsPlaying(true);
      setPlayError(null);
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        // 新播放中断了旧播放，不算错误
        return;
      }
      // code=4 且有 URL 时，可能是 URL 过期，尝试强制重新获取
      if (e?.message?.includes('code=4') && song.url) {
        console.warn('媒体错误 code=4，尝试重新获取 URL...');
        try {
          const res = await fetch(`/api/song-url?id=${song.id}&force=true`);
          const data = await res.json();
          if (data.url) {
            // 更新 song 的 url 和 queue 中的引用
            song.url = data.url;
            const a = audioRef.current!;
            a.src = data.url;
            a.volume = volumeRef.current;
            await new Promise<void>((resolve, reject) => {
              const onOk = () => { a.removeEventListener('error', onErr2); resolve(); };
              const onErr2 = () => { a.removeEventListener('canplay', onOk); reject(new Error('重试仍失败')); };
              a.addEventListener('canplay', onOk, { once: true });
              a.addEventListener('error', onErr2, { once: true });
              setTimeout(() => { a.removeEventListener('canplay', onOk); a.removeEventListener('error', onErr2); reject(new Error('重试超时')); }, 10000);
            });
            await a.play();
            setIsPlaying(true);
            setPlayError(null);
            return;
          }
        } catch (retryErr) {
          console.warn('重试失败:', retryErr);
        }
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
