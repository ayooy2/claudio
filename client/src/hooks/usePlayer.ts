import { useRef, useState, useCallback } from 'react';
import { apiUrl, toAbsoluteUrl } from '../lib/api.js';

// iOS Safari autoplay unlock — lazy AudioContext that resumes on first play()
let _audioCtx: AudioContext | null = null;
async function ensureAudioReady(): Promise<void> {
  try {
    if (!_audioCtx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) _audioCtx = new AC();
    }
    if (_audioCtx?.state === 'suspended') await _audioCtx.resume();
  } catch { /* non-critical */ }
}

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

export function usePlayer(qualityRef?: React.RefObject<number>) {
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
      return typeof parsed === 'number' ? Math.max(0, Math.min(1, parsed)) : 0.6;
    } catch { return 0.6; }
  });
  const [isMuted, setIsMuted] = useState(false);
  const [volumeBeforeMute, setVolumeBeforeMute] = useState(volume);
  const volumeRef = useRef(volume);
  const [playError, setPlayError] = useState<string | null>(null);

  // Ref for play to avoid stale closures in auto-play scenarios
  const playRef = useRef<(song: SongInfo) => Promise<void>>(undefined!);

  // Concurrency guard: increment on each play() call, ignore stale results
  const playSeqRef = useRef(0);

  const play = useCallback(async (song: SongInfo) => {
    const seq = ++playSeqRef.current;
    setCurrent(song);
    setCurrentTime(0);
    setDuration(song.duration || 0);
    setPlayError(null);

    let url = song.url;
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // 如果歌曲已有URL，无需加载，清除可能残留的 loading 状态
    if (url) {
      setIsLoading(false);
    }

    if (!url) {
      setIsLoading(true);
      try {
        const abortCtrl = new AbortController();
        // Render 免费版冷启动约需 30-60 秒，超时设为 45 秒
        timeoutId = setTimeout(() => abortCtrl.abort(), 45000);
        const maxAttempts = 2;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const brParam = qualityRef?.current ? `&br=${qualityRef.current}` : '';
            const res = await fetch(
              apiUrl(`/api/song-url?name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist)}${brParam}`),
              { signal: abortCtrl.signal }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            url = toAbsoluteUrl(data.url);
            if (url) {
              setCurrent(prev => prev ? { ...prev, url, id: data.id || prev.id, cover: data.cover || prev.cover } : prev);
            }
            break;
          } catch (e: unknown) {
            if (e instanceof Error && e.name === 'AbortError') { timedOut = true; break; }
            console.warn(`获取URL失败 (attempt ${attempt + 1}):`, e);
            if (attempt < maxAttempts - 1) {
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }
      } finally {
        // 仅当没有更新的 play() 调用时才清除 loading，避免竞态条件
        if (playSeqRef.current === seq) {
          setIsLoading(false);
        }
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    // If a newer play() has been called, abort this one
    if (playSeqRef.current !== seq) return;

    if (!url) {
      setIsPlaying(false);
      setPlayError(timedOut ? '连接超时，服务器可能正在启动中（约需30-60秒），请稍后重试' : '获取歌曲链接失败');
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
        let timer: ReturnType<typeof setTimeout> | undefined;
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
          if (timer) clearTimeout(timer);
        };
        // 设置 src 触发加载（先赋值 src，再检查 readyState）
        audio.src = url;
        audio.volume = volumeRef.current;
        // 如果同一首歌已经可以播放，直接 resolve（在 src 赋值后检查）
        if (audio.currentSrc === url && audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          resolve(); return;
        }
        // 需要等待加载，添加事件监听和超时
        audio.addEventListener('canplay', onCanPlay, { once: true });
        audio.addEventListener('error', onErr, { once: true });
        timer = setTimeout(() => { cleanup(); reject(new Error('音频加载超时（30s）')); }, 30000);
      });

      // Check again after await — a newer play() may have started
      if (playSeqRef.current !== seq) return;

      await ensureAudioReady();
      await audio.play();
      setIsPlaying(true);
      setPlayError(null);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        // 新播放中断了旧播放，不算错误
        return;
      }
      // code=4 且有 URL 时，可能是 URL 过期，尝试强制重新获取
      if (e instanceof Error && e.message?.includes('code=4') && song.url) {
        console.warn('媒体错误 code=4，尝试重新获取 URL...');
        try {
          const brParam = qualityRef?.current ? `&br=${qualityRef.current}` : '';
          const res = await fetch(apiUrl(`/api/song-url?id=${song.id}&force=true${brParam}`), { signal: AbortSignal.timeout(20000) });
          const data = await res.json();
          const retriedUrl = toAbsoluteUrl(data.url);
          if (retriedUrl) {
            // Check if a newer play() has started during fetch
            if (playSeqRef.current !== seq) return;
            // 更新 song 的 url 和 queue 中的引用
            song.url = retriedUrl;
            const a = audioRef.current!;
            a.src = retriedUrl;
            a.volume = volumeRef.current;
            await new Promise<void>((resolve, reject) => {
              const onOk = () => { a.removeEventListener('error', onErr2); resolve(); };
              const onErr2 = () => { a.removeEventListener('canplay', onOk); reject(new Error('重试仍失败')); };
              a.addEventListener('canplay', onOk, { once: true });
              a.addEventListener('error', onErr2, { once: true });
              setTimeout(() => { a.removeEventListener('canplay', onOk); a.removeEventListener('error', onErr2); reject(new Error('重试超时')); }, 30000);
            });
            // Check again after await
            if (playSeqRef.current !== seq) return;
            await ensureAudioReady();
            await a.play();
            setIsPlaying(true);
            setPlayError(null);
            return;
          }
        } catch (retryErr) {
          console.warn('重试失败:', retryErr);
        }
      }
      const errMsg = e instanceof Error ? e.message : '播放失败';
      console.warn('播放失败:', errMsg);
      setIsPlaying(false);
      setPlayError(errMsg);
    }
  }, []);

  playRef.current = play;

  // Use functional update to avoid stale isPlaying closure
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.src) {
      setPlayError('没有可播放的歌曲');
      return;
    }
    if (audio.paused) {
      ensureAudioReady().then(() => audio.play()).then(() => {
        setIsPlaying(true);
        setPlayError(null);
      }).catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : '播放失败';
        // AbortError 不算错误（新播放中断旧播放）
        if (e instanceof Error && e.name === 'AbortError') return;
        setPlayError(msg);
        setIsPlaying(false);
      });
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
    // 读取最新 isMuted 状态，避免 stale closure
    const muted = audioRef.current.volume === 0;
    if (muted) {
      audioRef.current.volume = volumeBeforeMute;
      volumeRef.current = volumeBeforeMute;
      setVolumeState(volumeBeforeMute);
      setIsMuted(false);
    } else {
      const currentVol = volumeRef.current;
      setVolumeBeforeMute(currentVol);
      audioRef.current.volume = 0;
      volumeRef.current = 0;
      setVolumeState(0);
      setIsMuted(true);
    }
  }, [volumeBeforeMute]);

  const seek = useCallback((pct: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = (audioRef.current.duration || 0) * pct;
    }
  }, []);

  return {
    audioRef, current, setCurrent, isPlaying, setIsPlaying, isLoading,
    currentTime, setCurrentTime, duration, setDuration,
    volume, volumeRef, isMuted, play, playRef, togglePlay, setVolume, toggleMute, seek,
    playError, setPlayError, clearError: () => setPlayError(null),
  };
}
