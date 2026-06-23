import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import { usePlayer, type SongInfo } from './hooks/usePlayer.js';
import { useSocket } from './hooks/useSocket.js';
import SearchPanel from './components/SearchPanel.js';

// ===== LocalStorage helpers =====
function loadState<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}

// ====================== Constants ======================
const DOTS: Record<string, number[][]> = {
  '0': [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
  '1': [[0,0,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
  '2': [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]],
  '3': [[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]],
  '4': [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
  '5': [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
  '6': [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
  '7': [[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
  '8': [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
  '9': [[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]],
};

type Scene =
  | 'starry' | 'aurora' | 'ocean' | 'sunset' | 'rainy' | 'neon'
  | 'citynight' | 'firefly' | 'snow' | 'lavender' | 'minimal';

interface SceneConfig {
  bg: string;
  gradient: string;
  overlay: string;
  accent: string;
  text: string;
  textDim: string;
  name: string;
  emoji: string;
  category: 'dynamic' | 'life';
  bgImage?: string;
  particles: { count: number; css: string; style: 'dots' | 'lines' | 'custom' };
}

const SCENE_CONFIG: Record<Scene, SceneConfig> = {
  starry: {
    bg: '#050510',
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.1) 0%, transparent 50%), linear-gradient(180deg, #070714 0%, #0a0a1a 50%, #050510 100%)',
    overlay: 'transparent',
    accent: '#818cf8', text: 'rgba(255,255,255,0.95)', textDim: 'rgba(199,210,255,0.5)', name: '星空', emoji: '✨',
    category: 'dynamic',
    bgImage: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=1920&h=1080&fit=crop',
    particles: { count: 100, css: 'twinkle 3s ease-in-out infinite', style: 'dots' },
  },
  aurora: {
    bg: '#020814',
    gradient: 'linear-gradient(180deg, #020814 0%, #061420 20%, #0a2030 40%, #0d2838 50%, #082020 65%, #040e14 85%, #020814 100%)',
    overlay: 'linear-gradient(180deg, rgba(74,222,128,0.06) 0%, rgba(56,189,248,0.04) 30%, rgba(168,85,247,0.03) 50%, transparent 70%)',
    accent: '#4ade80', text: 'rgba(200,255,230,0.95)', textDim: 'rgba(200,255,230,0.45)', name: '极光', emoji: '🌌',
    category: 'dynamic',
    bgImage: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&h=1080&fit=crop',
    particles: { count: 0, css: '', style: 'dots' },
  },
  ocean: {
    bg: '#030d1a',
    gradient: 'linear-gradient(180deg, #061428 0%, #0a2040 30%, #0d2847 50%, #0a2040 70%, #061428 100%)',
    overlay: 'radial-gradient(ellipse at 50% 30%, rgba(56,189,248,0.08) 0%, transparent 60%)',
    accent: '#38bdf8', text: 'rgba(200,230,255,0.95)', textDim: 'rgba(200,230,255,0.45)', name: '深海', emoji: '🌊',
    category: 'life',
    bgImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop',
    particles: { count: 20, css: 'float 8s ease-in-out infinite', style: 'dots' },
  },
  sunset: {
    bg: '#1a0a10',
    gradient: 'linear-gradient(180deg, #1a0a1e 0%, #2d1028 15%, #4a1a30 30%, #6b2a30 45%, #8b3a28 55%, #6b2a20 70%, #3a1520 85%, #1a0a10 100%)',
    overlay: 'radial-gradient(ellipse at 50% 60%, rgba(255,107,138,0.08) 0%, transparent 60%)',
    accent: '#ff6b8a', text: 'rgba(255,220,230,0.95)', textDim: 'rgba(255,200,210,0.45)', name: '落日', emoji: '🌅',
    category: 'life',
    bgImage: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1920&h=1080&fit=crop',
    particles: { count: 10, css: 'drift 10s ease-in-out infinite', style: 'dots' },
  },
  rainy: {
    bg: '#0a0e14',
    gradient: 'linear-gradient(180deg, #0e1420 0%, #141e30 30%, #0e1828 60%, #0a0e14 100%)',
    overlay: 'radial-gradient(ellipse at 50% 20%, rgba(96,165,250,0.06) 0%, transparent 60%)',
    accent: '#60a5fa', text: 'rgba(200,220,255,0.95)', textDim: 'rgba(180,200,240,0.45)', name: '雨夜', emoji: '🌧️',
    category: 'dynamic',
    bgImage: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1920&h=1080&fit=crop',
    particles: { count: 60, css: 'rain 1.5s linear infinite', style: 'lines' },
  },
  neon: {
    bg: '#050010',
    gradient: 'linear-gradient(135deg, #0a0018 0%, #140028 25%, #1e0038 50%, #140028 75%, #0a0018 100%)',
    overlay: 'radial-gradient(ellipse at 30% 50%, rgba(232,121,249,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, rgba(99,102,241,0.06) 0%, transparent 50%)',
    accent: '#e879f9', text: 'rgba(255,220,255,0.95)', textDim: 'rgba(240,200,255,0.45)', name: '霓虹', emoji: '💜',
    category: 'dynamic',
    bgImage: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1920&h=1080&fit=crop',
    particles: { count: 30, css: 'float 5s ease-in-out infinite', style: 'dots' },
  },
  citynight: {
    bg: '#0a0e14',
    gradient: 'linear-gradient(180deg, #0a0e18 0%, #0e1420 30%, #141828 50%, #1a1e30 65%, #0e1420 85%, #0a0e14 100%)',
    overlay: 'radial-gradient(ellipse at 50% 70%, rgba(251,191,36,0.05) 0%, transparent 60%)',
    accent: '#fbbf24', text: 'rgba(255,240,200,0.95)', textDim: 'rgba(255,230,180,0.45)', name: '城市', emoji: '🏙️',
    category: 'life',
    bgImage: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1920&h=1080&fit=crop',
    particles: { count: 15, css: 'twinkle 4s ease-in-out infinite', style: 'dots' },
  },
  firefly: {
    bg: '#040a04',
    gradient: 'linear-gradient(180deg, #0a1208 0%, #0e1a0c 30%, #0a1408 60%, #060e06 100%)',
    overlay: 'radial-gradient(ellipse at 40% 60%, rgba(163,230,53,0.06) 0%, transparent 50%)',
    accent: '#a3e635', text: 'rgba(220,255,200,0.95)', textDim: 'rgba(200,240,180,0.45)', name: '萤火', emoji: '🌿',
    category: 'life',
    bgImage: 'https://images.unsplash.com/photo-1476842634003-7dcca8f832de?w=1920&h=1080&fit=crop',
    particles: { count: 25, css: 'float 4s ease-in-out infinite', style: 'dots' },
  },
  snow: {
    bg: '#0a1018',
    gradient: 'linear-gradient(180deg, #0e1828 0%, #142038 30%, #182840 50%, #142038 70%, #0e1828 100%)',
    overlay: 'radial-gradient(ellipse at 50% 30%, rgba(147,197,253,0.06) 0%, transparent 60%)',
    accent: '#93c5fd', text: 'rgba(220,235,255,0.95)', textDim: 'rgba(200,220,250,0.45)', name: '初雪', emoji: '❄️',
    category: 'dynamic',
    bgImage: 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1920&h=1080&fit=crop',
    particles: { count: 50, css: 'fall 5s linear infinite', style: 'dots' },
  },
  lavender: {
    bg: '#0a0612',
    gradient: 'linear-gradient(180deg, #14101e 0%, #1e1428 30%, #241838 50%, #1e1428 70%, #0e0818 100%)',
    overlay: 'radial-gradient(ellipse at 50% 50%, rgba(192,132,252,0.06) 0%, transparent 50%)',
    accent: '#c084fc', text: 'rgba(230,210,255,0.95)', textDim: 'rgba(220,200,250,0.45)', name: '薰衣草', emoji: '💜',
    category: 'life',
    bgImage: 'https://images.unsplash.com/photo-1499002238440-d264edd596ec?w=1920&h=1080&fit=crop',
    particles: { count: 15, css: 'float 7s ease-in-out infinite', style: 'dots' },
  },
  minimal: {
    bg: '#000',
    gradient: '#000',
    overlay: 'transparent',
    accent: '#fff', text: 'rgba(255,255,255,0.95)', textDim: 'rgba(255,255,255,0.4)', name: '极简', emoji: '⬛',
    category: 'life',
    bgImage: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&h=1080&fit=crop',
    particles: { count: 0, css: '', style: 'dots' },
  },
};

interface LyricLine {
  time: number;
  text: string;
}

function fmtTime(s: number): string {
  return (!s || isNaN(s)) ? '0:00' : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}

// ====================== Components ======================

const DotDigit = memo(function DotDigit({ ch, size = 10, gap = 3 }: { ch: string; size?: number; gap?: number }) {
  const p = DOTS[ch];
  if (!p) return null;
  return (
    <div style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(3, 1fr)', gap }}>
      {p.flat().map((on, i) => (
        <div key={i} style={{
          width: size, height: size, borderRadius: 2,
          background: on ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.03)',
        }} />
      ))}
    </div>
  );
});

const PlayIndicator = memo(function PlayIndicator({ accent, bottom, right, bg = 'rgba(20,20,30,0.9)', border }: {
  accent: string; bottom: number | string; right: number | string; bg?: string; border?: string;
}) {
  return (
    <div style={{
      position: 'absolute', bottom, right,
      width: 28, height: 28, borderRadius: '50%',
      background: bg, backdropFilter: 'blur(4px)',
      border: border || 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
    }}>
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 12 }}>
        <div style={{ width: 2, height: 6, background: accent, borderRadius: 1, animation: 'equalizer 0.8s ease-in-out infinite alternate' }} />
        <div style={{ width: 2, height: 10, background: accent, borderRadius: 1, animation: 'equalizer 0.8s ease-in-out 0.2s infinite alternate' }} />
        <div style={{ width: 2, height: 4, background: accent, borderRadius: 1, animation: 'equalizer 0.8s ease-in-out 0.4s infinite alternate' }} />
      </div>
    </div>
  );
});

const Particles = memo(function Particles({ scene }: { scene: Scene }) {
  const config = SCENE_CONFIG[scene].particles;
  if (!config.count) return null;

  const particles = useMemo(() =>
    Array.from({ length: config.count }, (_, i) => ({
      left: `${(i * 137 + 50) % 100}%`,
      top: `${(i * 89 + 30) % 100}%`,
      delay: `${(i * 0.4) % 6}s`,
      size: config.style === 'lines' ? { w: 1.5, h: 10 } : { w: 2 + (i % 3), h: 2 + (i % 3) },
    })), [config.count, config.style]);

  const accent = SCENE_CONFIG[scene].accent;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.left, top: p.top,
          width: p.size.w, height: p.size.h,
          borderRadius: config.style === 'lines' ? 1 : '50%',
          background: config.style === 'lines'
            ? `linear-gradient(180deg, transparent, ${accent}40)`
            : `${accent}${i % 3 === 0 ? '50' : i % 3 === 1 ? '30' : '20'}`,
          animation: config.css,
          animationDelay: p.delay,
          filter: config.style === 'dots' ? `blur(${i % 2}px)` : 'none',
        }} />
      ))}
    </div>
  );
});

const QueueDrawer = memo(function QueueDrawer({ queue, queueIdx, show, onClose, onSelect, accent, text, textDim }: {
  queue: SongInfo[]; queueIdx: number; show: boolean;
  onClose: () => void; onSelect: (i: number) => void;
  accent: string; text: string; textDim: string;
}) {
  if (!show) return null;
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, zIndex: 60,
      background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <span style={{ fontSize: 12, color: textDim, letterSpacing: 2, fontWeight: 600 }}>QUEUE · {queue.length}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: textDim, fontSize: 16, cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {queue.map((s, i) => (
          <div key={i} onClick={() => onSelect(i)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer',
            background: i === queueIdx ? `${accent}15` : 'transparent',
            borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s',
          }}>
            <span style={{ width: 18, fontSize: 10, color: i === queueIdx ? accent : 'rgba(255,255,255,0.2)', textAlign: 'right', fontWeight: 600 }}>{String(i+1).padStart(2,'0')}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: i === queueIdx ? text : textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: i === queueIdx ? 500 : 300 }}>{s.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{s.artist}</div>
            </div>
            {i === queueIdx && <span style={{ color: accent, fontSize: 12 }}>▶</span>}
          </div>
        ))}
      </div>
    </div>
  );
});

// Clock component - isolated to avoid re-rendering entire app every second
const Clock = memo(function Clock({ textDim, compact }: { textDim: string; compact?: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const sz = compact ? 10 : 12;
  const gap = compact ? 4 : 5;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 14 }}>
        <DotDigit ch={hh[0]} size={sz} gap={gap} />
        <DotDigit ch={hh[1]} size={sz} gap={gap} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8, margin: '0 3px' }}>
          <div style={{ width: compact ? 5 : 6, height: compact ? 5 : 6, borderRadius: '50%', background: '#fff' }} />
          <div style={{ width: compact ? 5 : 6, height: compact ? 5 : 6, borderRadius: '50%', background: '#fff' }} />
        </div>
        <DotDigit ch={mm[0]} size={sz} gap={gap} />
        <DotDigit ch={mm[1]} size={sz} gap={gap} />
      </div>
      <div style={{ color: textDim, fontSize: compact ? 11 : 12, letterSpacing: 2, marginTop: compact ? 10 : 14, fontWeight: 300 }}>{weekday}</div>
      <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: compact ? 9 : 10, letterSpacing: 1, marginTop: 4 }}>{date}</div>
    </>
  );
});

// ====================== APP ======================
export default function App() {
  const [scene, setScene] = useState<Scene>(() => {
    const saved = loadState<string>('claudio_scene', 'starry');
    return (saved in SCENE_CONFIG ? saved : 'starry') as Scene;
  });
  const [sceneChanging, setSceneChanging] = useState(false);
  const [queue, setQueue] = useState<SongInfo[]>(() => loadState('claudio_queue', []));
  const [queueIdx, setQueueIdx] = useState(() => loadState('claudio_queue_idx', -1));
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(() => new Set(loadState('claudio_favorites', [])));
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [volumeVisible, setVolumeVisible] = useState(false);
  const [comment, setComment] = useState<{ content: string; nickname: string; likedCount: number } | null>(null);
  const [playMode, setPlayMode] = useState<'sequence' | 'loop' | 'shuffle'>(() => loadState('claudio_play_mode', 'sequence'));
  const [playedIndices, setPlayedIndices] = useState<Set<number>>(new Set());
  const [bgLoaded, setBgLoaded] = useState(false);
  const [coverMode, setCoverMode] = useState<'vinyl' | 'fullcover'>(() => loadState('claudio_cover_mode', 'vinyl'));
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showCover, setShowCover] = useState(() => loadState('claudio_show_cover', true));
  const [showTime, setShowTime] = useState(() => loadState('claudio_show_time', true));

  const { audioRef, current, isPlaying, isLoading, currentTime, duration, volume, isMuted,
    play, playRef, togglePlay, toggleMute, setVolume, seek, setCurrentTime, setDuration, setIsPlaying } = usePlayer();
  const { socket } = useSocket();

  // Refs for latest state (avoid stale closures)
  const queueRef = useRef(queue);
  const queueIdxRef = useRef(queueIdx);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIdxRef.current = queueIdx; }, [queueIdx]);

  // Save state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('claudio_scene', JSON.stringify(scene));
      localStorage.setItem('claudio_cover_mode', JSON.stringify(coverMode));
      localStorage.setItem('claudio_show_cover', JSON.stringify(showCover));
      localStorage.setItem('claudio_show_time', JSON.stringify(showTime));
      if (queue.length > 0) {
        localStorage.setItem('claudio_queue', JSON.stringify(queue));
        localStorage.setItem('claudio_queue_idx', JSON.stringify(queueIdx));
      }
      localStorage.setItem('claudio_favorites', JSON.stringify(Array.from(liked)));
    } catch {}
  }, [scene, queue, queueIdx, liked, coverMode, showCover, showTime]);

  // Preload background image when scene changes
  useEffect(() => {
    const config = SCENE_CONFIG[scene];
    if (!config.bgImage) {
      setBgLoaded(false);
      return;
    }
    setBgLoaded(false);
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.onerror = () => setBgLoaded(false);
    img.src = config.bgImage;
  }, [scene]);

  // ===== Load playlist (only if no saved queue) =====
  useEffect(() => {
    if (queue.length > 0) {
      // Pre-warm cache for saved queue in background
      fetch('/api/warmup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songs: queue.slice(0, 10).map(s => ({ name: s.name, artist: s.artist })) }),
      }).catch(() => {});
      return;
    }
    let cancelled = false;
    fetch('/api/playlist-resolved')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (cancelled || !data.songs?.length) return;
        setQueue(data.songs);
        setQueueIdx(0);
        // Pre-warm cache for first batch
        fetch('/api/warmup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songs: data.songs.slice(0, 10).map((s: SongInfo) => ({ name: s.name, artist: s.artist })) }),
        }).catch(() => {});
      })
      .catch(e => console.warn('Playlist load failed:', e));
    return () => { cancelled = true; };
  }, []);

  // ===== Fetch lyrics when song changes =====
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    fetch(`/api/lyrics?id=${current.id}&name=${encodeURIComponent(current.name)}&artist=${encodeURIComponent(current.artist)}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (cancelled) return;
        if (data.lyrics?.length > 0 && Array.isArray(data.lyrics) && typeof data.lyrics[0] === 'object' && 'time' in data.lyrics[0]) {
          setLyrics(data.lyrics);
        } else if (data.lyrics?.length > 0 && typeof data.lyrics[0] === 'string') {
          setLyrics(data.lyrics.map((text: string, i: number) => ({ time: i * 3, text })));
        } else {
          setLyrics([{ time: 0, text: `${current.name} — ${current.artist}` }]);
        }
      })
      .catch(() => {
        if (!cancelled) setLyrics([{ time: 0, text: `${current.name} — ${current.artist}` }]);
      });
    return () => { cancelled = true; };
  }, [current?.id]);

  // ===== Fetch comment when song changes =====
  useEffect(() => {
    if (!current?.id) return;
    let cancelled = false;
    fetch(`/api/comment?id=${current.id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (!cancelled) setComment(data.comment || null);
      })
      .catch(() => { if (!cancelled) setComment(null); });
    return () => { cancelled = true; };
  }, [current?.id]);

  // ===== Binary search for current lyric line =====
  const currentLyricIndex = useMemo(() => {
    if (lyrics.length === 0) return -1;
    let low = 0, high = lyrics.length - 1, result = -1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lyrics[mid].time <= currentTime) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return result;
  }, [lyrics, currentTime]);

  // Auto scene based on time (only on first mount)
  useEffect(() => {
    const saved = loadState<string | null>('claudio_scene', null);
    if (saved) return; // respect user's saved choice
    const h = new Date().getHours();
    if (h >= 6 && h < 12) setScene('starry');
    else if (h >= 12 && h < 18) setScene('sunset');
    else if (h >= 18 && h < 20) setScene('aurora');
    else setScene('neon');
  }, []);

  // Audio setup - use ref for onended to avoid stale closure
  const attachAudio = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el;
    if (!el) return;
    el.ontimeupdate = () => setCurrentTime(el.currentTime);
    el.ondurationchange = () => setDuration(el.duration || 0);
    el.volume = volume;
  }, [volume]);

  // Separate effect for onended (uses refs for latest state)
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.onended = () => {
      const q = queueRef.current;
      const idx = queueIdxRef.current;
      if (q.length > 1) {
        const n = (idx + 1) % q.length;
        setQueueIdx(n);
        setCurrentTime(0);
        setIsPlaying(true);
        play(q[n]);
      }
    };
  }, []);

  // Pre-fetch next song URL
  useEffect(() => {
    if (!isPlaying || queue.length <= 1) return;
    let cancelled = false;
    const nextIdx = (queueIdx + 1) % queue.length;
    const nextSong = queue[nextIdx];
    if (nextSong && !nextSong.url) {
      fetch(`/api/song-url?name=${encodeURIComponent(nextSong.name)}&artist=${encodeURIComponent(nextSong.artist)}`)
        .then(r => r.json())
        .then(data => {
          if (!cancelled && data.url) {
            setQueue(prev => prev.map((s, i) => i === nextIdx ? { ...s, url: data.url, id: data.id || s.id, cover: data.cover || s.cover } : s));
          }
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [isPlaying, queueIdx, queue]);

  const handleToggle = useCallback(() => {
    if (!current && queue.length > 0) {
      setQueueIdx(0);
      play(queue[0]);
      return;
    }
    if (!current) return;
    togglePlay();
  }, [current, togglePlay, queue, play]);

  const handleNext = useCallback(() => {
    if (queue.length <= 1) return;
    let n: number;
    if (playMode === 'loop') {
      setCurrentTime(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
      audioRef.current?.play();
      return;
    } else if (playMode === 'shuffle') {
      // Fix: use functional update to avoid stale playedIndices
      const resetNeeded = playedIndices.size >= queue.length;
      const effectivePlayed = resetNeeded ? new Set<number>() : playedIndices;
      if (resetNeeded) setPlayedIndices(new Set());
      const available = queue.map((_, i) => i).filter(i => !effectivePlayed.has(i) && i !== queueIdx);
      if (available.length === 0) {
        n = Math.floor(Math.random() * queue.length);
      } else {
        n = available[Math.floor(Math.random() * available.length)];
      }
      setPlayedIndices(prev => new Set([...prev, n]));
    } else {
      n = (queueIdx + 1) % queue.length;
    }
    setQueueIdx(n); setCurrentTime(0); setIsPlaying(true); play(queue[n]);
  }, [queue, queueIdx, play, setCurrentTime, setIsPlaying, playMode, playedIndices]);

  const handlePrev = useCallback(() => {
    if (queue.length <= 1) return;
    const p = queueIdx <= 0 ? queue.length - 1 : queueIdx - 1;
    setQueueIdx(p); setCurrentTime(0); setIsPlaying(true); play(queue[p]);
  }, [queue, queueIdx, play, setCurrentTime, setIsPlaying]);

  const handleSeek = useCallback((pct: number) => {
    if (audioRef.current) audioRef.current.currentTime = (audioRef.current.duration || 0) * pct;
  }, []);

  const handleSelectSong = useCallback((idx: number) => {
    setQueueIdx(idx); setCurrentTime(0); setIsPlaying(true); play(queue[idx]); setShowQueue(false);
  }, [queue, play, setCurrentTime, setIsPlaying]);

  // Play mode persistence
  useEffect(() => {
    try { localStorage.setItem('claudio_play_mode', JSON.stringify(playMode)); } catch {}
  }, [playMode]);

  // Keyboard (use refs to avoid re-binding)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.code) {
        case 'Space': e.preventDefault(); handleToggle(); break;
        case 'ArrowLeft': handlePrev(); break;
        case 'ArrowRight': handleNext(); break;
        case 'KeyL': setShowLyrics(v => !v); break;
        case 'KeyQ': setShowQueue(v => !v); break;
        case 'KeyS': setShowSearch(v => !v); break;
        case 'KeyM': toggleMute(); break;
        case 'KeyF':
          if (!document.fullscreenElement) document.documentElement.requestFullscreen();
          else document.exitFullscreen();
          break;
        case 'Slash': if (e.shiftKey) setShowHelp(v => !v); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleToggle, handlePrev, handleNext, toggleMute]);

  // Scene switch
  const sceneTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const switchScene = useCallback((s: Scene) => {
    setSceneChanging(true);
    clearTimeout(sceneTimerRef.current);
    sceneTimerRef.current = setTimeout(() => { setScene(s); setSceneChanging(false); }, 300);
  }, []);

  // Like
  const toggleLike = useCallback(() => {
    if (!current) return;
    setLiked(prev => { const n = new Set(prev); if (n.has(current.id)) n.delete(current.id); else n.add(current.id); return n; });
  }, [current]);

  // Touch gestures for mobile
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      if (dx > 0) handlePrev(); else handleNext();
    }
    touchStartRef.current = null;
  }, [handlePrev, handleNext]);

  const sc = SCENE_CONFIG[scene];
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        width: '100%', height: '100vh', background: '#000', color: sc.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: 'relative', overflow: 'hidden', transition: 'all 0.8s ease',
        opacity: sceneChanging ? 0 : 1, display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Mini progress bar at top */}
      {current && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 20,
          background: 'rgba(255,255,255,0.05)',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: `linear-gradient(90deg, ${sc.accent}80, ${sc.accent})`,
            transition: 'width 0.3s linear',
          }} />
        </div>
      )}

      {/* Background image */}
      {sc.bgImage && bgLoaded && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${sc.bgImage})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          transition: 'opacity 0.8s ease',
        }} />
      )}
      {/* Background gradient */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: sc.gradient,
        opacity: bgLoaded ? 0.3 : 1,
        transition: 'opacity 0.8s ease',
      }} />

      {/* Overlay effect */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: sc.overlay,
        transition: 'background 0.8s ease',
      }} />

      <Particles scene={scene} />

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px', flexShrink: 0, zIndex: 10,
        background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <span style={{
          fontSize: 13, fontWeight: 600, letterSpacing: 4, color: sc.text,
          textTransform: 'uppercase', opacity: 0.8,
        }}>Claudio</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowSearch(true)} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, cursor: 'pointer', padding: '5px 14px',
            color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: 0.5,
            transition: 'all 0.2s ease',
          }}>搜索</button>
          <button onClick={() => {
            const scenes = Object.keys(SCENE_CONFIG) as Scene[];
            switchScene(scenes[(scenes.indexOf(scene) + 1) % scenes.length]);
          }} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, cursor: 'pointer', padding: '5px 14px',
            color: sc.accent, fontSize: 11, letterSpacing: 0.5,
            transition: 'all 0.2s ease',
          }}>{sc.name}</button>
          <button onClick={() => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else document.exitFullscreen();
          }} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, cursor: 'pointer', padding: '5px 10px',
            color: 'rgba(255,255,255,0.5)', fontSize: 12,
            transition: 'all 0.2s ease',
          }}>⛶</button>
          <button onClick={() => setShowSettings(!showSettings)} style={{
            background: showSettings ? `${sc.accent}20` : 'rgba(255,255,255,0.06)',
            border: `1px solid ${showSettings ? `${sc.accent}30` : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 20, cursor: 'pointer', padding: '5px 10px',
            color: showSettings ? sc.accent : 'rgba(255,255,255,0.5)', fontSize: 12,
            transition: 'all 0.2s ease',
          }}>⚙</button>
        </div>
      </div>

      {/* Central Area: Clock + Cover */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 10, minHeight: 0, overflow: 'auto', padding: '0 16px' }}>
        {/* Clock - 过渡动画 */}
        <div style={{
          maxHeight: showTime ? 120 : 0, opacity: showTime ? 1 : 0,
          overflow: 'hidden', transition: 'max-height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease',
        }}>
          <Clock textDim={sc.textDim} compact={!!current} />
        </div>

        {/* Audio Visualizer */}
        {isPlaying && (
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 24, marginTop: 12 }}>
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{
                width: 3, borderRadius: 2,
                background: `linear-gradient(to top, ${sc.accent}60, ${sc.accent})`,
                animation: `viz-bar 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                height: 8 + (i % 3) * 4,
              }} />
            ))}
          </div>
        )}

        {/* Album Cover */}
        <div style={{
          maxHeight: showCover ? 500 : 0, opacity: showCover ? 1 : 0,
          overflow: 'hidden', transition: 'max-height 0.6s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease',
        }}>
          <style>{`
            .cover-vinyl { width: min(42vw, 35vh, 220px); aspect-ratio: 1; flex-shrink: 0; transition: all 0.4s ease; }
            .cover-full { width: min(40vw, 32vh, 200px); aspect-ratio: 1; flex-shrink: 0; transition: all 0.4s ease; }
            .cover-vinyl.playing { width: min(38vw, 30vh, 180px); }
            .cover-full.playing { width: min(36vw, 28vh, 170px); }
            @media (max-width: 480px) { .cover-vinyl { width: min(50vw, 32vh, 180px); } .cover-full { width: min(45vw, 28vh, 160px); } .cover-vinyl.playing { width: min(42vw, 26vh, 150px); } .cover-full.playing { width: min(40vw, 24vh, 140px); } }
            :fullscreen .cover-vinyl { width: min(35vw, 40vh, 300px); }
            :fullscreen .cover-full { width: min(35vw, 40vh, 300px); }
            :fullscreen .cover-vinyl.playing { width: min(30vw, 35vh, 260px); }
            :fullscreen .cover-full.playing { width: min(30vw, 35vh, 260px); }
          `}</style>
          {coverMode === 'vinyl' ? (
            /* ===== 黑胶唱片 ===== */
            <div className={`cover-vinyl${isPlaying ? ' playing' : ''}`} style={{ marginTop: 20, position: 'relative' }}>
              {/* 整个唱片（旋转） */}
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: '#111',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
                animation: isPlaying ? 'spin 20s linear infinite' : 'none',
                boxShadow: isPlaying ? `0 0 60px rgba(0,0,0,0.6)` : '0 0 30px rgba(0,0,0,0.3)',
                transition: 'box-shadow 0.5s ease',
              }}>
                {/* 纹理沟槽 */}
                <div style={{
                  position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
                  background: `repeating-radial-gradient(circle at center,
                    transparent 0px, transparent 4px,
                    rgba(255,255,255,0.04) 4.5px, transparent 5px,
                    transparent 9px, rgba(255,255,255,0.02) 9.5px, transparent 10px,
                    transparent 14px, rgba(255,255,255,0.03) 14.5px, transparent 15px)`,
                  pointerEvents: 'none',
                }} />
                {/* 高光反射 */}
                <div style={{
                  position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.03) 100%)',
                  pointerEvents: 'none',
                }} />
                {/* 封面图（居中圆形，占比约60%） */}
                {current?.cover ? (
                  <img src={current.cover} alt={current.name} style={{
                    width: '60%', height: '60%', borderRadius: '50%', objectFit: 'cover',
                    position: 'relative', zIndex: 1,
                    border: '3px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 0 20px rgba(0,0,0,0.5)',
                  }} />
                ) : (
                  <div style={{
                    width: '60%', height: '60%', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', zIndex: 1,
                  }}>
                    <span style={{ fontSize: 'min(10vw, 48px)', opacity: 0.2 }}>🎵</span>
                  </div>
                )}
                {/* 中心轴孔 */}
                <div style={{
                  position: 'absolute', width: 16, height: 16, borderRadius: '50%',
                  background: '#1a1a2e', border: '2px solid rgba(255,255,255,0.15)',
                  zIndex: 2,
                }} />
              </div>
              {/* 播放指示器 */}
              {isPlaying && <PlayIndicator accent={sc.accent} bottom={-4} right={-4} border={`1px solid ${sc.accent}30`} />}
            </div>
          ) : (
            /* ===== 全屏封面 ===== */
            <div className={`cover-full${isPlaying ? ' playing' : ''}`} style={{ marginTop: 20, position: 'relative' }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: 20, overflow: 'hidden', position: 'relative',
                boxShadow: isPlaying
                  ? `0 8px 40px rgba(0,0,0,0.5), 0 0 60px ${sc.accent}15`
                  : '0 4px 20px rgba(0,0,0,0.3)',
                transition: 'box-shadow 0.5s ease',
              }}>
                {current?.cover ? (
                  <img src={current.cover} alt={current.name} style={{
                    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                  }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%', background: 'rgba(255,255,255,0.03)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 'min(15vw, 80px)', opacity: 0.15 }}>🎵</span>
                  </div>
                )}
                {/* 播放指示器 */}
                {isPlaying && <PlayIndicator accent={sc.accent} bottom={12} right={12} bg="rgba(0,0,0,0.6)" />}
              </div>
            </div>
          )}
        </div>

        {/* Now Playing Info */}
        {current && (
          <div style={{ marginTop: 10, textAlign: 'center', maxWidth: 260 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: sc.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {current.name}
            </div>
            <div style={{ fontSize: 11, color: sc.textDim, marginTop: 3 }}>{current.artist}</div>
          </div>
        )}

        {/* Inline Lyrics Preview */}
        {current && lyrics.length > 0 && currentLyricIndex >= 0 && (
          <div style={{ marginTop: 10, textAlign: 'center', maxWidth: 300, cursor: 'pointer' }}
            onClick={() => setShowLyrics(true)}>
            <div style={{
              fontSize: 13, color: sc.accent, fontWeight: 500,
              opacity: 0.8, transition: 'all 0.3s ease',
              lineHeight: 1.6,
            }}>
              {lyrics[currentLyricIndex]?.text || ''}
            </div>
            {currentLyricIndex + 1 < lyrics.length && (
              <div style={{ fontSize: 11, color: sc.textDim, opacity: 0.5, marginTop: 3 }}>
                {lyrics[currentLyricIndex + 1]?.text || ''}
              </div>
            )}
          </div>
        )}

        {/* Placeholder when no song */}
        {!current && (
          <div style={{ marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.15)', letterSpacing: 2 }}>
            点击搜索开始播放
          </div>
        )}
      </div>

      {/* Controls + Progress - Three Column Layout */}
      <div style={{ padding: '0 16px 12px', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {/* Left: Transport Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Prev */}
            <button onClick={handlePrev} style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', color: sc.textDim,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>

            {/* Play/Pause */}
            <button onClick={handleToggle} style={{
              width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: `${sc.accent}18`, color: sc.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease', boxShadow: `0 0 16px ${sc.accent}15`,
              opacity: isLoading ? 0.6 : 1,
            }}>
              {isLoading ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              ) : isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            {/* Next */}
            <button onClick={handleNext} style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', color: sc.textDim,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>

          {/* Center: Progress Bar */}
          <div style={{ flex: 1, margin: '0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: sc.textDim, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(currentTime)}</span>
              <span style={{ fontSize: 10, color: sc.textDim, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(duration)}</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, cursor: 'pointer', position: 'relative' }}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); handleSeek((e.clientX - r.left) / r.width); }}
              onMouseDown={(e) => {
                const bar = e.currentTarget;
                const onMove = (ev: MouseEvent) => {
                  const r = bar.getBoundingClientRect();
                  handleSeek(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)));
                };
                const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}>
              <div style={{ width: `${pct}%`, height: '100%', background: sc.accent, borderRadius: 2, transition: 'width 0.1s linear' }} />
              <div style={{
                position: 'absolute', top: '50%', left: `${pct}%`,
                width: 10, height: 10, borderRadius: '50%', background: sc.accent,
                transform: 'translate(-50%, -50%)', opacity: 0.8,
              }} />
            </div>
            {queue.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: 4, fontSize: 9, color: sc.textDim, opacity: 0.3 }}>
                {queueIdx + 1} / {queue.length}
              </div>
            )}
          </div>

          {/* Right: Utility Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Like */}
            <button onClick={toggleLike} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
              transition: 'all 0.2s ease',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={current && liked.has(current.id) ? '#ff6b8a' : 'none'} stroke={current && liked.has(current.id) ? '#ff6b8a' : sc.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>

            {/* Lyrics */}
            <button onClick={() => setShowLyrics(!showLyrics)} style={{
              background: showLyrics ? `${sc.accent}15` : 'none',
              border: 'none', borderRadius: 6,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
              transition: 'all 0.2s ease',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={showLyrics ? sc.accent : sc.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 10h12M4 14h16M4 18h8"/></svg>
            </button>

            {/* Play Mode */}
            <button onClick={() => setPlayMode(m => m === 'sequence' ? 'shuffle' : m === 'shuffle' ? 'loop' : 'sequence')} style={{
              background: 'none', border: 'none', borderRadius: 6,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
              transition: 'all 0.2s ease',
            }} title={playMode === 'sequence' ? '顺序播放' : playMode === 'shuffle' ? '随机播放' : '列表循环'}>
              {playMode === 'sequence' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={sc.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>
              ) : playMode === 'shuffle' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={sc.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={sc.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              )}
            </button>

            {/* Volume */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              onMouseEnter={() => setVolumeVisible(true)} onMouseLeave={() => setVolumeVisible(false)}>
              <button onClick={toggleMute} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isMuted ? sc.accent : sc.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isMuted || volume === 0 ? (
                    <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
                  ) : volume < 0.5 ? (
                    <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
                  ) : (
                    <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
                  )}
                </svg>
              </button>
              <input type="range" min={0} max={100} value={isMuted ? 0 : Math.round(volume * 100)}
                onChange={e => setVolume(Number(e.target.value) / 100)}
                style={{
                  width: 56, accentColor: sc.accent, height: 2,
                  opacity: volumeVisible ? 0.8 : 0.3, transition: 'opacity 0.3s',
                }} />
            </div>

            {/* Queue */}
            <button onClick={() => setShowQueue(!showQueue)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: sc.textDim,
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
              opacity: 0.5, transition: 'opacity 0.2s',
            }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>

      <QueueDrawer queue={queue} queueIdx={queueIdx} show={showQueue}
        onClose={() => setShowQueue(false)} onSelect={handleSelectSong}
        accent={sc.accent} text={sc.text} textDim={sc.textDim} />

      {/* Lyrics Panel - 沉浸式歌词 */}
      {showLyrics && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 55,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(16px)',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.4s ease',
        }}>
          {/* 顶部：关闭按钮 */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 24px', flexShrink: 0,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, color: sc.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current?.name}</div>
              <div style={{ fontSize: 11, color: sc.textDim, marginTop: 2 }}>{current?.artist}</div>
            </div>
            <button onClick={() => setShowLyrics(false)} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: 16, padding: '5px 14px', cursor: 'pointer',
              color: sc.textDim, fontSize: 11, letterSpacing: 0.5,
              backdropFilter: 'blur(8px)',
              flexShrink: 0, marginLeft: 12,
            }}>收起</button>
          </div>

          {/* 中间：封面 + 歌词 */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            overflow: 'hidden', minHeight: 0,
          }}>
            {/* 专辑封面 - 毛玻璃卡片 */}
            {current?.cover && (
              <div style={{
                width: 'min(45vw, 160px)', aspectRatio: '1', borderRadius: 16,
                overflow: 'hidden', flexShrink: 0, marginTop: 8,
                boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 60px ${sc.accent}12`,
                position: 'relative',
              }}>
                <img src={current.cover} alt="" style={{
                  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                }} />
                {/* 封面底部模糊渐变，和歌词区域融合 */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.4))',
                }} />
              </div>
            )}

            {/* 歌词区域 - 可滚动 */}
            <div ref={el => {
              if (el && currentLyricIndex >= 0) {
                // Find the actual lyric div (skip spacers)
                const lyricDivs = el.querySelectorAll('[data-lyric]');
                const target = lyricDivs[currentLyricIndex] as HTMLElement;
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }} style={{
              flex: 1, overflow: 'auto', width: '100%',
              padding: '16px 24px',
              maskImage: 'linear-gradient(transparent 0%, black 10%, black 90%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(transparent 0%, black 10%, black 90%, transparent 100%)',
            }}>
              {/* 顶部留白 */}
              <div style={{ height: '8vh', flexShrink: 0 }} />
              {lyrics.map((line, i) => {
                const isCurrent = i === currentLyricIndex;
                const dist = Math.abs(i - currentLyricIndex);
                const isNear = dist <= 2;
                return (
                  <div key={i} data-lyric onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = line.time;
                      setCurrentTime(line.time);
                    }
                  }} style={{
                    padding: isCurrent ? '14px 0' : '10px 0',
                    fontSize: isCurrent ? 20 : isNear ? 15 : 13,
                    lineHeight: 1.7,
                    fontWeight: isCurrent ? 700 : isNear ? 400 : 300,
                    color: isCurrent ? sc.text : isNear ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)',
                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transform: isCurrent ? 'scale(1.03)' : 'scale(1)',
                    letterSpacing: isCurrent ? 1.5 : 0.5,
                    textShadow: isCurrent ? `0 0 20px ${sc.accent}30` : 'none',
                  }}>{line.text || '···'}</div>
                );
              })}
              {/* 底部留白 */}
              <div style={{ height: '30vh', flexShrink: 0 }} />
            </div>
          </div>

          {/* 底部：迷你进度条 + 控制 */}
          <div style={{
            padding: '12px 24px 20px', flexShrink: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.3))',
          }}>
            {/* 进度条 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1, cursor: 'pointer', position: 'relative' }}
                onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); handleSeek((e.clientX - r.left) / r.width); }}>
                <div style={{ width: `${pct}%`, height: '100%', background: sc.accent, borderRadius: 1, transition: 'width 0.3s linear' }} />
                <div style={{
                  position: 'absolute', top: '50%', left: `${pct}%`,
                  width: 8, height: 8, borderRadius: '50%', background: sc.accent,
                  transform: 'translate(-50%, -50%)', opacity: 0.9,
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 9, color: sc.textDim, fontVariantNumeric: 'tabular-nums', opacity: 0.6 }}>{fmtTime(currentTime)}</span>
                <span style={{ fontSize: 9, color: sc.textDim, fontVariantNumeric: 'tabular-nums', opacity: 0.6 }}>{fmtTime(duration)}</span>
              </div>
            </div>
            {/* 播放控制 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
              <button onClick={handlePrev} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: sc.textDim, fontSize: 18, opacity: 0.7,
                transition: 'opacity 0.2s',
              }}>⏮</button>
              <button onClick={handleToggle} style={{
                width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,0.12)', color: sc.text,
                fontSize: 18, backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}>{isPlaying ? '⏸' : '▶'}</button>
              <button onClick={handleNext} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: sc.textDim, fontSize: 18, opacity: 0.7,
                transition: 'opacity 0.2s',
              }}>⏭</button>
            </div>
          </div>
        </div>
      )}

      {/* Search panel */}
      <SearchPanel
        show={showSearch}
        onClose={() => setShowSearch(false)}
        onSelect={(song) => {
          setQueue(prev => {
            setQueueIdx(prev.length);
            return [...prev, song];
          });
          play(song);
        }}
        accent={sc.accent} text={sc.text} textDim={sc.textDim}
      />

      {/* Settings panel */}
      {showSettings && (
        <>
          <div onClick={() => setShowSettings(false)} style={{
            position: 'fixed', inset: 0, zIndex: 49,
            background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
          }} />
          <div style={{
            position: 'fixed', top: 56, right: 16, zIndex: 50,
            background: 'rgba(15,15,25,0.9)', backdropFilter: 'blur(40px)',
            borderRadius: 20, padding: '20px', width: 280,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: sc.text, marginBottom: 20, letterSpacing: 0.5 }}>设置</div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: sc.textDim, marginBottom: 10, letterSpacing: 0.5 }}>封面样式</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['vinyl', 'fullcover'] as const).map(mode => (
                  <button key={mode} onClick={() => setCoverMode(mode)} style={{
                    flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: coverMode === mode ? `${sc.accent}15` : 'rgba(255,255,255,0.04)',
                    color: coverMode === mode ? sc.accent : sc.textDim,
                    fontSize: 12, fontWeight: coverMode === mode ? 600 : 400,
                    transition: 'all 0.2s ease',
                  }}>{mode === 'vinyl' ? '🎵 黑胶' : '🖼️ 封面'}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: sc.textDim, marginBottom: 10, letterSpacing: 0.5 }}>显示控制</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '6px 0' }}>
                  <span style={{ fontSize: 12, color: sc.textDim }}>显示专辑封面</span>
                  <button onClick={() => setShowCover(v => !v)} style={{
                    width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative',
                    background: showCover ? sc.accent : 'rgba(255,255,255,0.15)',
                    transition: 'background 0.3s ease',
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2, left: showCover ? 18 : 2,
                      transition: 'left 0.3s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  </button>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '6px 0' }}>
                  <span style={{ fontSize: 12, color: sc.textDim }}>显示时钟</span>
                  <button onClick={() => setShowTime(v => !v)} style={{
                    width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative',
                    background: showTime ? sc.accent : 'rgba(255,255,255,0.15)',
                    transition: 'background 0.3s ease',
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2, left: showTime ? 18 : 2,
                      transition: 'left 0.3s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  </button>
                </label>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: sc.textDim, marginBottom: 10, letterSpacing: 0.5 }}>沉浸场景</div>
              {(['dynamic', 'life'] as const).map(cat => (
                <div key={cat}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 8, letterSpacing: 1 }}>{cat === 'dynamic' ? '动态' : '生活'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: cat === 'dynamic' ? 16 : 0 }}>
                    {(Object.entries(SCENE_CONFIG) as [Scene, SceneConfig][])
                      .filter(([, cfg]) => cfg.category === cat)
                      .map(([key, cfg]) => (
                        <button key={key} onClick={() => switchScene(key)} style={{
                          padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                          background: cfg.bgImage
                            ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${cfg.bgImage.replace('w=1920&h=1080', 'w=200&h=120')}) center/cover`
                            : scene === key ? `${sc.accent}15` : 'rgba(255,255,255,0.03)',
                          color: scene === key ? sc.accent : sc.textDim,
                          fontSize: 11, fontWeight: scene === key ? 600 : 400,
                          transition: 'all 0.2s ease',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          boxShadow: scene === key ? `0 0 0 1px ${sc.accent}40` : 'none',
                        }}>
                          <span style={{ fontSize: 10 }}>{cfg.name}</span>
                        </button>
                      ))
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <audio ref={attachAudio} preload="auto" />

      {/* Help overlay */}
      {showHelp && (
        <>
          <div onClick={() => setShowHelp(false)} style={{ position: 'fixed', inset: 0, zIndex: 98, background: 'transparent' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 99, background: 'rgba(15,15,25,0.96)', backdropFilter: 'blur(24px)',
            borderRadius: 20, padding: '28px 36px', minWidth: 280,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 16px 64px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: sc.text, marginBottom: 20, letterSpacing: 1, textAlign: 'center' }}>快捷键</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Space', '播放 / 暂停'],
                ['← →', '上一首 / 下一首'],
                ['M', '静音切换'],
                ['L', '歌词面板'],
                ['Q', '播放队列'],
                ['S', '搜索'],
                ['F', '全屏切换'],
                ['Shift + ?', '快捷键帮助'],
              ].map(([key, desc]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 11, color: sc.text, fontFamily: 'monospace', minWidth: 60, textAlign: 'center',
                  }}>{key}</span>
                  <span style={{ fontSize: 12, color: sc.textDim }}>{desc}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>点击任意处关闭</div>
          </div>
        </>
      )}

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
