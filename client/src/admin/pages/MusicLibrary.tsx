import { useState, useEffect, useMemo } from 'react';
import { apiUrl } from '../../lib/api.js';

interface Song {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  enabled: boolean;
  isFavorite: boolean;
}

export default function MusicLibrary() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'favorites' | 'enabled'>('all');
  const [error, setError] = useState<string | null>(null);

  // 从 localStorage 加载收藏（与 App.tsx 共享 claudio_favorites）
  const loadFavorites = (): Set<string> => {
    try {
      const saved = localStorage.getItem('claudio_favorites');
      if (saved) {
        const arr = JSON.parse(saved);
        return new Set(arr.map((s: { id: string }) => s.id));
      }
    } catch { /* ignore */ }
    return new Set();
  };

  const saveFavorites = (favorites: Set<string>) => {
    try {
      const saved = localStorage.getItem('claudio_favorites');
      const arr: { id: string; name: string; artist: string; album: string }[] = saved ? JSON.parse(saved) : [];
      // 更新收藏状态
      const updated = songs.filter(s => favorites.has(s.id)).map(s => ({ id: s.id, name: s.name, artist: s.artist, album: s.album }));
      localStorage.setItem('claudio_favorites', JSON.stringify(updated));
    } catch { /* ignore */ }
  };

  // 从 localStorage 加载启用状态
  const loadEnabledStates = (): Record<string, boolean> => {
    try {
      const saved = localStorage.getItem('claudio_song_enabled');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  };

  const saveEnabledStates = (states: Record<string, boolean>) => {
    localStorage.setItem('claudio_song_enabled', JSON.stringify(states));
  };

  useEffect(() => {
    const ctrl = new AbortController();
    const favIds = loadFavorites();
    const enabledStates = loadEnabledStates();
    fetch(apiUrl('/api/playlist'), { signal: ctrl.signal }).then(r => r.json()).then(data => {
      setSongs(data.songs?.map((s: { name: string; artist: string; album?: string; duration?: number }, i: number) => {
        const id = String(i);
        return {
          id,
          name: s.name,
          artist: s.artist,
          album: s.album || '',
          duration: s.duration || 0,
          enabled: enabledStates[id] !== false,
          isFavorite: favIds.has(id),
        };
      }) || []);
    }).catch((err) => {
      if (err.name !== 'AbortError') setError(`加载音乐库失败: ${err.message}`);
    });
    return () => ctrl.abort();
  }, []);

  const filtered = useMemo(() => songs.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                       s.artist.toLowerCase().includes(search.toLowerCase());
    if (filter === 'favorites') return matchSearch && s.isFavorite;
    if (filter === 'enabled') return matchSearch && s.enabled;
    return matchSearch;
  }), [songs, search, filter]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(s => s.id)));
  };

  const toggleFavorite = (id: string) => {
    setSongs(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s);
      const favIds = new Set(updated.filter(s => s.isFavorite).map(s => s.id));
      // 保存到 claudio_favorites（与 App.tsx 共享）
      try {
        const favSongs = updated.filter(s => s.isFavorite).map(s => ({ id: s.id, name: s.name, artist: s.artist, album: s.album, duration: s.duration, fee: 0, url: null }));
        localStorage.setItem('claudio_favorites', JSON.stringify(favSongs));
      } catch { /* ignore */ }
      return updated;
    });
  };

  const toggleEnabled = (id: string) => {
    setSongs(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
      const states: Record<string, boolean> = {};
      updated.forEach(s => { states[s.id] = s.enabled; });
      saveEnabledStates(states);
      return updated;
    });
  };

  const batchSetEnabled = (enabled: boolean) => {
    if (selected.size === 0) return;
    setSongs(prev => {
      const updated = prev.map(s => selected.has(s.id) ? { ...s, enabled } : s);
      const states: Record<string, boolean> = {};
      updated.forEach(s => { states[s.id] = s.enabled; });
      saveEnabledStates(states);
      return updated;
    });
    setSelected(new Set());
  };

  return (
    <div>
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 8,
          background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)',
          color: '#ff6666', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#ff6666', cursor: 'pointer', fontSize: 16 }}>&times;</button>
        </div>
      )}
      {/* Toolbar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 200 }}>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索歌名、歌手..."
            maxLength={100}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none',
            }}
          />
          <select
            value={filter} onChange={e => setFilter(e.target.value as 'all' | 'favorites' | 'enabled')}
            style={{
              padding: '10px 14px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none',
            }}
          >
            <option value="all">全部</option>
            <option value="favorites">收藏</option>
            <option value="enabled">已启用</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => batchSetEnabled(true)} style={{
            padding: '10px 16px', borderRadius: 8,
            border: '1px solid rgba(51,255,102,0.2)', background: selected.size > 0 ? 'rgba(51,255,102,0.15)' : 'rgba(51,255,102,0.05)',
            color: '#3f6', fontSize: 12, cursor: selected.size > 0 ? 'pointer' : 'default',
            opacity: selected.size > 0 ? 1 : 0.5,
          }}>批量启用{selected.size > 0 ? ` (${selected.size})` : ''}</button>
          <button onClick={() => batchSetEnabled(false)} style={{
            padding: '10px 16px', borderRadius: 8,
            border: '1px solid rgba(255,102,102,0.2)', background: selected.size > 0 ? 'rgba(255,102,102,0.15)' : 'rgba(255,102,102,0.05)',
            color: '#ff6666', fontSize: 12, cursor: selected.size > 0 ? 'pointer' : 'default',
            opacity: selected.size > 0 ? 1 : 0.5,
          }}>批量禁用{selected.size > 0 ? ` (${selected.size})` : ''}</button>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(0,0,0,0.3)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)', overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '40px 1fr 1fr 80px 80px 80px',
          padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600,
          minWidth: 500,
        }}>
          <div><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} /></div>
          <div>歌名</div>
          <div>歌手</div>
          <div>时长</div>
          <div>状态</div>
          <div>操作</div>
        </div>

        {/* Rows */}
        {filtered.map(song => (
          <div key={song.id} style={{
            display: 'grid', gridTemplateColumns: '40px 1fr 1fr 80px 80px 80px',
            padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)',
            alignItems: 'center',
            background: selected.has(song.id) ? 'rgba(51,255,102,0.05)' : 'transparent',
            minWidth: 500,
          }}>
            <div><input type="checkbox" checked={selected.has(song.id)} onChange={() => toggleSelect(song.id)} /></div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{song.artist}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, '0')}</div>
            <div>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 10,
                background: song.enabled ? 'rgba(51,255,102,0.1)' : 'rgba(255,255,255,0.05)',
                color: song.enabled ? '#3f6' : 'rgba(255,255,255,0.3)',
              }}>{song.enabled ? '启用' : '禁用'}</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => toggleFavorite(song.id)} style={{ background: 'none', border: 'none', color: song.isFavorite ? '#ff6666' : 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}>{song.isFavorite ? '❤️' : '♡'}</button>
              <button onClick={() => toggleEnabled(song.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}>{song.enabled ? '✓' : '✗'}</button>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
        共 {filtered.length} 首歌，已选 {selected.size} 首
      </div>
    </div>
  );
}
