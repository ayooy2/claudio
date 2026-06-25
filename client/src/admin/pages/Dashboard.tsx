import { useState, useEffect } from 'react';
import { apiUrl } from '../../lib/api.js';

interface Stats {
  totalSongs: number;
  totalPlaylists: number;
  totalPlays: number;
  activeScenes: number;
  serverStatus: string;
  apiStatus: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalSongs: 0, totalPlaylists: 0, totalPlays: 0,
    activeScenes: 6, serverStatus: 'running', apiStatus: 'connected'
  });
  const [recentPlays, setRecentPlays] = useState<any[]>([]);

  useEffect(() => {
    // Load stats
    fetch(apiUrl('/api/playlist')).then(r => r.json()).then(data => {
      setStats(prev => ({ ...prev, totalSongs: data.total || 0 }));
    }).catch(() => {});

    // Load recent plays
    fetch(apiUrl('/api/plays/recent')).then(r => r.json()).then(setRecentPlays).catch(() => {});
  }, []);

  const statCards = [
    { label: '音乐总数', value: stats.totalSongs, icon: '🎵', color: '#3f6', desc: '来自 wyy.json 歌单' },
    { label: '歌单数量', value: stats.totalPlaylists, icon: '📋', color: '#4a9eff', desc: '已创建的歌单' },
    { label: '总播放次数', value: stats.totalPlays, icon: '▶️', color: '#ffaa44', desc: '累计播放记录' },
    { label: '活跃场景', value: stats.activeScenes, icon: '🌧️', color: '#ff6688', desc: '已启用的场景数' },
  ];

  return (
    <div>
      {/* System status */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24,
      }}>
        <div style={{
          padding: '16px 20px', borderRadius: 12,
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>服务器状态</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3f6' }} />
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>运行中</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>端口 8080</div>
        </div>
        <div style={{
          padding: '16px 20px', borderRadius: 12,
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>网易云 API</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3f6' }} />
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>已连接</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>localhost:3000</div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {statCards.map((card, i) => (
          <div key={i} style={{
            padding: '20px', borderRadius: 12,
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{card.label}</span>
              <span style={{ fontSize: 20 }}>{card.icon}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{card.desc}</div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div style={{
        background: 'rgba(0,0,0,0.3)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)', padding: '20px',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>最近播放</h3>
        {recentPlays.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
            暂无播放记录
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentPlays.slice(0, 10).map((play, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(255,255,255,0.02)',
              }}>
                <div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{play.song_name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{play.artist}</div>
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{play.played_at}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
