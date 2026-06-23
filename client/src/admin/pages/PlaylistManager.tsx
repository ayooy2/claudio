import { useState, useEffect } from 'react';

interface Playlist {
  id: string;
  name: string;
  description: string;
  songCount: number;
  isDefault: boolean;
  createdAt: string;
}

export default function PlaylistManager() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    fetch('/api/playlists').then(r => r.json()).then(setPlaylists).catch(() => {});
  }, []);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const playlist: Playlist = {
      id: String(Date.now()),
      name: newName,
      description: newDesc,
      songCount: 0,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    setPlaylists(prev => [...prev, playlist]);
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>共 {playlists.length} 个歌单</div>
        <button onClick={() => setShowCreate(true)} style={{
          padding: '8px 16px', borderRadius: 8,
          border: '1px solid rgba(51,255,102,0.2)', background: 'rgba(51,255,102,0.08)',
          color: '#3f6', fontSize: 12, cursor: 'pointer',
        }}>+ 新建歌单</button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{
          background: 'rgba(0,0,0,0.3)', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.06)', padding: '20px', marginBottom: 16,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>新建歌单</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="歌单名称"
              style={{
                padding: '10px 14px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none',
              }}
            />
            <textarea
              value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="歌单描述（可选）"
              rows={3}
              style={{
                padding: '10px 14px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCreate} style={{
                padding: '8px 16px', borderRadius: 8,
                border: '1px solid rgba(51,255,102,0.2)', background: 'rgba(51,255,102,0.08)',
                color: '#3f6', fontSize: 12, cursor: 'pointer',
              }}>创建</button>
              <button onClick={() => setShowCreate(false)} style={{
                padding: '8px 16px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer',
              }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Playlist list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {playlists.map(playlist => (
          <div key={playlist.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px', borderRadius: 12,
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>
                {playlist.name}
                {playlist.isDefault && (
                  <span style={{
                    marginLeft: 8, padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(51,255,102,0.1)', color: '#3f6', fontSize: 10,
                  }}>默认</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                {playlist.description || '暂无描述'} · {playlist.songCount} 首歌
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}>编辑</button>
              <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}>删除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
