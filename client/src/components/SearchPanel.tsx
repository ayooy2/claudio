import { useState, useEffect, useRef } from 'react';
import type { SongInfo } from '../hooks/usePlayer.js';
import { apiUrl, toAbsoluteUrl } from '../lib/api.js';

interface Props {
  onSelect: (song: SongInfo) => void;
  likedSongs: SongInfo[];
  onToggleLike: (song: SongInfo) => void;
  accent: string;
  text: string;
  textDim: string;
  show: boolean;
  onClose: () => void;
}

interface SearchResult {
  songs: SongInfo[];
  loading: boolean;
}

export default function SearchPanel({ onSelect, likedSongs, onToggleLike, accent, text, textDim, show, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult>({ songs: [], loading: false });
  const [history, setHistory] = useState<string[]>([]);
  const [tab, setTab] = useState<'search' | 'favorites' | 'history'>('search');
  const [recentPlays, setRecentPlays] = useState<{ id?: string; name: string; artist: string; album: string; timestamp: number }[]>([]);
  const [selectError, setSelectError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup error timer on unmount
  useEffect(() => () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); }, []);

  const showTempError = (msg: string) => {
    setSelectError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => { setSelectError(null); errorTimerRef.current = null; }, 3000);
  };
  const inputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const h = localStorage.getItem('claudio_search_history');
      if (h) setHistory(JSON.parse(h));
    } catch {}
  }, []);

  // Refresh recent plays when panel opens
  useEffect(() => {
    if (!show) return;
    try {
      const r = localStorage.getItem('claudio_recent_plays');
      if (r) setRecentPlays(JSON.parse(r));
    } catch {}
  }, [show]);

  // Focus input when opened
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [show]);

  // Reset search state when panel closes
  useEffect(() => {
    if (!show) {
      setQuery('');
      setResult({ songs: [], loading: false });
      setSelectError(null);
    }
  }, [show]);

  // Search with debounce + AbortController for race condition
  useEffect(() => {
    if (!query.trim()) {
      setResult({ songs: [], loading: false });
      return;
    }
    setResult(prev => ({ ...prev, loading: true }));
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl('/api/search'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: query, limit: 20 }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResult({ songs: data.songs || [], loading: false });
      } catch (err: unknown) {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          setResult({ songs: [], loading: false });
        }
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const handleSelect = async (song: SongInfo) => {
    setSelectError(null);
    // Save to history
    const newHistory = [song.name + ' - ' + song.artist, ...history.filter(h => h !== song.name + ' - ' + song.artist)].slice(0, 20);
    setHistory(newHistory);
    localStorage.setItem('claudio_search_history', JSON.stringify(newHistory));

    // Fetch URL first, only close on success
    try {
      const res = await fetch(apiUrl(`/api/song-url?id=${song.id}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.url) {
        onSelect({ ...song, url: toAbsoluteUrl(data.url)!, isTrial: data.isTrial });
        onClose();
      } else {
        showTempError('该歌曲暂无可用播放链接');
      }
    } catch (err) {
      showTempError('获取播放链接失败，请重试');
    }
  };

  const handleRecentPlaySelect = async (entry: { id?: string; name: string; artist: string; album: string }) => {
    setSelectError(null);
    try {
      const url = entry.id
        ? apiUrl(`/api/song-url?id=${entry.id}`)
        : apiUrl(`/api/song-url?name=${encodeURIComponent(entry.name)}&artist=${encodeURIComponent(entry.artist)}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.url) {
        onSelect({ id: data.id || entry.id || '', name: entry.name, artist: entry.artist, album: entry.album, duration: 0, fee: 0, url: toAbsoluteUrl(data.url)!, isTrial: data.isTrial });
        onClose();
      } else {
        showTempError('该歌曲暂无可用播放链接');
      }
    } catch (err) {
      showTempError('获取播放链接失败，请重试');
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('claudio_search_history');
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)',
      zIndex: 100, display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes searchPulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
      `}</style>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: text, letterSpacing: 2 }}>搜索</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: textDim, fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Search input */}
      <div style={{ padding: '12px 20px' }}>
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text" value={query} onChange={e => setQuery(e.target.value)}
            maxLength={100}
            placeholder="搜索歌曲、歌手..."
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
              color: text, fontSize: 14, outline: 'none',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: textDim, fontSize: 14, cursor: 'pointer',
            }}>✕</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 20px',
      }}>
        {(['search', 'favorites', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 16px', background: 'none', border: 'none',
            color: tab === t ? accent : textDim,
            borderBottom: tab === t ? `2px solid ${accent}` : '2px solid transparent',
            fontSize: 12, cursor: 'pointer', letterSpacing: 1, fontWeight: 600,
          }}>
            {t === 'search' ? '搜索' : t === 'favorites' ? '收藏' : '历史'}
          </button>
        ))}
      </div>

      {/* Error toast */}
      {selectError && (
        <div style={{
          margin: '0 20px', padding: '8px 16px', borderRadius: 8,
          background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)',
          color: '#fca5a5', fontSize: 12, textAlign: 'center',
        }}>
          ⚠ {selectError}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
        {/* Search results */}
        {tab === 'search' && (
          <>
            {/* Search suggestions (history) */}
            {!query && history.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: textDim }}>搜索历史</span>
                  <button onClick={clearHistory} style={{ background: 'none', border: 'none', color: textDim, fontSize: 11, cursor: 'pointer' }}>清空</button>
                </div>
                {history.map((h, i) => (
                  <div key={i} onClick={() => setQuery(h)} style={{
                    padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
                    color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer',
                  }}>{h}</div>
                ))}
              </div>
            )}

            {/* Loading */}
            {result.loading && (
              <div style={{ textAlign: 'center', padding: 40, color: textDim }}>
                <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, animation: 'searchPulse 1s ease-in-out infinite' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, animation: 'searchPulse 1s ease-in-out 0.2s infinite' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, animation: 'searchPulse 1s ease-in-out 0.4s infinite' }} />
                </div>
                <div style={{ marginTop: 8, fontSize: 12 }}>搜索中...</div>
              </div>
            )}

            {/* Results */}
            {!result.loading && result.songs.length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: textDim, marginBottom: 8, display: 'block' }}>
                  找到 {result.songs.length} 首
                </span>
                {result.songs.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                  }} onClick={() => handleSelect(s)}>
                    {s.cover ? (
                      <img src={s.cover} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                    ) : (
                      <span style={{ width: 24, fontSize: 11, color: textDim, textAlign: 'right' }}>{i + 1}</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: textDim }}>{s.artist} · {s.album}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onToggleLike(s); }} style={{
                      background: 'none', border: 'none', color: likedSongs.some(f => f.id === s.id) ? accent : textDim,
                      fontSize: 14, cursor: 'pointer',
                    }}>♡</button>
                  </div>
                ))}
              </div>
            )}

            {/* No results */}
            {!result.loading && query && result.songs.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: textDim }}>未找到相关歌曲</div>
            )}
          </>
        )}

        {/* Favorites */}
        {tab === 'favorites' && (
          <div>
            {likedSongs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: textDim }}>暂无收藏</div>
            ) : (
              likedSongs.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                }} onClick={() => handleSelect(s)}>
                  <span style={{ width: 24, fontSize: 11, color: textDim, textAlign: 'right' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: text }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: textDim }}>{s.artist}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onToggleLike(s); }} style={{
                    background: 'none', border: 'none', color: accent, fontSize: 14, cursor: 'pointer',
                  }}>❤</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* History */}
        {tab === 'history' && (
          <div>
            {recentPlays.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: textDim }}>暂无播放记录</div>
            ) : (
              recentPlays.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                }} onClick={() => handleRecentPlaySelect(s)}>
                  <span style={{ width: 24, fontSize: 11, color: textDim, textAlign: 'right' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: text }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: textDim }}>{s.artist}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
