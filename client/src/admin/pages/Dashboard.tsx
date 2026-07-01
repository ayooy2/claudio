import { useState, useEffect, useMemo } from 'react';
import { apiUrl } from '../../lib/api.js';

interface Stats {
  totalSongs: number;
  totalPlaylists: number;
  totalPlays: number;
  activeScenes: number;
  serverStatus: string;
  apiStatus: string;
}

interface RecentPlay {
  song_name: string;
  artist: string;
  played_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalSongs: 0, totalPlaylists: 0, totalPlays: 0,
    activeScenes: 11, serverStatus: '检测中...', apiStatus: '检测中...'
  });
  const [recentPlays, setRecentPlays] = useState<RecentPlay[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();

    // 检测 API 状态
    fetch(apiUrl('/api/playlist'), { signal: ctrl.signal }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStats(prev => ({ ...prev, serverStatus: '运行中', apiStatus: '已连接' }));
      return r.json();
    }).then(data => {
      setStats(prev => ({ ...prev, totalSongs: data.total || 0 }));
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        setStats(prev => ({ ...prev, serverStatus: '异常', apiStatus: '断开' }));
        setErrors(prev => [...prev, `加载歌曲数据失败: ${err.message}`]);
      }
    });

    // 读取活跃场景数
    try {
      const saved = localStorage.getItem('claudio_scene_enabled');
      if (saved) {
        const enabledMap = JSON.parse(saved);
        const count = Object.values(enabledMap).filter(v => v === true).length;
        setStats(prev => ({ ...prev, activeScenes: count }));
      }
    } catch { /* ignore */ }

    fetch(apiUrl('/api/playlists'), { signal: ctrl.signal }).then(r => r.json()).then(data => {
      setStats(prev => ({ ...prev, totalPlaylists: Array.isArray(data) ? data.length : 0 }));
    }).catch((err) => {
      if (err.name !== 'AbortError') setErrors(prev => [...prev, `加载歌单数据失败: ${err.message}`]);
    });

    fetch(apiUrl('/api/plays/recent?limit=100'), { signal: ctrl.signal }).then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setRecentPlays(data.slice(0, 20));
        setStats(prev => ({ ...prev, totalPlays: data.length }));
      }
    }).catch((err) => {
      if (err.name !== 'AbortError') setErrors(prev => [...prev, `加载播放记录失败: ${err.message}`]);
    });

    return () => ctrl.abort();
  }, []);

  const statCards = useMemo(() => [
    { label: '音乐总数', value: stats.totalSongs, icon: '🎵', color: '#3f6', desc: '来自 wyy.json 歌单' },
    { label: '歌单数量', value: stats.totalPlaylists, icon: '📋', color: '#4a9eff', desc: '已创建的歌单' },
    { label: '总播放次数', value: stats.totalPlays, icon: '▶️', color: '#ffaa44', desc: '累计播放记录' },
    { label: '活跃场景', value: stats.activeScenes, icon: '🌧️', color: '#ff6688', desc: '已启用的场景数' },
  ], [stats]);

  return (
    <div>
      {errors.length > 0 && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 8,
          background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)',
          color: '#ff6666', fontSize: 13,
        }}>
          {errors.map((err, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < errors.length - 1 ? 4 : 0 }}>
              <span>{err}</span>
              <button onClick={() => setErrors(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#ff6666', cursor: 'pointer', fontSize: 16 }}>&times;</button>
            </div>
          ))}
        </div>
      )}
      {/* System status */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24,
      }}>
        <div style={{
          padding: '16px 20px', borderRadius: 12,
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>服务器状态</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3f6' }} />
            <span style={{ fontSize: 14, color: '#fff' }}>{stats.serverStatus}</span>
          </div>
        </div>
        <div style={{
          padding: '16px 20px', borderRadius: 12,
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>API 状态</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: stats.apiStatus === 'connected' ? '#3f6' : '#f66' }} />
            <span style={{ fontSize: 14, color: '#fff' }}>{stats.apiStatus}</span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {statCards.map(card => (
          <div key={card.label} style={{
            padding: '20px', borderRadius: 12,
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>{card.icon}</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</span>
            </div>
            <div style={{ fontSize: 13, color: '#fff', marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{card.desc}</div>
          </div>
        ))}
      </div>

      {/* Recent plays */}
      <div style={{
        padding: '20px', borderRadius: 12,
        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 16 }}>最近播放</div>
        {recentPlays.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', padding: 20 }}>暂无播放记录</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentPlays.slice(0, 10).map((play, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
              }}>
                <div>
                  <div style={{ fontSize: 13, color: '#fff' }}>{play.song_name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{play.artist}</div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  {play.played_at ? new Date(play.played_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
