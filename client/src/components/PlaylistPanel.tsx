import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import type { SongInfo } from '../hooks/usePlayer.js';
import { apiUrl } from '../lib/api.js';

interface PlaylistMeta {
  id: string;
  name: string;
  description: string;
  songCount: number;
  isDefault: boolean;
  createdAt: string;
}

interface Props {
  show: boolean;
  onClose: () => void;
  accent: string;
  text: string;
  textDim: string;
  onPlay: (song: SongInfo) => void;
  currentSong: SongInfo | null;
}

type SortKey = 'name' | 'artist' | 'album';
type SortDir = 'asc' | 'desc';

export default memo(function PlaylistPanel({ show, onClose, accent, text, textDim, onPlay, currentSong }: Props) {
  const [playlists, setPlaylists] = useState<PlaylistMeta[]>([]);
  const [defaultSongs, setDefaultSongs] = useState<SongInfo[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('default');
  const [playlistSongs, setPlaylistSongs] = useState<Record<string, SongInfo[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedPlaylists, setExpandedPlaylists] = useState<Set<string>>(new Set(['default']));
  const fetchedPlaylistIds = useRef<Set<string>>(new Set());

  // 加载歌单列表
  const fetchPlaylists = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/playlists'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPlaylists(data);
    } catch (err) {
      setError('加载歌单列表失败');
      setTimeout(() => setError(null), 3000);
    }
  }, []);

  // 加载默认歌单歌曲
  const fetchDefaultSongs = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/playlist-resolved'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDefaultSongs(data.songs || []);
    } catch (err) {
      setError('加载默认歌单失败');
      setTimeout(() => setError(null), 3000);
    }
  }, []);

  // 加载指定歌单的歌曲（使用 ref 追踪已加载 ID，避免不必要的重请求）
  const fetchPlaylistSongs = useCallback(async (playlistId: string) => {
    if (playlistId === 'default' || fetchedPlaylistIds.current.has(playlistId)) return;
    fetchedPlaylistIds.current.add(playlistId);
    try {
      const res = await fetch(apiUrl(`/api/playlists/${playlistId}/songs`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPlaylistSongs(prev => ({ ...prev, [playlistId]: data.songs || [] }));
    } catch (err) {
      fetchedPlaylistIds.current.delete(playlistId); // 失败时允许重试
      setError('加载歌单歌曲失败');
      setTimeout(() => setError(null), 3000);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    if (!show) return;
    setLoading(true);
    Promise.all([fetchPlaylists(), fetchDefaultSongs()]).finally(() => setLoading(false));
  }, [show, fetchPlaylists, fetchDefaultSongs]);

  // 切换歌单时加载歌曲
  useEffect(() => {
    if (selectedPlaylistId !== 'default') {
      fetchPlaylistSongs(selectedPlaylistId);
    }
  }, [selectedPlaylistId, fetchPlaylistSongs]);

  // 排序后的歌曲列表
  const sortedSongs = useMemo(() => {
    const songs = selectedPlaylistId === 'default' ? defaultSongs : (playlistSongs[selectedPlaylistId] || []);
    const sorted = [...songs].sort((a, b) => {
      const valA = (a[sortKey] || '').toLowerCase();
      const valB = (b[sortKey] || '').toLowerCase();
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    return sorted;
  }, [selectedPlaylistId, defaultSongs, playlistSongs, sortKey, sortDir]);

  // 切换排序方向
  const toggleSortDir = useCallback(() => {
    setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  // 创建歌单
  const handleCreatePlaylist = useCallback(async () => {
    if (!newPlaylistName.trim()) return;
    try {
      const res = await fetch(apiUrl('/api/playlists'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaylistName.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewPlaylistName('');
      await fetchPlaylists();
    } catch (err) {
      setError('创建歌单失败');
      setTimeout(() => setError(null), 3000);
    }
  }, [newPlaylistName, fetchPlaylists]);

  // 删除歌单
  const handleDeletePlaylist = useCallback(async (playlistId: string) => {
    if (!confirm('确定要删除这个歌单吗？')) return;
    try {
      const res = await fetch(apiUrl(`/api/playlists/${playlistId}`), { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (selectedPlaylistId === playlistId) setSelectedPlaylistId('default');
      await fetchPlaylists();
    } catch (err) {
      setError('删除歌单失败');
      setTimeout(() => setError(null), 3000);
    }
  }, [selectedPlaylistId, fetchPlaylists]);

  // 从歌单移除歌曲
  const handleRemoveSong = useCallback(async (song: SongInfo) => {
    if (selectedPlaylistId === 'default') return;
    try {
      const res = await fetch(apiUrl(`/api/playlists/${selectedPlaylistId}/songs/${song.id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPlaylistSongs(prev => ({
        ...prev,
        [selectedPlaylistId]: (prev[selectedPlaylistId] || []).filter(s => s.id !== song.id),
      }));
      await fetchPlaylists(); // 刷新歌单列表以更新歌曲计数
    } catch (err) {
      setError('移除歌曲失败');
      setTimeout(() => setError(null), 3000);
    }
  }, [selectedPlaylistId, fetchPlaylists]);

  // 导入歌单
  const handleImport = useCallback(async () => {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) throw new Error('无效格式');
      const songs: SongInfo[] = parsed.map((item: any, index: number) => ({
        id: `import_${Date.now()}_${index}`,
        name: item.name || '未知歌曲',
        artist: item.artist || '未知歌手',
        album: item.album || '未知专辑',
        duration: 0,
        fee: 0,
        url: null,
      }));

      // 创建新歌单
      const createRes = await fetch(apiUrl('/api/playlists'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `导入歌单 ${new Date().toLocaleTimeString()}` }),
      });
      if (!createRes.ok) throw new Error(`HTTP ${createRes.status}`);
      const newPlaylist = await createRes.json();

      // 添加歌曲到歌单
      const addRes = await fetch(apiUrl(`/api/playlists/${newPlaylist.id}/songs`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songs }),
      });
      if (!addRes.ok) throw new Error(`HTTP ${addRes.status}`);

      setShowImport(false);
      setImportText('');
      await fetchPlaylists();
      setSelectedPlaylistId(newPlaylist.id);
    } catch (err) {
      setError('导入失败，请检查JSON格式');
      setTimeout(() => setError(null), 3000);
    }
  }, [importText, fetchPlaylists]);

  // 切换展开/折叠
  const toggleExpand = useCallback((playlistId: string) => {
    setExpandedPlaylists(prev => {
      const next = new Set(prev);
      if (next.has(playlistId)) next.delete(playlistId);
      else next.add(playlistId);
      return next;
    });
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, bottom: 0, width: 500, zIndex: 60,
      background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column',
    }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <span style={{ fontSize: 12, color: textDim, letterSpacing: 2, fontWeight: 600 }}>歌单管理</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: textDim, fontSize: 16, cursor: 'pointer' }}>✕</button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={{
          margin: '8px 16px', padding: '8px 12px', borderRadius: 6,
          background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)',
          color: '#fca5a5', fontSize: 11, textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {/* 主内容区：左侧歌单列表，右侧歌曲列表 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧歌单列表 */}
        <div style={{
          width: 200, borderRight: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* 创建歌单 */}
          <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={newPlaylistName}
                onChange={e => setNewPlaylistName(e.target.value)}
                placeholder="新歌单名称"
                style={{
                  flex: 1, padding: '6px 8px', borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                  color: text, fontSize: 11, outline: 'none',
                }}
              />
              <button onClick={handleCreatePlaylist} style={{
                padding: '6px 10px', borderRadius: 4, border: 'none',
                background: accent, color: '#000', fontSize: 11, cursor: 'pointer', fontWeight: 600,
              }}>+</button>
            </div>
            <button onClick={() => setShowImport(!showImport)} style={{
              marginTop: 6, width: '100%', padding: '6px', borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
              color: textDim, fontSize: 10, cursor: 'pointer',
            }}>
              {showImport ? '取消导入' : '导入歌单'}
            </button>
          </div>

          {/* 导入区域 */}
          {showImport && (
            <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder={'[\n  {"name":"歌名","artist":"歌手","album":"专辑"}\n]'}
                style={{
                  width: '100%', height: 80, padding: '8px', borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                  color: text, fontSize: 10, outline: 'none', resize: 'none',
                }}
              />
              <button onClick={handleImport} style={{
                marginTop: 6, width: '100%', padding: '6px', borderRadius: 4,
                border: 'none', background: accent, color: '#000',
                fontSize: 11, cursor: 'pointer', fontWeight: 600,
              }}>确认导入</button>
            </div>
          )}

          {/* 歌单列表 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* 默认歌单 */}
            <div
              onClick={() => { setSelectedPlaylistId('default'); toggleExpand('default'); }}
              style={{
                padding: '10px 12px', cursor: 'pointer',
                background: selectedPlaylistId === 'default' ? `${accent}15` : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: selectedPlaylistId === 'default' ? text : textDim, fontWeight: selectedPlaylistId === 'default' ? 600 : 400 }}>
                  默认歌单
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{defaultSongs.length} 首</div>
              </div>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                {expandedPlaylists.has('default') ? '▼' : '▶'}
              </span>
            </div>

            {/* 自定义歌单 */}
            {playlists.map(pl => (
              <div
                key={pl.id}
                onClick={() => { setSelectedPlaylistId(pl.id); toggleExpand(pl.id); }}
                style={{
                  padding: '10px 12px', cursor: 'pointer',
                  background: selectedPlaylistId === pl.id ? `${accent}15` : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: selectedPlaylistId === pl.id ? text : textDim, fontWeight: selectedPlaylistId === pl.id ? 600 : 400 }}>
                    {pl.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{pl.songCount} 首</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(pl.id); }}
                    style={{
                      background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                      fontSize: 10, cursor: 'pointer', padding: '2px 4px',
                    }}
                  >
                    ✕
                  </button>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                    {expandedPlaylists.has(pl.id) ? '▼' : '▶'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧歌曲列表 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* 排序控制栏 */}
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', gap: 6, alignItems: 'center',
          }}>
            <span style={{ fontSize: 10, color: textDim }}>排序:</span>
            {(['name', 'artist', 'album'] as SortKey[]).map(key => (
              <button
                key={key}
                onClick={() => {
                  if (sortKey === key) { toggleSortDir(); }
                  else { setSortKey(key); setSortDir('asc'); }
                }}
                style={{
                  padding: '3px 8px', borderRadius: 3, border: 'none',
                  background: sortKey === key ? accent : 'rgba(255,255,255,0.08)',
                  color: sortKey === key ? '#000' : textDim,
                  fontSize: 10, cursor: 'pointer', fontWeight: sortKey === key ? 600 : 400,
                }}
              >
                {key === 'name' ? '歌名' : key === 'artist' ? '歌手' : '专辑'}
                {sortKey === key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </button>
            ))}
          </div>

          {/* 歌曲列表 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: textDim }}>
                <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, animation: 'searchPulse 1s ease-in-out infinite' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, animation: 'searchPulse 1s ease-in-out 0.2s infinite' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, animation: 'searchPulse 1s ease-in-out 0.4s infinite' }} />
                </div>
                <div style={{ marginTop: 8, fontSize: 12 }}>加载中...</div>
              </div>
            ) : sortedSongs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: textDim }}>暂无歌曲</div>
            ) : (
              sortedSongs.map((song, i) => {
                const isCurrent = currentSong?.id === song.id;
                return (
                  <div
                    key={song.id}
                    onClick={() => onPlay(song)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', cursor: 'pointer',
                      background: isCurrent ? `${accent}15` : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      width: 18, fontSize: 10,
                      color: isCurrent ? accent : 'rgba(255,255,255,0.2)',
                      textAlign: 'right', fontWeight: 600,
                    }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, color: isCurrent ? text : textDim,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontWeight: isCurrent ? 500 : 300,
                      }}>
                        {song.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                        {song.artist} · {song.album}
                      </div>
                    </div>
                    {selectedPlaylistId !== 'default' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveSong(song); }}
                        style={{
                          background: 'none', border: 'none',
                          color: 'rgba(255,255,255,0.3)', fontSize: 10,
                          cursor: 'pointer', padding: '2px 4px',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
