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
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const fetchedPlaylistIds = useRef<Set<string>>(new Set());

  // 批量选择
  const [selectMode, setSelectMode] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());

  // 拖拽
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 移动到歌单
  const [showMoveTo, setShowMoveTo] = useState(false);

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

  // 加载指定歌单的歌曲
  const fetchPlaylistSongs = useCallback(async (playlistId: string) => {
    if (playlistId === 'default' || fetchedPlaylistIds.current.has(playlistId)) return;
    fetchedPlaylistIds.current.add(playlistId);
    try {
      const res = await fetch(apiUrl(`/api/playlists/${playlistId}/songs`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPlaylistSongs(prev => ({ ...prev, [playlistId]: data.songs || [] }));
    } catch (err) {
      fetchedPlaylistIds.current.delete(playlistId);
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

  // 当前歌单的歌曲
  const currentSongs = useMemo(() => {
    return selectedPlaylistId === 'default' ? defaultSongs : (playlistSongs[selectedPlaylistId] || []);
  }, [selectedPlaylistId, defaultSongs, playlistSongs]);

  // 排序后的歌曲列表
  const sortedSongs = useMemo(() => {
    return sortDir === 'asc' ? currentSongs : [...currentSongs].reverse();
  }, [currentSongs, sortDir]);

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
      await fetchPlaylists();
    } catch (err) {
      setError('移除歌曲失败');
      setTimeout(() => setError(null), 3000);
    }
  }, [selectedPlaylistId, fetchPlaylists]);

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    if (selectedPlaylistId === 'default' || selectedSongs.size === 0) return;
    if (!confirm(`确定要移除选中的 ${selectedSongs.size} 首歌曲吗？`)) return;
    try {
      const ids = Array.from(selectedSongs);
      const results = await Promise.allSettled(ids.map(id =>
        fetch(apiUrl(`/api/playlists/${selectedPlaylistId}/songs/${id}`), { method: 'DELETE' })
      ));
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length;
      if (failed > 0) setError(`${failed} 首歌曲移除失败`);
      else setError(null);
      setSelectedSongs(new Set());
      setSelectMode(false);
      // 刷新以确保数据一致
      fetchedPlaylistIds.current.delete(selectedPlaylistId);
      await fetchPlaylists();
      if (selectedPlaylistId !== 'default') {
        const res = await fetch(apiUrl(`/api/playlists/${selectedPlaylistId}/songs`));
        if (res.ok) {
          const data = await res.json();
          setPlaylistSongs(prev => ({ ...prev, [selectedPlaylistId]: data.songs || [] }));
        }
      }
    } catch (err) {
      setError('批量删除失败');
      setTimeout(() => setError(null), 3000);
    }
  }, [selectedPlaylistId, selectedSongs, fetchPlaylists]);

  // 移动歌曲到其他歌单
  const handleMoveToPlaylist = useCallback(async (targetPlaylistId: string) => {
    if (selectedPlaylistId === 'default' || selectedSongs.size === 0) return;
    try {
      const songsToMove = currentSongs.filter(s => selectedSongs.has(s.id));
      // 1. 先添加到目标歌单
      const addRes = await fetch(apiUrl(`/api/playlists/${targetPlaylistId}/songs`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songs: songsToMove }),
      });
      if (!addRes.ok) throw new Error(`添加失败: ${addRes.status}`);
      // 2. 从源歌单移除
      const results = await Promise.allSettled(songsToMove.map(s =>
        fetch(apiUrl(`/api/playlists/${selectedPlaylistId}/songs/${s.id}`), { method: 'DELETE' })
      ));
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length;
      if (failed > 0) setError(`${failed} 首歌曲从源歌单移除失败`);
      setSelectedSongs(new Set());
      setSelectMode(false);
      setShowMoveTo(false);
      // 刷新两个歌单
      fetchedPlaylistIds.current.delete(selectedPlaylistId);
      fetchedPlaylistIds.current.delete(targetPlaylistId);
      await fetchPlaylists();
    } catch (err) {
      setError(`移动歌曲失败: ${err instanceof Error ? err.message : ''}`);
      setTimeout(() => setError(null), 3000);
    }
  }, [selectedPlaylistId, selectedSongs, currentSongs, fetchPlaylists]);

  // 切换选中歌曲
  const toggleSongSelection = useCallback((songId: string) => {
    setSelectedSongs(prev => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedSongs.size === sortedSongs.length) {
      setSelectedSongs(new Set());
    } else {
      setSelectedSongs(new Set(sortedSongs.map(s => s.id)));
    }
  }, [selectedSongs.size, sortedSongs]);

  // 拖拽开始
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  // 拖拽经过
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  // 拖拽放下 - 重排序
  const handleDrop = useCallback(async (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex || selectedPlaylistId === 'default') {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    // 将 sortedSongs 索引转换为 currentSongs 索引（处理降序模式）
    const len = currentSongs.length;
    const realDrag = sortDir === 'desc' ? len - 1 - dragIndex : dragIndex;
    const realDrop = sortDir === 'desc' ? len - 1 - dropIndex : dropIndex;

    const songs = [...currentSongs];
    const [moved] = songs.splice(realDrag, 1);
    songs.splice(realDrop, 0, moved);

    setPlaylistSongs(prev => ({ ...prev, [selectedPlaylistId]: songs }));

    // 保存到后端
    try {
      const songIds = songs.map(s => s.id);
      await fetch(apiUrl(`/api/playlists/${selectedPlaylistId}/reorder`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songIds }),
      });
    } catch (err) {
      setError('保存排序失败');
      setTimeout(() => setError(null), 3000);
    }

    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, currentSongs, selectedPlaylistId, sortDir]);

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  // 解析导入文本为歌曲列表
  const parseImportText = useCallback((text: string): { name: string; songs: SongInfo[]; _neteaseId?: string } | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    // 1. 网易云歌单链接
    const neteaseMatch = trimmed.match(/music\.163\.com\/#\/playlist\?id=(\d+)/)
      || trimmed.match(/music\.163\.com\/playlist\?id=(\d+)/)
      || trimmed.match(/music\.163\.com\/.*[?&]id=(\d+)/);
    if (neteaseMatch) {
      return { name: `netease_${neteaseMatch[1]}`, songs: [], _neteaseId: neteaseMatch[1] };
    }

    // 2. JSON 数组
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const songs: SongInfo[] = parsed.map((item: Record<string, unknown>, index: number) => ({
            id: `import_${Date.now()}_${index}`,
            name: String(item.name || item.title || '未知歌曲'),
            artist: String(item.artist || item.singer || '未知歌手'),
            album: String(item.album || '未知专辑'),
            duration: Number(item.duration) || 0,
            fee: 0,
            url: null,
          }));
          return { name: `导入歌单 ${new Date().toLocaleTimeString()}`, songs };
        }
      } catch { /* not JSON */ }
    }

    // 3. M3U/M3U8
    if (trimmed.startsWith('#EXTM3U') || trimmed.startsWith('#EXTINF')) {
      const lines = trimmed.split('\n');
      const songs: SongInfo[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXTINF:')) {
          const infoMatch = line.match(/#EXTINF:\d+,(.+?)\s*-\s*(.+)/);
          const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
          if (infoMatch) {
            songs.push({
              id: `import_${Date.now()}_${songs.length}`,
              name: infoMatch[2].trim(),
              artist: infoMatch[1].trim(),
              album: '未知专辑',
              duration: 0, fee: 0, url: null,
            });
          } else if (nextLine && !nextLine.startsWith('#')) {
            songs.push({
              id: `import_${Date.now()}_${songs.length}`,
              name: line.replace('#EXTINF:\d+,', '').trim() || nextLine.split('/').pop() || '未知歌曲',
              artist: '未知歌手',
              album: '未知专辑',
              duration: 0, fee: 0, url: null,
            });
          }
        }
      }
      if (songs.length > 0) return { name: `导入歌单 ${new Date().toLocaleTimeString()}`, songs };
    }

    // 4. CSV/TSV
    const csvLines = trimmed.split('\n').filter(l => l.trim());
    if (csvLines.length >= 1) {
      const delimiter = csvLines[0].includes('\t') ? '\t' : ',';
      const songs: SongInfo[] = [];
      for (const line of csvLines) {
        const parts = line.split(delimiter).map(s => s.trim().replace(/^["']|["']$/g, ''));
        if (parts.length >= 2) {
          songs.push({
            id: `import_${Date.now()}_${songs.length}`,
            name: parts[0] || '未知歌曲',
            artist: parts[1] || '未知歌手',
            album: parts[2] || '未知专辑',
            duration: 0, fee: 0, url: null,
          });
        }
      }
      if (songs.length > 0) return { name: `导入歌单 ${new Date().toLocaleTimeString()}`, songs };
    }

    return null;
  }, []);

  // 导入歌单
  const handleImport = useCallback(async () => {
    try {
      const result = parseImportText(importText);
      if (!result) throw new Error('无法识别格式');

      const createRes = await fetch(apiUrl('/api/playlists'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: result.name }),
      });
      if (!createRes.ok) throw new Error(`HTTP ${createRes.status}`);
      const newPlaylist = await createRes.json();

      if (result._neteaseId) {
        const fetchRes = await fetch(apiUrl(`/api/playlist/${result._neteaseId}`));
        if (!fetchRes.ok) throw new Error('获取网易云歌单失败');
        const data = await fetchRes.json();
        const songs: SongInfo[] = (data.songs || []).map((s: Record<string, unknown>, i: number) => ({
          id: `import_${Date.now()}_${i}`,
          name: String(s.name || '未知歌曲'),
          artist: String(s.artist || '未知歌手'),
          album: String(s.album || '未知专辑'),
          duration: Number(s.duration) || 0,
          fee: Number(s.fee) || 0,
          cover: s.cover ? String(s.cover) : null,
          url: null,
        }));
        if (songs.length > 0) {
          const addRes = await fetch(apiUrl(`/api/playlists/${newPlaylist.id}/songs`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songs }),
          });
          if (!addRes.ok) throw new Error(`添加歌曲失败: ${addRes.status}`);
        }
      } else if (result.songs.length > 0) {
        const addRes = await fetch(apiUrl(`/api/playlists/${newPlaylist.id}/songs`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songs: result.songs }),
        });
        if (!addRes.ok) throw new Error(`添加歌曲失败: ${addRes.status}`);
      }

      setShowImport(false);
      setImportText('');
      await fetchPlaylists();
      setSelectedPlaylistId(newPlaylist.id);
    } catch (err) {
      setError(`导入失败: ${err instanceof Error ? err.message : '格式不支持'}`);
      setTimeout(() => setError(null), 3000);
    }
  }, [importText, fetchPlaylists, parseImportText]);

  // 点击空白处关闭
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // 退出选择模式
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedSongs(new Set());
    setShowMoveTo(false);
  }, []);

  if (!show) return null;

  return (
    <>
      {/* 点击空白处关闭 */}
      <div onClick={handleBackdropClick} style={{
        position: 'fixed', inset: 0, zIndex: 59, background: 'transparent',
      }} />

      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: 500, zIndex: 60,
        background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column',
      }}>
        <style>{`
          .playlist-scroll::-webkit-scrollbar { width: 4px; }
          .playlist-scroll::-webkit-scrollbar-track { background: transparent; }
          .playlist-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
          .playlist-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
          @keyframes searchPulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        `}</style>

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
            margin: '8px 16px', padding: '8px 12px', borderRadius: 8,
            background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)',
            color: '#fca5a5', fontSize: 11, textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* 主内容区 */}
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
                  onKeyDown={e => e.key === 'Enter' && handleCreatePlaylist()}
                  placeholder="新歌单名称"
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                    color: text, fontSize: 11, outline: 'none',
                  }}
                />
                <button onClick={handleCreatePlaylist} style={{
                  padding: '6px 10px', borderRadius: 8, border: 'none',
                  background: accent, color: '#000', fontSize: 11, cursor: 'pointer', fontWeight: 600,
                }}>+</button>
              </div>
              <button onClick={() => setShowImport(!showImport)} style={{
                marginTop: 6, width: '100%', padding: '6px', borderRadius: 8,
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
                  placeholder={'支持格式:\n• 网易云歌单链接\n  music.163.com/#/playlist?id=xxx\n• JSON: [{"name":"歌名","artist":"歌手"}]\n• M3U: #EXTINF:0,歌手 - 歌名\n• CSV: 歌名,歌手,专辑'}
                  style={{
                    width: '100%', height: 100, padding: '8px', borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                    color: text, fontSize: 10, outline: 'none', resize: 'none',
                  }}
                />
                <button onClick={handleImport} style={{
                  marginTop: 6, width: '100%', padding: '6px', borderRadius: 8,
                  border: 'none', background: accent, color: '#000',
                  fontSize: 11, cursor: 'pointer', fontWeight: 600,
                }}>确认导入</button>
              </div>
            )}

            {/* 歌单列表 */}
            <div className="playlist-scroll" style={{ flex: 1, overflow: 'auto' }}>
              {/* 默认歌单 */}
              <div
                onClick={() => { setSelectedPlaylistId('default'); exitSelectMode(); }}
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
              </div>

              {/* 自定义歌单 */}
              {playlists.map(pl => (
                <div
                  key={pl.id}
                  onClick={() => { setSelectedPlaylistId(pl.id); exitSelectMode(); }}
                  style={{
                    padding: '10px 12px', cursor: 'pointer',
                    background: selectedPlaylistId === pl.id ? `${accent}15` : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: selectedPlaylistId === pl.id ? text : textDim, fontWeight: selectedPlaylistId === pl.id ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pl.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{pl.songCount} 首</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(pl.id); }}
                    style={{
                      background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                      fontSize: 10, cursor: 'pointer', padding: '2px 6px', flexShrink: 0,
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* 右侧歌曲列表 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* 工具栏 */}
            <div style={{
              padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
            }}>
              <button onClick={toggleSortDir} style={{
                padding: '3px 8px', borderRadius: 6, border: 'none',
                background: accent, color: '#000', fontSize: 10, cursor: 'pointer', fontWeight: 600,
              }}>
                {sortDir === 'asc' ? '↑' : '↓'} 添加顺序
              </button>

              <button onClick={() => { setSelectMode(!selectMode); setSelectedSongs(new Set()); setShowMoveTo(false); }} style={{
                padding: '3px 8px', borderRadius: 6,
                border: selectMode ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.15)',
                background: selectMode ? `${accent}20` : 'transparent',
                color: selectMode ? accent : textDim, fontSize: 10, cursor: 'pointer',
              }}>
                {selectMode ? '取消' : '选择'}
              </button>

              {selectMode && (
                <>
                  <button onClick={toggleSelectAll} style={{
                    padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent', color: textDim, fontSize: 10, cursor: 'pointer',
                  }}>
                    {selectedSongs.size === sortedSongs.length ? '取消全选' : '全选'}
                  </button>

                  {selectedSongs.size > 0 && selectedPlaylistId !== 'default' && (
                    <>
                      <button onClick={handleBatchDelete} style={{
                        padding: '3px 8px', borderRadius: 6, border: 'none',
                        background: 'rgba(220,38,38,0.2)', color: '#fca5a5', fontSize: 10, cursor: 'pointer',
                      }}>
                        删除 ({selectedSongs.size})
                      </button>
                      <button onClick={() => setShowMoveTo(!showMoveTo)} style={{
                        padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
                        background: showMoveTo ? `${accent}20` : 'transparent',
                        color: showMoveTo ? accent : textDim, fontSize: 10, cursor: 'pointer',
                      }}>
                        移动到...
                      </button>
                    </>
                  )}
                </>
              )}

              {selectedPlaylistId !== 'default' && !selectMode && (
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>
                  拖拽可排序
                </span>
              )}
            </div>

            {/* 移动到歌单选择 */}
            {showMoveTo && selectMode && (
              <div style={{
                padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', gap: 6, flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 10, color: textDim, lineHeight: '22px' }}>移动到:</span>
                {playlists.filter(pl => pl.id !== selectedPlaylistId).map(pl => (
                  <button key={pl.id} onClick={() => handleMoveToPlaylist(pl.id)} style={{
                    padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent', color: textDim, fontSize: 10, cursor: 'pointer',
                  }}>
                    {pl.name}
                  </button>
                ))}
                {playlists.length <= 1 && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>暂无其他歌单</span>
                )}
              </div>
            )}

            {/* 歌曲列表 */}
            <div className="playlist-scroll" style={{ flex: 1, overflow: 'auto' }}>
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
                  const isSelected = selectedSongs.has(song.id);
                  const isDragging = dragIndex === i;
                  const isDragOver = dragOverIndex === i;

                  return (
                    <div
                      key={song.id}
                      draggable={selectedPlaylistId !== 'default' && !selectMode}
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDrop={() => handleDrop(i)}
                      onDragEnd={handleDragEnd}
                      onClick={() => selectMode ? toggleSongSelection(song.id) : onPlay(song)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', cursor: selectMode ? 'pointer' : 'grab',
                        background: isCurrent && !selectMode ? `${accent}15`
                          : isSelected ? `${accent}10`
                          : isDragOver ? 'rgba(255,255,255,0.05)'
                          : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        borderTop: isDragOver ? `2px solid ${accent}` : '2px solid transparent',
                        transition: 'background 0.2s, border 0.15s',
                        opacity: isDragging ? 0.4 : 1,
                      }}
                    >
                      {/* 选择模式: 复选框 */}
                      {selectMode && (
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          border: `1.5px solid ${isSelected ? accent : 'rgba(255,255,255,0.2)'}`,
                          background: isSelected ? accent : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, color: '#000',
                        }}>
                          {isSelected && '✓'}
                        </div>
                      )}

                      {/* 序号 / 拖拽把手 */}
                      {!selectMode && selectedPlaylistId !== 'default' && (
                        <span style={{
                          width: 18, fontSize: 10, color: 'rgba(255,255,255,0.15)',
                          textAlign: 'center', cursor: 'grab', flexShrink: 0,
                        }}>⠿</span>
                      )}
                      {!selectMode && selectedPlaylistId === 'default' && (
                        <span style={{
                          width: 18, fontSize: 10,
                          color: isCurrent ? accent : 'rgba(255,255,255,0.2)',
                          textAlign: 'right', fontWeight: 600,
                        }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      )}

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

                      {/* 单曲删除 */}
                      {!selectMode && selectedPlaylistId !== 'default' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveSong(song); }}
                          style={{
                            background: 'none', border: 'none',
                            color: 'rgba(255,255,255,0.3)', fontSize: 10,
                            cursor: 'pointer', padding: '2px 4px',
                          }}
                        >✕</button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
});
